/**
 * Panels (spec §2.6–2.10): the Ship's Log (leather journal), the Deck Plan (blueprint SVG generated from SHIP.decks),
 * Photo Mode (bellows camera frame) and the Chronometer (wind the watch).
 */
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v !== null && v !== undefined) el.setAttribute(k, v); }
  for (const c of children.flat()) if (c !== null && c !== undefined) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const svgEl = (tag, attrs = {}) => { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
const DECKS = ['boat', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'orlop', 'tankTop'];
const DECK_LABEL = { boat: 'Boat', A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', orlop: 'Orlop', tankTop: 'Tank Top' };

/** Hull half-breadth at (x, y) from the spec stations (pure data, no three.js). */
function halfBreadth(spec, x, y) {
  const st = spec.hull?.stations || [];
  if (!st.length) return 14;
  const sorted = spec.__uiStations || (spec.__uiStations = [...st].sort((a, b) => b.x - a.x));
  const hbAt = (s) => { const hbs = s.halfBreadths; if (y <= hbs[0][0]) return 0; for (let i = 1; i < hbs.length; i++) if (y <= hbs[i][0]) { const [y0, h0] = hbs[i - 1], [y1, h1] = hbs[i]; return h0 + (h1 - h0) * ((y - y0) / (y1 - y0 || 1)); } return hbs[hbs.length - 1][1]; };
  if (x >= sorted[0].x) return hbAt(sorted[0]);
  for (let i = 1; i < sorted.length; i++) if (x >= sorted[i].x) { const a = sorted[i - 1], b = sorted[i]; const t = (a.x - x) / (a.x - b.x || 1); return hbAt(a) + (hbAt(b) - hbAt(a)) * t; }
  return hbAt(sorted[sorted.length - 1]);
}

export class Panels {
  constructor({ bus, settings, spec, story, characters, discoveries, collectibles, locations }) {
    Object.assign(this, { bus, settings, spec, story, characters, discoveries, collectibles, locations });
    this.discovered = new Set(); this.collected = new Set(); this.met = new Set(); this.inventory = new Map(); this.reputation = { first: 0, third: 0 }; this.currentDeck = 'C'; this.state = null;
    this.journal = this._buildJournal();
    this.map = this._buildMap();
    this.photo = this._buildPhoto();
    this.time = this._buildTime();
    bus.on('quest:discover', ({ id }) => { this.discovered.add(id); this._renderJournal(); });
    bus.on('quest:collect', ({ id }) => { this.collected.add(id); this._renderJournal(); });
    bus.on('dialogue:node', ({ speaker }) => { if (speaker && speaker !== 'player' && speaker !== 'narrator') this.met.add(speaker); });
    bus.on('quest:reputation', (p) => { if (p && p.reputation) this.reputation = p.reputation; else if (p && p.faction) this.reputation[p.faction] = p.value ?? this.reputation[p.faction]; });
  }
  setMode(mode) {
    this.journal.classList.toggle('hidden', mode !== 'journal');
    this.map.classList.toggle('hidden', mode !== 'map');
    this.photo.classList.toggle('hidden', mode !== 'photo');
    this.time.classList.toggle('hidden', mode !== 'time');
    if (mode === 'journal') this._renderJournal();
    if (mode === 'map') { this.mapDeck = this.state?.deck && DECKS.includes(this.state.deck) ? this.state.deck : this.mapDeck || 'boat'; this._renderMap(); }
    if (mode === 'time') this._renderTime();
  }
  update(state, mode) { this.state = state; if (mode === 'map') this._updateMarkers(); }

  // ---------------- journal
  _buildJournal() {
    const tabs = ['Objectives', 'Discoveries', 'Collectibles', 'Passengers met'];
    const rail = h('div', { class: 'tabrail' });
    const body = h('div', { class: 'parchment journal-page' });
    tabs.forEach((t, i) => rail.append(h('button', { class: `plate tab ${i === 0 ? 'active' : ''}`, onclick: (e) => { rail.querySelectorAll('.tab').forEach((b) => b.classList.remove('active')); e.currentTarget.classList.add('active'); this.journalTab = t; this._renderJournal(); this.bus.emit('audio:play', { id: 'ui_page' }); } }, t)));
    this.journalTab = 'Objectives';
    const el = h('div', { id: 'journal', class: 'hidden center' }, h('div', { class: 'modal-scrim' }), h('div', { class: 'leather journal' }, h('div', { class: 'engraved', style: 'font-size:var(--fs-lg);margin-bottom:.6rem' }, "Ship's Log"), rail, body, h('div', { style: 'text-align:right;margin-top:.8rem' }, h('button', { class: 'btn', onclick: () => this.bus.emit('ui:resume') }, 'Close  (J)'))));
    this.journalBody = body;
    return el;
  }
  _renderJournal() {
    const b = this.journalBody; if (!b) return;
    const st = this.state || {};
    if (this.journalTab === 'Objectives') {
      const obj = st.objective;
      b.replaceChildren(h('div', { class: 'engraved', style: 'color:var(--burgundy);text-shadow:none;font-size:var(--fs-xs)' }, st.watchTitle || ''), h('div', { class: 'copperplate', style: 'font-size:var(--fs-lg);margin:.4rem 0' }, obj ? obj.title : 'The watch is yours.'), h('div', { class: 'copperplate' }, obj ? obj.text : 'Explore the ship. Discoveries and collectibles are recorded here.'),
        h('hr', { class: 'engraved' }), h('div', { class: 'pencil' }, `Purser's note — standing with first class: ${this.reputation.first >= 0 ? '+' : ''}${this.reputation.first}; with steerage: ${this.reputation.third >= 0 ? '+' : ''}${this.reputation.third}.`),
        h('div', { class: 'pencil' }, `Pocket: ${[...(st.inventory || [])].join(', ') || 'a charcoal stub'}`));
    } else if (this.journalTab === 'Discoveries') {
      b.replaceChildren(h('div', { class: 'pencil', style: 'margin-bottom:.5rem' }, `${this.discovered.size} of ${this.discoveries.length} found`), ...this.discoveries.map((d) => this.discovered.has(d.id) ? h('div', { class: 'plaque-entry' }, h('div', { class: 'engraved', style: 'color:var(--burgundy);text-shadow:none;font-size:var(--fs-xs)' }, d.name), h('div', { class: 'copperplate' }, d.plaque)) : h('div', { class: 'pencil' }, `? — ${d.deck === 'world' ? 'at sea' : (DECK_LABEL[d.deck] || d.deck) + ' deck'}`)));
    } else if (this.journalTab === 'Collectibles') {
      b.replaceChildren(...this.collectibles.map((c) => h('div', { class: this.collected.has(c.id) ? 'copperplate' : 'pencil' }, this.collected.has(c.id) ? `${c.name} — ${c.text}` : `? ${c.kind}, ${DECK_LABEL[c.deck] || c.deck} deck`)));
    } else {
      const list = [...this.met].map((id) => this.characters[id]).filter(Boolean);
      b.replaceChildren(list.length ? list.map((c) => h('div', { class: 'copperplate' }, `${c.name} — ${c.role}`)) : h('div', { class: 'pencil' }, 'Nobody yet. Talk to people.'));
    }
  }

  // ---------------- deck map (blueprint)
  _buildMap() {
    const tabs = h('div', { class: 'decktabs' }, DECKS.map((d) => h('button', { class: 'plate tab', 'data-deck': d, onclick: () => { this.mapDeck = d; this._renderMap(); this.bus.emit('audio:play', { id: 'ui_page' }); } }, DECK_LABEL[d])));
    this.svg = svgEl('svg', { class: 'blueprint', viewBox: '-145 -40 290 80', preserveAspectRatio: 'xMidYMid meet' });
    const el = h('div', { id: 'deckmap', class: 'hidden center' }, h('div', { class: 'modal-scrim' }), h('div', { class: 'mahogany-panel mapframe' }, h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('div', { class: 'engraved', style: 'font-size:var(--fs-lg)' }, 'Deck Plan'), h('div', { class: 'pencil', style: 'color:var(--fog-dim)' }, 'Click a pin to have a steward escort you there')), tabs, this.svg, h('div', { style: 'text-align:right;margin-top:.6rem' }, h('button', { class: 'btn', onclick: () => this.bus.emit('ui:resume') }, 'Close  (Tab)'))));
    return el;
  }
  _renderMap() {
    const deck = (this.spec.decks || []).find((d) => d.id === this.mapDeck) || this.spec.decks[0];
    this.map.querySelectorAll('.decktabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.deck === this.mapDeck));
    const svg = this.svg; svg.replaceChildren();
    const y = deck.y + 0.6;
    // hull outline
    const pts = [];
    const ext = deck.hullExtent || {};
    const xHi = ext.x1 ?? 130, xLo = ext.x0 ?? -138;
    for (let x = xHi; x >= xLo; x -= 2) pts.push([x, halfBreadth(this.spec, x, y)]);
    const path = pts.map(([x, hb], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${(-hb).toFixed(1)}`).join(' ') + ' ' + [...pts].reverse().map(([x, hb]) => `L${x.toFixed(1)},${hb.toFixed(1)}`).join(' ') + ' Z';
    svg.append(svgEl('path', { d: path, fill: '#0E2A4A', stroke: '#CFE3F5', 'stroke-width': '0.6' }));
    // deckhouses
    for (const dh of deck.deckhouses || []) svg.append(svgEl('rect', { x: dh.x0, y: dh.z0, width: dh.x1 - dh.x0, height: dh.z1 - dh.z0, fill: '#16406a', stroke: '#CFE3F5', 'stroke-width': '0.35' }));
    // rooms
    for (const r of deck.rooms || []) {
      const g = svgEl('g', { class: 'room' });
      g.append(svgEl('rect', { x: r.x0, y: r.z0, width: r.x1 - r.x0, height: r.z1 - r.z0, fill: r.class === 'machinery' ? '#2a3c4a' : r.class === 'first' ? '#1f4f7a' : r.class === 'third' ? '#3b4f3a' : '#2c4b63', 'fill-opacity': '0.75', stroke: '#CFE3F5', 'stroke-width': '0.25' }));
      if ((r.x1 - r.x0) > 9 && (r.z1 - r.z0) > 4) { const t = svgEl('text', { x: (r.x0 + r.x1) / 2, y: (r.z0 + r.z1) / 2 + 0.9, 'text-anchor': 'middle', 'font-size': '2.2', fill: '#CFE3F5', 'font-family': 'Cinzel, Georgia, serif' }); t.textContent = r.name.replace(/\(.*?\)/g, '').split(/[—–:,]/)[0].trim().slice(0, 26); g.append(t); }
      svg.append(g);
    }
    for (const c of deck.corridors || []) svg.append(svgEl('rect', { x: c.x0, y: c.z0, width: c.x1 - c.x0, height: c.z1 - c.z0, fill: '#7FB3D5', 'fill-opacity': '0.35' }));
    for (const s of deck.stairs || []) { svg.append(svgEl('rect', { x: s.x - 1.2, y: s.z - 1.2, width: 2.4, height: 2.4, fill: '#F2D27A', 'fill-opacity': '0.8', stroke: '#7A5B12', 'stroke-width': '0.2' })); }
    // landmarks on this deck as pins (fast travel)
    for (const [id, l] of Object.entries(this.locations || {})) {
      if (l.deck !== this.mapDeck) continue;
      const pin = svgEl('g', { class: 'pin', style: 'cursor:pointer' });
      pin.append(svgEl('circle', { cx: l.x, cy: l.z, r: 1.6, fill: '#C9A227', stroke: '#3F2E12', 'stroke-width': '0.3' }));
      const t = svgEl('title'); t.textContent = l.name; pin.append(t);
      pin.addEventListener('click', () => { this.bus.emit('ui:teleport', { locationId: id }); this.bus.emit('audio:play', { id: 'bell' }); this.bus.emit('ui:resume'); });
      svg.append(pin);
    }
    // player & objective markers
    this.playerMarker = svgEl('g'); this.playerMarker.append(svgEl('circle', { cx: 0, cy: 0, r: 2, fill: '#E8E1D1', stroke: '#0B1626', 'stroke-width': '0.5' }), svgEl('path', { d: 'M3.5,0 L-1.5,-2 L-1.5,2 Z', fill: '#B5402D' }));
    this.objectiveMarker = svgEl('circle', { r: 2.2, fill: 'none', stroke: '#F2D27A', 'stroke-width': '0.7' });
    svg.append(this.objectiveMarker, this.playerMarker);
    const label = svgEl('text', { x: -140, y: -34, 'font-size': '4', fill: '#CFE3F5', 'font-family': 'Cinzel, Georgia, serif' }); label.textContent = `${deck.name.toUpperCase()} · bow →`; svg.append(label);
    this._updateMarkers();
  }
  _updateMarkers() {
    const st = this.state; if (!st || !this.playerMarker) return;
    const onDeck = st.deck === this.mapDeck;
    this.playerMarker.setAttribute('opacity', onDeck ? '1' : '0.3');
    this.playerMarker.setAttribute('transform', `translate(${st.player.x.toFixed(1)},${st.player.z.toFixed(1)}) rotate(${(-(st.heading || 0)).toFixed(0)})`);
    const loc = st.objective && st.objective.locationId ? this.locations[st.objective.locationId] : null;
    if (loc && loc.deck === this.mapDeck) { this.objectiveMarker.setAttribute('cx', loc.x); this.objectiveMarker.setAttribute('cy', loc.z); this.objectiveMarker.setAttribute('opacity', '1'); } else this.objectiveMarker.setAttribute('opacity', '0');
  }

  // ---------------- photo mode
  _buildPhoto() {
    return h('div', { id: 'photo', class: 'hidden passive' }, h('div', { class: 'bellows' }), h('div', { class: 'photo-bar' }, h('span', { class: 'plate' }, 'Plate camera'), h('span', { class: 'hint' }, h('span', { class: 'keycap' }, 'C'), 'expose plate   ', h('span', { class: 'keycap' }, 'P'), 'close   ', h('span', { class: 'keycap' }, 'WASD / Q E'), 'move')));
  }

  // ---------------- chronometer
  _buildTime() {
    const el = h('div', { id: 'timectl', class: 'hidden center' }, h('div', { class: 'modal-scrim' }), h('div', { class: 'mahogany-panel', style: 'padding:1.4rem 2rem;position:relative;text-align:center;min-width:24rem' }, h('div', { class: 'engraved', style: 'font-size:var(--fs-lg)' }, 'Wind the Watch'), h('div', { class: 'now', style: 'font-family:var(--font-doc);font-size:var(--fs-xl);color:var(--brass-hi);margin:.6rem 0' }, ''), h('div', { class: 'next', style: 'color:var(--fog-dim)' }, ''), h('div', { style: 'display:flex;gap:1rem;justify-content:center;margin-top:1rem' }, h('button', { class: 'btn wind', onclick: () => this._wind() }, 'Wind to the next beat'), h('button', { class: 'btn bronze', onclick: () => this.bus.emit('ui:resume') }, 'Close'))));
    return el;
  }
  _renderTime() {
    const st = this.state || {};
    this.time.querySelector('.now').textContent = st.clock ? `${st.clock.hhmm}` : '';
    const nt = st.nextTime;
    this.time.querySelector('.next').textContent = nt ? `The next beat waits for ${nt.at}${nt.date ? ' on ' + nt.date : ''}.` : (st.sinking ? 'From here, the ship keeps her own time.' : 'Nothing is waiting on the clock. The watch is yours.');
    this.time.querySelector('.wind').disabled = !nt || !!st.sinking;
  }
  _wind() { const nt = this.state?.nextTime; if (!nt) return; this.bus.emit('ui:advanceTime', { to: nt.at, date: nt.date }); this.bus.emit('audio:play', { id: 'bell' }); this.bus.emit('ui:resume'); }
}
