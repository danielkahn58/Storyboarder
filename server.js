require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const Anthropic = require('@anthropic-ai/sdk');
const { fal } = require('@fal-ai/client');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const cron = require('node-cron');
const archiver = require('archiver');
const JSZip = require('jszip');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
app.use(express.json({ limit: '20mb' }));

// ── auth ──────────────────────────────────────────────────────────────────────

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const AUTH_ENABLED = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && ALLOWED_EMAILS.length);

if (AUTH_ENABLED) {
  app.use(session({
    secret: process.env.SESSION_SECRET || 'local-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email || !ALLOWED_EMAILS.includes(email)) {
      return done(null, false, { message: 'Email not allowed' });
    }
    return done(null, { id: profile.id, email, name: profile.displayName });
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html' }),
    (req, res) => res.redirect('/')
  );

  app.get('/auth/logout', (req, res) => {
    req.logout(() => res.redirect('/login.html'));
  });

  app.get('/auth/me', (req, res) => {
    if (req.isAuthenticated()) res.json({ email: req.user.email, name: req.user.name });
    else res.status(401).json({ error: 'not authenticated' });
  });

  // Protect everything except auth routes and login page
  app.use((req, res, next) => {
    if (req.path.startsWith('/auth/') || req.path === '/login.html') return next();
    if (req.isAuthenticated()) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'not authenticated' });
    res.redirect('/login.html');
  });
}

