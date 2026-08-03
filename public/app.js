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
// When true: skip all local storage reads/writes; all data goes through Supabase; failures throw.
// Stored in localStorage under a dedicated key that is always read/written regardless of this setting.
let cloudOnlyMode = localStorage.getItem('sg-cloud-only') === '1';
const AUTO_VERSION_EVERY = 100;

let lastScriptText = null;
let lastScriptName = null;
let animatics = []; // { url, createdAt, label } newest-first

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

async function sbUpsertData(id, stripped, imgs, throwOnError = false) {
  const proj = projects.find(p => p.id === id);
  try {
    // Exclude scriptText from the DB row — it can be hundreds of KB and causes
    // statement timeouts on Supabase free tier (3-second limit). It stays in IndexedDB.
    const { scriptText, scriptName, ...strippedForDB } = stripped;
    const sb = getSB();

    // Store data as JSON files in Supabase Storage via server-issued signed URLs
    const uploadJson = async (storagePath, obj) => {
      const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
      const { signedUrl } = await apiFetch('/api/storage-upload-url', { path: storagePath });
      const r = await fetch(signedUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'application/json' } });
      if (!r.ok) throw new Error(`Storage PUT ${r.status}`);
    };
    await Promise.all([
      uploadJson(`projects/${id}/data.json`, strippedForDB),
      uploadJson(`projects/${id}/images.json`, stripBase64ForSync(imgs)),
    ]);

    // Update only lightweight metadata in the DB row
    const { error } = await sb.from('projects').upsert({
      id, name: proj?.name || 'Untitled', updated_at: Date.now(),
    }, { onConflict: 'id' });
    if (error) throw error;
  } catch(e) {
    console.warn('sb upsert data:', e.message, e);
    const isPaused = e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError');
    const msg = isPaused
      ? 'Cloud sync failed — Supabase project may be paused. Visit supabase.com/dashboard to restore it.'
      : `Cloud sync failed (${e.message || 'unknown error'})${throwOnError ? '' : ' — data saved locally only.'}.`;
    showToast(msg, true);
    if (throwOnError) throw e;
  }
}

// stripBase64ForSync now lives in lib/versioning.js (loaded before this script).

const _snapQueueKey = (id) => `sg-snap-queue-${id}`;

async function sbSaveSnapshot(projectId, label, isAuto, stripped, imgs) {
  const strippedImgs = stripBase64ForSync(imgs);
  try {
    await apiFetch('/api/snapshots', {
      projectId, label: label || null, auto: isAuto, data: stripped, images: strippedImgs
    });
  } catch(e) {
    console.warn('snapshot save failed:', e.message);
    showToast('Version checkpoint couldn\'t reach the server — queued for retry on next load.', true);
    try {
      const key = _snapQueueKey(projectId);
      const queue = JSON.parse(localStorage.getItem(key) || '[]');
      queue.push({ label, isAuto, data: stripped, images: strippedImgs, queuedAt: Date.now() });
      while (queue.length > 5) queue.shift(); // cap to avoid quota issues
      localStorage.setItem(key, JSON.stringify(queue));
    } catch(qe) { console.warn('snapshot queue store failed:', qe.message); }
  }
}

async function flushSnapshotQueue(projectId) {
  if (!projectId) return;
  try {
    const key = _snapQueueKey(projectId);
    const queue = JSON.parse(localStorage.getItem(key) || '[]');
    if (!queue.length) return;
    const remaining = [];
    for (const item of queue) {
      try {
        await apiFetch('/api/snapshots', { projectId, label: item.label || null, auto: item.isAuto, data: item.data, images: item.images });
      } catch(e) { remaining.push(item); }
    }
    if (remaining.length) localStorage.setItem(key, JSON.stringify(remaining));
    else localStorage.removeItem(key);
    if (remaining.length < queue.length) showToast(`Flushed ${queue.length - remaining.length} queued version checkpoint(s).`);
  } catch(e) { console.warn('snapshot queue flush failed:', e.message); }
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
    // Route through server so service key is used — avoids bucket-policy issues with anon key
    const result = await apiFetch(`/api/project/${id}/data`, null, 'GET');
    return result || null;
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
async function idbDelete(key) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('images', 'readwrite');
    tx.objectStore('images').delete(key);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
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

// extractImages, mergeImages, mergeLocalIntoSbImages now live in lib/versioning.js.

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
  return `<div style="display:flex;align-items:center;gap:8px;border-left:1px solid #222;padding-left:12px;margin-left:4px;flex-shrink:0;">
    <span class="user-email-label" style="font-size:12px;color:#555;">${esc(_authUser.email)}</span>
    <a href="/auth/logout" class="btn-sign-out" style="font-size:12px;color:#444;text-decoration:none;border:1px solid #222;border-radius:5px;padding:5px 10px;white-space:nowrap;flex-shrink:0;transition:all 0.15s;" onmouseover="this.style.color='#aaa';this.style.borderColor='#444'" onmouseout="this.style.color='#444';this.style.borderColor='#222'">Sign out</a>
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
<button id="btn-open-kb" onclick="openKb()" style="background:none;border:1px solid #2a2a2a;border-radius:6px;color:#666;font-size:12px;padding:7px 12px;cursor:pointer;position:relative">Docs &amp; Tests<span id="kb-nav-dot" style="display:none;position:absolute;top:4px;right:4px;width:6px;height:6px;background:#818cf8;border-radius:50%;pointer-events:none"></span></button>
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
    <div id="version-ui-mobile" class="version-bar-mobile"></div>
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

    if (cloudOnlyMode && currentProjectId) {
      // Cloud-only: fetch exclusively from Supabase, throw on failure
      const sbRow = await sbGetData(currentProjectId);
      if (!sbRow?.data) throw new Error('Failed to load project data from cloud. Check your connection and try again.');
      saved = JSON.stringify(sbRow.data);
      imgs = sbRow.images || {};
    } else {
      // Read local data as baseline before touching Supabase
      const localSaved = localStorage.getItem(key);
      let localImgs = null;
      try { localImgs = await idbGet(key); } catch {}
      const localCharCount = (() => { try { return JSON.parse(localSaved)?.characters?.length || 0; } catch { return 0; } })();

      // Try Supabase — prefer whichever source is newer (by savedAt), but never replace local data with less data
      if (currentProjectId) {
        const sbRow = await sbGetData(currentProjectId);
        const sbCharCount = sbRow?.data?.characters?.length || 0;
        if (sbRow?.data && (sbCharCount > 0 || localCharCount === 0)) {
          const sbSavedAt = sbRow.data.savedAt || 0;
          const localSavedAt = (() => { try { return JSON.parse(localSaved)?.savedAt || 0; } catch { return 0; } })();
          // Use local if it's strictly newer than Supabase (pending cloud sync not yet uploaded)
          if (localSavedAt > sbSavedAt && localCharCount > 0) {
            saved = localSaved;
            imgs = localImgs;
            // Re-push to Supabase now so other devices get the latest data
            const { stripped: s2, imgs: i2 } = _buildPayloadFromSaved(JSON.parse(localSaved), localImgs);
            sbUpsertData(currentProjectId, s2, i2);
          } else {
            saved = JSON.stringify(sbRow.data);
            imgs = sbRow.images || {};
            try { localStorage.setItem(key, saved); } catch {}
            try { await idbSet(key, imgs); } catch {}
          }
        }
      }

      // Fall back to local if Supabase unavailable or had less data
      if (!saved) {
        saved = localSaved;
        imgs = localImgs;
      }
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
      if (Array.isArray(d.animatics)) animatics = d.animatics;
      // Restore version context from Supabase on devices that have no localStorage version history
      if (!versions.length) {
        if (d.currentVersionLabel) currentVersionLabel = d.currentVersionLabel;
        if (Array.isArray(d.versionIndex) && d.versionIndex.length > 0) {
          versions = d.versionIndex.map(v => ({ label: v.label, timestamp: v.timestamp, auto: v.auto || false, data: null }));
          editsSinceVersion = 0;
        }
      }
    }
  } catch {}
  // If still no version history after parsing local/Supabase data, fetch snapshot list directly
  if (!versions.length && currentProjectId) {
    try {
      const snapshots = await sbGetSnapshots(currentProjectId);
      if (snapshots.length > 0) {
        const sorted = [...snapshots].sort((a, b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
        versions = sorted.map(s => ({ label: s.label, timestamp: s.created_at ? new Date(s.created_at).getTime() : 0, auto: s.auto || false, data: null }));
        if (!currentVersionLabel && sorted.length > 0) currentVersionLabel = sorted[0].label;
        editsSinceVersion = 0;
      }
    } catch(e) {}
  }
  if (!characters.length) characters = [newCharacter()];
  if (!locations.length) locations = [newLocation()];
  // Remove legacy global script key
  localStorage.removeItem('character-generator-script');
  applyStyleUI();
  renderScriptPreview();
  renderCharacters();
  renderLocations();
  renderShots();
  renderAnimaticHistory();
  renderVersionUI();
  restoreAudio();
  prefetchCharBgRemovals();
  migrateRefImages();
  flushSnapshotQueue(currentProjectId);
}

// Migrate any non-Supabase images (fal.media URLs or base64 data URIs) to Supabase Storage
async function migrateRefImages() {
  const isFal = url => typeof url === 'string' && (url.includes('fal.media') || url.includes('fal.run'));
  const isBase64 = url => typeof url === 'string' && url.startsWith('data:image');
  const needsMigration = url => isFal(url) || isBase64(url);

  // Count total images needing migration
  const collectUrls = () => {
    const urls = [];
    for (const c of characters) {
      const ref = c.referenceImage;
      const src = ref?.url || (ref?.dataUrl && !isBase64(ref.dataUrl) ? ref.dataUrl : ref?.dataUrl);
      if (src && needsMigration(src)) urls.push(1);
      for (const u of (c.images || [])) if (needsMigration(u)) urls.push(1);
    }
    for (const l of locations) {
      const ref = l.referenceImage;
      const src = ref?.url || (ref?.dataUrl && !isBase64(ref.dataUrl) ? ref.dataUrl : ref?.dataUrl);
      if (src && needsMigration(src)) urls.push(1);
      for (const u of (l.images || [])) if (needsMigration(u)) urls.push(1);
    }
    for (const s of shots) {
      for (const u of (s.images || [])) if (needsMigration(u)) urls.push(1);
      if (needsMigration(s.finalImage)) urls.push(1);
      if (needsMigration(s.refImage?.dataUrl)) urls.push(1);
      if (needsMigration(s.composeMeta?.bgUrl)) urls.push(1);
    }
    return urls.length;
  };

  const total = collectUrls();
  if (total === 0) return;

  let done = 0;
  let changed = false;

  // Progress banner
  let banner = document.getElementById('migrate-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'migrate-banner';
    banner.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:10px 18px;font-size:12px;color:#aaa;z-index:9999;display:flex;align-items:center;gap:10px;min-width:240px;box-shadow:0 4px 16px rgba(0,0,0,0.5)';
    document.body.appendChild(banner);
  }
  const updateBanner = () => {
    banner.innerHTML = `<span style="color:#4ade80">↑</span> Uploading images to cloud: <b style="color:#e8e8e8">${done}/${total}</b>`;
  };
  updateBanner();

  const uploadUrl = async (url, entityType, entityId) => {
    try {
      let r;
      if (isBase64(url)) {
        const [meta, b64] = url.split(',');
        const mediaType = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
        r = await apiFetch('/api/upload-reference', { base64: b64, mediaType, projectId: currentProjectId, entityType, entityId });
      } else {
        r = await apiFetch('/api/reupload-ref', { url, projectId: currentProjectId, entityType, entityId });
      }
      if (r.url) { changed = true; done++; updateBanner(); return r.url; }
    } catch (e) { console.warn('migrate failed', entityType, entityId, e); }
    return url;
  };

  const migrateRef = async (entity, entityType) => {
    const ref = entity.referenceImage;
    if (!ref) return;
    const src = ref.url && needsMigration(ref.url) ? ref.url : (needsMigration(ref.dataUrl) ? ref.dataUrl : null);
    if (!src) return;
    const newUrl = await uploadUrl(src, entityType, entity.id);
    if (newUrl !== src) entity.referenceImage = { ...ref, url: newUrl, dataUrl: newUrl, base64: null };
  };

  const migrateImageArr = async (entity, entityType) => {
    if (!entity.images?.length) return;
    entity.images = await Promise.all(entity.images.map(u => needsMigration(u) ? uploadUrl(u, entityType, entity.id) : u));
  };

  const migrateRefImages = async (entity, entityType) => {
    if (!entity.refImages?.length) return;
    entity.refImages = await Promise.all(entity.refImages.map(async ref => {
      const src = ref.url && needsMigration(ref.url) ? ref.url : (needsMigration(ref.dataUrl) ? ref.dataUrl : null);
      if (!src) return ref;
      const newUrl = await uploadUrl(src, entityType, entity.id);
      return newUrl !== src ? { ...ref, url: newUrl, dataUrl: newUrl, base64: null } : ref;
    }));
  };

  for (const c of characters) {
    await migrateRef(c, 'chars'); await migrateImageArr(c, 'chars'); await migrateRefImages(c, 'chars');
    for (const [k, v] of Object.entries(c.angles || {})) {
      const src = v.refImage?.dataUrl && needsMigration(v.refImage.dataUrl) ? v.refImage.dataUrl : null;
      if (src) { const u = await uploadUrl(src, 'chars', c.id); if (u !== src) { v.refImage = { ...v.refImage, url: u, dataUrl: u, base64: null }; changed = true; } }
    }
  }
  for (const l of locations) {
    await migrateRef(l, 'locs'); await migrateImageArr(l, 'locs');
    for (const [k, v] of Object.entries(l.shotAngles || {})) {
      const src = v.refImage?.dataUrl && needsMigration(v.refImage.dataUrl) ? v.refImage.dataUrl : null;
      if (src) { const u = await uploadUrl(src, 'locs', l.id); if (u !== src) { v.refImage = { ...v.refImage, url: u, dataUrl: u, base64: null }; changed = true; } }
    }
    for (const cv of (l.customViews || [])) {
      const src = cv.refImage?.dataUrl && needsMigration(cv.refImage.dataUrl) ? cv.refImage.dataUrl : null;
      if (src) { const u = await uploadUrl(src, 'locs', l.id); if (u !== src) { cv.refImage = { ...cv.refImage, url: u, dataUrl: u, base64: null }; changed = true; } }
    }
  }
  for (const s of shots) {
    s.images = await Promise.all((s.images || []).map(u => needsMigration(u) ? uploadUrl(u, 'shots', s.id) : u));
    if (needsMigration(s.finalImage)) s.finalImage = await uploadUrl(s.finalImage, 'shots', s.id);
    if (needsMigration(s.refImage?.dataUrl)) { const u = await uploadUrl(s.refImage.dataUrl, 'shots', s.id); s.refImage = { ...s.refImage, dataUrl: u }; }
    if (needsMigration(s.composeMeta?.bgUrl)) { const u = await uploadUrl(s.composeMeta.bgUrl, 'shots', s.id); s.composeMeta = { ...s.composeMeta, bgUrl: u }; }
  }

  banner.innerHTML = `<span style="color:#4ade80">✓</span> <b style="color:#e8e8e8">${done}</b> images uploaded to cloud`;
  setTimeout(() => banner.remove(), 3000);

  if (changed) { renderCharacters(); renderLocations(); renderShots(); autoSave(); }
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
  const versionIndex = versions.map(v => ({ label: v.label, timestamp: v.timestamp, auto: v.auto || false }));
  return { characters, locations, shots, visualStyles, selectedStyleId, charGenRules, locationGenRules, charBoilerplate: CHAR_BOILERPLATE, scriptText: lastScriptText || null, scriptName: lastScriptName || null, animatics: animatics || [], currentVersionLabel: currentVersionLabel || null, versionIndex: versionIndex, savedAt: Date.now() };
}

async function _persistData(key) {
  const { stripped, imgs } = extractImages(_buildPayload());
  const hasContent = characters.length > 0 || locations.length > 0 || shots.length > 0;

  if (cloudOnlyMode) {
    // Cloud-only: write directly to Supabase, throw on failure
    if (!currentProjectId || !hasContent) return;
    await sbUpsertData(currentProjectId, stripped, imgs, true /* throwOnError */);
    const now = Date.now();
    if (now - _lastAutoSnapshotTime > 10 * 60 * 1000) {
      _lastAutoSnapshotTime = now;
      await sbSaveSnapshot(currentProjectId, null, true, stripped, imgs);
    }
    return;
  }

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
  // Sync to Supabase (fire and forget)
  if (currentProjectId && hasContent) {
    sbUpsertData(currentProjectId, stripped, imgs);
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
  if (cloudOnlyMode) return; // versions fetched from Supabase snapshots in cloud-only mode
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
  if (cloudOnlyMode) return; // versions fetched from Supabase snapshots in loadData
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

// stripImagesForVersion now lives in lib/versioning.js.

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
    data: stripImagesForVersion({ characters, locations, shots, visualStyles, selectedStyleId, charGenRules, locationGenRules, charBoilerplate: CHAR_BOILERPLATE, animatics }),
    timestamp: Date.now(),
    auto: isAuto
  });
  currentVersionLabel = label;
  editsSinceVersion = 0;
  saveVersionMeta();
  renderVersionUI();
  // Save ALL versions (auto and named) to Supabase snapshots for cross-device access
  if (currentProjectId) {
    const { stripped, imgs } = extractImages(_buildPayload());
    sbSaveSnapshot(currentProjectId, label, isAuto, stripped, imgs);
    if (!isAuto) {
      const btn = document.getElementById('btn-new-version');
      if (btn) { btn.classList.add('saved-flash'); setTimeout(() => btn.classList.remove('saved-flash'), 1500); }
    }
  }
}

async function loadVersion(label) {
  if (!label) return;
  const v = versions.find(v => v.label === label);
  if (!v) return;
  // Snapshot audio for the version being left (so it can be restored if the user returns to it)
  if (currentVersionLabel) {
    await _snapshotCurrentAudio();
  }
  let d = v.data;
  // If data isn't in memory (cross-device stub with data: null), fetch from Supabase snapshots
  if (!d && currentProjectId) {
    showToast('Loading version from cloud…');
    const snapshots = await sbGetSnapshots(currentProjectId);
    const snap = snapshots.find(s => s.label === label);
    if (!snap) {
      showToast('Version not available — save on original device first to sync it.', true);
      return;
    }
    const restored = await sbRestoreSnapshot(snap.id, currentProjectId);
    if (!restored?.data) {
      showToast('Failed to load version from cloud.', true);
      return;
    }
    v.data = restored.data;
    d = restored.data;
  }
  if (!d) { showToast('Version data unavailable.', true); return; }
  // Restore versioned state. Versions now store all fields including Supabase URLs.
  // Only fall back to current in-memory data for base64/blob content not stored in versions.
  const prevChars = characters; const prevLocs = locations; const prevShots = shots;
  characters = (d.characters || []).map(vc => {
    const cur = prevChars.find(c => c.id === vc.id) || {};
    // Merge refImages: version has {id, url}; current may have richer base64/mediaType data
    const refImages = (vc.refImages || []).map(vr => {
      const cr = (cur.refImages || []).find(r => r.id === vr.id);
      return cr ? { ...cr, ...vr } : vr;
    });
    // Merge angles: seed from current (preserves any added after this version), override with version data
    const angles = { ...(cur.angles || {}) };
    for (const [k, va] of Object.entries(vc.angles || {})) {
      const ca = cur.angles?.[k] || {};
      angles[k] = { ...ca, ...va, image: va.image || ca.image || null };
    }
    return { ...newCharacter(), images: cur.images || [], referenceImage: cur.referenceImage || null, ...vc, refImages, angles };
  });
  locations = (d.locations || []).map(vl => {
    const cur = prevLocs.find(l => l.id === vl.id) || {};
    // Seed from current so angles added after this version aren't lost, then overlay version data
    const mergedAngles = { ...(cur.shotAngles || {}) };
    for (const [k, va] of Object.entries(vl.shotAngles || {})) {
      const ca = cur.shotAngles?.[k] || {};
      mergedAngles[k] = { ...ca, ...va, image: va.image || ca.image || null };
    }
    // Merge customViews: keep views from current not in version, overlay version data for shared ones
    const customViewsMap = {};
    for (const ccv of (cur.customViews || [])) customViewsMap[ccv.id] = ccv;
    const mergedCustomViews = [...(vl.customViews || []).map(vcv => {
      const ccv = customViewsMap[vcv.id] || {};
      delete customViewsMap[vcv.id];
      return { ...ccv, ...vcv, image: vcv.image || ccv.image || null, refImage: ccv.refImage || null };
    }), ...Object.values(customViewsMap)];
    return { ...newLocation(), images: cur.images || [], referenceImage: cur.referenceImage || null, ...vl, shotAngles: mergedAngles, customViews: mergedCustomViews };
  });
  shots = (d.shots || []).map(vs => {
    const cur = prevShots.find(s => s.id === vs.id) || {};
    return { ...newShot(), images: cur.images || [], ...vs,
      finalImage: vs.finalImage || cur.finalImage || null,
      videoUrl: vs.videoUrl || cur.videoUrl || '',
      motionVideoUrl: vs.motionVideoUrl || cur.motionVideoUrl || '',
      motionDuration: vs.motionDuration ?? cur.motionDuration ?? null,
      motionConfig: vs.motionConfig || cur.motionConfig || null,
      refImage: cur.refImage || null,
      composeMeta: vs.composeMeta || cur.composeMeta || null,
      composeLayers: vs.composeLayers || cur.composeLayers || null,
    };
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
  // Animatics are project-level, not version-level — never overwrite from a version snapshot.
  // (Version snapshots may have empty or stale animatics arrays from before this was tracked.)
  // Restore script for this version (may be null for versions created before this was tracked)
  lastScriptText = d.scriptText || null;
  lastScriptName = d.scriptName || null;
  // Restore audio for this version from IDB (keyed by version label)
  _restoreVersionAudio(label);
  currentVersionLabel = label;
  editsSinceVersion = 0;
  saveVersionMeta();
  applyStyleUI();
  renderVisualStyles();
  renderCharacters();
  renderLocations();
  renderShots();
  renderAnimaticHistory();
  renderScriptPreview();
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
  const mob = document.getElementById('version-ui-mobile');
  if (!el && !mob) return;
  const sorted = (Array.isArray(versions) ? [...versions] : []).sort((a, b) => b.timestamp - a.timestamp);
  const selectHTML = versions.length > 0 ? `
    <select class="version-select" onchange="loadVersion(this.value)">
      <option value="">version history…</option>
      ${sorted.map(v => `<option value="${v.label}" ${v.label === currentVersionLabel ? 'selected' : ''}>v${v.label}${v.auto ? ' ⟳' : ''} · ${timeAgo(v.timestamp)}</option>`).join('')}
    </select>
  ` : '';
  const fullHTML = `
    ${selectHTML}
    <button id="btn-new-version" class="btn-new-version" onclick="createVersion()">+ New Version</button>
    <button class="btn-cloud-restore" onclick="openCloudRestore()" title="Restore from cloud backup">☁ Restore</button>
    <button class="btn-cloud-restore" onclick="forceLoadFromCloud()" title="Discard local data and reload current state from cloud">↓ Cloud</button>
    ${currentVersionLabel ? `<span class="version-badge">v${currentVersionLabel}</span>` : ''}
    <span id="version-edit-count" class="version-edit-count">${editsSinceVersion > 0 ? `${editsSinceVersion}/${AUTO_VERSION_EVERY}` : ''}</span>
  `;
  if (el) el.innerHTML = fullHTML;
  if (mob) mob.innerHTML = `
    ${selectHTML}
    <button class="btn-new-version" onclick="createVersion()">+ Version</button>
    ${currentVersionLabel ? `<span class="version-badge">v${currentVersionLabel}</span>` : ''}
    <button onclick="forceLoadFromCloud()" title="Discard local data and reload from cloud" style="background:none;border:1px solid #2a2a2a;border-radius:5px;color:#555;font-size:11px;padding:4px 8px;cursor:pointer;white-space:nowrap;flex-shrink:0;">↓ Cloud</button>
  `;
}

function setCloudOnlyMode(enabled) {
  cloudOnlyMode = enabled;
  if (enabled) {
    localStorage.setItem('sg-cloud-only', '1');
  } else {
    localStorage.removeItem('sg-cloud-only');
  }
  showToast(enabled ? 'Cloud-only mode on — local cache disabled.' : 'Cloud-only mode off — local caching enabled.');
}

function initCloudOnlyToggle() {
  const el = document.getElementById('cloud-only-toggle');
  if (el) el.checked = cloudOnlyMode;
}

async function forceLoadFromCloud() {
  if (!currentProjectId) return;
  if (!confirm('Discard local data and load the latest version from cloud? This cannot be undone.')) return;
  const key = projectDataKey(currentProjectId);
  const vKey = projectVersionsKey(currentProjectId);
  localStorage.removeItem(key);
  localStorage.removeItem(vKey);
  try { await idbDelete(key); } catch {}
  versions = [];
  currentVersionLabel = null;
  editsSinceVersion = 0;
  showToast('Loading from cloud…');
  await loadData();
  renderVersionUI();
  showToast('Loaded latest version from cloud.');
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
    const mdVal = row.querySelector('.field-motion-duration')?.value?.trim();
    shot.motionDuration = mdVal ? (parseFloat(mdVal) || null) : null;
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

// ── Knowledge Base (unified Docs + Tests modal) ──────────────────────────────
// ── KB changelog — update dates + entries whenever tab content changes ────────
// Entries are newest-first. Badge shows if newest entry is within 3 days AND
// the user hasn't seen that version yet (tracked via localStorage date string).
const _KB_CHANGELOG = {
  spec: [
    { date: '2026-08-01', type: 'updated',
      summary: 'Motion video clarified (motionVideoUrl takes priority over videoUrl). Animatics explicitly marked as project-level. Music piece mode expanded with bar-detection algorithm detail.',
      prev: 'Motion video had a single type. Animatics were not explicitly documented as project-level.' },
  ],
  arch: [
    { date: '2026-08-01', type: 'updated',
      summary: 'Added rule: update spec.md and TESTING.md with every code commit/push. Docs & Tests modal consolidated into a single KB modal with 4 tabs.',
      prev: 'No explicit rule about keeping docs current with commits. Docs and Tests were separate modals.' },
  ],
  unit: [
    { date: '2026-08-01', type: 'new',
      summary: 'Added 40+ unit/API tests: parse-script, parse-characters, parse-locations, generate-shot-sequence, generate-shot-prompts, fuzzy-match-timestamp, transcribe-audio, snapshots, project-data, storage-upload-url.',
      prev: null },
  ],
  ui: [
    { date: '2026-08-01', type: 'new',
      summary: 'Added 36 Playwright e2e tests across 8 spec files: Projects, Characters, Locations, Shot Sequence, Versions, Animatic, Configuration, and KB modal. Run via ▶ Run E2E Tests button.',
      prev: null },
  ],
};

// spec section slug → { ui: [section labels], unit: [file fragments] }
const _SPEC_SECTION_TESTS = {
  'projects':           { ui: ['Project Management', 'Authentication'], unit: [] },
  'versioning':         { ui: ['Versions'], unit: ['versioning', 'snapshots'] },
  'configuration-tab':  { ui: ['Configuration & Cloud', 'Audio & Transcript'], unit: ['transcribe-audio', 'parse-script'] },
  'characters':         { ui: ['Characters'], unit: ['generate-prompt', 'parse-characters'] },
  'locations':          { ui: ['Locations'], unit: ['parse-locations'] },
  'shot-sequence':      { ui: ['Shot Sequence', 'Image Editor (Compose)'], unit: ['generate-shot-prompts', 'generate-shot-sequence', 'fuzzy-match-timestamp'] },
  'animatic':           { ui: ['Animatic'], unit: [] },
  'cloud-sync':         { ui: ['Configuration & Cloud'], unit: ['project-data', 'storage-upload-url', 'snapshots'] },
};

// test file fragment → spec section slug (for unit test rows)
const _FILE_TO_SPEC = {
  'versioning':           'versioning',
  'generate-prompt':      'characters',
  'parse-characters':     'characters',
  'parse-locations':      'locations',
  'generate-shot-sequence': 'shot-sequence',
  'generate-shot-prompts':  'shot-sequence',
  'fuzzy-match-timestamp':  'shot-sequence',
  'transcribe-audio':     'configuration-tab',
  'snapshots':            'versioning',
  'project-data':         'cloud-sync',
  'storage-upload-url':   'cloud-sync',
  'parse-script':         'configuration-tab',
};

// UI test section label → spec section slug
const _UI_SECTION_TO_SPEC = {
  'Authentication':         'projects',
  'Project Management':     'projects',
  'Characters':             'characters',
  'Locations':              'locations',
  'Shot Sequence':          'shot-sequence',
  'Audio & Transcript':     'configuration-tab',
  'Image Editor (Compose)': 'shot-sequence',
  'Versions':               'versioning',
  'Animatic':               'animatic',
  'Configuration & Cloud':  'configuration-tab',
};

let _kbCache = {};
let _kbActiveTab = 'spec';
let _kbSpecFilter = null; // slug of spec section currently highlighted

function _specSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function _kbSeenKey(tab) { return 'sg-kb-seen2-' + tab; }

function _kbTabHasNew(tab) {
  const entries = _KB_CHANGELOG[tab];
  if (!entries?.length) return null;
  const latest = entries[0];
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  if (Date.now() - new Date(latest.date).getTime() > THREE_DAYS) return null;
  const seen = localStorage.getItem(_kbSeenKey(tab));
  if (seen && seen >= latest.date) return null;
  return latest;
}

function _kbApplyBadges() {
  let anyNew = false;
  for (const tab of ['spec', 'arch', 'unit', 'ui']) {
    const entry = _kbTabHasNew(tab);
    const btn = document.getElementById('kb-tab-' + tab);
    if (!btn) continue;
    btn.querySelector('.kb-new-badge')?.remove();
    if (entry) {
      anyNew = true;
      const label = entry.type === 'new' ? 'NEW' : 'UPDATED';
      btn.insertAdjacentHTML('beforeend',
        `<span class="kb-new-badge" onclick="event.stopPropagation();_showKbChangelog('${tab}',this)" style="cursor:pointer" title="Click to see what changed">${label}</span>`);
    }
  }
  const dot = document.getElementById('kb-nav-dot');
  if (dot) dot.style.display = anyNew ? '' : 'none';
}

function _showKbChangelog(tab, badgeEl) {
  document.getElementById('kb-changelog-popover')?.remove();
  const entry = _kbTabHasNew(tab);
  if (!entry) return;
  const pop = document.createElement('div');
  pop.id = 'kb-changelog-popover';
  pop.style.cssText = 'position:fixed;z-index:10000;background:#161616;border:1px solid #2a2a2a;border-radius:8px;padding:14px 16px;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,0.7);font-size:12px;color:#aaa;line-height:1.6';
  pop.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:11px;font-weight:600;color:#818cf8;text-transform:uppercase;letter-spacing:.05em">${entry.type === 'new' ? 'New' : 'Updated'} · ${entry.date}</span>
      <button onclick="document.getElementById('kb-changelog-popover')?.remove()" style="background:none;border:none;color:#555;font-size:16px;cursor:pointer;padding:0 0 0 12px;line-height:1">✕</button>
    </div>
    <p style="margin:0 0 8px;color:#ccc">${esc(entry.summary)}</p>
    ${entry.prev ? `<div style="border-top:1px solid #222;margin-top:8px;padding-top:8px"><span style="font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.04em">Previously</span><p style="margin:4px 0 0;color:#666;font-size:11px">${esc(entry.prev)}</p></div>` : ''}
  `;
  document.body.appendChild(pop);
  // Position near badge
  const rect = badgeEl.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - 400);
  pop.style.top = (rect.bottom + 8) + 'px';
  pop.style.left = Math.max(8, left) + 'px';
  // Close on outside click
  setTimeout(() => document.addEventListener('click', function h(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', h); }
  }), 0);
}

