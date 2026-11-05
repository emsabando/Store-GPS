/**
 * Environment — image-based lighting + atmosphere glue (ARCHITECTURE §6):
 *  - a 256² HDR cube of the sky (sky + twilight dome + sea hemisphere) rendered with a CubeCamera,
 *    turned into a PMREM for `engine.setEnvironment()` and reused by the ocean for reflections;
 *    regenerated when the sun moves > 2° or the day/twilight/night mode changes, throttled to
 *    once per 2 s (low quality: 20 s);
 *  - FogExp2 tied to the horizon colour (≈ 0.0006 by day, 0.0012 at night);
 *  - tone-mapping exposure by time of day (day 1.0, sunset 1.1, night 1.6 so interiors read);
 *  - the hemisphere fill light and the sun colour/intensity curves (`lightingForElevation`).
 *
 * Interior lamp warmth: builders light their rooms; `LAMP_COLOR_2200K` is the agreed colour.
 */
import * as THREE from 'three';
import { smoothstep } from './Astronomy.js';

/** 2200 K incandescent, linear RGB (CIE → sRGB primaries, normalised to red). */
export const LAMP_COLOR_2200K = new THREE.Color(1.0, 0.44, 0.13);

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const lerpC = (a, b, t, out) => out.copy(a).lerp(b, t);
const SUN_KEYS = [
  { el: -3, c: [1.0, 0.30, 0.10], i: 0.0 },
  { el: 0, c: [1.0, 0.42, 0.18], i: 0.55 },
  { el: 3, c: [1.0, 0.60, 0.35], i: 1.3 },
  { el: 10, c: [1.0, 0.86, 0.70], i: 2.6 },
  { el: 25, c: [1.0, 0.95, 0.90], i: 3.2 },
  { el: 90, c: [1.0, 0.98, 0.95], i: 3.4 },
];

/**
 * Lighting curves by solar elevation (degrees). All colours linear.
 * @returns {{ sunColor, sunIntensity, hemiSky, hemiGround, hemiIntensity, exposure, fogDensity, dayFactor }}
 */
export function lightingForElevation(elDeg, out = {}) {
  out.sunColor = out.sunColor || new THREE.Color();
  out.hemiSky = out.hemiSky || new THREE.Color();
  out.hemiGround = out.hemiGround || new THREE.Color();
  let i = 0;
  while (i < SUN_KEYS.length - 2 && elDeg > SUN_KEYS[i + 1].el) i++;
  const a = SUN_KEYS[i], b = SUN_KEYS[i + 1];
  const t = THREE.MathUtils.clamp((elDeg - a.el) / (b.el - a.el), 0, 1);
  out.sunColor.setRGB(a.c[0] + (b.c[0] - a.c[0]) * t, a.c[1] + (b.c[1] - a.c[1]) * t, a.c[2] + (b.c[2] - a.c[2]) * t);
  out.sunIntensity = a.i + (b.i - a.i) * t;

  const day = smoothstep(-4, 10, elDeg);          // 0 night … 1 day
  const dusk = smoothstep(-8, -1, elDeg) * (1 - smoothstep(2, 12, elDeg)); // bump around sunset
  const night = 1 - smoothstep(-12, -3, elDeg);
  // hemisphere sky colour: night starlight-blue → sunset warm → day sky blue
  _c1.setRGB(0.05, 0.075, 0.14);
  _c2.setRGB(0.70, 0.52, 0.46);
  lerpC(_c1, _c2, smoothstep(-8, 0, elDeg), out.hemiSky);
  _c2.setRGB(0.52, 0.70, 1.0);
  out.hemiSky.lerp(_c2, smoothstep(0, 12, elDeg));
  _c1.setRGB(0.010, 0.013, 0.022);
  _c2.setRGB(0.06, 0.11, 0.17);
  lerpC(_c1, _c2, day, out.hemiGround);
  out.hemiIntensity = 0.18 + 0.25 * smoothstep(-8, 0, elDeg) + 0.22 * smoothstep(0, 12, elDeg);
  out.exposure = 0.82 + 0.1 * dusk + 0.7 * night;
  out.fogDensity = 0.0012 - 0.0006 * day;
  out.dayFactor = day;
  out.nightFactor = night;
  return out;
}

