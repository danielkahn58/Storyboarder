require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { fal } = require('@fal-ai/client');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

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

// Single character: Flux dev image-to-image
async function generateShotImageFlux(prompt, referenceImageUrl, stylePrompt) {
  const finalPrompt = applyStyle(prompt, stylePrompt);
  log('info', 'flux-shot-input', { prompt: finalPrompt, image_url: referenceImageUrl, strength: 0.4 });
  const tasks = Array.from({ length: 2 }, (_, i) =>
    fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: { prompt: finalPrompt, image_url: referenceImageUrl, strength: 0.2, num_images: 1, image_size: 'landscape_16_9', enable_safety_checker: false }
    }).then(r => {
      const url = r?.data?.images?.[0]?.url;
      log('info', `flux-shot-task-${i + 1} done`, { url });
      return url;
    }).catch(e => {
      log('error', `flux-shot-task-${i + 1} failed`, { error: e.message, status: e.status, body: e.body });
      return null;
    })
  );
  return (await Promise.all(tasks)).filter(Boolean);
}

// Multiple characters: OmniGen with all reference images
async function generateShotImageOmniGen(prompt, referenceImageUrls, stylePrompt) {
  // Scene first, then identify each character by reference image (OmniGen pattern)
  const charRefs = referenceImageUrls.map((_, i) => `Character ${i + 1} is the person in <img><|image_${i + 1}|></img>.`).join(' ');
  const finalPrompt = applyStyle(`${prompt} ${charRefs}`, stylePrompt);
  const tasks = Array.from({ length: 2 }, (_, i) =>
    fal.subscribe('fal-ai/omnigen-v1', {
      input: { prompt: finalPrompt, input_image_urls: referenceImageUrls, num_images: 1, image_size: 'landscape_16_9', guidance_scale: 3.5, img_guidance_scale: 1.2 }
    }).then(r => {
      const url = r?.data?.images?.[0]?.url;
      log('info', `omnigen-shot-task-${i + 1} done`, { url });
      return url;
    }).catch(e => {
      log('error', `omnigen-shot-task-${i + 1} failed`, { error: e.message, status: e.status, body: e.body });
      return null;
    })
  );
  return (await Promise.all(tasks)).filter(Boolean);
}

