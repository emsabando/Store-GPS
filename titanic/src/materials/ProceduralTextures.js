/**
 * ProceduralTextures — canvas-generated, tileable PBR texture sets (ARCHITECTURE.md §4).
 *
 * Every generator returns `{ map, normalMap, roughnessMap, aoMap, sizeM:[w,h] }` of CanvasTextures:
 * `map` is sRGB, the data maps are NoColorSpace, all RepeatWrapping with mipmaps and the requested
 * anisotropy. `sizeM` is the physical size of one texture tile in metres so callers can set repeats.
 * Results are cached by generator name + JSON of the options; dispose with `clearProceduralCache()`.
 * Default texture size is 1024 (512 when `setProceduralQuality('low')` has been called).
 */
import * as THREE from 'three';

let defaultSize = 1024;
let defaultAnisotropy = 8;
const cache = new Map();

export function setProceduralQuality(quality) {
  defaultSize = quality === 'low' ? 512 : 1024;
  defaultAnisotropy = { low: 2, medium: 4, high: 8, ultra: 16 }[quality] || 8;
}
export function clearProceduralCache() {
  for (const pack of cache.values()) for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) if (pack[k]) pack[k].dispose();
  cache.clear();
}

// ------------------------------------------------------------------ small helpers
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);
export function mulberry(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function rgb(hex) { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; }
function shade(hex, h, s, l) { const c = new THREE.Color(hex).offsetHSL(h, s, l); return [c.r * 255, c.g * 255, c.b * 255]; }
function canvas2d(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/**
 * Tileable value-noise fBm field, values 0..1, `size`×`size`, `freq` cells per tile at octave 0.
 * Anisotropic noise (brushed metal, grain) uses `freqY` for the vertical frequency.
 */
export function noiseField(size, { octaves = 4, freq = 4, freqY = freq, seed = 1, persistence = 0.5 } = {}) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const px = Math.max(1, Math.round(freq * (1 << o))), py = Math.max(1, Math.round(freqY * (1 << o)));
    const lat = new Float32Array(px * py);
    for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) lat[j * px + i] = hash2(i, j, seed * 97 + o * 7919);
    const sx = px / size, sy = py / size;
    for (let y = 0; y < size; y++) {
      const fy = y * sy, iy = fy | 0, ty = smooth(fy - iy), y0 = (iy % py) * px, y1 = ((iy + 1) % py) * px;
      for (let x = 0; x < size; x++) {
        const fx = x * sx, ix = fx | 0, tx = smooth(fx - ix), x0 = ix % px, x1 = (ix + 1) % px;
        const a = lat[y0 + x0] + (lat[y0 + x1] - lat[y0 + x0]) * tx;
        const b = lat[y1 + x0] + (lat[y1 + x1] - lat[y1 + x0]) * tx;
        out[y * size + x] += (a + (b - a) * ty) * amp;
      }
    }
    total += amp; amp *= persistence;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Greyscale tileable noise canvas (contract: makeNoise(size, octaves)). */
export function makeNoise(size = defaultSize, octaves = 4, seed = 1) {
  const f = noiseField(size, { octaves, seed });
  return fieldToCanvas(f, size, size);
}

function fieldToCanvas(field, w, h) {
  const c = canvas2d(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) { const v = clamp01(field[i]) * 255; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}
function canvasToField(canvas) {
  const w = canvas.width, h = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, w, h).data, f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
  return f;
}

/**
 * Sobel normal map (OpenGL convention, +Y up, which is what three.js expects) from a height canvas
 * or a Float32Array field (0..1). Edges wrap so the result tiles. Returns a canvas.
 */
export function normalFromHeight(source, strength = 2, w = 0, h = 0) {
  let field = source;
  if (source instanceof HTMLCanvasElement || (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas)) { w = source.width; h = source.height; field = canvasToField(source); }
  const c = canvas2d(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const ym = ((y - 1 + h) % h) * w, y0 = y * w, yp = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w, xp = (x + 1) % w;
      const gx = (field[ym + xp] + 2 * field[y0 + xp] + field[yp + xp]) - (field[ym + xm] + 2 * field[y0 + xm] + field[yp + xm]);
      const gy = (field[yp + xm] + 2 * field[yp + x] + field[yp + xp]) - (field[ym + xm] + 2 * field[ym + x] + field[ym + xp]);
      let nx = -gx * strength, ny = gy * strength, nz = 1; // canvas y is down, texture V is up
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= len; ny /= len; nz /= len;
      const i = (y0 + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Cheap ambient occlusion from a height field: cavities (below the local mean) darken. */
function aoFromHeight(field, w, h, radius = 6, strength = 1.5) {
  const blur = new Float32Array(w * h), tmp = new Float32Array(w * h);
  const n = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let k = -radius; k <= radius; k++) acc += field[y * w + ((k + w) % w)];
    for (let x = 0; x < w; x++) { tmp[y * w + x] = acc / n; acc += field[y * w + ((x + radius + 1) % w)] - field[y * w + ((x - radius + w) % w)]; }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -radius; k <= radius; k++) acc += tmp[((k + h) % h) * w + x];
    for (let y = 0; y < h; y++) { blur[y * w + x] = acc / n; acc += tmp[((y + radius + 1) % h) * w + x] - tmp[((y - radius + h) % h) * w + x]; }
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = clamp01(1 - (blur[i] - field[i]) * strength * 4);
  return out;
}

function makeTexture(canvas, { srgb = false, anisotropy = defaultAnisotropy } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

/** Assemble a texture pack from a colour canvas plus height/roughness fields. */
function pack({ color, height, rough, ao, w, h, sizeM, anisotropy, normalStrength = 2, aoRadius = 6, aoStrength = 1.2, transparent = false }) {
  const opts = { anisotropy };
  const map = makeTexture(color, { srgb: true, ...opts });
  if (transparent) map.premultiplyAlpha = false;
  const normalMap = height ? makeTexture(normalFromHeight(height, normalStrength, w, h), opts) : null;
  const roughnessMap = rough ? makeTexture(fieldToCanvas(rough, w, h), opts) : null;
  const aoField = ao || (height ? aoFromHeight(height, w, h, aoRadius, aoStrength) : null);
  const aoMap = aoField ? makeTexture(fieldToCanvas(aoField, w, h), opts) : null;
  return { map, normalMap, roughnessMap, aoMap, sizeM };
}

function cached(name, options, build) {
  const key = name + JSON.stringify(options);
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

// ------------------------------------------------------------------ generators

/**
 * Deck planks: `widthM`×`lengthM` tile, planks `plankW` wide running along V (the long axis), joints
 * every `plankL` staggered per row, per-plank hue/lightness variation, grain lines and caulked seams.
 */
export function makePlanks(options = {}) {
  return cached('planks', options, () => {
    const { widthM = 1.2, lengthM = 2.4, plankW = 0.15, plankL = 2.4, color = '#8b6a3e', gapColor = '#1c1711', grain = 0.6, variation = 0.5, caulk = 0.006, seed = 3, size = defaultSize, anisotropy = defaultAnisotropy } = options;
    const w = size, h = Math.round(size * (lengthM / widthM)) || size;
    const n = Math.max(1, Math.round(widthM / plankW)), pw = w / n, gapPx = Math.max(1.5, (caulk / widthM) * w);
    const rand = mulberry(seed);
    const planks = [];
    for (let i = 0; i < n; i++) planks.push({ c: shade(color, (rand() - 0.5) * 0.02 * variation, (rand() - 0.5) * 0.1 * variation, (rand() - 0.5) * 0.14 * variation), off: rand() * plankL, grainOff: rand() * 100, warp: 0.5 + rand() });
    const fine = noiseField(size, { octaves: 5, freq: 6, freqY: 12, seed }), warpN = noiseField(size, { octaves: 2, freq: 2, seed: seed + 11 });
    const c = canvas2d(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const height = new Float32Array(w * h), rough = new Float32Array(w * h);
    const gapRGB = rgb(gapColor);
    for (let y = 0; y < h; y++) {
      const vM = (y / h) * lengthM;
      for (let x = 0; x < w; x++) {
        const i = y * w + x, p = Math.min(n - 1, (x / pw) | 0), pl = planks[p], lx = x - p * pw;
        const nx = (x % size), ny = (y % size), ni = ny * size + nx;
        const jointPos = ((vM + pl.off) % plankL + plankL) % plankL;
        const inGapX = lx < gapPx * 0.5 || lx > pw - gapPx * 0.5, inGapY = jointPos * (h / lengthM) < gapPx || jointPos * (h / lengthM) > plankL * (h / lengthM) - gapPx;
        const edge = Math.min(lx, pw - lx) / pw;
        let r, gg, b;
        if (inGapX || inGapY) {
          const t = 0.7 + fine[ni] * 0.3; r = gapRGB[0] * t; gg = gapRGB[1] * t; b = gapRGB[2] * t;
          height[i] = 0.1 + fine[ni] * 0.05; rough[i] = 0.9;
        } else {
          const gx = (lx / pw) * 4 + warpN[ni] * pl.warp * 3 + pl.grainOff;
          const lines = Math.pow(0.5 + 0.5 * Math.sin(gx * Math.PI * 2 * 3.5 + fine[ni] * 4), 6) * grain;
          const tone = 1 - lines * 0.35 - (fine[ni] - 0.5) * 0.25 * grain + (0.5 - Math.abs(edge - 0.5)) * 0.06;
          r = pl.c[0] * tone; gg = pl.c[1] * tone; b = pl.c[2] * tone;
          height[i] = 0.75 + Math.min(1, edge * 12) * 0.2 - lines * 0.08 + (fine[ni] - 0.5) * 0.06;
          rough[i] = 0.58 + lines * 0.2 + (fine[ni] - 0.5) * 0.15;
        }
        d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return pack({ color: c, height, rough, w, h, sizeM: [widthM, lengthM], anisotropy, normalStrength: 1.6 });
  });
}

/**
 * Riveted hull/bulkhead plating: two in-and-out strakes per tile (`plateW` × 2·`plateH` metres),
 * butt joints with double rivet rows, dome rivets at `rivetPitch`, paint colour variation.
 */
export function makeRivetedPlates(options = {}) {
  return cached('rivets', options, () => {
    const { plateW = 1.8, plateH = 0.9, rivetPitch = 0.09, rivetR = 0.014, color = '#111214', rivetColor = '#0d0e10', seam = 1, rust = 0, seed = 5, size = defaultSize, anisotropy = defaultAnisotropy } = options;
    const w = size, h = size, sizeM = [plateW, plateH * 2];
    const mx = w / plateW, my = h / (plateH * 2);
    const base = rgb(color), riv = rgb(rivetColor);
    const n = noiseField(size, { octaves: 5, freq: 3, seed }), fine = noiseField(size, { octaves: 3, freq: 32, seed: seed + 3 });
    const height = new Float32Array(w * h), rough = new Float32Array(w * h);
    const c = canvas2d(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    // Strake A (outer, raised) occupies the lower half; strake B (inner) the upper half. Vertical butt
    // joint at x = plateW/2 on strake B, at x = 0 on strake A so joints are staggered.
    const rivetRows = []; // { y (px), x0, dx, two:boolean } rows of rivets along seams
    const pitchPx = rivetPitch * mx;
    const yA = plateH * my; // seam between strakes
    rivetRows.push({ y: yA + rivetPitch * 0.7 * my, x0: pitchPx * 0.5, dx: pitchPx }, { y: yA + rivetPitch * 1.6 * my, x0: pitchPx, dx: pitchPx });
    rivetRows.push({ y: rivetPitch * 0.7 * my, x0: pitchPx, dx: pitchPx }, { y: h - rivetPitch * 0.7 * my, x0: pitchPx * 0.5, dx: pitchPx });
    const rivets = [];
    for (const row of rivetRows) for (let x = row.x0; x < w; x += row.dx) rivets.push([x, row.y]);
    const butts = [{ x: 0, y0: 0, y1: yA }, { x: plateW * 0.5 * mx, y0: yA, y1: h }];
    for (const bj of butts) for (let y = bj.y0 + pitchPx * 0.5; y < bj.y1; y += pitchPx) rivets.push([bj.x + rivetPitch * 0.8 * mx, y], [bj.x - rivetPitch * 0.8 * mx + (bj.x === 0 ? w : 0), y]);
    const rPx = rivetR * mx, cell = Math.ceil(rPx * 2 + 2);
    const grid = new Map();
    for (const rv of rivets) { const k = `${(rv[0] / cell) | 0},${(rv[1] / cell) | 0}`; (grid.get(k) || grid.set(k, []).get(k)).push(rv); }
    for (let y = 0; y < h; y++) {
      const strakeA = y >= yA;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let hgt = strakeA ? 0.72 : 0.5;
        // overlap lip of strake A over strake B
        if (strakeA && y < yA + 3) hgt = 0.6 + (y - yA) * 0.04;
        // butt joints: a narrow groove
        for (const bj of butts) { const dx = Math.min(Math.abs(x - bj.x), Math.abs(x - bj.x - w), Math.abs(x - bj.x + w)); if (y >= bj.y0 && y < bj.y1 && dx < 1.5 * seam) hgt -= 0.08; }
        // plate waviness ("hungry horse") + fine texture
        hgt += (n[i] - 0.5) * 0.12 + (fine[i] - 0.5) * 0.03;
        let isRivet = 0;
        const gx = (x / cell) | 0, gy = (y / cell) | 0;
        for (let oy = -1; oy <= 1 && !isRivet; oy++) for (let ox = -1; ox <= 1 && !isRivet; ox++) {
          const list = grid.get(`${gx + ox},${gy + oy}`); if (!list) continue;
          for (const rv of list) { let ddx = x - rv[0]; if (ddx > w / 2) ddx -= w; if (ddx < -w / 2) ddx += w; const ddy = y - rv[1]; const dd = ddx * ddx + ddy * ddy; if (dd < rPx * rPx) { isRivet = Math.sqrt(1 - dd / (rPx * rPx)); break; } }
        }
        if (isRivet) hgt += isRivet * 0.22;
        height[i] = clamp01(hgt);
        const rustAmt = rust > 0 ? clamp01((n[i] - (1 - rust * 0.6)) * 4) : 0;
        const tone = 0.9 + (n[i] - 0.5) * 0.25 + (fine[i] - 0.5) * 0.1;
        let r = base[0] * tone, gg = base[1] * tone, b = base[2] * tone;
        if (isRivet) { const t = 0.85 + isRivet * 0.3; r = riv[0] * t; gg = riv[1] * t; b = riv[2] * t; }
        if (rustAmt) { r = r * (1 - rustAmt) + 120 * rustAmt; gg = gg * (1 - rustAmt) + 60 * rustAmt; b = b * (1 - rustAmt) + 30 * rustAmt; }
        d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
        rough[i] = clamp01(0.42 + (n[i] - 0.5) * 0.2 + rustAmt * 0.45 + (isRivet ? 0.08 : 0));
      }
    }
    g.putImageData(img, 0, 0);
    return pack({ color: c, height, rough, w, h, sizeM, anisotropy, normalStrength: 2.2, aoRadius: 5, aoStrength: 0.9 });
  });
}

/**
 * Floor tiles. `pattern`: 'checker' | 'diamond' | 'mosaic' | 'moorish' (8-point star & cross, Turkish
 * bath) | 'dining' (the D-deck saloon's cream/blue/red linoleum). Tile = `tileW`·`n` metres square.
 */
export function makeTiles(options = {}) {
  return cached('tiles', options, () => {
    const { tileW = 0.3, pattern = 'checker', colours = ['#d9cfae', '#2a3f6e', '#8b1e2b'], grout = '#8a8578', groutW = 0.004, gloss = 0.3, seed = 7, size = defaultSize, anisotropy = defaultAnisotropy } = options;
    const n = pattern === 'mosaic' ? 12 : pattern === 'moorish' ? 2 : pattern === 'dining' ? 4 : 4;
    const sizeM = [tileW * n, tileW * n], w = size, h = size, t = w / n;
    const rand = mulberry(seed);
    const c = canvas2d(w, h), g = c.getContext('2d');
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    const gp = Math.max(1, (groutW / sizeM[0]) * w);
    const tileMask = canvas2d(w, h), mg = tileMask.getContext('2d'); mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h); mg.fillStyle = '#fff';
    const star = (ctx, cx, cy, r) => { ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = k % 2 === 0 ? r : r * 0.62; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); };
    const fillTile = (x, y, s, col) => { g.fillStyle = col; g.fillRect(x + gp / 2, y + gp / 2, s - gp, s - gp); mg.fillRect(x + gp / 2, y + gp / 2, s - gp, s - gp); };
    if (pattern === 'checker' || pattern === 'mosaic') {
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const col = pattern === 'checker' ? colours[(i + j) % 2] : colours[(rand() * colours.length) | 0];
        fillTile(i * t, j * t, t, shade(col, 0, 0, (rand() - 0.5) * 0.06).map(Math.round).reduce((s, v) => s + v.toString(16).padStart(2, '0'), '#'));
      }
    } else if (pattern === 'diamond') {
      for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
        const cx = (i + 0.5) * t, cy = (j + 0.5) * t, col = colours[((i + j) % 2 + 2) % 2];
        for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
          g.save(); g.translate(cx + ox, cy + oy); g.rotate(Math.PI / 4); g.fillStyle = col; const s = t * 0.7071 - gp; g.fillRect(-s / 2, -s / 2, s, s); g.restore();
          mg.save(); mg.translate(cx + ox, cy + oy); mg.rotate(Math.PI / 4); const s2 = t * 0.7071 - gp; mg.fillRect(-s2 / 2, -s2 / 2, s2, s2); mg.restore();
        }
      }
    } else if (pattern === 'moorish') {
      const bg = colours[1] || '#1f4d6e', fg = colours[0] || '#e8dcc0', ac = colours[2] || '#b0442c';
      g.fillStyle = bg; g.fillRect(0, 0, w, h); mg.fillStyle = '#fff'; mg.fillRect(0, 0, w, h);
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        g.fillStyle = fg; star(g, i * t, j * t, t * 0.46);
        g.fillStyle = ac; star(g, i * t, j * t, t * 0.2);
        g.fillStyle = fg; g.beginPath(); g.arc(i * t, j * t, t * 0.07, 0, Math.PI * 2); g.fill();
        // cross between stars
        g.fillStyle = ac; const cx = (i + 0.5) * t, cy = (j + 0.5) * t, a = t * 0.16, b = t * 0.05;
        g.fillRect(cx - a, cy - b, a * 2, b * 2); g.fillRect(cx - b, cy - a, b * 2, a * 2);
      }
      g.strokeStyle = grout; g.lineWidth = gp; for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * t, 0); g.lineTo(k * t, h); g.moveTo(0, k * t); g.lineTo(w, k * t); g.stroke(); }
    } else if (pattern === 'dining') {
      const cream = colours[0] || '#dccfa8', blue = colours[1] || '#2b4a7a', red = colours[2] || '#8f2b2b';
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) fillTile(i * t, j * t, t, cream);
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        g.fillStyle = blue; const s = t * 0.28; g.fillRect(i * t - s / 2, j * t - s / 2, s, s);
        g.fillStyle = red; const cx = (i + 0.5) * t, cy = (j + 0.5) * t, r = t * 0.17;
        g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.fill();
        g.strokeStyle = blue; g.lineWidth = Math.max(1, t * 0.02); g.strokeRect(i * t + t * 0.12, j * t + t * 0.12, t * 0.76, t * 0.76);
      }
    }
    // subtle glaze variation + height from mask
    const mask = canvasToField(tileMask), nz = noiseField(size, { octaves: 4, freq: 8, seed });
    const img = g.getImageData(0, 0, w, h), d = img.data, height = new Float32Array(w * h), rough = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const tone = 1 + (nz[i] - 0.5) * 0.08; d[i * 4] *= tone; d[i * 4 + 1] *= tone; d[i * 4 + 2] *= tone;
      height[i] = mask[i] > 0.5 ? 0.85 + (nz[i] - 0.5) * 0.04 : 0.45 + (nz[i] - 0.5) * 0.08;
      rough[i] = mask[i] > 0.5 ? clamp01(gloss + (nz[i] - 0.5) * 0.15) : 0.9;
    }
    g.putImageData(img, 0, 0);
    return pack({ color: c, height, rough, w, h, sizeM, anisotropy, normalStrength: 1.5, aoRadius: 4 });
  });
}