export class Environment {
  constructor({ engine, sky, quality = 'high' }) {
    this.engine = engine;
    this.sky = sky;
    this.quality = quality;
    this.cubeSize = quality === 'low' ? 128 : 256;
    this.refreshInterval = quality === 'low' ? 20 : 2;
    this.refreshAngleDeg = 2;
    this.hemiLight = new THREE.HemisphereLight(0x87b0ff, 0x1a2630, 0.8);
    this.hemiLight.name = 'WorldHemisphere';
    this.lighting = lightingForElevation(45);
    this.cubeTexture = null;
    this._pmrem = null;
    this._pmremRT = null;
    this._envScene = null;
    this._lastRefreshDir = new THREE.Vector3(0, -2, 0);
    this._lastRefreshTime = -1e9;
    this._lastMode = '';
    this._pending = true;
    this._time = 0;
    this._fogColor = new THREE.Color(1, 0, 0);
    this._fogDensity = -1;
    this._fogTimer = 0;
    this._exposure = -1;
  }

  build() {
    const renderer = this.engine.renderer;
    this.cubeRT = new THREE.WebGLCubeRenderTarget(this.cubeSize, {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    this.cubeRT.texture.name = 'SkyCube';
    this.cubeTexture = this.cubeRT.texture;
    this.cubeCamera = new THREE.CubeCamera(0.1, 100, this.cubeRT);
    this._envScene = this.sky.createEnvScene();
    try {
      this._pmrem = new THREE.PMREMGenerator(renderer);
      this._pmrem.compileCubemapShader();
    } catch (err) {
      console.warn('[world] PMREM unavailable', err);
      this._pmrem = null;
    }
    this.engine.scene.add(this.hemiLight);
  }

  static modeFor(elDeg) { return elDeg > 2 ? 'day' : elDeg > -9 ? 'twilight' : 'night'; }

  /**
   * @param {number} dt
   * @param {{ sunDir:THREE.Vector3, sunElevationDeg:number, palette:object }} s
   */
  update(dt, s) {
    this._time += dt;
    const L = lightingForElevation(s.sunElevationDeg, this.lighting);
    this.hemiLight.color.copy(L.hemiSky);
    this.hemiLight.groundColor.copy(L.hemiGround);
    this.hemiLight.intensity = L.hemiIntensity;

    if (Math.abs(L.exposure - this._exposure) > 0.005) {
      this._exposure = L.exposure;
      if (typeof this.engine.setExposure === 'function') this.engine.setExposure(L.exposure);
    }
    this._fogTimer += dt;
    const fogC = s.palette.fog;
    if (this._fogTimer > 0.25 || this._fogDensity < 0) {
      this._fogTimer = 0;
      const dc = Math.abs(fogC.r - this._fogColor.r) + Math.abs(fogC.g - this._fogColor.g) + Math.abs(fogC.b - this._fogColor.b);
      if (dc > 0.004 || Math.abs(L.fogDensity - this._fogDensity) > 1e-5) {
        this._fogColor.copy(fogC);
        this._fogDensity = L.fogDensity;
        if (typeof this.engine.setFog === 'function') this.engine.setFog(this._fogColor.clone(), L.fogDensity);
        else this.engine.scene.fog = new THREE.FogExp2(this._fogColor.clone(), L.fogDensity);
      }
    }

    const mode = Environment.modeFor(s.sunElevationDeg);
    const moved = THREE.MathUtils.radToDeg(this._lastRefreshDir.angleTo(s.sunDir));
    if (mode !== this._lastMode || moved > this.refreshAngleDeg) this._pending = true;
    if (this._pending && this._time - this._lastRefreshTime >= this.refreshInterval) this.refresh(s);
  }

  /** Re-render the sky cube and rebuild the PMREM environment. */
  refresh(s) {
    if (!this.cubeCamera || !this._envScene) return;
    const renderer = this.engine.renderer;
    this._envScene.sync();
    const prevRT = renderer.getRenderTarget();
    try {
      this.cubeCamera.update(renderer, this._envScene.scene);
      if (this._pmrem) {
        const rt = this._pmrem.fromCubemap(this.cubeRT.texture);
        if (typeof this.engine.setEnvironment === 'function') this.engine.setEnvironment(rt.texture);
        else this.engine.scene.environment = rt.texture;
        if (this._pmremRT) this._pmremRT.dispose();
        this._pmremRT = rt;
      }
    } catch (err) {
      console.warn('[world] environment refresh failed', err);
    } finally {
      renderer.setRenderTarget(prevRT);
    }
    this._lastRefreshDir.copy(s.sunDir);
    this._lastRefreshTime = this._time;
    this._lastMode = Environment.modeFor(s.sunElevationDeg);
    this._pending = false;
  }

  dispose() {
    if (this._pmremRT) this._pmremRT.dispose();
    if (this._pmrem) this._pmrem.dispose();
    if (this.cubeRT) this.cubeRT.dispose();
    if (this._envScene) this._envScene.dispose();
    this.engine.scene.remove(this.hemiLight);
  }
}
