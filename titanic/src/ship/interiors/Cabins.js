/**
 * Cabins and corridors (ARCHITECTURE.md §5): every corridor in the spec (Scotland Road included) as a walkable
 * passage with doors, the parlour suites B-52/54/56 and B-51/53/55 with their private promenades, representative
 * first-class staterooms in several styles, second- and third-class cabins with bunks, the third-class gates,
 * the Master-at-Arms' office, the Marconi room, wheelhouse/chart room, officers' quarters, crew messes and quarters.
 */
import * as THREE from 'three';
import { findRoom, roomShell, gridPlace, bakeGroup, tiled, wall } from './RoomKit.js';
import { hullHalfBreadth } from '../Hull.js';
import { makeBed, makeWardrobe, makeSofa, makeDesk, makeChair, makeTable, makeSink, makeBathtub, makeDoor, makeLamp, makeBench, makeFireplace, makePalm, makeShipsWheel, makeBinnacle, makeTelegraph, makeClock, makeBookcase, box, cyl } from '../Props.js';

const STYLES = [
  { name: 'Empire', walls: 'whiteEnamel', floor: 'carpetBlue', trim: 'ormolu', bed: 'brass' },
  { name: 'Louis XVI', walls: 'whiteEnamel', floor: 'carpetRed', trim: 'ormolu', bed: 'wood' },
  { name: 'Georgian', walls: 'plasterCream', floor: 'carpetGreen', trim: 'mahogany', bed: 'wood' },
  { name: 'Old Dutch', walls: 'oakDark', floor: 'carpetRed', trim: 'oakDark', bed: 'wood' },
  { name: 'Queen Anne', walls: 'walnut', floor: 'carpetBlue', trim: 'walnut', bed: 'wood' },
  { name: 'Adam', walls: 'whiteEnamel', floor: 'roseCarpet', trim: 'sycamore', bed: 'brass' },
];

function loc(id, name, deck, x, y, z, yaw = Math.PI) { return { id, name, deck, x, y, z, yaw }; }

/** A block of cabins along both sides of a corridor: partitions, doors, bunks. Local y = 0 at the deck. */
function cabinBlock(m, g, { x0, x1, zIn, zOut, cabinW = 2.6, depthClass = 'third', ceiling = 2.4, doorEvery = 1, bunk = 'bunk2', wallMat = 'whiteEnamel', floorMat = null, nameBase = 'cabin', spec = null, deckY = 0, ceilMat = 'plasterWhite', interactables, seed = 1 }) {
  const n = Math.max(1, Math.floor((x1 - x0) / cabinW));
  const sign = Math.sign(zOut - zIn) || 1;
  // The outboard side is the hull (or another room): clamp it to the hull breadth at each x so
  // cabins near the tapering ends never poke through the plating.
  const outAt = (x) => {
    if (!spec) return zOut;
    const hb = hullHalfBreadth(spec, x, deckY + 1.2);
    return Number.isFinite(hb) ? (sign > 0 ? Math.min(zOut, hb - 0.3) : Math.max(zOut, -hb + 0.3)) : zOut;
  };
  // partitions
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * cabinW;
    const zo = outAt(x); const depth = Math.abs(zo - zIn);
    if (depth < 1.2) continue;
    const part = box(m, 0.08, ceiling, depth, wallMat, { x, y: ceiling / 2, z: (zIn + zo) / 2, collide: true });
    part.castShadow = false; g.add(part);
  }
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * cabinW, xb = xa + cabinW;
    const cx = (xa + xb) / 2;
    const zOutC = sign > 0 ? Math.min(outAt(xa), outAt(xb), outAt(cx)) : Math.max(outAt(xa), outAt(xb), outAt(cx));
    const depth = Math.abs(zOutC - zIn);
    if (depth < 1.4) continue;                                  // too shallow to be a cabin here
    // floor and ceiling strip for this cabin (the bake merges them)
    if (floorMat) { const f = box(m, cabinW, 0.02, depth, floorMat, { x: cx, y: 0.013, z: (zIn + zOutC) / 2, collide: true }); f.castShadow = false; g.add(f); }
    { const c = box(m, cabinW, 0.05, depth, ceilMat, { x: cx, y: ceiling + 0.025, z: (zIn + zOutC) / 2, collide: false }); c.castShadow = false; g.add(c); }
    // inboard wall with a door
    const w = wall(m, xa, zIn, xb, zIn, 0, ceiling, { gaps: [0.5], material: wallMat, panelled: depthClass !== 'third', doorW: 0.85, doorH: 2.0 });
    g.add(w);
    const door = makeDoor(m, { w: 0.85, h: 2.0, style: depthClass === 'third' ? 'white' : 'oak', id: `${nameBase}_${i}` });
    door.position.set(cx, 0, zIn); door.rotation.y = sign > 0 ? 0 : Math.PI; g.add(door);
    // furniture
    const bed = makeBed(m, { w: depthClass === 'third' ? 0.8 : 1.0, l: 1.9, style: bunk });
    bed.position.set(xa + 0.55, 0, zIn + sign * (depth - 1.1)); bed.rotation.y = Math.PI / 2; g.add(bed);
    if (depthClass !== 'third' || i % 2 === 0) { const sink = makeSink(m, {}); sink.position.set(xb - 0.45, 0, zIn + sign * (depth - 0.35)); sink.rotation.y = sign > 0 ? Math.PI : 0; g.add(sink); }
    if (depthClass === 'first') { const wd = makeWardrobe(m, { w: 1.0, h: 2.0, d: 0.5 }); wd.position.set(xb - 0.6, 0, zIn + sign * 0.35); wd.rotation.y = sign > 0 ? 0 : Math.PI; g.add(wd); }
    if (depthClass !== 'third') { const lamp = makeLamp(m, { kind: 'ceilingGlobe', power: 0.8, light: false }); lamp.position.set(cx, ceiling - 0.02, (zIn + zOutC) / 2); g.add(lamp); }
    else if (i % 3 === 0) { const lamp = makeLamp(m, { kind: 'bulkhead', power: 1, light: false }); lamp.position.set(cx, ceiling - 0.15, (zIn + zOutC) / 2); g.add(lamp); }
  }
}

