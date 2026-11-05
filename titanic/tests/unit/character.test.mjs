// node --test tests/unit/character.test.mjs — bounding boxes, mesh budget and animation sanity of makeCharacter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeCharacter } from '../../src/player/Character.js';

// Minimal stand-in for MaterialLibrary (get / clone).
const materials = {
  _cache: new Map(),
  get(name) {
    if (!this._cache.has(name)) { const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.name = name; this._cache.set(name, m); }
    return this._cache.get(name);
  },
  clone(name, overrides = {}) { const m = this.get(name).clone(); Object.assign(m, overrides); return m; },
};

const LOOKS = {
  gentleman: { sex: 'm', skin: '#e0b89a', hair: { color: '#2c1b12', style: 'moustache' }, hat: 'tophat', top: { color: '#141416', kind: 'tailcoat' }, bottom: { color: '#141416', kind: 'trousers' }, accent: '#e9dcc2', height: 1.8 },
  lady: { sex: 'f', skin: '#f0d0b8', hair: { color: '#c8a165', style: 'bun' }, hat: 'wide', top: { color: '#5e1a26', kind: 'gown' }, bottom: { color: '#5e1a26', kind: 'gown' }, accent: '#d4af37', height: 1.65 },
  officer: { sex: 'm', skin: '#d9b391', hair: { color: '#3a2a1a', style: 'short' }, hat: 'officer', top: { color: '#182540', kind: 'uniform' }, bottom: { color: '#182540', kind: 'trousers' }, accent: '#d4af37', height: 1.78 },
  steerage: { sex: 'm', skin: '#c89a78', hair: { color: '#1a1410', style: 'short' }, hat: 'flatcap', top: { color: '#5a3d2a', kind: 'waistcoat' }, bottom: { color: '#6e6e70', kind: 'trousers' }, accent: '#2e5a3c', height: 1.7 },
  maid: { sex: 'f', skin: '#e8c4a8', hair: { color: '#2c1b12', style: 'long' }, hat: 'bonnet', top: { color: '#f3f0ea', kind: 'blouse' }, bottom: { color: '#182540', kind: 'skirt' }, accent: '#f3f0ea', height: 1.6 },
  bald: { sex: 'm', hair: { style: 'bald' }, hat: 'bowler', top: { kind: 'suit' } },
  straw: { sex: 'm', hat: 'straw', top: { kind: 'shirt', color: '#f3f0ea' }, bottom: { kind: 'trousers', color: '#c2a36b' } },
  empty: {},
};

function bbox(c) {
  c.group.updateMatrixWorld(true);
  const b = new THREE.Box3();
  c.group.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); b.union(bb); } });
  return b;
}
function meshes(c) { let n = 0; c.group.traverse((o) => { if (o.isMesh) n++; }); return n; }

for (const [name, look] of Object.entries(LOOKS)) {
  test(`look "${name}": proportions, mesh budget, shadows`, () => {
    const c = makeCharacter(materials, look);
    const h = look.height || 1.75;
    assert.equal(c.height, h);
    const b = bbox(c);
    const size = b.getSize(new THREE.Vector3());
    // feet on the ground
    assert.ok(Math.abs(b.min.y) < 0.03, `${name}: min y ${b.min.y}`);
    // top of head/hat between height-0.05 and height+0.32 (hats sit above the crown)
    assert.ok(b.max.y > h - 0.05 && b.max.y < h + 0.32, `${name}: max y ${b.max.y} for height ${h}`);
    // believable width/depth (gown hems and wide hats are the widest things)
    assert.ok(size.x > 0.35 && size.x < 1.0, `${name}: width ${size.x}`);
    assert.ok(size.z > 0.2 && size.z < 1.0, `${name}: depth ${size.z}`);
    // roughly centred on the origin
    const centre = b.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(centre.x) < 0.08 && Math.abs(centre.z) < 0.15, `${name}: centre ${centre.x},${centre.z}`);
    assert.ok(meshes(c) <= 14, `${name}: ${meshes(c)} meshes`);
    c.group.traverse((o) => { if (o.isMesh) assert.ok(o.castShadow, 'casts shadows'); });
  });
}

test('poses animate without throwing and sit lowers the figure', () => {
  const c = makeCharacter(materials, LOOKS.gentleman);
  const standing = bbox(c).max.y;
  for (const pose of ['idle', 'walk', 'talk', 'play', 'wave', 'sit', 'bogus']) {
    c.setPose(pose);
    for (let i = 0; i < 90; i++) c.update(1 / 60, pose === 'walk' ? 1.6 : 0, pose === 'walk');
    const b = bbox(c);
    assert.ok(Number.isFinite(b.max.y), `${pose} finite`);
  }
  c.setPose('sit');
  for (let i = 0; i < 120; i++) c.update(1 / 60, 0, false);
  const seated = bbox(c).max.y;
  assert.ok(seated < standing - 0.35, `seated head ${seated} vs standing ${standing}`);
  assert.ok(meshes(c) <= 14, 'violin keeps the budget');
});

test('walk cycle swings the legs and look target turns the head within ±70°', () => {
  const c = makeCharacter(materials, LOOKS.officer);
  c.setPose('walk');
  let maxSwing = 0;
  for (let i = 0; i < 120; i++) { c.update(1 / 60, 4.2, true); maxSwing = Math.max(maxSwing, Math.abs(c.joints.hipL.obj.rotation.x)); }
  assert.ok(maxSwing > 0.3, `leg swing ${maxSwing}`);
  c.setPose('idle');
  c.setLookTarget(new THREE.Vector3(10, 1.6, 1)); // far to the figure's left (+x)
  for (let i = 0; i < 120; i++) c.update(1 / 60, 0, false);
  const yaw = c.joints.head.obj.rotation.y;
  assert.ok(yaw > 0.8 && yaw <= 70 * Math.PI / 180 + 0.1, `head yaw ${yaw}`);
  c.setLookTarget(null);
  for (let i = 0; i < 120; i++) c.update(1 / 60, 0, false);
  assert.ok(Math.abs(c.joints.head.obj.rotation.y) < 0.15, 'head returns');
});
