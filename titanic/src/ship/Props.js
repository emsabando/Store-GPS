/**
 * Props factory (ARCHITECTURE.md §5). Every factory returns a THREE.Group whose origin is the base centre on the
 * floor, "front" facing +z, in metres. `m` is the MaterialLibrary. Collidable props set userData.collide on a mesh
 * (or on an invisible box collider child). Geometry is cached by factory + options.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNameplate } from '../materials/ProceduralTextures.js';

export * from './props/Fittings.js';

// ------------------------------------------------------------------ helpers
const _cache = new Map();
export function cachedGeometry(key, make) {
  let g = _cache.get(key);
  if (!g) { g = make(); _cache.set(key, g); }
  return g;
}
export function mesh(geom, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, collide = false, shadow = true, name } = {}) {
  const mm = new THREE.Mesh(geom, mat);
  mm.position.set(x, y, z); mm.rotation.set(rx, ry, rz);
  mm.castShadow = shadow; mm.receiveShadow = true;
  if (collide) mm.userData.collide = true;
  if (name) mm.name = name;
  return mm;
}
export function box(m, w, h, d, matName, opts = {}) {
  return mesh(cachedGeometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)), typeof matName === 'string' ? m.get(matName) : matName, { y: h / 2, ...opts });
}
export function cyl(m, rTop, rBot, h, matName, opts = {}, seg = 16) {
  return mesh(cachedGeometry(`cyl:${rTop}:${rBot}:${h}:${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg)), typeof matName === 'string' ? m.get(matName) : matName, { y: h / 2, ...opts });
}
export function collider(group, w, h, d, { x = 0, y = h / 2, z = 0 } = {}) {
  const c = new THREE.Mesh(cachedGeometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)), new THREE.MeshBasicMaterial({ visible: false }));
  c.position.set(x, y, z); c.visible = false; c.userData.collide = true; c.name = 'collider';
  group.add(c);
  return c;
}
const group = (name) => { const g = new THREE.Group(); g.name = name; return g; };
const LAMP_COLOR = 0xffa552;

export function lampGlobe(m, r = 0.12, intensity = 2.5) {
  const mat = m.clone('glassFrosted', { emissive: new THREE.Color(LAMP_COLOR), emissiveIntensity: intensity, transparent: false, opacity: 1, transmission: 0, roughness: 0.6 });
  const g = mesh(cachedGeometry(`sphere:${r}`, () => new THREE.SphereGeometry(r, 14, 10)), mat, { shadow: false });
  g.userData.emissiveLamp = true;
  return g;
}

// ------------------------------------------------------------------ furniture
export function makeChair(m, { style = 'dining', color } = {}) {
  const g = group(`chair.${style}`);
  const wood = color ? m.clone('oakPanel', { color: new THREE.Color(color) }) : m.get(style === 'wicker' ? 'wicker' : style === 'bentwood' ? 'walnut' : 'oakPanel');
  if (style === 'club') {
    const leather = m.get(color ? 'leatherDark' : 'leatherDark');
    g.add(box(m, 0.8, 0.42, 0.8, leather, { y: 0.21 }));
    g.add(box(m, 0.8, 0.5, 0.2, leather, { y: 0.65, z: -0.3 }));
    g.add(box(m, 0.18, 0.3, 0.7, leather, { y: 0.55, x: -0.31 }), box(m, 0.18, 0.3, 0.7, leather, { y: 0.55, x: 0.31 }));
    collider(g, 0.8, 0.9, 0.8);
    return g;
  }
  if (style === 'stool') {
    g.add(cyl(m, 0.17, 0.17, 0.05, wood, { y: 0.45 }));
    for (const [x, z] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) g.add(cyl(m, 0.015, 0.02, 0.45, wood, { x, z }, 6));
    collider(g, 0.35, 0.5, 0.35);
    return g;
  }
  if (style === 'bench3rd') {
    g.add(box(m, 1.6, 0.05, 0.35, 'pineDeck', { y: 0.45 }));
    g.add(box(m, 0.05, 0.45, 0.3, 'pineDeck', { x: -0.7, y: 0.225 }), box(m, 0.05, 0.45, 0.3, 'pineDeck', { x: 0.7, y: 0.225 }));
    collider(g, 1.6, 0.5, 0.35);
    return g;
  }
  // dining / wicker / bentwood: seat, 4 legs, back
  const seatMat = style === 'dining' ? m.get('leatherGreen') : wood;
  g.add(box(m, 0.46, 0.05, 0.46, seatMat, { y: 0.45 }));
  const legR = style === 'wicker' ? 0.02 : 0.018;
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(cyl(m, legR, legR * 1.3, 0.45, wood, { x, z }, 6));
  if (style === 'wicker') {
    const back = mesh(cachedGeometry('torus:wicker', () => new THREE.TorusGeometry(0.24, 0.035, 8, 20, Math.PI)), wood, { y: 0.5, z: -0.2 });
    g.add(back);
    g.add(box(m, 0.46, 0.4, 0.02, wood, { y: 0.68, z: -0.22 }));
  } else {
    g.add(cyl(m, 0.016, 0.016, 0.5, wood, { x: -0.2, z: -0.2, y: 0.45 }, 6), cyl(m, 0.016, 0.016, 0.5, wood, { x: 0.2, z: -0.2, y: 0.45 }, 6));
    g.add(box(m, 0.42, 0.14, 0.03, wood, { y: 0.88, z: -0.2 }), box(m, 0.42, 0.06, 0.03, wood, { y: 0.66, z: -0.2 }));
  }
  collider(g, 0.5, 0.95, 0.5);
  return g;
}

export function makeTable(m, { w = 1.2, d = 0.8, h = 0.76, style = 'rect', top = 'wood' } = {}) {
  const g = group(`table.${style}`);
  const wood = m.get('oakPanel');
  const topMat = top === 'linen' ? m.get('clothWhite') : top === 'marble' ? m.get('marbleWhite') : wood;
  if (style === 'round' || style === 'cafe') {
    const r = style === 'cafe' ? Math.min(w, d) / 2 || 0.4 : w / 2;
    g.add(cyl(m, r, r, 0.04, topMat, { y: h - 0.02 }, 24));
    if (top === 'linen') { const cloth = cyl(m, r + 0.02, r - 0.08, 0.3, topMat, { y: h - 0.17 }, 24); cloth.castShadow = false; g.add(cloth); }
    g.add(cyl(m, 0.05, 0.08, h - 0.06, style === 'cafe' ? m.get('wroughtIron') : wood, { y: (h - 0.06) / 2 }, 10));
    g.add(cyl(m, r * 0.5, r * 0.55, 0.05, style === 'cafe' ? m.get('wroughtIron') : wood, { y: 0.025 }, 12));
    collider(g, r * 2, h, r * 2);
    return g;
  }
  g.add(box(m, w, 0.04, d, topMat, { y: h - 0.02 }));
  if (top === 'linen') { const cloth = box(m, w + 0.04, 0.25, d + 0.04, topMat, { y: h - 0.16 }); cloth.castShadow = false; g.add(cloth); }
  const inset = 0.08;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(m, 0.07, h - 0.04, 0.07, wood, { x: sx * (w / 2 - inset), z: sz * (d / 2 - inset), y: (h - 0.04) / 2 }));
  if (style === 'long') g.add(box(m, w - 0.3, 0.06, 0.06, wood, { y: 0.2 }));
  collider(g, w, h, d);
  return g;
}

export function makeBed(m, { w = 1.0, l = 2.0, style = 'wood' } = {}) {
  const g = group(`bed.${style}`);
  const bunk = style === 'bunk2' || style === 'bunk3';
  const levels = style === 'bunk3' ? 3 : style === 'bunk2' ? 2 : 1;
  const frameMat = style === 'brass' ? m.get('brass') : bunk ? m.get('ironDark') : m.get('mahogany');
  const stepH = bunk ? 0.75 : 0;
  for (let i = 0; i < levels; i++) {
    const y = 0.45 + i * stepH;
    g.add(box(m, w, 0.08, l, frameMat, { y: y - 0.04 }));
    const mat = box(m, w - 0.08, 0.16, l - 0.1, m.get('clothCream'), { y: y + 0.08 });
    g.add(mat);
    g.add(box(m, w - 0.1, 0.06, l - 0.14, m.get(bunk ? 'clothGrey' : 'clothBurgundy'), { y: y + 0.19, z: 0.12 }));
    g.add(box(m, w * 0.5, 0.1, 0.35, m.get('clothWhite'), { y: y + 0.21, z: -l / 2 + 0.3 }));
  }
  const postH = bunk ? 0.45 + (levels - 1) * stepH + 0.5 : style === 'brass' ? 1.2 : 1.0;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ph = sz < 0 ? postH : postH * 0.75;
    g.add(cyl(m, 0.025, 0.03, ph, frameMat, { x: sx * (w / 2 - 0.03), z: sz * (l / 2 - 0.03), y: ph / 2 }, 8));
  }
  if (!bunk) {
    g.add(box(m, w, style === 'brass' ? 0.04 : 0.6, 0.04, frameMat, { y: style === 'brass' ? postH - 0.1 : 0.7, z: -l / 2 }));
    g.add(box(m, w, 0.04, 0.04, frameMat, { y: postH * 0.75 - 0.05, z: l / 2 }));
  }
  collider(g, w, 0.6 + (levels - 1) * stepH, l);
  return g;
}

export function makeLamp(m, { kind = 'ceilingGlobe', power = 1, light = true } = {}) {
  const g = group(`lamp.${kind}`);
  let pos = new THREE.Vector3(0, 0, 0);
  let cd = 14 * power;
  if (kind === 'ceilingGlobe') {
    g.add(cyl(m, 0.02, 0.02, 0.25, 'brass', { y: -0.125 }, 8));
    const globe = lampGlobe(m, 0.16, 2.2 * power); globe.position.y = -0.4; g.add(globe); pos.set(0, -0.4, 0);
  } else if (kind === 'chandelier') {
    cd = 40 * power;
    g.add(cyl(m, 0.01, 0.01, 0.6, 'brass', { y: -0.3 }, 6));
    const ring = mesh(cachedGeometry('torus:chand', () => new THREE.TorusGeometry(0.45, 0.03, 8, 24)), m.get('ormolu'), { y: -0.7, rx: Math.PI / 2 });
    g.add(ring);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const gl = lampGlobe(m, 0.09, 2.5 * power); gl.position.set(Math.cos(a) * 0.45, -0.62, Math.sin(a) * 0.45); g.add(gl); }
    const centre = lampGlobe(m, 0.14, 2.5 * power); centre.position.y = -0.85; g.add(centre);
    pos.set(0, -0.75, 0);
  } else if (kind === 'sconce') {
    cd = 8 * power;
    g.add(box(m, 0.1, 0.25, 0.05, 'ormolu', { y: 0, z: 0.025 }));
    g.add(cyl(m, 0.015, 0.015, 0.18, 'ormolu', { y: 0.05, z: 0.12, rx: Math.PI / 2 }, 6));
    const gl = lampGlobe(m, 0.08, 2.0 * power); gl.position.set(0, 0.12, 0.2); g.add(gl); pos.set(0, 0.12, 0.2);
  } else if (kind === 'tableLamp') {
    cd = 6 * power;
    g.add(cyl(m, 0.04, 0.07, 0.3, 'brass', { y: 0.15 }, 10));
    const shade = mesh(cachedGeometry('cone:shade', () => new THREE.ConeGeometry(0.16, 0.18, 14, 1, true)), m.clone('clothCream', { side: THREE.DoubleSide, emissive: new THREE.Color(LAMP_COLOR), emissiveIntensity: 0.5 }), { y: 0.42 });
    shade.userData.emissiveLamp = true; g.add(shade); pos.set(0, 0.4, 0);
  } else if (kind === 'bulkhead') {
    cd = 6 * power;
    g.add(box(m, 0.14, 0.06, 0.14, 'ironDark', { y: 0 }));
    const gl = lampGlobe(m, 0.09, 2.0 * power); gl.position.set(0, -0.08, 0.04); g.add(gl); pos.set(0, -0.08, 0.04);
    // cage
    const cage = mesh(cachedGeometry('torus:cage', () => new THREE.TorusGeometry(0.1, 0.008, 4, 12)), m.get('ironDark'), { y: -0.08, z: 0.04 });
    g.add(cage);
  } else if (kind === 'deckLamp') {
    cd = 10 * power;
    g.add(cyl(m, 0.03, 0.04, 2.2, 'whitePaintedSteel', { y: 1.1 }, 8));
    const gl = lampGlobe(m, 0.14, 2.2 * power); gl.position.y = 2.35; g.add(gl); pos.set(0, 2.35, 0);
  } else if (kind === 'candelabra') {
    cd = 5 * power;
    g.add(cyl(m, 0.08, 0.1, 0.05, 'ormolu', { y: 0.025 }, 10), cyl(m, 0.015, 0.02, 0.35, 'ormolu', { y: 0.2 }, 8));
    for (const dx of [-0.12, 0, 0.12]) { g.add(cyl(m, 0.012, 0.012, 0.18, 'clothCream', { x: dx, y: 0.45 }, 6)); const fl = lampGlobe(m, 0.025, 3 * power); fl.position.set(dx, 0.56, 0); g.add(fl); }
    pos.set(0, 0.55, 0);
  }
  if (light) {
    const pl = new THREE.PointLight(LAMP_COLOR, cd, kind === 'chandelier' ? 18 : 10, 2);
    pl.position.copy(pos); pl.castShadow = false; pl.name = `light.${kind}`;
    g.add(pl); g.userData.light = pl;
  }
  return g;
}

export function makeColumn(m, { h = 3, style = 'plain', r = 0.2 } = {}) {
  const g = group(`column.${style}`);
  if (style === 'ionic' || style === 'oak') {
    const mat = m.get(style === 'oak' ? 'oakPanel' : 'plasterWhite');
    const pts = [];
    pts.push(new THREE.Vector2(r * 1.6, 0), new THREE.Vector2(r * 1.6, 0.08), new THREE.Vector2(r * 1.25, 0.12), new THREE.Vector2(r * 1.08, 0.3));
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(r * (1.0 - 0.1 * t), 0.3 + (h - 0.75) * t)); }
    pts.push(new THREE.Vector2(r * 1.15, h - 0.4), new THREE.Vector2(r * 1.5, h - 0.2), new THREE.Vector2(r * 1.6, h - 0.08), new THREE.Vector2(r * 1.6, h));
    const geom = cachedGeometry(`lathe:${style}:${h}:${r}`, () => new THREE.LatheGeometry(pts, 20));
    g.add(mesh(geom, mat, { collide: true }));
    if (style === 'ionic') { g.add(box(m, r * 3.2, 0.12, r * 1.2, 'plasterWhite', { y: h - 0.14 })); }
    return g;
  }
  if (style === 'square') { g.add(box(m, r * 2, h, r * 2, 'whiteEnamel', { collide: true })); return g; }
  if (style === 'steel') {
    g.add(cyl(m, r, r, h, 'whitePaintedSteel', { collide: true }, 14));
    g.add(cyl(m, r * 1.4, r * 1.4, 0.06, 'steelGrey', { y: 0.03 }, 14), cyl(m, r * 1.4, r * 1.4, 0.06, 'steelGrey', { y: h - 0.03 }, 14));
    return g;
  }
  g.add(cyl(m, r, r, h, 'plasterWhite', { collide: true }, 16));
  return g;
}

/** Door with a swinging leaf; toggle() animates. Front = +z; hinge on the left (−x) edge. */
export function makeDoor(m, { w = 0.9, h = 2.1, style = 'oak', open = false, double = false, id = 'door' } = {}) {
  const g = group(`door.${style}`);
  const mat = style === 'white' ? m.get('whiteEnamel') : style === 'steel' || style === 'wtDoor' ? m.get('steelGrey') : style === 'gate' ? m.get('wroughtIron') : m.get('oakPanel');
  const frameMat = style === 'gate' ? m.get('wroughtIron') : style === 'steel' || style === 'wtDoor' ? m.get('steelGrey') : m.get(style === 'white' ? 'whiteEnamel' : 'oakDark');
  const totalW = double ? w * 2 : w;
  // frame (jambs + head)
  g.add(box(m, 0.08, h + 0.08, 0.14, frameMat, { x: -totalW / 2 - 0.04, y: (h + 0.08) / 2 }), box(m, 0.08, h + 0.08, 0.14, frameMat, { x: totalW / 2 + 0.04, y: (h + 0.08) / 2 }));
  g.add(box(m, totalW + 0.16, 0.08, 0.14, frameMat, { y: h + 0.04 }));
  const leaves = [];
  const leafCount = double ? 2 : 1;
  for (let i = 0; i < leafCount; i++) {
    const hingeX = double ? (i === 0 ? -w : 0) : -w / 2;
    const dir = double && i === 1 ? -1 : 1;
    const pivot = new THREE.Group();
    pivot.position.set(double && i === 1 ? w : hingeX, 0, 0);
    let leaf;
    if (style === 'gate') {
      const bars = new THREE.Group();
      const barGeom = cachedGeometry(`cyl:gate:${h}`, () => new THREE.CylinderGeometry(0.012, 0.012, h - 0.1, 6));
      const n = Math.max(3, Math.floor(w / 0.12));
      const im = new THREE.InstancedMesh(barGeom, mat, n);
      const mm = new THREE.Matrix4();
      for (let k = 0; k < n; k++) { mm.makeTranslation(dir * (0.06 + k * (w - 0.12) / (n - 1)), h / 2, 0); im.setMatrixAt(k, mm); }
      im.instanceMatrix.needsUpdate = true; bars.add(im);
      bars.add(box(m, w, 0.05, 0.04, mat, { x: dir * w / 2, y: 0.12 }), box(m, w, 0.05, 0.04, mat, { x: dir * w / 2, y: h - 0.2 }), box(m, w, 0.05, 0.04, mat, { x: dir * w / 2, y: h / 2 }));
      leaf = bars;
      const col = collider(bars, w, h, 0.06, { x: dir * w / 2 });
      col.userData.interactable = { id, type: 'gate', label: 'Open gate', data: null };
    } else {
      leaf = new THREE.Group();
      const slab = box(m, w - 0.02, h - 0.02, style === 'wtDoor' ? 0.12 : 0.05, mat, { x: dir * w / 2, y: h / 2, collide: true });
      leaf.add(slab);
      if (style === 'oak' || style === 'white') {
        for (const [py, ph] of [[h * 0.3, h * 0.35], [h * 0.72, h * 0.3]]) leaf.add(box(m, w * 0.65, ph, 0.02, mat === m.get('oakPanel') ? m.get('oakDark') : m.get('plasterCream'), { x: dir * w / 2, y: py, z: 0.03 }));
        leaf.add(mesh(cachedGeometry('sphere:knob', () => new THREE.SphereGeometry(0.03, 8, 6)), m.get('brass'), { x: dir * (w - 0.1), y: 1.0, z: 0.05 }));
      }
      if (style === 'wtDoor') {
        const wheel = mesh(cachedGeometry('torus:wtwheel', () => new THREE.TorusGeometry(0.2, 0.02, 6, 16)), m.get('brass'), { x: dir * w / 2, y: 1.2, z: 0.1 });
        leaf.add(wheel);
      }
      slab.userData.interactable = { id, type: 'door', label: 'Open door', data: null };
    }
    pivot.add(leaf);
    g.add(pivot);
    leaves.push({ pivot, dir });
  }
  const state = { open: !!open, anim: null };
  const target = () => leaves.map((l) => (state.open ? -l.dir * Math.PI * 0.52 : 0));
  const apply = (ys) => leaves.forEach((l, i) => { l.pivot.rotation.y = ys[i]; });
  if (state.open) apply(target());
  const toggle = () => {
    state.open = !state.open;
    const from = leaves.map((l) => l.pivot.rotation.y), to = target();
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / 450);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      apply(from.map((f, i) => f + (to[i] - f) * e));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const data = { toggle, get open() { return state.open; }, setOpen(v) { if (state.open !== v) toggle(); } };
  g.traverse((o) => { if (o.userData.interactable) o.userData.interactable.data = data; });
  g.userData.door = data;
  g.userData.update = () => {};
  return g;
}