function _stripTestingWhatsCorvered(md) {
  return md.replace(/\n## What's Covered[\s\S]*?(?=\n## |\n---\s*\n## |\s*$)/, '');
}

async function _kbFetchContent(tab) {
  if (tab === 'spec') {
    const md = await fetch('/spec.md').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    return { html: _renderMd(md, true) };
  }
  if (tab === 'arch') {
    const [claudeMd, testingMd] = await Promise.all([
      fetch('/CLAUDE.md').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
      fetch('/TESTING.md').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    ]);
    const combined = claudeMd + '\n\n---\n\n## Testing Guide\n\n' + _stripTestingWhatsCorvered(testingMd);
    return { html: _renderMd(combined, false) };
  }
  if (tab === 'unit') {
    const html = await _kbBuildUnitHtml();
    return { html };
  }
  if (tab === 'ui') {
    return { html: _renderUiTestCases() };
  }
  throw new Error('unknown tab: ' + tab);
}

async function _kbBuildUnitHtml() {
  try {
    const data = await fetch('/api/test-results').then(r => r.json());
    return _renderTestResults(data);
  } catch (_) {
    return _renderTestResults(null);
  }
}

function _kbSpecFilterBar() {
  if (!_kbSpecFilter) return '';
  const sections = _SPEC_SECTION_TESTS[_kbSpecFilter];
  const label = _kbSpecFilter.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const otherTab = _kbActiveTab === 'unit' ? 'ui' : 'unit';
  const otherLabel = otherTab === 'unit' ? 'Unit/API' : 'UI';
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:8px 12px;background:#0a0a1a;border:1px solid #2e2e50;border-radius:6px">
    <span style="font-size:11px;color:#818cf8;flex:1">Filtered by spec: <strong>${esc(label)}</strong></span>
    <button onclick="_filterKbBySpec('${_kbSpecFilter}','${otherTab}')" style="background:none;border:1px solid #2a2a2a;border-radius:4px;color:#555;font-size:11px;padding:3px 8px;cursor:pointer">Show ${esc(otherLabel)} tests</button>
    <button onclick="_clearKbSpecFilter()" style="background:none;border:none;color:#555;font-size:14px;cursor:pointer;padding:0">✕</button>
  </div>`;
}

async function openKb(tab) {
  const modal = document.getElementById('kb-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  _kbApplyBadges();
  await switchKbTab(tab || _kbActiveTab);
}

function closeKb() {
  const modal = document.getElementById('kb-modal');
  if (modal) modal.style.display = 'none';
  document.getElementById('kb-changelog-popover')?.remove();
}

async function switchKbTab(tab) {
  _kbActiveTab = tab;
  document.querySelectorAll('.kb-tab-btn').forEach(b => b.classList.toggle('active', b.id === `kb-tab-${tab}`));
  const runBtn = document.getElementById('btn-run-tests');
  if (runBtn) runBtn.style.display = tab === 'unit' ? '' : 'none';
  const body = document.getElementById('kb-body');
  if (!body) return;

  // Mark as seen when switching to the tab
  const entry = _kbTabHasNew(tab);
  if (entry) {
    localStorage.setItem(_kbSeenKey(tab), entry.date);
    _kbApplyBadges();
  }

  if (_kbCache[tab] && !_kbSpecFilter) {
    body.innerHTML = _kbSpecFilterBar() + _kbCache[tab].html;
    return;
  }

  body.innerHTML = '<p style="color:#555;font-size:12px;padding:8px 0">Loading…</p>';
  try {
    const result = await _kbFetchContent(tab);
    _kbCache[tab] = result;
    body.innerHTML = _kbSpecFilterBar() + result.html;
  } catch (e) {
    body.innerHTML = `<p style="color:#f87171;font-size:12px">Failed to load: ${esc(e.message)}</p>`;
  }
}

async function _filterKbBySpec(slug, tabPreference) {
  _kbSpecFilter = slug;
  // Pick the best tab: prefer tabPreference, else whichever has more relevant content
  const sections = _SPEC_SECTION_TESTS[slug] || { ui: [], unit: [] };
  const preferredTab = tabPreference || (sections.unit.length ? 'unit' : 'ui');
  // Force re-render with filter
  delete _kbCache[preferredTab];
  await openKb(preferredTab);
}

function _clearKbSpecFilter() {
  _kbSpecFilter = null;
  delete _kbCache[_kbActiveTab];
  switchKbTab(_kbActiveTab);
}

function _kbCheckNewContentOnLoad() {
  // No fetching needed — badge logic is purely date-based
  _kbApplyBadges();
}

// Legacy aliases so old callsites keep working
function openDocs(tab) { return openKb(tab === 'testing' ? 'arch' : (tab || 'spec')); }
function closeDocs() { closeKb(); }

function _renderMd(md, withTestLinks = false) {
  const _e = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const badge = tag => `<span style="display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;vertical-align:middle;margin-left:5px;letter-spacing:.04em;background:${tag==='NEW'?'#14532d':'#1e3a5f'};color:${tag==='NEW'?'#4ade80':'#60a5fa'}">${tag}</span>`;
  const inline = s => s
    .replace(/\*\*NEW\*\*/g, badge('NEW'))
    .replace(/\*\*UPDATED\*\*/g, badge('UPDATED'))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  const lines = md.split('\n');
  let html = '', inUl = false, inBq = false, inPre = false, preLines = [];

  const closeUl  = () => { if (inUl)  { html += '</ul>';         inUl  = false; } };
  const closeBq  = () => { if (inBq)  { html += '</blockquote>'; inBq  = false; } };
  const flushPre = () => { if (inPre) { html += `<pre>${_e(preLines.join('\n'))}</pre>`; inPre = false; preLines = []; } };

  // table state
  let inTable = false, tableRows = [];
  const flushTable = () => {
    if (!inTable) return;
    const [head, , ...body] = tableRows;
    const ths = head.split('|').filter(c => c.trim()).map(c => `<th>${inline(_e(c.trim()))}</th>`).join('');
    const trs = body.map(row => '<tr>' + row.split('|').filter(c => c.trim()).map(c => `<td>${inline(_e(c.trim()))}</td>`).join('') + '</tr>').join('');
    html += `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    inTable = false; tableRows = [];
  };

  for (const line of lines) {
    if (line.startsWith('```')) { flushTable(); closeUl(); closeBq(); if (inPre) flushPre(); else inPre = true; continue; }
    if (inPre) { preLines.push(line); continue; }
    if (line.startsWith('|')) { closeUl(); closeBq(); inTable = true; tableRows.push(line); continue; }
    if (inTable) flushTable();
    if (line.startsWith('# '))   { closeUl(); closeBq(); html += `<h2>${_e(line.slice(2))}</h2>`; }
    else if (line.startsWith('## '))  {
      const rawText = line.slice(3).trim();
      const slug = _specSlug(rawText);
      const hasTests = withTestLinks && !!_SPEC_SECTION_TESTS[slug];
      const testBtn = hasTests
        ? ` <button onclick="_filterKbBySpec('${slug}')" style="font-size:10px;font-weight:500;background:none;border:1px solid #2a2a2a;border-radius:4px;color:#555;padding:2px 8px;cursor:pointer;vertical-align:middle;margin-left:8px;transition:color 0.15s,border-color 0.15s" onmouseover="this.style.color='#818cf8';this.style.borderColor='#818cf8'" onmouseout="this.style.color='#555';this.style.borderColor='#2a2a2a'">→ Tests</button>`
        : '';
      closeUl(); closeBq(); html += `<h3>${inline(_e(rawText))}${testBtn}</h3>`;
    }
    else if (line.startsWith('### ')) { closeUl(); closeBq(); html += `<h4>${inline(_e(line.slice(4)))}</h4>`; }
    else if (line.startsWith('> '))   { closeUl(); if (!inBq) { html += '<blockquote>'; inBq = true; } html += `<p style="margin:2px 0">${inline(_e(line.slice(2)))}</p>`; }
    else if (line.startsWith('- '))   { closeBq(); if (!inUl) { html += '<ul>'; inUl = true; } html += `<li>${inline(_e(line.slice(2)))}</li>`; }
    else if (line.startsWith('---'))  { closeUl(); closeBq(); }
    else if (!line.trim())            { closeUl(); closeBq(); }
    else                              { closeUl(); closeBq(); html += `<p>${inline(_e(line))}</p>`; }
  }
  flushPre(); flushTable(); closeUl(); closeBq();
  return html;
}

// ── Test results (now part of KB modal) ─────────────────────────────────────
// Legacy aliases
function openTestResults() { return openKb('unit'); }
function closeTestResults() { closeKb(); }
function switchTestTab(tab) { return switchKbTab(tab); }

function _renderE2eResults(data) {
  if (data.error) {
    return `<div style="background:#1a0505;border:1px solid #3a1a1a;border-radius:6px;padding:12px;margin-bottom:8px">
      <p style="color:#f87171;font-size:12px;margin:0 0 6px">${esc(data.error)}</p>
      ${data.stdout ? `<pre style="color:#888;font-size:10px;white-space:pre-wrap;margin:0;max-height:200px;overflow-y:auto">${esc(data.stdout)}</pre>` : ''}
    </div>`;
  }
  const stats = data.stats || {};
  const passed = stats.expected ?? 0;
  const failed = (stats.unexpected ?? 0) + (stats.flaky ?? 0);
  const total = stats.tests ?? (passed + failed);
  const color = failed > 0 ? '#f87171' : '#4ade80';
  let html = `<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:#0c0c0c;border-radius:6px;border:1px solid #1e1e1e;margin-bottom:8px">
    <span style="font-size:13px;font-weight:600;color:${color}">${failed === 0 ? '✓ All passed' : `✗ ${failed} failed`}</span>
    <span style="font-size:11px;color:#555">${passed}/${total} tests · ${Math.round((stats.duration || 0) / 1000)}s</span>
  </div>`;
  for (const suite of (data.suites || [])) {
    const failedSpecs = suite.specs.filter(s => !s.ok);
    if (failedSpecs.length === 0) continue;
    html += `<div style="margin-bottom:6px;font-size:11px;font-weight:600;color:#818cf8">${esc(suite.title || suite.file)}</div>`;
    for (const spec of failedSpecs) {
      const msg = spec.tests?.[0]?.results?.[0]?.error?.message || '';
      html += `<div style="background:#1a0505;border:1px solid #3a1a1a;border-radius:5px;padding:8px 10px;margin-bottom:4px">
        <span style="color:#f87171;font-size:11px">✗ ${esc(spec.title)}</span>
        ${msg ? `<pre style="color:#888;font-size:10px;white-space:pre-wrap;margin:4px 0 0;max-height:120px;overflow-y:auto">${esc(msg)}</pre>` : ''}
      </div>`;
    }
  }
  return html;
}

let _e2ePollInterval = null;
let _lastE2eResults = null; // { titleMap: { [testTitle]: 'passed'|'failed' } }
let _e2eLogShowing = false;

function _buildE2eTitleMap(results) {
  const map = {};
  function walk(suite) {
    for (const spec of (suite.specs || [])) {
      const status = spec.ok ? 'passed' : 'failed';
      map[spec.title] = status;
      map[spec.title.toLowerCase()] = status;
    }
    for (const child of (suite.suites || [])) walk(child);
  }
  for (const suite of (results?.suites || [])) walk(suite);
  return map;
}

async function runE2eTestsNow() {
  const btn = document.getElementById('btn-run-e2e');
  const out = document.getElementById('e2e-results');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Running…';
  if (out) out.innerHTML = '<p style="color:#555;font-size:12px;padding:4px 0">Starting Playwright tests…</p>';

  clearInterval(_e2ePollInterval);
  try {
    await fetch('/api/run-e2e-tests', { method: 'POST' });
  } catch (e) {
    if (out) out.innerHTML = `<p style="color:#f87171;font-size:12px">Failed to start: ${esc(e.message)}</p>`;
    btn.disabled = false;
    btn.textContent = '▶ Run E2E Tests';
    return;
  }

  let elapsed = 0;
  _e2ePollInterval = setInterval(async () => {
    elapsed += 3;
    if (!_e2eLogShowing && out) out.innerHTML = `<p style="color:#555;font-size:12px;padding:4px 0">Running Playwright tests… ${elapsed}s</p>`;
    try {
      const res = await fetch('/api/e2e-results');
      const data = await res.json();
      if (data.running) {
        if (_e2eLogShowing) showE2eLog(); // auto-refresh log content while user is viewing it
        return;
      }
      clearInterval(_e2ePollInterval);
      _e2eLogShowing = false;
      btn.disabled = false;
      btn.textContent = '▶ Run E2E Tests';
      if (!data.results) {
        if (out) out.innerHTML = '<p style="color:#555;font-size:12px">No results yet.</p>';
        return;
      }
      _lastE2eResults = { titleMap: _buildE2eTitleMap(data.results) };
      delete _kbCache['ui'];
      if (out) out.innerHTML = _renderE2eResults(data.results);
      // Re-render the table body so pass/fail marks appear in the rows
      const body = document.getElementById('kb-body');
      if (body && _kbActiveTab === 'ui') {
        const bar = _kbSpecFilterBar();
        const { html } = await _kbFetchContent('ui');
        body.innerHTML = bar + html;
      }
    } catch (e) {
      clearInterval(_e2ePollInterval);
      _e2eLogShowing = false;
      btn.disabled = false;
      btn.textContent = '▶ Run E2E Tests';
      if (out) out.innerHTML = `<p style="color:#f87171;font-size:12px">Poll error: ${esc(e.message)}</p>`;
    }
  }, 3000);
}

async function showE2eLog() {
  const out = document.getElementById('e2e-results');
  if (!out) return;
  _e2eLogShowing = true;
  out.innerHTML = '<p style="color:#555;font-size:12px">Fetching log…</p>';
  try {
    const data = await fetch('/api/e2e-log').then(r => r.json());
    const logText = data.log || '(empty)';
    out.innerHTML = `<div style="display:flex;justify-content:flex-end;margin-bottom:4px"><button onclick="navigator.clipboard.writeText(this.dataset.log).then(()=>{this.textContent='✓ Copied';setTimeout(()=>this.textContent='📋 Copy',1500)})" data-log="${esc(logText)}" style="background:none;border:1px solid #2a2a2a;border-radius:5px;color:#555;font-size:11px;padding:3px 9px;cursor:pointer">📋 Copy</button></div><pre style="background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:12px;color:#aaa;font-size:10px;white-space:pre-wrap;max-height:400px;overflow-y:auto">${esc(logText)}</pre>`;
  } catch(e) {
    out.innerHTML = `<p style="color:#f87171;font-size:12px">Log fetch error: ${esc(e.message)}</p>`;
  }
}

async function runTestsNow() {
  const btn = document.getElementById('btn-run-tests');
  const body = document.getElementById('kb-body');
  if (!btn || !body) return;
  btn.disabled = true;
  btn.textContent = 'Running…';
  body.innerHTML = '<p style="color:#555;font-size:12px">Running test suite…</p>';
  try {
    const res = await fetch('/api/run-tests', { method: 'POST' });
    const data = await res.json();
    body.innerHTML = _renderTestResults(data);
    // Invalidate cache so result shows fresh
    delete _kbCache['unit'];
  } catch (e) {
    body.innerHTML = '<p style="color:#f87171;font-size:12px">Failed to run tests: ' + esc(e.message) + '</p>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Tests';
  }
}

const _UNIT_TEST_META = {
  'returns the timestamp extracted from the Claude response': ['fuzzyMatchTimestamp returns AI-extracted value', 'Core timestamp matching accuracy'],
  'returns null timestamp when Claude responds with "none"': ['Handles no-match response gracefully', 'Prevents bad timestamp assignments'],
  'returns null when lyric is missing (skips Claude call)': ['Short-circuits without lyric input', 'Avoids unnecessary AI calls'],
  'returns null when transcript is missing (skips Claude call)': ['Short-circuits without transcript', 'Avoids unnecessary AI calls'],
  'returns null (not 500) when Claude fails': ['Graceful degradation on AI error', 'Prevents 500s from reaching client'],
  'passes lyric and transcript bounds to Claude': ['Correct prompt construction', 'Ensures AI has needed context'],
  'returns the prompt text produced by Claude for a character': ['Character prompt generation', 'Core AI prompt generation path'],
  'rejects requests with neither a reference description nor a reference image': ['Input validation', 'Guards against empty prompts'],
  'returns 500 with the upstream error message when Claude fails': ['Error propagation', 'Surfaces AI errors to client'],
  'returns imagePrompt and videoPrompt from Claude': ['Shot prompt dual-field response', 'Both prompt types generated correctly'],
  'returns 400 when both lyric and description are missing': ['Input validation', 'Prevents empty shot prompts'],
  'accepts description alone (no lyric)': ['Optional lyric field', 'Non-lyric shots are supported'],
  'includes shot parameters in the Claude prompt': ['Prompt includes size/angle/movement', 'AI context completeness'],
  'returns 500 when Claude fails': ['AI error propagation', 'Surfaces upstream errors'],
  'handles JSON wrapped in markdown fences': ['Markdown code fence stripping', 'Claude often wraps JSON in fences'],
  'returns a shots array from Claude': ['Shot sequence generation', 'Core AI shot generation path'],
  'returns 400 when scriptText is missing': ['Input validation', 'Guards against empty script input'],
  'includes character and location IDs in the Claude prompt': ['Prompt includes project context', 'Shot gen uses correct characters/locations'],
  'works with empty characters and locations arrays': ['Empty context handling', 'Works on fresh projects'],
  'returns parsed characters array from Claude': ['Character parsing from script', 'Script → characters pipeline'],
  'returns 400 when body is empty': ['Empty body validation', 'Guards missing request body'],
  'includes scriptText in the prompt sent to Claude': ['Prompt contains script', 'AI receives correct input'],
  'handles a Claude response wrapped in markdown fences': ['Markdown fence stripping', 'Claude wraps JSON in fences'],
  'returns parsed locations array from Claude': ['Location parsing from script', 'Script → locations pipeline'],
  'includes scriptText in the Claude prompt': ['Prompt contains script text', 'AI receives correct input'],
  'handles locations wrapped in markdown fences': ['Markdown fence stripping', 'Location JSON extraction'],
  'returns parsed characters and locations for a plain-text upload': ['Full script parse pipeline', 'End-to-end script import'],
  'returns 400 when no file is attached': ['File attachment validation', 'Guards missing file upload'],
  'sends the extracted script text to Claude in the request body': ['Text extraction → Claude', 'File text is correctly forwarded'],
  'returns 500 when Claude returns an error': ['AI error propagation', 'Surfaces parse errors to client'],
  'handles a Claude response wrapped in markdown code fences': ['Markdown fence stripping', 'Claude wraps JSON in fences'],
  'returns 503 when Supabase is not configured': ['Supabase config guard', 'Fails fast without credentials'],
  'the route exists and is handled (not 404)': ['Route registration check', 'Ensures endpoint is registered'],
  'returns 404 when auth is disabled (route not registered)': ['Auth-gated route protection', 'Signed upload URL only available when auth enabled'],
  'returns 400 when no file is attached': ['File attachment validation', 'Guards missing audio upload'],
  'returns transcribed text and word timestamps from OpenAI Whisper': ['Whisper transcription pipeline', 'Core transcription end-to-end'],
  'returns 500 when OPENAI_API_KEY is not set': ['API key guard', 'Fails fast without credentials'],
  'returns 500 when the OpenAI API returns an error': ['OpenAI error propagation', 'Surfaces Whisper errors to client'],
  'returns only word/start/end fields from the words array (strips extra Whisper fields)': ['Response field filtering', 'Keeps payload lean'],
};

function _kbRowHighlight(fileFragment) {
  if (!_kbSpecFilter) return { tr: '', group: '' };
  const slug = Object.entries(_FILE_TO_SPEC).find(([k]) => fileFragment.includes(k))?.[1];
  const match = slug === _kbSpecFilter;
  return {
    tr: match ? 'background:rgba(129,140,248,0.08);border-left:2px solid #818cf8;' : 'opacity:0.25;',
    group: match ? 'color:#818cf8;' : 'opacity:0.25;',
  };
}

