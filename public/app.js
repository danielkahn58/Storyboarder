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
const AUTO_VERSION_EVERY = 100;

let lastScriptText = null;
let lastScriptName = null;

const SHOT_SIZES     = ['Extreme Wide Shot','Wide Shot','Medium Wide Shot','Medium Shot','Medium Close Up','Close Up','Extreme Close Up'];
const SHOT_ANGLES    = ["Eye Level","Low Angle","High Angle","Bird's Eye View","Worm's Eye View","Dutch Angle","Over the Shoulder"];
const SHOT_MOVEMENTS = ['Static','Pan Left','Pan Right','Tilt Up','Tilt Down','Slow Zoom In','Slow Zoom Out','Dolly In','Dolly Out','Tracking Shot','Handheld','Crane Up','Crane Down','Whip Pan'];

function genId() { return Math.random().toString(36).slice(2, 9); }

// ── persistence ───────────────────────────────────────────────────────────
// ── project management ────────────────────────────────────────────────────
function projectDataKey(id)     { return `sg-data-${id}`; }
function projectVersionsKey(id) { return `sg-versions-${id}`; }

function loadProjects() {
  try {
    const saved = localStorage.getItem('sg-projects');
    if (saved) { const p = JSON.parse(saved); projects = Array.isArray(p) ? p : []; }
  } catch {}
  // Migrate legacy single-project data if no projects exist yet
  if (!projects.length && localStorage.getItem('character-generator-data')) {
    try {
      const id = genId();
      projects = [{ id, name: 'My Project', createdAt: Date.now(), updatedAt: Date.now() }];
      // Move (not copy) old data to free space: write new key, then delete old key
      const oldData = localStorage.getItem('character-generator-data');
      const oldVersions = localStorage.getItem('character-generator-versions');
      // Delete old keys first to free space before writing new ones
      localStorage.removeItem('character-generator-data');
      localStorage.removeItem('character-generator-versions');
      localStorage.setItem(projectDataKey(id), oldData);
      if (oldVersions) localStorage.setItem(projectVersionsKey(id), oldVersions);
      saveProjects();
    } catch(e) {
      console.warn('Migration failed, starting fresh:', e.message);
      projects = [];
    }
  }
}

function saveProjects() {
  localStorage.setItem('sg-projects', JSON.stringify(projects));
}

function createProject() {
  const name = prompt('Project name:');
  if (name === null) return; // cancelled
  const id = genId();
  projects.push({ id, name: name.trim() || 'Untitled', createdAt: Date.now(), updatedAt: Date.now() });
  saveProjects();
  openProject(id);
}

function openProject(id) {
  currentProjectId = id;
  versions = []; currentVersionLabel = null; editsSinceVersion = 0;
  characters = []; locations = []; shots = [];
  visualStyles = [
    { id: 'style-photo', name: 'Photorealistic', prompt: 'Photorealistic, hyperrealistic, cinematic photography, 8k, sharp detail.' },
    { id: 'style-2d',    name: '2D Animation',   prompt: '2D animation style. Clean bold line art, smooth cel-shading, bright saturated colors. No shadows on background.' },
    { id: 'style-3d',    name: '3D Animation',   prompt: '3D animation style, Pixar-inspired, smooth subsurface scattering, soft studio lighting, vibrant colors, clean render.' },
  ];
  selectedStyleId = 'style-photo';
  // Update project's updatedAt
  const proj = projects.find(p => p.id === id);
  if (proj) { proj.updatedAt = Date.now(); saveProjects(); }
  loadData();
  document.getElementById('view-projects').style.display = 'none';
  document.getElementById('view-editor').style.display = 'block';
  renderHeader();
  initSectionNav();
}

function backToProjects() {
  autoSave();
  currentProjectId = null;
  document.getElementById('view-editor').style.display = 'none';
  document.getElementById('view-projects').style.display = 'block';
  renderHeader();
  renderProjectsView();
}

function deleteProject(id) {
  if (!confirm('Delete this project and all its versions? This cannot be undone.')) return;
  projects = projects.filter(p => p.id !== id);
  localStorage.removeItem(projectDataKey(id));
  localStorage.removeItem(projectVersionsKey(id));
  saveProjects();
  renderProjectsView();
}

function renameProject(id, name) {
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  const trimmed = name.trim() || 'Untitled';
  proj.name = trimmed;
  proj.updatedAt = Date.now();
  saveProjects();
  // If this is the currently open project, update the header name display
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
              <button class="btn-delete-project" onclick="event.stopPropagation();startRenameProject('${p.id}',event)" title="Rename">✏️</button>
              <button class="btn-delete-project" onclick="event.stopPropagation();deleteProject('${p.id}')" title="Delete">✕</button>
            </div>
          </div>
        </div>`;
    }).join('')}
  `;
}

function renderHeader() {
  const el = document.getElementById('main-header');
  if (!el) return;
  if (!currentProjectId) {
    // Projects view header
    el.innerHTML = `<div class="header-main"><h1>Storyboard Generator</h1><div></div></div>`;
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
      </div>
    </div>
    <nav class="section-nav">
      <button class="section-nav-btn" onclick="scrollToSection('sec-characters')">Characters</button>
      <button class="section-nav-btn" onclick="scrollToSection('sec-locations')">Locations</button>
      <button class="section-nav-btn" onclick="scrollToSection('sec-shots')">Shot Sequence</button>
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

let _sectionObserver = null;
function initSectionNav() {
  if (_sectionObserver) _sectionObserver.disconnect();
  const headerH = document.getElementById('main-header')?.offsetHeight || 60;
  _sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const id = entry.target.id;
      const btn = document.querySelector(`.section-nav-btn[onclick*="${id}"]`);
      if (btn) btn.classList.toggle('active', entry.isIntersecting);
    });
  }, { rootMargin: `-${headerH}px 0px -60% 0px`, threshold: 0 });
  ['sec-characters', 'sec-locations', 'sec-shots'].forEach(id => {
    const el = document.getElementById(id);
    if (el) _sectionObserver.observe(el);
  });
}