export function makeWindow(m, { w = 1, h = 1, style = 'square' } = {}) {
  const g = group(`window.${style}`);
  const glassName = style === 'stained' ? 'glassStained' : style === 'frosted' ? 'glassFrosted' : 'glass';
  if (style === 'round') {
    g.add(mesh(cachedGeometry(`torus:win:${w}`, () => new THREE.TorusGeometry(w / 2, 0.035, 8, 20)), m.get('brass'), { y: h / 2 }));
    g.add(mesh(cachedGeometry(`circle:${w}`, () => new THREE.CircleGeometry(w / 2 - 0.02, 20)), m.clone(glassName, { side: THREE.DoubleSide }), { y: h / 2, shadow: false }));
    return g;
  }
  const frame = m.get('brass');
  const t = 0.05;
  g.add(box(m, w + t, t, t, frame, { y: h - t / 2 }), box(m, w + t, t, t, frame, { y: t / 2 }), box(m, t, h, t, frame, { x: -w / 2, y: h / 2 }), box(m, t, h, t, frame, { x: w / 2, y: h / 2 }));
  if (style === 'bay') {
    for (const [dx, ry] of [[-w * 0.33, 0.5], [0, 0], [w * 0.33, -0.5]]) g.add(mesh(cachedGeometry(`plane:${w / 3}:${h}`, () => new THREE.PlaneGeometry(w / 3, h)), m.clone(glassName, { side: THREE.DoubleSide }), { x: dx, y: h / 2, ry, shadow: false }));
  } else {
    g.add(mesh(cachedGeometry(`plane:${w}:${h}`, () => new THREE.PlaneGeometry(w, h)), m.clone(glassName, { side: THREE.DoubleSide }), { y: h / 2, shadow: false }));
    if (style === 'square') g.add(box(m, w, 0.03, 0.03, frame, { y: h / 2 }), box(m, 0.03, h, 0.03, frame, { y: h / 2 }));
  }
  return g;
}

