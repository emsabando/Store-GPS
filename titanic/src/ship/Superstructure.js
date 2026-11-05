/**
 * Superstructure builder (ARCHITECTURE.md §5): funnels, masts & rigging, lifeboats on Welin davits, cranes,
 * windlass & capstans, bollards, ventilators, skylights, Grand Staircase domes, bridge fittings, docking bridge,
 * compass platform, benches, deck chairs (dynamic), deck lamps, hatch covers, flagstaffs.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hullHalfBreadth, sheerAt } from './Hull.js';
import { makeLifeboat, makeDavit, makeCrane, makeBollard, makeVentilator, makeSkylight, makeBench, makeDeckChair, makeLamp, makeHatch, makeTelegraph, makeShipsWheel, makeBinnacle } from './Props.js';

const FT = 0.3048;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function originFromBow(spec) { return spec.frame?.originXFromBowM ?? 129.54; }
function xOfFt(spec, ft) { return originFromBow(spec) - ft * FT; }
function deckY(spec, id) { return (spec.decks || []).find((d) => d.id === id)?.y ?? 0; }

function lineSegments(points, material) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(geom, material);
}

/** Elliptical, raked funnel with black top, band, steam pipes, whistles, ladder and twelve stays. */
function buildFunnel(spec, f, materials, hi) {
  const g = new THREE.Group();
  g.name = `Funnel${f.n}`;
  const h = f.height - 2.6;                 // visible height above the casing top
  const buffH = h - (f.blackTopM || 5.64);
  const seg = hi ? 48 : 24;
  const mkTube = (y0, y1, mat, scaleTop = 1.0) => {
    const geom = new THREE.CylinderGeometry(1 * scaleTop, 1, y1 - y0, seg, 1, true);
    geom.scale(f.rx, 1, f.rz);
    geom.translate(0, (y0 + y1) / 2, 0);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  };
  const buff = materials.clone('funnelBuff', { side: THREE.DoubleSide });
  const black = materials.clone('funnelBlack', { side: THREE.DoubleSide });
  materials.setRepeat?.(buff, Math.PI * (f.rx + f.rz) / 2.2, h / 2.2);   // cylinder UVs are 0..1 around and up
  g.add(mkTube(0, buffH, buff), mkTube(buffH, h, black, 0.98));
  // top cap (dark interior) and rim
  const cap = new THREE.Mesh(new THREE.CircleGeometry(1, seg), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }));
  cap.scale.set(f.rx * 0.98, f.rz * 0.98, 1); cap.rotation.x = -Math.PI / 2; cap.position.y = h - 0.4;
  g.add(cap);
  const rimGeom = new THREE.TorusGeometry(1, 0.08, 8, seg); rimGeom.scale(f.rx, f.rz, 1); rimGeom.rotateX(Math.PI / 2); rimGeom.translate(0, h, 0);
  g.add(new THREE.Mesh(rimGeom, black));
  // reinforcing band at 2/3 height carrying the stay eyes
  const bandGeom = new THREE.TorusGeometry(1, 0.06, 6, seg); bandGeom.scale(f.rx + 0.02, f.rz + 0.02, 1); bandGeom.rotateX(Math.PI / 2); bandGeom.translate(0, buffH, 0);
  g.add(new THREE.Mesh(bandGeom, materials.get('ironDark')));
  // steam pipes (aft face) and ladder (forward face)
  const pipeMat = materials.get('funnelBuff');
  for (let i = 0; i < (f.steamPipes || 0); i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, h + 1.5, 10), pipeMat);
    pipe.position.set(-f.rx - 0.25, (h + 1.5) / 2, (i - (f.steamPipes - 1) / 2) * 0.9);
    g.add(pipe);
  }
  const ladder = new THREE.Group();
  const rail = new THREE.CylinderGeometry(0.03, 0.03, h, 6);
  for (const dz of [-0.25, 0.25]) { const r = new THREE.Mesh(rail, materials.get('ironDark')); r.position.set(f.rx + 0.25, h / 2, dz); ladder.add(r); }
  const rungGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5); rungGeom.rotateX(Math.PI / 2);
  const rungs = new THREE.InstancedMesh(rungGeom, materials.get('ironDark'), Math.floor(h / 0.35));
  const m = new THREE.Matrix4();
  for (let i = 0; i < rungs.count; i++) { m.makeTranslation(f.rx + 0.25, 0.3 + i * 0.35, 0); rungs.setMatrixAt(i, m); }
  rungs.instanceMatrix.needsUpdate = true; ladder.add(rungs);
  g.add(ladder);
  // whistles (forward face, funnels 1 and 2)
  if (f.whistles) {
    const wh = new THREE.Group();
    for (const [d, dz] of [[0.23, -0.6], [0.3, 0], [0.38, 0.6]]) {
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2 * 0.8, 1.0, 12), materials.get('brass'));
      bell.position.set(f.rx + 0.9, h * 0.47, dz); wh.add(bell);
    }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 8), materials.get('brass'));
    arm.rotation.z = Math.PI / 2; arm.position.set(f.rx + 0.35, h * 0.47 - 0.6, 0); wh.add(arm);
    g.add(wh);
  }
  // rake: rotate so the top leans aft (−x)
  g.rotation.z = THREE.MathUtils.degToRad(f.rakeDeg || 9.46);
  const holder = new THREE.Group();
  holder.add(g);
  holder.position.set(f.x, f.casingTopY ?? (f.baseY + 2.8), 0);
  holder.name = `FunnelHolder${f.n}`;
  holder.userData.part = { x0: f.x - 6, x1: f.x + 6 };
  // stays: 12 wires from the band to the boat deck
  const stayPts = [];
  const bandWorld = new THREE.Vector3(0, buffH, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), g.rotation.z).add(holder.position);
  const deck = deckY(spec, 'boat') + 0.1;
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const dx = THREE.MathUtils.lerp(-14, 14, t);
    for (const sign of [1, -1]) {
      const z = sign * (hullHalfBreadth(spec, f.x + dx, deck) - 1.2);
      stayPts.push(V(bandWorld.x + Math.sign(dx) * f.rx * 0.6, bandWorld.y, sign * f.rz * 0.8), V(f.x + dx, deck, z));
    }
  }
  const stays = lineSegments(stayPts, new THREE.LineBasicMaterial({ color: 0x222222 }));
  stays.name = `Funnel${f.n}.stays`;
  stays.userData.part = holder.userData.part;
  return { holder, stays, funnelGroup: g };
}

