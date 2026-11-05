/**
 * PlayerInteraction — finds the interactable the player is looking at.
 *
 * Every frame a ray is cast from the camera 3.0 m forward. Rather than walking the whole scene
 * (tens of thousands of merged ship triangles every frame) we keep a short-lived cache of every
 * object in `engine.scene` that carries `userData.interactable` (refreshed every second — NPCs and
 * dynamic props come and go), raycast only against those, and then check occlusion of the best hit
 * with one BVH ray against the ship collision. The result is the same as a full-scene raycast
 * (walls hide doors behind them) at a fraction of the cost.
 */
import * as THREE from 'three';
import { castRay } from './CapsuleCollider.js';

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _localOrigin = new THREE.Vector3();
const _localDir = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _rot = new THREE.Matrix3();

export class PlayerInteraction {
  constructor({ engine, ship, range = 3.0 }) {
    this.engine = engine;
    this.ship = ship;
    this.range = range;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = range;
    this.raycaster.firstHitOnly = true;
    this._cache = [];
    this._cacheAge = 1e9;
    this._hits = [];
    /** current target: { interactable, object, point, distance } or null */
    this.target = null;
    this.label = null;
  }

  /** Rebuild the interactable cache (objects that carry userData.interactable). */
  refresh() {
    this._cache.length = 0;
    const seen = new Set();
    this.engine.scene.traverse((o) => {
      if (o.userData && o.userData.interactable && !seen.has(o)) {
        seen.add(o);
        this._cache.push(o);
      }
    });
    this._cacheAge = 0;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} origin world camera position
   * @param {THREE.Vector3} forward world camera forward (unit)
   * @returns {object|null} the interactable userData of the new target (or null)
   */
  update(dt, origin, forward) {
    this._cacheAge += dt;
    if (this._cacheAge > 1.0) this.refresh();
    _origin.copy(origin);
    _dir.copy(forward).normalize();
    this.raycaster.set(_origin, _dir);
    this._hits.length = 0;
    let best = null;
    if (this._cache.length) {
      // Objects can be removed from the scene between refreshes — skip orphans.
      const hits = this.raycaster.intersectObjects(this._cache, true, this._hits);
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (!h.object.visible) continue;
        const inter = findInteractable(h.object);
        if (!inter) continue;
        if (this._occluded(_origin, _dir, h.distance)) continue;
        best = { interactable: inter.data, object: inter.object, hitObject: h.object, point: h.point, distance: h.distance };
        break;
      }
    }
    this.target = best;
    this.label = best ? (best.interactable.label || best.interactable.id || null) : null;
    return best ? best.interactable : null;
  }

  /** One BVH ray against the ship part under the camera: is something solid closer than `distance`? */
  _occluded(origin, dir, distance) {
    const ship = this.ship;
    if (!ship || typeof ship.partAt !== 'function') return false;
    const part = ship.partAt(origin);
    if (!part || !part.bvh || !part.group) return false;
    _inv.copy(part.group.matrixWorld).invert();
    _rot.setFromMatrix4(_inv);
    _localOrigin.copy(origin).applyMatrix4(_inv);
    _localDir.copy(dir).applyMatrix3(_rot).normalize();
    const hit = castRay(part.bvh, _localOrigin, _localDir, distance - 0.12, 0.05);
    return hit.hit;
  }

  dispose() { this._cache.length = 0; this.target = null; }
}

/** Walk up the parent chain for userData.interactable. Returns { data, object } or null. */
export function findInteractable(object) {
  let o = object;
  while (o) {
    if (o.userData && o.userData.interactable) return { data: o.userData.interactable, object: o };
    o = o.parent;
  }
  return null;
}
