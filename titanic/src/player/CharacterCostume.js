/**
 * CharacterCostume — builds the (few) merged meshes of a stylised 1912 humanoid from a `look`
 * (ARCHITECTURE.md §2). Every body part is ONE mesh with a material array (geometries merged
 * with groups), so a fully dressed character — hat, hair, collar, waistcoat, tails or gown —
 * stays at 10 meshes. All sizes are for a 1.75 m figure; Character.js scales the group.
 *
 * Conventions: the figure faces +z, +x is its left-hand side, pivots sit at the joints.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DEFAULTS = {
  sex: 'm', skin: '#e0b89a',
  hair: { color: '#2c1b12', style: 'short' },
  hat: 'none',
  top: { color: '#141416', kind: 'suit' },
  bottom: { color: '#141416', kind: 'trousers' },
  accent: '#5e1a26', height: 1.75,
};

/** Fill in missing look fields (the contract says any field may be absent). */
export function normaliseLook(look = {}) {
  const l = { ...DEFAULTS, ...look };
  l.hair = { ...DEFAULTS.hair, ...(look.hair || {}) };
  l.top = { ...DEFAULTS.top, ...(look.top || {}) };
  l.bottom = { ...DEFAULTS.bottom, ...(look.bottom || {}) };
  if (!look.bottom && (l.top.kind === 'gown')) l.bottom = { color: l.top.color, kind: 'gown' };
  if (!look.bottom && (l.top.kind === 'dress' || l.top.kind === 'blouse')) l.bottom = { color: l.top.color, kind: 'skirt' };
  if (l.sex === 'f' && !look.bottom && !look.top) l.bottom = { color: l.top.color, kind: 'skirt' };
  if (!(l.height > 1.2 && l.height < 2.3)) l.height = 1.75;
  return l;
}

/** Material set for one look, cloned from the shared library and tinted. */
export function makeWardrobe(materials, look) {
  const col = (hex) => new THREE.Color(hex);
  const mk = (base, hex, name, extra = {}) => {
    let m;
    try { m = materials.clone(base, { color: col(hex), ...extra }); } catch { m = new THREE.MeshStandardMaterial({ color: col(hex), roughness: 0.8 }); }
    if (!m.color) m.color = col(hex); else m.color.set(hex);
    m.name = name;
    return m;
  };
  const dark = (hex, k) => '#' + col(hex).multiplyScalar(k).getHexString();
  return {
    skin: mk('skin', look.skin, 'skin', { roughness: 0.62 }),
    hair: mk('hairDark', look.hair.color, 'hair', { roughness: 0.75 }),
    top: mk('clothBlack', look.top.color, 'cloth_top', { roughness: 0.9 }),
    bottom: mk('clothBlack', look.bottom.color, 'cloth_bottom', { roughness: 0.9 }),
    accent: mk('clothBurgundy', look.accent, 'cloth_accent', { roughness: 0.7 }),
    white: mk('clothWhite', '#f4f1ea', 'cloth_white', { roughness: 0.85 }),
    black: mk('clothBlack', '#101012', 'cloth_black', { roughness: 0.55 }),
    hat: mk('clothBlack', look.hat === 'straw' ? '#d9c38a' : (look.hat === 'bonnet' || look.hat === 'wide') ? look.accent : dark(look.top.color, 0.8), 'hat', { roughness: 0.7 }),
    gold: mk('brass', '#c9a648', 'brass', { metalness: 0.9, roughness: 0.35 }),
    eye: mk('clothBlack', '#1a1410', 'eye', { roughness: 0.3 }),
  };
}

// ------------------------------------------------------------------ geometry helpers

function tf(geom, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geom.scale(sx, sy, sz);
  if (rx) geom.rotateX(rx);
  if (ry) geom.rotateY(ry);
  if (rz) geom.rotateZ(rz);
  if (x || y || z) geom.translate(x, y, z);
  return geom;
}

/** Vertical capsule from y=0 down to y=-length (pivot at the top). */
function limb(radius, length, seg = 6) {
  const g = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 3, seg * 2);
  g.translate(0, -length / 2, 0);
  return g;
}

