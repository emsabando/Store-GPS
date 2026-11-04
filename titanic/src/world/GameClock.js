// STUB — replaced by the World engineer (ARCHITECTURE.md §6). Functional minimal clock.
import { bus } from '../core/Events.js';
const pad = (n) => String(n).padStart(2, '0');
export class GameClock {
  constructor() { this.date = '1912-04-10'; this.minutes = 12 * 60; this.speed = 1; this._lastEmitted = -1; this._target = null; }
  get hhmm() { const m = ((Math.floor(this.minutes) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
  get hours() { return (this.minutes / 60) % 24; }
  set(hhmm) { const [h, m] = hhmm.split(':').map(Number); this.minutes = h * 60 + (m || 0); this._target = null; }
  setDate(iso) { this.date = iso; }
  advanceTo(hhmm, seconds = 3) { const [h, m] = hhmm.split(':').map(Number); let target = h * 60 + (m || 0); if (target < this.minutes % 1440) target += 1440; const base = Math.floor(this.minutes / 1440) * 1440; this._target = { to: base + target, rate: (base + target - this.minutes) / Math.max(0.01, seconds) }; }
  update(dt) { if (this._target) { this.minutes += this._target.rate * dt; if (this.minutes >= this._target.to) { this.minutes = this._target.to; this._target = null; } } else this.minutes += (this.speed * dt) / 60; if (this.minutes >= 1440) { this.minutes -= 1440; const d = new Date(this.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); this.date = d.toISOString().slice(0, 10); } const whole = Math.floor(this.minutes); if (whole !== this._lastEmitted) { this._lastEmitted = whole; bus.emit('time:tick', { date: this.date, hhmm: this.hhmm, minutes: whole }); } }
}