function _renderTestResults(data) {
  if (data?.error) {
    let html = `<p style="color:#f87171;font-size:12px;margin-bottom:12px">${esc(data.error)}</p>`;
    if (data.stderr) html += `<pre style="background:#1a0505;border:1px solid #3a1a1a;border-radius:6px;padding:12px;color:#f87171;font-size:11px;white-space:pre-wrap;max-height:300px;overflow-y:auto;">${esc(data.stderr)}</pre>`;
    return html;
  }

  // Build status lookup from run results
  const statusMap = {};
  let failMsgs = {};
  if (data.available && data.files) {
    for (const f of data.files) {
      for (const t of f.tests) {
        statusMap[t.title] = t.status;
        if (t.status === 'failed' && t.failureMessages?.length) failMsgs[t.title] = t.failureMessages[0];
      }
    }
  }

  const thStyle = 'font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.05em;padding:6px 8px;border-bottom:1px solid #2a2a2a;text-align:left;';
  const tdStyle = 'font-size:11px;padding:5px 8px;vertical-align:top;border-bottom:1px solid #111;';

  let summary = '';
  if (data.available) {
    const passColor = '#4ade80', failColor = '#f87171';
    const sc = data.numFailedTests > 0 ? failColor : passColor;
    const st = data.numFailedTests > 0 ? `${data.numFailedTests} failed, ${data.numPassedTests} passed` : `${data.numPassedTests} passed`;
    summary = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:8px 10px;background:#0c0c0c;border-radius:6px;border:1px solid #1e1e1e;">
      <span style="font-size:12px;font-weight:600;color:${sc}">${esc(st)}</span>
      <span style="font-size:10px;color:#555">${data.numTotalTests} tests · last run ${timeAgo(data.startTime)}</span>
    </div>`;
  } else {
    summary = `<div style="font-size:11px;color:#555;margin-bottom:12px;padding:8px 12px;background:#0c0c0c;border-radius:6px;border:1px solid #1e1e1e;">
      Click <strong>Run Tests</strong> above to execute the test suite and populate the ✓ column.
    </div>`;
  }

  let html = summary + `<table style="width:100%;border-collapse:collapse;">
  <thead><tr>
    <th style="${thStyle};width:22%">File</th>
    <th style="${thStyle}">Test Case</th>
    <th style="${thStyle}">What it Verifies</th>
    <th style="${thStyle}">Why it Matters</th>
    <th style="${thStyle};width:36px;text-align:center">✓</th>
  </tr></thead><tbody>`;

  const files = data.available ? data.files : null;
  const seenFiles = new Set();

  const staticFiles = {
    'versioning.test.js': ['stripBase64ForSync — nulls out bare data: URL strings','stripBase64ForSync — prefers cdnUrl/url over existing base64','stripBase64ForSync — nulls dataUrl when no cdn/url available','stripBase64ForSync — recurses into nested arrays and objects','stripBase64ForSync — passes through null/undefined','extractImages — strips image fields out of data, keeps in imgs','mergeImages — reconstructs original from stripped + imgs','mergeImages — no-op passthrough when imgs is falsy','mergeLocalIntoSbImages — fills missing cloud fields from local','mergeLocalIntoSbImages — prefers cloud value when both sides have data','mergeLocalIntoSbImages — recurses into nested objects like angles','mergeLocalIntoSbImages — returns other side when one is missing','stripImagesForVersion — keeps permanent https URLs','stripImagesForVersion — strips blob: and base64','stripImagesForVersion — drops fields not in versioned schema','stripImagesForVersion — filters compose layers with no permanent URL','stripImagesForVersion — keeps project-level fields as-is'],
    'fuzzy-match-timestamp.test.js': ['returns the timestamp extracted from the Claude response','returns null timestamp when Claude responds with "none"','returns null when lyric is missing (skips Claude call)','returns null when transcript is missing (skips Claude call)','returns null (not 500) when Claude fails','passes lyric and transcript bounds to Claude'],
    'generate-prompt.test.js': ['returns the prompt text produced by Claude for a character','rejects requests with neither a reference description nor a reference image','returns 500 with the upstream error message when Claude fails'],
    'generate-shot-prompts.test.js': ['returns imagePrompt and videoPrompt from Claude','returns 400 when both lyric and description are missing','accepts description alone (no lyric)','includes shot parameters in the Claude prompt','returns 500 when Claude fails','handles JSON wrapped in markdown fences'],
    'generate-shot-sequence.test.js': ['returns a shots array from Claude','returns 400 when scriptText is missing','includes character and location IDs in the Claude prompt','works with empty characters and locations arrays','returns 500 when Claude fails'],
    'parse-characters.test.js': ['returns parsed characters array from Claude','returns 400 when scriptText is missing','returns 400 when body is empty','includes scriptText in the prompt sent to Claude','returns 500 when Claude fails','handles a Claude response wrapped in markdown fences'],
    'parse-locations.test.js': ['returns parsed locations array from Claude','returns 400 when scriptText is missing','includes scriptText in the Claude prompt','returns 500 when Claude fails','handles locations wrapped in markdown fences'],
    'parse-script.test.js': ['returns parsed characters and locations for a plain-text upload','returns 400 when no file is attached','sends the extracted script text to Claude in the request body','returns 500 when Claude returns an error','handles a Claude response wrapped in markdown code fences'],
    'project-data.test.js': ['returns 503 when Supabase is not configured','the route exists and is handled (not 404)'],
    'snapshots.test.js': ['returns 503 when Supabase is not configured','returns 503 when Supabase is not configured','returns 503 when Supabase is not configured','returns 503 when projectId is missing and Supabase is not configured'],
    'storage-upload-url.test.js': ['returns 404 when auth is disabled (route not registered)'],
    'transcribe-audio.test.js': ['returns 400 when no file is attached','returns transcribed text and word timestamps from OpenAI Whisper','returns 500 when OPENAI_API_KEY is not set','returns 500 when the OpenAI API returns an error','returns only word/start/end fields from the words array (strips extra Whisper fields)'],
  };

  if (files) {
    for (const f of files) {
      const hl = _kbRowHighlight(f.name);
      html += `<tr><td colspan="5" style="padding:10px 8px 4px;font-size:10px;font-weight:600;font-family:monospace;border-bottom:1px solid #1e1e1e;${hl.group}color:#818cf8">${esc(f.name)}</td></tr>`;
      for (const t of f.tests) {
        const status = t.status;
        const [verifies, why] = _UNIT_TEST_META[t.title] || ['', ''];
        const mark = status === 'passed' ? '✓' : '✗';
        const markColor = status === 'passed' ? '#4ade80' : '#f87171';
        html += `<tr style="${hl.tr}">
          <td style="${tdStyle};color:#444;font-family:monospace;font-size:10px">${esc(f.name.split('/').pop())}</td>
          <td style="${tdStyle};color:#999">${esc(t.title)}</td>
          <td style="${tdStyle};color:#666">${esc(verifies)}</td>
          <td style="${tdStyle};color:#444">${esc(why)}</td>
          <td style="${tdStyle};text-align:center;font-size:14px;color:${markColor}">${mark}</td>
        </tr>`;
        if (status === 'failed' && failMsgs[t.title]) {
          html += `<tr><td colspan="5" style="padding:0 8px 8px"><pre style="background:#1a0505;border:1px solid #3a1a1a;border-radius:4px;padding:8px;color:#e08080;font-size:10px;white-space:pre-wrap;max-height:120px;overflow-y:auto;margin:0">${esc(failMsgs[t.title])}</pre></td></tr>`;
        }
      }
    }
  } else {
    // No run yet — show static list with ○ placeholders
    for (const [file, tests] of Object.entries(staticFiles)) {
      const hl = _kbRowHighlight(file);
      html += `<tr><td colspan="5" style="padding:10px 8px 4px;font-size:10px;font-weight:600;font-family:monospace;border-bottom:1px solid #1e1e1e;${hl.group}color:#818cf8">tests/${file.includes('versioning') ? 'unit' : 'api'}/${file}</td></tr>`;
      for (const title of tests) {
        const [verifies, why] = _UNIT_TEST_META[title] || ['', ''];
        html += `<tr style="${hl.tr}">
          <td style="${tdStyle};color:#444;font-family:monospace;font-size:10px">${esc(file)}</td>
          <td style="${tdStyle};color:#999">${esc(title)}</td>
          <td style="${tdStyle};color:#666">${esc(verifies)}</td>
          <td style="${tdStyle};color:#444">${esc(why)}</td>
          <td style="${tdStyle};text-align:center;font-size:14px;color:#333">○</td>
        </tr>`;
      }
    }
  }

  html += '</tbody></table>';
  return html;
}

const _UI_TEST_STORAGE_KEY = 'sg-ui-test-checks';
function _getUiTestChecks() { try { return JSON.parse(localStorage.getItem(_UI_TEST_STORAGE_KEY) || '{}'); } catch { return {}; } }
function toggleUiTestCheck(key) {
  const checks = _getUiTestChecks();
  checks[key] = !checks[key];
  localStorage.setItem(_UI_TEST_STORAGE_KEY, JSON.stringify(checks));
  const el = document.getElementById('uitc-' + key);
  if (el) el.textContent = checks[key] ? '✓' : '○';
}

function _renderUiTestCases() {
  const sections = [
    { label: 'Authentication', file: 'e2e/auth.spec.ts', cases: [
      ['Unauthenticated access redirects to Google login', 'Session guard on all routes', 'Prevents unauthorized use; catches accidental session expiry'],
      ['After Google OAuth user email appears in header', 'Session cookie + user badge render', 'Confirms passport.js session works end-to-end'],
      ['Sign Out clears session and returns to login', 'Full logout flow', 'Ensures logout fully revokes the session'],
    ]},
    { label: 'Project Management', file: 'e2e/projects.spec.ts', cases: [
      ['projects grid loads with existing projects shown', 'Project list fetch and render', 'Regression guard for the projects API and card render'],
      ['creating a new project navigates to editor with empty state', 'New-project API and routing', 'Core onboarding flow'],
      ['project name rename prompt saves and updates title', 'Inline rename UX + metadata persistence', 'Covers project metadata update round-trip'],
      ['deleting a project removes it from the grid', 'Destructive action guard + Supabase delete', 'Guards delete confirmation UX'],
      ['↓ Cloud button reloads from Supabase discarding local changes', 'forceLoadFromCloud() flow', 'Cross-device sync escape hatch'],
    ]},
    { label: 'Characters', file: 'e2e/characters.spec.ts', cases: [
      ['adding a character appends a new row with default name', 'addCharacter() CRUD', 'Basic CRUD regression guard'],
      ['editing name and description persists via syncFromDOM', 'syncFromDOM field values', 'Confirms DOM → data sync'],
      ['deleting a character removes it and auto-saves', 'deleteCharacter() + re-render', 'CRUD delete path'],
      ['Uploading a reference image shows thumbnail and stores URL', 'Image upload + Supabase storage', 'Image upload pipeline'],
      ['Generating a character image populates the image cell', 'fal.ai generation + polling', 'End-to-end image generation'],
    ]},
    { label: 'Locations', file: 'e2e/locations.spec.ts', cases: [
      ['adding a location appends a card with default name', 'CRUD parity with characters', 'Basic location CRUD'],
      ['editing location name persists via syncFromDOM', 'syncFromDOM field values', 'Confirms DOM → data sync'],
      ['adding a custom view shows it in the variations grid', 'Custom view creation + render', 'Custom view flow'],
      ['deleting a location removes it', 'deleteLocation() + re-render', 'CRUD delete path'],
      ['Uploading an angle reference image appears in angle slot', 'Angle ref image upload pipeline', 'Location angle image upload'],
      ['Generating a location image populates the default image', 'Location AI generation', 'Location image gen end-to-end'],
    ]},
    { label: 'Shot Sequence', file: 'e2e/shots.spec.ts', cases: [
      ['adding a shot appends a new row with empty fields', 'addShot() CRUD', 'Basic shot CRUD'],
      ['assigning a character updates the character column', 'Shot–character linking + re-render', 'Shot–character association'],
      ['assigning a location shows name in location select', 'Shot–location linking', 'Shot–location association'],
      ['setting a timestamp persists and shows in the field', 'Timestamp field → syncFromDOM → save', 'Timestamp persistence pipeline'],
      ['Generating a shot image populates the Final Image column', 'Shot image generation end-to-end', 'Shot image gen flow'],
      ['new shot added mid-sequence appears in the correct position', '_syncAnimaticFromLiveShots on addShot', 'Guards animatic sync for inserted shots'],
      ['editing a lyric field persists via syncFromDOM', 'onTimestampInput → _syncAnimaticFromLiveShots', 'Live animatic sync regression'],
      ['deleting a shot removes it from the sequence', 'deleteShot() + re-render', 'CRUD delete path'],
    ]},
    { label: 'Audio & Transcript', file: 'e2e/audio.spec.ts', cases: [
      ['Importing audio displays waveform and enables bar-marker tools', 'Audio import + waveform render', 'Audio import pipeline'],
      ['Dragging a bar marker updates its timestamp', 'Bar-marker drag handler', 'Bar marker drag UX'],
      ['Transcribing audio populates lyrics with timestamped words', 'Whisper transcription → display', 'Transcription end-to-end'],
      ['Auto-assigning timestamps maps shot lyrics to nearest word', 'autoAssignTimestamps() correctness', 'Timestamp auto-assignment accuracy'],
      ['Pinning the audio player keeps controls visible while scrolling', 'Pinned-player UX', 'Pinned player regression'],
    ]},
    { label: 'Image Editor (Compose)', file: 'e2e/compose.spec.ts', cases: [
      ['Opening compose from a shot loads its location as background', 'openCompose() → loadComposeBackground()', 'Compose editor init'],
      ['Clicking a location card loads it on the canvas', 'onLocBgCardClick() flow', 'Background selection'],
      ['Clicking a variation loads that angle as background', 'onLocBgViewChange() image resolution', 'Variation background load'],
      ['Variation thumbnails do not show a delete button', 'Regression: no delete in compose', 'Delete button regression'],
      ['Adding a character layer places it on canvas and layers list', 'Layer add → renderCompose()', 'Character layer add'],
      ['Adjusting brightness/saturation sliders changes rendering', 'Effect params → renderCompose()', 'Effect slider regression'],
      ['Saving sets the shot Final Image and closes editor', 'saveComposeAsFinal() end-to-end', 'Compose save pipeline'],
      ['Double-clicking animatic segment opens compose for that shot', 'dblclick on .tl-segment → openCompose()', 'Animatic-to-compose shortcut'],
    ]},
    { label: 'Versions', file: 'e2e/versions.spec.ts', cases: [
      ['version UI is visible in the editor header', 'Version bar render on open', 'Version UI always visible'],
      ['creating a named version appears in the version list', 'createVersion() label generation', 'Named version flow'],
      ['version list renders inside version-ui', 'Version list render', 'Version list regression'],
      ['switching to older version restores data from that snapshot', 'loadVersion() → versionSelect.selectOption(v1Label)', 'Version restore round-trip'],
      ['After N edits an auto-version appears in the version list', 'AUTO_VERSION_EVERY + createVersion(true)', 'Auto-version threshold'],
      ['Version list appears on a second device after saving', 'Cross-device sync via project_snapshots', 'Cross-device version sync'],
    ]},
    { label: 'Animatic', file: 'e2e/animatic.spec.ts', cases: [
      ['animatic tab is reachable and renders its container', 'animatic-tab-panel visibility on nav click', 'Animatic tab regression'],
      ['adding a shot with a timestamp appears in animatic sync', 'Shot timestamp → animatic sync', 'Shot–animatic sync'],
      ['animatic timeline wrap renders when animatic exists', 'animatic-tab-panel render', 'Timeline render regression'],
      ['canvas preview element is present after animatic loads', 'animatic-tab-panel + animatic-empty render', 'Canvas init regression'],
      ['sync button refreshes timeline from live shot timestamps', '_syncAnimaticFromLiveShots()', 'Manual sync escape hatch'],
      ['Generating an animatic produces a video and adds it as Latest', 'generateAnimatic() full flow', 'Animatic generation pipeline'],
      ['Timeline handles render at correct positions for shot timestamps', 'Handle X-position: (secs - offset) / duration', 'Handle position accuracy'],
      ['Dragging a handle updates segment widths and handle position', 'startTlDrag() onMove CSS update', 'Drag handle UX'],
      ['Canvas shows correct shot image at current playback position', '_drawCanvasFrame() rAF loop from _animaticTimeline', 'Live canvas preview'],
    ]},
    { label: 'Configuration & Cloud', file: 'e2e/config.spec.ts', cases: [
      ['configuration tab loads and shows settings', 'Config tab render', 'Config tab regression'],
      ['cloud-only toggle is present in config tab', 'setCloudOnlyMode() toggle', 'Cloud-only mode toggle'],
      ['visual styles section renders in config tab', 'Visual styles table render', 'Visual style persistence'],
      ['Toggling Cloud Only mode disables local caching and shows indicator', 'setCloudOnlyMode() full flow', 'Cloud-only mode full toggle'],
      ['Script upload parses the script and populates shot descriptions', 'handleScriptUpload() → /api/parse-script', 'Script import pipeline'],
    ]},
    { label: 'Docs & Tests Modal (KB)', file: 'e2e/kb.spec.ts', cases: [
      ['KB button is visible in the header', '#btn-open-kb render in header', 'KB button always present'],
      ['clicking KB button opens the modal', 'openKb() → display:flex', 'KB modal open flow'],
      ['Product Spec tab loads content', 'switchKbTab(spec) → /spec.md fetch', 'Spec tab content load'],
      ['Architecture tab loads content from CLAUDE.md', 'switchKbTab(arch) → /CLAUDE.md fetch', 'Arch tab content load'],
      ['Unit/API Tests tab loads test results table', 'switchKbTab(unit) → table render', 'Unit tab table render'],
      ['Run Tests button is visible on Unit/API tab', '#btn-run-tests visibility on unit tab', 'Run Tests button regression'],
      ['UI Test Cases tab renders a table with manual check column', 'switchKbTab(ui) → _renderUiTestCases()', 'UI tab table render'],
      ['Run Tests button is hidden on UI Test Cases tab', '#btn-run-tests hidden on ui tab', 'Run Tests hidden regression'],
      ['closing modal hides it', 'closeKb() → display:none', 'KB modal close flow'],
    ]},
  ];

  const checks = _getUiTestChecks();
  const e2eMap = _lastE2eResults?.titleMap || {};
  const thStyle = 'font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.05em;padding:6px 8px;border-bottom:1px solid #2a2a2a;text-align:left;';
  const tdStyle = 'font-size:11px;padding:5px 8px;vertical-align:top;border-bottom:1px solid #111;color:#888;';

  let html = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:8px 12px;background:#0c0c0c;border-radius:6px;border:1px solid #1e1e1e;">
    <span style="font-size:11px;color:#555;flex:1">Playwright e2e tests. Click ○ to mark a case as manually verified.</span>
    <button id="btn-run-e2e" onclick="runE2eTestsNow()" style="background:#1a1a2e;border:1px solid #2e2e50;border-radius:6px;color:#818cf8;font-size:12px;font-weight:500;padding:5px 12px;cursor:pointer;white-space:nowrap">▶ Run E2E Tests</button>
    <button onclick="showE2eLog()" style="background:none;border:1px solid #2a2a2a;border-radius:6px;color:#555;font-size:11px;padding:5px 10px;cursor:pointer;white-space:nowrap">📋 View Log</button>
  </div>
  <div id="e2e-results" style="margin-bottom:12px"></div>
  <table style="width:100%;border-collapse:collapse;">
  <thead><tr>
    <th style="${thStyle};width:18%">File</th>
    <th style="${thStyle}">Test Case</th>
    <th style="${thStyle}">What it Verifies</th>
    <th style="${thStyle}">Why it Matters</th>
    <th style="${thStyle};width:36px;text-align:center">✓</th>
  </tr></thead><tbody>`;

  for (const s of sections) {
    const specSlug = _UI_SECTION_TO_SPEC[s.label];
    let groupStyle = '', rowStyle = '';
    if (_kbSpecFilter) {
      const match = specSlug === _kbSpecFilter;
      groupStyle = match ? 'color:#818cf8;' : 'opacity:0.25;color:#444;';
      rowStyle = match ? 'background:rgba(129,140,248,0.08);border-left:2px solid #818cf8;' : 'opacity:0.25;';
    }
    html += `<tr><td colspan="5" style="padding:10px 8px 4px;font-size:11px;font-weight:600;border-bottom:1px solid #1e1e1e;${groupStyle}color:#818cf8">▸ ${esc(s.label)}</td></tr>`;
    for (const [desc, verifies, why] of s.cases) {
      const key = btoa(unescape(encodeURIComponent(s.label + ':' + desc))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
      const checked = checks[key];
      const e2eStatus = e2eMap[desc] || e2eMap[desc.toLowerCase()]; // 'passed' | 'failed' | undefined
      const mark = e2eStatus === 'passed' ? { icon: '✓', color: '#4ade80', title: 'Playwright: passed' }
                 : e2eStatus === 'failed' ? { icon: '✗', color: '#f87171', title: 'Playwright: failed' }
                 : checked               ? { icon: '✓', color: '#818cf8', title: 'Manually verified' }
                 :                         { icon: '○', color: '#333',    title: 'Not yet verified' };
      html += `<tr style="${rowStyle}${e2eStatus === 'failed' ? 'background:rgba(248,113,113,0.06);border-left:2px solid #f87171;' : ''}">
        <td style="${tdStyle};color:#444;font-family:monospace;font-size:10px">${esc(s.file)}</td>
        <td style="${tdStyle};color:#999">${esc(desc)}</td>
        <td style="${tdStyle}">${esc(verifies)}</td>
        <td style="${tdStyle};color:#444">${esc(why)}</td>
        <td style="${tdStyle};text-align:center"><span id="uitc-${key}" onclick="${e2eStatus ? '' : `toggleUiTestCheck('${key}')`}" style="cursor:${e2eStatus ? 'default' : 'pointer'};color:${mark.color};font-size:14px" title="${mark.title}">${mark.icon}</span></td>
      </tr>`;
    }
  }

  html += '</tbody></table>';
  return html;
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

function newCharacter() { return { id: genId(), name: '', reference: '', referenceImage: null, refImages: [], selectedRefImageId: null, loraUrl: null, loraStatus: 'idle', loraTriggerWord: null, prompt: '', images: [], angles: {}, expressionCache: {} }; }

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

function locVariationImage(loc, angleKey) {
  if (!loc || !angleKey) return locDefaultImage(loc);
  if (angleKey.startsWith('cv:')) {
    const cv = (loc.customViews || []).find(v => v.id === angleKey.slice(3));
    if (!cv) return locDefaultImage(loc);
    return (cv.useRef && cv.refImage) ? (cv.refImage.dataUrl || cv.refImage.url) : (cv.image || locDefaultImage(loc));
  }
  const entry = loc.shotAngles?.[angleKey];
  if (!entry) return locDefaultImage(loc);
  return (entry.useRef && entry.refImage) ? (entry.refImage.dataUrl || entry.refImage.url) : (entry.image || locDefaultImage(loc));
}

function locVariationsHTML(s) {
  const loc = locations.find(l => l.id === s.locationId);
  if (!loc) return '';
  const thumbs = [];
  for (const angle of Object.keys(loc.shotAngles || {})) {
    const entry = loc.shotAngles[angle];
    const img = (entry.useRef && entry.refImage) ? (entry.refImage.dataUrl || entry.refImage.url) : entry.image;
    if (!img) continue;
    const sel = s.locationAngleKey === angle;
    thumbs.push(`<div class="loc-var-thumb${sel ? ' loc-var-thumb-sel' : ''}" onclick="selectLocVariation('${s.id}','${angle}')" title="${esc(angle)}">
      <img src="${esc(img)}"><span class="loc-var-label">${esc(angle)}</span>
    </div>`);
  }
  for (const cv of (loc.customViews || [])) {
    const img = (cv.useRef && cv.refImage) ? (cv.refImage.dataUrl || cv.refImage.url) : cv.image;
    if (!img) continue;
    const key = `cv:${cv.id}`;
    const sel = s.locationAngleKey === key;
    thumbs.push(`<div class="loc-var-thumb${sel ? ' loc-var-thumb-sel' : ''}" onclick="selectLocVariation('${s.id}','${key}')" title="${esc(cv.name||'Custom')}">
      <img src="${esc(img)}"><span class="loc-var-label">${esc(cv.name || 'Custom')}</span>
    </div>`);
  }
  if (!thumbs.length) return '';
  return `<div class="loc-variations-strip" id="loc-vars-${s.id}">${thumbs.join('')}</div>`;
}

function charDefaultImage(c) {
  if (!c) return null;
  if (c.selectedRefImageId) {
    const sel = (c.refImages || []).find(r => r.id === c.selectedRefImageId);
    if (sel) return sel.url || sel.dataUrl;
  }
  return c.images?.[0] || null;
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
function newShot() { return { id: genId(), lyric: '', description: '', characterIds: [], locationId: '', locationAngleKey: '', shotSize: 'Medium Shot', shotAngle: 'Eye Level', shotMovement: 'Static', imagePrompt: '', videoPrompt: '', images: [], videoUrl: '', motionVideoUrl: '', motionDuration: null, motionConfig: null, characterDetails: {}, refImage: null, timestamp: '' }; }

function addShot() { syncFromDOM(); shots.push(newShot()); renderShots(); _syncAnimaticFromLiveShots(); autoSave(); }
function addShotAfter(id) {
  syncFromDOM();
  const idx = shots.findIndex(s => s.id === id);
  shots.splice(idx + 1, 0, newShot());
  renderShots(); _syncAnimaticFromLiveShots(); autoSave();
}
function duplicateShot(id) {
  syncFromDOM();
  const idx = shots.findIndex(s => s.id === id);
  if (idx < 0) return;
  const src = shots[idx];
  const next = shots[idx + 1];
  // Compute midpoint timestamp between this shot and next (or +5s if last)
  const srcSecs = parseTimestamp(src.timestamp) ?? null;
  const nextSecs = next ? (parseTimestamp(next.timestamp) ?? null) : null;
  let midTs = '';
  if (srcSecs !== null) {
    const endSecs = nextSecs !== null ? nextSecs : srcSecs + 10;
    midTs = formatTimestamp((srcSecs + endSecs) / 2);
  }
  const dupe = {
    ...src,
    id: genId(),
    timestamp: midTs,
    images: [],
    videoUrl: '',
    motionVideoUrl: '',
    motionDuration: null,
    motionConfig: null,
    finalImage: src.finalImage || '',
    composeMeta: src.composeMeta ? { ...src.composeMeta } : null,
    composeLayers: src.composeLayers ? src.composeLayers.map(l => ({ ...l })) : [],
  };
  shots.splice(idx + 1, 0, dupe);
  renderShots(); _syncAnimaticFromLiveShots(); autoSave();
}
function deleteShot(id) { syncFromDOM(); shots = shots.filter(s => s.id !== id); renderShots(); _syncAnimaticFromLiveShots(); autoSave(); }
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
function openLocVariationPicker(shotId) {
  const shot = shots.find(s => s.id === shotId);
  if (!shot) return;
  const loc = locations.find(l => l.id === shot.locationId);
  if (!loc) return;

  // Remove any existing picker
  document.getElementById('loc-var-picker-overlay')?.remove();

  const btn = document.querySelector(`#shots-body tr[data-id="${shotId}"] .btn-loc-variation`);
  const rect = btn ? btn.getBoundingClientRect() : { left: 0, bottom: 80 };

  const views = [];
  for (const angle of Object.keys(loc.shotAngles || {})) {
    const entry = loc.shotAngles[angle];
    const img = (entry.useRef && entry.refImage) ? (entry.refImage.dataUrl || entry.refImage.url) : entry.image;
    if (!img) continue;
    views.push({ key: angle, label: angle, img });
  }
  for (const cv of (loc.customViews || [])) {
    const img = (cv.useRef && cv.refImage) ? (cv.refImage.dataUrl || cv.refImage.url) : cv.image;
    if (!img) continue;
    views.push({ key: `cv:${cv.id}`, label: cv.name || 'Custom', img });
  }

  if (!views.length) { showToast('No variations generated for this location yet.'); return; }

  const overlay = document.createElement('div');
  overlay.id = 'loc-var-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  const popup = document.createElement('div');
  popup.style.cssText = `position:absolute;background:#161616;border:1px solid #2a2a2a;border-radius:10px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,0.7);min-width:280px;max-width:400px;`;
  // Position below button, keep on screen
  const top = Math.min(rect.bottom + 8 + window.scrollY, window.innerHeight + window.scrollY - 260);
  const left = Math.min(rect.left, window.innerWidth - 420);
  popup.style.top = top + 'px';
  popup.style.left = Math.max(8, left) + 'px';

  popup.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:12px;font-weight:600;color:#aaa">${esc(loc.name || 'Location')} — Variations</span>
      <button onclick="document.getElementById('loc-var-picker-overlay').remove()" style="background:none;border:none;color:#555;font-size:14px;cursor:pointer;line-height:1;padding:2px 4px">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
      ${views.map(v => {
        const sel = shot.locationAngleKey === v.key;
        return `<div onclick="selectLocVariation('${shotId}','${v.key}');document.getElementById('loc-var-picker-overlay').remove()"
          style="border-radius:6px;overflow:hidden;cursor:pointer;border:2px solid ${sel ? '#818cf8' : '#2a2a2a'};transition:border-color 0.12s"
          onmouseover="this.style.borderColor='${sel ? '#818cf8' : '#555'}'" onmouseout="this.style.borderColor='${sel ? '#818cf8' : '#2a2a2a'}'">
          <img src="${esc(v.img)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block">
          <div style="font-size:10px;color:#888;padding:3px 5px;background:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(v.label)}</div>
        </div>`;
      }).join('')}
    </div>
    ${shot.locationAngleKey ? `<button onclick="selectLocVariation('${shotId}','');document.getElementById('loc-var-picker-overlay').remove()" style="margin-top:10px;width:100%;background:none;border:1px solid #2a2a2a;border-radius:5px;color:#666;font-size:11px;padding:5px;cursor:pointer">Clear selection</button>` : ''}
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}

function selectLocVariation(shotId, angleKey) {
  const shot = shots.find(s => s.id === shotId);
  if (!shot) return;
  shot.locationAngleKey = angleKey;
  // Update the button label
  const btn = document.querySelector(`#shots-body tr[data-id="${shotId}"] .btn-loc-variation`);
  if (btn) {
    btn.textContent = angleKey ? '⬛ Variation set' : '⬛ Choose variation';
    btn.classList.toggle('btn-loc-variation-set', !!angleKey);
  }
  // Update final preview image
  const finalCell = document.getElementById(`final-img-${shotId}`);
  if (finalCell && !shot.finalImage) {
    const loc = locations.find(l => l.id === shot.locationId);
    const img = locVariationImage(loc, shot.locationAngleKey) || locDefaultImage(loc);
    const preview = finalCell.querySelector('.final-image-loc-preview');
    if (preview) {
      const existing = preview.querySelector('.final-image-preview');
      const empty = preview.querySelector('.final-image-loc-empty');
      if (img) {
        if (existing) existing.src = img;
        else { if (empty) empty.remove(); const el = document.createElement('img'); el.className = 'final-image-preview'; el.src = img; preview.insertBefore(el, preview.firstChild); }
      }
    }
  }
  autoSave();
}

function onShotLocationChange(shotId, locationId) {
  const shot = shots.find(s => s.id === shotId);
  if (shot) { shot.locationId = locationId; shot.locationAngleKey = ''; }
  // Refresh variation strip
  const strip = document.getElementById(`loc-vars-${shotId}`);
  if (strip) strip.outerHTML = locVariationsHTML(shot || { id: shotId, locationId, locationAngleKey: '' });
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
      ? `<img src="${esc(refImg.dataUrl || refImg.url)}" alt="${esc(angle)}">`
      : imgHtml;
    const refHtml = refImg
      ? `<div style="position:relative;display:inline-block">
           <img src="${esc(refImg.dataUrl || refImg.url)}" alt="ref" style="width:40px;height:40px;object-fit:cover;border-radius:3px;cursor:pointer;outline:${entry.useRef ? '2px solid #4ade80' : 'none'}" onclick="toggleLocAngleUseRef('${l.id}','${angle}')" title="${entry.useRef ? 'Using ref as image (click to revert)' : 'Click to use as image'}">
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
      ? `<img src="${esc(refImg.dataUrl || refImg.url)}" alt="${esc(cv.name || '')}">`
      : imgHtml;
    const refHtml = refImg
      ? `<div style="position:relative;display:inline-block">
           <img src="${esc(refImg.dataUrl || refImg.url)}" alt="ref" style="width:40px;height:40px;object-fit:cover;border-radius:3px;cursor:pointer;outline:${cv.useRef ? '2px solid #4ade80' : 'none'}" onclick="toggleLocCustomViewUseRef('${l.id}',${i})" title="${cv.useRef ? 'Using ref as image (click to revert)' : 'Click to use as image'}">
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
  if (tab === 'config') initCloudOnlyToggle();
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
  if (isAnimatic) _syncAnimaticFromLiveShots();
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

  const filteredShots = shots.filter(s => (s.finalImage || s.images?.[0] || s.videoUrl || s.motionVideoUrl) && s.timestamp);
  const rawFrames = filteredShots
    .map(s => ({ imageUrl: s.finalImage || s.images?.[0] || null, videoUrl: s.motionVideoUrl || s.videoUrl || null, motionDuration: s.motionDuration || null, timestamp: s.timestamp }));
  const shotSnapshot = filteredShots.map(s => ({ id: s.id, timestamp: s.timestamp, lyric: s.lyric || '' }));

  if (!rawFrames.length) {
    showToast('No shots with a Final Image (or motion video) and a timestamp yet.', true);
    return;
  }

  const audioFile = await idbGet(_audioKey() + '-file');
  if (!audioFile) {
    showToast('No audio loaded — import audio first.', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Generating…';
  status.textContent = 'Uploading assets…';

  // Upload a Blob directly to Supabase Storage via a server-issued signed URL.
  // This bypasses Railway's body size limit and doesn't need anon key write access.
  const uploadBlobToSupabase = async (blob, storagePath) => {
    try {
      const { signedUrl, publicUrl } = await apiFetch('/api/storage-upload-url', { path: storagePath });
      const uploadResp = await fetch(signedUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      });
      if (!uploadResp.ok) throw new Error(`PUT ${uploadResp.status} ${uploadResp.statusText}`);
      return publicUrl;
    } catch(e) {
      throw new Error(`Upload failed (${storagePath.split('/').pop()}): ${e.message}`);
    }
  };

  try {
    const prefix = `projects/${currentProjectId || 'unassigned'}/animatic-tmp/${Date.now()}`;

    status.textContent = 'Uploading audio…';
    const audioUrl = await uploadBlobToSupabase(audioFile, `${prefix}/audio.mp3`);

    status.textContent = 'Uploading shot assets…';
    const shotMeta = [];
    for (let i = 0; i < rawFrames.length; i++) {
      const f = rawFrames[i];
      const meta = { timestamp: f.timestamp, motionDuration: f.motionDuration || null };
      const tryFetchBlob = async (url) => {
        try { return await fetch(url).then(r => r.blob()); } catch { return null; }
      };
      if (f.videoUrl) {
        if (f.videoUrl.startsWith('blob:')) {
          // blob: URLs expire on page reload — try to fetch, fall back to still image
          const blob = await tryFetchBlob(f.videoUrl);
          if (blob) {
            meta.videoUrl = await uploadBlobToSupabase(blob, `${prefix}/video_${i}.mp4`);
          } else if (f.imageUrl && !f.imageUrl.startsWith('blob:')) {
            meta.imageUrl = f.imageUrl; // use still image instead
          } else {
            continue; // skip this shot — no valid asset
          }
        } else {
          meta.videoUrl = f.videoUrl;
          if (f.imageUrl && !f.imageUrl.startsWith('blob:')) meta.imageUrl = f.imageUrl;
        }
      } else if (f.imageUrl) {
        if (f.imageUrl.startsWith('blob:')) {
          const blob = await tryFetchBlob(f.imageUrl);
          if (blob) {
            meta.imageUrl = await uploadBlobToSupabase(blob, `${prefix}/image_${i}.jpg`);
          } else {
            continue; // skip — stale blob, no fallback
          }
        } else {
          meta.imageUrl = f.imageUrl;
        }
      }
      shotMeta.push(meta);
    }

    status.textContent = 'Connecting to server…';
    const pingOk = await fetch('/api/ping').then(r => r.ok).catch(() => false);
    if (!pingOk) throw new Error('Server unreachable — check Railway deployment');

    status.textContent = 'Building animatic…';

    // Send only URLs — no binary through Railway's proxy
    let resp;
    try {
      resp = await fetch('/api/generate-animatic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots: shotMeta, audioUrl, projectId: currentProjectId }),
      });
    } catch(fetchErr) {
      throw new Error('Railway request failed: ' + fetchErr.message);
    }
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || resp.statusText); }

    const data = await resp.json();
    if (!data.url) throw new Error('No URL returned from server');
    const permanentUrl = data.url;

    // Show frame debug log so it's easy to see which shots used video vs image
    if (data.frameLog) {
      const summary = data.frameLog.map(f => `${f.ts}: ${f.type}${f.dur ? ` (${f.dur.toFixed(1)}s)` : ''}${f.error ? ' ERR:'+f.error : ''}`).join('\n');
      status.textContent = 'Frame log: ' + data.frameLog.filter(f=>f.type==='video-ok').length + ' video / ' + data.frameLog.filter(f=>f.type==='image-ok'||f.type==='image-fallback-ok').length + ' still';
      console.log('[animatic frameLog]\n' + summary);
    }

    const entry = { url: permanentUrl, createdAt: Date.now(), label: new Date().toLocaleString(), shots: shotSnapshot };
    animatics = [entry, ...(animatics || [])];
    autoSave();

    setTimeout(() => { status.textContent = ''; }, 5000);
    renderAnimaticHistory();
  } catch(e) {
    showToast('Animatic failed: ' + e.message, true);
    status.textContent = '';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Animatic';
  }
}

function renderAnimaticHistory() {
  const container = document.getElementById('animatic-history');
  const empty = document.getElementById('animatic-empty');
  if (!container) return;
  if (!animatics || !animatics.length) {
    empty.style.display = '';
    container.innerHTML = '';
    return;
  }
  empty.style.display = 'none';
  container.innerHTML = animatics.map((a, i) => `
    <div style="margin-bottom:28px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:11px;color:#555">${esc(a.label || new Date(a.createdAt).toLocaleString())}${i === 0 ? ' <span style="color:#818cf8;font-weight:600">· Latest</span>' : ''}</span>
        <a href="${esc(a.url)}" download="animatic-${a.createdAt}.mp4" style="font-size:11px;color:#555;text-decoration:none;border:1px solid #222;border-radius:3px;padding:2px 7px">↓ Download</a>
        <button onclick="deleteAnimatic(${i})" style="font-size:11px;color:#555;background:none;border:1px solid #222;border-radius:3px;padding:2px 7px;cursor:pointer">✕ Remove</button>
      </div>
      <div style="position:relative;width:100%;max-width:900px">
        <video src="${esc(a.url)}" ${i === 0 ? 'style="width:100%;border-radius:8px;background:#000;display:block;opacity:0;pointer-events:none;position:absolute;top:0;left:0"' : 'controls style="width:100%;border-radius:8px;background:#000;display:block"'} data-animatic-idx="${i}" onloadedmetadata="if(${i}===0)_initPrimaryAnimaticTimeline(this,${i})"></video>
        ${i === 0 ? `<canvas id="animatic-preview-canvas" style="width:100%;border-radius:8px;background:#000;display:block;cursor:pointer" onclick="_toggleAnimaticPlayback()"></canvas>
        <div id="animatic-preview-controls" style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <button onclick="_toggleAnimaticPlayback()" style="background:none;border:1px solid #333;border-radius:4px;color:#aaa;font-size:11px;padding:3px 10px;cursor:pointer" id="animatic-play-btn">▶ Play</button>
          <span id="animatic-time-display" style="font-size:10px;color:#555;font-family:monospace">0:00 / 0:00</span>
          <button onclick="_insertShotAtPlayhead()" title="Insert a new shot at the current playhead position" style="background:none;border:1px solid #333;border-radius:4px;color:#818cf8;font-size:11px;padding:3px 10px;cursor:pointer">+ Insert Shot</button>
        </div>` : ''}
      </div>
      ${i === 0 ? `<div id="animatic-timeline-wrap" style="display:none;max-width:900px;margin-top:10px;user-select:none">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:10px;color:#444;flex:1">Shot boundaries — drag handles to adjust · scroll to zoom</span>
          <span id="tl-zoom-label" style="font-size:10px;color:#818cf8;min-width:28px;text-align:right"></span>
          <button onclick="_tlZoomBy(2)" style="font-size:11px;color:#555;background:none;border:1px solid #222;border-radius:3px;padding:1px 7px;cursor:pointer">+</button>
          <button onclick="_tlZoomBy(0.5)" style="font-size:11px;color:#555;background:none;border:1px solid #222;border-radius:3px;padding:1px 7px;cursor:pointer">−</button>
          <button onclick="_syncAnimaticFromLiveShots();showToast('Synced from shot sequence')" style="font-size:10px;color:#818cf8;background:none;border:1px solid #2a2a3a;border-radius:3px;padding:2px 8px;cursor:pointer">↺ Sync</button>
        </div>
        <div id="animatic-timeline-scroll" style="overflow-x:auto;border-radius:4px" onwheel="(function(e){e.preventDefault();const sc=document.getElementById('animatic-timeline-scroll');const pivot=(e.clientX-sc.getBoundingClientRect().left+sc.scrollLeft)/sc.scrollWidth;_tlZoomBy(e.deltaY<0?1.25:0.8,pivot);})(event)">
          <div id="animatic-timeline" style="position:relative;height:48px;background:#0e0e0e;border-radius:4px;overflow:visible;border:1px solid #1e1e1e;cursor:pointer;width:100%"></div>
        </div>
      </div>` : ''}
    </div>
  `).join('');
}

function _initPrimaryAnimaticTimeline(videoEl, animaticIdx) {
  renderAnimaticTimeline(videoEl, animaticIdx != null ? animatics[animaticIdx] : null);
  videoEl.addEventListener('timeupdate', updateAnimaticPlayhead, { passive: true });
  _startLiveCanvasPreview(videoEl);
}

// ── Live canvas preview state ────────────────────────────────────────────────
let _redrawLiveCanvas = null;
let _livePreviewVideoEl = null; // hidden <video> carrying the audio track
let _livePreviewPlaying = false;
let _livePreviewRafId = null;
const _videoPool = {};   // { shotId: HTMLVideoElement } — one per shot with video
const _imgCache = {};    // { url: HTMLImageElement }
let _lastDrawnShotId = null;
let _lastCanvasW = 0, _lastCanvasH = 0;

function _getOrCreatePoolVideo(shot) {
  const url = shot.motionVideoUrl || shot.videoUrl;
  if (!url) return null;
  const existing = _videoPool[shot.id];
  // Recreate if URL changed
  if (existing && existing.dataset.src === url) return existing;
  if (existing) { existing.remove(); }
  const v = document.createElement('video');
  v.src = url;
  v.dataset.src = url;
  v.crossOrigin = 'anonymous';
  v.preload = 'auto';
  v.muted = true;
  v.playsInline = true;
  v.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none';
  document.body.appendChild(v);
  _videoPool[shot.id] = v;
  return v;
}

function _loadImg(url) {
  if (!_imgCache[url]) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!_livePreviewPlaying) _drawCanvasFrame(); };
    img.src = proxyUrl(url);
    _imgCache[url] = img;
  }
  return _imgCache[url];
}

