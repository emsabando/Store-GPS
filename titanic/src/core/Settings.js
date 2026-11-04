/**
 * Persisted user settings (localStorage) — ARCHITECTURE.md §3.
 */
const STORAGE_KEY = 'titanic.settings.v1';

export const DEFAULT_SETTINGS = {
  quality: 'high',          // 'low' | 'medium' | 'high' | 'ultra'
  resolution: 'native',     // 'native' | '4k' | '1440p' | '1080p'
  renderScale: 1.0,         // 0.5 – 2.0 (applies to 'native')
  fov: 75,
  sensitivity: 1.0,
  invertY: false,
  volumeMaster: 0.8,
  volumeMusic: 0.7,
  volumeSfx: 0.9,
  volumeAmbience: 0.8,
  subtitles: true,
  reduceMotion: false,
  colourBlind: 'none',
  uiScale: 1.0,
  viewMode: 'first',
  showFps: false,
};

class Settings {
  constructor() {
    this._data = { ...DEFAULT_SETTINGS };
    this._listeners = new Set();
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in parsed) this._data[k] = parsed[k];
      }
    } catch { /* private mode / blocked storage: run with defaults */ }
  }

  get(key) { return this._data[key]; }

  set(key, value) {
    if (!(key in DEFAULT_SETTINGS)) { console.warn(`[settings] unknown key ${key}`); return; }
    if (this._data[key] === value) return;
    this._data[key] = value;
    this._persist();
    for (const fn of [...this._listeners]) {
      try { fn(key, value, this._data); } catch (err) { console.error('[settings] listener threw', err); }
    }
  }

  reset() {
    for (const k of Object.keys(DEFAULT_SETTINGS)) this.set(k, DEFAULT_SETTINGS[k]);
  }

  all() { return { ...this._data }; }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  _persist() {
    try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this._data)); } catch { /* ignore */ }
  }
}

export const settings = new Settings();