/** Straight railing along +x from −length/2 to +length/2, at the origin's z. */
export function makeRailing(m, { length = 2, height = 1.05, balusterPitch = 0.4, style = 'teakCap' } = {}) {
  const g = group(`railing.${style}`);
  const capMat = style === 'oakGrand' ? m.get('oakPanel') : style === 'iron' || style === 'pipe' ? m.get('whitePaintedSteel') : m.get('teakOiled');
  const postMat = style === 'oakGrand' ? m.get('wroughtIron') : style === 'iron' ? m.get('wroughtIron') : m.get('whitePaintedSteel');
  const n = Math.max(2, Math.round(length / balusterPitch) + 1);
  const postGeom = cachedGeometry(`cyl:post:${height}:${style}`, () => new THREE.CylinderGeometry(style === 'oakGrand' ? 0.012 : 0.02, style === 'oakGrand' ? 0.012 : 0.02, height - 0.04, 6));
  const posts = new THREE.InstancedMesh(postGeom, postMat, n);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { mm.makeTranslation(-length / 2 + (i / (n - 1)) * length, (height - 0.04) / 2, 0); posts.setMatrixAt(i, mm); }
  posts.instanceMatrix.needsUpdate = true; posts.castShadow = true;
  g.add(posts);
  if (style === 'oakGrand') {
    g.add(box(m, length, 0.08, 0.1, capMat, { y: height - 0.04 }));
    // wrought-iron panels with gilt swags between balusters (thin decorative panels every second bay)
    const panelGeom = cachedGeometry('box:swag', () => new THREE.BoxGeometry(balusterPitch * 0.8, 0.26, 0.015));
    const swags = new THREE.InstancedMesh(panelGeom, m.get('ormolu'), Math.max(1, Math.floor((n - 1) / 2)));
    let k = 0;
    for (let i = 0; i + 1 < n; i += 2) { mm.makeTranslation(-length / 2 + ((i + 0.5) / (n - 1)) * length, height * 0.55, 0); swags.setMatrixAt(k++, mm); }
    swags.count = k; swags.instanceMatrix.needsUpdate = true; g.add(swags);
    g.add(box(m, length, 0.03, 0.03, postMat, { y: height * 0.35 }));
  } else {
    g.add(mesh(cachedGeometry(`cyl:rail:${length}`, () => { const c = new THREE.CylinderGeometry(0.045, 0.045, length, 8); c.rotateZ(Math.PI / 2); return c; }), capMat, { y: height }));
    for (const hh of [height * 0.66, height * 0.33]) g.add(mesh(cachedGeometry(`cyl:rail2:${length}`, () => { const c = new THREE.CylinderGeometry(0.018, 0.018, length, 6); c.rotateZ(Math.PI / 2); return c; }), postMat, { y: hh }));
  }
  collider(g, length, height, 0.08);
  return g;
}

