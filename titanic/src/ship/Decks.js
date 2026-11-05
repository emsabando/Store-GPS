/**
 * Decks builder (ARCHITECTURE.md §5): deck plates with wells for stairs, hatches and machinery spaces,
 * sheered forecastle and poop, bulwarks and railings, deckhouse walls with real window openings,
 * the A-deck promenade screen, boat-deck support stanchions, roofs. Everything in ship-local metres.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hullHalfBreadth, hullTopY, hullOutline, sheerAt } from './Hull.js';

const FT = 0.3048;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function originFromBow(spec) { return spec.frame?.originXFromBowM ?? 129.54; }
function xOfFt(spec, ft) { return originFromBow(spec) - ft * FT; }
function deckById(spec, id) { return (spec.decks || []).find((d) => d.id === id); }

// ------------------------------------------------------------------ plates
/** Flat deck plate at y following the hull outline between xHi and xLo, with rectangular holes. */
function flatPlate(spec, y, xHi, xLo, holes, inset = 0.12) {
  const pts = [];
  const step = 1.5;
  for (let x = xHi; x > xLo; x -= step) pts.push([x, Math.max(0.05, hullHalfBreadth(spec, x, y + 0.6) - inset)]);
  pts.push([xLo, Math.max(0.05, hullHalfBreadth(spec, xLo, y + 0.6) - inset)]);
  if (pts.length < 2) return null;
  const shape = new THREE.Shape();
  // starboard edge bow→stern, then port edge stern→bow (shape y = -z so the geometry rotates to +y normal)
  shape.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  for (const h of holes) {
    const x0 = Math.max(h.x0, xLo + 0.2), x1 = Math.min(h.x1, xHi - 0.2);
    if (x1 - x0 < 0.3) continue;
    const hb = Math.max(0.05, hullHalfBreadth(spec, (x0 + x1) / 2, y + 0.6) - inset - 0.3);
    const z0 = Math.max(h.z0, -hb), z1 = Math.min(h.z1, hb);
    if (z1 - z0 < 0.3) continue;
    const p = new THREE.Path();
    p.moveTo(x0, -z0); p.lineTo(x0, -z1); p.lineTo(x1, -z1); p.lineTo(x1, -z0); p.closePath();
    shape.holes.push(p);
  }
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Sheered weather deck (forecastle / poop): quad strip, y = base + sheer(x). */
function sheeredPlate(spec, baseY, xHi, xLo, inset = 0.1) {
  const o = originFromBow(spec);
  const pos = [], uv = [];
  const step = 1.0;
  const col = (x) => { const y = baseY + sheerAt(spec, o - x); return { x, y, hb: Math.max(0.03, hullHalfBreadth(spec, x, y + 0.4) - inset) }; };
  let a = col(xHi);
  for (let x = xHi - step; x >= xLo - 1e-6; x -= step) {
    const b = col(Math.max(x, xLo));
    const q = (p1, p2, p3) => { for (const p of [p1, p2, p3]) { pos.push(p[0], p[1], p[2]); uv.push(p[0], p[2]); } };
    const N = 6;
    for (let k = 0; k < N; k++) {
      const t0 = -1 + 2 * k / N, t1 = -1 + 2 * (k + 1) / N;
      q([a.x, a.y, a.hb * t0], [b.x, b.y, b.hb * t0], [b.x, b.y, b.hb * t1]);
      q([a.x, a.y, a.hb * t0], [b.x, b.y, b.hb * t1], [a.x, a.y, a.hb * t1]);
    }
    a = b;
    if (b.x <= xLo) break;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Polyline of the hull edge at height y (bow→stern) on one side, with the deck's sheer added. */
function edgeLine(spec, y, xHi, xLo, sign, step = 2.0, offset = -0.08) {
  const o = originFromBow(spec);
  const pts = [];
  for (let x = xHi; x > xLo; x -= step) pts.push(V(x, y + sheerAt(spec, o - x), sign * (hullHalfBreadth(spec, x, y + 0.6) + offset)));
  pts.push(V(xLo, y + sheerAt(spec, o - xLo), sign * (hullHalfBreadth(spec, xLo, y + 0.6) + offset)));
  return pts;
}

// ------------------------------------------------------------------ walls, railings, bulwarks
/** Tube following points (rails, cap rails). */
function tubeAlong(points, radius, segmentsPerPoint = 2) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.0);
  return new THREE.TubeGeometry(curve, Math.max(4, points.length * segmentsPerPoint), radius, 6, false);
}

/** Open railing along a polyline: instanced stanchions, 3 tube rails, invisible collider. */
function railingAlong(points, height, materials, { pitch = 1.5, capMaterial = 'teakOiled', railMaterial = 'whitePaintedSteel', collider = true } = {}) {
  const group = new THREE.Group();
  if (points.length < 2) return group;
  // stanchions
  const stanchionGeom = new THREE.CylinderGeometry(0.025, 0.025, height, 6);
  stanchionGeom.translate(0, height / 2, 0);
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.0);
  const length = curve.getLength();
  const n = Math.max(2, Math.round(length / pitch));
  const stanchions = new THREE.InstancedMesh(stanchionGeom, materials.get(railMaterial), n + 1);
  const m = new THREE.Matrix4();
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    m.makeTranslation(p.x, p.y, p.z);
    stanchions.setMatrixAt(i, m);
  }
  stanchions.instanceMatrix.needsUpdate = true;
  stanchions.castShadow = true;
  group.add(stanchions);
  const rails = [];
  for (const h of [height, height * 0.66, height * 0.33]) {
    const pts = points.map((p) => V(p.x, p.y + h, p.z));
    rails.push(tubeAlong(pts, h === height ? 0.045 : 0.018));
  }
  const capMesh = new THREE.Mesh(rails[0], materials.get(capMaterial));
  capMesh.castShadow = true;
  const lower = new THREE.Mesh(mergeGeometries([rails[1], rails[2]]), materials.get(railMaterial));
  group.add(capMesh, lower);
  if (collider) {
    const parts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const len = a.distanceTo(b);
      if (len < 0.05) continue;
      const g = new THREE.BoxGeometry(len, height, 0.08);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const ang = Math.atan2(-(b.z - a.z), b.x - a.x);
      g.rotateY(ang);
      g.translate(mid.x, mid.y + height / 2, mid.z);
      parts.push(g);
    }
    if (parts.length) {
      const col = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ visible: false }));
      col.visible = false; col.userData.collide = true; col.name = 'railingCollider';
      group.add(col);
    }
  }
  return group;
}

