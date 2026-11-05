#!/usr/bin/env node
/**
 * fetch-textures.mjs — vendors CC0 photoscanned PBR texture sets into public/textures/.
 *
 *   node scripts/fetch-textures.mjs [--cache=<dir>] [--force] [--only=name,name] [--dry]
 *
 * Sources (all CC0 1.0 — no attribution required, kept in LICENSES.md anyway):
 *   ambientCG   https://ambientcg.com/get?file=<AssetId>_<1K|2K>-JPG.zip
 *   Poly Haven  https://api.polyhaven.com/files/<id>  → per-resolution jpg URLs
 *
 * Every ship material name in CATALOG maps to one source asset. Several names may share an asset
 * (cloth colours tint one neutral weave through material.color), so assets are downloaded once
 * into public/textures/<AssetId>/{color,normal,roughness,ao}.webp and the manifest points at them.
 * Only the maps the game uses are kept (colour, OpenGL-style normal, roughness, AO).
 *
 * Output: public/textures/manifest.json
 *   { [materialName]: { color, normal, roughness, ao?, sizeM:[w,h], source, license:'CC0',
 *                       asset, resolution, tint?, bytes }, _meta: { generated, totalBytes, assets } }
 * and public/textures/LICENSES.md.
 *
 * Adding a texture: add a CATALOG row, run `npm run fetch-textures`, commit public/textures.
 * Downloads are cached in --cache (default: $TMPDIR/titanic-textures-dl); the repo only receives WebP.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const OUT = path.join(root, 'public', 'textures');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const CACHE = path.resolve(args.cache || process.env.TEXTURE_CACHE || path.join(os.tmpdir(), 'titanic-textures-dl'));
const FORCE = !!args.force;
const ONLY = args.only ? String(args.only).split(',') : null;
const DRY = !!args.dry;
const UA = 'TitanicGame/1.0';
const QUALITY = { color: 82, normal: 86, roughness: 78, ao: 78 };

/** Resolution class: 'hero' → 2048 px from the 2K source, 'std' → 1024 px from the 1K source. */
const PX = { hero: 2048, std: 1024 };

/**
 * materialName → { src:'acg'|'ph', id, res:'hero'|'std', sizeM?:[w,h], tint?:'#hex', note }
 * `tint` is advisory for MaterialLibrary (it multiplies material.color); sizeM overrides the
 * physical size reported by the source when the source value is missing or wrong for our use.
 */
