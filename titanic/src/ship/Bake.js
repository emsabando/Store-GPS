/**
 * Static-geometry bake for the whole ship (ARCHITECTURE.md "Integration additions").
 *
 * The builders return tens of thousands of small meshes (railing posts, window frames, chairs…),
 * one draw call each. After every builder has run, `bakeShip(ship)` merges the static ones into
 * a few hundred meshes, bucketed by:
 *   material × collide flag × break-up side (bow / stern of `ship.breakX`) × 40 m slab along x
 * so the break-up still moves whole buckets, collision stays correct and frustum culling keeps
 * some granularity. Anything animated, interactive, instanced, emissive-flickering or referenced
 * by a system (dynamic props, funnels, lifeboats + davits, interactables, doors, lamps, lines)
 * is kept as-is and re-parented to the ship group with its world transform preserved.
 *
 * Pooled lamp descriptors (`ship.lamps`) are converted to ship-local positions first, because
 * their original parents may be baked away.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SLAB_M = 150;   // two slabs along the ship: draw calls matter more than per-slab culling

function slim(o, mw) {
  const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
  src.applyMatrix4(mw);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.getAttribute('position'));
  if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal')); else g.computeVertexNormals();
  if (src.getAttribute('uv')) g.setAttribute('uv', src.getAttribute('uv'));
  else g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  return g;
}

/** True when an object (or any descendant) animates its own parts and must stay as built. */
function hasAnimatedParts(obj) {
  let found = false;
  obj.traverse((o) => {
    if (found) return;
    const u = o.userData || {};
    if (u.setTime || u.animate || u.noBake || u.joint || o.isSkinnedMesh || o.isInstancedMesh || o.isLight) found = true;
    if (o !== obj && u.door) found = true;
  });
  return found;
}

/**
 * Merge every mesh under `obj` (except under children that `skip` accepts) into one mesh per
 * material, parented to `obj` itself. The object keeps its transform, userData and references,
 * so dynamic props (deck chairs), lifeboats, davits and door leaves become 1–3 draw calls each.
 * Interactable tags found on the merged meshes are carried over to the merged result.
 */
