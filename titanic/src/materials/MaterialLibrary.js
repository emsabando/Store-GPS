/**
 * MaterialLibrary — the shared PBR palette of the ship (ARCHITECTURE.md §4).
 *
 *   const materials = await MaterialLibrary.load({ quality, onProgress });
 *   const teak = materials.get('teakDeck');          // shared MeshStandard/PhysicalMaterial
 *   materials.setRepeat(materials.clone('teakDeck'), 40, 8); // tile a 40 m × 8 m surface (UV 0..1)
 *
 * Texture sources, in order: (1) `public/textures/manifest.json` written by scripts/fetch-textures.mjs
 * (CC0 photoscans, WebP); (2) the canvas generators in ProceduralTextures.js for every name without a
 * vendored set, or if the manifest is missing/unreachable; (3) a flat colour. Colour maps are sRGB,
 * data maps are NoColorSpace. One UV unit of a material covers `material.userData.sizeM` metres.
 *
 * Adding a texture: add a CATALOG row in scripts/fetch-textures.mjs, run `npm run fetch-textures`,
 * then (optionally) add a DEFS row here to tune roughness/metalness/clearcoat; names without a DEFS
 * row still work (defaults + manifest/flat colour). Names in `SHIP.materials` (if that object exists)
 * are merged too: `{ name: '#hex' | { color, roughness, metalness, texture?: existingName } }`.
 */
import * as THREE from 'three';
import * as P from './ProceduralTextures.js';
import { makeSwatchGrid } from './SwatchGrid.js';
import { SHIP } from '../data/shipSpec.js';

export const MATERIAL_NAMES = [
  'teakDeck', 'pineDeck', 'oakPanel', 'oakDark', 'mahogany', 'walnut', 'sycamore', 'whiteEnamel', 'whitePaintedSteel',
  'hullBlack', 'hullBlackRiveted', 'antifouling', 'boottop', 'sheerStripe', 'funnelBuff', 'funnelBlack', 'brass', 'bronze',
  'wroughtIron', 'ironDark', 'steelGrey', 'steelRusty', 'linoDining', 'linoCorridor', 'carpetRed', 'carpetBlue', 'carpetGreen',
  'roseCarpet', 'moorishTile', 'marbleWhite', 'plasterWhite', 'plasterCream', 'canvas', 'canvasCover', 'glass', 'glassFrosted',
  'glassStained', 'lifeboatWhite', 'rope', 'velvetGreen', 'velvetRed', 'leatherDark', 'leatherGreen', 'wicker', 'coal', 'boilerIron',
  'copper', 'gold', 'ice', 'snow', 'woodCrate', 'carRed', 'skin', 'hairDark', 'hairLight', 'clothBlack', 'clothWhite', 'clothNavy',
  'clothGrey', 'clothBrown', 'clothCream', 'clothBurgundy', 'clothBlue', 'clothGreen',
];

const ANISO = { low: 2, medium: 4, high: 8, ultra: 16 };

