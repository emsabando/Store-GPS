/**
 * PostPipeline — the pmndrs `postprocessing` EffectComposer that the Engine renders through.
 *
 *   RenderPass (scene → HalfFloat linear HDR buffer, NO tone mapping: three.js only tone-maps
 *               when the render target is the screen, see WebGLPrograms.getParameters)
 *   → N8AOPostPass (quality dependent: disabled / half-res / full-res; reads the composer depth)
 *   → EffectPass( BloomEffect (mip-map blur, HDR threshold)
 *                 ToneMappingEffect (AgX, applied exactly once; honours renderer.toneMappingExposure)
 *                 SMAAEffect (HIGH / ULTRA)
 *                 VignetteEffect (subtle) )  → screen, linear → sRGB encode in the same shader.
 *
 * Tone mapping is applied exactly once: the scene is rendered into an off-screen render target
 * (three skips `renderer.toneMapping` there), every pmndrs full-screen material is `toneMapped: false`,
 * and only the ToneMappingEffect maps HDR → display. `renderer.toneMapping` is still AgX so the
 * composer-bypass path (post disabled / composer failed) looks identical. Verified empirically with a
 * mid-grey unlit quad in `tests/`-style Playwright runs — see the Engine report.
 */
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, VignetteEffect, SMAAEffect, ToneMappingEffect,
  SMAAPreset, ToneMappingMode, BlendFunction, EdgeDetectionMode, PredicationMode, VignetteTechnique,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

const SKIP = BlendFunction.SKIP !== undefined ? BlendFunction.SKIP : BlendFunction.DST;

const SMAA_PRESETS = {
  LOW: SMAAPreset.LOW, MEDIUM: SMAAPreset.MEDIUM, HIGH: SMAAPreset.HIGH, ULTRA: SMAAPreset.ULTRA,
};

/** AO tuning shared by every preset (metres). */
export const AO_SETTINGS = Object.freeze({
  aoRadius: 1.5,
  distanceFalloff: 1.0,
  intensity: 2.5,
  screenSpaceRadius: false,
});

/**
 * n8ao 2.0.1 wraps its half-res depth/normal MRT in a shim whose `texture` getter returns the
 * *array* of textures. three r187's WebGLTextures.setupRenderTarget reads `renderTarget.texture.mipmaps`,
 * so the first half-res AO frame throws. Feature-detect and give the instance a standard `texture`
 * accessor (n8ao itself only reads `.textures[i]`). Cheap: one property check per frame.
 */
function patchHalfResTarget(aoPass) {
  const t = aoPass.depthDownsampleTarget;
  if (!t || !Array.isArray(t.texture)) return;
  Object.defineProperty(t, 'texture', {
    configurable: true,
    enumerable: false,
    get() { return this.textures[0]; },
    set(v) { this.textures[0] = v; },
  });
}

