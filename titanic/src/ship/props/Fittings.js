/**
 * Ship fittings and machinery props (part of the Props factory, ARCHITECTURE.md §5): bollards, ventilators,
 * skylights, davits, lifeboats, boilers, engine cylinders, gauges, valve wheels, telegraphs, ship's wheel,
 * binnacle, the Grand Staircase clock, cherub statue, plaques, the Renault, bathtub, sink, gym machines,
 * hatches, cranes, anchors.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNameplate } from '../../materials/ProceduralTextures.js';
import { cachedGeometry, mesh, box, cyl, collider, lampGlobe } from '../Props.js';

const group = (name) => { const g = new THREE.Group(); g.name = name; return g; };

export function makeBollard(m, {} = {}) {
  const g = group('bollard');
  g.add(box(m, 1.1, 0.12, 0.5, 'ironDark', { y: 0.06 }));
  for (const dx of [-0.3, 0.3]) { g.add(cyl(m, 0.14, 0.16, 0.6, 'ironDark', { x: dx, y: 0.36 }, 12)); g.add(cyl(m, 0.18, 0.14, 0.08, 'ironDark', { x: dx, y: 0.68 }, 12)); }
  collider(g, 1.1, 0.75, 0.5);
  return g;
}

export function makeVentilator(m, { kind = 'cowl', h = 1.5 } = {}) {
  const g = group(`ventilator.${kind}`);
  const white = m.get('whitePaintedSteel');
  if (kind === 'mushroom') {
    g.add(cyl(m, 0.3, 0.3, h, white, { collide: true }, 14));
    g.add(cyl(m, 0.55, 0.45, 0.18, white, { y: h + 0.09 }, 16));
    return g;
  }
  if (kind === 'goose') {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * 0.7, 0), new THREE.Vector3(0, h, 0.1), new THREE.Vector3(0, h * 0.9, 0.35)]);
    g.add(mesh(cachedGeometry(`tube:goose:${h}`, () => new THREE.TubeGeometry(curve, 12, 0.12, 10, false)), white, { collide: false }));
    return g;
  }
  // cowl: tube + bell mouth facing +z
  g.add(cyl(m, 0.22, 0.24, h, white, { collide: true }, 14));
  const mouth = mesh(cachedGeometry('cowl:mouth', () => { const s = new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2); s.rotateX(Math.PI / 2); return s; }), m.clone('whitePaintedSteel', { side: THREE.DoubleSide }), { y: h, z: 0.1 });
  g.add(mouth);
  const inner = mesh(cachedGeometry('circle:cowl', () => new THREE.CircleGeometry(0.4, 16)), m.get('antifouling'), { y: h, z: 0.11 });
  g.add(inner);
  return g;
}

export function makeSkylight(m, { w = 2, d = 1 } = {}) {
  const g = group('skylight');
  g.add(box(m, w, 0.35, d, 'superstructureWhite', { collide: true }));
  const glass = m.clone('glassFrosted', { side: THREE.DoubleSide, emissive: new THREE.Color(0xffa552), emissiveIntensity: 0.4 });
  const pane = mesh(cachedGeometry(`plane:sky:${w}:${d}`, () => new THREE.PlaneGeometry(w - 0.1, d / 2 - 0.05)), glass, { y: 0.52, z: -d / 4, rx: -Math.PI / 2 + 0.5, shadow: false });
  const pane2 = mesh(cachedGeometry(`plane:sky:${w}:${d}`, () => new THREE.PlaneGeometry(w - 0.1, d / 2 - 0.05)), glass, { y: 0.52, z: d / 4, rx: -Math.PI / 2 - 0.5, shadow: false });
  pane.userData.emissiveLamp = true; pane2.userData.emissiveLamp = true;
  g.add(pane, pane2);
  g.add(box(m, w, 0.04, 0.06, 'brass', { y: 0.62 }));
  return g;
}

/** Welin quadrant davit: curved arm rising from a quadrant base; the arm reaches outboard toward +z. */
export function makeDavit(m, { h = 3.2, reach = 1.8 } = {}) {
  const g = group('davit');
  const white = m.get('whitePaintedSteel');
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * 0.55, 0.05), new THREE.Vector3(0, h * 0.9, reach * 0.35), new THREE.Vector3(0, h, reach)]);
  g.add(mesh(cachedGeometry(`tube:davit:${h}:${reach}`, () => new THREE.TubeGeometry(curve, 14, 0.09, 8, false)), white));
  // quadrant rack
  g.add(mesh(cachedGeometry('quadrant', () => new THREE.CylinderGeometry(0.75, 0.75, 0.12, 16, 1, false, 0, Math.PI / 2)), white, { y: 0.45, rx: Math.PI / 2, rz: 0 }));
  g.add(box(m, 0.3, 0.6, 0.25, white, { y: 0.3, collide: true }));
  g.add(cyl(m, 0.05, 0.05, 0.3, 'brass', { y: h, z: reach, rx: Math.PI / 2 }, 8)); // head sheave
  return g;
}