function corridorShell(m, ctx, c, deckY, { ceiling = 2.4, floor = 'linoCorridor', walls = 'whiteEnamel', lampEvery = 6 } = {}) {
  const g = new THREE.Group();
  g.name = `Corridor.${c.id}`;
  const lights = [];
  const len = c.x1 - c.x0, w = c.z1 - c.z0;
  const f = box(m, len, 0.02, w, tiled(m, floor, 0.9), { x: (c.x0 + c.x1) / 2, y: 0.013, z: (c.z0 + c.z1) / 2, collide: true });
  f.castShadow = false; g.add(f);
  const ceil = box(m, len, 0.05, w, 'plasterWhite', { x: (c.x0 + c.x1) / 2, y: ceiling + 0.025, z: (c.z0 + c.z1) / 2, collide: false }); ceil.castShadow = false; g.add(ceil);
  const n = Math.max(1, Math.floor(len / lampEvery));
  const q = ctx?.quality || 'high';
  const litEvery = q === 'low' ? 1e9 : q === 'medium' ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const lamp = makeLamp(m, { kind: 'bulkhead', power: 1.1, light: i % litEvery === 1 });
    lamp.position.set(c.x0 + (i + 0.5) * (len / n), ceiling - 0.12, (c.z0 + c.z1) / 2); g.add(lamp);
    if (lamp.userData.light) lights.push(lamp.userData.light);
  }
  g.position.y = deckY;
  return { group: g, lights };
}