const CATALOG = {
  teakDeck: { src: 'acg', id: 'WoodFloor051', res: 'hero', sizeM: [1.2, 1.2], note: 'clean warm plank floor → teak deck planks (repeat tuned to ~0.15 m planks)' },
  pineDeck: { src: 'acg', id: 'Planks033A', res: 'std', sizeM: [2, 2], note: 'pale planks → holystoned pine deck' },
  oakPanel: { src: 'acg', id: 'Wood049', res: 'hero', sizeM: [0.8, 0.8], note: 'oak grain, horizontal' },
  oakDark: { src: 'acg', id: 'Wood084A', res: 'std', sizeM: [1, 1], note: 'dark stained oak' },
  mahogany: { src: 'acg', id: 'Wood030', res: 'std', sizeM: [1, 1], tint: '#a9603f', note: 'orange fine wood tinted to mahogany' },
  walnut: { src: 'ph', id: 'walnut_veneer', res: 'std', tint: '#c9a07a', note: 'walnut veneer, warmed' },
  sycamore: { src: 'acg', id: 'Wood095', res: 'std', sizeM: [1, 1], note: 'pale clean wood' },
  whiteEnamel: { src: 'acg', id: 'Paint004', res: 'std', sizeM: [1, 1], note: 'white gloss paint with fine cracks' },
  whitePaintedSteel: { src: 'acg', id: 'Metal016', res: 'std', sizeM: [1, 1], note: 'light painted, lightly scratched steel' },
  hullBlack: { src: 'acg', id: 'Metal027', res: 'hero', sizeM: [2, 2], note: 'black painted steel' },
  hullBlackRiveted: { src: 'acg', id: 'Metal027', res: 'hero', sizeM: [2, 2], note: 'same paint; rivet/plate normal is generated procedurally' },
  antifouling: { src: 'acg', id: 'Metal016', res: 'std', sizeM: [1, 1], tint: '#7a2a1e', note: 'painted steel tinted antifouling red' },
  boottop: { src: 'acg', id: 'Metal016', res: 'std', sizeM: [1, 1], tint: '#3a221b', note: 'painted steel tinted boot-topping' },
  sheerStripe: { src: 'acg', id: 'Metal042A', res: 'std', sizeM: [0.5, 0.5], tint: '#d4b25a', note: 'gold leaf stripe' },
  funnelBuff: { src: 'acg', id: 'Metal016', res: 'std', sizeM: [1, 1], tint: '#c9a66b', note: 'painted steel tinted White Star buff' },
  funnelBlack: { src: 'acg', id: 'Metal027', res: 'hero', sizeM: [2, 2], note: 'black painted steel' },
  brass: { src: 'acg', id: 'Metal034', res: 'std', sizeM: [0.5, 0.5], tint: '#b08d57', note: 'polished yellow metal tinted brass' },
  bronze: { src: 'acg', id: 'Metal008', res: 'std', sizeM: [0.5, 0.5], tint: '#8c6b3d', note: 'scratched coppery metal tinted bronze' },
  copper: { src: 'acg', id: 'Metal035', res: 'std', sizeM: [0.5, 0.5], note: 'smooth copper' },
  gold: { src: 'acg', id: 'Metal042A', res: 'std', sizeM: [0.5, 0.5], note: 'clean gold' },
  wroughtIron: { src: 'acg', id: 'Metal046A', res: 'std', sizeM: [1, 1], note: 'black iron' },
  ironDark: { src: 'acg', id: 'Metal046A', res: 'std', sizeM: [1, 1], note: 'black iron' },
  steelGrey: { src: 'acg', id: 'Metal030', res: 'std', sizeM: [1, 1], note: 'grey smooth steel' },
  steelRusty: { src: 'acg', id: 'Metal053C', res: 'std', sizeM: [1, 1], note: 'rusted iron' },
  boilerIron: { src: 'acg', id: 'Metal041B', res: 'std', sizeM: [1, 1], note: 'iron with rust bloom' },
  linoCorridor: { src: 'ph', id: 'linoleum_brown', res: 'std', tint: '#b05a46', note: 'linoleum tinted corridor red-brown' },
  moorishTile: { src: 'acg', id: 'Tiles099', res: 'std', sizeM: [1, 1], note: 'painted pattern tiles (Turkish bath)' },
  marbleWhite: { src: 'acg', id: 'Marble001', res: 'std', sizeM: [1, 1], note: 'white marble' },
  plasterWhite: { src: 'acg', id: 'Plaster002', res: 'std', sizeM: [1, 1], note: 'white rough plaster' },
  plasterCream: { src: 'acg', id: 'Plaster004', res: 'std', sizeM: [1, 1], tint: '#efe6cf', note: 'white plaster tinted cream' },
  carpetRed: { src: 'acg', id: 'Carpet015', res: 'hero', sizeM: [1, 1], note: 'red woven carpet' },
  carpetBlue: { src: 'acg', id: 'Carpet012', res: 'hero', sizeM: [1, 1], note: 'dark blue plain carpet' },
  carpetGreen: { src: 'acg', id: 'Fabric024', res: 'std', sizeM: [1, 1], tint: '#6f9a6a', note: 'green carpet, darkened' },
  roseCarpet: { src: 'acg', id: 'Carpet008', res: 'std', sizeM: [1, 1], tint: '#d59aa6', note: 'beige patterned carpet tinted rose' },
  canvas: { src: 'acg', id: 'Fabric001', res: 'std', sizeM: [1, 1], tint: '#d8cfb8', note: 'old white cloth' },
  canvasCover: { src: 'acg', id: 'Fabric001', res: 'std', sizeM: [1, 1], tint: '#cfc6ad', note: 'old white cloth, lifeboat cover' },
  lifeboatWhite: { src: 'acg', id: 'Paint004', res: 'std', sizeM: [1, 1], note: 'white paint' },
  rope: { src: 'acg', id: 'Rope001', res: 'std', sizeM: [0.25, 0.25], note: 'laid rope' },
  velvetRed: { src: 'ph', id: 'velour_velvet', res: 'std', note: 'red velour' },
  velvetGreen: { src: 'ph', id: 'ribbed_corduroy', res: 'std', tint: '#5f8a66', note: 'green corduroy' },
  leatherDark: { src: 'acg', id: 'Leather006', res: 'std', sizeM: [0.6, 0.6], note: 'dark worn leather' },
  leatherGreen: { src: 'acg', id: 'Leather004', res: 'std', sizeM: [0.6, 0.6], tint: '#2c4a36', note: 'white leather tinted green' },
  wicker: { src: 'acg', id: 'Wicker005', res: 'std', sizeM: [0.5, 0.5], note: 'light wicker weave' },
  coal: { src: 'acg', id: 'Gravel024', res: 'std', sizeM: [1, 1], tint: '#5a5a5c', note: 'black gravel → coal heap' },
  woodCrate: { src: 'acg', id: 'Planks011', res: 'std', sizeM: [1, 1], note: 'nailed rough planks' },
  snow: { src: 'acg', id: 'Snow007A', res: 'std', sizeM: [2, 2], note: 'clean snow' },
  ice: { src: 'acg', id: 'Ice002', res: 'std', sizeM: [2, 2], note: 'frozen lake ice' },
  clothBlack: { src: 'acg', id: 'Fabric019', res: 'std', sizeM: [0.3, 0.3], tint: '#141416', note: 'white wool weave tinted' },
  clothWhite: { src: 'acg', id: 'Fabric019', res: 'std', sizeM: [0.3, 0.3], tint: '#f3f0ea', note: 'white wool weave' },
  clothNavy: { src: 'acg', id: 'Fabric019', res: 'std', sizeM: [0.3, 0.3], tint: '#182540', note: 'white wool weave tinted' },
  clothGrey: { src: 'acg', id: 'Fabric019', res: 'std', sizeM: [0.3, 0.3], tint: '#6e6e70', note: 'white wool weave tinted' },
  clothBrown: { src: 'acg', id: 'Fabric019', res: 'std', sizeM: [0.3, 0.3], tint: '#5a3d2a', note: 'white wool weave tinted' },
  clothCream: { src: 'acg', id: 'Fabric019', res: 'std', sizeM: [0.3, 0.3], tint: '#e9dcc2', note: 'white wool weave tinted' },
  clothBurgundy: { src: 'acg', id: 'Fabric019', res: 'std', sizeM: [0.3, 0.3], tint: '#5e1a26', note: 'white wool weave tinted' },
  clothBlue: { src: 'acg', id: 'Fabric019', res: 'std', sizeM: [0.3, 0.3], tint: '#2a4b7c', note: 'white wool weave tinted' },
  clothGreen: { src: 'acg', id: 'Fabric019', res: 'std', sizeM: [0.3, 0.3], tint: '#2e5a3c', note: 'white wool weave tinted' },
};

