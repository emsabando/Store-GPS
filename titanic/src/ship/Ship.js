/**
 * Ship — orchestrates every builder (ARCHITECTURE.md §5) into one ship-local group,
 * builds the static collision BVH, controls lamps, and performs the break-up split.
 */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHull } from './Hull.js';
import { buildDecks } from './Decks.js';
import { buildSuperstructure } from './Superstructure.js';
import { buildGrandStaircases } from './interiors/GrandStaircase.js';
import { buildPublicRoomsA } from './interiors/PublicRoomsA.js';
import { buildPublicRoomsB } from './interiors/PublicRoomsB.js';
import { buildCabinsAndCorridors } from './interiors/Cabins.js';
import { buildMachinery } from './interiors/Machinery.js';

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
    const steps = [
      ['Riveting the hull', buildHull],
      ['Laying the decks', buildDecks],
      ['Raising funnels and masts', buildSuperstructure],
      ['Carving the Grand Staircase', buildGrandStaircases],
      ['Furnishing the public rooms', buildPublicRoomsA],
      ['Setting the dining saloon', buildPublicRoomsB],
      ['Fitting cabins and corridors', buildCabinsAndCorridors],
      ['Lighting the boilers', buildMachinery],
    ];
    let i = 0;
    for (const [label, fn] of steps) {
      onProgress((i / steps.length) * 100, label);
      await nextFrame();
      const t0 = performance.now();
      let result = null;
      try {
        result = fn(this.spec, this.materials, ctx);
      } catch (err) {
        console.error(`[ship] builder ${fn.name} failed`, err);
        if (globalThis.__errors) globalThis.__errors.push(`builder ${fn.name}: ${err && err.message}`);
      }
      if (result) this._merge(result, fn.name);
      ctx.log(`${fn.name} ${(performance.now() - t0).toFixed(0)} ms`);
      i++;
    }
    onProgress(92, 'Surveying for collisions');
    await nextFrame();
    this.buildCollision();
    onProgress(100, 'Ship complete');
    return this;
  }

  _merge(result, builderName) {
    if (result.group) {
      result.group.name = result.group.name || builderName;
      this.group.add(result.group);
    }
    for (const loc of result.locations || []) this.locations.set(loc.id, { ...loc });
    for (const l of result.lights || []) { l.userData.baseIntensity = l.intensity; this.lightsList.push(l); }
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

  setPower(p) {
    this._power = Math.max(0, Math.min(1, p));
    for (const l of this.lightsList) l.intensity = (l.userData.baseIntensity ?? 1) * this._power;
    for (const o of this.lampMeshes) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if ('emissiveIntensity' in m) m.emissiveIntensity = (m.userData.baseEmissive ?? 1) * this._power;
    }
  }

  update(dt) {
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
  partAt(worldPos) {
    if (!this.broken || !this.parts) return { group: this.group, bvh: this.collision?.bvh || null };
    const local = this.group.worldToLocal(worldPos.clone());
    const part = local.x > this.breakX ? this.parts[0] : this.parts[1];
    return { group: part.group, bvh: part.bvh };
  }
}
