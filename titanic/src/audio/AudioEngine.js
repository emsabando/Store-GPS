/**
 * AudioEngine (ARCHITECTURE.md §7): everything is synthesised with the Web Audio API — no audio files.
 * Buses: master → limiter; music / sfx / ambience with a shared convolution reverb. Ambience: ocean (brown noise
 * through a swelling low-pass), wind (band-passed pink noise with gusts), engine thrum (reciprocating pulse at
 * 75 rpm, louder on the lower decks), crowd murmur. SFX are short synth patches. The band plays public-domain
 * melodies (the hymn tune "Bethany", a Strauss waltz theme) and original period-style pieces through a string-like
 * voice with a PannerNode at the band's world position.
 */
import { MELODIES, parseNote } from './Melodies.js';

const SFX_IDS = ['ui_click', 'ui_hover', 'ui_page', 'bell', 'horn', 'steps_wood', 'steps_steel', 'steps_carpet', 'door', 'gate', 'splash', 'creak', 'strike', 'rumble', 'explosion', 'glass', 'alarm'];

function noiseBuffer(ctx, seconds, kind = 'white', seed = 1) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = seed, b0 = 0, b1 = 0, b2 = 0, last = 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
  for (let i = 0; i < n; i++) {
    const w = rnd();
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return buf;
}

function impulse(ctx, seconds, decay = 3.0, seed = 7) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = rnd() * Math.pow(1 - i / n, decay); }
  return buf;
}

export class AudioEngine {
  constructor({ settings, bus } = {}) {
    this.settings = settings; this.bus = bus;
    this.ctx = null; this.ready = false;
    this.master = null; this.buses = {};
    this.ambience = null;
    this.band = {
      playing: null, loop: true, _nodes: null, _timer: 0, _nextTime: 0, _idx: 0, _gain: null, _panner: null,
      play: (id, { loop = true } = {}) => this._bandPlay(id, loop),
      stop: (fade = 1.5) => this._bandStop(fade),
      setPosition: (p) => { this.band._pos = [p.x, p.y, p.z]; this._bandPan(); },
      setListener: (camera) => { this._camera = camera; },
      _pos: [0, 0, 0],
    };
    this._camera = null;
    this._lastStep = 0;
    this._unsubs = [];
    this._pendingInit = null;
    if (typeof window !== 'undefined') {
      const kick = () => { this.init().catch(() => {}); };
      window.addEventListener('keydown', kick, { once: true });
      window.addEventListener('pointerdown', kick, { once: true });
    }
    if (bus) {
      this._unsubs.push(bus.on('audio:play', (p) => this.play(p && p.id ? p.id : p)));
      this._unsubs.push(bus.on('player:footstep', (p) => this.play(p && p.surface === 'carpet' ? 'steps_carpet' : p && p.surface === 'steel' ? 'steps_steel' : 'steps_wood')));
      this._unsubs.push(bus.on('sinking:event', (e) => { const map = { strike: 'strike', lightsOut: 'alarm', funnel1: 'explosion', breakup: 'explosion', plunge: 'rumble', floodDeck: 'creak' }; if (e && map[e.id]) this.play(map[e.id]); }));
      this._unsubs.push(bus.on('ui:newGame', () => this.init().catch(() => {})));
    }
  }

  attachCamera(camera) { this._camera = camera; }