function buildMast(spec, mast, materials, hi) {
  const group = new THREE.Group();
  group.name = `Mast.${mast.id}`;
  const baseY = mast.baseY, topY = mast.topY;
  const h = topY - baseY;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, h, hi ? 16 : 10), materials.get('mastRust'));
  pole.position.y = h / 2; pole.castShadow = true;
  group.add(pole);
  // topmast cap, truck
  const truck = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), materials.get('brass')); truck.position.y = h; group.add(truck);
  // crow's nest
  if (mast.crowsNestY) {
    const ny = mast.crowsNestY - baseY;
    const nest = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.8, 1.3, 14, 1, true), materials.clone('steelGrey', { side: THREE.DoubleSide }));
    nest.position.y = ny; nest.userData.collide = true;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 14), materials.get('steelGrey'));
    floor.position.y = ny - 0.6; floor.userData.collide = true;
    group.add(nest, floor);
    // access door (opening forward) and a bell
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.25, 12), materials.get('brass'));
    bell.position.set(0.6, ny + 1.2, 0); group.add(bell);
  }
  // yard / derrick
  if (mast.derrick) {
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 14, 8), materials.get('mastRust'));
    yard.rotation.x = Math.PI / 2; yard.position.y = h * 0.48; group.add(yard);
    const derrick = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 12, 8), materials.get('mastRust'));
    derrick.position.set(5.5, 8.5, 0); derrick.rotation.z = -1.1; group.add(derrick);
  } else {
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 12, 8), materials.get('mastRust'));
    yard.rotation.x = Math.PI / 2; yard.position.y = h * 0.52; group.add(yard);
  }
  group.position.set(mast.x, baseY, 0);
  group.rotation.z = THREE.MathUtils.degToRad(mast.rakeDeg || 5.5);
  group.userData.part = { x0: mast.x - 3, x1: mast.x + 3 };
  // standing rigging: shrouds to the deck edge, stays fore/aft
  const rigPts = [];
  const top = new THREE.Vector3(0, h * 0.72, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), group.rotation.z).add(group.position);
  const deckLevel = baseY + 0.2;
  for (const sign of [1, -1]) for (const dx of [-2.5, 0, 2.5]) {
    const z = sign * (hullHalfBreadth(spec, mast.x + dx, deckLevel + 0.6) - 0.6);
    rigPts.push(top.clone(), V(mast.x + dx, deckLevel + (mast.id === 'foremast' ? sheerAt(spec, originFromBow(spec) - (mast.x + dx)) : 0), z));
  }
  const rig = lineSegments(rigPts, new THREE.LineBasicMaterial({ color: 0x1a1a1a }));
  rig.userData.part = group.userData.part;
  return { group, rig, top: new THREE.Vector3(0, h, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), group.rotation.z).add(group.position) };
}

