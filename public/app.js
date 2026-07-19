// Restore built-ins corrupted by browser extensions.
// Uses Object.defineProperty to override getters, and for-loop polyfills as fallback.
// No Array/Object prototype methods are used anywhere in this block.
(function() {
  // Force-install a method using defineProperty (handles getter-based corruption).
  // If the native method is already a real function, reinstall it as configurable:false
  // so browser extensions cannot override it later (e.g. via MutationObserver callbacks).
  function forceInstall(proto, name, impl) {
    try {
      var desc = Object.getOwnPropertyDescriptor(proto, name);
      // Use native if it's a real function; otherwise fall back to our polyfill.
      var fn = (desc && desc.value && typeof desc.value === 'function') ? desc.value : impl;
      // Lock it down so extensions cannot redefine it after this point.
      Object.defineProperty(proto, name, { value: fn, writable: true, enumerable: false, configurable: false });
    } catch(e) {
      try { proto[name] = impl; } catch(e2) {} // last resort
    }
  }

  var AP = Array.prototype;

  forceInstall(AP, 'map', function(fn, ctx) {
    var r = [], i;
    for (i = 0; i < this.length; i++) if (i in this) r[r.length] = fn.call(ctx, this[i], i, this);
    return r;
  });
  forceInstall(AP, 'filter', function(fn, ctx) {
    var r = [], i;
    for (i = 0; i < this.length; i++) if ((i in this) && fn.call(ctx, this[i], i, this)) r[r.length] = this[i];
    return r;
  });
  forceInstall(AP, 'forEach', function(fn, ctx) {
    for (var i = 0; i < this.length; i++) if (i in this) fn.call(ctx, this[i], i, this);
  });
  forceInstall(AP, 'find', function(fn, ctx) {
    for (var i = 0; i < this.length; i++) if ((i in this) && fn.call(ctx, this[i], i, this)) return this[i];
  });
  forceInstall(AP, 'findIndex', function(fn, ctx) {
    for (var i = 0; i < this.length; i++) if ((i in this) && fn.call(ctx, this[i], i, this)) return i;
    return -1;
  });
  forceInstall(AP, 'some', function(fn, ctx) {
    for (var i = 0; i < this.length; i++) if ((i in this) && fn.call(ctx, this[i], i, this)) return true;
    return false;
  });
  forceInstall(AP, 'every', function(fn, ctx) {
    for (var i = 0; i < this.length; i++) if ((i in this) && !fn.call(ctx, this[i], i, this)) return false;
    return true;
  });
  forceInstall(AP, 'reduce', function(fn, init) {
    var i = 0, acc;
    if (arguments.length < 2) { while (i < this.length && !(i in this)) i++; acc = this[i++]; } else acc = init;
    for (; i < this.length; i++) if (i in this) acc = fn(acc, this[i], i, this);
    return acc;
  });
  forceInstall(AP, 'includes', function(v) {
    for (var i = 0; i < this.length; i++) if (this[i] === v || (v !== v && this[i] !== this[i])) return true;
    return false;
  });
  forceInstall(AP, 'indexOf', function(v, from) {
    for (var i = (from || 0); i < this.length; i++) if (this[i] === v) return i;
    return -1;
  });
  forceInstall(AP, 'join', function(sep) {
    sep = sep === undefined ? ',' : '' + sep;
    var r = '';
    for (var i = 0; i < this.length; i++) { if (i) r += sep; if (this[i] != null) r += this[i]; }
    return r;
  });
  forceInstall(AP, 'flat', function(depth) {
    depth = depth === undefined ? 1 : +depth;
    function f(arr, d) {
      var r = [], i, v;
      for (i = 0; i < arr.length; i++) {
        v = arr[i];
        if (d > 0 && v && typeof v === 'object' && typeof v.length === 'number') { var s = f(v, d-1); for (var j=0;j<s.length;j++) r[r.length]=s[j]; }
        else r[r.length] = v;
      }
      return r;
    }
    return f(this, depth);
  });
  forceInstall(AP, 'flatMap', function(fn, ctx) {
    var r = [], i, v, j;
    for (i = 0; i < this.length; i++) {
      v = fn.call(ctx, this[i], i, this);
      if (v && typeof v === 'object' && typeof v.length === 'number') { for (j=0;j<v.length;j++) r[r.length]=v[j]; }
      else r[r.length] = v;
    }
    return r;
  });
  forceInstall(AP, 'sort', function(cmp) {
    // Simple insertion sort — only used as polyfill fallback
    for (var i = 1; i < this.length; i++) {
      var key = this[i], j = i - 1;
      while (j >= 0 && (cmp ? cmp(this[j], key) > 0 : ('' + this[j]) > ('' + key))) { this[j+1] = this[j]; j--; }
      this[j+1] = key;
    }
    return this;
  });
  forceInstall(AP, 'splice', function(start, deleteCount) {
    var len = this.length, i, removed = [];
    if (start < 0) start = Math.max(len + start, 0); else start = Math.min(start, len);
    if (deleteCount === undefined) deleteCount = len - start;
    deleteCount = Math.min(Math.max(deleteCount, 0), len - start);
    for (i = 0; i < deleteCount; i++) removed[i] = this[start + i];
    var addCount = arguments.length - 2, diff = addCount - deleteCount;
    if (diff > 0) { for (i = len - 1; i >= start + deleteCount; i--) this[i + diff] = this[i]; }
    else if (diff < 0) { for (i = start + deleteCount; i < len; i++) this[i + diff] = this[i]; }
    for (i = 0; i < addCount; i++) this[start + i] = arguments[i + 2];
    this.length = len + diff;
    return removed;
  });
  forceInstall(AP, 'slice', function(s, e) {
    var len = this.length, r = [], i;
    if (s < 0) s = Math.max(len + s, 0); else s = Math.min(s || 0, len);
    if (e === undefined) e = len; else if (e < 0) e = Math.max(len + e, 0); else e = Math.min(e, len);
    for (i = s; i < e; i++) r[r.length] = this[i];
    return r;
  });
  forceInstall(AP, 'push', function() {
    for (var i = 0; i < arguments.length; i++) this[this.length] = arguments[i];
    return this.length;
  });
  forceInstall(AP, 'pop', function() {
    if (!this.length) return undefined;
    var v = this[this.length - 1]; this.length--; return v;
  });
  forceInstall(AP, 'shift', function() {
    if (!this.length) return undefined;
    var v = this[0];
    for (var i = 1; i < this.length; i++) this[i-1] = this[i];
    this.length--; return v;
  });
  forceInstall(AP, 'unshift', function() {
    var n = arguments.length, i;
    for (i = this.length - 1; i >= 0; i--) this[i + n] = this[i];
    for (i = 0; i < n; i++) this[i] = arguments[i];
    return this.length;
  });
  forceInstall(AP, 'reverse', function() {
    for (var i = 0, j = this.length-1; i < j; i++, j--) { var t=this[i]; this[i]=this[j]; this[j]=t; }
    return this;
  });
  forceInstall(AP, 'fill', function(v, s, e) {
    var len = this.length;
    s = s === undefined ? 0 : (s < 0 ? Math.max(len+s,0) : Math.min(s,len));
    e = e === undefined ? len : (e < 0 ? Math.max(len+e,0) : Math.min(e,len));
    for (; s < e; s++) this[s] = v;
    return this;
  });
  forceInstall(AP, 'lastIndexOf', function(v, from) {
    var i = from === undefined ? this.length-1 : from;
    for (; i >= 0; i--) if (this[i] === v) return i;
    return -1;
  });
  forceInstall(AP, 'copyWithin', function(t, s, e) {
    var len = this.length;
    t = t < 0 ? Math.max(len+t,0) : Math.min(t,len);
    s = s < 0 ? Math.max(len+s,0) : Math.min(s||0,len);
    e = e === undefined ? len : (e < 0 ? Math.max(len+e,0) : Math.min(e,len));
    var count = Math.min(e-s, len-t), i;
    if (s < t && t < s+count) { for (i=count-1;i>=0;i--) this[t+i]=this[s+i]; }
    else { for (i=0;i<count;i++) this[t+i]=this[s+i]; }
    return this;
  });

  if (typeof Array.isArray !== 'function') {
    try { Array.isArray = function(v) { return Object.prototype.toString.call(v) === '[object Array]'; }; } catch(e) {}
  }
  if (typeof Array.from !== 'function') {
    try { Array.from = function(v, fn, ctx) {
      var r = [], i;
      for (i = 0; i < v.length; i++) r[i] = fn ? fn.call(ctx, v[i], i) : v[i];
      return r;
    }; } catch(e) {}
  }
  if (typeof Array.of !== 'function') {
    try { Array.of = function() { var r=[]; for(var i=0;i<arguments.length;i++) r[i]=arguments[i]; return r; }; } catch(e) {}
  }
})();


// ── state ──────────────────────────────────────────────────────────────────
let characters = [];
let locations = [];
let shots = [];
let selectedStyleId = '';
let visualStyles = [
  { id: 'style-photo', name: 'Photorealistic', prompt: 'Photorealistic, hyperrealistic, cinematic photography, 8k, sharp detail.' },
  { id: 'style-2d',    name: '2D Animation',   prompt: '2D animation style. Clean bold line art, smooth cel-shading, bright saturated colors. No shadows on background.' },
  { id: 'style-3d',    name: '3D Animation',   prompt: '3D animation style, Pixar-inspired, smooth subsurface scattering, soft studio lighting, vibrant colors, clean render.' },
];
// Keep legacy alias for server calls that still send visualStyle as a string
Object.defineProperty(window, 'visualStyle', { get: () => selectedStyleId, set: v => { selectedStyleId = v; } });

let CHAR_BOILERPLATE = 'ONE character. ONE pose. Front view only. Single figure centered in frame. Do NOT show multiple views, do NOT show side or back angles, do NOT create a turnaround sheet. Full body from head to toe, character fills the full height of the frame. Solid flat white background only — no background elements, no scenery.';
let debugMode = false;

// ── generation rules ──────────────────────────────────────────────────────
const DEFAULT_CHAR_RULES = `- Only describe the character's clothing, hairstyle, physique, and facial expression. Do not make reference to any props or accessories.
- Describe the character with clothes — not naked or without clothes.
- Describe one fixed appearance — one outfit, one hairstyle, one expression. No variations.
- Do NOT include pose, framing, background, style, aspect ratio, or technical rendering notes.`;

const DEFAULT_LOC_RULES = `- Every object, architectural feature, and environmental element MUST come directly from the reference. Do not invent new rooms, furniture, exterior features, props, or setting details not mentioned.
- You may only add adjectives and sensory details that enhance what is already described (e.g. lighting quality, texture, atmospheric mood, material finishes).
- Describe one fixed moment — single lighting condition, one time of day. No variations or transitions.
- Do NOT include any characters or people. Do NOT include style instructions, aspect ratio, or technical rendering notes.`;

let charGenRules = DEFAULT_CHAR_RULES;
let locationGenRules = DEFAULT_LOC_RULES;

// ── projects ──────────────────────────────────────────────────────────────
let projects = []; // { id, name, createdAt, updatedAt }
let currentProjectId = null;

// ── versioning ────────────────────────────────────────────────────────────
let versions = []; // { id, label, parentLabel, data, timestamp }
let currentVersionLabel = null;
let editsSinceVersion = 0;
let _lastAutoSnapshotTime = 0;
const AUTO_VERSION_EVERY = 100;

let lastScriptText = null;
let lastScriptName = null;

const SHOT_SIZES     = ['Extreme Wide Shot','Wide Shot','Medium Wide Shot','Medium Shot','Medium Close Up','Close Up','Extreme Close Up'];
const SHOT_ANGLES    = ["Eye Level","Low Angle","High Angle","Bird's Eye View","Worm's Eye View","Dutch Angle","Over the Shoulder"];
const SHOT_MOVEMENTS = ['Static','Pan Left','Pan Right','Tilt Up','Tilt Down','Slow Zoom In','Slow Zoom Out','Dolly In','Dolly Out','Tracking Shot','Handheld','Crane Up','Crane Down','Whip Pan'];

function genId() { return Math.random().toString(36).slice(2, 9); }

// ── Supabase ──────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ecgoffhladapojwxngfx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NP1omtMIQ9fTtjLcWtQHzw_ercGkQR3';

function getSB() {
  if (!window._sb) window._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return window._sb;
}

async function sbGetProjects() {
  try {
    const { data, error } = await getSB().from('projects').select('id,name,updated_at');
    if (error) throw error;
    return (data || []).map(p => ({ id: p.id, name: p.name, updatedAt: p.updated_at, createdAt: p.updated_at }));
  } catch(e) { console.warn('sb load projects:', e.message); return null; }
}

async function sbUpsertMeta(proj) {
  try {
    await getSB().from('projects')
      .upsert({ id: proj.id, name: proj.name, updated_at: proj.updatedAt }, { onConflict: 'id' });
  } catch(e) { console.warn('sb upsert meta:', e.message); }
}

async function sbUpsertData(id, stripped, imgs) {
  const proj = projects.find(p => p.id === id);
  try {
    const { error } = await getSB().from('projects').upsert({
      id, name: proj?.name || 'Untitled', updated_at: Date.now(),
      data: stripped, images: imgs
    }, { onConflict: 'id' });
    if (error) throw error;
  } catch(e) {
    console.warn('sb upsert data:', e.message);
    showToast('Cloud sync failed — data saved locally only.', true);
  }
}

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

async function sbSaveSnapshot(projectId, label, isAuto, stripped, imgs) {
  try {
    const strippedImgs = stripBase64ForSync(imgs);
    await apiFetch('/api/snapshots', {
      projectId, label: label || null, auto: isAuto, data: stripped, images: strippedImgs
    });
  } catch(e) { console.warn('snapshot save failed:', e.message); }
}

async function sbGetSnapshots(projectId) {
  try {
    const data = await apiFetch(`/api/snapshots/${projectId}`, null, 'GET');
    return data || [];
  } catch(e) { console.warn('snapshot fetch failed:', e.message); return []; }
}

async function sbRestoreSnapshot(snapshotId, projectId) {
  try {
    const data = await apiFetch(`/api/snapshots/${projectId}/${snapshotId}`, null, 'GET');
    return data;
  } catch(e) { console.warn('snapshot restore failed:', e.message); return null; }
}

async function sbGetData(id) {
  try {
    const { data, error } = await getSB().from('projects').select('data,images').eq('id', id).single();
    if (error) throw error;
    return data;
  } catch(e) { console.warn('sb get data:', e.message); return null; }
}

async function sbDelete(id) {
  try { await getSB().from('projects').delete().eq('id', id); }
  catch(e) { console.warn('sb delete:', e.message); }
}

// ── IndexedDB image store ─────────────────────────────────────────────────
// Images are large (base64 / CDN URLs); we keep them out of localStorage
// (5 MB quota) and store them here instead.
let _idb = null;
function openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open('sg-images', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('images');
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror  = () => rej(req.error);
  });
}
async function idbSet(key, val) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('images', 'readwrite');
    tx.objectStore('images').put(val, key);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('images', 'readonly');
    const req = tx.objectStore('images').get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

