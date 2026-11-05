/**
 * Ocean — Gerstner-wave surface with analytic normals, sky-gradient Fresnel reflection, sun glint,
 * depth colour and crest foam (ARCHITECTURE.md §6). heightAt(x, z) mirrors the vertex shader so
 * floating objects can follow the surface. The grid follows the camera in steps.
 */
import * as THREE from 'three';

const MAX_WAVES = 6;

export class Ocean {
  constructor({ quality = 'high', size = 6000, segments } = {}) {
    this.quality = quality;
    this.size = size;
    this.segments = segments || (quality === 'low' ? 96 : quality === 'medium' ? 160 : quality === 'high' ? 256 : 384);
    this.time = 0;
    this.waves = [];                 // { dir: Vector2, amp, len, speed, steep }
    this.windScale = 1;
    this.group = new THREE.Group();
    this.group.name = 'Ocean';
    this.uniforms = {
      uTime: { value: 0 },
      uWaveDir: { value: Array.from({ length: MAX_WAVES }, () => new THREE.Vector2(1, 0)) },
      uWaveParams: { value: Array.from({ length: MAX_WAVES }, () => new THREE.Vector4(0, 10, 1, 0.5)) }, // amp, wavelength, speed, steepness
      uWaveCount: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
      uSunIntensity: { value: 1 },
      uHorizonColor: { value: new THREE.Color(0.55, 0.7, 0.9) },
      uZenithColor: { value: new THREE.Color(0.15, 0.3, 0.6) },
      uDeepColor: { value: new THREE.Color(0.012, 0.045, 0.07) },
      uShallowColor: { value: new THREE.Color(0.03, 0.14, 0.17) },
      uFoamColor: { value: new THREE.Color(0.85, 0.9, 0.92) },
      uNight: { value: 0 },
      uDetailScale: { value: 0.06 },
      uCameraPos: { value: new THREE.Vector3() },
    };
    this.setWeather({ wind: 0.4, swell: 0.5 });
    this._build();
  }

  _build() {
    const geom = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.uniforms]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: true,
      transparent: false,
      side: THREE.FrontSide,
    });
    // UniformsUtils.merge clones; keep references to the live uniform objects
    this.uniforms = mat.uniforms;
    this.material = mat;
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.name = 'OceanSurface';
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = -10;
    this.group.add(this.mesh);
    this._pushWaves();
  }

  /** wind 0..1 (chop), swell 0..1 (long waves). The night of 14 April was a flat calm: setWeather({wind:0.05, swell:0.08}). */
  setWeather({ wind = 0.4, swell = 0.5 } = {}) {
    this.wind = wind; this.swell = swell;
    const w = [];
    const d = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));
    w.push({ dir: d(0.35), amp: 0.55 * swell, len: 90, speed: 1.0, steep: 0.25 });
    w.push({ dir: d(0.9), amp: 0.32 * swell, len: 47, speed: 1.1, steep: 0.3 });
    w.push({ dir: d(-0.4), amp: 0.18 * wind, len: 21, speed: 1.3, steep: 0.35 });
    w.push({ dir: d(2.1), amp: 0.10 * wind, len: 11, speed: 1.4, steep: 0.4 });
    w.push({ dir: d(-1.3), amp: 0.06 * wind, len: 5.5, speed: 1.6, steep: 0.45 });
    w.push({ dir: d(1.6), amp: 0.035 * wind, len: 2.7, speed: 1.8, steep: 0.5 });
    this.waves = w;
    if (this.material) this._pushWaves();
  }

  _pushWaves() {
    const u = this.uniforms;
    u.uWaveCount.value = this.waves.length;
    this.waves.forEach((w, i) => {
      u.uWaveDir.value[i].copy(w.dir);
      u.uWaveParams.value[i].set(w.amp, w.len, w.speed, w.steep);
    });
  }

  /** Surface height at world (x, z) — same Gerstner sum as the shader (vertical component). */
  heightAt(x, z, t = this.time) {
    let y = 0;
    for (const w of this.waves) {
      const k = (2 * Math.PI) / w.len;
      const c = Math.sqrt(9.81 / k) * w.speed;
      const f = k * (w.dir.x * x + w.dir.y * z - c * t);
      y += w.amp * Math.cos(f);
    }
    return y;
  }

  /** Approximate surface normal at (x, z). */
  normalAt(x, z, t = this.time, out = new THREE.Vector3()) {
    const e = 0.5;
    const hL = this.heightAt(x - e, z, t), hR = this.heightAt(x + e, z, t), hD = this.heightAt(x, z - e, t), hU = this.heightAt(x, z + e, t);
    return out.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  /** Call every frame with the camera position, sun direction/colour and sky colours. */
  update(dt, { cameraPos, sunDir, sunColor, sunIntensity = 1, horizonColor, zenithColor, night = 0 } = {}) {
    this.time += dt;
    const u = this.uniforms;
    u.uTime.value = this.time;
    if (cameraPos) {
      const step = this.size / this.segments;
      this.mesh.position.set(Math.round(cameraPos.x / step) * step, 0, Math.round(cameraPos.z / step) * step);
      u.uCameraPos.value.copy(cameraPos);
    }
    if (sunDir) u.uSunDir.value.copy(sunDir).normalize();
    if (sunColor) u.uSunColor.value.copy(sunColor);
    u.uSunIntensity.value = sunIntensity;
    if (horizonColor) u.uHorizonColor.value.copy(horizonColor);
    if (zenithColor) u.uZenithColor.value.copy(zenithColor);
    u.uNight.value = night;
  }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}

const VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
uniform vec2 uWaveDir[${MAX_WAVES}];
uniform vec4 uWaveParams[${MAX_WAVES}];
uniform int uWaveCount;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;
void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 p = wp;
  vec3 n = vec3(0.0, 1.0, 0.0);
  float crest = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    if (i >= uWaveCount) break;
    vec2 d = uWaveDir[i];
    float amp = uWaveParams[i].x, len = uWaveParams[i].y, spd = uWaveParams[i].z, steep = uWaveParams[i].w;
    float k = 6.2831853 / len;
    float c = sqrt(9.81 / k) * spd;
    float f = k * (dot(d, wp.xz) - c * uTime);
    float a = amp;
    float q = steep / (k * a * float(uWaveCount) + 1e-4);
    q = min(q, 1.0);
    float cf = cos(f), sf = sin(f);
    p.x += q * a * d.x * cf;
    p.z += q * a * d.y * cf;
    p.y += a * cf;
    // analytic Gerstner normal contributions
    float wa = k * a;
    n.x -= d.x * wa * sf;
    n.z -= d.y * wa * sf;
    n.y -= q * wa * cf;
    crest += max(0.0, cf) * wa;
  }
  vNormal = normalize(n);
  vWorldPos = p;
  vCrest = crest;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uHorizonColor;
uniform vec3 uZenithColor;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFoamColor;
uniform float uNight;
uniform float uDetailScale;
uniform float uTime;
uniform vec3 uCameraPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 detailNormal(vec2 p, float t) {
  float e = 0.35;
  vec2 q1 = p * uDetailScale * 7.0 + vec2(t * 0.05, t * 0.03);
  vec2 q2 = p * uDetailScale * 19.0 - vec2(t * 0.08, -t * 0.06);
  float h  = noise(q1) * 0.6 + noise(q2) * 0.4;
  float hx = noise(q1 + vec2(e * uDetailScale * 7.0, 0.0)) * 0.6 + noise(q2 + vec2(e * uDetailScale * 19.0, 0.0)) * 0.4;
  float hz = noise(q1 + vec2(0.0, e * uDetailScale * 7.0)) * 0.6 + noise(q2 + vec2(0.0, e * uDetailScale * 19.0)) * 0.4;
  return normalize(vec3((h - hx) * 2.2, 1.0, (h - hz) * 2.2));
}
void main() {
  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  float dist = length(uCameraPos - vWorldPos);
  float detailFade = clamp(1.0 - dist / 900.0, 0.0, 1.0);
  vec3 dn = detailNormal(vWorldPos.xz, uTime);
  vec3 n = normalize(mix(vNormal, normalize(vNormal + (dn - vec3(0.0, 1.0, 0.0)) * 0.9), detailFade));
  n = normalize(mix(vec3(0.0, 1.0, 0.0), n, clamp(1.0 - dist / 3500.0, 0.25, 1.0)));

  // Fresnel (Schlick) with water IOR
  float cosT = clamp(dot(n, viewDir), 0.0, 1.0);
  float F0 = 0.02;
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);
  fresnel = clamp(fresnel * 1.6, 0.0, 1.0);

  // sky reflection: gradient by the reflected ray's elevation
  vec3 r = reflect(-viewDir, n);
  float el = clamp(r.y, 0.0, 1.0);
  vec3 sky = mix(uHorizonColor, uZenithColor, pow(el, 0.55));

  // sun glint (Blinn-Phong) and a broad sun path
  vec3 h = normalize(viewDir + uSunDir);
  float spec = pow(max(dot(n, h), 0.0), 900.0) * 6.0 + pow(max(dot(n, h), 0.0), 60.0) * 0.25;
  float sunUp = smoothstep(-0.05, 0.08, uSunDir.y);
  vec3 glint = uSunColor * spec * uSunIntensity * sunUp;

  // water body colour: deep in the troughs, lighter on the crests facing the sun
  float sunFacing = max(dot(n, uSunDir), 0.0);
  vec3 water = mix(uDeepColor, uShallowColor, clamp(vCrest * 0.8 + sunFacing * 0.3, 0.0, 1.0));
  water *= (0.35 + 0.65 * sunUp) * (1.0 - 0.75 * uNight);
  water += uZenithColor * 0.05 * (1.0 - sunUp);

  // foam on steep crests
  float foam = smoothstep(0.55, 0.95, vCrest) * detailFade * (1.0 - uNight * 0.5);
  foam *= 0.5 + 0.5 * noise(vWorldPos.xz * 0.6 + uTime * 0.2);

  vec3 col = mix(water, sky, fresnel) + glint;
  col = mix(col, uFoamColor * (0.4 + 0.6 * sunUp), foam * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;