/** Clinker lifeboat; length runs along +z (rotate as needed). Covered boats get a canvas cover. */
export function makeLifeboat(m, { length = 9.14, beam = 2.77, covered = true, name = '' } = {}) {
  const g = group(`lifeboat.${name}`);
  const depth = length > 8 ? 1.22 : 0.91;
  const geom = cachedGeometry(`lifeboat:${length}:${beam}`, () => {
    const N = 16, R = 9;
    const pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const z = (t - 0.5) * length;
      const hb = (beam / 2) * Math.pow(Math.sin(Math.PI * t), 0.55) + 0.02;
      const dpt = depth * (0.7 + 0.3 * Math.sin(Math.PI * t));
      for (let j = 0; j <= R; j++) {
        const a = -Math.PI / 2 + (j / R) * Math.PI;           // −90° (port gunwale) → +90° (stbd gunwale)
        const x = Math.sin(a) * hb;
        const y = -Math.cos(a) * dpt + dpt;                  // 0 at the keel, depth at the gunwale
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = a + R + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setIndex(idx);
    bg.computeVertexNormals();
    return bg;
  });
  const hull = mesh(geom, m.clone('lifeboatWhite', { side: THREE.DoubleSide }), { collide: true });
  hull.name = 'lifeboatHull';
  g.add(hull);
  // clinker strakes: thin tube rings along the length (3 lines) as texture-free detail
  const gunwale = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => { const t = i / 8; return new THREE.Vector3((beam / 2) * Math.pow(Math.sin(Math.PI * t), 0.55) + 0.02, depth * (0.7 + 0.3 * Math.sin(Math.PI * t)), (t - 0.5) * length); }));
  for (const sign of [1, -1]) {
    const pts = gunwale.getPoints(16).map((p) => new THREE.Vector3(p.x * sign, p.y, p.z));
    g.add(mesh(cachedGeometry(`gunwale:${length}:${sign}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 6, false)), m.get('oakDark')));
  }
  g.add(box(m, 0.08, 0.1, length * 0.95, 'oakDark', { y: 0.02 })); // keel
  for (const dz of [-0.3, -0.1, 0.1, 0.3]) g.add(box(m, beam * 0.8, 0.04, 0.2, 'oakDark', { y: depth * 0.55, z: dz * length })); // thwarts
  if (covered) {
    const cover = mesh(cachedGeometry(`cover:${length}:${beam}`, () => { const s = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); s.scale(beam / 2 + 0.05, 0.25, length / 2 + 0.05); return s; }), m.get('canvasCover'), { y: depth });
    g.add(cover);
  }
  if (name) {
    const tex = makeNameplate({ text: `S.S. TITANIC  ${name}`, color: '#1a1a1a', font: 'bold 120px Georgia, serif' });
    const plate = mesh(cachedGeometry('plane:boatname', () => new THREE.PlaneGeometry(1.4, 0.2)), new THREE.MeshStandardMaterial({ map: tex.map, transparent: true, roughness: 0.6 }), { x: beam / 2 + 0.01, y: depth * 0.8, z: -length * 0.3, ry: Math.PI / 2, shadow: false });
    g.add(plate);
  }
  return g;
}

/** Scotch marine boiler, axis along +z (double-ended: furnace doors both ends). */
export function makeBoiler(m, { diameter = 4.8, length = 6.1, doubleEnded = true } = {}) {
  const g = group('boiler');
  const r = diameter / 2;
  const shell = mesh(cachedGeometry(`boiler:${diameter}:${length}`, () => { const c = new THREE.CylinderGeometry(r, r, length, 28); c.rotateX(Math.PI / 2); return c; }), m.get('boilerIron'), { y: r + 0.3, collide: true });
  g.add(shell);
  for (const dz of [-length / 2 + 0.6, 0, length / 2 - 0.6]) g.add(mesh(cachedGeometry(`torus:boilerBand:${r}`, () => new THREE.TorusGeometry(r + 0.02, 0.05, 6, 28)), m.get('steelRusty'), { y: r + 0.3, z: dz }));
  const ends = doubleEnded ? [1, -1] : [1];
  const doorMat = m.clone('clothBlack', { emissive: new THREE.Color(0xff4a10), emissiveIntensity: 2.2 });
  for (const s of ends) {
    for (let i = 0; i < 3; i++) {
      const y = r + 0.3 + (i - 1) * r * 0.55;
      const door = box(m, 0.75, 0.6, 0.12, 'ironDark', { x: 0, y, z: s * (length / 2 + 0.06) });
      door.position.x = (i - 1) * 0.0; g.add(door);
      const glow = box(m, 0.5, 0.35, 0.02, doorMat, { y, z: s * (length / 2 + 0.13) });
      glow.userData.emissiveLamp = true; g.add(glow);
    }
    const pl = new THREE.PointLight(0xff5a1a, 25, 9, 2); pl.position.set(0, r, s * (length / 2 + 1.2)); g.add(pl);
    if (!g.userData.light) g.userData.light = pl;
  }
  g.add(cyl(m, 0.5, 0.5, 1.2, 'boilerIron', { y: 2 * r + 0.3 + 0.5 }, 14)); // steam dome
  g.add(box(m, diameter * 0.8, 0.3, length * 0.9, 'steelGrey', { y: 0.15 })); // cradle
  return g;
}
export function makeEngineCylinder(m, { d = 2, h = 4 } = {}) {
  const g = group('engineCylinder');
  g.add(cyl(m, d / 2, d / 2, h, 'steelGrey', { y: 1.2 + h / 2, collide: true }, 20));
  g.add(cyl(m, d / 2 + 0.2, d / 2 + 0.2, 0.25, 'steelGrey', { y: 1.2 + h }, 20), cyl(m, d / 2 + 0.2, d / 2 + 0.2, 0.25, 'steelGrey', { y: 1.2 }, 20));
  for (const [x, z] of [[-d * 0.45, -d * 0.45], [d * 0.45, -d * 0.45], [-d * 0.45, d * 0.45], [d * 0.45, d * 0.45]]) g.add(cyl(m, 0.12, 0.14, 1.2, 'whitePaintedSteel', { x, z, y: 0.6 }, 10));
  g.add(box(m, d * 0.5, h * 0.6, d * 0.4, 'steelGrey', { y: 1.2 + h * 0.4, z: d * 0.6 })); // valve chest
  g.add(cyl(m, 0.12, 0.12, 1.6, 'brass', { y: 1.2 + h + 0.8 }, 8)); // piston rod
  return g;
}
export function makeGauge(m, { d = 0.3 } = {}) {
  const g = group('gauge');
  g.add(cyl(m, d / 2, d / 2, 0.06, 'brass', { y: d / 2, rx: Math.PI / 2 }, 20));
  g.add(cyl(m, d / 2 - 0.02, d / 2 - 0.02, 0.02, 'clothWhite', { y: d / 2, z: 0.035, rx: Math.PI / 2 }, 20));
  g.add(box(m, 0.01, d * 0.4, 0.005, 'clothBlack', { y: d / 2 + d * 0.15, z: 0.05, rz: 0.6 }));
  return g;
}
export function makeValveWheel(m, { d = 0.4 } = {}) {
  const g = group('valveWheel');
  g.add(mesh(cachedGeometry(`torus:valve:${d}`, () => new THREE.TorusGeometry(d / 2, 0.02, 6, 18)), m.get('brass'), { y: d / 2 }));
  for (let i = 0; i < 4; i++) g.add(box(m, d, 0.02, 0.02, 'brass', { y: d / 2, rz: (i / 4) * Math.PI }));
  g.add(cyl(m, 0.04, 0.05, 0.3, 'steelGrey', { y: 0.15 }, 8));
  return g;
}
export function makeTelegraph(m, {} = {}) {
  const g = group('telegraph');
  const pts = [new THREE.Vector2(0.22, 0), new THREE.Vector2(0.22, 0.05), new THREE.Vector2(0.08, 0.12), new THREE.Vector2(0.06, 0.95), new THREE.Vector2(0.09, 1.0)];
  g.add(mesh(cachedGeometry('lathe:telegraph', () => new THREE.LatheGeometry(pts, 16)), m.get('brass'), { collide: true }));
  g.add(mesh(cachedGeometry('cyl:teleHead', () => { const c = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 20); c.rotateX(Math.PI / 2); return c; }), m.get('brass'), { y: 1.2 }));
  g.add(mesh(cachedGeometry('cyl:teleFace', () => { const c = new THREE.CylinderGeometry(0.2, 0.2, 0.17, 20); c.rotateX(Math.PI / 2); return c; }), m.clone('clothWhite', { emissive: new THREE.Color(0xffa552), emissiveIntensity: 0.15 }), { y: 1.2 }));
  for (const s of [1, -1]) g.add(box(m, 0.03, 0.26, 0.03, 'brass', { x: s * 0.22, y: 1.3, rz: s * 0.5 }), mesh(cachedGeometry('sphere:handle', () => new THREE.SphereGeometry(0.035, 8, 6)), m.get('oakDark'), { x: s * 0.29, y: 1.4 }));
  return g;
}
export function makeShipsWheel(m, { d = 1.5 } = {}) {
  const g = group('shipsWheel');
  g.add(box(m, 0.5, 0.8, 0.5, 'oakDark', { y: 0.4, collide: true }));
  const hubY = 0.8 + d * 0.45;
  g.add(mesh(cachedGeometry(`torus:wheel:${d}`, () => new THREE.TorusGeometry(d / 2, 0.035, 8, 28)), m.get('mahogany'), { y: hubY }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    g.add(box(m, 0.04, d + 0.3, 0.04, 'mahogany', { y: hubY, rz: a }));
  }
  g.add(cyl(m, 0.08, 0.08, 0.12, 'brass', { y: hubY, rx: Math.PI / 2 }, 12));
  return g;
}
export function makeBinnacle(m, {} = {}) {
  const g = group('binnacle');
  const pts = [new THREE.Vector2(0.25, 0), new THREE.Vector2(0.25, 0.06), new THREE.Vector2(0.14, 0.1), new THREE.Vector2(0.15, 1.0), new THREE.Vector2(0.2, 1.05)];
  g.add(mesh(cachedGeometry('lathe:binnacle', () => new THREE.LatheGeometry(pts, 16)), m.get('teakVarnished'), { collide: true }));
  g.add(mesh(cachedGeometry('sphere:binHood', () => new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), m.get('brass'), { y: 1.05 }));
  for (const s of [1, -1]) g.add(mesh(cachedGeometry('sphere:compensator', () => new THREE.SphereGeometry(0.1, 12, 8)), m.get('ironDark'), { x: s * 0.3, y: 0.9 }));
  return g;
}
/** The "Honour and Glory Crowning Time" panel (carved) or a plain clock. Front = +z. userData.setTime(h, m). */
export function makeClock(m, { w = 2, h = 2.5, carved = true } = {}) {
  const g = group('clock');
  const oak = m.get('oakPanel');
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h * 0.7); shape.absarc(0, h * 0.7, w / 2, 0, Math.PI, false); shape.lineTo(-w / 2, 0);
  g.add(mesh(cachedGeometry(`clockPanel:${w}:${h}`, () => new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 })), oak, { z: -0.06 }));
  for (const s of [1, -1]) g.add(box(m, 0.18, h * 1.05, 0.2, m.get('oakDark'), { x: s * (w / 2 + 0.1), y: h * 0.52 })); // pilasters
  const faceY = h * 0.52;
  g.add(cyl(m, w * 0.17, w * 0.17, 0.05, 'clothCream', { y: faceY, z: 0.08, rx: Math.PI / 2 }, 28));
  g.add(mesh(cachedGeometry(`torus:clockRim:${w}`, () => new THREE.TorusGeometry(w * 0.17, 0.015, 6, 28)), m.get('ormolu'), { y: faceY, z: 0.1 }));
  const hourHand = box(m, 0.02, w * 0.1, 0.01, 'clothBlack', { y: faceY, z: 0.115 });
  const minHand = box(m, 0.015, w * 0.14, 0.01, 'clothBlack', { y: faceY, z: 0.12 });
  hourHand.geometry = new THREE.BoxGeometry(0.02, w * 0.1, 0.01).translate(0, w * 0.05, 0);
  minHand.geometry = new THREE.BoxGeometry(0.015, w * 0.14, 0.01).translate(0, w * 0.07, 0);
  g.add(hourHand, minHand);
  if (carved) {
    // two allegorical figures (Honour left, Glory right) as stylised relief figures
    const figMat = m.get('oakDark');
    for (const s of [-1, 1]) {
      const f = new THREE.Group();
      f.add(mesh(cachedGeometry('capsule:fig', () => new THREE.CapsuleGeometry(0.12, 0.55, 4, 8)), figMat, { y: 0.5 }));
      f.add(mesh(cachedGeometry('sphere:figHead', () => new THREE.SphereGeometry(0.1, 10, 8)), figMat, { y: 0.95 }));
      f.add(mesh(cachedGeometry('plane:wing', () => new THREE.PlaneGeometry(0.35, 0.5)), m.clone('oakDark', { side: THREE.DoubleSide }), { x: -s * 0.2, y: 0.75, rz: s * 0.5 }));
      f.position.set(s * w * 0.3, h * 0.08, 0.06);
      g.add(f);
    }
    g.add(box(m, w * 0.5, 0.08, 0.1, 'ormolu', { y: h * 0.92, z: 0.04 })); // laurel band
  }
  g.userData.setTime = (hours, minutes) => {
    hourHand.rotation.z = -((hours % 12) / 12 + minutes / 720) * Math.PI * 2;
    minHand.rotation.z = -(minutes / 60) * Math.PI * 2;
  };
  g.userData.setTime(23, 40);
  return g;
}
export function makeStatue(m, { kind = 'cherub' } = {}) {
  const g = group(`statue.${kind}`);
  const bronze = m.get('bronze');
  g.add(cyl(m, 0.18, 0.22, 0.5, 'oakDark', { y: 0.25, collide: true }, 10));
  g.add(mesh(cachedGeometry('capsule:cherub', () => new THREE.CapsuleGeometry(0.13, 0.35, 4, 10)), bronze, { y: 0.85 }));
  g.add(mesh(cachedGeometry('sphere:cherubHead', () => new THREE.SphereGeometry(0.12, 12, 8)), bronze, { y: 1.2 }));
  for (const s of [-1, 1]) g.add(mesh(cachedGeometry('plane:cherubWing', () => new THREE.PlaneGeometry(0.3, 0.4)), m.clone('bronze', { side: THREE.DoubleSide }), { x: s * 0.2, y: 0.95, z: -0.1, rz: s * 0.6 }));
  g.add(cyl(m, 0.03, 0.04, 0.5, 'bronze', { x: 0.2, y: 1.25, z: 0.1, rz: -0.4 }, 6));
  const torch = lampGlobe(m, 0.09, 2.5); torch.position.set(0.3, 1.52, 0.12); g.add(torch);
  const pl = new THREE.PointLight(0xffa552, 10, 8, 2); pl.position.set(0.3, 1.55, 0.2); g.add(pl); g.userData.light = pl;
  return g;
}
export function makePlaque(m, { text = '', id = 'plaque' } = {}) {
  const g = group('plaque');
  const plate = box(m, 0.42, 0.3, 0.03, 'brass', { y: 1.45 });
  plate.userData.interactable = { id, type: 'plaque', label: 'Read plaque', data: { text } };
  g.add(plate);
  const tex = makeNameplate({ text: (text || id).split(/[.:—-]/)[0].slice(0, 28).toUpperCase(), color: '#2a1a08', font: 'bold 90px Georgia, serif' });
  g.add(mesh(cachedGeometry('plane:plaque', () => new THREE.PlaneGeometry(0.38, 0.1)), new THREE.MeshStandardMaterial({ map: tex.map, transparent: true, roughness: 0.5 }), { y: 1.5, z: 0.02, shadow: false }));
  return g;
}
/** 1912 Renault Type CB coupé de ville: red body, black roof, brass lamps, spoked wheels. Length along +z (bonnet forward). */
export function makeCar(m, {} = {}) {
  const g = group('renault');
  const red = m.get('carRed');
  g.add(box(m, 1.4, 0.45, 4.0, 'ironDark', { y: 0.5 })); // chassis
  g.add(box(m, 1.5, 0.75, 1.5, red, { y: 0.95, z: 1.1 })); // bonnet (coal-scuttle)
  g.add(box(m, 1.2, 0.5, 1.2, red, { y: 1.1, z: 1.2 }));
  g.add(box(m, 1.6, 1.15, 1.9, red, { y: 1.25, z: -0.75, collide: true })); // passenger cab
  g.add(box(m, 1.66, 0.06, 2.0, 'clothBlack', { y: 1.86, z: -0.75 })); // roof
  g.add(box(m, 1.62, 0.5, 1.92, m.clone('glass', { transparent: true, opacity: 0.45 }), { y: 1.5, z: -0.75 })); // cab windows
  g.add(box(m, 1.2, 0.4, 0.8, red, { y: 1.05, z: 0.3 })); // chauffeur seat (open)
  g.add(box(m, 1.2, 0.08, 0.9, 'leatherDark', { y: 0.95, z: 0.3 }));
  g.add(mesh(cachedGeometry('torus:steering', () => new THREE.TorusGeometry(0.22, 0.025, 6, 16)), m.get('oakDark'), { y: 1.25, z: 0.55, rx: -0.5 }));
  for (const [x, z] of [[-0.75, 1.25], [0.75, 1.25], [-0.75, -1.3], [0.75, -1.3]]) {
    g.add(mesh(cachedGeometry('torus:tyre', () => new THREE.TorusGeometry(0.42, 0.08, 10, 24)), m.get('clothBlack'), { x, y: 0.5, z, ry: Math.PI / 2 }));
    g.add(mesh(cachedGeometry('cyl:spokes', () => { const c = new THREE.CylinderGeometry(0.4, 0.4, 0.04, 12); c.rotateZ(Math.PI / 2); return c; }), m.get('clothCream'), { x, y: 0.5, z }));
  }
  for (const x of [-0.6, 0.6]) g.add(mesh(cachedGeometry('sphere:lampB', () => new THREE.SphereGeometry(0.14, 10, 8)), m.get('brass'), { x, y: 1.1, z: 2.0 }));
  for (const x of [-0.95, 0.95]) g.add(box(m, 0.3, 0.04, 2.4, 'oakDark', { x, y: 0.62, z: -0.2 })); // running boards
  g.add(box(m, 1.2, 0.25, 0.05, 'brass', { y: 1.05, z: 1.86 })); // radiator
  return g;
}
export function makeBathtub(m, {} = {}) {
  const g = group('bathtub');
  g.add(mesh(cachedGeometry('capsule:tub', () => { const c = new THREE.CapsuleGeometry(0.4, 0.9, 4, 12); c.rotateX(Math.PI / 2); c.scale(1, 0.75, 1); return c; }), m.get('whiteEnamel'), { y: 0.35, collide: true }));
  g.add(mesh(cachedGeometry('capsule:tubIn', () => { const c = new THREE.CapsuleGeometry(0.34, 0.9, 4, 12); c.rotateX(Math.PI / 2); c.scale(1, 0.6, 1); return c; }), m.clone('moorishTile', { color: new THREE.Color(0xdfe9ee) }), { y: 0.45 }));
  for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) g.add(mesh(cachedGeometry('sphere:tubfoot', () => new THREE.SphereGeometry(0.06, 8, 6)), m.get('brass'), { x: s * 0.3, y: 0.05, z }));
  g.add(cyl(m, 0.02, 0.02, 0.2, 'brass', { y: 0.7, z: -0.75, rx: 0.4 }, 6));
  return g;
}
export function makeSink(m, {} = {}) {
  const g = group('sink');
  g.add(cyl(m, 0.1, 0.14, 0.75, 'whiteEnamel', { y: 0.375 }, 12));
  g.add(mesh(cachedGeometry('sphere:basin', () => { const s = new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); s.scale(1, 0.6, 0.85); return s; }), m.clone('whiteEnamel', { side: THREE.DoubleSide }), { y: 0.86, collide: true }));
  g.add(cyl(m, 0.015, 0.015, 0.2, 'brass', { y: 0.95, z: -0.2 }, 6), mesh(cachedGeometry('plane:mirror', () => new THREE.PlaneGeometry(0.4, 0.5)), m.clone('glass', { metalness: 1, roughness: 0.05, transparent: false }), { y: 1.4, z: -0.28, shadow: false }));
  return g;
}
export function makeGymMachine(m, { kind = 'rower' } = {}) {
  const g = group(`gym.${kind}`);
  if (kind === 'camel' || kind === 'horse') {
    g.add(box(m, 0.6, 0.9, 1.2, 'oakPanel', { collide: true }));
    g.add(box(m, 0.45, 0.25, 0.9, 'leatherDark', { y: 1.02 }));
    g.add(cyl(m, 0.03, 0.03, 0.5, 'brass', { y: 1.3, z: 0.4 }, 6), box(m, 0.4, 0.03, 0.03, 'brass', { y: 1.55, z: 0.4 }));
    g.add(box(m, 0.3, 0.4, 0.3, 'ironDark', { y: 0.2, z: -0.75 })); // motor box
    return g;
  }
  if (kind === 'bike') {
    g.add(box(m, 0.5, 0.1, 1.2, 'ironDark', { y: 0.05 }));
    g.add(mesh(cachedGeometry('torus:bike', () => new THREE.TorusGeometry(0.35, 0.03, 8, 20)), m.get('ironDark'), { y: 0.45, z: 0.45, ry: Math.PI / 2 }));
    g.add(cyl(m, 0.03, 0.03, 0.8, 'ironDark', { y: 0.45, z: -0.2, rx: 0.3 }, 6), box(m, 0.25, 0.06, 0.3, 'leatherDark', { y: 0.92, z: -0.35 }), box(m, 0.5, 0.03, 0.03, 'brass', { y: 0.95, z: 0.1 }));
    collider(g, 0.5, 1.0, 1.2);
    return g;
  }
  if (kind === 'punch') {
    g.add(cyl(m, 0.05, 0.4, 0.08, 'ironDark', { y: 0.04 }, 12), cyl(m, 0.03, 0.03, 1.9, 'ironDark', { y: 0.95 }, 8), box(m, 0.7, 0.05, 0.05, 'ironDark', { x: 0.3, y: 1.9 }));
    g.add(mesh(cachedGeometry('sphere:bag', () => new THREE.SphereGeometry(0.17, 12, 10)), m.get('leatherDark'), { x: 0.6, y: 1.55 }));
    collider(g, 0.4, 1.9, 0.4);
    return g;
  }
  // rower
  g.add(box(m, 0.5, 0.08, 1.6, 'oakPanel', { y: 0.2 }), box(m, 0.3, 0.06, 0.3, 'leatherDark', { y: 0.27, z: 0.2 }));
  for (const s of [-1, 1]) g.add(cyl(m, 0.015, 0.015, 1.0, 'oakPanel', { x: s * 0.3, y: 0.45, z: -0.1, rz: s * 1.1 }, 6));
  for (const [z, h] of [[0.7, 0.2], [-0.7, 0.2]]) g.add(box(m, 0.4, h, 0.06, 'ironDark', { y: h / 2, z }));
  collider(g, 0.9, 0.5, 1.6);
  return g;
}
export function makeHatch(m, { w = 4, l = 5 } = {}) {
  const g = group('hatch');
  const coaming = m.get('hullBlack');
  g.add(box(m, w + 0.3, 0.9, 0.15, coaming, { z: l / 2, collide: true }), box(m, w + 0.3, 0.9, 0.15, coaming, { z: -l / 2, collide: true }), box(m, 0.15, 0.9, l, coaming, { x: w / 2, collide: true }), box(m, 0.15, 0.9, l, coaming, { x: -w / 2, collide: true }));
  g.add(box(m, w + 0.1, 0.25, l + 0.1, 'canvasCover', { y: 0.95, collide: true }));
  for (const dz of [-l * 0.3, 0, l * 0.3]) g.add(box(m, w + 0.4, 0.04, 0.06, 'ironDark', { y: 1.1, z: dz }));
  return g;
}
export function makeCrane(m, { h = 6.5, reach = 8.5 } = {}) {
  const g = group('crane');
  const white = m.get('whitePaintedSteel');
  g.add(cyl(m, 0.4, 0.5, 2.2, 'steelRusty', { y: 1.1, collide: true }, 14));
  g.add(cyl(m, 0.25, 0.3, h - 2.2, white, { y: 2.2 + (h - 2.2) / 2 }, 12));
  g.add(box(m, 1.1, 1.3, 1.6, white, { y: 3.0, z: -0.4 })); // machinery house
  const jib = cyl(m, 0.08, 0.14, reach, white, { y: 3.8 + reach * 0.3, z: reach * 0.45 }, 8);
  jib.rotation.x = Math.PI / 2 - 0.6; g.add(jib);
  const tipY = 3.8 + reach * Math.sin(0.6), tipZ = reach * Math.cos(0.6);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, tipY, tipZ), new THREE.Vector3(0, tipY - 3, tipZ)]), new THREE.LineBasicMaterial({ color: 0x222222 }));
  g.add(line);
  g.add(mesh(cachedGeometry('torus:hook', () => new THREE.TorusGeometry(0.12, 0.03, 6, 10, Math.PI * 1.5)), m.get('ironDark'), { y: tipY - 3.1, z: tipZ }));
  return g;
}
/** Hall's stockless anchor, lying flat (crown at −z); size = overall length. */
export function makeAnchor(m, { size = 3.6 } = {}) {
  const g = group('anchor');
  const iron = m.get('ironDark');
  g.add(box(m, size * 0.09, size * 0.09, size * 0.62, iron, { y: size * 0.05, z: 0.1 }));
  g.add(box(m, size * 0.42, size * 0.12, size * 0.14, iron, { y: size * 0.06, z: -size * 0.25 })); // crown
  for (const s of [-1, 1]) g.add(box(m, size * 0.12, size * 0.06, size * 0.32, iron, { x: s * size * 0.16, y: size * 0.07, z: -size * 0.12, rx: -0.35 })); // flukes
  g.add(mesh(cachedGeometry('torus:shackle', () => new THREE.TorusGeometry(0.16, 0.03, 6, 12)), iron, { y: size * 0.05, z: size * 0.42, rx: Math.PI / 2 }));
  return g;
}