/** Stairs rising toward −z (the player walks in from +z and climbs away). Origin = bottom step centre. */
export function makeStairs(m, { width = 1.2, rise = 0.18, run = 0.28, steps = 10, style = 'oak', rails = true } = {}) {
  const g = group(`stairs.${style}`);
  const treadMat = style === 'steel' ? m.get('steelGrey') : style === 'ladder' ? m.get('ironDark') : m.get(style === 'oak' ? 'oakPanel' : 'oakDark');
  if (style === 'spiral') {
    const r = width;
    g.add(cyl(m, 0.08, 0.08, steps * rise + 0.5, 'ironDark', { y: (steps * rise + 0.5) / 2 }, 10));
    const geom = cachedGeometry(`spiralStep:${r}`, () => new THREE.CylinderGeometry(r, r, 0.04, 12, 1, false, 0, Math.PI / 4));
    for (let i = 0; i < steps; i++) {
      const s = mesh(geom, treadMat, { y: (i + 1) * rise, ry: -i * (Math.PI / 4), collide: true });
      g.add(s);
    }
    return g;
  }
  if (style === 'ladder') {
    const h = steps * rise;
    for (const dx of [-width / 2, width / 2]) g.add(cyl(m, 0.025, 0.025, h, treadMat, { x: dx, y: h / 2, z: -h * 0.25, rx: 0.26 }, 6));
    const rungGeom = cachedGeometry(`rung:${width}`, () => { const c = new THREE.CylinderGeometry(0.018, 0.018, width, 6); c.rotateZ(Math.PI / 2); return c; });
    const rungs = new THREE.InstancedMesh(rungGeom, treadMat, steps);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < steps; i++) { mm.makeTranslation(0, (i + 0.5) * rise, -(i + 0.5) * rise * 0.27); rungs.setMatrixAt(i, mm); }
    rungs.instanceMatrix.needsUpdate = true; g.add(rungs);
    // walkable ramp collider
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, Math.hypot(h, h * 0.27)), new THREE.MeshBasicMaterial({ visible: false }));
    ramp.position.set(0, h / 2, -h * 0.135); ramp.rotation.x = Math.atan2(h, h * 0.27) - Math.PI / 2; ramp.visible = false; ramp.userData.collide = true;
    g.add(ramp);
    return g;
  }
  const treads = [];
  const risers = [];
  for (let i = 0; i < steps; i++) {
    const t = new THREE.BoxGeometry(width, 0.04, run + 0.03);
    t.translate(0, (i + 1) * rise - 0.02, -(i + 0.5) * run);
    treads.push(t);
    const rr = new THREE.BoxGeometry(width, rise, 0.03);
    rr.translate(0, (i + 0.5) * rise, -(i * run) - 0.015 - run);
    risers.push(rr);
  }
  const treadMesh = new THREE.Mesh(mergeGeometries(treads), treadMat);
  treadMesh.castShadow = true; treadMesh.receiveShadow = true; treadMesh.userData.collide = true;
  g.add(treadMesh);
  const riserMesh = new THREE.Mesh(mergeGeometries(risers), style === 'steel' ? m.get('steelGrey') : m.get('oakDark'));
  riserMesh.receiveShadow = true;
  g.add(riserMesh);
  // stringers
  const totalH = steps * rise, totalD = steps * run;
  for (const dx of [-width / 2 - 0.03, width / 2 + 0.03]) {
    const s = box(m, 0.06, 0.32, Math.hypot(totalH, totalD), treadMat, { x: dx, y: totalH / 2 - 0.1, z: -totalD / 2 });
    s.rotation.x = -Math.atan2(totalH, totalD); g.add(s);
  }
  // smooth collision ramp (so the capsule glides)
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, Math.hypot(totalH, totalD)), new THREE.MeshBasicMaterial({ visible: false }));
  ramp.position.set(0, totalH / 2 + 0.02, -totalD / 2); ramp.rotation.x = -Math.atan2(totalH, totalD); ramp.visible = false; ramp.userData.collide = true;
  g.add(ramp);
  if (rails) {
    for (const dx of [-width / 2 - 0.05, width / 2 + 0.05]) {
      const r = makeRailing(m, { length: Math.hypot(totalH, totalD), height: 0.95, balusterPitch: 0.35, style: style === 'oak' ? 'oakGrand' : 'pipe' });
      r.position.set(dx, totalH / 2 + 0.05, -totalD / 2); r.rotation.y = Math.PI / 2; r.rotation.z = Math.atan2(totalH, totalD) * (1);
      // rotate so the rail climbs with the stair: railing runs along its local x; after ry=90° its x maps to -z; tilt about local z
      r.rotation.set(0, Math.PI / 2, 0); r.rotateX(-Math.atan2(totalH, totalD) * 0);
      r.rotation.z = Math.atan2(totalH, totalD);
      g.add(r);
    }
  }
  return g;
}

