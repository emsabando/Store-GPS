/**
 * Grand Staircases (ARCHITECTURE.md §5): forward (Boat Deck → E) and aft (A → C). Each deck interval is an
 * imperial stair: a central flight rises forward from the lower level to a half-landing against the forward
 * wall, and two return flights climb aft to the upper level, which is a U-shaped oak gallery around the well.
 * The clock panel "Honour and Glory Crowning Time" sits on the half-landing below the dome; a bronze cherub
 * lamp stands on the newel at the foot of the A-deck flight. Three lifts rise forward of the stair (E → A).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeStairs, makeRailing, makeClock, makeStatue, makeLamp, makeColumn, makeDoor, makeBench, box, collider } from '../Props.js';

const ORDER = ['boat', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'orlop', 'tankTop'];

function slab(m, w, h, d, mat, x, y, z, { collide = true, shadow = true } = {}) {
  const b = box(m, w, h, d, mat, { x, y: y - h / 2, z, collide, shadow });
  return b;
}

/** Oak-panelled wall segment between (x0,z0) and (x1,z1) from y to y+h with optional door gaps (fractions along the run). */
function panelWall(m, x0, z0, x1, z1, y, h, gaps = [], mat = 'oakPanel') {
  const g = new THREE.Group();
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(-(z1 - z0), x1 - x0);
  const dir = new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize();
  const segs = [];
  let cursor = 0;
  const sorted = [...gaps].sort((a, b) => a - b);
  for (const f of sorted) {
    const gx = f * len - 0.55;
    if (gx > cursor) segs.push([cursor, gx]);
    cursor = f * len + 0.55;
    // lintel above the door gap
    const cx = x0 + dir.x * (f * len), cz = z0 + dir.z * (f * len);
    const lintel = box(m, 1.1, h - 2.15, 0.16, mat, { x: cx, y: y + 2.15 + (h - 2.15) / 2, z: cz, collide: true });
    lintel.rotation.y = ang; g.add(lintel);
  }
  if (cursor < len) segs.push([cursor, len]);
  for (const [a, b] of segs) {
    const l = b - a; if (l < 0.05) continue;
    const cx = x0 + dir.x * (a + l / 2), cz = z0 + dir.z * (a + l / 2);
    const w = box(m, l, h, 0.16, mat, { x: cx, y: y + h / 2, z: cz, collide: true });
    w.rotation.y = ang; g.add(w);
    // dado rail and cornice
    const dado = box(m, l, 0.08, 0.2, 'oakDark', { x: cx, y: y + 0.95, z: cz, collide: false }); dado.rotation.y = ang; g.add(dado);
    const cornice = box(m, l, 0.14, 0.22, 'oakDark', { x: cx, y: y + h - 0.1, z: cz, collide: false }); cornice.rotation.y = ang; g.add(cornice);
  }
  return g;
}