export function buildSuperstructure(spec, materials, ctx) {
  const group = new THREE.Group();
  group.name = 'Superstructure';
  const q = ctx?.quality || 'high';
  const hi = q === 'high' || q === 'ultra';
  const o = originFromBow(spec);
  const lights = [], dynamic = [], interactables = [], locations = [];
  const yBoat = deckY(spec, 'boat'), yA = deckY(spec, 'A'), yB = deckY(spec, 'B'), yC = deckY(spec, 'C');
  const addLamp = (x, y, z, kind = 'deckLamp', light = true, power = 1) => {
    const lamp = makeLamp(materials, { kind, power, light });
    lamp.position.set(x, y, z);
    group.add(lamp);
    if (lamp.userData.light) lights.push(lamp.userData.light);
    return lamp;
  };

  // ---- funnels ----
  const funnels = [];
  for (const f of spec.funnels || []) {
    const { holder, stays, funnelGroup } = buildFunnel(spec, f, materials, hi);
    group.add(holder, stays);
    funnels.push(holder);
    // boiler casing house: the deckhouse rectangle exists in Decks; add the casing top plate above the deckhouse height
    const casing = new THREE.Mesh(new THREE.BoxGeometry(f.rx * 2 + 1.6, 0.3, f.rz * 2 + 1.6), materials.get('superstructureWhite'));
    casing.position.set(f.x, (f.casingTopY ?? yBoat + 2.8) - 0.15, 0); casing.userData.collide = true; casing.userData.part = holder.userData.part;
    group.add(casing);
    // fan room housings at the casing corners
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const fan = makeVentilator(materials, { kind: 'cowl', h: 1.6 });
      fan.position.set(f.x + dx * (f.rx + 1.2), f.casingTopY ?? yBoat + 2.8, dz * (f.rz + 1.3));
      fan.rotation.y = dx > 0 ? 0 : Math.PI;
      group.add(fan);
    }
  }

  // ---- masts, rigging, aerial ----
  const mastTops = [];
  for (const mst of spec.masts || []) {
    const { group: mg, rig, top } = buildMast(spec, mst, materials, hi);
    group.add(mg, rig);
    mastTops.push(top);
    if (mst.crowsNestY) locations.push({ id: 'crows_nest_platform', name: "Crow's nest", deck: 'C', x: mst.x + Math.tan(THREE.MathUtils.degToRad(mst.rakeDeg || 0)) * (mst.crowsNestY - mst.baseY) * -1, y: mst.crowsNestY - 0.55, z: 0, yaw: 0 });
  }
  if (mastTops.length === 2) {
    const [a, b] = mastTops;
    const pts = [];
    for (const dz of [-4.5, -1.5, 1.5, 4.5]) pts.push(V(a.x, a.y - 1.5, dz), V(b.x, b.y - 1.5, dz));
    // lead-in to the Marconi room roof
    const mr = spec.marconiRoom;
    if (mr) pts.push(V((a.x + b.x) / 2, (a.y + b.y) / 2 - 1.5, 0), V((mr.x0 + mr.x1) / 2, yBoat + 2.6, 0));
    // spreader bars
    for (const t of [a, b]) pts.push(V(t.x, t.y - 1.5, -4.6), V(t.x, t.y - 1.5, 4.6));
    const aerial = lineSegments(pts, new THREE.LineBasicMaterial({ color: 0x333333 }));
    aerial.name = 'MarconiAerial';
    group.add(aerial);
    // flag line between the masts (two triangular flags)
  }

  // ---- lifeboats on davits ----
  const lifeboats = [];
  for (const lb of spec.lifeboats || []) {
    const boat = makeLifeboat(materials, { length: lb.length, beam: lb.beam, covered: true, name: lb.id });
    boat.name = `Lifeboat${lb.id}`;
    // Boats rested on wooden chocks on the deck (keel ~0.45 m up, gunwale ~1.5 m); the Welin davits
    // swung them out from there. Roof-stowed collapsibles keep their spec height.
    const yBase = lb.onRoof && lb.y != null ? lb.y : yBoat + 0.45;
    boat.position.set(lb.x, lb.onRoof ? yBase : yBase, lb.z);
    boat.rotation.y = Math.PI / 2; // props face +z: rotate so the boat's length runs along x
    boat.userData.part = { x0: lb.x - 5, x1: lb.x + 5 };
    group.add(boat);
    let davitPair = null;
    if (lb.type !== 'Engelhardt collapsible') {
      davitPair = new THREE.Group();
      for (const dx of [-lb.length * 0.45, lb.length * 0.45]) {
        const d = makeDavit(materials, { h: 3.2, reach: 1.8 });
        d.position.set(lb.x + dx, yBoat, lb.z - Math.sign(lb.z) * 1.1);
        d.rotation.y = lb.side === 'starboard' ? 0 : Math.PI;
        davitPair.add(d);
        // falls (ropes) from the davit head to the boat
        const falls = lineSegments([V(lb.x + dx, yBoat + 3.2, lb.z + Math.sign(lb.z) * 0.4), V(lb.x + dx, yBase + 0.9, lb.z)], new THREE.LineBasicMaterial({ color: 0xb59a6a }));
        davitPair.add(falls);
      }
      // chocks under the boat
      for (const dx of [-lb.length * 0.3, lb.length * 0.3]) {
        const ch = Math.max(0.12, yBase - yBoat - 0.08);
        const chock = new THREE.Mesh(new THREE.BoxGeometry(0.35, ch, lb.beam * 0.55), materials.get('oakDark'));
        chock.position.set(lb.x + dx, yBoat + ch / 2, lb.z); davitPair.add(chock);
      }
      davitPair.userData.part = boat.userData.part;
      group.add(davitPair);
    } else if (lb.onRoof) {
      // officers' house roof already exists; a low cradle
      const cradle = new THREE.Mesh(new THREE.BoxGeometry(lb.length * 0.8, 0.25, lb.beam * 0.9), materials.get('oakDark'));
      cradle.position.set(lb.x, yBase - 0.3, lb.z); group.add(cradle);
    }
    boat.traverse((obj) => { if (obj.isMesh) obj.userData.interactable = { id: `lifeboat_${lb.id}`, type: 'use', label: `Lifeboat ${lb.id}`, data: { boat: lb.id, launchTime: lb.launchTime } }; });
    interactables.push({ id: `lifeboat_${lb.id}`, type: 'use', label: `Lifeboat ${lb.id}`, object: boat, data: { boat: lb.id, launchTime: lb.launchTime } });
    lifeboats.push({ id: lb.id, object: boat, davit: davitPair, side: lb.side, x: lb.x, launchTime: lb.launchTime, launchOrder: lb.launchOrder, capacity: lb.capacity });
  }

  // ---- cranes, hatches, windlass, capstans, bollards ----
  for (const c of spec.cranes || []) {
    const crane = makeCrane(materials, { h: c.height || 6.5, reach: c.reach || 8.5 });
    crane.position.set(c.x, c.y + (c.deck === 'B' || c.deck === 'C' ? sheerAt(spec, o - c.x) : 0), c.z);
    crane.rotation.y = c.z > 0 ? -Math.PI / 2 : Math.PI / 2;
    crane.userData.part = { x0: c.x - 2, x1: c.x + 2 };
    group.add(crane);
  }
  for (const h of spec.hatches || []) {
    const hatch = makeHatch(materials, { w: h.z1 - h.z0, l: h.x1 - h.x0 });
    hatch.position.set((h.x0 + h.x1) / 2, h.y + sheerAt(spec, o - (h.x0 + h.x1) / 2), (h.z0 + h.z1) / 2);
    hatch.userData.part = { x0: h.x0, x1: h.x1 };
    group.add(hatch);
  }
  const fcY = (x) => yB + sheerAt(spec, o - x);
  // windlass heads and capstans on the forecastle, capstans on the poop
  for (const [ft, z, r] of [[88, -3.2, 0.55], [88, 3.2, 0.55], [105, -5.5, 0.4], [105, 5.5, 0.4], [70, -2.2, 0.35], [70, 2.2, 0.35], [820, -4.5, 0.4], [820, 4.5, 0.4], [850, -3.0, 0.4], [850, 3.0, 0.4]]) {
    const x = xOfFt(spec, ft);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, 1.1, 14), materials.get('bronze'));
    cap.position.set(x, fcY(x) + 0.55, z); cap.castShadow = true; cap.userData.collide = true; cap.userData.part = { x0: x - 1, x1: x + 1 };
    group.add(cap);
  }
  // anchor crane at the stem, centre anchor well
  const ac = makeCrane(materials, { h: 4.5, reach: 4.0 });
  ac.position.set(xOfFt(spec, 14), fcY(xOfFt(spec, 14)), 0); ac.rotation.y = 0; group.add(ac);
  // bollards along the forecastle, well decks and poop
  const bollardSpots = [];
  for (const sign of [1, -1]) for (const ft of [30, 60, 95, 130, 160, 740, 765, 800, 835, 865]) {
    const x = xOfFt(spec, ft); const yDeck = (ft > 125 && ft < 175) || (ft > 725 && ft < 775) ? yC : fcY(x);
    bollardSpots.push([x, yDeck, sign * (hullHalfBreadth(spec, x, yDeck + 0.6) - 1.0)]);
  }
  for (const [x, y, z] of bollardSpots) { const b = makeBollard(materials, {}); b.position.set(x, y, z); b.userData.part = { x0: x - 1, x1: x + 1 }; group.add(b); }

  // ---- domes over the grand staircases, skylights on raised roofs, compass platform ----
  const gs = spec.grandStaircases || {};
  const domeMat = materials.clone('glassFrosted', { side: THREE.DoubleSide, emissive: new THREE.Color(0xffa552), emissiveIntensity: 0.6, transmission: 0.2, opacity: 0.85, transparent: true });
  domeMat.name = 'dome.glass';
  const ribMat = materials.get('wroughtIron');
  for (const [key, d] of Object.entries(gs)) {
    if (!d) continue;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, hi ? 32 : 16, hi ? 16 : 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.scale.set(d.domeRx, d.domeHeight, d.domeRz);
    dome.position.set(d.x, d.domeY, d.z || 0);
    dome.userData.emissiveLamp = true; dome.name = `Dome.${key}`;
    dome.userData.part = { x0: d.x - 5, x1: d.x + 5 };
    group.add(dome);
    // ribs
    const ribs = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const pts = [];
      for (let k = 0; k <= 8; k++) { const t = (k / 8) * Math.PI / 2; pts.push(V(Math.cos(a) * Math.cos(t), Math.sin(t), Math.sin(a) * Math.cos(t))); }
      ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.03, 5, false));
    }
    const ribMesh = new THREE.Mesh(mergeGeometries(ribs), ribMat);
    ribMesh.scale.copy(dome.scale); ribMesh.position.copy(dome.position); group.add(ribMesh);
    // base drum
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 24, 1, true), materials.clone('superstructureWhite', { side: THREE.DoubleSide }));
    drum.scale.set(d.domeRx, 1, d.domeRz); drum.position.set(d.x, d.domeY - 0.25, d.z || 0); group.add(drum);
  }
  for (const [ft0, ft1, z0, z1] of [[380, 470, -8.5, 8.5], [575, 635, -8.5, 8.5]]) {
    for (let ft = ft0 + 6; ft < ft1 - 4; ft += 12) {
      for (const z of [-5.5, 0, 5.5]) {
        const sk = makeSkylight(materials, { w: 2.2, d: 1.4 });
        sk.position.set(xOfFt(spec, ft), yBoat + 0.9 + 0.12, z); group.add(sk);
      }
    }
  }
  const cp = spec.compassPlatform;
  if (cp) {
    const house = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, cp.height || 2.2, 8), materials.get('teakVarnished'));
    house.position.set(cp.x, (cp.y ?? yBoat + 0.9) + (cp.height || 2.2) / 2 + 0.12, 0); house.userData.collide = true; house.name = 'CompassPlatform';
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.6, 8), materials.get('superstructureWhite'));
    roof.position.set(cp.x, (cp.y ?? yBoat + 0.9) + (cp.height || 2.2) + 0.42, 0);
    group.add(house, roof);
    const bin = makeBinnacle(materials, {}); bin.position.set(cp.x, (cp.y ?? yBoat + 0.9) + (cp.height || 2.2) + 0.12, 0); group.add(bin);
    locations.push({ id: 'compass_platform_top', name: 'Compass platform', deck: 'boat', x: cp.x + 2.4, y: (cp.y ?? yBoat + 0.9) + 0.12, z: 0, yaw: Math.PI });
  }

  // ---- bridge fittings: wing cabs, telegraphs, wheel, binnacle; docking bridge ----
  const br = spec.bridge;
  if (br) {
    const yb = br.y ?? yBoat;
    const xFront = br.x1 - 0.4;
    for (let i = 0; i < 5; i++) {
      const t = makeTelegraph(materials, {});
      t.position.set(xFront - 0.9, yb, -3.2 + i * 1.6); t.rotation.y = Math.PI; group.add(t);
    }
    const wheel = makeShipsWheel(materials, { d: 1.07 });
    wheel.position.set(br.wheelhouse ? (br.wheelhouse.x0 + br.wheelhouse.x1) / 2 : br.x0 + 2, yb, 0); wheel.rotation.y = Math.PI / 2; group.add(wheel);
    const bin = makeBinnacle(materials, {}); bin.position.set(br.x1 - 2.6, yb, 0); group.add(bin);
    // wing cabs: small glazed boxes at the deck edges, overhanging
    for (const sign of [1, -1]) {
      const wc = br.wingCabs || { z: 13.2, w: 2.4, d: 2.4 };
      const cab = new THREE.Mesh(new THREE.BoxGeometry(wc.d, 2.4, wc.w), materials.clone('superstructureWhite', { side: THREE.DoubleSide }));
      cab.position.set((br.x0 + br.x1) / 2 + 0.5, yb + 1.2, sign * (wc.z + 0.6)); cab.userData.collide = true; cab.name = 'WingCab';
      group.add(cab);
      const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(wc.d + 0.02, 1.0, wc.w + 0.02), materials.clone('glass', { transparent: true, opacity: 0.4 }));
      cabGlass.position.set(cab.position.x, yb + 1.75, cab.position.z); group.add(cabGlass);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(wc.d + 0.6, 0.15, wc.w + 1.2), materials.get('teakDeck'));
      floor.position.set(cab.position.x, yb - 0.08, cab.position.z); floor.userData.collide = true; group.add(floor);
    }
    locations.push({ id: 'bridge_wing_stbd', name: 'Starboard bridge wing', deck: 'boat', x: (br.x0 + br.x1) / 2, y: yb, z: 12.0, yaw: -Math.PI / 2 });
  }
  const db = spec.dockingBridge;
  if (db) {
    const y = db.y ?? yB + 2.4;
    const span = new THREE.Mesh(new THREE.BoxGeometry(db.width || 1.6, 0.15, db.z1 - db.z0), materials.get('teakDeck'));
    span.position.set(db.x, y, 0); span.userData.collide = true; span.name = 'DockingBridge'; span.userData.part = { x0: db.x - 2, x1: db.x + 2 };
    group.add(span);
    for (const z of [db.z0 + 0.4, db.z0 + 6, 0, db.z1 - 6, db.z1 - 0.4]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), materials.get('whitePaintedSteel'));
      leg.position.set(db.x, y - 1.2, z); group.add(leg);
    }
    const rail = new THREE.Group();
    for (const dx of [-0.75, 0.75]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, db.z1 - db.z0), materials.get('whitePaintedSteel'));
      r.position.set(db.x + dx, y + 0.5, 0); rail.add(r);
    }
    group.add(rail);
    const t1 = makeTelegraph(materials, {}); t1.position.set(db.x, y + 0.07, -2.5); group.add(t1);
    const t2 = makeTelegraph(materials, {}); t2.position.set(db.x, y + 0.07, 2.5); group.add(t2);
    const w = makeShipsWheel(materials, { d: 0.9 }); w.position.set(db.x, y + 0.07, 0); w.rotation.y = Math.PI / 2; group.add(w);
    // stern flagstaff
    const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 7, 8), materials.get('teakVarnished'));
    const sx = xOfFt(spec, 878);
    flag.position.set(sx, yB + sheerAt(spec, o - sx) + 3.5, 0); flag.rotation.z = -0.25; group.add(flag);
  }

  // ---- benches, deck chairs, lamps along the deckhouses ----
  const boatDeck = (spec.decks || []).find((d) => d.id === 'boat');
  const aDeck = (spec.decks || []).find((d) => d.id === 'A');
  let chairs = 0;
  const chairBudget = q === 'low' ? 40 : q === 'medium' ? 90 : 160;
  const placeAlongHouses = (deck, y, benchEvery, chairEvery, lampEvery) => {
    for (const dh of deck.deckhouses || []) {
      if ((dh.height || 2.6) < 1.2) continue;
      for (const sign of [1, -1]) {
        const z = sign > 0 ? dh.z1 + 0.5 : dh.z0 - 0.5;
        const len = dh.x1 - dh.x0;
        for (let s = 2.5; s < len - 2; s += benchEvery) {
          const x = dh.x0 + s;
          const b = makeBench(materials, { length: 1.8, style: 'deck' });
          b.position.set(x, y, z); b.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2; b.userData.part = { x0: x - 1, x1: x + 1 };
          group.add(b);
        }
        for (let s = 1.5; s < len - 1 && chairs < chairBudget; s += chairEvery) {
          const x = dh.x0 + s;
          const dc = makeDeckChair(materials, {});
          dc.position.set(x, y, z + sign * 1.3); dc.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
          dc.userData.part = { x0: x - 1, x1: x + 1 };
          group.add(dc); dynamic.push({ object: dc, kind: 'deckchair', mass: 8 }); chairs++;
        }
        for (let s = 4; s < len - 2; s += lampEvery) {
          const x = dh.x0 + s;
          addLamp(x, y + 2.3, z - sign * 0.35, 'bulkhead', hi && (s / lampEvery) % 2 === 0, 0.8);
        }
      }
    }
  };
  if (boatDeck) placeAlongHouses(boatDeck, yBoat, 9, 7, 12);
  if (aDeck) placeAlongHouses(aDeck, yA, 7, 5, 10);
  // ventilators on the forecastle, poop and casings
  for (const [ft, z, kind] of [[40, -4, 'cowl'], [40, 4, 'cowl'], [112, -6, 'mushroom'], [112, 6, 'mushroom'], [805, -5, 'cowl'], [805, 5, 'cowl'], [860, 0, 'mushroom']]) {
    const x = xOfFt(spec, ft);
    const v = makeVentilator(materials, { kind, h: kind === 'cowl' ? 2.2 : 0.8 });
    v.position.set(x, fcY(x), z); v.userData.part = { x0: x - 1, x1: x + 1 }; group.add(v);
  }

  ctx?.log?.(`superstructure: ${funnels.length} funnels, ${lifeboats.length} boats, ${chairs} deck chairs, ${lights.length} lights`);
  return { group, locations, lights, dynamic, interactables, floodRooms: [], funnels, lifeboats };
}