function promptRenameCurrentProject() {
  const proj = projects.find(p => p.id === currentProjectId);
  if (!proj) return;
  const name = prompt('Rename project:', proj.name);
  if (name !== null) { renameProject(currentProjectId, name); }
}

function initApp() {
  loadProjects();
  renderHeader();
  renderProjectsView();
}

function loadData() {
  loadVersions();
  try {
    const key = currentProjectId ? projectDataKey(currentProjectId) : 'character-generator-data';
    const saved = localStorage.getItem(key);
    if (saved) {
      const d = JSON.parse(saved);
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
    }
  } catch {}
  if (!characters.length) characters = [newCharacter()];
  if (!locations.length) locations = [newLocation()];
  try {
    const savedScript = localStorage.getItem('character-generator-script');
    if (savedScript) { const s = JSON.parse(savedScript); lastScriptText = s.text; lastScriptName = s.name; }
  } catch {}
  applyStyleUI();
  renderScriptPreview();
  renderCharacters();
  renderLocations();
  renderShots();
  renderVersionUI();
}

function saveData() {
  syncFromDOM();
  const key = currentProjectId ? projectDataKey(currentProjectId) : 'character-generator-data';
  localStorage.setItem(key, JSON.stringify({ characters, locations, shots, visualStyles, selectedStyleId, charGenRules, locationGenRules, charBoilerplate: CHAR_BOILERPLATE }));
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
  localStorage.setItem(key, JSON.stringify({ characters, locations, shots, visualStyles, selectedStyleId, charGenRules, locationGenRules, charBoilerplate: CHAR_BOILERPLATE }));
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
  const stripLoc  = l => ({ id: l.id, name: l.name, reference: l.reference, prompt: l.prompt, possibleDuplicate: l.possibleDuplicate, shotAngles: l.shotAngles ? Object.fromEntries(Object.entries(l.shotAngles).map(([k,v]) => [k, { prompt: v.prompt }])) : undefined });
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
  if (!isAuto) {
    const btn = document.getElementById('btn-new-version');
    if (btn) { btn.classList.add('saved-flash'); setTimeout(() => btn.classList.remove('saved-flash'), 1500); }
  }
}

function loadVersion(label) {
  if (!label) return;
  const v = versions.find(v => v.label === label);
  if (!v) return;
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
  localStorage.setItem(_lk, JSON.stringify({ characters, locations, shots, visualStyles, selectedStyleId, charGenRules, locationGenRules, charBoilerplate: CHAR_BOILERPLATE }));
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
    ${currentVersionLabel ? `<span class="version-badge">v${currentVersionLabel}</span>` : ''}
    <span id="version-edit-count" class="version-edit-count">${editsSinceVersion > 0 ? `${editsSinceVersion}/${AUTO_VERSION_EVERY}` : ''}</span>
  `;
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
function newLocation() { return { id: genId(), name: '', reference: '', referenceImage: null, prompt: '', images: [], shotAngles: {}, customViews: [], possibleDuplicate: false }; }

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
function newShot() { return { id: genId(), lyric: '', description: '', characterIds: [], locationId: '', shotSize: 'Medium Shot', shotAngle: 'Eye Level', shotMovement: 'Static', imagePrompt: '', videoPrompt: '', images: [], videoUrl: '', characterDetails: {}, refImage: null }; }

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
    syncFromDOM();
    const shot = shots.find(s => s.id === id);
    if (shot) { shot.refImage = { dataUrl: e.target.result, mediaType: file.type }; autoSave(); renderShots(); }
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
    const locImg = loc?.images?.[0] || null;
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
    loadComposeBackground(loc?.images?.[0] || null);
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
  const stdRows = LOC_ANGLES.map(angle => {
    const key = angle.replace(/\s+/g, '-');
    const entry = l.shotAngles?.[angle] || {};
    const img = entry.image;
    const imgHtml = img
      ? `<img src="${esc(img)}" alt="${esc(angle)}">`
      : `<div class="loc-shot-placeholder">no image</div>`;
    return `<tr>
      <td class="loc-shot-label">${esc(angle)}</td>
      <td><textarea class="loc-angle-prompt" rows="3" oninput="onLocAnglePromptChange('${l.id}','${angle}',this.value)">${esc(entry.prompt || '')}</textarea></td>
      <td class="loc-shot-img-slot" id="loc-angle-img-${l.id}-${key}">${imgHtml}</td>
      <td><button class="btn-regen-angle" onclick="generateLocAngleSingle('${l.id}','${angle}')">Regenerate</button></td>
    </tr>`;
  }).join('');
  const customRows = l.customViews.map((cv, i) => {
    const img = cv.image;
    const imgHtml = img
      ? `<img src="${esc(img)}" alt="${esc(cv.name || '')}">`
      : `<div class="loc-shot-placeholder">no image</div>`;
    return `<tr>
      <td class="loc-shot-label"><input type="text" value="${esc(cv.name)}" placeholder="View name…" style="width:100%;background:#111;border:1px solid #222;border-radius:3px;color:#ccc;font-size:11px;padding:3px 5px" oninput="onLocCustomViewNameChange('${l.id}',${i},this.value)"></td>
      <td><textarea class="loc-angle-prompt" rows="3" oninput="onLocCustomViewPromptChange('${l.id}',${i},this.value)">${esc(cv.prompt || '')}</textarea></td>
      <td class="loc-shot-img-slot" id="loc-custom-img-${l.id}-${i}">${imgHtml}</td>
      <td>
        <button class="btn-regen-angle" onclick="generateLocCustomView('${l.id}',${i})">Generate</button>
        <button onclick="deleteLocCustomView('${l.id}',${i})" style="display:block;margin-top:4px;background:none;border:1px solid #3a1a1a;border-radius:3px;color:#a05050;font-size:10px;padding:2px 6px;cursor:pointer;width:100%">Remove</button>
      </td>
    </tr>`;
  }).join('');
  return `<tr class="loc-shot-row" id="loc-shots-${l.id}" style="display:none">
    <td colspan="6">
      <div class="loc-shot-inner">
        <table class="loc-shot-table">
          <thead><tr><th>Variation</th><th>Prompt</th><th>Image</th><th></th></tr></thead>
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
}