// ---------------------------------------------------------------------------------------------
const log = (...a) => console.log('[textures]', ...a);
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

async function fetchBuffer(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(dest + '.part', buf);
      fs.renameSync(dest + '.part', dest);
      return dest;
    } catch (err) {
      log(`  retry ${attempt} ${url}: ${err.message}`);
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return dest;
}

/** Returns { color, normal, roughness, ao?, sizeM, sourceUrl } with local jpg paths for the asset. */
async function obtainAmbientCG(id, res) {
  const tag = res === 'hero' ? '2K' : '1K';
  const zipName = `${id}_${tag}-JPG.zip`;
  const zip = path.join(CACHE, zipName);
  const dir = path.join(CACHE, `${id}_${tag}`);
  await fetchBuffer(`https://ambientcg.com/get?file=${zipName}`, zip);
  if (!fs.existsSync(dir) || fs.readdirSync(dir).length === 0) {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('unzip', ['-o', '-q', '-j', zip, '*.jpg', '-d', dir], { stdio: 'pipe' }); // AO is optional in ambientCG sets
  }
  const files = fs.readdirSync(dir);
  const pick = (suffix) => { const f = files.find((x) => x.endsWith(suffix)); return f ? path.join(dir, f) : null; };
  const info = { color: pick('_Color.jpg'), normal: pick('_NormalGL.jpg'), roughness: pick('_Roughness.jpg'), ao: pick('_AmbientOcclusion.jpg') };
  if (!info.color || !info.normal) throw new Error(`${id}: missing colour/normal in ${zipName}`);
  // Physical size: the API gives dimensionX/Y in centimetres (0 when unknown).
  let sizeM = null;
  try {
    const metaFile = path.join(CACHE, `${id}.meta.json`);
    await fetchBuffer(`https://ambientcg.com/api/v2/full_json?id=${id}&type=Material&limit=1`, metaFile);
    const j = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const a = (j.foundAssets || []).find((x) => x.assetId === id) || (j.foundAssets || [])[0];
    if (a && a.dimensionX > 0) sizeM = [a.dimensionX / 100, (a.dimensionY || a.dimensionX) / 100];
  } catch (err) { log(`  (no size metadata for ${id}: ${err.message})`); }
  return { ...info, sizeM, sourceUrl: `https://ambientcg.com/a/${id}`, author: 'ambientCG (Lennart Demes)' };
}