export function makeBench(m, { length = 1.8, style = 'deck' } = {}) {
  const g = group(`bench.${style}`);
  if (style === 'third') { g.add(box(m, length, 0.05, 0.35, 'pineDeck', { y: 0.45 })); for (const dx of [-length / 2 + 0.1, length / 2 - 0.1]) g.add(box(m, 0.05, 0.45, 0.3, 'pineDeck', { x: dx, y: 0.225 })); collider(g, length, 0.5, 0.35); return g; }
  const slat = cachedGeometry(`slat:${length}`, () => new THREE.BoxGeometry(length, 0.035, 0.07));
  const im = new THREE.InstancedMesh(slat, m.get('teakOiled'), 8);
  const mm = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < 4; i++) { mm.makeTranslation(0, 0.45, -0.17 + i * 0.1); im.setMatrixAt(k++, mm); }
  const e = new THREE.Euler(-0.25, 0, 0);
  for (let i = 0; i < 4; i++) { mm.compose(new THREE.Vector3(0, 0.56 + i * 0.1, -0.26 - i * 0.025), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(k++, mm); }
  im.instanceMatrix.needsUpdate = true; im.castShadow = true; g.add(im);
  for (const dx of [-length / 2 + 0.08, length / 2 - 0.08]) {
    g.add(box(m, 0.05, 0.45, 0.42, 'ironDark', { x: dx, y: 0.225 }));
    g.add(box(m, 0.05, 0.5, 0.06, 'ironDark', { x: dx, y: 0.7, z: -0.25, rx: -0.25 }));
  }
  collider(g, length, 0.95, 0.5);
  return g;
}