  async init() {
    if (this.ready) return;
    if (this._pendingInit) return this._pendingInit;
    this._pendingInit = (async () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio unavailable');
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* needs a gesture; resumed later */ } }
      // master chain
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.25;
      this.master = ctx.createGain(); this.master.gain.value = this._vol('volumeMaster', 0.8);
      this.master.connect(limiter); limiter.connect(ctx.destination);
      for (const b of ['music', 'sfx', 'ambience']) { const g = ctx.createGain(); g.gain.value = this._vol(`volume${b[0].toUpperCase()}${b.slice(1)}`, 0.8); g.connect(this.master); this.buses[b] = g; }
      // reverbs
      this.reverb = ctx.createConvolver(); this.reverb.buffer = impulse(ctx, 2.5, 3.2); this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0.22; this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.master);
      this.roomReverb = ctx.createConvolver(); this.roomReverb.buffer = impulse(ctx, 1.2, 4.0, 11); this.roomGain = ctx.createGain(); this.roomGain.gain.value = 0.15; this.roomReverb.connect(this.roomGain); this.roomGain.connect(this.master);
      this._buildAmbience();
      this.settings?.onChange?.((k, v) => { if (k === 'volumeMaster') this.master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); if (k === 'volumeMusic') this.buses.music.gain.setTargetAtTime(v, ctx.currentTime, 0.05); if (k === 'volumeSfx') this.buses.sfx.gain.setTargetAtTime(v, ctx.currentTime, 0.05); if (k === 'volumeAmbience') this.buses.ambience.gain.setTargetAtTime(v, ctx.currentTime, 0.05); });
      this.ready = true;
    })();
    return this._pendingInit;
  }

  _vol(key, def) { const v = this.settings?.get?.(key); return typeof v === 'number' ? v : def; }

  // ------------------------------------------------------------------ ambience
  _buildAmbience() {
    const ctx = this.ctx;
    const A = { nodes: [] };
    const mk = (kind, seconds, seed) => { const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, seconds, kind, seed); src.loop = true; src.start(); return src; };
    // ocean: brown noise → low-pass with slow swell LFO
    A.ocean = mk('brown', 6, 3); A.oceanLP = ctx.createBiquadFilter(); A.oceanLP.type = 'lowpass'; A.oceanLP.frequency.value = 420; A.oceanLP.Q.value = 0.6;
    A.oceanGain = ctx.createGain(); A.oceanGain.gain.value = 0.0; A.ocean.connect(A.oceanLP); A.oceanLP.connect(A.oceanGain); A.oceanGain.connect(this.buses.ambience);
    A.swell = ctx.createOscillator(); A.swell.frequency.value = 0.08; A.swellGain = ctx.createGain(); A.swellGain.gain.value = 160; A.swell.connect(A.swellGain); A.swellGain.connect(A.oceanLP.frequency); A.swell.start();
    // wind: pink noise band-pass with gusts
    A.wind = mk('pink', 5, 5); A.windBP = ctx.createBiquadFilter(); A.windBP.type = 'bandpass'; A.windBP.frequency.value = 700; A.windBP.Q.value = 0.7;
    A.windGain = ctx.createGain(); A.windGain.gain.value = 0.0; A.wind.connect(A.windBP); A.windBP.connect(A.windGain); A.windGain.connect(this.buses.ambience);
    A.gust = ctx.createOscillator(); A.gust.type = 'sine'; A.gust.frequency.value = 0.13; A.gustGain = ctx.createGain(); A.gustGain.gain.value = 0.0; A.gust.connect(A.gustGain); A.gustGain.connect(A.windGain.gain); A.gust.start();
    // engine: low sine + sub + reciprocating pulse (75 rpm → 1.25 Hz, each beat two cylinders)
    A.engine = ctx.createOscillator(); A.engine.type = 'sine'; A.engine.frequency.value = 24; A.engineGain = ctx.createGain(); A.engineGain.gain.value = 0.0;
    A.sub = ctx.createOscillator(); A.sub.type = 'triangle'; A.sub.frequency.value = 48; A.subGain = ctx.createGain(); A.subGain.gain.value = 0.3; A.sub.connect(A.subGain); A.subGain.connect(A.engineGain);
    A.pulse = ctx.createOscillator(); A.pulse.type = 'square'; A.pulse.frequency.value = 2.5; A.pulseGain = ctx.createGain(); A.pulseGain.gain.value = 0.25; A.pulseShape = ctx.createGain(); A.pulse.connect(A.pulseShape.gain); A.pulseShape.gain.value = 0.75;
    A.engine.connect(A.pulseShape); A.pulseShape.connect(A.engineGain); A.engineGain.connect(this.buses.ambience);
    A.engineLP = ctx.createBiquadFilter(); A.engineLP.type = 'lowpass'; A.engineLP.frequency.value = 140;
    A.engineGain.disconnect(); A.engineGain.connect(A.engineLP); A.engineLP.connect(this.buses.ambience);
    A.engine.start(); A.sub.start(); A.pulse.start();
    // crowd murmur: band-passed noise with slow amplitude flutter
    A.crowd = mk('pink', 4, 9); A.crowdBP = ctx.createBiquadFilter(); A.crowdBP.type = 'bandpass'; A.crowdBP.frequency.value = 350; A.crowdBP.Q.value = 1.4;
    A.crowdGain = ctx.createGain(); A.crowdGain.gain.value = 0.0; A.crowd.connect(A.crowdBP); A.crowdBP.connect(A.crowdGain); A.crowdGain.connect(this.roomReverb); A.crowdGain.connect(this.buses.ambience);
    A.flutter = ctx.createOscillator(); A.flutter.frequency.value = 0.9; A.flutterGain = ctx.createGain(); A.flutterGain.gain.value = 0.0; A.flutter.connect(A.flutterGain); A.flutterGain.connect(A.crowdGain.gain); A.flutter.start();
    // interior filter for the exterior ambience
    A.interiorLP = ctx.createBiquadFilter(); A.interiorLP.type = 'lowpass'; A.interiorLP.frequency.value = 20000;
    this.ambience = A;
  }

  setAmbience({ wind, ocean, engine, crowd } = {}) {
    const A = this.ambience; if (!A) return;
    const t = this.ctx.currentTime;
    if (ocean !== undefined) A.oceanGain.gain.setTargetAtTime(0.35 * ocean, t, 0.8);
    if (wind !== undefined) { A.windGain.gain.setTargetAtTime(0.12 * wind, t, 0.8); A.gustGain.gain.setTargetAtTime(0.06 * wind, t, 0.8); }
    if (engine !== undefined) A.engineGain.gain.setTargetAtTime(0.5 * engine, t, 0.8);
    if (crowd !== undefined) { A.crowdGain.gain.setTargetAtTime(0.1 * crowd, t, 0.8); A.flutterGain.gain.setTargetAtTime(0.04 * crowd, t, 0.8); }
  }

  /** Per-frame: ambience by context; music scheduler; listener pose. */
  update(dt, { inside = false, deck = 'boat', wind = 0.3, speed = 0, sinking = false, mode = 'playing' } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') return;
    const low = ['F', 'G', 'orlop', 'tankTop'].includes(deck);
    const mid = ['D', 'E'].includes(deck);
    const engine = sinking ? 0.25 : low ? 1.0 : mid ? 0.45 : inside ? 0.18 : 0.08;
    const ocean = inside ? 0.25 : 1.0;
    const windAmt = (inside ? 0.15 : 1.0) * (0.3 + wind);
    const crowd = inside && !low ? 0.6 : 0.1;
    this.setAmbience({ ocean: mode === 'menu' ? 0.6 : ocean, wind: windAmt, engine, crowd });
    const A = this.ambience;
    const target = inside ? 900 : 20000;
    if (Math.abs(A.oceanLP.frequency.value - (inside ? 300 : 420)) > 5) A.oceanLP.frequency.setTargetAtTime(inside ? 300 : 420, ctx.currentTime, 0.5);
    A.windBP.frequency.setTargetAtTime(inside ? 400 : 700, ctx.currentTime, 0.5);
    if (sinking) { A.engine.frequency.setTargetAtTime(19, ctx.currentTime, 2); A.engineLP.frequency.setTargetAtTime(90, ctx.currentTime, 2); }
    this._bandTick();
    if (this._camera && ctx.listener) {
      const L = ctx.listener;
      const c = this._camera;
      c.updateMatrixWorld?.();
      const p = c.position;
      const e = c.matrixWorld.elements;
      const fwd = [-e[8], -e[9], -e[10]], up = [e[4], e[5], e[6]];
      if (L.positionX) { L.positionX.setTargetAtTime(p.x, ctx.currentTime, 0.02); L.positionY.setTargetAtTime(p.y, ctx.currentTime, 0.02); L.positionZ.setTargetAtTime(p.z, ctx.currentTime, 0.02); L.forwardX.setTargetAtTime(fwd[0], ctx.currentTime, 0.02); L.forwardY.setTargetAtTime(fwd[1], ctx.currentTime, 0.02); L.forwardZ.setTargetAtTime(fwd[2], ctx.currentTime, 0.02); L.upX.setTargetAtTime(up[0], ctx.currentTime, 0.02); L.upY.setTargetAtTime(up[1], ctx.currentTime, 0.02); L.upZ.setTargetAtTime(up[2], ctx.currentTime, 0.02); }
      else { L.setPosition(p.x, p.y, p.z); L.setOrientation(fwd[0], fwd[1], fwd[2], up[0], up[1], up[2]); }
    } else if (window.__game?.engine?.camera) this._camera = window.__game.engine.camera;
  }

  // ------------------------------------------------------------------ SFX
  play(id, { gain = 1, when = 0 } = {}) {
    if (!this.ready || !SFX_IDS.includes(id)) return;
    const ctx = this.ctx; const t = ctx.currentTime + when;
    const out = ctx.createGain(); out.gain.value = gain; out.connect(this.buses.sfx);
    const env = (node, a, d, s, r, peak = 1, hold = 0) => { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.linearRampToValueAtTime(peak * s, t + a + d); node.gain.setValueAtTime(peak * s, t + a + d + hold); node.gain.linearRampToValueAtTime(0, t + a + d + hold + r); };
    const noise = (kind, seconds, filterType, freq, q, a, d, s, r, peak = 0.5, hold = 0) => {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, seconds, kind, (Date.now() % 1000) + 1);
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); env(g, a, d, s, r, peak, hold); src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + a + d + hold + r + 0.05); return { src, f, g };
    };
    const tone = (type, freq, a, d, s, r, peak = 0.3, hold = 0, detune = 0) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
      const g = ctx.createGain(); env(g, a, d, s, r, peak, hold); o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + hold + r + 0.05); return o;
    };
    switch (id) {
      case 'ui_click': tone('square', 1800, 0.002, 0.04, 0, 0.03, 0.12); noise('white', 0.1, 'highpass', 3000, 1, 0.001, 0.03, 0, 0.02, 0.15); break;
      case 'ui_hover': tone('sine', 2400, 0.003, 0.05, 0, 0.04, 0.06); break;
      case 'ui_page': noise('pink', 0.4, 'bandpass', 2500, 0.8, 0.02, 0.18, 0.2, 0.15, 0.35); break;
      case 'bell': for (const [f, p] of [[880, 0.5], [1760 * 1.01, 0.25], [2640, 0.12], [587, 0.2]]) tone('sine', f, 0.002, 1.2, 0.2, 1.8, p); noise('white', 0.2, 'highpass', 4000, 1, 0.001, 0.05, 0, 0.05, 0.3); out.connect(this.reverb); break;
      case 'horn': { // triple-chime steam whistle: three tones, breathy
        for (const [f, p] of [[110, 0.5], [146.8, 0.45], [220 * 1.5, 0.3], [110 * 2.01, 0.2]]) tone('sawtooth', f, 0.35, 0.3, 0.9, 1.2, p, 2.2, 6);
        const n = noise('pink', 4, 'bandpass', 500, 0.5, 0.3, 0.3, 0.6, 1.2, 0.3, 2.2); n.f.frequency.setValueAtTime(400, t); n.f.frequency.linearRampToValueAtTime(700, t + 1);
        out.connect(this.reverb); break; }
      case 'steps_wood': noise('brown', 0.15, 'lowpass', 500, 1, 0.002, 0.07, 0, 0.05, 0.9); tone('sine', 140, 0.002, 0.06, 0, 0.04, 0.35); break;
      case 'steps_steel': noise('white', 0.15, 'bandpass', 1800, 2, 0.002, 0.08, 0, 0.12, 0.5); tone('triangle', 420, 0.001, 0.1, 0, 0.15, 0.2); break;
      case 'steps_carpet': noise('brown', 0.15, 'lowpass', 300, 1, 0.003, 0.06, 0, 0.05, 0.6); break;
      case 'door': tone('square', 900, 0.001, 0.03, 0, 0.03, 0.15); noise('brown', 0.3, 'lowpass', 400, 1, 0.01, 0.12, 0, 0.1, 0.9, 0); out.connect(this.roomReverb); break;
      case 'gate': noise('white', 0.4, 'bandpass', 2200, 4, 0.001, 0.1, 0.2, 0.35, 0.5); tone('sine', 310, 0.001, 0.3, 0, 0.4, 0.3); out.connect(this.roomReverb); break;
      case 'splash': noise('white', 0.8, 'lowpass', 1200, 0.7, 0.01, 0.25, 0.3, 0.5, 0.7); break;
      case 'creak': { const o = tone('sawtooth', 70, 0.2, 0.8, 0.4, 0.8, 0.12); o.frequency.linearRampToValueAtTime(52, t + 1.8); out.connect(this.reverb); break; }
      case 'strike': { noise('brown', 8, 'lowpass', 120, 1, 0.3, 2, 0.6, 5, 1.0, 1); const n = noise('white', 8, 'bandpass', 900, 3, 0.1, 1.5, 0.5, 5, 0.35, 1.5); n.f.frequency.linearRampToValueAtTime(400, t + 7); tone('sine', 32, 0.3, 3, 0.4, 4, 0.6, 1); out.connect(this.reverb); break; }
      case 'rumble': noise('brown', 6, 'lowpass', 90, 1, 0.5, 2, 0.5, 3, 0.9); tone('sine', 28, 0.5, 2, 0.5, 3, 0.4); break;
      case 'explosion': noise('white', 3, 'lowpass', 500, 0.7, 0.005, 0.5, 0.2, 2.0, 1.0); tone('sine', 45, 0.005, 0.6, 0.1, 1.5, 0.8); out.connect(this.reverb); break;
      case 'glass': noise('white', 0.6, 'highpass', 3500, 1, 0.001, 0.15, 0.2, 0.4, 0.4); tone('sine', 3200, 0.001, 0.2, 0, 0.3, 0.1); break;
      case 'alarm': { const n = noise('white', 5, 'bandpass', 1500, 1.2, 0.3, 1, 0.8, 2, 0.4, 1.5); n.f.frequency.linearRampToValueAtTime(2500, t + 4); out.connect(this.reverb); break; }
      default: break;
    }
  }

  // ------------------------------------------------------------------ band
  _bandNodes() {
    if (this.band._nodes) return this.band._nodes;
    const ctx = this.ctx;
    const gain = ctx.createGain(); gain.gain.value = 0.0;
    const panner = ctx.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 8; panner.maxDistance = 120; panner.rolloffFactor = 1.0;
    gain.connect(panner); panner.connect(this.buses.music); gain.connect(this.reverb);
    this.band._nodes = { gain, panner }; this.band._gain = gain; this.band._panner = panner;
    this._bandPan();
    return this.band._nodes;
  }
  _bandPan() {
    const p = this.band._panner; if (!p) return;
    const [x, y, z] = this.band._pos; const t = this.ctx.currentTime;
    if (p.positionX) { p.positionX.setTargetAtTime(x, t, 0.05); p.positionY.setTargetAtTime(y, t, 0.05); p.positionZ.setTargetAtTime(z, t, 0.05); } else p.setPosition(x, y, z);
  }
  _bandPlay(id, loop = true) {
    if (!this.ready) { this.init().then(() => this._bandPlay(id, loop)).catch(() => {}); return; }
    const piece = MELODIES[id]; if (!piece) { console.warn('[audio] unknown piece', id); return; }
    const { gain } = this._bandNodes();
    this.band.playing = id; this.band.loop = loop; this.band._idx = 0; this.band._nextTime = this.ctx.currentTime + 0.1;
    gain.gain.cancelScheduledValues(this.ctx.currentTime); gain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.4);
  }
  _bandStop(fade = 1.5) {
    if (!this.band._gain) return;
    this.band._gain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    this.band.playing = null;
  }
  _bandTick() {
    const b = this.band; if (!b.playing) return;
    const piece = MELODIES[b.playing]; const ctx = this.ctx;
    const beat = 60 / piece.tempo;
    while (b._nextTime < ctx.currentTime + 0.35) {
      const ev = piece.notes[b._idx];
      if (!ev) { if (b.loop) { b._idx = 0; b._nextTime += beat; continue; } b.playing = null; return; }
      const dur = ev.d * beat;
      if (ev.n && ev.n !== 'r') this._voice(parseNote(ev.n), b._nextTime, dur * 0.95, piece.voice || 'strings', 0.5 * (ev.v || 1));
      if (ev.c) for (const cn of ev.c) this._voice(parseNote(cn), b._nextTime, dur * 0.9, 'accomp', 0.2);
      b._nextTime += dur; b._idx++;
    }
  }
  _voice(freq, t, dur, kind, vel) {
    const ctx = this.ctx; const dest = this._bandNodes().gain;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    if (kind === 'strings') {
      g.gain.linearRampToValueAtTime(vel, t + Math.min(0.12, dur * 0.4)); g.gain.setValueAtTime(vel, t + dur - 0.08); g.gain.linearRampToValueAtTime(0, t + dur + 0.1);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800 + freq; lp.Q.value = 0.5; lp.connect(g);
      for (const det of [-6, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det; const vib = ctx.createOscillator(); vib.frequency.value = 5.5; const vg = ctx.createGain(); vg.gain.value = 3.5; vib.connect(vg); vg.connect(o.detune); vib.start(t); vib.stop(t + dur + 0.2); o.connect(lp); o.start(t); o.stop(t + dur + 0.2); }
    } else if (kind === 'piano') {
      g.gain.linearRampToValueAtTime(vel, t + 0.005); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.25), t + Math.min(dur, 0.6)); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2; const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g); o.connect(g); o.start(t); o.stop(t + dur + 0.1); o2.start(t); o2.stop(t + dur + 0.1);
    } else { // accomp: soft triangle chords
      g.gain.linearRampToValueAtTime(vel, t + 0.03); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.3), t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; o.connect(g); o.start(t); o.stop(t + dur + 0.1);
    }
    g.connect(dest);
  }

  dispose() { for (const u of this._unsubs) u(); try { this.ctx?.close(); } catch { /* ignore */ } }
}
