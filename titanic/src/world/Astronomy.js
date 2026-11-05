/**
 * Astronomy — low-precision (≈ 0.1°) solar/lunar positions and sidereal time for the
 * ship's position in the North Atlantic, April 1912. Used by Sky.js and World.js.
 *
 * Conventions
 *  - The GameClock is treated as the ship's *local mean time* (LMT) for longitude SHIP_LON.
 *  - Angles returned in radians. `azimuth` is measured clockwise from true north.
 *  - World frame (ARCHITECTURE §1): +x = bow = roughly WEST (Titanic steamed ~266° true),
 *    +z = starboard = NORTH, +y up. `horizontalToWorld` maps (east, north, up) to that frame.
 */
import * as THREE from 'three';

export const SHIP_LAT = 41.73;     // degrees north (41°44'N — the wreck position)
export const SHIP_LON = -49.95;    // degrees east (49°57'W)
export const SOLAR_G = 9.81;

const DEG = Math.PI / 180;
const J2000 = 2451545.0;

/** Julian Day (UT) for an ISO date + hours in UT. */
export function julianDay(isoDate, hoursUT = 0) {
  const [y, m, d] = isoDate.split('-').map(Number);
  // Meeus' algorithm (Gregorian calendar)
  let Y = y, M = m;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5 + hoursUT / 24;
}

/** Local mean time (hours) at longitude `lon` → UT hours (may exceed 24; julianDay handles it). */
export function lmtToUT(hoursLMT, lon = SHIP_LON) {
  return hoursLMT - lon / 15;
}

const norm360 = (x) => ((x % 360) + 360) % 360;

/** Greenwich mean sidereal time in hours for a UT Julian day. */
export function gmstHours(jd) {
  const n = jd - J2000;
  return ((18.697374558 + 24.06570982441908 * n) % 24 + 24) % 24;
}

/** Local sidereal time (radians) at the ship. */
export function localSiderealTime(isoDate, minutesLMT, lon = SHIP_LON) {
  const jd = julianDay(isoDate, lmtToUT(minutesLMT / 60, lon));
  const lst = (gmstHours(jd) + lon / 15 + 24) % 24;
  return lst * 15 * DEG;
}

/** Equatorial (RA, Dec) + local sidereal time → horizontal { elevation, azimuth } for latitude φ. */
export function equatorialToHorizontal(ra, dec, lst, latDeg = SHIP_LAT) {
  const phi = latDeg * DEG;
  const H = lst - ra;
  const sinEl = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const up = sinEl;
  const north = Math.cos(phi) * Math.sin(dec) - Math.sin(phi) * Math.cos(dec) * Math.cos(H);
  const east = -Math.cos(dec) * Math.sin(H);
  return { elevation: Math.asin(THREE.MathUtils.clamp(up, -1, 1)), azimuth: Math.atan2(east, north), east, north, up };
}

/** (east, north, up) unit components → world-frame direction (+x west, +z north, +y up). */
export function horizontalToWorld(east, north, up, target = new THREE.Vector3()) {
  return target.set(-east, up, north);
}

/** Direction from elevation/azimuth to the world frame. */
export function elAzToWorld(elevation, azimuth, target = new THREE.Vector3()) {
  const c = Math.cos(elevation);
  return horizontalToWorld(Math.sin(azimuth) * c, Math.cos(azimuth) * c, Math.sin(elevation), target);
}

/**
 * Solar position for the clock's local mean time.
 * @returns {{ elevation:number, azimuth:number, dir:THREE.Vector3, ra:number, dec:number, lst:number, jd:number }}
 */