export function makeDeckChair(m, { color } = {}) {
  const g = group('deckChair');
  const wood = m.get('teakOiled');
  const canvas = color ? m.clone('canvas', { color: new THREE.Color(color), side: THREE.DoubleSide }) : m.clone('canvas', { side: THREE.DoubleSide });
  // two side rails sloping back, a seat frame, leg rest and back
  for (const dx of [-0.28, 0.28]) {
    g.add(box(m, 0.04, 0.04, 0.9, wood, { x: dx, y: 0.36, z: 0.1 }));
    g.add(box(m, 0.04, 0.04, 0.7, wood, { x: dx, y: 0.6, z: -0.55, rx: -0.95 }));
    g.add(box(m, 0.04, 0.38, 0.04, wood, { x: dx, y: 0.19, z: 0.5 }), box(m, 0.04, 0.38, 0.04, wood, { x: dx, y: 0.19, z: -0.3 }));
  }
  const seat = mesh(cachedGeometry('plane:0.56:0.9', () => new THREE.PlaneGeometry(0.56, 0.9)), canvas, { y: 0.4, z: 0.1, rx: -Math.PI / 2, shadow: false });
  const back = mesh(cachedGeometry('plane:0.56:0.7', () => new THREE.PlaneGeometry(0.56, 0.7)), canvas, { y: 0.62, z: -0.56, rx: -0.95 + Math.PI / 2 - Math.PI / 2, shadow: false });
  back.rotation.x = -0.95 + Math.PI / 2;
  g.add(seat, back);
  collider(g, 0.62, 0.9, 1.3, { z: -0.1 });
  return g;
}

