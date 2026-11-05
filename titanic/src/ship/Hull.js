/**
 * Hull builder — lofts SHIP.hull.stations into the plated hull (ARCHITECTURE.md §5).
 * Exports helpers used by the other builders:
 *   hullHalfBreadth(spec, x, y)  half-breadth (m) of the hull skin at frame x and height y
 *   hullTopY(spec, x)            deck-edge height (B deck + sheer) at frame x
 *   hullBottomY(spec, x)         keel / counter underside at frame x
 *   hullOutline(spec, y, step)   [[x, halfBreadth], ...] plan outline at height y (bow → stern)
 *   sheerAt(spec, xFromBow)      sheer offset (m) at a distance from the bow
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNameplate } from '../materials/ProceduralTextures.js';
import { makeAnchor } from './Props.js';

const FT = 0.3048;

// ------------------------------------------------------------------ station interpolation
function stationsOf(spec) {
  if (!spec.__stations) {
    const list = [...(spec.hull?.stations || [])].sort((a, b) => b.x - a.x); // bow (large x) → stern
    spec.__stations = list;
  }
  return spec.__stations;
}

function hbInStation(st, y) {
  const hbs = st.halfBreadths;
  if (!hbs || !hbs.length) return 0;
  if (y <= hbs[0][0]) return y < hbs[0][0] - 0.05 ? 0 : hbs[0][1];
  for (let i = 1; i < hbs.length; i++) {
    if (y <= hbs[i][0]) {
      const [y0, h0] = hbs[i - 1];
      const [y1, h1] = hbs[i];
      const t = y1 === y0 ? 1 : (y - y0) / (y1 - y0);
      return h0 + (h1 - h0) * t;
    }
  }
  return hbs[hbs.length - 1][1]; // above the deck edge: bulwark continues the top breadth
}

function bracket(spec, x) {
  const st = stationsOf(spec);
  if (!st.length) return null;
  if (x >= st[0].x) return [st[0], st[0], 0];
  if (x <= st[st.length - 1].x) return [st[st.length - 1], st[st.length - 1], 0];
  for (let i = 1; i < st.length; i++) {
    if (x >= st[i].x) {
      const a = st[i - 1], b = st[i];
      const t = a.x === b.x ? 0 : (a.x - x) / (a.x - b.x);
      return [a, b, t];
    }
  }
  return [st[st.length - 1], st[st.length - 1], 0];
}

export function hullHalfBreadth(spec, x, y) {
  const br = bracket(spec, x);
  if (!br) return ((spec.dims && spec.dims.beamMoulded) || 28.2) / 2;
  const [a, b, t] = br;
  const ha = hbInStation(a, y), hb = hbInStation(b, y);
  return ha + (hb - ha) * t;
}

export function hullTopY(spec, x) {
  const br = bracket(spec, x);
  if (!br) return (spec.decks?.find((d) => d.id === 'B')?.y) ?? 12;
  const [a, b, t] = br;
  return a.yTop + (b.yTop - a.yTop) * t;
}

export function hullBottomY(spec, x) {
  const br = bracket(spec, x);
  if (!br) return -10.5;
  const [a, b, t] = br;
  return a.yBottom + (b.yBottom - a.yBottom) * t;
}

export function sheerAt(spec, xFromBow) {
  const p = spec.hull?.sheerProfile;
  if (!p || !p.length) return 0;
  if (xFromBow <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (xFromBow <= p[i][0]) {
      const t = (xFromBow - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
    }
  }
  return p[p.length - 1][1];
}

/** Plan outline at height y from bow to stern: [[x, halfBreadth], ...] (only where the hull exists at that height). */
export function hullOutline(spec, y, step = 2.0) {
  const st = stationsOf(spec);
  if (!st.length) return [];
  const out = [];
  const xBow = st[0].x, xStern = st[st.length - 1].x;
  for (let x = xBow; x >= xStern; x -= step) {
    const hb = hullHalfBreadth(spec, x, y);
    if (hb > 0.02 && y >= hullBottomY(spec, x) - 0.01) out.push([x, hb]);
  }
  return out;
}

// ------------------------------------------------------------------ lofting
function columnsBetween(spec, xHi, xLo) {
  // Sample columns from x = xHi down to xLo: all stations in range plus 3 subdivisions between them.
  const st = stationsOf(spec);
  const xs = new Set([xHi, xLo]);
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i].x, b = st[i + 1].x;
    for (let k = 0; k <= 3; k++) {
      const x = a + (b - a) * (k / 4);
      if (x <= xHi + 1e-6 && x >= xLo - 1e-6) xs.add(x);
    }
  }
  return [...xs].sort((p, q) => q - p);
}