/** Carpet: fibre noise with an optional repeating floral motif or Greek-key border in `accent`. */
export function makeCarpet(options = {}) {
  return cached('carpet', options, () => {
    const { color = '#8b1e2b', pattern = 'floral', accent = '#c9a66b', sizeMetres = 1.5, seed = 9, size = defaultSize, anisotropy = defaultAnisotropy } = options;
    const w = size, h = size, c = canvas2d(w, h), g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const accent2 = new THREE.Color(accent).lerp(new THREE.Color(color), 0.35).getStyle();
    if (pattern === 'floral') {
      const cells = 3, cs = w / cells;
      g.lineWidth = Math.max(1.5, w * 0.004); g.strokeStyle = accent2; g.fillStyle = accent2;
      for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
        const cx = (i + 0.5) * cs, cy = (j + 0.5) * cs;
        for (let k = 0; k < 8; k++) { // rosette
          const a = (k / 8) * Math.PI * 2;
          g.save(); g.translate(cx, cy); g.rotate(a); g.beginPath(); g.ellipse(cs * 0.17, 0, cs * 0.14, cs * 0.055, 0, 0, Math.PI * 2); g.fillStyle = k % 2 ? accent : accent2; g.fill(); g.restore();
        }
        g.beginPath(); g.arc(cx, cy, cs * 0.05, 0, Math.PI * 2); g.fillStyle = accent; g.fill();
        // vine arcs between rosettes
        g.beginPath(); g.arc(cx + cs / 2, cy, cs * 0.22, Math.PI * 0.75, Math.PI * 1.25); g.stroke();
        g.beginPath(); g.arc(cx + cs / 2, cy, cs * 0.22, -Math.PI * 0.25, Math.PI * 0.25); g.stroke();
        g.beginPath(); g.arc(cx, cy + cs / 2, cs * 0.22, Math.PI * 1.25, Math.PI * 1.75); g.stroke();
        g.beginPath(); g.arc(cx, cy + cs / 2, cs * 0.22, Math.PI * 0.25, Math.PI * 0.75); g.stroke();
        // small diamond at cell corners
        g.save(); g.translate(i * cs, j * cs); g.rotate(Math.PI / 4); g.fillStyle = accent; g.fillRect(-cs * 0.035, -cs * 0.035, cs * 0.07, cs * 0.07); g.restore();
      }
    } else if (pattern === 'border') {
      const m = w * 0.08, bw = w * 0.025;
      g.strokeStyle = accent; g.lineWidth = bw; g.strokeRect(m, m, w - 2 * m, h - 2 * m);
      g.lineWidth = bw * 0.4; g.strokeRect(m + bw * 1.6, m + bw * 1.6, w - 2 * (m + bw * 1.6), h - 2 * (m + bw * 1.6));
      g.strokeStyle = accent2; const step = (w - 2 * m) / 24;
      for (let k = 0; k < 24; k++) { // Greek key along the top/bottom
        for (const yy of [m - bw * 1.3, h - m + bw * 1.3]) { const x0 = m + k * step; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + step * 0.6, yy); g.lineTo(x0 + step * 0.6, yy - bw * 0.6); g.lineTo(x0 + step * 0.25, yy - bw * 0.6); g.stroke(); }
      }
    }
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const fibre = noiseField(size, { octaves: 5, freq: 48, seed }), low = noiseField(size, { octaves: 3, freq: 3, seed: seed + 1 });
    const height = new Float32Array(w * h), rough = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const tone = 0.82 + fibre[i] * 0.32 + (low[i] - 0.5) * 0.12;
      d[i * 4] *= tone; d[i * 4 + 1] *= tone; d[i * 4 + 2] *= tone;
      height[i] = 0.5 + (fibre[i] - 0.5) * 0.5 + (low[i] - 0.5) * 0.2; rough[i] = 0.9 + fibre[i] * 0.1;
    }
    g.putImageData(img, 0, 0);
    return pack({ color: c, height, rough, w, h, sizeM: [sizeMetres, sizeMetres], anisotropy, normalStrength: 0.9, aoRadius: 3, aoStrength: 0.6 });
  });
}