export function makeWardrobe(m, { w = 1.2, h = 2.0, d = 0.6, wood = 'mahogany' } = {}) {
  const g = group('wardrobe');
  g.add(box(m, w, h, d, wood, { collide: true }));
  g.add(box(m, w * 0.45, h * 0.9, 0.02, m.get(wood === 'mahogany' ? 'walnut' : 'oakDark'), { x: -w * 0.25, y: h / 2, z: d / 2 + 0.01 }), box(m, w * 0.45, h * 0.9, 0.02, m.get(wood === 'mahogany' ? 'walnut' : 'oakDark'), { x: w * 0.25, y: h / 2, z: d / 2 + 0.01 }));
  g.add(mesh(cachedGeometry('sphere:knob', () => new THREE.SphereGeometry(0.03, 8, 6)), m.get('brass'), { x: -0.05, y: h * 0.5, z: d / 2 + 0.04 }), mesh(cachedGeometry('sphere:knob', () => new THREE.SphereGeometry(0.03, 8, 6)), m.get('brass'), { x: 0.05, y: h * 0.5, z: d / 2 + 0.04 }));
  return g;
}
export function makeSofa(m, { w = 2, color } = {}) {
  const g = group('sofa');
  const mat = color ? m.clone('velvetGreen', { color: new THREE.Color(color) }) : m.get('velvetGreen');
  g.add(box(m, w, 0.42, 0.9, mat, { y: 0.21 }), box(m, w, 0.45, 0.22, mat, { y: 0.64, z: -0.34 }));
  g.add(box(m, 0.2, 0.3, 0.8, mat, { x: -w / 2 + 0.1, y: 0.57 }), box(m, 0.2, 0.3, 0.8, mat, { x: w / 2 - 0.1, y: 0.57 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(m, 0.03, 0.04, 0.12, 'mahogany', { x: sx * (w / 2 - 0.1), z: sz * 0.38, y: 0.06 }, 6));
  collider(g, w, 0.9, 0.9);
  return g;
}
export function makeDesk(m, {} = {}) {
  const g = group('desk');
  g.add(box(m, 1.4, 0.04, 0.7, 'mahogany', { y: 0.74 }));
  g.add(box(m, 0.45, 0.68, 0.6, 'mahogany', { x: -0.45, y: 0.34 }), box(m, 0.45, 0.68, 0.6, 'mahogany', { x: 0.45, y: 0.34 }));
  for (const y of [0.15, 0.38, 0.6]) for (const x of [-0.45, 0.45]) g.add(mesh(cachedGeometry('sphere:knobS', () => new THREE.SphereGeometry(0.018, 6, 5)), m.get('brass'), { x, y, z: 0.31 }));
  collider(g, 1.4, 0.76, 0.7);
  return g;
}
export function makePiano(m, { grand = false } = {}) {
  const g = group(grand ? 'piano.grand' : 'piano.upright');
  const mat = m.get('mahogany');
  if (grand) {
    g.add(box(m, 1.5, 0.3, 2.0, mat, { y: 0.85 }));
    const lid = box(m, 1.5, 0.03, 2.0, mat, { y: 1.3, z: -0.4, rx: -0.5 }); g.add(lid);
    g.add(box(m, 0.08, 0.08, 1.0, mat, { x: 0.7, y: 1.3, z: -0.2, rx: -0.5 }));
    for (const [x, z] of [[-0.6, 0.85], [0.6, 0.85], [0, -0.8]]) g.add(cyl(m, 0.04, 0.05, 0.7, mat, { x, z, y: 0.35 }, 8));
    g.add(box(m, 1.3, 0.04, 0.3, 'clothWhite', { y: 0.72, z: 1.05 }), box(m, 1.2, 0.03, 0.12, 'clothBlack', { y: 0.76, z: 0.98 }));
    collider(g, 1.5, 1.1, 2.3);
  } else {
    g.add(box(m, 1.45, 1.25, 0.6, mat, { collide: true, z: -0.1 }));
    g.add(box(m, 1.45, 0.08, 0.35, mat, { y: 0.72, z: 0.28 }), box(m, 1.3, 0.03, 0.3, 'clothWhite', { y: 0.78, z: 0.3 }), box(m, 1.2, 0.02, 0.1, 'clothBlack', { y: 0.81, z: 0.2 }));
    g.add(box(m, 0.06, 0.72, 0.06, mat, { x: -0.65, y: 0.36, z: 0.4 }), box(m, 0.06, 0.72, 0.06, mat, { x: 0.65, y: 0.36, z: 0.4 }));
  }
  return g;
}
export function makeFireplace(m, { w = 2, style = 'marble' } = {}) {
  const g = group('fireplace');
  const mat = style === 'grey' ? m.get('steelGrey') : m.get('marbleWhite');
  g.add(box(m, w, 1.25, 0.35, mat, { z: -0.1, collide: true }));
  const fire = box(m, w * 0.4, 0.75, 0.3, m.clone('clothBlack', { emissive: new THREE.Color(0xff5a1a), emissiveIntensity: 1.5 }), { y: 0.4, z: -0.08 });
  fire.userData.emissiveLamp = true; g.add(fire);
  g.add(box(m, w + 0.2, 0.08, 0.45, mat, { y: 1.29 }));
  g.add(box(m, w * 0.16, 1.15, 0.1, mat, { x: -w * 0.3, y: 0.6, z: 0.12 }), box(m, w * 0.16, 1.15, 0.1, mat, { x: w * 0.3, y: 0.6, z: 0.12 }));
  const pl = new THREE.PointLight(0xff6a2a, 10, 6, 2); pl.position.set(0, 0.6, 0.4); g.add(pl); g.userData.light = pl;
  return g;
}
export function makeBookcase(m, { w = 1.5, h = 2.2 } = {}) {
  const g = group('bookcase');
  g.add(box(m, w, h, 0.35, 'mahogany', { z: -0.0, collide: true }));
  const shelves = Math.max(2, Math.floor(h / 0.36));
  const bookGeom = cachedGeometry('box:book', () => new THREE.BoxGeometry(0.035, 0.24, 0.18));
  const colours = ['#5e1a26', '#1f2f5a', '#2f5a3a', '#6b4a2a', '#8c1b1b', '#2a2a2a', '#b08d57'];
  const count = shelves * Math.floor((w - 0.1) / 0.04);
  const im = new THREE.InstancedMesh(bookGeom, m.get('leatherDark'), count);
  const mm = new THREE.Matrix4();
  const c = new THREE.Color();
  let k = 0;
  for (let s = 0; s < shelves; s++) for (let i = 0; i < Math.floor((w - 0.1) / 0.04); i++) {
    const y = 0.15 + s * (h / shelves) + 0.12;
    mm.makeTranslation(-w / 2 + 0.07 + i * 0.04, y, 0.08); im.setMatrixAt(k, mm);
    im.setColorAt(k, c.set(colours[(i * 7 + s * 3) % colours.length])); k++;
  }
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  g.add(im);
  return g;
}
export function makePalm(m, { h = 2 } = {}) {
  const g = group('palm');
  g.add(cyl(m, 0.22, 0.18, 0.4, 'brass', { y: 0.2 }, 12));
  g.add(cyl(m, 0.03, 0.05, h * 0.5, 'clothBrown', { y: 0.4 + h * 0.25 }, 6));
  const frond = cachedGeometry('plane:frond', () => { const p = new THREE.PlaneGeometry(0.35, h * 0.6, 1, 4); p.translate(0, h * 0.3, 0); return p; });
  const mat = m.clone('clothGreen', { side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) { const f = mesh(frond, mat, { y: 0.4 + h * 0.5, ry: (i / 7) * Math.PI * 2, shadow: false }); f.rotateX(-0.9); g.add(f); }
  collider(g, 0.5, 0.6, 0.5);
  return g;
}
export function makeTrellis(m, { w = 2, h = 2.4 } = {}) {
  const g = group('trellis');
  const bar = cachedGeometry(`box:trellis:${h}`, () => new THREE.BoxGeometry(0.03, h, 0.02));
  const n = Math.max(2, Math.floor(w / 0.25));
  const im = new THREE.InstancedMesh(bar, m.get('whiteEnamel'), n * 2);
  const mm = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    mm.compose(new THREE.Vector3(x, h / 2, 0), q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.6), new THREE.Vector3(1, 1.2, 1)); im.setMatrixAt(i, mm);
    mm.compose(new THREE.Vector3(x, h / 2, 0), q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.6), new THREE.Vector3(1, 1.2, 1)); im.setMatrixAt(n + i, mm);
  }
  im.instanceMatrix.needsUpdate = true; g.add(im);
  // ivy patches
  const ivy = m.clone('clothGreen', { side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) g.add(mesh(cachedGeometry('plane:ivy', () => new THREE.PlaneGeometry(0.4, 0.3)), ivy, { x: -w / 2 + (i + 0.5) * (w / 4), y: h * (0.3 + 0.15 * (i % 3)), z: 0.03, shadow: false }));
  return g;
}
export function makeCrate(m, { w = 1, h = 1, d = 1 } = {}) { const g = group('crate'); g.add(box(m, w, h, d, 'woodCrate', { collide: true })); g.add(box(m, w + 0.02, 0.08, d + 0.02, 'oakDark', { y: h * 0.5 })); return g; }
export function makeBarrel(m, {} = {}) { const g = group('barrel'); g.add(cyl(m, 0.3, 0.26, 0.9, 'woodCrate', { collide: true }, 14)); for (const y of [0.15, 0.75]) g.add(mesh(cachedGeometry('torus:hoop', () => new THREE.TorusGeometry(0.3, 0.015, 6, 16)), m.get('ironDark'), { y, rx: Math.PI / 2 })); return g; }
export function makeSack(m, {} = {}) { const g = group('sack'); g.add(mesh(cachedGeometry('capsule:sack', () => { const c = new THREE.CapsuleGeometry(0.22, 0.4, 4, 8); c.rotateZ(Math.PI / 2); c.scale(1, 0.75, 1); return c; }), m.get('canvas'), { y: 0.17 })); return g; }
export function makeTrunk(m, {} = {}) { const g = group('trunk'); g.add(box(m, 0.9, 0.5, 0.5, 'leatherDark', { collide: true })); g.add(box(m, 0.92, 0.04, 0.52, 'brass', { y: 0.25 })); for (const x of [-0.3, 0.3]) g.add(box(m, 0.04, 0.5, 0.52, 'oakDark', { x })); return g; }
