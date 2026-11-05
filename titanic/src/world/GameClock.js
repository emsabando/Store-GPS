/**
 * GameClock — the ship's clock (ARCHITECTURE §6).
 *
 *   clock.date        ISO date 'YYYY-MM-DD' (rolls over at midnight)
 *   clock.minutes     fractional minutes since midnight (0 ≤ minutes < 1440)
 *   clock.speed       game-minutes per real second (1/60 = real time, the default;
 *                     60 = one game hour per real minute). 0 freezes the clock.
 *   clock.set('HH:MM')            jump (emits one tick)
 *   clock.setDate('1912-04-14')
 *   clock.advanceTo('HH:MM', seconds)  smooth accelerated advance; a target earlier than
 *                     "now" means the same time *tomorrow* (date rolls over on the way)
 *   clock.update(dt)
 *   clock.hhmm, clock.hours, clock.totalMinutes, clock.isAdvancing, clock.cancelAdvance()
 *
 * Emits `time:tick { date, hhmm, minutes }` on every whole game minute crossed (one event per
 * minute, in order, so `{ type:'time', at }` story triggers never miss a minute), and once
 * immediately after `set()` / `setDate()`.
 */
import { bus } from '../core/Events.js';

const pad = (n) => String(n).padStart(2, '0');
const DAY = 1440;
const MAX_TICKS_PER_FRAME = 720;

export const REAL_TIME_SPEED = 1 / 60;

export function parseHHMM(hhmm) {
  if (typeof hhmm === 'number') return hhmm;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(hhmm).trim());
  if (!m) throw new Error(`GameClock: bad time "${hhmm}" (expected HH:MM)`);
  return (Number(m[1]) % 24) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export class GameClock {
  constructor({ date = '1912-04-10', time = '12:00', speed = REAL_TIME_SPEED } = {}) {
    this.date = date;
    this.minutes = parseHHMM(time);
    this.speed = speed;
    this.paused = false;
    this._epoch = '1912-04-10';
    this._target = null;        // { remaining (minutes), seconds }
    this._lastEmitted = Math.floor(this.minutes);
    this._listeners = new Set();
  }

  get hhmm() {
    const m = ((Math.floor(this.minutes) % DAY) + DAY) % DAY;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  /** Fractional hours since midnight. */
  get hours() { return (this.minutes / 60) % 24; }

  /** Whole days since 10 April 1912 (negative before). */
  get dayIndex() {
    return Math.round((Date.parse(`${this.date}T00:00:00Z`) - Date.parse(`${this._epoch}T00:00:00Z`)) / 86400000);
  }

  /** Continuous minutes since 10 April 1912 00:00 — handy for anything that must not jump at midnight. */
  get totalMinutes() { return this.dayIndex * DAY + this.minutes; }

  get isAdvancing() { return this._target !== null; }

  /** Seconds since midnight (fractional). */
  get seconds() { return this.minutes * 60; }

  set(hhmm) {
    this.minutes = ((parseHHMM(hhmm) % DAY) + DAY) % DAY;
    this._target = null;
    this._lastEmitted = Math.floor(this.minutes);
    this._emit();
  }

  setDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) throw new Error(`GameClock: bad date "${iso}"`);
    this.date = iso;
    this._emit();
  }

  /** Jump to a full timestamp: ('1912-04-14', '23:40'). */
  setDateTime(iso, hhmm) { this.date = iso; this.set(hhmm); }

  /**
   * Advance smoothly to `hhmm` over `seconds` real seconds (ease-in-out). A target at or before
   * the current time means that time on the following day.
   */
  advanceTo(hhmm, seconds = 3) {
    const target = ((parseHHMM(hhmm) % DAY) + DAY) % DAY;
    let delta = target - this.minutes;
    if (delta <= 1e-6) delta += DAY;
    if (!(seconds > 0)) {
      this._step(delta);
      this._target = null;
      return;
    }
    this._target = { total: delta, remaining: delta, duration: seconds, elapsed: 0 };
  }

  cancelAdvance() { this._target = null; }

  update(dt) {
    if (!(dt > 0) || this.paused) return;
    if (this._target) {
      const t = this._target;
      const before = this._ease(t.elapsed / t.duration);
      t.elapsed = Math.min(t.duration, t.elapsed + dt);
      const after = this._ease(t.elapsed / t.duration);
      const step = (after - before) * t.total;
      t.remaining -= step;
      this._step(step);
      if (t.elapsed >= t.duration) {
        if (t.remaining > 1e-6) this._step(t.remaining);
        this._target = null;
      }
      return;
    }
    if (this.speed > 0) this._step(this.speed * dt);
  }

  toJSON() { return { date: this.date, minutes: this.minutes, speed: this.speed }; }
  fromJSON(j) { if (!j) return; if (j.date) this.date = j.date; if (Number.isFinite(j.minutes)) this.minutes = j.minutes; if (Number.isFinite(j.speed)) this.speed = j.speed; this._lastEmitted = Math.floor(this.minutes); this._target = null; this._emit(); }

  _ease(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }

  _step(deltaMinutes) {
    this.minutes += deltaMinutes;
    while (this.minutes >= DAY) { this.minutes -= DAY; this.date = addDays(this.date, 1); this._lastEmitted -= DAY; }
    while (this.minutes < 0) { this.minutes += DAY; this.date = addDays(this.date, -1); this._lastEmitted += DAY; }
    const whole = Math.floor(this.minutes);
    if (whole === this._lastEmitted) return;
    const crossed = whole - this._lastEmitted;
    if (crossed > 0 && crossed <= MAX_TICKS_PER_FRAME) {
      for (let m = this._lastEmitted + 1; m <= whole; m++) {
        const mm = ((m % DAY) + DAY) % DAY;
        // Minutes that belong to the previous date (m < 0 after a rollover) are reported with today's date;
        // the rollover is at most one frame old so nothing observable depends on it.
        bus.emit('time:tick', { date: this.date, hhmm: `${pad(Math.floor(mm / 60))}:${pad(mm % 60)}`, minutes: mm });
      }
      this._lastEmitted = whole;
    } else {
      this._lastEmitted = whole;
      this._emit();
    }
  }

  _emit() {
    bus.emit('time:tick', { date: this.date, hhmm: this.hhmm, minutes: Math.floor(this.minutes) });
  }
}
