// STUB — replaced by the Player engineer (ARCHITECTURE.md §7).
import * as THREE from 'three';
export function makeCharacter(materials, look = {}) {
  const group = new THREE.Group(); const h = look.height || 1.75;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, h - 0.5, 4, 8), materials.get((look.top && look.top.color) ? 'clothNavy' : 'clothBlack')); body.position.y = h / 2; group.add(body);
  return { group, height: h, update() {}, setPose() {}, setLookTarget() {} };
}
