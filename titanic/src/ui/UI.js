/**
 * UI root (ARCHITECTURE.md §8): mounts the overlay, switches modes, owns the main menu (ship's wheel), settings
 * (engine-order telegraph), loading ticket, pause, outcomes, the Ship's Manifest, toasts, fades and the helm overlay.
 */
import { HUD } from './HUD.js';
import { Panels } from './Panels.js';

const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v !== null && v !== undefined) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const QUALITY_POS = [['low', 'DEAD SLOW'], ['medium', 'SLOW'], ['high', 'HALF'], ['ultra', 'FULL AHEAD']];
const SAVE_KEY = 'titanic.save.v1';
const WELCOME_KEY = 'titanic.welcomed.v1';

export class UI {
  constructor({ root, bus, settings, spec, story, characters, discoveries = [], collectibles = [], locations = {} }) {
    this.root = root; this.bus = bus; this.settings = settings; this.spec = spec; this.story = story; this.characters = characters;
    this.mode = 'loading';
    this.state = null;
    this._unsubs = [];
    root.innerHTML = '';
    root.removeAttribute('aria-live');
    this.applyScale();
    // layers
    this.loading = this._buildLoading(); root.append(this.loading);
    this.menu = this._buildMenu(); root.append(this.menu);
    this.hud = new HUD({ bus, settings, spec, locations });
    root.append(this.hud.el, this.hud.dialogue.el);
    this.panels = new Panels({ bus, settings, spec, story, characters, discoveries, collectibles, locations });
    root.append(this.panels.journal, this.panels.map, this.panels.photo, this.panels.time);
    this.pause = this._buildPause(); root.append(this.pause);
    this.settingsPanel = this._buildSettings(); root.append(this.settingsPanel);
    this.gameover = this._buildGameOver(); root.append(this.gameover);
    this.credits = this._buildCredits(); root.append(this.credits);
    this.helm = h('div', { id: 'helm', class: 'hidden', onclick: () => bus.emit('ui:requestPointerLock') }, h('div', { class: 'card' }, h('div', { class: 'big' }, 'Click to take the helm'), h('div', { class: 'small' }, 'Esc · pause   ·   Tab · deck plan   ·   J · ship\'s log')));
    root.append(this.helm);
    this.toasts = h('div', { class: 'toast' }); root.append(this.toasts);
    this.fade = h('div', { id: 'fade', style: 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .6s;z-index:70' }); root.append(this.fade);
    this.cut = h('div', { id: 'cutscene', class: 'hidden center', style: 'z-index:65;background:#0B1626ee' }, h('div', { style: 'text-align:center;max-width:60rem;padding:2rem' }, h('div', { class: 'title-hero', style: 'font-size:var(--fs-xl)' }, ''), h('p', { class: 'cut-text', style: 'font-size:var(--fs-lg);color:var(--fog-dim);font-style:italic' }, ''))); root.append(this.cut);
    this._bind();
    this.setMode('loading');
  }

  applyScale() {
    document.documentElement.style.setProperty('--ui-scale', String(this.settings.get('uiScale') || 1));
    document.documentElement.dataset.reduceMotion = this.settings.get('reduceMotion') ? '1' : '0';
    const cb = this.settings.get('colourBlind');
    document.documentElement.dataset.colourBlind = cb || 'none';
  }

  _bind() {
    const bus = this.bus, on = (t, f) => this._unsubs.push(bus.on(t, f));
    on('loading:progress', ({ pct, label }) => { this.loading.querySelector('.fill').style.width = `${Math.max(0, Math.min(100, pct))}%`; this.loading.querySelector('.label').textContent = label || ''; });
    on('game:ready', () => { this.loading.querySelector('.stamp').classList.remove('hidden'); });
    on('game:mode', ({ mode }) => this.setMode(mode));
    on('notify', (p) => this.toast(p));
    on('ui:fade', ({ seconds = 1 }) => this.doFade(seconds));
    on('cutscene:play', ({ id, text }) => this.cutscene(id, text));
    on('quest:watchStart', ({ watch }) => this.cutscene(watch?.title || 'A new watch', watch?.date ? `${this._longDate(watch.date)}` : '', 3.5));
    on('input:escape', () => {
      if (this.mode === 'paused') bus.emit('ui:resume');
      else if (['map', 'journal', 'photo', 'time', 'settings'].includes(this.mode)) { if (this._settingsFrom === 'menu' && this.mode === 'settings') { this.setMode('menu'); bus.emit('ui:mode', { mode: 'menu' }); } else bus.emit('ui:resume'); }
      else if (this.mode === 'credits' || this.mode === 'gameover') bus.emit('ui:quitToMenu');
    });
    window.addEventListener('keydown', (e) => this._key(e));
    on('player:died', (p) => this.gameover.querySelector('.cause').textContent = p && p.cause === 'drowned' ? 'Lost at sea.' : p && p.cause === 'trapped' ? 'Trapped below.' : 'You faint. A steward carries you back to the stairs.');
    this.settings.onChange?.((k) => { if (k === 'uiScale' || k === 'reduceMotion' || k === 'colourBlind') this.applyScale(); });
  }

  _key(e) {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    const code = e.code;
    if (this.mode === 'playing') {
      if (code === 'Tab' || code === 'KeyM') { e.preventDefault(); this.bus.emit('ui:mode', { mode: 'map' }); }
      else if (code === 'KeyJ') this.bus.emit('ui:mode', { mode: 'journal' });
      else if (code === 'KeyP') this.bus.emit('ui:photoMode', { on: true });
      else if (code === 'KeyT') this.bus.emit('ui:mode', { mode: 'time' });
      else if (code === 'KeyV') this.bus.emit('ui:toggleView');
      else if (code === 'F5') { e.preventDefault(); this.bus.emit('ui:save'); }
      else if (code === 'F9') { e.preventDefault(); this.bus.emit('ui:load'); }
    } else if (this.mode === 'photo' && (code === 'KeyP')) this.bus.emit('ui:photoMode', { on: false });
    else if (this.mode === 'map' && (code === 'Tab' || code === 'KeyM')) { e.preventDefault(); this.bus.emit('ui:resume'); }
    else if (this.mode === 'journal' && code === 'KeyJ') this.bus.emit('ui:resume');
    else if (this.mode === 'time' && code === 'KeyT') this.bus.emit('ui:resume');
    else if (this.mode === 'menu') this._menuKey(e);
  }

  setMode(mode) {
    this.mode = mode;
    const show = (el, on) => el.classList.toggle('hidden', !on);
    show(this.loading, mode === 'loading');
    show(this.menu, mode === 'menu');
    show(this.pause, mode === 'paused');
    show(this.settingsPanel, mode === 'settings');
    show(this.gameover, mode === 'gameover');
    show(this.credits, mode === 'credits');
    this.panels.setMode(mode);
    this.hud.setVisible(['playing', 'dialogue', 'map', 'journal', 'time', 'paused'].includes(mode) && mode !== 'photo');
    if (mode === 'menu') { this.menu.querySelector('.take-helm').classList.toggle('hidden', !localStorage.getItem(SAVE_KEY)); this._welcome(); }
    if (mode === 'gameover') this.bus.emit('audio:play', { id: 'bell' });
  }

  update(state) {
    this.state = state;
    this.hud.update(state, this.mode);
    this.panels.update(state, this.mode);
    this.helm.classList.toggle('hidden', !(this.mode === 'playing' && !state.pointerLocked));
    if (this.mode === 'settings' && state.stats) this.settingsPanel.querySelector('.ms').textContent = `${(state.stats.frameMs || 0).toFixed(1)} ms/frame · ${state.stats.drawCalls || 0} draws`;
  }

  // ---------------- toasts, fades, cutscenes
  toast({ text, kind = 'log' }) {
    if (!text) return;
    if (kind === 'speech' && !this.settings.get('subtitles')) { this.hud.subtitle(text); return; }
    const m = /^(.+?): “(.+)”$/.exec(text);
    const item = h('div', { class: `item ${kind}` }, m ? [h('span', { class: 'who' }, m[1]), m[2]] : text);
    this.toasts.append(item);
    this.bus.emit('audio:play', { id: kind === 'warn' || kind === 'danger' ? 'bell' : 'ui_page' });
    setTimeout(() => { item.style.transition = 'opacity .5s'; item.style.opacity = '0'; setTimeout(() => item.remove(), 500); }, kind === 'speech' ? 5000 : 4000);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }
  doFade(seconds) {
    const f = this.fade; f.style.transition = `opacity ${seconds / 2}s`; f.style.opacity = '1';
    setTimeout(() => { f.style.opacity = '0'; }, seconds * 500);
  }
  cutscene(title, text = '', seconds = 4) {
    this.cut.querySelector('.title-hero').textContent = title || '';
    this.cut.querySelector('.cut-text').textContent = text || '';
    this.cut.classList.remove('hidden');
    clearTimeout(this._cutTimer);
    this._cutTimer = setTimeout(() => this.cut.classList.add('hidden'), seconds * 1000);
  }
  _longDate(iso) { const d = new Date(iso + 'T12:00:00Z'); return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }

  // ---------------- loading ticket
  _buildLoading() {
    return h('div', { id: 'loading', class: 'center', style: 'background:var(--navy);z-index:50' },
      h('div', { class: 'ticket swell' },
        h('div', { class: 'band' }, h('span', {}, 'White Star Line'), h('span', { style: 'font-size:var(--fs-xs)' }, 'Contract Ticket')),
        h('div', { class: 'stamp hidden' }, 'Boarded'),
        h('div', { class: 'body' }, h('span', { class: 'k' }, 'Passenger'), h('span', {}, 'Jack Drawson'), h('span', { class: 'k' }, 'Class'), h('span', {}, 'Third'), h('span', { class: 'k' }, 'Berth'), h('span', {}, 'G-62'), h('span', { class: 'k' }, 'Sailing'), h('span', {}, 'Southampton, 10 April 1912')),
        h('div', { class: 'label' }, 'Laying the keel'),
        h('div', { class: 'progress-rope' }, h('div', { class: 'fill' }))));
  }

  // ---------------- main menu
  _buildMenu() {
    const items = [
      ['take-helm', 'Take the helm', () => this.bus.emit('ui:continue')],
      ['new', 'New voyage', () => this._newVoyage()],
      ['settings', 'Settings', () => { this._settingsFrom = 'menu'; this.setMode('settings'); }],
      ['manifest', "Ship's manifest", () => this.setMode('credits')],
      ['abandon', 'Abandon ship', () => { if (confirm('Abandon ship? Unsaved progress will be lost.')) location.reload(); }],
    ];
    this.menuItems = items;
    this.menuIndex = 1;
    const wheel = h('div', { class: 'wheel' }, h('div', { class: 'rim' }));
    const spokes = items.length + 1;
    items.forEach(([id, label, fn], i) => {
      const ang = -90 + (i - (items.length - 1) / 2) * 32;
      const spoke = h('div', { class: 'spoke', style: `transform: rotate(${ang + 180}deg)` }, h('div', { class: 'handle' }), h('div', { class: 'tag', style: `transform: translate(-50%, 2.2rem) rotate(${-(ang + 180)}deg)` }, h('button', { class: id, onclick: fn }, label)));
      wheel.append(spoke);
    });
    for (let i = 0; i < 2; i++) wheel.append(h('div', { class: 'spoke', style: `transform: rotate(${(i ? 70 : -70)}deg)` }, h('div', { class: 'handle' })));
    wheel.append(h('div', { class: 'hub' }));
    const list = h('div', { class: 'menu-list' }, items.map(([id, label, fn]) => h('button', { class: `btn ${id}`, onclick: fn }, label)));
    const menu = h('div', { id: 'menu', class: 'hidden' }, h('div', { class: 'scrim' }),
      h('div', { class: 'layout' },
        h('div', {}, h('h1', { class: 'title-hero' }, 'A Night to Remember Forever'), h('div', { class: 'title-sub' }, 'Aboard RMS Titanic · April 1912'), list),
        h('div', { class: 'footer-bar' }, h('span', {}, 'v0.1.0 · build 1912'), h('span', {}, h('span', { class: 'keycap' }, 'Enter'), 'Select'), h('span', {}, h('span', { class: 'keycap' }, '↑↓'), 'Navigate'))),
      h('div', { class: 'welcome hidden center', style: 'z-index:5' }, h('div', { class: 'ticket', style: 'width:40rem' }, h('div', { class: 'band' }, h('span', {}, 'Welcome aboard')), h('div', { style: 'padding:1.2rem 1.6rem;font-family:var(--font-body);font-size:var(--fs-md);color:var(--ink)' }, 'This is a parody of a film, with changed names. The ship, the night and the people lost on it are real. Discovery plaques quote documented history only. Memorial resources: see the Ship\'s Manifest.'), h('div', { style: 'padding:0 1.6rem 1.2rem;text-align:right' }, h('button', { class: 'btn', onclick: () => { localStorage.setItem(WELCOME_KEY, '1'); menu.querySelector('.welcome').classList.add('hidden'); } }, 'Understood')))));
    this._menuHighlight(list);
    return menu;
  }
  _menuHighlight(list) { const btns = (list || this.menu.querySelector('.menu-list')).querySelectorAll('.btn'); btns.forEach((b, i) => b.classList.toggle('active', i === this.menuIndex)); }
  _menuKey(e) {
    const btns = [...this.menu.querySelectorAll('.menu-list .btn')].filter((b) => !b.classList.contains('hidden'));
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { const cur = btns.findIndex((b) => b.classList.contains('active')); const next = (cur + (e.code === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length; btns.forEach((b, i) => b.classList.toggle('active', i === next)); this.bus.emit('audio:play', { id: 'ui_hover' }); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'Space') { const b = btns.find((x) => x.classList.contains('active')); if (b) { this.bus.emit('audio:play', { id: 'ui_click' }); b.click(); } }
  }
  _welcome() { try { if (!localStorage.getItem(WELCOME_KEY)) this.menu.querySelector('.welcome').classList.remove('hidden'); } catch { /* ignore */ } }
  _newVoyage() { this.bus.emit('audio:play', { id: 'bell' }); this.bus.emit('ui:newGame'); }

  // ---------------- pause
  _buildPause() {
    const btn = (label, fn, cls = '') => h('button', { class: `btn ${cls}`, style: 'width:16rem;text-align:left', onclick: fn }, label);
    return h('div', { id: 'pause', class: 'hidden center' }, h('div', { class: 'modal-scrim' }),
      h('div', { class: 'mahogany-panel', style: 'position:relative;padding:1.6rem 2rem;min-width:22rem' },
        h('div', { class: 'engraved', style: 'font-size:var(--fs-lg);margin-bottom:1rem' }, 'Paused'),
        h('div', { style: 'display:flex;flex-direction:column;gap:.6rem' },
          btn('Resume', () => this.bus.emit('ui:resume')), btn("Ship's log  (J)", () => this.bus.emit('ui:mode', { mode: 'journal' })), btn('Deck plan  (Tab)', () => this.bus.emit('ui:mode', { mode: 'map' })),
          btn('Wind the watch  (T)', () => this.bus.emit('ui:mode', { mode: 'time' })), btn('Settings', () => { this._settingsFrom = 'pause'; this.setMode('settings'); }),
          btn('Enter in the log  (F5)', () => this.bus.emit('ui:save'), 'bronze'), btn('Return to last entry  (F9)', () => this.bus.emit('ui:load'), 'bronze'), btn('Abandon ship', () => this.bus.emit('ui:quitToMenu'), 'danger'))));
  }

  // ---------------- settings
  _buildSettings() {
    const S = this.settings;
    const set = (k, v) => { S.set(k, v); this.bus.emit('ui:settingsChanged', { key: k, value: v }); };
    const valve = (label, key, min, max, step, fmt = (v) => v) => {
      const inp = h('input', { type: 'range', min, max, step, value: S.get(key) });
      const out = h('span', { class: 'readout' }, fmt(S.get(key)));
      inp.addEventListener('input', () => { const v = parseFloat(inp.value); out.textContent = fmt(v); set(key, v); });
      return h('label', { class: 'row' }, h('span', { class: 'engraved', style: 'font-size:var(--fs-xs)' }, label), h('div', { class: 'valve' }, inp, out));
    };
    const sw = (label, key) => { const el = h('div', { class: 'switch', role: 'switch', 'aria-checked': String(!!S.get(key)), tabindex: '0' }, h('div', { class: 'blade' }), h('span', {}, label)); const toggle = () => { const v = el.getAttribute('aria-checked') !== 'true'; el.setAttribute('aria-checked', String(v)); set(key, v); }; el.addEventListener('click', toggle); el.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); toggle(); } }); return h('div', { class: 'row' }, el); };
    const drum = (label, key, opts) => { const sel = h('select', {}, opts.map(([v, l]) => h('option', { value: v, selected: S.get(key) === v ? 'selected' : null }, l))); sel.addEventListener('change', () => set(key, sel.value)); return h('label', { class: 'row' }, h('span', { class: 'engraved', style: 'font-size:var(--fs-xs)' }, label), h('div', { class: 'drum' }, sel)); };
    const telegraph = h('div', { class: 'telegraph' }, QUALITY_POS.map(([q, label]) => h('button', { class: `pos ${S.get('quality') === q ? 'active' : ''}`, 'data-q': q, onclick: (e) => { set('quality', q); telegraph.querySelectorAll('.pos').forEach((b) => b.classList.toggle('active', b.dataset.q === q)); this.bus.emit('audio:play', { id: 'bell' }); } }, label)));
    const tabs = ['Display', 'Graphics', 'Controls', 'Audio', 'Accessibility'];
    const pages = {
      Display: h('div', {}, drum('Resolution', 'resolution', [['native', 'Native'], ['4k', '3840 × 2160'], ['1440p', '2560 × 1440'], ['1080p', '1920 × 1080']]), valve('Render scale', 'renderScale', 0.5, 2, 0.05, (v) => `${Math.round(v * 100)}%`), valve('Field of view', 'fov', 60, 110, 1, (v) => `${v}°`), drum('View', 'viewMode', [['first', 'First person'], ['third', 'Third person']]), sw('Show frame counter', 'showFps')),
      Graphics: h('div', {}, h('div', { class: 'engraved', style: 'font-size:var(--fs-xs);margin-bottom:.4rem' }, 'Engine-order telegraph'), telegraph, h('div', { class: 'plate ms', style: 'margin-top:.8rem;font-size:var(--fs-xs)' }, '— ms/frame'), h('p', { style: 'color:var(--fog-dim);font-size:var(--fs-sm)' }, 'Dead slow: 1024 shadows, no ambient occlusion · Slow: 2048 · Half: 4096, half-res AO · Full ahead: 4096, full AO, 4K-ready.')),
      Controls: h('div', {}, valve('Look sensitivity', 'sensitivity', 0.2, 3, 0.05, (v) => v.toFixed(2)), sw('Invert Y', 'invertY'), h('div', { style: 'margin-top:1rem;font-size:var(--fs-sm);color:var(--fog-dim);line-height:2' }, [['WASD', 'move'], ['Shift', 'run'], ['Space', 'jump'], ['E', 'interact'], ['Tab / M', 'deck plan'], ['J', "ship's log"], ['P', 'photo mode'], ['T', 'wind the watch'], ['V', 'view'], ['F5 / F9', 'quick save / load'], ['Esc', 'pause']].map(([k, v]) => h('div', {}, h('span', { class: 'keycap' }, k), v)))),
      Audio: h('div', {}, valve('Master', 'volumeMaster', 0, 1, 0.01, (v) => `${Math.round(v * 100)}`), valve('Music', 'volumeMusic', 0, 1, 0.01, (v) => `${Math.round(v * 100)}`), valve('Effects', 'volumeSfx', 0, 1, 0.01, (v) => `${Math.round(v * 100)}`), valve('Ambience', 'volumeAmbience', 0, 1, 0.01, (v) => `${Math.round(v * 100)}`), sw('Subtitles', 'subtitles')),
      Accessibility: h('div', {}, valve('Interface size', 'uiScale', 0.8, 1.6, 0.05, (v) => `${Math.round(v * 100)}%`), sw('Reduce motion', 'reduceMotion'), drum('Colour-blind mode', 'colourBlind', [['none', 'Off'], ['deuteranopia', 'Deuteranopia'], ['protanopia', 'Protanopia'], ['tritanopia', 'Tritanopia']])),
    };
    const body = h('div', { class: 'settings-body' });
    const rail = h('div', { class: 'tabrail' }, tabs.map((t, i) => h('button', { class: `plate tab ${i === 0 ? 'active' : ''}`, onclick: (e) => { rail.querySelectorAll('.tab').forEach((b) => b.classList.remove('active')); e.currentTarget.classList.add('active'); body.replaceChildren(pages[t]); this.bus.emit('audio:play', { id: 'ui_page' }); } }, t)));
    body.replaceChildren(pages.Display);
    return h('div', { id: 'settings', class: 'hidden center' }, h('div', { class: 'modal-scrim' }),
      h('div', { class: 'mahogany-panel settings-panel' }, rail, body,
        h('div', { style: 'display:flex;justify-content:space-between;margin-top:1rem' }, h('button', { class: 'btn bronze', onclick: () => { S.reset(); location.reload(); } }, 'Restore defaults'), h('button', { class: 'btn', onclick: () => { if (this._settingsFrom === 'menu') { this.setMode('menu'); } else this.bus.emit('ui:mode', { mode: 'paused' }); } }, 'Back'))));
  }