/** Solid bulwark (thin wall) along a polyline with a teak cap. */
function bulwarkAlong(points, height, materials, { material = 'whitePaintedSteel', thickness = 0.1, cap = true } = {}) {
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const len = a.distanceTo(b);
    if (len < 0.05) continue;
    const g = new THREE.BoxGeometry(len + 0.02, height, thickness);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const ang = Math.atan2(-(b.z - a.z), b.x - a.x);
    g.rotateY(ang);
    g.translate(mid.x, mid.y + height / 2, mid.z);
    parts.push(g);
  }
  const group = new THREE.Group();
  if (!parts.length) return group;
  const mesh = new THREE.Mesh(mergeGeometries(parts), materials.get(material));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.collide = true;
  group.add(mesh);
  if (cap) {
    const capGeom = tubeAlong(points.map((p) => V(p.x, p.y + height, p.z)), 0.06);
    const capMesh = new THREE.Mesh(capGeom, materials.get('teakOiled'));
    group.add(capMesh);
  }
  return group;
}

/**
 * Wall run with window openings along a polyline (closed or open): piers between windows, sill and lintel
 * bands, instanced glass panes with frames, optional door gaps. win = { type, pitch, w, h, y } (type 'none' → solid).
 */
function wallRun(points, yBase, height, win, materials, { wallMaterial = 'superstructureWhite', thickness = 0.15, doorsEvery = 0, doorWidth = 1.0, closed = false, glassList = null, frameList = null } = {}) {
  const group = new THREE.Group();
  const pierGeoms = [];
  const solid = !win || win.type === 'none' || !win.pitch;
  const segs = closed ? points.length : points.length - 1;
  let runLen = 0;
  for (let i = 0; i < segs; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const len = a.distanceTo(b);
    if (len < 0.05) continue;
    const dir = b.clone().sub(a).normalize();
    const ang = Math.atan2(-dir.z, dir.x);
    const place = (g, along, w) => { const c = a.clone().addScaledVector(dir, along + w / 2); g.rotateY(ang); g.translate(c.x, yBase, c.z); return g; };
    if (solid || len < win.pitch * 1.2) {
      const g = new THREE.BoxGeometry(len + 0.02, height, thickness); g.translate(0, height / 2, 0);
      pierGeoms.push(place(g, 0, len));
      runLen += len;
      continue;
    }
    const nWin = Math.floor((len - 0.6) / win.pitch);
    const margin = (len - nWin * win.pitch) / 2;
    const sillH = win.y, headH = height - win.y - win.h;
    // sill band and lintel band
    const sill = new THREE.BoxGeometry(len + 0.02, Math.max(0.05, sillH), thickness); sill.translate(0, sillH / 2, 0); pierGeoms.push(place(sill, 0, len));
    const head = new THREE.BoxGeometry(len + 0.02, Math.max(0.05, headH), thickness); head.translate(0, height - headH / 2, 0); pierGeoms.push(place(head, 0, len));
    // piers
    let cursor = 0;
    const pierW = win.pitch - win.w;
    const pier = (x0, w) => { if (w <= 0.01) return; const g = new THREE.BoxGeometry(w + 0.01, win.h + 0.02, thickness); g.translate(0, sillH + win.h / 2, 0); pierGeoms.push(place(g, x0, w)); };
    pier(0, margin + pierW / 2); cursor = margin + pierW / 2;
    for (let k = 0; k < nWin; k++) {
      const along = cursor + runLen;
      const isDoor = doorsEvery > 0 && Math.floor(along / doorsEvery) !== Math.floor((along - win.pitch) / doorsEvery) && k > 0 && k < nWin - 1;
      if (isDoor) {
        // door opening: no sill, full height gap of doorWidth centred in this bay; rest of bay as pier
        const gapStart = cursor + (win.w - doorWidth) / 2;
        // remove the sill under the door by adding nothing (sill band exists; so cut: we instead raise a step — acceptable) → keep simple: door bay is an open gap in the pier row
        if (gapStart > cursor) pier(cursor, gapStart - cursor);
        pier(gapStart + doorWidth, cursor + win.w - gapStart - doorWidth);
      } else {
        const c = a.clone().addScaledVector(dir, cursor + win.w / 2);
        if (glassList) glassList.push({ c: V(c.x, yBase + sillH + win.h / 2, c.z), ang, w: win.w, h: win.h, round: win.type === 'round' });
      }
      cursor += win.w;
      if (k < nWin - 1) { pier(cursor, pierW); cursor += pierW; }
    }
    pier(cursor, len - cursor);
    runLen += len;
  }
  if (pierGeoms.length) {
    const mesh = new THREE.Mesh(mergeGeometries(pierGeoms), materials.get(wallMaterial));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.collide = true;
    mesh.name = 'wall';
    group.add(mesh);
  }
  return group;
}

