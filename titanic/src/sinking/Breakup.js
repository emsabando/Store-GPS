/**
 * Break-up rig — drives Ship.bowGroup / Ship.sternGroup separately after `ship.split()`.
 *
 * Model (world frame, see ARCHITECTURE.md §1): at the break the Ship.group pose is frozen. Each
 * part is then posed as  M = T(pivotWorld) · R(list, trim) · T(-pivotLocal)  and written into the
 * part's local matrix relative to the frozen parent, so pivots are expressed in ship-local metres:
 *   bow   pivot = centroid of the bow section at the waterline, keeps trimming to ~35° while it
 *         sinks at ~1.5 m/s;
 *   stern pivot = its forward end (breakX, 0, 0): settles back to ~5° within 40 s, then pitches up
 *         to ~88° over 60 s while that end sinks, then slides down vertically (20 s).
 * `tb` is "cinematic seconds" since the break (1 game-minute = 40 s during the break-up; the
 * director dilates the clock so these are real seconds at the default pace).
 */
import * as THREE from 'three';
import { DEG, lerp, smoothstep, easeInQuad, easeInOut, clamp } from './Timeline.js';

const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _one = new THREE.Vector3(1, 1, 1);

/** Update only this object's own matrix/matrixWorld (cheap; no traversal of children). */
export function updateOwnWorldMatrix(obj) {
  obj.updateMatrix();
  if (obj.parent) obj.matrixWorld.multiplyMatrices(obj.parent.matrixWorld, obj.matrix);
  else obj.matrixWorld.copy(obj.matrix);
}

/**
 * Pose `obj` so that its local point `pivotLocal` sits at world `pivotWorld` with the given trim
 * (bow-down, rad) and list (to port, rad), using the contract's sign convention
 * (rotation.z = -trim, rotation.x = -list, Euler order XYZ).
 */
export function setWorldPose(obj, pivotLocal, pivotWorld, trimRad, listRad) {
  _e.set(-listRad, 0, -trimRad, 'XYZ');
  _q.setFromEuler(_e);
  _m.compose(pivotWorld, _q, _one);
  _t.makeTranslation(-pivotLocal.x, -pivotLocal.y, -pivotLocal.z);
  _m.multiply(_t);
  if (obj.parent) {
    _inv.copy(obj.parent.matrixWorld).invert();
    _m.premultiply(_inv);
  }
  _m.decompose(obj.position, obj.quaternion, obj.scale);
  updateOwnWorldMatrix(obj);
}

export const BREAKUP_SECONDS = { settle: 40, rise: 60, slide: 20 };
export const BREAKUP_TOTAL = BREAKUP_SECONDS.settle + BREAKUP_SECONDS.rise + BREAKUP_SECONDS.slide; // 120

export class BreakupRig {
  /**
   * @param {object} o { ship, breakX, trimDeg, listDeg } — the pose at the moment of the break.
   */
  constructor({ ship, breakX, trimDeg, listDeg }) {
    this.ship = ship;
    this.breakX = breakX;
    this.trim0 = trimDeg;
    this.list0 = listDeg;
    this.bow = null;
    this.stern = null;
    this.done = false;
    this.state = { bow: { trimDeg, y: 0 }, stern: { trimDeg, y: 0 }, phase: 'breakup' };
    this._bowPivotLocal = new THREE.Vector3((breakX + 134) / 2, 0, 0);
    this._sternPivotLocal = new THREE.Vector3(breakX, 0, 0);
    this._bowPivotWorld = new THREE.Vector3();
    this._sternPivotWorld = new THREE.Vector3();
    this._bowStart = new THREE.Vector3();
    this._sternStart = new THREE.Vector3();
    this._attached = false;
  }

  /** Attach to the parts once `ship.split()` has created them. Returns true when attached. */
  attach() {
    if (this._attached) return true;
    const ship = this.ship;
    if (!ship || !ship.bowGroup || !ship.sternGroup) return false;
    this.bow = ship.bowGroup;
    this.stern = ship.sternGroup;
    ship.group.updateMatrixWorld(true);
    this._bowStart.copy(this._bowPivotLocal).applyMatrix4(ship.group.matrixWorld);
    this._sternStart.copy(this._sternPivotLocal).applyMatrix4(ship.group.matrixWorld);
    this._attached = true;
    return true;
  }

  /** @param {number} tb cinematic seconds since the break. */
  update(tb) {
    if (!this.attach()) return this.state;
    const S = BREAKUP_SECONDS;
    tb = Math.max(0, tb);

    // ---- bow: trims on to ~35°, sinks at ~1.5 m/s, list eases out.
    const bowTrim = lerp(this.trim0, 35, smoothstep(0, 30, tb));
    const bowList = lerp(this.list0, 0, smoothstep(0, 60, tb));
    this._bowPivotWorld.copy(this._bowStart);
    this._bowPivotWorld.y -= 1.5 * tb;
    setWorldPose(this.bow, this._bowPivotLocal, this._bowPivotWorld, bowTrim * DEG, bowList * DEG);

    // ---- stern: settle back, rise to vertical about its forward end, then slide down.
    let sternTrim, dy, phase;
    const y0 = this._sternStart.y;
    if (tb < S.settle) {
      const u = tb / S.settle;
      sternTrim = lerp(this.trim0, 5, easeInOut(u));
      dy = -4 * easeOutQuadLocal(u);                     // forward end splashes down ~4 m
      phase = 'breakup';
    } else if (tb < S.settle + S.rise) {
      const u = (tb - S.settle) / S.rise;
      sternTrim = lerp(5, 88, easeInOut(u));
      dy = -4 - 22 * easeInQuad(u);                      // the open end floods and goes under
      phase = 'breakup';
    } else {
      const u = clamp((tb - S.settle - S.rise) / S.slide, 0, 1);
      sternTrim = lerp(88, 90, u);
      dy = -26 - 150 * easeInQuad(u);                    // the plunge
      phase = u >= 1 ? 'gone' : 'plunge';
    }
    const sternList = lerp(this.list0, 0, smoothstep(0, S.settle + S.rise, tb));
    this._sternPivotWorld.copy(this._sternStart);
    this._sternPivotWorld.y = Math.max(y0, 0) + dy;      // never start below the sea
    setWorldPose(this.stern, this._sternPivotLocal, this._sternPivotWorld, sternTrim * DEG, sternList * DEG);

    this.done = tb >= BREAKUP_TOTAL;
    this.state.bow.trimDeg = bowTrim; this.state.bow.y = this._bowPivotWorld.y;
    this.state.stern.trimDeg = sternTrim; this.state.stern.y = this._sternPivotWorld.y;
    this.state.phase = phase;
    return this.state;
  }
}

function easeOutQuadLocal(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); }