app.use(express.static('public', { etag: false, lastModified: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-store') }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
fal.config({ credentials: process.env.FAL_KEY });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const LOG_FILE = path.join(__dirname, 'app.log');
function log(level, message, data) {
  const entry = { time: new Date().toISOString(), level, message, ...data };
  const line = JSON.stringify(entry);
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Supabase server client ────────────────────────────────────────────────────

const sbAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

// Download a URL and upload to Supabase Storage. Returns permanent public URL.
async function persistImage(falUrl, storagePath) {
  if (!sbAdmin || !falUrl) return falUrl;
  try {
    const res = await fetch(falUrl);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = storagePath.split('.').pop() || 'jpg';
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const { error } = await sbAdmin.storage.from('images').upload(storagePath, buf, {
      contentType, upsert: true
    });
    if (error) throw error;
    const { data } = sbAdmin.storage.from('images').getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (e) {
    log('warn', 'persistImage failed — keeping fal URL', { falUrl, error: e.message });
    return falUrl; // fall back to fal URL rather than failing the request
  }
}

// Persist an array of image URLs to Storage under a given prefix.
async function persistImages(falUrls, prefix) {
  if (!sbAdmin) return falUrls;
  const ts = Date.now();
  return Promise.all(falUrls.map((url, i) => persistImage(url, `${prefix}/${ts}-${i}.jpg`)));
}

// ── Google Drive backup ───────────────────────────────────────────────────────

async function getDriveClient() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json';
  const key = JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
  return google.drive({ version: 'v3', auth });
}

async function runBackup() {
  if (!sbAdmin) { log('warn', 'backup skipped — no Supabase admin client'); return; }
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) { log('warn', 'backup skipped — no GOOGLE_DRIVE_FOLDER_ID'); return; }

  log('info', 'backup started');
  const t0 = Date.now();
  try {
    // Fetch all data from Supabase
    const [{ data: projects }, { data: snapshots }] = await Promise.all([
      sbAdmin.from('projects').select('*'),
      sbAdmin.from('project_snapshots').select('*').order('created_at', { ascending: false })
    ]);

    // List all images in Storage
    const { data: storageFiles } = await sbAdmin.storage.from('images').list('projects', { limit: 10000, recursive: true });

    // Build zip in memory
    const zip = new JSZip();
    zip.file('projects.json', JSON.stringify(projects || [], null, 2));
    zip.file('snapshots.json', JSON.stringify(snapshots || [], null, 2));
    zip.file('storage-index.json', JSON.stringify(storageFiles || [], null, 2));

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    // Upload to Google Drive
    const drive = await getDriveClient();
    const date = new Date().toISOString().split('T')[0];
    const filename = `storyboarder-backup-${date}.zip`;

    await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: 'application/zip', body: require('stream').Readable.from(zipBuf) }
    });

    // Delete backups older than 30 days
    const { data: oldFiles } = await drive.files.list({
      q: `'${folderId}' in parents and name contains 'storyboarder-backup' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc'
    });
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const f of (oldFiles?.files || [])) {
      if (new Date(f.createdTime).getTime() < cutoff) {
        await drive.files.delete({ fileId: f.id });
        log('info', 'backup pruned old file', { name: f.name });
      }
    }

    log('info', 'backup complete', { ms: Date.now() - t0, projects: projects?.length, snapshots: snapshots?.length });
  } catch (e) {
    log('error', 'backup failed', { error: e.message, ms: Date.now() - t0 });
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function extractJSON(text) {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(stripped); } catch {}
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Could not extract valid JSON from response');
}

async function extractTextFromFile(buffer, mimetype, originalname) {
  const ext = path.extname(originalname).toLowerCase();
  if (ext === '.pdf' || mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === '.docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  return buffer.toString('utf-8');
}

function applyStyle(prompt, stylePrompt) {
  if (!stylePrompt) return prompt;
  return `${prompt}, ${stylePrompt}`;
}

async function generateImages(prompt, stylePrompt) {
  const finalPrompt = applyStyle(prompt, stylePrompt);
  const tasks = Array.from({ length: 2 }, (_, i) =>
    fal.subscribe('fal-ai/kling-image/v3/text-to-image', {
      input: { prompt: finalPrompt, aspect_ratio: '16:9' }
    }).then(r => {
      const url = r?.data?.images?.[0]?.url;
      log('info', `image-task-${i + 1} done`, { url });
      return url;
    }).catch(e => {
      log('error', `image-task-${i + 1} failed`, { error: e.message, status: e.status, body: e.body });
      return null;
    })
  );
  return (await Promise.all(tasks)).filter(Boolean);
}

// Single reference: Flux Kontext
async function generateShotImageKontextSingle(prompt, referenceImageUrl, stylePrompt) {
  const finalPrompt = applyStyle(prompt, stylePrompt);
  log('info', 'kontext-single-input', { prompt: finalPrompt, image_url: referenceImageUrl });
  const tasks = Array.from({ length: 2 }, (_, i) =>
    fal.subscribe('fal-ai/flux-pro/kontext', {
      input: { prompt: finalPrompt, image_url: referenceImageUrl, aspect_ratio: '16:9', num_images: 1, safety_tolerance: '5' }
    }).then(r => {
      const url = r?.data?.images?.[0]?.url;
      log('info', `kontext-single-task-${i + 1} done`, { url });
      return url;
    }).catch(e => {
      log('error', `kontext-single-task-${i + 1} failed`, { error: e.message, status: e.status, body: e.body });
      return null;
    })
  );
  return (await Promise.all(tasks)).filter(Boolean);
}

// Multiple references: Flux Kontext Multi
async function generateShotImageKontextMulti(prompt, referenceImageUrls, stylePrompt) {
  const finalPrompt = applyStyle(prompt, stylePrompt);
  log('info', 'kontext-multi-input', { prompt: finalPrompt, image_urls: referenceImageUrls });
  const tasks = Array.from({ length: 2 }, (_, i) =>
    fal.subscribe('fal-ai/flux-pro/kontext/multi', {
      input: { prompt: finalPrompt, image_urls: referenceImageUrls, aspect_ratio: '16:9', num_images: 1, safety_tolerance: '5' }
    }).then(r => {
      const url = r?.data?.images?.[0]?.url;
      log('info', `kontext-multi-task-${i + 1} done`, { url });
      return url;
    }).catch(e => {
      log('error', `kontext-multi-task-${i + 1} failed`, { error: e.message, status: e.status, body: e.body });
      return null;
    })
  );
  return (await Promise.all(tasks)).filter(Boolean);
}

async function generateShotImageFlux2Edit(prompt, locs, chars, stylePrompt) {
  // Build image_urls with location first, then characters
  const imageUrls = [...locs, ...chars];
  // Use @imageN syntax so the model knows which image is which role
  const locLabel = locs.length === 1
    ? '@image1 is the background/location scene'
    : `@image1 through @image${locs.length} are the background/location scene`;
  const charParts = chars.map((_, i) => `@image${locs.length + i + 1}`).join(' and ');
  const charLabel = chars.length === 1
    ? `${charParts} is the character to place in the scene`
    : `${charParts} are the characters to place in the scene`;
  const finalPrompt = applyStyle(`[${locLabel}; ${charLabel}] ${prompt}`, stylePrompt);
  log('info', 'flux2-edit-input', { prompt: finalPrompt, image_urls: imageUrls });
  const tasks = Array.from({ length: 2 }, (_, i) =>
    fal.subscribe('fal-ai/flux-2-pro/edit', {
      input: { prompt: finalPrompt, image_urls: imageUrls, image_size: 'landscape_16_9', safety_tolerance: '5' }
    }).then(r => {
      const url = r?.data?.images?.[0]?.url;
      log('info', `flux2-edit-task-${i + 1} done`, { url });
      return url;
    }).catch(e => {
      log('error', `flux2-edit-task-${i + 1} failed`, { error: e.message, status: e.status, body: e.body });
      return null;
    })
  );
  return (await Promise.all(tasks)).filter(Boolean);
}

// ── routes ────────────────────────────────────────────────────────────────────

const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/transcribe-audio', audioUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  log('info', 'transcribe-audio started', { name: req.file.originalname, size: req.file.size });
  try {
    const FormData = require('form-data');
    const https = require('https');
    const { execFile } = require('child_process');
    const os = require('os');
    const path = require('path');
    const WHISPER_LIMIT = 24 * 1024 * 1024; // 24MB to stay safely under OpenAI's 25MB limit
    let audioBuffer = req.file.buffer;
    let audioFilename = req.file.originalname;
    let audioMime = req.file.mimetype;
    if (audioBuffer.length > WHISPER_LIMIT) {
      log('info', 'transcribe-audio: compressing oversized file', { size: audioBuffer.length });
      const tmpIn = path.join(os.tmpdir(), `sg-audio-in-${Date.now()}`);
      const tmpOut = path.join(os.tmpdir(), `sg-audio-out-${Date.now()}.mp3`);
      require('fs').writeFileSync(tmpIn, audioBuffer);
      await new Promise((resolve, reject) => {
        execFile('ffmpeg', ['-y', '-i', tmpIn, '-ac', '1', '-ar', '16000', '-b:a', '32k', tmpOut], (err) => {
          require('fs').unlinkSync(tmpIn);
          if (err) reject(new Error('ffmpeg compression failed: ' + err.message));
          else resolve();
        });
      });
      audioBuffer = require('fs').readFileSync(tmpOut);
      require('fs').unlinkSync(tmpOut);
      audioFilename = 'audio.mp3';
      audioMime = 'audio/mpeg';
      log('info', 'transcribe-audio: compressed', { newSize: audioBuffer.length });
    }
    const form = new FormData();
    form.append('file', audioBuffer, { filename: audioFilename, contentType: audioMime });
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
    };

    const result = await new Promise((resolve, reject) => {
      const req2 = https.request(options, r => {
        let body = '';
        r.on('data', d => body += d);
        r.on('end', () => {
          try { resolve({ status: r.statusCode, data: JSON.parse(body) }); }
          catch { reject(new Error(body)); }
        });
      });
      req2.on('error', reject);
      form.pipe(req2);
    });

    if (result.status !== 200) throw new Error(result.data?.error?.message || `HTTP ${result.status}`);
    const words = (result.data.words || []).map(w => ({ word: w.word, start: w.start, end: w.end }));
    res.json({ text: result.data.text, words });
  } catch(e) {
    log('error', 'transcribe-audio failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/parse-script', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  log('info', 'parse-script started', { name: req.file.originalname, size: req.file.size });
  const t0 = Date.now();
  try {
    const text = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this script/screenplay/lyrics and extract every distinct character or group of characters, and every distinct location/setting.

For each character:
1. Determine if the name is PLURAL (e.g. "Girls", "Backup Dancers", "The Twins"). If plural, set isPlural=true and pluralCount=3 (or the number specified in the script).
2. Extract ALL visual and behavioral attributes you can observe or clearly infer — focus on: body type, face, hair, skin tone, clothing style, and visible personality traits.
3. For each attribute, determine:
   - "text": the attribute label (e.g. "Overweight", "Short curly hair", "Wears glasses")
   - "sometimes": true if this only applies in SOME scenes/moments, false if consistent throughout
   - "reasoning": one brief sentence explaining how you derived this from the script
4. Do NOT mention props, held objects, or setting details.

For each location provide a name (prefixed with "INT." or "EXT." or "INT./EXT." exactly as it appears in the script, e.g. "INT. Coffee Shop", "EXT. Park") and a visual reference description (environment, lighting, time of day, atmosphere, notable visual features).

Respond with valid JSON only, no markdown:
{
  "characters": [
    {
      "name": "string",
      "isPlural": false,
      "pluralCount": 1,
      "attributes": [
        { "text": "string", "sometimes": false, "reasoning": "string" }
      ]
    }
  ],
  "locations": [{ "name": "string", "description": "string" }]
}

Document:
${text}`
      }]
    });
    const parsed = extractJSON(message.content[0].text);
    parsed.scriptText = text;
    log('info', 'parse-script done', { ms: Date.now() - t0, characters: parsed.characters?.length, locations: parsed.locations?.length });
    res.json(parsed);
  } catch (e) {
    log('error', 'parse-script failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/parse-characters', async (req, res) => {
  const { scriptText } = req.body;
  if (!scriptText) return res.status(400).json({ error: 'scriptText required' });
  log('info', 'parse-characters started', {});
  const t0 = Date.now();
  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this script/screenplay/lyrics and extract every distinct character or group of characters.

For each character:
1. Determine if the name is PLURAL (e.g. "Girls", "Backup Dancers", "The Twins"). If plural, set isPlural=true and pluralCount=3 (or the number specified in the script).
2. Extract ALL visual and behavioral attributes you can observe or clearly infer — focus on: body type, face, hair, skin tone, clothing style, and visible personality traits.
3. For each attribute, determine:
   - "text": the attribute label (e.g. "Overweight", "Short curly hair", "Wears glasses")
   - "sometimes": true if this only applies in SOME scenes/moments, false if consistent throughout
   - "reasoning": one brief sentence explaining how you derived this from the script
4. Do NOT mention props, held objects, or setting details.

Respond with valid JSON only, no markdown:
{
  "characters": [
    {
      "name": "string",
      "isPlural": false,
      "pluralCount": 1,
      "attributes": [
        { "text": "string", "sometimes": false, "reasoning": "string" }
      ]
    }
  ]
}

Document:
${scriptText}`
      }]
    });
    const parsed = extractJSON(message.content[0].text);
    log('info', 'parse-characters done', { ms: Date.now() - t0, count: parsed.characters?.length });
    res.json(parsed);
  } catch (e) {
    log('error', 'parse-characters failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/parse-locations', async (req, res) => {
  const { scriptText } = req.body;
  if (!scriptText) return res.status(400).json({ error: 'scriptText required' });
  log('info', 'parse-locations started', {});
  const t0 = Date.now();
  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this script/screenplay/lyrics and extract every distinct location or setting.
For each location provide a name prefixed with "INT." or "EXT." or "INT./EXT." exactly as it appears in the script (e.g. "INT. Coffee Shop", "EXT. Park"), and a visual reference description (environment, lighting, time of day, atmosphere, notable visual features). Do NOT include characters or people.

Respond with valid JSON only, no markdown:
{ "locations": [{ "name": "string", "description": "string" }] }

Document:
${scriptText}`
      }]
    });
    const parsed = extractJSON(message.content[0].text);
    log('info', 'parse-locations done', { ms: Date.now() - t0, count: parsed.locations?.length });
    res.json(parsed);
  } catch (e) {
    log('error', 'parse-locations failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-shot-sequence', async (req, res) => {
  const { scriptText, characters, locations } = req.body;
  if (!scriptText) return res.status(400).json({ error: 'scriptText required' });
  log('info', 'generate-shot-sequence started', { chars: characters?.length, locs: locations?.length });
  const t0 = Date.now();
  try {
    const charList = characters?.length
      ? `Known characters:\n${characters.map(c => `- id: "${c.id}", name: "${c.name}"`).join('\n')}`
      : 'No characters defined yet.';
    const locList = locations?.length
      ? `Known locations:\n${locations.map(l => `- id: "${l.id}", name: "${l.name}"`).join('\n')}`
      : 'No locations defined yet.';

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this script/screenplay/lyrics and generate a shot sequence — one row per distinct scene, lyric line, or action beat.

${charList}

${locList}

For each shot:
- "lyric": the exact lyric line, action, or scene text from the script
- "description": brief visual description of what should be shown on screen
- "characterIds": array of character IDs from the list above who appear in this shot (match by name, use exact IDs, empty array if none)
- "locationIds": array of location IDs from the list above for the setting of this shot (match by name, use exact IDs, empty array if none)

Respond with valid JSON only, no markdown:
{ "shots": [{ "lyric": "string", "description": "string", "characterIds": ["id1"], "locationIds": ["id1"] }] }

Document:
${scriptText}`
      }]
    });
    const parsed = extractJSON(message.content[0].text);
    log('info', 'generate-shot-sequence done', { ms: Date.now() - t0, shots: parsed.shots?.length });
    res.json(parsed);
  } catch (e) {
    log('error', 'generate-shot-sequence failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-prompt', async (req, res) => {
  const { referenceDescription, referenceImage, visualStyle, isLocation } = req.body;
  if (!referenceDescription && !referenceImage) {
    return res.status(400).json({ error: 'referenceDescription or referenceImage required' });
  }
  log('info', 'generate-prompt started', { chars: referenceDescription?.length ?? 0, hasImage: !!referenceImage, isLocation: !!isLocation });
  const t0 = Date.now();
  try {
    const userContent = [];
    if (referenceImage) {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: referenceImage.mediaType, data: referenceImage.base64 } });
    }
    const { customRules } = req.body;
    const defaultLocationRules = `- Every object, architectural feature, and environmental element MUST come directly from the reference. Do not invent new rooms, furniture, exterior features, props, or setting details not mentioned.
- You may only add adjectives and sensory details that enhance what is already described (e.g. lighting quality, texture, atmospheric mood, material finishes).
- Describe one fixed moment — single lighting condition, one time of day. No variations or transitions.
- Do NOT include any characters or people. Do NOT include style instructions, aspect ratio, or technical rendering notes.`;
    const defaultCharacterRules = `- Every physical feature, clothing item, and accessory MUST come directly from the reference. Do not invent new clothing, hairstyles, facial features, accessories, or body details not mentioned.
- You may only add adjectives and sensory details that enhance what is already described (e.g. fabric texture, color shading, material quality).
- Describe one fixed appearance — one outfit, one hairstyle, one expression. No variations.
- Do NOT include pose, framing, background, style, aspect ratio, or technical rendering notes.`;
    const rules = customRules || (isLocation ? defaultLocationRules : defaultCharacterRules);
    const promptInstruction = isLocation
      ? `You are an expert at writing AI image generation prompts. Write a 2-sentence description of a location/setting for use in an image generation prompt.
${referenceImage ? `
IMPORTANT: A reference image is provided. Describe ONLY what is visible in that image — do not add details, objects, lighting, or atmosphere that are not clearly shown. The location is shown centered in the frame from a frontal view; include that in your description.
` : ''}
STRICT RULES:
${rules}

Output ONLY the 2-sentence description, nothing else.${referenceDescription ? `\n\nReference: ${referenceDescription}` : ''}`
      : `You are an expert at writing AI image generation prompts. Write a 2-sentence description of a character's appearance for use in an image generation prompt.

STRICT RULES:
${rules}

Output ONLY the 2-sentence description, nothing else.${referenceDescription ? `\n\nReference: ${referenceDescription}` : ''}`;

    userContent.push({ type: 'text', text: promptInstruction });

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userContent }]
    });
    const prompt = message.content[0].text;
    log('info', 'generate-prompt done', { ms: Date.now() - t0, input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens });
    res.json({ prompt });
  } catch (e) {
    log('error', 'generate-prompt failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-shot-prompts', async (req, res) => {
  const { lyric, description, shotSize, shotAngle, shotMovement, position, characters, locations, visualStyle } = req.body;
  if (!lyric && !description) return res.status(400).json({ error: 'lyric or description required' });
  log('info', 'generate-shot-prompts started', { shotSize, shotAngle, shotMovement, chars: characters?.length, locs: locations?.length });
  const t0 = Date.now();
  try {
    const userContent = [];

    if (characters?.length) {
      for (const char of characters) {
        if (char.referenceImage) {
          userContent.push({ type: 'image', source: { type: 'base64', media_type: char.referenceImage.mediaType, data: char.referenceImage.base64 } });
          userContent.push({ type: 'text', text: `Reference image for character: ${char.name}` });
        }
      }
    }

    const charNames = characters?.length
      ? `\nCharacters in this shot (reference images provided separately — do NOT describe their appearance): ${characters.map(c => c.name).join(', ')}`
      : '';
    const locNames = locations?.length
      ? `\nLocations/settings in this shot (reference images provided separately — do NOT describe their appearance): ${locations.map(l => l.name).join(', ')}`
      : '';
    const positionNote = position
      ? `\nPosition: A reference image showing a stick figure at the "${position}" position (rule of thirds) is provided. The character(s) should be positioned at the ${position} of the frame.`
      : '';

    const styleNote = visualStyle ? `\nVisual style for all prompts: ${visualStyle}` : '';

    userContent.push({
      type: 'text',
      text: `You are an expert cinematographer and AI prompt writer. Generate TWO separate prompts for this shot.

Lyric/Action: ${lyric || ''}
Visual description: ${description || ''}
Shot size: ${shotSize || 'Medium Shot'}
Shot angle: ${shotAngle || 'Eye Level'}
Shot movement: ${shotMovement || 'Static'}${charNames}${locNames}${positionNote}${styleNote}

IMPORTANT: Do NOT describe the characters' physical appearance, clothing, or location appearance. Reference images for both characters and locations are passed directly to the image model — it already knows what they look like.

Generate:
1. IMAGE PROMPT: An editing instruction for Flux Kontext, a model that composes scenes from reference images using text instructions. The model already has reference images for the characters, locations${position ? ', and a position reference showing where the character should be placed in the frame' : ''} — your prompt should instruct how to compose them into this shot. Write it as a direct instruction, e.g. "Place the character in the location, medium shot, eye level, dramatic lighting from the left, tense mood." Focus on: composition, lighting, mood, shot size (${shotSize || 'Medium Shot'}), camera angle (${shotAngle || 'Eye Level'}), and how the character(s) and location relate.${position ? ` The character(s) must be positioned at the ${position} of the frame as shown in the position reference image.` : ''} Do not describe the appearance of characters or the location.
2. VIDEO PROMPT: A prompt for the VIDEO MOTION of this clip for a text-to-video AI. Describe what action/movement happens and how the camera moves (${shotMovement || 'Static'}). Do not describe character or location appearance.

Respond with valid JSON only, no markdown:
{ "imagePrompt": "string", "videoPrompt": "string" }`
    });

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userContent }]
    });
    const parsed = extractJSON(message.content[0].text);
    log('info', 'generate-shot-prompts done', { ms: Date.now() - t0 });
    res.json(parsed);
  } catch (e) {
    log('error', 'generate-shot-prompts failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-location-angle-prompts', async (req, res) => {
  const { locationPrompt, locationName, angles } = req.body;
  if (!locationPrompt && !locationName) return res.status(400).json({ error: 'locationPrompt or locationName required' });
  log('info', 'generate-location-angle-prompts started', { locationName });
  const t0 = Date.now();
  try {
    const angleList = (angles || ['Wide establishing shot', 'Reverse angle wide shot', '3/4 left shot', '3/4 right shot', 'High angle shot', 'Low angle shot']).join(', ');
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are an expert cinematographer writing AI image generation prompts for different camera angles of the same location.

Location: ${locationName || 'Unknown'}
Location description: ${locationPrompt || locationName}

For each of the following camera angles, write a single concise sentence (20-35 words) describing:
- Where the camera is positioned
- What is in the foreground of the shot
- What is in the background of the shot
Do NOT describe character appearances. Do NOT add style instructions.

Angles: ${angleList}

Respond with ONLY a JSON object mapping each angle name exactly to its prompt string. Example format:
{"Wide establishing shot": "Camera placed far back at eye level, open floor space in foreground, full room visible in background.", "Reverse angle wide shot": "..."}`
      }]
    });
    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    const prompts = JSON.parse(jsonMatch[0]);
    log('info', 'generate-location-angle-prompts done', { ms: Date.now() - t0 });
    res.json({ prompts });
  } catch (e) {
    log('error', 'generate-location-angle-prompts failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload-reference', async (req, res) => {
  const { base64, mediaType } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 required' });
  log('info', 'upload-reference started', { mediaType });
  const t0 = Date.now();
  try {
    const buffer = Buffer.from(base64, 'base64');
    const blob = new Blob([buffer], { type: mediaType || 'image/jpeg' });
    const url = await fal.storage.upload(blob);
    log('info', 'upload-reference done', { url, ms: Date.now() - t0 });
    res.json({ url });
  } catch (e) {
    log('error', 'upload-reference failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-images', async (req, res) => {
  const { prompt, stylePrompt, projectId, entityType, entityId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  log('info', 'generate-images started', { prompt_chars: prompt.length });
  const t0 = Date.now();
  try {
    const images = await generateImages(prompt, stylePrompt);
    const prefix = (projectId && entityType && entityId) ? `projects/${projectId}/${entityType}/${entityId}` : `projects/unassigned`;
    const persisted = await persistImages(images, prefix);
    log('info', 'generate-images done', { count: persisted.length, ms: Date.now() - t0 });
    res.json({ images: persisted });
  } catch (e) {
    log('error', 'generate-images failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-shot-images', async (req, res) => {
  const { prompt, referenceImageUrls, stylePrompt, charImageUrls, locImageUrls, projectId, entityType, entityId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  // Build ref list — prefer explicit char/loc split, fall back to combined array
  const chars = Array.isArray(charImageUrls) ? charImageUrls.filter(Boolean) : [];
  const locs = Array.isArray(locImageUrls) ? locImageUrls.filter(Boolean) : [];
  const hasSplit = chars.length > 0 || locs.length > 0;
  // Location image goes FIRST so Kontext uses it as the base scene to compose into.
  // Character image(s) follow so the subject is placed into that scene.
  const refs = hasSplit ? [...locs, ...chars] : (Array.isArray(referenceImageUrls) ? referenceImageUrls.filter(Boolean) : []);

  // flux-2-pro/edit handles its own @imageN prompt labeling internally
  const useFlux2Edit = chars.length >= 2;

  // For kontext-multi (1-char case), label refs in the prompt
  let finalPrompt = prompt;
  if (!useFlux2Edit && hasSplit && chars.length > 0 && locs.length > 0) {
    const locLabel = locs.length === 1 ? 'Reference image 1 is the location/background scene' : `Reference images 1–${locs.length} are the location/background scene`;
    const charLabel = `reference image ${locs.length + 1} is the character to place in the scene`;
    finalPrompt = `[${locLabel}; ${charLabel}] ${prompt}`;
  }

  const modelName = useFlux2Edit ? 'flux2-edit' : refs.length >= 2 ? 'kontext-multi' : refs.length === 1 ? 'kontext-single' : 'plain';
  log('info', 'generate-shot-images started', { prompt_chars: prompt.length, refCount: refs.length, chars: chars.length, locs: locs.length, model: modelName });
  const t0 = Date.now();
  try {
    let images;
    if (useFlux2Edit) {
      images = await generateShotImageFlux2Edit(prompt, locs, chars, stylePrompt);
    } else if (refs.length >= 2) {
      images = await generateShotImageKontextMulti(finalPrompt, refs, stylePrompt);
    } else if (refs.length === 1) {
      images = await generateShotImageKontextSingle(finalPrompt, refs[0], stylePrompt);
    } else {
      images = await generateImages(finalPrompt, stylePrompt);
    }
    const prefix = (projectId && entityType && entityId) ? `projects/${projectId}/${entityType}/${entityId}` : `projects/unassigned`;
    const persisted = await persistImages(images, prefix);
    log('info', 'generate-shot-images done', { count: persisted.length, ms: Date.now() - t0 });
    res.json({ images: persisted });
  } catch (e) {
    log('error', 'generate-shot-images failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-shot-video', async (req, res) => {
  const { prompt, referenceImageUrl } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  log('info', 'generate-shot-video started', { prompt_chars: prompt.length, hasRef: !!referenceImageUrl });
  const t0 = Date.now();
  try {
    const input = { prompt, prompt_optimizer: true };
    if (referenceImageUrl) input.subject_reference_image_url = referenceImageUrl;
    const r = await fal.subscribe('fal-ai/minimax/video-01-subject-reference', { input });
    const url = r?.data?.video?.url;
    log('info', 'generate-shot-video done', { url, ms: Date.now() - t0 });
    res.json({ url });
  } catch (e) {
    log('error', 'generate-shot-video failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

// ── Animatic generation ──────────────────────────────────────────────────────
const animaticUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } });

app.post('/api/generate-animatic', animaticUpload.single('audio'), async (req, res) => {
  const { execFile } = require('child_process');
  const os = require('os');
  const https = require('https');
  const http = require('http');

  let tmpFiles = [];
  const tmp = (ext) => { const p = path.join(os.tmpdir(), `sg-anim-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`); tmpFiles.push(p); return p; };

  try {
    const shots = JSON.parse(req.body.shots || '[]');
    if (!shots.length) return res.status(400).json({ error: 'No shots provided' });
    if (!req.file) return res.status(400).json({ error: 'No audio provided' });

    // Parse timestamps to seconds
    const toSecs = (ts) => {
      if (!ts) return null;
      const parts = ts.split(':').map(Number);
      return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
    };

    // Download a URL to a temp file
    const download = (url, dest) => new Promise((resolve, reject) => {
      const proto = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      proto.get(url, r => { r.pipe(file); file.on('finish', () => { file.close(); resolve(); }); }).on('error', reject);
    });

    // Download all shot images
    const frames = [];
    for (const shot of shots) {
      const secs = toSecs(shot.timestamp);
      if (secs === null) continue;
      let imgPath;
      if (shot.imageUrl.startsWith('data:')) {
        // base64 data URL
        const m = shot.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!m) continue;
        imgPath = tmp('.' + m[1]);
        fs.writeFileSync(imgPath, Buffer.from(m[2], 'base64'));
      } else {
        imgPath = tmp('.jpg');
        await download(shot.imageUrl, imgPath);
      }
      frames.push({ imgPath, secs });
    }

    if (!frames.length) return res.status(400).json({ error: 'No valid frames' });
    frames.sort((a, b) => a.secs - b.secs);

    // Write audio to temp file
    const audioPath = tmp('.mp3');
    fs.writeFileSync(audioPath, req.file.buffer);

    // Get audio duration via ffprobe
    const audioDuration = await new Promise((resolve) => {
      execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath], (err, stdout) => {
        resolve(err ? 120 : parseFloat(stdout.trim()) || 120);
      });
    });

    // Build concat file: each frame shown from its timestamp to the next
    const concatPath = tmp('.txt');
    let concatContent = '';
    for (let i = 0; i < frames.length; i++) {
      const start = frames[i].secs;
      const end = i + 1 < frames.length ? frames[i + 1].secs : audioDuration;
      const duration = Math.max(end - start, 0.1);
      concatContent += `file '${frames[i].imgPath}'\nduration ${duration.toFixed(3)}\n`;
    }
    // ffmpeg concat needs final file listed twice
    concatContent += `file '${frames[frames.length - 1].imgPath}'\n`;
    fs.writeFileSync(concatPath, concatContent);

    // Audio may start after first frame — need offset
    const audioOffset = frames[0].secs;
    const outputPath = tmp('.mp4');

    await new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-ss', String(audioOffset), '-i', audioPath,
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-shortest',
        outputPath
      ];
      execFile('ffmpeg', args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) reject(new Error('ffmpeg failed: ' + (stderr || err.message)));
        else resolve();
      });
    });

    const videoBuffer = fs.readFileSync(outputPath);
    res.set('Content-Type', 'video/mp4');
    res.set('Content-Disposition', 'inline; filename="animatic.mp4"');
    res.send(videoBuffer);
  } catch(e) {
    console.error('Animatic error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
  }
});

app.post('/api/create-talking-video', async (req, res) => {
  const { imageUrl, audioUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  if (!audioUrl) return res.status(400).json({ error: 'audioUrl required — load audio in the Upload Script section first' });
  log('info', 'create-talking-video started');
  const t0 = Date.now();
  try {
    const r = await fal.subscribe('fal-ai/sadtalker', {
      input: {
        source_image_url: imageUrl,
        driven_audio_url: audioUrl,
        expression_scale: 1,
        still_mode: false,
        preprocess: 'crop',
      }
    });
    const url = r?.data?.video?.url ?? null;
    log('info', 'create-talking-video done', { url, ms: Date.now() - t0 });
    res.json({ url });
  } catch (e) {
    log('error', 'create-talking-video failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-char-variant', async (req, res) => {
  const { prompt, referenceImageUrls, stylePrompt, projectId, entityId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  const refs = Array.isArray(referenceImageUrls) ? referenceImageUrls.filter(Boolean) : [];
  if (!refs.length) return res.status(400).json({ error: 'at least one character reference image required' });
  log('info', 'generate-char-variant started', { prompt, refs: refs.length });
  const t0 = Date.now();
  try {
    const fullPrompt = stylePrompt ? `${prompt}. ${stylePrompt}` : prompt;
    const editPrompt = `${fullPrompt}. Keep the exact same character design, fully clothed outfit, and colors from the reference image. Only change the pose, facing direction, and expression as described.`;
    const result = await fal.subscribe('fal-ai/flux-pro/kontext/max', {
      input: {
        prompt: editPrompt,
        image_url: refs[0],
        aspect_ratio: '1:1',
        num_images: 1,
        safety_tolerance: '6',
      }
    });
    const falUrl = result?.data?.images?.[0]?.url ?? null;
    const prefix = (projectId && entityId) ? `projects/${projectId}/chars/${entityId}` : `projects/unassigned`;
    const url = await persistImage(falUrl, `${prefix}/${Date.now()}.jpg`);
    log('info', 'generate-char-variant done', { url, ms: Date.now() - t0 });
    res.json({ url });
  } catch (e) {
    log('error', 'generate-char-variant failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/apply-expression', async (req, res) => {
  const { imageUrl, expression, projectId, entityId } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  const PROMPTS = {
    happy:     'Change only the facial expression to happy and smiling, keeping everything else identical — same character, same pose, same outfit, same art style, same background.',
    sad:       'Change only the facial expression to sad and downcast, keeping everything else identical — same character, same pose, same outfit, same art style, same background.',
    surprised: 'Change only the facial expression to wide-eyed and surprised with mouth slightly open, keeping everything else identical — same character, same pose, same outfit, same art style, same background.',
    wink:      'Change only the facial expression to a playful wink with one eye closed and a slight smile, keeping everything else identical — same character, same pose, same outfit, same art style, same background.',
    angry:     'Change only the facial expression to angry with furrowed brows and a frown, keeping everything else identical — same character, same pose, same outfit, same art style, same background.',
  };
  const prompt = PROMPTS[expression];
  if (!prompt) return res.status(400).json({ error: 'unknown expression' });
  try {
    const result = await fal.subscribe('fal-ai/flux-pro/kontext/max', {
      input: { prompt, image_url: imageUrl, aspect_ratio: '1:1', num_images: 1, safety_tolerance: '6' }
    });
    const falUrl = result?.data?.images?.[0]?.url || null;
    const prefix = (projectId && entityId) ? `projects/${projectId}/chars/${entityId}` : `projects/unassigned`;
    const imageResultUrl = await persistImage(falUrl, `${prefix}/${Date.now()}.jpg`);
    res.json({ imageUrl: imageResultUrl });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/apply-prompt', async (req, res) => {
  const { imageUrl, prompt, projectId, entityType, entityId } = req.body;
  if (!imageUrl || !prompt) return res.status(400).json({ error: 'imageUrl and prompt required' });
  try {
    const result = await fal.subscribe('fal-ai/flux-pro/kontext/max', {
      input: { prompt, image_url: imageUrl, aspect_ratio: '16:9', num_images: 1, safety_tolerance: '6' }
    });
    const falUrl = result?.data?.images?.[0]?.url ?? null;
    const prefix = (projectId && entityType && entityId) ? `projects/${projectId}/${entityType}/${entityId}` : `projects/unassigned`;
    const url = await persistImage(falUrl, `${prefix}/${Date.now()}.jpg`);
    res.json({ url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/remove-background', async (req, res) => {
  const { imageUrl, projectId, entityType, entityId } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  try {
    const result = await fal.subscribe('fal-ai/birefnet', {
      input: { image_url: imageUrl, output_format: 'png', refine_foreground: true }
    });
    const falUrl = result?.data?.image?.url || null;
    const prefix = (projectId && entityType && entityId) ? `projects/${projectId}/${entityType}/${entityId}` : `projects/unassigned`;
    const url = await persistImage(falUrl, `${prefix}/${Date.now()}-nobg.png`);
    res.json({ url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/segment-subjects', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  try {
    const result = await fal.subscribe('fal-ai/birefnet', {
      input: { image_url: imageUrl, output_format: 'png', output_mask: true }
    });
    const url = result?.data?.mask_image?.url || null;
    res.json({ url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/relight-image', async (req, res) => {
  const { imageBase64, prompt, initialLatent } = req.body;
  if (!imageBase64 || !prompt) return res.status(400).json({ error: 'imageBase64 and prompt required' });
  try {
    // Strip data URI prefix if present and upload to fal storage
    const b64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(b64, 'base64');
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const imageUrl = await fal.storage.upload(blob);

    const result = await fal.subscribe('fal-ai/iclight-v2', {
      input: {
        image_url: imageUrl,
        prompt,
        initial_latent: initialLatent || 'None',
        num_inference_steps: 28,
        guidance_scale: 5,
        output_format: 'jpeg',
        enable_safety_checker: false,
      }
    });
    const falUrl = result?.data?.images?.[0]?.url || null;
    const url = await persistImage(falUrl, `projects/unassigned/${Date.now()}-relight.jpg`);
    res.json({ url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/proxy-image', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('url required');
  const proto = url.startsWith('https') ? https : http;
  proto.get(url, imgRes => {
    res.set('Content-Type', imgRes.headers['content-type'] || 'image/png');
    res.set('Access-Control-Allow-Origin', '*');
    imgRes.pipe(res);
  }).on('error', e => res.status(500).send(e.message));
});

app.post('/api/generate-vrm', async (req, res) => {
  const { base64, mediaType } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 required' });
  log('info', 'generate-vrm started', { mediaType });
  const t0 = Date.now();
  try {
    const buffer = Buffer.from(base64, 'base64');
    const blob = new Blob([buffer], { type: mediaType || 'image/jpeg' });
    const imageUrl = await fal.storage.upload(blob);
    log('info', 'generate-vrm image uploaded', { imageUrl });

    const result = await fal.subscribe('fal-ai/trellis-2', {
      input: {
        image_url: imageUrl,
        resolution: 1024,
        ss_guidance_strength: 7.5,
        ss_sampling_steps: 12,
        shape_slat_sampling_steps: 12,
        tex_slat_sampling_steps: 12,
        decimation_target: 500000,
        texture_size: 2048,
        remesh: true,
      }
    });

    const url = result?.data?.model_glb?.url ?? null;
    log('info', 'generate-vrm done', { url, ms: Date.now() - t0 });
    res.json({ url });
  } catch (e) {
    log('error', 'generate-vrm failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fix-location-prefixes', async (req, res) => {
  const { locations, scriptText } = req.body;
  if (!locations?.length) return res.json({ locations: [] });
  try {
    const locList = locations.map((l, i) => `${i + 1}. id="${l.id}" name="${l.name}"`).join('\n');
    const scriptContext = scriptText ? `\nScript excerpt for context:\n${scriptText.slice(0, 6000)}` : '';
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `For each location below, add the correct INT., EXT., or INT./EXT. prefix to the name based on whether it is an interior, exterior, or both. If the name already has a correct prefix, leave it as-is. Preserve the original capitalisation of the rest of the name.${scriptContext}

Locations:
${locList}

Return ONLY a JSON array with this exact structure — one object per location in the same order:
[{"id":"...","name":"INT. or EXT. prefixed name"},...]`
      }]
    });
    const match = message.content[0].text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON in response');
    res.json({ locations: JSON.parse(match[0]) });
  } catch(e) {
    log('error', 'fix-location-prefixes failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/cleanup-shot-fields', async (req, res) => {
  const { shots, locations = [], characters = [], scriptText = '' } = req.body;
  if (!shots?.length) return res.json({ shots: [] });
  try {
    const locList = locations.map(l => `"${l.name}" (id: ${l.id})`).join(', ');
    const charList = characters.map(c => `"${c.name}" (id: ${c.id})`).join(', ');
    const scriptContext = scriptText ? `\nScript for reference:\n${scriptText.slice(0, 8000)}\n` : '';
    const input = shots.map((s, i) => `Shot ${i + 1} (id: ${s.id}):\n  audio: ${s.lyric || '(empty)'}\n  visual: ${s.description || '(empty)'}\n  currentLocation: ${s.locationName || '(none)'}\n  currentCharacters: ${s.characterNames || '(none)'}`).join('\n\n');
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are cleaning up shot sequence data for a storyboard.${scriptContext}
Available locations: ${locList || 'none'}
Available characters: ${charList || 'none'}

For each shot:
1. "lyric": should contain ONLY lyrics, dialogue, voiceover, sound cues, or other audio content. If correct, return the same value unchanged.
2. "description": should contain ONLY visual descriptions — what is seen on screen, camera angles, action, setting. If correct, return the same value unchanged.
3. "suggestedLocationId": if you can identify the location for this shot from the script or content, return the matching location id from the available locations list. Return null if uncertain.
4. "suggestedCharacterIds": array of character ids from the available characters list that appear in this shot. Return [] if uncertain.

Redistribute lyric/description content only if it is clearly in the wrong field. Never duplicate content. If a field is empty and the other has mixed content, split appropriately.

Return ONLY a valid JSON array, one object per shot. Escape all special characters in string values (quotes, newlines, backslashes). Do not include markdown fences or any text outside the array:
[{"id":"...","lyric":"...","description":"...","suggestedLocationId":null,"suggestedCharacterIds":[]},...]

Shots:
${input}`
      }]
    });
    const text = message.content[0].text.trim();
    // Try direct parse first, then strip markdown fences, then find array
    let cleaned;
    const attempts = [
      text,
      text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim(),
      (text.match(/\[[\s\S]*\]/) || [])[0],
    ];
    for (const attempt of attempts) {
      if (!attempt) continue;
      try { cleaned = JSON.parse(attempt); break; } catch {}
    }
    if (!cleaned) throw new Error('Could not parse JSON from response');
    res.json({ shots: cleaned });
  } catch(e) {
    log('error', 'cleanup-shot-fields failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/inpaint', async (req, res) => {
  const { imageUrl, maskUrl, prompt, projectId, entityType, entityId } = req.body;
  if (!imageUrl || !maskUrl || !prompt) return res.status(400).json({ error: 'imageUrl, maskUrl, prompt required' });
  log('info', 'inpaint started', { prompt_chars: prompt.length });
  const t0 = Date.now();
  try {
    const result = await fal.subscribe('fal-ai/flux-pro/v1/fill', {
      input: { image_url: imageUrl, mask_url: maskUrl, prompt, num_images: 1, output_format: 'jpeg', safety_tolerance: '5' }
    });
    const falUrl = result?.data?.images?.[0]?.url || null;
    if (!falUrl) throw new Error('No image returned');
    const prefix = (projectId && entityType && entityId) ? `projects/${projectId}/${entityType}/${entityId}` : `projects/unassigned`;
    const url = await persistImage(falUrl, `${prefix}/${Date.now()}-inpaint.jpg`);
    log('info', 'inpaint done', { url, ms: Date.now() - t0 });
    res.json({ url });
  } catch(e) {
    log('error', 'inpaint failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

// Manual backup trigger (auth-protected)
app.post('/api/admin/backup', async (req, res) => {
  runBackup().catch(e => log('error', 'manual backup error', { error: e.message }));
  res.json({ message: 'Backup started in background' });
});

// Nightly backup at 2am
cron.schedule('0 2 * * *', () => {
  log('info', 'cron backup triggered');
  runBackup();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => log('info', `server started on port ${PORT}`, {}));
