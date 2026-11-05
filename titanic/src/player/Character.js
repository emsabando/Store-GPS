/**
 * Character — stylised, well-proportioned 1912 humanoid with procedural animation
 * (ARCHITECTURE.md §7). Used for the third-person player avatar and by the NPC manager.
 *
 *   const c = makeCharacter(materials, look);
 *   scene.add(c.group);               // origin between the feet, facing +z
 *   c.update(dt, speedMps, moving);   // every frame
 *   c.setPose('idle'|'walk'|'sit'|'talk'|'play'|'wave');
 *   c.setLookTarget(worldPos|null);   // head turns within ±70°
 *   c.height                          // metres
 *
 * Rig (pivots at the joints, figure built for 1.75 m then scaled):
 *   group → hips(0.95) → torso mesh, spine → headPivot(0.50) → head mesh
 *                      → shoulderL/R(±0.21, 0.47) → upperArm → elbow(−0.30) → lowerArm
 *        → hips → hipL/R(±0.09, 0) → upperLeg → knee(−0.45) → lowerLeg (+shoe)
 * 10 meshes (11 with the violin), all casting shadows.
 */
import * as THREE from 'three';
import { normaliseLook, makeWardrobe, buildHead, buildTorso, buildUpperArm, buildLowerArm, buildUpperLeg, buildLowerLeg, buildViolin } from './CharacterCostume.js';

const BASE_H = 1.75;
const HIP_Y = 0.95;
const SPINE_Y = 0.50;        // relative to hips (neck base at 1.45 abs)
const SHOULDER = { x: 0.21, y: 0.47 };
const HIP_X = 0.09;
const UPPER_ARM = 0.30;
const UPPER_LEG = 0.45;
const SIT_HIP_Y = 0.45;
const LOOK_YAW = 70 * Math.PI / 180;
const LOOK_PITCH = 35 * Math.PI / 180;
const POSES = ['idle', 'walk', 'sit', 'talk', 'play', 'wave'];

const _v = new THREE.Vector3();
const _hv = new THREE.Vector3();

/** A joint target: rotation xyz (+ optional position y). */
class Joint {
  constructor(obj) { this.obj = obj; this.tx = 0; this.ty = 0; this.tz = 0; }
  set(x = 0, y = 0, z = 0) { this.tx = x; this.ty = y; this.tz = z; return this; }
  add(x = 0, y = 0, z = 0) { this.tx += x; this.ty += y; this.tz += z; return this; }
  apply(k) {
    const r = this.obj.rotation;
    r.x += (this.tx - r.x) * k;
    r.y += (this.ty - r.y) * k;
    r.z += (this.tz - r.z) * k;
  }
  snap() { this.obj.rotation.set(this.tx, this.ty, this.tz); }
}