function charRowHTML(c) {
  const frontUrl = c.images?.[0] || null;
  const frontHTML = frontUrl
    ? `<img src="${esc(frontUrl)}" alt="Front">`
    : `<span class="placeholder">·</span>`;
  const refImgHTML = c.referenceImage
    ? `<img src="${esc(c.referenceImage.dataUrl)}" alt="Reference"><button class="remove-img" onclick="removeRefImage('${c.id}', event)">✕</button>`
    : `<div class="upload-hint">Click to<br>upload</div>`;
  return `<tr data-id="${c.id}">
    <td><input type="text" class="field-name" placeholder="Name…" value="${esc(c.name)}" oninput="debouncedSave()"></td>
    <td><div class="field-ref ref-rich" contenteditable="true" data-placeholder="Describe appearance, style, mood…" oninput="debouncedSave()">${c.reference || ''}</div></td>
    <td>
      <div class="ref-img-cell">
        <div class="ref-img-preview" onclick="triggerImageUpload('${c.id}')">${refImgHTML}</div>
        <input type="file" id="file-${c.id}" class="hidden" accept="image/*" onchange="handleImageUpload('${c.id}', this)">
      </div>
    </td>
    <td>
      <div class="char-prompt-section">
        <span class="char-prompt-label">Character Description</span>
        <textarea class="field-prompt" rows="3" placeholder="Describe the character's appearance…" oninput="debouncedSave()">${esc(c.prompt)}</textarea>
        <span class="char-prompt-label" style="margin-top:4px">Framing (applied to all characters)</span>
        <div class="char-prompt-static">${esc(CHAR_BOILERPLATE)}</div>
        <span class="char-prompt-label" style="margin-top:4px">Visual Style</span>
        <div class="char-prompt-static char-style-preview">${esc(getStylePrompt()) || '(no style selected)'}</div>
      </div>
    </td>
    <td>
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
        <button class="btn-toggle-angles" onclick="toggleCharAngles('${c.id}')">▶ Angles</button>
        <button class="btn btn-gen-prompt" onclick="generateCharPrompt('${c.id}')">Generate Prompt</button>
        <button class="btn btn-gen-images" onclick="generateCharFrontProfile('${c.id}')">Generate Front Profile</button>
        <button class="btn btn-gen-images" style="background:#162a2a;border-color:#254a4a;color:#4adede" onclick="generateCharAngles('${c.id}')">Generate Angles</button>
        <button class="btn btn-delete" onclick="deleteCharacter('${c.id}')">Remove</button>
      </div>
    </td>
  </tr>`;
}

function charAngleRowHTML(c) {
  const rows = CHAR_ANGLES.map(angle => {
    const d = c.angles?.[angle] || {};
    const isMirror = !!MIRROR_PAIRS[angle];
    const imgHTML = d.image
      ? `<img src="${esc(d.image)}" alt="${esc(angle)}">`
      : `<span class="placeholder">·</span>`;
    const labelHTML = isMirror
      ? `${esc(angle)} <span style="color:#555;font-size:9px">🪞</span>`
      : esc(angle);
    const promptCell = isMirror
      ? `<td style="color:#383838;font-size:10px;font-style:italic;vertical-align:middle">Mirrored from ${esc(MIRROR_PAIRS[angle])}</td>`
      : `<td><textarea class="angle-prompt-field" data-angle="${esc(angle)}" rows="3" oninput="debouncedSave()">${esc(d.prompt || '')}</textarea></td>`;
    return `<tr>
      <td class="angle-label">${labelHTML}</td>
      ${promptCell}
      <td><div class="angle-img-slot" id="angle-img-${c.id}-${angle.replace(/\W/g,'_')}">${imgHTML}</div></td>
      <td><button class="btn btn-regen" onclick="regenerateCharAngle('${c.id}','${angle}')">${isMirror ? '🪞 Re-mirror' : '↺ Regenerate'}</button></td>
    </tr>`;
  }).join('');
  return `<tr class="char-angle-row" id="char-angles-${c.id}" style="display:none">
    <td colspan="6">
      <div class="char-angle-inner">
        <table class="angle-subtable">
          <thead><tr><th>Angle</th><th>Prompt</th><th>Image</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </td>
  </tr>`;
}

