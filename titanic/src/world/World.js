/**
 * World (ARCHITECTURE.md §6): assembles the SkyDome, Environment (PMREM + fog + exposure), Ocean, Iceberg and
 * the sun light, driven by the GameClock for 10–15 April 1912 at ~41.7°N 49.9°W.
 */
import * as THREE from 'three';
import { SkyDome, skyPalette } from './Sky.js';
import { Environment } from './Environment.js';
import { Iceberg } from './Iceberg.js';
import { Ocean } from './Ocean.js';
import { sunPosition, moonPosition, localSiderealTime } from './Astronomy.js';

const SUN_WHITE = new THREE.Color(1.0, 0.97, 0.92);

export class World {
  constructor({ engine, materials, clock, quality = 'high', ship = null }) {
    this.engine = engine;
    this.materials = materials;
    this.clock = clock;
    this.quality = quality;
    this.ship = ship;
    this.wind = 0.35;
    this.swell = 0.45;
    this.sky = null; this.env = null; this.ocean = null; this.iceberg = null; this.sunLight = null;
    this._sunDir = new THREE.Vector3(0, 1, 0);
    this._moon = { dir: new THREE.Vector3(0, -1, 0), elevation: -30, illuminated: 0.0 };
    this._state = { sunDir: this._sunDir, sunElevationDeg: 45, lst: 0, moon: this._moon, time: 0, palette: skyPalette(45) };
    this._time = 0;
    this._shadowTarget = new THREE.Object3D();
    this._lastShadowUpdate = -1;
  }

  async build() {
    const scene = this.engine.scene;
    this.sky = new SkyDome({ quality: this.quality });
    this.sky.setRadius(Math.min(4500, (this.engine.camera.far || 6000) * 0.8));
    scene.add(this.sky.group);
    this.env = new Environment({ engine: this.engine, sky: this.sky, quality: this.quality });
    this.env.build();
    this.ocean = new Ocean({ quality: this.quality });
    scene.add(this.ocean.group);
    this.iceberg = new Iceberg({ quality: this.quality });
    this.iceberg.build();
    this.iceberg.setVisible?.(false);
    this.iceberg._dateVisible = false;
    scene.add(this.iceberg.group);

    // sun
    const size = this.quality === 'ultra' ? 4096 : this.quality === 'high' ? 4096 : this.quality === 'medium' ? 2048 : 1024;
    const sun = new THREE.DirectionalLight(0xfff1dd, 3.0);
    sun.name = 'Sun';
    sun.castShadow = this.quality !== 'low' || true;
    sun.shadow.mapSize.set(size, size);
    const ext = this.quality === 'ultra' ? 140 : this.quality === 'high' ? 120 : 90;
    sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext; sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 700;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    sun.shadow.radius = this.quality === 'low' ? 1 : 2;
    scene.add(sun); scene.add(sun.target);
    this.sunLight = sun;
    this.setWeather({ wind: this.wind, swell: this.swell });
    this._refreshAstronomy(true);
    this.env.update(0, this._state);
    this.env.refresh(this._state);
    return this;
  }

  setWeather({ wind = this.wind, swell = this.swell } = {}) {
    this.wind = wind; this.swell = swell;
    this.ocean?.setWeather({ wind, swell });
  }

  spawnIceberg(worldPos, opts) { return this.iceberg?.spawn(worldPos, opts); }

  _refreshAstronomy(force = false) {
    const c = this.clock;
    const date = c?.date || '1912-04-14';
    const minutes = c?.minutes ?? 12 * 60;
    sunPosition(date, minutes, undefined, undefined, this._sunDir);
    this._sunDir.normalize();
    const el = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(this._sunDir.y, -1, 1)));
    this._state.sunElevationDeg = el;
    this._state.lst = localSiderealTime(date, minutes);
    try {
      const m = moonPosition(date, minutes);
      if (m && m.isVector3) { this._moon.dir.copy(m).normalize(); this._moon.elevation = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(m.y, -1, 1))); this._moon.illuminated = m.illuminated ?? 0.05; }
      else if (m && m.dir) { this._moon.dir.copy(m.dir); this._moon.elevation = m.elevation ?? -30; this._moon.illuminated = m.illuminated ?? 0.05; }
    } catch { /* moon optional */ }
    skyPalette(el, this._state.palette);
  }

  update(dt, cameraPos) {
    this._time += dt;
    this._state.time = this._time;
    this._refreshAstronomy();
    const s = this._state;
    this.sky.update(s);
    this.sky.group.position.copy(cameraPos || this.engine.camera.position);
    this.env.update(dt, s);
    // sun light follows the camera so the shadow frustum covers the player's surroundings
    const sun = this.sunLight;
    const el = s.sunElevationDeg;
    const dayI = THREE.MathUtils.smoothstep(el, -3, 10);
    const pal = s.palette;
    sun.intensity = 3.4 * dayI * (pal.sunIntensity ?? 1);
    if (pal.sun) sun.color.copy(pal.sun);
    else if (pal.glow) { sun.color.copy(pal.glow).lerp(SUN_WHITE, THREE.MathUtils.smoothstep(el, 2, 18)); }
    const cam = cameraPos || this.engine.camera.position;
    const ahead = new THREE.Vector3(); this.engine.camera.getWorldDirection(ahead);
    const focus = cam.clone().addScaledVector(ahead, 30);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(this._sunDir, 400);
    sun.castShadow = dayI > 0.02 && this.quality !== 'low';
    // ocean
    const night = THREE.MathUtils.clamp(1 - THREE.MathUtils.smoothstep(el, -12, 2), 0, 1);
    this.ocean.update(dt, { cameraPos: cam, sunDir: this._sunDir, sunColor: sun.color, sunIntensity: dayI, horizonColor: pal.horizon, zenithColor: pal.zenith, night });
    this.iceberg.update(dt, { date: this.clock?.date });
  }

  dispose() { this.sky?.dispose?.(); this.env?.dispose?.(); this.ocean?.dispose?.(); this.iceberg?.dispose?.(); }
}
