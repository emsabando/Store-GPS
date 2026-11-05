/**
 * Quick view screenshots for iteration (no build step):
 *   node tests/shot.mjs --locations=a,b --time=18:20 --quality=high --w=960 --h=540 [--out=screenshots/quick] [--sink=120]
 *   Options: --at=<spawn location> --watch=watchN --yaw=<rad> --pitch=<rad> (applied after each teleport)
 *            --calls (draw-call breakdown) --pick (what the centre ray hits) --custom (window.__shotProbe())
 *            --eval="js with `game`" (runs once before the locations) --helm (keep the pointer-lock prompt) --settle=ms
 *   A location may be free-camera coordinates "x:y:z[:yaw:pitch]" (world metres, radians).
 * Serves dist/ (run `npx vite build` first), boots with ?autostart&manual, teleports, renders 2 frames, saves PNGs.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const locations = String(args.locations || 'exterior_port_bow').split(',');
const W = parseInt(args.w || '960', 10), H = parseInt(args.h || '540', 10);
const outDir = path.resolve(root, args.out || 'screenshots/quick');
fs.mkdirSync(outDir, { recursive: true });
const dist = path.join(root, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, rq) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rq.writeHead(404); rq.end(); return; }
  rq.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rq);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (args.verbose) console.log('[con]', m.text().slice(0, parseInt(args.conlen || '200', 10))); });
const url = `http://127.0.0.1:${server.address().port}/?autostart=1&debug=1&nosink=1&manual=1&quality=${args.quality || 'high'}&res=native${args.time ? '&time=' + args.time : ''}${args.watch ? '&watch=' + args.watch : ''}${args.at ? '&at=' + args.at : ''}`;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__GAME_READY === true, null, { timeout: 300000, polling: 300 });
if (args.time) await page.evaluate((t) => window.__game.setTime(t), String(args.time));
await page.evaluate(() => window.__game.frame(3)); // warm-up: first frames initialise post-processing and the environment
// The watch-start title card (#cutscene, navy, 3.5 s) and the pointer-lock prompt (#helm) sit over the canvas: wait / hide them.
await page.waitForFunction(() => { const c = document.querySelector('#cutscene'); return !c || c.classList.contains('hidden'); }, null, { timeout: 30000, polling: 200 });
if (args.settle) await new Promise((r) => setTimeout(r, parseInt(args.settle, 10)));
if (!args.helm) await page.evaluate(() => { const h = document.querySelector('#helm'); if (h) h.style.display = 'none'; });
if (args.sink) {
  await page.evaluate((m) => { window.__game.setTime('23:40'); window.__game.startSinking(); window.__game.sinking.jumpTo?.(m); }, parseFloat(args.sink));
}
if (args.calls) await page.evaluate(() => { window.__shotCalls = true; });
if (args.pick) await page.evaluate(() => { window.__shotPick = true; });
if (args.eval) await page.evaluate((code) => (new Function('game', code))(window.__game), String(args.eval));   // a returned promise is awaited
for (const loc of locations) {
  const info = await page.evaluate(async ({ id, yaw, pitch }) => {
    try {
      if (id.includes(':')) { const [x, y, z, yaw = 0, pitch = 0] = id.split(':').map(Number); window.__game.teleport({ x, y, z, yaw, pitch, mode: 'free' }); }   // "x:y:z[:yaw:pitch]" free camera
      else window.__game.teleport(id);
    } catch (e) { return { err: String(e) }; }
    if (yaw !== null) window.__game.player.yaw = yaw;      // --yaw / --pitch: radians, applied after the teleport
    if (pitch !== null) window.__game.player.pitch = pitch;
    await window.__game.frame(4);
    const c = window.__game.engine.camera; const p = window.__game.player;
    // probe: what the DOM stacks over the viewport centre, and the mean canvas colour (manual mode keeps the buffer)
    let probe = null;
    try {
      const cv = document.querySelector('canvas'); const els = document.elementsFromPoint(innerWidth / 2, innerHeight / 2).map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : ''));
      // render once more and read the centre + four quadrant pixels back in the same task (no compositor clear in between)
      window.__game.engine.renderOnce();
      const gl = window.__game.engine.renderer.getContext(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const px = []; for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const b4 = new Uint8Array(4); gl.readPixels(Math.floor(W * fx), Math.floor(H * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b4); px.push(Array.from(b4)); }
      probe = { els: els.slice(0, 4), px, cut: (document.querySelector('#cutscene') || {}).className, cam: window.__game.engine.camera === window.__game.player.camera ? 'player' : 'other' };
    } catch (e) { probe = { err: String(e) }; }
    const st = window.__game.engine.stats || {};
    let pick = null;
    if (window.__shotPick) {
      try {
        const rc = window.__game.player.interaction.raycaster; const cam = window.__game.engine.camera;
        const o = cam.position.clone(); const d = cam.getWorldDirection(o.clone()); rc.set(cam.getWorldPosition(o.clone()), d); rc.far = 1000; rc.near = 0.05;
        const shown = (o) => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
        const hits = rc.intersectObjects(window.__game.engine.scene.children.filter((c) => !/Sky|Celestial|Ocean/.test(c.name)), true).filter((h) => shown(h.object) && (!h.object.material || h.object.material.visible !== false));
        const h = hits[0];
        if (h) { const chain = []; let q = h.object; while (q && chain.length < 5) { chain.push(q.name || q.type); q = q.parent; } const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material; pick = { d: +h.distance.toFixed(1), chain: chain.join('<'), mat: m && m.name, col: m && m.color ? m.color.getHexString() : null, pt: h.point.toArray().map((v) => +v.toFixed(1)) }; }
        else pick = { none: true };
      } catch (e) { pick = { err: String(e).slice(0, 100) }; }
    }
    let custom = null;
    try { if (typeof window.__shotProbe === 'function') custom = window.__shotProbe(); } catch (e) { custom = { err: String(e).slice(0, 120) }; }
    let calls = null;
    if (window.__shotCalls) { const e = window.__game.engine, r = e.renderer; calls = {}; e.renderOnce(); e.renderOnce(); calls.full = r.info.render.calls; const au = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = true; r.shadowMap.enabled = false; e.renderOnce(); calls.noShadow = r.info.render.calls; e.setPostEnabled(false); e.renderOnce(); calls.plain = r.info.render.calls; r.shadowMap.enabled = true; r.shadowMap.autoUpdate = au; e.setPostEnabled(true); e.renderOnce(); }
    return { post: !!window.__game.engine.postEnabled, cam: [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(1)), mode: p.mode, yaw: +p.yaw.toFixed(2), pitch: +p.pitch.toFixed(2), calls: calls || st.drawCalls, tris: st.triangles, custom, pick, ms: +(+st.frameMs || 0).toFixed(1), probe };
  }, { id: loc, yaw: args.yaw !== undefined ? parseFloat(args.yaw) : null, pitch: args.pitch !== undefined ? parseFloat(args.pitch) : null });
  const file = path.join(outDir, `${loc.replace(/[^a-zA-Z0-9_.-]+/g, '_')}.png`);
  await page.screenshot({ path: file, type: 'png' });
  console.log(loc, JSON.stringify(info).slice(0, args.custom ? 2000 : 400), '->', path.relative(root, file));
}
if (errors.length) { console.log('ERRORS:'); for (const e of errors.slice(0, 10)) console.log('  ', e.slice(0, 300)); }
await browser.close(); server.close();