function _drawCanvasFrame() {
  const canvas = document.getElementById('animatic-preview-canvas');
  const audioEl = _livePreviewVideoEl;
  if (!canvas || !audioEl || !_animaticTimeline) return;

  const { shots: ts, duration } = _animaticTimeline;
  if (!ts.length) return;

  // Sync canvas resolution to display size
  const dw = canvas.offsetWidth, dh = canvas.offsetHeight;
  if (dw !== _lastCanvasW || dh !== _lastCanvasH) {
    canvas.width = dw; canvas.height = dh;
    _lastCanvasW = dw; _lastCanvasH = dh;
  }
  if (!dw || !dh) return;

  const ctx = canvas.getContext('2d');
  const offset = ts[0].secs;
  const t = (audioEl.currentTime || 0) + offset;

  // Find current shot
  let curIdx = 0;
  for (let i = 0; i < ts.length; i++) { if (ts[i].secs <= t) curIdx = i; else break; }
  const cur = ts[curIdx];
  const nextSecs = ts[curIdx + 1]?.secs ?? (offset + duration);
  const shotStart = cur.secs;
  const offsetInShot = Math.max(0, t - shotStart);

  const live = shots.find(sh => sh.id === cur.id);

  // Update time display
  const timeEl = document.getElementById('animatic-time-display');
  if (timeEl) timeEl.textContent = `${formatTimestamp(t)} / ${formatTimestamp(offset + duration)}`;

  // Update playhead
  const ph = document.getElementById('animatic-playhead');
  if (ph) ph.style.left = (audioEl.currentTime / duration * 100) + '%';

  // Determine what to draw
  const hasMotionVideo = !!(live?.motionVideoUrl);
  const hasGenVideo = !!(live?.videoUrl);
  const hasVideo = hasMotionVideo || hasGenVideo;
  const stillUrl = live?.finalImage || live?.images?.[0];

  if (hasVideo) {
    const pv = _getOrCreatePoolVideo(live);
    if (pv) {
      const slotDur = nextSecs - shotStart;
      const clipDur = pv.duration || 0;
      const maxPlay = live.motionDuration ? Math.min(live.motionDuration, clipDur) : clipDur;

      if (_livePreviewPlaying && pv.paused && offsetInShot < maxPlay) {
        pv.currentTime = offsetInShot;
        pv.play().catch(() => {});
      }
      // Freeze on last frame when beyond clip duration
      if (offsetInShot >= maxPlay && !pv.paused) pv.pause();

      // Sync if drifted > 150ms
      if (!pv.paused) {
        const drift = Math.abs(pv.currentTime - offsetInShot);
        if (drift > 0.15) pv.currentTime = offsetInShot;
      }

      if (pv.readyState >= 2) {
        _drawImageCover(ctx, pv, dw, dh);
        _lastDrawnShotId = cur.id;
        return;
      }
    }
    // Video not ready yet — fall through to still
  }

  if (stillUrl) {
    const img = _loadImg(stillUrl);
    if (img.complete && img.naturalWidth) {
      _drawImageCover(ctx, img, dw, dh);
    }
    // else: image still loading — keep previous frame
  } else {
    ctx.clearRect(0, 0, dw, dh);
  }
  _lastDrawnShotId = cur.id;

  // Pause pool videos for shots that are no longer current
  if (_lastDrawnShotId !== cur.id) {
    Object.entries(_videoPool).forEach(([id, v]) => {
      if (id !== cur.id && !v.paused) v.pause();
    });
  }
}

function _drawImageCover(ctx, source, dw, dh) {
  const sw = source.naturalWidth || source.videoWidth || dw;
  const sh = source.naturalHeight || source.videoHeight || dh;
  const scale = Math.max(dw / sw, dh / sh);
  const w = sw * scale, h = sh * scale;
  ctx.drawImage(source, (dw - w) / 2, (dh - h) / 2, w, h);
}

function _livePreviewRafLoop() {
  _drawCanvasFrame();
  if (_livePreviewPlaying) {
    _livePreviewRafId = requestAnimationFrame(_livePreviewRafLoop);
  }
}

function _insertShotAtPlayhead() {
  const audioEl = _livePreviewVideoEl;
  const currentTime = audioEl ? audioEl.currentTime : 0;
  syncFromDOM();
  // Sort shots by timestamp to find the shot before the playhead
  const timed = shots
    .filter(s => s.timestamp)
    .map(s => ({ shot: s, secs: parseTimestamp(s.timestamp) }))
    .filter(s => s.secs !== null)
    .sort((a, b) => a.secs - b.secs);
  // Find the shot whose window contains currentTime (or the last shot before it)
  let prevShot = timed.length ? timed[timed.length - 1].shot : (shots.length ? shots[shots.length - 1] : null);
  for (let i = 0; i < timed.length - 1; i++) {
    if (timed[i].secs <= currentTime && timed[i + 1].secs > currentTime) {
      prevShot = timed[i].shot;
      break;
    }
  }
  if (!prevShot) { showToast('No shots to duplicate — add a shot first.', true); return; }
  const newTs = formatTimestamp(currentTime);
  const idx = shots.findIndex(s => s.id === prevShot.id);
  const dupe = {
    ...prevShot,
    id: genId(),
    timestamp: newTs,
    images: [],
    videoUrl: '',
    motionVideoUrl: '',
    motionDuration: null,
    motionConfig: null,
    composeMeta: prevShot.composeMeta ? { ...prevShot.composeMeta } : null,
    composeLayers: prevShot.composeLayers ? prevShot.composeLayers.map(l => ({ ...l })) : [],
  };
  shots.splice(idx + 1, 0, dupe);
  renderShots(); _syncAnimaticFromLiveShots(); autoSave();
  showToast(`Shot inserted at ${newTs}`);
}

function _toggleAnimaticPlayback() {
  const audioEl = _livePreviewVideoEl;
  if (!audioEl) return;
  const btn = document.getElementById('animatic-play-btn');
  if (_livePreviewPlaying) {
    audioEl.pause();
    Object.values(_videoPool).forEach(v => v.pause());
    _livePreviewPlaying = false;
    if (_livePreviewRafId) { cancelAnimationFrame(_livePreviewRafId); _livePreviewRafId = null; }
    if (btn) btn.textContent = '▶ Play';
  } else {
    audioEl.play().catch(() => {});
    _livePreviewPlaying = true;
    _livePreviewRafId = requestAnimationFrame(_livePreviewRafLoop);
    if (btn) btn.textContent = '⏸ Pause';
  }
}

function _startLiveCanvasPreview(videoEl) {
  _livePreviewVideoEl = videoEl;
  _livePreviewPlaying = false;
  if (_livePreviewRafId) { cancelAnimationFrame(_livePreviewRafId); _livePreviewRafId = null; }

  // When the hidden audio/video ends, stop playback and reset
  videoEl.onended = () => {
    _livePreviewPlaying = false;
    Object.values(_videoPool).forEach(v => { v.pause(); v.currentTime = 0; });
    const btn = document.getElementById('animatic-play-btn');
    if (btn) btn.textContent = '▶ Play';
  };

  // Pre-load all shot images and create pool videos
  if (_animaticTimeline) {
    _animaticTimeline.shots.forEach(s => {
      const live = shots.find(sh => sh.id === s.id);
      if (!live) return;
      if (live.finalImage) _loadImg(live.finalImage);
      if (live.motionVideoUrl || live.videoUrl) _getOrCreatePoolVideo(live);
    });
  }

  // Draw initial frame
  _redrawLiveCanvas = () => { _drawCanvasFrame(); };
  _drawCanvasFrame();

  // Wire timeline click to seek
  const tl = document.getElementById('animatic-timeline');
  if (tl) {
    tl._previewSeekHandler = (e) => {
      if (e.target.closest('.tl-handle')) return;
      const rect = tl.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const { duration } = _animaticTimeline;
      videoEl.currentTime = pct * duration;
      Object.values(_videoPool).forEach(v => { v.pause(); });
      _drawCanvasFrame();
    };
  }
}

function deleteAnimatic(index) {
  animatics.splice(index, 1);
  autoSave();
  renderAnimaticHistory();
}

let _animaticTimeline = null;
let _tlZoom = 1; // timeline zoom level (1 = full width, 2 = 2x, etc.)

function _tlZoomBy(delta, pivotPct) {
  const wrap = document.getElementById('animatic-timeline-scroll');
  if (!wrap) return;
  const prev = _tlZoom;
  _tlZoom = Math.max(1, Math.min(8, _tlZoom * delta));
  // Adjust scroll so the point under cursor stays fixed
  if (pivotPct !== undefined) {
    wrap.scrollLeft = pivotPct * wrap.scrollWidth - (pivotPct * wrap.clientWidth);
  }
  _redrawAnimaticTimeline();
  document.getElementById('tl-zoom-label').textContent = _tlZoom === 1 ? '' : `${_tlZoom.toFixed(1)}×`;
}

