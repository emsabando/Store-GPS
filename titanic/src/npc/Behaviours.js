/**
 * Behaviours — per-NPC behaviour steps and room-area helpers for NPCManager (ARCHITECTURE.md §7).
 * Everything here works on plain numbers in ship-local space (npc.group.position) so it runs in
 * Node without WebGL. The manager owns LOD, the separation grid and the bus; this file owns the
 * "what does this NPC want to do next" logic.
 *
 * Yaw convention (ARCHITECTURE.md §2): 0 = facing +x (bow), positive = turning toward port (−z),
 * so forward = (cos yaw, 0, −sin yaw) and yaw toward (dx, dz) is atan2(−dz, dx).
 */

export const SHIP_X_MIN = -132;
export const SHIP_X_MAX = 132;
export const SHIP_Z_MAX = 13.2;
export const ARRIVE_DIST = 0.35;
export const BEHAVIOURS = ['stand', 'wander', 'sit', 'patrol', 'play', 'work', 'flee', 'goto'];

const TAU = Math.PI * 2;

/** Shortest signed angle from a to b. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Rotate state.yaw toward target at most rate*dt radians. */
export function turnToward(state, target, rate, dt) {
  const d = angleDelta(state.yaw, target);
  const step = rate * dt;
  state.yaw += Math.abs(d) <= step ? d : Math.sign(d) * step;
  if (state.yaw > Math.PI || state.yaw < -Math.PI) state.yaw = angleDelta(0, state.yaw);
}

export function yawToward(dx, dz) { return Math.atan2(-dz, dx); }

/**
 * Normalise a room-like rectangle into an area record. `r` (optional) restricts the area to a disc
 * around (cx, cz) as well — used for the "no room found" fallback.
 */
export function makeArea(x0, x1, z0, z1, r = null, cx = null, cz = null) {
  const ax0 = Math.min(x0, x1), ax1 = Math.max(x0, x1);
  const az0 = Math.min(z0, z1), az1 = Math.max(z0, z1);
  return {
    x0: ax0, x1: ax1, z0: az0, z1: az1,
    cx: cx ?? (ax0 + ax1) / 2, cz: cz ?? (az0 + az1) / 2,
    r: r,
  };
}

/** Area for a disc of radius r around (x, z), clamped to the hull. */
export function discArea(x, z, r = 6) {
  return makeArea(
    Math.max(SHIP_X_MIN, x - r), Math.min(SHIP_X_MAX, x + r),
    Math.max(-SHIP_Z_MAX, z - r), Math.min(SHIP_Z_MAX, z + r),
    r, x, z,
  );
}

function roomRect(room) {
  if (!room) return null;
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const x0 = n(room.x0), x1 = n(room.x1), z0 = n(room.z0), z1 = n(room.z1);
  if (x0 === null || x1 === null || z0 === null || z1 === null) return null;
  if (Math.abs(x1 - x0) < 0.5 || Math.abs(z1 - z0) < 0.5) return null;
  return makeArea(x0, x1, z0, z1);
}

/** Deck object from spec by id (defensive). */
export function findDeck(spec, deckId) {
  const decks = (spec && Array.isArray(spec.decks)) ? spec.decks : [];
  return decks.find((d) => d && d.id === deckId) || null;
}

/** Room object by id on a deck (or any deck when deckId is null). */
export function findRoomById(spec, deckId, roomId) {
  const decks = (spec && Array.isArray(spec.decks)) ? spec.decks : [];
  for (const d of decks) {
    if (deckId && d.id !== deckId) continue;
    for (const r of d.rooms || []) if (r && r.id === roomId) return { room: r, deck: d };
  }
  return null;
}

/**
 * Area for the room on `deckId` whose rectangle contains (x, z); otherwise a disc of radius
 * `fallbackR` around the point. Shrinks the rectangle by a small margin so NPCs stay off the walls.
 */
export function findArea(spec, deckId, x, z, fallbackR = 6, margin = 0.5) {
  const deck = findDeck(spec, deckId);
  let best = null;
  for (const room of (deck && deck.rooms) || []) {
    const a = roomRect(room);
    if (!a) continue;
    if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1) {
      const size = (a.x1 - a.x0) * (a.z1 - a.z0);
      if (!best || size < best.size) best = { area: a, size, room };
    }
  }
  if (!best) return discArea(x, z, fallbackR);
  return shrinkArea(best.area, margin, best.room);
}

