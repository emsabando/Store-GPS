/**
 * Ship — orchestrates every builder (ARCHITECTURE.md §5) into one ship-local group,
 * builds the static collision BVH, controls lamps, and performs the break-up split.
 */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeShip } from './Bake.js';
import { buildHull } from './Hull.js';
import { buildDecks } from './Decks.js';
import { buildSuperstructure } from './Superstructure.js';
import { buildGrandStaircases } from './interiors/GrandStaircase.js';
import { buildPublicRoomsA } from './interiors/PublicRoomsA.js';
import { buildPublicRoomsB } from './interiors/PublicRoomsB.js';
import { buildCabinsAndCorridors } from './interiors/Cabins.js';
import { buildMachinery } from './interiors/Machinery.js';

const _groundRay = new THREE.Ray();

/** Merge the position-only, world-transformed geometry of meshes into one non-indexed BufferGeometry (relative to `parentInverse`). */
function mergeColliders(meshes, parentInverse) {
  const parts = [];
  const m = new THREE.Matrix4();
  for (const mesh of meshes) {
    let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const pos = g.getAttribute('position');
    if (!pos || pos.count < 3) continue;
    const only = new THREE.BufferGeometry();
    only.setAttribute('position', pos.clone());
    m.multiplyMatrices(parentInverse, mesh.matrixWorld);
    only.applyMatrix4(m);
    parts.push(only);
    if (g !== mesh.geometry) g.dispose();
  }
  if (!parts.length) return null;
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  return merged;
}

