/**
 * Interior flooding — world-horizontal translucent water planes rendered only inside the hull.
 *
 * Model: the interior water level is a WORLD-space height `floodWorldY(t)` (it can never exceed
 * the sea, so it rises from the tank top at the bow, −9 m, towards −0.3 m by 150 min) plus an
 * aft extent `aftX(t)` in ship-local x (the flooded compartments spread aft from the forward
 * holds, x ≈ +40, to the whole hull at the break). Because the ship trims, the SHIP-LOCAL height of
 * that level rises much faster at the bow than amidships: at 60 min it is around D/E deck forward,
 * by 150 min above the boat deck forward — the same milestones as the historical flooding.
 *
 * Rendering: two big planes (bow/whole hull + stern after the break) at y = floodWorldY, clipped by
 * `material.clippingPlanes` derived from the hull's bounding box (plus four bow/stern taper
 * planes) in ship-local space, transformed by the part's matrixWorld every frame
 * (`renderer.localClippingEnabled` is set by the Engine; `clipIntersection = false`).
 */
import * as THREE from 'three';
import { curve } from './Timeline.js';

const LEVEL_KEYS = [[0, -9], [30, -7], [60, -5], [90, -3], [120, -1.5], [150, -0.5], [158, -0.3], [161, -0.3]];
const AFT_KEYS = [[0, 40], [30, 25], [60, 0], [90, -20], [120, -40], [140, -60], [150, -80], [158, -140], [161, -140]];

const _p = new THREE.Vector3();
const _c = new THREE.Vector3();

