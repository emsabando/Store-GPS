/**
 * Public rooms A (ARCHITECTURE.md §5): First-Class Lounge, Smoking Room, Reading & Writing Room, Verandah Cafés,
 * Café Parisien, À la Carte Restaurant and its Reception Room, Gymnasium, Second-Class Library and Smoking Room.
 * Each room is built from its spec rectangle with period materials and furniture, then baked to a few draw calls.
 */
import * as THREE from 'three';
import { findRoom, roomShell, gridPlace, tableCluster, bakeGroup, tiled } from './RoomKit.js';
import { makeChair, makeTable, makeSofa, makeDesk, makeFireplace, makeBookcase, makePalm, makeTrellis, makeColumn, makeLamp, makeGymMachine, makePiano, box } from '../Props.js';

function roomLocation(room, dx = 0, yaw = Math.PI) {
  return { id: `room_${room.id}`, name: room.name, deck: room.deck, x: (room.x0 + room.x1) / 2 + dx, y: room.y, z: (room.z0 + room.z1) / 2, yaw };
}

export function buildPublicRoomsA(spec, m, ctx) {
  const group = new THREE.Group();
  group.name = 'PublicRoomsA';
  const lights = [], locations = [], interactables = [], dynamic = [];
  const q = ctx?.quality || 'high';
  const dense = q === 'high' || q === 'ultra';
  const add = (shell) => { group.add(shell.group); lights.push(...shell.lights); };
  const R = (id) => findRoom(spec, id);

  // ---------------- First-Class Lounge (A deck): Louis XV oak, green velvet, chandelier, fireplace, bookcase alcove
  let r = R('lounge');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'carpetGreen', walls: 'oakPanel', ceiling: 'plasterWhite', trim: 'oakDark', floorRepeat: 2.5,
      doors: { fwd: [0.5], aft: [0.5], port: [0.25, 0.75], stbd: [0.25, 0.75] }, lamps: { kind: 'chandelier', nx: 3, nz: 2, lit: 2, power: 1.1 } });
    const g = shell.group;
    gridPlace(g, () => tableCluster(m, makeTable, makeChair, { tableOpts: { w: 0.9, d: 0.9, style: 'round', top: 'wood' }, chairOpts: { style: 'club' }, seats: 3, radius: 0.95 }),
      { x0: r.x0 + 2.5, x1: r.x1 - 2.5, z0: r.z0 + 2.4, z1: r.z1 - 2.4, dx: 4.2, dz: 4.0, jitter: 0.3, limit: dense ? 14 : 8 });
    for (const z of [r.z0 + 1.2, r.z1 - 1.2]) for (let i = 0; i < 3; i++) { const s = makeSofa(m, { w: 2.0 }); s.position.set(r.x0 + 3 + i * 5.5, 0, z); s.rotation.y = z < 0 ? 0 : Math.PI; g.add(s); }
    const fp = makeFireplace(m, { w: 2.2, style: 'grey' }); fp.position.set(r.x0 + 0.35, 0, 0); fp.rotation.y = Math.PI / 2; g.add(fp); lights.push(fp.userData.light);
    const bc = makeBookcase(m, { w: 3.0, h: 2.4 }); bc.position.set(r.x1 - 0.3, 0, r.z1 - 3); bc.rotation.y = -Math.PI / 2; g.add(bc);
    for (const x of [r.x0 + 4, (r.x0 + r.x1) / 2, r.x1 - 4]) for (const z of [-4.5, 4.5]) { const c = makeColumn(m, { h: r.ceiling, style: 'oak', r: 0.22 }); c.position.set(x, 0, z); g.add(c); }
    const piano = makePiano(m, { grand: true }); piano.position.set(r.x1 - 3, 0, r.z0 + 3); piano.rotation.y = 0.6; g.add(piano);
        locations.push(roomLocation(r));
    add(shell);
  }

  // ---------------- Reading & Writing Room (A deck, port): Georgian white, pink carpet, writing desks, settees
  r = R('reading_room');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'roseCarpet', walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'whiteEnamel', floorRepeat: 2.0,
      doors: { fwd: [0.5], aft: [0.5], stbd: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 3, nz: 3, lit: 1 } });
    const g = shell.group;
    for (let i = 0; i < 5; i++) { const d = makeDesk(m, {}); d.position.set(r.x0 + 1.5 + i * 2.2, 0, r.z0 + 0.6); d.rotation.y = 0; g.add(d); const c = makeChair(m, { style: 'bentwood' }); c.position.set(d.position.x, 0, r.z0 + 1.4); c.rotation.y = Math.PI; g.add(c); }
    for (const [x, z, ry] of [[r.x0 + 3, 0, Math.PI / 2], [r.x1 - 3, 0, -Math.PI / 2], [(r.x0 + r.x1) / 2, r.z1 - 1.3, Math.PI]]) { const s = makeSofa(m, { w: 2.1, color: '#d9b64a' }); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s); }
    gridPlace(g, () => tableCluster(m, makeTable, makeChair, { tableOpts: { w: 0.8, d: 0.8, style: 'round' }, chairOpts: { style: 'club' }, seats: 2, radius: 0.85 }), { x0: r.x0 + 3, x1: r.x1 - 3, z0: r.z0 + 3, z1: r.z1 - 3, dx: 4, dz: 3.5, limit: 4 });
    const fp = makeFireplace(m, { w: 1.8, style: 'marble' }); fp.position.set(r.x1 - 0.35, 0, (r.z0 + r.z1) / 2); fp.rotation.y = -Math.PI / 2; g.add(fp); lights.push(fp.userData.light); locations.push(roomLocation(r)); add(shell);
  }

  // ---------------- First-Class Smoking Room (A deck): mahogany, mother-of-pearl, leather club chairs, fireplace
  r = R('smoking_room');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoCorridor', walls: 'mahogany', ceiling: 'plasterWhite', trim: 'ormolu', floorRepeat: 1.2,
      doors: { fwd: [0.5], aft: [0.5], port: [0.5], stbd: [0.5] }, lamps: { kind: 'chandelier', nx: 2, nz: 2, lit: 2, power: 1.0 } });
    const g = shell.group;
    gridPlace(g, () => tableCluster(m, makeTable, makeChair, { tableOpts: { w: 0.85, d: 0.85, style: 'round', top: 'wood' }, chairOpts: { style: 'club' }, seats: 4, radius: 0.95 }),
      { x0: r.x0 + 2.5, x1: r.x1 - 3.5, z0: r.z0 + 2.2, z1: r.z1 - 2.2, dx: 4.0, dz: 4.0, jitter: 0.25, limit: dense ? 16 : 8 });
    const fp = makeFireplace(m, { w: 2.4, style: 'marble' }); fp.position.set(r.x0 + 0.35, 0, 0); fp.rotation.y = Math.PI / 2; g.add(fp); lights.push(fp.userData.light);
    // painting "Plymouth Harbour" above the fireplace
    const painting = box(m, 0.05, 1.1, 1.8, m.clone('clothBlue', { color: new THREE.Color(0x3b5a78) }), { x: r.x0 + 0.26, y: 2.1, z: 0, collide: false }); g.add(painting);
    for (const x of [r.x0 + 5, (r.x0 + r.x1) / 2, r.x1 - 5]) for (const z of [-4.8, 4.8]) { const c = makeColumn(m, { h: r.ceiling, style: 'square', r: 0.2 }); c.traverse((o) => { if (o.isMesh) o.material = m.get('mahogany'); }); c.position.set(x, 0, z); g.add(c); }
    // bar at the aft starboard corner
    const bar = makeTable(m, { w: 3.2, d: 0.8, h: 1.1, style: 'rect', top: 'marble' }); bar.position.set(r.x1 - 2, 0, r.z1 - 1.2); g.add(bar); locations.push(roomLocation(r)); add(shell);
  }

  // ---------------- Verandah Cafés (A deck, port & starboard): trellis, ivy, wicker, chequered floor
  for (const id of ['verandah_port', 'verandah_stbd']) {
    r = R(id);
    if (!r) continue;
    const chequer = tiled(m, 'linoDining', 0.6, 0.6, { color: new THREE.Color(0xb08a5e) });
    const shell = roomShell(spec, m, ctx, r, { floorMat: chequer, walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'whiteEnamel', doors: { fwd: [0.5], aft: [0.5], [id === 'verandah_port' ? 'stbd' : 'port']: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 2, nz: 2, lit: 1 } });
    const g = shell.group;
    gridPlace(g, () => tableCluster(m, makeTable, makeChair, { tableOpts: { w: 0.7, d: 0.7, style: 'cafe' }, chairOpts: { style: 'wicker' }, seats: 3, radius: 0.7 }), { x0: r.x0 + 1.5, x1: r.x1 - 1.5, z0: r.z0 + 1.5, z1: r.z1 - 1.5, dx: 3.0, dz: 2.8, limit: 6 });
    for (let i = 0; i < 3; i++) { const t = makeTrellis(m, { w: 2.2, h: r.ceiling - 0.2 }); t.position.set(r.x0 + 1.5 + i * 2.6, 0, id === 'verandah_port' ? r.z0 + 0.15 : r.z1 - 0.15); t.rotation.y = id === 'verandah_port' ? 0 : Math.PI; g.add(t); }
    for (const [x, z] of [[r.x0 + 0.8, r.z0 + 0.8], [r.x1 - 0.8, r.z1 - 0.8], [r.x0 + 0.8, r.z1 - 0.8], [r.x1 - 0.8, r.z0 + 0.8]]) { const p = makePalm(m, { h: 2.0 }); p.position.set(x, 0, z); g.add(p); } locations.push(roomLocation(r)); add(shell);
  }

  // ---------------- Café Parisien (B deck, starboard): wicker along the windows, white trellis, ivy
  r = R('cafe_parisien');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoDining', walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'whiteEnamel', floorRepeat: 0.9, doors: { port: [0.2, 0.5, 0.8] }, skip: ['stbd'], lamps: { kind: 'ceilingGlobe', nx: 6, nz: 1, lit: 2 } });
    const g = shell.group;
    const n = dense ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const x = r.x0 + 1.2 + i * ((r.x1 - r.x0 - 2.4) / (n - 1));
      const c = tableCluster(m, makeTable, makeChair, { tableOpts: { w: 0.7, d: 0.7, style: 'cafe', top: 'linen' }, chairOpts: { style: 'wicker' }, seats: i % 2 ? 2 : 3, radius: 0.72 });
      c.position.set(x, 0, r.z1 - 1.6); g.add(c);
    }
    for (let i = 0; i < Math.floor((r.x1 - r.x0) / 2.6); i++) { const t = makeTrellis(m, { w: 2.2, h: r.ceiling - 0.2 }); t.position.set(r.x0 + 1.3 + i * 2.6, 0, r.z0 + 0.12); g.add(t); }
    for (let i = 0; i < 4; i++) { const p = makePalm(m, { h: 1.8 }); p.position.set(r.x0 + 2 + i * ((r.x1 - r.x0 - 4) / 3), 0, r.z0 + 0.9); g.add(p); } locations.push(roomLocation(r, 0, Math.PI)); add(shell);
  }

  // ---------------- À la Carte Restaurant (B deck): walnut, Rose du Barry carpet, crystal table lamps
  r = R('restaurant');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'roseCarpet', walls: 'walnut', ceiling: 'plasterWhite', trim: 'ormolu', floorRepeat: 2.2, doors: { fwd: [0.3, 0.7], stbd: [0.3, 0.7] }, lamps: { kind: 'sconce', nx: 1, nz: 1, lit: 0 } });
    const g = shell.group;
    // ceiling clusters
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const l = makeLamp(m, { kind: 'chandelier', power: 0.8, light: (i === 1 && j === 1) }); l.position.set(r.x0 + (i + 0.5) * ((r.x1 - r.x0) / 3), r.ceiling - 0.05, r.z0 + (j + 0.5) * ((r.z1 - r.z0) / 3)); g.add(l); if (l.userData.light) lights.push(l.userData.light); }
    const tables = gridPlace(g, (i, j) => { const c = tableCluster(m, makeTable, makeChair, { tableOpts: { w: 1.1, d: 1.1, style: 'round', top: 'linen' }, chairOpts: { style: 'dining' }, seats: (i + j) % 3 === 0 ? 2 : 4, radius: 0.95 }); const lamp = makeLamp(m, { kind: 'tableLamp', power: 0.8, light: false }); lamp.position.y = 0.78; c.add(lamp); return c; },
      { x0: r.x0 + 2, x1: r.x1 - 2, z0: r.z0 + 2, z1: r.z1 - 2, dx: 3.2, dz: 3.2, jitter: 0.2, limit: dense ? 24 : 12 });
    for (const x of [r.x0 + 4.5, (r.x0 + r.x1) / 2, r.x1 - 4.5]) for (const z of [-5, 5]) { const c = makeColumn(m, { h: r.ceiling, style: 'ionic', r: 0.2 }); c.position.set(x, 0, z); g.add(c); }
    const buffet = makeTable(m, { w: 4.0, d: 0.8, h: 1.0, style: 'rect', top: 'marble' }); buffet.position.set(r.x1 - 0.7, 0, 0); buffet.rotation.y = Math.PI / 2; g.add(buffet); locations.push(roomLocation(r)); add(shell);
  }
  r = R('restaurant_reception');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'carpetRed', walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'ormolu', floorRepeat: 2.0, doors: { aft: [0.5], fwd: [0.4] }, lamps: { kind: 'chandelier', nx: 1, nz: 2, lit: 1 } });
    const g = shell.group;
    for (const [x, z, ry] of [[r.x0 + 2, r.z0 + 1.2, 0], [r.x1 - 2, r.z0 + 1.2, 0], [r.x0 + 2, r.z1 - 1.2, Math.PI], [r.x1 - 2, r.z1 - 1.2, Math.PI]]) { const s = makeSofa(m, { w: 2.2, color: '#4e7a5c' }); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s); }
    gridPlace(g, () => tableCluster(m, makeTable, makeChair, { tableOpts: { w: 0.7, d: 0.7, style: 'cafe' }, chairOpts: { style: 'wicker' }, seats: 3, radius: 0.72 }), { x0: r.x0 + 2, x1: r.x1 - 2, z0: r.z0 + 3, z1: r.z1 - 3, dx: 3.5, dz: 3.0, limit: 5 }); locations.push(roomLocation(r)); add(shell);
  }

  // ---------------- Gymnasium (Boat Deck, starboard)
  r = R('gymnasium');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'oakPanel', walls: 'whiteEnamel', ceiling: 'plasterWhite', trim: 'oakDark', floorRepeat: 1.2, doors: { aft: [0.5], port: [0.15] }, skip: ['stbd'], lamps: { kind: 'ceilingGlobe', nx: 4, nz: 1, lit: 1 } });
    const g = shell.group;
    const kinds = ['camel', 'horse', 'rower', 'rower', 'bike', 'bike', 'punch'];
    kinds.forEach((k, i) => { const mach = makeGymMachine(m, { kind: k }); mach.position.set(r.x0 + 1.5 + i * ((r.x1 - r.x0 - 3) / (kinds.length - 1)), 0, i % 2 ? r.z0 + 1.6 : r.z1 - 1.6); mach.rotation.y = i % 2 ? 0 : Math.PI; g.add(mach); });
    // the illuminated map of the world on the aft wall
    const map = box(m, 0.04, 1.4, 2.6, m.clone('clothCream', { emissive: new THREE.Color(0xffe9b0), emissiveIntensity: 0.25 }), { x: r.x0 + 0.12, y: 1.5, z: (r.z0 + r.z1) / 2, collide: false }); map.userData.emissiveLamp = true; g.add(map); locations.push(roomLocation(r, 0, Math.PI)); add(shell);
  }

  // ---------------- Second-Class Library (C deck): sycamore, columns, writing tables, bookcase
  r = R('library_2nd');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'carpetRed', walls: 'sycamore', ceiling: 'plasterWhite', trim: 'mahogany', floorRepeat: 2.0, doors: { fwd: [0.5], port: [0.5], stbd: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 4, nz: 3, lit: 1 } });
    const g = shell.group;
    gridPlace(g, () => { const t = new THREE.Group(); t.add(makeTable(m, { w: 1.6, d: 0.8, style: 'rect' })); for (const [dx, ry] of [[-0.45, 0], [0.45, 0]]) { const c = makeChair(m, { style: 'bentwood' }); c.position.set(dx, 0, 0.75); c.rotation.y = Math.PI; t.add(c); } return t; }, { x0: r.x0 + 2, x1: r.x1 - 2, z0: r.z0 + 2, z1: r.z1 - 2, dx: 3.0, dz: 3.2, limit: dense ? 10 : 6 });
    const bc = makeBookcase(m, { w: 6, h: 2.3 }); bc.position.set(r.x0 + 0.3, 0, 0); bc.rotation.y = Math.PI / 2; g.add(bc);
    for (const x of [r.x0 + 3, (r.x0 + r.x1) / 2, r.x1 - 3]) for (const z of [-4, 4]) { const c = makeColumn(m, { h: r.ceiling, style: 'ionic', r: 0.18 }); c.position.set(x, 0, z); g.add(c); } locations.push(roomLocation(r)); add(shell);
  }

  // ---------------- Second-Class Smoking Room (B deck): oak, green Morocco leather
  r = R('smoking_room_2nd');
  if (r) {
    const shell = roomShell(spec, m, ctx, r, { floor: 'linoDining', walls: 'oakPanel', ceiling: 'plasterWhite', trim: 'oakDark', floorRepeat: 1.0, doors: { fwd: [0.5], aft: [0.5] }, lamps: { kind: 'ceilingGlobe', nx: 3, nz: 3, lit: 1 } });
    const g = shell.group;
    gridPlace(g, () => tableCluster(m, makeTable, makeChair, { tableOpts: { w: 0.8, d: 0.8, style: 'round' }, chairOpts: { style: 'club' }, seats: 4, radius: 0.9 }), { x0: r.x0 + 2, x1: r.x1 - 2, z0: r.z0 + 2, z1: r.z1 - 2, dx: 3.6, dz: 3.6, limit: dense ? 9 : 5 });
    const bar = makeTable(m, { w: 3.0, d: 0.8, h: 1.1, style: 'rect', top: 'wood' }); bar.position.set(r.x1 - 1.5, 0, r.z0 + 1.2); g.add(bar); locations.push(roomLocation(r)); add(shell);
  }

  // bake every room (merge static meshes by material); lamps' PointLights, interactables and instanced parts are kept
  for (const child of [...group.children]) {
    child.updateMatrixWorld(true);
    bakeGroup(child);
  }
  group.traverse((o) => { if (o.isMesh && o.userData.part === undefined) o.userData.part = undefined; });
  ctx?.log?.(`public rooms A: ${group.children.length} rooms, ${lights.length} lights`);
  return { group, locations, lights, dynamic, interactables, floodRooms: [] };
}
