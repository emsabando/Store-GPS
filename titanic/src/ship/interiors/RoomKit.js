/**
 * Shared helpers for the interior builders: room shells (floor overlay, panelled walls with door openings,
 * ceiling, lamp grids), furniture layout, and `bakeGroup` which merges a room's static meshes by material so
 * a furnished saloon costs a handful of draw calls instead of thousands.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLamp, makePlaque, box } from '../Props.js';

export const DECK_ORDER = ['boat', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'orlop', 'tankTop'];

/** Resolve a room by id across decks: returns { ...room, deck, y }. */
export function findRoom(spec, id) {
  for (const d of spec.decks || []) for (const r of d.rooms || []) if (r.id === id) return { ...r, deck: d.id, y: d.y, deckHeight: d.heightToNext };
  return null;
}

/** Tiled clone of a library material so textures repeat per metre on large surfaces. */
export function tiled(m, name, metresPerTileU = 1, metresPerTileV = metresPerTileU, overrides = {}) {
  const mat = m.clone(name, overrides);
  const sizeM = (m.get(name).userData && m.get(name).userData.sizeM) || [1, 1];
  // geometry UVs are in metres: make one texture tile span `metresPerTile` metres
  if (typeof m.setRepeat === 'function') m.setRepeat(mat, sizeM[0] / metresPerTileU, sizeM[1] / metresPerTileV);
  return mat;
}

/**
 * Straight wall from (x0,z0) to (x1,z1), base y, height h, with door gaps at fractions along the run.
 * Adds a dado rail and cornice when `panelled`. Returns a Group of collidable boxes.
 */
export function wall(m, x0, z0, x1, z1, y, h, { gaps = [], material = 'whiteEnamel', trim = 'oakDark', panelled = true, thickness = 0.14, doorW = 1.1, doorH = 2.1 } = {}) {
  const g = new THREE.Group();
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.05) return g;
  const ang = Math.atan2(-(z1 - z0), x1 - x0);
  const dir = new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize();
  const place = (a, b, yy, hh, mat, depth = thickness, collide = true) => {
    const l = b - a; if (l < 0.03) return;
    const cx = x0 + dir.x * (a + l / 2), cz = z0 + dir.z * (a + l / 2);
    const bx = box(m, l, hh, depth, mat, { x: cx, y: yy + hh / 2, z: cz, collide });
    bx.rotation.y = ang; g.add(bx);
  };
  let cursor = 0;
  for (const f of [...gaps].sort((p, q) => p - q)) {
    const c = f * len;
    place(cursor, c - doorW / 2, y, h, material);
    place(c - doorW / 2, c + doorW / 2, y + doorH, h - doorH, material);       // lintel
    cursor = c + doorW / 2;
  }
  place(cursor, len, y, h, material);
  if (panelled) {
    place(0, len, y + 0.92, 0.07, trim, thickness + 0.06, false);
    place(0, len, y + h - 0.16, 0.14, trim, thickness + 0.08, false);
  }
  return g;
}

/**
 * Room shell for a spec room: floor overlay, four walls with door gaps, ceiling, lamp grid, name plaque.
 * opts: { floor, walls, ceiling, trim, floorRepeat, doors: { fwd:[f...], aft:[...], port:[...], stbd:[...] }, lamps: { kind, nx, nz, lit }, plaque: true }
 */
