/**
 * Engine — renderer, scene, camera, post-processing and the frame loop (ARCHITECTURE.md §3, §11).
 *
 *   const engine = new Engine({ canvas, settings });
 *   engine.renderer / scene / camera / composer
 *   engine.setQuality('ultra'); engine.setResolution('4k', 1.0);
 *   engine.onUpdate((dt, elapsed) => {}) → off; engine.start(); engine.stop();
 *   engine.setEnvironment(texture); engine.setPostEnabled({ ao, bloom, smaa, vignette }); engine.setExposure(x);
 *   engine.setFog(color, density); await engine.screenshot() → Blob; engine.stats
 *   engine.manualRender = true; engine.renderOnce();   // tests
 *
 * Resolution model: the drawing buffer is a *fixed* internal size for '4k' | '1440p' | '1080p'
 * (3840×2160 regardless of the window) and `window × devicePixelRatio × renderScale` for 'native'
 * (device pixel ratio capped per quality preset). The canvas is then letterboxed into the window
 * with CSS (object-fit: contain semantics done by hand: explicit CSS width/height + centring offsets).
 */
import * as THREE from 'three';
import { QUALITY_PRESETS, RESOLUTION_PRESETS, normalizeQuality, normalizeResolution } from './QualityPresets.js';
import { PostPipeline } from './PostPipeline.js';

const CAMERA_NEAR = 0.12;
const MAX_DT = 0.1;
const MAX_NATIVE_PIXEL_RATIO = 3;

export class Engine {
  /**
   * @param {{ canvas: HTMLCanvasElement, settings: { get(k): any, onChange(fn): Function } }} o
   */
  constructor({ canvas, settings, preserveDrawingBuffer = false }) {
    this.canvas = canvas;
    this.settings = settings;
    this._updates = new Set();
    this._qualityListeners = new Set();
    this._running = false;
    this._rafId = 0;
    this._hiddenTimer = 0;
    this._contextLost = false;
    this._envGenerated = null;   // PMREM texture we own (disposed on replacement)
    this._pmrem = null;
    this._timer = new THREE.Timer();
    this._lastFrameAt = 0;
    this._fpsAcc = 0;
    this._fpsN = 0;
    this._hiddenLast = 0;

    /** Test hook (§11): the loop runs update callbacks but only renders on renderOnce(). */
    this.manualRender = false;
    /** Optional frame-rate cap while visible (0 = uncapped, i.e. the display refresh rate). */
    this.maxFps = 0;
    /** Tiny tick rate while the tab is hidden (rAF is paused by the browser; we keep the sim alive, never render). */
    this.hiddenFps = 4;

    this.quality = normalizeQuality(settings.get('quality'));
    this.preset = QUALITY_PRESETS[this.quality];
    this.resolution = { mode: normalizeResolution(settings.get('resolution')), scale: clampScale(settings.get('renderScale')), width: 1, height: 1 };

    this.stats = { drawCalls: 0, triangles: 0, fps: 0, frameMs: 0, width: 0, height: 0, gpu: 'unknown' };

    // --- renderer ---
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,                 // SMAA in the post chain handles AA
      preserveDrawingBuffer: !!preserveDrawingBuffer, // manual-render tests screenshot between frames
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: false,
      alpha: false,
      stencil: false,
      depth: true,
      premultipliedAlpha: true,
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.AgXToneMapping !== undefined ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = this.preset.shadowType;
    r.localClippingEnabled = true;      // the sinking module clips interior water planes
    r.sortObjects = true;
    r.setClearColor(0x000000, 1);
    r.setPixelRatio(1);
    r.autoClear = true;
    r.info.autoReset = false;           // we reset once per frame so stats cover every composer pass
    this._maxAnisotropyHW = Math.max(1, r.capabilities.getMaxAnisotropy() || 1);
    this.stats.gpu = this._queryGpuName();

    // --- scene & camera ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);   // black until World sets the sky
    this.camera = new THREE.PerspectiveCamera(clampFov(settings.get('fov')), 16 / 9, CAMERA_NEAR, this.preset.far);
    this.camera.name = 'MainCamera';
    this.scene.add(this.camera);

    // --- post-processing ---
    this.post = null;
    this.composer = null;
    this._postEnabled = true;
    this._createPost();

    // --- events ---
    this._onResize = () => this._applyResolution();
    this._onContextLost = (e) => { e.preventDefault(); this._contextLost = true; console.warn('[engine] WebGL context lost — rendering paused, loop keeps running'); };
    this._onContextRestored = () => {
      this._contextLost = false;
      console.warn('[engine] WebGL context restored — rebuilding post pipeline');
      try { if (this.post) this.post.dispose(); } catch { /* ignore */ }
      this._createPost();
      this._applyResolution();
    };
    this._onVisibility = () => this._visibilityChanged();
    canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);
    this._offSettings = settings.onChange ? settings.onChange((key, value) => this._settingChanged(key, value)) : null;

