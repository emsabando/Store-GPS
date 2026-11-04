// STUB — replaced by the Core engineer (ARCHITECTURE.md §3). Plain WebGL renderer, no post-processing.
import * as THREE from 'three';
export class Engine {
  constructor({ canvas, settings }) {
    this.canvas = canvas; this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1e33');
    this.camera = new THREE.PerspectiveCamera(settings.get('fov') || 75, 1, 0.1, 6000);
    this.composer = null;
    this.quality = settings.get('quality') || 'high';
    this._updates = new Set(); this._running = false; this._clock = new THREE.Clock();
    this.stats = { drawCalls: 0, triangles: 0, fps: 0, frameMs: 0, width: 0, height: 0 };
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x443322, 1.0));
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  resize() { const w = window.innerWidth, h = window.innerHeight; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.stats.width = w; this.stats.height = h; }
  setQuality(q) { this.quality = q; }
  setResolution() { this.resize(); }
  setEnvironment(t) { this.scene.environment = t; }
  setPostEnabled() {}
  setExposure(x) { this.renderer.toneMappingExposure = x; }
  setFog(color, density) { this.scene.fog = density > 0 ? new THREE.FogExp2(color, density) : null; }
  onUpdate(fn) { this._updates.add(fn); return () => this._updates.delete(fn); }
  start() { if (this._running) return; this._running = true; this._clock.start(); const loop = () => { if (!this._running) return; requestAnimationFrame(loop); const dt = Math.min(0.1, this._clock.getDelta()); const t0 = performance.now(); for (const fn of [...this._updates]) fn(dt, this._clock.elapsedTime); if (!this.manualRender) this.renderer.render(this.scene, this.camera); this.stats.frameMs = performance.now() - t0; this.stats.drawCalls = this.renderer.info.render.calls; this.stats.triangles = this.renderer.info.render.triangles; }; requestAnimationFrame(loop); }
  stop() { this._running = false; }
  renderOnce() { this.renderer.render(this.scene, this.camera); this.stats.drawCalls = this.renderer.info.render.calls; this.stats.triangles = this.renderer.info.render.triangles; }
  async screenshot() { this.renderer.render(this.scene, this.camera); return new Promise((r) => this.canvas.toBlob(r, 'image/png')); }
}