/** Wood grain field: 0..1 "ring" intensity, grain running along V (vertical), warped by noise. */
function woodGrain(size, { seed = 1, rings = 14, warp = 1.5, fine = 0.5 } = {}) {
  const warpN = noiseField(size, { octaves: 3, freq: 2, seed }), fineN = noiseField(size, { octaves: 4, freq: 4, freqY: 24, seed: seed + 2 });
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, gx = (x / size) * rings + warpN[i] * warp + fineN[i] * 0.4;
    const ring = 0.5 + 0.5 * Math.sin(gx * Math.PI * 2);
    out[i] = clamp01(Math.pow(ring, 3) * 0.7 + (fineN[i] - 0.5) * fine + 0.3);
  }
  return out;
}

const WOOD_COLOURS = { oak: '#8a6a44', mahogany: '#5a2a1a', walnut: '#5b3a23', pine: '#c9a877', teak: '#8b6a3e', sycamore: '#c9b48c' };

/**
 * Panelling: a stile-and-rail frame with a bevelled moulding around a recessed field. One tile = one
 * `bayW`×`bayH` metre panel bay. `mouldings:false` gives plain grain for flush veneer.
 */
export function makePanel(options = {}) {
  return cached('panel', options, () => {
    const { wood = 'oak', color = WOOD_COLOURS[wood] || WOOD_COLOURS.oak, mouldings = true, bayW = 0.9, bayH = 0.9, seed = 13, size = defaultSize, anisotropy = defaultAnisotropy } = options;
    const w = size, h = size, grainV = woodGrain(size, { seed, rings: 10, warp: 1.2 }), grainH = woodGrain(size, { seed: seed + 5, rings: 10, warp: 1.2 });
    const base = rgb(color), dark = shade(color, 0, 0.02, -0.12);
    const c = canvas2d(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const height = new Float32Array(w * h), rough = new Float32Array(w * h);
    const st = w * 0.12, mo = w * 0.05; // stile width, moulding width (px)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let hgt = 0.7, isRail = false, inField = false, bevel = 0;
      if (mouldings) {
        const dx = Math.min(x, w - 1 - x), dy = Math.min(y, h - 1 - y), dmin = Math.min(dx, dy);
        if (dmin < st) { hgt = 0.7; isRail = dy < dx; }
        else if (dmin < st + mo) { const t = (dmin - st) / mo; bevel = Math.sin(t * Math.PI); hgt = 0.7 + bevel * 0.18 - t * 0.12; isRail = dy < dx; }
        else { hgt = 0.56; inField = true; }
      }
      // grain: vertical in stiles/field, horizontal in rails (rotated sample)
      const gv = isRail ? grainH[x * w + y] : grainV[i];
      const tone = (inField ? 0.93 : 1) * (0.78 + gv * 0.36) + bevel * 0.08;
      const col = inField ? dark : base;
      d[i * 4] = col[0] * tone; d[i * 4 + 1] = col[1] * tone; d[i * 4 + 2] = col[2] * tone; d[i * 4 + 3] = 255;
      height[i] = clamp01(hgt + (gv - 0.5) * 0.04); rough[i] = clamp01(0.4 + (1 - gv) * 0.2);
    }
    g.putImageData(img, 0, 0);
    return pack({ color: c, height, rough, w, h, sizeM: [bayW, bayH], anisotropy, normalStrength: 2.5, aoRadius: 8, aoStrength: 1.4 });
  });
}