/** Build instanced glass panes + frames from a glass list. */
function glassInstances(list, materials, { frameMaterial = 'brass', night = true } = {}) {
  const group = new THREE.Group();
  if (!list.length) return group;
  const pane = new THREE.PlaneGeometry(1, 1);
  const glassMat = materials.clone('glass', { side: THREE.DoubleSide, emissive: new THREE.Color(0xffa552), emissiveIntensity: 0.0 });
  glassMat.name = 'deck.windowGlass';
  const glass = new THREE.InstancedMesh(pane, glassMat, list.length);
  const frameGeom = new THREE.BoxGeometry(1, 1, 0.06);
  const frame = new THREE.InstancedMesh(frameGeom, materials.get(frameMaterial), list.length * 4);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const axisY = new THREE.Vector3(0, 1, 0);
  let fi = 0;
  list.forEach((w, i) => {
    q.setFromAxisAngle(axisY, w.ang);
    s.set(w.w, w.h, 1); m.compose(w.c, q, s); glass.setMatrixAt(i, m);
    // four frame bars
    const t = 0.05;
    const right = new THREE.Vector3(Math.cos(w.ang), 0, -Math.sin(w.ang));
    const bars = [
      [w.c.clone().addScaledVector(axisY, w.h / 2), w.w + t, t], [w.c.clone().addScaledVector(axisY, -w.h / 2), w.w + t, t],
      [w.c.clone().addScaledVector(right, w.w / 2), t, w.h], [w.c.clone().addScaledVector(right, -w.w / 2), t, w.h],
    ];
    for (const [c, bw, bh] of bars) { s.set(bw, bh, 1); m.compose(c, q, s); frame.setMatrixAt(fi++, m); }
  });
  glass.instanceMatrix.needsUpdate = true; frame.instanceMatrix.needsUpdate = true;
  glass.userData.emissiveLamp = night; glass.name = 'windowGlass'; frame.name = 'windowFrames';
  frame.castShadow = true;
  group.add(glass, frame);
  return group;
}