const nextFrame = () => new Promise((r) => (globalThis.requestAnimationFrame ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

export class Ship {
  constructor({ spec, materials, quality = 'high', log = console.log }) {
    this.spec = spec;
    this.materials = materials;
    this.quality = quality;
    this.log = log;
    this.group = new THREE.Group();
    this.group.name = 'Ship';
    this.locations = new Map();
    this.lightsList = [];
    this.lampMeshes = [];
    this.lamps = [];              // { parent, local: Vector3, color, intensity, distance, decay } (pooled point lights)
    this.pool = [];               // the few real PointLights, reassigned to the nearest lamps each frame
    this.poolSize = { low: 4, medium: 6, high: 10, ultra: 14 }[quality] || 8;
    this.dynamic = [];
    this.interactables = new Map();
    this.funnels = [];
    this.lifeboats = [];
    this.floodRooms = [];
    this.collision = null;
    this.parts = null;          // after split(): [{ group, bvh, mesh, x0, x1 }]
    this.broken = false;
    this._flicker = 0;
    this._power = 1;
    this.decksTopDown = [...(spec.decks || [])].sort((a, b) => b.y - a.y);
    this.breakX = this._computeBreakX();
    this.lights = {
      setPower: (p) => this.setPower(p),
      flicker: (seconds = 1.5) => { this._flicker = seconds; },
      get power() { return this._power; },
    };
  }

  _computeBreakX() {
    const s = this.spec;
    if (typeof s.breakX === 'number') return s.breakX;
    const tl = s.sinkingTimeline || [];
    const k = tl.find((e) => typeof e.breakX === 'number');
    if (k) return k.breakX;
    const f = s.funnels || [];
    if (f.length >= 4 && typeof f[2].x === 'number' && typeof f[3].x === 'number') return (f[2].x + f[3].x) / 2;
    return -32;
  }

  _ctx() {
    const spec = this.spec;
    const deckById = new Map((spec.decks || []).map((d) => [d.id, d]));
    const roomById = new Map();
    for (const d of spec.decks || []) for (const r of d.rooms || []) roomById.set(r.id, { ...r, deck: d.id, deckY: d.y });
    return {
      quality: this.quality,
      deck: (id) => deckById.get(id) || null,
      deckY: (id) => (deckById.get(id) ? deckById.get(id).y : 0),
      room: (id) => roomById.get(id) || null,
      breakX: this.breakX,
      log: (msg) => this.log(`[ship] ${msg}`),
    };
  }

  async build(onProgress = () => {}) {
    const ctx = this._ctx();
    // [label, builder, name, interior]: names are explicit because minification mangles fn.name.
    const steps = [
      ['Riveting the hull', buildHull, 'hull', false],
      ['Laying the decks', buildDecks, 'decks', false],
      ['Raising funnels and masts', buildSuperstructure, 'superstructure', false],
      ['Carving the Grand Staircase', buildGrandStaircases, 'grandStaircases', true],
      ['Furnishing the public rooms', buildPublicRoomsA, 'publicRoomsA', true],
      ['Setting the dining saloon', buildPublicRoomsB, 'publicRoomsB', true],
      ['Fitting cabins and corridors', buildCabinsAndCorridors, 'cabins', true],
      ['Lighting the boilers', buildMachinery, 'machinery', true],
    ];
    let i = 0;
    for (const [label, fn, name, interior] of steps) {
      onProgress((i / steps.length) * 100, label);
      await nextFrame();
      const t0 = performance.now();
      let result = null;
      try {
        result = fn(this.spec, this.materials, ctx);
      } catch (err) {
        console.error(`[ship] builder ${name} failed`, err);
        if (globalThis.__errors) globalThis.__errors.push(`builder ${name}: ${err && err.message}`);
      }
      if (result) this._merge(result, name, interior);
      ctx.log(`${name} ${(performance.now() - t0).toFixed(0)} ms`);
      i++;
    }
    if (ctx.bake !== false) {
      onProgress(88, 'Bolting it all together');
      await nextFrame();
      const t0 = performance.now();
      try { bakeShip(this, { log: ctx.log }); } catch (err) { console.error('[ship] bake failed; continuing unbaked', err); }
      ctx.log(`bake ${(performance.now() - t0).toFixed(0)} ms`);
    }
    onProgress(92, 'Surveying for collisions');
    await nextFrame();
    this.buildCollision();
    onProgress(100, 'Ship complete');
    return this;
  }

  _merge(result, builderName, interior = false) {
    if (result.group) {
      result.group.name = result.group.name || builderName;
      this.group.add(result.group);
      // Interior geometry never sees the sun: keep it out of the shadow pass (thousands of draws).
      if (interior) result.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    }
    for (const loc of result.locations || []) this.locations.set(loc.id, { ...loc });
    for (const l of result.lights || []) { l.userData.baseIntensity = l.intensity; this.lightsList.push(l); }
    // Pool point lights: three.js evaluates every light for every fragment, so builders' lamps become
    // descriptors and a small pool of real lights follows the camera.
    if (result.group) {
      const found = [];
      result.group.traverse((o) => { if (o.isPointLight) found.push(o); });
      for (const pl of found) {
        const parent = pl.parent || result.group;
        this.lamps.push({ parent, local: pl.position.clone(), color: pl.color.clone(), intensity: pl.userData.baseIntensity ?? pl.intensity, distance: pl.distance || 10, decay: pl.decay || 2, world: new THREE.Vector3() });
        parent.remove(pl);
        const idx = this.lightsList.indexOf(pl); if (idx >= 0) this.lightsList.splice(idx, 1);
      }
    }
    for (const d of result.dynamic || []) this.dynamic.push(d);
    for (const it of result.interactables || []) this.interactables.set(it.id, it);
    if (result.funnels) this.funnels = result.funnels;
    if (result.lifeboats) this.lifeboats = result.lifeboats;
    for (const fr of result.floodRooms || []) this.floodRooms.push(fr);
    if (result.group) {
      result.group.traverse((o) => {
        if (o.userData && o.userData.emissiveLamp && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) if ('emissiveIntensity' in m) m.userData.baseEmissive = m.emissiveIntensity;
          this.lampMeshes.push(o);
        }
      });
    }
  }

  /** Collect every mesh flagged userData.collide and build one BVH in ship-local space. */
  buildCollision(root = this.group) {
    root.updateMatrixWorld(true);
    const meshes = [];
    root.traverse((o) => { if (o.isMesh && o.userData.collide && o.geometry && o.geometry.attributes.position) meshes.push(o); });
    if (meshes.length === 0) {
      // Fallback: a flat invisible plank so the player has something to stand on.
      const g = new THREE.BoxGeometry(260, 0.2, 28);
      g.translate(0, -0.1, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ visible: false }));
      m.userData.collide = true;
      this.group.add(m);
      meshes.push(m);
      this.group.updateMatrixWorld(true);
    }
    // Merge ship-local (root-relative) collision geometry.
    const parentMatrixInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const merged = mergeColliders(meshes, parentMatrixInverse);
    if (!merged) throw new Error('collision merge produced no geometry');
    merged.computeBoundingBox();
    const bvh = new MeshBVH(merged, { targetLeafSize: 8 });
    merged.boundsTree = bvh;
    const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ visible: false, wireframe: true }));
    mesh.name = 'ShipCollision';
    mesh.visible = false;
    this.collision = { bvh, mesh, geometry: merged, count: meshes.length, triangles: merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3 };
    this.log(`[ship] collision: ${meshes.length} meshes, ${Math.round(this.collision.triangles)} tris`);
    return this.collision;
  }

  /** Deck id for a ship-local height (floor height <= y < next deck). */
  deckAt(yLocal) {
    const decks = this.decksTopDown;
    if (!decks.length) return 'boat';
    for (const d of decks) if (yLocal >= d.y - 0.5) return d.id;
    return decks[decks.length - 1].id;
  }

  deckY(id) { const d = (this.spec.decks || []).find((x) => x.id === id); return d ? d.y : 0; }

  /** Assign the pooled PointLights to the lamps nearest the camera (world position). */
  updateLightPool(cameraWorldPos) {
    if (!this.lamps.length) return;
    if (!this.pool.length) {
      for (let i = 0; i < this.poolSize; i++) {
        const pl = new THREE.PointLight(0xffa552, 0, 12, 2);
        pl.name = `pooledLamp${i}`; pl.castShadow = false;
        this.group.add(pl); this.pool.push(pl);
      }
    }
    const cam = cameraWorldPos || new THREE.Vector3();
    for (const L of this.lamps) { L.world.copy(L.local); L.parent.localToWorld(L.world); L.d2 = L.world.distanceToSquared(cam); }
    // partial selection of the N nearest
    const n = this.pool.length;
    const nearest = [];
    for (const L of this.lamps) {
      if (nearest.length < n) { nearest.push(L); if (nearest.length === n) nearest.sort((a, b) => a.d2 - b.d2); continue; }
      if (L.d2 < nearest[n - 1].d2) { nearest[n - 1] = L; nearest.sort((a, b) => a.d2 - b.d2); }
    }
    for (let i = 0; i < n; i++) {
      const pl = this.pool[i], L = nearest[i];
      if (!L) { pl.intensity = 0; continue; }
      pl.position.copy(this.group.worldToLocal(L.world.clone()));
      pl.color.copy(L.color); pl.distance = L.distance; pl.decay = L.decay;
      const fade = THREE.MathUtils.clamp(1 - Math.sqrt(L.d2) / 60, 0.15, 1);
      pl.intensity = L.intensity * this._power * fade;
    }
  }

  setPower(p) {
    this._power = Math.max(0, Math.min(1, p));
    for (const l of this.lightsList) l.intensity = (l.userData.baseIntensity ?? 1) * this._power;
    this._applyEmissive();
  }

  /** 0 = night … 1 = full daylight: materials flagged `userData.daylightDim` (porthole glass) fade out by day. */
  setDaylight(d) {
    const v = Math.max(0, Math.min(1, +d || 0));
    if (Math.abs(v - (this._daylight ?? -1)) < 0.01) return;
    this._daylight = v;
    this._applyEmissive();
  }

  _applyEmissive() {
    const day = this._daylight ?? 0;
    for (const o of this.lampMeshes) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!('emissiveIntensity' in m)) continue;
        const dim = m.userData.daylightDim ? 1 - 0.95 * day : 1;
        m.emissiveIntensity = (m.userData.baseEmissive ?? 1) * this._power * dim;
      }
    }
  }

  update(dt, cameraWorldPos) {
    if (cameraWorldPos) this.updateLightPool(cameraWorldPos);
    if (this._flicker > 0) {
      this._flicker -= dt;
      const p = this._flicker <= 0 ? this._powerTarget ?? this._power : (Math.random() < 0.5 ? 0.15 : 1) * (this._powerTarget ?? 1);
      this.setPower(this._flicker <= 0 ? (this._powerTarget ?? 1) : p);
    }
  }

  /** Flicker, then settle at the given power (used for the 02:17 lights-out). */
  flickerTo(power, seconds = 2) { this._powerTarget = power; this._flicker = seconds; }

  localToWorld(v) { return this.group.localToWorld(v.clone()); }
  worldToLocal(v) { return this.group.worldToLocal(v.clone()); }

  /**
   * Break the ship into bow and stern groups at x = xBreak (ship-local). Objects are assigned by
   * userData.part x-range if present, otherwise by bounding-box centre. Returns the two groups,
   * each with its own collision BVH. The original group stays as the common parent.
   */
  split(xBreak = this.breakX) {
    if (this.broken) return { bowGroup: this.bowGroup, sternGroup: this.sternGroup };
    this.group.updateMatrixWorld(true);
    const bowGroup = new THREE.Group(); bowGroup.name = 'ShipBow';
    const sternGroup = new THREE.Group(); sternGroup.name = 'ShipStern';
    const movable = [];
    const box = new THREE.Box3();
    // Descend until we find objects with a part tag, else assign leaf meshes / small groups by bbox.
    const visit = (o) => {
      if (o === this.collision?.mesh) return;
      if (o.userData && o.userData.part) { movable.push(o); return; }
      if (o.isMesh || o.isLight || o.children.length === 0) { movable.push(o); return; }
      for (const c of [...o.children]) visit(c);
    };
    for (const c of [...this.group.children]) visit(c);
    const center = new THREE.Vector3();
    for (const o of movable) {
      let toBow;
      if (o.userData.part && typeof o.userData.part.x0 === 'number') {
        toBow = (o.userData.part.x0 + o.userData.part.x1) / 2 > xBreak;
      } else {
        box.setFromObject(o);
        if (box.isEmpty()) { o.getWorldPosition(center); } else box.getCenter(center);
        this.group.worldToLocal(center);
        toBow = center.x > xBreak;
      }
      (toBow ? bowGroup : sternGroup).attach(o);
    }
    if (this.collision?.mesh?.parent) this.collision.mesh.parent.remove(this.collision.mesh);
    this.group.add(bowGroup, sternGroup);
    this.bowGroup = bowGroup; this.sternGroup = sternGroup;
    this.broken = true;
    this.parts = [bowGroup, sternGroup].map((g) => {
      const col = this._buildPartCollision(g);
      return { group: g, bvh: col.bvh, mesh: col.mesh, x0: g === bowGroup ? xBreak : -Infinity, x1: g === bowGroup ? Infinity : xBreak };
    });
    return { bowGroup, sternGroup };
  }

  _buildPartCollision(partGroup) {
    partGroup.updateMatrixWorld(true);
    const meshes = [];
    partGroup.traverse((o) => { if (o.isMesh && o.userData.collide && o.geometry?.attributes?.position) meshes.push(o); });
    if (!meshes.length) return { bvh: null, mesh: null };
    const inv = new THREE.Matrix4().copy(partGroup.matrixWorld).invert();
    const geom = mergeColliders(meshes, inv);
    if (!geom) return { bvh: null, mesh: null };
    const bvh = new MeshBVH(geom, { targetLeafSize: 8 });
    geom.boundsTree = bvh;
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
    mesh.visible = false;
    return { bvh, mesh };
  }

  /** Collision frame for a point (world): { group, bvh } — whole ship, or the part containing the point after the break. */
  /**
   * Height of the first surface below (x, fromY, z) in ship-local metres, or null if nothing within
   * `maxDrop`. Uses the intact-hull BVH (pre break-up). Cheap enough for spawn placement.
   */
  groundAt(x, fromY, z, maxDrop = 4) {
    const bvh = this.collision && this.collision.bvh;
    if (!bvh) return null;
    _groundRay.origin.set(x, fromY, z);
    _groundRay.direction.set(0, -1, 0);
    const hit = bvh.raycastFirst(_groundRay, THREE.DoubleSide, 0, maxDrop);
    return hit ? hit.point.y : null;
  }

  partAt(worldPos) {
    if (!this.broken || !this.parts) return { group: this.group, bvh: this.collision?.bvh || null };
    const local = this.group.worldToLocal(worldPos.clone());
    const part = local.x > this.breakX ? this.parts[0] : this.parts[1];
    return { group: part.group, bvh: part.bvh };
  }
}