async function obtainPolyHaven(id, res) {
  const tag = res === 'hero' ? '2k' : '1k';
  const metaFile = path.join(CACHE, `ph_${id}.files.json`);
  await fetchBuffer(`https://api.polyhaven.com/files/${id}`, metaFile);
  const files = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const infoFile = path.join(CACHE, `ph_${id}.info.json`);
  await fetchBuffer(`https://api.polyhaven.com/info/${id}`, infoFile);
  const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
  const dir = path.join(CACHE, `ph_${id}_${tag}`);
  fs.mkdirSync(dir, { recursive: true });
  const get = async (key) => {
    const entry = files[key] && files[key][tag] && files[key][tag].jpg;
    if (!entry) return null;
    const dest = path.join(dir, `${key}.jpg`);
    await fetchBuffer(entry.url, dest);
    return dest;
  };
  const out = { color: await get('Diffuse'), normal: await get('nor_gl'), roughness: await get('Rough'), ao: await get('AO') };
  if (!out.color || !out.normal) throw new Error(`${id}: Poly Haven asset lacks Diffuse/nor_gl at ${tag}`);
  const dims = info.dimensions && info.dimensions.length === 2 ? [info.dimensions[0] / 1000, info.dimensions[1] / 1000] : null;
  const authors = info.authors ? Object.keys(info.authors).join(', ') : 'Poly Haven';
  return { ...out, sizeM: dims, sourceUrl: `https://polyhaven.com/a/${id}`, author: `Poly Haven (${authors})` };
}

async function convert(srcPath, dest, kind, px) {
  if (!srcPath) return 0;
  if (!FORCE && fs.existsSync(dest)) return fs.statSync(dest).size;
  let img = sharp(srcPath, { failOn: 'none' }).resize(px, px, { fit: 'fill', kernel: 'lanczos3' });
  if (kind === 'color') img = img.toColourspace('srgb');
  else img = img.removeAlpha().toColourspace('srgb'); // data maps: keep raw 8-bit values, no profile conversion
  await img.webp({ quality: QUALITY[kind], effort: 5, smartSubsample: kind === 'color' }).toFile(dest);
  return fs.statSync(dest).size;
}