export function makeCharacter(materials, look = {}) {
  const L = normaliseLook(look);
  const w = makeWardrobe(materials, L);
  const group = new THREE.Group();
  group.name = 'Character';
  const scale = L.height / BASE_H;
  group.scale.setScalar(scale);

  // ---- rig ----
  const hips = new THREE.Object3D(); hips.name = 'hips'; hips.position.y = HIP_Y; group.add(hips);
  const torso = buildTorso(w, L); hips.add(torso);
  const spine = new THREE.Object3D(); spine.name = 'spine'; spine.position.y = SPINE_Y; hips.add(spine);
  const headPivot = new THREE.Object3D(); headPivot.name = 'head'; spine.add(headPivot);
  const head = buildHead(w, L); headPivot.add(head);

  const mkArm = (side) => {
    const shoulder = new THREE.Object3D(); shoulder.name = 'shoulder' + side; shoulder.position.set(SHOULDER.x * (side === 'L' ? 1 : -1), SHOULDER.y, 0); hips.add(shoulder);
    shoulder.add(buildUpperArm(w, L));
    const elbow = new THREE.Object3D(); elbow.name = 'elbow' + side; elbow.position.y = -UPPER_ARM; shoulder.add(elbow);
    elbow.add(buildLowerArm(w, L));
    return { shoulder, elbow };
  };
  const mkLeg = (side) => {
    const hip = new THREE.Object3D(); hip.name = 'hip' + side; hip.position.set(HIP_X * (side === 'L' ? 1 : -1), 0, 0); hips.add(hip);
    hip.add(buildUpperLeg(w, L));
    const knee = new THREE.Object3D(); knee.name = 'knee' + side; knee.position.y = -UPPER_LEG; hip.add(knee);
    knee.add(buildLowerLeg(w, L));
    return { hip, knee };
  };
  const armL = mkArm('L'), armR = mkArm('R');
  const legL = mkLeg('L'), legR = mkLeg('R');
  let violin = null;

  const J = {
    hips: new Joint(hips), spine: new Joint(spine), head: new Joint(headPivot),
    shL: new Joint(armL.shoulder), shR: new Joint(armR.shoulder), elL: new Joint(armL.elbow), elR: new Joint(armR.elbow),
    hipL: new Joint(legL.hip), hipR: new Joint(legR.hip), kneeL: new Joint(legL.knee), kneeR: new Joint(legR.knee),
  };
  const joints = Object.values(J);

  // ---- animation state ----
  const state = {
    pose: 'idle', phase: Math.random() * Math.PI * 2, time: Math.random() * 10, hipY: HIP_Y,
    lookTarget: null, lookYaw: 0, lookPitch: 0, lookWeight: 0, blendK: 12, first: true,
    seed: Math.random() * 6.28,
  };

  const ensureViolin = () => {
    if (violin) return;
    violin = buildViolin(w);
    // held under the chin, pointing out along the left arm
    violin.position.set(0.08, 0.43, 0.09);
    violin.rotation.set(0.2, 0.75, 0.1);
    hips.add(violin);
    violin.visible = false;
  };

  function poseTargets(dt, speed, moving) {
    const t = state.time;
    const pose = state.pose;
    const effective = (pose === 'idle' || pose === 'walk') ? (moving ? 'walk' : 'idle') : pose;
    for (const j of joints) j.set(0, 0, 0);
    let hipY = HIP_Y;
    // breathing + sway are always present (scaled down when walking)
    const breathe = Math.sin(t * 1.9 + state.seed) * 0.012;
    J.spine.add(breathe * 0.6, 0, 0);
    J.hips.add(0, 0, Math.sin(t * 0.6 + state.seed) * 0.012);
    J.shL.add(0, 0, 0.09 + breathe * 0.5);
    J.shR.add(0, 0, -0.09 - breathe * 0.5);
    J.elL.add(-0.12, 0, 0);
    J.elR.add(-0.12, 0, 0);
    if (violin) violin.visible = effective === 'play';

    switch (effective) {
      case 'walk': {
        const f = Math.min(1.35, Math.max(0.35, speed / 1.6));
        const amp = 0.4 + 0.3 * Math.min(1, speed / 4.2);
        state.phase += dt * (Math.max(speed, 0.4) / 0.7) * Math.PI;
        const p = state.phase;
        const s = Math.sin(p);
        J.hipL.add(-amp * s, 0, 0);
        J.hipR.add(amp * s, 0, 0);
        J.kneeL.add(0.12 + 1.0 * amp * Math.max(0, Math.cos(p)), 0, 0);
        J.kneeR.add(0.12 + 1.0 * amp * Math.max(0, -Math.cos(p)), 0, 0);
        J.shL.add(amp * 0.55 * s, 0, 0);
        J.shR.add(-amp * 0.55 * s, 0, 0);
        J.elL.add(-0.25 - 0.35 * Math.max(0, -s), 0, 0);
        J.elR.add(-0.25 - 0.35 * Math.max(0, s), 0, 0);
        J.spine.add(0.05 + 0.1 * Math.min(1, speed / 4.2), 0, 0);
        J.hips.add(0, Math.sin(p) * 0.06 * f, Math.cos(p) * 0.03);
        hipY = HIP_Y + Math.abs(Math.sin(p)) * 0.025 * f - 0.01;
        break;
      }
      case 'sit': {
        hipY = SIT_HIP_Y;
        J.hipL.add(-Math.PI / 2 + 0.08, 0.06, 0);
        J.hipR.add(-Math.PI / 2 + 0.08, -0.06, 0);
        J.kneeL.add(Math.PI / 2 - 0.12, 0, 0);
        J.kneeR.add(Math.PI / 2 - 0.12, 0, 0);
        J.shL.add(-0.55, 0, 0.12);
        J.shR.add(-0.55, 0, -0.12);
        J.elL.add(-0.75, 0, 0);
        J.elR.add(-0.75, 0, 0);
        J.spine.add(-0.04 + breathe * 0.6, 0, 0);
        break;
      }
      case 'talk': {
        J.head.add(0.05 + Math.sin(t * 5.1) * 0.05, Math.sin(t * 2.3) * 0.08, Math.sin(t * 1.7) * 0.04);
        J.shR.add(-0.55 + Math.sin(t * 3.7) * 0.12, 0, -0.35);
        J.elR.add(-1.45 + Math.sin(t * 4.1) * 0.3, 0.3, 0);
        J.shL.add(-0.15, 0, 0.12);
        J.elL.add(-0.6, 0, 0);
        break;
      }
      case 'play': {
        ensureViolin();
        violin.visible = true;
        J.head.add(0.08, 0.25, 0.3);
        J.shL.add(-1.25, 0.9, 0.35);
        J.elL.add(-1.55, 0.2, 0);
        const bow = Math.sin(t * 5.5);
        J.shR.add(-0.95 + bow * 0.1, -0.25, -0.65 - bow * 0.15);
        J.elR.add(-1.35 + bow * 0.45, 0.4, -0.2);
        J.spine.add(0.04, 0, 0.04);
        J.hips.add(0, 0, Math.sin(t * 2.7) * 0.02);
        break;
      }
      case 'wave': {
        J.shR.add(-2.65, 0, -0.45);
        J.elR.add(-0.55, 0, -0.35 + Math.sin(t * 9) * 0.45);
        J.head.add(0, -0.15, 0.08);
        J.shL.add(-0.1, 0, 0.1);
        J.elL.add(-0.35, 0, 0);
        break;
      }
      default: { // idle: weight shift
        const shift = Math.sin(t * 0.45 + state.seed);
        J.hips.add(0, 0, shift * 0.015);
        J.hipL.add(0, 0, -shift * 0.02);
        J.hipR.add(0, 0, -shift * 0.02);
        J.kneeL.add(0.03, 0, 0);
        J.kneeR.add(0.03, 0, 0);
        J.head.add(Math.sin(t * 0.9 + 1) * 0.02, Math.sin(t * 0.5 + state.seed) * 0.08, 0);
        break;
      }
    }
    // head look-at (additive, blended)
    if (state.lookWeight > 0.001) {
      J.head.add(state.lookPitch * state.lookWeight, state.lookYaw * state.lookWeight, 0);
    }
    return hipY;
  }

  function update(dt = 1 / 60, speedMps = 0, moving = false) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    state.time += dt;
    // look target: compute desired head yaw/pitch in the figure's local frame
    if (state.lookTarget) {
      group.updateMatrixWorld(true);
      _v.copy(state.lookTarget);
      group.worldToLocal(_v);
      _v.y -= (HIP_Y + SPINE_Y + 0.17);
      const h = Math.hypot(_v.x, _v.z);
      let yaw = Math.atan2(_v.x, _v.z);
      let pitch = -Math.atan2(_v.y, h);
      const behind = Math.abs(yaw) > LOOK_YAW * 1.6;
      yaw = Math.max(-LOOK_YAW, Math.min(LOOK_YAW, yaw));
      pitch = Math.max(-LOOK_PITCH, Math.min(LOOK_PITCH, pitch));
      const k = Math.min(1, dt * 6);
      state.lookYaw += (yaw - state.lookYaw) * k;
      state.lookPitch += (pitch - state.lookPitch) * k;
      state.lookWeight += ((behind ? 0 : 1) - state.lookWeight) * k;
    } else {
      state.lookWeight = Math.max(0, state.lookWeight - dt * 4);
    }
    const hipY = poseTargets(dt, speedMps, moving);
    const k = state.first ? 1 : 1 - Math.exp(-dt * state.blendK);
    for (const j of joints) j.apply(k);
    state.hipY += (hipY - state.hipY) * (state.first ? 1 : Math.min(1, dt * 10));
    hips.position.y = state.hipY;
    state.first = false;
  }

  function setPose(name) {
    if (!POSES.includes(name)) name = 'idle';
    if (name === state.pose) return;
    state.pose = name;
    if (name === 'play') ensureViolin();
  }

  function setLookTarget(worldPos) {
    if (!worldPos) { state.lookTarget = null; return; }
    if (!state.lookTarget) state.lookTarget = new THREE.Vector3();
    state.lookTarget.copy(worldPos);
  }

  /** Approximate world-space head position (useful for name tags / look-ats). */
  function headPosition(out = _hv) {
    out.set(0, HIP_Y + SPINE_Y + 0.17, 0);
    return group.localToWorld(out);
  }

  function dispose() {
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m && !m.userData.shared) m.dispose();   // character materials are shared
      }
    });
  }

  update(0, 0, false);
  return {
    group, height: L.height, look: L, joints: J, wardrobe: w,
    update, setPose, setLookTarget, headPosition, dispose,
    get pose() { return state.pose; },
  };
}

export { POSES as CHARACTER_POSES };
