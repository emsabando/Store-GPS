/**
 * Shared helpers for the story systems (QuestManager / DialogueRunner).
 * Pure functions only — no three.js, no DOM — so they run in Node unit tests.
 */

/** 'HH:MM' → minutes since midnight (NaN-safe: returns null for garbage). */
export function hhmmToMinutes(hhmm) {
  if (typeof hhmm === 'number' && Number.isFinite(hhmm)) return hhmm;
  if (typeof hhmm !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

/** minutes since midnight → 'HH:MM'. */
export function minutesToHHMM(minutes) {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** ISO date 'YYYY-MM-DD' → whole days since the epoch (null when unparsable). */
export function dayIndex(iso) {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
}

/** Absolute game minutes (date-aware) for a clock-like { date, minutes }. */
export function absMinutes(date, minutes) {
  const d = dayIndex(date);
  const m = Number.isFinite(minutes) ? minutes : 0;
  return (d === null ? 0 : d * 1440) + m;
}

/** Read the clock's minutes robustly (prefers .minutes, falls back to parsing .hhmm). */
export function clockMinutes(clock) {
  if (!clock) return 0;
  if (Number.isFinite(clock.minutes)) return clock.minutes;
  const m = hhmmToMinutes(clock.hhmm);
  return m === null ? 0 : m;
}

/** Absolute minutes of the current clock state. */
export function clockAbs(clock) {
  return absMinutes(clock && clock.date, clockMinutes(clock));
}

/** Horizontal (xz) distance between two points. */
export function horizontalDistance(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Whether a ship-local point `p` (the player's eye point, ~1.65 m above the feet) is
 * "at" a ship-local target `t` within `radius` horizontally and on the same deck.
 * The vertical window is asymmetric so a player on the deck directly below or above
 * (≈ ±2.7 m) does not match, while the eye point of a player standing at the target does.
 */
export function withinLocation(p, t, radius = 3, below = 0.9, above = 2.6) {
  if (!p || !t) return false;
  if (horizontalDistance(p, t) > radius) return false;
  const dy = (p.y || 0) - (t.y || 0);
  return dy >= -below && dy <= above;
}

/** Clamp helper. */
export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Replace {player}, {npc} and {flag:x?yes:no} style placeholders in dialogue text. */
export function resolvePlaceholders(text, vars = {}) {
  if (typeof text !== 'string') return '';
  return text.replace(/\{(\w+)\}/g, (whole, key) => (vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : whole));
}

/** Look up a location by id in the data map first, then in the ship's merged map. */
export function findLocation(locations, ship, id) {
  if (!id) return null;
  if (locations && locations[id]) return { id, ...locations[id] };
  if (ship && ship.locations && typeof ship.locations.get === 'function') {
    const l = ship.locations.get(id);
    if (l) return { id, ...l };
  }
  return null;
}

/** Deep-ish clone for save payloads (plain JSON data only). */
export function jsonClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}