/** Loft one side (sign ±1) of a vertical band between yLow(x) and yHigh(x). Returns a BufferGeometry (non-indexed). */
function loftBand(spec, xs, yLowFn, yHighFn, rows, sign, plateW, plateH) {
  const cols = xs.map((x) => {
    const lo = yLowFn(x), hi = yHighFn(x);
    const ys = [], hbs = [];
    for (let i = 0; i <= rows; i++) {
      const y = lo + (hi - lo) * (i / rows);
      ys.push(y);
      hbs.push(hullHalfBreadth(spec, x, y));
    }
    return { x, ys, hbs, lo, hi };
  });
  const pos = [], uv = [];
  const push = (c, i) => { pos.push(c.x, c.ys[i], sign * c.hbs[i]); uv.push(c.x / plateW, c.ys[i] / plateH); };
  for (let j = 0; j < cols.length - 1; j++) {
    const a = cols[j], b = cols[j + 1];
    if (a.hi - a.lo < 1e-4 && b.hi - b.lo < 1e-4) continue;
    for (let i = 0; i < rows; i++) {
      // two triangles per quad; winding so that +z side faces +z (checked against DoubleSide anyway)
      if (sign > 0) {
        push(a, i); push(b, i); push(b, i + 1);
        push(a, i); push(b, i + 1); push(a, i + 1);
      } else {
        push(a, i); push(b, i + 1); push(b, i);
        push(a, i); push(a, i + 1); push(b, i + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Bottom plate / counter underside: joins the lowest ring of both sides. */
function loftBottom(spec, xs, plateW, plateH) {
  const pos = [], uv = [];
  const N = 6;
  for (let j = 0; j < xs.length - 1; j++) {
    const xa = xs[j], xb = xs[j + 1];
    const ya = hullBottomY(spec, xa), yb = hullBottomY(spec, xb);
    const ha = hullHalfBreadth(spec, xa, ya + 0.02), hb = hullHalfBreadth(spec, xb, yb + 0.02);
    for (let k = 0; k < N; k++) {
      const t0 = -1 + (2 * k) / N, t1 = -1 + (2 * (k + 1)) / N;
      const p = (x, y, z) => { pos.push(x, y, z); uv.push(x / plateW, z / plateH); };
      p(xa, ya, ha * t0); p(xb, yb, hb * t1); p(xb, yb, hb * t0);
      p(xa, ya, ha * t0); p(xa, ya, ha * t1); p(xb, yb, hb * t1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Thin ribbon following the hull at height y (sheer stripe). */
function ribbon(spec, xs, yFn, height, sign, offset = 0.02) {
  const pos = [], uv = [];
  for (let j = 0; j < xs.length - 1; j++) {
    const xa = xs[j], xb = xs[j + 1];
    const ya = yFn(xa), yb = yFn(xb);
    const pa = (y) => sign * (hullHalfBreadth(spec, xa, y) + offset);
    const pb = (y) => sign * (hullHalfBreadth(spec, xb, y) + offset);
    const push = (x, y, z) => { pos.push(x, y, z); uv.push(x / 4, (y - ya) / height); };
    const a0 = [xa, ya - height / 2, pa(ya)], a1 = [xa, ya + height / 2, pa(ya)];
    const b0 = [xb, yb - height / 2, pb(yb)], b1 = [xb, yb + height / 2, pb(yb)];
    if (sign > 0) { push(...a0); push(...b0); push(...b1); push(...a0); push(...b1); push(...a1); } else { push(...a0); push(...b1); push(...b0); push(...a0); push(...a1); push(...b1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ builder
export function buildHull(spec, materials, ctx) {
  const group = new THREE.Group();
  group.name = 'Hull';
  const quality = ctx?.quality || 'high';
  const hi = quality === 'ultra' || quality === 'high';
  const stations = stationsOf(spec);
  if (!stations.length) return { group, locations: [], lights: [], dynamic: [], interactables: [], floodRooms: [] };

  const xBow = stations[0].x, xStern = stations[stations.length - 1].x;
  const breakX = ctx?.breakX ?? spec.breakX ?? -35;
  const plating = spec.hull.platingAndRivets || { plateW: 9.1, plateH: 1.8 };
  const bands = spec.hull.paintBands || { antifoulingTopY: -0.9, sheerStripeHeight: 0.3 };
  const yAnti = bands.antifoulingTopY ?? -0.9;

  const matRed = materials.clone('antifouling', { side: THREE.DoubleSide });
  const matBlack = materials.clone('hullBlackRiveted', { side: THREE.DoubleSide });
  const matStripe = materials.clone('sheerStripe', { side: THREE.DoubleSide });
  materials.setRepeat?.(matBlack, plating.plateW, plating.plateH);
  materials.setRepeat?.(matRed, plating.plateW, plating.plateH);
  matRed.name = 'hull.antifouling'; matBlack.name = 'hull.black'; matStripe.name = 'hull.sheerStripe';

  const rowsLow = hi ? 8 : 5, rowsHigh = hi ? 14 : 8;
  const topY = (x) => hullTopY(spec, x);
  const botY = (x) => hullBottomY(spec, x);
  const lowHi = (x) => Math.max(botY(x), Math.min(yAnti, topY(x)));

  const sections = [
    { name: 'bow', xHi: xBow, xLo: breakX, part: { x0: breakX, x1: xBow } },
    { name: 'stern', xHi: breakX, xLo: xStern, part: { x0: xStern, x1: breakX } },
  ];
  for (const sec of sections) {
    const xs = columnsBetween(spec, sec.xHi, sec.xLo);
    const red = mergeGeometries([
      loftBand(spec, xs, botY, lowHi, rowsLow, +1, plating.plateW, plating.plateH),
      loftBand(spec, xs, botY, lowHi, rowsLow, -1, plating.plateW, plating.plateH),
      loftBottom(spec, xs, plating.plateW, plating.plateH),
    ]);
    const black = mergeGeometries([
      loftBand(spec, xs, lowHi, topY, rowsHigh, +1, plating.plateW, plating.plateH),
      loftBand(spec, xs, lowHi, topY, rowsHigh, -1, plating.plateW, plating.plateH),
    ]);
    const stripe = mergeGeometries([
      ribbon(spec, xs, (x) => topY(x) - 0.25, bands.sheerStripeHeight || 0.3, +1),
      ribbon(spec, xs, (x) => topY(x) - 0.25, bands.sheerStripeHeight || 0.3, -1),
    ]);
    for (const [geom, mat, name, collide] of [[red, matRed, 'antifouling', true], [black, matBlack, 'plating', true], [stripe, matStripe, 'sheerStripe', false]]) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = `Hull.${sec.name}.${name}`;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.collide = collide;
      mesh.userData.part = sec.part;
      group.add(mesh);
    }
  }

  // ---- portholes (instanced ring + emissive glass) ----
  const rows = spec.hull.portholeRows || [];
  const transforms = [];
  for (const row of rows) {
    const pitch = row.pitch || 1.0;
    for (let ft = row.xFromBowStart; ft <= row.xFromBowEnd; ft += pitch / FT) {
      const x = (spec.frame?.originXFromBowM ?? 129.54) - ft * FT;
      const y = row.y;
      if (y < botY(x) + 0.4 || y > topY(x) - 0.35) continue;
      const hb = hullHalfBreadth(spec, x, y);
      if (hb < 1.0) continue;
      const slope = (hullHalfBreadth(spec, x + 0.5, y) - hullHalfBreadth(spec, x - 0.5, y)); // d(hb)/dx per metre
      for (const sign of [1, -1]) {
        const n = new THREE.Vector3(-slope * sign, 0, sign).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        transforms.push({ p: new THREE.Vector3(x, y, sign * (hb + 0.015)), q, s: (row.diameter || 0.4) / 0.4 });
      }
    }
  }
  if (transforms.length) {
    const ring = new THREE.TorusGeometry(0.2, 0.035, 8, hi ? 20 : 12);
    const glass = new THREE.CircleGeometry(0.19, hi ? 20 : 12);
    const ringMesh = new THREE.InstancedMesh(ring, materials.get('brass'), transforms.length);
    const glassMat = materials.clone('glassFrosted', { emissive: new THREE.Color(0xffa552), emissiveIntensity: 1.6, transparent: false, opacity: 1, roughness: 0.4 });
    glassMat.userData.daylightDim = true;   // porthole glow fades out by day (Ship.setDaylight)
    glassMat.name = 'hull.portholeGlass';
    const glassMesh = new THREE.InstancedMesh(glass, glassMat, transforms.length);
    glassMesh.userData.emissiveLamp = true;
    const m = new THREE.Matrix4();
    transforms.forEach((t, i) => {
      m.compose(t.p, t.q, new THREE.Vector3(t.s, t.s, t.s));
      ringMesh.setMatrixAt(i, m);
      glassMesh.setMatrixAt(i, m);
    });
    ringMesh.instanceMatrix.needsUpdate = true; glassMesh.instanceMatrix.needsUpdate = true;
    ringMesh.name = 'Hull.portholeRings'; glassMesh.name = 'Hull.portholeGlass';
    ringMesh.castShadow = false; glassMesh.castShadow = false;
    // portholes are split by x for the break-up by bounding box (InstancedMesh bbox covers all) → assign by majority: tag as stern/bow halves
    group.add(ringMesh, glassMesh);
  }

  // ---- nameplates ----
  const np = spec.hull.nameplates || {};
  const addName = (text, height, xFromBow, y, sign, colour, text2, height2) => {
    const tex = makeNameplate({ text, color: colour || '#C9A227', font: 'bold 160px Georgia, "Times New Roman", serif' });
    const w = text.length * height * 0.78;
    const x = (spec.frame?.originXFromBowM ?? 129.54) - xFromBow;
    const hb = hullHalfBreadth(spec, x, y);
    const n = new THREE.Vector3(-(hullHalfBreadth(spec, x + 0.5, y) - hullHalfBreadth(spec, x - 0.5, y)) * sign, 0, sign).normalize();
    const mat = new THREE.MeshStandardMaterial({ map: tex.map, transparent: true, roughness: 0.5, metalness: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, height * 1.4), mat);
    mesh.position.set(x, y, sign * (hb + 0.03));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    if (sign < 0) mesh.rotateY(0); // texture already faces +n
    mesh.name = `Hull.name.${text}`;
    group.add(mesh);
    if (text2) {
      const tex2 = makeNameplate({ text: text2, color: colour || '#C9A227', font: 'bold 160px Georgia, "Times New Roman", serif' });
      const mat2 = mat.clone(); mat2.map = tex2.map;
      const m2 = new THREE.Mesh(new THREE.PlaneGeometry(text2.length * (height2 || height * 0.66) * 0.78, (height2 || height * 0.66) * 1.4), mat2);
      m2.position.set(x, y - height * 1.3, sign * (hullHalfBreadth(spec, x, y - height * 1.3) + 0.03));
      m2.quaternion.copy(mesh.quaternion);
      group.add(m2);
    }
  };
  if (np.bow) { addName(np.bow.text, np.bow.height, np.bow.xFromBow + np.bow.text.length * np.bow.height * 0.4, np.bow.y, +1, np.bow.colour); addName(np.bow.text, np.bow.height, np.bow.xFromBow + np.bow.text.length * np.bow.height * 0.4, np.bow.y, -1, np.bow.colour); }
  if (np.stern) {
    // stern name on the counter, facing aft: place a plane at the extreme stern facing -x
    const tex = makeNameplate({ text: np.stern.text, color: np.stern.colour || '#C9A227', font: 'bold 160px Georgia, serif' });
    const tex2 = makeNameplate({ text: np.stern.text2 || 'LIVERPOOL', color: np.stern.colour || '#C9A227', font: 'bold 160px Georgia, serif' });
    const x = (spec.frame?.originXFromBowM ?? 129.54) - np.stern.xFromBow;
    const y = np.stern.y;
    const mk = (t, h, yy) => {
      const mat = new THREE.MeshStandardMaterial({ map: t.map, transparent: true, roughness: 0.5, metalness: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry((np.stern.text.length) * h * 0.78, h * 1.4), mat);
      // find the hull x where the stern skin is at this y (the counter is raked): march aft until hb ~ 0
      let xx = x; while (hullHalfBreadth(spec, xx, yy) < 0.3 && xx < x + 6) xx += 0.1;
      mesh.position.set(xx - 0.25, yy, 0);
      mesh.rotation.y = -Math.PI / 2; // face aft (-x)
      mesh.rotation.x = -0.25;
      return mesh;
    };
    group.add(mk(tex, np.stern.height, y), mk(tex2, np.stern.height2 || np.stern.height * 0.66, y - np.stern.height * 1.5));
  }

  // ---- propellers, rudder, bilge keels, anchors ----
  const bronze = materials.get('bronze');
  for (const p of spec.hull.propellers || []) {
    const prop = new THREE.Group();
    prop.name = `Hull.propeller.${p.side}`;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(p.diameter * 0.09, p.diameter * 0.11, p.diameter * 0.3, 16), bronze);
    hub.rotation.z = Math.PI / 2;
    prop.add(hub);
    const bladeGeom = new THREE.CylinderGeometry(p.diameter * 0.18, p.diameter * 0.07, p.diameter * 0.46, 10, 1, false);
    bladeGeom.scale(1, 1, 0.14);
    for (let i = 0; i < (p.blades || 3); i++) {
      const b = new THREE.Mesh(bladeGeom, bronze);
      b.position.y = p.diameter * 0.26;
      b.rotation.y = 0.55;
      const pivot = new THREE.Group();
      pivot.add(b);
      pivot.rotation.x = (i / (p.blades || 3)) * Math.PI * 2;
      prop.add(pivot);
    }
    prop.position.set(p.x, p.y, p.z);
    prop.userData.part = { x0: p.x - 2, x1: p.x + 2 };
    prop.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    group.add(prop);
  }
  const r = spec.hull.rudder;
  if (r) {
    const shape = new THREE.Shape();
    const top = r.top, bottom = r.bottom, chord = r.chord;
    shape.moveTo(0, top);
    shape.lineTo(-chord * 0.35, top);
    shape.bezierCurveTo(-chord * 1.1, top - 1, -chord * 1.15, bottom + 3, -chord * 0.6, bottom);
    shape.lineTo(0.3, bottom);
    shape.lineTo(0.3, top);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    geom.translate(0, 0, -0.25);
    const rudder = new THREE.Mesh(geom, materials.clone('hullBlack', { side: THREE.DoubleSide }));
    rudder.position.set(r.x, 0, 0);
    rudder.name = 'Hull.rudder';
    rudder.castShadow = true;
    rudder.userData.part = { x0: r.x - 6, x1: r.x + 1 };
    group.add(rudder);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, top - bottom + 1.0, 12), materials.get('ironDark'));
    post.position.set(r.x + 0.1, (top + bottom) / 2 + 0.3, 0);
    post.userData.part = rudder.userData.part;
    group.add(post);
  }
  const bk = spec.hull.bilgeKeels;
  if (bk) {
    const x0 = (spec.frame?.originXFromBowM ?? 129.54) - bk.xFromBow1, x1 = (spec.frame?.originXFromBowM ?? 129.54) - bk.xFromBow0;
    for (const sign of [1, -1]) {
      const segs = 12;
      const parts = [];
      for (let i = 0; i < segs; i++) {
        const xa = x1 + (x0 - x1) * (i / segs), xb = x1 + (x0 - x1) * ((i + 1) / segs);
        const y = -10.54 + 2.2;
        const hb = (hullHalfBreadth(spec, (xa + xb) / 2, y) + hullHalfBreadth(spec, (xa + xb) / 2, y - 1.2)) / 2;
        const g = new THREE.BoxGeometry(Math.abs(xa - xb), 0.12, bk.depth || 0.64);
        g.translate((xa + xb) / 2, y - 0.4, sign * (hb + (bk.depth || 0.64) * 0.35));
        g.rotateX(0); parts.push(g);
      }
      const mesh = new THREE.Mesh(mergeGeometries(parts), matRed);
      mesh.name = `Hull.bilgeKeel.${sign > 0 ? 'stbd' : 'port'}`;
      mesh.userData.part = { x0, x1 };
      group.add(mesh);
    }
  }
  const anchors = spec.hull.anchors;
  if (anchors) {
    for (const a of anchors.bower || []) {
      const an = makeAnchor(materials, { size: 3.6 });
      const hb = hullHalfBreadth(spec, a.x, a.y);
      an.position.set(a.x, a.y - 1.8, Math.sign(a.z) * (hb + 0.15));
      an.rotation.y = Math.sign(a.z) > 0 ? 0 : Math.PI;
      an.rotation.x = Math.sign(a.z) > 0 ? -Math.PI / 2 : Math.PI / 2;
      an.name = 'Hull.bowerAnchor';
      group.add(an);
      const hawse = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 8, 16), materials.get('ironDark'));
      hawse.position.set(a.x, a.y + 0.2, Math.sign(a.z) * (hb + 0.02));
      group.add(hawse);
    }
  }

  group.traverse((o) => { if (o.isMesh && o.userData.part === undefined && o.userData.collide === undefined) o.userData.collide = false; });
  ctx?.log?.(`hull: ${stations.length} stations, portholes ${transforms.length}`);
  return { group, locations: [], lights: [], dynamic: [], interactables: [], floodRooms: [] };
}
