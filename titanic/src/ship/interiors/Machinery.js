/**
 * Machinery and cargo (ARCHITECTURE.md §5): six boiler rooms with 29 Scotch boilers, furnace glow and coal,
 * the reciprocating engine room with two triple-expansion engines, turbine room, electric engine room with
 * dynamos, watertight bulkheads with doors, the firemen's passage and spiral stairs, cargo holds with crates
 * and the red Renault in No. 2 hold, the mail room, baggage room, stores and shaft tunnels.
 */
import * as THREE from 'three';
import { findRoom, roomShell, gridPlace, bakeGroup, tiled, wall } from './RoomKit.js';
import { makeBoiler, makeEngineCylinder, makeGauge, makeValveWheel, makeTelegraph, makeCrate, makeBarrel, makeSack, makeTrunk, makeCar, makeDoor, makeStairs, makeRailing, makeLamp, makeBookcase, makeDesk, box, cyl } from '../Props.js';

function loc(id, name, deck, x, y, z, yaw = Math.PI) { return { id, name, deck, x, y, z, yaw }; }

export function buildMachinery(spec, m, ctx) {
  const group = new THREE.Group();
  group.name = 'Machinery';
  const lights = [], locations = [], interactables = [], floodRooms = [], dynamic = [];
  const q = ctx?.quality || 'high';
  const dense = q === 'high' || q === 'ultra';
  const R = (id) => findRoom(spec, id);
  const add = (shell) => { group.add(shell.group); lights.push(...shell.lights); };
  const flood = (r) => floodRooms.push({ deck: r.deck, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 });
  const mach = spec.machinery || {};

  // ---------------- boiler rooms (tank top): boilers abreast, stokehold floors, bunker walls, gratings, fidley ladders
  for (const br of mach.boilerRooms || []) {
    const r = R(`boiler_room_${br.n}`);
    if (!r) continue;
    const h = Math.min(r.ceiling || 9.7, 9.7);
    const shell = roomShell(spec, m, ctx, { ...r, ceiling: h }, { floor: 'steelGrey', walls: 'steelRusty', ceiling: 'steelGrey', trim: 'steelRusty', panelled: false, floorRepeat: 2.0,
      doors: { fwd: [0.5], aft: [0.5] }, lamps: { kind: 'bulkhead', nx: 3, nz: 3, lit: 2, power: 1.3 }, plaque: true });
    const g = shell.group;
    const count = br.doubleEnded || br.singleEnded;
    const cx = (r.x0 + r.x1) / 2;
    for (const z of br.boilerZ || []) {
      const b = makeBoiler(m, { diameter: br.boilerDiameter || 4.8, length: br.boilerLength || 6.1, doubleEnded: !!br.doubleEnded });
      b.rotation.y = Math.PI / 2;                  // axis along x (fore-and-aft)
      b.position.set(cx, 0, z);
      g.add(b);
      if (b.userData.light && lights.length < 90) lights.push(b.userData.light);
    }
    // stokehold gratings, coal heaps, gauges on the forward bulkhead, ash ejector
    for (const x of [r.x0 + 1.5, r.x1 - 1.5]) {
      for (let i = 0; i < 3; i++) { const heap = box(m, 1.6, 0.6, 1.4, 'coal', { x, y: 0.3, z: -8 + i * 8, collide: false }); heap.scale.y = 0.6 + 0.3 * (i % 2); g.add(heap); }
    }
    for (let i = 0; i < 4; i++) { const gauge = makeGauge(m, { d: 0.35 }); gauge.position.set(r.x1 - 0.2, 1.6 + i * 0.5, -3 + i * 2); gauge.rotation.y = -Math.PI / 2; g.add(gauge); }
    for (let i = 0; i < 3; i++) { const vw = makeValveWheel(m, { d: 0.45 }); vw.position.set(r.x0 + 0.5, 1.2, 4 + i * 1.5); g.add(vw); }
    // uptake trunk at the room's centre rising into the casing above
    const uptake = box(m, 3.0, h, 4.0, 'boilerIron', { x: cx, y: h / 2 + (br.boilerDiameter || 4.8) + 0.8, z: 0, collide: true }); uptake.position.y = h / 2 + 3.2; g.add(uptake);
    // fidley ladder up the forward bulkhead
    const ladder = makeStairs(m, { width: 0.7, rise: 0.3, run: 0.08, steps: Math.round(h / 0.3), style: 'ladder', rails: false });
    ladder.position.set(r.x1 - 0.6, 0, -11); g.add(ladder);
    locations.push(loc(`boiler_room_${br.n}_stokehold`, `Boiler Room No. ${br.n}, forward stokehold`, 'tankTop', r.x1 - 3.5, r.y, 0, 0));
    flood(r); add(shell);
  }

  // ---------------- reciprocating engine room: two engines (four cylinders each on columns), starting platform
  let r = R('engine_room');
  if (r) {
    const h = Math.min(r.ceiling || 14, 14);
    const shell = roomShell(spec, m, ctx, { ...r, ceiling: h }, { floor: 'steelGrey', walls: 'whitePaintedSteel', ceiling: 'steelGrey', trim: 'steelGrey', panelled: false, floorRepeat: 2.0, doors: { fwd: [0.5], aft: [0.5] }, lamps: { kind: 'bulkhead', nx: 4, nz: 3, lit: 2, power: 1.4 } });
    const g = shell.group;
    const eng = mach.reciprocatingEngineRoom?.engines || [{ z: 7 }, { z: -7 }];
    for (const e of eng) {
      const cyls = e.cylinders || [1.372, 2.134, 2.464, 2.464];
      const spacing = 4.2;
      cyls.forEach((d, i) => {
        const c = makeEngineCylinder(m, { d, h: 3.2 });
        c.position.set(r.x1 - 3 - i * spacing, 0, e.z); g.add(c);
      });
      // bedplate, crankshaft and columns
      g.add(box(m, cyls.length * spacing + 1, 1.2, 4.5, 'steelGrey', { x: r.x1 - 3 - (cyls.length - 1) * spacing / 2, y: 0.6, z: e.z, collide: true }));
      const crank = cyl(m, 0.35, 0.35, cyls.length * spacing, 'steelGrey', { x: r.x1 - 3 - (cyls.length - 1) * spacing / 2, y: 1.6, z: e.z, rz: Math.PI / 2 }, 12); g.add(crank);
      // starting platform with telegraphs and gauges
      const plat = box(m, 3.0, 0.12, 2.4, 'steelGrey', { x: r.x1 - 1.5, y: 3.0, z: e.z, collide: true }); g.add(plat);
      const stairs = makeStairs(m, { width: 0.9, rise: 0.25, run: 0.26, steps: 12, style: 'steel', rails: true }); stairs.position.set(r.x1 - 1.5, 0, e.z + 1.2 + 3.1); stairs.rotation.y = 0; g.add(stairs);
      const tel = makeTelegraph(m, {}); tel.position.set(r.x1 - 1.2, 3.06, e.z - 0.6); g.add(tel);
      for (let i = 0; i < 3; i++) { const gauge = makeGauge(m, { d: 0.3 }); gauge.position.set(r.x1 - 0.2, 3.9 + i * 0.4, e.z + i * 0.5); gauge.rotation.y = -Math.PI / 2; g.add(gauge); }
      const rail = makeRailing(m, { length: 3.0, height: 0.9, balusterPitch: 0.5, style: 'pipe' }); rail.position.set(r.x1 - 1.5, 3.12, e.z - 1.2); g.add(rail);
    }
    // gratings/galleries along the sides at mid height
    for (const z of [r.z0 + 1.0, r.z1 - 1.0]) { const gal = box(m, r.x1 - r.x0 - 2, 0.1, 1.6, 'steelGrey', { x: (r.x0 + r.x1) / 2, y: 6.0, z, collide: true }); g.add(gal); const rail = makeRailing(m, { length: r.x1 - r.x0 - 2, height: 0.9, balusterPitch: 0.6, style: 'pipe' }); rail.position.set((r.x0 + r.x1) / 2, 6.1, z + (z < 0 ? 0.8 : -0.8)); g.add(rail); }
    locations.push(loc('engine_room_platform', 'Engine room starting platform', 'tankTop', r.x1 - 2.2, r.y + 3.12, 7, Math.PI));
    flood(r); add(shell);
  }

  // ---------------- turbine room: the Parsons turbine casing on the centre shaft, condensers
  r = R('turbine_room');
  if (r) {
    const h = Math.min(r.ceiling || 10, 10);
    const shell = roomShell(spec, m, ctx, { ...r, ceiling: h }, { floor: 'steelGrey', walls: 'whitePaintedSteel', ceiling: 'steelGrey', panelled: false, floorRepeat: 2.0, doors: { fwd: [0.5], aft: [0.5] }, lamps: { kind: 'bulkhead', nx: 3, nz: 2, lit: 1, power: 1.3 } });
    const g = shell.group;
    const t = mach.turbineRoom?.turbine || { diameter: 3.86, length: 7.0, z: 0 };
    const casing = cyl(m, t.diameter / 2, t.diameter / 2, t.length, 'steelGrey', { x: (r.x0 + r.x1) / 2, y: t.diameter / 2 + 0.6, z: t.z || 0, rz: Math.PI / 2, collide: true }, 24); g.add(casing);
    g.add(box(m, t.length + 1, 0.6, t.diameter + 0.6, 'steelGrey', { x: (r.x0 + r.x1) / 2, y: 0.3, z: t.z || 0, collide: true }));
    for (const z of [-7.5, 7.5]) { const cond = cyl(m, 1.6, 1.6, 9, 'boilerIron', { x: (r.x0 + r.x1) / 2, y: 1.6 + 0.4, z, rz: Math.PI / 2, collide: true }, 18); g.add(cond); }
    for (let i = 0; i < 4; i++) { const gauge = makeGauge(m, { d: 0.3 }); gauge.position.set(r.x1 - 0.2, 1.5 + i * 0.4, -2 + i); gauge.rotation.y = -Math.PI / 2; g.add(gauge); }
    locations.push(loc('turbine_room_floor', 'Turbine engine room', 'tankTop', r.x1 - 3, r.y, 4, Math.PI));
    flood(r); add(shell);
  }

  // ---------------- electric engine room: four dynamo sets, switchboard
  r = R('electric_engine_room');
  if (r) {
    const h = Math.min(r.ceiling || 7.3, 7.3);
    const shell = roomShell(spec, m, ctx, { ...r, ceiling: h }, { floor: 'steelGrey', walls: 'whitePaintedSteel', ceiling: 'steelGrey', panelled: false, floorRepeat: 2.0, doors: { fwd: [0.5] }, lamps: { kind: 'bulkhead', nx: 3, nz: 2, lit: 2, power: 1.4 } });
    const g = shell.group;
    for (let i = 0; i < 4; i++) {
      const x = r.x0 + 3 + i * ((r.x1 - r.x0 - 6) / 3);
      const dyn = cyl(m, 1.1, 1.1, 2.6, 'boilerIron', { x, y: 1.1 + 0.3, z: -3, rz: Math.PI / 2, collide: true }, 18); g.add(dyn);
      const eng = makeEngineCylinder(m, { d: 0.6, h: 1.4 }); eng.position.set(x, 0, 2.5); g.add(eng);
      g.add(box(m, 3.2, 0.3, 7, 'steelGrey', { x, y: 0.15, z: 0, collide: true }));
    }
    // switchboard (slate panels with brass instruments) along the forward bulkhead
    const board = box(m, 0.25, 2.6, r.z1 - r.z0 - 4, 'clothBlack', { x: r.x1 - 0.3, y: 1.6, z: 0, collide: true }); g.add(board);
    for (let i = 0; i < 10; i++) { const gauge = makeGauge(m, { d: 0.25 }); gauge.position.set(r.x1 - 0.42, 2.0 + (i % 2) * 0.5, -6 + i * 1.3); gauge.rotation.y = -Math.PI / 2; g.add(gauge); }
    locations.push(loc('dynamo_room', 'Electric engine room', 'tankTop', r.x0 + 2, r.y, 0, 0));
    flood(r); add(shell);
  }

  // ---------------- watertight bulkheads with sliding doors on the tank top (letters D..P)
  for (const b of spec.bulkheads || []) {
    if (!['D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N'].includes(b.letter)) continue;
    const door = makeDoor(m, { w: 1.3, h: 2.2, style: 'wtDoor', id: `wtdoor_tt_${b.letter}`, open: true });
    door.position.set(b.x, ctx.deckY('tankTop') + 0.02, 0); door.rotation.y = Math.PI / 2; group.add(door);
    interactables.push({ id: `wtdoor_tt_${b.letter}`, type: 'door', label: `Watertight door ${b.letter}`, object: door, data: door.userData.door });
  }

  // ---------------- firemen's passage (tunnel) and spiral stairs
  const fp = mach.firemensPassage;
  if (fp) {
    const g = new THREE.Group(); g.name = 'FiremensPassage';
    const len = fp.x1 - fp.x0;
    g.add(box(m, len, 0.05, fp.z1 - fp.z0, 'steelGrey', { x: (fp.x0 + fp.x1) / 2, y: 0.03, z: 0, collide: true }));
    for (const z of [fp.z0, fp.z1]) g.add(box(m, len, fp.height || 2.6, 0.1, 'whitePaintedSteel', { x: (fp.x0 + fp.x1) / 2, y: (fp.height || 2.6) / 2, z, collide: true }));
    g.add(box(m, len, 0.1, fp.z1 - fp.z0, 'steelGrey', { x: (fp.x0 + fp.x1) / 2, y: (fp.height || 2.6) + 0.05, z: 0, collide: false }));
    for (let i = 0; i < Math.floor(len / 6); i++) { const lamp = makeLamp(m, { kind: 'bulkhead', power: 1, light: i % 3 === 0 }); lamp.position.set(fp.x0 + 3 + i * 6, (fp.height || 2.6) - 0.15, 0); g.add(lamp); if (lamp.userData.light) lights.push(lamp.userData.light); }
    for (const z of [-3, 3]) { const sp = makeStairs(m, { width: 1.0, rise: 0.22, run: 0, steps: Math.round((ctx.deckY('D') - ctx.deckY('tankTop')) / 0.22), style: 'spiral' }); sp.position.set(fp.x1 + 2, 0, z); g.add(sp); }
    g.position.y = fp.y ?? ctx.deckY('tankTop');
    group.add(g);
    locations.push(loc('firemens_passage', "Firemen's passage", 'tankTop', fp.x0 + 5, g.position.y, 0, 0));
  }

  // ---------------- cargo holds (lower and 'tween decks), the Renault, mail room, baggage, stores
  const holdRooms = ['hold1', 'hold2', 'hold3', 'hold1_tween', 'hold2_tween', 'mail_room', 'baggage_room_orlop', 'baggage_room_G', 'post_office', 'stores_G', 'engineers_stores_G', 'refrigerated_cargo', 'hold6_tween', 'stores_F_aft', 'stores_G_aft', 'bunkers_G_port', 'bunkers_G_stbd', 'switchboard_gallery', 'shaft_tunnels'];
  for (const id of holdRooms) {
    r = R(id); if (!r) continue;
    const isBunker = id.startsWith('bunkers');
    const isTunnel = id === 'shaft_tunnels';
    const h = Math.min(r.ceiling || 2.4, isTunnel ? 3 : 4.4);
    const shell = roomShell(spec, m, ctx, { ...r, ceiling: h }, { floor: isBunker ? 'coal' : 'steelRusty', walls: isBunker ? 'steelRusty' : 'steelRusty', ceiling: 'steelGrey', panelled: false, floorRepeat: 2.0, doors: { fwd: [0.5], aft: [0.5] }, lamps: { kind: 'bulkhead', nx: Math.max(1, Math.round((r.x1 - r.x0) / 7)), nz: 1, lit: 1, power: 1.0 }, plaque: !isBunker });
    const g = shell.group;
    if (isTunnel) {
      for (const z of (mach.shaftTunnels?.shaftZ || [-7, 0, 7])) { const shaft = cyl(m, 0.33, 0.33, r.x1 - r.x0, 'steelGrey', { x: (r.x0 + r.x1) / 2, y: 0.9, z, rz: Math.PI / 2 }, 12); g.add(shaft); for (let i = 0; i < 4; i++) g.add(box(m, 0.8, 1.0, 1.0, 'boilerIron', { x: r.x0 + 3 + i * ((r.x1 - r.x0 - 6) / 3), y: 0.5, z, collide: true })); }
    } else if (isBunker) {
      gridPlace(g, () => { const heap = box(m, 2.6, 1.4, 2.2, 'coal', { y: 0.7, collide: true }); return heap; }, { x0: r.x0 + 2, x1: r.x1 - 2, z0: r.z0 + 1, z1: r.z1 - 1, dx: 4.5, dz: 3.2, jitter: 0.6, limit: dense ? 30 : 12 });
    } else if (id === 'mail_room' || id === 'post_office') {
      gridPlace(g, () => makeSack(m, {}), { x0: r.x0 + 1, x1: r.x1 - 1, z0: r.z0 + 1, z1: r.z1 - 1, dx: 1.2, dz: 1.0, jitter: 0.4, limit: dense ? 60 : 25 });
      for (let i = 0; i < 4; i++) { const rack = makeBookcase(m, { w: 2.4, h: 2.0 }); rack.position.set(r.x0 + 0.4, 0, r.z0 + 1.5 + i * 2.8); rack.rotation.y = Math.PI / 2; g.add(rack); }
      if (id === 'post_office') { const d = makeDesk(m, {}); d.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2); g.add(d); }
    } else if (id.startsWith('baggage')) {
      gridPlace(g, (i, j) => (i + j) % 3 === 0 ? makeCrate(m, { w: 1.0, h: 0.9, d: 1.0 }) : makeTrunk(m, {}), { x0: r.x0 + 1, x1: r.x1 - 1, z0: r.z0 + 1, z1: r.z1 - 1, dx: 1.4, dz: 1.2, jitter: 0.3, limit: dense ? 60 : 24 });
    } else {
      gridPlace(g, (i, j) => (i * 3 + j) % 4 === 0 ? makeBarrel(m, {}) : makeCrate(m, { w: 1.0 + (j % 2) * 0.4, h: 0.9 + (i % 2) * 0.5, d: 1.0 }), { x0: r.x0 + 1.2, x1: r.x1 - 1.2, z0: r.z0 + 1.2, z1: r.z1 - 1.2, dx: 1.8, dz: 1.6, jitter: 0.3, skip: (x, z) => id === 'hold2_tween' && Math.abs(x - (spec.cargo?.renaultCar?.x ?? 0)) < 3.5 && z < 0, limit: dense ? 50 : 20 });
      if (id === 'hold2_tween' && spec.cargo?.renaultCar) {
        const car = makeCar(m, {});
        const rc = spec.cargo.renaultCar;
        car.position.set(rc.x, 0, rc.z); car.rotation.y = rc.yaw || 0;
        car.traverse((o) => { if (o.isMesh) o.userData.interactable = { id: 'renault', type: 'item', label: 'The Renault', data: { keep: true } }; });
        g.add(car);
        interactables.push({ id: 'renault', type: 'item', label: 'The Renault', object: car, data: { keep: true } });
        const lamp = makeLamp(m, { kind: 'bulkhead', power: 1.2, light: true }); lamp.position.set(rc.x + 2, h - 0.15, rc.z); g.add(lamp); lights.push(lamp.userData.light);
        locations.push(loc('renault_car', 'The Renault in No. 2 hold', r.deck, rc.x + 3.5, r.y, rc.z, Math.PI));
      }
    }
    flood(r); add(shell);
  }

  for (const child of [...group.children]) { if (child.isGroup) { child.updateMatrixWorld(true); bakeGroup(child); } }
  ctx?.log?.(`machinery: ${group.children.length} groups, ${lights.length} lights`);
  return { group, locations, lights, dynamic, interactables, floodRooms };
}
