/**
 * HUD (ARCHITECTURE.md §8, spec §2.4) and the porthole dialogue box (§2.5).
 */
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v !== null && v !== undefined) el.setAttribute(k, v); }
  for (const c of children.flat()) if (c !== null && c !== undefined) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const DECK_NAMES = { boat: 'Boat Deck', A: 'A Deck', B: 'B Deck', C: 'C Deck', D: 'D Deck', E: 'E Deck', F: 'F Deck', G: 'G Deck', orlop: 'Orlop Deck', tankTop: 'Tank Top', world: 'At Sea' };
const SHIP_HEADING = 266; // true course on the night (approx.)

export class DialogueBox {
  constructor({ bus, characters }) {
    this.bus = bus; this.characters = characters || {};
    this.el = h('div', { id: 'dialogue', class: 'hidden' },
      h('div', { class: 'porthole' }, h('span', { class: 'initial' }, '')),
      h('div', { class: 'card rope' }, h('span', { class: 'plate speaker' }, ''), h('div', { class: 'text' }, ''), h('div', { class: 'choices' }), h('div', { class: 'advance' }, 'Space · continue')));
    this.active = false;
    bus.on('dialogue:node', (n) => this.show(n));
    bus.on('dialogue:end', () => this.hide());
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (/^Digit[1-9]$/.test(e.code)) { const i = parseInt(e.code.slice(5), 10) - 1; if (this.choices[i]) { e.preventDefault(); this.choose(i); } }
      else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); if (!this.choices.length) this.bus.emit('ui:dialogueAdvance'); }
    });
    this.el.addEventListener('click', (e) => { if (!e.target.closest('.choice') && !this.choices.length) this.bus.emit('ui:dialogueAdvance'); });
  }
  show({ speaker, speakerName, text, choices = [] }) {
    this.active = true; this.el.classList.remove('hidden');
    const name = speakerName || (this.characters[speaker]?.name) || (speaker === 'player' ? 'You' : speaker === 'narrator' ? '' : speaker);
    this.el.querySelector('.initial').textContent = speaker === 'narrator' ? '✦' : (name || '?').replace(/^["“]+/, '').charAt(0).toUpperCase();
    const plate = this.el.querySelector('.speaker'); plate.textContent = name; plate.classList.toggle('hidden', !name);
    this.el.querySelector('.text').textContent = text || '';
    this.choices = choices;
    const box = this.el.querySelector('.choices'); box.replaceChildren(...choices.map((c, i) => h('button', { class: 'choice', onclick: () => this.choose(i) }, h('span', { class: 'n' }, String(i + 1)), c)));
    this.el.querySelector('.advance').classList.toggle('hidden', choices.length > 0);
    this.bus.emit('audio:play', { id: 'ui_page' });
  }
  choose(i) { this.bus.emit('audio:play', { id: 'ui_click' }); this.bus.emit('ui:dialogueChoice', { index: i }); }
  hide() { this.active = false; this.el.classList.add('hidden'); }
}

export class HUD {
  constructor({ bus, settings, spec, locations = {} }) {
    this.bus = bus; this.settings = settings; this.spec = spec; this.locations = locations;
    this.dialogue = new DialogueBox({ bus, characters: {} });
    this.el = h('div', { id: 'hud', class: 'passive' });
    // compass
    this.compass = h('div', { class: 'compass' }, h('div', { class: 'tape' }), h('div', { class: 'lubber' }));
    this.tape = this.compass.querySelector('.tape');
    const marks = [[0, 'FWD'], [90, 'STBD'], [180, 'AFT'], [270, 'PORT']];
    for (let a = -180; a <= 540; a += 10) { const t = h('div', { class: `tick ${a % 30 === 0 ? 'major' : ''}` }); t.dataset.a = a; this.tape.append(t); }
    for (let k = -1; k <= 1; k++) for (const [a, l] of marks) { const m = h('div', { class: 'mark' }, l); m.dataset.a = a + k * 360; this.tape.append(m); }
    this.pin = h('div', { class: 'pin hidden' }); this.tape.append(this.pin);
    this.digits = h('div', { class: 'compass-digits' }, '000°');
    // clock & date
    this.clock = h('div', { class: 'clock', title: 'Honour and Glory Crowning Time' }, h('div', { class: 'hand hour' }), h('div', { class: 'hand minute' }), h('div', { class: 'pin' }));
    this.date = h('div', { class: 'date-plate' }, h('span', { class: 'plate' }, '10 April 1912'));
    this.deckPlate = h('div', { class: 'deck-plate' }, h('span', { class: 'plate deck' }, 'C Deck'), h('div', { class: 'room' }, ''));
    this.log = h('div', { class: 'log-tray' }, h('div', { class: 'head' }, "Ship's Log"), h('div', { class: 'page' }));
    this.prompt = h('div', { class: 'prompt hidden-soft' }, h('span', { class: 'plate' }, h('span', { class: 'keycap' }, 'E'), h('span', { class: 'label' }, '')));
    this.crosshair = h('div', { class: 'crosshair' });
    this.incline = h('div', { class: 'incline hidden' }, h('div', { class: 'pend' }, h('div', { class: 'needle' })), h('div', { class: 'read' }, 'On an even keel'), h('div', { class: 'flood' }, Array.from({ length: 16 }, () => h('i'))));
    this.sub = h('div', { class: 'subtitle hidden' }, h('span', { class: 'who' }, ''), h('span', { class: 'line' }, ''));
    this.fps = h('div', { class: 'fps hidden' }, '');
    this.el.append(this.compass, this.digits, this.clock, this.date, this.deckPlate, this.log, this.prompt, this.crosshair, this.incline, this.sub, this.fps);
    this.entries = new Map();
    this._idleTimer = 0; this._lastDeck = null; this._objectiveLoc = null;
    bus.on('interact:prompt', (p) => { const on = !!(p && p.label); this.prompt.classList.toggle('hidden-soft', !on); this.crosshair.classList.toggle('range', on); if (on) this.prompt.querySelector('.label').textContent = p.label; });
    bus.on('quest:objective', ({ text, locationId, optional, beatId }) => this.setEntry(beatId || text, text, optional, locationId));
    bus.on('quest:beatStart', ({ beat, optional }) => { if (beat) this.setEntry(beat.id, beat.objective, optional, beat.locationId); });
    bus.on('quest:beatComplete', ({ beat }) => { if (beat) this.completeEntry(beat.id); });
    bus.on('quest:watchStart', () => { this.entries.clear(); this._renderLog(); });
    bus.on('player:deck', () => { this.deckPlate.classList.remove('idle'); this.deckPlate.classList.add('glint'); setTimeout(() => this.deckPlate.classList.remove('glint'), 900); this._idleTimer = 0; });
    bus.on('notify', (p) => { if (p && p.kind === 'speech') this.subtitle(p.text); });
    bus.on('sinking:event', ({ id }) => { if (id === 'strike') { this.incline.classList.remove('hidden'); this.incline.classList.add('glint'); } });
  }
  setVisible(v) { this.el.classList.toggle('hidden', !v); }
  setEntry(id, text, optional = false, locationId = null) {
    if (!text) return;
    this.entries.set(id, { text, optional, done: false, locationId });
    if (!optional) this._objectiveLoc = locationId;
    this._renderLog();
  }
  completeEntry(id) { const e = this.entries.get(id); if (!e) return; e.done = true; this._renderLog(); setTimeout(() => { this.entries.delete(id); this._renderLog(); }, 2500); }
  _renderLog() {
    const page = this.log.querySelector('.page');
    const list = [...this.entries.entries()].slice(-3);
    page.replaceChildren(...list.map(([id, e]) => h('div', { class: `entry ${e.optional ? 'optional' : ''} ${e.done ? 'done' : ''}` }, h('span', { class: 'bullet' }, e.done ? '✓' : '◦'), e.text)));
    this.log.classList.toggle('hidden', list.length === 0);
  }
  subtitle(text) {
    const m = /^(.+?): “(.+)”$/.exec(text || '');
    this.sub.querySelector('.who').textContent = m ? m[1] : ''; this.sub.querySelector('.line').textContent = m ? m[2] : text;
    this.sub.classList.remove('hidden'); clearTimeout(this._subTimer); this._subTimer = setTimeout(() => this.sub.classList.add('hidden'), 4500);
  }
  update(state, mode) {
    if (!state) return;
    const heading = state.heading || 0;
    const px = 34 * 16 / 180; // rem→px approx per degree: tape width 34rem spans 180°
    const remPerDeg = 34 / 180;
    for (const el of this.tape.children) { if (el === this.pin) continue; const a = parseFloat(el.dataset.a); let d = a - heading; while (d > 180) d -= 360; while (d < -180) d += 360; el.style.left = `${d * remPerDeg}rem`; el.style.display = Math.abs(d) > 95 ? 'none' : ''; }
    this.digits.textContent = `${String(Math.round((SHIP_HEADING + heading) % 360)).padStart(3, '0')}°`;
    // objective pin
    const loc = this._objectiveLoc ? this.locations[this._objectiveLoc] : null;
    if (loc && state.player) { const dx = loc.x - state.player.x, dz = loc.z - state.player.z; let b = (Math.atan2(-dz, dx) * 180) / Math.PI - heading; while (b > 180) b -= 360; while (b < -180) b += 360; this.pin.classList.toggle('hidden', Math.abs(b) > 95); this.pin.style.left = `${b * remPerDeg}rem`; } else this.pin.classList.add('hidden');
    // clock
    if (state.clock && state.clock.hhmm) { const [hh, mm] = state.clock.hhmm.split(':').map(Number); this.clock.querySelector('.hour').style.transform = `rotate(${((hh % 12) / 12 + mm / 720) * 360}deg)`; this.clock.querySelector('.minute').style.transform = `rotate(${(mm / 60) * 360}deg)`; }
    if (state.clock && state.clock.date && state.clock.date !== this._lastDate) { this._lastDate = state.clock.date; const d = new Date(state.clock.date + 'T12:00:00Z'); this.date.querySelector('.plate').textContent = isNaN(d) ? state.clock.date : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
    // deck plate
    const deck = state.deck || 'C';
    if (deck !== this._lastDeck) { this._lastDeck = deck; this.deckPlate.querySelector('.deck').textContent = DECK_NAMES[deck] || deck; this.deckPlate.classList.remove('idle'); this._idleTimer = 0; }
    this.deckPlate.querySelector('.room').textContent = state.room || '';
    this._idleTimer += 1 / 60; if (this._idleTimer > 4) this.deckPlate.classList.add('idle');
    // incline
    if (state.sinking) {
      this.incline.classList.remove('hidden');
      const trim = Math.min(45, Math.max(0, state.sinking.trimDeg || 0)), list = Math.max(-15, Math.min(15, state.sinking.listDeg || 0));
      this.incline.querySelector('.needle').style.transform = `rotate(${-trim * 2}deg)`;
      this.incline.querySelector('.read').textContent = trim < 1 ? 'On an even keel' : `By the head ${trim.toFixed(0)}°${Math.abs(list) >= 1 ? ` · list ${Math.abs(list).toFixed(0)}° ${list > 0 ? 'to port' : 'to starboard'}` : ''}`;
      const bulk = this.spec.bulkheads || []; const cells = this.incline.querySelectorAll('.flood i'); const floodY = state.sinking.floodY ?? -99;
      cells.forEach((c, i) => { const b = bulk[Math.min(bulk.length - 1, i)]; const wet = i < Math.max(0, Math.round(((state.sinking.minutesAfter || 0) / 160) * 6)) || (b && floodY > (b.topY ?? 99) - 6 && i < 6); c.classList.toggle('wet', wet); });
    } else this.incline.classList.add('hidden');
    // fps
    const showFps = !!this.settings.get('showFps');
    this.fps.classList.toggle('hidden', !showFps); if (showFps) this.fps.textContent = `${state.fps || 0} fps · ${state.stats ? state.stats.drawCalls : 0} draws · ${state.stats ? Math.round((state.stats.triangles || 0) / 1000) : 0}k tris`;
    this.crosshair.classList.toggle('hidden', mode !== 'playing');
  }
}