function locRowHTML(l) {
  const defaultImg = l.images?.[0];
  const imgsHTML = `<div class="img-slot">${defaultImg ? `<img src="${esc(defaultImg)}" alt="">` : `<span class="placeholder">·</span>`}</div>`;
  const refImgHTML = l.referenceImage
    ? `<img src="${esc(l.referenceImage.dataUrl)}" alt="Reference"><button class="remove-img" onclick="removeLocRefImage('${l.id}', event)">✕</button>`
    : `<div class="upload-hint">Click to<br>upload</div>`;
  return `<tr data-id="${l.id}">
    <td>
      <div style="display:flex;flex-direction:column;gap:4px">
        <input type="text" class="field-name" placeholder="Name…" value="${esc(l.name)}" oninput="debouncedSave()">
        ${l.possibleDuplicate ? `<div class="loc-dup-flag" title="May be the same as another location">⚠ Possible duplicate</div>` : ''}
        <button class="btn-toggle-shot-angles" onclick="toggleLocAngles('${l.id}')" style="align-self:flex-start;background:none;border:1px solid #222;border-radius:4px;color:#555;font-size:10px;padding:3px 6px;cursor:pointer;white-space:nowrap">▶ Variations</button>
      </div>
    </td>
    <td><textarea class="field-ref" rows="3" placeholder="Describe environment, lighting, atmosphere…" oninput="debouncedSave()">${esc(l.reference)}</textarea></td>
    <td>
      <div class="ref-img-cell">
        <div class="ref-img-preview" onclick="triggerLocImageUpload('${l.id}')">${refImgHTML}</div>
        <input type="file" id="locfile-${l.id}" class="hidden" accept="image/*" onchange="handleLocImageUpload('${l.id}', this)">
      </div>
    </td>
    <td>
      <div class="char-prompt-section">
        <span class="char-prompt-label">Location Description</span>
        <textarea class="field-prompt" rows="3" placeholder="Describe the environment, lighting, atmosphere…" oninput="debouncedSave()">${esc(l.prompt)}</textarea>
        <span class="char-prompt-label" style="margin-top:4px">Visual Style</span>
        <div class="char-prompt-static char-style-preview">${esc(getStylePrompt()) || '(no style selected)'}</div>
      </div>
    </td>
    <td><div class="images-grid" id="loc-imgs-${l.id}">${imgsHTML}</div></td>
    <td>
      <div class="actions">
        <button class="btn btn-gen-prompt" onclick="generateLocPrompt('${l.id}')">Generate Prompt</button>
        <button class="btn btn-gen-images" onclick="generateLocImages('${l.id}')">Generate Default View</button>
        <button class="btn-gen-shot-angles" onclick="generateLocAltViews('${l.id}')">Generate Variations</button>
        <button class="btn btn-delete" onclick="deleteLocation('${l.id}')">Remove</button>
      </div>
    </td>
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
  const locOpts = `<option value="">— None —</option>` + locations.map(l => `<option value="${esc(l.id)}"${(s.locationId||'')=== l.id?' selected':''}>${esc(l.name||'Unnamed')}</option>`).join('');
  const sizeOpts = SHOT_SIZES.map(v => `<option${s.shotSize === v ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const angleOpts = SHOT_ANGLES.map(v => `<option${s.shotAngle === v ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const moveOpts = SHOT_MOVEMENTS.map(v => `<option${s.shotMovement === v ? ' selected' : ''}>${esc(v)}</option>`).join('');
  return `<tr data-id="${s.id}">
    <td><div class="order-btns">
      <button class="btn-ord" onclick="moveShot('${s.id}',-1)" ${idx===0?'disabled':''}>▲</button>
      <button class="btn-ord" onclick="moveShot('${s.id}',1)" ${idx===shots.length-1?'disabled':''}>▼</button>
      <button class="btn-ord btn-detail-toggle" onclick="toggleShotDetail('${s.id}')" title="Character details">▶</button>
      <button class="btn-ord" onclick="addShotAfter('${s.id}')" title="Add shot below" style="color:#4ade80;border-color:#254a31">+</button>
      <button class="btn-ord" onclick="deleteShot('${s.id}')" title="Delete shot" style="color:#e05050;border-color:#4a1a1a">✕</button>
    </div></td>
    <td><textarea class="field-lyric" rows="3" placeholder="Lyric or action…" oninput="debouncedSave()">${esc(s.lyric)}</textarea></td>
    <td><textarea class="field-desc" rows="3" placeholder="Visual description…" oninput="debouncedSave()">${esc(s.description)}</textarea></td>
    <td><div class="char-checks">${charChecks}</div></td>
    <td><select class="field-loc-select" onchange="onShotLocationChange('${s.id}',this.value);autoSave()">${locOpts}</select>
<div class="shot-ref-zone" onclick="triggerShotRefUpload('${s.id}')" title="Reference photo — overrides location when generating images">
  ${s.refImage
    ? `<img src="${esc(s.refImage.dataUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:3px"><button class="shot-ref-remove" onclick="removeShotRefImage('${s.id}',event)">✕</button>`
    : `<span>📷</span><span style="font-size:8px">Ref</span>`}
</div>
<input type="file" id="shotref-${s.id}" accept="image/*" capture="environment" style="display:none" onchange="handleShotRefUpload('${s.id}',this)"></td>
    <td><select class="field-size" onchange="autoSave()">${sizeOpts}</select></td>
    <td><select class="field-movement" onchange="autoSave()">${moveOpts}</select></td>
    <td><textarea class="field-imgprompt" rows="3" placeholder="Image prompt (opening frame)…" oninput="debouncedSave()">${esc(s.imagePrompt)}</textarea></td>
    <td><textarea class="field-vidprompt" rows="3" placeholder="Video prompt (action + camera movement)…" oninput="debouncedSave()">${esc(s.videoPrompt)}</textarea></td>
    <td><div class="images-grid" id="shot-imgs-${s.id}">${imgsHTML}</div></td>
    <td>
      <div class="final-image-cell" id="final-img-${s.id}">
        ${(() => {
          const loc = locations.find(l => l.id === s.locationId);
          const locImg = loc?.images?.[0] || null;
          const previewImg = s.finalImage || locImg;
          const locOpts2 = `<option value="">— No Location —</option>` + locations.map(l => `<option value="${esc(l.id)}"${s.locationId === l.id?' selected':''}>${esc(l.name||'Unnamed')}</option>`).join('');
          return `<div class="final-image-loc-preview" onclick="openCompose('${s.id}')">
            ${previewImg ? `<img src="${esc(previewImg)}" class="final-image-preview">` : `<div class="final-image-loc-empty"><span>No location</span></div>`}
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
  localStorage.removeItem('character-generator-script');
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
    if (lastScriptText) localStorage.setItem('character-generator-script', JSON.stringify({ text: lastScriptText, name: lastScriptName }));
    renderScriptPreview();
    if (data.characters?.length) mergeCharacters(data.characters);
    if (data.locations?.length) mergeLocations(data.locations);
    status.textContent = `Parsed ${data.characters?.length ?? 0} characters and ${data.locations?.length ?? 0} locations from "${file.name}" — click Generate Shot Sequence to build shots`;
    status.className = 'upload-status done';
  } catch (e) {
    status.textContent = 'Error: ' + e.message; status.className = 'upload-status error';
    showToast('Script parse failed: ' + e.message, true);
  }
  input.value = '';
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

function locationsSimilar(a, b) {
  const stop = new Set(['the','a','an','of','in','at','on','and','or','with','near','by']);
  const words = s => s.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stop.has(w));
  const w1 = words(a), w2 = words(b);
  if (!w1.length || !w2.length) return false;
  const shared = w1.filter(w => w2.includes(w));
  return shared.length >= Math.min(w1.length, w2.length) * 0.6;
}

function mergeCharacters(incoming) {
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
        }
      }
    } else {
      const name = (c.name || '').trim();
      const existing = characters.find(x => x.name.trim().toLowerCase() === name.toLowerCase());
      if (existing) {
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

function mergeLocations(incoming) {
  if (incoming.length) {
    locations = locations.filter(l => l.name.trim() || l.reference.trim() || l.prompt.trim() || l.images?.length);
  }
  for (const l of incoming) {
    const name = (l.name || '').trim();
    const existing = locations.find(x => x.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
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
function triggerImageUpload(id) { document.getElementById(`file-${id}`).click(); }
function handleImageUpload(id, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = dataUrl.split(',')[1];
      const char = characters.find(c => c.id === id);
      if (char) char.referenceImage = { dataUrl, base64, mediaType: 'image/jpeg' };
      const preview = document.querySelector(`tr[data-id="${id}"] .ref-img-preview`);
      if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Reference"><button class="remove-img" onclick="removeRefImage('${id}', event)">✕</button>`;
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
  if (preview) preview.innerHTML = `<div class="upload-hint">Click to<br>upload</div>`;
  autoSave();
}

// ── location image upload ─────────────────────────────────────────────────
function triggerLocImageUpload(id) { document.getElementById(`locfile-${id}`).click(); }
function handleLocImageUpload(id, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = dataUrl.split(',')[1];
      const loc = locations.find(l => l.id === id);
      if (loc) loc.referenceImage = { dataUrl, base64, mediaType: 'image/jpeg' };
      const preview = document.querySelector(`#locations-body tr[data-id="${id}"] .ref-img-preview`);
      if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Reference"><button class="remove-img" onclick="removeLocRefImage('${id}', event)">✕</button>`;
      autoSave();
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
  if (preview) preview.innerHTML = `<div class="upload-hint">Click to<br>upload</div>`;
  autoSave();
}

// ── location shot angles ───────────────────────────────────────────────────
function toggleLocAngles(id) {
  const row = document.getElementById(`loc-shots-${id}`);
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  row.style.display = isOpen ? 'none' : '';
  const btn = document.querySelector(`#locations-body tr[data-id="${id}"] .btn-toggle-shot-angles`);
  if (btn) btn.textContent = isOpen ? '▶ Variations' : '▼ Variations';
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
  const refImageUrl = loc.selectedImage || loc.images?.[0] || null;
  if (!refImageUrl) { showToast('Generate a default view first.', true); return; }
  const slot = document.getElementById(`loc-custom-img-${id}-${idx}`);
  const row = slot?.closest('tr');
  const btn = row?.querySelector('.btn-regen-angle');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  let prompt = cv.prompt;
  if (!prompt) { showToast('Add a prompt for this view first.', true); if (btn) { btn.disabled = false; btn.textContent = 'Generate'; } return; }

  try {
    const data = await apiFetch('/api/generate-shot-images', {
      prompt, referenceImageUrls: [refImageUrl], stylePrompt: getStylePrompt()
    });
    const imgUrl = data.images?.[0];
    if (imgUrl) {
      loc.customViews[idx].image = imgUrl;
      if (slot) slot.innerHTML = `<img src="${esc(imgUrl)}" alt="">`;
      autoSave();
    }
  } catch(e) { showToast('Error: ' + e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Generate'; } }
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
  const refImageUrl = loc.selectedImage || loc.images?.[0] || null;
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
  const refImageUrl = loc.selectedImage || loc.images?.[0] || null;
  if (!refImageUrl) { showToast('Generate a location image first.', true); return; }
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
  const btn = row.querySelector('.btn-gen-images');
  const prompt = row.querySelector('.field-prompt').value.trim();
  if (!prompt) { showToast('Generate a prompt first.', true); return; }
  const loc = locations.find(l => l.id === id);
  const grid = document.getElementById(`loc-imgs-${id}`);
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  grid.innerHTML = loadingSlots(1);
  const fullLocPrompt = [prompt, getStylePrompt()].filter(Boolean).join('\n\n');
  try {
    let data;
    if (loc?.referenceImage) {
      const uploaded = await apiFetch('/api/upload-reference', { base64: loc.referenceImage.base64, mediaType: loc.referenceImage.mediaType });
      data = await apiFetch('/api/generate-shot-images', { prompt: fullLocPrompt, referenceImageUrls: [uploaded.url], stylePrompt: '' });
    } else {
      data = await apiFetch('/api/generate-images', { prompt: fullLocPrompt, stylePrompt: '' });
    }
    const imgs = data.images.slice(0, 1);
    if (loc) loc.images = imgs;
    grid.innerHTML = imageSlots(imgs, 1);
    autoSave();
    showToast('Default view generated.');
  } catch(e) { grid.innerHTML = emptySlots(1); showToast('Error: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = 'Generate Default View'; }
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
  return `${name}${desc}`;
}

function toggleCharAngles(id) {
  const angleRow = document.getElementById(`char-angles-${id}`);
  const btn = document.querySelector(`#characters-body tr[data-id="${id}"] .btn-toggle-angles`);
  if (!angleRow) return;
  const hidden = angleRow.style.display === 'none' || angleRow.style.display === '';
  angleRow.style.display = hidden ? 'table-row' : 'none';
  if (btn) btn.textContent = hidden ? '▼ Angles' : '▶ Angles';
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
        const varData = await apiFetch('/api/generate-char-variant', { prompt: anglePrompt, referenceImageUrls: [refUrl] });
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
  finally { btn.disabled = false; btn.innerHTML = 'Generate Angles'; }
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
      loc.images = data.images || [];
      if (grid) grid.innerHTML = loc.images.map(url => `<img src="${esc(url)}" class="loc-thumb" onclick="setLocThumb('${loc.id}','${esc(url)}')">`).join('');
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

  const refUrl = char.images?.[0] || char.referenceImage?.dataUrl || null;
  if (!refUrl) { showToast('Generate the front image first.', true); return; }

  const btn = slotEl?.closest('tr')?.querySelector('.btn-regen');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
  if (slotEl) slotEl.innerHTML = '<span class="spinner"></span>';

  // Spin the mirror slot too
  const mirrorAngle = Object.keys(MIRROR_PAIRS).find(k => MIRROR_PAIRS[k] === angle);
  const mirrorSlot = mirrorAngle ? document.getElementById(`angle-img-${id}-${mirrorAngle.replace(/\W/g, '_')}`) : null;
  if (mirrorSlot) mirrorSlot.innerHTML = '<span class="spinner"></span>';

  try {
    const varData = await apiFetch('/api/generate-char-variant', { prompt: anglePrompt, referenceImageUrls: [refUrl] });
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
    } catch(e) { locImageUrls = locations.filter(l => l.id === locationId2).map(l => l.selectedImage || l.images?.[0]).filter(Boolean); }
  } else {
    locImageUrls = locations.filter(l => l.id === locationId2).map(l => l.selectedImage || l.images?.[0]).filter(Boolean);
  }

  const grid = document.getElementById(`shot-imgs-${id}`);
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  grid.innerHTML = loadingSlots(2);
  try {
    const data = await apiFetch('/api/generate-shot-images', { prompt: imagePrompt, charImageUrls, locImageUrls, stylePrompt: getStylePrompt() });
    if (shot) shot.images = data.images;
    grid.innerHTML = imageSlots(data.images, 2);
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
    const data = await apiFetch('/api/generate-char-variant', { prompt, referenceImageUrls: [refImg] });
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
async function apiFetch(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
  document.querySelectorAll('.compose-thumb[data-bg-key]').forEach(el => {
    el.classList.toggle('selected', el.dataset.bgKey === key);
  });
  // Also highlight the active location row
  document.querySelectorAll('.compose-loc-bg-row').forEach(el => {
    el.classList.toggle('selected', key && key.startsWith(`loc-${el.dataset.locId}-`));
  });
}

function buildComposeLocThumbs(shot) {
  const thumbContainer = document.getElementById('compose-loc-thumbs');
  if (!thumbContainer) return;
  if (!locations.length) { thumbContainer.innerHTML = `<span class="compose-empty">No locations</span>`; return; }
  thumbContainer.innerHTML = locations.map(l => {
    const views = [{ key: 'default', label: 'Default View', img: l.images?.[0] || null }];
    LOC_ANGLES.forEach(a => {
      const img = l.shotAngles?.[a]?.image;
      if (img) views.push({ key: `angle-${a}`, label: a, img });
    });
    (l.customViews || []).forEach(cv => {
      if (cv.image) views.push({ key: `custom-${cv.id}`, label: cv.name || 'Unnamed', img: cv.image });
    });
    const bgKey = `loc-${l.id}-default`;
    const thumbImg = views[0]?.img;
    const viewOpts = views.map(v => `<option value="${esc(v.key)}">${esc(v.label)}</option>`).join('');
    return `<div class="compose-loc-bg-row" data-loc-id="${esc(l.id)}">
      <div class="compose-thumb" data-bg-key="${esc(bgKey)}" onclick="onLocBgThumbClick('${esc(l.id)}')">
        ${thumbImg ? `<img src="${esc(proxyUrl(thumbImg))}" crossorigin="anonymous">` : '<span style="width:40px;height:40px;background:#1a1a1a;border-radius:4px;display:block"></span>'}
        <span class="compose-thumb-name">${esc(l.name || 'Unnamed')}</span>
        <span class="compose-thumb-add">↺</span>
      </div>
      ${views.length > 1 ? `<select class="compose-loc-view-sel" data-loc-id="${esc(l.id)}" onchange="onLocBgViewChange('${esc(l.id)}',this.value)" style="width:100%;margin-top:3px;font-size:10px;background:#111;border:1px solid #222;border-radius:3px;color:#888;padding:3px 4px">${viewOpts}</select>` : ''}
    </div>`;
  }).join('');
}

function onLocBgThumbClick(locId) {
  const sel = document.querySelector(`.compose-loc-view-sel[data-loc-id="${locId}"]`);
  const viewKey = sel ? sel.value : 'default';
  onLocBgViewChange(locId, viewKey);
}

function onLocBgViewChange(locId, viewKey) {
  if (!_compose) return;
  const loc = locations.find(l => l.id === locId);
  if (!loc) return;
  let imgUrl = null;
  if (viewKey === 'default') {
    imgUrl = loc.images?.[0] || null;
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
    return `<div class="compose-thumb" data-bg-key="${esc(key)}" onclick="selectOtherShotAsBg('${esc(s.id)}')">
      <img src="${esc(proxyUrl(s.finalImage))}" crossorigin="anonymous">
      <span class="compose-thumb-name">${esc(s.lyric || s.description || `Shot`)}</span>
      <span class="compose-thumb-add">↺</span>
    </div>`;
  }).join('');
  picker.style.display = 'flex';
  picker.style.flexDirection = 'column';
  picker.style.gap = '4px';
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
  const row = document.querySelector(`#shots-body tr[data-id="${_compose.shotId}"]`);
  if (row) { const s = row.querySelector('.field-loc-select'); if (s) s.value = locationId; }
  const finalCell = document.getElementById(`final-img-${_compose.shotId}`);
  if (finalCell) {
    const finalSel = finalCell.querySelector('.final-loc-select');
    if (finalSel) finalSel.value = locationId;
    const loc = locations.find(l => l.id === locationId);
    const locImg = loc?.images?.[0] || null;
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

  _compose = { shotId, layers: [], selectedIdx: -1, globalLighting: shot.composeMeta?.globalLighting || 'none', globalLightingDir: shot.composeMeta?.globalLightingDir || 'none', bgSeparation: shot.composeMeta?.bgSeparation ?? 0, bgKey: null, bgUrl: null, bgMask: null, bgMaskUrl: shot.composeMeta?.bgMaskUrl || null, bgColor: shot.composeMeta?.bgColor || null, globalContrast: shot.composeMeta?.globalContrast ?? 100, globalSaturation: shot.composeMeta?.globalSaturation ?? 100, history: [], undoStack: [] };
  const canvas = document.getElementById('compose-canvas');
  canvas.width = COMPOSE_W; canvas.height = COMPOSE_H;

  // Background = selected location's image
  const bgLoc = locations.find(l => l.id === shot.locationId && l.images?.length);
  loadComposeBackground(bgLoc?.images?.[0] || shot.images?.[0] || null);

  // Restore previously saved layers
  if (shot.composeLayers?.length) restoreComposeLayers(shot.composeLayers);

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
        return `<div class="compose-thumb" data-bg-key="${esc(key)}" onclick="selectComposeBg('${esc(key)}','${esc(url)}',null)">
          <img src="${esc(proxyUrl(url))}" crossorigin="anonymous">
          <span class="compose-thumb-name">Shot Image ${i + 1}</span>
          <span class="compose-thumb-add">↺</span>
        </div>`;
      }).join('');
      if (shotBgEmpty) shotBgEmpty.style.display = 'none';
    } else {
      shotBgThumbs.innerHTML = '';
      if (shotBgEmpty) shotBgEmpty.style.display = '';
    }
  }

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
        id="comp-tile-${esc(c.id)}" onclick="selectComposeChar('${esc(c.id)}')">
      ${frontImg
        ? `<img class="comp-char-tile-img" src="${esc(frontImg)}" alt="${esc(c.name)}">`
        : `<div class="comp-char-tile-img-empty">·</div>`}
      <div class="comp-char-tile-name">${esc(c.name || 'Unnamed')}</div>
    </div>`;
  }).join('');
  return `<div class="comp-char-grid">${tiles}</div>`;
}

function compCharDetailHTML() {
  if (!_selectedCompCharId) return '';
  const char = characters.find(c => c.id === _selectedCompCharId);
  if (!char) return '';
  const shot = shots.find(s => s.id === _compose?.shotId);
  const det = (shot?.characterDetails || {})[char.id] || {};
  const expr = det.expression || '';

  // Large preview: show AI variant if exists, else the selected angle image
  const previewImg = getCompCharImage(char, _selectedCompAngle, expr);

  const angleThumbs = ALL_ANGLES.map(a => {
    // Show the actual angle-specific image; do NOT fall back to front so users see what's generated
    const img = a === 'Front' ? (char.images?.[0] || null) : (char.angles?.[a]?.image || null);
    const sel = _selectedCompAngle === a;
    return `<div class="comp-angle-thumb${sel ? ' selected' : ''}${img ? '' : ' comp-angle-thumb-missing'}" onclick="selectComposeAngle('${esc(a)}')" title="${esc(a)}">
      ${img ? `<img src="${esc(img)}" alt="${esc(a)}">` : `<div class="comp-angle-thumb-empty">·</div>`}
      <div class="comp-angle-label">${esc(a.replace('3/4 ','¾ '))}</div>
    </div>`;
  }).join('');

  return `<div class="comp-char-detail" id="comp-char-detail">
    <div class="comp-char-preview-large">
      ${previewImg
        ? `<img src="${esc(previewImg)}" alt="${esc(char.name)}" id="comp-detail-preview-img">`
        : `<div class="comp-char-preview-large-empty" id="comp-detail-preview-img">No image generated</div>`}
      <div class="comp-char-preview-label-overlay">${esc(char.name || 'Unnamed')} · ${esc(_selectedCompAngle)}</div>
    </div>
    <div class="comp-char-angle-grid">${angleThumbs}</div>
    <textarea id="comp-alter-prompt" class="compose-tool-textarea" placeholder="Alter image… (e.g. smiling, looking left)">${esc(expr)}</textarea>
    <div class="comp-char-actions">
      <button class="btn-comp-add" onclick="compAddCharToStage('${esc(char.id)}')">+ Add to canvas</button>
      <button class="btn-comp-gen" onclick="compGenerateExpr('${esc(char.id)}')">Generate</button>
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

function selectComposeAngle(angle) {
  _selectedCompAngle = angle;
  if (_selectedCompCharId && _compose) {
    const shot = shots.find(s => s.id === _compose.shotId);
    if (shot) {
      if (!shot.characterDetails) shot.characterDetails = {};
      if (!shot.characterDetails[_selectedCompCharId]) shot.characterDetails[_selectedCompCharId] = {};
      shot.characterDetails[_selectedCompCharId].facingDir = angle;
    }
  }
  const detailWrap = document.getElementById('compose-char-detail-wrap');
  if (detailWrap) detailWrap.innerHTML = compCharDetailHTML();
}

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
  det.expression = expr;
  det.facingDir = angle;

  const refImg = getCharAngleImage(char, angle);
  if (!refImg) { showToast('Generate character images first.', true); return; }

  const genBtn = document.querySelector(`#comp-char-detail .btn-comp-gen`);
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '…'; }

  const prompt = expr
    ? `Keep everything identical. Change only the facial expression to: ${expr}.`
    : `Keep the character with a neutral expression. Do not change anything else.`;

  try {
    const data = await apiFetch('/api/generate-char-variant', { prompt, referenceImageUrls: [refImg] });
    const url = data.url || null;
    if (url) {
      if (!char.expressionCache) char.expressionCache = {};
      if (!char.expressionCache[angle]) char.expressionCache[angle] = {};
      char.expressionCache[angle][expr.toLowerCase() || 'neutral'] = url;
      det.variantImage = url;
      // Ensure char is in shot's characterIds
      if (!shot.characterIds.includes(charId)) {
        shot.characterIds.push(charId);
        syncCharCheckbox(_compose.shotId, charId, true);
      }
    }
    refreshCompCharCard(charId);
    refreshShotDetailIfOpen(_compose.shotId);
    autoSave();
    showToast('Generated.');
  } catch(e) {
    if (previewEl) previewEl.innerHTML = '<span class="placeholder">✕</span>';
    showToast('Error: ' + e.message, true);
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

async function addComposeLayerUrl(url, label, charId = null, dropPos = null) {
  if (!_compose) return;
  const pos = dropPos || { cx: COMPOSE_W / 2, cy: COMPOSE_H * 0.65 };

  const placeholderIdx = _compose.layers.length;
  _compose.layers.push({ imgEl: null, label, charId, cx: pos.cx, cy: pos.cy, scale: 0.40, w: 0, h: 0, opacity: 1, contrast: 100, saturation: 100, loading: true });
  _compose.selectedIdx = placeholderIdx;
  showToast('Removing background…');

  try {
    const data = await apiFetch('/api/remove-background', { imageUrl: url });
    const bgRemovedUrl = data.url || url;

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
  const swatch = document.getElementById('compose-color-swatch');
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

function closeCompose() {
  saveComposeLayers();
  document.getElementById('compose-modal').classList.remove('open');
  _compose = null;
  _composeDrag = null;
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
}

function setComposeBgMode(mode) {
  document.querySelectorAll('.compose-bg-mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  ['location','shot','color','other'].forEach(m => {
    const p = document.getElementById(`compose-bgpanel-${m}`);
    if (p) p.style.display = m === mode ? '' : 'none';
  });
  // populate other-shot panel on demand
  if (mode === 'other') {
    const picker = document.getElementById('compose-shot-bg-picker');
    if (picker && !picker.dataset.built) {
      buildOtherShotBgPicker(picker);
      picker.dataset.built = '1';
    }
  }
}

function updateComposeLayerPanel() {
  const noSel = document.getElementById('compose-layer-no-selection');
  const inner = document.getElementById('compose-layer-controls-inner');
  const layerTab = document.getElementById('compose-tab-layer');
  if (!_compose || _compose.selectedIdx < 0 || _compose.selectedIdx >= _compose.layers.length) {
    if (noSel) noSel.style.display = '';
    if (inner) inner.style.display = 'none';
    if (layerTab) layerTab.style.color = '';
    return;
  }
  if (noSel) noSel.style.display = 'none';
  if (inner) inner.style.display = '';
  if (layerTab) { layerTab.style.color = '#4ade80'; switchComposeTab('layer'); }
  const layer = _compose.layers[_compose.selectedIdx];
  const scaleVal = Math.round(layer.scale * 100);
  document.getElementById('compose-scale-slider').value = scaleVal;
  document.getElementById('compose-scale-val').textContent = scaleVal + '%';
  document.getElementById('compose-opacity-slider').value = Math.round(layer.opacity * 100);
  document.getElementById('compose-opacity-val').textContent = Math.round(layer.opacity * 100) + '%';
  const lighting = layer.lighting || 'none';
  document.getElementById('compose-lighting-select').value = lighting;
  const intensity = Math.round((layer.lightingIntensity ?? 0.6) * 100);
  document.getElementById('compose-lighting-slider').value = intensity;
  document.getElementById('compose-lighting-val').textContent = intensity + '%';
  document.getElementById('compose-lighting-intensity-row').style.display = lighting === 'none' ? 'none' : 'flex';
  const layerContrast = Math.round(layer.contrast ?? 100);
  const layerSaturation = Math.round(layer.saturation ?? 100);
  const lcSlider = document.getElementById('compose-layer-contrast');
  if (lcSlider) { lcSlider.value = layerContrast; document.getElementById('compose-layer-contrast-val').textContent = layerContrast + '%'; }
  const lsSlider = document.getElementById('compose-layer-saturation');
  if (lsSlider) { lsSlider.value = layerSaturation; document.getElementById('compose-layer-saturation-val').textContent = layerSaturation + '%'; }
  const layerPromptEl = document.getElementById('compose-layer-prompt');
  if (layerPromptEl && !layerPromptEl.value) layerPromptEl.value = 'Keep the subject in the same position. But ';
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
    if (_compose.bgImg) ctx.drawImage(_compose.bgImg, 0, 0, COMPOSE_W, COMPOSE_H);
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
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }
  try {
    const data = await apiFetch('/api/generate-shot-images', { prompt, referenceImageUrls: [layer.imgUrl], stylePrompt: '' });
    const url = data.images?.[0];
    if (url) {
      const imgEl = new Image();
      imgEl.crossOrigin = 'anonymous';
      imgEl.onload = () => {
        const h = COMPOSE_H * layer.scale;
        const w = h * (imgEl.naturalWidth / imgEl.naturalHeight);
        _compose.layers[_compose.selectedIdx] = { ..._compose.layers[_compose.selectedIdx], imgEl, imgUrl: url, w, h };
        updateComposeLayerPanel(); renderCompose(); saveComposeLayers();
      };
      imgEl.src = proxyUrl(url);
    }
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

let _composeResize = null; // { layerIdx, anchorX, anchorY, origW, origH, origCx, origCy, origDiag }

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
  captureUndoState();
  const { x, y } = composeCanvasCoords(e);
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
      _composeDrag = { layerIdx: i, startCx: l.cx, startCy: l.cy, startMx: x, startMy: y };
      updateComposeLayerPanel();
      renderCompose();
      return;
    }
  }
  // Clicked empty space — deselect
  _compose.selectedIdx = -1;
  updateComposeLayerPanel();
  renderCompose();
});

document.addEventListener('mousemove', e => {
  if (!_compose) return;
  const { x, y } = composeCanvasCoords(e);
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
});

document.addEventListener('mouseup', () => {
  if (_composeDrag || _composeResize) saveComposeLayers();
  _composeDrag = null;
  _composeResize = null;
});

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
  const swatch = document.getElementById('compose-color-swatch');
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