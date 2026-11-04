// STUB — replaced by the owning engineer. See ARCHITECTURE.md §5.
import * as THREE from 'three';
export function buildHull(spec, materials, ctx) {
  const group = new THREE.Group();
  group.name = 'buildHull';
  return { group, locations: [], lights: [], dynamic: [], interactables: [], floodRooms: [] };
}
export function hullHalfBreadth(spec, x, y) {
  const b = (spec.dims && spec.dims.beamMoulded) || 28.2;
  return b / 2;
}