export function buildCabinsAndCorridors(spec, m, ctx) {
  const group = new THREE.Group();
  group.name = 'CabinsAndCorridors';
  const lights = [], locations = [], interactables = [], floodRooms = [];
  const q = ctx?.quality || 'high';
  const dense = q === 'high' || q === 'ultra';
  const R = (id) => findRoom(spec, id);
  const add = (shell) => { group.add(shell.group); lights.push(...shell.lights); };
  const flood = (r) => floodRooms.push({ deck: r.deck, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 });

  // ---------------- corridors from the spec (all decks)
  for (const d of spec.decks || []) {
    for (const c of d.corridors || []) {
      const isScotland = c.id === 'scotland_road';
      const shell = corridorShell(m, ctx, c, d.y, { ceiling: isScotland ? 2.3 : 2.35, floor: isScotland ? 'linoCorridor' : (d.id === 'E' || d.id === 'F' || d.id === 'G' ? 'linoCorridor' : 'carpetRed'), lampEvery: isScotland ? 8 : 6 });
      // walls with doors: the cabin blocks supply the walls along the corridor sides; here only the end caps
      const g = shell.group;
      for (const x of [c.x0, c.x1]) {
        const cap = wall(m, x, c.z0, x, c.z1, 0, 2.35, { gaps: [0.5], material: 'whiteEnamel', panelled: false, doorW: 1.0, doorH: 2.0 });
        g.add(cap);
      }
      add(shell);
      floodRooms.push({ deck: d.id, x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 });
      if (isScotland) {
        // watertight doors across Scotland Road at bulkheads D..K (vertical sliding pattern) — interactable 'wtDoor'
        for (const b of spec.bulkheads || []) {
          if (b.x < c.x0 + 1 || b.x > c.x1 - 1) continue;
          if (!['D', 'E', 'F', 'G', 'H', 'J', 'K'].includes(b.letter)) continue;
          const door = makeDoor(m, { w: 1.2, h: 2.1, style: 'wtDoor', id: `wtdoor_${b.letter}`, open: true });
          door.position.set(b.x, 0, (c.z0 + c.z1) / 2); door.rotation.y = Math.PI / 2; g.add(door);
          interactables.push({ id: `wtdoor_${b.letter}`, type: 'door', label: `Watertight door ${b.letter}`, object: door, data: door.userData.door });
        }
        // the famous width: pipe runs and a brass rail along the walls
        const pipe = cyl(m, 0.08, 0.08, c.x1 - c.x0, 'whitePaintedSteel', { x: (c.x0 + c.x1) / 2, y: 2.0, z: c.z0 + 0.15, rz: Math.PI / 2 }, 8); g.add(pipe);
        locations.push(loc('scotland_road_fwd', 'Scotland Road, forward end', 'E', c.x1 - 3, d.y, (c.z0 + c.z1) / 2, Math.PI), loc('scotland_road_aft', 'Scotland Road, aft', 'E', c.x0 + 3, d.y, (c.z0 + c.z1) / 2, 0));
      }
    }
  }

  // ---------------- cabin blocks: generic first/second/third class rooms along corridors
  const blocks = [
    // [roomId, corridorId, class, bunk, cabinW]
    ['staterooms_A_fwd', 'cor_A_fwd', 'first', 'wood', 3.2], ['staterooms_B_fwd', 'cor_B_fwd', 'first', 'brass', 3.4],
    ['staterooms_B_mid', 'cor_B_mid_port', 'first', 'wood', 3.6], ['staterooms_B_mid', 'cor_B_mid_stbd', 'first', 'brass', 3.6],
    ['staterooms_C_fwd', 'cor_C_fwd_port', 'first', 'wood', 3.0], ['staterooms_C_fwd', 'cor_C_fwd_stbd', 'first', 'brass', 3.0],
    ['staterooms_C_mid', 'cor_C_mid_port', 'first', 'brass', 3.4], ['staterooms_C_mid', 'cor_C_mid_stbd', 'first', 'wood', 3.4],
    ['staterooms_C_aft', 'cor_C_aft_port', 'first', 'wood', 3.0], ['staterooms_C_aft', 'cor_C_aft_stbd', 'first', 'brass', 3.0],
    ['staterooms_D_fwd', 'cor_D_fwd_port', 'first', 'wood', 3.0], ['staterooms_D_fwd', 'cor_D_fwd_stbd', 'first', 'brass', 3.0],
    ['staterooms_2nd_D', 'cor_D_2nd', 'second', 'bunk2', 2.8],
    ['staterooms_E_first', 'cor_E_stbd', 'first', 'wood', 3.0], ['staterooms_E_second', 'cor_E_stbd', 'second', 'bunk2', 2.8],
    ['crew_cabins_E_port', 'scotland_road', 'crew', 'bunk2', 2.6], ['third_class_cabins_E_fwd', 'scotland_road', 'third', 'bunk2', 2.4],
    ['third_class_cabins_F_fwd', 'cor_F_fwd', 'third', 'bunk2', 2.4], ['cabins_2nd_F', 'cor_F_2nd', 'second', 'bunk2', 2.8],
    ['third_class_G_aft', 'cor_G_aft', 'third', 'bunk3', 2.4],
  ];
  const corridorsById = new Map();
  for (const d of spec.decks || []) for (const c of d.corridors || []) corridorsById.set(c.id, { ...c, deck: d.id, y: d.y });
  let blockCount = 0;
  for (const [roomId, corId, cls, bunk, cabinW] of blocks) {
    const r = R(roomId), c = corridorsById.get(corId);
    if (!r || !c) continue;
    const g = new THREE.Group(); g.name = `Cabins.${roomId}.${corId}`;
    const x0 = Math.max(r.x0, c.x0), x1 = Math.min(r.x1, c.x1);
    if (x1 - x0 < cabinW) continue;
    const ceiling = Math.min(r.ceiling || 2.5, 2.5);
    const sides = [];
    if (r.z0 < c.z0 - 1.0) sides.push({ zIn: c.z0, zOut: Math.max(r.z0, c.z0 - 3.6) });
    if (r.z1 > c.z1 + 1.0) sides.push({ zIn: c.z1, zOut: Math.min(r.z1, c.z1 + 3.6) });
    const style = STYLES[blockCount % STYLES.length];
    const floorMat = tiled(m, cls === 'first' ? style.floor : cls === 'second' ? 'linoCorridor' : 'linoCorridor', cls === 'first' ? 2.0 : 0.9, undefined, cls === 'third' ? { color: new THREE.Color(0xe7a58f) } : {});
    for (const s of sides) {
      cabinBlock(m, g, { x0, x1, zIn: s.zIn, zOut: s.zOut, cabinW, depthClass: cls === 'crew' ? 'third' : cls, ceiling, bunk, wallMat: cls === 'first' ? style.walls : 'whiteEnamel', spec, deckY: r.y, floorMat, ceilMat: cls === 'third' ? 'whitePaintedSteel' : 'plasterWhite', nameBase: `${roomId}_${corId}_${s.zIn > 0 ? 's' : 'p'}`, interactables });
    }
    g.position.y = r.y;
    group.add(g);
    floodRooms.push({ deck: r.deck, x0, x1, z0: r.z0, z1: r.z1 });
    const firstSide = sides[0];
    if (firstSide) locations.push(loc(`cabin_${roomId}_${corId}`, `${r.name} (${cls === 'first' ? style.name : cls})`, r.deck, x0 + cabinW * 0.5 + 0.3, r.y, firstSide.zIn + Math.sign(firstSide.zOut - firstSide.zIn) * 1.5, Math.PI / 2));
    blockCount++;
  }

  // ---------------- the parlour suites B-52/54/56 (port) and B-51/53/55 (starboard) with private promenades
  for (const [suiteId, promId, side] of [['parlour_suite_B52', 'private_promenade_B52', -1], ['parlour_suite_B51', 'private_promenade_B51', 1]]) {
    const r = R(suiteId), p = R(promId);
    if (!r) continue;
    const shell = roomShell(spec, m, ctx, r, { floor: side < 0 ? 'carpetBlue' : 'carpetRed', walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'ormolu', floorRepeat: 2.2,
      doors: { [side < 0 ? 'stbd' : 'port']: [0.2, 0.8], [side < 0 ? 'port' : 'stbd']: [0.5] }, lamps: { kind: 'chandelier', nx: 3, nz: 1, lit: 1, power: 0.8 } });
    const g = shell.group;
    const len = r.x1 - r.x0, w = r.z1 - r.z0;
    // sitting room (forward third), two bedrooms (middle), bath/wardrobe (aft)
    const xs = [r.x1 - len * 0.38, r.x1 - len * 0.66, r.x1 - len * 0.86];
    for (const x of xs) { const part = wall(m, x, r.z0, x, r.z1, 0, r.ceiling, { gaps: [0.5], material: 'whiteEnamel', trim: 'ormolu', doorW: 0.95 }); g.add(part); const d = makeDoor(m, { w: 0.95, h: 2.1, style: 'white', id: `${suiteId}_door_${x.toFixed(0)}` }); d.position.set(x, 0, (r.z0 + r.z1) / 2); d.rotation.y = Math.PI / 2; g.add(d); }
    // sitting room furniture
    const sx = (r.x1 + xs[0]) / 2, sz = (r.z0 + r.z1) / 2;
    const sofa = makeSofa(m, { w: 2.0, color: '#4e7a5c' }); sofa.position.set(sx, 0, sz + side * 1.6); sofa.rotation.y = side < 0 ? Math.PI : 0; g.add(sofa);
    for (const dx of [-1.3, 1.3]) { const c = makeChair(m, { style: 'club' }); c.position.set(sx + dx, 0, sz - side * 1.4); c.rotation.y = side < 0 ? 0 : Math.PI; g.add(c); }
    const t = makeTable(m, { w: 0.9, d: 0.9, style: 'round', top: 'marble' }); t.position.set(sx, 0, sz); g.add(t);
    const fp = makeFireplace(m, { w: 1.6, style: 'marble' }); fp.position.set(r.x1 - 0.3, 0, sz); fp.rotation.y = -Math.PI / 2; g.add(fp); lights.push(fp.userData.light);
    const desk = makeDesk(m, {}); desk.position.set(xs[0] + 1.0, 0, r.z0 + 0.6 + (side < 0 ? 0 : w - 1.2)); desk.rotation.y = side < 0 ? 0 : Math.PI; g.add(desk);
    // the safe (film: where the drawing was kept) — interactable
    const safe = box(m, 0.7, 0.9, 0.6, 'ironDark', { x: xs[0] + 0.6, y: 0.45, z: sz - side * (w / 2 - 0.5), collide: true });
    safe.userData.interactable = { id: 'suite_safe', type: 'use', label: 'The safe', data: null }; g.add(safe);
    interactables.push({ id: 'suite_safe', type: 'use', label: 'The safe', object: safe, data: null });
    // bedrooms
    for (let i = 0; i < 2; i++) {
      const bx = (xs[i] + xs[i + 1]) / 2;
      const bed = makeBed(m, { w: 1.5, l: 2.0, style: i === 0 ? 'brass' : 'wood' }); bed.position.set(bx, 0, sz + side * 1.5); bed.rotation.y = side < 0 ? Math.PI : 0; g.add(bed);
      const wd = makeWardrobe(m, { w: 1.3, h: 2.1, d: 0.6 }); wd.position.set(bx - 1.2, 0, sz - side * (w / 2 - 0.4)); wd.rotation.y = side < 0 ? 0 : Math.PI; g.add(wd);
      const sink = makeSink(m, {}); sink.position.set(bx + 1.3, 0, sz - side * (w / 2 - 0.35)); sink.rotation.y = side < 0 ? 0 : Math.PI; g.add(sink);
      const chair = makeChair(m, { style: 'bentwood' }); chair.position.set(bx + 0.4, 0, sz - side * 0.8); g.add(chair);
    }
    // bathroom
    const tub = makeBathtub(m, {}); tub.position.set((r.x0 + xs[2]) / 2, 0, sz + side * 1.2); tub.rotation.y = Math.PI / 2; g.add(tub);
    const sink2 = makeSink(m, {}); sink2.position.set(r.x0 + 0.5, 0, sz - side * 1.2); sink2.rotation.y = Math.PI / 2; g.add(sink2);
    locations.push(loc(`${suiteId}_sitting_room`, `${r.name.split('—')[0].trim()} sitting room`, r.deck, sx - 1.0, r.y, sz, 0), loc(`${suiteId}_bedroom`, 'Suite bedroom', r.deck, (xs[0] + xs[1]) / 2, r.y, sz, 0));
    flood(r); add(shell);
    if (p) {
      const ps = roomShell(spec, m, ctx, p, { floor: 'teakDeck', walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'oakDark', floorRepeat: 1.2, doors: { [side < 0 ? 'stbd' : 'port']: [0.3, 0.7] }, skip: [side < 0 ? 'port' : 'stbd'], lamps: { kind: 'ceilingGlobe', nx: 4, nz: 1, lit: 1 } });
      const pg = ps.group;
      // half-timbered Tudor beams
      for (let i = 0; i < 6; i++) { const beam = box(m, 0.14, p.ceiling - 0.1, 0.14, 'oakDark', { x: p.x0 + 1 + i * ((p.x1 - p.x0 - 2) / 5), y: (p.ceiling - 0.1) / 2, z: side < 0 ? p.z1 - 0.1 : p.z0 + 0.1, collide: false }); pg.add(beam); }
      for (let i = 0; i < 3; i++) { const c = makeChair(m, { style: 'wicker' }); c.position.set(p.x0 + 2 + i * 4, 0, (p.z0 + p.z1) / 2); c.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2; pg.add(c); }
      const tbl = makeTable(m, { w: 0.7, d: 0.7, style: 'cafe' }); tbl.position.set(p.x0 + 4, 0, (p.z0 + p.z1) / 2 + side * 0.9); pg.add(tbl);
      const palm = makePalm(m, { h: 1.8 }); palm.position.set(p.x1 - 0.8, 0, (p.z0 + p.z1) / 2); pg.add(palm);
      locations.push(loc(`${promId}_deck`, p.name, p.deck, (p.x0 + p.x1) / 2, p.y, (p.z0 + p.z1) / 2, side < 0 ? -Math.PI / 2 : Math.PI / 2));
      flood(p); add(ps);
    }
  }

  // ---------------- Master-at-Arms' office (E deck): desk, chair, the pipe, a bench; the handcuff pipe is interactable
  let r = R('master_at_arms');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whitePaintedSteel', ceiling: 'whitePaintedSteel', panelled: false, floorRepeat: 0.9, doors: { port: [0.5] }, lamps: { kind: 'bulkhead', nx: 2, nz: 1, lit: 1, power: 1.3 } });
    const g = shell.group;
    const desk = makeDesk(m, {}); desk.position.set((r.x0 + r.x1) / 2, 0, r.z0 + 1.2); g.add(desk);
    const chair = makeChair(m, { style: 'bentwood' }); chair.position.set((r.x0 + r.x1) / 2, 0, r.z0 + 2.1); chair.rotation.y = Math.PI; g.add(chair);
    const pipe = cyl(m, 0.07, 0.07, r.z1 - r.z0 - 0.4, 'steelGrey', { x: r.x1 - 0.25, y: 1.1, z: (r.z0 + r.z1) / 2, rx: Math.PI / 2 }, 10);
    pipe.userData.interactable = { id: 'handcuff_pipe', type: 'use', label: 'The pipe', data: null }; g.add(pipe);
    interactables.push({ id: 'handcuff_pipe', type: 'use', label: 'The pipe', object: pipe, data: null });
    const bench = makeBench(m, { length: 1.6, style: 'third' }); bench.position.set(r.x0 + 1.0, 0, r.z1 - 0.5); bench.rotation.y = Math.PI; g.add(bench);
    const safe = box(m, 0.6, 0.8, 0.5, 'ironDark', { x: r.x0 + 0.5, y: 0.4, z: r.z0 + 0.5, collide: true }); g.add(safe);
    // fire axe in a glass case in the corridor outside (the rescue)
    const axeCase = box(m, 0.08, 0.6, 0.35, m.clone('glass', { transparent: true, opacity: 0.4 }), { x: r.x0 - 0.1, y: 1.5, z: r.z0 - 1.5, collide: false });
    axeCase.userData.interactable = { id: 'fire_axe', type: 'item', label: 'Fire axe', data: null }; g.add(axeCase);
    interactables.push({ id: 'fire_axe', type: 'item', label: 'Fire axe', object: axeCase, data: null });
    locations.push(loc('master_at_arms_desk', "Master-at-Arms' office", r.deck, (r.x0 + r.x1) / 2, r.y, (r.z0 + r.z1) / 2, Math.PI / 2));
    flood(r); add(shell);
  }

  // ---------------- third-class gates: iron gates in the aft cross passage and at the forward third-class stairs
  for (const [id, roomId, side] of [['gate_aft_cross', 'cross_passage_aft', 'port'], ['gate_fwd_open_space', 'open_space_3rd', 'stbd']]) {
    const rr = R(roomId);
    if (!rr) continue;
    const gate = makeDoor(m, { w: 1.2, h: 2.2, style: 'gate', id, double: true, open: false });
    gate.position.set((rr.x0 + rr.x1) / 2, rr.y, side === 'port' ? rr.z0 + 2.0 : rr.z1 - 2.0); gate.rotation.y = Math.PI / 2;
    group.add(gate);
    interactables.push({ id, type: 'gate', label: 'Iron gate', object: gate, data: gate.userData.door });
  }

  // ---------------- Marconi room, wheelhouse/chart room, captain's quarters, officers' mess (Boat Deck interiors)
  r = R('marconi_room');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whiteEnamel', ceiling: 'whitePaintedSteel', panelled: false, floorRepeat: 0.9, doors: { port: [0.5], stbd: [0.5] }, lamps: { kind: 'bulkhead', nx: 3, nz: 1, lit: 1, power: 1.2 } });
    const g = shell.group;
    const desk = makeDesk(m, {}); desk.position.set((r.x0 + r.x1) / 2, 0, r.z0 + 0.8); g.add(desk);
    // the Marconi set: tuner box, spark gap, Morse key (brass boxes)
    g.add(box(m, 0.5, 0.3, 0.35, 'mahogany', { x: (r.x0 + r.x1) / 2 - 0.3, y: 0.91, z: r.z0 + 0.7, collide: false }), box(m, 0.12, 0.05, 0.2, 'brass', { x: (r.x0 + r.x1) / 2 + 0.35, y: 0.79, z: r.z0 + 0.9, collide: false }));
    const spark = box(m, 1.0, 1.4, 0.8, 'ironDark', { x: r.x0 + 0.8, y: 0.7, z: r.z0 + 0.6, collide: true }); g.add(spark);
    const chair = makeChair(m, { style: 'bentwood' }); chair.position.set((r.x0 + r.x1) / 2, 0, r.z0 + 1.6); chair.rotation.y = Math.PI; g.add(chair);
    const bed = makeBed(m, { w: 0.9, l: 1.9, style: 'wood' }); bed.position.set(r.x1 - 1.3, 0, r.z1 - 1.2); g.add(bed);
    const key = box(m, 0.4, 0.04, 0.3, 'brass', { x: (r.x0 + r.x1) / 2, y: 0.78, z: r.z0 + 1.0, collide: false }); key.userData.interactable = { id: 'marconi_key', type: 'use', label: 'Morse key', data: null }; g.add(key);
    interactables.push({ id: 'marconi_key', type: 'use', label: 'Morse key', object: key, data: null });
    locations.push(loc('marconi_desk', 'Marconi operating desk', r.deck, (r.x0 + r.x1) / 2, r.y, r.z0 + 1.9, 0));
    add(shell);
  }
  r = R('wheelhouse');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'teakDeck', walls: 'teakVarnished', ceiling: 'whitePaintedSteel', trim: 'teakVarnished', floorRepeat: 1.2, doors: { fwd: [0.5], aft: [0.5], port: [0.5], stbd: [0.5] }, lamps: { kind: 'bulkhead', nx: 1, nz: 1, lit: 0 } });
    const g = shell.group;
    const wheel = makeShipsWheel(m, { d: 1.07 }); wheel.position.set((r.x0 + r.x1) / 2 - 0.5, 0, 0); wheel.rotation.y = Math.PI / 2; g.add(wheel);
    const bin = makeBinnacle(m, {}); bin.position.set(r.x1 - 1.2, 0, 0); g.add(bin);
    const clock = makeClock(m, { w: 0.5, h: 0.6, carved: false }); clock.position.set(r.x0 + 0.1, 1.5, 1.5); clock.rotation.y = Math.PI / 2; g.add(clock);
    locations.push(loc('wheelhouse_wheel', 'At the wheel', r.deck, (r.x0 + r.x1) / 2 - 1.3, r.y, 0, 0));
    add(shell);
  }
  r = R('chart_room');
  if (r) { const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'teakVarnished', ceiling: 'whitePaintedSteel', trim: 'teakVarnished', doors: { fwd: [0.5], stbd: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 1, nz: 1, lit: 1 } }); const g = shell.group; const t = makeTable(m, { w: 2.2, d: 1.2, h: 0.95, style: 'rect', top: 'wood' }); t.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2); g.add(t); for (const dz of [-0.6, 0.6]) { const c = makeClock(m, { w: 0.45, h: 0.55, carved: false }); c.position.set(r.x0 + 0.1, 1.6, (r.z0 + r.z1) / 2 + dz); c.rotation.y = Math.PI / 2; g.add(c); } add(shell); }
  r = R('captains_quarters');
  if (r) { const shell = roomShell(spec, m, ctx, r, { floor: 'carpetRed', walls: 'mahogany', ceiling: 'plasterWhite', trim: 'ormolu', floorRepeat: 2.0, doors: { aft: [0.5], port: [0.3] }, lamps: { kind: 'ceilingGlobe', nx: 2, nz: 1, lit: 1 } }); const g = shell.group; const bed = makeBed(m, { w: 1.2, l: 2.0, style: 'wood' }); bed.position.set(r.x1 - 1.4, 0, r.z1 - 1.3); g.add(bed); const desk = makeDesk(m, {}); desk.position.set(r.x0 + 1.5, 0, r.z0 + 0.6); g.add(desk); const sofa = makeSofa(m, { w: 1.8, color: '#5a2a2a' }); sofa.position.set(r.x0 + 1.5, 0, r.z1 - 0.7); sofa.rotation.y = Math.PI; g.add(sofa); const tub = makeBathtub(m, {}); tub.position.set(r.x1 - 1.2, 0, r.z0 + 0.9); tub.rotation.y = Math.PI / 2; g.add(tub); locations.push(loc('captains_cabin', "Captain's sitting room", r.deck, r.x0 + 2.5, r.y, (r.z0 + r.z1) / 2, 0)); add(shell); }
  r = R('officers_mess');
  if (r) { const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'oakPanel', ceiling: 'plasterWhite', trim: 'oakDark', doors: { aft: [0.5], port: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 1, nz: 1, lit: 1 } }); const g = shell.group; const t = makeTable(m, { w: 1.0, d: 3.0, h: 0.76, style: 'long', top: 'linen' }); t.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2); g.add(t); for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const c = makeChair(m, { style: 'bentwood' }); c.position.set((r.x0 + r.x1) / 2 + s * 0.8, 0, (r.z0 + r.z1) / 2 - 1.1 + k * 0.75); c.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(c); } add(shell); }
  for (const id of ['officers_cabins_port', 'officers_cabins_stbd']) {
    r = R(id); if (!r) continue;
    const g = new THREE.Group(); g.name = `Cabins.${id}`;
    const floor = box(m, r.x1 - r.x0, 0.02, r.z1 - r.z0, tiled(m, 'linoCorridor', 0.9), { x: (r.x0 + r.x1) / 2, y: 0.013, z: (r.z0 + r.z1) / 2, collide: true }); floor.castShadow = false; g.add(floor);
    const inner = id.endsWith('port') ? r.z1 : r.z0;
    cabinBlock(m, g, { x0: r.x0, x1: r.x1, zIn: inner, zOut: id.endsWith('port') ? r.z0 : r.z1, cabinW: 3.0, depthClass: 'second', ceiling: 2.4, bunk: 'wood', wallMat: 'whiteEnamel', nameBase: id, interactables, spec, deckY: r.y });
    g.position.y = r.y; group.add(g);
  }

  // ---------------- crew messes and quarters (simple benches/bunks), the third-class open space
  for (const id of ['seamens_mess', 'firemens_mess', 'maids_valets_saloon']) {
    r = R(id); if (!r || id === 'maids_valets_saloon') continue;
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whitePaintedSteel', ceiling: 'whitePaintedSteel', panelled: false, floorRepeat: 0.9, doors: { aft: [0.5], [id.startsWith('seamens') ? 'stbd' : 'port']: [0.5] }, lamps: { kind: 'bulkhead', nx: 3, nz: 1, lit: 1, power: 1.3 } });
    const g = shell.group;
    for (let i = 0; i < 3; i++) { const t = makeTable(m, { w: 0.9, d: 4.0, h: 0.76, style: 'long' }); t.position.set(r.x0 + 2 + i * 3.5, 0, (r.z0 + r.z1) / 2); g.add(t); for (const s of [-1, 1]) { const b = makeBench(m, { length: 3.8, style: 'third' }); b.position.set(r.x0 + 2 + i * 3.5 + s * 0.75, 0, (r.z0 + r.z1) / 2); b.rotation.y = Math.PI / 2; g.add(b); } }
    add(shell);
  }
  for (const id of ['firemens_quarters_D', 'trimmers_quarters', 'seamens_quarters', 'firemens_quarters_F', 'leading_firemen_G', 'third_class_open_berths_G', 'stewards_F', 'engineers_accommodation']) {
    r = R(id); if (!r) continue;
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whitePaintedSteel', ceiling: 'whitePaintedSteel', panelled: false, floorRepeat: 0.9, doors: { aft: [0.5], fwd: [0.5] }, lamps: { kind: 'bulkhead', nx: Math.max(1, Math.round((r.x1 - r.x0) / 6)), nz: 1, lit: 1, power: 1.2 } });
    const g = shell.group;
    gridPlace(g, () => makeBed(m, { w: 0.8, l: 1.9, style: id.includes('open_berths') || id.includes('firemens') ? 'bunk3' : 'bunk2' }), { x0: r.x0 + 1.2, x1: r.x1 - 1.2, z0: r.z0 + 1.2, z1: r.z1 - 1.2, dx: 2.4, dz: 2.6, yaw: Math.PI / 2, limit: dense ? 24 : 10 });
    flood(r); add(shell);
  }
  r = R('open_space_3rd');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whitePaintedSteel', ceiling: 'whitePaintedSteel', panelled: false, floorRepeat: 0.9, doors: { fwd: [0.5], aft: [0.3, 0.7] }, lamps: { kind: 'bulkhead', nx: 6, nz: 2, lit: 2, power: 1.3 } });
    const g = shell.group;
    for (let i = 0; i < 8; i++) for (const z of [r.z0 + 0.6, r.z1 - 0.6]) { const b = makeBench(m, { length: 1.8, style: 'third' }); b.position.set(r.x0 + 2 + i * ((r.x1 - r.x0 - 4) / 7), 0, z); b.rotation.y = z < 0 ? 0 : Math.PI; g.add(b); }
    for (let i = 0; i < 6; i++) { const c = makeChair(m, { style: 'square' === 'x' ? 'club' : 'stool' }); }
    for (let i = 0; i < 4; i++) for (const z of [-6, 6]) { const col = box(m, 0.25, r.ceiling, 0.25, 'whitePaintedSteel', { x: r.x0 + 4 + i * ((r.x1 - r.x0 - 8) / 3), y: r.ceiling / 2, z, collide: true }); g.add(col); }
    locations.push(loc('third_class_open_space', 'Third-class open space, D deck', r.deck, (r.x0 + r.x1) / 2, r.y, 0, Math.PI));
    flood(r); add(shell);
  }

  for (const child of [...group.children]) { child.updateMatrixWorld(true); bakeGroup(child); }
  ctx?.log?.(`cabins & corridors: ${group.children.length} groups, ${lights.length} lights, ${interactables.length} interactables`);
  return { group, locations, lights, dynamic: [], interactables, floodRooms };
}
