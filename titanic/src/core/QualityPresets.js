/**
 * Quality presets — the single table the Engine owns (ARCHITECTURE.md §3).
 * Other modules read the *effective* values through the Engine getters
 * (`engine.quality`, `engine.shadowMapSize`, `engine.maxAnisotropy`, `engine.drawDistance`,
 * `engine.shadowCascades`) rather than importing this table, so the Engine can cap them by
 * what the GPU actually supports.
 *
 * | preset | shadows              | AO            | bloom | aniso | pixel ratio cap | draw distance |
 * | low    | 1024 PCF             | off           | off   | 2     | 1               | 600 m         |
 * | medium | 2048 PCF (soft)      | off           | on    | 4     | 1.5             | 1200 m        |
 * | high   | 4096 PCF (soft)      | N8AO half-res | on    | 8     | 2               | 2500 m        |
 * | ultra  | 4096 PCF (soft)+2CSM | N8AO full-res | on    | 16    | native / 4K     | 6000 m        |
 *
 * Note: three r187 removed `PCFSoftShadowMap` (the renderer warns and silently uses PCF), so every
 * preset uses `PCFShadowMap`; "soft" is achieved by the light's `shadow.radius` which the sun owner sets.
 */
import * as THREE from 'three';

export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

export const QUALITY_PRESETS = Object.freeze({
  low: Object.freeze({
    name: 'low',
    shadowMapSize: 1024,
    shadowType: THREE.PCFShadowMap,
    shadowEveryN: 3,               // refresh the sun shadow map every N frames
    shadowCascades: 1,
    ao: 'off',                 // 'off' | 'half' | 'full'
    bloom: false,
    vignette: true,
    smaa: 'MEDIUM',            // SMAAPreset name
    anisotropy: 2,
    pixelRatioCap: 1,
    drawDistance: 600,
    far: 1500,                 // camera far plane (sky / sea still need to be visible)
    fogScale: 1.0,
  }),
  medium: Object.freeze({
    name: 'medium',
    shadowMapSize: 2048,
    shadowType: THREE.PCFShadowMap,       // r187 removed PCFSoftShadowMap (falls back to PCF with a warning)
    shadowEveryN: 2,               // refresh the sun shadow map every N frames
    shadowCascades: 1,
    ao: 'off',
    bloom: true,
    vignette: true,
    smaa: 'HIGH',
    anisotropy: 4,
    pixelRatioCap: 1.5,
    drawDistance: 1200,
    far: 3000,
    fogScale: 1.0,
  }),
  high: Object.freeze({
    name: 'high',
    shadowMapSize: 4096,
    shadowType: THREE.PCFShadowMap,       // r187 removed PCFSoftShadowMap (falls back to PCF with a warning)
    shadowEveryN: 2,               // refresh the sun shadow map every N frames
    shadowCascades: 1,
    ao: 'half',
    bloom: true,
    vignette: true,
    smaa: 'HIGH',
    anisotropy: 8,
    pixelRatioCap: 2,
    drawDistance: 2500,
    far: 6000,
    fogScale: 1.0,
  }),
  ultra: Object.freeze({
    name: 'ultra',
    shadowMapSize: 4096,
    shadowType: THREE.PCFShadowMap,       // r187 removed PCFSoftShadowMap (falls back to PCF with a warning)
    shadowEveryN: 1,               // refresh the sun shadow map every N frames
    shadowCascades: 2,
    ao: 'full',
    bloom: true,
    vignette: true,
    smaa: 'ULTRA',
    anisotropy: 16,
    pixelRatioCap: 0,          // 0 = uncapped (native device pixel ratio / 4K)
    drawDistance: 6000,
    far: 12000,
    fogScale: 1.0,
  }),
});

/** Normalises any user-supplied string to a known preset name (defaults to 'high'). */
export function normalizeQuality(q) {
  const s = String(q || '').toLowerCase();
  return QUALITY_PRESETS[s] ? s : 'high';
}

export function getPreset(q) {
  return QUALITY_PRESETS[normalizeQuality(q)];
}

/** Fixed internal resolutions (width × height) for the non-native modes. */
export const RESOLUTION_PRESETS = Object.freeze({
  '4k': Object.freeze({ width: 3840, height: 2160 }),
  '1440p': Object.freeze({ width: 2560, height: 1440 }),
  '1080p': Object.freeze({ width: 1920, height: 1080 }),
});

export function normalizeResolution(mode) {
  const s = String(mode || 'native').toLowerCase();
  return RESOLUTION_PRESETS[s] ? s : 'native';
}