function sphere(r, { ws = 12, hs = 8, thetaStart = 0, thetaLength = Math.PI } = {}) {
  return new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, thetaStart, thetaLength);
}

function cyl(rTop, rBot, h, seg = 14, open = false) { return new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open); }

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }

function lathe(points, seg = 18) { return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg); }

/** Merge [{ g, m }] parts into one mesh with a material array (materials de-duplicated). */
export function mergeParts(parts, name) {
  const mats = [];
  const geoms = [];
  const matIndexOfGeom = [];   // material slot for each merged part (parallel to `geoms`)
  for (const { g, m } of parts) {
    if (!g) continue;
    let idx = mats.indexOf(m);
    if (idx < 0) { idx = mats.length; mats.push(m); }
    const ng = g.index ? g.toNonIndexed() : g;
    ng.clearGroups();
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    geoms.push(ng);
    matIndexOfGeom.push(idx);
    if (ng !== g) g.dispose();
  }
  // mergeGeometries(…, true) writes one group per input geometry with materialIndex = geometry
  // index, NOT our material slot. Remap, otherwise parts past mats.length have no material:
  // they neither render nor survive a raycast (three reads material[idx].side → TypeError).
  const merged = mergeGeometries(geoms, true);
  for (let i = 0; i < merged.groups.length; i++) merged.groups[i].materialIndex = matIndexOfGeom[i];
  for (const g of geoms) g.dispose();
  merged.computeBoundingSphere();
  const mesh = new THREE.Mesh(merged, mats.length === 1 ? mats[0] : mats);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ------------------------------------------------------------------ parts

const HEAD_R = 0.112;

/** Head mesh: pivot at the base of the neck; head centre at y = 0.17. */
export function buildHead(w, look) {
  const parts = [];
  const cy = 0.17;
  parts.push({ g: tf(cyl(0.045, 0.05, 0.11, 10), { y: 0.03 }), m: w.skin });            // neck
  parts.push({ g: tf(sphere(HEAD_R, { ws: 16, hs: 12 }), { y: cy, sy: 1.08 }), m: w.skin }); // head
  parts.push({ g: tf(sphere(0.022, { ws: 6, hs: 4 }), { x: HEAD_R - 0.004, y: cy, sz: 0.6 }), m: w.skin });  // ears
  parts.push({ g: tf(sphere(0.022, { ws: 6, hs: 4 }), { x: -HEAD_R + 0.004, y: cy, sz: 0.6 }), m: w.skin });
  parts.push({ g: tf(sphere(0.014, { ws: 6, hs: 4 }), { x: 0.04, y: cy + 0.02, z: HEAD_R - 0.012 }), m: w.eye });   // eyes
  parts.push({ g: tf(sphere(0.014, { ws: 6, hs: 4 }), { x: -0.04, y: cy + 0.02, z: HEAD_R - 0.012 }), m: w.eye });
  parts.push({ g: tf(sphere(0.02, { ws: 6, hs: 4 }), { y: cy - 0.015, z: HEAD_R - 0.004, sz: 1.3, sx: 0.8 }), m: w.skin }); // nose
  // hair
  const hs = look.hair.style;
  const hr = HEAD_R + 0.008;
  if (hs !== 'bald') {
    // cap: upper-back part of the head
    parts.push({ g: tf(sphere(hr, { ws: 16, hs: 10, thetaLength: Math.PI * 0.52 }), { y: cy + 0.004, sy: 1.08 }), m: w.hair });
    if (hs === 'bun') parts.push({ g: tf(sphere(0.045, { ws: 10, hs: 8 }), { y: cy + 0.06, z: -HEAD_R - 0.02 }), m: w.hair });
    if (hs === 'long') parts.push({ g: tf(cyl(0.11, 0.09, 0.26, 12), { y: cy - 0.1, z: -0.05, sz: 0.65 }), m: w.hair });
    if (hs === 'moustache') parts.push({ g: tf(box(0.075, 0.016, 0.02), { y: cy - 0.045, z: HEAD_R - 0.006 }), m: w.hair });
  }
  // hat
  const hat = look.hat;
  const top = cy + HEAD_R * 1.08;
  if (hat === 'tophat') {
    parts.push({ g: tf(cyl(0.105, 0.1, 0.17, 18), { y: top + 0.06 }), m: w.hat });
    parts.push({ g: tf(cyl(0.15, 0.15, 0.012, 18), { y: top - 0.02 }), m: w.hat });
    parts.push({ g: tf(cyl(0.106, 0.106, 0.03, 18, true), { y: top + 0.0 }), m: w.accent });
  } else if (hat === 'bowler') {
    parts.push({ g: tf(sphere(0.112, { ws: 16, hs: 8, thetaLength: Math.PI * 0.5 }), { y: top - 0.035, sy: 0.9 }), m: w.hat });
    parts.push({ g: tf(cyl(0.155, 0.155, 0.012, 18), { y: top - 0.035 }), m: w.hat });
  } else if (hat === 'flatcap') {
    parts.push({ g: tf(sphere(0.13, { ws: 16, hs: 8, thetaLength: Math.PI * 0.45 }), { y: top - 0.035, sy: 0.55, sz: 1.1 }), m: w.hat });
    parts.push({ g: tf(box(0.14, 0.012, 0.07), { y: top - 0.03, z: 0.13 }), m: w.hat });
  } else if (hat === 'officer') {
    parts.push({ g: tf(cyl(0.118, 0.118, 0.075, 18), { y: top - 0.005 }), m: w.black });
    parts.push({ g: tf(cyl(0.13, 0.12, 0.035, 18), { y: top + 0.05, sz: 1.08 }), m: w.white });
    parts.push({ g: tf(box(0.14, 0.012, 0.075), { y: top - 0.035, z: 0.135, rx: 0.25 }), m: w.black });
    parts.push({ g: tf(sphere(0.016, { ws: 6, hs: 4 }), { y: top, z: 0.118 }), m: w.gold });
  } else if (hat === 'bonnet') {
    parts.push({ g: tf(sphere(0.135, { ws: 16, hs: 10, thetaLength: Math.PI * 0.6 }), { y: cy + 0.01, z: -0.02, sy: 1.0 }), m: w.hat });
    parts.push({ g: tf(cyl(0.16, 0.16, 0.012, 18), { y: top - 0.015, z: 0.05, rx: 0.35 }), m: w.hat });
    parts.push({ g: tf(cyl(0.137, 0.137, 0.03, 18, true), { y: cy + 0.06 }), m: w.accent });
  } else if (hat === 'wide') {
    parts.push({ g: tf(cyl(0.23, 0.23, 0.01, 22), { y: top - 0.03, rx: 0.12 }), m: w.hat });
    parts.push({ g: tf(cyl(0.11, 0.12, 0.08, 18), { y: top + 0.01 }), m: w.hat });
    parts.push({ g: tf(cyl(0.113, 0.123, 0.025, 18, true), { y: top }), m: w.accent });
  } else if (hat === 'straw') {
    parts.push({ g: tf(cyl(0.18, 0.18, 0.01, 22), { y: top - 0.03 }), m: w.hat });
    parts.push({ g: tf(cyl(0.1, 0.105, 0.075, 18), { y: top + 0.008 }), m: w.hat });
    parts.push({ g: tf(cyl(0.102, 0.107, 0.03, 18, true), { y: top - 0.01 }), m: w.accent });
  }
  return mergeParts(parts, 'head');
}

/** Torso mesh: pivot at the hips (y = 0); shoulders at y ≈ 0.47. */
export function buildTorso(w, look) {
  const f = look.sex === 'f';
  const parts = [];
  const kind = look.top.kind;
  const bkind = look.bottom.kind;
  const torsoMat = w.top;
  // pelvis
  parts.push({ g: tf(cyl(0.165, 0.15, 0.17, 14), { y: 0.06, sz: 0.7, sx: f ? 1.08 : 1 }), m: w.bottom });
  // chest (tapered, elliptical)
  parts.push({ g: tf(cyl(f ? 0.165 : 0.19, f ? 0.135 : 0.15, 0.42, 16), { y: 0.33, sz: 0.66 }), m: torsoMat });
  // shoulders cap
  parts.push({ g: tf(sphere(f ? 0.165 : 0.19, { ws: 16, hs: 8, thetaLength: Math.PI * 0.5 }), { y: 0.535, sy: 0.35, sz: 0.66 }), m: torsoMat });
  // collar / shirt front
  const hasCollar = kind !== 'gown' && kind !== 'dress';
  if (hasCollar) {
    parts.push({ g: tf(cyl(0.062, 0.07, 0.035, 12, true), { y: 0.555 }), m: w.white });
    if (kind === 'tailcoat' || kind === 'suit' || kind === 'jacket' || kind === 'waistcoat') {
      // shirt-front V
      parts.push({ g: tf(box(0.07, 0.17, 0.012), { y: 0.46, z: 0.105 }), m: w.white });
      // tie
      parts.push({ g: tf(box(0.028, 0.12, 0.008), { y: 0.455, z: 0.112 }), m: kind === 'tailcoat' ? w.white : w.accent });
    }
    if (kind === 'uniform') {
      parts.push({ g: tf(box(0.012, 0.3, 0.01), { y: 0.36, z: 0.102 }), m: w.gold });
      for (let i = 0; i < 4; i++) {
        parts.push({ g: tf(sphere(0.012, { ws: 6, hs: 4 }), { x: 0.045, y: 0.2 + i * 0.085, z: 0.1 }), m: w.gold });
        parts.push({ g: tf(sphere(0.012, { ws: 6, hs: 4 }), { x: -0.045, y: 0.2 + i * 0.085, z: 0.1 }), m: w.gold });
      }
    }
  }
  if (kind === 'tailcoat' || kind === 'suit') {
    // waistcoat strip (accent) below the shirt front
    parts.push({ g: tf(box(0.12, 0.17, 0.012), { y: 0.26, z: 0.1 }), m: w.accent });
    for (let i = 0; i < 3; i++) parts.push({ g: tf(sphere(0.011, { ws: 6, hs: 4 }), { y: 0.2 + i * 0.055, z: 0.108 }), m: w.gold });
  }
  if (kind === 'tailcoat') {
    // two tails hanging behind the hips
    parts.push({ g: tf(box(0.09, 0.42, 0.016), { x: 0.06, y: -0.1, z: -0.11, rx: -0.15 }), m: w.top });
    parts.push({ g: tf(box(0.09, 0.42, 0.016), { x: -0.06, y: -0.1, z: -0.11, rx: -0.15 }), m: w.top });
  } else if (kind === 'jacket' || kind === 'suit' || kind === 'uniform') {
    // jacket skirt around the hips
    parts.push({ g: tf(cyl(0.17, 0.19, 0.16, 16, true), { y: -0.02, sz: 0.72 }), m: w.top });
  }
  if (kind === 'blouse' || f) {
    // bust suggestion
    parts.push({ g: tf(sphere(0.07, { ws: 10, hs: 6 }), { x: 0.055, y: 0.4, z: 0.07, sz: 0.7 }), m: torsoMat });
    parts.push({ g: tf(sphere(0.07, { ws: 10, hs: 6 }), { x: -0.055, y: 0.4, z: 0.07, sz: 0.7 }), m: torsoMat });
  }
  if (bkind === 'gown' || kind === 'gown') {
    // floor-length gown: a lathe from the waist flaring to the hem
    parts.push({ g: lathe([[0.15, 0.12], [0.17, 0.0], [0.21, -0.25], [0.3, -0.6], [0.4, -0.9], [0.44, -0.93], [0.0, -0.93]], 20), m: w.bottom });
    parts.push({ g: tf(cyl(0.17, 0.17, 0.05, 16, true), { y: 0.11 }), m: w.accent }); // sash
  } else if (bkind === 'skirt') {
    parts.push({ g: lathe([[0.15, 0.12], [0.17, 0.0], [0.2, -0.3], [0.27, -0.7], [0.3, -0.82], [0.0, -0.82]], 18), m: w.bottom });
    parts.push({ g: tf(cyl(0.165, 0.165, 0.04, 16, true), { y: 0.1 }), m: w.accent });
  }
  return mergeParts(parts, 'torso');
}

/** Upper arm: pivot at the shoulder, hangs down 0.30 m. */
export function buildUpperArm(w, look) {
  const kind = look.top.kind;
  const sleeve = kind === 'waistcoat' ? w.white : (kind === 'gown' && look.sex === 'f' ? w.skin : w.top);
  const parts = [{ g: limb(0.052, 0.30), m: sleeve }];
  if (kind === 'gown') parts.push({ g: tf(sphere(0.07, { ws: 10, hs: 6 }), { y: -0.02, sy: 0.8 }), m: w.top }); // puff sleeve
  if (kind === 'uniform') parts.push({ g: tf(cyl(0.056, 0.056, 0.02, 10, true), { y: -0.27 }), m: w.gold });
  return mergeParts(parts, 'upperArm');
}

/** Lower arm + hand: pivot at the elbow, 0.27 m to the wrist. */
export function buildLowerArm(w, look) {
  const kind = look.top.kind;
  const sleeve = kind === 'waistcoat' ? w.white : (kind === 'gown' && look.sex === 'f' ? w.skin : w.top);
  const parts = [
    { g: limb(0.045, 0.27), m: sleeve },
    { g: tf(cyl(0.048, 0.05, 0.03, 10, true), { y: -0.255 }), m: kind === 'gown' ? w.accent : w.white }, // cuff
    { g: tf(sphere(0.046, { ws: 8, hs: 6 }), { y: -0.3, sy: 1.25, sz: 0.65 }), m: w.skin },                // hand
  ];
  return mergeParts(parts, 'lowerArm');
}

/** Upper leg: pivot at the hip, 0.45 m to the knee. */
export function buildUpperLeg(w, look) {
  const legMat = look.bottom.kind === 'trousers' ? w.bottom : (look.sex === 'f' ? w.white : w.bottom);
  return mergeParts([{ g: limb(0.078, 0.45), m: legMat }], 'upperLeg');
}

/** Lower leg + shoe: pivot at the knee, 0.50 m to the ground (hips 0.95 = 0.45 thigh + 0.50 shin). */
export function buildLowerLeg(w, look) {
  const trousers = look.bottom.kind === 'trousers';
  const legMat = trousers ? w.bottom : (look.sex === 'f' ? w.white : w.black);
  const parts = [
    { g: limb(0.062, 0.47), m: legMat },
    { g: tf(box(0.095, 0.065, 0.25), { y: -0.4675, z: 0.055 }), m: w.black },  // shoe (ground at y = -0.50)
  ];
  if (!trousers && look.sex === 'm') parts.push({ g: tf(cyl(0.07, 0.07, 0.03, 10, true), { y: -0.02 }), m: w.bottom }); // breeches cuff
  return mergeParts(parts, 'lowerLeg');
}

/** A violin + bow for the 'play' pose (one mesh). */
export function buildViolin(w) {
  const body = lathe([[0.0, 0], [0.09, 0], [0.105, 0.04], [0.09, 0.08], [0.065, 0.14], [0.08, 0.18], [0.095, 0.25], [0.085, 0.33], [0.0, 0.33]], 14);
  body.rotateX(Math.PI / 2); // lies in the xz plane, long axis along z
  body.scale(1, 0.25, 1);
  const parts = [
    { g: body, m: w.gold },
    { g: tf(box(0.022, 0.02, 0.32), { y: 0.01, z: 0.42 }), m: w.black },      // neck/fingerboard
    { g: tf(box(0.012, 0.012, 0.55), { x: 0.1, y: 0.05, z: 0.15, ry: 0.0 }), m: w.hair }, // bow
  ];
  const mesh = mergeParts(parts, 'violin');
  return mesh;
}
