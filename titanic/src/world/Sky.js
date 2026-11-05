/**
 * Sky — Preetham daytime sky (three/addons Sky) crossfaded into a custom night sky:
 * twilight/horizon glow dome, ~6000-star dome with a bright Milky Way (moonless, crystal-clear
 * night of 14 April 1912), a real crescent moon (phase from the date; new moon 17 April) and a
 * sun disc. Everything is driven by the clock through `update()` (World computes the
 * astronomy with Astronomy.js). The whole group follows the camera.
 *
 *   const sky = new SkyDome({ quality });
 *   scene.add(sky.group);
 *   sky.update({ sunDir, sunElevationDeg, lst, moon, time, cameraPos, cameraFar, pixelRatio });
 *   sky.palette → { horizon, zenith, glow, nightMix, starMix, fog } for the current sun elevation
 *   sky.createEnvScene() → { scene, sync() } a small scene (sky + dome + sea) for the environment cube
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { galacticToEquatorial, equatorialToWorldAtLst0, starDomeQuaternion, smoothstep } from './Astronomy.js';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------------
// Palette by solar elevation (degrees). Linear-light colours.
// ---------------------------------------------------------------------------------------------
const KEYS = [
  { el: -90, horizon: [0.028, 0.034, 0.056], zenith: [0.0018, 0.0026, 0.007], glow: [0, 0, 0], glowK: 0.0, fog: [0.012, 0.016, 0.028] },
  { el: -18, horizon: [0.030, 0.036, 0.060], zenith: [0.0020, 0.0030, 0.008], glow: [0.10, 0.05, 0.08], glowK: 0.1, fog: [0.013, 0.017, 0.030] },
  { el: -12, horizon: [0.080, 0.085, 0.150], zenith: [0.0045, 0.0065, 0.017], glow: [0.40, 0.16, 0.20], glowK: 0.35, fog: [0.035, 0.040, 0.070] },
  { el: -6, horizon: [0.34, 0.26, 0.36], zenith: [0.020, 0.040, 0.100], glow: [0.95, 0.36, 0.18], glowK: 0.7, fog: [0.16, 0.13, 0.19] },
  { el: 0, horizon: [0.92, 0.58, 0.36], zenith: [0.10, 0.19, 0.42], glow: [1.0, 0.45, 0.16], glowK: 1.0, fog: [0.55, 0.40, 0.33] },
  { el: 5, horizon: [0.90, 0.74, 0.60], zenith: [0.17, 0.32, 0.65], glow: [1.0, 0.70, 0.40], glowK: 0.5, fog: [0.62, 0.60, 0.60] },
  { el: 15, horizon: [0.70, 0.80, 0.92], zenith: [0.18, 0.38, 0.75], glow: [1.0, 0.95, 0.85], glowK: 0.15, fog: [0.60, 0.70, 0.84] },
  { el: 90, horizon: [0.68, 0.80, 0.94], zenith: [0.14, 0.34, 0.74], glow: [1, 1, 1], glowK: 0.1, fog: [0.60, 0.72, 0.88] },
];

const _tmpC = new THREE.Color();
function lerp3(a, b, t, out) { out.setRGB(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); return out; }

/** Interpolated sky palette for a solar elevation in degrees. */
export function skyPalette(elDeg, out = {}) {
  out.horizon = out.horizon || new THREE.Color();
  out.zenith = out.zenith || new THREE.Color();
  out.glow = out.glow || new THREE.Color();
  out.fog = out.fog || new THREE.Color();
  let i = 0;
  while (i < KEYS.length - 2 && elDeg > KEYS[i + 1].el) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((elDeg - a.el) / (b.el - a.el), 0, 1);
  lerp3(a.horizon, b.horizon, t, out.horizon);
  lerp3(a.zenith, b.zenith, t, out.zenith);
  lerp3(a.glow, b.glow, t, out.glow);
  lerp3(a.fog, b.fog, t, out.fog);
  out.glowK = a.glowK + (b.glowK - a.glowK) * t;
  out.nightMix = smoothstep(2.5, -7.5, elDeg);     // custom dome fully covers the (black) Preetham sky below -7.5°
  out.starMix = smoothstep(-2.5, -11, elDeg);      // stars from civil twilight on
  out.elDeg = elDeg;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Star catalogue: the ~80 brightest stars (J2000; RA hours, Dec deg, V mag, B-V)
// ---------------------------------------------------------------------------------------------
const BRIGHT = [
  [6.752, -16.716, -1.46, 0.00], [6.399, -52.696, -0.74, 0.15], [14.261, 19.182, -0.05, 1.23], [18.616, 38.784, 0.03, 0.00],
  [5.278, 45.998, 0.08, 0.80], [5.242, -8.202, 0.13, -0.03], [7.655, 5.225, 0.34, 0.42], [5.919, 7.407, 0.42, 1.85],
  [1.629, -57.237, 0.46, -0.16], [14.064, -60.373, 0.61, -0.23], [19.846, 8.868, 0.77, 0.22], [12.443, -63.1, 0.76, -0.24],
  [4.599, 16.509, 0.85, 1.54], [16.490, -26.432, 0.96, 1.83], [13.420, -11.161, 0.97, -0.23], [7.755, 28.026, 1.14, 1.00],
  [22.961, -29.622, 1.16, 0.09], [20.690, 45.280, 1.25, 0.09], [12.795, -59.689, 1.25, -0.23], [10.139, 11.967, 1.35, -0.11],
  [6.977, -28.972, 1.50, -0.21], [7.577, 31.888, 1.58, 0.03], [17.560, -37.104, 1.62, -0.22], [12.519, -57.113, 1.63, 1.59],
  [5.419, 6.350, 1.64, -0.22], [5.438, 28.608, 1.65, -0.13], [5.604, -1.202, 1.69, -0.19], [5.679, -1.943, 1.74, -0.21],
  [12.900, 55.960, 1.76, -0.02], [11.062, 61.751, 1.79, 1.07], [3.405, 49.861, 1.79, 0.48], [7.140, -26.393, 1.83, 0.67],
  [18.403, -34.385, 1.85, -0.03], [13.792, 49.313, 1.86, -0.19], [5.992, 44.947, 1.90, 0.03], [6.629, 16.399, 1.93, 0.00],
  [6.378, -17.956, 1.98, -0.24], [9.460, -8.659, 1.98, 1.44], [2.530, 89.264, 1.98, 0.60], [2.120, 23.463, 2.00, 1.15],
  [10.333, 19.842, 2.08, 1.13], [0.727, -17.987, 2.04, 1.02], [13.399, 54.925, 2.04, 0.02], [18.921, -26.297, 2.05, -0.13],
  [1.162, 35.620, 2.05, 1.58], [0.140, 29.090, 2.06, -0.11], [17.582, 12.560, 2.08, 0.15], [14.845, 74.156, 2.08, 1.47],
  [5.796, -9.670, 2.09, -0.17], [11.818, 14.572, 2.14, 0.09], [3.136, 40.956, 2.12, -0.05], [11.031, 56.383, 2.37, -0.02],
  [11.897, 53.695, 2.44, 0.00], [12.257, 57.033, 3.31, 0.08], [5.533, -0.299, 2.23, -0.22], [21.736, 9.875, 2.39, 1.53],
  [0.675, 56.537, 2.24, 1.17], [0.153, 59.150, 2.27, 0.34], [21.310, 62.586, 2.44, 0.26], [19.512, 27.960, 3.18, 1.13],
  [20.370, 40.257, 2.23, 0.68], [20.770, 33.970, 2.48, 1.03], [23.079, 15.205, 2.49, -0.04], [23.063, 28.083, 2.42, 1.67],
  [0.220, 15.184, 2.83, -0.19], [12.934, 38.318, 2.90, -0.12], [15.578, 26.715, 2.23, -0.02], [15.738, 6.426, 2.63, 1.17],
  [15.283, -9.383, 2.61, -0.07], [17.944, 51.489, 2.23, 1.52], [3.791, 24.105, 2.87, -0.09], [16.503, 21.490, 2.78, 0.94],
  [17.943, -9.774, 2.43, 1.17], [9.764, 23.774, 3.52, 1.01], [22.711, -46.885, 2.10, 1.39], [8.158, -47.337, 1.75, -0.14],
  [2.065, 42.330, 2.26, 1.58], [4.330, 15.627, 3.53, 1.01], [16.400, -25.590, 2.29, -0.11], [20.794, -58.454, 2.10, 1.22],
];

function bvToColor(bv, out = new THREE.Color()) {
  const stops = [[-0.3, 0.64, 0.74, 1.0], [0.0, 0.80, 0.87, 1.0], [0.4, 1.0, 0.98, 0.92], [0.8, 1.0, 0.92, 0.76], [1.2, 1.0, 0.84, 0.58], [1.8, 1.0, 0.72, 0.42]];
  let i = 0;
  while (i < stops.length - 2 && bv > stops[i + 1][0]) i++;
  const a = stops[i], b = stops[i + 1];
  const t = THREE.MathUtils.clamp((bv - a[0]) / (b[0] - a[0]), 0, 1);
  return out.setRGB(a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gaussian(rng) { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------------------------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------------------------
const DOME_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }`;

const DOME_FRAG = /* glsl */`
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec2 uSunXZ;
  uniform float uGlowK; uniform float uOpacity; uniform float uSunY;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -1.0, 1.0);
    float up = pow(max(h, 0.0), 0.42);
    vec3 col = mix(uHorizon, uZenith, up);
    col += uHorizon * exp(-abs(h) * 10.0) * 0.55;                       // haze band on the horizon
    float toSun = max(dot(normalize(d.xz + vec2(1e-5)), uSunXZ), 0.0);
    float lift = clamp(uSunY * 6.0 + 1.0, 0.0, 1.0);                      // glow sinks as the sun goes deeper
    float glow = pow(toSun, 2.5) * exp(-max(h, 0.0) * (4.0 + 6.0 * (1.0 - lift))) * uGlowK;
    col += uGlow * glow;
    col += uGlow * pow(toSun, 12.0) * exp(-max(h, 0.0) * 18.0) * uGlowK * 0.8;
    col = mix(col, uHorizon * 0.25, smoothstep(0.0, -0.08, h));
    gl_FragColor = vec4(col, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const STAR_VERT = /* glsl */`
  attribute float aMag; attribute vec3 aColor; attribute float aPhase;
  uniform float uPixelRatio; uniform float uTime; uniform float uOpacity; uniform float uSize; uniform float uGlow;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec3 dir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    float b = pow(10.0, -0.4 * (aMag - 1.0));                             // mag 1 → 1.0
    float ext = pow(clamp(dir.y * 1.35 + 0.05, 0.0, 1.0), 0.55);        // atmospheric extinction near the horizon
    float tw = 1.0 + 0.22 * (1.2 - dir.y) * sin(uTime * (2.5 + aPhase * 5.0) + aPhase * 60.0);
    float size = uGlow > 0.5 ? uSize * (0.6 + 0.8 * aPhase) : (1.5 + 2.4 * sqrt(min(b, 8.0))) * uSize;
    gl_PointSize = size * uPixelRatio;
    vColor = aColor * (uGlow > 0.5 ? b : min(b, 6.0) * tw) * ext;
    vAlpha = (dir.y < -0.02) ? 0.0 : uOpacity * ext;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }`;

const STAR_FRAG = /* glsl */`
  uniform float uGlow;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r2 = dot(p, p) * 4.0;
    float a = uGlow > 0.5 ? exp(-r2 * 2.2) * (1.0 - r2 * 0.25) : exp(-r2 * 3.0);
    if (r2 > 1.0) discard;
    vec3 col = vColor * a * vAlpha;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const MOON_VERT = /* glsl */`
  varying vec2 vUv; varying vec3 vN;
  void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; }`;
const MOON_FRAG = /* glsl */`
  uniform vec3 uSunDir; uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    vec3 n = vec3(p.x, p.y, sqrt(1.0 - r2));
    vec3 nw = normalize(mat3(modelMatrix) * n);
    float lit = max(dot(nw, uSunDir), 0.0);
    // faint maria pattern
    float maria = 0.75 + 0.25 * sin(p.x * 7.0 + 1.0) * sin(p.y * 6.0 - 0.5);
    vec3 col = vec3(0.95, 0.93, 0.86) * (lit * 1.6 * maria + 0.012);
    float edge = 1.0 - smoothstep(0.90, 1.0, r2);
    gl_FragColor = vec4(col * uOpacity, edge);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const SEA_VERT = DOME_VERT;
const SEA_FRAG = /* glsl */`
  uniform vec3 uSea; uniform vec3 uHorizon;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    if (d.y > 0.0) discard;
    vec3 col = mix(uSea, uHorizon * 0.7, exp(-(-d.y) * 7.0));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// ---------------------------------------------------------------------------------------------
export class SkyDome {
  constructor({ quality = 'high', starCount, seed = 1912 } = {}) {
    this.quality = quality;
    const counts = { low: 1800, medium: 3500, high: 6000, ultra: 7000 };
    this.starCount = starCount || counts[quality] || 6000;
    this.group = new THREE.Group();
    this.group.name = 'SkyDome';
    this.palette = skyPalette(45);
    this._radius = 1;
    this._rng = mulberry32(seed);

    // --- Preetham sky -----------------------------------------------------------------------
    this.sky = new Sky();
    this.sky.name = 'PreethamSky';
    this.sky.scale.setScalar(1);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    this.sky.material.depthTest = false;
    const u = this.sky.material.uniforms;
    u.turbidity.value = 2.2; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.86;
    this.group.add(this.sky);

    // --- twilight / night dome --------------------------------------------------------------
    this.domeMaterial = new THREE.ShaderMaterial({
      name: 'NightDome', vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, transparent: true,
      depthWrite: false, depthTest: true,
      uniforms: {
        uZenith: { value: new THREE.Color(0.002, 0.003, 0.008) }, uHorizon: { value: new THREE.Color(0.03, 0.035, 0.06) },
        uGlow: { value: new THREE.Color(0, 0, 0) }, uSunXZ: { value: new THREE.Vector2(1, 0) }, uGlowK: { value: 0 },
        uOpacity: { value: 0 }, uSunY: { value: 0 },
      },
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.domeMaterial);
    this.dome.name = 'NightDome';
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -990;
    this.group.add(this.dome);

    // --- stars + Milky Way ------------------------------------------------------------------
    this._buildStars();

    // --- moon -------------------------------------------------------------------------------
    this.moonMaterial = new THREE.ShaderMaterial({
      name: 'Moon', vertexShader: MOON_VERT, fragmentShader: MOON_FRAG, transparent: true, depthWrite: false, depthTest: true,
      uniforms: { uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uOpacity: { value: 1 } },
    });
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.moonMaterial);
    this.moon.name = 'Moon';
    this.moon.renderOrder = -970;
    this.moon.frustumCulled = false;
    this.moon.visible = false;
    this.group.add(this.moon);

    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.sunElevationDeg = 45;
    this.setRadius(4000);
  }

  _buildStars() {
    const rng = this._rng;
    const n = this.starCount;
    const mwCount = Math.round(n * 0.7);
    const total = BRIGHT.length + n + mwCount;
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const mag = new Float32Array(total);
    const phase = new Float32Array(total);
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    let k = 0;
    const put = (ra, dec, m, bv) => {
      equatorialToWorldAtLst0(ra, dec, undefined, v);
      pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
      bvToColor(bv, c);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      mag[k] = m; phase[k] = rng();
      k++;
    };
    for (const [rah, decd, m, bv] of BRIGHT) put(rah / 24 * 2 * Math.PI, decd * DEG, m, bv);
    // Field stars: N(<m) ∝ 10^(0.5 m); more of them toward the galactic plane.
    const mMin = 2.6, mMax = 6.6;
    const A = Math.pow(10, 0.5 * mMin), B = Math.pow(10, 0.5 * mMax);
    let placed = 0;
    while (placed < n) {
      const ra = rng() * 2 * Math.PI;
      const dec = Math.asin(rng() * 2 - 1);
      const m = Math.log10(A + rng() * (B - A)) / 0.5;
      const bv = THREE.MathUtils.clamp(0.55 + gaussian(rng) * 0.45, -0.3, 1.9);
      put(ra, dec, m, bv);
      placed++;
    }
    // Milky Way band in galactic coordinates: dense, faint, brighter toward the centre, with the Great Rift.
    placed = 0;
    while (placed < mwCount) {
      const l = rng() * 2 * Math.PI;
      const lDeg = l / DEG;
      const centreBoost = 0.55 + 0.45 * Math.cos(l);            // galactic centre (l = 0) is the richest
      if (rng() > centreBoost) continue;
      let b = gaussian(rng) * (5.5 + 2.5 * Math.cos(l)) * DEG;
      // Great Rift: dark lane from Cygnus down to Sagittarius, just above the plane
      const inRift = lDeg > 0 && lDeg < 75 && b > 0 && b < 3.5 * DEG;
      if (inRift && rng() < 0.75) continue;
      const m = 5.2 + rng() * 2.2;
      const bv = THREE.MathUtils.clamp(0.6 + gaussian(rng) * 0.35, -0.2, 1.6);
      const eq = galacticToEquatorial(l, b);
      put(eq.ra, eq.dec, m, bv);
      placed++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mkMat = (glow) => new THREE.ShaderMaterial({
      name: glow ? 'MilkyWayGlow' : 'Stars', vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true,
      depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: 1 }, uTime: { value: 0 }, uOpacity: { value: 0 }, uSize: { value: glow ? 90 : 1 }, uGlow: { value: glow ? 1 : 0 } },
    });
    this.starMaterial = mkMat(false);
    this.stars = new THREE.Points(geo, this.starMaterial);
    this.stars.name = 'Stars';
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -980;

    // Diffuse Milky Way glow: a few hundred big soft sprites along the plane.
    const gCount = this.quality === 'low' ? 250 : 700;
    const gPos = new Float32Array(gCount * 3), gCol = new Float32Array(gCount * 3), gMag = new Float32Array(gCount), gPh = new Float32Array(gCount);
    for (let i = 0; i < gCount; i++) {
      const l = rng() * 2 * Math.PI;
      const b = gaussian(rng) * (4.5 + 2.0 * Math.cos(l)) * DEG;
      const eq = galacticToEquatorial(l, b);
      equatorialToWorldAtLst0(eq.ra, eq.dec, undefined, v);
      gPos[i * 3] = v.x; gPos[i * 3 + 1] = v.y; gPos[i * 3 + 2] = v.z;
      const warm = 0.5 + 0.5 * Math.cos(l);
      gCol[i * 3] = 0.015 * (0.9 + 0.3 * warm); gCol[i * 3 + 1] = 0.015 * 0.95; gCol[i * 3 + 2] = 0.015 * (1.05 - 0.2 * warm);
      const lDeg = l / DEG;
      const rift = lDeg > 0 && lDeg < 75 && b > 0 && b < 3 * DEG ? 0.35 : 1.0;
      gMag[i] = 1 - Math.log10((0.6 + 0.6 * Math.cos(l)) * rift) / 0.4;   // encodes brightness through the mag formula
      gPh[i] = rng();
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    gGeo.setAttribute('aColor', new THREE.BufferAttribute(gCol, 3));
    gGeo.setAttribute('aMag', new THREE.BufferAttribute(gMag, 1));
    gGeo.setAttribute('aPhase', new THREE.BufferAttribute(gPh, 1));
    this.glowMaterial = mkMat(true);
    this.milkyWay = new THREE.Points(gGeo, this.glowMaterial);
    this.milkyWay.name = 'MilkyWay';
    this.milkyWay.frustumCulled = false;
    this.milkyWay.renderOrder = -985;

    this.celestial = new THREE.Group();        // rotated by sidereal time
    this.celestial.name = 'Celestial';
    this.celestial.add(this.milkyWay, this.stars);
    this.group.add(this.celestial);
  }

  /** Dome radius — kept inside the camera's far plane by update(). */
  setRadius(r) {
    if (Math.abs(r - this._radius) < 1) return;
    this._radius = r;
    this.sky.scale.setScalar(r * 1.05);
    this.dome.scale.setScalar(r);
    this.celestial.scale.setScalar(r * 0.98);
    this.moon.scale.setScalar(r * 0.95 * 0.0091);     // 0.52° angular diameter
  }

  /**
   * @param {object} s
   * @param {THREE.Vector3} s.sunDir unit world direction to the sun
   * @param {number} s.sunElevationDeg
   * @param {number} s.lst local sidereal time (rad)
   * @param {object} [s.moon] { dir, elevation, illuminated }
   * @param {number} s.time seconds (twinkle)
   * @param {THREE.Vector3} s.cameraPos
   * @param {number} s.cameraFar
   * @param {number} s.pixelRatio
   */
  update(s) {
    this.sunDir.copy(s.sunDir);
    this.sunElevationDeg = s.sunElevationDeg;
    const p = skyPalette(s.sunElevationDeg, this.palette);
    if (s.cameraPos) this.group.position.copy(s.cameraPos);
    if (s.cameraFar) this.setRadius(Math.max(200, s.cameraFar * 0.8));

    // Preetham: the sun position magnitude drives its built-in twilight fade.
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(s.sunDir).multiplyScalar(400000);
    const low = smoothstep(25, -2, s.sunElevationDeg);
    u.turbidity.value = 2.0 + 3.5 * low;
    u.rayleigh.value = 1.4 + 2.2 * low;
    u.mieCoefficient.value = 0.004 + 0.012 * low;
    u.mieDirectionalG.value = 0.86 + 0.09 * low;
    this.sky.visible = p.nightMix < 0.995;

    const d = this.domeMaterial.uniforms;
    d.uZenith.value.copy(p.zenith); d.uHorizon.value.copy(p.horizon); d.uGlow.value.copy(p.glow);
    d.uGlowK.value = p.glowK; d.uOpacity.value = p.nightMix; d.uSunY.value = s.sunDir.y;
    const xz = Math.hypot(s.sunDir.x, s.sunDir.z) || 1;
    d.uSunXZ.value.set(s.sunDir.x / xz, s.sunDir.z / xz);
    this.dome.visible = p.nightMix > 0.002;

    const pr = s.pixelRatio || 1;
    for (const m of [this.starMaterial, this.glowMaterial]) {
      m.uniforms.uOpacity.value = p.starMix;
      m.uniforms.uTime.value = s.time || 0;
      m.uniforms.uPixelRatio.value = pr;
    }
    this.celestial.visible = p.starMix > 0.002;
    if (typeof s.lst === 'number') starDomeQuaternion(s.lst, undefined, this.celestial.quaternion);

    if (s.moon && s.moon.dir) {
      const vis = s.moon.elevation > -0.02 && p.starMix > 0.02;
      this.moon.visible = vis;
      if (vis) {
        this.moon.position.copy(s.moon.dir).multiplyScalar(this._radius * 0.95);
        this.moon.lookAt(this.group.position);   // Mesh.lookAt turns +z (the plane's face) toward the camera
        this.moonMaterial.uniforms.uSunDir.value.copy(s.sunDir);
        this.moonMaterial.uniforms.uOpacity.value = p.starMix;
      }
    } else this.moon.visible = false;
  }

  /**
   * A tiny scene for the environment cube: Preetham sky (no sun disc), the night dome and a
   * sea hemisphere so downward reflections are sea-coloured. `sync()` copies the live uniforms.
   */
  createEnvScene() {
    const scene = new THREE.Scene();
    const sky = new Sky();
    sky.scale.setScalar(40);
    sky.material.depthTest = false;
    sky.renderOrder = -3;
    const sea = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({
      name: 'EnvSea', vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false,
      uniforms: { uSea: { value: new THREE.Color(0.01, 0.03, 0.05) }, uHorizon: { value: new THREE.Color() } },
    }));
    sea.renderOrder = -2;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(32, 32, 16), this.domeMaterial);
    dome.renderOrder = -1;
    scene.add(sky, sea, dome);
    const self = this;
    return {
      scene,
      sync() {
        const a = self.sky.material.uniforms, b = sky.material.uniforms;
        b.sunPosition.value.copy(a.sunPosition.value);
        b.turbidity.value = a.turbidity.value; b.rayleigh.value = a.rayleigh.value;
        b.mieCoefficient.value = a.mieCoefficient.value; b.mieDirectionalG.value = a.mieDirectionalG.value;
        if (b.showSunDisc) b.showSunDisc.value = 0;
        sky.visible = self.sky.visible;
        dome.visible = self.dome.visible;
        const p = self.palette;
        sea.material.uniforms.uHorizon.value.copy(p.horizon);
        const day = smoothstep(-6, 8, p.elDeg);
        sea.material.uniforms.uSea.value.setRGB(0.004 + 0.012 * day, 0.012 + 0.045 * day, 0.02 + 0.07 * day);
      },
      dispose() { sky.geometry.dispose(); sky.material.dispose(); sea.geometry.dispose(); sea.material.dispose(); dome.geometry.dispose(); },
    };
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
  }
}