  _buildGameOver() {
    return h('div', { id: 'gameover', class: 'hidden center' }, h('div', { class: 'modal-scrim', style: 'background:#0B1626e6' }),
      h('div', { style: 'position:relative;text-align:center' }, h('div', { class: 'title-hero', style: 'font-size:var(--fs-2xl)' }, 'Lost at Sea'), h('p', { class: 'cause', style: 'color:var(--fog-dim);font-size:var(--fs-lg)' }, ''),
        h('div', { style: 'display:flex;gap:1rem;justify-content:center;margin-top:1rem' }, h('button', { class: 'btn', onclick: () => this.bus.emit('ui:load') }, 'Return to the last entry'), h('button', { class: 'btn bronze', onclick: () => this.bus.emit('ui:quitToMenu') }, 'Abandon ship'))));
  }

  _buildCredits() {
    const chars = Object.values(this.characters || {}).map((c) => h('div', { class: 'row-m' }, h('span', { class: 'n' }, c.name), h('span', { class: 'r' }, c.parodyOf ? `the ${c.parodyOf.replace(/^the /, '')}` : c.role)));
    return h('div', { id: 'credits', class: 'hidden center' }, h('div', { class: 'modal-scrim', style: 'background:#0B1626f0' }),
      h('div', { class: 'parchment manifest', style: 'position:relative;width:46rem;max-height:84vh;overflow:auto;padding:1.6rem 2rem' },
        h('div', { class: 'engraved', style: 'color:var(--burgundy);font-size:var(--fs-lg);text-shadow:none' }, "Ship's Manifest"),
        h('hr', { class: 'engraved' }),
        h('p', { style: 'font-family:var(--font-doc)' }, 'A Night to Remember Forever — a free-roam parody built from the ship\'s general arrangement plans. Three.js, procedural geometry, CC0 textures (ambientCG, Poly Haven), OFL fonts.'),
        h('div', { class: 'engraved', style: 'color:var(--burgundy);font-size:var(--fs-sm);text-shadow:none;margin-top:1rem' }, 'Passengers and crew (parody roster)'),
        chars,
        h('hr', { class: 'engraved' }),
        h('p', { style: 'font-family:var(--font-doc)' }, 'Sources: the British Wreck Commissioner\'s Inquiry report (deck heights, bulkheads, lifeboats); The Shipbuilder, Midsummer 1911; the 1911 Engineering elevation; Wikipedia and Encyclopedia Titanica for interiors and the timeline.'),
        h('div', { class: 'memorial', style: 'margin:1.4rem 0;padding:1rem;background:var(--navy);color:var(--fog);text-align:center;font-family:var(--font-display);font-size:var(--fs-lg)' }, 'In memory of the 1,496.'),
        h('p', { style: 'font-family:var(--font-doc);font-size:var(--fs-sm)' }, 'Memorial resources: the Titanic Historical Society; Encyclopedia Titanica.'),
        h('div', { style: 'text-align:right' }, h('button', { class: 'btn', onclick: () => this.bus.emit('ui:quitToMenu') }, 'Close'))));
  }
}
