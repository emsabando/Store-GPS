/**
 * Lifeboat launches. For each `ship.lifeboats[]` entry { id, object, davit, side, x, launchTime }
 * whose launch time has passed: swing the boat 2 m outboard (10 s), lower it ~20 m down the falls to
 * the water (60 s), detach it from the ship (scene.attach), set it on the ocean and row it away at
 * 0.6 m/s on its own side, bobbing on `world.ocean.heightAt`.
 *
 * Every stage is a pure function of the game clock ("sequence seconds" = game minutes since the
 * launch ÷ the base clock speed), so `jumpTo()` lands every boat in the right place.
 */
import * as THREE from 'three';
import { hhmmToMinutesAfter, smoothstep, clamp } from './Timeline.js';

/** Historical launch order with default times (HH:MM), used when the spec carries none. */
export const DEFAULT_LAUNCH_ORDER = [7, 5, 3, 8, 1, 6, 16, 14, 12, 9, 11, 13, 15, 2, 10, 4];
export const DEFAULT_LAUNCH_TIMES = (() => {
  const out = {};
  const first = hhmmToMinutesAfter('00:45'), last = hhmmToMinutesAfter('01:50');
  DEFAULT_LAUNCH_ORDER.forEach((n, i) => { out[String(n)] = first + (last - first) * (i / (DEFAULT_LAUNCH_ORDER.length - 1)); });
  out.C = hhmmToMinutesAfter('02:00');
  out.D = hhmmToMinutesAfter('02:05');
  out.A = hhmmToMinutesAfter('02:15');
  out.B = hhmmToMinutesAfter('02:15');
  return out;
})();

export const SWING_SECONDS = 10;
export const LOWER_SECONDS = 60;
export const ROW_SPEED = 0.6;

const normId = (id) => String(id ?? '').replace(/^(life)?boat[_\-\s]?/i, '').replace(/^collapsible[_\-\s]?/i, '').toUpperCase();