function buildStaircase(spec, m, ctx, gs, { clockBetween = null, cherubAt = null, lifts = null, key = 'forward' }) {
  const group = new THREE.Group();
  group.name = `GrandStaircase.${key}`;
  const lights = [], locations = [], interactables = [];
  const deckY = (id) => ctx.deckY(id);
  const decks = gs.decks.filter((d) => spec.decks.some((dd) => dd.id === d));
  const xC = gs.x, zC = gs.z || 0;
  const halfLen = key === 'forward' ? 4.6 : 3.4;          // must match the well cut in Decks.js
  const halfWid = key === 'forward' ? 6.2 : 4.6;
  const flightW = gs.width || 4.9;
  const sideW = Math.min(1.9, halfWid - flightW / 2 - 1.4);
  const landingDepth = 2.4;
  const lino = m.get('linoLanding') || m.get('linoDining');
  const oak = 'oakPanel';
  const part = { x0: xC - halfLen - 10, x1: xC + halfLen + 10 };

  // room shells per level: floor overlay (outside the well), fore/aft bulkheads, side walls with corridor doors, ceiling
  for (let i = 0; i < decks.length; i++) {
    const id = decks[i];
    const y = deckY(id);
    const isTop = i === 0, isBottom = i === decks.length - 1;
    const room = (spec.decks.find((d) => d.id === id)?.rooms || []).find((r) => /grand_staircase/.test(r.id) && ((key === 'forward') === !/aft/.test(r.id)));
    const rx0 = room ? room.x0 : xC - halfLen - 4, rx1 = room ? room.x1 : xC + halfLen + 4;
    const rz0 = room ? room.z0 : -halfWid - 2, rz1 = room ? room.z1 : halfWid + 2;
    const ceilH = isTop ? 2.6 : room?.ceiling || 2.6;
    // floor overlay around the well (lino) — four strips so the well stays open
    const fy = y + 0.012;
    const strips = [
      [rx0, xC - halfLen, rz0, rz1], [xC + halfLen, rx1, rz0, rz1],
      [xC - halfLen, xC + halfLen, rz0, -halfWid], [xC - halfLen, xC + halfLen, halfWid, rz1],
    ];
    if (isBottom) strips.push([xC - halfLen, xC + halfLen, -halfWid, halfWid]);
    for (const [a, b, c, d] of strips) {
      if (b - a < 0.05 || d - c < 0.05) continue;
      const f = box(m, b - a, 0.024, d - c, lino, { x: (a + b) / 2, y: fy - 0.012, z: (c + d) / 2, collide: isBottom });
      f.receiveShadow = true; f.userData.part = part; group.add(f);
    }
    // ceiling (plaster) except where the well continues upward (open) and at the top (dome drum)
    if (!isTop) {
      const cy = y + ceilH;
      const cs = [[rx0, xC - halfLen, rz0, rz1], [xC + halfLen, rx1, rz0, rz1], [xC - halfLen, xC + halfLen, rz0, -halfWid], [xC - halfLen, xC + halfLen, halfWid, rz1]];
      for (const [a, b, c, d] of cs) {
        if (b - a < 0.05 || d - c < 0.05) continue;
        const cm = box(m, b - a, 0.05, d - c, 'plasterWhite', { x: (a + b) / 2, y: cy, z: (c + d) / 2, collide: false });
        cm.castShadow = false; cm.userData.part = part; group.add(cm);
      }
    }
    // bulkheads fore and aft (oak) with door gaps toward the corridors / lift lobby; side walls with doors
    const wallH = isTop ? ceilH : ceilH;
    const fwd = panelWall(m, rx1, rz0, rx1, rz1, y, wallH, [0.5], oak);
    const aft = panelWall(m, rx0, rz0, rx0, rz1, y, wallH, [0.5], oak);
    const port = panelWall(m, rx0, rz0, rx1, rz0, y, wallH, [0.3, 0.7], oak);
    const stbd = panelWall(m, rx0, rz1, rx1, rz1, y, wallH, [0.3, 0.7], oak);
    for (const w of [fwd, aft, port, stbd]) { w.traverse((o) => { if (o.isMesh) o.userData.part = part; }); group.add(w); }
    // sconces and a landing bench
    for (const sz of [-1, 1]) {
      const sc = makeLamp(m, { kind: 'sconce', power: 1, light: i % 2 === 0 });
      sc.position.set(xC - halfLen - 0.1, y + 1.9, sz * (halfWid - 0.6)); sc.rotation.y = -Math.PI / 2; group.add(sc);
      if (sc.userData.light) lights.push(sc.userData.light);
    }
    locations.push({ id: `${key}_gs_${id}`, name: `Grand Staircase, ${id} deck`, deck: id, x: xC - halfLen - 1.5, y, z: 0, yaw: 0 });
    // the spec's own landmark for this landing sits inside the well (over the flights): override it with the safe spot
    if (key === 'forward') locations.push({ id: `grand_staircase_${id}`, name: `Grand Staircase, ${id} deck`, deck: id, x: xC - halfLen - 1.5, y, z: 0, yaw: 0 });
  }

  // intervals: upper deck U, lower deck L
  for (let i = 0; i < decks.length - 1; i++) {
    const U = decks[i], L = decks[i + 1];
    const yU = deckY(U), yL = deckY(L);
    const h = yU - yL;
    const yHalf = yL + h / 2;
    // U-shaped gallery at the upper level: aft strip + side strips (thick oak-faced floor)
    const galleryAftX1 = xC - 0.04;
    const aft = slab(m, galleryAftX1 - (xC - halfLen), 0.28, 2 * halfWid, oak, (xC - halfLen + galleryAftX1) / 2, yU, 0);
    aft.userData.part = part; group.add(aft);
    for (const sz of [-1, 1]) {
      const zIn = sz * (flightW / 2 + sideW), zOut = sz * halfWid;
      const s = slab(m, halfLen - (galleryAftX1 - xC), 0.28, Math.abs(zOut - zIn), oak, (galleryAftX1 + xC + halfLen) / 2, yU, (zIn + zOut) / 2);
      s.userData.part = part; group.add(s);
    }
    // half-landing against the forward wall
    const land = slab(m, landingDepth, 0.28, flightW + 2 * sideW, oak, xC + halfLen - landingDepth / 2, yHalf, 0);
    land.userData.part = part; group.add(land);
    // central flight: from the lower level (x = galleryAftX1) forward+up to the half-landing
    const steps = Math.max(6, Math.round((h / 2) / 0.18));
    const rise = (h / 2) / steps;
    const run = (xC + halfLen - landingDepth - galleryAftX1) / steps;
    const central = makeStairs(m, { width: flightW, rise, run, steps, style: 'oak', rails: false });
    // makeStairs rises toward −z from its origin; rotate so it rises toward +x
    central.rotation.y = -Math.PI / 2;
    central.position.set(galleryAftX1, yL, 0);
    central.userData.part = part; group.add(central);
    // side return flights: from the half-landing aft+up to the upper gallery
    for (const sz of [-1, 1]) {
      const sideSteps = steps, sideRise = rise, sideRun = (xC + halfLen - landingDepth - galleryAftX1) / sideSteps;
      const fl = makeStairs(m, { width: sideW, rise: sideRise, run: sideRun, steps: sideSteps, style: 'oak', rails: false });
      fl.rotation.y = Math.PI / 2; // rises toward −x (aft)
      fl.position.set(xC + halfLen - landingDepth, yHalf, sz * (flightW / 2 + sideW / 2));
      fl.userData.part = part; group.add(fl);
    }
    // balustrades: gallery edges (aft strip inner edge, side strip inner edges), flight rails, landing front rail between the side flights
    const rails = [];
    rails.push({ len: flightW + 2 * sideW - 0.2, x: galleryAftX1 - 0.05, y: yU, z: 0, ry: Math.PI / 2 });               // aft gallery edge (across z)
    for (const sz of [-1, 1]) {
      rails.push({ len: halfLen - (galleryAftX1 - xC) - 0.1, x: (galleryAftX1 + xC + halfLen) / 2, y: yU, z: sz * (flightW / 2 + sideW) + sz * 0.05, ry: 0 }); // side strip inner edge
      // central flight rails (sloped)
      const flen = Math.hypot(h / 2, steps * run);
      const r = makeRailing(m, { length: flen, height: 0.95, balusterPitch: 0.3, style: 'oakGrand' });
      r.position.set(galleryAftX1 + (steps * run) / 2, yL + h / 4 + 0.05, sz * (flightW / 2 + 0.02));
      r.rotation.z = Math.atan2(h / 2, steps * run);
      r.userData.part = part; group.add(r);
      // side flight outer/inner rail (sloped, rising aft)
      const r2 = makeRailing(m, { length: flen, height: 0.95, balusterPitch: 0.3, style: 'oakGrand' });
      r2.position.set(galleryAftX1 + (steps * run) / 2, yHalf + h / 4 + 0.05, sz * (flightW / 2 + sideW + 0.02) * (sz > 0 ? 1 : 1));
      r2.rotation.z = -Math.atan2(h / 2, steps * run);
      r2.userData.part = part; group.add(r2);
    }
    for (const rr of rails) {
      const r = makeRailing(m, { length: rr.len, height: 0.95, balusterPitch: 0.3, style: 'oakGrand' });
      r.position.set(rr.x, rr.y + 0.14, rr.z); r.rotation.y = rr.ry; r.userData.part = part; group.add(r);
    }
    // newel posts with pineapple finials at the foot of the central flight
    for (const sz of [-1, 1]) {
      const post = box(m, 0.22, 1.25, 0.22, 'oakDark', { x: galleryAftX1 - 0.1, y: yL + 0.62, z: sz * (flightW / 2 + 0.11), collide: true });
      post.userData.part = part; group.add(post);
    }
    // clock panel on the half-landing's forward wall (one interval) or a landscape painting
    if (clockBetween && clockBetween[0] === U && clockBetween[1] === L) {
      const clock = makeClock(m, { w: 2.6, h: 3.1, carved: true });
      clock.position.set(xC + halfLen - 0.12, yHalf + 0.14, 0); clock.rotation.y = -Math.PI / 2;
      clock.userData.part = part; group.add(clock);
      group.userData.clock = clock;
      clock.traverse((o) => { if (o.isMesh) o.userData.interactable = { id: 'honour_and_glory_clock', type: 'plaque', label: 'Honour and Glory Crowning Time', data: { text: 'The clock panel on the Grand Staircase: Honour and Glory crowning Time.' } }; });
      interactables.push({ id: 'honour_and_glory_clock', type: 'plaque', label: 'Honour and Glory Crowning Time', object: clock, data: { text: 'The clock panel on the Grand Staircase: Honour and Glory crowning Time.' } });
      const ch = makeLamp(m, { kind: 'chandelier', power: 1.2, light: true });
      ch.position.set(xC + 1.0, yU + 2.2, 0); group.add(ch); lights.push(ch.userData.light);
      locations.push({ id: `${key}_clock_landing`, name: 'The clock landing', deck: U, x: xC + halfLen - 1.6, y: yHalf + 0.14, z: 0, yaw: 0 });
    } else {
      const painting = box(m, 0.06, 1.3, 2.2, m.clone('clothGreen', { color: new THREE.Color(0x5c6e5a) }), { x: xC + halfLen - 0.12, y: yHalf + 1.5, z: 0, collide: false });
      const frame = box(m, 0.04, 1.5, 2.4, 'ormolu', { x: xC + halfLen - 0.14, y: yHalf + 1.5, z: 0, collide: false });
      painting.userData.part = part; frame.userData.part = part; group.add(frame, painting);
      const lamp = makeLamp(m, { kind: 'ceilingGlobe', power: 1, light: i % 2 === 1 });
      lamp.position.set(xC, yU - 0.05, 0); group.add(lamp); if (lamp.userData.light) lights.push(lamp.userData.light);
    }
    if (cherubAt && cherubAt === L) {
      const cherub = makeStatue(m, { kind: 'cherub' });
      cherub.position.set(galleryAftX1 - 0.1, yL + 0.014, -(flightW / 2 + 0.11)); cherub.rotation.y = Math.PI / 2;
      cherub.userData.part = part; group.add(cherub); lights.push(cherub.userData.light);
    }
  }

  // lifts (forward of the stair): three cages in a shaft from the lowest lift deck to the top lift deck
  if (lifts) {
    const liftDecks = lifts.decks.filter((d) => spec.decks.some((dd) => dd.id === d));
    const yTop = deckY(liftDecks[0]), yBot = deckY(liftDecks[liftDecks.length - 1]);
    const lx = lifts.x;
    for (let k = 0; k < (lifts.count || 3); k++) {
      const z = (k - 1) * 1.6;
      // shaft grille (brass) on the aft face, cage at the top deck
      const cage = new THREE.Group();
      cage.add(box(m, 1.4, 2.2, 1.4, m.clone('brass', { transparent: true, opacity: 0.35 }), { y: 1.1, collide: false }));
      cage.add(box(m, 1.4, 0.06, 1.4, 'oakPanel', { y: 0.03, collide: true }));
      cage.position.set(lx, yTop + 0.02, z);
      cage.userData.part = part; group.add(cage);
      const shaft = box(m, 1.5, yTop - yBot + 2.3, 0.06, 'brass', { x: lx - 0.78, y: yBot + (yTop - yBot + 2.3) / 2, z, collide: true });
      shaft.userData.part = part; group.add(shaft);
      for (const d of liftDecks) {
        const door = makeDoor(m, { w: 0.9, h: 2.1, style: 'gate', id: `lift_gate_${d}_${k}` });
        door.position.set(lx - 0.8, deckY(d), z); door.rotation.y = Math.PI / 2;
        door.userData.part = part; group.add(door);
      }
    }
    locations.push({ id: 'lift_lobby_A', name: 'Lift lobby, A deck', deck: 'A', x: lx - 2.2, y: deckY('A'), z: 0, yaw: 0 });
  }

  return { group, lights, locations, interactables };
}

