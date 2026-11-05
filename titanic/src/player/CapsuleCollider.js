/**
 * CapsuleCollider — resolves a vertical-ish capsule against a static three-mesh-bvh BVH.
 *
 * Everything here works in the BVH's LOCAL frame (the ship part group). The caller transforms
 * the capsule in, runs `resolve()` / `castDown()` / `castUp()`, and transforms the result out.
 * The canonical three-mesh-bvh "characterMovement" approach: for every triangle whose bounds touch
 * the capsule, find the closest point to the capsule segment and push the segment out along the
 * separating direction; contacts whose push direction is close to "up" are ground.
 *
 * No allocations per call — every temporary is module-level and reused.
 */
import * as THREE from 'three';

const _box = new THREE.Box3();
const _segment = new THREE.Line3();
const _triPoint = new THREE.Vector3();
const _capPoint = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _start0 = new THREE.Vector3();
const _ray = new THREE.Ray();
const _normal = new THREE.Vector3();

/** Result of one capsule resolve — reused, read it before the next call. */
export const contact = {
  /** total displacement applied to the capsule (local frame) */
  delta: new THREE.Vector3(),
  /** true when at least one contact pushed roughly along `up` */
  ground: false,
  /** accumulated (unnormalised) ground normal */
  groundNormal: new THREE.Vector3(),
  /** triangle index of the steepest-up ground contact (for surface lookup) */
  groundTri: -1,
  /** accumulated (unnormalised) wall normal of non-ground contacts */
  wallNormal: new THREE.Vector3(),
  wall: false,
  /** number of penetrating triangles found in the final iteration */
  count: 0,
};

/**
 * Push a capsule out of the BVH.
 * @param {import('three-mesh-bvh').MeshBVH} bvh
 * @param {THREE.Vector3} start   bottom sphere centre (local) — modified in place
 * @param {THREE.Vector3} end     top sphere centre (local) — modified in place
 * @param {number} radius
 * @param {THREE.Vector3} up      unit "up" in the local frame (gravity opposite)
 * @param {number} [iterations=3]
 * @returns {typeof contact}
 */
export function resolveCapsule(bvh, start, end, radius, up, iterations = 3) {
  contact.delta.set(0, 0, 0);
  contact.ground = false;
  contact.wall = false;
  contact.groundNormal.set(0, 0, 0);
  contact.wallNormal.set(0, 0, 0);
  contact.groundTri = -1;
  contact.count = 0;
  if (!bvh) return contact;
  let bestUp = 0.5;
  for (let it = 0; it < iterations; it++) {
    _segment.start.copy(start);
    _segment.end.copy(end);
    _box.makeEmpty();
    _box.expandByPoint(start);
    _box.expandByPoint(end);
    _box.min.addScalar(-radius);
    _box.max.addScalar(radius);
    _start0.copy(start);
    let count = 0;
    bvh.shapecast({
      intersectsBounds: (box) => box.intersectsBox(_box),
      intersectsTriangle: (tri, triIndex) => {
        const distance = tri.closestPointToSegment(_segment, _triPoint, _capPoint);
        if (distance < radius) {
          const depth = radius - distance;
          _dir.subVectors(_capPoint, _triPoint);
          const len = _dir.length();
          if (len < 1e-7) {
            // Segment touches the triangle plane exactly — use the face normal.
            if (tri.needsUpdate) tri.update();
            _dir.copy(tri.plane.normal);
          } else {
            _dir.multiplyScalar(1 / len);
          }
          _segment.start.addScaledVector(_dir, depth);
          _segment.end.addScaledVector(_dir, depth);
          const upDot = _dir.dot(up);
          if (upDot > 0.5) {
            contact.ground = true;
            contact.groundNormal.add(_dir);
            if (upDot > bestUp) { bestUp = upDot; contact.groundTri = triIndex; }
          } else if (upDot > -0.3) {
            contact.wall = true;
            contact.wallNormal.add(_dir);
          }
          count++;
        }
        return false;
      },
    });
    contact.count = count;
    start.copy(_segment.start);
    end.copy(_segment.end);
    contact.delta.add(_segment.start).sub(_start0);
    if (count === 0) break;
  }
  if (contact.ground) contact.groundNormal.normalize();
  if (contact.wall) contact.wallNormal.normalize();
  return contact;
}

/** Reused hit record for the ray helpers. */
export const rayHit = { hit: false, distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), faceIndex: -1 };

/**
 * First BVH hit along a ray (local frame).
 * @returns {typeof rayHit}
 */