export function roomShell(spec, m, ctx, room, opts = {}) {
  const g = new THREE.Group();
  g.name = `Room.${room.id}`;
  const lights = [];
  const { x0, x1, z0, z1 } = room;
  const y = 0, h = room.ceiling || 2.6;          // local: the group is lifted to room.y
  g.position.y = room.y;
  const floorMat = opts.floorMat || tiled(m, opts.floor || room.materials?.floor || 'linoCorridor', opts.floorRepeat || 2.0);
  const wallMat = opts.walls || room.materials?.walls || 'whiteEnamel';
  const ceilMat = opts.ceiling || room.materials?.ceiling || 'plasterWhite';
  const trim = opts.trim || room.materials?.trim || (wallMat === 'oakPanel' ? 'oakDark' : 'whiteEnamel');
  const part = { x0, x1 };
  const floor = box(m, x1 - x0, 0.024, z1 - z0, floorMat, { x: (x0 + x1) / 2, y: y + 0.012, z: (z0 + z1) / 2, collide: true });
  floor.receiveShadow = true; floor.castShadow = false; floor.userData.part = part; g.add(floor);
  if (opts.ceiling !== false) {
    const ceil = box(m, x1 - x0, 0.05, z1 - z0, ceilMat, { x: (x0 + x1) / 2, y: y + h + 0.025, z: (z0 + z1) / 2, collide: false });
    ceil.castShadow = false; ceil.userData.part = part; g.add(ceil);
  }
  const d = opts.doors || {};
  const sides = {
    fwd: () => wall(m, x1, z0, x1, z1, y, h, { gaps: d.fwd || [], material: wallMat, trim, panelled: opts.panelled !== false }),
    aft: () => wall(m, x0, z0, x0, z1, y, h, { gaps: d.aft || [], material: wallMat, trim, panelled: opts.panelled !== false }),
    port: () => wall(m, x0, z0, x1, z0, y, h, { gaps: d.port || [], material: wallMat, trim, panelled: opts.panelled !== false }),
    stbd: () => wall(m, x0, z1, x1, z1, y, h, { gaps: d.stbd || [], material: wallMat, trim, panelled: opts.panelled !== false }),
  };
  for (const [side, make] of Object.entries(sides)) {
    if (opts.skip && opts.skip.includes(side)) continue;
    const w = make(); w.traverse((o) => { if (o.isMesh) o.userData.part = part; }); g.add(w);
  }
  // lamps
  const L = opts.lamps || { kind: 'ceilingGlobe', nx: Math.max(1, Math.round((x1 - x0) / 5)), nz: Math.max(1, Math.round((z1 - z0) / 5)), lit: 2 };
  const q = ctx?.quality || 'high';
  const litBudget = q === 'low' ? 0 : q === 'medium' ? Math.min(1, L.lit ?? 1) : (L.lit ?? 2);
  let litCount = 0;
  const lampY = y + h - (L.kind === 'chandelier' ? 0.05 : 0.02);
  for (let i = 0; i < L.nx; i++) for (let j = 0; j < L.nz; j++) {
    const lx = x0 + ((i + 0.5) / L.nx) * (x1 - x0), lz = z0 + ((j + 0.5) / L.nz) * (z1 - z0);
    const central = Math.abs(i - (L.nx - 1) / 2) <= 0.5 && Math.abs(j - (L.nz - 1) / 2) <= 0.5;
    const lit = litCount < litBudget && (central || (i + j) % 2 === 0);
    const lamp = makeLamp(m, { kind: L.kind, power: L.power || 1, light: lit });
    if (lit) { litCount++; lights.push(lamp.userData.light); }
    lamp.position.set(lx, lampY, lz); g.add(lamp);
  }
  if (opts.plaque !== false) {
    const pl = makePlaque(m, { text: room.name, id: `plaque_${room.id}` });
    pl.position.set(x0 + 0.1, y, z0 + 1.0); pl.rotation.y = Math.PI / 2; g.add(pl);
  }
  return { group: g, lights, part };
}