function renderAnimaticTimeline(videoEl, animatic) {
  const video = videoEl || document.querySelector('#animatic-history video');
  const wrap = document.getElementById('animatic-timeline-wrap');
  const scrollEl = document.getElementById('animatic-timeline-scroll');
  if (!video || !wrap) return;
  const duration = video.duration;
  if (!duration || !isFinite(duration)) return;

  // Build from live shots — IDs always match the shots array so drag updates land correctly.
  const timedShots = shots
    .filter(s => s.timestamp)
    .map(s => { const secs = parseTimestamp(s.timestamp); return secs !== null ? { id: s.id, secs, lyric: s.lyric || '' } : null; })
    .filter(Boolean)
    .sort((a, b) => a.secs - b.secs);

  if (!timedShots.length) return;
  _animaticTimeline = { duration, shots: timedShots };
  wrap.style.display = '';
  _redrawAnimaticTimeline();

  const tl = document.getElementById('animatic-timeline');
  tl.onclick = (e) => {
    if (e.target.closest('.tl-handle')) return;
    const rect = tl.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pct * duration;
    video.currentTime = newTime; // hidden audio track
    Object.values(_videoPool).forEach(v => { v.pause(); v.currentTime = 0; });
    _drawCanvasFrame();
  };
}

function _redrawAnimaticTimeline() {
  const tl = document.getElementById('animatic-timeline');
  if (!tl || !_animaticTimeline) return;
  tl.style.width = (_tlZoom * 100) + '%';
  const { duration, shots: ts } = _animaticTimeline;
  const colors = ['#141a2e','#0e1a0e','#1e1208','#180e1e','#0c1818'];
  const offset = ts[0].secs;
  tl.innerHTML = ts.map((s, i) => {
    const x1 = (s.secs - offset) / duration * 100;
    const x2 = i + 1 < ts.length ? (ts[i + 1].secs - offset) / duration * 100 : 100;
    const w = Math.max(x2 - x1, 0.2);
    const hasHandle = i > 0;
    return `
      <div style="position:absolute;left:${x1}%;width:${w}%;height:100%;background:${colors[i % colors.length]};border-right:1px solid #222;box-sizing:border-box;overflow:hidden;cursor:pointer" title="Double-click to edit shot" ondblclick="openCompose('${s.id}')">
        <span style="position:absolute;left:5px;top:4px;font-size:9px;color:#555;white-space:nowrap;overflow:hidden;max-width:calc(100% - 8px)">${esc(s.lyric.slice(0, 28))}</span>
        <span style="position:absolute;bottom:4px;left:5px;font-size:8px;color:#383838;font-family:monospace">${formatTimestamp(s.secs)}</span>
      </div>
      ${hasHandle ? `<div class="tl-handle" data-shot-id="${s.id}" style="position:absolute;left:${x1}%;top:0;width:14px;height:100%;margin-left:-7px;z-index:10;display:flex;align-items:center;justify-content:center;pointer-events:none">
        <div style="width:8px;height:100%;display:flex;align-items:center;justify-content:center;cursor:ew-resize;pointer-events:all;touch-action:none" onpointerdown="startTlDrag(event,'${s.id}')">
          <div style="width:2px;height:75%;background:#818cf8;border-radius:1px;pointer-events:none"></div>
        </div>
      </div>` : ''}`;
  }).join('') +
  `<div id="animatic-playhead" style="position:absolute;left:0%;top:0;width:2px;height:100%;background:#f59e0b;pointer-events:none;z-index:20"></div>`;
}

function updateAnimaticPlayhead() {
  const video = _livePreviewVideoEl;
  const ph = document.getElementById('animatic-playhead');
  if (!ph || !video || !_animaticTimeline) return;
  ph.style.left = (video.currentTime / _animaticTimeline.duration * 100) + '%';
  _drawCanvasFrame(); // keep canvas in sync when scrubbing while paused
}

function startTlDrag(e, shotId) {
  e.preventDefault();
  e.stopPropagation();
  const tl = document.getElementById('animatic-timeline');
  if (!tl || !_animaticTimeline) return;
  const { duration, shots: ts } = _animaticTimeline;
  const shotIdx = ts.findIndex(s => s.id === shotId);
  if (shotIdx <= 0) return;

  const tlRect = tl.getBoundingClientRect(); // zoomed element — correct for drag math
  const offset = ts[0].secs;
  const minSecs = ts[shotIdx - 1].secs + 0.3;
  // Last handle: max is end of the video in audio time (offset + video duration)
  const maxSecs = (shotIdx + 1 < ts.length ? ts[shotIdx + 1].secs : offset + duration) - 0.3;

  // Capture handle element now — full redraws during drag destroy it
  const dragHandle = e.target.closest('[data-shot-id]');
  // Store original position before drag so fallback timestamp-matching works in onUp
  const originalSecs = ts[shotIdx].secs;

  const onMove = (ev) => {
    const pct = Math.max(0, Math.min(1, (ev.clientX - tlRect.left) / tlRect.width));
    ts[shotIdx].secs = Math.max(minSecs, Math.min(maxSecs, pct * duration + offset));
    // Move just the handle element; avoid full innerHTML replacement mid-drag
    if (dragHandle && dragHandle.isConnected) {
      dragHandle.style.left = ((ts[shotIdx].secs - offset) / duration * 100) + '%';
    }
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    const newTs = formatTimestamp(ts[shotIdx].secs);


    // Update the animatic snapshot so the handle position survives reload
    if (animatics[0]?.shots) {
      const snap = animatics[0].shots.find(s => s.id === shotId);
      if (snap) snap.timestamp = newTs;
    }

    // Find the live shot via three fallbacks (snapshot IDs may diverge from live IDs
    // after version switches, re-imports, etc.):
    //   1. ID match — exact, works when IDs haven't changed
    //   2. Timestamp match — finds the shot whose current timestamp equals the
    //      original snapshot timestamp (before this drag started)
    //   3. Position match — shot at the same sorted index in the filtered live list
    syncFromDOM();
    const originalTs = formatTimestamp(originalSecs);
    const filteredLive = shots
      .filter(s => s.timestamp)
      .sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));

    let shot = shots.find(s => s.id === shotId);
    if (!shot) shot = shots.find(s => s.timestamp === originalTs);
    if (!shot) shot = filteredLive[shotIdx] || null;

    if (shot) {
      shot.timestamp = newTs;
    } else {
      console.warn('[tlDrag] NO SHOT FOUND — timestamp NOT updated');
    }
    _redrawAnimaticTimeline();
    _redrawLiveCanvas?.();
    renderShots();
    autoSave();

    // Re-render motion videos for shots whose duration just changed.
    // The handle is the LEFT boundary of shot[shotIdx], so shot[shotIdx-1]'s
    // duration changed (its end moved) and shot[shotIdx]'s duration changed too.
    const affectedIds = [ts[shotIdx]?.id, ts[shotIdx - 1]?.id].filter(Boolean);
    for (const affectedId of affectedIds) {
      const affShot = shots.find(s => s.id === affectedId);
      if (!affShot?.motionVideoUrl || !affShot?.motionConfig) continue;
      // Compute new slot duration for this shot
      const sortedTs = shots.filter(s => s.timestamp).map(s => ({ id: s.id, secs: parseTimestamp(s.timestamp) })).filter(s => s.secs !== null).sort((a, b) => a.secs - b.secs);
      const affIdx = sortedTs.findIndex(s => s.id === affectedId);
      if (affIdx < 0) continue;
      const affSecs = sortedTs[affIdx].secs;
      const nextSecs = sortedTs[affIdx + 1]?.secs ?? (affSecs + (affShot.motionConfig.durationSecs || 4));
      const newDur = Math.max(0.5, nextSecs - affSecs);
      // Clear video immediately and show still while re-rendering in background
      const prevUrl = affShot.motionVideoUrl;
      affShot.motionVideoUrl = '';
      renderShots();
      autoSave();
      (async () => {
        try {
          const imgUrl = affShot.finalImage || affShot.images?.[0];
          if (!imgUrl) { affShot.motionVideoUrl = prevUrl; return; }
          const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = imgUrl; });
          const blob = await _renderMotionVideoBlob(img, affShot.motionConfig, newDur, null);
          const b64 = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.readAsDataURL(blob); });
          const uploadData = await apiFetch('/api/upload-video', { base64: b64, mediaType: 'video/webm', projectId: currentProjectId, shotId: affectedId });
          affShot.motionVideoUrl = uploadData.url;
          affShot.motionConfig = { ...affShot.motionConfig, durationSecs: newDur };
          _syncAnimaticFromLiveShots();
          renderShots();
          autoSave();
          showToast('Motion video updated for resized shot.');
        } catch(e) {
          affShot.motionVideoUrl = prevUrl; // restore on failure
          console.warn('motion re-render failed', e.message);
        }
      })();
    }
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
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

function charRefGalleryHTML(c) {
  const refs = c.refImages || [];
  const thumbs = refs.map(r => {
    const src = r.url || r.dataUrl || '';
    const isSelected = r.id === c.selectedRefImageId;
    return `<div style="position:relative;flex-shrink:0">
      <img src="${esc(src)}" onclick="selectCharRefImage('${c.id}','${r.id}')" title="${isSelected ? 'Default view (click to deselect)' : 'Click to use as default view'}"
        style="width:52px;height:52px;object-fit:cover;border-radius:4px;cursor:pointer;border:2px solid ${isSelected ? '#4ade80' : '#2a2a2a'};display:block">
      <button onclick="removeCharRefImage('${c.id}','${r.id}',event)" style="position:absolute;top:-5px;right:-5px;background:#222;border:none;border-radius:50%;color:#888;font-size:9px;width:15px;height:15px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
    </div>`;
  }).join('');
  const loraBtn = refs.length >= 2
    ? `<button onclick="trainCharacterLora('${c.id}')" style="margin-top:4px;width:100%;background:${c.loraStatus === 'ready' ? '#162a1a' : c.loraStatus === 'training' ? '#1a1610' : 'none'};border:1px solid ${c.loraStatus === 'ready' ? '#4ade80' : c.loraStatus === 'training' ? '#a8830a' : '#2a2a2a'};border-radius:4px;color:${c.loraStatus === 'ready' ? '#4ade80' : c.loraStatus === 'training' ? '#d4a017' : '#666'};font-size:10px;padding:4px 6px;cursor:pointer;white-space:nowrap">
        ${c.loraStatus === 'ready' ? '✓ Model Trained' : c.loraStatus === 'training' ? '⏳ Training…' : c.loraStatus === 'error' ? '⚠ Retry Training' : '🧠 Train Character Model'}
      </button>` : '';
  return `<div style="display:flex;flex-direction:column;gap:6px">
    <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:flex-start">
      ${thumbs}
      <label style="width:52px;height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px dashed #2a2a2a;border-radius:4px;cursor:pointer;color:#555;font-size:9px;gap:2px;flex-shrink:0">
        <span style="font-size:16px;line-height:1">+</span><span>Add</span>
        <input type="file" accept="image/*" multiple style="display:none" onchange="handleCharRefImagesUpload('${c.id}',this)">
      </label>
    </div>
    <button onclick="openImageLibrary('char','${c.id}')" style="background:none;border:1px solid #2a2a2a;border-radius:4px;color:#666;font-size:10px;padding:3px 6px;cursor:pointer;text-align:left">🖼 Library</button>
    ${loraBtn}
  </div>`;
}

function charRowHTML(c) {
  const frontUrl = charDefaultImage(c);
  const frontHTML = frontUrl
    ? `<img src="${esc(frontUrl)}" alt="Front">`
    : `<span class="placeholder">·</span>`;
  return `<tr data-id="${c.id}">
    <td>
      <div style="display:flex;flex-direction:column;gap:4px">
        <input type="text" class="field-name" placeholder="Name…" value="${esc(c.name)}" oninput="debouncedSave()">
        ${c.missingFromScript ? `<div class="missing-from-script-flag">Missing from script — <button onclick="deleteCharacter('${c.id}')" style="background:none;border:none;color:#e05050;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Delete?</button> — <button onclick="dismissMissingFlag('char','${c.id}')" style="background:none;border:none;color:#555;cursor:pointer;padding:0;font-size:10px;text-decoration:underline">Dismiss</button></div>` : ''}
        <button class="btn-toggle-angles btn-var-inline" onclick="toggleCharAngles('${c.id}')" style="align-self:flex-start;background:none;border:1px solid #222;border-radius:4px;color:#555;font-size:10px;padding:3px 6px;cursor:pointer;white-space:nowrap">▶ Variations</button>
      </div>
    </td>
    <td data-label="Description"><div class="field-ref ref-rich" contenteditable="true" data-placeholder="Describe appearance, style, mood…" oninput="debouncedSave()">${c.reference || ''}</div></td>
    <td data-label="Reference Images">${charRefGalleryHTML(c)}</td>
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
    <td data-label="Final Image">
      <div class="char-front-wrap">
        <div class="char-front-slot" id="char-front-${c.id}">${frontHTML}</div>
        <datalist id="expr-opts-${c.id}">
          <option value="happy and smiling">
          <option value="sad and downcast">
          <option value="wide-eyed and surprised with mouth slightly open">
          <option value="playful wink with one eye closed and a slight smile">
          <option value="angry with furrowed brows and a frown">
          <option value="neutral">
        </datalist>
        <div style="display:flex;gap:4px;margin-top:4px">
          <input type="text" class="expr-select" id="expr-${c.id}" list="expr-opts-${c.id}" placeholder="Expression…" style="flex:1;min-width:0;font-size:11px;background:#0e0e0e;border:1px solid #1a1a1a;color:#aaa;border-radius:3px;padding:4px 6px;box-sizing:border-box">
          <button onclick="applyCharExpression('${c.id}')" title="Apply expression" style="padding:4px 7px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:3px;color:#818cf8;font-size:12px;cursor:pointer;flex-shrink:0;line-height:1">▶</button>
        </div>
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
    const effectiveImg = d.useRef && refImg ? (refImg.dataUrl || refImg.url) : d.image;
    const imgHTML = effectiveImg
      ? `<img src="${esc(effectiveImg)}" alt="${esc(angle)}">`
      : `<span class="placeholder">·</span>`;
    const labelHTML = isMirror
      ? `${esc(angle)} <span style="color:#555;font-size:9px">🪞</span>`
      : esc(angle);
    const refHtml = refImg
      ? `<div style="position:relative;display:inline-block">
           <img src="${esc(refImg.dataUrl || refImg.url)}" alt="ref" style="width:40px;height:40px;object-fit:cover;border-radius:3px;cursor:pointer;outline:${d.useRef ? '2px solid #4ade80' : 'none'}" onclick="toggleCharAngleUseRef('${c.id}','${angle}')" title="${d.useRef ? 'Using ref as image (click to revert)' : 'Click to use as image'}">
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
        <div style="display:flex;gap:4px;margin-top:5px">
          <button onclick="triggerLocImageUpload('${l.id}')" style="flex:1;background:none;border:1px solid #2a2a2a;border-radius:4px;color:#666;font-size:10px;padding:3px 6px;cursor:pointer">⬆ Upload</button>
          <button onclick="openLocImageLibrary('${l.id}')" style="flex:1;background:none;border:1px solid #2a2a2a;border-radius:4px;color:#666;font-size:10px;padding:3px 6px;cursor:pointer">🖼 Library</button>
        </div>
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
      <button class="btn-ord" onclick="duplicateShot('${s.id}')" title="Duplicate shot" style="color:#818cf8;border-color:#2a2a45">⎘</button>
      <button class="btn-ord" onclick="deleteShot('${s.id}')" title="Delete shot" style="color:#e05050;border-color:#4a1a1a">✕</button>
    </div></td>
    <td class="shot-card-timestamp" style="text-align:center">
      <input type="text" class="field-timestamp" placeholder="0:00" value="${esc(s.timestamp || '')}" data-shot-id="${esc(s.id)}" oninput="debouncedSave();onTimestampInput(this)" style="width:60px;font-size:11px;font-family:monospace;background:#0e0e0e;border:1px solid #1a1a1a;color:#aaa;border-radius:3px;padding:3px 5px">
      ${s.timestampIssue === 'missing' ? `<div style="margin-top:3px;font-size:9px;color:#e05050;font-weight:600;line-height:1.2">Missing<br>Timestamp</div>` : ''}
      ${s.timestampIssue === 'inaccurate' ? `<div style="margin-top:3px;font-size:9px;color:#f59e0b;font-weight:600;line-height:1.2">Timestamp<br>Inaccuracy</div>` : ''}
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
${s.locationId ? `<button class="btn-loc-variation${s.locationAngleKey ? ' btn-loc-variation-set' : ''}" onclick="openLocVariationPicker('${s.id}')" title="Choose location variation">${s.locationAngleKey ? '⬛ Variation set' : '⬛ Choose variation'}</button>` : ''}
<div class="shot-ref-zone" onclick="triggerShotRefUpload('${s.id}')" title="Reference photo — overrides location when generating images">
  ${s.refImage
    ? `<img src="${esc(s.refImage.dataUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:3px"><button class="shot-ref-remove" onclick="removeShotRefImage('${s.id}',event)">✕</button>`
    : `<span>📷</span><span style="font-size:8px">Ref</span>`}
</div>
<input type="file" id="shotref-${s.id}" accept="image/*" capture="environment" style="display:none" onchange="handleShotRefUpload('${s.id}',this)"></td>
    <td class="shot-card-size" data-label="Size"><select class="field-size" onchange="autoSave()">${sizeOpts}</select></td>
    <td class="shot-card-movement" data-label="Movement"><select class="field-movement" onchange="autoSave()">${moveOpts}</select></td>
    <td data-label="Image Prompt"><textarea class="field-imgprompt" rows="3" placeholder="Image prompt (opening frame)…" oninput="debouncedSave()">${esc(s.imagePrompt)}</textarea></td>
    <td data-label="Video Prompt"><textarea class="field-vidprompt" rows="3" placeholder="Video prompt (action + camera movement)…" oninput="debouncedSave()">${esc(s.videoPrompt)}</textarea>
      ${s.motionVideoUrl ? (() => { const timedSorted = shots.filter(sh=>sh.timestamp).map(sh=>({id:sh.id,secs:parseTimestamp(sh.timestamp)})).filter(sh=>sh.secs!==null).sort((a,b)=>a.secs-b.secs); const myIdx=timedSorted.findIndex(sh=>sh.id===s.id); const slotDur = myIdx>=0&&timedSorted[myIdx+1] ? (timedSorted[myIdx+1].secs-timedSorted[myIdx].secs) : null; return `<div style="margin-top:4px;display:flex;align-items:center;gap:6px"><label style="font-size:10px;color:#555;white-space:nowrap">Motion duration (s):</label><input type="number" class="field-motion-duration" min="0.5" step="0.5" value="${esc(String(s.motionDuration ?? (slotDur ? slotDur.toFixed(1) : '')))}\" placeholder="${slotDur ? slotDur.toFixed(1) : 'full clip'}" style="width:70px;background:#111;border:1px solid #222;border-radius:4px;color:#888;font-size:11px;padding:2px 6px" oninput="debouncedSave()" title="Seconds of motion before holding last frame. Defaults to shot slot length."></div>`; })() : ''}
    </td>
    <td data-label="Generated Images"><div class="images-grid" id="shot-imgs-${s.id}">${imgsHTML}</div></td>
    <td>
      <div class="final-image-cell" id="final-img-${s.id}">
        ${(() => {
          const loc = locations.find(l => l.id === s.locationId);
          const locImg = s.locationAngleKey ? locVariationImage(loc, s.locationAngleKey) : locDefaultImage(loc);
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
let _audioBeats = null;      // array of beat timestamps in seconds (music mode only)
let _isMusicPiece = false;
let _audioBarOffset = 0;     // time of first bar marker (seconds)
let _audioBarInterval = 0;   // time between bar markers (seconds)
let _dragMarkerIdx = null;   // index of marker being dragged
let _dragTimelineRect = null;

function _audioKey() { return `audio-${currentProjectId || 'default'}`; }
function _audioVersionKey(label) { return `audio-${currentProjectId || 'default'}-v-${label}`; }

async function _saveAudio(file) {
  try {
    await idbSet(_audioKey() + '-file', file);
    if (currentVersionLabel) await idbSet(_audioVersionKey(currentVersionLabel) + '-file', file);
  } catch(e) { console.warn('audio save failed', e); }
}

async function _saveTranscript(words) {
  try {
    await idbSet(_audioKey() + '-transcript', words);
    if (currentVersionLabel) await idbSet(_audioVersionKey(currentVersionLabel) + '-transcript', words);
  } catch(e) { console.warn('transcript save failed', e); }
}

async function _saveBeats(beats) {
  try {
    await idbSet(_audioKey() + '-beats', beats);
    if (currentVersionLabel) await idbSet(_audioVersionKey(currentVersionLabel) + '-beats', beats);
  } catch(e) { console.warn('beats save failed', e); }
}

async function _saveMusicMode(val) {
  try {
    await idbSet(_audioKey() + '-musicMode', val);
    if (currentVersionLabel) await idbSet(_audioVersionKey(currentVersionLabel) + '-musicMode', val);
  } catch(e) { console.warn('musicMode save failed', e); }
}

// Called when switching versions — snaps current audio to the outgoing version key, then loads
// audio for the incoming version (falls back to project-level key for old versions).
async function _snapshotCurrentAudio() {
  if (!currentVersionLabel) return;
  try {
    const file  = await idbGet(_audioKey() + '-file');
    const words = await idbGet(_audioKey() + '-transcript');
    const beats = await idbGet(_audioKey() + '-beats');
    const mode  = await idbGet(_audioKey() + '-musicMode');
    if (file)  await idbSet(_audioVersionKey(currentVersionLabel) + '-file', file);
    if (words) await idbSet(_audioVersionKey(currentVersionLabel) + '-transcript', words);
    if (beats) await idbSet(_audioVersionKey(currentVersionLabel) + '-beats', beats);
    if (mode !== undefined) await idbSet(_audioVersionKey(currentVersionLabel) + '-musicMode', mode);
  } catch(e) { console.warn('audio snapshot failed', e); }
}

async function _restoreVersionAudio(label) {
  clearAudioState();
  try {
    const vKey = _audioVersionKey(label);
    const file  = await idbGet(vKey + '-file')       || await idbGet(_audioKey() + '-file');
    const words = await idbGet(vKey + '-transcript') || await idbGet(_audioKey() + '-transcript');
    const beats = await idbGet(vKey + '-beats')      || await idbGet(_audioKey() + '-beats');
    const mode  = await idbGet(vKey + '-musicMode');
    const transcriptBox = document.getElementById('audio-transcript');
    const statusEl = document.getElementById('audio-upload-status');
    if (file) { _setAudioSrc(URL.createObjectURL(file)); }
    _isMusicPiece = !!mode;
    _audioBeats = beats || null;
    const cb = document.getElementById('music-piece-cb');
    if (cb) cb.checked = _isMusicPiece;
    if (words?.length) {
      _audioTranscript = words;
      _renderAudioTranscriptBox(words, beats);
      if (statusEl) { statusEl.textContent = _audioStatusText(words.length, beats); statusEl.className = 'upload-status done'; }
    } else if (beats?.length) {
      _renderAudioTranscriptBox(null, beats);
      if (statusEl) { statusEl.textContent = _audioStatusText(0, beats); statusEl.className = 'upload-status done'; }
    }
    if (beats?.length) _updateBarFromBeats(beats);
  } catch(e) { console.warn('restoreVersionAudio failed', e); }
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
  const section = document.getElementById('audio-section-player');
  if (section) section.src = src;
  const wrap = document.getElementById('audio-player-wrap');
  if (wrap) wrap.style.display = '';
}

// ── Section audio player ──────────────────────────────────────────────────────

function _fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}

function _updateSectionPlayerTime(player) {
  const el = document.getElementById('audio-section-time');
  if (el) el.textContent = _fmtTime(player.currentTime) + ' / ' + _fmtTime(player.duration);
  const dur = player.duration || 1;
  const pct = (player.currentTime / dur) * 100;
  const prog = document.getElementById('audio-bar-progress');
  if (prog) prog.style.width = pct + '%';
  const head = document.getElementById('audio-bar-playhead');
  if (head) head.style.left = pct + '%';
}

function _onSectionPlayerEnded() {
  const btn = document.getElementById('audio-section-play-btn');
  if (btn) btn.textContent = '▶';
}

function _onSectionPlayerLoaded() {
  const player = document.getElementById('audio-section-player');
  if (player) _updateSectionPlayerTime(player);
  _renderBarMarkers();
}

function toggleSectionAudioPlayback() {
  const player = document.getElementById('audio-section-player');
  const btn = document.getElementById('audio-section-play-btn');
  if (!player) return;
  if (player.paused) { player.play(); if (btn) btn.textContent = '⏸'; }
  else { player.pause(); if (btn) btn.textContent = '▶'; }
}

function onTimelineMouseDown(e) {
  if (e.target.closest('.bar-marker')) return;
  const timeline = document.getElementById('audio-bar-timeline');
  const player = document.getElementById('audio-section-player');
  if (!timeline || !player || !player.duration) return;
  const rect = timeline.getBoundingClientRect();
  const t = ((e.clientX - rect.left) / rect.width) * player.duration;
  player.currentTime = Math.max(0, Math.min(t, player.duration));
}

function _computeBarTimes() {
  if (!_audioBarInterval || _audioBarInterval < 0.05) return [];
  const player = document.getElementById('audio-section-player');
  const duration = player?.duration;
  if (!duration || isNaN(duration) || duration <= 0) return [];
  const times = [];
  for (let t = _audioBarOffset; t < duration + _audioBarInterval * 0.4; t += _audioBarInterval) {
    times.push(parseFloat(t.toFixed(3)));
  }
  return times;
}

function _renderBarMarkers() {
  const timeline = document.getElementById('audio-bar-timeline');
  if (!timeline) return;
  timeline.querySelectorAll('.bar-marker').forEach(m => m.remove());
  const player = document.getElementById('audio-section-player');
  const duration = player?.duration;
  if (!duration || isNaN(duration) || !_audioBarInterval) return;
  const barTimes = _computeBarTimes();
  barTimes.forEach((t, i) => {
    if (t < 0 || t > duration * 1.02) return;
    const pct = Math.min(100, (t / duration) * 100);
    const m = document.createElement('div');
    m.className = 'bar-marker';
    m.dataset.idx = i;
    m.style.cssText = `position:absolute;top:0;left:${pct}%;width:2px;height:100%;background:#f59e0b;transform:translateX(-1px);cursor:ew-resize;z-index:2;`;
    // Wide hit target
    const hit = document.createElement('div');
    hit.style.cssText = 'position:absolute;top:0;left:-5px;width:12px;height:100%;cursor:ew-resize;';
    m.appendChild(hit);
    // Bar number label above
    const lbl = document.createElement('div');
    lbl.style.cssText = 'position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:8px;color:#f59e0b;white-space:nowrap;pointer-events:none;';
    lbl.textContent = i + 1;
    m.appendChild(lbl);
    m.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      _dragMarkerIdx = i;
      _dragTimelineRect = timeline.getBoundingClientRect();
    });
    timeline.appendChild(m);
  });
}

function _updateBarFromBeats(beats) {
  if (!beats?.length) return;
  _audioBarOffset = beats[0];
  if (beats.length >= 2) {
    const diffs = [];
    for (let i = 1; i < beats.length; i++) diffs.push(beats[i] - beats[i - 1]);
    diffs.sort((a, b) => a - b);
    _audioBarInterval = diffs[Math.floor(diffs.length / 2)];
  }
  const inp = document.getElementById('audio-bar-interval');
  if (inp) inp.value = _audioBarInterval.toFixed(2);
  const lbl = document.getElementById('audio-bar-interval-label');
  if (lbl) lbl.style.display = 'flex';
  _renderBarMarkers();
}

function onBarIntervalInput(val) {
  const v = parseFloat(val);
  if (!isFinite(v) || v < 0.05) return;
  _audioBarInterval = v;
  _renderBarMarkers();
  _audioBeats = _computeBarTimes();
  _saveBeats(_audioBeats);
  _renderAudioTranscriptBox(_audioTranscript, _audioBeats);
  if (_isMusicPiece && _audioBeats?.length) matchBeatsToShots();
}

// Drag handlers (document-level so drag works outside timeline bounds)
document.addEventListener('mousemove', e => {
  if (_dragMarkerIdx === null || !_dragTimelineRect) return;
  const player = document.getElementById('audio-section-player');
  const duration = player?.duration;
  if (!duration || isNaN(duration)) return;
  const x = Math.max(0, Math.min(e.clientX - _dragTimelineRect.left, _dragTimelineRect.width));
  const t = (x / _dragTimelineRect.width) * duration;
  if (_dragMarkerIdx === 0) {
    _audioBarOffset = Math.max(0, t);
  } else {
    const newInterval = (t - _audioBarOffset) / _dragMarkerIdx;
    if (newInterval > 0.05) _audioBarInterval = newInterval;
  }
  const inp = document.getElementById('audio-bar-interval');
  if (inp) inp.value = _audioBarInterval.toFixed(2);
  _renderBarMarkers();
});

document.addEventListener('mouseup', () => {
  if (_dragMarkerIdx !== null) {
    _dragMarkerIdx = null;
    _dragTimelineRect = null;
    _audioBeats = _computeBarTimes();
    _saveBeats(_audioBeats);
    _renderAudioTranscriptBox(_audioTranscript, _audioBeats);
    if (_isMusicPiece && _audioBeats?.length) matchBeatsToShots();
  }
});

function clearAudioState() {
  _audioTranscript = null;
  _audioBeats = null;
  _isMusicPiece = false;
  const cb = document.getElementById('music-piece-cb');
  if (cb) cb.checked = false;
  const pinned = document.getElementById('pinned-audio-player');
  if (pinned) { pinned.pause(); pinned.src = ''; }
  const bar = document.getElementById('pinned-audio-bar');
  if (bar) { bar.style.display = 'none'; bar.dataset.hidden = ''; }
  document.body.classList.remove('has-pinned-audio');
  const hideBtn = document.getElementById('btn-pinned-toggle');
  const showBtn = document.getElementById('btn-pinned-expand');
  if (hideBtn) hideBtn.style.display = '';
  if (showBtn) showBtn.style.display = 'none';
  const lw = document.getElementById('audio-transcript-lyrics-wrap');
  const bw = document.getElementById('audio-transcript-beats-wrap');
  if (lw) { lw.style.display = 'none'; const b = document.getElementById('audio-transcript-lyrics'); if (b) b.value = ''; }
  if (bw) { bw.style.display = 'none'; const b = document.getElementById('audio-transcript-beats'); if (b) b.value = ''; }
  const statusEl = document.getElementById('audio-upload-status');
  if (statusEl) { statusEl.textContent = 'MP3, WAV, M4A, MP4…'; statusEl.className = 'upload-status'; }
  // Reset section player
  const sectionPlayer = document.getElementById('audio-section-player');
  if (sectionPlayer) { sectionPlayer.pause(); sectionPlayer.src = ''; }
  const playerWrap = document.getElementById('audio-player-wrap');
  if (playerWrap) playerWrap.style.display = 'none';
  const timeEl = document.getElementById('audio-section-time');
  if (timeEl) timeEl.textContent = '0:00 / 0:00';
  const playBtn = document.getElementById('audio-section-play-btn');
  if (playBtn) playBtn.textContent = '▶';
  const intervalLbl = document.getElementById('audio-bar-interval-label');
  if (intervalLbl) intervalLbl.style.display = 'none';
  const intervalInp = document.getElementById('audio-bar-interval');
  if (intervalInp) intervalInp.value = '';
  const timeline = document.getElementById('audio-bar-timeline');
  if (timeline) timeline.querySelectorAll('.bar-marker').forEach(m => m.remove());
  const prog = document.getElementById('audio-bar-progress');
  if (prog) prog.style.width = '0';
  const head = document.getElementById('audio-bar-playhead');
  if (head) head.style.left = '0';
  _audioBarOffset = 0;
  _audioBarInterval = 0;
}

async function restoreAudio() {
  clearAudioState();
  try {
    const file  = await idbGet(_audioKey() + '-file');
    const words = await idbGet(_audioKey() + '-transcript');
    const beats = await idbGet(_audioKey() + '-beats');
    const mode  = await idbGet(_audioKey() + '-musicMode');
    const transcriptBox = document.getElementById('audio-transcript');
    const statusEl = document.getElementById('audio-upload-status');
    if (file) { _setAudioSrc(URL.createObjectURL(file)); }
    _isMusicPiece = !!mode;
    _audioBeats = beats || null;
    const cb = document.getElementById('music-piece-cb');
    if (cb) cb.checked = _isMusicPiece;
    if (words?.length) {
      _audioTranscript = words;
      _renderAudioTranscriptBox(words, beats);
      if (statusEl) { statusEl.textContent = _audioStatusText(words.length, beats); statusEl.className = 'upload-status done'; }
    } else if (beats?.length) {
      _renderAudioTranscriptBox(null, beats);
      if (statusEl) { statusEl.textContent = _audioStatusText(0, beats); statusEl.className = 'upload-status done'; }
    }
    if (beats?.length) _updateBarFromBeats(beats);
  } catch(e) { console.warn('restoreAudio failed', e); }
}

function onMusicPieceCbChange() {
  const cb = document.getElementById('music-piece-cb');
  _isMusicPiece = cb ? cb.checked : false;
}

function _audioStatusText(wordCount, beats) {
  const parts = [];
  if (beats?.length) parts.push(`${beats.length} downbeats detected`);
  if (wordCount) parts.push(`${wordCount} words transcribed`);
  return parts.join(' · ') || 'Done';
}

function _renderAudioTranscriptBox(words, beats) {
  const lyricsWrap = document.getElementById('audio-transcript-lyrics-wrap');
  const lyricsBox  = document.getElementById('audio-transcript-lyrics');
  const beatsWrap  = document.getElementById('audio-transcript-beats-wrap');
  const beatsBox   = document.getElementById('audio-transcript-beats');

  // Lyrics box: one line per word with its timestamp
  if (lyricsBox) {
    if (words?.length) {
      lyricsBox.value = words.map(w => `[${formatTimestamp(w.start)}] ${w.word}`).join('\n');
      if (lyricsWrap) lyricsWrap.style.display = '';
    } else {
      lyricsBox.value = '';
      if (lyricsWrap) lyricsWrap.style.display = 'none';
    }
  }

  // Beats box: one line per downbeat — timestamp followed by lyrics that fall in that beat interval
  if (beatsBox) {
    if (beats?.length) {
      const lines = beats.map((b, i) => {
        const nextBeat = beats[i + 1] ?? Infinity;
        const beatWords = (words || [])
          .filter(w => w.start >= b && w.start < nextBeat)
          .map(w => w.word.trim())
          .join(' ');
        return `[${formatTimestamp(b)}] ${beatWords}`;
      });
      beatsBox.value = lines.join('\n');
      if (beatsWrap) beatsWrap.style.display = '';
    } else {
      beatsBox.value = '';
      if (beatsWrap) beatsWrap.style.display = 'none';
    }
  }
}

// Beat detection: onset strength (positive energy flux on low-passed signal) + adaptive peak picking
function detectBeatsFromPCM(pcm, sampleRate) {
  // IIR low-pass ~200 Hz to isolate kick/bass
  const alpha = (2 * Math.PI * 200) / (2 * Math.PI * 200 + sampleRate);
  const lp = new Float32Array(pcm.length);
  lp[0] = Math.abs(pcm[0]);
  for (let i = 1; i < pcm.length; i++) lp[i] = alpha * Math.abs(pcm[i]) + (1 - alpha) * lp[i - 1];

  // RMS energy per ~23ms hop
  const HOP = Math.max(1, Math.round(sampleRate * 0.023));
  const WIN = HOP * 2;
  const nFrames = Math.floor((lp.length - WIN) / HOP);
  const energy = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let e = 0;
    const s = i * HOP;
    for (let j = 0; j < WIN; j++) e += lp[s + j] ** 2;
    energy[i] = Math.sqrt(e / WIN);
  }

  // Onset strength: positive energy flux
  const flux = new Float32Array(nFrames);
  for (let i = 1; i < nFrames; i++) flux[i] = Math.max(0, energy[i] - energy[i - 1]);

  // Adaptive peak picking: must exceed local mean + 1.2*std, be a local max, min 250ms apart
  const localW = Math.round(sampleRate / HOP); // ~1s of frames
  const minDistFrames = Math.round(0.25 * sampleRate / HOP);
  const beats = [];
  for (let i = localW; i < nFrames - localW; i++) {
    let sum = 0, sum2 = 0;
    for (let j = i - localW; j <= i + localW; j++) { sum += flux[j]; sum2 += flux[j] ** 2; }
    const n = 2 * localW + 1;
    const mean = sum / n;
    const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    if (flux[i] < mean + std * 1.2) continue;
    // Local peak in ±4 frames
    let isPeak = true;
    for (let j = Math.max(0, i - 4); j <= Math.min(nFrames - 1, i + 4); j++) {
      if (j !== i && flux[j] >= flux[i]) { isPeak = false; break; }
    }
    if (!isPeak) continue;
    const t = parseFloat((i * HOP / sampleRate).toFixed(3));
    if (beats.length === 0 || t - beats[beats.length - 1] >= 0.25) beats.push(t);
  }
  return beats;
}