export function castRay(bvh, origin, direction, far = 4, near = 0) {
  rayHit.hit = false;
  rayHit.faceIndex = -1;
  if (!bvh) return rayHit;
  _ray.origin.copy(origin);
  _ray.direction.copy(direction);
  const hit = bvh.raycastFirst(_ray, THREE.DoubleSide, near, far);
  if (!hit) return rayHit;
  rayHit.hit = true;
  rayHit.distance = hit.distance;
  rayHit.point.copy(hit.point);
  rayHit.faceIndex = hit.faceIndex;
  if (hit.face && hit.face.normal) {
    _normal.copy(hit.face.normal);
    if (_normal.dot(direction) > 0) _normal.negate();
    rayHit.normal.copy(_normal);
  } else {
    rayHit.normal.copy(direction).negate();
  }
  return rayHit;
}

/**
 * True if the capsule (start/end bottom & top sphere centres) overlaps any triangle — used to test
 * head-room before standing up from a crouch. Does not modify the inputs.
 */
export function capsuleOverlaps(bvh, start, end, radius) {
  if (!bvh) return false;
  _segment.start.copy(start);
  _segment.end.copy(end);
  _box.makeEmpty();
  _box.expandByPoint(start);
  _box.expandByPoint(end);
  _box.min.addScalar(-radius);
  _box.max.addScalar(radius);
  return bvh.shapecast({
    intersectsBounds: (box) => box.intersectsBox(_box),
    intersectsTriangle: (tri) => tri.closestPointToSegment(_segment, _triPoint, _capPoint) < radius,
  });
}

// ---------------------------------------------------------------------------------------------
// Dynamic blockers: door leaves (thin boxes that move) are kept out of the static BVH and resolved
// here. `matrix` places the box (its geometry bounding box) in the capsule's frame.
// ---------------------------------------------------------------------------------------------
const _bInv = new THREE.Matrix4();
const _bs = new THREE.Vector3(), _be = new THREE.Vector3(), _bp = new THREE.Vector3(), _bq = new THREE.Vector3(), _bd = new THREE.Vector3();
const _bMin = new THREE.Vector3(), _bMax = new THREE.Vector3();

/**
 * Push a capsule (start → end, radius) out of an oriented box. Returns true when it moved the
 * capsule; `push` (optional Vector3) receives the applied translation in the capsule's frame.
 */
export function resolveCapsuleBox(start, end, radius, box, matrix, push = null) {
  _bInv.copy(matrix).invert();
  _bs.copy(start).applyMatrix4(_bInv);
  _be.copy(end).applyMatrix4(_bInv);
  _bMin.copy(box.min); _bMax.copy(box.max);
  // closest point on the segment to the box: alternate clamping a few times
  _bp.lerpVectors(_bs, _be, 0.5);
  for (let i = 0; i < 4; i++) {
    _bq.copy(_bp).clamp(_bMin, _bMax);
    _bd.subVectors(_be, _bs);
    const l2 = _bd.lengthSq();
    const t = l2 > 1e-9 ? THREE.MathUtils.clamp(_bq.clone().sub(_bs).dot(_bd) / l2, 0, 1) : 0;
    _bp.lerpVectors(_bs, _be, t);
  }
  _bq.copy(_bp).clamp(_bMin, _bMax);
  _bd.subVectors(_bp, _bq);
  const d = _bd.length();
  if (d > 1e-6) {
    if (d >= radius) return false;
    _bd.multiplyScalar((radius - d) / d);
  } else {
    // the segment passes through the slab: leave by the nearest face
    let best = Infinity, axis = 0, sign = 1;
    for (let a = 0; a < 3; a++) {
      const c = a === 0 ? _bp.x : a === 1 ? _bp.y : _bp.z;
      const lo = a === 0 ? _bMin.x : a === 1 ? _bMin.y : _bMin.z, hi = a === 0 ? _bMax.x : a === 1 ? _bMax.y : _bMax.z;
      if (c - lo < best) { best = c - lo; axis = a; sign = -1; }
      if (hi - c < best) { best = hi - c; axis = a; sign = 1; }
    }
    if (axis === 1) return false;                       // never pop through floors/lintels vertically
    _bd.set(0, 0, 0);
    if (axis === 0) _bd.x = sign * (best + radius); else _bd.z = sign * (best + radius);
  }
  // the push is a vector in box space: rotate it into the capsule frame, keeping its length
  const len = _bd.length() * matrix.getMaxScaleOnAxis();
  _bd.transformDirection(matrix).multiplyScalar(len);
  return applyPush(start, end, _bd, push);
}

function applyPush(start, end, v, push) {
  start.add(v); end.add(v);
  if (push) push.add(v);
  return true;
}