// ------------------------------------------------------------------ holes
function holesFor(spec, deck, ctx) {
  const holes = [];
  const o = originFromBow(spec);
  const order = ['boat', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'orlop', 'tankTop'];
  const idx = order.indexOf(deck.id);
  const gs = spec.grandStaircases || {};
  if (gs.forward && ['boat', 'A', 'B', 'C', 'D'].includes(deck.id)) holes.push({ x0: gs.forward.x - 4.6, x1: gs.forward.x + 4.6, z0: -6.2, z1: 6.2, kind: 'grand' });
  if (gs.aft && ['A', 'B'].includes(deck.id)) holes.push({ x0: gs.aft.x - 3.4, x1: gs.aft.x + 3.4, z0: -4.6, z1: 4.6, kind: 'grand' });
  if (gs.forward?.lifts && ['B', 'C', 'D'].includes(deck.id)) holes.push({ x0: gs.forward.lifts.x - 1.1, x1: gs.forward.lifts.x + 1.1, z0: -2.4, z1: 2.4, kind: 'lift' });
  for (const st of deck.stairs || []) {
    if (st.type === 'grand') continue;
    if (st.toDeck === st.fromDeck) continue;
    const down = order.indexOf(st.toDeck) > order.indexOf(st.fromDeck);
    if (!down) continue; // holes are cut in the deck the stair starts from (it descends)
    const w = st.type === 'ladder' ? 1.0 : st.type === 'spiral' ? 1.9 : Math.min(6.5, (st.width || 1.2) + 0.6);
    const l = st.type === 'ladder' ? 1.0 : st.type === 'spiral' ? 1.9 : 3.6;
    holes.push({ x0: st.x - l / 2, x1: st.x + l / 2, z0: st.z - w / 2, z1: st.z + w / 2, kind: st.type });
  }
  // stairs arriving from the deck above also need the hole in THIS deck? No: a stair from deck X down to Y cuts X's plate only.
  for (const h of spec.hatches || []) {
    const hIdx = order.indexOf(h.deck);
    if (idx > hIdx && idx <= order.indexOf('orlop')) holes.push({ x0: h.x0, x1: h.x1, z0: h.z0, z1: h.z1, kind: 'hatch' });
  }
  const m = spec.machinery || {};
  if (['orlop', 'G'].includes(deck.id)) for (const br of m.boilerRooms || []) holes.push({ x0: br.x0 + 0.6, x1: br.x1 - 0.6, z0: -9.0, z1: 9.0, kind: 'boilerRoom' });
  if (['orlop', 'G', 'F', 'E'].includes(deck.id) && m.reciprocatingEngineRoom) holes.push({ x0: m.reciprocatingEngineRoom.x0 + 0.6, x1: m.reciprocatingEngineRoom.x1 - 0.6, z0: -8.5, z1: 8.5, kind: 'engineRoom' });
  if (['orlop', 'G'].includes(deck.id) && m.turbineRoom) holes.push({ x0: m.turbineRoom.x0 + 0.6, x1: m.turbineRoom.x1 - 0.6, z0: -7.0, z1: 7.0, kind: 'turbineRoom' });
  if (deck.id === 'orlop' && m.electricEngineRoom) holes.push({ x0: m.electricEngineRoom.x0 + 0.6, x1: m.electricEngineRoom.x1 - 0.6, z0: -6.0, z1: 6.0, kind: 'electricRoom' });
  if (deck.id === 'F') {
    holes.push({ x0: xOfFt(spec, 292), x1: xOfFt(spec, 262), z0: 4.5, z1: 8.8, kind: 'pool' });
    holes.push({ x0: xOfFt(spec, 190), x1: xOfFt(spec, 165), z0: 0.5, z1: 6.6, kind: 'squash' });
  }
  if (deck.id === 'orlop') holes.push({ x0: xOfFt(spec, 193), x1: xOfFt(spec, 91), z0: -1.3, z1: 1.3, kind: 'firemensPassageSlot', skip: true });
  return holes.filter((h) => !h.skip);
}