// Extract all image data into a separate object, return stripped copy.
function extractImages(data) {
  const imgs = { chars: {}, locs: {}, shots: {} };
  const chars = (data.characters || []).map(c => {
    imgs.chars[c.id] = { images: c.images, referenceImage: c.referenceImage, expressionCache: c.expressionCache,
      angles: c.angles ? Object.fromEntries(Object.entries(c.angles).map(([k,v]) => [k, { image: v.image, refImage: v.refImage || null }])) : {} };
    return { ...c, images: [], referenceImage: null, expressionCache: {},
      angles: c.angles ? Object.fromEntries(Object.entries(c.angles).map(([k,v]) => [k, { prompt: v.prompt, useRef: v.useRef || false }])) : {} };
  });
  const locs = (data.locations || []).map(l => {
    imgs.locs[l.id] = { images: l.images, referenceImage: l.referenceImage,
      shotAngles: l.shotAngles ? Object.fromEntries(Object.entries(l.shotAngles).map(([k,v]) => [k, { image: v.image, refImage: v.refImage || null }])) : {},
      customViews: (l.customViews || []).map(cv => ({ image: cv.image, refImage: cv.refImage || null })) };
    return { ...l, images: [], referenceImage: null,
      shotAngles: l.shotAngles ? Object.fromEntries(Object.entries(l.shotAngles).map(([k,v]) => [k, { prompt: v.prompt }])) : {},
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
      expressionCache: ci.expressionCache || {}, angles };
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

// Thin wrapper: given already-parsed saved data + imgs, produce { stripped, imgs } for sbUpsertData
function _buildPayloadFromSaved(data, imgs) {
  return { stripped: data, imgs: imgs || {} };
}

// ── persistence ───────────────────────────────────────────────────────────
// ── project management ────────────────────────────────────────────────────
function projectDataKey(id)     { return `sg-data-${id}`; }
function projectVersionsKey(id) { return `sg-versions-${id}`; }

async function loadProjects() {
  // Load local projects immediately so UI is never blank
  let localProjects = [];
  try {
    const saved = localStorage.getItem('sg-projects');
    if (saved) { const p = JSON.parse(saved); localProjects = Array.isArray(p) ? p : []; }
  } catch {}
  projects = localProjects;
  renderProjectsView();

  // Try Supabase in background — only update if it returns something useful
  const sbProjects = await sbGetProjects();
  if (sbProjects !== null) {
    if (sbProjects.length === 0 && localProjects.length > 0) {
      // First time using Supabase: migrate local projects up
      projects = localProjects;
      await migrateLocalProjectsToSupabase();
    } else if (sbProjects.length > 0) {
      projects = sbProjects;
      localStorage.setItem('sg-projects', JSON.stringify(projects));
      renderProjectsView();
    }
    // If sbProjects is empty and localProjects is also empty, nothing to do
  }
  // Supabase unavailable → already showing localProjects, nothing to do
}

async function migrateLocalProjectsToSupabase() {
  showToast('Migrating projects to cloud…');
  for (const proj of projects) {
    try {
      const key = projectDataKey(proj.id);
      const saved = localStorage.getItem(key);
      const stripped = saved ? JSON.parse(saved) : null;
      const imgs = await idbGet(key).catch(() => null);
      await getSB().from('projects').upsert({
        id: proj.id, name: proj.name, updated_at: proj.updatedAt || Date.now(),
        data: stripped, images: imgs
      }, { onConflict: 'id' });
    } catch(e) { console.warn('Migration failed for', proj.id, e.message); }
  }
  showToast('Projects synced to cloud ✓');
}

function saveProjects() {
  // Keep local cache in sync; Supabase is updated by sbUpsertMeta/sbUpsertData
  localStorage.setItem('sg-projects', JSON.stringify(projects));
}

function createProject() {
  const name = prompt('Project name:');
  if (name === null) return; // cancelled
  const id = genId();
  const proj = { id, name: name.trim() || 'Untitled', createdAt: Date.now(), updatedAt: Date.now() };
  projects.push(proj);
  saveProjects();
  sbUpsertMeta(proj);
  openProject(id);
}

async function openProject(id) {
  clearTimeout(_saveTimer); // prevent any pending debounced save from writing empty data to the new project
  _lastAutoSnapshotTime = 0;
  currentProjectId = id;
  localStorage.setItem('sg-last-project', id);
  versions = []; currentVersionLabel = null; editsSinceVersion = 0;
  characters = []; locations = []; shots = [];
  visualStyles = [
    { id: 'style-photo', name: 'Photorealistic', prompt: 'Photorealistic, hyperrealistic, cinematic photography, 8k, sharp detail.' },
    { id: 'style-2d',    name: '2D Animation',   prompt: '2D animation style. Clean bold line art, smooth cel-shading, bright saturated colors. No shadows on background.' },
    { id: 'style-3d',    name: '3D Animation',   prompt: '3D animation style, Pixar-inspired, smooth subsurface scattering, soft studio lighting, vibrant colors, clean render.' },
  ];
  selectedStyleId = 'style-photo';
  const proj = projects.find(p => p.id === id);
  if (proj) { proj.updatedAt = Date.now(); saveProjects(); }
  document.getElementById('view-projects').style.display = 'none';
  document.getElementById('view-editor').style.display = 'block';
  renderHeader();
  initSectionNav();
  const overlay = document.getElementById('data-loading-overlay');
  if (overlay) overlay.style.display = 'flex';
  try {
    await loadData();
  } finally {
    if (overlay) overlay.style.display = 'none';
  }
}

function backToProjects() {
  clearTimeout(_saveTimer); // prevent debounced save firing after project is cleared
  localStorage.removeItem('sg-last-project');
  localStorage.removeItem('sg-last-tab');
  autoSave();
  currentProjectId = null;
  document.getElementById('view-editor').style.display = 'none';
  document.getElementById('view-projects').style.display = 'block';
  renderHeader();
  renderProjectsView();
}

async function duplicateProject(id) {
  const src = projects.find(p => p.id === id);
  if (!src) return;
  const baseName = src.name.replace(/ #\d+$/, '');
  let suffix = 2;
  while (projects.find(p => p.name === `${baseName} #${suffix}`)) suffix++;
  const newName = `${baseName} #${suffix}`;
  const newId = genId();
  const now = Date.now();
  // Copy localStorage text data
  const srcData = localStorage.getItem(projectDataKey(id));
  if (srcData) localStorage.setItem(projectDataKey(newId), srcData);
  // Copy IDB image data
  let imgs = null;
  try {
    imgs = await idbGet(projectDataKey(id));
    if (imgs) await idbSet(projectDataKey(newId), imgs);
  } catch(e) { console.warn('IDB duplicate failed:', e); }
  // Copy audio
  try {
    const audioFile = await idbGet(`audio-${id}-file`);
    if (audioFile) await idbSet(`audio-${newId}-file`, audioFile);
    const audioTranscript = await idbGet(`audio-${id}-transcript`);
    if (audioTranscript) await idbSet(`audio-${newId}-transcript`, audioTranscript);
  } catch(e) { console.warn('Audio duplicate failed:', e); }
  const newProj = { id: newId, name: newName, createdAt: now, updatedAt: now };
  projects.push(newProj);
  saveProjects();
  // Mirror duplicate to Supabase
  try {
    const sbSrc = await sbGetData(id);
    await getSB().from('projects').upsert({
      id: newId, name: newName, updated_at: now,
      data: sbSrc?.data || (srcData ? JSON.parse(srcData) : null),
      images: sbSrc?.images || imgs
    }, { onConflict: 'id' });
  } catch(e) { console.warn('sb duplicate failed:', e.message); }
  renderProjectsView();
  showToast(`Duplicated as "${newName}"`);
}

function deleteProject(id) {
  if (!confirm('Delete this project and all its versions? This cannot be undone.')) return;
  projects = projects.filter(p => p.id !== id);
  localStorage.removeItem(projectDataKey(id));
  localStorage.removeItem(projectVersionsKey(id));
  saveProjects();
  sbDelete(id);
  renderProjectsView();
}

function renameProject(id, name) {
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  const trimmed = name.trim() || 'Untitled';
  proj.name = trimmed;
  proj.updatedAt = Date.now();
  saveProjects();
  sbUpsertMeta(proj);
  if (currentProjectId === id) renderHeader();
}

function startRenameProject(id, e) {
  e.stopPropagation();
  const nameEl = document.getElementById(`proj-name-${id}`);
  if (!nameEl) return;
  const current = nameEl.textContent;
  nameEl.innerHTML = `<input class="project-card-name-input" value="${esc(current)}" onclick="event.stopPropagation()" onblur="finishRenameProject('${id}',this)" onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){this.value='${esc(current)}';this.blur();}">`;
  const inp = nameEl.querySelector('input');
  inp.focus(); inp.select();
}

function finishRenameProject(id, inp) {
  renameProject(id, inp.value);
  renderProjectsView();
}

function renderProjectsView() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;
  let sorted = [];
  try { sorted = (Array.isArray(projects) ? [...projects] : []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); } catch(e) { console.warn('sort failed:', e); }
  if (!Array.isArray(sorted)) sorted = [];
  grid.innerHTML = `
    <button class="btn-new-project" onclick="createProject()">
      <span class="plus">+</span>
      <span>New Project</span>
    </button>
    ${sorted.map(p => {
      const versionData = localStorage.getItem(projectVersionsKey(p.id));
      let vCount = 0;
      try { const vd = JSON.parse(versionData); vCount = vd?.versions?.length || 0; } catch {}
      return `
        <div class="project-card" onclick="openProject('${p.id}')">
          <div class="project-card-name" id="proj-name-${p.id}">${esc(p.name)}</div>
          <div class="project-card-meta">Edited ${timeAgo(p.updatedAt)}${vCount ? ` · ${vCount} version${vCount !== 1 ? 's' : ''}` : ''}</div>
          <div class="project-card-footer">
            <button class="btn-open-project" onclick="event.stopPropagation();openProject('${p.id}')">Open →</button>
            <div style="display:flex;gap:4px;">
              <button class="btn-delete-project" onclick="event.stopPropagation();duplicateProject('${p.id}')" title="Duplicate" style="font-size:13px">⧉</button>
              <button class="btn-delete-project" onclick="event.stopPropagation();startRenameProject('${p.id}',event)" title="Rename">✏️</button>
              <button class="btn-delete-project" onclick="event.stopPropagation();deleteProject('${p.id}')" title="Delete">✕</button>
            </div>
          </div>
        </div>`;
    }).join('')}
  `;
}

let _authUser = null;
async function loadAuthUser() {
  try {
    const r = await fetch('/auth/me');
    if (r.ok) _authUser = await r.json();
  } catch(e) {}
}

function userBadgeHTML() {
  if (!_authUser) return '';
  return `<div style="display:flex;align-items:center;gap:8px;border-left:1px solid #222;padding-left:12px;margin-left:4px;">
    <span style="font-size:12px;color:#555;">${esc(_authUser.email)}</span>
    <a href="/auth/logout" style="font-size:12px;color:#444;text-decoration:none;border:1px solid #222;border-radius:5px;padding:5px 10px;transition:all 0.15s;" onmouseover="this.style.color='#aaa';this.style.borderColor='#444'" onmouseout="this.style.color='#444';this.style.borderColor='#222'">Sign out</a>
  </div>`;
}

function renderHeader() {
  const el = document.getElementById('main-header');
  if (!el) return;
  if (!currentProjectId) {
    // Projects view header
    el.innerHTML = `<div class="header-main"><h1>Storyboard Generator</h1>${userBadgeHTML()}</div>`;
    return;
  }
  const proj = projects.find(p => p.id === currentProjectId);
  const name = proj?.name || 'Project';
  el.innerHTML = `
    <div class="header-main">
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="btn-back-projects" onclick="backToProjects()">← Projects</button>
        <div class="header-divider"></div>
        <span class="header-project-name" title="Click to rename" onclick="promptRenameCurrentProject()">${esc(name)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div id="version-ui" class="version-bar"></div>
        <a href="/vrm-builder.html" style="color:#818cf8;font-size:13px;text-decoration:none;font-weight:500;padding:7px 14px;border:1px solid #2e2e50;border-radius:6px;background:#1a1a2e;">VRM Builder</a>
        <a href="/reference.html" style="color:#818cf8;font-size:13px;text-decoration:none;font-weight:500;padding:7px 14px;border:1px solid #2e2e50;border-radius:6px;background:#1a1a2e;">Reference Images</a>
        <button id="btn-debug-toggle" onclick="toggleDebugMode()" style="background:none;border:1px solid #222;border-radius:6px;color:#444;font-size:12px;padding:7px 12px;cursor:pointer;">Debug</button>
        <button class="save-btn" onclick="saveData()">Save</button>
        ${userBadgeHTML()}
      </div>
    </div>
    <nav class="section-nav">
      <button class="section-nav-btn active" id="nav-btn-config" onclick="switchMainTab('config')">Configuration</button>
      <button class="section-nav-btn" id="nav-btn-characters" onclick="switchMainTab('characters')">Characters</button>
      <button class="section-nav-btn" id="nav-btn-locations" onclick="switchMainTab('locations')">Locations</button>
      <button class="section-nav-btn" id="nav-btn-shots" onclick="switchMainTab('shots')">Shot Sequence</button>
      <button class="section-nav-btn" id="nav-btn-avscript" onclick="switchMainTab('avscript')">AV Script</button>
      <button class="section-nav-btn" id="nav-btn-animatic" onclick="switchMainTab('animatic')">Animatic</button>
    </nav>
  `;
  renderVersionUI();
  // Restore debug button state
  if (debugMode) {
    const btn = document.getElementById('btn-debug-toggle');
    if (btn) { btn.style.color='#e05050'; btn.style.borderColor='#5a1a1a'; btn.style.background='#1a0505'; }
  }
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const headerH = document.getElementById('main-header')?.offsetHeight || 0;
  const y = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

function initSectionNav() {
  // Tabs are now click-driven; no scroll observer needed.
  // Default to Configuration tab on project open.
  switchMainTab('config');
}

function promptRenameCurrentProject() {
  const proj = projects.find(p => p.id === currentProjectId);
  if (!proj) return;
  const name = prompt('Rename project:', proj.name);
  if (name !== null) { renameProject(currentProjectId, name); }
}

async function initApp() {
  await loadAuthUser();
  renderHeader();
  renderProjectsView(); // show loading state immediately
  await loadProjects();
  renderProjectsView(); // re-render once projects are loaded from Supabase
  // Restore last session: reopen the project and tab the user was on
  const lastProject = localStorage.getItem('sg-last-project');
  const lastTab = localStorage.getItem('sg-last-tab');
  if (lastProject && projects.find(p => p.id === lastProject)) {
    await openProject(lastProject);
    if (lastTab) switchMainTab(lastTab);
  }
}

async function loadData() {
  loadVersions();
  try {
    const key = currentProjectId ? projectDataKey(currentProjectId) : 'character-generator-data';
    let saved = null;
    let imgs = null;

    // Read local data as baseline before touching Supabase
    const localSaved = localStorage.getItem(key);
    let localImgs = null;
    try { localImgs = await idbGet(key); } catch {}
    const localCharCount = (() => { try { return JSON.parse(localSaved)?.characters?.length || 0; } catch { return 0; } })();

    // Try Supabase — only trust it if it has actual content, or local is also empty
    if (currentProjectId) {
      const sbRow = await sbGetData(currentProjectId);
      const sbCharCount = sbRow?.data?.characters?.length || 0;
      if (sbRow?.data && (sbCharCount > 0 || localCharCount === 0)) {
        saved = JSON.stringify(sbRow.data);
        imgs = sbRow.images || {};
        try { localStorage.setItem(key, saved); } catch {}
        try { await idbSet(key, imgs); } catch {}
      }
    }

    // Fall back to local if Supabase unavailable or had less data
    if (!saved) {
      saved = localSaved;
      imgs = localImgs;
    }

    if (saved) {
      let d = JSON.parse(saved);
      if (imgs) d = mergeImages(d, imgs);
      characters = d.characters || []; locations = d.locations || []; shots = d.shots || [];
      if (d.visualStyles) {
        const LEGACY = new Set(['style-anime','style-comic','style-wc','style-oil','Anime','Comic Book','Watercolor','Oil Painting']);
        const filtered = d.visualStyles.filter(s => !LEGACY.has(s.id) && !LEGACY.has(s.name));
        // Always ensure the 3 default styles exist; merge saved custom styles on top
        const defaults = [
          { id: 'style-photo', name: 'Photorealistic', prompt: 'Photorealistic, hyperrealistic, cinematic photography, 8k, sharp detail.' },
          { id: 'style-2d',    name: '2D Animation',   prompt: '2D animation style. Clean bold line art, smooth cel-shading, bright saturated colors. No shadows on background.' },
          { id: 'style-3d',    name: '3D Animation',   prompt: '3D animation style, Pixar-inspired, smooth subsurface scattering, soft studio lighting, vibrant colors, clean render.' },
        ];
        const merged = [...defaults];
        for (const s of filtered) {
          if (!merged.find(m => m.id === s.id)) merged.push(s);
        }
        visualStyles = merged;
      }
      selectedStyleId = d.selectedStyleId && visualStyles.find(s => s.id === d.selectedStyleId) ? d.selectedStyleId : (visualStyles[0]?.id || '');
      if (d.charGenRules) charGenRules = d.charGenRules;
      if (d.locationGenRules) locationGenRules = d.locationGenRules;
      if (d.charBoilerplate) CHAR_BOILERPLATE = d.charBoilerplate;
      if (d.scriptText) { lastScriptText = d.scriptText; lastScriptName = d.scriptName || null; }
    }
  } catch {}
  if (!characters.length) characters = [newCharacter()];
  if (!locations.length) locations = [newLocation()];
  // Remove legacy global script key
  localStorage.removeItem('character-generator-script');
  applyStyleUI();
  renderScriptPreview();
  renderCharacters();
  renderLocations();
  renderShots();
  renderVersionUI();
  restoreAudio();
  prefetchCharBgRemovals();
  migrateRefImages();
}

// Silently re-upload any ref images still on fal.media to Supabase Storage
async function migrateRefImages() {
  const isFal = url => typeof url === 'string' && (url.includes('fal.media') || url.includes('fal.run'));
  let changed = false;

  const migrateRef = async (entity, entityType) => {
    const ref = entity.referenceImage;
    if (!ref) return;
    const src = ref.url || (typeof ref.dataUrl === 'string' && !ref.dataUrl.startsWith('data:') ? ref.dataUrl : null);
    if (!src || !isFal(src)) return;
    try {
      const r = await apiFetch('/api/reupload-ref', { url: src, projectId: currentProjectId, entityType, entityId: entity.id });
      if (r.url) { entity.referenceImage = { ...ref, url: r.url, dataUrl: r.url }; changed = true; }
    } catch (e) { console.warn('migrateRefImages ref failed for', entity.id, e); }
  };

  const migrateImages = async (entity, entityType) => {
    if (!entity.images?.length) return;
    const newImages = await Promise.all(entity.images.map(async url => {
      if (!isFal(url)) return url;
      try {
        const r = await apiFetch('/api/reupload-ref', { url, projectId: currentProjectId, entityType, entityId: entity.id });
        if (r.url) { changed = true; return r.url; }
      } catch (e) { console.warn('migrateRefImages images failed for', entity.id, e); }
      return url;
    }));
    entity.images = newImages;
  };

  for (const c of characters) { await migrateRef(c, 'chars'); await migrateImages(c, 'chars'); }
  for (const l of locations) { await migrateRef(l, 'locs'); await migrateImages(l, 'locs'); }

  if (changed) { renderCharacters(); renderLocations(); autoSave(); }
}

async function prefetchCharBgRemovals() {
  const pending = characters.filter(c => (c.images?.length || c.referenceImage) && !c.bgRemovedImage);
  for (const c of pending) {
    try {
      let imageUrl = charDefaultImage(c) || c.images[0];
      if (imageUrl?.startsWith('data:')) {
        const b64 = imageUrl.split(',')[1];
        const uploaded = await apiFetch('/api/upload-reference', { base64: b64, mediaType: 'image/jpeg' });
        imageUrl = uploaded.url;
      }
      const data = await apiFetch('/api/remove-background', { imageUrl });
      const bgRemovedUrl = data.url;
      if (bgRemovedUrl) {
        c.bgRemovedImage = bgRemovedUrl;
        autoSave();
        renderShots(); // refresh previews as each one completes
      }
    } catch(e) { /* silently skip if removal fails */ }
  }
}

function _buildPayload() {
  return { characters, locations, shots, visualStyles, selectedStyleId, charGenRules, locationGenRules, charBoilerplate: CHAR_BOILERPLATE, scriptText: lastScriptText || null, scriptName: lastScriptName || null, savedAt: Date.now() };
}

async function _persistData(key) {
  const { stripped, imgs } = extractImages(_buildPayload());
  // Local cache
  try {
    localStorage.setItem(key, JSON.stringify(stripped));
  } catch(e) {
    console.warn('localStorage quota hit, clearing old project data:', e.message);
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sg-data-') && k !== key) { localStorage.removeItem(k); break; }
      }
      localStorage.setItem(key, JSON.stringify(stripped));
    } catch(e2) { console.error('localStorage save failed:', e2.message); }
  }
  try { await idbSet(key, imgs); } catch(e) { console.warn('IDB save failed:', e.message); }
  // Sync to Supabase (fire and forget) — only if we have real content to avoid overwriting with empty state
  if (currentProjectId && (characters.length > 0 || locations.length > 0 || shots.length > 0)) {
    sbUpsertData(currentProjectId, stripped, imgs);
    // Auto-snapshot every 10 minutes
    const now = Date.now();
    if (now - _lastAutoSnapshotTime > 10 * 60 * 1000) {
      _lastAutoSnapshotTime = now;
      sbSaveSnapshot(currentProjectId, null, true, stripped, imgs);
    }
  }
}

function saveData() {
  syncFromDOM();
  const key = currentProjectId ? projectDataKey(currentProjectId) : 'character-generator-data';
  _persistData(key);
  if (currentProjectId) {
    const proj = projects.find(p => p.id === currentProjectId);
    if (proj) { proj.updatedAt = Date.now(); saveProjects(); }
  }
  // Update the snapshot stored in the current version so switching away and back shows latest saved state
  if (currentVersionLabel) {
    const v = versions.find(v => v.label === currentVersionLabel);
    if (v) {
      v.data = stripImagesForVersion({ characters, locations, shots, visualStyles, selectedStyleId, charGenRules, locationGenRules, charBoilerplate: CHAR_BOILERPLATE });
      v.timestamp = Date.now();
      saveVersionMeta();
    }
  }
  const btn = document.querySelector('.save-btn');
  if (btn) { btn.textContent = 'Saved!'; btn.classList.add('saved'); setTimeout(() => { btn.textContent = 'Save'; btn.classList.remove('saved'); }, 1800); }
}

function autoSave() {
  syncFromDOM();
  const key = currentProjectId ? projectDataKey(currentProjectId) : 'character-generator-data';
  _persistData(key);
  if (currentProjectId) {
    const proj = projects.find(p => p.id === currentProjectId);
    if (proj) { proj.updatedAt = Date.now(); saveProjects(); }
  }
  editsSinceVersion++;
  if (editsSinceVersion >= AUTO_VERSION_EVERY) {
    createVersion(true);
  } else {
    saveVersionMeta();
    const el = document.getElementById('version-edit-count');
    if (el) el.textContent = `${editsSinceVersion}/${AUTO_VERSION_EVERY}`;
  }
}

let _saveTimer = null;
function debouncedSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(autoSave, 400);
}

function saveVersionMeta() {
  const key = currentProjectId ? projectVersionsKey(currentProjectId) : 'character-generator-versions';
  // If the save fails due to quota, trim oldest auto-versions one at a time until it fits
  for (let attempt = 0; attempt < versions.length; attempt++) {
    try {
      localStorage.setItem(key, JSON.stringify({ versions, currentVersionLabel, editsSinceVersion }));
      return;
    } catch (e) {
      // Drop the oldest auto-version; if no auto-versions left, drop the oldest overall
      const dropIdx = versions.findIndex(v => v.auto);
      if (dropIdx !== -1) versions.splice(dropIdx, 1);
      else if (versions.length > 1) versions.shift();
      else return; // can't trim further
    }
  }
}

function loadVersions() {
  try {
    const key = currentProjectId ? projectVersionsKey(currentProjectId) : 'character-generator-versions';
    const saved = localStorage.getItem(key);
    if (saved) {
      const d = JSON.parse(saved);
      versions = Array.isArray(d.versions) ? d.versions : [];
      currentVersionLabel = d.currentVersionLabel ?? null;
      editsSinceVersion = d.editsSinceVersion || 0;
    }
  } catch {}
}

function stripImagesForVersion(data) {
  // Remove all image data before storing in a version snapshot.
  // Images are large and fal CDN URLs expire anyway — only text/prompts matter for versioning.
  const stripChar = c => ({ id: c.id, name: c.name, reference: c.reference, prompt: c.prompt, attributes: c.attributes, angles: c.angles ? Object.fromEntries(Object.entries(c.angles).map(([k,v]) => [k, { prompt: v.prompt }])) : undefined });
  const stripLoc  = l => ({ id: l.id, name: l.name, aliases: l.aliases || [], reference: l.reference, prompt: l.prompt, possibleDuplicate: l.possibleDuplicate, shotAngles: l.shotAngles ? Object.fromEntries(Object.entries(l.shotAngles).map(([k,v]) => [k, { prompt: v.prompt }])) : undefined });
  const stripShot = s => ({ id: s.id, lyric: s.lyric, description: s.description, imagePrompt: s.imagePrompt, videoPrompt: s.videoPrompt, shotSize: s.shotSize, shotAngle: s.shotAngle, shotMovement: s.shotMovement, characterIds: s.characterIds, locationId: s.locationId, characterDetails: s.characterDetails });
  return {
    characters: (data.characters || []).map(stripChar),
    locations:  (data.locations  || []).map(stripLoc),
    shots:      (data.shots      || []).map(stripShot),
    visualStyles: data.visualStyles,
    selectedStyleId: data.selectedStyleId,
    charGenRules: data.charGenRules,
    locationGenRules: data.locationGenRules,
    charBoilerplate: data.charBoilerplate,
  };
}

function createVersion(isAuto = false) {
  syncFromDOM();
  // Determine if we're on the latest version at this level or have reverted to an older one.
  // "Latest" means no version exists that is a child of currentVersionLabel's parent
  // and was created after the current version's timestamp.
  const currentV = versions.find(v => v.label === currentVersionLabel);
  const currentTs = currentV ? currentV.timestamp : 0;
  const currentParent = currentV ? currentV.parentLabel : null;
  // Siblings share the same parentLabel as currentVersionLabel
  const siblings = versions.filter(v => v.parentLabel === currentParent);
  const isLatestSibling = !siblings.some(v => v.timestamp > currentTs);

  let label;
  if (!currentVersionLabel) {
    // No current version — top-level
    const topLevel = versions.filter(v => !v.parentLabel);
    label = String(topLevel.length + 1);
  } else if (isLatestSibling) {
    // We're on the latest at this level — iterate (e.g. 1.1 → 1.2)
    const parts = currentVersionLabel.split('.');
    parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
    label = parts.join('.');
  } else {
    // We've reverted to an older version — branch (e.g. revert to 1.1, create 1.1.1)
    const children = versions.filter(v => v.parentLabel === currentVersionLabel);
    label = `${currentVersionLabel}.${children.length + 1}`;
  }
  // newParent: when iterating, new version has same parent as current; when branching, current becomes the parent
  const newParent = (!currentVersionLabel || isLatestSibling) ? currentParent : currentVersionLabel;
  versions.push({
    id: genId(),
    label,
    parentLabel: newParent,
    data: stripImagesForVersion({ characters, locations, shots, visualStyles, selectedStyleId, charGenRules, locationGenRules, charBoilerplate: CHAR_BOILERPLATE }),
    timestamp: Date.now(),
    auto: isAuto
  });
  currentVersionLabel = label;
  editsSinceVersion = 0;
  saveVersionMeta();
  renderVersionUI();
  // Save named versions to Supabase snapshots table
  if (!isAuto && currentProjectId) {
    const { stripped, imgs } = extractImages(_buildPayload());
    sbSaveSnapshot(currentProjectId, label, false, stripped, imgs);
    const btn = document.getElementById('btn-new-version');
    if (btn) { btn.classList.add('saved-flash'); setTimeout(() => btn.classList.remove('saved-flash'), 1500); }
  }
}

function loadVersion(label) {
  if (!label) return;
  const v = versions.find(v => v.label === label);
  if (!v) return;
  // Save current state into the current version snapshot before switching
  if (currentVersionLabel) {
    const cur = versions.find(v => v.label === currentVersionLabel);
    if (cur) {
      syncFromDOM();
      cur.data = stripImagesForVersion({ characters, locations, shots, visualStyles, selectedStyleId, charGenRules, locationGenRules, charBoilerplate: CHAR_BOILERPLATE });
      cur.timestamp = Date.now();
      const key = currentProjectId ? projectDataKey(currentProjectId) : 'character-generator-data';
      _persistData(key);
    }
  }
  const d = v.data;
  // Restore text/prompt data from the version, but preserve current images
  // (version snapshots intentionally strip images to save space).
  const prevChars = characters; const prevLocs = locations; const prevShots = shots;
  characters = (d.characters || []).map(vc => {
    const cur = prevChars.find(c => c.id === vc.id) || {};
    return { ...newCharacter(), images: cur.images || [], referenceImage: cur.referenceImage || null, ...vc };
  });
  locations = (d.locations || []).map(vl => {
    const cur = prevLocs.find(l => l.id === vl.id) || {};
    const mergedAngles = {};
    for (const [k, va] of Object.entries(vl.shotAngles || {})) {
      mergedAngles[k] = { prompt: va.prompt, image: cur.shotAngles?.[k]?.image || null };
    }
    return { ...newLocation(), images: cur.images || [], referenceImage: cur.referenceImage || null, selectedImage: cur.selectedImage || null, ...vl, shotAngles: mergedAngles };
  });
  shots = (d.shots || []).map(vs => {
    const cur = prevShots.find(s => s.id === vs.id) || {};
    return { ...newShot(), images: cur.images || [], videoUrl: cur.videoUrl || '', ...vs };
  });
  if (d.visualStyles) {
    const LEGACY = new Set(['style-anime','style-comic','style-wc','style-oil','Anime','Comic Book','Watercolor','Oil Painting']);
    const filtered = d.visualStyles.filter(s => !LEGACY.has(s.id) && !LEGACY.has(s.name));
    const defaults = [
      { id: 'style-photo', name: 'Photorealistic', prompt: 'Photorealistic, hyperrealistic, cinematic photography, 8k, sharp detail.' },
      { id: 'style-2d',    name: '2D Animation',   prompt: '2D animation style. Clean bold line art, smooth cel-shading, bright saturated colors. No shadows on background.' },
      { id: 'style-3d',    name: '3D Animation',   prompt: '3D animation style, Pixar-inspired, smooth subsurface scattering, soft studio lighting, vibrant colors, clean render.' },
    ];
    const merged = [...defaults];
    for (const s of filtered) { if (!merged.find(m => m.id === s.id)) merged.push(s); }
    visualStyles = merged;
  }
  selectedStyleId = d.selectedStyleId && visualStyles.find(s => s.id === d.selectedStyleId)
    ? d.selectedStyleId : (visualStyles[0]?.id || '');
  if (d.charGenRules) charGenRules = d.charGenRules;
  if (d.locationGenRules) locationGenRules = d.locationGenRules;
  if (d.charBoilerplate) CHAR_BOILERPLATE = d.charBoilerplate;
  currentVersionLabel = label;
  editsSinceVersion = 0;
  const _lk = currentProjectId ? projectDataKey(currentProjectId) : 'character-generator-data';
  _persistData(_lk);
  saveVersionMeta();
  applyStyleUI();
  renderVisualStyles();
  renderCharacters();
  renderLocations();
  renderShots();
  renderVersionUI();
  showToast(`Loaded version ${label}`);
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function renderVersionUI() {
  const el = document.getElementById('version-ui');
  if (!el) return;
  const sorted = (Array.isArray(versions) ? [...versions] : []).sort((a, b) => b.timestamp - a.timestamp);
  el.innerHTML = `
    ${versions.length > 0 ? `
      <select class="version-select" onchange="loadVersion(this.value)">
        <option value="">version history…</option>
        ${sorted.map(v => `<option value="${v.label}" ${v.label === currentVersionLabel ? 'selected' : ''}>v${v.label}${v.auto ? ' ⟳' : ''} · ${timeAgo(v.timestamp)}</option>`).join('')}
      </select>
    ` : ''}
    <button id="btn-new-version" class="btn-new-version" onclick="createVersion()">+ New Version</button>
    <button class="btn-cloud-restore" onclick="openCloudRestore()" title="Restore from cloud backup">☁ Restore</button>
    ${currentVersionLabel ? `<span class="version-badge">v${currentVersionLabel}</span>` : ''}
    <span id="version-edit-count" class="version-edit-count">${editsSinceVersion > 0 ? `${editsSinceVersion}/${AUTO_VERSION_EVERY}` : ''}</span>
  `;
}

async function openCloudRestore() {
  if (!currentProjectId) return;
  const modal = document.getElementById('cloud-restore-modal');
  const list = document.getElementById('cloud-restore-list');
  if (!modal || !list) return;
  list.innerHTML = '<p style="color:#888;padding:16px">Loading snapshots…</p>';
  modal.style.display = 'flex';
  const snapshots = await sbGetSnapshots(currentProjectId);
  if (!snapshots.length) {
    list.innerHTML = '<p style="color:#888;padding:16px">No cloud snapshots found.</p>';
    return;
  }
  list.innerHTML = snapshots.map(s => `
    <div class="restore-item">
      <div class="restore-item-info">
        <span class="restore-item-label">${s.auto ? '⟳ Auto-save' : `📌 v${s.label}`}</span>
        <span class="restore-item-time">${new Date(s.created_at).toLocaleString()}</span>
        <span class="restore-item-counts">${s.data?.characters?.length || 0} chars · ${s.data?.locations?.length || 0} locs · ${s.data?.shots?.length || 0} shots</span>
      </div>
      <button class="restore-item-btn" onclick="restoreCloudSnapshot('${s.id}')">Restore</button>
    </div>
  `).join('');
}

async function restoreCloudSnapshot(snapshotId) {
  if (!confirm('Restore this snapshot? Your current state will be saved as a new version first.')) return;
  // Save current state first
  createVersion(false);
  const row = await sbRestoreSnapshot(snapshotId, currentProjectId);
  if (!row) { showToast('Failed to load snapshot.', true); return; }
  const merged = mergeImages(row.data, row.images);
  characters = merged.characters || [];
  locations = merged.locations || [];
  shots = merged.shots || [];
  visualStyles = merged.visualStyles || visualStyles;
  selectedStyleId = merged.selectedStyleId || selectedStyleId;
  charGenRules = merged.charGenRules || '';
  locationGenRules = merged.locationGenRules || '';
  autoSave();
  renderAll();
  document.getElementById('cloud-restore-modal').style.display = 'none';
  showToast('Snapshot restored.');
}

function syncFromDOM() {
  document.querySelectorAll('#characters-body tr[data-id]').forEach(row => {
    const char = characters.find(c => c.id === row.dataset.id);
    if (!char) return;
    char.name = row.querySelector('.field-name').value;
    const refEl = row.querySelector('.field-ref');
    char.reference = refEl.tagName === 'TEXTAREA' ? refEl.value : refEl.innerHTML;
    char.prompt = row.querySelector('.field-prompt').value;
  });
  document.querySelectorAll('#characters-body .char-angle-row').forEach(angleRow => {
    const charId = angleRow.id.replace('char-angles-', '');
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    if (!char.angles) char.angles = {};
    angleRow.querySelectorAll('.angle-prompt-field').forEach(field => {
      const angle = field.dataset.angle;
      if (!char.angles[angle]) char.angles[angle] = {};
      char.angles[angle].prompt = field.value;
    });
  });
  document.querySelectorAll('#locations-body tr[data-id]').forEach(row => {
    const loc = locations.find(l => l.id === row.dataset.id);
    if (!loc) return;
    loc.name = row.querySelector('.field-name').value;
    const locRefEl = row.querySelector('.field-ref');
    loc.reference = locRefEl.tagName === 'TEXTAREA' ? locRefEl.value : locRefEl.innerHTML;
    loc.prompt = row.querySelector('.field-prompt').value;
  });
  document.querySelectorAll('#shots-body tr[data-id]').forEach(row => {
    const shot = shots.find(s => s.id === row.dataset.id);
    if (!shot) return;
    shot.timestamp = row.querySelector('.field-timestamp')?.value || shot.timestamp || '';
    shot.lyric = row.querySelector('.field-lyric').value;
    shot.description = row.querySelector('.field-desc').value;
    shot.imagePrompt = row.querySelector('.field-imgprompt').value;
    shot.videoPrompt = row.querySelector('.field-vidprompt').value;
    shot.shotSize = row.querySelector('.field-size').value;
    shot.shotAngle = row.querySelector('.field-angle')?.value || shot.shotAngle;
    shot.shotMovement = row.querySelector('.field-movement').value;
    shot.characterIds = [...row.querySelectorAll('.char-cb:checked')].map(cb => cb.value);
    shot.locationId = row.querySelector('.field-loc-select')?.value || '';
  });
  document.querySelectorAll('#shots-body .shot-detail-row').forEach(detRow => {
    const shotId = detRow.id.replace('shot-detail-', '');
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;
    if (!shot.characterDetails) shot.characterDetails = {};
    // Don't overwrite characterDetails from DOM when compositor is open for this shot
    // (compositor is the source of truth for angle/expression while open)
    if (_compose && _compose.shotId === shotId) return;
    detRow.querySelectorAll('tr[data-char-id]').forEach(cRow => {
      const cid = cRow.dataset.charId;
      if (!shot.characterDetails[cid]) shot.characterDetails[cid] = {};
      const d = shot.characterDetails[cid];
      d.expression = cRow.querySelector('.det-expression')?.value || '';
      d.facingDir   = cRow.querySelector('.det-facing')?.value || 'Front';
    });
  });
}

// ── visual style ──────────────────────────────────────────────────────────
function toggleGenRules() {
  const body = document.getElementById('gen-rules-body');
  const toggle = document.getElementById('gen-rules-toggle');
  const open = body.classList.toggle('open');
  toggle.classList.toggle('open', open);
  if (open) {
    const charEl = document.getElementById('char-gen-rules');
    const locEl = document.getElementById('loc-gen-rules');
    if (charEl) charEl.value = charGenRules;
    if (locEl) locEl.value = locationGenRules;
    const framingEl = document.getElementById('char-framing-rules');
    if (framingEl) framingEl.value = CHAR_BOILERPLATE;
  }
}

function onCharRulesChange(val) { charGenRules = val; autoSave(); }
function onLocRulesChange(val) { locationGenRules = val; autoSave(); }

function resetFramingRules() {
  CHAR_BOILERPLATE = 'ONE character. ONE pose. Front view only. Single figure centered in frame. Do NOT show multiple views, do NOT show side or back angles, do NOT create a turnaround sheet. Full body from head to toe, character fills the full height of the frame. Solid flat white background only — no background elements, no scenery.';
  const el = document.getElementById('char-framing-rules');
  if (el) el.value = CHAR_BOILERPLATE;
  onBoilerplateChange(CHAR_BOILERPLATE);
  autoSave();
}

function resetCharRules() {
  charGenRules = DEFAULT_CHAR_RULES;
  const el = document.getElementById('char-gen-rules');
  if (el) el.value = charGenRules;
  autoSave();
}

function resetLocRules() {
  locationGenRules = DEFAULT_LOC_RULES;
  const el = document.getElementById('loc-gen-rules');
  if (el) el.value = locationGenRules;
  autoSave();
}

function toggleDebugMode() {
  debugMode = !debugMode;
  const panel = document.getElementById('debug-panel');
  const btn = document.getElementById('btn-debug-toggle');
  panel.style.display = debugMode ? 'block' : 'none';
  btn.style.color = debugMode ? '#e05050' : '#444';
  btn.style.borderColor = debugMode ? '#5a1a1a' : '#222';
  btn.style.background = debugMode ? '#1a0505' : 'none';
  if (debugMode) {
    const ta = document.getElementById('debug-boilerplate');
    if (ta) ta.value = CHAR_BOILERPLATE;
  }
}

function onBoilerplateChange(val) {
  CHAR_BOILERPLATE = val;
  document.querySelectorAll('.char-prompt-static').forEach(el => {
    // Only update framing cells (first static block per character), not style previews
    if (!el.classList.contains('char-style-preview')) el.textContent = val;
  });
}

function setStyle(id) {
  selectedStyleId = id;
  renderVisualStyles();
  autoSave();
  document.querySelectorAll('.char-style-preview').forEach(el => {
    el.textContent = getStylePrompt() || '(no style selected)';
  });
}

function applyStyleUI() {
  renderVisualStyles();
}

function getStylePrompt() {
  return visualStyles.find(s => s.id === selectedStyleId)?.prompt || '';
}

function getCharFullPrompt(charPrompt) {
  const parts = [charPrompt.trim(), CHAR_BOILERPLATE, getStylePrompt()].filter(Boolean);
  return parts.join('\n\n');
}

function renderVisualStyles() {
  const container = document.getElementById('style-options');
  if (!container) return;
  if (!selectedStyleId && visualStyles.length) selectedStyleId = visualStyles[0].id;
  const sel = visualStyles.find(s => s.id === selectedStyleId);
  const pills = visualStyles.map(s => `
    <label class="style-pill">
      <input type="radio" name="style" value="${esc(s.id)}" ${s.id === selectedStyleId ? 'checked' : ''} onchange="setStyle('${esc(s.id)}')">
      <span class="style-pill-name">${esc(s.name)}</span>
      <button class="style-pill-del" onclick="event.preventDefault();deleteVisualStyle('${esc(s.id)}')" title="Remove">✕</button>
    </label>`).join('');
  container.innerHTML = `
    <div class="style-pills">
      ${pills}
      <button class="btn-add-style" onclick="addVisualStyle()">+ Add Style</button>
    </div>
    ${sel ? `<div class="style-prompt-row">
      <textarea class="style-prompt-input" placeholder="Style prompt…" oninput="onStylePromptChange('${esc(sel.id)}',this.value)">${esc(sel.prompt)}</textarea>
    </div>` : ''}`;
}

function onStyleNameChange(id, val) {
  const s = visualStyles.find(s => s.id === id);
  if (!s) return;
  s.name = val;
  // Update the pill label without full re-render (avoids losing textarea focus)
  const pill = document.querySelector(`.style-pill input[value="${CSS.escape(id)}"] + .style-pill-name`);
  if (pill) pill.textContent = val;
  autoSave();
}

function onStylePromptChange(id, val) {
  const s = visualStyles.find(s => s.id === id);
  if (s) {
    s.prompt = val;
    autoSave();
    if (id === selectedStyleId) {
      document.querySelectorAll('.char-style-preview').forEach(el => {
        el.textContent = val || '(no style selected)';
      });
    }
  }
}

function addVisualStyle() {
  const s = { id: 'style-' + genId(), name: 'New Style', prompt: '' };
  visualStyles.push(s);
  renderVisualStyles();
  autoSave();
}

function deleteVisualStyle(id) {
  if (visualStyles.length <= 1) { showToast('Need at least one style.', true); return; }
  visualStyles = visualStyles.filter(s => s.id !== id);
  if (selectedStyleId === id) selectedStyleId = visualStyles[0]?.id || '';
  renderVisualStyles();
  autoSave();
}

// ── character helpers ─────────────────────────────────────────────────────
// Angles generated by AI (left side + back)
const CHAR_ANGLES_AI = ['3/4 Left', 'Profile Left', '3/4 Back Left', 'Back'];
// Right-side angles mirrored from their left counterparts
const MIRROR_PAIRS = { '3/4 Right': '3/4 Left', 'Profile Right': 'Profile Left', '3/4 Back Right': '3/4 Back Left' };
// All non-front angles displayed in subrows (walk-around order)
const CHAR_ANGLES = ['3/4 Left', 'Profile Left', '3/4 Back Left', 'Back', '3/4 Back Right', 'Profile Right', '3/4 Right'];
const ANGLE_DESC = {
  'Front':          'front view, facing forward, full body, solid flat white background, no shadows, no gradients',
  '3/4 Left':       'three-quarter profile turned slightly to the left, full body, solid flat white background, no shadows, no gradients',
  'Profile Left':   'pure side profile facing left, 90 degree side view, full body, solid flat white background, no shadows, no gradients',
  '3/4 Back Left':  'three-quarter rear view angled to the left, back of character mostly visible, full body, solid flat white background, no shadows, no gradients',
  'Back':           'rear view from behind, back of character fully visible, full body, solid flat white background, no shadows, no gradients',
  '3/4 Back Right': 'three-quarter rear view angled to the right, back of character mostly visible, full body, solid flat white background, no shadows, no gradients',
  'Profile Right':  'pure side profile facing right, 90 degree side view, full body, solid flat white background, no shadows, no gradients',
  '3/4 Right':      'three-quarter profile turned slightly to the right, full body, solid flat white background, no shadows, no gradients',
};

function newCharacter() { return { id: genId(), name: '', reference: '', referenceImage: null, prompt: '', images: [], angles: {}, expressionCache: {} }; }

function addCharacter() {
  syncFromDOM(); characters.push(newCharacter()); renderCharacters(); renderShots(); autoSave();
}
function deleteCharacter(id) {
  syncFromDOM();
  characters = characters.filter(c => c.id !== id);
  if (!characters.length) characters = [newCharacter()];
  shots.forEach(s => { s.characterIds = (s.characterIds || []).filter(cid => cid !== id); });
  renderCharacters(); renderShots(); autoSave();
}

// ── location helpers ──────────────────────────────────────────────────────
function newLocation() { return { id: genId(), name: '', aliases: [], reference: '', referenceImage: null, prompt: '', images: [], shotAngles: {}, customViews: [], possibleDuplicate: false }; }
function locDisplayName(l) { return l.name || 'Unnamed'; }
function locDefaultImage(l) {
  if (!l) return null;
  return l.useRefAsDefault ? (l.referenceImage?.dataUrl || null) : (l.selectedImage || l.images?.[0] || null);
}

function charDefaultImage(c) {
  if (!c) return null;
  return c.useRefAsDefault ? (c.referenceImage?.dataUrl || null) : (c.images?.[0] || null);
}

function deleteAllCharacters() {
  if (!confirm('Delete all characters?')) return;
  syncFromDOM();
  characters = [newCharacter()];
  renderCharacters(); renderShots(); autoSave();
}

function deleteAllLocations() {
  if (!confirm('Delete all locations?')) return;
  syncFromDOM();
  locations = [newLocation()];
  shots.forEach(s => s.locationId = '');
  renderLocations(); renderShots(); autoSave();
}

function addLocation() {
  syncFromDOM(); locations.push(newLocation()); renderLocations(); renderShots(); autoSave();
}
function deleteLocation(id) {
  syncFromDOM();
  locations = locations.filter(l => l.id !== id);
  if (!locations.length) locations = [newLocation()];
  shots.forEach(s => { if (s.locationId === id) s.locationId = ''; });
  renderLocations(); renderShots(); autoSave();
}

// ── shot helpers ──────────────────────────────────────────────────────────
function newShot() { return { id: genId(), lyric: '', description: '', characterIds: [], locationId: '', shotSize: 'Medium Shot', shotAngle: 'Eye Level', shotMovement: 'Static', imagePrompt: '', videoPrompt: '', images: [], videoUrl: '', characterDetails: {}, refImage: null, timestamp: '' }; }

function addShot() { syncFromDOM(); shots.push(newShot()); renderShots(); autoSave(); }
function addShotAfter(id) {
  syncFromDOM();
  const idx = shots.findIndex(s => s.id === id);
  shots.splice(idx + 1, 0, newShot());
  renderShots(); autoSave();
}
function deleteShot(id) { syncFromDOM(); shots = shots.filter(s => s.id !== id); renderShots(); autoSave(); }
function triggerShotRefUpload(id) { document.getElementById(`shotref-${id}`)?.click(); }
function handleShotRefUpload(id, input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      syncFromDOM();
      const { dataUrl, base64 } = resizeForUpload(img);
      const shot = shots.find(s => s.id === id);
      if (shot) {
        shot.refImage = { dataUrl, base64, mediaType: 'image/jpeg' };
        autoSave(); renderShots();
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function removeShotRefImage(id, evt) {
  evt.stopPropagation();
  syncFromDOM();
  const shot = shots.find(s => s.id === id);
  if (shot) { shot.refImage = null; autoSave(); renderShots(); }
}
function onShotLocationChange(shotId, locationId) {
  const shot = shots.find(s => s.id === shotId);
  if (shot) shot.locationId = locationId;
  // Sync final-image-cell dropdown
  const finalCell = document.getElementById(`final-img-${shotId}`);
  if (finalCell) {
    const finalSel = finalCell.querySelector('.final-loc-select');
    if (finalSel) finalSel.value = locationId;
    // Update location preview image
    const loc = locations.find(l => l.id === locationId);
    const locImg = locDefaultImage(loc);
    const preview = finalCell.querySelector('.final-image-loc-preview');
    if (preview) {
      const existing = preview.querySelector('.final-image-preview');
      const empty = preview.querySelector('.final-image-loc-empty');
      if (locImg) {
        if (existing) existing.src = locImg;
        else { if (empty) empty.remove(); const img = document.createElement('img'); img.className = 'final-image-preview'; img.src = locImg; preview.insertBefore(img, preview.firstChild); }
      } else {
        if (existing) existing.remove();
        if (!empty) { const d = document.createElement('div'); d.className = 'final-image-loc-empty'; d.innerHTML = '<span>No location</span>'; preview.insertBefore(d, preview.firstChild); }
      }
    }
  }
  // If compositor is open for this shot, update the background
  if (_compose && _compose.shotId === shotId) {
    const loc = locations.find(l => l.id === locationId);
    loadComposeBackground(locDefaultImage(loc));
  }
}

function onFinalLocChange(shotId, locationId) {
  // Sync the shot row's location select
  const row = document.querySelector(`tr[data-id="${shotId}"]`);
  if (row) {
    const sel = row.querySelector('.field-loc-select');
    if (sel) sel.value = locationId;
  }
  onShotLocationChange(shotId, locationId);
  autoSave();
}
function moveShot(id, dir) {
  syncFromDOM();
  const idx = shots.findIndex(s => s.id === id);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= shots.length) return;
  [shots[idx], shots[newIdx]] = [shots[newIdx], shots[idx]];
  renderShots(); autoSave();
}

// ── render ────────────────────────────────────────────────────────────────
function renderCharacters() {
  document.getElementById('characters-body').innerHTML = characters.map(c => charRowHTML(c) + charAngleRowHTML(c)).join('');
}
const LOC_ANGLES = ['Wide establishing shot', 'Reverse angle wide shot', '3/4 left shot', '3/4 right shot', 'High angle shot', 'Low angle shot'];

function locAngleRowHTML(l) {
  if (!l.shotAngles) l.shotAngles = {};
  if (!l.customViews) l.customViews = [];
  const stdRows = LOC_ANGLES.filter(angle => {
    const entry = l.shotAngles?.[angle] || {};
    return entry.image || entry.prompt?.trim() || entry.refImage;
  }).map(angle => {
    const key = angle.replace(/\s+/g, '-');
    const entry = l.shotAngles?.[angle] || {};
    const img = entry.image;
    const refImg = entry.refImage;
    const imgHtml = img
      ? `<img src="${esc(img)}" alt="${esc(angle)}">`
      : `<div class="loc-shot-placeholder">no image</div>`;
    const angleImgHtml = entry.useRef && refImg
      ? `<img src="${esc(refImg.dataUrl)}" alt="${esc(angle)}">`
      : imgHtml;
    const refHtml = refImg
      ? `<div style="position:relative;display:inline-block">
           <img src="${esc(refImg.dataUrl)}" alt="ref" style="width:40px;height:40px;object-fit:cover;border-radius:3px;cursor:pointer;outline:${entry.useRef ? '2px solid #4ade80' : 'none'}" onclick="toggleLocAngleUseRef('${l.id}','${angle}')" title="${entry.useRef ? 'Using ref as image (click to revert)' : 'Click to use as image'}">
           <button onclick="removeLocAngleRefImage('${l.id}','${angle}')" style="position:absolute;top:-5px;right:-5px;background:#222;border:none;border-radius:50%;color:#888;font-size:9px;width:14px;height:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
         </div>`
      : `<label style="cursor:pointer;font-size:10px;color:#555;border:1px dashed #2a2a2a;border-radius:3px;padding:4px 6px;display:block;text-align:center">📷 Upload<input type="file" accept="image/*" style="display:none" onchange="handleLocAngleRefUpload('${l.id}','${angle}',this)"></label>`;
    return `<tr>
      <td class="loc-shot-label" data-label="Variation">${esc(angle)}</td>
      <td data-label="Prompt"><textarea class="loc-angle-prompt" rows="3" oninput="onLocAnglePromptChange('${l.id}','${angle}',this.value)">${esc(entry.prompt || '')}</textarea></td>
      <td data-label="Ref Image" style="width:52px">${refHtml}</td>
      <td class="loc-shot-img-slot" data-label="Image" id="loc-angle-img-${l.id}-${key}">${angleImgHtml}</td>
      <td>
        <button class="btn-regen-angle" onclick="generateLocAngleSingle('${l.id}','${angle}')">Regenerate</button>
        ${refImg ? `<button onclick="toggleLocAngleUseRef('${l.id}','${angle}')" style="display:block;margin-top:4px;background:${entry.useRef ? '#1a2a1a' : 'none'};border:1px solid ${entry.useRef ? '#4ade80' : '#2a2a2a'};border-radius:3px;color:${entry.useRef ? '#4ade80' : '#666'};font-size:10px;padding:2px 6px;cursor:pointer;width:100%;white-space:nowrap">${entry.useRef ? '📷 Using Ref' : '📷 Use Ref'}</button>` : ''}
      </td>
    </tr>`;
  }).join('');
  const customRows = l.customViews.map((cv, i) => {
    const img = cv.image;
    const refImg = cv.refImage;
    const imgHtml = img
      ? `<img src="${esc(img)}" alt="${esc(cv.name || '')}">`
      : `<div class="loc-shot-placeholder">no image</div>`;
    const cvImgHtml = cv.useRef && refImg
      ? `<img src="${esc(refImg.dataUrl)}" alt="${esc(cv.name || '')}">`
      : imgHtml;
    const refHtml = refImg
      ? `<div style="position:relative;display:inline-block">
           <img src="${esc(refImg.dataUrl)}" alt="ref" style="width:40px;height:40px;object-fit:cover;border-radius:3px;cursor:pointer;outline:${cv.useRef ? '2px solid #4ade80' : 'none'}" onclick="toggleLocCustomViewUseRef('${l.id}',${i})" title="${cv.useRef ? 'Using ref as image (click to revert)' : 'Click to use as image'}">
           <button onclick="removeLocCustomRefImage('${l.id}',${i})" style="position:absolute;top:-5px;right:-5px;background:#222;border:none;border-radius:50%;color:#888;font-size:9px;width:14px;height:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
         </div>`
      : `<label style="cursor:pointer;font-size:10px;color:#555;border:1px dashed #2a2a2a;border-radius:3px;padding:4px 6px;display:block;text-align:center">📷 Upload<input type="file" accept="image/*" style="display:none" onchange="handleLocCustomRefUpload('${l.id}',${i},this)"></label>`;
    return `<tr>
      <td class="loc-shot-label" data-label="Variation"><input type="text" value="${esc(cv.name)}" placeholder="View name…" style="width:100%;background:#111;border:1px solid #222;border-radius:3px;color:#ccc;font-size:11px;padding:3px 5px" oninput="onLocCustomViewNameChange('${l.id}',${i},this.value)"></td>
      <td data-label="Prompt"><textarea class="loc-angle-prompt" rows="3" oninput="onLocCustomViewPromptChange('${l.id}',${i},this.value)">${esc(cv.prompt || '')}</textarea></td>
      <td data-label="Ref Image" style="width:52px">${refHtml}</td>
      <td class="loc-shot-img-slot" data-label="Image" id="loc-custom-img-${l.id}-${i}">${cvImgHtml}</td>
      <td>
        <button class="btn-regen-angle" onclick="generateLocCustomView('${l.id}',${i})">Generate</button>
        ${refImg ? `<button onclick="toggleLocCustomViewUseRef('${l.id}',${i})" style="display:block;margin-top:4px;background:${cv.useRef ? '#1a2a1a' : 'none'};border:1px solid ${cv.useRef ? '#4ade80' : '#2a2a2a'};border-radius:3px;color:${cv.useRef ? '#4ade80' : '#666'};font-size:10px;padding:2px 6px;cursor:pointer;width:100%;white-space:nowrap">${cv.useRef ? '📷 Using Ref' : '📷 Use Ref'}</button>` : ''}
        <button onclick="deleteLocCustomView('${l.id}',${i})" style="display:block;margin-top:4px;background:none;border:1px solid #3a1a1a;border-radius:3px;color:#a05050;font-size:10px;padding:2px 6px;cursor:pointer;width:100%">Remove</button>
      </td>
    </tr>`;
  }).join('');
  return `<tr class="loc-shot-row" id="loc-shots-${l.id}" style="display:none">
    <td colspan="6">
      <div class="loc-shot-inner">
        <table class="loc-shot-table">
          <thead><tr><th>Variation</th><th>Prompt</th><th>Ref Image</th><th>Image</th><th></th></tr></thead>
          <tbody>${stdRows}${customRows}</tbody>
        </table>
        <button onclick="addLocCustomView('${l.id}')" style="margin-top:8px;background:none;border:1px dashed #2a2a2a;border-radius:4px;color:#555;font-size:11px;padding:4px 12px;cursor:pointer">+ Add Custom View</button>
      </div>
    </td>
  </tr>`;
}

function renderLocations() {
  const openIds = new Set(
    [...document.querySelectorAll('.loc-shot-row')]
      .filter(r => r.style.display !== 'none')
      .map(r => r.id.replace('loc-shots-', ''))
  );
  document.getElementById('locations-body').innerHTML = locations.map(l => locRowHTML(l) + locAngleRowHTML(l)).join('');
  openIds.forEach(id => {
    const row = document.getElementById(`loc-shots-${id}`);
    if (row) {
      row.style.display = '';
      const btn = document.querySelector(`#locations-body tr[data-id="${id}"] .btn-toggle-shot-angles`);
      if (btn) btn.textContent = '▼ Variations';
    }
  });
}
let _avScriptShowImages = true;

function toggleAvScriptImages() {
  _avScriptShowImages = !_avScriptShowImages;
  const btn = document.getElementById('btn-avscript-images');
  if (btn) btn.textContent = _avScriptShowImages ? 'Hide Images' : 'Show Images';
  renderAvScript();
}

const MAIN_TABS = ['config', 'characters', 'locations', 'shots', 'avscript', 'animatic'];

function switchMainTab(tab) {
  if (currentProjectId) localStorage.setItem('sg-last-tab', tab);
  // shots / avscript / animatic all live inside tab-shots
  const panelKey = ['shots','avscript','animatic'].includes(tab) ? 'shots' : tab;
  MAIN_TABS.forEach(t => {
    const panelId = ['shots','avscript','animatic'].includes(t) ? 'tab-shots' : `tab-${t}`;
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = (panelId === `tab-${panelKey}`) ? '' : 'none';
  });
  // active nav button
  MAIN_TABS.forEach(t => {
    const btn = document.getElementById(`nav-btn-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  // if it's one of the shots sub-tabs, switch that inner panel too
  if (['shots','avscript','animatic'].includes(tab)) switchShotsTab(tab);
  window.scrollTo(0, 0);
}

function switchShotsTab(tab) {
  const isAv = tab === 'avscript';
  const isAnimatic = tab === 'animatic';
  const isShots = !isAv && !isAnimatic;
  document.getElementById('shots-tab-panel').style.display = isShots ? '' : 'none';
  document.getElementById('avscript-tab-panel').style.display = isAv ? '' : 'none';
  document.getElementById('animatic-tab-panel').style.display = isAnimatic ? '' : 'none';
  document.getElementById('shots-tab-actions').style.display = isShots ? 'flex' : 'none';
  document.getElementById('avscript-tab-actions').style.display = isAv ? 'flex' : 'none';
  document.getElementById('animatic-tab-actions').style.display = isAnimatic ? 'flex' : 'none';
  const titleEl = document.getElementById('shots-section-title');
  if (titleEl) titleEl.textContent = isAv ? 'AV Script' : isAnimatic ? 'Animatic' : 'Shot Sequence';
  if (isAv) renderAvScript();
}

function renderAvScript() {
  syncFromDOM();
  const wrap = document.getElementById('av-script-content');
  if (!wrap) return;
  const proj = projects.find(p => p.id === currentProjectId);
  const title = proj?.name || 'Untitled Project';
  if (!shots.length) {
    wrap.innerHTML = `<div class="av-script-title">${esc(title)}</div><div class="av-script-empty">No shots yet — generate or add shots in the Shot Sequence tab.</div>`;
    return;
  }
  const rows = shots.map((s, i) => {
    const charNames = (s.characterIds || []).map(id => characters.find(c => c.id === id)?.name).filter(Boolean).join(', ');
    const loc = locations.find(l => l.id === s.locationId);
    const metaParts = [s.shotSize, s.shotMovement, loc ? locDisplayName(loc) : null].filter(Boolean);
    const finalImg = s.finalImage || s.images?.[0] || locDefaultImage(loc);
    const locOptions = `<option value="">— None —</option>` + locations.map(l => `<option value="${esc(l.id)}"${s.locationId === l.id ? ' selected' : ''}>${esc(locDisplayName(l))}</option>`).join('');
    return `<div class="av-shot-row">
      <div class="av-shot-num">
        <div>${i + 1}</div>
        ${s.timestamp ? `<div class="av-shot-ts">${esc(s.timestamp)}</div>` : ''}
      </div>
      <div class="av-col-loc">
        <div class="av-col-label">Location</div>
        <select class="av-loc-select" onchange="onAvScriptLocChange('${esc(s.id)}', this.value)">${locOptions}</select>
      </div>
      <div class="av-col-audio">
        <div class="av-col-label">Audio / Action</div>
        <div class="av-shot-lyric av-editable" contenteditable="true" data-shot-id="${esc(s.id)}" data-field="lyric" oninput="onAvScriptEdit(this)">${esc(s.lyric || '')}</div>
        ${charNames ? `<div class="av-shot-chars">Characters: ${esc(charNames)}</div>` : ''}
      </div>
      <div class="av-col-visual">
        <div class="av-col-label">Visual</div>
        ${finalImg && _avScriptShowImages ? `<img class="av-shot-image" src="${esc(finalImg)}" alt="Shot ${i + 1}">` : ''}
        <div class="av-shot-desc av-editable" contenteditable="true" data-shot-id="${esc(s.id)}" data-field="description" oninput="onAvScriptEdit(this)">${esc(s.description || '')}</div>
        ${metaParts.length ? `<div class="av-shot-meta">${esc(metaParts.join(' · '))}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  wrap.innerHTML = `
    <div class="av-script-title">${esc(title)}</div>
    <div class="av-script-subtitle">AV Script · ${shots.length} shot${shots.length !== 1 ? 's' : ''}</div>
    ${rows}`;
}

async function cleanupShotFields() {
  syncFromDOM();
  const relevant = shots.filter(s => s.lyric?.trim() || s.description?.trim());
  if (!relevant.length) { showToast('No shot data to clean up.', true); return; }
  const btn = document.getElementById('btn-cleanup-shots');
  if (btn) { btn.disabled = true; btn.textContent = '✦ Cleaning…'; }
  try {
    const payload = relevant.map(s => {
      const loc = locations.find(l => l.id === s.locationId);
      const charNames = (s.characterIds || []).map(id => characters.find(c => c.id === id)?.name).filter(Boolean).join(', ');
      return { id: s.id, lyric: s.lyric || '', description: s.description || '', locationName: loc ? locDisplayName(loc) : '', characterNames: charNames };
    });
    const data = await apiFetch('/api/cleanup-shot-fields', {
      shots: payload,
      locations: locations.map(l => ({ id: l.id, name: locDisplayName(l) })),
      characters: characters.map(c => ({ id: c.id, name: c.name })),
      scriptText: lastScriptText || ''
    });
    let flagCount = 0, autoFillCount = 0;
    for (const r of (data.shots || [])) {
      const shot = shots.find(s => s.id === r.id);
      if (!shot) continue;
      // Suggest lyric/description changes as flags — never auto-apply
      shot._suggestions = shot._suggestions || {};
      if (r.lyric !== undefined && r.lyric.trim() !== (shot.lyric || '').trim()) {
        shot._suggestions.lyric = r.lyric; flagCount++;
      }
      if (r.description !== undefined && r.description.trim() !== (shot.description || '').trim()) {
        shot._suggestions.description = r.description; flagCount++;
      }
      // Auto-fill missing location from AI suggestion
      if (r.suggestedLocationId && !shot.locationId) {
        shot.locationId = r.suggestedLocationId; autoFillCount++;
      }
      // Auto-fill missing characters
      if (r.suggestedCharacterIds?.length && !(shot.characterIds?.length)) {
        shot.characterIds = r.suggestedCharacterIds; autoFillCount++;
      }
    }
    // Second pass: carry the last known location forward to any shot still missing one
    let lastLocId = null;
    for (const shot of shots) {
      if (shot.locationId) { lastLocId = shot.locationId; }
      else if (lastLocId) { shot.locationId = lastLocId; autoFillCount++; }
    }
    renderShots();
    autoSave();
    const parts = [];
    if (flagCount) parts.push(`${flagCount} suggestion${flagCount !== 1 ? 's' : ''} flagged`);
    if (autoFillCount) parts.push(`${autoFillCount} location/character${autoFillCount !== 1 ? 's' : ''} filled`);
    showToast(parts.length ? parts.join(', ') + '.' : 'No changes needed.');
  } catch(e) {
    showToast('Cleanup failed: ' + e.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Clean Up Fields'; }
  }
}

function acceptShotSuggestion(shotId, field) {
  const shot = shots.find(s => s.id === shotId);
  if (!shot?._suggestions?.[field]) return;
  shot[field] = shot._suggestions[field];
  delete shot._suggestions[field];
  // Update textarea in DOM directly
  const row = document.querySelector(`#shots-body tr[data-id="${shotId}"]`);
  if (row) {
    const sel = field === 'lyric' ? '.field-lyric' : '.field-desc';
    const ta = row.querySelector(sel);
    if (ta) ta.value = shot[field];
  }
  renderShotSuggestionFlags(shotId);
  autoSave();
}

function dismissShotSuggestion(shotId, field) {
  const shot = shots.find(s => s.id === shotId);
  if (!shot?._suggestions) return;
  delete shot._suggestions[field];
  renderShotSuggestionFlags(shotId);
  autoSave();
}

function renderShotSuggestionFlags(shotId) {
  const shot = shots.find(s => s.id === shotId);
  const row = document.querySelector(`#shots-body tr[data-id="${shotId}"]`);
  if (!row || !shot) return;
  ['lyric', 'description'].forEach(field => {
    const flagId = `suggestion-flag-${shotId}-${field}`;
    const existing = document.getElementById(flagId);
    const suggestion = shot._suggestions?.[field];
    if (!suggestion) { if (existing) existing.remove(); return; }
    if (existing) { existing.querySelector('.suggestion-text').textContent = suggestion; return; }
    const ta = row.querySelector(field === 'lyric' ? '.field-lyric' : '.field-desc');
    if (!ta) return;
    const flag = document.createElement('div');
    flag.id = flagId;
    flag.className = 'shot-suggestion-flag';
    flag.innerHTML = `<span class="suggestion-label">Script suggests:</span><span class="suggestion-text">${esc(suggestion)}</span><div class="suggestion-actions"><button onclick="acceptShotSuggestion('${shotId}','${field}')" class="suggestion-accept">✓ Use</button><button onclick="dismissShotSuggestion('${shotId}','${field}')" class="suggestion-dismiss">✕</button></div>`;
    ta.parentNode.insertBefore(flag, ta.nextSibling);
  });
}

function onAvScriptLocChange(shotId, locId) {
  const shot = shots.find(s => s.id === shotId);
  if (!shot) return;
  shot.locationId = locId || null;
  // Mirror to the shot sequence row select
  const row = document.querySelector(`#shots-body tr[data-id="${shotId}"]`);
  if (row) {
    const sel = row.querySelector('.field-loc-select');
    if (sel) sel.value = locId || '';
  }
  autoSave();
}

function onAvScriptEdit(el) {
  const shotId = el.dataset.shotId;
  const field = el.dataset.field;
  const shot = shots.find(s => s.id === shotId);
  if (!shot) return;
  shot[field] = el.innerText;
  // Mirror change into shot sequence textarea without re-rendering
  const selector = field === 'lyric' ? '.field-lyric' : '.field-desc';
  const row = document.querySelector(`#shots-body tr[data-id="${shotId}"]`);
  if (row) { const ta = row.querySelector(selector); if (ta) ta.value = shot[field]; }
  debouncedSave();
}

function exportAvScriptPdf() {
  syncFromDOM();
  const proj = projects.find(p => p.id === currentProjectId);
  const title = proj?.name || 'AV Script';
  // Build a self-contained printable HTML document
  const rows = shots.map((s, i) => {
    const charNames = (s.characterIds || []).map(id => characters.find(c => c.id === id)?.name).filter(Boolean).join(', ');
    const loc = locations.find(l => l.id === s.locationId);
    const metaParts = [s.shotSize, s.shotMovement, loc ? locDisplayName(loc) : null].filter(Boolean);
    const finalImg = s.finalImage || s.images?.[0] || locDefaultImage(loc);
    return `<tr>
      <td class="col-num">${i + 1}${s.timestamp ? `<br><span class="ts">${s.timestamp}</span>` : ''}</td>
      <td class="col-audio">
        ${s.lyric ? `<p class="lyric">${s.lyric.replace(/\n/g,'<br>')}</p>` : ''}
        ${charNames ? `<p class="meta">Characters: ${charNames}</p>` : ''}
      </td>
      <td class="col-visual">
        ${finalImg && _avScriptShowImages ? `<img src="${finalImg}" style="width:100%;border-radius:3px;margin-bottom:6px;display:block">` : ''}
        ${s.description ? `<p class="desc">${s.description.replace(/\n/g,'<br>')}</p>` : ''}
        ${metaParts.length ? `<p class="meta">${metaParts.join(' · ')}</p>` : ''}
      </td>
    </tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${title} – AV Script</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; background: #fff; padding: 28px 36px; }
  h1 { font-size: 20pt; margin-bottom: 4px; }
  .subtitle { font-size: 9pt; color: #777; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  tr { border-top: 1px solid #ccc; page-break-inside: avoid; }
  tr:last-child { border-bottom: 1px solid #ccc; }
  td { padding: 12px 10px; vertical-align: top; }
  .col-num { width: 44px; font-size: 9pt; font-weight: 700; color: #888; white-space: nowrap; }
  .ts { font-size: 8pt; color: #aaa; font-family: monospace; }
  .col-visual { width: 50%; border-left: 1px solid #e5e5e5; border-right: 1px solid #e5e5e5; padding-left: 14px; padding-right: 14px; }
  .col-audio { width: calc(50% - 44px); }
  .col-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 6px; }
  .desc { font-size: 10pt; color: #333; line-height: 1.5; margin-bottom: 4px; }
  .lyric { font-size: 11pt; font-style: italic; color: #111; line-height: 1.6; margin-bottom: 6px; }
  .meta { font-size: 8pt; color: #888; }
  @media print { body { padding: 16px 24px; } }
</style></head><body>
<h1>${title}</h1>
<div class="subtitle">AV Script · ${shots.length} shot${shots.length !== 1 ? 's' : ''} · ${new Date().toLocaleDateString()}</div>
<table>
  <thead><tr>
    <th class="col-num col-label">#</th>
    <th class="col-audio col-label" style="text-align:left">Audio / Action</th>
    <th class="col-visual col-label" style="text-align:left;padding-left:14px">Visual</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

async function generateAnimatic() {
  syncFromDOM();
  const btn = document.getElementById('btn-gen-animatic');
  const status = document.getElementById('animatic-status');
  const video = document.getElementById('animatic-video');
  const empty = document.getElementById('animatic-empty');

  // Collect shots that have a final image and a timestamp
  const shotFrames = shots
    .filter(s => s.finalImage && s.timestamp)
    .map(s => ({ imageUrl: s.finalImage, timestamp: s.timestamp }));

  if (!shotFrames.length) {
    showToast('No shots with both a Final Image and a timestamp yet.', true);
    return;
  }

  const audioFile = await idbGet(_audioKey() + '-file');
  if (!audioFile) {
    showToast('No audio loaded — import audio first.', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Generating…';
  status.textContent = 'Uploading frames and audio…';
  empty.style.display = 'none';
  video.style.display = 'none';

  try {
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('shots', JSON.stringify(shotFrames));

    const resp = await fetch('/api/generate-animatic', { method: 'POST', body: formData });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || resp.statusText); }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    video.src = url;
    video.style.display = 'block';
    status.textContent = '';
  } catch(e) {
    showToast('Animatic failed: ' + e.message, true);
    status.textContent = '';
    empty.style.display = '';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Animatic';
  }
}

function renderShots() {
  const openIds = new Set(
    [...document.querySelectorAll('.shot-detail-row')]
      .filter(r => r.style.display !== 'none')
      .map(r => r.id.replace('shot-detail-', ''))
  );
  document.getElementById('shots-body').innerHTML = shots.map((s, i) => shotRowHTML(s, i)).join('');
  openIds.forEach(id => {
    const row = document.getElementById(`shot-detail-${id}`);
    if (row) {
      row.style.display = '';
      const btn = document.querySelector(`#shots-body tr[data-id="${id}"] .btn-detail-toggle`);
      if (btn) btn.textContent = '▼';
    }
  });
  // Re-render any pending suggestion flags
  shots.forEach(s => { if (s._suggestions && Object.keys(s._suggestions).length) renderShotSuggestionFlags(s.id); });
}

function charRowHTML(c) {
  const frontUrl = charDefaultImage(c);
  const frontHTML = frontUrl
    ? `<img src="${esc(frontUrl)}" alt="Front">`
    : `<span class="placeholder">·</span>`;
  const refImgHTML = c.referenceImage
    ? `<img src="${esc(c.referenceImage.dataUrl)}" alt="Reference"><button class="remove-img" onclick="removeRefImage('${c.id}', event)">✕</button>`
    : `<div class="upload-hint">Click to<br>upload</div>`;
  return `<tr data-id="${c.id}">
    <td>
      <div style="display:flex;flex-direction:column;gap:4px">
        <input type="text" class="field-name" placeholder="Name…" value="${esc(c.name)}" oninput="debouncedSave()">
        ${c.missingFromScript ? `<div class="missing-from-script-flag">Missing from script — <button onclick="deleteCharacter('${c.id}')" style="background:none;border:none;color:#e05050;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Delete?</button> — <button onclick="dismissMissingFlag('char','${c.id}')" style="background:none;border:none;color:#555;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Dismiss</button></div>` : ''}
        <button class="btn-toggle-angles btn-var-inline" onclick="toggleCharAngles('${c.id}')" style="align-self:flex-start;background:none;border:1px solid #222;border-radius:4px;color:#555;font-size:10px;padding:3px 6px;cursor:pointer;white-space:nowrap">▶ Variations</button>
      </div>
    </td>
    <td data-label="Description"><div class="field-ref ref-rich" contenteditable="true" data-placeholder="Describe appearance, style, mood…" oninput="debouncedSave()">${c.reference || ''}</div></td>
    <td data-label="Reference Image">
      <div class="ref-img-cell">
        <div class="ref-img-preview" onclick="${c.referenceImage ? `toggleCharUseRef('${c.id}')` : `triggerImageUpload('${c.id}')`}">${refImgHTML}</div>
        <input type="file" id="file-${c.id}" class="hidden" accept="image/*" onchange="handleImageUpload('${c.id}', this)">
        ${c.referenceImage ? `<button onclick="toggleCharUseRef('${c.id}')" style="background:${c.useRefAsDefault ? '#1a2a1a' : 'none'};border:1px solid ${c.useRefAsDefault ? '#4ade80' : '#2a2a2a'};border-radius:4px;color:${c.useRefAsDefault ? '#4ade80' : '#666'};font-size:11px;padding:4px 8px;cursor:pointer;white-space:nowrap;margin-top:4px">${c.useRefAsDefault ? '📷 Using Ref as Default' : '📷 Use Ref as Default'}</button>` : ''}
      </div>
    </td>
    <td data-label="Prompt">
      <div class="char-prompt-section">
        <span class="char-prompt-label">Character Description</span>
        <textarea class="field-prompt" rows="3" placeholder="Describe the character's appearance…" oninput="debouncedSave()">${esc(c.prompt)}</textarea>
        <span class="char-prompt-label" style="margin-top:4px">Framing (applied to all characters)</span>
        <div class="char-prompt-static">${esc(CHAR_BOILERPLATE)}</div>
        <span class="char-prompt-label" style="margin-top:4px">Visual Style</span>
        <div class="char-prompt-static char-style-preview">${esc(getStylePrompt()) || '(no style selected)'}</div>
      </div>
    </td>
    <td data-label="Generated Image">
      <div class="char-front-wrap">
        <div class="char-front-slot" id="char-front-${c.id}">${frontHTML}</div>
        <select class="expr-select" id="expr-${c.id}" onchange="applyCharExpression('${c.id}')">
          <option value="neutral">Neutral</option>
          <option value="happy">Happy</option>
          <option value="sad">Sad</option>
          <option value="surprised">Surprised</option>
          <option value="wink">Wink</option>
          <option value="angry">Angry</option>
        </select>
      </div>
    </td>
    <td>
      <div class="actions">
        <button class="btn btn-gen-prompt" onclick="generateCharPrompt('${c.id}')">Generate Prompt</button>
        <button class="btn btn-gen-images" onclick="generateCharFrontProfile('${c.id}')">Generate Front Profile</button>
        <button class="btn btn-gen-images" style="background:#162a2a;border-color:#254a4a;color:#4adede" onclick="generateCharAngles('${c.id}')">Generate Variations</button>
        <button class="btn btn-delete" onclick="deleteCharacter('${c.id}')">Remove</button>
      </div>
    </td>
    <td class="card-var-btn-cell"><button class="btn-toggle-angles" onclick="toggleCharAngles('${c.id}')" style="width:100%;background:none;border:1px solid #222;border-radius:4px;color:#555;font-size:11px;padding:6px;cursor:pointer">▶ Variations</button></td>
  </tr>`;
}

function charAngleRowsInnerHTML(c) {
  const standardRows = CHAR_ANGLES.map(angle => {
    const d = c.angles?.[angle] || {};
    const isMirror = !!MIRROR_PAIRS[angle];
    const refImg = d.refImage;
    const effectiveImg = d.useRef && refImg ? refImg.dataUrl : d.image;
    const imgHTML = effectiveImg
      ? `<img src="${esc(effectiveImg)}" alt="${esc(angle)}">`
      : `<span class="placeholder">·</span>`;
    const labelHTML = isMirror
      ? `${esc(angle)} <span style="color:#555;font-size:9px">🪞</span>`
      : esc(angle);
    const refHtml = refImg
      ? `<div style="position:relative;display:inline-block">
           <img src="${esc(refImg.dataUrl)}" alt="ref" style="width:40px;height:40px;object-fit:cover;border-radius:3px;cursor:pointer;outline:${d.useRef ? '2px solid #4ade80' : 'none'}" onclick="toggleCharAngleUseRef('${c.id}','${angle}')" title="${d.useRef ? 'Using ref as image (click to revert)' : 'Click to use as image'}">
           <button onclick="removeCharAngleRefImage('${c.id}','${angle}')" style="position:absolute;top:-5px;right:-5px;background:#222;border:none;border-radius:50%;color:#888;font-size:9px;width:14px;height:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
         </div>`
      : `<label style="cursor:pointer;font-size:10px;color:#555;border:1px dashed #2a2a2a;border-radius:3px;padding:4px 6px;display:block;text-align:center">📷 Upload<input type="file" accept="image/*" style="display:none" onchange="handleCharAngleRefUpload('${c.id}','${angle}',this)"></label>`;
    return `<tr>
      <td class="angle-label" data-label="Variation">${labelHTML}</td>
      ${isMirror ? `<td data-label="Prompt" style="color:#383838;font-size:10px;font-style:italic;vertical-align:middle">Mirrored from ${esc(MIRROR_PAIRS[angle])}</td>` : `<td data-label="Prompt"><textarea class="angle-prompt-field" data-angle="${esc(angle)}" rows="3" oninput="debouncedSave()">${esc(d.prompt || '')}</textarea></td>`}
      <td data-label="Ref Image" style="width:52px">${isMirror ? '' : refHtml}</td>
      <td data-label="Image"><div class="angle-img-slot" id="angle-img-${c.id}-${angle.replace(/\W/g,'_')}">${imgHTML}</div></td>
      <td>
        <button class="btn btn-regen" onclick="regenerateCharAngle('${c.id}','${angle}')">${isMirror ? '🪞 Re-mirror' : '↺ Regenerate'}</button>
        ${!isMirror && refImg ? `<button onclick="toggleCharAngleUseRef('${c.id}','${angle}')" style="display:block;margin-top:4px;background:${d.useRef ? '#1a2a1a' : 'none'};border:1px solid ${d.useRef ? '#4ade80' : '#2a2a2a'};border-radius:3px;color:${d.useRef ? '#4ade80' : '#666'};font-size:10px;padding:2px 6px;cursor:pointer;width:100%;white-space:nowrap">${d.useRef ? '📷 Using Ref' : '📷 Use Ref'}</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  // Generated variants (from expressionCache / compose-generated variations)
  const variantRows = Object.entries(c.angles || {})
    .filter(([k, v]) => v?.isVariant)
    .map(([key, v]) => {
      const imgHTML = v.image ? `<img src="${esc(v.image)}" alt="${esc(key)}">` : `<span class="placeholder">·</span>`;
      return `<tr>
        <td class="angle-label" style="color:#818cf8">${esc(key)}</td>
        <td style="color:#555;font-size:10px;font-style:italic;vertical-align:middle">${esc(v.prompt || '')}</td>
        <td><div class="angle-img-slot">${imgHTML}</div></td>
        <td><button onclick="deleteCharVariant('${esc(c.id)}','${esc(key)}')" style="background:none;border:1px solid #3a1a1a;border-radius:3px;color:#a05050;font-size:10px;padding:2px 6px;cursor:pointer;width:100%">Delete</button></td>
      </tr>`;
    }).join('');

  return standardRows + variantRows;
}

function charAngleRowHTML(c) {
  return `<tr class="char-angle-row" id="char-angles-${c.id}" style="display:none">
    <td colspan="6">
      <div class="char-angle-inner">
        <table class="angle-subtable">
          <thead><tr><th>Variation</th><th>Prompt</th><th>Ref</th><th>Image</th><th></th></tr></thead>
          <tbody>${charAngleRowsInnerHTML(c)}</tbody>
        </table>
      </div>
    </td>
  </tr>`;
}

function locRowHTML(l) {
  const defaultImg = locDefaultImage(l);
  const imgsHTML = `<div class="img-slot">${defaultImg ? `<img src="${esc(defaultImg)}" alt="">` : `<span class="placeholder">·</span>`}</div>`;
  const refImgHTML = l.referenceImage
    ? `<img src="${esc(l.referenceImage.dataUrl)}" alt="Reference"><button class="remove-img" onclick="removeLocRefImage('${l.id}', event)">✕</button>`
    : `<div class="upload-hint">Click to<br>upload</div>`;
  return `<tr data-id="${l.id}">
    <td>
      <div style="display:flex;flex-direction:column;gap:4px">
        <input type="text" class="field-name" placeholder="Name…" value="${esc(l.name)}" oninput="debouncedSave()">
        ${l.missingFromScript ? `<div class="missing-from-script-flag">Missing from script — <button onclick="deleteLocation('${l.id}')" style="background:none;border:none;color:#e05050;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Delete?</button> — <button onclick="dismissMissingFlag('loc','${l.id}')" style="background:none;border:none;color:#555;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Dismiss</button></div>` : ''}
        ${l.possibleDuplicate ? (() => {
          const twin = locations.find(x => x.id !== l.id && x.name && locationsSimilar(x.name, l.name));
          return `<div class="loc-dup-flag">⚠ Possible duplicate of "${esc(twin?.name || '?')}"${twin ? ` — <button onclick="mergeLocationsIntoOne('${esc(twin.id)}','${esc(l.id)}')" style="background:none;border:none;color:#f59e0b;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Merge into it</button>` : ''} — <button onclick="dismissDuplicateFlag('loc','${esc(l.id)}')" style="background:none;border:none;color:#555;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Dismiss</button></div>`;
        })() : ''}
        <button class="btn-toggle-shot-angles btn-var-inline" onclick="toggleLocAngles('${l.id}')" style="align-self:flex-start;background:none;border:1px solid #222;border-radius:4px;color:#555;font-size:10px;padding:3px 6px;cursor:pointer;white-space:nowrap">▶ Variations</button>
      </div>
    </td>
    <td data-label="Description"><textarea class="field-ref" rows="3" placeholder="Describe environment, lighting, atmosphere…" oninput="debouncedSave()">${esc(l.reference)}</textarea></td>
    <td data-label="Reference Image">
      <div class="ref-img-cell">
        <div class="ref-img-preview" onclick="${l.referenceImage ? `toggleLocUseRef('${l.id}')` : `triggerLocImageUpload('${l.id}')`}">${refImgHTML}</div>
        <input type="file" id="locfile-${l.id}" class="hidden" accept="image/*" onchange="handleLocImageUpload('${l.id}', this)">
      </div>
    </td>
    <td data-label="Prompt">
      <div class="char-prompt-section">
        <span class="char-prompt-label">Location Description</span>
        <textarea class="field-prompt" rows="3" placeholder="Describe the environment, lighting, atmosphere…" oninput="debouncedSave()">${esc(l.prompt)}</textarea>
        <span class="char-prompt-label" style="margin-top:4px">Visual Style</span>
        <div class="char-prompt-static char-style-preview">${esc(getStylePrompt()) || '(no style selected)'}</div>
      </div>
    </td>
    <td data-label="Image"><div class="images-grid" id="loc-imgs-${l.id}">${imgsHTML}</div></td>
    <td>
      <div class="actions">
        <button class="btn btn-gen-prompt" onclick="generateLocPrompt('${l.id}')">Generate Prompt</button>
        <button class="btn btn-gen-images" onclick="generateLocImages('${l.id}')">Generate Default View (AI)</button>
        ${l.referenceImage ? `<button onclick="toggleLocUseRef('${l.id}')" style="background:${l.useRefAsDefault ? '#1a2a1a' : 'none'};border:1px solid ${l.useRefAsDefault ? '#4ade80' : '#2a2a2a'};border-radius:4px;color:${l.useRefAsDefault ? '#4ade80' : '#666'};font-size:11px;padding:4px 8px;cursor:pointer;white-space:nowrap">${l.useRefAsDefault ? '📷 Using Ref as Default' : '📷 Use Ref as Default View'}</button>` : ''}
        <button class="btn-gen-shot-angles" onclick="generateLocAltViews('${l.id}')">Generate Variations</button>
        <button class="btn btn-delete" onclick="deleteLocation('${l.id}')">Remove</button>
      </div>
    </td>
    <td class="card-var-btn-cell"><button class="btn-toggle-shot-angles" onclick="toggleLocAngles('${l.id}')" style="width:100%;background:none;border:1px solid #222;border-radius:4px;color:#555;font-size:11px;padding:6px;cursor:pointer">▶ Variations</button></td>
  </tr>`;
}

function shotRowHTML(s, idx) {
  const imgsHTML = Array.from({ length: 2 }, (_, i) => {
    const url = s.images?.[i];
    return `<div class="img-slot">${url ? `<img src="${esc(url)}" alt="">` : `<span class="placeholder">·</span>`}</div>`;
  }).join('');
  const charChecks = characters.length
    ? characters.map(c => `<label class="char-check-item"><input type="checkbox" class="char-cb" value="${c.id}"${(s.characterIds||[]).includes(c.id) ? ' checked' : ''} onchange="autoSave();refreshShotDetailIfOpen('${s.id}')">${esc(c.name || 'Unnamed')}</label>`).join('')
    : `<span class="char-checks-empty">No characters yet</span>`;
  const locOpts = `<option value="">— None —</option>` + locations.map(l => `<option value="${esc(l.id)}"${(s.locationId||'')=== l.id?' selected':''}>${esc(locDisplayName(l))}</option>`).join('');
  const sizeOpts = SHOT_SIZES.map(v => `<option${s.shotSize === v ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const angleOpts = SHOT_ANGLES.map(v => `<option${s.shotAngle === v ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const moveOpts = SHOT_MOVEMENTS.map(v => `<option${s.shotMovement === v ? ' selected' : ''}>${esc(v)}</option>`).join('');
  return `<tr data-id="${s.id}">
    <td class="shot-card-controls"><div class="order-btns">
      <button class="btn-ord" onclick="moveShot('${s.id}',-1)" ${idx===0?'disabled':''}>▲</button>
      <button class="btn-ord" onclick="moveShot('${s.id}',1)" ${idx===shots.length-1?'disabled':''}>▼</button>
      <button class="btn-ord btn-detail-toggle" onclick="toggleShotDetail('${s.id}')" title="Character details">▶</button>
      <button class="btn-ord" onclick="addShotAfter('${s.id}')" title="Add shot below" style="color:#4ade80;border-color:#254a31">+</button>
      <button class="btn-ord" onclick="deleteShot('${s.id}')" title="Delete shot" style="color:#e05050;border-color:#4a1a1a">✕</button>
    </div></td>
    <td class="shot-card-timestamp" style="text-align:center">
      <input type="text" class="field-timestamp" placeholder="0:00" value="${esc(s.timestamp || '')}" data-shot-id="${esc(s.id)}" oninput="debouncedSave();onTimestampInput(this)" style="width:60px;font-size:11px;font-family:monospace;background:#0e0e0e;border:1px solid #1a1a1a;color:#aaa;border-radius:3px;padding:3px 5px">
    </td>
    <td data-label="Audio">
      ${s.missingFromScript ? `<div class="missing-from-script-flag" style="margin-bottom:4px">Missing from script — <button onclick="deleteShot('${s.id}')" style="background:none;border:none;color:#e05050;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Delete?</button> — <button onclick="dismissShotMissingFlag('${s.id}')" style="background:none;border:none;color:#555;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Dismiss</button></div>` : ''}
      <textarea class="field-lyric" rows="3" placeholder="Audio / lyric…" oninput="debouncedSave()">${esc(s.lyric)}</textarea>
      <div style="display:flex;gap:4px;margin-top:4px">
        <button class="btn-play-shot" id="btn-play-${esc(s.id)}" onclick="playAudioAtShot('${esc(s.id)}')" title="Play from timestamp" style="${s.timestamp && s.timestamp !== '0:00' ? '' : 'opacity:0.2;pointer-events:none'}">▶</button>
        <button class="btn-retry-timestamp" onclick="retryTimestampForShot('${esc(s.id)}')" title="Retry timestamp from transcript" style="background:none;border:1px solid #222;border-radius:3px;color:#555;font-size:10px;padding:2px 6px;cursor:pointer">↻</button>
      </div>
    </td>
    <td data-label="Visual"><textarea class="field-desc" rows="3" placeholder="Visual description…" oninput="debouncedSave()">${esc(s.description)}</textarea></td>
    <td class="shot-card-chars" data-label="Characters"><div class="char-checks">${charChecks}</div></td>
    <td class="shot-card-loc" data-label="Location"><select class="field-loc-select" onchange="onShotLocationChange('${s.id}',this.value);autoSave()">${locOpts}</select>
<div class="shot-ref-zone" onclick="triggerShotRefUpload('${s.id}')" title="Reference photo — overrides location when generating images">
  ${s.refImage
    ? `<img src="${esc(s.refImage.dataUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:3px"><button class="shot-ref-remove" onclick="removeShotRefImage('${s.id}',event)">✕</button>`
    : `<span>📷</span><span style="font-size:8px">Ref</span>`}
</div>
<input type="file" id="shotref-${s.id}" accept="image/*" capture="environment" style="display:none" onchange="handleShotRefUpload('${s.id}',this)"></td>
    <td class="shot-card-size" data-label="Size"><select class="field-size" onchange="autoSave()">${sizeOpts}</select></td>
    <td class="shot-card-movement" data-label="Movement"><select class="field-movement" onchange="autoSave()">${moveOpts}</select></td>
    <td data-label="Image Prompt"><textarea class="field-imgprompt" rows="3" placeholder="Image prompt (opening frame)…" oninput="debouncedSave()">${esc(s.imagePrompt)}</textarea></td>
    <td data-label="Video Prompt"><textarea class="field-vidprompt" rows="3" placeholder="Video prompt (action + camera movement)…" oninput="debouncedSave()">${esc(s.videoPrompt)}</textarea></td>
    <td data-label="Generated Images"><div class="images-grid" id="shot-imgs-${s.id}">${imgsHTML}</div></td>
    <td>
      <div class="final-image-cell" id="final-img-${s.id}">
        ${(() => {
          const loc = locations.find(l => l.id === s.locationId);
          const locImg = locDefaultImage(loc);
          const previewImg = s.finalImage || locImg;
          const shotCharsWithImg = (s.characterIds || [])
            .map(id => characters.find(c => c.id === id))
            .filter(c => c && c.images?.length);
          const locOpts2 = `<option value="">— No Location —</option>` + locations.map(l => `<option value="${esc(l.id)}"${s.locationId === l.id?' selected':''}>${esc(locDisplayName(l))}</option>`).join('');
          const charOverlay = (!s.finalImage && shotCharsWithImg.length)
            ? shotCharsWithImg.map((c, i) => {
                const total = shotCharsWithImg.length;
                const leftPct = ((i + 1) / (total + 1)) * 100;
                const imgSrc = c.bgRemovedImage || charDefaultImage(c) || c.images[0];
                return `<img src="${esc(imgSrc)}" class="final-preview-char-overlay" style="left:${leftPct}%;transform:translateX(-50%)">`;
              }).join('')
            : '';
          return `<div class="final-image-loc-preview" onclick="openCompose('${s.id}')">
            ${previewImg ? `<img src="${esc(previewImg)}" class="final-image-preview">` : `<div class="final-image-loc-empty"><span>No location</span></div>`}
            ${charOverlay}
            ${s.finalImage ? `<div class="final-image-badge">✎ Final</div>` : ''}
            <div class="final-image-compose-hint">Click to compose</div>
          </div>
          <div class="final-image-loc-row">
            <select class="final-loc-select" onchange="onFinalLocChange('${s.id}',this.value);event.stopPropagation()">${locOpts2}</select>
          </div>`;
        })()}
      </div>
    </td>
    <td>
      <div class="actions">
        <button class="btn btn-gen-prompt" onclick="generateShotPrompts('${s.id}')">Generate Prompts</button>
        <button class="btn btn-gen-images" onclick="generateShotImages('${s.id}')">Generate Images</button>
        <button class="btn btn-delete" onclick="deleteShot('${s.id}')">Remove</button>
      </div>
    </td>
  </tr>` + shotDetailRowHTML(s);
}

// ── script upload ─────────────────────────────────────────────────────────
function renderScriptPreview() {
  const preview = document.getElementById('script-preview');
  if (lastScriptText) {
    document.getElementById('script-filename').textContent = lastScriptName || 'Script';
    document.getElementById('script-text').textContent = lastScriptText;
    preview.classList.add('visible');
  } else {
    preview.classList.remove('visible');
  }
}

function removeScript() {
  lastScriptText = null; lastScriptName = null;
  for (const c of characters) delete c.missingFromScript;
  for (const l of locations) delete l.missingFromScript;
  for (const s of shots) delete s.missingFromScript;
  renderScriptPreview();
  document.getElementById('upload-status').textContent = 'Accepts .txt, .pdf, .docx';
  document.getElementById('upload-status').className = 'upload-status';
}

async function handleScriptUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('upload-status');
  status.textContent = 'Parsing script…'; status.className = 'upload-status loading';
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/parse-script', { method: 'POST', body: formData });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(text || `HTTP ${res.status}`); }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    syncFromDOM();
    lastScriptText = data.scriptText || null;
    lastScriptName = file.name;
    renderScriptPreview();
    const hadExistingData = characters.length > 0 || locations.length > 0 || shots.length > 0;
    if (data.characters?.length) mergeCharacters(data.characters, hadExistingData);
    if (data.locations?.length) mergeLocations(data.locations, hadExistingData);
    if (hadExistingData && lastScriptText) flagMissingShots(lastScriptText);
    status.textContent = `Parsed ${data.characters?.length ?? 0} characters and ${data.locations?.length ?? 0} locations from "${file.name}" — click Generate Shot Sequence to build shots`;
    status.className = 'upload-status done';
  } catch (e) {
    status.textContent = 'Error: ' + e.message; status.className = 'upload-status error';
    showToast('Script parse failed: ' + e.message, true);
  }
  input.value = '';
}

// ── Audio import + Whisper transcript ────────────────────────────────────────
let _audioTranscript = null; // array of word objects: { word, start, end }

function _audioKey() { return `audio-${currentProjectId || 'default'}`; }

async function _saveAudio(file) {
  try { await idbSet(_audioKey() + '-file', file); } catch(e) { console.warn('audio save failed', e); }
}

async function _saveTranscript(words) {
  try { await idbSet(_audioKey() + '-transcript', words); } catch(e) { console.warn('transcript save failed', e); }
}

function getPinnedPlayer() {
  return document.getElementById('pinned-audio-player');
}

function showPinnedPlayer() {
  const bar = document.getElementById('pinned-audio-bar');
  if (bar) { bar.style.display = ''; bar.dataset.hidden = ''; }
  document.body.classList.add('has-pinned-audio');
}

function togglePinnedPlayer() {
  const bar = document.getElementById('pinned-audio-bar');
  if (!bar) return;
  const hidden = bar.dataset.hidden === '1';
  bar.dataset.hidden = hidden ? '' : '1';
  const inner = document.getElementById('pinned-audio-inner');
  if (inner) inner.style.display = hidden ? '' : 'none';
  const hideBtn = document.getElementById('btn-pinned-toggle');
  const showBtn = document.getElementById('btn-pinned-expand');
  if (hideBtn) hideBtn.style.display = hidden ? '' : 'none';
  if (showBtn) showBtn.style.display = hidden ? 'none' : '';
}

function _setAudioSrc(src) {
  const pinned = document.getElementById('pinned-audio-player');
  if (pinned) pinned.src = src;
  showPinnedPlayer();
}

function clearAudioState() {
  _audioTranscript = null;
  const pinned = document.getElementById('pinned-audio-player');
  if (pinned) { pinned.pause(); pinned.src = ''; }
  const bar = document.getElementById('pinned-audio-bar');
  if (bar) { bar.style.display = 'none'; bar.dataset.hidden = ''; }
  document.body.classList.remove('has-pinned-audio');
  const hideBtn = document.getElementById('btn-pinned-toggle');
  const showBtn = document.getElementById('btn-pinned-expand');
  if (hideBtn) hideBtn.style.display = '';
  if (showBtn) showBtn.style.display = 'none';
  const transcriptBox = document.getElementById('audio-transcript');
  if (transcriptBox) { transcriptBox.value = ''; transcriptBox.style.display = 'none'; }
  const statusEl = document.getElementById('audio-upload-status');
  if (statusEl) { statusEl.textContent = 'MP3, WAV, M4A, MP4…'; statusEl.className = 'upload-status'; }
}

async function restoreAudio() {
  clearAudioState();
  try {
    const file = await idbGet(_audioKey() + '-file');
    const words = await idbGet(_audioKey() + '-transcript');
    const transcriptBox = document.getElementById('audio-transcript');
    const statusEl = document.getElementById('audio-upload-status');
    if (file) {
      const src = URL.createObjectURL(file);
      _setAudioSrc(src);
    }
    if (words?.length) {
      _audioTranscript = words;
      const fullText = words.map(w => `[${formatTimestamp(w.start)}] ${w.word}`).join(' ');
      if (transcriptBox) { transcriptBox.value = fullText; transcriptBox.style.display = ''; }
      if (statusEl) { statusEl.textContent = `${words.length} words transcribed`; statusEl.className = 'upload-status done'; }
    }
  } catch(e) { console.warn('restoreAudio failed', e); }
}

async function handleAudioUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('audio-upload-status');
  const player = document.getElementById('audio-player');
  const transcriptBox = document.getElementById('audio-transcript');
  if (statusEl) { statusEl.textContent = 'Transcribing…'; statusEl.className = 'upload-status loading'; }
  await _saveAudio(file);
  _setAudioSrc(URL.createObjectURL(file));
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/transcribe-audio', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    _audioTranscript = data.words || [];
    await _saveTranscript(_audioTranscript);
    const fullText = _audioTranscript.map(w => `[${formatTimestamp(w.start)}] ${w.word}`).join(' ');
    if (transcriptBox) { transcriptBox.value = fullText; transcriptBox.style.display = ''; }
    if (statusEl) { statusEl.textContent = `Transcribed ${_audioTranscript.length} words`; statusEl.className = 'upload-status done'; }
    matchTranscriptToShots();
  } catch(e) {
    if (statusEl) { statusEl.textContent = 'Error: ' + e.message; statusEl.className = 'upload-status error'; }
    showToast('Transcription failed: ' + e.message, true);
  }
  input.value = '';
}

function formatTimestamp(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  const ms = Math.floor((secs % 1) * 10);
  return `${m}:${s}.${ms}`;
}

function matchShotToTranscript(shot) {
  if (!_audioTranscript?.length || !shot.lyric?.trim()) return false;
  const words = _audioTranscript;
  const lyricWords = shot.lyric.trim().toLowerCase().split(/\s+/);
  const firstLyricWord = lyricWords[0];
  let bestMatch = -1, bestScore = 0;
  for (let i = 0; i < words.length; i++) {
    const tw = words[i].word.toLowerCase().replace(/[^a-z0-9]/g, '');
    const lw = firstLyricWord.replace(/[^a-z0-9]/g, '');
    if (tw === lw || (lw.length > 3 && (tw.startsWith(lw) || lw.startsWith(tw)))) {
      let score = 0;
      for (let j = 0; j < Math.min(lyricWords.length, 4) && i + j < words.length; j++) {
        const ta = words[i + j].word.toLowerCase().replace(/[^a-z0-9]/g, '');
        const la = lyricWords[j].replace(/[^a-z0-9]/g, '');
        if (ta === la || (la.length > 2 && (ta.startsWith(la) || la.startsWith(ta)))) score++;
        else break;
      }
      if (score > bestScore) { bestScore = score; bestMatch = i; }
    }
  }
  if (bestMatch >= 0) { shot.timestamp = formatTimestamp(words[bestMatch].start); return true; }
  return false;
}

function matchTranscriptToShots() {
  if (!_audioTranscript?.length || !shots.length) return;
  syncFromDOM();

  // First pass: direct transcript matches
  const directMatch = shots.map(shot => matchShotToTranscript(shot));

  // Build anchor list: shots that got a direct match, with their timestamp in seconds
  const anchors = []; // { idx, secs }
  shots.forEach((shot, idx) => {
    if (directMatch[idx] && shot.timestamp) {
      const secs = parseTimestamp(shot.timestamp);
      if (secs != null && !isNaN(secs)) anchors.push({ idx, secs });
    }
  });

  if (anchors.length > 0) {
    // Shots before the first anchor — interpolate from 0:00 to first anchor
    const first = anchors[0];
    if (first.idx > 0) {
      for (let i = 0; i < first.idx; i++) {
        const t = first.secs * (i / first.idx);
        shots[i].timestamp = formatTimestamp(t);
      }
    }

    // Shots between consecutive anchors — interpolate evenly
    for (let a = 0; a < anchors.length - 1; a++) {
      const lo = anchors[a], hi = anchors[a + 1];
      const span = hi.idx - lo.idx;
      for (let i = lo.idx + 1; i < hi.idx; i++) {
        if (!directMatch[i]) {
          const t = lo.secs + (hi.secs - lo.secs) * ((i - lo.idx) / span);
          shots[i].timestamp = formatTimestamp(t);
        }
      }
    }
  }

  renderShots();
  autoSave();
  showToast('Timestamps matched to shots.');
}

function retryTimestampForShot(shotId) {
  if (!_audioTranscript?.length) { showToast('No transcript loaded.', true); return; }
  syncFromDOM();
  const shot = shots.find(s => s.id === shotId);
  if (!shot) return;
  const found = matchShotToTranscript(shot);
  // Update just the timestamp input and play button without full re-render
  const input = document.querySelector(`.field-timestamp[data-shot-id="${shotId}"]`);
  if (input) input.value = shot.timestamp || '';
  const playBtn = document.getElementById(`btn-play-${shotId}`);
  if (playBtn) {
    const hasTs = shot.timestamp && shot.timestamp !== '0:00';
    playBtn.style.opacity = hasTs ? '1' : '0.2';
    playBtn.style.pointerEvents = hasTs ? '' : 'none';
  }
  autoSave();
  showToast(found ? `Timestamp set to ${shot.timestamp}` : 'No match found in transcript.', !found);
}

function onTimestampInput(input) {
  const shotId = input.dataset.shotId;
  const val = input.value.trim();
  const btn = document.getElementById(`btn-play-${shotId}`);
  if (!btn) return;
  const hasTs = val && val !== '0:00';
  btn.style.opacity = hasTs ? '1' : '0.2';
  btn.style.pointerEvents = hasTs ? '' : 'none';
}

function parseTimestamp(ts) {
  if (!ts) return null;
  // Accepts "1:23.4", "1:23", "83.4" (seconds)
  const parts = ts.split(':');
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(parts[0]);
}

function playAudioAtShot(shotId) {
  const player = getPinnedPlayer();
  if (!player || !player.src) { showToast('No audio loaded yet.', true); return; }
  const idx = shots.findIndex(s => s.id === shotId);
  if (idx < 0) return;

  // Read timestamp live from DOM (user may have typed one since render)
  const inputEl = document.querySelector(`.field-timestamp[data-shot-id="${shotId}"]`);
  const tsVal = inputEl ? inputEl.value.trim() : shots[idx].timestamp;
  const startTs = parseTimestamp(tsVal);
  if (startTs === null) return;

  // Find next shot with a real timestamp
  let endTs = null;
  for (let i = idx + 1; i < shots.length; i++) {
    const inputNext = document.querySelector(`.field-timestamp[data-shot-id="${shots[i].id}"]`);
    const nextTs = parseTimestamp(inputNext ? inputNext.value.trim() : shots[i].timestamp);
    if (nextTs !== null && nextTs > 0) { endTs = nextTs; break; }
  }

  showPinnedPlayer();

  // Clear any existing stop-listener from a previous playAudioAtShot call
  if (player._shotStopCheck) {
    player.removeEventListener('timeupdate', player._shotStopCheck);
    player._shotStopCheck = null;
  }

  const doPlay = () => {
    player.play().catch(() => {});
    if (endTs !== null) {
      const stopAt = endTs;
      player._shotStopCheck = () => {
        if (player.currentTime >= stopAt) {
          player.pause();
          player.removeEventListener('timeupdate', player._shotStopCheck);
          player._shotStopCheck = null;
        }
      };
      player.addEventListener('timeupdate', player._shotStopCheck);
    }
  };

  if (Math.abs(player.currentTime - startTs) < 0.05) {
    // Already at the right position — just play
    doPlay();
  } else {
    player.addEventListener('seeked', doPlay, { once: true });
    player.currentTime = startTs;
  }
}

function formatAttributesHtml(attributes) {
  if (!attributes?.length) return '';
  const items = attributes.map(a => {
    const label = a.sometimes ? `Sometimes ${a.text.charAt(0).toLowerCase() + a.text.slice(1)}` : a.text;
    return `<li>• <strong>${esc(label)}</strong> — <span class="reasoning">${esc(a.reasoning)}</span></li>`;
  });
  return `<ul>${items.join('')}</ul>`;
}

function extractBoldText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const bolds = [...div.querySelectorAll('strong, b')].map(el => el.textContent.trim()).filter(Boolean);
  if (bolds.length) return bolds.join(', ');
  return div.textContent.trim();
}

function singularize(name) {
  name = name.trim();
  if (/ies$/i.test(name)) return name.replace(/ies$/i, 'y');
  if (/(ses|zes|xes|ches|shes)$/i.test(name)) return name.replace(/(es)$/i, '');
  if (/s$/i.test(name) && !/ss$/i.test(name)) return name.replace(/s$/i, '');
  return name;
}

function dismissShotMissingFlag(shotId) {
  dismissMissingFlag('shot', shotId);
}

function dismissMissingFlag(type, id) {
  if (type === 'shot') {
    const s = shots.find(x => x.id === id);
    if (s) { delete s.missingFromScript; autoSave(); renderShots(); }
  } else if (type === 'char') {
    const c = characters.find(x => x.id === id);
    if (c) { delete c.missingFromScript; autoSave(); renderCharacters(); }
  } else if (type === 'loc') {
    const l = locations.find(x => x.id === id);
    if (l) { delete l.missingFromScript; autoSave(); renderLocations(); }
  }
}

function dismissDuplicateFlag(type, id) {
  if (type === 'loc') {
    const l = locations.find(x => x.id === id);
    if (l) { l.possibleDuplicate = false; autoSave(); renderLocations(); }
  } else if (type === 'char') {
    const c = characters.find(x => x.id === id);
    if (c) { c.possibleDuplicate = false; autoSave(); renderCharacters(); }
  }
}

function mergeLocationsIntoOne(keepId, dropId) {
  const keep = locations.find(l => l.id === keepId);
  const drop = locations.find(l => l.id === dropId);
  if (!keep || !drop) return;
  // Store the dropped name (and its aliases) on the keeper so future imports recognise both
  keep.aliases = [...(keep.aliases || []), drop.name, ...(drop.aliases || [])].filter(Boolean);
  // Redirect all shots that referenced the dropped location
  for (const s of shots) { if (s.locationId === dropId) s.locationId = keepId; }
  // Remove the duplicate
  locations = locations.filter(l => l.id !== dropId);
  // Re-run duplicate detection
  for (let i = 0; i < locations.length; i++) {
    locations[i].possibleDuplicate = false;
    for (let j = 0; j < locations.length; j++) {
      if (i !== j && locations[i].name && locations[j].name && locationsSimilar(locations[i].name, locations[j].name)) {
        locations[i].possibleDuplicate = true; break;
      }
    }
  }
  renderLocations();
  renderShots();
  autoSave();
  showToast(`Merged "${drop.name}" into "${keep.name}".`);
}

function locationsSimilar(a, b) {
  const stop = new Set(['the','a','an','of','in','at','on','and','or','with','near','by']);
  const words = s => s.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stop.has(w));
  const w1 = words(a), w2 = words(b);
  if (!w1.length || !w2.length) return false;
  const shared = w1.filter(w => w2.includes(w));
  return shared.length >= Math.min(w1.length, w2.length) * 0.6;
}

function mergeCharacters(incoming, flagMissing = false) {
  const incomingNames = new Set(incoming.flatMap(c => {
    if (c.isPlural && (c.pluralCount || 1) > 1) {
      const base = singularize(c.name);
      return Array.from({ length: c.pluralCount || 3 }, (_, i) => `${base} #${i + 1}`.toLowerCase());
    }
    return [(c.name || '').trim().toLowerCase()];
  }));
  if (flagMissing) {
    for (const c of characters) {
      if (c.name.trim()) c.missingFromScript = !incomingNames.has(c.name.trim().toLowerCase());
    }
  }
  if (incoming.length) {
    characters = characters.filter(c => c.name.trim() || c.reference.trim() || c.prompt.trim() || c.images?.length);
  }
  for (const c of incoming) {
    if (c.isPlural && (c.pluralCount || 1) > 1) {
      const base = singularize(c.name);
      const count = c.pluralCount || 3;
      for (let i = 1; i <= count; i++) {
        const charName = `${base} #${i}`;
        const existing = characters.find(x => x.name.trim().toLowerCase() === charName.toLowerCase());
        if (!existing) {
          const char = { ...newCharacter(), name: charName };
          char.reference = formatAttributesHtml(c.attributes);
          char.attributes = c.attributes;
          characters.push(char);
        } else {
          existing.missingFromScript = false;
        }
      }
    } else {
      const name = (c.name || '').trim();
      const existing = characters.find(x => x.name.trim().toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.missingFromScript = false;
        if (!existing.reference && c.attributes?.length) {
          existing.reference = formatAttributesHtml(c.attributes);
          existing.attributes = c.attributes;
        }
      } else {
        const char = { ...newCharacter(), name };
        if (c.attributes?.length) {
          char.reference = formatAttributesHtml(c.attributes);
          char.attributes = c.attributes;
        } else if (c.description) {
          char.reference = c.description;
        }
        characters.push(char);
      }
    }
  }
  if (!characters.length) characters = [newCharacter()];
  renderCharacters();
  renderShots();
  autoSave();
}

function mergeLocations(incoming, flagMissing = false) {
  const incomingNames = new Set(incoming.map(l => (l.name || '').trim().toLowerCase()));
  if (flagMissing) {
    for (const l of locations) {
      if (l.name.trim()) l.missingFromScript = !incomingNames.has(l.name.trim().toLowerCase());
    }
  }
  if (incoming.length) {
    locations = locations.filter(l => l.name.trim() || l.reference.trim() || l.prompt.trim() || l.images?.length);
  }
  for (const l of incoming) {
    const name = (l.name || '').trim();
    const nameLower = name.toLowerCase();
    const existing = locations.find(x =>
      x.name.trim().toLowerCase() === nameLower ||
      (x.aliases || []).some(a => a.trim().toLowerCase() === nameLower)
    );
    if (existing) {
      existing.missingFromScript = false;
      if (!existing.reference && l.description) existing.reference = l.description;
    } else {
      locations.push({ ...newLocation(), name, reference: l.description || '' });
    }
  }
  if (!locations.length) locations = [newLocation()];
  // Flag possible duplicates
  for (let i = 0; i < locations.length; i++) {
    locations[i].possibleDuplicate = false;
    for (let j = 0; j < locations.length; j++) {
      if (i !== j && locations[i].name && locations[j].name && locationsSimilar(locations[i].name, locations[j].name)) {
        locations[i].possibleDuplicate = true;
        break;
      }
    }
  }
  renderLocations();
  renderShots();
  autoSave();
}

function flagMissingShots(scriptText) {
  const lowerScript = scriptText.toLowerCase();
  for (const s of shots) {
    if (s.lyric && s.lyric.trim()) {
      // Flag if a meaningful chunk of the lyric text doesn't appear in the script
      const words = s.lyric.trim().toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matchCount = words.filter(w => lowerScript.includes(w)).length;
      s.missingFromScript = words.length > 0 && matchCount < words.length * 0.4;
    } else {
      s.missingFromScript = false;
    }
  }
  renderShots();
  autoSave();
}

async function generateCharactersFromScript() {
  if (!lastScriptText) { showToast('Upload a script first.', true); return; }
  const btn = document.getElementById('btn-gen-chars');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  try {
    syncFromDOM();
    const data = await apiFetch('/api/parse-characters', { scriptText: lastScriptText });
    if (data.characters?.length) mergeCharacters(data.characters);
    showToast(`Generated ${data.characters?.length ?? 0} characters.`);
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Characters'; }
}

async function fixLocationPrefixes() {
  syncFromDOM();
  if (!locations.length) { showToast('No locations to fix.', true); return; }
  const btn = document.querySelector('[onclick="fixLocationPrefixes()"]');
  if (btn) { btn.disabled = true; btn.textContent = '✦ Fixing…'; }
  try {
    const payload = locations.map(l => ({ id: l.id, name: l.name }));
    const data = await apiFetch('/api/fix-location-prefixes', { locations: payload, scriptText: lastScriptText || null });
    for (const fixed of (data.locations || [])) {
      const loc = locations.find(l => l.id === fixed.id);
      if (loc) loc.name = fixed.name;
    }
    renderLocations();
    renderShots();
    autoSave();
    showToast(`Updated ${data.locations?.length ?? 0} location names.`);
  } catch(e) {
    showToast('Failed: ' + e.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Fix INT./EXT.'; }
  }
}

async function generateLocationsFromScript() {
  if (!lastScriptText) { showToast('Upload a script first.', true); return; }
  const btn = document.getElementById('btn-gen-locs');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  try {
    syncFromDOM();
    const data = await apiFetch('/api/parse-locations', { scriptText: lastScriptText });
    if (data.locations?.length) mergeLocations(data.locations);
    showToast(`Generated ${data.locations?.length ?? 0} locations.`);
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Locations'; }
}

async function generateShotSequence() {
  if (!lastScriptText) { showToast('Upload a script first.', true); return; }
  const btn = document.getElementById('btn-gen-shots');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  try {
    syncFromDOM();
    const data = await apiFetch('/api/generate-shot-sequence', {
      scriptText: lastScriptText,
      characters: characters.map(c => ({ id: c.id, name: c.name })),
      locations: locations.map(l => ({ id: l.id, name: l.name }))
    });
    if (data.shots?.length) {
      const newShots = data.shots.map(s => ({ ...newShot(), ...s, characterIds: s.characterIds || [], locationId: s.locationId || (s.locationIds?.[0] || '') }));
      shots = [...shots.filter(s => s.lyric || s.description), ...newShots];
    }
    renderShots();
    autoSave();
    showToast(`Generated ${data.shots?.length ?? 0} shots.`);
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Shot Sequence'; }
}

// ── image upload ──────────────────────────────────────────────────────────
// Resize to max 800px on longest side at 75% JPEG to keep base64 under ~200KB for Supabase sync.
function resizeForUpload(imgEl, maxPx = 800) {
  const scale = Math.min(1, maxPx / Math.max(imgEl.width, imgEl.height));
  const w = Math.round(imgEl.width * scale);
  const h = Math.round(imgEl.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(imgEl, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
  return { dataUrl, base64: dataUrl.split(',')[1] };
}

function triggerImageUpload(id) { document.getElementById(`file-${id}`).click(); }
function handleImageUpload(id, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = async () => {
      const { dataUrl, base64 } = resizeForUpload(img);
      const char = characters.find(c => c.id === id);
      if (char) char.referenceImage = { dataUrl, base64, mediaType: 'image/jpeg' };
      // Upload to Supabase Storage in background for permanent URL
      let displayUrl = dataUrl;
      try {
        const r = await apiFetch('/api/upload-reference', { base64, mediaType: 'image/jpeg', projectId: currentProjectId, entityType: 'chars', entityId: id });
        if (r.url && char) { char.referenceImage = { ...char.referenceImage, url: r.url, dataUrl: r.url }; displayUrl = r.url; }
      } catch(e) { console.warn('ref upload failed', e); }
      const preview = document.querySelector(`tr[data-id="${id}"] .ref-img-preview`);
      if (preview) {
        preview.innerHTML = `<img src="${displayUrl}" alt="Reference"><button class="remove-img" onclick="removeRefImage('${id}', event)">✕</button>`;
        preview.onclick = () => toggleCharUseRef(id);
        const cell = preview.closest('.ref-img-cell');
        if (cell && !cell.querySelector('.use-ref-btn')) {
          const btn = document.createElement('button');
          btn.className = 'use-ref-btn';
          btn.style.cssText = 'background:none;border:1px solid #2a2a2a;border-radius:4px;color:#666;font-size:11px;padding:4px 8px;cursor:pointer;white-space:nowrap;margin-top:4px';
          btn.textContent = '📷 Use Ref as Default';
          btn.onclick = () => toggleCharUseRef(id);
          cell.appendChild(btn);
        }
      }
      autoSave();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function removeRefImage(id, event) {
  event.stopPropagation();
  const char = characters.find(c => c.id === id);
  if (char) char.referenceImage = null;
  const preview = document.querySelector(`#characters-body tr[data-id="${id}"] .ref-img-preview`);
  if (preview) {
    preview.innerHTML = `<div class="upload-hint">Click to<br>upload</div>`;
    preview.onclick = () => triggerImageUpload(id);
    const cell = preview.closest('.ref-img-cell');
    if (cell) { const b = cell.querySelector('.use-ref-btn'); if (b) b.remove(); }
  }
  autoSave();
}

// ── location image upload ─────────────────────────────────────────────────
function triggerLocImageUpload(id) { document.getElementById(`locfile-${id}`).click(); }
function handleLocImageUpload(id, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = async () => {
      const { dataUrl, base64 } = resizeForUpload(img);
      const loc = locations.find(l => l.id === id);
      if (loc) {
        loc.referenceImage = { dataUrl, base64, mediaType: 'image/jpeg' };
        if (!loc.images?.length && !loc.useRefAsDefault) loc.useRefAsDefault = true;
      }
      // Upload to Supabase Storage in background for permanent URL
      let displayUrl = dataUrl;
      try {
        const r = await apiFetch('/api/upload-reference', { base64, mediaType: 'image/jpeg', projectId: currentProjectId, entityType: 'locs', entityId: id });
        if (r.url && loc) { loc.referenceImage = { ...loc.referenceImage, url: r.url, dataUrl: r.url }; displayUrl = r.url; }
      } catch(e) { console.warn('loc ref upload failed', e); }
      const preview = document.querySelector(`#locations-body tr[data-id="${id}"] .ref-img-preview`);
      if (preview) {
        preview.innerHTML = `<img src="${displayUrl}" alt="Reference"><button class="remove-img" onclick="removeLocRefImage('${id}', event)">✕</button>`;
        preview.onclick = () => toggleLocUseRef(id);
        const cell = preview.closest('.ref-img-cell');
        if (cell && !cell.querySelector('.use-ref-btn')) {
          const btn = document.createElement('button');
          btn.className = 'use-ref-btn';
          btn.style.cssText = 'background:none;border:1px solid #2a2a2a;border-radius:4px;color:#666;font-size:11px;padding:4px 8px;cursor:pointer;white-space:nowrap;margin-top:4px';
          btn.textContent = '📷 Use Ref as Default View';
          btn.onclick = () => toggleLocUseRef(id);
          cell.appendChild(btn);
        }
      }
      autoSave();
      renderLocations();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function removeLocRefImage(id, event) {
  event.stopPropagation();
  const loc = locations.find(l => l.id === id);
  if (loc) loc.referenceImage = null;
  const preview = document.querySelector(`#locations-body tr[data-id="${id}"] .ref-img-preview`);
  if (preview) {
    preview.innerHTML = `<div class="upload-hint">Click to<br>upload</div>`;
    preview.onclick = () => triggerLocImageUpload(id);
    const cell = preview.closest('.ref-img-cell');
    if (cell) { const b = cell.querySelector('.use-ref-btn'); if (b) b.remove(); }
  }
  autoSave();
}

// ── location shot angles ───────────────────────────────────────────────────
function toggleLocAngles(id) {
  const row = document.getElementById(`loc-shots-${id}`);
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  row.style.display = isOpen ? 'none' : '';
  document.querySelectorAll(`#locations-body tr[data-id="${id}"] .btn-toggle-shot-angles`).forEach(btn => {
    btn.textContent = isOpen ? '▶ Variations' : '▼ Variations';
  });
}

function addLocCustomView(id) {
  syncFromDOM();
  const loc = locations.find(l => l.id === id);
  if (!loc) return;
  if (!loc.customViews) loc.customViews = [];
  loc.customViews.push({ id: genId(), name: '', prompt: '', image: null });
  renderLocations();
  // Ensure panel stays open
  const row = document.getElementById(`loc-shots-${id}`);
  if (row) {
    row.style.display = '';
    const btn = document.querySelector(`#locations-body tr[data-id="${id}"] .btn-toggle-shot-angles`);
    if (btn) btn.textContent = '▼ Variations';
  }
  autoSave();
}

function deleteLocCustomView(id, idx) {
  syncFromDOM();
  const loc = locations.find(l => l.id === id);
  if (!loc || !loc.customViews) return;
  loc.customViews.splice(idx, 1);
  renderLocations();
  const row = document.getElementById(`loc-shots-${id}`);
  if (row) {
    row.style.display = '';
    const btn = document.querySelector(`#locations-body tr[data-id="${id}"] .btn-toggle-shot-angles`);
    if (btn) btn.textContent = '▼ Variations';
  }
  autoSave();
}

// Delete by cv.id — used from compose bg thumbnails
function deleteLocCustomViewById(locId, cvId) {
  const loc = locations.find(l => l.id === locId);
  if (!loc?.customViews) return;
  const idx = loc.customViews.findIndex(cv => cv.id === cvId);
  if (idx === -1) return;
  loc.customViews.splice(idx, 1);
  renderLocations();
  autoSave();
  // Rebuild compose bg thumbs if compose is open for this location's shot
  if (_compose) {
    const shot = shots.find(s => s.id === _compose.shotId);
    if (shot) buildComposeLocThumbs(shot);
  }
}

// Delete a generated character variant by its angle key
function deleteCharVariant(charId, variantKey) {
  const char = characters.find(c => c.id === charId);
  if (!char?.angles?.[variantKey]) return;
  // Remove from char.angles
  delete char.angles[variantKey];
  // Also remove from expressionCache — key format is "angle · expr"
  const sep = variantKey.indexOf(' · ');
  if (sep !== -1) {
    const angle = variantKey.slice(0, sep);
    const expr = variantKey.slice(sep + 3).toLowerCase();
    if (char.expressionCache?.[angle]?.[expr]) delete char.expressionCache[angle][expr];
  }
  // If this was the currently selected variation, fall back to Front
  if (_selectedCompExpr && _selectedCompAngle + ' · ' + _selectedCompExpr === variantKey) {
    _selectedCompAngle = 'Front';
    _selectedCompExpr = '';
  }
  // Refresh main page angle sub-row
  const tbody = document.querySelector(`#char-angles-${charId} .char-angle-inner table tbody`);
  if (tbody) tbody.innerHTML = charAngleRowsInnerHTML(char);
  // Refresh compose detail if that char is selected
  if (_selectedCompCharId === charId) {
    const detailWrap = document.getElementById('compose-char-detail-wrap');
    if (detailWrap) detailWrap.innerHTML = compCharDetailHTML();
    else renderComposeLayerTab();
  }
  autoSave();
}

function onLocCustomViewNameChange(id, idx, value) {
  const loc = locations.find(l => l.id === id);
  if (!loc || !loc.customViews?.[idx]) return;
  loc.customViews[idx].name = value;
  debouncedSave();
}

function onLocCustomViewPromptChange(id, idx, value) {
  const loc = locations.find(l => l.id === id);
  if (!loc || !loc.customViews?.[idx]) return;
  loc.customViews[idx].prompt = value;
  debouncedSave();
}

async function generateLocCustomView(id, idx) {
  const loc = locations.find(l => l.id === id);
  if (!loc || !loc.customViews?.[idx]) return;
  const cv = loc.customViews[idx];
  const slot = document.getElementById(`loc-custom-img-${id}-${idx}`);
  const row = slot?.closest('tr');
  const btn = row?.querySelector('.btn-regen-angle');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  let prompt = cv.prompt;
  if (!prompt) { showToast('Add a prompt for this view first.', true); if (btn) { btn.disabled = false; btn.textContent = 'Generate'; } return; }

  // Row ref image overrides location default image
  let refImageUrl;
  if (cv.refImage) {
    const uploaded = await apiFetch('/api/upload-reference', { base64: cv.refImage.base64, mediaType: cv.refImage.mediaType });
    refImageUrl = uploaded.url;
  } else {
    refImageUrl = locDefaultImage(loc);
  }

  try {
    const data = refImageUrl
      ? await apiFetch('/api/generate-shot-images', { prompt, referenceImageUrls: [refImageUrl], stylePrompt: getStylePrompt() })
      : await apiFetch('/api/generate-images', { prompt, stylePrompt: getStylePrompt() });
    const imgUrl = data.images?.[0];
    if (imgUrl) {
      loc.customViews[idx].image = imgUrl;
      if (slot) slot.innerHTML = `<img src="${esc(imgUrl)}" alt="">`;
      autoSave();
    }
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Generate'; } }
}

function handleCharAngleRefUpload(charId, angle, input) {
  const file = input.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const { dataUrl, base64 } = resizeForUpload(img);
      const char = characters.find(c => c.id === charId);
      if (!char) return;
      if (!char.angles) char.angles = {};
      if (!char.angles[angle]) char.angles[angle] = {};
      char.angles[angle].refImage = { dataUrl, base64, mediaType: 'image/jpeg' };
      autoSave(); renderCharacters();
      const row = document.getElementById(`char-angles-${charId}`);
      if (row) row.style.display = '';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeCharAngleRefImage(charId, angle) {
  const char = characters.find(c => c.id === charId);
  if (!char?.angles?.[angle]) return;
  delete char.angles[angle].refImage;
  delete char.angles[angle].useRef;
  autoSave(); renderCharacters();
  const row = document.getElementById(`char-angles-${charId}`);
  if (row) row.style.display = '';
}

function toggleCharAngleUseRef(charId, angle) {
  const char = characters.find(c => c.id === charId);
  if (!char?.angles?.[angle]) return;
  char.angles[angle].useRef = !char.angles[angle].useRef;
  autoSave(); renderCharacters();
  const row = document.getElementById(`char-angles-${charId}`);
  if (row) row.style.display = '';
}

function handleLocAngleRefUpload(locId, angle, input) {
  const file = input.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const { dataUrl, base64 } = resizeForUpload(img);
      const loc = locations.find(l => l.id === locId);
      if (!loc) return;
      if (!loc.shotAngles) loc.shotAngles = {};
      if (!loc.shotAngles[angle]) loc.shotAngles[angle] = {};
      loc.shotAngles[angle].refImage = { dataUrl, base64, mediaType: 'image/jpeg' };
      if (!loc.shotAngles[angle].image) loc.shotAngles[angle].useRef = true;
      autoSave(); renderLocations();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeLocAngleRefImage(locId, angle) {
  const loc = locations.find(l => l.id === locId);
  if (!loc?.shotAngles?.[angle]) return;
  delete loc.shotAngles[angle].refImage;
  delete loc.shotAngles[angle].useRef;
  autoSave(); renderLocations();
}

function toggleLocAngleUseRef(locId, angle) {
  const loc = locations.find(l => l.id === locId);
  if (!loc?.shotAngles?.[angle]) return;
  loc.shotAngles[angle].useRef = !loc.shotAngles[angle].useRef;
  autoSave(); renderLocations();
}

function handleLocCustomRefUpload(locId, idx, input) {
  const file = input.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const { dataUrl, base64 } = resizeForUpload(img);
      const loc = locations.find(l => l.id === locId);
      if (!loc?.customViews?.[idx]) return;
      loc.customViews[idx].refImage = { dataUrl, base64, mediaType: 'image/jpeg' };
      if (!loc.customViews[idx].image) loc.customViews[idx].useRef = true;
      autoSave(); renderLocations();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeLocCustomRefImage(locId, idx) {
  const loc = locations.find(l => l.id === locId);
  if (!loc?.customViews?.[idx]) return;
  delete loc.customViews[idx].refImage;
  delete loc.customViews[idx].useRef;
  autoSave(); renderLocations();
}

function toggleLocCustomViewUseRef(locId, idx) {
  const loc = locations.find(l => l.id === locId);
  if (!loc?.customViews?.[idx]) return;
  loc.customViews[idx].useRef = !loc.customViews[idx].useRef;
  autoSave(); renderLocations();
}

function onLocAnglePromptChange(id, angleName, value) {
  const loc = locations.find(l => l.id === id);
  if (!loc) return;
  if (!loc.shotAngles) loc.shotAngles = {};
  if (!loc.shotAngles[angleName]) loc.shotAngles[angleName] = {};
  loc.shotAngles[angleName].prompt = value;
  debouncedSave();
}

async function generateLocAltViews(id) {
  const loc = locations.find(l => l.id === id);
  if (!loc) return;
  const refImageUrl = locDefaultImage(loc);
  if (!refImageUrl) { showToast('Generate a default view first.', true); return; }
  const btn = document.querySelector(`#locations-body tr[data-id="${id}"] .btn-gen-shot-angles`);
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  // Ensure angles row is visible
  const shotRow = document.getElementById(`loc-shots-${id}`);
  if (shotRow) shotRow.style.display = '';
  const toggleBtn = document.querySelector(`#locations-body tr[data-id="${id}"] .btn-toggle-shot-angles`);
  if (toggleBtn) toggleBtn.textContent = '▼ Variations';

  if (!loc.shotAngles) loc.shotAngles = {};

  // Step 1: generate prompts for all angles
  let prompts = {};
  try {
    const data = await apiFetch('/api/generate-location-angle-prompts', {
      locationPrompt: loc.prompt,
      locationName: loc.name,
      angles: LOC_ANGLES
    });
    prompts = data.prompts || {};
  } catch(e) {
    showToast('Failed to generate angle prompts.', true);
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Variations'; }
    return;
  }

  // Save prompts to state and update textareas
  for (const angle of LOC_ANGLES) {
    if (!loc.shotAngles[angle]) loc.shotAngles[angle] = {};
    if (prompts[angle]) {
      loc.shotAngles[angle].prompt = prompts[angle];
      const key = angle.replace(/\s+/g, '-');
      const row = document.getElementById(`loc-shots-${id}`);
      const textarea = row?.querySelector(`[id="loc-angle-img-${id}-${key}"]`)?.closest('tr')?.querySelector('.loc-angle-prompt');
      if (textarea) textarea.value = prompts[angle];
    }
  }
  autoSave();

  // Step 2: generate images for each angle sequentially
  const stylePrompt = getStylePrompt();
  for (const angle of LOC_ANGLES) {
    const prompt = loc.shotAngles[angle]?.prompt;
    if (!prompt) continue;
    try {
      const data = await apiFetch('/api/generate-shot-images', {
        prompt,
        referenceImageUrls: [refImageUrl],
        stylePrompt
      });
      const imgUrl = data.images?.[0];
      if (imgUrl) {
        loc.shotAngles[angle].image = imgUrl;
        const key = angle.replace(/\s+/g, '-');
        const slot = document.getElementById(`loc-angle-img-${id}-${key}`);
        if (slot) slot.innerHTML = `<img src="${esc(imgUrl)}" alt="${esc(angle)}">`;
        autoSave();
      }
    } catch(e) { console.error('angle image failed for', angle, e); }
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Generate Variations'; }
  showToast('Shot angles generated.');
}

async function generateLocAngleSingle(id, angleName) {
  const loc = locations.find(l => l.id === id);
  if (!loc) return;
  // Row ref image overrides the location default image
  const rowRefImage = loc.shotAngles?.[angleName]?.refImage;
  let refImageUrl;
  if (rowRefImage) {
    const uploaded = await apiFetch('/api/upload-reference', { base64: rowRefImage.base64, mediaType: rowRefImage.mediaType });
    refImageUrl = uploaded.url;
  } else {
    refImageUrl = locDefaultImage(loc);
    if (!refImageUrl) { showToast('Generate a default view first, or upload a reference image for this row.', true); return; }
  }
  if (!loc.shotAngles) loc.shotAngles = {};
  if (!loc.shotAngles[angleName]) loc.shotAngles[angleName] = {};

  const key = angleName.replace(/\s+/g, '-');
  const slot = document.getElementById(`loc-angle-img-${id}-${key}`);
  const row = slot?.closest('tr');
  const regenBtn = row?.querySelector('.btn-regen-angle');
  if (regenBtn) { regenBtn.disabled = true; regenBtn.textContent = '…'; }

  // If no prompt yet, generate one first
  let prompt = loc.shotAngles[angleName].prompt;
  if (!prompt) {
    try {
      const data = await apiFetch('/api/generate-location-angle-prompts', {
        locationPrompt: loc.prompt,
        locationName: loc.name,
        angles: [angleName]
      });
      prompt = data.prompts?.[angleName] || '';
      if (prompt) {
        loc.shotAngles[angleName].prompt = prompt;
        const textarea = row?.querySelector('.loc-angle-prompt');
        if (textarea) textarea.value = prompt;
      }
    } catch(e) { /* proceed with empty prompt */ }
  }

  if (!prompt) { showToast('No prompt for this angle.', true); if (regenBtn) { regenBtn.disabled = false; regenBtn.textContent = 'Regenerate'; } return; }

  try {
    const data = await apiFetch('/api/generate-shot-images', {
      prompt,
      referenceImageUrls: [refImageUrl],
      stylePrompt: getStylePrompt()
    });
    const imgUrl = data.images?.[0];
    if (imgUrl) {
      loc.shotAngles[angleName].image = imgUrl;
      if (slot) slot.innerHTML = `<img src="${esc(imgUrl)}" alt="${esc(angleName)}">`;
      autoSave();
    }
  } catch(e) { showToast('Image generation failed.', true); }
  if (regenBtn) { regenBtn.disabled = false; regenBtn.textContent = 'Regenerate'; }
}

// ── generate location prompt ──────────────────────────────────────────────
async function generateLocPrompt(id) {
  const row = document.querySelector(`#locations-body tr[data-id="${id}"]`);
  const btn = row.querySelector('.btn-gen-prompt');
  const loc = locations.find(l => l.id === id);
  const reference = row.querySelector('.field-ref').value.trim();
  if (!reference && !loc?.referenceImage) { showToast('Add a reference description or image first.', true); return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  try {
    const body = { referenceDescription: reference, visualStyle: selectedStyleId, isLocation: true, customRules: locationGenRules };
    if (loc?.referenceImage) body.referenceImage = { base64: loc.referenceImage.base64, mediaType: loc.referenceImage.mediaType };
    const data = await apiFetch('/api/generate-prompt', body);
    row.querySelector('.field-prompt').value = data.prompt;
    if (loc) { loc.reference = reference; loc.prompt = data.prompt; }
    autoSave();
    showToast('Prompt generated.');
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Prompt'; }
}

// ── generate location images ──────────────────────────────────────────────
async function generateLocImages(id) {
  const row = document.querySelector(`#locations-body tr[data-id="${id}"]`);
  const btn = row?.querySelector('.btn-gen-images');
  const prompt = row?.querySelector('.field-prompt').value.trim();
  if (!prompt) { showToast('Generate a prompt first.', true); return; }
  const loc = locations.find(l => l.id === id);
  const grid = document.getElementById(`loc-imgs-${id}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…'; }
  grid.innerHTML = loadingSlots(1);
  const stylePrompt = getStylePrompt();
  // If a reference image is uploaded, use kontext to keep visual consistency with it
  let locImageUrls = [];
  if (loc?.referenceImage) {
    try {
      const uploaded = await apiFetch('/api/upload-reference', { base64: loc.referenceImage.base64, mediaType: loc.referenceImage.mediaType });
      locImageUrls = [uploaded.url];
    } catch(e) { /* fall back to pure AI if upload fails */ }
  }
  try {
    const data = await apiFetch('/api/generate-shot-images', { prompt, stylePrompt, locImageUrls });
    const newImgs = data.images.slice(0, 1);
    if (loc) {
      loc.images = [...(loc.images || []), ...newImgs.filter(u => !(loc.images || []).includes(u))];
      loc.useRefAsDefault = false;
    }
    grid.innerHTML = imageSlots(loc.images, loc.images.length);
    autoSave();
    renderLocations();
    showToast('Default view generated.');
  } catch(e) { grid.innerHTML = emptySlots(1); showToast('Error: ' + e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = 'Generate Default View (AI)'; } }
}

function toggleLocUseRef(id) {
  const loc = locations.find(l => l.id === id);
  if (!loc || !loc.referenceImage) return;
  loc.useRefAsDefault = !loc.useRefAsDefault;
  const grid = document.getElementById(`loc-imgs-${id}`);
  if (grid) {
    if (loc.useRefAsDefault) {
      grid.innerHTML = imageSlots([loc.referenceImage.dataUrl], 1);
    } else {
      grid.innerHTML = loc.images?.length ? imageSlots(loc.images, 1) : emptySlots(1);
    }
  }
  const row = document.querySelector(`#locations-body tr[data-id="${id}"]`);
  if (row) {
    const btn = row.querySelector('.use-ref-btn');
    if (btn) {
      const on = loc.useRefAsDefault;
      btn.style.background = on ? '#1a2a1a' : 'none';
      btn.style.borderColor = on ? '#4ade80' : '#2a2a2a';
      btn.style.color = on ? '#4ade80' : '#666';
      btn.textContent = on ? '📷 Using Ref as Default View' : '📷 Use Ref as Default View';
    }
  }
  autoSave();
}

function toggleCharUseRef(id) {
  const char = characters.find(c => c.id === id);
  if (!char || !char.referenceImage) return;
  char.useRefAsDefault = !char.useRefAsDefault;
  const slot = document.getElementById(`char-front-${id}`);
  if (slot) {
    const img = charDefaultImage(char);
    slot.innerHTML = img ? `<img src="${esc(img)}" alt="Front">` : `<span class="placeholder">·</span>`;
  }
  const row = document.querySelector(`#characters-body tr[data-id="${id}"]`);
  if (row) {
    const btn = row.querySelector('.use-ref-btn');
    if (btn) {
      const on = char.useRefAsDefault;
      btn.style.background = on ? '#1a2a1a' : 'none';
      btn.style.borderColor = on ? '#4ade80' : '#2a2a2a';
      btn.style.color = on ? '#4ade80' : '#666';
      btn.textContent = on ? '📷 Using Ref as Default' : '📷 Use Ref as Default';
    }
  }
  autoSave();
}

// ── generate character prompt ─────────────────────────────────────────────
async function generateCharPrompt(id) {
  const row = document.querySelector(`#characters-body tr[data-id="${id}"]`);
  const btn = row.querySelector('.btn-gen-prompt');
  const char = characters.find(c => c.id === id);
  const refEl = row.querySelector('.field-ref');
  const rawRef = refEl.tagName === 'TEXTAREA' ? refEl.value : refEl.innerHTML;
  const reference = extractBoldText(rawRef);
  if (!reference && !char?.referenceImage) { showToast('Add a reference description or image first.', true); return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  try {
    const variantHint = char?.name && / #\d+/.test(char.name)
      ? ` (Variant ${char.name.match(/ #(\d+)/)[1]} — make this character visually distinct from others in this group while keeping the same general attributes)`
      : '';
    const referenceWithHint = reference + variantHint;
    const body = { referenceDescription: referenceWithHint, visualStyle: selectedStyleId, customRules: charGenRules };
    if (char?.referenceImage) body.referenceImage = { base64: char.referenceImage.base64, mediaType: char.referenceImage.mediaType };
    const data = await apiFetch('/api/generate-prompt', body);
    row.querySelector('.field-prompt').value = data.prompt;
    if (char) { char.reference = reference; char.prompt = data.prompt; }
    autoSave();
    showToast('Prompt generated.');
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Prompt'; }
}

// ── generate character images ─────────────────────────────────────────────
function proxyUrl(url) {
  if (!url || url.startsWith('data:')) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function mirrorImageUrl(srcUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = reject;
    img.src = proxyUrl(srcUrl);
  });
}

function buildAnglePrompt(char, angle) {
  const desc = ANGLE_DESC[angle] || angle;
  const name = char.name ? `${char.name}, ` : '';
  const style = getStylePrompt();
  const parts = [`${name}${desc}`];
  if (style) parts.push(style);
  return parts.join('. ');
}

function toggleCharAngles(id) {
  const angleRow = document.getElementById(`char-angles-${id}`);
  if (!angleRow) return;
  const hidden = angleRow.style.display === 'none' || angleRow.style.display === '';
  angleRow.style.display = hidden ? '' : 'none'; // '' lets CSS handle display (table-row on desktop, block on mobile)
  document.querySelectorAll(`#characters-body tr[data-id="${id}"] .btn-toggle-angles`).forEach(btn => {
    btn.textContent = hidden ? '▼ Variations' : '▶ Variations';
  });
}

async function generateCharFrontProfile(id) {
  syncFromDOM();
  const row = document.querySelector(`#characters-body tr[data-id="${id}"]`);
  const btns = row.querySelectorAll('.btn-gen-images');
  const btn = btns[0];
  const charDesc = row.querySelector('.field-prompt').value.trim();
  if (!charDesc) { showToast('Add a character description first.', true); return; }
  const char = characters.find(c => c.id === id);
  if (!char.angles) char.angles = {};
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  const frontSlot = document.getElementById(`char-front-${id}`);
  if (frontSlot) frontSlot.innerHTML = '<span class="spinner"></span>';
  try {
    const fullPrompt = getCharFullPrompt(charDesc);
    const frontData = await apiFetch('/api/generate-images', { prompt: fullPrompt, stylePrompt: '' });
    const frontUrl = frontData.images?.[0] || null;
    char.images = frontUrl ? [frontUrl] : [];
    char.prompt = charDesc;
    if (frontSlot) frontSlot.innerHTML = frontUrl ? `<img src="${esc(frontUrl)}" alt="Front">` : '<span class="placeholder">·</span>';
    autoSave();
    showToast('Front profile generated.');
  } catch(e) {
    if (frontSlot) frontSlot.innerHTML = '<span class="placeholder">·</span>';
    showToast('Error: ' + e.message, true);
  }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Front Profile'; }
}

async function generateCharAngles(id) {
  syncFromDOM();
  const row = document.querySelector(`#characters-body tr[data-id="${id}"]`);
  const btns = row.querySelectorAll('.btn-gen-images');
  const btn = btns[1];
  const char = characters.find(c => c.id === id);
  if (!char.angles) char.angles = {};
  const refUrl = char.referenceImage?.dataUrl || char.images?.[0] || null;
  if (!refUrl) { showToast('Generate a front profile first (or upload a reference image).', true); return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  // Open angles panel so spinners are visible
  const angleRow = document.getElementById(`char-angles-${id}`);
  if (angleRow && (angleRow.style.display === 'none' || !angleRow.style.display)) {
    toggleCharAngles(id);
  }
  CHAR_ANGLES.forEach(angle => {
    const slotEl = document.getElementById(`angle-img-${id}-${angle.replace(/\W/g, '_')}`);
    if (slotEl) slotEl.innerHTML = '<span class="spinner"></span>';
  });
  try {
    await Promise.all(CHAR_ANGLES_AI.map(async angle => {
      const angleKey = angle.replace(/\W/g, '_');
      const slotEl = document.getElementById(`angle-img-${id}-${angleKey}`);
      const anglePromptField = document.querySelector(`#char-angles-${id} .angle-prompt-field[data-angle="${angle}"]`);
      const existingPrompt = anglePromptField?.value.trim();
      const anglePrompt = existingPrompt || buildAnglePrompt(char, angle);
      if (anglePromptField && !existingPrompt) anglePromptField.value = anglePrompt;
      try {
        const varData = await apiFetch('/api/generate-char-variant', { prompt: anglePrompt, referenceImageUrls: [refUrl], stylePrompt: getStylePrompt() });
        const url = varData.url || null;
        if (!char.angles[angle]) char.angles[angle] = {};
        char.angles[angle].prompt = anglePrompt;
        char.angles[angle].image = url;
        if (slotEl) slotEl.innerHTML = url ? `<img src="${esc(url)}" alt="${esc(angle)}">` : '<span class="placeholder">·</span>';
        const mirrorAngle = Object.keys(MIRROR_PAIRS).find(k => MIRROR_PAIRS[k] === angle);
        if (mirrorAngle && url) {
          const mirrorSlot = document.getElementById(`angle-img-${id}-${mirrorAngle.replace(/\W/g, '_')}`);
          try {
            const mirroredDataUrl = await mirrorImageUrl(url);
            if (!char.angles[mirrorAngle]) char.angles[mirrorAngle] = {};
            char.angles[mirrorAngle].image = mirroredDataUrl;
            if (mirrorSlot) mirrorSlot.innerHTML = `<img src="${esc(mirroredDataUrl)}" alt="${esc(mirrorAngle)}">`;
          } catch { if (mirrorSlot) mirrorSlot.innerHTML = '<span class="placeholder">·</span>'; }
        }
      } catch(e) {
        if (slotEl) slotEl.innerHTML = '<span class="placeholder">✕</span>';
      }
    }));
    autoSave();
    showToast('Angle images generated.');
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Variations'; }
}

async function generateMissingCharPrompts() {
  const btn = document.getElementById('btn-gen-missing-prompts');
  const missing = characters.filter(c => !c.prompt?.trim());
  if (!missing.length) { showToast('All characters already have prompts.'); return; }
  btn.disabled = true; btn.textContent = `Generating 0/${missing.length}…`;
  let done = 0;
  for (const char of missing) {
    const reference = char.reference?.trim();
    if (!reference && !char.referenceImage) { done++; continue; }
    try {
      const body = { referenceDescription: reference, visualStyle: selectedStyleId };
      if (char.referenceImage) body.referenceImage = { base64: char.referenceImage.base64, mediaType: char.referenceImage.mediaType };
      const data = await apiFetch('/api/generate-prompt', body);
      char.prompt = data.prompt;
      const row = document.querySelector(`#characters-body tr[data-id="${char.id}"]`);
      if (row) row.querySelector('.field-prompt').value = data.prompt;
    } catch(e) { console.error('prompt gen failed for', char.name, e); }
    done++;
    btn.textContent = `Generating ${done}/${missing.length}…`;
  }
  autoSave();
  showToast(`Done — prompts generated for ${done} character(s).`);
  btn.disabled = false; btn.textContent = 'Generate Missing Prompts';
}

async function generateMissingCharImages() {
  const btn = document.getElementById('btn-gen-missing-images');
  const missing = characters.filter(c => !c.images?.length);
  if (!missing.length) { showToast('All characters already have images.'); return; }
  btn.disabled = true; btn.textContent = `Generating 0/${missing.length}…`;
  let done = 0;
  for (const char of missing) {
    const charDesc = char.prompt?.trim();
    if (!charDesc) { done++; continue; }
    const frontSlot = document.getElementById(`char-front-${char.id}`);
    if (frontSlot) frontSlot.innerHTML = '<span class="spinner"></span>';
    try {
      const fullPrompt = getCharFullPrompt(charDesc);
      const frontData = await apiFetch('/api/generate-images', { prompt: fullPrompt, stylePrompt: '' });
      const frontUrl = frontData.images?.[0] || null;
      char.images = frontUrl ? [frontUrl] : [];
      if (frontSlot) frontSlot.innerHTML = frontUrl ? `<img src="${esc(frontUrl)}" alt="Front">` : '<span class="placeholder">·</span>';
    } catch(e) {
      console.error('image gen failed for', char.name, e);
      if (frontSlot) frontSlot.innerHTML = '<span class="placeholder">·</span>';
    }
    done++;
    btn.textContent = `Generating ${done}/${missing.length}…`;
  }
  autoSave();
  showToast(`Done — images generated for ${done} character(s).`);
  btn.disabled = false; btn.textContent = 'Generate Missing Images';
}

async function generateMissingLocPrompts() {
  const btn = document.getElementById('btn-gen-missing-loc-prompts');
  const missing = locations.filter(l => !l.prompt?.trim());
  if (!missing.length) { showToast('All locations already have prompts.'); return; }
  btn.disabled = true; btn.textContent = `Generating 0/${missing.length}…`;
  let done = 0;
  for (const loc of missing) {
    const reference = loc.reference?.trim();
    if (!reference && !loc.referenceImage) { done++; continue; }
    try {
      const body = { referenceDescription: reference, visualStyle: selectedStyleId, isLocation: true, customRules: locationGenRules };
      if (loc.referenceImage) body.referenceImage = { base64: loc.referenceImage.base64, mediaType: loc.referenceImage.mediaType };
      const data = await apiFetch('/api/generate-prompt', body);
      loc.prompt = data.prompt;
      const row = document.querySelector(`#locations-body tr[data-id="${loc.id}"]`);
      if (row) row.querySelector('.field-prompt').value = data.prompt;
    } catch(e) { console.error('prompt gen failed for', loc.name, e); }
    done++;
    btn.textContent = `Generating ${done}/${missing.length}…`;
  }
  autoSave();
  showToast(`Done — prompts generated for ${done} location(s).`);
  btn.disabled = false; btn.textContent = 'Generate Missing Prompts';
}

async function generateMissingLocImages() {
  const btn = document.getElementById('btn-gen-missing-loc-images');
  const missing = locations.filter(l => !l.images?.length);
  if (!missing.length) { showToast('All locations already have images.'); return; }
  btn.disabled = true; btn.textContent = `Generating 0/${missing.length}…`;
  let done = 0;
  for (const loc of missing) {
    const prompt = loc.prompt?.trim();
    if (!prompt) { done++; continue; }
    const grid = document.getElementById(`loc-imgs-${loc.id}`);
    if (grid) grid.innerHTML = '<span class="spinner"></span>';
    try {
      const data = await apiFetch('/api/generate-images', { prompt, stylePrompt: getStylePrompt() });
      const newImgs = (data.images || []).filter(u => !(loc.images || []).includes(u));
      loc.images = [...(loc.images || []), ...newImgs];
      if (grid) grid.innerHTML = imageSlots(loc.images, loc.images.length);
    } catch(e) {
      console.error('image gen failed for', loc.name, e);
      if (grid) grid.innerHTML = '';
    }
    done++;
    btn.textContent = `Generating ${done}/${missing.length}…`;
  }
  autoSave();
  showToast(`Done — images generated for ${done} location(s).`);
  btn.disabled = false; btn.textContent = 'Generate Missing Images';
}

async function generateMissingShotPrompts() {
  const btn = document.getElementById('btn-gen-missing-shot-prompts');
  const missing = shots.filter(s => !s.imagePrompt?.trim());
  if (!missing.length) { showToast('All shots already have prompts.'); return; }
  btn.disabled = true; btn.textContent = `Generating 0/${missing.length}…`;
  let done = 0;
  for (const shot of missing) {
    const row = document.querySelector(`#shots-body tr[data-id="${shot.id}"]`);
    if (!row) { done++; continue; }
    const lyric = row.querySelector('.field-lyric')?.value.trim() || '';
    const description = row.querySelector('.field-desc')?.value.trim() || '';
    if (!lyric && !description) { done++; continue; }
    const shotSize = row.querySelector('.field-size')?.value || '';
    const shotMovement = row.querySelector('.field-movement')?.value || '';
    const shotAngle = shot.shotAngle || '';
    const selectedCharIds = [...row.querySelectorAll('.char-cb:checked')].map(cb => cb.value);
    const selectedChars = characters.filter(c => selectedCharIds.includes(c.id)).map(c => ({
      name: c.name, description: c.reference,
      referenceImage: c.referenceImage ? { base64: c.referenceImage.base64, mediaType: c.referenceImage.mediaType } : null
    }));
    const locationId = row.querySelector('.field-loc-select')?.value || shot.locationId || '';
    const selectedLocs = locations.filter(l => l.id === locationId).map(l => ({ name: l.name, description: l.reference }));
    const rowBtn = row.querySelector('.btn-gen-prompt');
    if (rowBtn) { rowBtn.disabled = true; rowBtn.innerHTML = '<span class="spinner"></span>'; }
    try {
      const data = await apiFetch('/api/generate-shot-prompts', { lyric, description, shotSize, shotAngle, shotMovement, position: '', characters: selectedChars, locations: selectedLocs, visualStyle });
      shot.imagePrompt = data.imagePrompt || '';
      shot.videoPrompt = data.videoPrompt || '';
      if (row.querySelector('.field-imgprompt')) row.querySelector('.field-imgprompt').value = shot.imagePrompt;
      if (row.querySelector('.field-vidprompt')) row.querySelector('.field-vidprompt').value = shot.videoPrompt;
    } catch(e) { console.error('prompt gen failed for shot', shot.id, e); }
    if (rowBtn) { rowBtn.disabled = false; rowBtn.innerHTML = 'Generate Prompts'; }
    done++;
    btn.textContent = `Generating ${done}/${missing.length}…`;
  }
  autoSave();
  showToast(`Done — prompts generated for ${done} shot(s).`);
  btn.disabled = false; btn.textContent = 'Generate Missing Prompts';
}

async function applyCharExpression(id) {
  const char = characters.find(c => c.id === id);
  const frontSlot = document.getElementById(`char-front-${id}`);
  const select = document.getElementById(`expr-${id}`);
  const expression = select?.value || 'neutral';

  const imageUrl = char?.images?.[0] || null;
  if (!imageUrl) { showToast('Generate an image first.', true); select.value = 'neutral'; return; }

  if (expression === 'neutral') {
    frontSlot.innerHTML = `<img src="${esc(imageUrl)}" alt="Front">`;
    return;
  }

  select.disabled = true;
  frontSlot.innerHTML = '<span class="spinner"></span>';
  try {
    const data = await apiFetch('/api/apply-expression', { imageUrl, expression });
    if (data.imageUrl) {
      frontSlot.innerHTML = `<img src="${esc(data.imageUrl)}" alt="Front">`;
    } else {
      frontSlot.innerHTML = `<img src="${esc(imageUrl)}" alt="Front">`;
      showToast('Expression could not be applied.', true);
    }
  } catch(e) {
    frontSlot.innerHTML = `<img src="${esc(imageUrl)}" alt="Front">`;
    showToast('Error: ' + e.message, true);
  } finally {
    select.disabled = false;
  }
}

async function regenerateCharAngle(id, angle) {
  syncFromDOM();
  const char = characters.find(c => c.id === id);
  if (!char) return;

  // If this is a mirrored (right-side) angle, regenerate the source left angle instead
  const sourceAngle = MIRROR_PAIRS[angle];
  if (sourceAngle) { await regenerateCharAngle(id, sourceAngle); return; }

  const angleKey = angle.replace(/\W/g, '_');
  const slotEl = document.getElementById(`angle-img-${id}-${angleKey}`);
  const anglePromptField = document.querySelector(`#char-angles-${id} .angle-prompt-field[data-angle="${angle}"]`);
  const anglePrompt = anglePromptField?.value.trim() || buildAnglePrompt(char, angle);
  if (anglePromptField && !anglePromptField.value.trim()) anglePromptField.value = anglePrompt;

  const angleRefImage = char.angles?.[angle]?.refImage;
  let refUrl = angleRefImage?.dataUrl || char.images?.[0] || char.referenceImage?.dataUrl || null;
  if (!refUrl) { showToast('Generate the front image first, or upload a ref image for this angle.', true); return; }

  const btn = slotEl?.closest('tr')?.querySelector('.btn-regen');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
  if (slotEl) slotEl.innerHTML = '<span class="spinner"></span>';

  // Spin the mirror slot too
  const mirrorAngle = Object.keys(MIRROR_PAIRS).find(k => MIRROR_PAIRS[k] === angle);
  const mirrorSlot = mirrorAngle ? document.getElementById(`angle-img-${id}-${mirrorAngle.replace(/\W/g, '_')}`) : null;
  if (mirrorSlot) mirrorSlot.innerHTML = '<span class="spinner"></span>';

  // If ref image is a dataUrl (not a CDN URL), upload it first
  if (refUrl.startsWith('data:')) {
    try {
      const src = angleRefImage || char.referenceImage;
      const uploaded = await apiFetch('/api/upload-reference', { base64: src.base64, mediaType: src.mediaType });
      refUrl = uploaded.url;
    } catch(e) { /* fall back to dataUrl if upload fails */ }
  }

  try {
    const varData = await apiFetch('/api/generate-char-variant', { prompt: anglePrompt, referenceImageUrls: [refUrl], stylePrompt: getStylePrompt() });
    const url = varData.url || null;
    if (!char.angles) char.angles = {};
    if (!char.angles[angle]) char.angles[angle] = {};
    char.angles[angle].prompt = anglePrompt;
    char.angles[angle].image = url;
    if (slotEl) slotEl.innerHTML = url ? `<img src="${esc(url)}" alt="${esc(angle)}">` : '<span class="placeholder">·</span>';

    // Re-mirror the right counterpart
    if (mirrorAngle && url) {
      try {
        const mirroredDataUrl = await mirrorImageUrl(url);
        if (!char.angles[mirrorAngle]) char.angles[mirrorAngle] = {};
        char.angles[mirrorAngle].image = mirroredDataUrl;
        if (mirrorSlot) mirrorSlot.innerHTML = `<img src="${esc(mirroredDataUrl)}" alt="${esc(mirrorAngle)}">`;
      } catch { if (mirrorSlot) mirrorSlot.innerHTML = '<span class="placeholder">·</span>'; }
    }

    autoSave();
    showToast(`${angle} regenerated.`);
  } catch(e) {
    if (slotEl) slotEl.innerHTML = '<span class="placeholder">✕</span>';
    if (mirrorSlot) mirrorSlot.innerHTML = '<span class="placeholder">·</span>';
    showToast('Error: ' + e.message, true);
  }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = '↺ Regenerate'; } }
}

// ── generate shot prompts ─────────────────────────────────────────────────
async function generateShotPrompts(id) {
  const row = document.querySelector(`#shots-body tr[data-id="${id}"]`);
  const btn = row.querySelector('.btn-gen-prompt');
  const lyric = row.querySelector('.field-lyric').value.trim();
  const description = row.querySelector('.field-desc').value.trim();
  if (!lyric && !description) { showToast('Add lyric/action or description first.', true); return; }
  const shot = shots.find(s => s.id === id);
  const shotSize = row.querySelector('.field-size').value;
  const shotAngle = shot?.shotAngle || '';
  const shotMovement = row.querySelector('.field-movement').value;
  const position = '';
  const selectedCharIds = [...row.querySelectorAll('.char-cb:checked')].map(cb => cb.value);
  const selectedChars = characters.filter(c => selectedCharIds.includes(c.id)).map(c => ({
    name: c.name, description: c.reference,
    referenceImage: c.referenceImage ? { base64: c.referenceImage.base64, mediaType: c.referenceImage.mediaType } : null
  }));
  const locationId = row.querySelector('.field-loc-select')?.value || shot?.locationId || '';
  const selectedLocs = locations.filter(l => l.id === locationId).map(l => ({ name: l.name, description: l.reference }));
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  try {
    const data = await apiFetch('/api/generate-shot-prompts', { lyric, description, shotSize, shotAngle, shotMovement, position, characters: selectedChars, locations: selectedLocs, visualStyle });
    row.querySelector('.field-imgprompt').value = data.imagePrompt || '';
    row.querySelector('.field-vidprompt').value = data.videoPrompt || '';
    if (shot) { shot.imagePrompt = data.imagePrompt || ''; shot.videoPrompt = data.videoPrompt || ''; }
    if (shot) { shot.imagePrompt = data.imagePrompt || ''; shot.videoPrompt = data.videoPrompt || ''; }
    autoSave();
    showToast('Prompts generated.');
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Prompts'; }
}

// ── generate shot images ──────────────────────────────────────────────────
async function generateShotImages(id) {
  const row = document.querySelector(`#shots-body tr[data-id="${id}"]`);
  const btn = row.querySelector('.btn-gen-images');
  const imagePrompt = row.querySelector('.field-imgprompt').value.trim();
  if (!imagePrompt) { showToast('Generate prompts first.', true); return; }

  const shot = shots.find(s => s.id === id);
  const selectedCharIds = [...row.querySelectorAll('.char-cb:checked')].map(cb => cb.value);
  const charImageUrls = characters.filter(c => selectedCharIds.includes(c.id) && c.images?.length).map(c => c.images[0]);
  const locationId2 = row.querySelector('.field-loc-select')?.value || shot?.locationId || '';
  let locImageUrls;
  if (shot?.refImage?.dataUrl) {
    try {
      const b64 = shot.refImage.dataUrl.split(',')[1];
      const uploaded = await apiFetch('/api/upload-reference', { base64: b64, mediaType: shot.refImage.mediaType });
      locImageUrls = [uploaded.url];
    } catch(e) { locImageUrls = []; }
  } else {
    const loc2 = locations.find(l => l.id === locationId2);
    const locImg = loc2 ? locDefaultImage(loc2) : null;
    if (locImg?.startsWith('data:')) {
      try {
        const b64 = locImg.split(',')[1];
        const uploaded = await apiFetch('/api/upload-reference', { base64: b64, mediaType: 'image/jpeg' });
        locImageUrls = [uploaded.url];
      } catch(e) { locImageUrls = []; }
    } else {
      locImageUrls = locImg ? [locImg] : [];
    }
  }

  const grid = document.getElementById(`shot-imgs-${id}`);
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  grid.innerHTML = loadingSlots(2);
  try {
    const data = await apiFetch('/api/generate-shot-images', { prompt: imagePrompt, charImageUrls, locImageUrls, stylePrompt: getStylePrompt() });
    if (shot) shot.images = [...(shot.images || []), ...data.images.filter(u => !(shot.images || []).includes(u))];
    grid.innerHTML = imageSlots(shot.images, shot.images.length);
    addImagesToLocation(locationId2, data.images);
    if (_compose?.shotId === id) refreshShotBgThumbs();
    autoSave();
    showToast(`${data.images.length} image${data.images.length !== 1 ? 's' : ''} generated.`);
  } catch(e) { grid.innerHTML = emptySlots(2); showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Images'; }
}

async function generateShotVideo(id) {
  const row = document.querySelector(`#shots-body tr[data-id="${id}"]`);
  const btn = row.querySelector('.btn-gen-video');
  const videoPrompt = row.querySelector('.field-vidprompt').value.trim();
  if (!videoPrompt) { showToast('Generate prompts first.', true); return; }

  const selectedIds = [...row.querySelectorAll('.char-cb:checked')].map(cb => cb.value);
  const selectedChars = characters.filter(c => selectedIds.includes(c.id));
  const refChar = selectedChars.find(c => c.images && c.images.length > 0);
  const referenceImageUrl = refChar ? refChar.images[0] : null;

  const cell = document.getElementById(`shot-vid-${id}`);
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  cell.innerHTML = '<span class="spinner" style="border-top-color:#4ade80"></span>';
  try {
    const data = await apiFetch('/api/generate-shot-video', { prompt: videoPrompt, referenceImageUrl });
    const shot = shots.find(s => s.id === id);
    if (shot) shot.videoUrl = data.url;
    autoSave();
    cell.innerHTML = data.url ? `<video src="${data.url}" controls style="width:100%;border-radius:6px"></video>` : '<span class="placeholder">·</span>';
    showToast(data.url ? 'Video generated.' : 'No video returned.', !data.url);
  } catch(e) { cell.innerHTML = '<span class="placeholder">·</span>'; showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Video'; }
}

// ── shot detail sub-row ───────────────────────────────────────────────────
function buildCharDetPrompt(facingDir, expression, eyeDir) {
  const faceMap = {
    'Front': 'facing forward, front view, face visible',
    '3/4 Left': 'turned slightly to the left, 3/4 view, face partially visible',
    '3/4 Right': 'turned slightly to the right, 3/4 view, face partially visible',
    'Profile Left': 'side profile facing left, full side view of outfit',
    'Profile Right': 'side profile facing right, full side view of outfit',
    '3/4 Back Left': 'turned mostly away, 3/4 rear view angled slightly to the left, back of outfit visible',
    '3/4 Back Right': 'turned mostly away, 3/4 rear view angled slightly to the right, back of outfit visible',
    'Back': 'turned around, rear view showing the back of their outfit and hair',
  };
  const parts = [faceMap[facingDir] || 'facing forward, face visible'];
  if (expression) parts.push(`${expression} expression`);
  if (eyeDir && eyeDir !== 'Forward') parts.push(`eyes looking ${eyeDir.toLowerCase()}`);
  return parts.join(', ');
}

function updateCharDetPrompt(shotId, charId) {
  // kept for compatibility — no longer used for expression-only flow
}

function updateCharDetRef(shotId, charId) {
  const detRow = document.querySelector(`#shot-detail-${shotId} tr[data-char-id="${charId}"]`);
  if (!detRow) return;
  const char = characters.find(c => c.id === charId);
  if (!char) return;
  const facingDir = detRow.querySelector('.det-facing').value;
  const refImg = getCharAngleImage(char, facingDir);
  const refEl = document.getElementById(`char-det-ref-${shotId}-${charId}`);
  if (refEl) refEl.innerHTML = refImg
    ? `<img src="${esc(refImg)}" class="char-det-img" style="max-width:80px;opacity:0.7">`
    : `<span class="placeholder" style="font-size:10px;color:#333">No image</span>`;
}

const DET_FACING =['Front','3/4 Left','3/4 Right','Profile Left','Profile Right','3/4 Back Left','3/4 Back Right','Back'];
const DET_EYE    = ['Forward','Left','Right','Up','Down','Up-Left','Up-Right','Down-Left','Down-Right'];

function getCharAngleImage(char, facingDir) {
  if (!facingDir || facingDir === 'Front') return char.images?.[0] || null;
  return char.angles?.[facingDir]?.image || char.images?.[0] || null;
}

function shotDetailRowHTML(s) {
  const selectedChars = characters.filter(c => (s.characterIds||[]).includes(c.id));
  const inner = selectedChars.length
    ? `<table class="char-det-table">
        <colgroup><col class="cdt-name"><col class="cdt-facing"><col class="cdt-expr"><col class="cdt-act"><col class="cdt-ref"><col class="cdt-result"></colgroup>
        <thead><tr><th>Character</th><th>Angle</th><th>Expression</th><th></th><th>Reference</th><th>Result</th></tr></thead>
        <tbody>${selectedChars.map(c => {
          const d = (s.characterDetails||{})[c.id] || {};
          const facingDir = d.facingDir || 'Front';
          const facingOpts = DET_FACING.map(v=>`<option${facingDir===v?' selected':''}>${esc(v)}</option>`).join('');
          const refImg = getCharAngleImage(c, facingDir);
          const refHTML = refImg
            ? `<img src="${esc(refImg)}" class="char-det-img" style="max-width:80px;opacity:0.7">`
            : `<span class="placeholder" style="font-size:10px;color:#333">No image</span>`;
          const resultHTML = d.variantImage
            ? `<img src="${esc(d.variantImage)}" class="char-det-img">`
            : `<span class="placeholder">·</span>`;
          return `<tr data-char-id="${c.id}">
            <td class="char-det-name">${esc(c.name||'Unnamed')}</td>
            <td><select class="det-facing" onchange="updateCharDetRef('${s.id}','${c.id}');autoSave()">${facingOpts}</select></td>
            <td><input type="text" class="det-expression" placeholder="e.g. smiling, worried…" value="${esc(d.expression||'')}" oninput="debouncedSave()"></td>
            <td><button class="btn btn-gen-images" style="padding:6px 8px;font-size:11px" onclick="generateCharVariant('${s.id}','${c.id}')">Generate</button></td>
            <td><div class="char-det-ref" id="char-det-ref-${s.id}-${c.id}">${refHTML}</div></td>
            <td><div class="char-det-result" id="char-det-result-${s.id}-${c.id}">${resultHTML}</div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`
    : `<p class="shot-detail-empty">No characters selected for this shot.</p>`;
  return `<tr class="shot-detail-row" id="shot-detail-${s.id}" style="display:none"><td colspan="14"><div class="shot-detail-inner">${inner}</div></td></tr>`;
}

function toggleShotDetail(id) {
  const row = document.getElementById(`shot-detail-${id}`);
  const btn = document.querySelector(`#shots-body tr[data-id="${id}"] .btn-detail-toggle`);
  if (!row) return;
  const opening = row.style.display === 'none';
  row.style.display = opening ? '' : 'none';
  if (btn) btn.textContent = opening ? '▼' : '▶';
}

function refreshShotDetailIfOpen(shotId) {
  const row = document.getElementById(`shot-detail-${shotId}`);
  if (!row || row.style.display === 'none') return;
  syncFromDOM();
  const shot = shots.find(s => s.id === shotId);
  if (!shot) return;
  const temp = document.createElement('tbody');
  temp.innerHTML = shotDetailRowHTML(shot);
  const newRow = temp.querySelector('.shot-detail-row');
  if (newRow) { newRow.style.display = ''; row.innerHTML = newRow.innerHTML; }
}

async function generateCharVariant(shotId, charId) {
  const shot = shots.find(s => s.id === shotId);
  const char = characters.find(c => c.id === charId);
  if (!shot || !char) return;
  const detRow = document.querySelector(`#shot-detail-${shotId} tr[data-char-id="${charId}"]`);
  if (!detRow) return;

  const expression = detRow.querySelector('.det-expression').value.trim();
  const facingDir  = detRow.querySelector('.det-facing').value;

  // Use the character's angle image for this facing direction as the reference
  const refImg = getCharAngleImage(char, facingDir);
  if (!refImg) { showToast('Generate character images first.', true); return; }

  // Prompt is expression-only — the reference image provides the pose/angle
  const prompt = expression
    ? `Keep everything identical. Change only the facial expression to: ${expression}.`
    : `Keep the character with a neutral expression. Do not change anything else.`;

  const btn      = detRow.querySelector('.btn-gen-images');
  const resultEl = document.getElementById(`char-det-result-${shotId}-${charId}`);
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  resultEl.innerHTML = '<span class="spinner" style="border-top-color:#4ade80"></span>';

  try {
    const data = await apiFetch('/api/generate-char-variant', { prompt, referenceImageUrls: [refImg], stylePrompt: getStylePrompt() });
    const url = data.url || null;
    if (!shot.characterDetails) shot.characterDetails = {};
    shot.characterDetails[charId] = { expression, facingDir, prompt, variantImage: url };
    // Cache the expression variant on the character for reuse
    if (url) {
      if (!char.expressionCache) char.expressionCache = {};
      if (!char.expressionCache[facingDir]) char.expressionCache[facingDir] = {};
      char.expressionCache[facingDir][expression || 'neutral'] = url;
    }

    resultEl.innerHTML = url
      ? `<img src="${esc(url)}" class="char-det-img">`
      : '<span class="placeholder">·</span>';
    autoSave();
    showToast('Variant generated.');
  } catch(e) {
    resultEl.innerHTML = '<span class="placeholder">·</span>';
    showToast('Error: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.innerHTML = 'Generate';
  }
}

// ── utilities ─────────────────────────────────────────────────────────────
async function apiFetch(url, body, method) {
  // Auto-inject projectId into generation endpoints so images get meaningful storage paths
  const generationEndpoints = ['/api/generate-images', '/api/generate-shot-images', '/api/generate-char-variant',
    '/api/apply-expression', '/api/apply-prompt', '/api/remove-background', '/api/relight-image', '/api/inpaint'];
  const isGet = method === 'GET' || body === null;
  const enriched = (!isGet && currentProjectId && generationEndpoints.some(e => url.includes(e)))
    ? { projectId: currentProjectId, ...body }
    : body;
  const res = await fetch(url, isGet
    ? { method: 'GET' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(enriched) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(text || `HTTP ${res.status}`); }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function loadingSlots(n) { return Array.from({length:n},()=>`<div class="img-slot"><span class="spinner" style="border-top-color:#4ade80"></span></div>`).join(''); }
function emptySlots(n) { return Array.from({length:n},()=>`<div class="img-slot"><span class="placeholder">·</span></div>`).join(''); }
function imageSlots(images, n) { return Array.from({length:n},(_,i)=>{const url=images[i];return`<div class="img-slot">${url?`<img src="${esc(url)}" alt="">`:`<span class="placeholder">·</span>`}</div>`;}).join(''); }

function showToast(msg, isError=false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show'+(isError?' error':'');
  clearTimeout(t._timer);
  if (!isError) t._timer = setTimeout(()=>{t.className='toast';}, 4000);
}
document.getElementById('toast').addEventListener('click', function(){ this.className='toast'; });

try {
  initApp();
} catch(e) {
  console.error('initApp failed:', e);
  const hdr = document.getElementById('main-header');
  if (hdr) hdr.innerHTML = '<h1>Storyboard Generator</h1><div></div>';
  const grid = document.getElementById('projects-grid');
  if (grid) grid.innerHTML = '<div style="padding:20px;color:#e05;font-size:13px;">Error: ' + e.message + '</div><button class="btn-new-project" onclick="location.reload()"><span class="plus">↺</span><span>Reload</span></button>';
}

// ── compose shot ──────────────────────────────────────────────────────────
const COMPOSE_W = 1280, COMPOSE_H = 720;
let _compose = null;   // { shotId, layers[], selectedIdx, dragging }
let _composeDrag = null; // { layerIdx, startCx, startCy, startMx, startMy }
let _maskCanvas = null, _maskCtx = null, _maskOverlayCanvas = null;
let _maskMode = false, _maskPainting = false, _maskBrushSize = 40;
let _lastMaskX = null, _lastMaskY = null;
let _maskCursorX = null, _maskCursorY = null;

// Rule-of-thirds positions by label
const COMPOSE_POSITIONS = {
  'Top Left':     { cx: COMPOSE_W * 1/3, cy: COMPOSE_H * 1/3 },
  'Top Right':    { cx: COMPOSE_W * 2/3, cy: COMPOSE_H * 1/3 },
  'Bottom Left':  { cx: COMPOSE_W * 1/3, cy: COMPOSE_H * 2/3 },
  'Bottom Right': { cx: COMPOSE_W * 2/3, cy: COMPOSE_H * 2/3 },
};

function loadComposeBackground(url) {
  _compose.bgUrl = url || null;
  if (!url) { _compose.bgImg = null; renderCompose(); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { _compose.bgImg = img; renderCompose(); };
  img.onerror = () => { _compose.bgImg = null; renderCompose(); };
  img.src = proxyUrl(url);
}

function markComposeBgSelected(key) {
  document.querySelectorAll('[data-bg-key]').forEach(el => {
    el.classList.toggle('selected', el.dataset.bgKey === key);
  });
  document.querySelectorAll('.compose-loc-var-thumb').forEach(el => {
    const k = `loc-${el.dataset.locId}-${el.dataset.viewKey}`;
    el.classList.toggle('selected', k === key);
  });
}

function buildComposeLocThumbs(shot) {
  const thumbContainer = document.getElementById('compose-loc-thumbs');
  if (!thumbContainer) return;
  if (!locations.length) { thumbContainer.innerHTML = `<span class="compose-empty" style="padding:8px 10px;font-size:11px;color:#444">No locations yet.</span>`; return; }

  // Build pairs for 2-col grid — each location gets a "wrap" spanning both cols
  thumbContainer.innerHTML = locations.map(l => {
    const views = [{ key: 'default', label: 'Default', img: locDefaultImage(l) }];
    LOC_ANGLES.forEach(a => { const img = l.shotAngles?.[a]?.image; if (img) views.push({ key: `angle-${a}`, label: a.replace('establishing shot','est.').replace(' shot',''), img }); });
    (l.customViews || []).forEach(cv => { if (cv.image) views.push({ key: `custom-${cv.id}`, label: cv.name || 'Custom', img: cv.image }); });

    const defaultImg = views[0]?.img;
    const hasVariations = views.length > 1;
    const variationThumbs = views.map(v => {
      const isDeletable = v.key.startsWith('custom-');
      const cvId = isDeletable ? v.key.slice(7) : null;
      return `
      <div class="compose-loc-var-thumb" style="position:relative" data-loc-id="${esc(l.id)}" data-view-key="${esc(v.key)}" onclick="onLocBgViewChange('${esc(l.id)}','${esc(v.key)}')" title="${esc(v.label)}">
        ${v.img ? `<img src="${esc(proxyUrl(v.img))}" crossorigin="anonymous">` : `<div class="compose-loc-var-thumb-empty">·</div>`}
        <span class="compose-loc-var-label">${esc(v.label)}</span>
        ${isDeletable ? `<button class="comp-thumb-delete" onclick="event.stopPropagation();deleteLocCustomViewById('${esc(l.id)}','${esc(cvId)}')" title="Delete variation">✕</button>` : ''}
      </div>`;
    }).join('');

    return `<div class="compose-loc-card-wrap" data-loc-id="${esc(l.id)}">
      <div class="compose-loc-card-main">
        <div class="compose-bg-card" data-bg-key="loc-${esc(l.id)}-default" onclick="onLocBgCardClick('${esc(l.id)}')">
          ${defaultImg ? `<img src="${esc(proxyUrl(defaultImg))}" crossorigin="anonymous">` : `<div class="compose-bg-card-empty">·</div>`}
          <span class="compose-bg-card-label">${esc(l.name || 'Unnamed')}</span>
        </div>
        ${hasVariations ? `<div class="compose-bg-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;color:#555;font-size:10px" onclick="toggleLocVariations('${esc(l.id)}')">
          <span style="font-size:18px;line-height:1">⊞</span>
          <span>${views.length} views</span>
        </div>` : ''}
      </div>
      ${hasVariations ? `<div class="compose-loc-variations" id="loc-vars-${esc(l.id)}">${variationThumbs}</div>` : ''}
    </div>`;
  }).join('');
}

function toggleLocVariations(locId) {
  const el = document.getElementById(`loc-vars-${locId}`);
  if (el) el.classList.toggle('open');
}

function onLocBgCardClick(locId) {
  // Select default view and also open variations
  onLocBgViewChange(locId, 'default');
  const el = document.getElementById(`loc-vars-${locId}`);
  if (el && !el.classList.contains('open')) el.classList.add('open');
}

function onLocBgViewChange(locId, viewKey) {
  if (!_compose) return;
  const loc = locations.find(l => l.id === locId);
  if (!loc) return;
  let imgUrl = null;
  if (viewKey === 'default') {
    imgUrl = locDefaultImage(loc);
  } else if (viewKey.startsWith('angle-')) {
    imgUrl = loc.shotAngles?.[viewKey.slice(6)]?.image || null;
  } else if (viewKey.startsWith('custom-')) {
    const cv = (loc.customViews || []).find(c => c.id === viewKey.slice(7));
    imgUrl = cv?.image || null;
  }
  const key = `loc-${locId}-${viewKey}`;
  captureUndoState();
  _compose.bgColor = null;
  _compose.bgKey = key;
  markComposeBgSelected(key);
  // Update thumb image to show selected view
  const thumb = document.querySelector(`.compose-loc-bg-row[data-loc-id="${locId}"] .compose-thumb`);
  if (thumb) {
    thumb.dataset.bgKey = key;
    const img = thumb.querySelector('img');
    if (img && imgUrl) img.src = proxyUrl(imgUrl);
  }
  syncComposeLocationToRow(locId);
  loadComposeBackground(imgUrl || null);
  saveComposeLayers();
}

function buildOtherShotBgPicker(picker) {
  if (!_compose) return;
  const shotId = _compose.shotId;
  const otherShots = shots.filter(s => s.id !== shotId && s.finalImage);
  if (!otherShots.length) {
    picker.innerHTML = `<p style="font-size:11px;color:#444;font-style:italic">No other shots have a final image yet.</p>`;
    return;
  }
  picker.innerHTML = otherShots.map(s => {
    const key = `other-shot-${s.id}`;
    return `<div class="compose-bg-card" data-bg-key="${esc(key)}" onclick="selectOtherShotAsBg('${esc(s.id)}')">
      <img src="${esc(proxyUrl(s.finalImage))}" crossorigin="anonymous">
      <span class="compose-bg-card-label">${esc(s.lyric || s.description || `Shot`)}</span>
    </div>`;
  }).join('');
}

function toggleShotBgPicker() {
  const picker = document.getElementById('compose-shot-bg-picker');
  if (picker) buildOtherShotBgPicker(picker);
}

function selectOtherShotAsBg(shotId) {
  const s = shots.find(x => x.id === shotId);
  if (!s?.finalImage || !_compose) return;
  captureUndoState();
  const key = `other-shot-${shotId}`;
  _compose.bgColor = null;
  _compose.bgKey = key;
  markComposeBgSelected(key);
  loadComposeBackground(s.finalImage);
  saveComposeLayers();
}

async function applyBgOnlyPrompt() {
  if (!_compose) return;
  const bgUrl = _compose.bgUrl;
  if (!bgUrl) { showToast('No background image selected.', true); return; }
  const promptEl = document.getElementById('compose-bg-prompt-input');
  const prompt = promptEl?.value?.trim();
  if (!prompt) { showToast('Enter a prompt first.', true); return; }
  const btn = document.getElementById('btn-apply-bg-prompt');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    const data = await apiFetch('/api/apply-prompt', { imageUrl: bgUrl, prompt });
    const newUrl = data.url || data.imageUrl;
    if (!newUrl) throw new Error('No image returned');
    captureUndoState();
    loadComposeBackground(newUrl);
    _compose.bgUrl = newUrl;
    saveComposeLayers();
    addImagesToLocation(_compose.locationId, [newUrl]);
    addUrlToShotImages(newUrl);
    showToast('Background updated.');
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '✦ Apply to background'; } }
}

async function saveBgAsLocAltView() {
  if (!_compose) return;
  const bgUrl = _compose.bgUrl;
  if (!bgUrl) { showToast('No background image to save.', true); return; }
  const locSel = document.getElementById('compose-save-bg-loc-select');
  const nameEl = document.getElementById('compose-save-bg-name');
  const locId = locSel?.value;
  const name = nameEl?.value?.trim();
  if (!locId) { showToast('Select a location first.', true); return; }
  if (!name) { showToast('Enter a view name first.', true); return; }
  const loc = locations.find(l => l.id === locId);
  if (!loc) return;
  if (!loc.customViews) loc.customViews = [];
  loc.customViews.push({ id: genId(), name, prompt: '', image: bgUrl });
  autoSave();
  renderLocations();
  if (nameEl) nameEl.value = '';
  showToast(`Saved as "${name}" in ${loc.name || 'location'}.`);
  // Rebuild location thumbs so the new view appears
  const shot = shots.find(s => s.id === _compose.shotId);
  if (shot) buildComposeLocThumbs(shot);
}

function selectComposeBg(key, url, locationId) {
  if (!_compose) return;
  captureUndoState();
  _compose.bgKey = key;
  markComposeBgSelected(key);
  // If it's a location, also sync the row dropdowns
  if (locationId) syncComposeLocationToRow(locationId);
  loadComposeBackground(url || null);
  saveComposeLayers();
}

function syncComposeLocationToRow(locationId) {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  if (!shot) return;
  shot.locationId = locationId;
  _compose.locationId = locationId;
  const row = document.querySelector(`#shots-body tr[data-id="${_compose.shotId}"]`);
  if (row) { const s = row.querySelector('.field-loc-select'); if (s) s.value = locationId; }
  const finalCell = document.getElementById(`final-img-${_compose.shotId}`);
  if (finalCell) {
    const finalSel = finalCell.querySelector('.final-loc-select');
    if (finalSel) finalSel.value = locationId;
    const loc = locations.find(l => l.id === locationId);
    const locImg = locDefaultImage(loc);
    const preview = finalCell.querySelector('.final-image-loc-preview');
    if (preview) {
      let img = preview.querySelector('.final-image-preview');
      const empty = preview.querySelector('.final-image-loc-empty');
      if (locImg) {
        if (img) img.src = locImg;
        else { if (empty) empty.remove(); img = document.createElement('img'); img.className = 'final-image-preview'; img.src = locImg; preview.insertBefore(img, preview.firstChild); }
      } else {
        if (img && !shot.finalImage) img.remove();
        if (!empty) { const d = document.createElement('div'); d.className = 'final-image-loc-empty'; d.innerHTML = '<span>No location</span>'; preview.insertBefore(d, preview.firstChild); }
      }
    }
  }
}

function selectComposeLocation(locationId) {
  if (!_compose) return;
  selectComposeBg(`loc-${locationId}`, locations.find(l => l.id === locationId)?.images?.[0] || '', locationId);
  autoSave();
}

function openCompose(shotId) {
  const shot = shots.find(s => s.id === shotId);
  if (!shot) return;

  _compose = { shotId, locationId: shot.locationId || null, layers: [], selectedIdx: -1, bgSelected: false, globalLighting: shot.composeMeta?.globalLighting || 'none', globalLightingDir: shot.composeMeta?.globalLightingDir || 'none', bgSeparation: shot.composeMeta?.bgSeparation ?? 0, bgKey: null, bgUrl: null, bgMask: null, bgMaskUrl: shot.composeMeta?.bgMaskUrl || null, bgColor: shot.composeMeta?.bgColor || null, globalContrast: shot.composeMeta?.globalContrast ?? 100, globalSaturation: shot.composeMeta?.globalSaturation ?? 100, bgScale: shot.composeMeta?.bgScale ?? 1, bgOffsetX: shot.composeMeta?.bgOffsetX ?? 0, bgOffsetY: shot.composeMeta?.bgOffsetY ?? 0, history: [], undoStack: [] };
  const canvas = document.getElementById('compose-canvas');
  canvas.width = COMPOSE_W; canvas.height = COMPOSE_H;

  // Background — restore previously chosen bg URL, else fall back to location default
  const bgLoc = locations.find(l => l.id === shot.locationId);
  const savedBgUrl = shot.composeMeta?.bgUrl || null;
  loadComposeBackground(savedBgUrl || locDefaultImage(bgLoc) || shot.images?.[0] || null);

  // Restore previously saved layers (Array.isArray check so empty array [] skips auto-place)
  if (Array.isArray(shot.composeLayers)) {
    restoreComposeLayers(shot.composeLayers);
  } else {
    // Auto-place default character images for characters assigned to this shot
    const shotChars = (shot.characterIds || [])
      .map(id => characters.find(c => c.id === id))
      .filter(c => c && (charDefaultImage(c) || c.images?.length));
    if (shotChars.length) {
      // Spread characters horizontally across the lower portion of the canvas
      shotChars.forEach((c, i) => {
        const total = shotChars.length;
        const cx = COMPOSE_W * ((i + 1) / (total + 1));
        const cy = COMPOSE_H * 0.65;
        const defaultImg = charDefaultImage(c);
        if (c.bgRemovedImage && !defaultImg?.startsWith('data:')) {
          addComposeLayerUrlDirect(c.bgRemovedImage, c.name || 'Character', c.id, { cx, cy });
        } else {
          addComposeLayerUrl(defaultImg || c.images[0], c.name || 'Character', c.id, { cx, cy });
        }
      });
    }
  }

  // Restore subject mask if previously detected
  if (_compose.bgMaskUrl) {
    const maskImg = new Image();
    maskImg.crossOrigin = 'anonymous';
    maskImg.onload = () => { _compose.bgMask = maskImg; renderCompose(); };
    maskImg.src = '/api/proxy-image?url=' + encodeURIComponent(_compose.bgMaskUrl);
  }

  // Build character cards (all characters) + AI generated images as draggable layers
  renderComposeCharCards();

  // Build location bg thumbs (with per-location view dropdown)
  buildComposeLocThumbs(shot);

  // Shot's own AI images as background options
  const shotImgs = shot.images || [];
  const shotBgThumbs = document.getElementById('compose-shot-bg-thumbs');
  const shotBgEmpty = document.getElementById('compose-shot-bg-empty');
  if (shotBgThumbs) {
    if (shotImgs.length) {
      shotBgThumbs.innerHTML = shotImgs.map((url, i) => {
        const key = `shot-img-${i}`;
        return `<div class="compose-bg-card" style="position:relative" data-bg-key="${esc(key)}" onclick="selectComposeBg('${esc(key)}','${esc(url)}',null)">
          <img src="${esc(proxyUrl(url))}" crossorigin="anonymous">
          <span class="compose-bg-card-label">Image ${i + 1}</span>
          <button class="comp-thumb-delete" onclick="event.stopPropagation();removeShotBgImage('${esc(url)}')" title="Remove">✕</button>
        </div>`;
      }).join('');
      if (shotBgEmpty) shotBgEmpty.style.display = 'none';
    } else {
      shotBgThumbs.innerHTML = '';
      if (shotBgEmpty) shotBgEmpty.style.display = '';
    }
  }

  // Build other-shot picker (always visible now)
  const otherPicker = document.getElementById('compose-shot-bg-picker');
  if (otherPicker) buildOtherShotBgPicker(otherPicker);

  // Populate save-as-location-view select
  const saveBgLocSel = document.getElementById('compose-save-bg-loc-select');
  if (saveBgLocSel) {
    saveBgLocSel.innerHTML = `<option value="">Select location…</option>` +
      locations.map(l => `<option value="${esc(l.id)}">${esc(l.name || 'Unnamed')}</option>`).join('');
  }

  // Mark initial selected bg
  const initBgKey = shot.locationId ? `loc-${shot.locationId}-default` : null;
  if (initBgKey) { _compose.bgKey = initBgKey; markComposeBgSelected(initBgKey); }

  updateComposeLayerPanel();
  const glSel = document.getElementById('compose-global-lighting');
  if (glSel) glSel.value = _compose.globalLighting || 'none';
  const glDirSel = document.getElementById('compose-lighting-dir');
  if (glDirSel) glDirSel.value = _compose.globalLightingDir || 'none';
  const aiBtn = document.getElementById('btn-ai-relight');
  if (aiBtn) aiBtn.style.display = (_compose.globalLightingDir && _compose.globalLightingDir !== 'none') ? 'block' : 'none';
  const sepSlider = document.getElementById('compose-separation-slider');
  const sepVal = document.getElementById('compose-separation-val');
  const sepPct = Math.round((_compose.bgSeparation ?? 0) * 100);
  if (sepSlider) sepSlider.value = sepPct;
  if (sepVal) sepVal.textContent = sepPct + '%';
  syncBgPanZoomSliders();
  updateComposeHeader();
  document.getElementById('compose-modal').classList.add('open');
  updateUndoBtn();
}

// ── compositor character cards ─────────────────────────────────────────────

const ALL_ANGLES = ['Front', ...CHAR_ANGLES];

function getCompCharImage(char, angle, expression) {
  const expr = (expression || '').trim().toLowerCase();
  if (expr && char.expressionCache?.[angle]?.[expr]) return char.expressionCache[angle][expr];
  if (!expr || expr === 'neutral') return getCharAngleImage(char, angle);
  return getCharAngleImage(char, angle); // base angle image as fallback
}

function compCharExistingExprs(char, angle) {
  const cache = char.expressionCache?.[angle] || {};
  return Object.keys(cache);
}

let _selectedCompCharId = null;
let _selectedCompAngle = 'Front';

function renderComposeCharCards() {
  if (!_compose) return;
  const container = document.getElementById('compose-char-cards');
  const detailWrap = document.getElementById('compose-char-detail-wrap');
  if (!container) return;
  if (!characters.length) { container.innerHTML = '<p style="font-size:11px;color:#444;font-style:italic">No characters yet.</p>'; if (detailWrap) detailWrap.innerHTML = ''; return; }
  container.innerHTML = compCharGridHTML();
  if (detailWrap) detailWrap.innerHTML = compCharDetailHTML();
}

function compCharGridHTML() {
  const tiles = characters.map(c => {
    const frontImg = getCompCharImage(c, 'Front', '');
    const onStage = _compose?.layers.some(l => l.charId === c.id);
    const selected = _selectedCompCharId === c.id;
    return `<div class="comp-char-tile${selected ? ' selected' : ''}${onStage ? ' on-stage' : ''}"
        id="comp-tile-${esc(c.id)}" onclick="selectComposeChar('${esc(c.id)}')"
        draggable="true" ondragstart="onCompCharDragStart(event,'${esc(c.id)}')" ondragend="onCompCharDragEnd()">
      ${frontImg
        ? `<img class="comp-char-tile-img" src="${esc(frontImg)}" alt="${esc(c.name)}">`
        : `<div class="comp-char-tile-img-empty">·</div>`}
      <div class="comp-char-tile-name">${esc(c.name || 'Unnamed')}</div>
    </div>`;
  }).join('');
  return `<div class="comp-char-grid">${tiles}</div>`;
}

let _selectedCompExpr = ''; // tracks selected variation expression (empty = base angle)

function compCharDetailHTML() {
  if (!_selectedCompCharId) return '';
  const char = characters.find(c => c.id === _selectedCompCharId);
  if (!char) return '';
  const shot = shots.find(s => s.id === _compose?.shotId);
  const det = (shot?.characterDetails || {})[char.id] || {};

  // Build all variation thumbnails: base angles + expressionCache entries
  const variationItems = [];
  // Standard angles
  ALL_ANGLES.forEach(a => {
    const img = a === 'Front' ? (char.images?.[0] || null) : (char.angles?.[a]?.image || null);
    variationItems.push({ angle: a, expr: '', img, label: a.replace('3/4 ','¾ ') });
  });
  // Expression cache variants
  Object.entries(char.expressionCache || {}).forEach(([angle, exprs]) => {
    Object.entries(exprs || {}).forEach(([expr, imgUrl]) => {
      if (imgUrl && expr && expr !== 'neutral') {
        variationItems.push({ angle, expr, img: imgUrl, label: `${angle.replace('3/4','¾')} · ${expr}` });
      }
    });
  });

  const variationThumbs = variationItems.map(v => {
    const sel = _selectedCompAngle === v.angle && _selectedCompExpr === v.expr;
    const isVariant = !!v.expr; // base angles have no expr
    const deleteBtn = isVariant
      ? `<button class="comp-thumb-delete" onclick="event.stopPropagation();deleteCharVariant('${esc(char.id)}','${esc(v.angle)} · ${esc(v.expr)}')" title="Delete variation">✕</button>`
      : '';
    return `<div class="comp-angle-thumb${sel ? ' selected' : ''}${v.img ? '' : ' comp-angle-thumb-missing'}" style="position:relative"
        onclick="selectComposeVariation('${esc(v.angle)}','${esc(v.expr)}')" title="${esc(v.label)}"
        draggable="true" ondragstart="onCompCharDragStart(event,'${esc(char.id)}')" ondragend="onCompCharDragEnd()">
      ${v.img ? `<img src="${esc(v.img)}" alt="${esc(v.label)}">` : `<div class="comp-angle-thumb-empty">·</div>`}
      <div class="comp-angle-label">${esc(v.label)}</div>
      ${deleteBtn}
    </div>`;
  }).join('');

  const previewImg = getCompCharImage(char, _selectedCompAngle, _selectedCompExpr);
  const labelSuffix = _selectedCompExpr ? ` · ${_selectedCompExpr}` : ` · ${_selectedCompAngle}`;

  return `<div class="comp-char-detail" id="comp-char-detail"
      draggable="true" ondragstart="onCompCharDragStart(event,'${esc(char.id)}')" ondragend="onCompCharDragEnd()">
    <div class="comp-char-preview-large">
      ${previewImg
        ? `<img src="${esc(previewImg)}" alt="${esc(char.name)}" id="comp-detail-preview-img">`
        : `<div class="comp-char-preview-large-empty" id="comp-detail-preview-img">No image generated</div>`}
      <div class="comp-char-preview-label-overlay">${esc(char.name || 'Unnamed')}${esc(labelSuffix)}</div>
    </div>
    <div class="comp-char-angle-grid">${variationThumbs}</div>
    <div style="position:relative;margin-top:6px">
      <textarea id="comp-alter-prompt" class="compose-tool-textarea" placeholder="Describe changes… (e.g. smiling, looking left)" style="padding-right:36px"></textarea>
      <button class="btn-comp-gen-inline" onclick="compGenerateExpr('${esc(char.id)}')" title="Generate variation">✦</button>
    </div>
    <div class="comp-char-actions" style="margin-top:4px">
      <button class="btn-comp-add" onclick="compAddCharToStage('${esc(char.id)}')">+ Add to canvas</button>
    </div>
  </div>`;
}

function selectComposeChar(charId) {
  if (_selectedCompCharId === charId) {
    _selectedCompCharId = null;
  } else {
    _selectedCompCharId = charId;
    // Sync angle from shot's characterDetails if available
    const shot = shots.find(s => s.id === _compose?.shotId);
    const det = (shot?.characterDetails || {})[charId] || {};
    _selectedCompAngle = det.facingDir || 'Front';
  }
  renderComposeCharCards();
}

async function selectComposeVariation(angle, expr) {
  _selectedCompAngle = angle;
  _selectedCompExpr = expr || '';

  // Determine charId: prefer the selected layer's charId, fall back to the char selected in add-mode
  const charId = (_compose && _compose.selectedIdx >= 0
    ? _compose.layers[_compose.selectedIdx]?.charId
    : null) || _selectedCompCharId;

  if (charId && _compose) {
    const char = characters.find(c => c.id === charId);
    const shot = shots.find(s => s.id === _compose.shotId);
    if (shot) {
      if (!shot.characterDetails) shot.characterDetails = {};
      if (!shot.characterDetails[charId]) shot.characterDetails[charId] = {};
      shot.characterDetails[charId].facingDir = angle;
      if (expr) shot.characterDetails[charId].expression = expr;
    }

    // Find the canvas layer to update — prefer the currently selected layer, else first layer for this char
    let layerIdx = (_compose.selectedIdx >= 0 && _compose.layers[_compose.selectedIdx]?.charId === charId)
      ? _compose.selectedIdx
      : _compose.layers.findIndex(l => l.charId === charId && !l.loading);

    if (layerIdx >= 0 && char) {
      const newRawUrl = getCompCharImage(char, angle, expr || '');
      const layer = _compose.layers[layerIdx];
      if (newRawUrl && newRawUrl !== layer.imgUrl) {
        // Show a loading placeholder while we remove the background
        _compose.layers[layerIdx] = { ...layer, loading: true };
        renderCompose();

        // Re-render sidebar immediately so the selection highlight updates
        const detailWrap = document.getElementById('compose-char-detail-wrap');
        if (detailWrap) detailWrap.innerHTML = compCharDetailHTML();
        else renderComposeLayerTab();

        try {
          const bgData = await apiFetch('/api/remove-background', { imageUrl: newRawUrl });
          const finalUrl = bgData.url || newRawUrl;
          const imgEl = new Image();
          imgEl.crossOrigin = 'anonymous';
          imgEl.onload = () => {
            const h = COMPOSE_H * layer.scale;
            const w = h * (imgEl.naturalWidth / imgEl.naturalHeight);
            _compose.layers[layerIdx] = { ...layer, loading: false, imgEl, imgUrl: finalUrl, w, h };
            renderCompose();
            saveComposeLayers();
          };
          imgEl.src = proxyUrl(finalUrl);
        } catch(e) {
          _compose.layers[layerIdx] = { ...layer, loading: false };
          renderCompose();
          showToast('Could not swap variation: ' + e.message, true);
        }
        return; // sidebar already re-rendered above
      }
    }
  }

  const detailWrap = document.getElementById('compose-char-detail-wrap');
  if (detailWrap) detailWrap.innerHTML = compCharDetailHTML();
  else renderComposeLayerTab();
}

function selectComposeAngle(angle) { selectComposeVariation(angle, ''); }

function refreshCompCharCard(charId) {
  // Re-render whole grid (tiles update on-stage state)
  renderComposeCharCards();
}

function onCompSavedExprSelect(charId, expr) {
  if (!expr || !_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  if (!shot.characterDetails) shot.characterDetails = {};
  if (!shot.characterDetails[charId]) shot.characterDetails[charId] = {};
  const det = shot.characterDetails[charId];
  det.expression = expr;
  const char = characters.find(c => c.id === charId);
  const angle = det.facingDir || 'Front';
  const cached = char?.expressionCache?.[angle]?.[expr.toLowerCase()];
  if (cached) det.variantImage = cached;
  refreshCompCharCard(charId);
  autoSave();
}

function onCompAngleChange(charId, angle) {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  if (!shot.characterDetails) shot.characterDetails = {};
  if (!shot.characterDetails[charId]) shot.characterDetails[charId] = {};
  shot.characterDetails[charId].facingDir = angle;
  delete shot.characterDetails[charId].variantImage;
  refreshCompCharCard(charId);
  refreshShotDetailIfOpen(_compose.shotId);
  autoSave();
}

function onCompExprChange(charId, expr) {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  if (!shot.characterDetails) shot.characterDetails = {};
  if (!shot.characterDetails[charId]) shot.characterDetails[charId] = {};
  const det = shot.characterDetails[charId];
  if (det.expression === expr) return;
  det.expression = expr;
  // If this exact angle+expr combo is already cached, just refresh the card
  const char = characters.find(c => c.id === charId);
  const angle = det.facingDir || 'Front';
  const cached = expr && char?.expressionCache?.[angle]?.[expr.toLowerCase()];
  if (cached) { det.variantImage = cached; refreshCompCharCard(charId); autoSave(); return; }
  refreshCompCharCard(charId);
  autoSave();
}

async function compGenerateExpr(charId) {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  const char = characters.find(c => c.id === charId);
  if (!char) return;
  if (!shot.characterDetails) shot.characterDetails = {};
  if (!shot.characterDetails[charId]) shot.characterDetails[charId] = {};
  const det = shot.characterDetails[charId];
  const angle = _selectedCompAngle || det.facingDir || 'Front';
  const alterEl = document.getElementById('comp-alter-prompt');
  const expr = (alterEl ? alterEl.value : det.expression || '').trim();
  if (!expr) { showToast('Describe a variation first.', true); return; }
  det.expression = expr;
  det.facingDir = angle;

  const refImg = getCharAngleImage(char, angle);
  if (!refImg) { showToast('Generate character images first.', true); return; }

  const genBtn = document.querySelector(`#comp-char-detail .btn-comp-gen-inline`);
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '…'; }

  const prompt = `Keep everything identical. Change only: ${expr}.`;

  try {
    const data = await apiFetch('/api/generate-char-variant', { prompt, referenceImageUrls: [refImg], stylePrompt: getStylePrompt() });
    const url = data.url || null;
    if (url) {
      // Save to expressionCache (for compose view)
      if (!char.expressionCache) char.expressionCache = {};
      if (!char.expressionCache[angle]) char.expressionCache[angle] = {};
      const exprKey = expr.toLowerCase();
      char.expressionCache[angle][exprKey] = url;
      det.variantImage = url;
      // Also store in char.angles under a unique variation key so main page shows it
      if (!char.angles) char.angles = {};
      const varKey = `${angle} · ${expr}`;
      char.angles[varKey] = { image: url, prompt: expr, isVariant: true, baseAngle: angle };
      // Ensure char is in shot's characterIds
      if (!shot.characterIds.includes(charId)) {
        shot.characterIds.push(charId);
        syncCharCheckbox(_compose.shotId, charId, true);
      }
      // Select the newly generated variation
      _selectedCompAngle = angle;
      _selectedCompExpr = exprKey;
    }
    refreshCompCharCard(charId);
    // Also refresh main page character angle rows so the variation shows up
    const angleRow = document.getElementById(`char-angles-${charId}`);
    if (angleRow) {
      const tbody = angleRow.querySelector('.char-angle-inner table tbody');
      if (tbody) { const c = characters.find(c => c.id === charId); if (c) tbody.innerHTML = charAngleRowsInnerHTML(c); }
    }
    refreshShotDetailIfOpen(_compose.shotId);
    autoSave();
    showToast('Variation generated.');
  } catch(e) {
    showToast('Error: ' + e.message, true);
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = '✦'; }
  }
}

async function compAddCharToStage(charId) {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  const char = characters.find(c => c.id === charId);
  if (!char) return;

  if (!shot.characterDetails) shot.characterDetails = {};
  if (!shot.characterDetails[charId]) shot.characterDetails[charId] = {};
  const det = shot.characterDetails[charId];
  const angle = _selectedCompAngle || det.facingDir || 'Front';
  const alterEl = document.getElementById('comp-alter-prompt');
  const expr = (alterEl ? alterEl.value : det.expression || '').trim();
  const imgUrl = getCompCharImage(char, angle, expr);
  if (!imgUrl) { showToast('No image for this character. Generate one first.', true); return; }

  // Ensure char is in shot's characterIds
  if (!shot.characterIds.includes(charId)) {
    shot.characterIds.push(charId);
    syncCharCheckbox(_compose.shotId, charId, true);
  }

  await addComposeLayerUrl(imgUrl, char.name || 'Unnamed', charId);
  refreshCompCharCard(charId);
}

function syncCharCheckbox(shotId, charId, checked) {
  const row = document.querySelector(`#shots-body tr[data-id="${shotId}"]`);
  if (!row) return;
  const cb = row.querySelector(`.char-cb[value="${charId}"]`);
  if (cb) cb.checked = checked;
}

let _compDragCharId = null;

function onCompCharDragStart(event, charId) {
  _compDragCharId = charId;
  event.dataTransfer.effectAllowed = 'copy';
}
function onCompCharDragEnd() { _compDragCharId = null; _compDragShotIdx = null; }

let _compDragShotIdx = null;
function onCompShotImgDragStart(event, idx) {
  _compDragShotIdx = idx;
  event.dataTransfer.effectAllowed = 'copy';
}

async function compAddShotImgToStage(idx) {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  const url = shot?.images?.[idx];
  if (!url) return;
  await addComposeLayerUrl(url, `Generated Image ${idx + 1}`, null);
}

function addComposeLayerUrlDirect(url, label, charId = null, dropPos = null) {
  if (!_compose) return;
  const pos = dropPos || { cx: COMPOSE_W / 2, cy: COMPOSE_H * 0.65 };
  const imgEl = new Image();
  imgEl.crossOrigin = 'anonymous';
  imgEl.onload = () => {
    const scale = 0.40;
    const h = COMPOSE_H * scale;
    const w = h * (imgEl.naturalWidth / imgEl.naturalHeight);
    _compose.layers.push({ imgEl, imgUrl: url, label, charId, cx: pos.cx, cy: pos.cy, scale, w, h, opacity: 1, contrast: 100, saturation: 100 });
    _compose.selectedIdx = _compose.layers.length - 1;
    updateComposeLayerPanel();
    renderCompose();
    saveComposeLayers();
    if (charId) refreshCompCharCard(charId);
  };
  imgEl.src = proxyUrl(url);
}

async function addComposeLayerUrl(url, label, charId = null, dropPos = null) {
  if (!_compose) return;
  const pos = dropPos || { cx: COMPOSE_W / 2, cy: COMPOSE_H * 0.65 };

  const placeholderIdx = _compose.layers.length;
  _compose.layers.push({ imgEl: null, label, charId, cx: pos.cx, cy: pos.cy, scale: 0.40, w: 0, h: 0, opacity: 1, contrast: 100, saturation: 100, loading: true });
  _compose.selectedIdx = placeholderIdx;
  showToast('Removing background…');

  try {
    // fal-ai birefnet requires an https URL — upload data URLs to CDN first
    let imageUrl = url;
    if (url && url.startsWith('data:')) {
      const b64 = url.split(',')[1];
      const uploaded = await apiFetch('/api/upload-reference', { base64: b64, mediaType: 'image/jpeg' });
      imageUrl = uploaded.url;
    }
    const data = await apiFetch('/api/remove-background', { imageUrl });
    const bgRemovedUrl = data.url || url;

    // Cache bg-removed URL on the character so the shot preview can use it
    if (charId) {
      const char = characters.find(c => c.id === charId);
      if (char && bgRemovedUrl !== url) { char.bgRemovedImage = bgRemovedUrl; autoSave(); }
    }

    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const scale = 0.40;
      const h = COMPOSE_H * scale;
      const w = h * (imgEl.naturalWidth / imgEl.naturalHeight);
      _compose.layers[placeholderIdx] = { imgEl, imgUrl: bgRemovedUrl, label, charId, cx: pos.cx, cy: pos.cy, scale, w, h, opacity: 1, contrast: 100, saturation: 100 };
      _compose.selectedIdx = placeholderIdx;
      updateComposeLayerPanel();
      renderCompose();
      saveComposeLayers();
      if (charId) refreshCompCharCard(charId);
    };
    imgEl.src = proxyUrl(bgRemovedUrl);
  } catch(e) {
    _compose.layers.splice(placeholderIdx, 1);
    showToast('Background removal failed, adding original.', true);
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const scale = 0.40;
      const h = COMPOSE_H * scale;
      const w = h * (imgEl.naturalWidth / imgEl.naturalHeight);
      _compose.layers.push({ imgEl, imgUrl: url, label, charId, cx: pos.cx, cy: pos.cy, scale, w, h, opacity: 1, contrast: 100, saturation: 100 });
      _compose.selectedIdx = _compose.layers.length - 1;
      updateComposeLayerPanel();
      renderCompose();
      saveComposeLayers();
      if (charId) refreshCompCharCard(charId);
    };
    imgEl.src = proxyUrl(url);
  }
}

function saveComposeLayers() {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  if (!shot) return;
  shot.composeLayers = _compose.layers
    .filter(l => l.imgUrl && !l.loading)
    .map(l => ({
      imgUrl: l.imgUrl,
      label: l.label,
      charId: l.charId || null,
      cx: l.cx, cy: l.cy,
      scale: l.scale, w: l.w, h: l.h,
      opacity: l.opacity ?? 1,
      lighting: l.lighting || 'none',
      lightingIntensity: l.lightingIntensity ?? 0.6,
      contrast: l.contrast ?? 100,
      saturation: l.saturation ?? 100,
    }));
  if (!shot.composeMeta) shot.composeMeta = {};
  shot.composeMeta.globalLighting = _compose.globalLighting || 'none';
  shot.composeMeta.globalLightingDir = _compose.globalLightingDir || 'none';
  shot.composeMeta.bgSeparation = _compose.bgSeparation ?? 0;
  shot.composeMeta.bgMaskUrl = _compose.bgMaskUrl || null;
  shot.composeMeta.bgColor = _compose.bgColor || null;
  shot.composeMeta.globalContrast = _compose.globalContrast ?? 100;
  shot.composeMeta.globalSaturation = _compose.globalSaturation ?? 100;
  shot.composeMeta.bgScale = _compose.bgScale ?? 1;
  shot.composeMeta.bgOffsetX = _compose.bgOffsetX ?? 0;
  shot.composeMeta.bgOffsetY = _compose.bgOffsetY ?? 0;
  shot.composeMeta.bgUrl = _compose.bgUrl || null;
  autoSave();
}

function setComposeBgSeparation(val) {
  if (!_compose) return;
  _compose.bgSeparation = val / 100;
  document.getElementById('compose-separation-val').textContent = val + '%';
  renderCompose();
  saveComposeLayers();
}

function setComposeSolidColor(color) {
  if (!_compose) return;
  _compose.bgColor = color;
  _compose.bgImg = null;
  _compose.bgUrl = null;
  _compose.bgKey = 'solid';
  document.querySelectorAll('#compose-loc-thumbs .compose-thumb').forEach(el => el.classList.remove('selected'));
  const swatch = document.getElementById('compose-color-swatch') || document.getElementById('compose-color-swatch-lg');
  if (swatch) swatch.style.background = color;
  renderCompose(); saveComposeLayers();
}

async function detectBgSubjects() {
  if (!_compose) return;
  const bgUrl = _compose.bgUrl;
  if (!bgUrl) { alert('No background image selected.'); return; }
  const btn = document.getElementById('btn-detect-subjects');
  const status = document.getElementById('detect-subjects-status');
  btn.disabled = true;
  btn.textContent = '⏳ Detecting…';
  status.style.color = '#555';
  status.textContent = 'Running subject detection…';
  try {
    const resp = await fetch('/api/segment-subjects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: bgUrl })
    });
    const data = await resp.json();
    if (!data.url) throw new Error(data.error || 'No mask returned');
    const maskImg = new Image();
    maskImg.crossOrigin = 'anonymous';
    maskImg.src = '/api/proxy-image?url=' + encodeURIComponent(data.url);
    await new Promise((res, rej) => { maskImg.onload = res; maskImg.onerror = rej; });
    _compose.bgMask = maskImg;
    _compose.bgMaskUrl = data.url;
    const shot = shots.find(s => s.id === _compose.shotId);
    if (shot) { if (!shot.composeMeta) shot.composeMeta = {}; shot.composeMeta.bgMaskUrl = data.url; }
    autoSave();
    status.style.color = '#4ade80';
    status.textContent = 'Subjects detected! Separation will now protect human figures.';
    renderCompose();
    showMaskPreview();
  } catch(e) {
    status.style.color = '#f87171';
    status.textContent = 'Detection failed: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ Detect Human Subjects';
  }
}

function showMaskPreview() {
  if (!_compose?.bgMask) return;
  const canvas = document.getElementById('compose-canvas');
  const ctx = canvas.getContext('2d');
  // Flash a green tint over detected subjects for 1.5s
  const flash = () => {
    renderCompose();
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    // Draw mask: white=subject. Tint green over subject areas by drawing the mask
    // then multiplying with green using a trick: draw mask desaturated, recolor
    const tmp = document.createElement('canvas');
    tmp.width = COMPOSE_W; tmp.height = COMPOSE_H;
    const tCtx = tmp.getContext('2d');
    tCtx.drawImage(_compose.bgMask, 0, 0, COMPOSE_W, COMPOSE_H);
    // Convert white pixels to green semi-transparent
    try {
      const px = tCtx.getImageData(0, 0, COMPOSE_W, COMPOSE_H);
      for (let i = 0; i < px.data.length; i += 4) {
        const b = px.data[i];
        px.data[0] = 0; px.data[1] = 200; px.data[2] = 80;
        px.data[3] = Math.round(b * 0.55); // subject brightness → green alpha
      }
      tCtx.putImageData(px, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    } catch(e) { console.error('mask preview error:', e); }
    ctx.restore();
  };
  flash();
  setTimeout(renderCompose, 1500);
}

function setComposeGlobalLighting(val) {
  if (!_compose) return;
  _compose.globalLighting = val;
  renderCompose();
  saveComposeLayers();
}

function setComposeGlobalLightingDir(val) {
  if (!_compose) return;
  _compose.globalLightingDir = val;
  const btn = document.getElementById('btn-ai-relight');
  if (btn) btn.style.display = (val && val !== 'none') ? 'block' : 'none';
  renderCompose();
  saveComposeLayers();
}

const RELIGHT_PRESETS = {
  'front':               { initialLatent: 'None',   prompt: 'soft frontal studio lighting, even fill light from camera direction, gentle shadows, cinematic look' },
  'three-quarter-left':  { initialLatent: 'Left',   prompt: 'warm three-quarter key light from the front-left, natural shadow on the right side, cinematic portrait lighting' },
  'left':                { initialLatent: 'Left',   prompt: 'dramatic side lighting from the left, deep Rembrandt shadows on the right, high contrast' },
  'three-quarter-right': { initialLatent: 'Right',  prompt: 'warm three-quarter key light from the front-right, natural shadow on the left, cinematic portrait lighting' },
  'right':               { initialLatent: 'Right',  prompt: 'dramatic side lighting from the right, deep shadows on the left, high contrast' },
  'backlight':           { initialLatent: 'None',   prompt: 'strong backlight from behind, dramatic rim lighting, glowing halo around subjects, silhouette effect' },
  'top':                 { initialLatent: 'Top',    prompt: 'harsh overhead downward lighting from directly above, deep shadows under brows and chin, film noir style' },
  'under':               { initialLatent: 'Bottom', prompt: 'dramatic underlighting from below, upward shadows on faces, eerie spooky upward light source' },
};

async function applyAIRelight() {
  const dir = _compose?.globalLightingDir;
  if (!dir || dir === 'none') return;
  const preset = RELIGHT_PRESETS[dir];
  if (!preset) return;

  const btn = document.getElementById('btn-ai-relight');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Relighting…'; }

  try {
    // Temporarily disable overlays so we send clean content to iclight
    const savedLightingDir = _compose.globalLightingDir;
    const savedLighting = _compose.globalLighting;
    _compose.globalLightingDir = 'none';
    _compose.globalLighting = 'none';
    renderCompose();

    // Flatten current canvas to base64
    const canvas = document.getElementById('compose-canvas');
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);

    // Restore overlays for display
    _compose.globalLightingDir = savedLightingDir;
    _compose.globalLighting = savedLighting;
    renderCompose();

    showToast('Sending to ICLight v2…');
    const data = await apiFetch('/api/relight-image', {
      imageBase64,
      prompt: preset.prompt,
      initialLatent: preset.initialLatent,
    });

    if (!data.url) throw new Error('No image returned');

    // Load the relit image and set as compositor background
    // (clear canvas overlays since iclight baked the lighting in)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      _compose.bgImg = img;
      _compose.globalLightingDir = 'none';
      _compose.globalLighting = 'none';
      const glSel = document.getElementById('compose-global-lighting');
      const glDirSel = document.getElementById('compose-lighting-dir');
      if (glSel) glSel.value = 'none';
      if (glDirSel) glDirSel.value = 'none';
      if (btn) btn.style.display = 'none';
      renderCompose();
      saveComposeLayers();
      showToast('AI lighting applied. Canvas overlays reset — lighting is baked into the background.');
    };
    img.onerror = () => { throw new Error('Failed to load relit image'); };
    img.src = proxyUrl(data.url);

  } catch(e) {
    showToast('Relight failed: ' + e.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Apply AI Lighting'; }
  }
}

async function restoreComposeLayers(savedLayers) {
  if (!savedLayers?.length || !_compose) return;
  for (const saved of savedLayers) {
    if (!saved.imgUrl) continue;
    const idx = _compose.layers.length;
    _compose.layers.push({ imgEl: null, imgUrl: saved.imgUrl, label: saved.label, charId: saved.charId, cx: saved.cx, cy: saved.cy, scale: saved.scale, w: saved.w, h: saved.h, opacity: saved.opacity ?? 1, lighting: saved.lighting || 'none', lightingIntensity: saved.lightingIntensity ?? 0.6, contrast: saved.contrast ?? 100, saturation: saved.saturation ?? 100, loading: true });
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      if (!_compose) return;
      _compose.layers[idx] = { ...(_compose.layers[idx]), imgEl, loading: false };
      renderCompose();
      updateComposeLayerPanel();
    };
    imgEl.src = proxyUrl(saved.imgUrl);
  }
}

// Add AI-generated image URLs to the associated location's images list
function addImagesToLocation(locationId, imageUrls) {
  if (!locationId || !imageUrls?.length) return;
  const loc = locations.find(l => l.id === locationId);
  if (!loc) return;
  if (!loc.images) loc.images = [];
  const newUrls = imageUrls.filter(u => u && !loc.images.includes(u));
  if (!newUrls.length) return;
  loc.images.push(...newUrls);
  autoSave();
  // Refresh the location's image grid in the DOM if visible
  const grid = document.getElementById(`loc-imgs-${locationId}`);
  if (grid) grid.innerHTML = imageSlots(loc.images, loc.images.length);
}

// ── Inpaint mask painting ─────────────────────────────────────────────────────
function toggleMaskMode() {
  if (!_compose) return;
  _maskMode = !_maskMode;
  if (_maskMode && !_maskCanvas) {
    _maskCanvas = document.createElement('canvas');
    _maskCanvas.width = COMPOSE_W; _maskCanvas.height = COMPOSE_H;
    _maskCtx = _maskCanvas.getContext('2d');
    _maskCtx.fillStyle = '#000';
    _maskCtx.fillRect(0, 0, COMPOSE_W, COMPOSE_H);
  }
  updateMaskOverlay();
  const btn = document.getElementById('btn-toggle-mask');
  if (btn) {
    btn.style.background = _maskMode ? '#1a0a2a' : 'none';
    btn.style.borderColor = _maskMode ? '#a78bfa' : '#2a2a2a';
    btn.style.color = _maskMode ? '#a78bfa' : '#aaa';
    btn.textContent = _maskMode ? '🖌 Painting (ON)' : '🖌 Paint Mask';
  }
  renderCompose();
}

function clearMask() {
  if (!_maskCtx) return;
  _maskCtx.fillStyle = '#000';
  _maskCtx.fillRect(0, 0, COMPOSE_W, COMPOSE_H);
  updateMaskOverlay();
  renderCompose();
}

function updateMaskOverlay() {
  if (!_maskCanvas) return;
  if (!_maskOverlayCanvas) {
    _maskOverlayCanvas = document.createElement('canvas');
    _maskOverlayCanvas.width = COMPOSE_W; _maskOverlayCanvas.height = COMPOSE_H;
  }
  const mc = _maskOverlayCanvas.getContext('2d');
  mc.clearRect(0, 0, COMPOSE_W, COMPOSE_H);
  mc.fillStyle = 'rgb(255, 60, 60)';
  mc.fillRect(0, 0, COMPOSE_W, COMPOSE_H);
  mc.globalCompositeOperation = 'destination-in';
  mc.drawImage(_maskCanvas, 0, 0);
  mc.globalCompositeOperation = 'source-over';
  // Set resulting pixels to 50% opacity
  const id = mc.getImageData(0, 0, COMPOSE_W, COMPOSE_H);
  for (let i = 3; i < id.data.length; i += 4) id.data[i] = Math.round(id.data[i] * 0.5);
  mc.putImageData(id, 0, 0);
}

function paintMask(x, y) {
  if (!_maskCtx) return;
  _maskCtx.fillStyle = '#fff';
  _maskCtx.strokeStyle = '#fff';
  _maskCtx.lineWidth = _maskBrushSize;
  _maskCtx.lineCap = 'round';
  _maskCtx.lineJoin = 'round';
  if (_lastMaskX !== null) {
    _maskCtx.beginPath();
    _maskCtx.moveTo(_lastMaskX, _lastMaskY);
    _maskCtx.lineTo(x, y);
    _maskCtx.stroke();
  }
  _maskCtx.beginPath();
  _maskCtx.arc(x, y, _maskBrushSize / 2, 0, Math.PI * 2);
  _maskCtx.fill();
  _lastMaskX = x; _lastMaskY = y;
  updateMaskOverlay();
  renderCompose();
}

async function applyInpaint() {
  if (!_compose || !_maskCanvas) { showToast('Enable Paint Mask and draw a region first.', true); return; }
  const prompt = document.getElementById('inpaint-prompt')?.value.trim();
  if (!prompt) { showToast('Enter a prompt describing the replacement.', true); return; }

  const btn = document.getElementById('btn-apply-inpaint');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
  try {
    captureUndoState();
    // Export canvas without mask overlay (hide mask temporarily)
    const wasMaskMode = _maskMode;
    _maskMode = false;
    const savedIdx = _compose.selectedIdx;
    _compose.selectedIdx = -1;
    renderCompose();
    const imageB64 = document.getElementById('compose-canvas').toDataURL('image/jpeg', 0.92).split(',')[1];
    _compose.selectedIdx = savedIdx;
    _maskMode = wasMaskMode;
    renderCompose();

    const maskB64 = _maskCanvas.toDataURL('image/png').split(',')[1];

    const [imageData, maskData] = await Promise.all([
      apiFetch('/api/upload-reference', { base64: imageB64, mediaType: 'image/jpeg' }),
      apiFetch('/api/upload-reference', { base64: maskB64, mediaType: 'image/png' })
    ]);

    const data = await apiFetch('/api/inpaint', { imageUrl: imageData.url, maskUrl: maskData.url, prompt });
    if (!data.url) throw new Error('No image returned');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      _compose.bgImg = img;
      _compose.bgUrl = data.url;
      _compose.bgColor = null;
      _compose.bgScale = 1;
      _compose.bgOffsetX = 0;
      _compose.bgOffsetY = 0;
      clearMask();
      _maskMode = false;
      const maskBtn = document.getElementById('btn-toggle-mask');
      if (maskBtn) { maskBtn.style.background='none'; maskBtn.style.borderColor='#2a2a2a'; maskBtn.style.color='#aaa'; maskBtn.textContent='🖌 Paint Mask'; }
      syncBgPanZoomSliders();
      renderCompose();
      saveComposeLayers();
      addImagesToLocation(_compose.locationId, [data.url]);
      addUrlToShotImages(data.url);
      showToast('Inpaint applied.');
    };
    img.onerror = () => showToast('Failed to load inpainted image.', true);
    img.src = proxyUrl(data.url);
  } catch(e) {
    showToast('Inpaint failed: ' + e.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Apply to Region'; }
  }
}

function closeCompose() {
  if (!_compose) return;
  saveComposeLayers();

  // Auto-save current canvas state as the shot's final image (fire-and-forget)
  const shotId = _compose.shotId;
  const canvas = document.getElementById('compose-canvas');
  if (canvas && shotId) {
    const savedIdx = _compose.selectedIdx;
    _compose.selectedIdx = -1;
    renderCompose();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    _compose.selectedIdx = savedIdx;
    renderCompose();
    const base64 = dataUrl.split(',')[1];
    apiFetch('/api/upload-reference', { base64, mediaType: 'image/jpeg' }).then(data => {
      const url = data.url;
      const shot = shots.find(s => s.id === shotId);
      if (!shot || !url) return;
      shot.finalImage = url;
      // Update shot row preview
      const cell = document.getElementById(`final-img-${shotId}`);
      if (cell) {
        const locPreview = cell.querySelector('.final-image-loc-preview');
        if (locPreview) {
          let badge = locPreview.querySelector('.final-image-badge');
          if (!badge) { badge = document.createElement('div'); badge.className = 'final-image-badge'; locPreview.appendChild(badge); }
          badge.textContent = '✎ Final';
          let img = locPreview.querySelector('.final-image-preview');
          if (!img) { img = document.createElement('img'); img.className = 'final-image-preview'; locPreview.insertBefore(img, locPreview.firstChild); }
          img.src = url;
          const empty = locPreview.querySelector('.final-image-loc-empty');
          if (empty) empty.remove();
          // Remove character overlays — final image already includes them composited
          locPreview.querySelectorAll('.final-preview-char-overlay').forEach(el => el.remove());
        }
      }
      autoSave();
    }).catch(() => {}); // silently ignore upload failures
  }

  document.getElementById('compose-modal').classList.remove('open');
  _compose = null;
  _composeDrag = null;
  _maskCanvas = null; _maskCtx = null; _maskOverlayCanvas = null;
  _maskMode = false; _maskPainting = false;
  _lastMaskX = null; _lastMaskY = null; _maskCursorX = null; _maskCursorY = null;
}

function updateComposeHeader() {
  if (!_compose) return;
  const idx = shots.findIndex(s => s.id === _compose.shotId);
  const shot = shots[idx];
  const title = document.getElementById('compose-shot-title');
  const indexLabel = document.getElementById('compose-shot-index');
  const prevBtn = document.getElementById('btn-compose-prev');
  const nextBtn = document.getElementById('btn-compose-next');
  const playBtn = document.getElementById('btn-compose-play');
  if (title) title.textContent = `Shot ${idx + 1}${shot?.lyric ? ' — ' + shot.lyric.slice(0, 40) : ''}`;
  if (indexLabel) indexLabel.textContent = `${idx + 1} / ${shots.length}`;
  if (prevBtn) prevBtn.disabled = idx <= 0;
  if (nextBtn) nextBtn.disabled = idx >= shots.length - 1;
  // Enable play only when there's audio loaded and this shot has a usable timestamp
  const hasAudio = !!(getPinnedPlayer()?.src);
  const ts = shot?.timestamp;
  const hasTs = ts && ts !== '0:00' && parseTimestamp(ts) !== null;
  if (playBtn) playBtn.disabled = !(hasAudio && hasTs);
  // Restore video state if shot has one
  if (shot?.videoUrl) {
    const vid = document.getElementById('compose-video-main');
    if (vid) vid.src = shot.videoUrl;
    const sideVid = document.getElementById('compose-video-player');
    if (sideVid) { sideVid.src = shot.videoUrl; sideVid.style.display = ''; }
  }
}

function composeNavShot(dir) {
  if (!_compose) return;
  const idx = shots.findIndex(s => s.id === _compose.shotId);
  const next = shots[idx + dir];
  if (!next) return;
  saveComposeLayers();
  // Reset video view to image when navigating
  switchComposeView('image');
  openCompose(next.id);
}

function composePlayAudio() {
  if (!_compose) return;
  playAudioAtShot(_compose.shotId);
}

function openVideoTab() {
  switchComposeTab('video');
}

async function createTalkingVideo() {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  if (!shot) return;

  // Get the composed image — save a fresh render as a data URL, upload it
  const canvas = document.getElementById('compose-canvas');
  const savedIdx = _compose.selectedIdx;
  _compose.selectedIdx = -1;
  renderCompose();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  _compose.selectedIdx = savedIdx;
  renderCompose();

  const btn = document.getElementById('btn-talking-video');
  const status = document.getElementById('talking-video-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Uploading image…'; }
  if (status) status.textContent = '';

  try {
    // Upload the composed image
    const uploadData = await apiFetch('/api/upload-reference', { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    const imageUrl = uploadData.url;
    if (!imageUrl) throw new Error('Image upload failed');

    // Extract audio clip for this shot's timestamp range
    if (btn) btn.textContent = '⏳ Preparing audio…';
    let audioUrl = null;
    const player = getPinnedPlayer();
    if (player?.src && shot.timestamp && shot.timestamp !== '0:00') {
      // Upload the full audio file — the API will use the image + audio together
      const audioFile = await idbGet(_audioKey() + '-file');
      if (audioFile) {
        const audioB64 = await fileToBase64(audioFile);
        const audioUpload = await apiFetch('/api/upload-reference', { base64: audioB64.split(',')[1], mediaType: audioFile.type || 'audio/mpeg' });
        audioUrl = audioUpload.url;
      }
    }

    if (btn) btn.textContent = '⏳ Generating video…';
    const prompt = shot.lyric || shot.action || 'Character speaking naturally';
    const data = await apiFetch('/api/create-talking-video', { imageUrl, audioUrl, prompt });
    const videoUrl = data.url;
    if (!videoUrl) throw new Error('No video returned');

    // Save video to shot
    shot.videoUrl = videoUrl;
    _compose.videoUrl = videoUrl;
    autoSave();

    // Show the video in the sidebar panel
    const sideVid = document.getElementById('compose-video-player');
    if (sideVid) { sideVid.src = videoUrl; sideVid.style.display = ''; }

    // Switch main view to video
    switchComposeView('video');

    if (status) status.textContent = 'Video ready.';
    showToast('Talking video created!');
  } catch(e) {
    showToast('Video failed: ' + e.message, true);
    if (status) status.textContent = 'Error: ' + e.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Create Talking Video'; }
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function addComposeLayer(type, id) {
  if (!_compose) return;
  const item = type === 'char' ? characters.find(c => c.id === id) : locations.find(l => l.id === id);
  if (!item || !item.images?.length) return;
  addComposeLayerUrl(item.images[0], item.name || '');
}

function removeComposeLayer() {
  if (!_compose || _compose.selectedIdx < 0) return;
  captureUndoState();
  _compose.layers.splice(_compose.selectedIdx, 1);
  _compose.selectedIdx = Math.min(_compose.selectedIdx, _compose.layers.length - 1);
  updateComposeLayerPanel();
  renderCompose();
  saveComposeLayers();
}

function setComposeLayerScale(val) {
  document.getElementById('compose-scale-val').textContent = val + '%';
  if (!_compose || _compose.selectedIdx < 0) return;
  const layer = _compose.layers[_compose.selectedIdx];
  layer.scale = val / 100;
  layer.h = COMPOSE_H * layer.scale;
  layer.w = layer.h * (layer.imgEl.naturalWidth / layer.imgEl.naturalHeight);
  renderCompose();
  saveComposeLayers();
}

function setComposeLayerOpacity(val) {
  document.getElementById('compose-opacity-val').textContent = val + '%';
  if (!_compose || _compose.selectedIdx < 0) return;
  _compose.layers[_compose.selectedIdx].opacity = val / 100;
  renderCompose();
  saveComposeLayers();
}

function setComposeLayerLighting(val) {
  if (!_compose || _compose.selectedIdx < 0) return;
  _compose.layers[_compose.selectedIdx].lighting = val;
  const intensityRow = document.getElementById('compose-lighting-intensity-row');
  intensityRow.style.display = val === 'none' ? 'none' : 'flex';
  renderCompose();
  saveComposeLayers();
}

function setComposeLayerLightingIntensity(val) {
  document.getElementById('compose-lighting-val').textContent = val + '%';
  if (!_compose || _compose.selectedIdx < 0) return;
  _compose.layers[_compose.selectedIdx].lightingIntensity = val / 100;
  renderCompose();
  saveComposeLayers();
}

function buildLitLayer(layer) {
  const w = Math.round(layer.w), h = Math.round(layer.h);
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const oc = off.getContext('2d');

  // Draw character
  oc.drawImage(layer.imgEl, 0, 0, w, h);

  // Clip lighting gradient to character's own pixels only
  oc.globalCompositeOperation = 'source-atop';
  const s = layer.lightingIntensity ?? 0.6;
  let grad;

  switch (layer.lighting) {
    case 'front':
      grad = oc.createRadialGradient(w * 0.5, h * 0.38, 0, w * 0.5, h * 0.38, Math.max(w, h) * 0.72);
      grad.addColorStop(0,   `rgba(255,255,255,${s * 0.28})`);
      grad.addColorStop(0.45, 'rgba(128,128,128,0)');
      grad.addColorStop(1,   `rgba(0,0,0,${s * 0.38})`);
      break;
    case 'left':
      grad = oc.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0,    `rgba(255,255,255,${s * 0.40})`);
      grad.addColorStop(0.32, 'rgba(200,200,200,0)');
      grad.addColorStop(0.62, 'rgba(0,0,0,0)');
      grad.addColorStop(1,    `rgba(0,0,0,${s * 0.58})`);
      break;
    case 'right':
      grad = oc.createLinearGradient(w, 0, 0, 0);
      grad.addColorStop(0,    `rgba(255,255,255,${s * 0.40})`);
      grad.addColorStop(0.32, 'rgba(200,200,200,0)');
      grad.addColorStop(0.62, 'rgba(0,0,0,0)');
      grad.addColorStop(1,    `rgba(0,0,0,${s * 0.58})`);
      break;
    case 'top':
      grad = oc.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0,    `rgba(255,255,255,${s * 0.35})`);
      grad.addColorStop(0.28, 'rgba(200,200,200,0)');
      grad.addColorStop(0.65, 'rgba(0,0,0,0)');
      grad.addColorStop(1,    `rgba(0,0,0,${s * 0.50})`);
      break;
    case 'bottom':
      grad = oc.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0,    `rgba(255,255,255,${s * 0.35})`);
      grad.addColorStop(0.28, 'rgba(200,200,200,0)');
      grad.addColorStop(0.65, 'rgba(0,0,0,0)');
      grad.addColorStop(1,    `rgba(0,0,0,${s * 0.50})`);
      break;
    case 'backlit':
      // Dark body, warm rim light at edges
      grad = oc.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.1, w * 0.5, h * 0.45, Math.max(w, h) * 0.68);
      grad.addColorStop(0,    `rgba(0,0,0,${s * 0.72})`);
      grad.addColorStop(0.65, `rgba(0,0,0,${s * 0.35})`);
      grad.addColorStop(0.82, 'rgba(30,20,0,0)');
      grad.addColorStop(1,    `rgba(255,210,120,${s * 0.50})`);
      break;
  }

  if (grad) { oc.fillStyle = grad; oc.fillRect(0, 0, w, h); }
  const lc = layer.contrast ?? 100;
  const ls = layer.saturation ?? 100;
  if (lc !== 100 || ls !== 100) {
    const filtered = document.createElement('canvas');
    filtered.width = w; filtered.height = h;
    const fc = filtered.getContext('2d');
    fc.filter = `contrast(${lc}%) saturate(${ls}%)`;
    fc.drawImage(off, 0, 0);
    return filtered;
  }
  return off;
}

function switchComposeTab(tab) {
  document.querySelectorAll('.compose-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.compose-tab-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById(`compose-tabpanel-${tab}`);
  if (panel) panel.style.display = '';
  if (tab === 'layer') renderComposeLayerTab();
  // Video tab: switch main view
  switchComposeView(tab === 'video' && _compose?.videoUrl ? 'video' : 'image');
}

function switchComposeView(mode) {
  const canvasWrap = document.querySelector('.compose-canvas-wrap');
  const videoView = document.getElementById('compose-video-view');
  if (!canvasWrap || !videoView) return;
  if (mode === 'video') {
    canvasWrap.style.display = 'none';
    videoView.style.display = 'flex';
    const vid = document.getElementById('compose-video-main');
    if (vid && _compose?.videoUrl && vid.src !== _compose.videoUrl) vid.src = _compose.videoUrl;
  } else {
    canvasWrap.style.display = '';
    videoView.style.display = 'none';
  }
}

function renderComposeLayerTab() {
  if (!_compose) return;
  const sel = document.getElementById('compose-layer-select');
  const content = document.getElementById('compose-layer-content');
  if (!sel || !content) return;

  // Rebuild dropdown options
  const layers = _compose.layers;
  const currentVal = sel.value;
  sel.innerHTML = `<option value="__add__">+ Add Character</option>` +
    layers.map((l, i) => `<option value="${i}">${esc(l.label || `Layer ${i + 1}`)}</option>`).join('');

  // Keep selection if still valid
  const idx = _compose.selectedIdx;
  if (idx >= 0 && idx < layers.length) {
    sel.value = String(idx);
  } else {
    sel.value = '__add__';
    _compose.selectedIdx = -1;
  }

  // Render content area
  if (sel.value === '__add__') {
    content.innerHTML = `<div class="compose-layer-add-mode" id="compose-char-add-wrap">
      <div id="compose-char-cards"></div>
      <div id="compose-char-detail-wrap" class="compose-char-detail-wrap"></div>
    </div>`;
    renderComposeCharCards();
  } else {
    content.innerHTML = compLayerEditHTML(layers[idx], idx);
    syncLayerEditSliders(layers[idx]);
  }
}

function onLayerDropdownChange(val) {
  if (!_compose) return;
  if (val === '__add__') {
    _compose.selectedIdx = -1;
    _selectedCompCharId = null;
  } else {
    _compose.selectedIdx = parseInt(val, 10);
  }
  renderComposeLayerTab();
  renderCompose && renderCompose();
}

function compLayerEditHTML(layer, idx) {
  const char = layer.charId ? characters.find(c => c.id === layer.charId) : null;
  const shot = shots.find(s => s.id === _compose?.shotId);
  const det = char ? ((shot?.characterDetails || {})[char.id] || {}) : {};
  const angle = det.facingDir || 'Front';

  const charPreview = char ? (() => {
    const curExpr = _selectedCompCharId ? _selectedCompExpr : (det.expression || '');
    const curAngle = _selectedCompCharId ? _selectedCompAngle : angle;
    const img = getCompCharImage(char, curAngle, curExpr);
    // Build all variation thumbnails: base angles + expressionCache entries
    const varItems = [];
    ALL_ANGLES.forEach(a => {
      const aImg = a === 'Front' ? (char.images?.[0] || null) : (char.angles?.[a]?.image || null);
      varItems.push({ angle: a, expr: '', img: aImg, label: a.replace('3/4 ','¾ ') });
    });
    Object.entries(char.expressionCache || {}).forEach(([a, exprs]) => {
      Object.entries(exprs || {}).forEach(([ex, imgUrl]) => {
        if (imgUrl && ex && ex !== 'neutral')
          varItems.push({ angle: a, expr: ex, img: imgUrl, label: `${a.replace('3/4','¾')} · ${ex}` });
      });
    });
    const thumbs = varItems.map(v => {
      const sel = curAngle === v.angle && curExpr === v.expr;
      return `<div class="comp-angle-thumb${sel ? ' selected' : ''}${v.img ? '' : ' comp-angle-thumb-missing'}"
          onclick="selectComposeVariation('${esc(v.angle)}','${esc(v.expr)}')" title="${esc(v.label)}">
        ${v.img ? `<img src="${esc(v.img)}" alt="${esc(v.label)}">` : `<div class="comp-angle-thumb-empty">·</div>`}
        <div class="comp-angle-label">${esc(v.label)}</div>
      </div>`;
    }).join('');
    return `<div class="comp-layer-char-preview">
      ${img ? `<img src="${esc(img)}" alt="${esc(char.name)}">` : `<div class="comp-char-preview-large-empty">No image</div>`}
      <div class="comp-char-preview-label-overlay">${esc(char.name || 'Unnamed')} · ${esc(curExpr || curAngle)}</div>
    </div>
    <div class="compose-section-title" style="margin:8px 0 4px">Variations</div>
    <div class="comp-char-angle-grid" style="margin-bottom:8px">${thumbs}</div>`;
  })() : `<p style="font-size:11px;color:#555;margin-bottom:8px">${esc(layer.label || 'Layer')}</p>`;

  return `<div class="compose-layer-edit-mode">
    ${charPreview}
    <div class="compose-section-title" style="margin:8px 0 6px">Layer Settings</div>
    <div class="compose-slider-row">
      <span class="compose-slider-label">Size</span>
      <input type="range" id="compose-scale-slider" min="5" max="300" value="30" oninput="setComposeLayerScale(this.value)" onmousedown="captureUndoState()">
      <span class="compose-slider-val" id="compose-scale-val">30%</span>
    </div>
    <div class="compose-slider-row">
      <span class="compose-slider-label">Opacity</span>
      <input type="range" id="compose-opacity-slider" min="10" max="100" value="100" oninput="setComposeLayerOpacity(this.value)" onmousedown="captureUndoState()">
      <span class="compose-slider-val" id="compose-opacity-val">100%</span>
    </div>
    <div class="compose-slider-row" style="flex-direction:column;align-items:stretch;gap:6px">
      <span class="compose-slider-label">Lighting</span>
      <select id="compose-lighting-select" onchange="setComposeLayerLighting(this.value)" style="font-size:11px;background:#1a1a1a;color:#aaa;border:1px solid #2a2a2a;border-radius:4px;padding:4px 6px;width:100%">
        <option value="none">None</option>
        <option value="front">Front (soft)</option>
        <option value="left">Side — Left</option>
        <option value="right">Side — Right</option>
        <option value="top">Top down</option>
        <option value="bottom">Bottom up</option>
        <option value="backlit">Backlit / Rim</option>
      </select>
    </div>
    <div class="compose-slider-row" id="compose-lighting-intensity-row" style="display:none">
      <span class="compose-slider-label">Intensity</span>
      <input type="range" id="compose-lighting-slider" min="10" max="100" value="60" oninput="setComposeLayerLightingIntensity(this.value)" onmousedown="captureUndoState()">
      <span class="compose-slider-val" id="compose-lighting-val">60%</span>
    </div>
    <div class="compose-slider-row">
      <span class="compose-slider-label">Contrast</span>
      <input type="range" id="compose-layer-contrast" min="50" max="200" value="100" oninput="setComposeLayerContrast(this.value)" onmousedown="captureUndoState()">
      <span class="compose-slider-val" id="compose-layer-contrast-val">100%</span>
    </div>
    <div class="compose-slider-row">
      <span class="compose-slider-label">Saturation</span>
      <input type="range" id="compose-layer-saturation" min="0" max="200" value="100" oninput="setComposeLayerSaturation(this.value)" onmousedown="captureUndoState()">
      <span class="compose-slider-val" id="compose-layer-saturation-val">100%</span>
    </div>
    <button onclick="flipComposeLayerH()" style="width:100%;margin-top:2px;padding:5px 8px;font-size:11px;background:#1a1a1a;color:#aaa;border:1px solid #2a2a2a;border-radius:4px;cursor:pointer">⇔ Flip Horizontal</button>
    <textarea id="compose-layer-prompt" placeholder="Prompt to alter this layer…" class="compose-tool-textarea" style="margin-top:6px"></textarea>
    <button id="btn-apply-layer-prompt" onclick="applyLayerPrompt()" class="compose-tool-btn-purple" style="margin-top:4px">Apply Prompt to Layer</button>
    <button class="btn btn-remove-layer" style="width:100%;margin-top:4px" onclick="removeComposeLayer()">Remove Layer</button>
  </div>`;
}

function syncLayerEditSliders(layer) {
  if (!layer) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const scaleVal = Math.round(layer.scale * 100);
  set('compose-scale-slider', scaleVal); setText('compose-scale-val', scaleVal + '%');
  const opacityVal = Math.round(layer.opacity * 100);
  set('compose-opacity-slider', opacityVal); setText('compose-opacity-val', opacityVal + '%');
  const lighting = layer.lighting || 'none';
  set('compose-lighting-select', lighting);
  const intensityRow = document.getElementById('compose-lighting-intensity-row');
  if (intensityRow) intensityRow.style.display = lighting === 'none' ? 'none' : 'flex';
  const intensity = Math.round((layer.lightingIntensity ?? 0.6) * 100);
  set('compose-lighting-slider', intensity); setText('compose-lighting-val', intensity + '%');
  const contrastVal = Math.round(layer.contrast ?? 100);
  set('compose-layer-contrast', contrastVal); setText('compose-layer-contrast-val', contrastVal + '%');
  const satVal = Math.round(layer.saturation ?? 100);
  set('compose-layer-saturation', satVal); setText('compose-layer-saturation-val', satVal + '%');
}

function setComposeBgMode() {} // no-op — mode bar removed, all sections always visible

function updateComposeLayerPanel() {
  if (!_compose) return;
  const layerTab = document.getElementById('compose-tab-layer');
  const hasSelection = _compose.selectedIdx >= 0 && _compose.selectedIdx < _compose.layers.length;
  if (layerTab) layerTab.style.color = hasSelection ? '#4ade80' : '';
  switchComposeTab('layer');
  // renderComposeLayerTab is called by switchComposeTab('layer')
}

function renderCompose() {
  const canvas = document.getElementById('compose-canvas');
  if (!canvas || !_compose) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, COMPOSE_W, COMPOSE_H);

  // Background
  if (_compose.bgColor) {
    ctx.fillStyle = _compose.bgColor;
    ctx.fillRect(0, 0, COMPOSE_W, COMPOSE_H);
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, COMPOSE_W, COMPOSE_H);
    if (_compose.bgImg) {
      const s = _compose.bgScale ?? 1;
      const drawW = COMPOSE_W * s;
      const drawH = COMPOSE_H * s;
      const ox = (_compose.bgOffsetX ?? 0) + (COMPOSE_W - drawW) / 2;
      const oy = (_compose.bgOffsetY ?? 0) + (COMPOSE_H - drawH) / 2;
      ctx.drawImage(_compose.bgImg, ox, oy, drawW, drawH);
    }
  }

  // Background selection indicator
  if (_compose.bgSelected && _compose.selectedIdx < 0) {
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, COMPOSE_W - 4, COMPOSE_H - 4);
  }

  // Rule-of-thirds overlay (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  [COMPOSE_W/3, COMPOSE_W*2/3].forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, COMPOSE_H); ctx.stroke(); });
  [COMPOSE_H/3, COMPOSE_H*2/3].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(COMPOSE_W, y); ctx.stroke(); });

  // Subject separation — desaturate + darken background before drawing characters
  const sep = _compose.bgSeparation ?? 0;
  if (sep > 0) {
    if (_compose.bgMask) {
      try {
        // Build the darkening overlay, then zero out alpha where mask says "subject"
        const offDark = document.createElement('canvas');
        offDark.width = COMPOSE_W; offDark.height = COMPOSE_H;
        const dCtx = offDark.getContext('2d');
        dCtx.fillStyle = `rgba(0,0,0,${sep})`;
        dCtx.fillRect(0, 0, COMPOSE_W, COMPOSE_H);
        const darkPx = dCtx.getImageData(0, 0, COMPOSE_W, COMPOSE_H);

        // Read mask pixels (white=subject, black=background)
        const offMask = document.createElement('canvas');
        offMask.width = COMPOSE_W; offMask.height = COMPOSE_H;
        const mCtx = offMask.getContext('2d');
        mCtx.drawImage(_compose.bgMask, 0, 0, COMPOSE_W, COMPOSE_H);
        const maskPx = mCtx.getImageData(0, 0, COMPOSE_W, COMPOSE_H);

        // Suppress overlay alpha proportional to subject brightness
        for (let i = 0; i < darkPx.data.length; i += 4) {
          const subjectness = maskPx.data[i] / 255; // 1=subject, 0=background
          darkPx.data[3] = Math.round(darkPx.data[3] * (1 - subjectness));
        }
        dCtx.putImageData(darkPx, 0, 0);
        ctx.drawImage(offDark, 0, 0);
      } catch(e) {
        console.error('mask separation error:', e);
        ctx.fillStyle = `rgba(0,0,0,${sep})`;
        ctx.fillRect(0, 0, COMPOSE_W, COMPOSE_H);
      }
    } else {
      ctx.fillStyle = `rgba(0,0,0,${sep})`;
      ctx.fillRect(0, 0, COMPOSE_W, COMPOSE_H);
    }
  }

  // Layers
  _compose.layers.forEach((layer, i) => {
    if (layer.loading || !layer.imgEl) return;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    let src;
    if (layer.lighting && layer.lighting !== 'none') {
      src = buildLitLayer(layer);
    } else if ((layer.contrast ?? 100) !== 100 || (layer.saturation ?? 100) !== 100) {
      const off = document.createElement('canvas');
      off.width = Math.round(layer.w); off.height = Math.round(layer.h);
      const oc = off.getContext('2d');
      oc.filter = `contrast(${layer.contrast ?? 100}%) saturate(${layer.saturation ?? 100}%)`;
      oc.drawImage(layer.imgEl, 0, 0, off.width, off.height);
      src = off;
    } else {
      src = layer.imgEl;
    }
    ctx.drawImage(src, layer.cx - layer.w/2, layer.cy - layer.h/2, layer.w, layer.h);
    ctx.restore();
    // Selection outline + corner handles
    if (i === _compose.selectedIdx) {
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(layer.cx - layer.w/2, layer.cy - layer.h/2, layer.w, layer.h);
      const hs = 10;
      ctx.fillStyle = '#818cf8';
      [[layer.cx-layer.w/2, layer.cy-layer.h/2],[layer.cx+layer.w/2, layer.cy-layer.h/2],
       [layer.cx-layer.w/2, layer.cy+layer.h/2],[layer.cx+layer.w/2, layer.cy+layer.h/2]].forEach(([hx,hy]) => {
        ctx.fillRect(hx-hs/2, hy-hs/2, hs, hs);
      });
    }
  });

  // Global scene lighting overlay
  applyGlobalLightingOverlay(ctx);

  // Global contrast / saturation — applied last via offscreen filter pass
  const _gc = _compose.globalContrast ?? 100;
  const _gs = _compose.globalSaturation ?? 100;
  if (_gc !== 100 || _gs !== 100) {
    const off2 = document.createElement('canvas');
    off2.width = COMPOSE_W; off2.height = COMPOSE_H;
    const oc2 = off2.getContext('2d');
    oc2.filter = `contrast(${_gc}%) saturate(${_gs}%)`;
    oc2.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, COMPOSE_W, COMPOSE_H);
    ctx.drawImage(off2, 0, 0);
  }

  // Inpaint mask overlay — red tint where mask is white
  if (_maskMode && _maskOverlayCanvas) {
    ctx.drawImage(_maskOverlayCanvas, 0, 0);
  }

  // Brush cursor when in mask mode
  if (_maskMode && _maskCursorX !== null) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(_maskCursorX, _maskCursorY, _maskBrushSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function applyGlobalLightingOverlay(ctx) {
  const W = COMPOSE_W, H = COMPOSE_H;
  ctx.save();

  // ── Color / Temperature ───────────────────────────────────────────────────
  const gl = _compose?.globalLighting;
  if (gl && gl !== 'none') {
    switch (gl) {
      case 'warm':
        ctx.fillStyle = 'rgba(255,155,50,0.18)';
        ctx.fillRect(0, 0, W, H);
        break;
      case 'golden': {
        const g = ctx.createLinearGradient(0, H, W, 0);
        g.addColorStop(0, 'rgba(210,70,0,0.30)');
        g.addColorStop(1, 'rgba(255,195,70,0.18)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case 'cool':
        ctx.fillStyle = 'rgba(75,115,220,0.18)';
        ctx.fillRect(0, 0, W, H);
        break;
      case 'night':
        ctx.fillStyle = 'rgba(8,12,65,0.50)';
        ctx.fillRect(0, 0, W, H);
        break;
      case 'overcast':
        ctx.fillStyle = 'rgba(155,162,178,0.22)';
        ctx.fillRect(0, 0, W, H);
        break;
      case 'dramatic': {
        const v = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, W*0.82);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.58)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, W, H);
        break;
      }
    }
  }

  // ── Lighting Direction ────────────────────────────────────────────────────
  // Each preset draws two passes:
  //   1. shadow — dark semi-transparent gradient from the shadow side
  //   2. highlight — subtle warm/bright gradient from the light side
  const dir = _compose?.globalLightingDir;
  if (dir && dir !== 'none') {
    // Helper: linear shadow gradient from one side
    const linShadow = (x1, y1, x2, y2, alpha) => {
      const s = ctx.createLinearGradient(x1, y1, x2, y2);
      s.addColorStop(0, `rgba(0,0,0,0)`);
      s.addColorStop(1, `rgba(0,0,0,${alpha})`);
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, W, H);
    };
    const linHighlight = (x1, y1, x2, y2, r, g, b, alpha) => {
      const h = ctx.createLinearGradient(x1, y1, x2, y2);
      h.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      h.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = h;
      ctx.fillRect(0, 0, W, H);
    };

    switch (dir) {
      case 'front': {
        // Soft vignette: slightly darker at edges, neutral centre
        const fr = ctx.createRadialGradient(W/2, H*0.45, H*0.1, W/2, H*0.45, W*0.75);
        fr.addColorStop(0, 'rgba(0,0,0,0)');
        fr.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = fr;
        ctx.fillRect(0, 0, W, H);
        // Subtle bright centre
        const fc = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H*0.4, W*0.45);
        fc.addColorStop(0, 'rgba(255,250,230,0.10)');
        fc.addColorStop(1, 'rgba(255,250,230,0)');
        ctx.fillStyle = fc;
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case 'three-quarter-left': {
        // Light from top-left; shadow on bottom-right
        linShadow(0, 0, W, H, 0.45);
        linHighlight(0, 0, W*0.6, H*0.6, 255, 245, 220, 0.18);
        break;
      }
      case 'left': {
        // Light from the left; strong shadow on right
        linShadow(0, 0, W, 0, 0.55);
        linHighlight(0, 0, W*0.55, 0, 255, 245, 215, 0.20);
        break;
      }
      case 'three-quarter-right': {
        // Light from top-right; shadow on bottom-left
        linShadow(W, 0, 0, H, 0.45);
        linHighlight(W, 0, W*0.4, H*0.6, 255, 245, 220, 0.18);
        break;
      }
      case 'right': {
        // Light from the right; strong shadow on left
        linShadow(W, 0, 0, 0, 0.55);
        linHighlight(W, 0, W*0.45, 0, 255, 245, 215, 0.20);
        break;
      }
      case 'backlight': {
        // Dark fill overall; bright rim glow at edges
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(0, 0, W, H);
        // Rim: bright at all edges, dark in centre
        const rim = ctx.createRadialGradient(W/2, H/2, H*0.22, W/2, H/2, W*0.72);
        rim.addColorStop(0, 'rgba(0,0,0,0)');
        rim.addColorStop(0.7, 'rgba(0,0,0,0)');
        rim.addColorStop(1, 'rgba(200,220,255,0.30)');
        ctx.fillStyle = rim;
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case 'top': {
        // Light from above; shadow at bottom
        linShadow(0, H, 0, 0, 0.52);
        linHighlight(0, 0, 0, H*0.5, 255, 250, 230, 0.18);
        break;
      }
      case 'under': {
        // Light from below; shadow at top
        linShadow(0, 0, 0, H, 0.52);
        linHighlight(0, H, 0, H*0.5, 255, 240, 200, 0.22);
        break;
      }
    }
  }

  ctx.restore();
}

// ── global contrast / saturation ─────────────────────────────────────────
function setComposeGlobalContrast(val) {
  if (!_compose) return;
  _compose.globalContrast = parseInt(val);
  document.getElementById('compose-contrast-val').textContent = val + '%';
  renderCompose(); saveComposeLayers();
}
function setComposeGlobalSaturation(val) {
  if (!_compose) return;
  _compose.globalSaturation = parseInt(val);
  document.getElementById('compose-saturation-val').textContent = val + '%';
  renderCompose(); saveComposeLayers();
}

// ── per-layer contrast / saturation ──────────────────────────────────────
function setComposeLayerContrast(val) {
  document.getElementById('compose-layer-contrast-val').textContent = val + '%';
  if (!_compose || _compose.selectedIdx < 0) return;
  _compose.layers[_compose.selectedIdx].contrast = parseInt(val);
  renderCompose(); saveComposeLayers();
}
function setComposeLayerSaturation(val) {
  document.getElementById('compose-layer-saturation-val').textContent = val + '%';
  if (!_compose || _compose.selectedIdx < 0) return;
  _compose.layers[_compose.selectedIdx].saturation = parseInt(val);
  renderCompose(); saveComposeLayers();
}

function flipComposeLayerH() {
  if (!_compose || _compose.selectedIdx < 0) return;
  const layer = _compose.layers[_compose.selectedIdx];
  if (!layer.imgEl) return;
  captureUndoState();
  // Redraw the layer image mirrored into an offscreen canvas, replace imgEl
  const off = document.createElement('canvas');
  off.width = layer.imgEl.naturalWidth; off.height = layer.imgEl.naturalHeight;
  const oc = off.getContext('2d');
  oc.translate(off.width, 0); oc.scale(-1, 1);
  oc.drawImage(layer.imgEl, 0, 0);
  const dataUrl = off.toDataURL('image/png');
  const newImg = new Image();
  newImg.onload = () => {
    _compose.layers[_compose.selectedIdx].imgEl = newImg;
    renderCompose(); saveComposeLayers();
  };
  newImg.src = dataUrl;
  // Also update imgUrl so it persists correctly
  layer.imgUrl = dataUrl;
}

// Add a URL to the current shot's image list and refresh the AI Generated Backgrounds panel
function addUrlToShotImages(url) {
  if (!url || !_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  if (!shot) return;
  if (!shot.images) shot.images = [];
  if (shot.images.includes(url)) return;
  shot.images.push(url);
  refreshShotBgThumbs();
  autoSave();
}

function refreshShotBgThumbs() {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  const shotImgs = shot?.images || [];
  const thumbs = document.getElementById('compose-shot-bg-thumbs');
  const empty = document.getElementById('compose-shot-bg-empty');
  if (!thumbs) return;
  if (shotImgs.length) {
    thumbs.innerHTML = shotImgs.map((url, i) => {
      const key = `shot-img-${i}`;
      return `<div class="compose-bg-card" style="position:relative" data-bg-key="${esc(key)}" onclick="selectComposeBg('${esc(key)}','${esc(url)}',null)">
        <img src="${esc(proxyUrl(url))}" crossorigin="anonymous">
        <span class="compose-bg-card-label">Image ${i + 1}</span>
        <button class="comp-thumb-delete" onclick="event.stopPropagation();removeShotBgImage('${esc(url)}')" title="Remove">✕</button>
      </div>`;
    }).join('');
    if (empty) empty.style.display = 'none';
  } else {
    thumbs.innerHTML = '';
    if (empty) empty.style.display = '';
  }
}

function removeShotBgImage(url) {
  if (!_compose) return;
  const shot = shots.find(s => s.id === _compose.shotId);
  if (!shot) return;
  shot.images = (shot.images || []).filter(u => u !== url);
  autoSave();
  refreshShotBgThumbs();
}

// ── run prompt on whole image ─────────────────────────────────────────────
async function applyComposePrompt() {
  const prompt = document.getElementById('compose-prompt-input')?.value.trim();
  if (!prompt || !_compose) return;
  const btn = document.getElementById('btn-apply-compose-prompt');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Applying…'; }
  try {
    captureUndoState();
    saveComposeVersion();
    const canvas = document.getElementById('compose-canvas');
    const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
    const uploaded = await apiFetch('/api/upload-reference', { base64: b64, mediaType: 'image/jpeg' });
    const data = await apiFetch('/api/generate-shot-images', { prompt, referenceImageUrls: [uploaded.url], stylePrompt: '' });
    const url = data.images?.[0];
    if (url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { _compose.bgImg = img; _compose.bgUrl = url; _compose.bgColor = null; renderCompose(); saveComposeLayers(); };
      img.src = proxyUrl(url);
      addImagesToLocation(_compose.locationId, [url]);
      addUrlToShotImages(url);
    }
  } catch(e) { showToast('Prompt failed: ' + e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '✦ Apply Prompt'; } }
}

// ── run prompt on individual layer ────────────────────────────────────────
async function applyLayerPrompt() {
  if (!_compose || _compose.selectedIdx < 0) return;
  const layer = _compose.layers[_compose.selectedIdx];
  const prompt = document.getElementById('compose-layer-prompt')?.value.trim();
  if (!prompt || !layer.imgUrl) { showToast('Select a layer and enter a prompt.', true); return; }
  captureUndoState();
  const btn = document.getElementById('btn-apply-layer-prompt');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
  try {
    // Generate the variant using the character variant endpoint (keeps character design)
    const genData = await apiFetch('/api/generate-char-variant', {
      prompt,
      referenceImageUrls: [layer.imgUrl],
      stylePrompt: getStylePrompt()
    });
    const rawUrl = genData.url;
    if (!rawUrl) throw new Error('No image returned');

    if (btn) btn.textContent = '⏳ Removing bg…';

    // Remove background so only the character is shown on the layer
    const bgData = await apiFetch('/api/remove-background', { imageUrl: rawUrl });
    const finalUrl = bgData.url || rawUrl;

    // Save as a new variation on the character if this layer has a charId
    const char = layer.charId ? characters.find(c => c.id === layer.charId) : null;
    if (char) {
      const angle = _selectedCompAngle || 'Front';
      const exprKey = prompt.toLowerCase().slice(0, 60);
      if (!char.expressionCache) char.expressionCache = {};
      if (!char.expressionCache[angle]) char.expressionCache[angle] = {};
      char.expressionCache[angle][exprKey] = finalUrl;
      if (!char.angles) char.angles = {};
      char.angles[`${angle} · ${prompt.slice(0, 40)}`] = { image: finalUrl, prompt, isVariant: true, baseAngle: angle };
      // Update main page angle sub-rows live
      const angleRow = document.getElementById(`char-angles-${char.id}`);
      if (angleRow) {
        const tbody = angleRow.querySelector('.char-angle-inner table tbody');
        if (tbody) tbody.innerHTML = charAngleRowsInnerHTML(char);
      }
    }

    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const h = COMPOSE_H * layer.scale;
      const w = h * (imgEl.naturalWidth / imgEl.naturalHeight);
      _compose.layers[_compose.selectedIdx] = { ..._compose.layers[_compose.selectedIdx], imgEl, imgUrl: finalUrl, w, h };
      updateComposeLayerPanel(); renderCompose(); saveComposeLayers();
    };
    imgEl.src = proxyUrl(finalUrl);
    autoSave();
    showToast('Layer updated.');
  } catch(e) { showToast('Layer prompt failed: ' + e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Apply Prompt to Layer'; } }
}

// ── image version history ─────────────────────────────────────────────────
function saveComposeVersion() {
  if (!_compose) return;
  const canvas = document.getElementById('compose-canvas');
  const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
  if (!_compose.history) _compose.history = [];
  const d = new Date();
  const label = `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  _compose.history.unshift({ dataUrl, label });
  if (_compose.history.length > 12) _compose.history.pop();
  renderComposeHistory();
  showToast('Version saved.');
}

function renderComposeHistory() {
  const list = document.getElementById('compose-history-list');
  if (!list || !_compose) return;
  if (!_compose.history?.length) { list.innerHTML = '<span style="font-size:11px;color:#333">No versions yet</span>'; return; }
  list.innerHTML = _compose.history.map((h, i) =>
    `<div class="compose-history-thumb" onclick="restoreComposeVersion(${i})">
      <img src="${h.dataUrl}" alt="v${i+1}">
      <div class="compose-history-info">${esc(h.label)}</div>
    </div>`
  ).join('');
}

function restoreComposeVersion(idx) {
  if (!_compose?.history?.[idx]) return;
  const img = new Image();
  img.onload = () => { _compose.bgImg = img; _compose.bgUrl = null; _compose.bgColor = null; _compose.bgKey = null; renderCompose(); saveComposeLayers(); };
  img.src = _compose.history[idx].dataUrl;
  document.querySelectorAll('#compose-loc-thumbs .compose-thumb').forEach(el => el.classList.remove('selected'));
}

// ── canvas mouse events ───────────────────────────────────────────────────
function composeCanvasCoords(e) {
  const canvas = document.getElementById('compose-canvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (COMPOSE_W / rect.width),
    y: (e.clientY - rect.top) * (COMPOSE_H / rect.height)
  };
}

let _composeResize = null;
let _bgDrag = null; // { startOx, startOy, startMx, startMy }

function getCornerHit(layer, x, y) {
  const HIT = 12;
  const corners = [
    { name: 'tl', hx: layer.cx - layer.w/2, hy: layer.cy - layer.h/2 },
    { name: 'tr', hx: layer.cx + layer.w/2, hy: layer.cy - layer.h/2 },
    { name: 'bl', hx: layer.cx - layer.w/2, hy: layer.cy + layer.h/2 },
    { name: 'br', hx: layer.cx + layer.w/2, hy: layer.cy + layer.h/2 },
  ];
  for (const c of corners) {
    if (Math.abs(x - c.hx) <= HIT && Math.abs(y - c.hy) <= HIT) return c;
  }
  return null;
}

document.getElementById('compose-canvas').addEventListener('mousedown', e => {
  if (!_compose) return;
  const { x, y } = composeCanvasCoords(e);
  if (_maskMode) {
    _maskPainting = true;
    _lastMaskX = null; _lastMaskY = null;
    paintMask(x, y);
    return;
  }
  captureUndoState();
  // Check corner handles on selected layer first
  if (_compose.selectedIdx >= 0) {
    const sel = _compose.layers[_compose.selectedIdx];
    if (sel && !sel.loading) {
      const corner = getCornerHit(sel, x, y);
      if (corner) {
        // Anchor = opposite corner
        const anchorX = corner.name.includes('l') ? sel.cx + sel.w/2 : sel.cx - sel.w/2;
        const anchorY = corner.name.includes('t') ? sel.cy + sel.h/2 : sel.cy - sel.h/2;
        const origDiag = Math.sqrt(sel.w * sel.w + sel.h * sel.h);
        _composeResize = { layerIdx: _compose.selectedIdx, anchorX, anchorY, origW: sel.w, origH: sel.h, origDiag };
        return;
      }
    }
  }
  // Hit test layers from top (reverse order)
  for (let i = _compose.layers.length - 1; i >= 0; i--) {
    const l = _compose.layers[i];
    if (l.loading) continue;
    if (x >= l.cx - l.w/2 && x <= l.cx + l.w/2 && y >= l.cy - l.h/2 && y <= l.cy + l.h/2) {
      _compose.selectedIdx = i;
      _compose.bgSelected = false;
      _composeDrag = { layerIdx: i, startCx: l.cx, startCy: l.cy, startMx: x, startMy: y };
      updateComposeLayerPanel();
      renderCompose();
      return;
    }
  }
  // Clicked empty space — select background (for scroll-zoom), start bg drag
  _compose.selectedIdx = -1;
  _compose.bgSelected = true;
  updateComposeLayerPanel();
  if (_compose.bgImg && !_compose.bgColor) {
    _bgDrag = { startOx: _compose.bgOffsetX ?? 0, startOy: _compose.bgOffsetY ?? 0, startMx: x, startMy: y };
  }
  renderCompose();
});

document.getElementById('compose-canvas').addEventListener('mousemove', e => {
  if (!_compose) return;
  const { x, y } = composeCanvasCoords(e);
  _maskCursorX = x; _maskCursorY = y;
  if (_maskMode) { if (_maskPainting) paintMask(x, y); else renderCompose(); return; }
});

document.addEventListener('mousemove', e => {
  if (!_compose) return;
  const { x, y } = composeCanvasCoords(e);
  if (_maskMode) return;
  if (_composeResize) {
    const layer = _compose.layers[_composeResize.layerIdx];
    if (!layer) return;
    const dx = x - _composeResize.anchorX;
    const dy = y - _composeResize.anchorY;
    const newDiag = Math.sqrt(dx * dx + dy * dy);
    const scale = Math.max(0.05, newDiag / _composeResize.origDiag);
    layer.w = _composeResize.origW * scale;
    layer.h = _composeResize.origH * scale;
    layer.cx = _composeResize.anchorX + (x > _composeResize.anchorX ? layer.w/2 : -layer.w/2);
    layer.cy = _composeResize.anchorY + (y > _composeResize.anchorY ? layer.h/2 : -layer.h/2);
    // Recompute scale for the slider
    layer.scale = layer.h / COMPOSE_H;
    const scaleSlider = document.getElementById('compose-scale-slider');
    const scaleVal = document.getElementById('compose-scale-val');
    if (scaleSlider) scaleSlider.value = Math.round(layer.scale * 100);
    if (scaleVal) scaleVal.textContent = Math.round(layer.scale * 100) + '%';
    renderCompose();
    return;
  }
  if (_composeDrag) {
    const layer = _compose.layers[_composeDrag.layerIdx];
    if (!layer) return;
    layer.cx = _composeDrag.startCx + (x - _composeDrag.startMx);
    layer.cy = _composeDrag.startCy + (y - _composeDrag.startMy);
    renderCompose();
  }
  if (_bgDrag) {
    _compose.bgOffsetX = _bgDrag.startOx + (x - _bgDrag.startMx);
    _compose.bgOffsetY = _bgDrag.startOy + (y - _bgDrag.startMy);
    syncBgPanZoomSliders();
    renderCompose();
  }
});

document.addEventListener('mouseup', () => {
  if (_maskPainting) { _maskPainting = false; _lastMaskX = null; _lastMaskY = null; return; }
  if (_composeDrag || _composeResize) saveComposeLayers();
  if (_bgDrag) saveComposeLayers();
  _composeDrag = null;
  _composeResize = null;
  _bgDrag = null;
});

document.getElementById('compose-canvas').addEventListener('mouseleave', () => {
  _maskCursorX = null; _maskCursorY = null;
  if (_maskMode) renderCompose();
});

// ── Background scroll-to-zoom ─────────────────────────────────────────────────
document.getElementById('compose-canvas').addEventListener('wheel', e => {
  if (!_compose) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.05 : 0.05;
  const sel = _compose.selectedIdx >= 0 ? _compose.layers[_compose.selectedIdx] : null;
  if (sel && !sel.loading) {
    // Resize selected character layer
    sel.scale = Math.max(0.05, sel.scale + delta);
    sel.h = COMPOSE_H * sel.scale;
    sel.w = sel.h * (sel.imgEl.naturalWidth / sel.imgEl.naturalHeight);
    const scaleSlider = document.getElementById('compose-scale-slider');
    const scaleVal = document.getElementById('compose-scale-val');
    const pct = Math.round(sel.scale * 100);
    if (scaleSlider) scaleSlider.value = pct;
    if (scaleVal) scaleVal.textContent = pct + '%';
  } else if (_compose.bgImg && !_compose.bgColor) {
    // Resize background
    _compose.bgScale = Math.max(0.1, Math.min(5, (_compose.bgScale ?? 1) + delta));
    syncBgPanZoomSliders();
  }
  renderCompose();
  saveComposeLayers();
}, { passive: false });

function syncBgPanZoomSliders() {
  if (!_compose) return;
  const ox = Math.round(_compose.bgOffsetX ?? 0);
  const oy = Math.round(_compose.bgOffsetY ?? 0);
  const zoom = Math.round((_compose.bgScale ?? 1) * 100);
  const sx = document.getElementById('bg-pan-x'); if (sx) sx.value = ox;
  const sxv = document.getElementById('bg-pan-x-val'); if (sxv) sxv.textContent = ox;
  const sy = document.getElementById('bg-pan-y'); if (sy) sy.value = oy;
  const syv = document.getElementById('bg-pan-y-val'); if (syv) syv.textContent = oy;
  const sz = document.getElementById('bg-zoom'); if (sz) sz.value = zoom;
  const zv = document.getElementById('bg-zoom-val'); if (zv) zv.textContent = zoom + '%';
}

// ── Undo system ──────────────────────────────────────────────────────────────
function captureUndoState() {
  if (!_compose) return;
  if (!_compose.undoStack) _compose.undoStack = [];
  const snap = {
    layers: _compose.layers.filter(l => !l.loading && l.imgUrl).map(l => ({
      imgUrl: l.imgUrl, label: l.label, charId: l.charId,
      cx: l.cx, cy: l.cy, scale: l.scale, w: l.w, h: l.h,
      opacity: l.opacity ?? 1, lighting: l.lighting || 'none', lightingIntensity: l.lightingIntensity ?? 0.6,
      contrast: l.contrast ?? 100, saturation: l.saturation ?? 100,
    })),
    bgUrl: _compose.bgUrl || null,
    bgColor: _compose.bgColor || null,
    bgKey: _compose.bgKey || null,
    globalLighting: _compose.globalLighting || 'none',
    globalLightingDir: _compose.globalLightingDir || 'none',
    globalContrast: _compose.globalContrast ?? 100,
    globalSaturation: _compose.globalSaturation ?? 100,
    bgSeparation: _compose.bgSeparation ?? 0,
    selectedIdx: _compose.selectedIdx,
  };
  _compose.undoStack.push(snap);
  if (_compose.undoStack.length > 30) _compose.undoStack.shift();
  updateUndoBtn();
}

async function undo() {
  if (!_compose?.undoStack?.length) return;
  const snap = _compose.undoStack.pop();
  updateUndoBtn();
  _compose.globalLighting = snap.globalLighting;
  _compose.globalLightingDir = snap.globalLightingDir;
  _compose.globalContrast = snap.globalContrast;
  _compose.globalSaturation = snap.globalSaturation;
  _compose.bgSeparation = snap.bgSeparation;
  _compose.bgColor = snap.bgColor;
  _compose.bgKey = snap.bgKey;
  _compose.selectedIdx = Math.max(-1, Math.min(snap.selectedIdx, snap.layers.length - 1));
  if (snap.bgColor) {
    _compose.bgImg = null; _compose.bgUrl = null;
  } else if (snap.bgUrl && snap.bgUrl !== _compose.bgUrl) {
    _compose.bgUrl = snap.bgUrl;
    const img = new Image(); img.crossOrigin = 'anonymous';
    await new Promise(res => { img.onload = () => { _compose.bgImg = img; res(); }; img.onerror = res; img.src = proxyUrl(snap.bgUrl); });
  } else if (!snap.bgUrl) {
    _compose.bgImg = null; _compose.bgUrl = null;
  }
  const restored = new Array(snap.layers.length).fill(null);
  await Promise.all(snap.layers.map((saved, i) => new Promise(res => {
    const imgEl = new Image(); imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => { restored[i] = { ...saved, imgEl, loading: false }; res(); };
    imgEl.onerror = () => { restored[i] = null; res(); };
    imgEl.src = proxyUrl(saved.imgUrl);
  })));
  _compose.layers = restored.filter(Boolean);
  syncComposeGlobalUI();
  updateComposeLayerPanel();
  renderCompose();
  saveComposeLayers();
}

function updateUndoBtn() {
  const btn = document.getElementById('btn-compose-undo');
  if (!btn) return;
  const n = _compose?.undoStack?.length || 0;
  btn.disabled = n === 0;
  btn.style.color = n > 0 ? '#aaa' : '#555';
  btn.title = n > 0 ? `Undo (${n} step${n !== 1 ? 's' : ''})` : 'Nothing to undo';
}

function syncComposeGlobalUI() {
  if (!_compose) return;
  const gc = _compose.globalContrast ?? 100;
  const gs = _compose.globalSaturation ?? 100;
  const sep = Math.round((_compose.bgSeparation ?? 0) * 100);
  const cs = document.getElementById('compose-contrast-slider');
  const ss = document.getElementById('compose-saturation-slider');
  const seps = document.getElementById('compose-separation-slider');
  const cv = document.getElementById('compose-contrast-val');
  const sv = document.getElementById('compose-saturation-val');
  const sepv = document.getElementById('compose-separation-val');
  if (cs) cs.value = gc; if (cv) cv.textContent = gc + '%';
  if (ss) ss.value = gs; if (sv) sv.textContent = gs + '%';
  if (seps) seps.value = sep; if (sepv) sepv.textContent = sep + '%';
  const glSel = document.getElementById('compose-global-lighting');
  const glDir = document.getElementById('compose-lighting-dir');
  if (glSel) glSel.value = _compose.globalLighting || 'none';
  if (glDir) glDir.value = _compose.globalLightingDir || 'none';
  const aiBtn = document.getElementById('btn-ai-relight');
  if (aiBtn) aiBtn.style.display = (_compose.globalLightingDir && _compose.globalLightingDir !== 'none') ? 'block' : 'none';
  markComposeBgSelected(_compose.bgKey || '');
  const swatch = document.getElementById('compose-color-swatch') || document.getElementById('compose-color-swatch-lg');
  const picker = document.getElementById('compose-bg-color-picker');
  if (swatch && _compose.bgColor) swatch.style.background = _compose.bgColor;
  if (picker && _compose.bgColor) picker.value = _compose.bgColor;
}

document.addEventListener('keydown', e => {
  if (!document.getElementById('compose-modal').classList.contains('open')) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    undo();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (_compose && _compose.selectedIdx >= 0) {
      _compose.selectedIdx = -1;
      updateComposeLayerPanel();
      renderCompose();
    }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    removeComposeLayer();
  }
});

// ── canvas drag-and-drop from character cards ─────────────────────────────
const _compCanvas = document.getElementById('compose-canvas');

// Cursor feedback for corner handles
_compCanvas.addEventListener('mousemove', e => {
  if (!_compose || _composeDrag || _composeResize) return;
  const { x, y } = composeCanvasCoords(e);
  if (_compose.selectedIdx >= 0) {
    const sel = _compose.layers[_compose.selectedIdx];
    if (sel && !sel.loading) {
      const corner = getCornerHit(sel, x, y);
      if (corner) {
        const cursors = { tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize' };
        _compCanvas.style.cursor = cursors[corner.name];
        return;
      }
    }
  }
  // Check if over any layer body
  for (let i = _compose.layers.length - 1; i >= 0; i--) {
    const l = _compose.layers[i];
    if (!l.loading && x >= l.cx-l.w/2 && x <= l.cx+l.w/2 && y >= l.cy-l.h/2 && y <= l.cy+l.h/2) {
      _compCanvas.style.cursor = 'move';
      return;
    }
  }
  _compCanvas.style.cursor = 'default';
});
_compCanvas.addEventListener('mouseleave', () => { _compCanvas.style.cursor = 'default'; });

_compCanvas.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
_compCanvas.addEventListener('drop', async e => {
  e.preventDefault();
  if (!_compose) return;

  const rect = _compCanvas.getBoundingClientRect();
  const dropPos = {
    cx: (e.clientX - rect.left) * (COMPOSE_W / rect.width),
    cy: (e.clientY - rect.top) * (COMPOSE_H / rect.height)
  };

  if (_compDragShotIdx !== null) {
    const idx = _compDragShotIdx;
    _compDragShotIdx = null;
    const shot = shots.find(s => s.id === _compose.shotId);
    const url = shot?.images?.[idx];
    if (!url) return;
    await addComposeLayerUrl(url, `Generated Image ${idx + 1}`, null, dropPos);
    return;
  }

  if (!_compDragCharId) return;
  const charId = _compDragCharId;
  _compDragCharId = null;

  const shot = shots.find(s => s.id === _compose.shotId);
  const char = characters.find(c => c.id === charId);
  if (!char) return;

  if (!shot.characterIds.includes(charId)) {
    shot.characterIds.push(charId);
    syncCharCheckbox(_compose.shotId, charId, true);
  }
  if (!shot.characterDetails) shot.characterDetails = {};
  if (!shot.characterDetails[charId]) shot.characterDetails[charId] = {};
  const det = shot.characterDetails[charId];
  const angle = det.facingDir || 'Front';
  const expr = (det.expression || '').trim();
  const imgUrl = getCompCharImage(char, angle, expr);
  if (!imgUrl) { showToast('No image — generate one first.', true); return; }

  await addComposeLayerUrl(imgUrl, char.name || 'Unnamed', charId, dropPos);
});

// ── save composite ────────────────────────────────────────────────────────
async function saveCompose() {
  if (!_compose) return;
  const canvas = document.getElementById('compose-canvas');
  const saveBtn = document.querySelector('#compose-modal .btn-save-compose');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner"></span>Saving…';

  // Render without selection outline for clean save
  const savedIdx = _compose.selectedIdx;
  _compose.selectedIdx = -1;
  renderCompose();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = dataUrl.split(',')[1];

  _compose.selectedIdx = savedIdx;
  renderCompose();

  try {
    const data = await apiFetch('/api/upload-reference', { base64, mediaType: 'image/jpeg' });
    const url = data.url;
    const shot = shots.find(s => s.id === _compose.shotId);
    if (shot) {
      shot.finalImage = url;
      const cell = document.getElementById(`final-img-${shot.id}`);
      if (cell) {
        const badge = cell.querySelector('.final-image-badge');
        if (badge) badge.remove();
        const locPreview = cell.querySelector('.final-image-loc-preview');
        if (locPreview) {
          const badgeEl = document.createElement('div');
          badgeEl.className = 'final-image-badge';
          badgeEl.textContent = '✎ Final';
          locPreview.appendChild(badgeEl);
          // Show final image as the preview
          let img = locPreview.querySelector('.final-image-preview');
          if (!img) { img = document.createElement('img'); img.className = 'final-image-preview'; locPreview.insertBefore(img, locPreview.firstChild); }
          img.src = url;
          const empty = locPreview.querySelector('.final-image-loc-empty');
          if (empty) empty.remove();
        }
      }
      autoSave();
    }
    showToast('Final image saved.');
    closeCompose();
  } catch(e) {
    showToast('Save failed: ' + e.message, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save as Final Image';
  }
}

// ── Persist on page unload ────────────────────────────────────────────────────
// Flush any pending debounce and synchronously write text data to localStorage
// so refreshing or closing the tab never loses unsaved changes.
// (IDB image writes are async and can't be guaranteed during unload — text is safe.)
window.addEventListener('pagehide', () => {
  if (!currentProjectId) return;
  clearTimeout(_saveTimer);
  syncFromDOM();
  const key = projectDataKey(currentProjectId);
  const { stripped } = extractImages(_buildPayload());
  try { localStorage.setItem(key, JSON.stringify(stripped)); } catch {}
});

// Also catch visibility change (tab switch, mobile background) as a belt-and-suspenders save
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && currentProjectId) {
    clearTimeout(_saveTimer);
    autoSave();
  }
});