export function buildGrandStaircases(spec, materials, ctx) {
  const group = new THREE.Group();
  group.name = 'GrandStaircases';
  const lights = [], locations = [], interactables = [];
  const gs = spec.grandStaircases || {};
  if (gs.forward) {
    const r = buildStaircase(spec, materials, ctx, gs.forward, { clockBetween: ['boat', 'A'], cherubAt: 'A', lifts: gs.forward.lifts, key: 'forward' });
    group.add(r.group); lights.push(...r.lights); locations.push(...r.locations); interactables.push(...r.interactables);
    // the dome drum interior: a ring of oak under the dome at the boat-deck gallery ceiling
    const yTop = ctx.deckY('boat') + 2.6;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(gs.forward.domeRx + 0.2, gs.forward.domeRx + 0.2, 0.5, 32, 1, true), materials.clone('oakPanel', { side: THREE.DoubleSide }));
    ring.scale.set(1, 1, (gs.forward.domeRz + 0.2) / (gs.forward.domeRx + 0.2)); ring.position.set(gs.forward.x, yTop - 0.2, 0);
    group.add(ring);
  }
  if (gs.aft) {
    const r = buildStaircase(spec, materials, ctx, gs.aft, { clockBetween: null, cherubAt: null, lifts: null, key: 'aft' });
    group.add(r.group); lights.push(...r.lights); locations.push(...r.locations); interactables.push(...r.interactables);
  }
  ctx?.log?.(`grand staircases: ${lights.length} lights`);
  return { group, locations, lights, dynamic: [], interactables, floodRooms: [] };
}
