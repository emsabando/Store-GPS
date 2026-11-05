/**
 * PlayerController — first/third-person walker with capsule collision against the ship's static
 * BVH (ARCHITECTURE.md §7, §11). The player lives in WORLD space; every frame the capsule is
 * transformed into the local frame of the ship part under it (`ship.partAt`), integrated and
 * resolved there, and transformed back — so the tilting, sinking, broken ship "just works".
 *
 *   const player = new PlayerController({ engine, input, ship, settings, bus, materials });
 *   player.update(dt);
 *
 * `player.position` is the FEET point (capsule base) in world space; the eye sits `eyeHeight`
 * above it along world up. `teleportLocal(x, y, z, yaw)` places the feet at that ship-local point.
 */
import * as THREE from 'three';
import { resolveCapsule, castRay, capsuleOverlaps } from './CapsuleCollider.js';
import { PlayerInteraction } from './PlayerInteraction.js';
import { makeCharacter } from './Character.js';

const RADIUS = 0.3;
const HEIGHT = 1.75;
const EYE = 1.65;
const CROUCH_HEIGHT = 1.2;
const CROUCH_EYE = 1.1;
const SIT_EYE = 1.22;
const WALK = 1.6;
const RUN = 4.2;
const SWIM = 1.0;
const SWIM_FAST = 1.7;
const STEP_UP = 0.35;
const GRAVITY = 9.81;
const MAX_FALL = 14;
const JUMP_HEIGHT = 0.3;
const MAX_SUBSTEPS = 5;
const SUBSTEP_DT = 1 / 60;
const STRIDE = 0.7;
const DEG = 180 / Math.PI;

export const DEFAULT_LOOK = {
  sex: 'm', skin: '#e0b89a',
  hair: { color: '#3a2a1a', style: 'short' },
  hat: 'none',
  top: { color: '#23262e', kind: 'suit' },
  bottom: { color: '#23262e', kind: 'trousers' },
  accent: '#6b1f2a', height: 1.75,
};

