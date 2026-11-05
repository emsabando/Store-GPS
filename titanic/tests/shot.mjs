/**
 * Quick view screenshots for iteration (no build step):
 *   node tests/shot.mjs --locations=a,b --time=18:20 --quality=high --w=960 --h=540 [--out=screenshots/quick] [--sink=120]
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
const url = `http://127.0.0.1:${server.address().port}/?autostart=1&debug=1&nosink=1&manual=1&quality=${args.quality || 'high'}&res=native${args.time ? '&time=' + args.time : ''}${args.watch ? '&watch=' + args.watch : ''}`;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__GAME_READY === true, null, { timeout: 300000, polling: 300 });
if (args.time) await page.evaluate((t) => window.__game.setTime(t), String(args.time));
await page.evaluate(() => window.__game.frame(3)); // warm-up: first frames initialise post-processing and the environment
// The watch-start title card (#cutscene, navy, 3.5 s) and the pointer-lock prompt (#helm) sit over the canvas: wait / hide them.
await page.waitForFunction(() => { const c = document.querySelector('#cutscene'); return !c || c.classList.contains('hidden'); }, null, { timeout: 30000, polling: 200 });
if (!args.helm) await page.evaluate(() => { const h = document.querySelector('#helm'); if (h) h.style.display = 'none'; });
if (args.sink) {
  await page.evaluate((m) => { window.__game.setTime('23:40'); window.__game.startSinking(); window.__game.sinking.jumpTo?.(m); }, parseFloat(args.sink));
}
if (args.eval) await page.evaluate((code) => { (new Function('game', code))(window.__game); }, String(args.eval));
for (const loc of locations) {
  const info = await page.evaluate(async (id) => {
    try { window.__game.teleport(id); } catch (e) { return { err: String(e) }; }
    await window.__game.frame(4);
    const c = window.__game.engine.camera; const p = window.__game.player;
    // probe: what the DOM stacks over the viewport centre, and the mean canvas colour (manual mode keeps the buffer)
    let probe = null;
    try {
      const cv = document.querySelector('canvas'); const els = document.elementsFromPoint(innerWidth / 2, innerHeight / 2).map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : ''));
      const t = document.createElement('canvas'); t.width = 16; t.height = 9; const g = t.getContext('2d'); g.drawImage(cv, 0, 0, 16, 9);
      const d = g.getImageData(0, 0, 16, 9).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4;
      probe = { els: els.slice(0, 4), avg: [r / n, gg / n, b / n].map(Math.round), cut: (document.querySelector('#cutscene') || {}).className };
    } catch (e) { probe = { err: String(e) }; }
    return { post: !!window.__game.engine.postEnabled, cam: [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(1)), mode: p.mode, yaw: +p.yaw.toFixed(2), pitch: +p.pitch.toFixed(2), probe, stats: window.__game.engine.stats };
  }, loc);
  const file = path.join(outDir, `${loc}.png`);
  await page.screenshot({ path: file, type: 'png' });
  console.log(loc, JSON.stringify(info).slice(0, 220), '->', path.relative(root, file));
}
if (errors.length) { console.log('ERRORS:'); for (const e of errors.slice(0, 10)) console.log('  ', e.slice(0, 300)); }
await browser.close(); server.close();