/** Tileable procedural "ripples" normal map on a canvas (null outside the browser). */
export function makeWaterNormalTexture(size = 128) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const waves = [[3, 1, 0.6, 0.0], [1, 4, 0.5, 1.3], [5, 3, 0.25, 2.1], [2, 7, 0.2, 0.7], [8, 2, 0.12, 2.9]];
  const h = (x, y) => { let v = 0; for (const [fx, fy, a, ph] of waves) v += a * Math.sin(2 * Math.PI * (fx * x + fy * y) + ph); return v; };
  const d = 1 / size, k = 1.8;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = i / size, y = j / size;
      const dx = (h(x + d, y) - h(x - d, y)) / (2 * d) * k * d;
      const dy = (h(x, y + d) - h(x, y - d)) / (2 * d) * k * d;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const o = (j * size + i) * 4;
      img.data[o] = (nx * 0.5 + 0.5) * 255; img.data[o + 1] = (ny * 0.5 + 0.5) * 255; img.data[o + 2] = (nz * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function planeFrom(nx, ny, nz, px, py, pz) {
  const n = new THREE.Vector3(nx, ny, nz).normalize();
  return new THREE.Plane(n, -n.dot(new THREE.Vector3(px, py, pz)));
}

export class Flooding {
  constructor({ ship, world, spec, scene }) {
    this.ship = ship;
    this.world = world;
    this.spec = spec || {};
    this.scene = scene || null;
    this.levelCurve = curve(LEVEL_KEYS);
    this.aftCurve = curve(AFT_KEYS);
    this.floodWorldY = LEVEL_KEYS[0][1];
    this.aftX = AFT_KEYS[0][1];
    this.decks = [...(this.spec.decks || [])].filter((d) => typeof d.y === 'number').sort((a, b) => a.y - b.y);
    this.xRef = 100;                  // ship-local x where "a deck's forward end" is judged
    this.bounds = this._hullBounds();
    this.meshes = [];
    this._planes = [];                // [{ local: Plane[], world: Plane[], aftIndex }]
    this._built = false;
    this._time = 0;
    this.enabled = true;
  }

  _hullBounds() {
    const dims = this.spec.dims || {};
    const hb = ((dims.beamMoulded || 28.2) / 2) + 0.4;
    const loa = dims.loa || 269;
    let xMin = -loa / 2 - 1, xMax = loa / 2 + 0.5, yMin = -(dims.draught || 10.5) - 0.5, yMax = 19;
    const boat = this.decks.find((d) => d.id === 'boat');
    if (boat) yMax = boat.y + 3;
    const box = new THREE.Box3();
    try { if (this.ship && this.ship.group) box.setFromObject(this.ship.group); } catch (_) { /* fake ships */ }
    if (!box.isEmpty() && Number.isFinite(box.min.x) && box.max.x - box.min.x > 100) {
      xMin = box.min.x - 0.5; xMax = box.max.x + 0.5; yMin = Math.min(yMin, box.min.y - 0.5);
    }
    return { xMin, xMax, yMin, yMax, hb };
  }

  _makePlanes() {
    const b = this.bounds;
    const local = [
      planeFrom(-1, 0, 0, b.xMax, 0, 0),           // x <= xMax
      planeFrom(1, 0, 0, this.aftX, 0, 0),         // x >= aftX (index 1 is updated per frame)
      planeFrom(0, 1, 0, 0, b.yMin, 0),            // y >= yMin
      planeFrom(0, -1, 0, 0, b.yMax, 0),           // y <= yMax
      planeFrom(0, 0, -1, 0, 0, b.hb),             // z <= hb
      planeFrom(0, 0, 1, 0, 0, -b.hb),             // z >= -hb
    ];
    // bow taper: from the stem (xMax, 0) back to full beam at x = xMax - 60
    const tx = b.xMax - 60;
    local.push(planeFrom(-b.hb, 0, -(b.xMax - tx), b.xMax, 0, 0));   // starboard bow side
    local.push(planeFrom(-b.hb, 0, (b.xMax - tx), b.xMax, 0, 0));    // port bow side
    // stern taper: from the sternpost (xMin, 0) forward to full beam at xMin + 50
    const sx = b.xMin + 50;
    local.push(planeFrom(b.hb, 0, -(sx - b.xMin), b.xMin, 0, 0));
    local.push(planeFrom(b.hb, 0, (sx - b.xMin), b.xMin, 0, 0));
    return { local, world: local.map((p) => p.clone()), aftIndex: 1 };
  }

  /** Create the water meshes (no-op outside a browser / without a scene). */
  build() {
    if (this._built) return;
    this._built = true;
    if (!this.scene || typeof document === 'undefined') return;
    const normalMap = makeWaterNormalTexture(128);
    const normalMap2 = normalMap ? normalMap.clone() : null;
    if (normalMap) { normalMap.repeat.set(36, 8); }
    if (normalMap2) { normalMap2.repeat.set(23, 5); normalMap2.needsUpdate = true; }
    const geom = new THREE.PlaneGeometry(400, 80, 1, 1);
    geom.rotateX(-Math.PI / 2);
    for (let i = 0; i < 2; i++) {
      const planes = this._makePlanes();
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x0b1c17), roughness: 0.1, metalness: 0, transmission: 0.6, ior: 1.33, thickness: 1.5,
        transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false,
        clearcoat: 0.5, clearcoatRoughness: 0.08,
        clippingPlanes: planes.world, clipIntersection: false, clipShadows: false,
      });
      if (normalMap) { mat.normalMap = normalMap; mat.normalScale = new THREE.Vector2(0.35, 0.35); }
      if (normalMap2) { mat.clearcoatNormalMap = normalMap2; mat.clearcoatNormalScale = new THREE.Vector2(0.25, 0.25); }
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = i === 0 ? 'FloodWaterBow' : 'FloodWaterStern';
      mesh.renderOrder = 10;
      mesh.frustumCulled = false;
      mesh.visible = i === 0;
      mesh.userData.collide = false;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      this._planes.push(planes);
    }
    this._normalMaps = [normalMap, normalMap2].filter(Boolean);
  }

  /** Flood level for a minute of the sinking: { floodWorldY, aftX }. */
  levelAt(minutesAfter) {
    const t = Math.max(0, minutesAfter);
    return { floodWorldY: this.levelCurve.at(t), aftX: this.aftCurve.at(t) };
  }

  /** Ship-local (frame-local) y of the interior water under a world position. */
  localYUnder(worldPos, frame) {
    const g = frame || (this.ship && this.ship.group);
    if (!g) return this.floodWorldY;
    _p.set(worldPos.x, this.floodWorldY, worldPos.z);
    g.worldToLocal(_p);
    return _p.y;
  }

  /** Ship-local y of the water at ship-local x = xRef (on the centreline). */
  localYAtX(xRef, frame) {
    const g = frame || (this.ship && this.ship.group);
    if (!g) return this.floodWorldY;
    _c.set(xRef, 0, 0);
    g.localToWorld(_c);
    _p.set(_c.x, this.floodWorldY, _c.z);
    g.worldToLocal(_p);
    return _p.y;
  }

  /** Highest deck whose floor is at/below a ship-local height (null if below the lowest). */
  deckFor(localY) {
    let best = null;
    for (const d of this.decks) if (d.y <= localY) best = d.id;
    return best;
  }

  /** Index of a deck id in bottom-up order (-1 if unknown). */
  deckIndex(id) { return this.decks.findIndex((d) => d.id === id); }

  /**
   * Advance the flood level and move/clip the water meshes.
   * @param {number} dt real seconds
   * @param {object} o { minutesAfter, broken, bowGroup, sternGroup, breakX }
   */
  update(dt, { minutesAfter, broken, bowGroup, sternGroup, breakX }) {
    const lv = this.levelAt(minutesAfter);
    this.floodWorldY = Math.max(this.floodWorldY, lv.floodWorldY);     // never recedes
    this.aftX = Math.min(this.aftX, lv.aftX);
    this._time += dt;
    if (!this.meshes.length) return;
    const frames = broken && bowGroup && sternGroup ? [bowGroup, sternGroup] : [this.ship.group, null];
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i], frame = frames[i], planes = this._planes[i];
      if (!frame || !this.enabled) { mesh.visible = false; continue; }
      mesh.visible = true;
      // aft extent: the whole-hull/bow mesh stops at aftX (or the break once split); the stern mesh
      // covers the stern part only (it floods instantly through the open break).
      const aft = planes.local[planes.aftIndex];
      if (i === 0) { aft.constant = -(broken ? Math.max(this.aftX, breakX) : this.aftX); }
      else { aft.constant = -this.bounds.xMin; planes.local[0].constant = breakX; }
      for (let k = 0; k < planes.local.length; k++) planes.world[k].copy(planes.local[k]).applyMatrix4(frame.matrixWorld);
      _c.set(0, 0, 0); frame.localToWorld(_c);
      const y = i === 1 ? Math.min(-0.2, this.floodWorldY + 2) : this.floodWorldY;
      mesh.position.set(_c.x, y, _c.z);
    }
    if (this._normalMaps) {
      const [a, b] = this._normalMaps;
      if (a) { a.offset.x = (this._time * 0.012) % 1; a.offset.y = (this._time * 0.007) % 1; }
      if (b) { b.offset.x = (-this._time * 0.009) % 1; b.offset.y = (this._time * 0.011) % 1; }
    }
  }

  dispose() {
    for (const m of this.meshes) { if (m.parent) m.parent.remove(m); m.material.dispose(); }
    if (this.meshes[0]) this.meshes[0].geometry.dispose();
    for (const t of this._normalMaps || []) t.dispose();
    this.meshes = [];
  }
}
