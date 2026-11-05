/**
 * Small cinematic pieces owned by the SinkingDirector: the iceberg pass at the strike, the
 * collapse of funnel No. 1, and props sliding down the tilted decks.
 */
import * as THREE from 'three';
import { DEG, clamp, easeInQuad } from './Timeline.js';

const _w = new THREE.Vector3();
const _g = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _local = new THREE.Vector3();

// ------------------------------------------------------------------------------------ iceberg
export class IcebergPass {
  constructor({ ship, world }) {
    this.ship = ship; this.world = world;
    this.t = 0; this.active = false; this.done = false;
    this.seconds = 10;
    this.start = new THREE.Vector3(120, 0, 25);
    this.end = new THREE.Vector3(-230, 0, 34);
  }

  trigger() {
    if (this.active || this.done) return;
    const w = this.world;
    if (!w) { this.done = true; return; }
    _local.copy(this.start);
    const wp = this.ship.group.localToWorld(_local.clone());
    wp.y = 0;
    try {
      if (typeof w.spawnIceberg === 'function') { const r = w.spawnIceberg(wp); if (r && r.isObject3D && !w.iceberg) w.iceberg = r; }
    } catch (err) { console.warn('[sinking] spawnIceberg failed', err); }
    this.active = true; this.t = 0;
    this._place(0);
  }

  _place(u) {
    const berg = this.world && this.world.iceberg;
    if (!berg || !berg.position) return;
    _local.lerpVectors(this.start, this.end, u);
    const wp = this.ship.group.localToWorld(_local.clone());
    berg.position.set(wp.x, 0, wp.z);
    if (berg.rotation) berg.rotation.y = -0.15 * u;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const u = clamp(this.t / this.seconds, 0, 1);
    this._place(u);
    if (u >= 1) { this.active = false; this.done = true; }
  }
}

// ------------------------------------------------------------------------------------ funnel 1
export class FunnelCollapse {
  constructor({ ship, bus }) {
    this.ship = ship; this.bus = bus;
    this.funnel = null; this.q0 = null;
    this.t = 0; this.stage = 'idle';      // idle | falling | sinking | done
    this.fallSeconds = 2.5;
    this.maxAngle = 82 * DEG;
    // the top moves toward +x (forward) and +z (starboard): axis = (1, 0, -1) in the deck plane
    this.axis = new THREE.Vector3(1, 0, -1).normalize();
  }

  trigger() {
    if (this.stage !== 'idle') return;
    const f = this.ship && Array.isArray(this.ship.funnels) ? this.ship.funnels[0] : null;
    if (!f || !f.isObject3D) { this.stage = 'done'; this._emit(); return; }
    this.funnel = f;
    this.q0 = f.quaternion.clone();
    this.t = 0;
    this.stage = 'falling';
  }

  _emit() {
    if (!this.bus) return;
    this.bus.emit('sinking:event', { id: 'funnel1' });
    this.bus.emit('camera:shake', { intensity: 1.5, seconds: 2 });
  }

  update(dt, force = false) {
    if (this.stage === 'idle' || this.stage === 'done') return;
    const f = this.funnel;
    this.t += dt;
    if (this.stage === 'falling') {
      const u = force ? 1 : clamp(this.t / this.fallSeconds, 0, 1);
      _q.setFromAxisAngle(this.axis, this.maxAngle * easeInQuad(u));
      f.quaternion.copy(this.q0).premultiply(_q);
      if (u >= 1) {
        this.stage = 'sinking'; this.t = 0;
        let root = f; while (root.parent && !root.parent.isScene) root = root.parent;
        const scene = root.parent && root.parent.isScene ? root.parent : null;
        if (scene) scene.attach(f);
        f.getWorldPosition(_w);
        this._pos = _w.clone();
        this._emit();
      }
      return;
    }
    if (this.stage === 'sinking') {
      // the fallen funnel drifts clear to starboard and goes under
      const u = force ? 1 : this.t;
      if (f.parent && f.parent.isScene) {
        f.position.set(this._pos.x + 3 * Math.min(u, 8), this._pos.y - 2.2 * u, this._pos.z + 2 * Math.min(u, 8));
        f.rotation.z -= 0.15 * dt;
      } else {
        f.visible = false;
      }
      f.getWorldPosition(_w);
      if (force || _w.y < -45) { f.visible = false; this.stage = 'done'; }
    }
  }
}

// ------------------------------------------------------------------------------------ props
const FRICTION = { deckchair: 0.55, crate: 0.45, barrel: 0.85, boat: 0.4, piano: 0.6, misc: 0.5 };
const SLIDE_START_SIN = Math.sin(8 * DEG);

export class PropSlider {
  constructor({ ship }) {
    this.ship = ship;
    this.items = [];
    for (const d of (ship && Array.isArray(ship.dynamic) ? ship.dynamic : [])) {
      if (!d || !d.object || !d.object.isObject3D) continue;
      this.items.push({ object: d.object, kind: d.kind || 'misc', mass: d.mass || 10, v: 0, travelled: 0, done: false, dir: new THREE.Vector3() });
    }
  }

  update(dt) {
    if (!this.items.length || dt <= 0) return;
    for (const it of this.items) {
      if (it.done) continue;
      const o = it.object;
      const parent = o.parent;
      if (!parent) { it.done = true; continue; }
      // gravity expressed in the parent's frame; the deck plane is the parent's y = 0 plane
      _q.setFromRotationMatrix(parent.matrixWorld).invert();
      _g.set(0, -1, 0).applyQuaternion(_q);
      const planar = Math.hypot(_g.x, _g.z);          // = sin(slope)
      if (planar < SLIDE_START_SIN && it.v <= 0) continue;
      if (planar > 1e-4) it.dir.set(_g.x / planar, 0, _g.z / planar);
      // v += g * sin(slope) * dt * friction (friction = how freely the item slides, 0..1);
      // below the 8° threshold the item only decelerates until it stops.
      const mu = FRICTION[it.kind] ?? 0.5;
      const accel = planar >= SLIDE_START_SIN ? 9.81 * planar * mu : -9.81 * 0.3;
      it.v = Math.max(0, Math.min(12, it.v + accel * dt));
      if (it.v <= 0) continue;
      const step = Math.min(it.v * dt, 6);
      o.position.addScaledVector(it.dir, step);
      it.travelled += step;
      o.getWorldPosition(_w);
      if (it.travelled > 60 || _w.y < 0) { o.visible = false; it.done = true; }
    }
  }
}
