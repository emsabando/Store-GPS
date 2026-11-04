// STUB — replaced by the Player engineer (ARCHITECTURE.md §7). Fly-camera with no collision.
import * as THREE from 'three';
export class PlayerController {
  constructor({ engine, input, ship, settings, bus }) { this.engine = engine; this.input = input; this.ship = ship; this.settings = settings; this.bus = bus; this.position = new THREE.Vector3(0, 20, 0); this.yaw = 0; this.pitch = 0; this.enabled = false; this.mode = 'first'; this.currentDeck = 'boat'; this.heading = 0; this.interactTarget = null; this.onGround = true; this.inWater = false; this.sitting = false; this.inside = false; this.speed = 0; }
  setMode(m) { this.mode = m; }
  teleportLocal(x, y, z, yaw = 0) { this.position.copy(this.ship.localToWorld(new THREE.Vector3(x, y + 1.65, z))); this.yaw = yaw; }
  teleportTo(loc) { this.teleportLocal(loc.x, loc.y, loc.z, loc.yaw); }
  update(dt) {
    const i = this.input, s = this.settings.get('sensitivity') || 1;
    if (i.locked) { this.yaw -= i.mouse.dx * 0.002 * s; this.pitch -= i.mouse.dy * 0.002 * s * (this.settings.get('invertY') ? -1 : 1); this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch)); }
    const fwd = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const v = new THREE.Vector3(); if (i.isDown('KeyW')) v.add(fwd); if (i.isDown('KeyS')) v.sub(fwd); if (i.isDown('KeyD')) v.add(right); if (i.isDown('KeyA')) v.sub(right); if (i.isDown('KeyE') || i.isDown('Space')) v.y += 1; if (i.isDown('KeyQ')) v.y -= 1;
    const sp = i.isDown('ShiftLeft') ? 8 : 3; if (v.lengthSq() > 0) this.position.addScaledVector(v.normalize(), sp * dt); this.speed = v.length() * sp;
    this.engine.camera.position.copy(this.position); this.engine.camera.rotation.set(0, 0, 0, 'YXZ'); this.engine.camera.rotation.y = this.yaw - Math.PI / 2; this.engine.camera.rotation.x = this.pitch;
    this.heading = ((-this.yaw * 180 / Math.PI) % 360 + 360) % 360; this.currentDeck = this.ship.deckAt(this.ship.worldToLocal(this.position).y - 1.65);
  }
  sit() {}
}