/** Brushed metal: directional streaks (along U) in colour and roughness. */
export function makeBrushedMetal(options = {}) {
  return cached('brushed', options, () => {
    const { color = '#9a9ca0', roughness = 0.38, seed = 17, size = defaultSize, anisotropy = defaultAnisotropy } = options;
    const w = size, h = size, base = rgb(color);
    const streak = noiseField(size, { octaves: 4, freq: 2, freqY: 96, seed }), low = noiseField(size, { octaves: 3, freq: 3, seed: seed + 1 });
    const c = canvas2d(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const height = new Float32Array(w * h), rough = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const tone = 0.9 + (streak[i] - 0.5) * 0.22 + (low[i] - 0.5) * 0.1;
      d[i * 4] = base[0] * tone; d[i * 4 + 1] = base[1] * tone; d[i * 4 + 2] = base[2] * tone; d[i * 4 + 3] = 255;
      height[i] = 0.5 + (streak[i] - 0.5) * 0.12; rough[i] = clamp01(roughness + (streak[i] - 0.5) * 0.25 + (low[i] - 0.5) * 0.1);
    }
    g.putImageData(img, 0, 0);
    return pack({ color: c, height, rough, w, h, sizeM: [1, 1], anisotropy, normalStrength: 0.5, aoRadius: 2, aoStrength: 0.2 });
  });
}