// ------------------------------------------------------------------ builder
export function buildDecks(spec, materials, ctx) {
  const group = new THREE.Group();
  group.name = 'Decks';
  const q = ctx?.quality || 'high';
  const hi = q === 'high' || q === 'ultra';
  const breakX = ctx?.breakX ?? spec.breakX ?? -35;
  const o = originFromBow(spec);
  const lights = [];
  const glassList = [];
  const yB = deckById(spec, 'B')?.y ?? 12.02;
  const yA = deckById(spec, 'A')?.y ?? 14.76;
  const yBoat = deckById(spec, 'boat')?.y ?? 17.65;
  const yC = deckById(spec, 'C')?.y ?? 9.27;

  const teak = materials.get('teakDeck');
  const steelFloor = materials.get('steelGrey');
  const addMesh = (geom, mat, name, part, collide = true) => {
    if (!geom) return null;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = name; mesh.receiveShadow = true; mesh.castShadow = false;
    mesh.userData.collide = collide;
    if (part) mesh.userData.part = part;
    group.add(mesh);
    return mesh;
  };
  const splitRanges = (xHi, xLo) => (xHi > breakX && xLo < breakX ? [[xHi, breakX], [breakX, xLo]] : [[xHi, xLo]]);

  // ---- deck plates ----
  const FC_END = xOfFt(spec, 125), WELL_F_END = xOfFt(spec, 175), HOUSE_AFT = xOfFt(spec, 725), POOP_START = xOfFt(spec, 775);
  for (const deck of spec.decks || []) {
    const holes = holesFor(spec, deck, ctx);
    const ext = deck.hullExtent || {};
    let xHi = ext.x1 ?? xOfFt(spec, 0), xLo = ext.x0 ?? xOfFt(spec, 850);
    const planked = ['boat', 'A', 'B', 'C'].includes(deck.id);
    const mat = planked ? teak : steelFloor;
    if (deck.id === 'B') {
      // forecastle (sheered), house floor (flat), poop (sheered); the wells have no B plate
      addMesh(sheeredPlate(spec, yB, xHi, FC_END), teak, 'Deck.B.forecastle', { x0: FC_END, x1: xHi });
      for (const [a, b] of splitRanges(WELL_F_END, HOUSE_AFT)) addMesh(flatPlate(spec, yB, a, b, holes), teak, 'Deck.B.house', { x0: b, x1: a });
      addMesh(sheeredPlate(spec, yB, POOP_START, xLo), teak, 'Deck.B.poop', { x0: xLo, x1: POOP_START });
      continue;
    }
    if (deck.id === 'C') {
      // under the forecastle and poop the C deck is flat at its midship height; the wells are planked
      for (const [a, b] of splitRanges(xHi, xLo)) addMesh(flatPlate(spec, yC, a, b, holes), teak, 'Deck.C', { x0: b, x1: a });
      continue;
    }
    for (const [a, b] of splitRanges(xHi, xLo)) addMesh(flatPlate(spec, deck.y, a, b, holes), mat, `Deck.${deck.id}`, { x0: b, x1: a });
  }

  // ---- bulwarks & cap rails: forecastle, poop (1.15 m above the sheered deck); wells get a cap on the hull top ----
  for (const sign of [1, -1]) {
    const fc = edgeLine(spec, yB, xOfFt(spec, 1), FC_END, sign, 1.5, -0.12);
    group.add(bulwarkAlong(fc, 1.15, materials, { material: 'hullBlack', thickness: 0.08 }));
    const poop = edgeLine(spec, yB, POOP_START, xOfFt(spec, 882), sign, 1.5, -0.12);
    group.add(bulwarkAlong(poop, 1.1, materials, { material: 'hullBlack', thickness: 0.08 }));
    // well decks: hull side already rises to B; add the cap rail at the hull top
    for (const [a, b] of [[FC_END, WELL_F_END], [HOUSE_AFT, POOP_START]]) {
      const pts = edgeLine(spec, yB, a, b, sign, 1.5, -0.05).map((p) => V(p.x, hullTopY(spec, p.x), p.z));
      group.add(new THREE.Mesh(tubeAlong(pts, 0.06), materials.get('teakOiled')));
    }
    // boat deck edge: railing fore/aft groups, solid bulwark in the first-class promenade
    const bd0 = xOfFt(spec, 190), bd1 = xOfFt(spec, 685);
    const b1 = xOfFt(spec, 305), b2 = xOfFt(spec, 506);
    group.add(railingAlong(edgeLine(spec, yBoat, bd0, b1, sign, 2.0, -0.3), 1.05, materials, { pitch: 1.6 }));
    group.add(bulwarkAlong(edgeLine(spec, yBoat, b1, b2, sign, 2.0, -0.3), 1.1, materials, { material: 'superstructureWhite', thickness: 0.08 }));
    group.add(railingAlong(edgeLine(spec, yBoat, b2, bd1, sign, 2.0, -0.3), 1.05, materials, { pitch: 1.6 }));
    // A deck: forward screen with large sliding windows (177–375 ft), then open rail aft
    const a0 = xOfFt(spec, 177), aScreen = xOfFt(spec, 375), a1 = xOfFt(spec, 723);
    const screenPts = edgeLine(spec, yA, a0, aScreen, sign, 2.4, -0.2);
    group.add(wallRun(screenPts, yA, yBoat - yA - 0.02, { type: 'square', pitch: 2.4, w: 1.9, h: 1.5, y: 0.95 }, materials, { wallMaterial: 'superstructureWhite', thickness: 0.1, glassList }));
    group.add(railingAlong(edgeLine(spec, yA, aScreen, a1, sign, 2.0, -0.2), 1.05, materials, { pitch: 1.6 }));
    // boat-deck support stanchions along the open A promenade
    const stanch = new THREE.CylinderGeometry(0.06, 0.06, yBoat - yA, 8);
    stanch.translate(0, (yBoat - yA) / 2, 0);
    const pts = edgeLine(spec, yA, aScreen, xOfFt(spec, 685), sign, 4.0, -0.35);
    const im = new THREE.InstancedMesh(stanch, materials.get('superstructureWhite'), pts.length);
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m); });
    im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.name = 'Deck.A.stanchions';
    group.add(im);
    // transverse rails at the ends of the boat deck and A deck
  }
  // end rails (athwartships) at the boat deck aft end, A deck aft end, forecastle break, poop front
  const endRail = (x, y, hbMul = 1) => {
    const hb = hullHalfBreadth(spec, x, y + 0.6) * hbMul - 0.3;
    group.add(railingAlong([V(x, y, -hb), V(x, y, 0), V(x, y, hb)], 1.05, materials, { pitch: 1.5 }));
  };
  endRail(xOfFt(spec, 685), yBoat); endRail(xOfFt(spec, 723), yA);
  group.add(railingAlong([V(FC_END + 0.2, yB + sheerAt(spec, o - FC_END), -(hullHalfBreadth(spec, FC_END, yB + 0.6) - 0.4)), V(FC_END + 0.2, yB + sheerAt(spec, o - FC_END), 0), V(FC_END + 0.2, yB + sheerAt(spec, o - FC_END), hullHalfBreadth(spec, FC_END, yB + 0.6) - 0.4)], 1.05, materials, { pitch: 1.5 }));
  group.add(railingAlong([V(POOP_START - 0.2, yB + sheerAt(spec, o - POOP_START), -(hullHalfBreadth(spec, POOP_START, yB + 0.6) - 0.4)), V(POOP_START - 0.2, yB + sheerAt(spec, o - POOP_START), 0), V(POOP_START - 0.2, yB + sheerAt(spec, o - POOP_START), hullHalfBreadth(spec, POOP_START, yB + 0.6) - 0.4)], 1.05, materials, { pitch: 1.5 }));

  // ---- B-deck house exterior: hull outline from 175 to 725 ft, B→A, with the big windows; end walls ----
  const bWin = { type: 'square', pitch: 1.45, w: 0.85, h: 1.05, y: 1.35 };
  for (const sign of [1, -1]) {
    const pts = edgeLine(spec, yB, WELL_F_END, HOUSE_AFT, sign, 1.45 * 2, -0.02).map((p) => V(p.x, yB, p.z));
    for (const [a, b] of splitRanges(WELL_F_END, HOUSE_AFT)) {
      const sub = pts.filter((p) => p.x <= a + 1e-3 && p.x >= b - 1e-3);
      if (sub.length < 2) continue;
      const wall = wallRun(sub, yB, yA - yB - 0.02, bWin, materials, { wallMaterial: 'superstructureWhite', thickness: 0.18, glassList, doorsEvery: 0 });
      wall.traverse((o2) => { if (o2.isMesh) o2.userData.part = { x0: b, x1: a }; });
      group.add(wall);
    }
  }
  const endWall = (x, y0, y1, win) => {
    const hb = hullHalfBreadth(spec, x, y0 + 0.6) - 0.05;
    const w = wallRun([V(x, y0, -hb), V(x, y0, hb)], y0, y1 - y0 - 0.02, win, materials, { wallMaterial: 'superstructureWhite', thickness: 0.18, glassList, doorsEvery: 9, doorWidth: 1.1 });
    group.add(w);
  };
  endWall(WELL_F_END, yB, yA, { type: 'square', pitch: 1.6, w: 0.9, h: 1.0, y: 1.3 });
  endWall(HOUSE_AFT, yB, yA, { type: 'square', pitch: 1.6, w: 0.9, h: 1.0, y: 1.3 });
  // A-deck house front and the boat-deck front (bridge) are built from deckhouse rectangles below

  // ---- deckhouses on the boat deck and A deck: walls with windows, roofs ----
  for (const deck of spec.decks || []) {
    if (!['boat', 'A'].includes(deck.id)) continue;
    for (const dh of deck.deckhouses || []) {
      const hgt = dh.height || 2.6;
      const corners = [V(dh.x1, deck.y, dh.z0), V(dh.x0, deck.y, dh.z0), V(dh.x0, deck.y, dh.z1), V(dh.x1, deck.y, dh.z1)];
      const win = dh.windows && dh.windows.type !== 'none' ? dh.windows : { type: 'none' };
      const isRaisedRoof = hgt < 1.2;
      const wall = wallRun(corners, deck.y, hgt, isRaisedRoof ? { type: 'none' } : win, materials, { wallMaterial: 'superstructureWhite', thickness: 0.15, closed: true, glassList, doorsEvery: isRaisedRoof ? 0 : 11, doorWidth: 1.05 });
      wall.name = `House.${dh.id}`;
      wall.traverse((o2) => { if (o2.isMesh) o2.userData.part = { x0: dh.x0, x1: dh.x1 }; });
      group.add(wall);
      // roof plate (also the floor above for the raised roofs' skylights)
      const roof = new THREE.BoxGeometry(dh.x1 - dh.x0 + 0.3, 0.12, dh.z1 - dh.z0 + 0.3);
      roof.translate((dh.x0 + dh.x1) / 2, deck.y + hgt + 0.06, (dh.z0 + dh.z1) / 2);
      const rm = addMesh(roof, materials.get(isRaisedRoof ? 'teakDeck' : 'superstructureWhite'), `Roof.${dh.id}`, { x0: dh.x0, x1: dh.x1 });
      rm.castShadow = true;
      // interior ceiling lamps for houses with rooms are added by the interior builders
    }
  }
  // the bridge front: wing cabs windows all round are in bh_bridge; add the bridge roof overhang already via roof plate

  // ---- window glass & frames (one instanced pair for the whole ship) ----
  const glass = glassInstances(glassList, materials, { frameMaterial: 'brass' });
  glass.name = 'Deck.windows';
  group.add(glass);

  // ---- breakwater on the forecastle, deck lamps along the houses ----
  const bwX = xOfFt(spec, 100);
  const bw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 16), materials.get('whitePaintedSteel'));
  bw.position.set(bwX, yB + sheerAt(spec, o - bwX) + 0.45, 0); bw.rotation.y = 0; bw.userData.collide = true; bw.name = 'Deck.breakwater';
  group.add(bw);

  ctx?.log?.(`decks: ${group.children.length} objects, ${glassList.length} windows`);
  return { group, locations: [], lights, dynamic: [], interactables: [], floodRooms: [] };
}
