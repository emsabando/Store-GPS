/**
 * Sinking timeline data + interpolation helpers (ARCHITECTURE.md §7).
 *
 * Keyframes: { minutesAfter, trimDeg, listDeg, sinkM, event?, breakX?, time? }
 *   minutesAfter  minutes since the strike (23:40 ship time, 14 April 1912)
 *   trimDeg       bow-down trim, positive degrees            → group.rotation.z = -trim
 *   listDeg       list, positive = to PORT (contract §1)      → group.rotation.x = -list
 *   sinkM         bodily sinkage of the amidships pivot, m    → group.position.y = -sinkM
 *
 * Interpolation is a monotone cubic Hermite spline (Fritsch–Carlson): C1-smooth, and it never
 * overshoots the keyframes, so a monotone table produces a monotone trim/sink curve.
 */

export const STRIKE_HHMM = '23:40';
export const STRIKE_MIN = 23 * 60 + 40;   // minutes since midnight

/** Built-in default (history-based) used when `spec.sinkingTimeline` is missing or too short. */
export const DEFAULT_TIMELINE = [
  { minutesAfter: 0,     trimDeg: 0,    listDeg: 0,    sinkM: 0,   event: 'strike' },
  { minutesAfter: 10,    trimDeg: 1,    listDeg: 0,    sinkM: 0 },
  { minutesAfter: 30,    trimDeg: 3,    listDeg: -1.5, sinkM: 0.2 },      // slight starboard list
  { minutesAfter: 60,    trimDeg: 5,    listDeg: 0,    sinkM: 0.5 },      // list to port begins
  { minutesAfter: 90,    trimDeg: 7,    listDeg: 2,    sinkM: 0.9 },
  { minutesAfter: 120,   trimDeg: 10,   listDeg: 5,    sinkM: 1.5 },
  { minutesAfter: 140,   trimDeg: 13,   listDeg: 7,    sinkM: 2.5 },
  { minutesAfter: 150,   trimDeg: 17,   listDeg: 9,    sinkM: 3.5, event: 'lightsDim' },
  { minutesAfter: 155,   trimDeg: 20,   listDeg: 10,   sinkM: 6,   event: 'bridgeUnder' },
  { minutesAfter: 157,   trimDeg: 22,   listDeg: 10,   sinkM: 8,   event: 'funnel1' },
  { minutesAfter: 157.5, trimDeg: 22.5, listDeg: 10,   sinkM: 9,   event: 'lightsOut' },
  { minutesAfter: 158,   trimDeg: 23,   listDeg: 10,   sinkM: 10,  event: 'breakup' },
  // After the break the two parts are driven by the BreakupRig; these keyframes only carry the
  // event markers and a fallback (whole-hull) motion when ship.split() is unavailable.
  { minutesAfter: 159,   trimDeg: 23,   listDeg: 10,   sinkM: 20,  event: 'sternSettles' },
  { minutesAfter: 160,   trimDeg: 23,   listDeg: 10,   sinkM: 60,  event: 'sternVertical' },
  { minutesAfter: 161,   trimDeg: 23,   listDeg: 10,   sinkM: 160, event: 'plunge' },
];

/** Default moments (minutes after the strike) of the one-shot events. */
export const DEFAULT_EVENTS = {
  strike: 0, panic: 40, lightsDim: 150, bridgeUnder: 155, funnel1: 157, lightsOut: 157.5, breakup: 158, plunge: 161, gone: 161,
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
export const easeInQuad = (t) => { t = clamp(t, 0, 1); return t * t; };
export const easeOutQuad = (t) => { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); };
export const easeInOut = (t) => smoothstep(0, 1, t);
export const DEG = Math.PI / 180;

/** 'HH:MM' → minutes after the 23:40 strike (times before 23:40 are taken as the next day). */
export function hhmmToMinutesAfter(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  let abs = Number(m[1]) * 60 + Number(m[2]);
  if (abs < STRIKE_MIN - 60) abs += 1440;     // 00:45 → 1485 → 65 min after
  return abs - STRIKE_MIN;
}