// Given all detected beat positions, return only the downbeats (beat 1 of each 4/4 bar).
//
// Uses a time-based bar grid rather than index-based grouping, so a missed or
// doubled beat anywhere in the song doesn't cascade into wrong phase for the rest.
//
// Algorithm:
//  1. Estimate beat period T from the median inter-beat interval.
//  2. Bar period B = 4T.
//  3. Try all 4 phase offsets (0, T, 2T, 3T from the first beat).
//     For each, project a regular bar grid and sum the bass onset flux at each
//     grid point (with a ±50ms window to tolerate beat jitter).
//  4. The phase whose grid points land consistently on high-flux moments = downbeat.
//  5. Return one detected beat per bar, snapped to the nearest beat within ±T/2.
function findDownbeats(beats, pcm, sampleRate) {
  if (beats.length < 4) return beats;

  // Median inter-beat interval → quarter-note period T
  const ibi = [];
  for (let i = 1; i < beats.length; i++) ibi.push(beats[i] - beats[i - 1]);
  ibi.sort((a, b) => a - b);
  const T = ibi[Math.floor(ibi.length / 2)];
  const B = 4 * T; // bar period

  // Build low-pass onset flux (same filter as detectBeatsFromPCM)
  const HOP = Math.max(1, Math.round(sampleRate * 0.023));
  const WIN = HOP * 2;
  const nFrames = Math.floor((pcm.length - WIN) / HOP);
  const alpha = (2 * Math.PI * 200) / (2 * Math.PI * 200 + sampleRate);
  const lp = new Float32Array(pcm.length);
  lp[0] = Math.abs(pcm[0]);
  for (let i = 1; i < pcm.length; i++) lp[i] = alpha * Math.abs(pcm[i]) + (1 - alpha) * lp[i - 1];
  const energy = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let e = 0; const s = i * HOP;
    for (let j = 0; j < WIN; j++) e += lp[s + j] ** 2;
    energy[i] = Math.sqrt(e / WIN);
  }
  const flux = new Float32Array(nFrames);
  for (let i = 1; i < nFrames; i++) flux[i] = Math.max(0, energy[i] - energy[i - 1]);

  // Max flux within ±window_s seconds of time t (tolerates beat timing jitter)
  const searchHalfFrames = Math.round(Math.min(0.05, T * 0.35) * sampleRate / HOP);
  const fluxAt = t => {
    const c = Math.round(t * sampleRate / HOP);
    let max = 0;
    for (let j = Math.max(0, c - searchHalfFrames); j <= Math.min(nFrames - 1, c + searchHalfFrames); j++) {
      if (flux[j] > max) max = flux[j];
    }
    return max;
  };

  // Score all 4 phase offsets using the regular bar grid
  const end = beats[beats.length - 1] + B;
  const phaseScore = [0, 1, 2, 3].map(phase => {
    const start = beats[0] + phase * T;
    let sum = 0, count = 0;
    for (let t = start; t <= end; t += B) { sum += fluxAt(t); count++; }
    return count > 0 ? sum / count : 0;
  });

  const bestPhase = phaseScore.indexOf(Math.max(...phaseScore));
  const gridStart = beats[0] + bestPhase * T;

  // Snap each bar-grid position to the nearest detected beat within ±T*0.55
  const snapRadius = T * 0.55;
  const downbeats = [];
  const used = new Set();
  for (let t = gridStart; t <= end; t += B) {
    let nearest = null, nearestDist = snapRadius;
    for (const b of beats) {
      const d = Math.abs(b - t);
      if (d < nearestDist && !used.has(b)) { nearest = b; nearestDist = d; }
    }
    if (nearest !== null) { downbeats.push(nearest); used.add(nearest); }
  }
  downbeats.sort((a, b) => a - b);
  return downbeats.length > 0 ? downbeats : beats.filter((_, i) => i % 4 === 0);
}

// Assign shot timestamps to detected beats. Lyric shots snap to the beat nearest
// their transcript match; blank/instrumental shots fill remaining beats evenly.
function matchBeatsToShots() {
  if (!_audioBeats?.length || !shots.length) return;
  syncFromDOM();
  shots.forEach(s => { delete s.timestampIssue; s.timestamp = ''; });

  const beats = _audioBeats;
  const n = shots.length;

  // Initial even distribution: shot i → beat at index round(i/(n-1) * (beats.length-1))
  for (let i = 0; i < n; i++) {
    const bi = Math.min(Math.round(i / Math.max(n - 1, 1) * (beats.length - 1)), beats.length - 1);
    shots[i].timestamp = formatTimestamp(beats[bi]);
  }

  // Lyric refinement: snap to beat nearest the transcript word match
  if (_audioTranscript?.length) {
    const beatInterval = beats.length > 1 ? (beats[beats.length - 1] - beats[0]) / (beats.length - 1) : 1;
    shots.forEach(shot => {
      if (!shot.lyric?.trim()) return;
      const approxSecs = parseTimestamp(shot.timestamp);
      if (approxSecs == null) return;
      const searchWindow = beatInterval * 4;
      const lyricWords = shot.lyric.trim().toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(Boolean);
      let bestSecs = null;
      for (const w of _audioTranscript) {
        if (Math.abs(w.start - approxSecs) > searchWindow) continue;
        const tw = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (lyricWords.some(lw => lw.length > 2 && (tw === lw || tw.startsWith(lw) || lw.startsWith(tw)))) {
          if (bestSecs === null || Math.abs(w.start - approxSecs) < Math.abs(bestSecs - approxSecs)) bestSecs = w.start;
        }
      }
      if (bestSecs !== null) {
        // Snap to nearest beat
        const nearest = beats.reduce((b, c) => Math.abs(c - bestSecs) < Math.abs(b - bestSecs) ? c : b);
        shot.timestamp = formatTimestamp(nearest);
      }
    });
  }

  autoSave();
  renderShots();
}

const WHISPER_LIMIT = 24 * 1024 * 1024; // 24MB
const CHUNK_SECS = 600; // 10-minute chunks at 16kHz mono = ~19MB each

function pcmToWavFile(pcm, sampleRate, offsetSecs) {
  const wavBuf = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(wavBuf);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true);
  str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  let off = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
  }
  return new File([wavBuf], `chunk_${offsetSecs}.wav`, { type: 'audio/wav' });
}

async function decodeToMono16k(file) {
  const ctx = new AudioContext();
  const audioBuf = await ctx.decodeAudioData(await file.arrayBuffer());
  await ctx.close();
  const sampleRate = 16000;
  const frameCount = Math.ceil(audioBuf.duration * sampleRate);
  const offline = new OfflineAudioContext(1, frameCount, sampleRate);
  const src = offline.createBufferSource();
  src.buffer = audioBuf;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0); // Float32Array at 16kHz mono
}

async function transcribeChunk(pcm, sampleRate, offsetSecs) {
  const file = pcmToWavFile(pcm, sampleRate, offsetSecs);
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/transcribe-audio', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  // Shift word timestamps by chunk offset
  return (data.words || []).map(w => ({ word: w.word, start: w.start + offsetSecs, end: w.end + offsetSecs }));
}

async function handleAudioUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('audio-upload-status');
  const transcriptBox = document.getElementById('audio-transcript');
  const cb = document.getElementById('music-piece-cb');
  _isMusicPiece = cb ? cb.checked : false;
  await _saveAudio(file);
  await _saveMusicMode(_isMusicPiece);
  _audioTranscript = [];
  _audioBeats = null;
  await _saveTranscript([]);
  await _saveBeats(null);
  if (transcriptBox) { transcriptBox.value = ''; transcriptBox.style.display = 'none'; }
  _setAudioSrc(URL.createObjectURL(file));
  try {
    const sampleRate = 16000;
    const chunkFrames = CHUNK_SECS * sampleRate;
    if (statusEl) { statusEl.textContent = 'Decoding audio…'; statusEl.className = 'upload-status loading'; }
    const pcm = await decodeToMono16k(file);

    // Beat detection (music piece mode) — detect all beats then reduce to downbeats (bar 1s)
    if (_isMusicPiece) {
      if (statusEl) { statusEl.textContent = 'Detecting downbeats…'; statusEl.className = 'upload-status loading'; }
      const allBeats = detectBeatsFromPCM(pcm, sampleRate);
      _audioBeats = findDownbeats(allBeats, pcm, sampleRate);
      await _saveBeats(_audioBeats);
      _updateBarFromBeats(_audioBeats);
    }

    // Transcription (always — helps refine lyric shot placement even in music mode)
    const totalChunks = Math.ceil(pcm.length / chunkFrames);
    let allWords = [];
    for (let i = 0; i < totalChunks; i++) {
      const offsetSecs = i * CHUNK_SECS;
      const chunk = pcm.slice(i * chunkFrames, (i + 1) * chunkFrames);
      if (statusEl) { statusEl.textContent = `Transcribing${totalChunks > 1 ? ` part ${i + 1}/${totalChunks}` : ''}…`; statusEl.className = 'upload-status loading'; }
      const words = await transcribeChunk(chunk, sampleRate, offsetSecs);
      allWords = allWords.concat(words);
    }
    _audioTranscript = allWords;
    await _saveTranscript(_audioTranscript);

    _renderAudioTranscriptBox(_audioTranscript, _audioBeats);
    if (statusEl) { statusEl.textContent = _audioStatusText(_audioTranscript.length, _audioBeats); statusEl.className = 'upload-status done'; }

    if (_isMusicPiece && _audioBeats?.length) {
      matchBeatsToShots();
    } else {
      await matchTranscriptToShots();
    }
  } catch(e) {
    if (statusEl) { statusEl.textContent = 'Error: ' + e.message; statusEl.className = 'upload-status error'; }
    showToast('Audio processing failed: ' + e.message, true);
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

// Try to find the best transcript match for a shot's lyric within a time window [minSecs, maxSecs].
// Returns seconds if found, null otherwise. Uses relaxed matching — any word in the lyric can anchor.
function fuzzyMatchInWindow(lyric, minSecs, maxSecs) {
  if (!lyric?.trim() || !_audioTranscript?.length) return null;
  const words = _audioTranscript;
  const lyricWords = lyric.trim().toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(Boolean);
  let bestScore = 0, bestSecs = null;
  for (let i = 0; i < words.length; i++) {
    const ws = words[i].start;
    if (ws < minSecs || ws > maxSecs) continue;
    // Try each lyric word as the anchor
    for (let li = 0; li < Math.min(lyricWords.length, 6); li++) {
      const lw = lyricWords[li];
      if (lw.length < 2) continue;
      const tw = words[i].word.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (tw !== lw && !tw.startsWith(lw) && !lw.startsWith(tw)) continue;
      // Score forward from this position
      let score = 0;
      for (let j = 0; j < Math.min(lyricWords.length - li, 5) && i + j < words.length; j++) {
        const ta = words[i + j].word.toLowerCase().replace(/[^a-z0-9]/g, '');
        const la = lyricWords[li + j];
        if (ta === la || (la.length > 2 && (ta.startsWith(la) || la.startsWith(ta)))) score++;
        else if (j > 0) break;
      }
      if (score > bestScore) { bestScore = score; bestSecs = ws; }
    }
  }
  return bestScore >= 1 ? bestSecs : null;
}

// Get a readable snippet of transcript words between minSecs and maxSecs for AI context
function transcriptSnippet(minSecs, maxSecs) {
  return (_audioTranscript || [])
    .filter(w => w.start >= minSecs && w.start <= maxSecs)
    .map(w => `[${formatTimestamp(w.start)}] ${w.word}`)
    .join(' ');
}

async function matchTranscriptToShots() {
  if (!_audioTranscript?.length || !shots.length) return;
  syncFromDOM();

  // Clear previous timestamp issues
  shots.forEach(s => { delete s.timestampIssue; });

  // First pass: direct transcript matches (anywhere in audio)
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

  const isInstrumental = s => /^\s*instrumental\s*$/i.test(s.lyric || '') || !s.lyric?.trim();

  // Instrumental interpolation pass: for consecutive runs of instrumental/blank shots,
  // space them evenly between the nearest timestamped neighbors.
  const totalSecs = _audioTranscript[_audioTranscript.length - 1]?.start || 0;
  let i = 0;
  while (i < shots.length) {
    if (isInstrumental(shots[i])) {
      // Find the run
      let runEnd = i;
      while (runEnd + 1 < shots.length && isInstrumental(shots[runEnd + 1])) runEnd++;
      // Find bounding timestamps
      const prevSecs = i > 0 ? (parseTimestamp(shots[i - 1].timestamp) ?? 0) : 0;
      const nextSecs = runEnd < shots.length - 1 ? (parseTimestamp(shots[runEnd + 1].timestamp) ?? totalSecs) : totalSecs;
      const span = runEnd - i + 1;
      for (let j = i; j <= runEnd; j++) {
        const t = prevSecs + (nextSecs - prevSecs) * ((j - i + 1) / (span + 1));
        shots[j].timestamp = formatTimestamp(t);
        delete shots[j].timestampIssue;
      }
      i = runEnd + 1;
    } else {
      i++;
    }
  }

  // Validation pass: check each non-instrumental shot's timestamp is monotonically between neighbors
  const needsRepair = [];
  shots.forEach((shot, idx) => {
    if (isInstrumental(shot)) return; // already handled above
    const secs = parseTimestamp(shot.timestamp);
    if (secs == null || isNaN(secs)) { needsRepair.push(idx); return; }
    const prevSecs = idx > 0 ? parseTimestamp(shots[idx - 1].timestamp) ?? 0 : 0;
    const nextSecs = idx < shots.length - 1 ? parseTimestamp(shots[idx + 1].timestamp) ?? totalSecs : totalSecs;
    if (secs < prevSecs - 1 || secs > nextSecs + 1) needsRepair.push(idx);
  });

  if (needsRepair.length === 0) {
    renderShots(); autoSave(); showToast('Timestamps matched to shots.'); return;
  }

  // Second pass: for shots needing repair, try fuzzy window search first
  const statusEl = document.getElementById('audio-upload-status');
  if (statusEl) { statusEl.textContent = `Fixing ${needsRepair.length} timestamp(s)…`; statusEl.className = 'upload-status loading'; }

  const stillNeedsAI = [];
  for (const idx of needsRepair) {
    const shot = shots[idx];
    const prevSecs = idx > 0 ? (parseTimestamp(shots[idx - 1].timestamp) ?? 0) : 0;
    const nextSecs = idx < shots.length - 1 ? (parseTimestamp(shots[idx + 1].timestamp) ?? totalSecs) : totalSecs;
    const minW = Math.max(0, prevSecs - 2);
    const maxW = nextSecs + 2;

    const found = fuzzyMatchInWindow(shot.lyric, minW, maxW);
    if (found !== null) {
      shot.timestamp = formatTimestamp(found);
      shot.timestampIssue = null;
    } else {
      stillNeedsAI.push({ idx, prevSecs, nextSecs });
    }
  }

  // Third pass: AI fallback for shots still unresolved
  for (const { idx, prevSecs, nextSecs } of stillNeedsAI) {
    const shot = shots[idx];
    const snippet = transcriptSnippet(Math.max(0, prevSecs - 3), nextSecs + 3);
    if (!snippet || !shot.lyric?.trim()) { shot.timestampIssue = 'missing'; continue; }
    try {
      const r = await apiFetch('/api/fuzzy-match-timestamp', {
        lyric: shot.lyric,
        transcript: snippet,
        prevTimestamp: formatTimestamp(prevSecs),
        nextTimestamp: formatTimestamp(nextSecs)
      });
      if (r?.timestamp) {
        shot.timestamp = r.timestamp;
        shot.timestampIssue = null;
      } else {
        shot.timestampIssue = 'missing';
      }
    } catch(e) {
      shot.timestampIssue = 'missing';
    }
  }

  // Final validation — mark any still-invalid as inaccurate
  shots.forEach((shot, idx) => {
    if (shot.timestampIssue) return;
    const secs = parseTimestamp(shot.timestamp);
    if (secs == null || isNaN(secs)) { shot.timestampIssue = 'missing'; return; }
    const prevSecs = idx > 0 ? parseTimestamp(shots[idx - 1].timestamp) ?? 0 : 0;
    const nextSecs = idx < shots.length - 1 ? parseTimestamp(shots[idx + 1].timestamp) ?? totalSecs : totalSecs;
    if (secs < prevSecs - 1 || secs > nextSecs + 1) shot.timestampIssue = 'inaccurate';
  });

  if (statusEl) { statusEl.textContent = `${shots.length} shots timestamped`; statusEl.className = 'upload-status done'; }
  renderShots(); autoSave(); showToast('Timestamps matched to shots.');
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
  if (btn) {
    const hasTs = val && val !== '0:00';
    btn.style.opacity = hasTs ? '1' : '0.2';
    btn.style.pointerEvents = hasTs ? '' : 'none';
  }
  // Update the shot in memory immediately so the animatic timeline reflects the new value
  const shot = shots.find(s => s.id === shotId);
  if (shot) shot.timestamp = val;
  _syncAnimaticFromLiveShots();
}

function _syncAnimaticFromLiveShots() {
  // DOM is source of truth for text fields — always sync before reading shots
  syncFromDOM();
  // If the video hasn't fired loadedmetadata yet, try to trigger a full init
  if (!_animaticTimeline) {
    const video = document.querySelector('#animatic-history video');
    if (video && video.readyState >= 1) _initPrimaryAnimaticTimeline(video, 0);
    return;
  }
  const timedShots = shots
    .filter(s => s.timestamp)
    .map(s => { const secs = parseTimestamp(s.timestamp); return secs !== null ? { id: s.id, secs, lyric: s.lyric || '' } : null; })
    .filter(Boolean)
    .sort((a, b) => a.secs - b.secs);
  if (!timedShots.length) return;
  _animaticTimeline.shots = timedShots;
  _redrawAnimaticTimeline();
  // Clean up pool videos for shots that no longer exist
  const liveIds = new Set(timedShots.map(s => s.id));
  Object.keys(_videoPool).forEach(id => {
    if (!liveIds.has(id)) { _videoPool[id].pause(); _videoPool[id].remove(); delete _videoPool[id]; }
  });
  // Refresh pool videos for any shots whose video URLs changed
  timedShots.forEach(s => {
    const live = shots.find(sh => sh.id === s.id);
    if (live && (live.motionVideoUrl || live.videoUrl)) _getOrCreatePoolVideo(live);
    if (live?.finalImage) _loadImg(live.finalImage);
  });
  _redrawLiveCanvas?.();
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
      if (char) { char.referenceImage = { dataUrl, base64, mediaType: 'image/jpeg' }; char.useRefAsDefault = true; }
      // Upload to Supabase Storage
      let displayUrl = dataUrl;
      try {
        const r = await apiFetch('/api/upload-reference', { base64, mediaType: 'image/jpeg', projectId: currentProjectId, entityType: 'chars', entityId: id });
        if (r.url && char) { char.referenceImage = { ...char.referenceImage, url: r.url, dataUrl: r.url }; displayUrl = r.url; }
      } catch(e) { console.warn('ref upload failed', e); }
      const preview = document.querySelector(`tr[data-id="${id}"] .ref-img-preview`);
      if (preview) {
        preview.innerHTML = `<img src="${displayUrl}" alt="Reference"><button class="remove-img" onclick="removeRefImage('${id}', event)">✕</button>`;
        preview.onclick = () => triggerImageUpload(id);
      }
      // Remove background and set as Final Image
      try {
        const bgData = await apiFetch('/api/remove-background', { imageUrl: displayUrl });
        if (bgData?.url && char) {
          char.images = [bgData.url, ...(char.images || []).filter(u => u !== bgData.url)];
          char.bgRemovedImage = bgData.url;
          renderCharacters();
        }
      } catch(e) { console.warn('bg removal failed', e); }
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

// ── character multi-ref images ────────────────────────────────────────────
async function handleCharRefImagesUpload(id, input) {
  const files = Array.from(input.files); if (!files.length) return;
  const char = characters.find(c => c.id === id); if (!char) return;
  if (!char.refImages) char.refImages = [];
  for (const file of files) {
    const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); });
    const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = dataUrl; });
    const { dataUrl: resized, base64 } = resizeForUpload(img);
    const refId = genId();
    const ref = { id: refId, dataUrl: resized, base64, mediaType: 'image/jpeg' };
    char.refImages.push(ref);
    // Auto-select first upload as default
    if (char.refImages.length === 1) char.selectedRefImageId = refId;
    renderCharacters();
    // Upload to Supabase in background
    try {
      const r = await apiFetch('/api/upload-reference', { base64, mediaType: 'image/jpeg', projectId: currentProjectId, entityType: 'chars', entityId: id });
      if (r.url) { ref.url = r.url; ref.dataUrl = r.url; ref.base64 = null; renderCharacters(); }
    } catch(e) { console.warn('ref upload failed', e); }
    autoSave();
  }
}