// ── routes ────────────────────────────────────────────────────────────────────

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
        content: `Analyze this script/screenplay/lyrics and extract every distinct character.
For each character provide a name and a visual reference description (appearance, clothing, style, mood). Do NOT mention any props or held objects.

Respond with valid JSON only, no markdown:
{ "characters": [{ "name": "string", "description": "string" }] }

Document:
${text}`
      }]
    });
    const parsed = extractJSON(message.content[0].text);
    parsed.scriptText = text;
    log('info', 'parse-script done', { ms: Date.now() - t0, characters: parsed.characters?.length });
    res.json(parsed);
  } catch (e) {
    log('error', 'parse-script failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-shot-sequence', async (req, res) => {
  const { scriptText, characters } = req.body;
  if (!scriptText) return res.status(400).json({ error: 'scriptText required' });
  log('info', 'generate-shot-sequence started', { chars: characters?.length });
  const t0 = Date.now();
  try {
    const charList = characters?.length
      ? `Known characters:\n${characters.map(c => `- id: "${c.id}", name: "${c.name}"`).join('\n')}`
      : 'No characters defined yet.';

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this script/screenplay/lyrics and generate a shot sequence — one row per distinct scene, lyric line, or action beat.

${charList}

For each shot:
- "lyric": the exact lyric line, action, or scene text from the script
- "description": brief visual description of what should be shown on screen
- "characterIds": array of character IDs from the list above who appear in this shot (match by name, use exact IDs, empty array if none)

Respond with valid JSON only, no markdown:
{ "shots": [{ "lyric": "string", "description": "string", "characterIds": ["id1"] }] }

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
  const { referenceDescription, referenceImage, visualStyle } = req.body;
  if (!referenceDescription && !referenceImage) {
    return res.status(400).json({ error: 'referenceDescription or referenceImage required' });
  }
  log('info', 'generate-prompt started', { chars: referenceDescription?.length ?? 0, hasImage: !!referenceImage });
  const t0 = Date.now();
  try {
    const userContent = [];
    if (referenceImage) {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: referenceImage.mediaType, data: referenceImage.base64 } });
    }
    const styleNote = visualStyle ? `\nVisual style: ${visualStyle} — write the prompt to match this style.` : '';
    userContent.push({
      type: 'text',
      text: `You are an expert at writing AI image generation prompts. Generate a prompt for a character reference sheet following this structure:

"character reference sheet, [full character description], multiple views in one image: front full-body, three-quarter full-body, side profile, plus [N] headshots showing [expressions], neutral light-gray studio backdrop, even soft lighting, consistent character, 16:9 aspect ratio"

Important: Do NOT include any props, objects, weapons, accessories, or items being held or carried. Focus only on the character's physical appearance and clothing.${styleNote}

Fill in the bracketed sections based on the character reference. Be specific and vivid. Output only the final prompt text, nothing else.${referenceDescription ? `\n\nReference description: ${referenceDescription}` : ''}`
    });

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
  const { lyric, description, shotSize, shotAngle, shotMovement, characters, visualStyle } = req.body;
  if (!lyric && !description) return res.status(400).json({ error: 'lyric or description required' });
  log('info', 'generate-shot-prompts started', { shotSize, shotAngle, shotMovement, chars: characters?.length });
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

    const styleNote = visualStyle ? `\nVisual style for all prompts: ${visualStyle}` : '';

    userContent.push({
      type: 'text',
      text: `You are an expert cinematographer and AI prompt writer. Generate TWO separate prompts for this shot.

Lyric/Action: ${lyric || ''}
Visual description: ${description || ''}
Shot size: ${shotSize || 'Medium Shot'}
Shot angle: ${shotAngle || 'Eye Level'}
Shot movement: ${shotMovement || 'Static'}${charNames}${styleNote}

IMPORTANT: Do NOT describe the characters' physical appearance or clothing in either prompt. Reference images are passed directly to the image model to handle character consistency — your prompts should only describe the scene, environment, lighting, mood, composition, and camera movement.

Generate:
1. IMAGE PROMPT: A prompt for a still image of the OPENING FRAME of this clip. Describe the static composition — character positions (not appearance), environment, lighting, mood, shot framing. This is for a text-to-image AI. Do not describe motion or character appearance.
2. VIDEO PROMPT: A prompt for the VIDEO MOTION of this clip. Describe what action/movement happens during the clip, and how the camera moves (${shotMovement || 'Static'}). This is for a text-to-video AI. Do not describe character appearance.

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

app.post('/api/generate-images', async (req, res) => {
  const { prompt, stylePrompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  log('info', 'generate-images started', { prompt_chars: prompt.length });
  const t0 = Date.now();
  try {
    const images = await generateImages(prompt, stylePrompt);
    log('info', 'generate-images done', { count: images.length, ms: Date.now() - t0 });
    res.json({ images });
  } catch (e) {
    log('error', 'generate-images failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-shot-images', async (req, res) => {
  const { prompt, referenceImageUrls, stylePrompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  const refs = Array.isArray(referenceImageUrls) ? referenceImageUrls.filter(Boolean) : [];
  log('info', 'generate-shot-images started', { prompt_chars: prompt.length, refCount: refs.length, model: refs.length >= 2 ? 'omnigen' : refs.length === 1 ? 'flux-img2img' : 'kling' });
  const t0 = Date.now();
  try {
    let images;
    if (refs.length >= 2) {
      images = await generateShotImageOmniGen(prompt, refs, stylePrompt);
    } else if (refs.length === 1) {
      images = await generateShotImageFlux(prompt, refs[0], stylePrompt);
    } else {
      images = await generateImages(prompt, stylePrompt);
    }
    log('info', 'generate-shot-images done', { count: images.length, ms: Date.now() - t0 });
    res.json({ images });
  } catch (e) {
    log('error', 'generate-shot-images failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log('info', `server started on port ${PORT}`, {}));