export function shrinkArea(a, margin = 0.5, room = null) {
  const mx = Math.min(margin, (a.x1 - a.x0) * 0.25);
  const mz = Math.min(margin, (a.z1 - a.z0) * 0.25);
  const out = makeArea(a.x0 + mx, a.x1 - mx, a.z0 + mz, a.z1 - mz);
  if (room) out.roomId = room.id;
  return out;
}

/** Area from a room id / room object / rect on a deck; null when nothing usable is found. */
export function areaForRoom(spec, deckId, room, margin = 0.5) {
  if (typeof room === 'string') {
    const hit = findRoomById(spec, deckId, room) || findRoomById(spec, null, room);
    if (!hit) return null;
    const a = roomRect(hit.room);
    return a ? shrinkArea(a, margin, hit.room) : null;
  }
  if (room && typeof room === 'object') {
    const a = roomRect(room);
    return a ? shrinkArea(a, margin, room.id ? room : null) : null;
  }
  return null;
}

/** Clamp pos (any object with x, z) into the area. Returns true when it was moved. */
export function clampToArea(area, pos) {
  if (!area) return false;
  let moved = false;
  if (pos.x < area.x0) { pos.x = area.x0; moved = true; } else if (pos.x > area.x1) { pos.x = area.x1; moved = true; }
  if (pos.z < area.z0) { pos.z = area.z0; moved = true; } else if (pos.z > area.z1) { pos.z = area.z1; moved = true; }
  if (area.r) {
    const dx = pos.x - area.cx, dz = pos.z - area.cz;
    const d2 = dx * dx + dz * dz;
    if (d2 > area.r * area.r && d2 > 0) {
      const k = area.r / Math.sqrt(d2);
      pos.x = area.cx + dx * k; pos.z = area.cz + dz * k; moved = true;
    }
  }
  return moved;
}

export function insideArea(area, x, z, eps = 1e-6) {
  if (!area) return true;
  if (x < area.x0 - eps || x > area.x1 + eps || z < area.z0 - eps || z > area.z1 + eps) return false;
  if (area.r) { const dx = x - area.cx, dz = z - area.cz; if (dx * dx + dz * dz > (area.r + eps) * (area.r + eps)) return false; }
  return true;
}

/** Random point inside the area, written into out { x, z }. */
export function randomPointInArea(area, rng, out) {
  if (!area) { out.x = 0; out.z = 0; return out; }
  if (area.r) {
    const t = rng() * TAU, r = Math.sqrt(rng()) * area.r;
    out.x = area.cx + Math.cos(t) * r; out.z = area.cz + Math.sin(t) * r;
  } else {
    out.x = area.x0 + rng() * (area.x1 - area.x0);
    out.z = area.z0 + rng() * (area.z1 - area.z0);
  }
  clampToArea(area, out);
  return out;
}

export function clampToShip(pos) {
  if (pos.x < SHIP_X_MIN) pos.x = SHIP_X_MIN; else if (pos.x > SHIP_X_MAX) pos.x = SHIP_X_MAX;
  if (pos.z < -SHIP_Z_MAX) pos.z = -SHIP_Z_MAX; else if (pos.z > SHIP_Z_MAX) pos.z = SHIP_Z_MAX;
}

// ---------------------------------------------------------------------------------------------
// Movement primitive
// ---------------------------------------------------------------------------------------------

/**
 * Walk npc toward (tx, tz) at `speed` m/s for dt seconds, adding the separation force `sep`
 * ({ x, z }). Keeps inside npc.data.area unless `free` is set. Returns true on arrival.
 */
export function moveToward(npc, tx, tz, speed, dt, sep, free = false) {
  const pos = npc.group.position;
  const st = npc.state;
  let dx = tx - pos.x, dz = tz - pos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= ARRIVE_DIST) { st.moving = false; st.speed = 0; return true; }
  dx /= d; dz /= d;
  let vx = dx * speed + (sep ? sep.x : 0), vz = dz * speed + (sep ? sep.z : 0);
  const v = Math.sqrt(vx * vx + vz * vz);
  if (v > speed * 1.3) { const k = (speed * 1.3) / v; vx *= k; vz *= k; }
  const step = Math.min(v * dt, d);
  if (v > 1e-5) { pos.x += (vx / v) * step; pos.z += (vz / v) * step; }
  if (!free) clampToArea(npc.data.area, pos); else clampToShip(pos);
  if (v > 0.05) turnToward(st, yawToward(vx, vz), 7, dt);
  st.moving = true;
  st.speed = Math.min(speed, dt > 0 ? step / dt : speed);
  return false;
}

