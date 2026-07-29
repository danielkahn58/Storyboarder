// Pure data-transform functions for image/version persistence, extracted from app.js
// so they can be unit-tested with Node/Vitest without a DOM. Loaded as a plain
// <script> before app.js (see index.html), so it must not use import/export syntax —
// the UMD-lite wrapper below attaches these as globals in the browser and as
// module.exports under Node.
(function (global) {

// Replace any base64 / dataUrl blobs with null so they don't bloat the Supabase payload.
// CDN URLs (https://...) are kept as-is.
// An "image object" is any object with a dataUrl or base64 key — treated atomically, not recursed into.
function stripBase64ForSync(imgs) {
  if (!imgs) return imgs;
  function isImgObj(v) {
    return v && typeof v === 'object' && !Array.isArray(v) && ('dataUrl' in v || 'base64' in v);
  }
  function cleanImgObj(v) {
    if (!v) return v;
    const out = { ...v };
    out.base64 = null;
    const cdn = out.cdnUrl || out.url; // use Supabase/CDN URL for cross-device display
    if (cdn) out.dataUrl = cdn;
    else if (typeof out.dataUrl === 'string' && out.dataUrl.startsWith('data:')) out.dataUrl = null;
    return out;
  }
  function cleanVal(v) {
    if (!v) return v;
    if (typeof v === 'string') return v.startsWith('data:') ? null : v;
    if (isImgObj(v)) return cleanImgObj(v);
    if (Array.isArray(v)) return v.map(cleanVal);
    if (typeof v === 'object') return cleanEntry(v);
    return v;
  }
  function cleanEntry(obj) {
    if (!obj) return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = cleanVal(v);
    return out;
  }
  return {
    chars: Object.fromEntries(Object.entries(imgs.chars || {}).map(([id, v]) => [id, cleanEntry(v)])),
    locs:  Object.fromEntries(Object.entries(imgs.locs  || {}).map(([id, v]) => [id, cleanEntry(v)])),
    shots: Object.fromEntries(Object.entries(imgs.shots || {}).map(([id, v]) => [id, cleanEntry(v)])),
  };
}

// Extract all image data into a separate object, return stripped copy.
function extractImages(data) {
  const imgs = { chars: {}, locs: {}, shots: {} };
  const chars = (data.characters || []).map(c => {
    imgs.chars[c.id] = { images: c.images, referenceImage: c.referenceImage, refImages: c.refImages || [], expressionCache: c.expressionCache,
      angles: c.angles ? Object.fromEntries(Object.entries(c.angles).map(([k,v]) => [k, { image: v.image, refImage: v.refImage || null }])) : {} };
    return { ...c, images: [], referenceImage: null, refImages: [], expressionCache: {},
      angles: c.angles ? Object.fromEntries(Object.entries(c.angles).map(([k,v]) => [k, { prompt: v.prompt, useRef: v.useRef || false }])) : {} };
  });
  const locs = (data.locations || []).map(l => {
    imgs.locs[l.id] = { images: l.images, referenceImage: l.referenceImage,
      shotAngles: l.shotAngles ? Object.fromEntries(Object.entries(l.shotAngles).map(([k,v]) => [k, { image: v.image, refImage: v.refImage || null }])) : {},
      customViews: (l.customViews || []).map(cv => ({ image: cv.image, refImage: cv.refImage || null })) };
    return { ...l, images: [], referenceImage: null,
      shotAngles: l.shotAngles ? Object.fromEntries(Object.entries(l.shotAngles).map(([k,v]) => [k, { prompt: v.prompt, useRef: v.useRef || false }])) : {},
      customViews: (l.customViews || []).map(cv => ({ ...cv, image: null, refImage: null })) };
  });
  const shots = (data.shots || []).map(s => {
    imgs.shots[s.id] = { images: s.images, finalImage: s.finalImage, refImage: s.refImage, videoUrl: s.videoUrl };
    return { ...s, images: [], finalImage: null, refImage: null, videoUrl: '' };
  });
  return { stripped: { ...data, characters: chars, locations: locs, shots }, imgs };
}

// Merge images back into loaded data.
function mergeImages(data, imgs) {
  if (!imgs) return data;
  const characters = (data.characters || []).map(c => {
    const ci = imgs.chars?.[c.id] || {};
    const angles = { ...c.angles };
    for (const [k, v] of Object.entries(ci.angles || {})) {
      angles[k] = { ...(angles[k] || {}), image: v.image, refImage: v.refImage || null };
    }
    return { ...c, images: ci.images || [], referenceImage: ci.referenceImage || null,
      refImages: ci.refImages || [], expressionCache: ci.expressionCache || {}, angles };
  });
  const locations = (data.locations || []).map(l => {
    const li = imgs.locs?.[l.id] || {};
    const shotAngles = { ...l.shotAngles };
    for (const [k, v] of Object.entries(li.shotAngles || {})) {
      shotAngles[k] = { ...(shotAngles[k] || {}), image: v.image, refImage: v.refImage || null };
    }
    const customViews = (l.customViews || []).map((cv, i) => ({ ...cv, image: li.customViews?.[i]?.image || null, refImage: li.customViews?.[i]?.refImage || null }));
    return { ...l, images: li.images || [], referenceImage: li.referenceImage || null, shotAngles, customViews };
  });
  const shots = (data.shots || []).map(s => {
    const si = imgs.shots?.[s.id] || {};
    return { ...s, images: si.images || [], finalImage: si.finalImage || null,
      refImage: si.refImage || null, videoUrl: si.videoUrl || '' };
  });
  return { ...data, characters, locations, shots };
}

// When loading from Supabase, fill in any base64 images (referenceImage etc.) that
// didn't sync (because stripBase64ForSync removed them) from the local IDB copy.
function mergeLocalIntoSbImages(sbImgs, localImgs) {
  if (!localImgs) return sbImgs || {};
  if (!sbImgs) return localImgs;
  function mergeEntry(sb, local) {
    if (!local) return sb || {};
    if (!sb) return local;
    const out = { ...sb };
    for (const [k, v] of Object.entries(local)) {
      if (out[k] == null && v != null) out[k] = v; // fill in missing fields from local
      else if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') {
        out[k] = mergeEntry(out[k], v);
      }
    }
    return out;
  }
  return {
    chars: Object.fromEntries(Object.entries(localImgs.chars || {}).map(([id, v]) => [id, mergeEntry((sbImgs.chars || {})[id], v)])),
    locs:  Object.fromEntries(Object.entries(localImgs.locs  || {}).map(([id, v]) => [id, mergeEntry((sbImgs.locs  || {})[id], v)])),
    shots: Object.fromEntries(Object.entries(localImgs.shots || {}).map(([id, v]) => [id, mergeEntry((sbImgs.shots || {})[id], v)])),
  };
}

// Strip a full project data object down to the fields that get versioned:
// keeps permanent Supabase https: URLs, drops base64/blob: data.
function stripImagesForVersion(data) {
  const isUrl = v => v && typeof v === 'string' && v.startsWith('http');

  const stripChar = c => ({
    id: c.id, name: c.name, reference: c.reference, prompt: c.prompt, attributes: c.attributes,
    useRefAsDefault: c.useRefAsDefault || false,
    selectedRefImageId: c.selectedRefImageId || null,
    loraUrl: c.loraUrl || null,
    loraStatus: c.loraStatus || 'idle',
    loraTriggerWord: c.loraTriggerWord || null,
    refImages: (c.refImages || []).map(r => ({ id: r.id, url: r.url || null })),
    angles: c.angles ? Object.fromEntries(Object.entries(c.angles).map(([k, v]) => [k, {
      prompt: v.prompt,
      useRef: v.useRef || false,
      image: isUrl(v.image) ? v.image : null,
    }])) : undefined,
  });

  const stripLoc = l => ({
    id: l.id, name: l.name, aliases: l.aliases || [], reference: l.reference,
    prompt: l.prompt, possibleDuplicate: l.possibleDuplicate,
    useRefAsDefault: l.useRefAsDefault || false,
    selectedImage: isUrl(l.selectedImage) ? l.selectedImage : null,
    shotAngles: l.shotAngles ? Object.fromEntries(Object.entries(l.shotAngles).map(([k, v]) => [k, {
      prompt: v.prompt,
      useRef: v.useRef || false,
      image: isUrl(v.image) ? v.image : null,
    }])) : undefined,
    customViews: (l.customViews || []).map(cv => ({
      id: cv.id, name: cv.name || '', prompt: cv.prompt || '',
      useRef: cv.useRef || false,
      image: isUrl(cv.image) ? cv.image : null,
    })),
  });

  const stripComposeMeta = m => m ? {
    bgUrl: isUrl(m.bgUrl) ? m.bgUrl : null,
    bgColor: m.bgColor || null,
    bgMaskUrl: isUrl(m.bgMaskUrl) ? m.bgMaskUrl : null,
    globalLighting: m.globalLighting || 'none',
    globalLightingDir: m.globalLightingDir || 'none',
    globalContrast: m.globalContrast ?? 100,
    globalSaturation: m.globalSaturation ?? 100,
    bgSeparation: m.bgSeparation ?? 0,
    bgScale: m.bgScale ?? 1,
    bgOffsetX: m.bgOffsetX ?? 0,
    bgOffsetY: m.bgOffsetY ?? 0,
  } : null;
  const stripComposeLayer = l => ({
    imgUrl: isUrl(l.imgUrl) ? l.imgUrl : null,
    label: l.label, charId: l.charId || null,
    cx: l.cx, cy: l.cy, scale: l.scale, w: l.w, h: l.h,
    opacity: l.opacity ?? 1, lighting: l.lighting || 'none',
    lightingIntensity: l.lightingIntensity ?? 0.6,
    contrast: l.contrast ?? 100, saturation: l.saturation ?? 100,
  });
  const stripShot = s => ({
    id: s.id, lyric: s.lyric, description: s.description,
    imagePrompt: s.imagePrompt, videoPrompt: s.videoPrompt,
    shotSize: s.shotSize, shotAngle: s.shotAngle, shotMovement: s.shotMovement,
    characterIds: s.characterIds, locationId: s.locationId, characterDetails: s.characterDetails,
    timestamp: s.timestamp || '',
    timestampIssue: s.timestampIssue || null,
    finalImage: isUrl(s.finalImage) ? s.finalImage : null,
    videoUrl: isUrl(s.videoUrl) ? s.videoUrl : '',
    motionVideoUrl: isUrl(s.motionVideoUrl) ? s.motionVideoUrl : '',
    composeMeta: stripComposeMeta(s.composeMeta),
    composeLayers: (s.composeLayers || []).map(stripComposeLayer).filter(l => l.imgUrl),
  });

  return {
    characters: (data.characters || []).map(stripChar),
    locations:  (data.locations  || []).map(stripLoc),
    shots:      (data.shots      || []).map(stripShot),
    visualStyles: data.visualStyles,
    selectedStyleId: data.selectedStyleId,
    charGenRules: data.charGenRules,
    locationGenRules: data.locationGenRules,
    charBoilerplate: data.charBoilerplate,
    animatics: data.animatics || [],
    scriptText: data.scriptText || null,
    scriptName: data.scriptName || null,
  };
}

const api = { stripBase64ForSync, extractImages, mergeImages, mergeLocalIntoSbImages, stripImagesForVersion };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  Object.assign(global, api);
}

})(typeof window !== 'undefined' ? window : globalThis);