async function main() {
  const names = Object.keys(CATALOG).filter((n) => !ONLY || ONLY.includes(n));
  const manifest = {};
  const assets = new Map(); // assetKey → { entry, files, bytes }
  let total = 0;
  for (const name of names) {
    const c = CATALOG[name];
    const key = `${c.id}@${c.res}`;
    if (!assets.has(key)) {
      log(`${name}: ${c.src} ${c.id} (${c.res})`);
      if (DRY) { assets.set(key, { files: {}, bytes: 0, sizeM: c.sizeM || [1, 1], sourceUrl: '', author: '' }); continue; }
      try {
        const got = c.src === 'acg' ? await obtainAmbientCG(c.id, c.res) : await obtainPolyHaven(c.id, c.res);
        const folder = path.join(OUT, c.id);
        fs.mkdirSync(folder, { recursive: true });
        const px = PX[c.res];
        const files = {};
        let bytes = 0;
        for (const kind of ['color', 'normal', 'roughness', 'ao']) {
          if (!got[kind]) continue;
          const dest = path.join(folder, `${kind}.webp`);
          const n = await convert(got[kind], dest, kind, px);
          files[kind] = `${c.id}/${kind}.webp`;
          bytes += n;
        }
        total += bytes;
        assets.set(key, { files, bytes, sizeM: got.sizeM, sourceUrl: got.sourceUrl, author: got.author, px, id: c.id, src: c.src });
        log(`  → ${Object.keys(files).join(',')} ${(bytes / 1024).toFixed(0)} kB`);
      } catch (err) {
        log(`  FAILED ${c.id}: ${err.message} (material '${name}' will use the procedural fallback)`);
        assets.set(key, null);
      }
    }
    const a = assets.get(key);
    if (!a) continue;
    manifest[name] = {
      color: a.files.color, normal: a.files.normal, roughness: a.files.roughness, ...(a.files.ao ? { ao: a.files.ao } : {}),
      sizeM: c.sizeM || a.sizeM || [1, 1],
      source: c.src === 'acg' ? 'ambientCG' : 'Poly Haven', license: 'CC0', asset: c.id, resolution: a.px,
      ...(c.tint ? { tint: c.tint } : {}), bytes: a.bytes, note: c.note,
    };
  }
  const distinct = [...assets.entries()].filter(([, a]) => a).map(([k, a]) => ({ key: k, ...a }));
  manifest._meta = { generated: new Date().toISOString(), totalBytes: total, assets: distinct.length, materials: Object.keys(manifest).length };
  if (!DRY) {
    fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
    const lines = ['# Vendored texture licences', '', 'Every texture set under `public/textures/` is released under the **CC0 1.0 Universal** public-domain dedication by its author',
      '(no attribution required; listed here for provenance). Files were resized and converted to WebP by `scripts/fetch-textures.mjs`.', '',
      '| Folder | Source | Author | Resolution | Size |', '|---|---|---|---|---|'];
    const seenIds = new Set();
    for (const a of distinct.sort((x, y) => x.id.localeCompare(y.id))) {
      if (seenIds.has(a.id)) continue; seenIds.add(a.id);
      lines.push(`| ${a.id} | [${a.src === 'acg' ? 'ambientCG' : 'Poly Haven'}](${a.sourceUrl}) | ${a.author} | ${a.px} px | ${(a.bytes / 1024).toFixed(0)} kB |`);
    }
    lines.push('', `Total: ${(total / 1048576).toFixed(1)} MB across ${seenIds.size} texture sets. ambientCG: https://ambientcg.com/ — Poly Haven: https://polyhaven.com/license`, '');
    fs.writeFileSync(path.join(OUT, 'LICENSES.md'), lines.join('\n'));
  }
  log(`done: ${Object.keys(manifest).length - 1} materials, ${distinct.length} asset sets, ${(total / 1048576).toFixed(1)} MB`);
}

main().catch((err) => { console.error(err); process.exit(1); });