/** Place a prop factory on a grid inside bounds (metres), facing +z unless `yaw` given. Returns the props. */
export function gridPlace(group, make, { x0, x1, z0, z1, dx, dz, yaw = 0, jitter = 0, skip = () => false, limit = 1e9 }) {
  const out = [];
  const nx = Math.max(1, Math.floor((x1 - x0) / dx)), nz = Math.max(1, Math.floor((z1 - z0) / dz));
  const ox = x0 + ((x1 - x0) - (nx - 1) * dx) / 2, oz = z0 + ((z1 - z0) - (nz - 1) * dz) / 2;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (out.length >= limit) return out;
    const x = ox + i * dx, z = oz + j * dz;
    if (skip(x, z, i, j)) continue;
    const p = make(i, j);
    if (!p) continue;
    p.position.set(x + (jitter ? (Math.sin(i * 12.9898 + j * 78.233) * 0.5) * jitter : 0), 0, z + (jitter ? (Math.cos(i * 3.7 + j * 9.1) * 0.5) * jitter : 0));
    p.rotation.y = typeof yaw === 'function' ? yaw(i, j) : yaw;
    group.add(p); out.push(p);
  }
  return out;
}

/** A dining/café "table with chairs" cluster. */
export function tableCluster(m, makeTable, makeChair, { tableOpts = {}, chairOpts = {}, seats = 4, radius = 0.75 } = {}) {
  const g = new THREE.Group();
  g.add(makeTable(m, tableOpts));
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2;
    const c = makeChair(m, chairOpts);
    c.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
    c.rotation.y = a + Math.PI;            // face the table (front = +z)
    g.add(c);
  }
  return g;
}

/**
 * Merge static meshes of a group by material into as few meshes as possible. Lights, instanced meshes,
 * animated props (userData.door) and interactables are kept as-is. The result replaces the group's children.
 */
export function bakeGroup(group, { keep = (o) => !!(o.userData.door || o.userData.interactable || o.isInstancedMesh || o.isLight) } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();       // material uuid → { material, geoms, collide, emissive, shadow }
  const colliders = [];
  const kept = [];
  group.traverse((o) => {
    if (o === group) return;
    let p = o.parent, isKept = false;
    while (p && p !== group) { if (keep(p)) { isKept = true; break; } p = p.parent; }
    if (isKept) return;
    if (keep(o)) { kept.push(o); return; }
    if (!o.isMesh || !o.geometry) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    const mw = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(mw);
    if (!o.visible && o.userData.collide) { colliders.push(g); return; }
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const key = mat.uuid;
    if (!buckets.has(key)) buckets.set(key, { material: mat, geoms: [], collide: false, emissive: false, shadow: o.castShadow });
    const b = buckets.get(key);
    // keep only position/normal/uv so geometries merge cleanly
    const slim = new THREE.BufferGeometry();
    slim.setAttribute('position', g.getAttribute('position'));
    if (g.getAttribute('normal')) slim.setAttribute('normal', g.getAttribute('normal')); else slim.computeVertexNormals();
    if (g.getAttribute('uv')) slim.setAttribute('uv', g.getAttribute('uv'));
    else { const n = slim.getAttribute('position').count; slim.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); }
    b.geoms.push(slim);
    if (o.userData.collide) b.collide = true;
    if (o.userData.emissiveLamp) b.emissive = true;
  });
  // detach kept objects (preserve world transforms relative to the group)
  const keptWithMatrix = kept.map((o) => ({ o, mw: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) }));
  group.clear();
  for (const { o, mw } of keptWithMatrix) { mw.decompose(o.position, o.quaternion, o.scale); group.add(o); }
  for (const b of buckets.values()) {
    if (!b.geoms.length) continue;
    const merged = b.geoms.length === 1 ? b.geoms[0] : mergeGeometries(b.geoms, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.shadow; mesh.receiveShadow = true;
    if (b.collide) mesh.userData.collide = true;
    if (b.emissive) mesh.userData.emissiveLamp = true;
    mesh.name = `baked.${b.material.name || 'mat'}`;
    group.add(mesh);
  }
  if (colliders.length) {
    const c = new THREE.Mesh(mergeGeometries(colliders.map((g) => { const s = new THREE.BufferGeometry(); s.setAttribute('position', g.getAttribute('position')); return s; }), false), new THREE.MeshBasicMaterial({ visible: false }));
    c.visible = false; c.userData.collide = true; c.name = 'baked.colliders';
    group.add(c);
  }
  return group;
}