// ---- reusable temporaries (no per-frame allocation) ----
const _inv = new THREE.Matrix4();
const _rot = new THREE.Matrix3();
const _rotInv = new THREE.Matrix3();
const _posL = new THREE.Vector3();
const _velL = new THREE.Vector3();
const _upL = new THREE.Vector3();
const _start = new THREE.Vector3();
const _end = new THREE.Vector3();
const _before = new THREE.Vector3();
const _try = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _world = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _down = new THREE.Vector3(0, -1, 0);
const _wallN = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class PlayerController {
  constructor({ engine, input, ship, settings, bus, materials, world = null }) {
    this.engine = engine;
    this.input = input;
    this.ship = ship;
    this.settings = settings;
    this.bus = bus;
    this.materials = materials;
    this.world = world;

    /** world-space feet position */
    this.position = new THREE.Vector3(0, 20, 0);
    /** world-space velocity (m/s) */
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.enabled = false;
    this.mode = settings.get('viewMode') === 'third' ? 'third' : 'first';
    this.radius = RADIUS;
    this.height = HEIGHT;
    this.eyeHeight = EYE;
    this.currentDeck = null;
    this.heading = 0;
    this.interactTarget = null;
    this.onGround = false;
    this.inWater = false;
    this.swimming = false;
    this.submerged = false;
    this.sitting = false;
    this.inside = false;
    this.crouching = false;
    this.speed = 0;
    /** shake state driven by camera:shake */
    this.shake = { intensity: 0, seconds: 0, t: 0 };

    this._wasGround = false;
    this._groundTri = -1;
    this._jumpCooldown = 0;
    this._anchor = new THREE.Vector3();
    this._anchorGroup = null;
    this._anchored = false;
    this._stepAcc = 0;
    this._bobPhase = 0;
    this._bobAmp = 0;
    this._insideTimer = 0;
    this._drownTimer = 0;
    this._promptLabel = undefined;
    this._promptObj = undefined;
    this._seat = null;
    this._saved = null;
    this._trimDeg = 0;
    this._floodWorldY = null;
    this._fovBase = settings.get('fov') || 75;
    this._fovKick = 0;
    this._surfaceCache = { t: 0, name: 'steel' };
    this._surfaceRay = new THREE.Raycaster();
    this._surfaceRay.far = 1.2;
    this._surfaceRay.firstHitOnly = true;
    this._surfaceHits = [];
    this._cameraRoll = 0;
    this._smoothSpeed = 0;
    this._eyeCurrent = EYE;
    this._heightCurrent = HEIGHT;

    this.interaction = new PlayerInteraction({ engine, ship, range: 3.0 });

    // Third-person avatar (hidden in first-person / free mode).
    this.character = null;
    try {
      this.character = makeCharacter(materials, DEFAULT_LOOK);
      this.character.group.name = 'PlayerCharacter';
      this.character.group.visible = this.mode === 'third';
      engine.scene.add(this.character.group);
    } catch (err) { console.warn('[player] character failed', err); this.character = null; }

    engine.camera.fov = this._fovBase;
    engine.camera.updateProjectionMatrix();

    this._offs = [
      bus.on('camera:shake', (p) => this.addShake(p)),
      bus.on('sinking:state', (p) => this._onSinking(p)),
      settings.onChange((key, value) => {
        if (key === 'fov') { this._fovBase = value; }
        if (key === 'viewMode' && this.mode !== 'free' && (value === 'first' || value === 'third')) this.setMode(value);
      }),
    ];
  }

  // ------------------------------------------------------------------ public API

  /** Eye point in world space (reused vector). */
  get eyePosition() { return _world.copy(this.position).addScaledVector(WORLD_UP, this._eyeCurrent); }

  setMode(mode) {
    if (mode !== 'first' && mode !== 'third' && mode !== 'free') return;
    if (mode === this.mode) return;
    if (mode === 'free') {
      this._saved = { pos: this.position.clone(), yaw: this.yaw, pitch: this.pitch, from: this.mode };
      this.position.copy(this.eyePosition);
    } else if (this.mode === 'free' && this._saved) {
      this.position.copy(this._saved.pos);
      this._saved = null;
      this.velocity.set(0, 0, 0);
    }
    this.mode = mode;
    if (this.character) this.character.group.visible = mode === 'third';
  }

  teleportLocal(x, y, z, yaw = 0) {
    // step off furniture: landmarks sit at room centres, where a table may stand
    if (this.ship && typeof this.ship.findStandable === 'function') { const s = this.ship.findStandable(x, y, z); if (s) { x = s.x; z = s.z; } }
    _tmp.set(x, y, z);
    this.ship.group.updateMatrixWorld(true);
    this.ship.group.localToWorld(_tmp);
    if (this.mode === 'free') _tmp.y += EYE;
    this.position.copy(_tmp);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.sitting = false;
    this._seat = null;
    this._anchored = false;
    this._wasGround = false;
    this._jumpCooldown = 0;
    this.shake.t = 0;
    if (this.character) this.character.setPose('idle');
    this._updateDeck(true);
    this.refreshInside();
  }

  /** Recompute `inside` now (after a teleport, or from the free-camera timer) instead of waiting for the walk update. */
  refreshInside() {
    this._insideTimer = 0.15;
    const part = this.ship && this.ship.partAt ? this.ship.partAt(this.position) : null;
    if (!(part && part.group && part.bvh)) { this.inside = false; return false; }
    part.group.updateMatrixWorld(true);
    _inv.copy(part.group.matrixWorld).invert();
    _tmp.copy(this.position).addScaledVector(WORLD_UP, this.mode === 'free' ? 0 : this._eyeCurrent).applyMatrix4(_inv);
    _upL.set(0, 1, 0).transformDirection(_inv);
    this.inside = this._probeInside(part.bvh);
    return this.inside;
  }

  /**
   * Under cover = any ceiling above the eye (a corridor at 2.4 m, a boiler room at 15 m); the open
   * decks, the wells and the sea find nothing overhead. `_tmp` must hold the eye in ship-local space.
   */
  _probeInside(bvh) {
    if (!bvh) return false;
    const hit = castRay(bvh, _tmp, _upL, 40.0);
    return !!hit.hit;
  }

  /** Teleport in WORLD space (exterior free-camera landmarks: the sea does not sink with the ship). */
  teleportWorld(x, y, z, yaw = 0) {
    this.position.set(x, y, z);
    if (this.mode === 'free') this.position.y += 0;   // free mode holds the eye point itself
    this.velocity.set(0, 0, 0);
    this.yaw = yaw; this.pitch = 0;
    this.sitting = false; this._seat = null; this._anchored = false; this._wasGround = false; this._jumpCooldown = 0; this.shake.t = 0;
    this._updateDeck(true);
    this.refreshInside();
  }

  teleportTo(loc) {
    if (!loc) return;
    this.teleportLocal(loc.x || 0, (loc.y ?? 0) + 0.1, loc.z || 0, loc.yaw || 0);
    if (typeof loc.pitch === 'number') this.pitch = loc.pitch;
    if (loc.mode) this.setMode(loc.mode);
  }

  /** Seat the player on an interactable of type 'sit' (object found via interactable.object, ship.interactables or the current target). */
  sit(interactable) {
    if (!interactable) return false;
    let object = interactable.object || null;
    if (!object && this.ship.interactables && interactable.id) {
      const entry = this.ship.interactables.get(interactable.id);
      if (entry && entry.object) object = entry.object;
    }
    if (!object && this.interaction.target && this.interaction.target.interactable === interactable) object = this.interaction.target.object;
    if (!object) return false;
    object.updateMatrixWorld(true);
    const data = interactable.data || {};
    _tmp.set(data.seatX || 0, data.seatY || 0, data.seatZ || 0);
    object.localToWorld(_tmp);
    // Face the seat's "front" (+z in prop convention) unless the data says otherwise.
    _fwd.set(0, 0, 1).transformDirection(object.matrixWorld);
    const yaw = typeof data.yaw === 'number' ? data.yaw : Math.atan2(-_fwd.z, _fwd.x);
    this._seat = { object, offset: new THREE.Vector3(data.seatX || 0, data.seatY || 0, data.seatZ || 0), yaw };
    this.position.copy(_tmp);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.sitting = true;
    this.crouching = false;
    this._anchored = false;
    if (this.character) this.character.setPose('sit');
    return true;
  }

  stand() {
    if (!this.sitting) return;
    this.sitting = false;
    this._seat = null;
    if (this.character) this.character.setPose('idle');
  }

  addShake({ intensity = 0.5, seconds = 0.8 } = {}) {
    if (this.settings.get('reduceMotion')) { intensity *= 0.35; }
    if (intensity * seconds >= this.shake.intensity * this.shake.t) {
      this.shake.intensity = intensity; this.shake.seconds = Math.max(0.05, seconds); this.shake.t = this.shake.seconds;
    }
  }

  dispose() {
    for (const off of this._offs) try { off(); } catch { /* ignore */ }
    this.interaction.dispose();
    if (this.character) this.engine.scene.remove(this.character.group);
  }

  // ------------------------------------------------------------------ frame

  update(dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    const enabled = this.enabled;
    if (enabled) this._look(dt);
    if (enabled && this.mode !== 'free' && (this.input.pressed('KeyF') || this.input.pressed('PadY'))) {
      const next = this.mode === 'first' ? 'third' : 'first';
      this.setMode(next);
      try { this.settings.set('viewMode', next); } catch { /* ignore */ }
    }
    if (this.mode === 'free') {
      this._updateFree(dt, enabled);
      this._insideTimer -= dt;
      if (this._insideTimer <= 0) this.refreshInside();
    } else {
      this._updateWalk(dt, enabled);
    }
    this._placeCamera(dt);
    if (enabled && this.mode !== 'free') this._updateInteraction(dt);
    else this._setPrompt(null, null);
  }

  // ------------------------------------------------------------------ look

  _look(dt) {
    const sens = this.settings.get('sensitivity') || 1;
    const inv = this.settings.get('invertY') ? -1 : 1;
    const m = this.input.mouse;
    if (this.input.locked) {
      this.yaw -= m.dx * 0.0022 * sens;
      this.pitch -= m.dy * 0.0022 * sens * inv;
    }
    const ax = this.input.axes;
    if (ax && (ax.rx || ax.ry)) {
      this.yaw -= ax.rx * 2.6 * sens * dt;
      this.pitch -= ax.ry * 2.0 * sens * inv * dt;
    }
    const lim = 89 / DEG;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2; else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  _forwardFlat(out) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  _rightFlat(out) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  /** Movement wish vector (world, horizontal, |v| ≤ 1) and run flag from keys/gamepad. */
  _wishDir(out) {
    const i = this.input;
    let x = 0, z = 0;
    if (i.isDown('KeyW') || i.isDown('ArrowUp')) x += 1;
    if (i.isDown('KeyS') || i.isDown('ArrowDown')) x -= 1;
    if (i.isDown('KeyD') || i.isDown('ArrowRight')) z += 1;
    if (i.isDown('KeyA') || i.isDown('ArrowLeft')) z -= 1;
    if (i.axes) { x += -i.axes.ly; z += i.axes.lx; }
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    this._forwardFlat(_fwd); this._rightFlat(_right);
    out.set(0, 0, 0).addScaledVector(_fwd, x).addScaledVector(_right, z);
    return len > 0.001;
  }

  _wantsRun() { const i = this.input; return i.isDown('ShiftLeft') || i.isDown('ShiftRight') || i.isDown('PadLS') || i.isDown('PadLB'); }
  _wantsJump() { const i = this.input; return i.pressed('Space') || i.pressed('PadA'); }
  _wantsCrouch() { const i = this.input; return i.isDown('KeyC') || i.isDown('PadB') || i.isDown('ControlLeft'); }

  // ------------------------------------------------------------------ free (photo) mode

  _updateFree(dt, enabled) {
    this.onGround = false; this.swimming = false; this.inWater = false; this.submerged = false;
    if (!enabled) { this.speed = 0; return; }
    const moving = this._wishDir(_wish);
    const i = this.input;
    let up = 0;
    if (i.isDown('KeyE') || i.isDown('Space') || i.isDown('PadA')) up += 1;
    if (i.isDown('KeyQ') || i.isDown('KeyC') || i.isDown('PadB')) up -= 1;
    const sp = this._wantsRun() ? 10 : 3;
    _tmp.set(0, 0, 0);
    if (moving) {
      // Fly along the actual view direction for forward/back, flat for strafe.
      _camFwd.set(Math.cos(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.sin(this.yaw) * Math.cos(this.pitch));
      const f = _wish.dot(_fwd), r = _wish.dot(_right);
      _tmp.addScaledVector(_camFwd, f).addScaledVector(_right, r);
    }
    _tmp.y += up;
    const k = 1 - Math.exp(-dt * 10);
    this.velocity.lerp(_tmp2.copy(_tmp).multiplyScalar(sp), k);
    this.position.addScaledVector(this.velocity, dt);
    this.speed = this.velocity.length();
  }

  // ------------------------------------------------------------------ walking / swimming

  _updateWalk(dt, enabled) {
    const ship = this.ship;
    // Ride the ship: re-derive the world position from last frame's local anchor.
    if (this._anchored && this._anchorGroup) {
      this._anchorGroup.updateMatrixWorld(true);
      this.position.copy(this._anchor);
      this._anchorGroup.localToWorld(this.position);
    }
    if (this.sitting && this._seat) {
      const s = this._seat;
      s.object.updateMatrixWorld(true);
      this.position.copy(s.offset);
      s.object.localToWorld(this.position);
    }

    const part = ship.partAt(this.position) || { group: ship.group, bvh: null };
    const group = part.group;
    const bvh = part.bvh;
    group.updateMatrixWorld(true);
    _inv.copy(group.matrixWorld).invert();
    _rot.setFromMatrix4(group.matrixWorld);
    _rotInv.setFromMatrix4(_inv);
    _upL.copy(WORLD_UP).applyMatrix3(_rotInv).normalize();

    // ---- input → desired horizontal velocity (world) ----
    let moving = false, run = false;
    _wish.set(0, 0, 0);
    if (enabled) {
      moving = this._wishDir(_wish);
      run = this._wantsRun();
      if (this.sitting && (moving || this._wantsJump() || this._wantsCrouch())) this.stand();
    }
    if (this.sitting) { moving = false; _wish.set(0, 0, 0); }

    // ---- water state ----
    const waterY = this._waterLevel();
    const chestY = this.position.y + 1.25;
    const wasSwimming = this.swimming;
    this.swimming = chestY < waterY;
    this.inWater = this.swimming;
    if (this.swimming && this.sitting) this.stand();

    // ---- crouch (hold) with head-room check when standing back up ----
    const wantCrouch = enabled && !this.swimming && !this.sitting && this._wantsCrouch();
    if (wantCrouch) this.crouching = true;
    else if (this.crouching) {
      _posL.copy(this.position).applyMatrix4(_inv);
      _start.copy(_posL).addScaledVector(_upL, RADIUS);
      _end.copy(_posL).addScaledVector(_upL, HEIGHT - RADIUS);
      if (!capsuleOverlaps(bvh, _start, _end, RADIUS * 0.95)) this.crouching = false;
    }
    const targetH = this.swimming ? HEIGHT : (this.crouching ? CROUCH_HEIGHT : HEIGHT);
    const targetEye = this.sitting ? SIT_EYE : (this.crouching ? CROUCH_EYE : EYE);
    const kh = 1 - Math.exp(-dt * 10);
    this._heightCurrent += (targetH - this._heightCurrent) * kh;
    this._eyeCurrent += (targetEye - this._eyeCurrent) * kh;
    this.height = this._heightCurrent;
    this.eyeHeight = this._eyeCurrent;

    // ---- horizontal velocity smoothing (world) ----
    const maxSpeed = this.swimming ? (run ? SWIM_FAST : SWIM) : (run ? RUN : (this.crouching ? WALK * 0.6 : WALK));
    _tmp.copy(_wish).multiplyScalar(moving ? maxSpeed : 0);
    const hv = _tmp2.set(this.velocity.x, 0, this.velocity.z);
    const accel = this.swimming ? 3 : (this.onGround ? (moving ? 14 : 18) : 4);
    const ka = 1 - Math.exp(-dt * accel);
    hv.lerp(_tmp, ka);
    const hl = hv.length();
    if (hl > maxSpeed) hv.multiplyScalar(maxSpeed / hl);
    this.velocity.x = hv.x; this.velocity.z = hv.z;

    // ---- jump ----
    this._jumpCooldown = Math.max(0, this._jumpCooldown - dt);
    const canJump = enabled && this.onGround && !this.swimming && !this.sitting && !this.crouching && Math.abs(this._trimDeg) <= 15 && this._jumpCooldown <= 0;
    let jumped = false;
    if (canJump && this._wantsJump()) {
      this.velocity.y = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
      this._jumpCooldown = 0.25;
      jumped = true;
    }

    // ---- integrate in the part-local frame with sub-steps ----
    _posL.copy(this.position).applyMatrix4(_inv);
    _velL.copy(this.velocity).applyMatrix3(_rotInv);
    const wasGround = this.onGround && !jumped;
    const n = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / SUBSTEP_DT)));
    const sdt = dt / n;
    let ground = false;
    let groundTri = -1;
    let travelled = 0;
    const h = this._heightCurrent;
    for (let s = 0; s < n; s++) {
      if (this.sitting) break;
      if (this.swimming) {
        this._swimStep(sdt, group, enabled);
      } else {
        // gravity along local "down"
        _velL.addScaledVector(_upL, -GRAVITY * sdt);
        const vUp = _velL.dot(_upL);
        if (vUp < -MAX_FALL) _velL.addScaledVector(_upL, -MAX_FALL - vUp);
      }
      _before.copy(_posL);
      _posL.addScaledVector(_velL, sdt);
      _start.copy(_posL).addScaledVector(_upL, RADIUS);
      _end.copy(_posL).addScaledVector(_upL, h - RADIUS);
      const c = resolveCapsule(bvh, _start, _end, RADIUS, _upL, 3);
      _posL.copy(_start).addScaledVector(_upL, -RADIUS);
      // `c` is a shared record — copy what we need before any further resolve overwrites it.
      let stepGround = c.ground;
      let stepTri = c.groundTri;
      const hitWall = c.wall;
      _wallN.copy(c.wallNormal);
      // ---- step-up: horizontal move blocked while on the ground → retry 0.35 m higher, then settle ----
      if (wasGround && !this.swimming && hitWall) {
        _tmp.copy(_velL).addScaledVector(_upL, -_velL.dot(_upL)); // intended horizontal step
        const intended = _tmp.length() * sdt;
        if (intended > 1e-4) {
          _tmp2.subVectors(_posL, _before);
          _tmp2.addScaledVector(_upL, -_tmp2.dot(_upL));
          const achieved = _tmp2.dot(_tmp) / _tmp.length();
          if (achieved < intended * 0.6) {
            _try.copy(_before).addScaledVector(_upL, STEP_UP).addScaledVector(_tmp, sdt);
            _start.copy(_try).addScaledVector(_upL, RADIUS);
            _end.copy(_try).addScaledVector(_upL, h - RADIUS);
            resolveCapsule(bvh, _start, _end, RADIUS, _upL, 2);
            _try.copy(_start).addScaledVector(_upL, -RADIUS);
            // settle back down onto the step
            _try.addScaledVector(_upL, -STEP_UP);
            _start.copy(_try).addScaledVector(_upL, RADIUS);
            _end.copy(_try).addScaledVector(_upL, h - RADIUS);
            const c2 = resolveCapsule(bvh, _start, _end, RADIUS, _upL, 3);
            _try.copy(_start).addScaledVector(_upL, -RADIUS);
            _tmp2.subVectors(_try, _before);
            _tmp2.addScaledVector(_upL, -_tmp2.dot(_upL));
            const achieved2 = _tmp2.dot(_tmp) / _tmp.length();
            if (c2.ground && achieved2 > achieved + 1e-3) {
              _posL.copy(_try);
              stepGround = true;
              stepTri = c2.groundTri;
              const vu = _velL.dot(_upL);
              if (vu < 0) _velL.addScaledVector(_upL, -vu);
            }
          }
        }
      }
      // ---- velocity response to contacts ----
      if (stepGround) {
        ground = true;
        if (stepTri >= 0) groundTri = stepTri;
        const vu = _velL.dot(_upL);
        if (vu < 0) _velL.addScaledVector(_upL, -vu);
      }
      if (hitWall) {
        // slide along the wall (with or without ground contact)
        const d = _velL.dot(_wallN);
        if (d < 0) _velL.addScaledVector(_wallN, -d);
      }
      // ---- snap down onto stairs / slopes when walking off a step ----
      if (!stepGround && wasGround && !jumped && !this.swimming && _velL.dot(_upL) <= 0.01 && bvh) {
        _start.copy(_posL).addScaledVector(_upL, RADIUS);
        _tmp.copy(_upL).negate();
        const hit = castRay(bvh, _start, _tmp, STEP_UP + RADIUS + 0.05);
        if (hit.hit && hit.normal.dot(_upL) > 0.5) {
          _posL.addScaledVector(_upL, -(hit.distance - RADIUS));
          ground = true;
          groundTri = hit.faceIndex;
          const vu = _velL.dot(_upL);
          if (vu < 0) _velL.addScaledVector(_upL, -vu);
        }
      }
      if (ground || stepGround) {
        _tmp2.subVectors(_posL, _before);
        _tmp2.addScaledVector(_upL, -_tmp2.dot(_upL));
        travelled += _tmp2.length();
      }
    }

    // ---- back to world ----
    if (!this.sitting) {
      this.position.copy(_posL).applyMatrix4(group.matrixWorld);
      this.velocity.copy(_velL).applyMatrix3(_rot);
    }
    this.onGround = this.sitting ? true : ground;
    this._groundTri = groundTri;
    this._wasGround = this.onGround;
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    this.speed = this.sitting ? 0 : hs;

    // Anchor to the ship part when standing on it (or sitting / inside) so it carries us as it moves.
    this._anchored = this.onGround || this.sitting || (this.inside && !this.swimming);
    if (this._anchored) {
      this._anchorGroup = group;
      this._anchor.copy(this.position).applyMatrix4(_inv);
    } else this._anchorGroup = null;

    // ---- heading (ship frame: bow = 0°, starboard = 90°) ----
    this._forwardFlat(_fwd);
    this.ship.group.updateMatrixWorld(true);
    _tmp.copy(_fwd).transformDirection(_inv);
    let hd = Math.atan2(_tmp.z, _tmp.x) * DEG;
    if (hd < 0) hd += 360;
    this.heading = hd;

    // ---- deck / inside / water / footsteps / drowning ----
    this._updateDeck(false);
    this._insideTimer -= dt;
    if (this._insideTimer <= 0) {
      this._insideTimer = 0.15;
      _tmp.copy(this.position).addScaledVector(WORLD_UP, this._eyeCurrent).applyMatrix4(_inv);
      this.inside = this._probeInside(bvh);
    }
    const eyeY = this.position.y + this._eyeCurrent;
    this.submerged = eyeY < waterY;
    if (this.submerged) {
      this._drownTimer += dt;
      if (this._drownTimer >= 1) {
        this._drownTimer -= 1;
        this.bus.emit('player:drowning', { depth: waterY - eyeY });
      }
    } else this._drownTimer = 0;
    if (this.onGround && !this.swimming && travelled > 0) {
      this._stepAcc += travelled;
      const stride = run ? STRIDE * 1.25 : STRIDE;
      if (this._stepAcc >= stride) {
        this._stepAcc -= stride;
        this.bus.emit('player:footstep', { surface: this._surface(), running: run });
      }
    } else if (!this.onGround) this._stepAcc = STRIDE * 0.5;
    if (this.swimming && !wasSwimming) this.bus.emit('audio:play', { id: 'splash' });

    // ---- avatar ----
    if (this.character) {
      const ch = this.character;
      ch.group.position.copy(this.position);
      ch.group.rotation.set(0, this.yaw + Math.PI / 2, 0);
      if (!this.sitting) {
        const pose = this.swimming ? 'walk' : (this.speed > 0.15 ? 'walk' : 'idle');
        ch.setPose(pose);
      }
      ch.update(dt, this.speed, this.speed > 0.15);
    }
  }

  _swimStep(sdt, group, enabled) {
    // Buoyancy toward "head just above the surface"; C dives, Space surfaces.
    const e = group.matrixWorld.elements;
    const worldY = e[1] * _posL.x + e[5] * _posL.y + e[9] * _posL.z + e[13];
    const waterY = this._waterLevel();
    const targetEyeY = waterY + 0.25;
    const eyeY = worldY + this._eyeCurrent;
    let wantV = (targetEyeY - eyeY) * 2.5;
    if (enabled) {
      if (this.input.isDown('Space') || this.input.isDown('PadA')) wantV = 1.2;
      if (this.input.isDown('KeyC') || this.input.isDown('PadB')) wantV = -1.2;
    }
    wantV = Math.max(-2, Math.min(2, wantV));
    const vUp = _velL.dot(_upL);
    _velL.addScaledVector(_upL, (wantV - vUp) * Math.min(1, sdt * 6));
    // water drag on the horizontal part
    _velL.multiplyScalar(1 - Math.min(0.5, sdt * 1.5));
  }

  _waterLevel() {
    let level = 0;
    const ocean = this.world && this.world.ocean;
    if (ocean && typeof ocean.heightAt === 'function') {
      try { const hgt = ocean.heightAt(this.position.x, this.position.z); if (Number.isFinite(hgt)) level = hgt; } catch { /* ignore */ }
    }
    if (this._floodWorldY !== null && this.inside && this._floodWorldY > level) level = this._floodWorldY;
    return level;
  }

  _onSinking(p) {
    const s = p && p.state ? p.state : p;
    if (!s) return;
    if (typeof s.trimDeg === 'number') this._trimDeg = s.trimDeg;
    if (typeof s.floodWorldY === 'number' && Number.isFinite(s.floodWorldY)) this._floodWorldY = s.floodWorldY;
  }

  _updateDeck(force) {
    const ship = this.ship;
    if (!ship || typeof ship.deckAt !== 'function') return;
    _tmp.copy(this.position);
    ship.group.worldToLocal(_tmp);
    const deck = ship.deckAt(_tmp.y + 0.05);
    if (deck !== this.currentDeck || force) {
      this.currentDeck = deck;
      this.bus.emit('player:deck', { deck });
    }
  }

  /** Surface under the feet: 'wood' | 'carpet' | 'steel' (material name of the mesh below). */
  _surface() {
    const now = performance.now();
    if (now - this._surfaceCache.t < 250) return this._surfaceCache.name;
    let name = '';
    const ship = this.ship;
    if (ship && typeof ship.surfaceAt === 'function') {
      try { name = String(ship.surfaceAt(ship.worldToLocal(this.position)) || ''); } catch { name = ''; }
    }
    if (!name && ship && ship.group) {
      _tmp.copy(this.position).addScaledVector(WORLD_UP, 0.4);
      this._surfaceRay.set(_tmp, _down);
      this._surfaceHits.length = 0;
      const hits = this._surfaceRay.intersectObject(ship.group, true, this._surfaceHits);
      for (let i = 0; i < hits.length; i++) {
        const o = hits[i].object;
        if (!o.isMesh || !o.material) continue;
        const mat = Array.isArray(o.material) ? o.material[hits[i].face ? (o.geometry.groups.find((g) => hits[i].faceIndex * 3 >= g.start && hits[i].faceIndex * 3 < g.start + g.count)?.materialIndex ?? 0) : 0] : o.material;
        name = (mat && mat.name) || o.name || '';
        if (name) break;
      }
    }
    const n = name.toLowerCase();
    let surface = 'steel';
    if (/teak|pine|oak|plank|wood|mahogan|walnut|lino|parquet/.test(n)) surface = 'wood';
    else if (/carpet|rug|velvet/.test(n)) surface = 'carpet';
    this._surfaceCache.t = now;
    this._surfaceCache.name = surface;
    return surface;
  }

  // ------------------------------------------------------------------ camera

  _placeCamera(dt) {
    const cam = this.engine.camera;
    const reduce = !!this.settings.get('reduceMotion');
    // view direction
    _camFwd.set(Math.cos(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.sin(this.yaw) * Math.cos(this.pitch));

    // head bob (first person only)
    let bobY = 0, bobX = 0;
    if (this.mode === 'first' && !reduce && this.onGround && !this.swimming && !this.sitting) {
      const f = Math.min(1, this.speed / RUN);
      this._bobAmp += ((this.speed > 0.2 ? f : 0) - this._bobAmp) * Math.min(1, dt * 6);
      this._bobPhase += dt * (this.speed / STRIDE) * Math.PI;
      bobY = Math.sin(this._bobPhase * 2) * 0.028 * this._bobAmp;
      bobX = Math.sin(this._bobPhase) * 0.014 * this._bobAmp;
    } else {
      this._bobAmp *= Math.max(0, 1 - dt * 6);
    }

    // shake
    let sx = 0, sy = 0, sz = 0, roll = 0;
    if (this.shake.t > 0) {
      this.shake.t = Math.max(0, this.shake.t - dt);
      const k = this.shake.t / this.shake.seconds;
      const a = this.shake.intensity * k * k;
      const t = performance.now() * 0.001;
      sx = (Math.sin(t * 41.3) + Math.sin(t * 23.7) * 0.5) * 0.05 * a;
      sy = (Math.sin(t * 37.1 + 1.3) + Math.sin(t * 19.3) * 0.5) * 0.06 * a;
      sz = (Math.sin(t * 29.7 + 2.1)) * 0.03 * a;
      roll = (Math.sin(t * 31.9 + 0.7) + Math.sin(t * 13.1) * 0.4) * 0.025 * a;
    }

    this._rightFlat(_right);
    if (this.mode === 'free') {
      _camPos.copy(this.position);
    } else if (this.mode === 'third') {
      _pivot.copy(this.position).addScaledVector(WORLD_UP, 1.2).addScaledVector(_right, 0.25);
      let dist = 3.2;
      const part = this.ship.partAt(_pivot);
      if (part && part.bvh && part.group) {
        _inv.copy(part.group.matrixWorld).invert();
        _rotInv.setFromMatrix4(_inv);
        _tmp.copy(_pivot).applyMatrix4(_inv);
        _tmp2.copy(_camFwd).negate().applyMatrix3(_rotInv).normalize();
        const hit = castRay(part.bvh, _tmp, _tmp2, dist + 0.3);
        if (hit.hit) dist = Math.max(0.6, hit.distance - 0.35);
      }
      _camPos.copy(_pivot).addScaledVector(_camFwd, -dist);
    } else {
      _camPos.copy(this.position).addScaledVector(WORLD_UP, this._eyeCurrent + bobY).addScaledVector(_right, bobX);
    }
    _camPos.x += sx; _camPos.y += sy; _camPos.z += sz;
    cam.position.copy(_camPos);
    _euler.set(this.pitch, this.yaw - Math.PI / 2, roll + (this.mode === 'first' && !reduce ? bobX * 0.6 : 0), 'YXZ');
    cam.quaternion.setFromEuler(_euler);

    // FOV: base from settings + a little kick while running (unless reduceMotion).
    const kick = (!reduce && this.mode !== 'free' && this.speed > WALK + 0.3) ? Math.min(1, (this.speed - WALK) / (RUN - WALK)) * 5 : 0;
    this._fovKick += (kick - this._fovKick) * Math.min(1, dt * 4);
    const fov = this._fovBase + this._fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld(true);
    if (this.character && this.mode === 'third') this.character.setLookTarget(null);
  }

  // ------------------------------------------------------------------ interaction

  _updateInteraction(dt) {
    const cam = this.engine.camera;
    cam.getWorldDirection(_camFwd);
    cam.getWorldPosition(_camPos);
    const inter = this.interaction.update(dt, _camPos, _camFwd);
    const t = this.interaction.target;
    this.interactTarget = inter;
    this._setPrompt(inter ? (this.interaction.label || 'Interact') : null, t ? t.object : null);
    if (inter && (this.input.pressed('KeyE') || this.input.pressed('PadX') || (this.input.locked && this.input.pressed('Mouse0')))) {
      this.bus.emit('player:interact', { interactable: inter, object: t.object, point: t.point });
    }
  }

  _setPrompt(label, obj) {
    if (label === this._promptLabel && obj === this._promptObj) return;
    this._promptLabel = label;
    this._promptObj = obj;
    if (!label) { this.interactTarget = null; this.bus.emit('interact:prompt', null); }
    else this.bus.emit('interact:prompt', { label });
  }
}

export { RADIUS as PLAYER_RADIUS, HEIGHT as PLAYER_HEIGHT, EYE as PLAYER_EYE, WALK as WALK_SPEED, RUN as RUN_SPEED, STEP_UP as STEP_HEIGHT };
