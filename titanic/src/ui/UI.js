// STUB — replaced by the UI engineers (ARCHITECTURE.md §8). Minimal loading + start overlay.
export class UI {
  constructor({ root, bus }) {
    this.root = root; this.bus = bus;
    root.innerHTML = `<div id="stub-ui" style="position:fixed;inset:0;display:grid;place-items:center;color:#f4e3b2;font:20px Georgia,serif;background:rgba(11,30,51,.85)"><div><div id="stub-label">Loading…</div><div id="stub-bar" style="width:320px;height:6px;background:#2a3a4a;margin-top:10px"><div id="stub-fill" style="height:100%;width:0;background:#c9a66b"></div></div><button id="stub-start" style="display:none;margin-top:16px;font:18px Georgia,serif;padding:8px 20px;background:#c9a66b;border:0;cursor:pointer">Take the helm</button></div></div><div id="stub-hud" style="position:fixed;left:12px;bottom:12px;color:#f4e3b2;font:14px Georgia,serif;display:none"></div>`;
    bus.on('loading:progress', ({ pct, label }) => { root.querySelector('#stub-label').textContent = label; root.querySelector('#stub-fill').style.width = pct + '%'; });
    bus.on('game:ready', () => { root.querySelector('#stub-start').style.display = 'inline-block'; root.querySelector('#stub-label').textContent = 'RMS Titanic — ready'; });
    root.querySelector('#stub-start').addEventListener('click', () => bus.emit('ui:newGame'));
    bus.on('game:mode', ({ mode }) => { root.querySelector('#stub-ui').style.display = mode === 'menu' || mode === 'loading' || mode === 'paused' ? 'grid' : 'none'; root.querySelector('#stub-hud').style.display = mode === 'playing' ? 'block' : 'none'; if (mode === 'paused') root.querySelector('#stub-label').textContent = 'Paused — click to resume'; });
    root.querySelector('#stub-ui').addEventListener('click', (e) => { if (e.target.id !== 'stub-start' && root.querySelector('#stub-label').textContent.startsWith('Paused')) bus.emit('ui:resume'); });
  }
  update(state) { const hud = this.root.querySelector('#stub-hud'); if (hud && state.mode === 'playing') hud.textContent = `${state.clock.date} ${state.clock.hhmm} · Deck ${state.deck} · hdg ${Math.round(state.heading)}° · ${state.fps} fps · ${state.objective ? state.objective.text : ''}`; }
}