    this._applyResolution();
  }

  // ------------------------------------------------------------------ quality

  /** Current preset name ('low' | 'medium' | 'high' | 'ultra'). */
  get quality() { return this._quality; }
  set quality(q) { this._quality = normalizeQuality(q); }

  /** Shadow map size (px) for the current preset. */
  get shadowMapSize() { return this.preset.shadowMapSize; }
  /** Number of cascades a CSM-like sun should use (2 at ultra, else 1). */
  get shadowCascades() { return this.preset.shadowCascades; }
  /** Anisotropy for colour/normal maps, capped by the GPU. */
  get maxAnisotropy() { return Math.min(this.preset.anisotropy, this._maxAnisotropyHW); }
  /** Draw distance in metres (builders/world may cull or fade beyond this). */
  get drawDistance() { return this.preset.drawDistance; }
  /** Whether the composer path is in use (false → plain renderer.render with AgX on the renderer). */
  get postEnabled() { return this._postEnabled && !!this.post; }

  setQuality(q) {
    const name = normalizeQuality(q);
    const changed = name !== this._quality;
    this._quality = name;
    this.preset = QUALITY_PRESETS[name];
    const r = this.renderer;
    if (r.shadowMap.type !== this.preset.shadowType) {
      r.shadowMap.type = this.preset.shadowType;
      r.shadowMap.needsUpdate = true;
      // Shadow type is baked into every lit program: force a recompile.
      this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
    }
    this.camera.far = this.preset.far;
    this.camera.updateProjectionMatrix();
    if (this.post) this.post.setQuality(this.preset);
    this._applyResolution();
    if (changed) for (const fn of [...this._qualityListeners]) { try { fn(name, this.preset); } catch (err) { console.error('[engine] quality listener threw', err); } }
  }

  /** Subscribe to preset changes: fn(name, preset) → unsubscribe. */
  onQualityChange(fn) { this._qualityListeners.add(fn); return () => this._qualityListeners.delete(fn); }

  // --------------------------------------------------------------- resolution

  /**
   * @param {'native'|'4k'|'1440p'|'1080p'} mode
   * @param {number} [renderScale] applies to 'native' only (fixed modes are exact by contract)
   */
  setResolution(mode, renderScale) {
    this.resolution.mode = normalizeResolution(mode);
    if (renderScale !== undefined) this.resolution.scale = clampScale(renderScale);
    this._applyResolution();
  }

  /** Computes the internal drawing-buffer size and the CSS letterbox for the current window. */
  _applyResolution() {
    const winW = Math.max(1, window.innerWidth || this.canvas.clientWidth || 1);
    const winH = Math.max(1, window.innerHeight || this.canvas.clientHeight || 1);
    let w, h;
    const fixed = RESOLUTION_PRESETS[this.resolution.mode];
    if (fixed) {
      w = fixed.width; h = fixed.height;
    } else {
      const dprRaw = window.devicePixelRatio || 1;
      const cap = this.preset.pixelRatioCap > 0 ? this.preset.pixelRatioCap : MAX_NATIVE_PIXEL_RATIO;
      const dpr = Math.min(dprRaw, cap);
      w = Math.round(winW * dpr * this.resolution.scale);
      h = Math.round(winH * dpr * this.resolution.scale);
    }
    w = Math.max(2, w); h = Math.max(2, h);
    const r = this.renderer;
    r.setPixelRatio(1);
    const cur = r.getSize(new THREE.Vector2());
    if (cur.x !== w || cur.y !== h) r.setSize(w, h, false);   // drawing buffer = exactly w × h
    // CSS: object-fit contain — scale to fit the window, centre, keep aspect.
    const s = Math.min(winW / w, winH / h);
    const cssW = Math.round(w * s), cssH = Math.round(h * s);
    const st = this.canvas.style;
    st.position = 'fixed';
    st.width = `${cssW}px`;
    st.height = `${cssH}px`;
    st.left = `${Math.floor((winW - cssW) / 2)}px`;
    st.top = `${Math.floor((winH - cssH) / 2)}px`;
    st.right = 'auto'; st.bottom = 'auto'; st.margin = '0';
    st.display = 'block';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.post) this.post.setSize(w, h);
    this.resolution.width = w; this.resolution.height = h;
    this.stats.width = w; this.stats.height = h;
  }

  // ------------------------------------------------------------------- loop

  onUpdate(fn) { this._updates.add(fn); return () => this._updates.delete(fn); }

  get running() { return this._running; }

  start() {
    if (this._running) return;
    this._running = true;
    this._timer.reset();
    this._lastFrameAt = 0;
    if (document.hidden) this._startHiddenLoop(); else this._rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
    if (this._hiddenTimer) clearTimeout(this._hiddenTimer);
    this._hiddenTimer = 0;
  }

  _frame = (timestamp) => {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._frame);
    if (this.maxFps > 0 && this._lastFrameAt && timestamp - this._lastFrameAt < 1000 / this.maxFps - 0.5) return;
    this._lastFrameAt = timestamp;
    this._timer.update(timestamp);
    const dt = Math.min(MAX_DT, this._timer.getDelta());
    this._tick(dt, this._timer.getElapsed(), !this.manualRender);
  };

  _tick(dt, elapsed, render) {
    const t0 = performance.now();
    for (const fn of [...this._updates]) {
      try { fn(dt, elapsed); } catch (err) { console.error('[engine] update callback threw', err); }
    }
    if (render) this._render(dt);
    const ms = performance.now() - t0;
    this.stats.frameMs = this.stats.frameMs ? this.stats.frameMs * 0.9 + ms * 0.1 : ms;
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc >= 0.5) { this.stats.fps = Math.round(this._fpsN / this._fpsAcc); this._fpsAcc = 0; this._fpsN = 0; }
  }

  _render(dt) {
    if (this._contextLost) return;
    const r = this.renderer;
    r.info.reset();
    try {
      if (this.postEnabled) {
        this.post.render(dt);
      } else {
        r.setRenderTarget(null);
        r.render(this.scene, this.camera);
      }
    } catch (err) {
      console.error('[engine] render failed — falling back to plain rendering', err);
      this._postEnabled = false;
    }
    this.stats.drawCalls = r.info.render.calls;
    this.stats.triangles = r.info.render.triangles;
  }

  /** Renders one frame synchronously (manual render mode / tests). Updates stats. */
  renderOnce() {
    this._render(0);
    return this.stats;
  }

  _visibilityChanged() {
    if (!this._running) return;
    if (document.hidden) {
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = 0;
      this._startHiddenLoop();
    } else {
      if (this._hiddenTimer) clearTimeout(this._hiddenTimer);
      this._hiddenTimer = 0;
      this._timer.reset();
      this._lastFrameAt = 0;
      if (!this._rafId) this._rafId = requestAnimationFrame(this._frame);
    }
  }

  _startHiddenLoop() {
    if (this._hiddenTimer || this.hiddenFps <= 0) return;
    this._hiddenLast = performance.now();
    const step = () => {
      this._hiddenTimer = 0;
      if (!this._running || !document.hidden) return;
      const now = performance.now();
      const dt = Math.min(MAX_DT, (now - this._hiddenLast) / 1000);
      this._hiddenLast = now;
      this._tick(dt, this._timer.getElapsed(), false);   // simulate only — no rendering while hidden
      this._hiddenTimer = setTimeout(step, 1000 / this.hiddenFps);
    };
    this._hiddenTimer = setTimeout(step, 1000 / this.hiddenFps);
  }

  // ------------------------------------------------------------- environment

  /**
   * Sets the PBR environment. Accepts a PMREM texture, an equirectangular texture or a CubeTexture;
   * the latter two are converted with PMREMGenerator (and owned/disposed by the Engine). null clears it.
   */
  setEnvironment(texture) {
    if (this._envGenerated) { this._envGenerated.dispose(); this._envGenerated = null; }
    if (!texture) { this.scene.environment = null; return; }
    let env = texture;
    const needsPmrem = texture.isTexture && texture.isPMREMTexture !== true;   // r187 flags PMREM output textures
    if (needsPmrem) {
      try {
        if (!this._pmrem) { this._pmrem = new THREE.PMREMGenerator(this.renderer); this._pmrem.compileEquirectangularShader(); }
        const rt = texture.isCubeTexture ? this._pmrem.fromCubemap(texture) : this._pmrem.fromEquirectangular(texture);
        env = rt.texture;
        this._envGenerated = rt;
      } catch (err) {
        console.warn('[engine] PMREM conversion failed, using the texture directly', err);
      }
    }
    this.scene.environment = env;
  }

  /** PMREM from a live Scene (e.g. the sky): `engine.environmentFromScene(skyScene)`. */
  environmentFromScene(scene, sigma = 0.04) {
    if (this._envGenerated) { this._envGenerated.dispose(); this._envGenerated = null; }
    if (!this._pmrem) this._pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = this._pmrem.fromScene(scene, sigma);
    this._envGenerated = rt;
    this.scene.environment = rt.texture;
    return rt.texture;
  }

  /**
   * @param {boolean|{ ao?: boolean, bloom?: boolean, smaa?: boolean, vignette?: boolean, godrays?: boolean }} flags
   *   `false` bypasses the composer entirely (tone mapping then happens on the renderer); an object toggles effects.
   */
  setPostEnabled(flags) {
    if (typeof flags === 'boolean') { this._postEnabled = flags; return; }
    this._postEnabled = true;
    if (this.post) this.post.setEnabled(flags);
  }

  /** Current effective post-effect state. */
  get postState() { return this.post ? { enabled: this.postEnabled, ...this.post.effective } : { enabled: false, ao: false, bloom: false, smaa: false, vignette: false, godrays: false }; }

  setExposure(x) {
    const v = Number.isFinite(x) ? Math.max(0, x) : 1;
    this.renderer.toneMappingExposure = v;   // read by three's AgX in both the composer and the bypass path
  }
  get exposure() { return this.renderer.toneMappingExposure; }

  /**
   * Exponential fog. `density <= 0` or no colour removes it. Density is scaled by the preset so
   * shorter draw distances hide their pop-in a little more.
   */
  setFog(color, density) {
    if (!density || density <= 0) { this.scene.fog = null; return; }
    const c = color instanceof THREE.Color ? color : new THREE.Color(color ?? 0x000000);
    const d = density * (this.preset.fogScale || 1);
    if (this.scene.fog && this.scene.fog.isFogExp2) { this.scene.fog.color.copy(c); this.scene.fog.density = d; }
    else this.scene.fog = new THREE.FogExp2(c.getHex(), d);
  }

  /** Renders the composed frame and captures it in the same task (preserveDrawingBuffer is off). */
  screenshot(type = 'image/png', quality) {
    return new Promise((resolve, reject) => {
      try {
        this._render(0);
        this.canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))), type, quality);
      } catch (err) { reject(err); }
    });
  }

  /** Releases GPU resources and listeners (used by tests / hot reload). */
  dispose() {
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    if (this._offSettings) this._offSettings();
    if (this._envGenerated) this._envGenerated.dispose();
    if (this._pmrem) this._pmrem.dispose();
    if (this.post) this.post.dispose();
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------- internal

  _createPost() {
    try {
      this.post = new PostPipeline({ renderer: this.renderer, scene: this.scene, camera: this.camera, width: this.resolution.width, height: this.resolution.height, preset: this.preset });
      this.composer = this.post.composer;
    } catch (err) {
      console.error('[engine] post pipeline failed to initialise — rendering without post-processing', err);
      this.post = null; this.composer = null; this._postEnabled = false;
    }
  }

  _settingChanged(key, value) {
    switch (key) {
      case 'quality': this.setQuality(value); break;
      case 'resolution': this.setResolution(value); break;
      case 'renderScale': this.setResolution(this.resolution.mode, value); break;
      case 'fov': this.camera.fov = clampFov(value); this.camera.updateProjectionMatrix(); break;
      default: break;
    }
  }

  _queryGpuName() {
    try {
      const gl = this.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : (this.renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL');
    } catch { return 'unknown'; }
  }
}

function clampScale(v) { const n = Number(v); return Number.isFinite(n) ? Math.min(2, Math.max(0.5, n)) : 1; }
function clampFov(v) { const n = Number(v); return Number.isFinite(n) ? Math.min(110, Math.max(60, n)) : 75; }