// ---------------------------------------------------------------------------------------------
// Behaviour steps. ctx = { rng, panic, trimDeg, broken, lifeboats:[{x,z}], boatY, sep:{x,z} }
// ---------------------------------------------------------------------------------------------

function idle(npc) { npc.state.moving = false; npc.state.speed = 0; }

export function stepStand(npc, ctx, dt) {
  const st = npc.state;
  idle(npc);
  if (!st.facingPlayer) turnToward(st, npc.data.home.yaw, 1.5, dt);
}

export function stepWander(npc, ctx, dt) {
  const st = npc.state;
  if (st.wait > 0) { st.wait -= dt; idle(npc); return; }
  const pos = npc.group.position;
  if (!st.hasTarget) {
    // a few tries for a target whose floor is the deck itself (hatches, tables and bunks are not)
    for (let k = 0; k < 6; k++) {
      randomPointInArea(npc.data.area, ctx.rng, st.target);
      if (!ctx.groundOk || ctx.groundOk(st.target.x, st.target.z, pos.y)) break;
    }
    st.hasTarget = true;
    st.stuck = 0;
  }
  const px = pos.x, pz = pos.z;
  const before = pos.x + pos.z;
  const arrived = moveToward(npc, st.target.x, st.target.z, st.walkSpeed, dt, ctx.sep);
  if (ctx.groundOk && (pos.x !== px || pos.z !== pz) && !ctx.groundOk(pos.x, pos.z, pos.y)) {
    // stepped onto something: back off, pick another way after a short pause
    pos.x = px; pos.z = pz;
    st.hasTarget = false;
    st.wait = 0.4 + ctx.rng() * 0.8;
    idle(npc);
    return;
  }
  const after = pos.x + pos.z;
  if (Math.abs(after - before) < 1e-4 * Math.max(1, dt * 60)) st.stuck += dt; else st.stuck = 0;
  if (arrived || st.stuck > 2.5) {
    st.hasTarget = false;
    st.wait = 2 + ctx.rng() * 6;
    idle(npc);
  }
}

export function stepSit(npc) { idle(npc); }

export function stepPlay(npc) { idle(npc); }

export function stepWork(npc, ctx, dt) {
  const st = npc.state;
  if (st.gesture > 0) { st.gesture -= dt; idle(npc); return; }
  if (st.wait > 0) { st.wait -= dt; idle(npc); if (!st.facingPlayer) turnToward(st, npc.data.home.yaw, 1.5, dt); return; }
  if (!st.hasTarget) {
    // Shuffle a short step around the work spot, or gesture in place.
    if (ctx.rng() < 0.45) { st.gesture = 1.2 + ctx.rng() * 1.2; st.gestureKind = ctx.rng() < 0.5 ? 'talk' : 'wave'; st.wait = 4 + ctx.rng() * 8; return; }
    const h = npc.data.home;
    const t = ctx.rng() * TAU, r = 0.6 + ctx.rng() * 1.2;
    st.target.x = h.x + Math.cos(t) * r; st.target.z = h.z + Math.sin(t) * r;
    clampToArea(npc.data.area, st.target);
    st.hasTarget = true;
  }
  if (moveToward(npc, st.target.x, st.target.z, st.walkSpeed * 0.7, dt, ctx.sep)) {
    st.hasTarget = false;
    st.wait = 5 + ctx.rng() * 9;
  }
}

export function stepPatrol(npc, ctx, dt) {
  const st = npc.state;
  if (st.wait > 0) { st.wait -= dt; idle(npc); return; }
  const p = st.patrolAtB ? npc.data.patrolB : npc.data.home;
  if (moveToward(npc, p.x, p.z, st.walkSpeed, dt, ctx.sep)) {
    st.patrolAtB = !st.patrolAtB;
    st.wait = 2 + ctx.rng() * 3;
  }
}

export function stepGoto(npc, ctx, dt) {
  const st = npc.state;
  const g = st.goto;
  if (!g) { st.behaviour = npc.data.behaviour; return; }
  if (moveToward(npc, g.x, g.z, st.walkSpeed * 1.15, dt, ctx.sep, true)) {
    const h = npc.data.home;
    h.x = g.x; h.z = g.z; h.yaw = g.yaw ?? h.yaw;
    st.goto = null;
    st.behaviour = npc.data.behaviour;
    st.hasTarget = false;
    st.wait = 0;
  }
}

