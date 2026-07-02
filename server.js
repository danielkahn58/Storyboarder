require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { fal } = require('@fal-ai/client');
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
        content: `Analyze this script/screenplay/lyrics and extract every distinct character and every distinct location/setting.
For each character provide a name and a visual reference description (appearance, clothing, style, mood). Do NOT mention any props or held objects.
For each location provide a name and a visual reference description (environment, lighting, time of day, atmosphere, notable visual features).

Respond with valid JSON only, no markdown:
{ "characters": [{ "name": "string", "description": "string" }], "locations": [{ "name": "string", "description": "string" }] }

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
        content: `Analyze this script/screenplay/lyrics and extract every distinct character.
For each character provide a name and a visual reference description (appearance, clothing, style, mood). Do NOT mention any props or held objects.

Respond with valid JSON only, no markdown:
{ "characters": [{ "name": "string", "description": "string" }] }

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
For each location provide a name and a visual reference description (environment, lighting, time of day, atmosphere, notable visual features). Do NOT include characters or people.

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
    const promptInstruction = isLocation
      ? `You are an expert at writing AI image generation prompts. Write a description of a location/setting for use in an image generation prompt.

Output ONLY the location description — physical environment details: architecture, landscape, natural features, time of day, lighting conditions, atmosphere, textures, and mood. Do NOT include any characters or people. Do NOT include style instructions, background instructions, aspect ratio, or any technical rendering notes — those will be added separately.

Be specific and vivid. Output only the description text, nothing else.${referenceDescription ? `\n\nReference: ${referenceDescription}` : ''}`
      : `You are an expert at writing AI image generation prompts. Write a character appearance description for use in an image generation prompt.

Output ONLY the character's physical appearance: body type, face, hair, eyes, skin, clothing, and accessories. Do NOT include pose, framing, background, style, aspect ratio, or any technical rendering notes — those will be added separately.

Be specific and vivid. Output only the description text, nothing else.${referenceDescription ? `\n\nReference: ${referenceDescription}` : ''}`;

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
  log('info', 'generate-shot-images started', { prompt_chars: prompt.length, refCount: refs.length, model: refs.length >= 2 ? 'kontext-multi' : refs.length === 1 ? 'kontext-single' : 'kling' });
  const t0 = Date.now();
  try {
    let images;
    if (refs.length >= 2) {
      images = await generateShotImageKontextMulti(prompt, refs, stylePrompt);
    } else if (refs.length === 1) {
      images = await generateShotImageKontextSingle(prompt, refs[0], stylePrompt);
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

app.post('/api/generate-char-variant', async (req, res) => {
  const { prompt, referenceImageUrls } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  const refs = Array.isArray(referenceImageUrls) ? referenceImageUrls.filter(Boolean) : [];
  if (!refs.length) return res.status(400).json({ error: 'at least one character reference image required' });
  log('info', 'generate-char-variant started', { prompt, refs: refs.length });
  const t0 = Date.now();
  try {
    // Use Kontext to edit the character reference image — preserves art style
    const editPrompt = `Cartoon animated character illustration: ${prompt}. Keep the exact same cartoon art style, character design, fully clothed outfit, and colors. Only change the pose, facing direction, and expression as described.`;
    const result = await fal.subscribe('fal-ai/flux-pro/kontext/max', {
      input: {
        prompt: editPrompt,
        image_url: refs[0],
        aspect_ratio: '1:1',
        num_images: 1,
        safety_tolerance: '6',
      }
    });
    const url = result?.data?.images?.[0]?.url ?? null;
    log('info', 'generate-char-variant done', { url, ms: Date.now() - t0 });
    res.json({ url });
  } catch (e) {
    log('error', 'generate-char-variant failed', { error: e.message, ms: Date.now() - t0 });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/apply-expression', async (req, res) => {
  const { imageUrl, expression } = req.body;
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
    const imageResultUrl = result?.data?.images?.[0]?.url || null;
    res.json({ imageUrl: imageResultUrl });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/remove-background', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  try {
    const result = await fal.subscribe('fal-ai/birefnet', {
      input: { image_url: imageUrl, output_format: 'png', refine_foreground: true }
    });
    const url = result?.data?.image?.url || null;
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
    const url = result?.data?.images?.[0]?.url || null;
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log('info', `server started on port ${PORT}`, {}));