export class PostPipeline {
  /**
   * @param {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, width: number, height: number, preset: object }} o
   */
  constructor({ renderer, scene, camera, width, height, preset }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.preset = preset;
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));

    /** Requested (user) toggles; the effective state also depends on the quality preset. */
    this.requested = { ao: true, bloom: true, smaa: true, vignette: true, godrays: false };

    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 0,              // SMAA does the AA; MSAA + post would double the cost at 4K
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.composer.autoRenderToScreen = true;

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // --- N8AO ---
    this.aoPass = null;
    try {
      const ao = new N8AOPostPass(scene, camera, this.width, this.height);
      const c = ao.configuration;
      c.aoRadius = AO_SETTINGS.aoRadius;
      c.distanceFalloff = AO_SETTINGS.distanceFalloff;
      c.intensity = AO_SETTINGS.intensity;
      c.screenSpaceRadius = AO_SETTINGS.screenSpaceRadius;
      c.aoSamples = 16;
      c.denoiseSamples = 8;
      c.denoiseRadius = 12;
      c.gammaCorrection = false;     // we are not the last pass: the EffectPass encodes to sRGB
      c.color = new THREE.Color(0x000000);
      c.halfRes = preset.ao === 'half';
      c.depthAwareUpsampling = true;
      c.transparencyAware = false;
      c.accumulate = false;
      this.aoPass = ao;
      this.composer.addPass(ao);
      patchHalfResTarget(ao);
    } catch (err) {
      console.warn('[engine] N8AO unavailable, ambient occlusion disabled', err);
    }

    // --- Effects ---
    this.bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 1.0,
      luminanceSmoothing: 0.08,
      intensity: 0.5,
      radius: 0.6,
      levels: 8,
    });
    this.toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    this.smaa = new SMAAEffect({
      preset: SMAA_PRESETS[preset.smaa] ?? SMAAPreset.HIGH,
      edgeDetectionMode: EdgeDetectionMode.COLOR,
      predicationMode: PredicationMode.DISABLED,
    });
    this.vignette = new VignetteEffect({ technique: VignetteTechnique.DEFAULT, offset: 0.32, darkness: 0.42 });

    this.effectPass = new EffectPass(camera, this.bloom, this.toneMapping, this.smaa, this.vignette);
    this.effectPass.renderToScreen = true;
    this.composer.addPass(this.effectPass);

    this.composer.setSize(this.width, this.height, false);
    this.applyToggles();
  }

  /** Effective effect states after combining user toggles with the quality preset. */
  get effective() {
    const p = this.preset;
    return {
      ao: !!(this.aoPass && this.requested.ao && p.ao !== 'off'),
      bloom: !!(this.requested.bloom && p.bloom),
      smaa: !!this.requested.smaa,
      vignette: !!(this.requested.vignette && p.vignette !== false),
      godrays: false,
    };
  }

  applyToggles() {
    const e = this.effective;
    if (this.aoPass) this.aoPass.enabled = e.ao;
    this._setEffect(this.bloom, e.bloom, BlendFunction.SCREEN);
    this._setEffect(this.smaa, e.smaa, BlendFunction.SRC);
    this._setEffect(this.vignette, e.vignette, BlendFunction.NORMAL);
    // The tone mapper is never skipped: it is the single place HDR → display happens.
    if (this.toneMapping.blendMode.blendFunction !== BlendFunction.SRC) this.toneMapping.blendMode.blendFunction = BlendFunction.SRC;
  }

  _setEffect(effect, on, fn) {
    const want = on ? fn : SKIP;
    if (effect.blendMode.blendFunction !== want) effect.blendMode.blendFunction = want; // dispatches 'change' → EffectPass recompiles
  }

  /** @param {{ ao?: boolean, bloom?: boolean, smaa?: boolean, vignette?: boolean, godrays?: boolean }} flags */
  setEnabled(flags) {
    if (!flags || typeof flags !== 'object') return;
    for (const k of Object.keys(this.requested)) if (typeof flags[k] === 'boolean') this.requested[k] = flags[k];
    this.applyToggles();
  }

  setQuality(preset) {
    this.preset = preset;
    if (this.aoPass) {
      const wantHalf = preset.ao === 'half';
      if (this.aoPass.configuration.halfRes !== wantHalf) {
        this.aoPass.configuration.halfRes = wantHalf;   // re-allocates the half-res targets
        this.aoPass.setSize(this.width, this.height);
        patchHalfResTarget(this.aoPass);
      }
    }
    const smaaPreset = SMAA_PRESETS[preset.smaa] ?? SMAAPreset.HIGH;
    if (typeof this.smaa.applyPreset === 'function') this.smaa.applyPreset(smaaPreset);
    this.applyToggles();
  }

  setSize(width, height) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    // The renderer has already been sized by the Engine; composer.setSize only resizes buffers
    // when the renderer size differs, so we pass the exact drawing-buffer size.
    this.composer.setSize(this.width, this.height, false);
  }

  setCamera(camera) {
    this.camera = camera;
    this.renderPass.mainCamera = camera;
    this.effectPass.mainCamera = camera;
    if (this.aoPass) this.aoPass.camera = camera;
  }

  render(dt) {
    if (this.aoPass && this.aoPass.enabled) patchHalfResTarget(this.aoPass);
    this.composer.render(dt);
  }

  dispose() {
    try { this.composer.dispose(); } catch { /* ignore */ }
  }
}