function selectCharRefImage(charId, refId) {
  const char = characters.find(c => c.id === charId); if (!char) return;
  char.selectedRefImageId = char.selectedRefImageId === refId ? null : refId;
  renderCharacters(); autoSave();
}

function removeCharRefImage(charId, refId, event) {
  event.stopPropagation();
  const char = characters.find(c => c.id === charId); if (!char) return;
  char.refImages = (char.refImages || []).filter(r => r.id !== refId);
  if (char.selectedRefImageId === refId) char.selectedRefImageId = char.refImages[0]?.id || null;
  if (char.loraStatus !== 'idle') { char.loraUrl = null; char.loraStatus = 'idle'; char.loraTriggerWord = null; }
  renderCharacters(); autoSave();
}

async function trainCharacterLora(id) {
  const char = characters.find(c => c.id === id); if (!char) return;
  const urls = (char.refImages || []).map(r => r.url).filter(Boolean);
  if (urls.length < 2) { showToast('Upload at least 2 ref images first.', true); return; }
  char.loraStatus = 'training'; renderCharacters();
  try {
    const r = await apiFetch('/api/train-character-lora', { imageUrls: urls, triggerWord: `CHAR${id.slice(0,4).toUpperCase()}` });
    char.loraUrl = r.loraUrl; char.loraStatus = 'ready'; char.loraTriggerWord = r.triggerWord;
    showToast('Character model trained ✓');
  } catch(e) {
    char.loraStatus = 'error'; showToast('Training failed: ' + e.message, true);
  }
  renderCharacters(); autoSave();
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

function openLocImageLibrary(locId) {
  // Collect all images from all locations and their associated shots
  const entries = [];
  const addUrl = (url, label) => { if (url && typeof url === 'string') entries.push({ url, label }); };

  for (const l of locations) {
    const label = l.name || 'Unnamed';
    for (const url of (l.images || [])) addUrl(url, label);
    addUrl(l.selectedImage, label);
    const refUrl = l.referenceImage?.dataUrl || l.referenceImage?.url;
    addUrl(refUrl, `${label} (ref)`);
    for (const [angle, a] of Object.entries(l.shotAngles || {})) {
      addUrl(a.image, `${label} – ${angle}`);
      addUrl(a.refImage?.dataUrl || a.refImage?.url, `${label} – ${angle} ref`);
    }
    for (const cv of (l.customViews || [])) {
      addUrl(cv.image, `${label} – ${cv.name || 'Custom'}`);
    }
    // Include final images and generated images from shots that use this location
    for (const s of shots) {
      if (s.locationId !== l.id) continue;
      const shotLabel = `${label} (shot ${s.lyric ? '"' + s.lyric.slice(0, 20) + '"' : 'scene'})`;
      addUrl(s.finalImage, shotLabel);
      for (const url of (s.images || [])) addUrl(url, shotLabel);
    }
  }
  // Deduplicate by URL
  const seen = new Set();
  const unique = entries.filter(e => { if (seen.has(e.url)) return false; seen.add(e.url); return true; });

  const grid = document.getElementById('loc-image-library-grid');
  if (!grid) return;
  if (!unique.length) {
    grid.innerHTML = '<div style="color:#555;font-size:12px;grid-column:1/-1;text-align:center;padding:40px 0">No location images yet. Generate or upload some first.</div>';
  } else {
    grid.innerHTML = unique.map((e, i) => `
      <div onclick="pickLocLibraryImage('${locId}', ${i})" style="cursor:pointer;border-radius:6px;overflow:hidden;border:2px solid transparent;transition:border-color 0.15s" onmouseover="this.style.borderColor='#818cf8'" onmouseout="this.style.borderColor='transparent'">
        <img src="${esc(e.url)}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block">
        <div style="font-size:9px;color:#555;padding:4px 5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(e.label)}</div>
      </div>`).join('');
  }
  // Store entries on the grid element for lookup by index
  grid._libraryEntries = unique;
  document.getElementById('loc-image-library-modal').style.display = 'flex';
}

async function pickLocLibraryImage(locId, idx) {
  const grid = document.getElementById('loc-image-library-grid');
  const entries = grid?._libraryEntries;
  if (!entries?.[idx]) return;
  const { url } = entries[idx];
  const loc = locations.find(l => l.id === locId);
  if (!loc) return;

  document.getElementById('loc-image-library-modal').style.display = 'none';

  // Fetch the image and convert to base64 for referenceImage
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const mediaType = blob.type || 'image/jpeg';
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(',')[1];
      loc.referenceImage = { dataUrl, base64, mediaType, url: url.startsWith('http') ? url : null };
      if (!loc.images?.length && !loc.useRefAsDefault) loc.useRefAsDefault = true;
      // Update preview inline
      const preview = document.querySelector(`#locations-body tr[data-id="${locId}"] .ref-img-preview`);
      if (preview) {
        preview.innerHTML = `<img src="${esc(dataUrl)}" alt="Reference"><button class="remove-img" onclick="removeLocRefImage('${locId}', event)">✕</button>`;
        preview.onclick = () => toggleLocUseRef(locId);
      }
      autoSave();
      renderLocations();
    };
    reader.readAsDataURL(blob);
  } catch(e) {
    // If fetch fails (CORS etc), use the URL directly as the reference
    loc.referenceImage = { dataUrl: url, base64: null, mediaType: 'image/jpeg', url: url.startsWith('http') ? url : null };
    if (!loc.images?.length && !loc.useRefAsDefault) loc.useRefAsDefault = true;
    autoSave();
    renderLocations();
  }
}

// ── global image library modal ────────────────────────────────────────────
const LIB_PAGE_SIZE = 20;
let _libState = { type: null, id: null, allEntries: [], filtered: [], page: 0 };

function _libThumbUrl(url) {
  // Use Supabase image transform for low-res thumbnails (200×200, q=50)
  if (url && url.includes('supabase.co/storage/v1/object/public/')) {
    return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') +
      '?width=200&height=200&resize=cover&quality=50';
  }
  return url.includes('supabase.co') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

async function openImageLibrary(type, entityId) {
  _libState = { type, id: entityId, allEntries: [], filtered: [], page: 0 };
  const modal = document.getElementById('image-library-modal');
  const grid  = document.getElementById('image-library-grid');
  const title = document.getElementById('image-library-title');
  const count = document.getElementById('image-library-count');
  const loading = document.getElementById('image-library-loading');
  const search = document.getElementById('image-library-search');
  if (!modal) return;
  title.textContent = type === 'char' ? 'Character Image Library' : 'Location Image Library';
  count.textContent = '';
  search.value = '';
  grid.innerHTML = '';
  loading.style.display = 'block';
  modal.style.display = 'flex';

  try {
    const { images } = await apiFetch('/api/storage-images', null, 'GET');
    _libState.allEntries = images || [];
    _libState.filtered = _libState.allEntries;
    loading.style.display = 'none';
    _renderImageLibraryPage(true);
  } catch (e) {
    loading.style.display = 'none';
    grid.innerHTML = `<div style="color:#e05050;font-size:12px;grid-column:1/-1;padding:20px">Failed to load library: ${esc(e.message)}</div>`;
  }
}

function _libThumbHTML(e, idx) {
  const name = e.name ? e.name.split('/').pop() : '';
  const src = esc(_libThumbUrl(e.url));
  return `<div
    onclick="_pickImageLibrary(${idx})"
    onmouseover="this.querySelector('.lib-thumb-overlay').style.opacity='1'"
    onmouseout="this.querySelector('.lib-thumb-overlay').style.opacity='0'"
    style="cursor:pointer;border-radius:6px;overflow:hidden;border:2px solid transparent;transition:border-color 0.15s;background:#111;position:relative">
    <div style="width:100%;background:#0e0e0e;display:flex;align-items:center;justify-content:center;min-height:80px">
      <img src="${src}" loading="lazy"
        style="width:100%;height:auto;max-height:200px;object-fit:contain;display:block"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div style="display:none;width:100%;height:80px;align-items:center;justify-content:center;color:#333;font-size:22px">🖼</div>
    </div>
    <div class="lib-thumb-overlay" style="position:absolute;inset:0;background:rgba(129,140,248,0.18);opacity:0;transition:opacity 0.15s;pointer-events:none;display:flex;align-items:center;justify-content:center">
      <span style="background:#818cf8;color:#fff;font-size:10px;font-weight:600;padding:3px 10px;border-radius:10px">Select</span>
    </div>
    <div style="font-size:9px;color:#555;padding:4px 6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border-top:1px solid #1a1a1a" title="${esc(name)}">${esc(name)}</div>
  </div>`;
}

function _renderImageLibraryPage(reset) {
  const grid  = document.getElementById('image-library-grid');
  const count = document.getElementById('image-library-count');
  if (!grid) return;
  const entries = _libState.filtered;
  count.textContent = entries.length ? `${entries.length} image${entries.length !== 1 ? 's' : ''}` : '';

  if (reset) {
    _libState.page = 0;
    if (!entries.length) {
      grid.innerHTML = '<div style="color:#555;font-size:12px;grid-column:1/-1;text-align:center;padding:40px 0">No images found in storage.</div>';
      return;
    }
    grid.innerHTML = '';
  }

  const start = _libState.page * LIB_PAGE_SIZE;
  const slice = entries.slice(start, start + LIB_PAGE_SIZE);
  if (!slice.length) return;

  // Remove existing load-more button before appending new cards
  const oldBtn = grid.querySelector('.lib-load-more');
  if (oldBtn) oldBtn.remove();

  slice.forEach((e, i) => {
    const div = document.createElement('div');
    div.innerHTML = _libThumbHTML(e, start + i);
    grid.appendChild(div.firstElementChild);
  });

  _libState.page++;
  const hasMore = _libState.page * LIB_PAGE_SIZE < entries.length;
  if (hasMore) {
    const btn = document.createElement('div');
    btn.className = 'lib-load-more';
    btn.style.cssText = 'grid-column:1/-1;text-align:center;padding:12px 0';
    btn.innerHTML = `<button onclick="_libLoadMore()" style="background:none;border:1px solid #2a2a2a;border-radius:5px;color:#666;font-size:11px;padding:6px 20px;cursor:pointer">Load more (${entries.length - _libState.page * LIB_PAGE_SIZE} remaining)</button>`;
    grid.appendChild(btn);
  }
}

function _libLoadMore() {
  _renderImageLibraryPage(false);
}

function _filterImageLibrary(query) {
  const q = query.trim().toLowerCase();
  _libState.filtered = q
    ? _libState.allEntries.filter(e => (e.name || '').toLowerCase().includes(q) || (e.url || '').toLowerCase().includes(q))
    : _libState.allEntries;
  _renderImageLibraryPage(true);
}

function _closeImageLibrary() {
  const modal = document.getElementById('image-library-modal');
  if (modal) modal.style.display = 'none';
}

async function _pickImageLibrary(idx) {
  const entries = _libState.filtered;
  if (!entries?.[idx]) return;
  const { url } = entries[idx];
  _closeImageLibrary();

  if (_libState.type === 'char') {
    const char = characters.find(c => c.id === _libState.id);
    if (!char) return;
    // Add as a ref image entry
    const newRef = { id: genId(), url };
    char.refImages = char.refImages || [];
    char.refImages.push(newRef);
    if (!char.selectedRefImageId) char.selectedRefImageId = newRef.id;
    autoSave();
    renderCharacters();
    showToast('Image added to character reference images.');
  } else if (_libState.type === 'loc') {
    const loc = locations.find(l => l.id === _libState.id);
    if (!loc) return;
    loc.referenceImage = { dataUrl: url, base64: null, mediaType: 'image/jpeg', url };
    if (!loc.images?.length && !loc.useRefAsDefault) loc.useRefAsDefault = true;
    autoSave();
    renderLocations();
    showToast('Image set as location reference.');
  }
}

// Override the old location-only library to use the shared modal
function openLocImageLibrary(locId) {
  openImageLibrary('loc', locId);
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
      // Upload to Supabase so images.json stays small
      apiFetch('/api/upload-reference', { base64, mediaType: 'image/jpeg', projectId: currentProjectId, entityType: 'chars', entityId: charId })
        .then(r => { if (r.url) { char.angles[angle].refImage = { url: r.url, dataUrl: r.url, base64: null, mediaType: 'image/jpeg' }; autoSave(); } })
        .catch(() => {});
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
      apiFetch('/api/upload-reference', { base64, mediaType: 'image/jpeg', projectId: currentProjectId, entityType: 'locs', entityId: locId })
        .then(r => { if (r.url) { loc.shotAngles[angle].refImage = { url: r.url, dataUrl: r.url, base64: null, mediaType: 'image/jpeg' }; autoSave(); } })
        .catch(() => {});
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
      apiFetch('/api/upload-reference', { base64, mediaType: 'image/jpeg', projectId: currentProjectId, entityType: 'locs', entityId: locId })
        .then(r => { if (r.url) { loc.customViews[idx].refImage = { url: r.url, dataUrl: r.url, base64: null, mediaType: 'image/jpeg' }; autoSave(); } })
        .catch(() => {});
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
    if (loc?.referenceImage) body.referenceImage = { base64: loc.referenceImage.base64 || null, mediaType: loc.referenceImage.mediaType, url: loc.referenceImage.url || loc.referenceImage.dataUrl || null };
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
    if (char?.referenceImage) body.referenceImage = { base64: char.referenceImage.base64 || null, mediaType: char.referenceImage.mediaType, url: char.referenceImage.url || char.referenceImage.dataUrl || null };
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
  // Supabase public storage URLs are already CORS-accessible — no proxy needed
  if (url.includes('supabase.co/storage')) return url;
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

function getCharSelectedRefUrl(char) {
  if (char.selectedRefImageId) {
    const sel = (char.refImages || []).find(r => r.id === char.selectedRefImageId);
    if (sel) return sel.url || sel.dataUrl;
  }
  return (char.refImages || [])[0]?.url || (char.refImages || [])[0]?.dataUrl || null;
}

async function generateCharFrontProfile(id) {
  syncFromDOM();
  const row = document.querySelector(`#characters-body tr[data-id="${id}"]`);
  const btns = row.querySelectorAll('.btn-gen-images');
  const btn = btns[0];
  const charDesc = row.querySelector('.field-prompt').value.trim();
  const char = characters.find(c => c.id === id);
  const hasLora = char?.loraStatus === 'ready' && char?.loraUrl;
  const selectedRef = getCharSelectedRefUrl(char);
  const hasRef = !!selectedRef;
  if (!charDesc && !hasRef && !hasLora) { showToast('Add a description or upload reference images first.', true); return; }
  if (!char.angles) char.angles = {};
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  const frontSlot = document.getElementById(`char-front-${id}`);
  if (frontSlot) frontSlot.innerHTML = '<span class="spinner"></span>';
  try {
    const fullPrompt = getCharFullPrompt(charDesc || '');
    let frontUrl = null;
    if (hasLora) {
      // Path 1: trained LoRA — use framing boilerplate but not the appearance description
      const loraPrompt = CHAR_BOILERPLATE + ' Front profile, facing camera, neutral expression.';
      const data = await apiFetch('/api/generate-from-lora', { prompt: loraPrompt, loraUrl: char.loraUrl, triggerWord: char.loraTriggerWord, stylePrompt: getStylePrompt(), projectId: currentProjectId, entityType: 'chars', entityId: id });
      frontUrl = data.images?.[0] || null;
    } else if (hasRef) {
      // Path 2: Kontext with selected ref image
      const data = await apiFetch('/api/generate-shot-images', { prompt: fullPrompt, stylePrompt: getStylePrompt(), charImageUrls: [selectedRef] });
      frontUrl = data.images?.[0] || null;
    } else {
      // Path 3: plain text-to-image
      const data = await apiFetch('/api/generate-images', { prompt: fullPrompt, stylePrompt: '' });
      frontUrl = data.images?.[0] || null;
    }
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
  const hasLora = char?.loraStatus === 'ready' && char?.loraUrl;
  const selectedRef = getCharSelectedRefUrl(char);
  const refUrl = selectedRef || char.images?.[0] || null;
  if (!hasLora && !refUrl) { showToast('Upload reference images or generate a front profile first.', true); return; }
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
        let url = null;
        if (hasLora) {
          // For LoRA, only describe the pose/angle — appearance comes from the weights
          const loraPosePrompt = anglePrompt.replace(/\b(wearing|dressed|hair|eyes|skin|outfit|clothes|tall|short|with [a-z]+ [a-z]+)\b.*/i, '').trim() || anglePrompt;
          const data = await apiFetch('/api/generate-from-lora', { prompt: loraPosePrompt, loraUrl: char.loraUrl, triggerWord: char.loraTriggerWord, stylePrompt: getStylePrompt(), projectId: currentProjectId, entityType: 'chars', entityId: id });
          url = data.images?.[0] || null;
        } else {
          const varData = await apiFetch('/api/generate-char-variant', { prompt: anglePrompt, referenceImageUrls: [refUrl], stylePrompt: getStylePrompt() });
          url = varData.url || null;
        }
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
  const input = document.getElementById(`expr-${id}`);
  const expression = (input?.value || '').trim();

  const imageUrl = char?.images?.[0] || null;
  if (!imageUrl) { showToast('Generate an image first.', true); return; }

  if (!expression || expression === 'neutral') {
    frontSlot.innerHTML = `<img src="${esc(imageUrl)}" alt="Front">`;
    return;
  }

  input.disabled = true;
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
    input.disabled = false;
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
    _syncAnimaticFromLiveShots();
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
    _syncAnimaticFromLiveShots();
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
  // Check for new KB content in background after page loads
  setTimeout(() => _kbCheckNewContentOnLoad().catch(() => {}), 2000);
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

  thumbContainer.innerHTML = locations.map(l => {
    const defaultImg = locDefaultImage(l);
    const variations = [];
    LOC_ANGLES.forEach(a => {
      const entry = l.shotAngles?.[a];
      const img = (entry?.useRef && entry?.refImage) ? (entry.refImage.dataUrl || entry.refImage.url) : entry?.image;
      if (img) variations.push({ key: `angle-${a}`, label: a.replace('establishing shot','est.').replace(' shot',''), img, deletable: false });
    });
    (l.customViews || []).forEach(cv => {
      const img = (cv.useRef && cv.refImage) ? (cv.refImage.dataUrl || cv.refImage.url) : cv.image;
      if (img) variations.push({ key: `custom-${cv.id}`, label: cv.name || 'Custom', img, deletable: false, cvId: cv.id });
    });

    const varThumbs = variations.map(v => `
      <div class="compose-loc-var-thumb" style="position:relative" data-loc-id="${esc(l.id)}" data-view-key="${esc(v.key)}" onclick="onLocBgViewChange('${esc(l.id)}','${esc(v.key)}')" title="${esc(v.label)}">
        <img src="${esc(proxyUrl(v.img))}" crossorigin="anonymous">
        <span class="compose-loc-var-label">${esc(v.label)}</span>
        ${v.deletable ? `<button class="comp-thumb-delete" onclick="event.stopPropagation();deleteLocCustomViewById('${esc(l.id)}','${esc(v.cvId)}')" title="Delete">✕</button>` : ''}
      </div>`).join('');

    return `<div class="compose-loc-card-wrap" data-loc-id="${esc(l.id)}">
      <div class="compose-bg-card compose-loc-main-card" data-bg-key="loc-${esc(l.id)}-default" onclick="onLocBgCardClick('${esc(l.id)}')">
        ${defaultImg ? `<img src="${esc(proxyUrl(defaultImg))}" crossorigin="anonymous">` : `<div class="compose-bg-card-empty">·</div>`}
        <span class="compose-bg-card-label">${esc(l.name || 'Unnamed')}</span>
      </div>
      ${variations.length ? `<div class="compose-loc-variations" id="loc-vars-${esc(l.id)}">${varThumbs}</div>` : ''}
    </div>`;
  }).join('');
}

function toggleLocVariations(locId) {
  const el = document.getElementById(`loc-vars-${locId}`);
  if (el) el.classList.toggle('open');
}

function onLocBgCardClick(locId) {
  // Collapse all other locations' variations, expand this one
  document.querySelectorAll('.compose-loc-variations').forEach(el => {
    if (el.id !== `loc-vars-${locId}`) el.classList.remove('open');
  });
  const el = document.getElementById(`loc-vars-${locId}`);
  if (el) el.classList.add('open');
  onLocBgViewChange(locId, 'default');
}

function onLocBgViewChange(locId, viewKey) {
  if (!_compose) return;
  const loc = locations.find(l => l.id === locId);
  if (!loc) return;
  let imgUrl = null;
  if (viewKey === 'default') {
    imgUrl = locDefaultImage(loc);
  } else if (viewKey.startsWith('angle-')) {
    const entry = loc.shotAngles?.[viewKey.slice(6)];
    imgUrl = (entry?.useRef && entry?.refImage) ? (entry.refImage.dataUrl || entry.refImage.url) : (entry?.image || null);
  } else if (viewKey.startsWith('custom-')) {
    const cv = (loc.customViews || []).find(c => c.id === viewKey.slice(7));
    imgUrl = (cv?.useRef && cv?.refImage) ? (cv.refImage.dataUrl || cv.refImage.url) : (cv?.image || null);
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

// ── Draw / sketch tool ────────────────────────────────────────────────────────
let _drawTool = 'pencil'; // 'pencil' | 'eraser'
let _drawActive = false;

function _drawGetCanvas() { return document.getElementById('compose-draw-canvas'); }

function _drawSyncSize() {
  const dc = _drawGetCanvas();
  const cc = document.getElementById('compose-canvas');
  if (!dc || !cc) return;
  if (dc.width !== COMPOSE_W || dc.height !== COMPOSE_H) {
    dc.width = COMPOSE_W; dc.height = COMPOSE_H;
  }
}

function _drawSetTool(tool) {
  _drawTool = tool;
  const pencilBtn = document.getElementById('draw-tool-pencil');
  const eraserBtn = document.getElementById('draw-tool-eraser');
  if (pencilBtn) { pencilBtn.style.background = tool === 'pencil' ? '#2a1a0a' : '#1a1a1a'; pencilBtn.style.color = tool === 'pencil' ? '#fb923c' : '#666'; pencilBtn.style.borderColor = tool === 'pencil' ? '#fb923c' : '#333'; }
  if (eraserBtn) { eraserBtn.style.background = tool === 'eraser' ? '#2a1a0a' : '#1a1a1a'; eraserBtn.style.color = tool === 'eraser' ? '#fb923c' : '#666'; eraserBtn.style.borderColor = tool === 'eraser' ? '#fb923c' : '#333'; }
}

function _drawEnableCanvas() {
  const dc = _drawGetCanvas();
  if (!dc) return;
  dc.style.pointerEvents = 'all';
  dc.style.cursor = 'crosshair';
  _drawSyncSize();
  dc.onpointerdown = _drawPointerDown;
}

function _drawDisableCanvas() {
  const dc = _drawGetCanvas();
  if (!dc) return;
  dc.style.pointerEvents = 'none';
  dc.style.cursor = '';
  dc.onpointerdown = null;
  _drawActive = false;
}

function _drawPointerDown(e) {
  e.preventDefault();
  _drawActive = true;
  _drawSyncSize();
  const dc = _drawGetCanvas();
  dc.setPointerCapture(e.pointerId);
  dc.onpointermove = _drawPointerMove;
  dc.onpointerup = dc.onpointercancel = _drawPointerUp;
  _drawStroke(e, true);
}

function _drawPointerMove(e) {
  if (!_drawActive) return;
  _drawStroke(e, false);
}

function _drawPointerUp(e) {
  _drawActive = false;
  const dc = _drawGetCanvas();
  dc.onpointermove = null; dc.onpointerup = null; dc.onpointercancel = null;
}

function _drawStroke(e, isStart) {
  const dc = _drawGetCanvas();
  if (!dc) return;
  const rect = dc.getBoundingClientRect();
  const scaleX = COMPOSE_W / rect.width;
  const scaleY = COMPOSE_H / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const ctx = dc.getContext('2d');
  const size = parseInt(document.getElementById('draw-size')?.value || '8');
  const color = document.getElementById('draw-color')?.value || '#ff4444';

  if (_drawTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
  }

  if (isStart) {
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = _drawTool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    if (!dc._lastX) { dc._lastX = x; dc._lastY = y; }
    ctx.beginPath();
    ctx.moveTo(dc._lastX, dc._lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  dc._lastX = x; dc._lastY = y;
  ctx.globalCompositeOperation = 'source-over';
}

function _drawClear() {
  const dc = _drawGetCanvas();
  if (!dc) return;
  _drawSyncSize();
  dc.getContext('2d').clearRect(0, 0, COMPOSE_W, COMPOSE_H);
}

function _drawHasContent() {
  const dc = _drawGetCanvas();
  if (!dc || dc.width === 0) return false;
  const data = dc.getContext('2d').getImageData(0, 0, dc.width, dc.height).data;
  for (let i = 3; i < data.length; i += 4) { if (data[i] > 10) return true; }
  return false;
}

function _drawGetBoundingBox() {
  const dc = _drawGetCanvas();
  if (!dc) return null;
  const { data, width, height } = dc.getContext('2d').getImageData(0, 0, dc.width, dc.height);
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  const pad = 30;
  return { x: Math.max(0, minX - pad), y: Math.max(0, minY - pad), w: Math.min(COMPOSE_W, maxX + pad) - Math.max(0, minX - pad), h: Math.min(COMPOSE_H, maxY + pad) - Math.max(0, minY - pad) };
}

async function _drawReplaceWithCharacter() {
  if (!_compose) return;
  if (!_drawHasContent()) { showToast('Draw a sketch first.', true); return; }
  const charId = document.getElementById('draw-char-select')?.value;
  if (!charId) { showToast('Select a character to replace the sketch with.', true); return; }
  const char = characters.find(c => c.id === charId);
  if (!char) return;

  const refImg = charDefaultImage(char) || char.images?.[0] || char.bgRemovedImage;
  if (!refImg) { showToast('Character has no generated images yet — generate a character image first.', true); return; }

  const btn = document.getElementById('btn-draw-replace');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

  try {
    // Composite: compose canvas + sketch overlay → single image for the AI
    const bbox = _drawGetBoundingBox();
    const comp = document.createElement('canvas');
    comp.width = COMPOSE_W; comp.height = COMPOSE_H;
    const compCtx = comp.getContext('2d');
    // Draw compose background
    compCtx.drawImage(document.getElementById('compose-canvas'), 0, 0);
    // Draw sketch on top (red so AI can see the intended pose)
    compCtx.drawImage(_drawGetCanvas(), 0, 0);

    const b64 = comp.toDataURL('image/jpeg', 0.92).split(',')[1];
    const uploaded = await apiFetch('/api/upload-reference', { base64: b64, mediaType: 'image/jpeg' });

    const poseHint = document.getElementById('draw-pose-hint')?.value.trim();
    const charDesc = char.reference || char.name || 'the character';
    const prompt = `Place ${charDesc} as a character layer into this scene, matching the pose and position of the red sketch/stick figure exactly. ${poseHint ? poseHint + '. ' : ''}Keep the background unchanged. Only add the character where the sketch indicates.`;

    if (btn) btn.textContent = '⏳ Generating image…';
    const genData = await apiFetch('/api/generate-char-variant', {
      prompt,
      referenceImageUrls: [refImg, uploaded.url],
      stylePrompt: getStylePrompt(),
    });
    const rawUrl = genData.url;
    if (!rawUrl) throw new Error('No image returned');

    if (btn) btn.textContent = '⏳ Removing background…';
    const bgData = await apiFetch('/api/remove-background', { imageUrl: rawUrl });
    const finalUrl = bgData.url || rawUrl;

    // Position the new layer centered on the sketch bounding box
    const cx = bbox ? bbox.x + bbox.w / 2 : COMPOSE_W / 2;
    const cy = bbox ? bbox.y + bbox.h / 2 : COMPOSE_H * 0.65;
    const scaleH = bbox ? Math.min(0.7, bbox.h / COMPOSE_H * 1.4) : 0.4;

    captureUndoState();
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      if (!_compose) return;
      const h = COMPOSE_H * scaleH;
      const w = h * (imgEl.naturalWidth / imgEl.naturalHeight);
      _compose.layers.push({ imgEl, imgUrl: finalUrl, label: char.name || 'Character', charId, cx, cy, scale: scaleH, w, h, opacity: 1, contrast: 100, saturation: 100 });
      _compose.selectedIdx = _compose.layers.length - 1;
      _drawClear(); // clear the sketch now that it's been replaced
      updateComposeLayerPanel();
      renderCompose();
      saveComposeLayers();
      showToast('Character placed! Sketch cleared.');
    };
    imgEl.onerror = () => showToast('Character generated but failed to load — try again.', true);
    imgEl.src = proxyUrl(finalUrl);
    if (char && finalUrl !== rawUrl) { char.bgRemovedImage = finalUrl; autoSave(); }
  } catch(e) {
    showToast('Replace failed: ' + e.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Replace Sketch with Character'; }
  }
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
  _drawClear();
  _drawDisableCanvas();
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
      _syncAnimaticFromLiveShots();
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

function _audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const dataLen = numFrames * numChannels * bytesPerSample;
  const wavBuf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(wavBuf);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLen, true);
  let off = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return new Blob([wavBuf], { type: 'audio/wav' });
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
    const audioFile = await idbGet(_audioKey() + '-file');
    if (audioFile) {
      // Determine clip start/end from shot timestamps
      const startSecs = shot.timestamp ? (parseTimestamp(shot.timestamp) ?? 0) : 0;
      // Find the next shot's timestamp to determine clip end
      syncFromDOM();
      const sortedShots = shots
        .filter(s => s.timestamp)
        .map(s => ({ id: s.id, secs: parseTimestamp(s.timestamp) }))
        .filter(s => s.secs !== null)
        .sort((a, b) => a.secs - b.secs);
      const shotIdx = sortedShots.findIndex(s => s.id === shot.id);
      const endSecs = sortedShots[shotIdx + 1]?.secs ?? (startSecs + 10); // max 10s if last shot
      const clipDur = Math.min(endSecs - startSecs, 30); // cap at 30s for sadtalker

      // Trim audio to clip duration using Web Audio API
      const arrayBuf = await audioFile.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(arrayBuf);
      audioCtx.close();

      const clipFrames = Math.floor(clipDur * decoded.sampleRate);
      const startFrame = Math.floor(startSecs * decoded.sampleRate);
      const offCtx = new OfflineAudioContext(decoded.numberOfChannels, clipFrames, decoded.sampleRate);
      const src = offCtx.createBufferSource();
      const clipBuf = offCtx.createBuffer(decoded.numberOfChannels, clipFrames, decoded.sampleRate);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        clipBuf.copyToChannel(decoded.getChannelData(ch).slice(startFrame, startFrame + clipFrames), ch);
      }
      src.buffer = clipBuf;
      src.connect(offCtx.destination);
      src.start();
      const rendered = await offCtx.startRendering();

      // Encode to WAV for upload (browser-safe, no encoder needed)
      const wavBlob = _audioBufferToWavBlob(rendered);
      const wavB64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(wavBlob); });
      const audioUpload = await apiFetch('/api/upload-reference', { base64: wavB64, mediaType: 'audio/wav' });
      audioUrl = audioUpload.url;
    }

    if (btn) btn.textContent = '⏳ Generating video…';
    const prompt = shot.lyric || shot.action || 'Character speaking naturally';
    const data = await apiFetch('/api/create-talking-video', { imageUrl, audioUrl, prompt });
    const videoUrl = data.url;
    if (!videoUrl) throw new Error('No video returned');

    // Save video to shot
    shot.videoUrl = videoUrl;
    _compose.videoUrl = videoUrl;
    _syncAnimaticFromLiveShots();
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

// ── Motion video ─────────────────────────────────────────────────────────────

let _motionConfig = {
  preset: null,
  zoomTarget: { x: 0.5, y: 0.35 },
  zoomScale: 1.35,
  panStart: { cx: 0.25, cy: 0.5, scale: 1.15 },
  panEnd:   { cx: 0.75, cy: 0.5, scale: 1.15 },
};
let _motionImg = null;   // Image object of the composed frame
let _motionDrag = null;  // active drag state

function _getComposeDataUrl() {
  const canvas = document.getElementById('compose-canvas');
  const savedIdx = _compose.selectedIdx;
  _compose.selectedIdx = -1;
  renderCompose();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  _compose.selectedIdx = savedIdx;
  renderCompose();
  return dataUrl;
}

async function selectMotionPreset(preset) {
  _motionConfig.preset = preset;
  document.querySelectorAll('.btn-motion-preset').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === preset));

  const isZoom = preset === 'zoom-in' || preset === 'zoom-out';
  const isPan  = preset === 'pan-left' || preset === 'pan-right';
  document.getElementById('motion-zoom-controls').style.display = isZoom ? '' : 'none';
  document.getElementById('motion-pan-controls').style.display  = isPan  ? '' : 'none';
  document.getElementById('btn-generate-motion').style.display  = '';

  const hint = document.getElementById('motion-canvas-hint');
  if (isZoom) hint.textContent = 'Drag the yellow dot to set zoom target.';
  if (isPan)  hint.textContent = 'Drag the blue (start) or green (end) frame to set pan path.';

  // Default pan positions based on direction
  if (preset === 'pan-left')  { _motionConfig.panStart = { cx: 0.25, cy: 0.5, scale: 1.15 }; _motionConfig.panEnd = { cx: 0.75, cy: 0.5, scale: 1.15 }; }
  if (preset === 'pan-right') { _motionConfig.panStart = { cx: 0.75, cy: 0.5, scale: 1.15 }; _motionConfig.panEnd = { cx: 0.25, cy: 0.5, scale: 1.15 }; }

  // Load preview image if needed
  if (!_motionImg) {
    const dataUrl = _getComposeDataUrl();
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = dataUrl; });
    _motionImg = img;
  }

  const previewCanvas = document.getElementById('motion-preview-canvas');
  previewCanvas.style.display = '';
  hint.style.display = '';
  _setupMotionCanvas(previewCanvas);
  renderMotionPreview();
}