/** Nearest lifeboat stations (random among the closest few) for clustering. */
function pickStation(npc, ctx) {
  const list = ctx.lifeboats;
  if (!list || !list.length) return null;
  const px = npc.group.position.x, pz = npc.group.position.z;
  let a = null, b = null, c = null, da = Infinity, db = Infinity, dc = Infinity;
  for (const s of list) {
    const dx = s.x - px, dz = s.z - pz, d = dx * dx + dz * dz;
    if (d < da) { c = b; dc = db; b = a; db = da; a = s; da = d; }
    else if (d < db) { c = b; dc = db; b = s; db = d; }
    else if (d < dc) { c = s; dc = d; }
  }
  const r = ctx.rng();
  return r < 0.6 || !b ? a : (r < 0.85 || !c ? b : c);
}

export function stepFlee(npc, ctx, dt) {
  const st = npc.state;
  const level = ctx.panic;
  if (st.pause > 0) { st.pause -= dt; idle(npc); return; }
  if (st.wait > 0) { st.wait -= dt; idle(npc); return; }
  const pos = npc.group.position;
  const toBoats = (npc.data.deck === 'boat' || npc.data.deck === 'A') && level > 0.6;
  if (!st.hasTarget) {
    if (toBoats) {
      // Keep the station once chosen so the crowd clusters instead of trekking between boats.
      if (!st.station || ctx.rng() < 0.03) st.station = pickStation(npc, ctx);
      const s = st.station;
      if (s) {
        st.target.x = s.x + (ctx.rng() - 0.5) * 5;
        st.target.z = s.z + (ctx.rng() - 0.5) * 3 - Math.sign(s.z || 1) * 1.2;
      } else { st.target.x = pos.x - 10; st.target.z = pos.z; }
    } else if (pos.x > -60) {
      st.target.x = Math.max(-125, pos.x - (15 + ctx.rng() * 25));
      st.target.z = pos.z + (ctx.rng() - 0.5) * 4;
    } else {
      st.target.x = pos.x + (ctx.rng() - 0.5) * 8;
      st.target.z = pos.z + (ctx.rng() - 0.5) * 6;
    }
    clampToShip(st.target);
    st.hasTarget = true;
    st.stuck = 0;
  }
  let speed = st.walkSpeed * (1 + level * 1.6);
  if (level >= 0.999 && st.runner) speed = 4.2;
  const bx = pos.x, bz = pos.z;
  const arrived = moveToward(npc, st.target.x, st.target.z, speed, dt, ctx.sep, true);
  if (toBoats && ctx.boatY !== null && Number.isFinite(ctx.boatY)) {
    // "Takes the stairs": drift up to the Boat Deck as it moves (A deck is one flight below).
    const dy = ctx.boatY - pos.y;
    if (Math.abs(dy) > 0.01) pos.y += Math.sign(dy) * Math.min(Math.abs(dy), 0.8 * dt);
    else { pos.y = ctx.boatY; npc.data.deck = 'boat'; npc.data.home.y = ctx.boatY; }
  }
  if (Math.abs(pos.x - bx) + Math.abs(pos.z - bz) < 1e-4 && !arrived) st.stuck += dt; else st.stuck = 0;
  if (arrived || st.stuck > 2) {
    st.hasTarget = false;
    st.wait = toBoats ? 1 + ctx.rng() * 4 : 0.5 + ctx.rng() * 2;
    idle(npc);
  }
  // Stumbles: random pauses at full panic.
  if (level >= 0.999 && st.stumbler) {
    st.stumbleIn -= dt;
    if (st.stumbleIn <= 0) { st.pause = 0.4 + ctx.rng() * 0.9; st.stumbleIn = 3 + ctx.rng() * 5; idle(npc); }
  }
}

export const STEPS = {
  stand: stepStand, wander: stepWander, sit: stepSit, patrol: stepPatrol, play: stepPlay,
  work: stepWork, flee: stepFlee, goto: stepGoto,
};

/** Pose a behaviour wants while not moving. */
export function restPose(behaviour) {
  switch (behaviour) {
    case 'sit': return 'sit';
    case 'play': return 'play';
    default: return 'idle';
  }
}