export function sunPosition(isoDate, minutesLMT, latDeg = SHIP_LAT, lon = SHIP_LON, target = new THREE.Vector3()) {
  const jd = julianDay(isoDate, lmtToUT(minutesLMT / 60, lon));
  const n = jd - J2000;
  const L = norm360(280.460 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const lst = ((gmstHours(jd) + lon / 15 + 24) % 24) * 15 * DEG;
  const h = equatorialToHorizontal(ra, dec, lst, latDeg);
  horizontalToWorld(h.east, h.north, h.up, target);
  // Atmospheric refraction lifts the sun ≈ 0.57° at the horizon (Bennett), cosmetic only.
  const elDeg = h.elevation / DEG;
  const refr = elDeg > -1 ? (1.02 / Math.tan((elDeg + 10.3 / (elDeg + 5.11)) * DEG)) / 60 * DEG : 0;
  return { elevation: h.elevation + refr, azimuth: (h.azimuth + 2 * Math.PI) % (2 * Math.PI), dir: target, ra, dec, lst, jd, eclipticLongitude: lambda };
}

/**
 * Lunar position (Astronomical Almanac low-precision series, ≈ 0.3°) and phase.
 * @returns {{ elevation, azimuth, dir, illuminated (0..1), phaseAngle (rad, 0 = new), waxing:boolean }}
 */
export function moonPosition(isoDate, minutesLMT, latDeg = SHIP_LAT, lon = SHIP_LON, target = new THREE.Vector3()) {
  const jd = julianDay(isoDate, lmtToUT(minutesLMT / 60, lon));
  const T = (jd - J2000) / 36525;
  const s = (deg) => Math.sin(deg * DEG);
  const lambda = norm360(218.32 + 481267.881 * T
    + 6.29 * s(135.0 + 477198.87 * T) - 1.27 * s(259.3 - 413335.36 * T) + 0.66 * s(235.7 + 890534.22 * T)
    + 0.21 * s(269.9 + 954397.74 * T) - 0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.5 + 966404.03 * T)) * DEG;
  const beta = (5.13 * s(93.3 + 483202.02 * T) + 0.28 * s(228.2 + 960400.89 * T) - 0.28 * s(318.3 + 6003.15 * T) - 0.17 * s(217.6 - 407332.21 * T)) * DEG;
  const eps = (23.439 - 0.0000004 * (jd - J2000)) * DEG;
  const x = Math.cos(beta) * Math.cos(lambda);
  const y = Math.cos(eps) * Math.cos(beta) * Math.sin(lambda) - Math.sin(eps) * Math.sin(beta);
  const z = Math.sin(eps) * Math.cos(beta) * Math.sin(lambda) + Math.cos(eps) * Math.sin(beta);
  const ra = Math.atan2(y, x);
  const dec = Math.asin(z);
  const lst = ((gmstHours(jd) + lon / 15 + 24) % 24) * 15 * DEG;
  const h = equatorialToHorizontal(ra, dec, lst, latDeg);
  horizontalToWorld(h.east, h.north, h.up, target);
  // Phase: elongation from the sun's ecliptic longitude.
  const sun = sunPosition(isoDate, minutesLMT, latDeg, lon);
  let elong = lambda - sun.eclipticLongitude;
  elong = ((elong % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const illuminated = (1 - Math.cos(elong)) / 2;
  return { elevation: h.elevation, azimuth: (h.azimuth + 2 * Math.PI) % (2 * Math.PI), dir: target, illuminated, phaseAngle: elong, waxing: elong < Math.PI, ra, dec };
}

/**
 * Convert galactic (l, b) to equatorial (ra, dec), radians. Used to lay out the Milky Way.
 */
const _gal = (() => {
  const toVec = (raDeg, decDeg) => new THREE.Vector3(Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG), Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG), Math.sin(decDeg * DEG));
  const zG = toVec(192.859, 27.128);   // north galactic pole (J2000)
  const xG = toVec(266.405, -28.936);  // galactic centre
  const yG = new THREE.Vector3().crossVectors(zG, xG).normalize();
  xG.crossVectors(yG, zG).normalize();
  return { xG, yG, zG };
})();
export function galacticToEquatorial(l, b) {
  const cb = Math.cos(b);
  const v = new THREE.Vector3()
    .addScaledVector(_gal.xG, cb * Math.cos(l))
    .addScaledVector(_gal.yG, cb * Math.sin(l))
    .addScaledVector(_gal.zG, Math.sin(b));
  return { ra: Math.atan2(v.y, v.x), dec: Math.asin(THREE.MathUtils.clamp(v.z, -1, 1)) };
}

/** Equatorial → world direction at sidereal time 0 (the star dome is then rotated by LST about the pole). */
export function equatorialToWorldAtLst0(ra, dec, latDeg = SHIP_LAT, target = new THREE.Vector3()) {
  const h = equatorialToHorizontal(ra, dec, 0, latDeg);
  return horizontalToWorld(h.east, h.north, h.up, target);
}

/** Unit vector toward the north celestial pole in the world frame. */
export function celestialPoleWorld(latDeg = SHIP_LAT, target = new THREE.Vector3()) {
  const phi = latDeg * DEG;
  return horizontalToWorld(0, Math.cos(phi), Math.sin(phi), target);
}

/** Quaternion that rotates the LST-0 star dome into the sky for sidereal time `lst` (radians). */
export function starDomeQuaternion(lst, latDeg = SHIP_LAT, target = new THREE.Quaternion()) {
  // Diurnal motion: stars drift westward, i.e. hour angle grows with LST; rotating the LST-0
  // layout by -lst about the pole reproduces equatorialToHorizontal(ra, dec, lst).
  return target.setFromAxisAngle(celestialPoleWorld(latDeg), -lst);
}

/** Small helper: smoothstep for driving lighting curves by solar elevation in degrees. */
export function smoothstep(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