function subBake(obj, { skip = () => false } = {}) {
  obj.updateMatrixWorld(true);
  const invObj = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  let interactable = obj.userData.interactable || null;
  obj.traverse((o) => {
    if (o === obj) return;
    let p = o.parent, skipped = skip(o);
    while (!skipped && p && p !== obj) { if (skip(p)) skipped = true; p = p.parent; }
    if (skipped) return;
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position) return;
    if (!o.visible && !o.userData.collide) { remove.push(o); return; }
    const mw = new THREE.Matrix4().multiplyMatrices(invObj, o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats[0]) return;
    const collide = !!o.userData.collide, invisible = !o.visible;
    if (o.userData.interactable && !interactable) interactable = o.userData.interactable;
    const push = (m, g) => {
      const key = `${invisible ? 'c' : m.uuid}|${collide ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) { b = { material: invisible ? null : m, geoms: [], collide, invisible, castShadow: false, receiveShadow: false }; buckets.set(key, b); }
      b.geoms.push(g);
      if (o.castShadow) b.castShadow = true;
      if (o.receiveShadow) b.receiveShadow = true;
    };
    const groups = Array.isArray(o.material) && o.geometry.groups && o.geometry.groups.length ? o.geometry.groups : null;
    if (groups) {
      const g = slim(o, mw);
      const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv = g.getAttribute('uv');
      for (const grp of groups) {
        const m = mats[grp.materialIndex] || mats[0];
        const count = Math.min(grp.count, pos.count - grp.start);
        if (count <= 0) continue;
        const sub = new THREE.BufferGeometry();
        sub.setAttribute('position', new THREE.BufferAttribute(pos.array.slice(grp.start * 3, (grp.start + count) * 3), 3));
        sub.setAttribute('normal', new THREE.BufferAttribute(nor.array.slice(grp.start * 3, (grp.start + count) * 3), 3));
        sub.setAttribute('uv', new THREE.BufferAttribute(uv.array.slice(grp.start * 2, (grp.start + count) * 2), 2));
        push(m, sub);
      }
    } else push(mats[0], slim(o, mw));
    remove.push(o);
  });
  if (!remove.length) return 0;
  for (const o of remove) if (o.parent) o.parent.remove(o);
  let made = 0;
  for (const b of buckets.values()) {
    const merged = b.geoms.length === 1 ? b.geoms[0] : mergeGeometries(b.geoms, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.invisible ? new THREE.MeshBasicMaterial({ visible: false }) : b.material);
    mesh.visible = !b.invisible;
    mesh.castShadow = b.castShadow && !b.invisible;
    mesh.receiveShadow = b.receiveShadow && !b.invisible;
    if (b.collide) mesh.userData.collide = true;
    if (interactable && !b.invisible) mesh.userData.interactable = interactable;
    mesh.name = `sub.${b.invisible ? 'colliders' : (b.material.name || 'mat')}`;
    obj.add(mesh);
    made++;
  }
  return made;
}

/**
 * @param {import('./Ship.js').Ship} ship
 * @param {{ log?: (s: string) => void }} [opts]
 */
export function bakeShip(ship, { log = () => {} } = {}) {
  const root = ship.group;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const breakX = Number.isFinite(ship.breakX) ? ship.breakX : -35;

  // ---- what must survive untouched ----
  const keepSet = new Set();
  for (const d of ship.dynamic || []) if (d && d.object) keepSet.add(d.object);
  for (const f of ship.funnels || []) if (f && f.isObject3D) keepSet.add(f);
  for (const lb of ship.lifeboats || []) { if (lb.object) keepSet.add(lb.object); if (lb.davit) keepSet.add(lb.davit); }
  for (const it of ship.interactables.values()) if (it && it.object) keepSet.add(it.object);
  if (ship.collision && ship.collision.mesh) keepSet.add(ship.collision.mesh);
  const keep = (o) => keepSet.has(o) || !!(o.userData.door || o.userData.interactable || o.userData.noBake
    || o.userData.setTime || o.isInstancedMesh || o.isLight || o.isLine || o.isPoints || o.isSprite || o.isCamera);

  // ---- lamp descriptors → ship-local, parented to the root ----
  const tmp = new THREE.Vector3();
  for (const L of ship.lamps || []) {
    if (!L.parent || L.parent === root) continue;
    L.parent.updateMatrixWorld(true);
    tmp.copy(L.local); L.parent.localToWorld(tmp); root.worldToLocal(tmp);
    L.local = tmp.clone(); L.parent = root;
  }

  // ---- door frames are static: move them out of the (kept) door groups before collecting ----
  const frameHolder = new THREE.Group(); frameHolder.name = 'doorFrames';
  root.add(frameHolder);
  root.traverse((o) => {
    if (!o.userData || !o.userData.door) return;
    for (const c of [...o.children]) {
      if (c.isMesh && !c.userData.interactable) { c.userData.part = o.userData.part || c.userData.part; frameHolder.attach(c); }
    }
  });
  root.updateMatrixWorld(true);

  // ---- collect ----
  const buckets = new Map();
  const kept = [];
  const box = new THREE.Box3();
  const centre = new THREE.Vector3();
  let baked = 0;
  root.traverse((o) => {
    if (o === root) return;
    let p = o.parent, inKept = false;
    while (p && p !== root) { if (keep(p)) { inKept = true; break; } p = p.parent; }
    if (inKept) return;
    if (keep(o)) { kept.push(o); return; }
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    if (!o.visible && !o.userData.collide) return;                       // invisible, non-colliding: drop
    const mw = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    // break-up side and x slab from the object's own part tag or its bounds (ship-local)
    let cx;
    if (o.userData.part && typeof o.userData.part.x0 === 'number') cx = (o.userData.part.x0 + o.userData.part.x1) / 2;
    else {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.copy(o.geometry.boundingBox).applyMatrix4(mw);
      cx = box.isEmpty() ? mw.elements[12] : box.getCenter(centre).x;
    }
    const side = cx > breakX ? 'bow' : 'stern';
    const slab = Math.floor(cx / SLAB_M);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const collide = !!o.userData.collide;
    const invisible = !o.visible;
    const mat0 = mats[0];
    if (!mat0) return;
    // array materials: bake group by group
    const groups = Array.isArray(o.material) && o.geometry.groups && o.geometry.groups.length ? o.geometry.groups : null;
    if (groups) {
      const g = slim(o, mw);            // non-indexed → groups are vertex ranges
      const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv = g.getAttribute('uv');
      for (const grp of groups) {
        const m = mats[grp.materialIndex] || mat0;
        const count = Math.min(grp.count, pos.count - grp.start);
        if (count <= 0) continue;
        const sub = new THREE.BufferGeometry();
        sub.setAttribute('position', new THREE.BufferAttribute(pos.array.slice(grp.start * 3, (grp.start + count) * 3), 3));
        sub.setAttribute('normal', new THREE.BufferAttribute(nor.array.slice(grp.start * 3, (grp.start + count) * 3), 3));
        sub.setAttribute('uv', new THREE.BufferAttribute(uv.array.slice(grp.start * 2, (grp.start + count) * 2), 2));
        push(m, sub);
      }
    } else push(mat0, slim(o, mw));
    baked++;
    function push(m, g) {
      const key = `${invisible ? 'c' : m.uuid}|${collide ? 1 : 0}|${side}|${slab}`;
      let b = buckets.get(key);
      if (!b) { b = { material: invisible ? null : m, geoms: [], collide, invisible, castShadow: false, emissive: false, cx, side }; buckets.set(key, b); }
      b.geoms.push(g);
      if (o.castShadow) b.castShadow = true;
      if (o.userData.emissiveLamp) b.emissive = true;
    }
  });

  // ---- rebuild the group ----
  const keptWithMatrix = kept.map((o) => ({ o, mw: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) }));
  root.clear();
  for (const { o, mw } of keptWithMatrix) { mw.decompose(o.position, o.quaternion, o.scale); root.add(o); }
  // Kept objects: collapse their own meshes. Doors keep their pivots (the leaves rotate), so the
  // frame merges under the door and each leaf merges under its pivot.
  let subBaked = 0;
  for (const { o } of keptWithMatrix) {
    if (o.isMesh || o.isLight || o.isLine || o.isPoints || o.isInstancedMesh || o.isSprite) continue;
    if (o.userData.door) {
      const pivots = o.children.filter((c) => !c.isMesh && c.children.length);
      subBaked += subBake(o, { skip: (c) => pivots.includes(c) });
      for (const pv of pivots) subBaked += subBake(pv);
      continue;
    }
    if (hasAnimatedParts(o)) continue;
    subBaked += subBake(o);
  }
  let meshes = 0, tris = 0;
  for (const b of buckets.values()) {
    const merged = b.geoms.length === 1 ? b.geoms[0] : mergeGeometries(b.geoms, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.invisible ? new THREE.MeshBasicMaterial({ visible: false }) : b.material);
    mesh.visible = !b.invisible;
    mesh.castShadow = b.castShadow && !b.invisible;
    mesh.receiveShadow = !b.invisible;
    if (b.collide) mesh.userData.collide = true;
    if (b.emissive) mesh.userData.emissiveLamp = true;
    // a representative x on the right side of the break keeps split() honest
    const px = b.side === 'bow' ? Math.max(b.cx, breakX + 1) : Math.min(b.cx, breakX - 1);
    mesh.userData.part = { x0: px, x1: px };
    mesh.name = `baked.${b.invisible ? 'colliders' : (b.material.name || 'mat')}.${b.side}.${Math.round(b.cx)}`;
    root.add(mesh);
    meshes++; tris += merged.getAttribute('position').count / 3;
  }
  // Lamp flicker/power scales material emissive: re-collect the meshes that carry lamp materials.
  if (Array.isArray(ship.lampMeshes)) {
    ship.lampMeshes.length = 0;
    root.traverse((o) => { if (o.isMesh && o.userData.emissiveLamp) ship.lampMeshes.push(o); });
  }
  log(`bake: ${baked} meshes → ${meshes} (${Math.round(tris / 1000)}k tris); ${kept.length} kept objects collapsed to ${subBaked} meshes`);
  return { baked, meshes, kept: kept.length };
}
