/**
 * Smoke test: build (unless --no-build), serve dist/, drive headless Chromium at 3840x2160,
 * assert the game boots without errors and save 4K screenshots of key locations.
 *   node tests/smoke.mjs [--no-build] [--quality=high] [--res=native] [--locations=a,b,c] [--out=screenshots] [--frames=2] [--4k] [--viewport=WxH] [--sink]
 */
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const quality = args.quality || 'high';
const res = args.res || 'native';
const frames = parseInt(args.frames || '2', 10);
const [vw, vh] = String(args.viewport || (args['4k'] ? '3840x2160' : '1920x1080')).split('x').map(Number);
const outDir = path.resolve(root, args.out || 'screenshots');
const DEFAULT_LOCS = ['bow_tip', 'boat_deck_port_fwd', 'grand_staircase_A', 'dining_saloon', 'bridge', 'parlour_suite_B52', 'cafe_parisien', 'boiler_room_6', 'cargo_hold_2', 'third_class_general', 'stern_rail', 'exterior_starboard_quarter', 'exterior_port_bow'];
const locations = args.locations ? String(args.locations).split(',') : DEFAULT_LOCS;

if (!args['no-build']) {
  const b = spawnSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit' });
  if (b.status !== 0) { console.error('BUILD FAILED'); process.exit(1); }
}
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const dist = path.join(root, 'dist');
const server = http.createServer((req, rq) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(dist, p);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rq.writeHead(404); rq.end('not found'); return; }
  rq.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(rq);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
page.setDefaultTimeout(600000);
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));

const url = `http://127.0.0.1:${port}/?autostart=1&debug=1&nosink=1&manual=1&quality=${quality}&res=${res}`;
console.log('open', url);
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME_READY === true, null, { timeout: 600000, polling: 500 });
console.log(`game ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await page.evaluate(() => window.__game.frame(3)); // warm-up: first frames initialise post-processing and the environment
const info = await page.evaluate(() => {
  const gl = window.__game.engine.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return { webgl2: window.__game.engine.renderer.capabilities.isWebGL2, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?', locations: window.__game.listLocations().length, collision: window.__game.ship.collision && Math.round(window.__game.ship.collision.triangles), size: [window.__game.engine.renderer.domElement.width, window.__game.engine.renderer.domElement.height] };
});
console.log('renderer', JSON.stringify(info));

const brightness = async (file) => {
  const p2 = await browser.newPage();
  const b64 = fs.readFileSync(file).toString('base64');
  const v = await p2.evaluate(async (data) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const c = document.createElement('canvas'); c.width = 192; c.height = 108; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 192, 108);
    const d = g.getImageData(0, 0, 192, 108).data; let s = 0, n = 0; const hist = new Set();
    for (let i = 0; i < d.length; i += 4) { s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; hist.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); }
    return { mean: s / n, colours: hist.size };
  }, b64);
  await p2.close();
  return v;
};

const results = [];
for (const loc of locations) {
  const ok = await page.evaluate((id) => { try { const l = window.__game.teleport(id); return !!l; } catch (e) { return false; } }, loc);
  if (!ok) { results.push({ loc, skipped: true }); console.log(`- ${loc}: unknown location, skipped`); continue; }
  const t1 = Date.now();
  const stats = await page.evaluate((n) => window.__game.frame(Math.max(4, n)), frames);
  const file = path.join(outDir, `${loc}.png`);
  await page.screenshot({ path: file, type: 'png', timeout: 600000 });
  const br = await brightness(file);
  const row = { loc, ms: Math.round((Date.now() - t1) / frames), drawCalls: stats.drawCalls, tris: stats.triangles, mean: Math.round(br.mean), colours: br.colours };
  results.push(row);
  console.log(`- ${loc}: ${row.ms} ms/frame, ${row.drawCalls} calls, ${row.tris} tris, brightness ${row.mean}, colours ${row.colours}`);
}
if (args.sink) {
  await page.evaluate(() => { window.__game.setTime('23:40'); window.__game.startSinking(); });
  for (const mins of [0, 60, 120, 150, 157, 159]) {
    await page.evaluate((m) => { const s = window.__game.sinking; if (s.jumpTo) s.jumpTo(m); }, mins);
    await page.evaluate((n) => window.__game.frame(n), frames);
    const file = path.join(outDir, `sinking_${String(mins).padStart(3, '0')}.png`);
    await page.screenshot({ path: file, type: 'png', timeout: 600000 });
    console.log(`- sinking +${mins} min saved`);
  }
}
const errors = await page.evaluate(() => window.__errors);
await browser.close();
server.close();
const report = { info, results, errors, consoleErrors: consoleErrors.slice(0, 50) };
fs.writeFileSync(path.join(outDir, 'smoke-report.json'), JSON.stringify(report, null, 2));
console.log(`\nerrors: ${errors.length}, console errors/warnings: ${consoleErrors.length}`);
for (const e of errors.slice(0, 20)) console.log('  ERR', e);
for (const e of consoleErrors.slice(0, 20)) console.log('  CON', e);
const black = results.filter((r) => !r.skipped && r.mean < 6);
if (black.length) console.log('  BLACK frames:', black.map((b) => b.loc).join(', '));
process.exit(errors.length || black.length ? 1 : 0);