const _w = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export class LifeboatLauncher {
  constructor({ ship, world, spec, bus, scene }) {
    this.ship = ship;
    this.world = world;
    this.bus = bus;
    this.scene = scene || null;
    this.boats = [];
    this.launched = [];       // boats that have left the davits (still lowering) or are afloat
    this._specTimes = new Map();
    for (const b of (spec && Array.isArray(spec.lifeboats) ? spec.lifeboats : [])) {
      if (!b) continue;
      const t = hhmmToMinutesAfter(b.launchTime);
      if (t !== null) this._specTimes.set(normId(b.id ?? b.n ?? b.number), t);
    }
    this._collect();
  }

  _collect() {
    const list = (this.ship && Array.isArray(this.ship.lifeboats)) ? this.ship.lifeboats : [];
    list.forEach((lb, i) => {
      if (!lb || !lb.object || !lb.object.isObject3D) return;
      const key = normId(lb.id ?? i + 1);
      let launchAt = hhmmToMinutesAfter(lb.launchTime);
      if (launchAt === null && this._specTimes.has(key)) launchAt = this._specTimes.get(key);
      if (launchAt === null && key in DEFAULT_LAUNCH_TIMES) launchAt = DEFAULT_LAUNCH_TIMES[key];
      if (launchAt === null) launchAt = DEFAULT_LAUNCH_TIMES[String(DEFAULT_LAUNCH_ORDER[i % DEFAULT_LAUNCH_ORDER.length])];
      let sideSign = 0;
      const s = String(lb.side || '').toLowerCase();
      if (s.startsWith('p')) sideSign = -1; else if (s.startsWith('s')) sideSign = 1;
      if (!sideSign) sideSign = (lb.object.position.z || (typeof lb.z === 'number' ? lb.z : 1)) < 0 ? -1 : 1;
      this.boats.push({
        id: lb.id ?? key, key, object: lb.object, davit: lb.davit || null, sideSign, launchAt,
        status: 'stowed', p0: null, dropM: 20, detachAt: null, anchor: null, dir: null, yaw: 0, phase: Math.random() * Math.PI * 2,
      });
    });
    this.boats.sort((a, b) => a.launchAt - b.launchAt);
  }

  _seaY(x, z) {
    const o = this.world && this.world.ocean;
    if (o && typeof o.heightAt === 'function') { const h = o.heightAt(x, z); return Number.isFinite(h) ? h : 0; }
    return 0;
  }

  _findScene() {
    if (this.scene) return this.scene;
    let o = this.ship && this.ship.group;
    while (o && o.parent) o = o.parent;
    return o && o.isScene ? o : null;
  }

  /**
   * @param {number} minutesAfter game minutes since the strike
   * @param {number} speed base clock speed (game-min per real-s) used to convert to sequence seconds
   * @param {number} elapsed real seconds (for bobbing)
   */
  update(minutesAfter, speed, elapsed) {
    const toSeconds = 1 / Math.max(1e-6, speed);
    for (const b of this.boats) {
      if (b.status === 'done') continue;
      const ts = (minutesAfter - b.launchAt) * toSeconds;
      if (ts < 0) continue;
      if (b.status === 'stowed') this._begin(b);
      if (b.status === 'lowering') this._lower(b, ts);
      if (b.status === 'afloat') this._row(b, ts, elapsed);
    }
  }

  _begin(b) {
    const obj = b.object;
    b.p0 = obj.position.clone();
    b.q0 = obj.quaternion.clone();
    obj.getWorldPosition(_w);
    const sea = this._seaY(_w.x, _w.z);
    b.dropM = clamp(_w.y - sea + 0.3, 3, 60);
    b.status = 'lowering';
    this.launched.push(b);
    if (this.bus) this.bus.emit('sinking:event', { id: 'lifeboat', boat: b.id, stage: 'launch' });
  }

  _lower(b, ts) {
    const obj = b.object;
    const swing = 2 * smoothstep(0, SWING_SECONDS, ts) * b.sideSign;
    const down = ts <= SWING_SECONDS ? 0 : b.dropM * clamp((ts - SWING_SECONDS) / LOWER_SECONDS, 0, 1);
    obj.position.set(b.p0.x, b.p0.y - down, b.p0.z + swing);
    obj.updateMatrixWorld(true);
    obj.getWorldPosition(_w);
    const sea = this._seaY(_w.x, _w.z);
    if (ts >= SWING_SECONDS + LOWER_SECONDS || _w.y <= sea + 0.3) this._detach(b, ts);
  }

  _detach(b, ts) {
    const obj = b.object;
    const scene = this._findScene();
    obj.getWorldPosition(_w);
    if (scene && obj.parent !== scene) scene.attach(obj);
    b.anchor = new THREE.Vector3(_w.x, 0, _w.z);
    // row away along the ship's own side (world direction of ship-local ±z), slightly aft
    const g = this.ship.group;
    _d.set(-0.25, 0, b.sideSign);
    g.getWorldQuaternion(_q);
    _d.applyQuaternion(_q); _d.y = 0;
    if (_d.lengthSq() < 1e-6) _d.set(0, 0, b.sideSign);
    _d.normalize();
    b.dir = _d.clone();
    // keep the hull's heading (boats drift parallel to the ship)
    _e.setFromQuaternion(_q, 'YXZ');
    b.yaw = _e.y;
    b.detachAt = ts;
    b.status = 'afloat';
    if (this.bus) this.bus.emit('sinking:event', { id: 'lifeboat', boat: b.id, stage: 'afloat' });
  }

  _row(b, ts, elapsed) {
    const obj = b.object;
    const dist = Math.min(900, ROW_SPEED * Math.max(0, ts - b.detachAt));
    const x = b.anchor.x + b.dir.x * dist, z = b.anchor.z + b.dir.z * dist;
    const bob = 0.12 * Math.sin(elapsed * 0.9 + b.phase);
    const y = this._seaY(x, z) + bob;
    _w.set(x, y, z);
    if (obj.parent && !obj.parent.isScene) obj.parent.worldToLocal(_w);
    obj.position.copy(_w);
    if (!obj.parent || obj.parent.isScene) {
      _e.set(0.03 * Math.sin(elapsed * 0.7 + b.phase), b.yaw, 0.05 * Math.sin(elapsed * 1.1 + b.phase), 'YXZ');
      obj.quaternion.setFromEuler(_e);
    }
  }

  /** Boats currently afloat (for the HUD / tests). */
  get afloat() { return this.boats.filter((b) => b.status === 'afloat'); }
}
