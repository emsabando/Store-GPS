/**
 * Public rooms B (ARCHITECTURE.md §5): First-Class Reception Room and Dining Saloon (D deck), Second-Class Dining
 * Saloon, Third-Class General Room, Smoking Room and Dining Saloons, Swimming Bath, Turkish Baths, Squash Court,
 * Barber shop, Purser's office, Hospital, the D-deck entrance hall.
 */
import * as THREE from 'three';
import { findRoom, roomShell, gridPlace, tableCluster, bakeGroup, tiled } from './RoomKit.js';
import { makeChair, makeTable, makeSofa, makeColumn, makeLamp, makePiano, makeBench, makeDesk, makeBookcase, makeSink, makeBed, makeDoor, makeStairs, makeRailing, box, cyl } from '../Props.js';

function roomLocation(room, dx = 0, yaw = Math.PI) {
  return { id: `room_${room.id}`, name: room.name, deck: room.deck, x: (room.x0 + room.x1) / 2 + dx, y: room.y, z: (room.z0 + room.z1) / 2, yaw };
}

export function buildPublicRoomsB(spec, m, ctx) {
  const group = new THREE.Group();
  group.name = 'PublicRoomsB';
  const lights = [], locations = [], interactables = [], dynamic = [], floodRooms = [];
  const q = ctx?.quality || 'high';
  const dense = q === 'high' || q === 'ultra';
  const add = (shell) => { group.add(shell.group); lights.push(...shell.lights); };
  const R = (id) => findRoom(spec, id);
  const flood = (r) => floodRooms.push({ deck: r.deck, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 });

  // ---------------- First-Class Reception Room (D deck): Jacobean white, Axminster, wicker, Chesterfields, orchestra
  let r = R('reception_room');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'carpetRed', walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'ormolu', floorRepeat: 2.5,
      doors: { fwd: [0.35, 0.65], aft: [0.3, 0.7] }, lamps: { kind: 'chandelier', nx: 3, nz: 3, lit: 2, power: 1.0 } });
    const g = shell.group;
    gridPlace(g, (i, j) => tableCluster(m, makeTable, makeChair, { tableOpts: { w: 0.7, d: 0.7, style: 'cafe' }, chairOpts: { style: 'wicker' }, seats: 3, radius: 0.75 }), { x0: r.x0 + 2.5, x1: r.x1 - 2.5, z0: r.z0 + 2.5, z1: r.z1 - 2.5, dx: 3.6, dz: 3.4, jitter: 0.3, skip: (x, z) => Math.abs(z) < 2.0, limit: dense ? 20 : 10 });
    for (const z of [r.z0 + 1.0, r.z1 - 1.0]) for (let i = 0; i < 4; i++) { const s = makeSofa(m, { w: 2.2, color: '#4e7a5c' }); s.position.set(r.x0 + 2.5 + i * 3.6, 0, z); s.rotation.y = z < 0 ? 0 : Math.PI; g.add(s); }
    for (const x of [r.x0 + 4, r.x0 + 9, r.x1 - 4]) for (const z of [-6.5, -2.2, 2.2, 6.5]) { const c = makeColumn(m, { h: r.ceiling, style: 'ionic', r: 0.22 }); c.position.set(x, 0, z); g.add(c); }
    // orchestra: grand piano on a dais by the forward wall (where the staircase lands)
    const dais = box(m, 4.0, 0.15, 3.5, 'oakPanel', { x: r.x1 - 2.6, y: 0.075, z: r.z1 - 3.0, collide: true }); g.add(dais);
    const piano = makePiano(m, { grand: true }); piano.position.set(r.x1 - 2.6, 0.15, r.z1 - 3.0); piano.rotation.y = -0.8; g.add(piano);
    for (let i = 0; i < 4; i++) { const c = makeChair(m, { style: 'bentwood' }); c.position.set(r.x1 - 3.8 + i * 0.7, 0.15, r.z1 - 1.6); c.rotation.y = Math.PI * 0.75; g.add(c); }
    locations.push(roomLocation(r), { id: 'band_reception', name: 'The orchestra dais', deck: r.deck, x: r.x1 - 3.5, y: r.y + 0.15, z: r.z1 - 2.6, yaw: Math.PI * 0.75 }); flood(r); add(shell);
  }

  // ---------------- First-Class Dining Saloon (D deck): Jacobean white, leaded bays, oak chairs in green leather
  r = R('dining_saloon');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoDining', walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'whiteEnamel', floorRepeat: 1.2,
      doors: { fwd: [0.3, 0.7], aft: [0.3, 0.7] }, lamps: { kind: 'ceilingGlobe', nx: 8, nz: 4, lit: 3, power: 1.1 } });
    const g = shell.group;
    // two longitudinal aisles at z = ±4.5; tables in three bands
    const bands = [[r.z0 + 1.6, -5.4], [-3.4, 3.4], [5.4, r.z1 - 1.6]];
    let count = 0;
    const limit = dense ? 60 : 28;
    for (const [z0, z1] of bands) {
      gridPlace(g, (i, j) => { if (count >= limit) return null; count++; const seats = (i % 3 === 0) ? 6 : 4; return tableCluster(m, makeTable, makeChair, { tableOpts: { w: seats > 4 ? 2.0 : 1.4, d: 1.0, style: 'rect', top: 'linen' }, chairOpts: { style: 'dining' }, seats, radius: 0.95 }); },
        { x0: r.x0 + 2.5, x1: r.x1 - 2.5, z0, z1, dx: 3.6, dz: 3.0, limit });
    }
    for (let i = 0; i < 8; i++) for (const z of [-4.5, 4.5]) { const c = makeColumn(m, { h: r.ceiling, style: 'square', r: 0.22 }); c.position.set(r.x0 + 2.0 + i * ((r.x1 - r.x0 - 4) / 7), 0, z); g.add(c); }
    // recessed bays with leaded windows along the sides: alcove partitions
    for (let i = 0; i < 6; i++) for (const z of [r.z0 + 0.9, r.z1 - 0.9]) { const p = box(m, 0.12, r.ceiling - 0.2, 1.8, 'whiteEnamel', { x: r.x0 + 4 + i * ((r.x1 - r.x0 - 8) / 5), y: (r.ceiling - 0.2) / 2, z, collide: true }); g.add(p); }
    locations.push(roomLocation(r), { id: 'dining_saloon_head_table', name: "Captain's table", deck: r.deck, x: (r.x0 + r.x1) / 2, y: r.y, z: 0, yaw: Math.PI / 2 }); flood(r); add(shell);
  }

  // ---------------- D-deck entrance hall (gangway doors)
  r = R('entrance_D_fwd');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoDining', walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'ormolu', floorRepeat: 1.0, doors: { fwd: [0.5], aft: [0.3, 0.7], port: [0.4, 0.6], stbd: [0.4, 0.6] }, lamps: { kind: 'chandelier', nx: 1, nz: 1, lit: 1 } });
    const g = shell.group;
    for (const s of [-1, 1]) for (const dx of [-1.2, 1.2]) { const d = makeDoor(m, { w: 1.2, h: 2.2, style: 'steel', id: `gangway_D_${s > 0 ? 'stbd' : 'port'}_${dx > 0 ? 'a' : 'f'}`, double: false }); d.position.set((r.x0 + r.x1) / 2 + dx, 0, s > 0 ? r.z1 - 0.1 : r.z0 + 0.1); d.rotation.y = s > 0 ? Math.PI : 0; g.add(d); }
    for (let i = 0; i < 3; i++) { const b = makeBench(m, { length: 1.8, style: 'deck' }); b.position.set(r.x0 + 2 + i * 2.5, 0, 0); b.rotation.y = Math.PI / 2; g.add(b); }
    locations.push(roomLocation(r, 0, Math.PI / 2)); flood(r); add(shell);
  }

  // ---------------- Second-Class Dining Saloon (D deck): oak, long tables, red leather swivel chairs, piano
  r = R('dining_saloon_2nd');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoDining', walls: 'oakPanel', ceiling: 'plasterWhite', trim: 'oakDark', floorRepeat: 1.0, doors: { fwd: [0.5], aft: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 5, nz: 3, lit: 2 } });
    const g = shell.group;
    const rows = dense ? 7 : 4;
    for (let i = 0; i < rows; i++) {
      const x = r.x0 + 2.5 + i * ((r.x1 - r.x0 - 5) / (rows - 1));
      for (const [z0, z1] of [[r.z0 + 1.5, -1.0], [1.0, r.z1 - 1.5]]) {
        const len = z1 - z0;
        const t = makeTable(m, { w: 1.0, d: len, h: 0.76, style: 'long', top: 'linen' }); t.position.set(x, 0, (z0 + z1) / 2); g.add(t);
        const n = Math.floor(len / 0.75);
        for (let k = 0; k < n; k++) for (const s of [-1, 1]) { const c = makeChair(m, { style: 'stool' }); c.position.set(x + s * 0.8, 0, z0 + 0.4 + k * 0.75); c.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(c); }
      }
    }
    const piano = makePiano(m, { grand: false }); piano.position.set(r.x1 - 1.0, 0, 0); piano.rotation.y = -Math.PI / 2; g.add(piano);
    locations.push(roomLocation(r)); flood(r); add(shell);
  }

  // ---------------- Third-Class General Room (C deck, starboard) — the steerage party; Smoking Room (port)
  r = R('general_room_3rd');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whiteEnamel', ceiling: 'whitePaintedSteel', trim: 'oakDark', floorRepeat: 0.9, doors: { fwd: [0.5], port: [0.5] }, lamps: { kind: 'bulkhead', nx: 3, nz: 2, lit: 2, power: 1.4 } });
    const g = shell.group;
    for (let i = 0; i < 4; i++) { const b = makeBench(m, { length: 1.8, style: 'third' }); b.position.set(r.x0 + 1.5 + i * 2.4, 0, r.z1 - 0.5); b.rotation.y = Math.PI; g.add(b); }
    for (let i = 0; i < 3; i++) { const b = makeBench(m, { length: 1.8, style: 'third' }); b.position.set(r.x0 + 0.5, 0, r.z0 + 1.8 + i * 2.4); b.rotation.y = Math.PI / 2; g.add(b); }
    gridPlace(g, () => { const t = new THREE.Group(); t.add(makeTable(m, { w: 1.4, d: 0.8, style: 'rect' })); for (const dz of [-0.75, 0.75]) { const b = makeBench(m, { length: 1.4, style: 'third' }); b.position.set(0, 0, dz); b.rotation.y = dz > 0 ? Math.PI : 0; t.add(b); } return t; }, { x0: r.x0 + 2.5, x1: r.x1 - 2.5, z0: r.z0 + 2.5, z1: r.z1 - 2.5, dx: 3.2, dz: 3.0, limit: 6 });
    const piano = makePiano(m, { grand: false }); piano.position.set(r.x1 - 0.9, 0, (r.z0 + r.z1) / 2); piano.rotation.y = -Math.PI / 2; g.add(piano);
    // a clear dance floor in the middle: bump the centre cluster out by skipping (handled by limit/dx); add a makeshift stage crate
    locations.push(roomLocation(r), { id: 'steerage_dance_floor', name: 'Steerage dance floor', deck: r.deck, x: (r.x0 + r.x1) / 2, y: r.y, z: (r.z0 + r.z1) / 2, yaw: Math.PI }); flood(r); add(shell);
  }
  r = R('smoking_room_3rd');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whiteEnamel', ceiling: 'whitePaintedSteel', trim: 'oakDark', floorRepeat: 0.9, doors: { fwd: [0.5], stbd: [0.5] }, lamps: { kind: 'bulkhead', nx: 3, nz: 2, lit: 1, power: 1.4 } });
    const g = shell.group;
    gridPlace(g, () => { const t = new THREE.Group(); t.add(makeTable(m, { w: 1.2, d: 0.7, style: 'rect' })); for (const dz of [-0.7, 0.7]) { const b = makeBench(m, { length: 1.2, style: 'third' }); b.position.set(0, 0, dz); b.rotation.y = dz > 0 ? Math.PI : 0; t.add(b); } return t; }, { x0: r.x0 + 2, x1: r.x1 - 2, z0: r.z0 + 2, z1: r.z1 - 2, dx: 3.0, dz: 2.8, limit: 6 });
    const bar = makeTable(m, { w: 2.6, d: 0.7, h: 1.05, style: 'rect', top: 'wood' }); bar.position.set(r.x1 - 1.2, 0, r.z0 + 1.0); g.add(bar);
    locations.push(roomLocation(r)); flood(r); add(shell);
  }

  // ---------------- Third-Class Dining Saloons (F deck): white steel, long tables with swivel chairs, posters
  for (const id of ['dining_saloon_3rd_fwd', 'dining_saloon_3rd_aft']) {
    r = R(id);
    if (!r) continue;
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whitePaintedSteel', ceiling: 'whitePaintedSteel', trim: 'whitePaintedSteel', panelled: false, floorRepeat: 0.9, doors: { fwd: [0.25, 0.75], aft: [0.25, 0.75] }, lamps: { kind: 'bulkhead', nx: 5, nz: 3, lit: 2, power: 1.4 } });
    const g = shell.group;
    const rows = dense ? 5 : 3;
    for (let i = 0; i < rows; i++) {
      const x = r.x0 + 2.5 + i * ((r.x1 - r.x0 - 5) / (rows - 1));
      for (const [z0, z1] of [[r.z0 + 1.2, -5.8], [5.8, r.z1 - 1.2]]) {
        const len = z1 - z0;
        const t = makeTable(m, { w: 0.9, d: len, h: 0.76, style: 'long', top: 'wood' }); t.position.set(x, 0, (z0 + z1) / 2); g.add(t);
        const n = Math.floor(len / 0.7);
        for (let k = 0; k < n; k++) for (const s of [-1, 1]) { const c = makeChair(m, { style: 'stool' }); c.position.set(x + s * 0.75, 0, z0 + 0.35 + k * 0.7); g.add(c); }
      }
    }
    // framed White Star posters
    for (let i = 0; i < 4; i++) { const p = box(m, 0.04, 0.9, 0.6, m.clone('clothBurgundy'), { x: r.x0 + 0.1, y: 1.6, z: r.z0 + 2 + i * ((r.z1 - r.z0 - 4) / 3), collide: false }); g.add(p); }
    locations.push(roomLocation(r)); flood(r); add(shell);
  }

  // ---------------- Swimming Bath (F deck, starboard): tiled pool with steps, cubicles, marble
  r = R('swimming_bath');
  if (r) {
    const tile = tiled(m, 'moorishTile', 0.3, 0.3, { color: new THREE.Color(0xf2f2ee) });
    const shell = roomShell(spec, m, ctx, r, { floorMat: tile, walls: 'whiteEnamel', ceiling: 'whitePaintedSteel', trim: 'teakVarnished', floorRepeat: 0.3, doors: { aft: [0.3], port: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 4, nz: 2, lit: 2 } });
    const g = shell.group;
    // pool basin (the F plate has the hole): walls down to G, water surface 0.4 m below the deck
    const px0 = r.x0 + (r.x1 - r.x0 - 9.14) / 2, px1 = px0 + 9.14, pz0 = 4.5, pz1 = 8.8;
    const depth = 2.0;
    const poolTile = tiled(m, 'moorishTile', 0.3, 0.3, { color: new THREE.Color(0x1e3f7a) });
    g.add(box(m, px1 - px0, 0.1, pz1 - pz0, poolTile, { x: (px0 + px1) / 2, y: -depth, z: (pz0 + pz1) / 2, collide: true }));
    g.add(box(m, 0.1, depth, pz1 - pz0, poolTile, { x: px0, y: -depth / 2, z: (pz0 + pz1) / 2, collide: true }), box(m, 0.1, depth, pz1 - pz0, poolTile, { x: px1, y: -depth / 2, z: (pz0 + pz1) / 2, collide: true }));
    g.add(box(m, px1 - px0, depth, 0.1, poolTile, { x: (px0 + px1) / 2, y: -depth / 2, z: pz0, collide: true }), box(m, px1 - px0, depth, 0.1, poolTile, { x: (px0 + px1) / 2, y: -depth / 2, z: pz1, collide: true }));
    const water = box(m, px1 - px0 - 0.1, 0.02, pz1 - pz0 - 0.1, m.clone('glass', { color: new THREE.Color(0x3a8fb8), transparent: true, opacity: 0.6, roughness: 0.05}), { x: (px0 + px1) / 2, y: -0.45, z: (pz0 + pz1) / 2, collide: false });
    water.castShadow = false; g.add(water);
    const steps = makeStairs(m, { width: 1.2, rise: 0.2, run: 0.3, steps: 7, style: 'steel', rails: true }); steps.position.set(px0 + 0.8, -depth + 0.1, pz1 - 0.3); steps.rotation.y = Math.PI; g.add(steps);
    for (const z of [pz0 - 0.1, pz1 + 0.1]) { const rail = makeRailing(m, { length: px1 - px0, height: 0.9, balusterPitch: 0.5, style: 'pipe' }); rail.position.set((px0 + px1) / 2, 0.02, z); g.add(rail); }
    // changing cubicles along the port wall
    for (let i = 0; i < 8; i++) { const d = makeDoor(m, { w: 0.7, h: 2.0, style: 'oak', id: `cubicle_${i}` }); d.position.set(r.x0 + 1.0 + i * 1.0, 0, r.z0 + 1.2); g.add(d); const wll = box(m, 0.05, 2.1, 1.2, 'teakVarnished', { x: r.x0 + 1.5 + i * 1.0, y: 1.05, z: r.z0 + 0.6, collide: true }); g.add(wll); }
    locations.push(roomLocation(r, 0, -Math.PI / 2), { id: 'pool_edge', name: 'Swimming bath edge', deck: r.deck, x: px0 - 1.0, y: r.y, z: (pz0 + pz1) / 2, yaw: 0 }); flood(r); add(shell);
  }

  // ---------------- Turkish Baths cooling room (F deck): Moorish tiles, teak, gilded beams, bronze lanterns
  r = R('turkish_bath');
  if (r) {
    const blue = tiled(m, 'moorishTile', 0.4, 0.4);
    const shell = roomShell(spec, m, ctx, r, { floorMat: blue, walls: 'moorishTile', ceiling: 'plasterWhite', trim: 'teakVarnished', floorRepeat: 0.4, doors: { port: [0.3], aft: [0.5] }, lamps: { kind: 'candelabra', nx: 1, nz: 1, lit: 1 } });
    const g = shell.group;
    // crimson ceiling with gilt beams
    g.add(box(m, r.x1 - r.x0, 0.04, r.z1 - r.z0, m.clone('clothBurgundy', { color: new THREE.Color(0x7a2e2c) }), { x: (r.x0 + r.x1) / 2, y: r.ceiling - 0.03, z: (r.z0 + r.z1) / 2, collide: false }));
    for (let i = 0; i < 5; i++) g.add(box(m, 0.2, 0.2, r.z1 - r.z0, 'ormolu', { x: r.x0 + 1 + i * ((r.x1 - r.x0 - 2) / 4), y: r.ceiling - 0.15, z: (r.z0 + r.z1) / 2, collide: false }));
    for (let i = 0; i < 6; i++) { const couch = makeSofa(m, { w: 2.0, color: '#d8cfb8' }); couch.position.set(r.x0 + 1.6 + (i % 3) * 3.2, 0, i < 3 ? r.z0 + 1.2 : r.z1 - 1.2); couch.rotation.y = i < 3 ? 0 : Math.PI; g.add(couch); }
    for (const [x, z] of [[r.x0 + 2, 0], [r.x1 - 2, 0]]) { const c = makeColumn(m, { h: r.ceiling, style: 'oak', r: 0.18 }); c.traverse((o) => { if (o.isMesh) o.material = m.get('teakVarnished'); }); c.position.set(x, 0, z); g.add(c); }
    for (let i = 0; i < 4; i++) { const lamp = makeLamp(m, { kind: 'chandelier', power: 0.6, light: i === 0 }); lamp.position.set(r.x0 + 2 + i * ((r.x1 - r.x0 - 4) / 3), r.ceiling - 0.3, (r.z0 + r.z1) / 2); lamp.traverse((o) => { if (o.isMesh && o.material && o.material.name !== 'glassFrosted') {} }); g.add(lamp); if (lamp.userData.light) lights.push(lamp.userData.light); }
    const fountain = cyl(m, 0.5, 0.6, 0.9, 'marbleWhite', { x: (r.x0 + r.x1) / 2, y: 0.45, z: (r.z0 + r.z1) / 2, collide: true }, 16); g.add(fountain);
    locations.push(roomLocation(r)); flood(r); add(shell);
  }
  r = R('turkish_bath_hot');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floorMat: tiled(m, 'moorishTile', 0.3, 0.3, { color: new THREE.Color(0xe8e4dc) }), walls: 'whiteEnamel', ceiling: 'whitePaintedSteel', trim: 'teakVarnished', doors: { fwd: [0.3], port: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 2, nz: 2, lit: 1 } });
    const g = shell.group;
    for (let i = 0; i < 4; i++) { const slab = box(m, 2.0, 0.5, 0.8, 'marbleWhite', { x: r.x0 + 1.5 + (i % 2) * 2.6, y: 0.25, z: i < 2 ? r.z0 + 1.0 : r.z1 - 1.0, collide: true }); g.add(slab); } flood(r); add(shell);
  }

  // ---------------- Squash Racquet Court (G deck, two decks high) with the F-level gallery
  r = R('squash_court');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'oakPanel', walls: 'plasterWhite', ceiling: 'whitePaintedSteel', trim: 'plasterWhite', panelled: false, floorRepeat: 1.2, doors: { aft: [0.5] }, lamps: { kind: 'bulkhead', nx: 3, nz: 2, lit: 1, power: 1.5 } });
    const g = shell.group;
    // red court lines
    for (const z of [r.z0 + 0.1, r.z1 - 0.1]) g.add(box(m, r.x1 - r.x0 - 0.3, 0.02, 0.05, m.clone('clothBurgundy'), { x: (r.x0 + r.x1) / 2, y: 0.03, z, collide: false }));
    g.add(box(m, 0.05, 0.02, r.z1 - r.z0 - 0.3, m.clone('clothBurgundy'), { x: r.x0 + (r.x1 - r.x0) * 0.4, y: 0.03, z: (r.z0 + r.z1) / 2, collide: false }));
    g.add(box(m, 0.04, 0.05, r.z1 - r.z0, m.clone('clothBurgundy'), { x: r.x1 - 0.1, y: 1.7, z: (r.z0 + r.z1) / 2, collide: false }));
    locations.push(roomLocation(r, 0, 0)); flood(r); add(shell);
  }
  r = R('squash_gallery');
  if (r) { const shell = roomShell(spec, m, ctx, r, { floor: 'oakPanel', walls: 'whiteEnamel', ceiling: 'whitePaintedSteel', doors: { aft: [0.5] }, skip: ['fwd'], lamps: { kind: 'bulkhead', nx: 1, nz: 1, lit: 0 } }); const rail = makeRailing(m, { length: r.z1 - r.z0, height: 1.0, balusterPitch: 0.4, style: 'pipe' }); rail.position.set(r.x1 - 0.1, 0.02, (r.z0 + r.z1) / 2); rail.rotation.y = Math.PI / 2; shell.group.add(rail);  add(shell); }

  // ---------------- Barber, Purser's office, Hospital, Maids' saloon
  r = R('barber_shop');
  if (r) { const shell = roomShell(spec, m, ctx, r, { floor: 'linoDining', walls: 'whiteEnamel', ceiling: 'plasterWhite', doors: { port: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 2, nz: 1, lit: 1 } }); const g = shell.group; for (let i = 0; i < 2; i++) { const c = makeChair(m, { style: 'club' }); c.position.set(r.x0 + 1.2 + i * 1.8, 0, r.z1 - 1.3); c.rotation.y = Math.PI; g.add(c); const s = makeSink(m, {}); s.position.set(r.x0 + 1.2 + i * 1.8, 0, r.z1 - 0.4); s.rotation.y = Math.PI; g.add(s); } locations.push(roomLocation(r)); flood(r); add(shell); }
  r = R('pursers_office');
  if (r) { const shell = roomShell(spec, m, ctx, r, { floor: 'linoDining', walls: 'oakPanel', ceiling: 'plasterWhite', trim: 'oakDark', doors: { port: [0.3] }, lamps: { kind: 'ceilingGlobe', nx: 2, nz: 1, lit: 1 } }); const g = shell.group; const counter = makeTable(m, { w: r.x1 - r.x0 - 2, d: 0.7, h: 1.05, style: 'rect', top: 'wood' }); counter.position.set((r.x0 + r.x1) / 2, 0, r.z0 + 1.5); g.add(counter); for (let i = 0; i < 2; i++) { const d = makeDesk(m, {}); d.position.set(r.x0 + 2 + i * 3, 0, r.z1 - 1.2); d.rotation.y = Math.PI; g.add(d); } const safe = box(m, 0.9, 1.2, 0.8, 'ironDark', { x: r.x1 - 0.8, y: 0.6, z: r.z1 - 0.8, collide: true }); safe.userData.interactable = { id: 'pursers_safe', type: 'use', label: "Purser's safe", data: null }; g.add(safe); const bc = makeBookcase(m, { w: 2.5, h: 2.2 }); bc.position.set(r.x0 + 0.3, 0, (r.z0 + r.z1) / 2); bc.rotation.y = Math.PI / 2; g.add(bc); interactables.push({ id: 'pursers_safe', type: 'use', label: "Purser's safe", object: safe, data: null }); locations.push(roomLocation(r)); flood(r); add(shell); }
  r = R('hospital');
  if (r) { const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whiteEnamel', ceiling: 'whitePaintedSteel', panelled: false, doors: { port: [0.3, 0.7] }, lamps: { kind: 'ceilingGlobe', nx: 3, nz: 1, lit: 1 } }); const g = shell.group; for (let i = 0; i < 6; i++) { const b = makeBed(m, { w: 0.9, l: 2.0, style: 'brass' }); b.position.set(r.x0 + 1.5 + i * 2.4, 0, r.z1 - 1.3); b.rotation.y = 0; g.add(b); } flood(r); add(shell); }
  r = R('maids_valets_saloon');
  if (r) { const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'whiteEnamel', ceiling: 'plasterWhite', doors: { port: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 2, nz: 2, lit: 1 } }); const g = shell.group; for (let i = 0; i < 3; i++) { const t = makeTable(m, { w: 0.9, d: 4.0, h: 0.76, style: 'long', top: 'linen' }); t.position.set(r.x0 + 1.5 + i * 3, 0, (r.z0 + r.z1) / 2); g.add(t); for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { const c = makeChair(m, { style: 'bentwood' }); c.position.set(r.x0 + 1.5 + i * 3 + s * 0.8, 0, (r.z0 + r.z1) / 2 - 1.6 + k * 0.8); c.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(c); } } flood(r); add(shell); }

  for (const child of [...group.children]) { child.updateMatrixWorld(true); bakeGroup(child); }
  ctx?.log?.(`public rooms B: ${group.children.length} rooms, ${lights.length} lights`);
  return { group, locations, lights, dynamic, interactables, floodRooms };
}