/** Base colour of every name (used by the procedural fallbacks and as the tint target). */
export const PALETTE = {
  teakDeck: '#8b6a3e', pineDeck: '#c2a36b', oakPanel: '#7a5a34', oakDark: '#4b3620', mahogany: '#4e2416', walnut: '#5b3a23', sycamore: '#c9b48c',
  whiteEnamel: '#f2efe6', whitePaintedSteel: '#e9e6dc', hullBlack: '#111214', hullBlackRiveted: '#111214', antifouling: '#7a2a1e', boottop: '#2a1a16', sheerStripe: '#d4b25a',
  funnelBuff: '#c9a66b', funnelBlack: '#101010', brass: '#b08d57', bronze: '#8c6b3d', wroughtIron: '#2b2b2e', ironDark: '#26272a', steelGrey: '#6f7378', steelRusty: '#6b4a3a',
  linoDining: '#d9cfae', linoCorridor: '#9c3b36', carpetRed: '#8b1e2b', carpetBlue: '#1f2f5a', carpetGreen: '#2f5a3a', roseCarpet: '#b86b7a', moorishTile: '#2a7a7a', marbleWhite: '#e8e4dc',
  plasterWhite: '#f4f1ea', plasterCream: '#efe6cf', canvas: '#d8cfb8', canvasCover: '#5f635a', glass: '#ffffff', glassFrosted: '#f4f6f8', glassStained: '#c47a3a', lifeboatWhite: '#f1eee5', rope: '#b59a6a',
  velvetGreen: '#1f4d33', velvetRed: '#7a1f2a', leatherDark: '#3a2418', leatherGreen: '#2c4a36', wicker: '#c7a66a', coal: '#151515', boilerIron: '#3a3a3c', copper: '#b87333', gold: '#d4af37', ice: '#cfe8f3', snow: '#f5fbff',
  woodCrate: '#a07c4c', carRed: '#8e1b1b', skin: '#e0b89a', hairDark: '#2c1b12', hairLight: '#c8a165', clothBlack: '#141416', clothWhite: '#f3f0ea', clothNavy: '#182540', clothGrey: '#6e6e70', clothBrown: '#5a3d2a', clothCream: '#e9dcc2', clothBurgundy: '#5e1a26', clothBlue: '#2a4b7c', clothGreen: '#2e5a3c',
};

/**
 * Per-name tuning. Fields: physical (MeshPhysicalMaterial), roughness, metalness, normalScale, props
 * (extra material properties), colourMap:false (ignore the vendored colour map; use `color` — for
 * saturated metal scans that cannot be re-tinted), tint:false (no auto tint), fallback() → procedural
 * pack, extraNormal() → procedural pack whose normal/ao replace the vendored ones (hull rivets).
 */
const wood = (hex, roughness = 0.5, polished = false) => ({ roughness, physical: polished, props: polished ? { clearcoat: 0.3, clearcoatRoughness: 0.35 } : {}, normalScale: 0.7, fallback: (s) => P.makePanel({ color: hex, mouldings: false, size: s }) });
const metal = (roughness, hex, brushed = true) => ({ metalness: 1, roughness, colourMap: false, normalScale: 0.35, fallback: (s) => (brushed ? P.makeBrushedMetal({ color: '#ffffff', roughness, size: s }) : P.makeFlat({ color: '#ffffff', roughness, size: s })) });
const paint = (hex, roughness = 0.45, wear = 0.15) => ({ roughness, metalness: 0.05, normalScale: 0.5, fallback: (s) => P.makePaint({ color: hex, wear, roughness, size: s }) });
const cloth = (hex) => ({ roughness: 0.92, normalScale: 0.5, fallback: (s) => P.makeCanvas({ color: hex, threadsPerMetre: 1400, sizeMetres: 0.3, size: Math.min(512, s) }) });
const carpet = (hex, pattern, accent) => ({ roughness: 1, physical: true, props: { sheen: 0.35, sheenRoughness: 0.9, sheenColor: new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.4) }, normalScale: 0.6, fallback: (s) => P.makeCarpet({ color: hex, pattern, accent, size: s }) });
const glassLike = (props) => ({ physical: true, roughness: 0.05, metalness: 0, tint: false, props: { transmission: 0.9, ior: 1.5, thickness: 0.01, transparent: true, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1, ...props }, noMaps: true });

