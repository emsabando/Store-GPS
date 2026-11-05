/**
 * Iceberg — the berg (≈ 30 m long, ≈ 20 m above the water as the lookouts described it, a
 * dark mass with a pale sheen) plus a distant ice field of growlers and small bergs toward the
 * north-west (visible on the morning of the 15th). Procedural: displaced icosahedron with
 * simplex ridges, vertex colours (pale above the waterline, blue-green below), a
 * MeshPhysicalMaterial with a touch of transmission at high/ultra.
 *
 *   const berg = new Iceberg({ quality }); berg.build(); scene.add(berg.group);
 *   berg.spawn(new THREE.Vector3(x, 0, z), { yaw }) → places the main berg (visible, spawned = true)
 *   berg.mesh (Mesh), berg.box (Box3, world), berg.field (InstancedMesh), berg.update(dt, { date })
 */
import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Build an iceberg geometry. `opts.lengthM` horizontal length, `opts.topM` height above water,
 * `opts.keelM` depth below. Vertex colours in `color`.
 */
export function makeIcebergGeometry({ detail = 5, lengthM = 30, beamM = 20, topM = 20, keelM = 50, seed = 7, jagged = 1 } = {}) {
  const rng = mulberry32(seed * 7919 + 13);
  const noise = new SimplexNoise({ random: rng });
  const off = new THREE.Vector3(rng() * 100, rng() * 100, rng() * 100);
  const fbm = (x, y, z, oct = 4) => {
    let a = 0.5, f = 1, s = 0, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * noise.noise3d(x * f + off.x, y * f + off.y, z * f + off.z); norm += a; a *= 0.5; f *= 2.05; }
    return s / norm;
  };
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo = mergeVertices(geo, 1e-4);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const hx = lengthM / 2, hz = beamM / 2;
  const cAbove = new THREE.Color(0.88, 0.96, 1.0), cCrevice = new THREE.Color(0.50, 0.76, 0.95);
  const cShallow = new THREE.Color(0.30, 0.62, 0.72), cDeep = new THREE.Color(0.04, 0.16, 0.26);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const vy = v.y;
    // envelope: flatter, broader keel; a blocky top with a slight plateau
    const yScale = vy > 0 ? topM * Math.pow(vy, 0.85) / Math.max(vy, 1e-6) : keelM;
    const px = v.x * hx, pz = v.z * hz;
    let py = vy * yScale;
    // large lumps + vertical striations + fine texture, stronger above the waterline
    const aboveK = vy > 0 ? 1 + 0.5 * jagged : 0.7;
    const lumps = fbm(v.x * 1.4, v.y * 1.4, v.z * 1.4, 3) * 0.22 * aboveK;
    const ridge = (1 - Math.abs(noise.noise3d(v.x * 4.5 + off.x, v.y * 0.8 + off.y, v.z * 4.5 + off.z))) * 0.09 * aboveK * jagged;
    const fine = fbm(v.x * 9, v.y * 9, v.z * 9, 2) * 0.035;
    const d = 1 + lumps + ridge + fine;
    let x = px * d, z = pz * d;
    py *= (1 + lumps * 0.8 + fine);
    // wave-cut notch at the waterline
    const notch = Math.exp(-Math.pow((py - 0.4) / 1.6, 2)) * 0.08;
    x *= 1 - notch; z *= 1 - notch;
    pos.setXYZ(i, x, py, z);
    // colours
    if (py > -0.6) {
      const crev = THREE.MathUtils.clamp(ridge * 6 + Math.max(0, -lumps) * 1.5, 0, 1);
      c.copy(cAbove).lerp(cCrevice, crev * 0.7);
      if (py < 0.6) c.lerp(cShallow, (0.6 - py) / 1.2 * 0.6);
    } else {
      c.copy(cShallow).lerp(cDeep, THREE.MathUtils.clamp(-py / keelM, 0, 1));
    }
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export class Iceberg {
  constructor({ quality = 'high', seed = 1912 } = {}) {
    this.quality = quality;
    this.seed = seed;
    this.group = new THREE.Group();
    this.group.name = 'Icebergs';
    this.mesh = null;
    this.field = null;
    this.box = new THREE.Box3();
    this.spawned = false;
    this.position = new THREE.Vector3(700, 0, 110);   // default: ahead, a little to starboard
    this.autoVisibleFrom = '1912-04-14';
    this._dateVisible = false;
  }

  build() {
    const hi = this.quality === 'high' || this.quality === 'ultra';
    const detail = this.quality === 'low' ? 4 : hi ? 6 : 5;
    const geo = makeIcebergGeometry({ detail, lengthM: 32, beamM: 22, topM: 20, keelM: 55, seed: this.seed });
    this.material = new THREE.MeshPhysicalMaterial({
      name: 'Iceberg', vertexColors: true, color: 0xf2fbff, roughness: 0.35, metalness: 0,
      transmission: hi ? 0.15 : 0, thickness: 2, attenuationColor: new THREE.Color(0x2f86d6), attenuationDistance: 4, ior: 1.31,
      clearcoat: 0.25, clearcoatRoughness: 0.45, emissive: new THREE.Color(0x9ccbe6), emissiveIntensity: 0.02, envMapIntensity: 1.0,
      side: THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'Iceberg';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.collide = true;
    this.mesh.userData.iceberg = true;
    this.mesh.rotation.set(THREE.MathUtils.degToRad(3), 0.6, THREE.MathUtils.degToRad(-4));
    this.group.add(this.mesh);
    this._buildField();
    this.spawn(this.position, { yaw: 0.6, silent: true });
    this.spawned = false;
    return this;
  }

  _buildField() {
    const rng = mulberry32(this.seed + 99);
    const count = this.quality === 'low' ? 15 : this.quality === 'medium' ? 20 : 28;
    const geo = makeIcebergGeometry({ detail: 3, lengthM: 30, beamM: 22, topM: 14, keelM: 40, seed: this.seed + 3, jagged: 0.7 });
    const mat = new THREE.MeshStandardMaterial({ name: 'IceField', vertexColors: true, color: 0xdef1f8, roughness: 0.5, metalness: 0, emissive: new THREE.Color(0x9ccbe6), emissiveIntensity: 0.015 });
    this.field = new THREE.InstancedMesh(geo, mat, count);
    this.field.name = 'IceField';
    this.field.castShadow = false;
    this.field.receiveShadow = true;
    this.field.frustumCulled = true;
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // north-west quadrant: between the bow (+x = west) and starboard (+z = north)
      const ang = THREE.MathUtils.degToRad(10 + rng() * 70);
      const dist = 1400 + Math.pow(rng(), 0.8) * 5200;
      p.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
      const size = 0.12 + Math.pow(rng(), 2.2) * 1.5;           // growlers … big bergs (× 30 m)
      const tabular = rng() < 0.3;
      s.set(size * (0.8 + rng() * 0.6), size * (tabular ? 0.45 : 0.75 + rng() * 0.6), size * (0.8 + rng() * 0.6));
      e.set((rng() - 0.5) * 0.12, rng() * Math.PI * 2, (rng() - 0.5) * 0.12);
      q.setFromEuler(e);
      m.compose(p, q, s);
      this.field.setMatrixAt(i, m);
      col.setRGB(0.85 + rng() * 0.15, 0.93 + rng() * 0.07, 1.0);
      this.field.setColorAt(i, col);
    }
    this.field.instanceMatrix.needsUpdate = true;
    if (this.field.instanceColor) this.field.instanceColor.needsUpdate = true;
    this.field.computeBoundingSphere();
    this.group.add(this.field);
  }

  /** Place the main berg (world position; y is ignored — the berg floats at the waterline). */
  spawn(worldPos, { yaw = 0.6, silent = false } = {}) {
    this.position.set(worldPos.x, 0, worldPos.z);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = yaw;
    this.mesh.updateMatrixWorld(true);
    this.box.copy(this.mesh.geometry.boundingBox).applyMatrix4(this.mesh.matrixWorld);
    if (!silent) { this.spawned = true; this.mesh.visible = true; }
    return this.mesh;
  }

  setVisible(v) { this.mesh.visible = v; this.field.visible = v; }

  /** Date-driven visibility: the ice is out there from 14 April; `spawn()` overrides it. */
  update(dt, { date } = {}) {
    if (this.spawned) return;
    const vis = !date || date >= this.autoVisibleFrom;
    if (vis !== this._dateVisible) { this._dateVisible = vis; this.setVisible(vis); }
  }

  dispose() {
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    if (this.field) { this.field.geometry.dispose(); this.field.material.dispose(); this.field.dispose(); }
  }
}