/** Monotone cubic Hermite interpolation (Fritsch–Carlson). xs must be strictly increasing. */
export class MonotoneCubic {
  constructor(xs, ys) {
    this.xs = xs.slice();
    this.ys = ys.slice();
    const n = xs.length;
    const d = new Array(Math.max(0, n - 1));
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]);
    const m = new Array(n).fill(0);
    if (n === 1) { this.m = m; return; }
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
    }
    this.m = m;
  }

  at(x) {
    const xs = this.xs, ys = this.ys, m = this.m, n = xs.length;
    if (n === 0) return 0;
    if (n === 1 || x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
    const h = xs[hi] - xs[lo];
    const t = (x - xs[lo]) / h;
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    return h00 * ys[lo] + h10 * h * m[lo] + h01 * ys[hi] + h11 * h * m[hi];
  }
}

/** Build a MonotoneCubic from [[x, y], ...] pairs. */
export const curve = (pairs) => new MonotoneCubic(pairs.map((p) => p[0]), pairs.map((p) => p[1]));

const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * Normalise `spec.sinkingTimeline` into sorted keyframes with numeric fields, or fall back to
 * DEFAULT_TIMELINE when it is missing, malformed or too short to describe the whole sinking.
 */
export function normalizeTimeline(raw) {
  const out = [];
  for (const k of Array.isArray(raw) ? raw : []) {
    if (!k || typeof k !== 'object') continue;
    let t = num(k.minutesAfter, null);
    if (t === null) t = hhmmToMinutesAfter(k.time);
    if (t === null) continue;
    out.push({
      minutesAfter: t,
      trimDeg: num(k.trimDeg, null),
      listDeg: num(k.listDeg, 0),
      sinkM: num(k.sinkM, null),
      event: typeof k.event === 'string' ? k.event : undefined,
      breakX: num(k.breakX, undefined),
      time: k.time,
    });
  }
  out.sort((a, b) => a.minutesAfter - b.minutesAfter);
  // de-duplicate identical times (keep the last)
  const dedup = [];
  for (const k of out) { if (dedup.length && dedup[dedup.length - 1].minutesAfter === k.minutesAfter) dedup.pop(); dedup.push(k); }
  const usable = dedup.filter((k) => k.trimDeg !== null);
  const span = usable.length ? usable[usable.length - 1].minutesAfter : 0;
  if (usable.length < 4 || span < 150) return { keys: DEFAULT_TIMELINE.map((k) => ({ ...k })), isDefault: true };
  // fill missing sinkM by interpolating neighbours (or 0)
  let last = 0;
  for (const k of usable) { if (k.sinkM === null) k.sinkM = last; else last = k.sinkM; }
  return { keys: usable, isDefault: false };
}

/** Event moments from a keyframe list, with defaults for anything not listed. */
export function eventTimes(keys) {
  const ev = { ...DEFAULT_EVENTS };
  for (const k of keys) if (k.event && typeof k.minutesAfter === 'number') ev[k.event] = k.minutesAfter;
  if (!keys.some((k) => k.event === 'lightsDim')) ev.lightsDim = Math.max(0, ev.lightsOut - 7.5);
  if (!keys.some((k) => k.event === 'gone')) ev.gone = ev.plunge;
  // keep a sane ordering whatever the data says
  ev.funnel1 = Math.min(ev.funnel1, ev.breakup);
  ev.lightsOut = Math.min(ev.lightsOut, ev.breakup);
  ev.plunge = Math.max(ev.plunge, ev.breakup + 1);
  ev.gone = Math.max(ev.gone, ev.plunge);
  return ev;
}

/** Sampler over keyframes: trim/list/sink at any minute, clamped at the ends. */
export class TimelineSampler {
  constructor(keys) {
    this.keys = keys;
    const xs = keys.map((k) => k.minutesAfter);
    this.trim = new MonotoneCubic(xs, keys.map((k) => k.trimDeg));
    this.list = new MonotoneCubic(xs, keys.map((k) => k.listDeg));
    this.sink = new MonotoneCubic(xs, keys.map((k) => k.sinkM));
    this.end = xs[xs.length - 1];
  }

  at(minutesAfter) {
    const t = Math.max(0, minutesAfter);
    return { trimDeg: this.trim.at(t), listDeg: this.list.at(t), sinkM: this.sink.at(t) };
  }
}