const DEFS = {
  teakDeck: { roughness: 0.68, normalScale: 0.8, fallback: (s) => P.makePlanks({ widthM: 1.2, lengthM: 2.4, plankW: 0.15, plankL: 2.4, color: PALETTE.teakDeck, gapColor: '#1a1510', size: s }) },
  pineDeck: { roughness: 0.78, normalScale: 0.7, fallback: (s) => P.makePlanks({ widthM: 1.2, lengthM: 2.4, plankW: 0.12, plankL: 2.4, color: PALETTE.pineDeck, gapColor: '#4a3b28', variation: 0.3, size: s }) },
  oakPanel: { roughness: 0.42, physical: true, props: { clearcoat: 0.25, clearcoatRoughness: 0.4 }, normalScale: 0.7, fallback: (s) => P.makePanel({ wood: 'oak', color: PALETTE.oakPanel, mouldings: true, size: s }) },
  oakDark: wood(PALETTE.oakDark, 0.45, true), mahogany: wood(PALETTE.mahogany, 0.35, true), walnut: wood(PALETTE.walnut, 0.4, true), sycamore: wood(PALETTE.sycamore, 0.5),
  whiteEnamel: { roughness: 0.28, physical: true, props: { clearcoat: 0.5, clearcoatRoughness: 0.2 }, normalScale: 0.4, fallback: (s) => P.makePaint({ color: PALETTE.whiteEnamel, wear: 0.05, roughness: 0.28, size: s }) },
  whitePaintedSteel: paint(PALETTE.whitePaintedSteel, 0.45, 0.2),
  hullBlack: { ...paint(PALETTE.hullBlack, 0.45, 0.1), metalness: 0.15, fallback: (s) => P.makeRivetedPlates({ color: PALETTE.hullBlack, seam: 0, size: s }) },
  hullBlackRiveted: { ...paint(PALETTE.hullBlack, 0.45, 0.1), metalness: 0.15, normalScale: 1, extraNormal: (s) => P.makeRivetedPlates({ plateW: 2, plateH: 1, rivetPitch: 0.09, color: PALETTE.hullBlack, size: s }), fallback: (s) => P.makeRivetedPlates({ plateW: 2, plateH: 1, rivetPitch: 0.09, color: PALETTE.hullBlack, size: s }) },
  antifouling: paint(PALETTE.antifouling, 0.65, 0.3), boottop: paint(PALETTE.boottop, 0.55, 0.2),
  sheerStripe: { ...metal(0.3, PALETTE.sheerStripe), metalness: 0.9 },
  funnelBuff: { ...paint(PALETTE.funnelBuff, 0.55, 0.1), colour: '#C08A52' }, funnelBlack: paint(PALETTE.funnelBlack, 0.5, 0.15),
  brass: metal(0.3, PALETTE.brass), bronze: metal(0.42, PALETTE.bronze), copper: metal(0.32, PALETTE.copper), gold: metal(0.22, PALETTE.gold),
  wroughtIron: { ...metal(0.55, PALETTE.wroughtIron, false), metalness: 0.85, colourMap: true }, ironDark: { ...metal(0.6, PALETTE.ironDark, false), metalness: 0.8, colourMap: true },
  steelGrey: { ...metal(0.38, PALETTE.steelGrey), colourMap: true }, steelRusty: { roughness: 0.8, metalness: 0.35, normalScale: 0.8, fallback: (s) => P.makeRivetedPlates({ color: PALETTE.steelRusty, rust: 0.8, size: s }) },
  boilerIron: { roughness: 0.62, metalness: 0.6, normalScale: 0.8, fallback: (s) => P.makeRivetedPlates({ plateW: 1.2, plateH: 0.6, color: PALETTE.boilerIron, rust: 0.25, size: s }) },
  linoDining: { roughness: 0.35, normalScale: 0.5, fallback: (s) => P.makeTiles({ tileW: 0.45, pattern: 'dining', colours: ['#dccfa8', '#2b4a7a', '#8f2b2b'], grout: '#b9ad8c', groutW: 0.002, gloss: 0.3, size: s }) },
  linoCorridor: { roughness: 0.4, normalScale: 0.4, fallback: (s) => P.makeTiles({ tileW: 0.3, pattern: 'checker', colours: ['#9c3b36', '#b8aa86'], grout: '#6d5a4a', groutW: 0.002, gloss: 0.35, size: s }) },
  carpetRed: carpet(PALETTE.carpetRed, 'floral', '#c9a66b'), carpetBlue: carpet(PALETTE.carpetBlue, 'floral', '#b9a46a'), carpetGreen: carpet(PALETTE.carpetGreen, 'border', '#c9a66b'), roseCarpet: carpet(PALETTE.roseCarpet, 'floral', '#f0d8c8'),
  moorishTile: { roughness: 0.22, physical: true, props: { clearcoat: 0.45, clearcoatRoughness: 0.25 }, normalScale: 0.6, fallback: (s) => P.makeTiles({ tileW: 0.3, pattern: 'moorish', colours: ['#e8dcc0', '#1f5f6e', '#b0442c'], grout: '#8a8578', size: s }) },
  marbleWhite: { roughness: 0.14, physical: true, props: { clearcoat: 0.3, clearcoatRoughness: 0.1 }, normalScale: 0.3, fallback: (s) => P.makeFlat({ color: PALETTE.marbleWhite, roughness: 0.14, mottle: 0.1, size: s }) },
  plasterWhite: { roughness: 0.92, normalScale: 0.6, fallback: (s) => P.makePaint({ color: PALETTE.plasterWhite, wear: 0.05, roughness: 0.92, size: s }) },
  plasterCream: { roughness: 0.9, normalScale: 0.6, fallback: (s) => P.makePaint({ color: PALETTE.plasterCream, wear: 0.05, roughness: 0.9, size: s }) },
  canvas: { roughness: 0.9, normalScale: 0.7, colour: '#d2c4a0', fallback: (s) => P.makeCanvas({ color: PALETTE.canvas, size: s }) },
  canvasCover: { roughness: 0.9, normalScale: 0.7, props: { side: THREE.DoubleSide }, colour: '#767a6e', fallback: (s) => P.makeCanvas({ color: PALETTE.canvasCover, size: s }) },
  glass: glassLike({}),
  glassFrosted: { ...glassLike({ transmission: 0.6, thickness: 0.02, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0.5 }), roughness: 0.5 },
  glassStained: { ...glassLike({ transmission: 0.45, thickness: 0.02, emissive: new THREE.Color('#ffb060'), emissiveIntensity: 0.15 }), roughness: 0.25, noMaps: false, tint: false, fallback: (s) => P.makeTiles({ tileW: 0.06, pattern: 'mosaic', colours: ['#d9a441', '#b03a2e', '#2d6b4a', '#2f4f8a', '#e8d9b0', '#8a3d7a'], grout: '#1a1a1a', groutW: 0.004, gloss: 0.1, size: Math.min(512, s) }) },
  lifeboatWhite: paint(PALETTE.lifeboatWhite, 0.5, 0.2),
  rope: { roughness: 0.9, normalScale: 0.9, fallback: (s) => P.makeCanvas({ color: PALETTE.rope, threadsPerMetre: 60, sizeMetres: 0.25, size: Math.min(512, s) }) },
  velvetRed: { roughness: 0.85, physical: true, props: { sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#d25a6a') }, normalScale: 0.4, fallback: (s) => P.makeCanvas({ color: PALETTE.velvetRed, threadsPerMetre: 2000, sizeMetres: 0.3, size: Math.min(512, s) }) },
  velvetGreen: { roughness: 0.85, physical: true, props: { sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#6fa37c') }, normalScale: 0.4, fallback: (s) => P.makeCanvas({ color: PALETTE.velvetGreen, threadsPerMetre: 2000, sizeMetres: 0.3, size: Math.min(512, s) }) },
  leatherDark: { roughness: 0.48, physical: true, props: { clearcoat: 0.15, clearcoatRoughness: 0.5 }, normalScale: 0.6, fallback: (s) => P.makeFlat({ color: PALETTE.leatherDark, roughness: 0.48, mottle: 0.15, size: s }) },
  leatherGreen: { roughness: 0.48, physical: true, props: { clearcoat: 0.15, clearcoatRoughness: 0.5 }, normalScale: 0.6, fallback: (s) => P.makeFlat({ color: PALETTE.leatherGreen, roughness: 0.48, mottle: 0.15, size: s }) },
  wicker: { roughness: 0.8, normalScale: 0.9, props: { side: THREE.DoubleSide }, fallback: (s) => P.makeCanvas({ color: PALETTE.wicker, threadsPerMetre: 120, sizeMetres: 0.5, size: s }) },
  coal: { roughness: 0.5, metalness: 0.05, normalScale: 1, fallback: (s) => P.makeFlat({ color: PALETTE.coal, roughness: 0.5, mottle: 0.5, size: s }) },
  ice: { physical: true, roughness: 0.35, tint: false, props: { transmission: 0.25, thickness: 2, ior: 1.31, attenuationColor: new THREE.Color('#9fd0e8'), attenuationDistance: 3, clearcoat: 0.6, clearcoatRoughness: 0.3 }, normalScale: 0.8, fallback: (s) => P.makeFlat({ color: PALETTE.ice, roughness: 0.35, mottle: 0.1, size: s }) },
  snow: { roughness: 0.92, normalScale: 0.8, fallback: (s) => P.makeFlat({ color: PALETTE.snow, roughness: 0.92, mottle: 0.05, size: s }) },
  woodCrate: { roughness: 0.82, normalScale: 0.9, fallback: (s) => P.makePlanks({ widthM: 1, lengthM: 1, plankW: 0.12, plankL: 1, color: PALETTE.woodCrate, gapColor: '#3a2a18', grain: 0.9, variation: 0.7, size: s }) },
  carRed: { physical: true, roughness: 0.25, metalness: 0.15, props: { clearcoat: 1, clearcoatRoughness: 0.05 }, noMaps: true },
  skin: { physical: true, roughness: 0.55, props: { sheen: 0.25, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffd0b0') }, noMaps: true },
  hairDark: { roughness: 0.55, noMaps: true }, hairLight: { roughness: 0.55, noMaps: true },
  clothBlack: cloth(PALETTE.clothBlack), clothWhite: cloth(PALETTE.clothWhite), clothNavy: cloth(PALETTE.clothNavy), clothGrey: cloth(PALETTE.clothGrey), clothBrown: cloth(PALETTE.clothBrown),
  clothCream: cloth(PALETTE.clothCream), clothBurgundy: cloth(PALETTE.clothBurgundy), clothBlue: cloth(PALETTE.clothBlue), clothGreen: cloth(PALETTE.clothGreen),
};

const textureBase = () => {
  let base = './';
  try { if (import.meta.env && import.meta.env.BASE_URL) base = import.meta.env.BASE_URL; } catch (_) { /* plain ESM without Vite */ }
  if (!base.endsWith('/')) base += '/';
  return base + 'textures/';
};

/** Average linear colour of a loaded image (16×16 downsample) → THREE.Color. */
function averageColour(image) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
  } catch (_) { return null; }
}

/** Strength of the warm interior environment (see setInteriorEnv). */
const INTERIOR_ENV_INTENSITY = 0.55;

/** Materials used mostly indoors: they get a warm, lamp-coloured environment map instead of the sky. */
export const INTERIOR_NAMES = new Set(['oakPanel', 'oakDark', 'mahogany', 'walnut', 'sycamore', 'whiteEnamel', 'plasterWhite', 'plasterCream', 'linoDining', 'linoCorridor', 'linoLanding',
  'carpetRed', 'carpetBlue', 'carpetGreen', 'roseCarpet', 'moorishTile', 'marbleWhite', 'velvetGreen', 'velvetRed', 'leatherDark', 'leatherGreen', 'wicker', 'steelGrey', 'steelRusty', 'boilerIron', 'coal', 'woodCrate', 'clothCream', 'clothWhite']);

export class MaterialLibrary {
  constructor(quality = 'high') {
    this.quality = quality;
    this.anisotropy = ANISO[quality] || 8;
    this.manifest = null;          // parsed manifest.json or null
    this.base = textureBase();
    this._cache = new Map();       // name → material
    this._packs = new Map();       // name → { map, normalMap, roughnessMap, aoMap, sizeM, source }
    this._vendored = new Map();    // file path → THREE.Texture (shared between names)
    this._warned = new Set();
    this.extraDefs = {};           // merged from SHIP.materials
    this._mergeShipMaterials();
    P.setProceduralQuality(quality);
  }

  /** Loads manifest.json (if present) and preloads every vendored map with progress. Never throws. */
  static async load({ quality = 'high', onProgress = () => {} } = {}) {
    const lib = new MaterialLibrary(quality);
    onProgress(2, 'Reading the texture manifest');
    try {
      const r = await fetch(lib.base + 'manifest.json', { cache: 'force-cache' });
      if (r.ok) lib.manifest = await r.json();
      else console.info('[materials] no manifest.json — using procedural textures');
    } catch (err) { console.info('[materials] manifest unavailable, using procedural textures:', err && err.message); }
    if (lib.manifest) {
      const files = new Set();
      for (const [name, entry] of Object.entries(lib.manifest)) {
        if (name.startsWith('_') || !entry) continue;
        const def = lib._def(name);
        for (const k of ['color', 'normal', 'roughness', 'ao']) if (entry[k] && !(k === 'color' && def.colourMap === false)) files.add(entry[k]);
      }
      const list = [...files]; let done = 0;
      const loader = new THREE.TextureLoader();
      const loadOne = async (file) => {
        try {
          const tex = await loader.loadAsync(lib.base + file);
          lib._prepTexture(tex, file.endsWith('color.webp'));
          lib._vendored.set(file, tex);
        } catch (err) { console.warn('[materials] failed to load', file, err && err.message); lib._vendored.set(file, null); }
        done++; onProgress(5 + (done / list.length) * 95, `Loading textures ${done}/${list.length}`);
      };
      const workers = []; let i = 0;
      for (let w = 0; w < 6; w++) workers.push((async () => { while (i < list.length) await loadOne(list[i++]); })());
      await Promise.all(workers);
    }
    onProgress(100, 'Palette ready');
    return lib;
  }

  _mergeShipMaterials() {
    const sm = SHIP && SHIP.materials;
    if (!sm || typeof sm !== 'object') return;
    for (const [name, v] of Object.entries(sm)) {
      if (typeof v === 'string') this.extraDefs[name] = { color: v };
      else if (v && typeof v === 'object') this.extraDefs[name] = { color: v.color || v.colour || v.hex, roughness: v.roughness, metalness: v.metalness, texture: v.texture || v.base, physical: !!v.physical, props: v.props || {} };
    }
  }

  get names() { return [...new Set([...MATERIAL_NAMES, ...Object.keys(this.extraDefs), ...(this.manifest ? Object.keys(this.manifest).filter((k) => !k.startsWith('_')) : [])])]; }

  _def(name) {
    const d = DEFS[name] || {};
    const extra = this.extraDefs[name];
    if (!extra) return d;
    const base = extra.texture && DEFS[extra.texture] ? DEFS[extra.texture] : {};
    return { ...base, ...d, roughness: extra.roughness ?? d.roughness ?? base.roughness, metalness: extra.metalness ?? d.metalness ?? base.metalness, physical: extra.physical || d.physical || base.physical, props: { ...(base.props || {}), ...(d.props || {}), ...(extra.props || {}) }, colour: extra.color || PALETTE[name] || PALETTE[extra.texture], manifestName: extra.texture || name };
  }

  _prepTexture(tex, srgb) {
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = this.anisotropy;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.needsUpdate = true;
  }

  /** The texture pack for a name: `{ map, normalMap, roughnessMap, aoMap, sizeM, source:'vendored'|'procedural'|null }`. */
  texturesFor(name) {
    if (this._packs.has(name)) return this._packs.get(name);
    const def = this._def(name);
    let pack = null;
    const mName = def.manifestName || name;
    const entry = this.manifest && this.manifest[mName];
    if (!def.noMaps && entry && this._vendored.get(entry.normal)) {
      pack = {
        map: def.colourMap === false ? null : this._vendored.get(entry.color) || null,
        normalMap: this._vendored.get(entry.normal) || null,
        roughnessMap: this._vendored.get(entry.roughness) || null,
        aoMap: entry.ao ? this._vendored.get(entry.ao) || null : null,
        sizeM: entry.sizeM || [1, 1], tint: entry.tint || null, source: 'vendored',
      };
      if (def.extraNormal) {
        const extra = def.extraNormal(this._size());
        pack.normalMap = extra.normalMap; pack.aoMap = extra.aoMap; pack.sizeM = extra.sizeM; pack.extra = extra;
      }
    } else if (!def.noMaps && def.fallback) {
      const p = def.fallback(this._size());
      pack = { ...p, source: 'procedural' };
    } else if (!def.noMaps && def.colour) {
      pack = { ...P.makeFlat({ color: def.colour, roughness: def.roughness ?? 0.6, size: Math.min(512, this._size()) }), source: 'procedural' };
    }
    this._packs.set(name, pack);
    return pack;
  }

  _size() { return this.quality === 'low' ? 512 : 1024; }

  /** Shared material for a name (created lazily, cached). Unknown names get a neutral grey material. */
  get(name) {
    if (this._cache.has(name)) return this._cache.get(name);
    const def = this._def(name);
    const known = MATERIAL_NAMES.includes(name) || this.extraDefs[name] || (this.manifest && this.manifest[name]);
    if (!known && !this._warned.has(name)) { this._warned.add(name); console.warn(`[materials] unknown material '${name}', using neutral grey`); }
    const pack = known ? this.texturesFor(name) : null;
    const Ctor = def.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const mat = new Ctor({ color: new THREE.Color(known ? '#ffffff' : '#9a9a9a'), roughness: def.roughness ?? 0.6, metalness: def.metalness ?? 0 });
    mat.name = name;
    const target = def.colour || PALETTE[name] || null;
    if (pack) {
      if (pack.map) {
        mat.map = pack.map;
        // Tint: multiply so the map's average lands on the palette colour (manifest tint or PALETTE).
        // A colour given in the material definition is the design intent and beats the manifest tint.
        const tintHex = def.colour || pack.tint || (pack.source === 'vendored' && def.tint !== false ? target : null);
        if (tintHex && pack.map.image) {
          const avg = averageColour(pack.map.image), want = new THREE.Color(tintHex);
          if (avg) mat.color.setRGB(THREE.MathUtils.clamp(want.r / Math.max(avg.r, 0.02), 0.02, 4), THREE.MathUtils.clamp(want.g / Math.max(avg.g, 0.02), 0.02, 4), THREE.MathUtils.clamp(want.b / Math.max(avg.b, 0.02), 0.02, 4));
        }
      } else if (target) mat.color.set(target);
      if (pack.normalMap) { mat.normalMap = pack.normalMap; mat.normalScale.setScalar(def.normalScale ?? 0.6); }
      if (pack.roughnessMap) mat.roughnessMap = pack.roughnessMap;
      if (pack.aoMap) { mat.aoMap = pack.aoMap; mat.aoMapIntensity = 0.8; }
      if (pack.transparent) { mat.transparent = true; mat.alphaTest = 0.4; }
      mat.userData.sizeM = pack.sizeM || [1, 1];
      mat.userData.textureSource = pack.source;
    } else {
      if (target) mat.color.set(target);
      mat.userData.sizeM = [1, 1];
      mat.userData.textureSource = null;
    }
    if (def.props) for (const [k, v] of Object.entries(def.props)) { if (v && v.isColor && mat[k] && mat[k].isColor) mat[k].copy(v); else mat[k] = v; }
    // three multiplies the scalar roughness by the map; scale it so the map's mean lands on the tuned value.
    if (mat.roughnessMap && pack && pack.source === 'vendored' && mat.roughnessMap.image) {
      const avg = averageColour(mat.roughnessMap.image);
      const mean = avg ? Math.max(0.05, new THREE.Color().copySRGBToLinear(avg).g) : 0.5; // NoColorSpace map: undo the sRGB decode of averageColour
      mat.roughness = THREE.MathUtils.clamp((def.roughness ?? 0.6) / mean, 0.05, 3);
    }
    mat.userData.materialName = name;
    if (INTERIOR_NAMES.has(name)) {
      mat.envMapIntensity = 0.3;
      if (this.interiorEnv) { mat.envMap = this.interiorEnv; mat.envMapIntensity = INTERIOR_ENV_INTENSITY; }
      (this.interiorMaterials ||= []).push(mat);
    }
    this._cache.set(name, mat);
    return mat;
  }

  /**
   * Give every interior material (INTERIOR_NAMES, existing and future) its own environment map —
   * a warm, lamp-coloured PMREM — so panelling and plaster are not tinted sky-blue indoors.
   */
  setInteriorEnv(texture) {
    this.interiorEnv = texture || null;
    for (const mat of this.interiorMaterials || []) {
      mat.envMap = this.interiorEnv;
      mat.envMapIntensity = this.interiorEnv ? INTERIOR_ENV_INTENSITY : 0.3;
      mat.needsUpdate = true;
    }
  }

  /** A private copy of a material (textures are shared) with property overrides applied. */
  clone(name, overrides = {}) {
    const m = this.get(name).clone();
    m.userData = { ...this.get(name).userData, cloned: true };
    for (const [k, v] of Object.entries(overrides)) { if (v && v.isColor && m[k] && m[k].isColor) m[k].copy(v); else if (typeof v === 'string' && m[k] && m[k].isColor) m[k].set(v); else m[k] = v; }
    return m;
  }

  /**
   * Make UV 0..1 of `material` span `metresU` × `metresV` metres: clones its maps with the right repeat.
   * Use on a `clone()`d material (or accept that every mesh sharing it gets the repeat).
   */
  setRepeat(material, metresU, metresV = metresU) {
    const sizeM = (material.userData && material.userData.sizeM) || [1, 1];
    const ru = metresU / sizeM[0], rv = metresV / sizeM[1];
    for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'metalnessMap', 'emissiveMap']) {
      const t = material[k];
      if (!t) continue;
      if (!t.userData.repeatClone) { const c = t.clone(); c.userData.repeatClone = true; c.needsUpdate = true; material[k] = c; }
      material[k].repeat.set(ru, rv);
    }
    material.needsUpdate = true;
    return material;
  }

  /** Texture tiles per metre for a name, `{ u, v }` — for builders that scale geometry UVs instead. */
  tilesPerMetre(name) { const s = this.get(name).userData.sizeM || [1, 1]; return { u: 1 / s[0], v: 1 / s[1] }; }

  /** Re-apply the anisotropy preset to every texture (textures are regenerated only on reload). */
  setQuality(q) {
    this.quality = q;
    this.anisotropy = ANISO[q] || 8;
    P.setProceduralQuality(q);
    const seen = new Set();
    const apply = (t) => { if (t && !seen.has(t)) { seen.add(t); t.anisotropy = this.anisotropy; t.needsUpdate = true; } };
    for (const t of this._vendored.values()) apply(t);
    for (const m of this._cache.values()) for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) apply(m[k]);
  }

  /** Debug: a Group of labelled swatches (sphere + flat tile) for every material; add it to a scene. */
  makeSwatchGrid(options = {}) { return makeSwatchGrid(this, options); }

  dispose() {
    for (const m of this._cache.values()) m.dispose();
    for (const t of this._vendored.values()) if (t) t.dispose();
    this._cache.clear(); this._vendored.clear(); this._packs.clear();
    P.clearProceduralCache();
  }
}