function _setupMotionCanvas(canvas) {
  canvas.onpointerdown = e => {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const preset = _motionConfig.preset;

    if (preset === 'zoom-in' || preset === 'zoom-out') {
      _motionDrag = { type: 'zoomTarget' };
    } else {
      // Determine which handle is closer
      const distStart = Math.hypot(px - _motionConfig.panStart.cx, py - _motionConfig.panStart.cy);
      const distEnd   = Math.hypot(px - _motionConfig.panEnd.cx,   py - _motionConfig.panEnd.cy);
      _motionDrag = { type: distStart <= distEnd ? 'panStart' : 'panEnd' };
    }
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  canvas.onpointermove = e => {
    if (!_motionDrag) return;
    const r = canvas.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    if (_motionDrag.type === 'zoomTarget') {
      _motionConfig.zoomTarget = { x: px, y: py };
    } else if (_motionDrag.type === 'panStart') {
      _motionConfig.panStart.cx = px; _motionConfig.panStart.cy = py;
    } else {
      _motionConfig.panEnd.cx = px; _motionConfig.panEnd.cy = py;
    }
    renderMotionPreview();
  };
  canvas.onpointerup = () => { _motionDrag = null; };
}

function renderMotionPreview() {
  const canvas = document.getElementById('motion-preview-canvas');
  if (!canvas || !_motionImg) return;
  const W = canvas.offsetWidth * (window.devicePixelRatio || 1);
  const H = Math.round(W * 9 / 16);
  if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d');
  ctx.drawImage(_motionImg, 0, 0, W, H);

  const preset = _motionConfig.preset;

  if (preset === 'zoom-in' || preset === 'zoom-out') {
    const { x: tx, y: ty } = _motionConfig.zoomTarget;
    const scale = _motionConfig.zoomScale;
    const vw = W / scale, vh = H / scale;
    const vx = Math.max(0, Math.min(W - vw, tx * W - vw / 2));
    const vy = Math.max(0, Math.min(H - vh, ty * H - vh / 2));

    const [startColor, endColor] = preset === 'zoom-in' ? ['#60a5fa','#4ade80'] : ['#4ade80','#60a5fa'];

    // Dim area outside end viewport
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, vy);
    ctx.fillRect(0, vy + vh, W, H - vy - vh);
    ctx.fillRect(0, vy, vx, vh);
    ctx.fillRect(vx + vw, vy, W - vx - vw, vh);

    // Start frame (full image outline)
    ctx.strokeStyle = startColor; ctx.lineWidth = 2; ctx.setLineDash([5,3]);
    ctx.strokeRect(2, 2, W - 4, H - 4); ctx.setLineDash([]);
    ctx.font = `bold ${Math.round(W * 0.035)}px sans-serif`;
    ctx.fillStyle = startColor; ctx.fillText('START', 8, Math.round(W * 0.045));

    // End frame
    ctx.strokeStyle = endColor; ctx.lineWidth = 2;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = endColor; ctx.fillText('END', vx + 6, vy + Math.round(W * 0.045));

    // Target dot + crosshair
    const dx = tx * W, dy = ty * H;
    ctx.strokeStyle = 'rgba(250,204,21,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, H); ctx.moveTo(0, dy); ctx.lineTo(W, dy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(dx, dy, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250,204,21,0.95)'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

  } else if (preset === 'pan-left' || preset === 'pan-right') {
    const drawVp = (vp, color, label) => {
      const vw = W / vp.scale, vh = H / vp.scale;
      const vx = Math.max(0, Math.min(W - vw, vp.cx * W - vw / 2));
      const vy = Math.max(0, Math.min(H - vh, vp.cy * H - vh / 2));
      ctx.strokeStyle = color; ctx.lineWidth = 2.5;
      ctx.strokeRect(vx, vy, vw, vh);
      ctx.font = `bold ${Math.round(W * 0.035)}px sans-serif`;
      ctx.fillStyle = color; ctx.fillText(label, vx + 6, vy + Math.round(W * 0.045));
      // Center handle
      ctx.beginPath(); ctx.arc(vp.cx * W, vp.cy * H, 7, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    };
    drawVp(_motionConfig.panStart, '#60a5fa', 'START');
    drawVp(_motionConfig.panEnd,   '#4ade80', 'END');
  }
}

function onMotionZoomScale(input) {
  _motionConfig.zoomScale = parseFloat(input.value);
  document.getElementById('motion-zoom-scale-label').textContent = _motionConfig.zoomScale.toFixed(2) + '×';
  renderMotionPreview();
}

function onMotionPanScale(which, input) {
  const val = parseFloat(input.value);
  if (which === 'start') { _motionConfig.panStart.scale = val; document.getElementById('motion-pan-start-scale-label').textContent = val.toFixed(2) + '×'; }
  else                   { _motionConfig.panEnd.scale   = val; document.getElementById('motion-pan-end-scale-label').textContent   = val.toFixed(2) + '×'; }
  renderMotionPreview();
}

// Render a pan/zoom motion video from an image + config and upload it.
// Returns the Supabase CDN URL. onProgress(pct) called during render.
async function _renderMotionVideoBlob(img, config, durationSecs, onProgress) {
  let startRect, endRect;
  const { preset } = config;
  if (preset === 'zoom-in') {
    startRect = { cx: 0.5, cy: 0.5, scale: 1.0 };
    endRect   = { cx: config.zoomTarget.x, cy: config.zoomTarget.y, scale: config.zoomScale };
  } else if (preset === 'zoom-out') {
    startRect = { cx: config.zoomTarget.x, cy: config.zoomTarget.y, scale: config.zoomScale };
    endRect   = { cx: 0.5, cy: 0.5, scale: 1.0 };
  } else {
    startRect = config.panStart;
    endRect   = config.panEnd;
  }
  const W = 1024, H = 576;
  const offscreen = document.createElement('canvas');
  offscreen.width = W; offscreen.height = H;
  const ctx = offscreen.getContext('2d');
  const imgW = img.naturalWidth, imgH = img.naturalHeight;
  const fps = 30, totalFrames = Math.round(durationSecs * fps);
  const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const stream = offscreen.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start();
  for (let f = 0; f < totalFrames; f++) {
    const t = ease(f / Math.max(1, totalFrames - 1));
    const cx    = startRect.cx    + (endRect.cx    - startRect.cx)    * t;
    const cy    = startRect.cy    + (endRect.cy    - startRect.cy)    * t;
    const scale = startRect.scale + (endRect.scale - startRect.scale) * t;
    const vpW = imgW / scale, vpH = imgH / scale;
    const sx = Math.max(0, Math.min(imgW - vpW, cx * imgW - vpW / 2));
    const sy = Math.max(0, Math.min(imgH - vpH, cy * imgH - vpH / 2));
    ctx.drawImage(img, sx, sy, vpW, vpH, 0, 0, W, H);
    if (f % 15 === 0 && onProgress) onProgress(Math.round(f / totalFrames * 100));
    await new Promise(r => setTimeout(r, 1000 / fps));
  }
  recorder.stop();
  await new Promise(r => { recorder.onstop = r; });
  return new Blob(chunks, { type: 'video/webm' });
}

async function generateMotionVideo() {
  const { preset } = _motionConfig;
  if (!preset) return;
  const statusEl = document.getElementById('motion-video-status');
  const genBtn   = document.getElementById('btn-generate-motion');
  const shot     = shots.find(s => s.id === _compose?.shotId);
  const durationSecs = parseInt(document.getElementById('motion-duration')?.value || '4', 10);
  const setStatus = t => { if (statusEl) statusEl.textContent = t; };

  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '⏳ Rendering…'; }

  try {
    const img = _motionImg || (() => { throw new Error('No preview image'); })();
    const savedConfig = JSON.parse(JSON.stringify(_motionConfig));

    const blob = await _renderMotionVideoBlob(img, savedConfig, durationSecs, pct => setStatus(`Rendering… ${pct}%`));

    // Upload to Supabase for persistence
    setStatus('Uploading…');
    const b64 = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
    const uploadData = await apiFetch('/api/upload-video', { base64: b64, mediaType: 'video/webm', projectId: currentProjectId, shotId: shot?.id });
    const videoUrl = uploadData.url;

    if (shot) {
      shot.motionVideoUrl = videoUrl;
      shot.motionConfig = { ...savedConfig, durationSecs };
      _syncAnimaticFromLiveShots();
      autoSave();
    }
    _compose.motionVideoUrl = videoUrl;

    const sideVid = document.getElementById('compose-video-player');
    if (sideVid) { sideVid.src = videoUrl; sideVid.style.display = ''; }
    switchComposeView('video');
    setStatus('Motion video saved.');
    showToast('Motion video created!');
  } catch(e) {
    setStatus('Error: ' + e.message);
    showToast('Motion video failed: ' + e.message, true);
  } finally {
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = '▶ Generate Motion Video'; }
  }
}

// Clear cached preview image when compose tab is reopened so it reflects latest edits
function resetMotionPreview() {
  _motionImg = null;
  _motionConfig.preset = null;
  document.querySelectorAll('.btn-motion-preset').forEach(b => b.classList.remove('active'));
  const pc = document.getElementById('motion-preview-canvas');
  if (pc) pc.style.display = 'none';
  const hint = document.getElementById('motion-canvas-hint');
  if (hint) hint.style.display = 'none';
  document.getElementById('motion-zoom-controls').style.display = 'none';
  document.getElementById('motion-pan-controls').style.display  = 'none';
  document.getElementById('btn-generate-motion').style.display  = 'none';
  const statusEl = document.getElementById('motion-video-status');
  if (statusEl) statusEl.textContent = '';
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
  if (tab === 'draw') {
    _drawEnableCanvas();
    _drawSetTool(_drawTool);
    // Populate character select
    const sel = document.getElementById('draw-char-select');
    if (sel) {
      const prev = sel.value;
      sel.innerHTML = '<option value="">— select character —</option>' +
        characters.map(c => `<option value="${esc(c.id)}">${esc(c.name || 'Unnamed')}</option>`).join('');
      if (prev) sel.value = prev;
    }
    // Wire size display
    const sizeEl = document.getElementById('draw-size');
    const sizeVal = document.getElementById('draw-size-val');
    if (sizeEl && sizeVal) sizeEl.oninput = () => { sizeVal.textContent = sizeEl.value; };
  } else {
    _drawDisableCanvas();
  }
  if (tab === 'video') {
    resetMotionPreview();
    // Restore persisted motion video if it exists
    const shot = shots.find(s => s.id === _compose?.shotId);
    if (shot?.motionVideoUrl) {
      const sideVid = document.getElementById('compose-video-player');
      if (sideVid) { sideVid.src = shot.motionVideoUrl; sideVid.style.display = ''; }
    }
  }
  switchComposeView(tab === 'video' && (_compose?.videoUrl || _compose?.motionVideoUrl) ? 'video' : 'image');
}

function switchComposeView(mode) {
  const canvasWrap = document.querySelector('.compose-canvas-wrap');
  const videoView = document.getElementById('compose-video-view');
  if (!canvasWrap || !videoView) return;
  if (mode === 'video') {
    canvasWrap.style.display = 'none';
    videoView.style.display = 'flex';
    const vid = document.getElementById('compose-video-main');
    const url = _compose?.videoUrl || _compose?.motionVideoUrl;
    if (vid && url && vid.src !== url) vid.src = url;
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
    if (!url) throw new Error('No image returned from generation');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!_compose) return;
      _compose.bgImg = img; _compose.bgUrl = url; _compose.bgColor = null;
      renderCompose(); saveComposeLayers();
      showToast('Image updated.');
    };
    img.onerror = () => showToast('Image generated but failed to load — try again.', true);
    img.src = proxyUrl(url);
    addImagesToLocation(_compose.locationId, [url]);
    addUrlToShotImages(url);
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

    const layerIdx = _compose.selectedIdx;
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      if (!_compose || layerIdx >= _compose.layers.length) return;
      const h = COMPOSE_H * layer.scale;
      const w = h * (imgEl.naturalWidth / imgEl.naturalHeight);
      _compose.layers[layerIdx] = { ..._compose.layers[layerIdx], imgEl, imgUrl: finalUrl, w, h };
      updateComposeLayerPanel(); renderCompose(); saveComposeLayers();
      showToast('Layer updated.');
    };
    imgEl.onerror = () => showToast('Layer updated but image failed to load — try again.', true);
    imgEl.src = proxyUrl(finalUrl);
    autoSave();
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
    bgScale: _compose.bgScale ?? 1,
    bgOffsetX: _compose.bgOffsetX ?? 0,
    bgOffsetY: _compose.bgOffsetY ?? 0,
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
  _compose.bgScale = snap.bgScale ?? 1;
  _compose.bgOffsetX = snap.bgOffsetX ?? 0;
  _compose.bgOffsetY = snap.bgOffsetY ?? 0;
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
      _syncAnimaticFromLiveShots();
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
  if (!currentProjectId || cloudOnlyMode) return;
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