/** Painted surface: colour with mottling, scratches and chips revealing undercoat as `wear` rises (0..1). */
export function makePaint(options = {}) {
  return cached('paint', options, () => {
    const { color = '#e9e6dc', wear = 0.2, undercoat = '#6b4a3a', roughness = 0.45, seed = 19, size = defaultSize, anisotropy = defaultAnisotropy } = options;
    const w = size, h = size, base = rgb(color), under = rgb(undercoat);
    const mottle = noiseField(size, { octaves: 5, freq: 3, seed }), chips = noiseField(size, { octaves: 6, freq: 6, seed: seed + 4, persistence: 0.6 });
    const c = canvas2d(w, h), g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    // scratches
    const rand = mulberry(seed);
    g.lineWidth = Math.max(1, w / 1024); const nScr = Math.round(wear * 140);
    for (let k = 0; k < nScr; k++) { const x = rand() * w, y = rand() * h, a = rand() * Math.PI, l = (0.02 + rand() * 0.12) * w; g.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    const img = g.getImageData(0, 0, w, h), d = img.data, height = new Float32Array(w * h), rough = new Float32Array(w * h);
    const thr = 1 - wear * 0.45;
    for (let i = 0; i < w * h; i++) {
      const tone = 0.95 + (mottle[i] - 0.5) * 0.12, chip = clamp01((chips[i] - thr) * 12);
      let r = d[i * 4] * tone, gg = d[i * 4 + 1] * tone, b = d[i * 4 + 2] * tone;
      if (chip > 0) { r = r * (1 - chip) + under[0] * chip; gg = gg * (1 - chip) + under[1] * chip; b = b * (1 - chip) + under[2] * chip; }
      d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b;
      height[i] = 0.6 + (mottle[i] - 0.5) * 0.08 - chip * 0.25; rough[i] = clamp01(roughness + (mottle[i] - 0.5) * 0.15 + chip * 0.4);
    }
    g.putImageData(img, 0, 0);
    return pack({ color: c, height, rough, w, h, sizeM: [1, 1], anisotropy, normalStrength: 1.2, aoRadius: 3, aoStrength: 0.5 });
  });
}

/** Woven canvas: plain weave of warp/weft threads, slight colour mottling. */
export function makeCanvas(options = {}) {
  return cached('canvas', options, () => {
    const { color = '#d8cfb8', threadsPerMetre = 900, sizeMetres = 0.5, seed = 23, size = defaultSize, anisotropy = defaultAnisotropy } = options;
    const w = size, h = size, base = rgb(color), n = Math.round(threadsPerMetre * sizeMetres);
    const mottle = noiseField(size, { octaves: 4, freq: 4, seed }), fine = noiseField(size, { octaves: 2, freq: 64, seed: seed + 1 });
    const c = canvas2d(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const height = new Float32Array(w * h), rough = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, u = (x / w) * n, v = (y / h) * n;
      const wa = 0.5 + 0.5 * Math.sin(u * Math.PI * 2), we = 0.5 + 0.5 * Math.sin(v * Math.PI * 2);
      const over = ((Math.floor(u) + Math.floor(v)) % 2 + 2) % 2; // which thread is on top
      const weave = over ? wa * 0.6 + we * 0.4 : we * 0.6 + wa * 0.4;
      const tone = 0.78 + weave * 0.3 + (mottle[i] - 0.5) * 0.16 + (fine[i] - 0.5) * 0.08;
      d[i * 4] = base[0] * tone; d[i * 4 + 1] = base[1] * tone; d[i * 4 + 2] = base[2] * tone; d[i * 4 + 3] = 255;
      height[i] = 0.4 + weave * 0.35 + (mottle[i] - 0.5) * 0.1; rough[i] = 0.85 + (fine[i] - 0.5) * 0.1;
    }
    g.putImageData(img, 0, 0);
    return pack({ color: c, height, rough, w, h, sizeM: [sizeMetres, sizeMetres], anisotropy, normalStrength: 1.0, aoRadius: 2, aoStrength: 0.4 });
  });
}

/**
 * Nameplate / lettering: serif capitals in `color` (gold) on a transparent (or `background`) field,
 * with raised letters in the normal map. `sizeM` = [widthM, widthM / aspect].
 */
export function makeNameplate(options = {}) {
  return cached('nameplate', options, () => {
    const { text = 'TITANIC', color = '#d4af37', background = null, font = 'bold 180px "Times New Roman", Georgia, serif', widthM = 4, letterSpacing = 0.12, anisotropy = defaultAnisotropy } = options;
    const w = 2048, h = 256, c = canvas2d(w, h), g = c.getContext('2d');
    if (background) { g.fillStyle = background; g.fillRect(0, 0, w, h); }
    g.font = font; g.textBaseline = 'middle'; g.fillStyle = color;
    const chars = [...text]; let total = 0; const widths = chars.map((ch) => { const m = g.measureText(ch).width; total += m; return m; });
    const spacing = letterSpacing * h; total += spacing * (chars.length - 1);
    let scale = Math.min(1, (w * 0.92) / total), x = (w - total * scale) / 2;
    g.save(); g.scale(scale, 1);
    chars.forEach((ch, k) => { g.fillText(ch, x / scale, h / 2); x += (widths[k] + spacing) * scale; });
    g.restore();
    // height from the letter alpha, roughness lower on the letters
    const d = g.getImageData(0, 0, w, h).data, height = new Float32Array(w * h), rough = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const a = d[i * 4 + 3] / 255; height[i] = 0.3 + a * 0.5; rough[i] = background ? 0.5 - a * 0.25 : 0.35; }
    const p = pack({ color: c, height, rough, w, h, sizeM: [widthM, widthM * (h / w)], anisotropy, normalStrength: 2.5, aoRadius: 3, aoStrength: 0.7, transparent: !background });
    p.map.wrapS = p.map.wrapT = THREE.ClampToEdgeWrapping;
    if (p.normalMap) p.normalMap.wrapS = p.normalMap.wrapT = THREE.ClampToEdgeWrapping;
    p.transparent = !background;
    return p;
  });
}

/** Generic colour/roughness pack from a flat colour with gentle mottling (fallback for untextured names). */
export function makeFlat(options = {}) {
  return cached('flat', options, () => {
    const { color = '#808080', roughness = 0.6, mottle = 0.08, seed = 29, size = Math.min(512, defaultSize), anisotropy = defaultAnisotropy } = options;
    const w = size, h = size, base = rgb(color), n = noiseField(size, { octaves: 4, freq: 4, seed });
    const c = canvas2d(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, rough = new Float32Array(w * h), height = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const t = 1 + (n[i] - 0.5) * mottle * 2; d[i * 4] = base[0] * t; d[i * 4 + 1] = base[1] * t; d[i * 4 + 2] = base[2] * t; d[i * 4 + 3] = 255; rough[i] = clamp01(roughness + (n[i] - 0.5) * mottle); height[i] = 0.5 + (n[i] - 0.5) * 0.1; }
    g.putImageData(img, 0, 0);
    return pack({ color: c, height, rough, w, h, sizeM: [1, 1], anisotropy, normalStrength: 0.4, aoRadius: 2, aoStrength: 0.2 });
  });
}
