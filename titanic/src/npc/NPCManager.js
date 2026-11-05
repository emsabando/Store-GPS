/**
 * NPCManager — named characters and anonymous crowds aboard the ship (ARCHITECTURE.md §7).
 *
 *   const npcs = new NPCManager({ ship, materials, characters, bus, clock, engine, world, player });
 *   npcs.spawnNamed('jack', 'bow_tip');      npcs.moveNamed('jack', 'lounge');
 *   npcs.spawnCrowd({ deck: 'A', room: 'lounge', count: 20, faction: 'first' });
 *   npcs.update(dt, playerWorldPos);          npcs.setPanic(0.8);   npcs.despawnAll();
 *   npcs.get(id) → NPC | null;                npcs.all → NPC[]
 *
 * NPC = { id, group, character, data, state }. NPC groups are children of ship.group (so they ride,
 * tilt and split with the ship); positions are ship-local, y = deck floor height.
 *
 * Facing: group.rotation.y = state.yaw (+ character.yawOffset when the character model exposes one;
 * see ARCHITECTURE.md Extensions). yaw 0 = facing +x (bow).
 */
import * as THREE from 'three';
import { makeCharacter } from '../player/Character.js';
import { makeLook, mulberry32, pickLines, speakerName, PANIC_LINES } from './Looks.js';
import {
  STEPS, restPose, findArea, areaForRoom, discArea, randomPointInArea, clampToArea, clampToShip,
  turnToward, yawToward, SHIP_X_MIN, SHIP_X_MAX, SHIP_Z_MAX, findDeck,
} from './Behaviours.js';

const CAPS = { low: 40, medium: 90, high: 160, ultra: 260 };
const LOD_NEAR = 40, LOD_MID = 120, LOD_FAR = 250;
const LOD_INTERVAL = [0, 0.1, 0.5, Infinity]; // tier → seconds between steps (0 = every frame)
const GRID_CELL = 3;
const SEP_RADIUS = 1.1;
const DEFAULT_LIFEBOAT_X = [62, 52, 44, 36, -24, -34, -44, -54];
const BEHAVIOURS = new Set(['stand', 'wander', 'sit', 'patrol', 'play', 'work']);

const _v = new THREE.Vector3();
const _sep = { x: 0, z: 0 };

export class NPCManager {
  constructor({ ship, materials, characters, bus, clock, engine, world, player } = {}) {
    this.ship = ship || null;
    this.materials = materials || { get: () => new THREE.MeshStandardMaterial(), clone: () => new THREE.MeshStandardMaterial() };
    this.characters = characters || {};
    this.bus = bus || null;
    this.clock = clock || null;
    this.engine = engine || null;
    this.world = world || null;
    this.player = player || null;

    /** @type {Array<object>} live NPC records (contract: `all`) */
    this.all = [];
    this._byId = new Map();
    this._crowdSeq = 0;
    this.panic = 0;
    this.trimDeg = 0;
    this.listDeg = 0;
    this.broken = false;
    this.rng = mulberry32(0x7a1912);
    this._frames = []; // [{ parent, pos: Vector3 }] player position per parent frame, per update
    this._grid = new Map();
    this._cellsUsed = [];
    this._lifeboats = null;
    this._lastPlayer = new THREE.Vector3(0, 20, 0);
    this._offs = [];

    if (this.bus && typeof this.bus.on === 'function') {
      this._offs.push(this.bus.on('player:interact', (p) => this._onInteract(p)));
      this._offs.push(this.bus.on('sinking:state', (p) => this._onSinkingState(p)));
    }
  }

  // ------------------------------------------------------------------------------------------
  // Queries
  // ------------------------------------------------------------------------------------------

  get(id) { return this._byId.get(id) || null; }
  get count() { return this.all.length; }

  get quality() {
    return (this.engine && this.engine.quality) || (this.ship && this.ship.quality) || 'high';
  }

  get cap() { return CAPS[this.quality] || CAPS.high; }

  get spec() { return (this.ship && this.ship.spec) || {}; }

  _deckY(deckId, fallback = 0) {
    if (this.ship && typeof this.ship.deckY === 'function') {
      const y = this.ship.deckY(deckId);
      if (Number.isFinite(y)) return y;
    }
    const d = findDeck(this.spec, deckId);
    return d && Number.isFinite(d.y) ? d.y : fallback;
  }

  _deckAt(y) {
    if (this.ship && typeof this.ship.deckAt === 'function') { const d = this.ship.deckAt(y); if (d) return d; }
    return 'boat';
  }

  _root() {
    if (this.ship && this.ship.group) return this.ship.group;
    if (!this._fallbackRoot) this._fallbackRoot = new THREE.Group();
    return this._fallbackRoot;
  }

  /**
   * Where a named NPC stands for a landmark: 2.2 m ahead of the point along its yaw, facing back
   * at it. Beats teleport the player to the same landmark id, so standing ON the point would put
   * the first-person camera inside the character.
   */
  _standPoint(loc) {
    const yaw = loc.yaw || 0;
    const ahead = Number.isFinite(loc.standOff) ? loc.standOff : 2.2;
    return { x: (loc.x || 0) + Math.cos(yaw) * ahead, z: (loc.z || 0) - Math.sin(yaw) * ahead, yaw: yaw + Math.PI };
  }

  _location(locationId) {
    const locs = this.ship && this.ship.locations;
    if (!locs) return null;
    if (typeof locs.get === 'function') return locs.get(locationId) || null;
    return locs[locationId] || null;
  }

  // ------------------------------------------------------------------------------------------
  // Spawning
  // ------------------------------------------------------------------------------------------

  /** Place CHARACTERS[id] at ship.locations.get(locationId). Returns the NPC (existing one is moved). */
  spawnNamed(id, locationId) {
    const c = this.characters[id];
    if (!c) { console.warn(`[npc] unknown character "${id}"`); return null; }
    const existing = this._byId.get(id);
    if (existing) { this.moveNamed(id, locationId, true); return existing; }

    let loc = this._location(locationId);
    if (!loc) {
      const first = c.locations && Object.values(c.locations).find((l) => this._location(l));
      loc = first ? this._location(first) : null;
      if (!loc) { console.warn(`[npc] unknown location "${locationId}" for ${id}; placing on the Boat Deck`); loc = { x: 0, y: this._deckY('boat', 19), z: 0, yaw: 0, deck: 'boat' }; }
    }
    const deck = loc.deck || this._deckAt(loc.y ?? 0);
    const y = Number.isFinite(loc.y) ? loc.y : this._deckY(deck, 19);
    const look = this._completeLook(c.look, c.faction);
    const behaviour = BEHAVIOURS.has(c.behaviour) ? c.behaviour : 'stand';
    const name = c.name || id;
    const sp = this._standPoint(loc);
    const npc = this._create({
      id, name, faction: c.faction || 'modern', look, lines: (c.idle && c.idle.length ? c.idle : c.greeting) || [],
      x: sp.x, y, z: sp.z, yaw: sp.yaw, deck, behaviour, named: true,
      label: 'Talk to ' + name, locationId, character: c,
    });
    return npc;
  }

  /** Walk (same deck, < 60 m) or teleport a named NPC to a location. */
  moveNamed(id, locationId, teleportOnly = false) {
    const npc = this._byId.get(id);
    if (!npc) { if (this.characters[id]) return this.spawnNamed(id, locationId); return null; }
    const loc = this._location(locationId);
    if (!loc) { console.warn(`[npc] unknown location "${locationId}"`); return npc; }
    const deck = loc.deck || this._deckAt(loc.y ?? 0);
    const y = Number.isFinite(loc.y) ? loc.y : this._deckY(deck, npc.group.position.y);
    const pos = npc.group.position;
    const sp = this._standPoint(loc);
    const dx = sp.x - pos.x, dz = sp.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    npc.data.locationId = locationId;
    if (!teleportOnly && deck === npc.data.deck && dist < 60 && !npc.state.frozen) {
      npc.state.goto = { x: sp.x, z: sp.z, yaw: sp.yaw };
      npc.state.behaviour = 'goto';
      npc.state.hasTarget = false;
      npc.state.wait = 0;
      npc.data.area = findArea(this.spec, deck, sp.x, sp.z);
      this._setupPatrol(npc);
      return npc;
    }
    pos.set(sp.x, y, sp.z);
    npc.data.home.x = pos.x; npc.data.home.y = y; npc.data.home.z = pos.z; npc.data.home.yaw = sp.yaw;
    npc.data.deck = deck;
    npc.data.area = findArea(this.spec, deck, pos.x, pos.z);
    npc.state.yaw = sp.yaw;
    npc.state.goto = null;
    npc.state.behaviour = this.panic > 0 && npc.data.behaviour !== 'play' ? 'flee' : npc.data.behaviour;
    npc.state.hasTarget = false;
    npc.state.wait = 0;
    this._setupPatrol(npc);
    this._applyYaw(npc);
    return npc;
  }

  /**
   * Spawn anonymous passengers in a room rectangle. `room` is a room id from SHIP.decks[].rooms,
   * a room-like object { x0, x1, z0, z1 }, or omitted (a 12 m disc amidships on that deck).
   * Returns the NPCs created (fewer than `count` when the quality cap is reached).
   */
  spawnCrowd({ deck = 'boat', room = null, count = 10, faction = 'third', seed = null } = {}) {
    const out = [];
    const rng = seed !== null && seed !== undefined ? mulberry32(seed) : this.rng;
    const area = areaForRoom(this.spec, deck, room) || this._defaultArea(deck, room);
    const y = this._deckY(deck, 19);
    const n = Math.max(0, Math.min(count | 0, this.cap - this.all.length));
    const tmp = { x: 0, z: 0 };
    for (let i = 0; i < n; i++) {
      const look = makeLook(faction, rng);
      // pick a point whose floor is the deck itself (not a hatch cover, table or bench top)
      for (let attempt = 0; attempt < 8; attempt++) {
        randomPointInArea(area, rng, tmp);
        const gy = this.ship && typeof this.ship.groundAt === 'function' ? this.ship.groundAt(tmp.x, y + 1.2, tmp.z, 3) : null;
        if (gy === null || Math.abs(gy - y) < 0.3) break;
      }
      const behaviour = this._crowdBehaviour(faction, rng);
      const id = 'crowd_' + (this._crowdSeq++);
      const speaker = speakerName(faction, look.sex);
      const npc = this._create({
        id, name: speaker, faction, look, lines: pickLines(faction, rng, 3),
        x: tmp.x, y, z: tmp.z, yaw: rng() * Math.PI * 2 - Math.PI, deck, behaviour, named: false,
        label: 'Talk to ' + speaker.toLowerCase(), area, rng,
      });
      out.push(npc);
    }
    return out;
  }

  _defaultArea(deck, room) {
    if (room && typeof room === 'object' && Number.isFinite(room.x) && Number.isFinite(room.z)) return discArea(room.x, room.z, room.r || 6);
    return discArea(0, 0, 12);
  }

  _crowdBehaviour(faction, rng) {
    const r = rng();
    switch (faction) {
      case 'band': return 'play';
      case 'officer': return r < 0.5 ? 'stand' : 'patrol';
      case 'crew': return r < 0.5 ? 'work' : (r < 0.85 ? 'wander' : 'stand');
      default: return r < 0.5 ? 'wander' : (r < 0.82 ? 'stand' : 'sit');
    }
  }

  _completeLook(look, faction) {
    const base = makeLook(faction || 'modern', this.rng);
    if (!look || typeof look !== 'object') return base;
    const out = { ...base, ...look };
    out.hair = { ...base.hair, ...(look.hair || {}) };
    out.top = { ...base.top, ...(look.top || {}) };
    out.bottom = { ...base.bottom, ...(look.bottom || {}) };
    if (!Number.isFinite(out.height)) out.height = base.height;
    return out;
  }

  _create({ id, name, faction, look, lines, x, y, z, yaw, deck, behaviour, named, label, locationId = null, character = null, area = null, rng = this.rng }) {
    let ch;
    try { ch = makeCharacter(this.materials, look); } catch (err) { console.warn('[npc] makeCharacter failed', err); ch = null; }
    if (!ch || !ch.group) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 2, 6), this.materials.get('clothBlack')));
      ch = { group: g, height: 1.75, update() {}, setPose() {}, setLookTarget() {} };
    }
    const group = ch.group;
    group.name = 'NPC:' + id;
    group.position.set(x, y, z);
    group.userData.npcId = id;
    group.userData.part = { x0: x, x1: x }; // so Ship.split() moves the whole NPC, not its limbs
    const interactable = { id, type: 'npc', label, data: { npcId: id, name, faction } };
    group.userData.interactable = interactable;
    group.traverse((o) => { if (o.isMesh) o.userData.interactable = interactable; });
    this._root().add(group);

    const npc = {
      id, group, character: ch,
      data: {
        name, faction, look, lines: lines || [], named, locationId, character, deck,
        home: { x, y, z, yaw },
        area: area || findArea(this.spec, deck, x, z),
        behaviour, patrolB: { x, z }, speaker: named ? name : speakerName(faction, look.sex),
      },
      state: {
        behaviour: this.panic > 0 && behaviour !== 'play' ? 'flee' : behaviour,
        pose: null, yaw, moving: false, speed: 0, wait: rng() * 3, pause: 0, gesture: 0, gestureKind: 'talk',
        hasTarget: false, target: { x, z }, station: null, stuck: 0, patrolAtB: false, goto: null,
        walkSpeed: 1.05 + rng() * 0.4, runner: rng() < 0.4, stumbler: rng() < 0.5, stumbleIn: 2 + rng() * 5,
        lod: 0, acc: rng() * 0.1, visible: true, frozen: false, facingPlayer: false, looking: false, talk: 0,
        yawOffset: Number.isFinite(ch.yawOffset) ? ch.yawOffset : 0,
      },
    };
    this._setupPatrol(npc);
    this._applyYaw(npc);
    this._applyPose(npc, restPose(npc.state.behaviour));
    this.all.push(npc);
    this._byId.set(id, npc);
    return npc;
  }

  _setupPatrol(npc) {
    const h = npc.data.home, a = npc.data.area;
    const span = 10 + this.rng() * 10;
    const toCentre = h.x > 0 ? -1 : 1;
    let bx = h.x + toCentre * span;
    const p = { x: bx, z: h.z };
    if (a && !a.r) clampToArea(a, p);
    clampToShip(p);
    if (Math.abs(p.x - h.x) < 4) { p.x = h.x - toCentre * span; if (a && !a.r) clampToArea(a, p); clampToShip(p); }
    npc.data.patrolB.x = p.x; npc.data.patrolB.z = p.z;
  }

  // ------------------------------------------------------------------------------------------
  // Removal
  // ------------------------------------------------------------------------------------------

  despawn(id) {
    const npc = this._byId.get(id);
    if (!npc) return false;
    if (npc.group.parent) npc.group.parent.remove(npc.group);
    this._byId.delete(id);
    const i = this.all.indexOf(npc);
    if (i >= 0) this.all.splice(i, 1);
    return true;
  }

  despawnAll() {
    for (const npc of this.all) if (npc.group.parent) npc.group.parent.remove(npc.group);
    this.all.length = 0;
    this._byId.clear();
    this._crowdSeq = 0;
    this._grid.clear();
    this._cellsUsed.length = 0;
  }

  dispose() {
    this.despawnAll();
    for (const off of this._offs) { try { off(); } catch (_) { /* ignore */ } }
    this._offs.length = 0;
  }

  // ------------------------------------------------------------------------------------------
  // Panic & sinking
  // ------------------------------------------------------------------------------------------

  /** 0 = calm, 1 = everyone running for the boats. */
  setPanic(level) {
    const l = Math.max(0, Math.min(1, Number(level) || 0));
    const was = this.panic;
    this.panic = l;
    if (l > 0 && !this._lifeboats) this._lifeboats = this._lifeboatStations();
    for (const npc of this.all) {
      const st = npc.state;
      if (l > 0) {
        if (npc.data.behaviour === 'play') continue; // the band plays on
        if (st.behaviour !== 'flee') { st.behaviour = 'flee'; st.hasTarget = false; st.wait = this.rng() * 1.5; st.goto = null; st.pause = 0; }
        if (l > 0.6 && was <= 0.6) { st.hasTarget = false; st.station = null; } // re-target toward the boats
      } else if (st.behaviour === 'flee') {
        st.behaviour = npc.data.behaviour; st.hasTarget = false; st.wait = 0; st.pause = 0;
      }
    }
  }

  _lifeboatStations() {
    const beam = (this.spec.dims && this.spec.dims.beamMoulded) || 28.19;
    const zEdge = beam / 2 - 1.6;
    const out = [];
    const src = (this.ship && Array.isArray(this.ship.lifeboats) && this.ship.lifeboats.length) ? this.ship.lifeboats
      : (Array.isArray(this.spec.lifeboats) && this.spec.lifeboats.length ? this.spec.lifeboats : null);
    if (src) {
      for (const b of src) {
        let x = Number.isFinite(b.x) ? b.x : (b.object && b.object.position ? b.object.position.x : null);
        if (!Number.isFinite(x)) continue;
        const side = String(b.side || '').toLowerCase();
        const z = side.startsWith('p') ? -zEdge : (side.startsWith('s') ? zEdge : (Number.isFinite(b.z) ? Math.sign(b.z || 1) * zEdge : zEdge));
        out.push({ x, z });
      }
    }
    if (!out.length) for (const x of DEFAULT_LIFEBOAT_X) { out.push({ x, z: zEdge }); out.push({ x, z: -zEdge }); }
    return out;
  }

  _onSinkingState(s) {
    if (!s) return;
    const st = s.state || s;
    if (Number.isFinite(st.trimDeg)) this.trimDeg = st.trimDeg;
    if (Number.isFinite(st.listDeg)) this.listDeg = st.listDeg;
    if (typeof st.broken === 'boolean') this.broken = st.broken;
  }

  // ------------------------------------------------------------------------------------------
  // Interaction
  // ------------------------------------------------------------------------------------------

  _onInteract(p) {
    const it = p && p.interactable;
    if (!it || it.type !== 'npc') return;
    const npc = this._byId.get(it.id);
    if (!npc) return;
    npc.state.talk = 2.5;
    npc.state.hasTarget = false;
    if (npc.data.named) return; // main.js shows CHARACTERS[id].greeting itself
    if (!this.bus) return;
    const pool = this.panic > 0.3 ? PANIC_LINES : npc.data.lines;
    if (!pool || !pool.length) return;
    const line = pool[Math.floor(this.rng() * pool.length) % pool.length];
    this.bus.emit('notify', { text: `${npc.data.speaker}: “${line}”`, kind: 'speech', npcId: npc.id });
  }

  // ------------------------------------------------------------------------------------------
  // Per-frame update
  // ------------------------------------------------------------------------------------------

  update(dt, playerWorldPos) {
    if (!this.all.length) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (dt > 0.1) dt = 0.1;
    if (playerWorldPos && Number.isFinite(playerWorldPos.x)) this._lastPlayer.copy(playerWorldPos);
    const player = this._lastPlayer;
    this._frames.length = 0;
    const boatY = this._deckY('boat', 19);
    const slide = this._slideVelocity();
    const ctx = this._ctx || (this._ctx = { rng: this.rng, panic: 0, trimDeg: 0, broken: false, lifeboats: null, boatY: 19, sep: _sep });
    ctx.panic = this.panic; ctx.trimDeg = this.trimDeg; ctx.broken = this.broken; ctx.boatY = boatY;
    ctx.lifeboats = this._lifeboats || (this.panic > 0 ? (this._lifeboats = this._lifeboatStations()) : null);

    // Pass 1: LOD classification + separation grid of the active set.
    this._beginGrid();
    for (const npc of this.all) {
      const local = this._playerLocal(npc.group.parent, player);
      const p = npc.group.position;
      const dx = p.x - local.x, dy = p.y - local.y, dz = p.z - local.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const st = npc.state;
      st.dist2 = d2;
      st.lod = d2 < LOD_NEAR * LOD_NEAR ? 0 : d2 < LOD_MID * LOD_MID ? 1 : d2 < LOD_FAR * LOD_FAR ? 2 : 3;
      const vis = st.lod < 3;
      if (vis !== st.visible) { st.visible = vis; npc.group.visible = vis; }
      st.frozen = !vis;
      if (vis) this._gridInsert(npc);
    }

    // Pass 2: stepped behaviour per LOD tier.
    for (const npc of this.all) {
      const st = npc.state;
      if (st.frozen) continue;
      st.acc += dt;
      const interval = LOD_INTERVAL[st.lod];
      if (interval > 0 && st.acc < interval) continue;
      const step = st.acc;
      st.acc = 0;
      this._stepNPC(npc, step, ctx, player, slide);
    }
  }

  _slideVelocity() {
    const t = Math.abs(this.trimDeg);
    if (t <= 15) return 0;
    const speed = 0.25 + Math.min(1, (t - 15) / 30) * 1.4;
    // Bow-down (positive trim) → slide toward the bow (+x); after the break the stern section rears up
    // at its broken end, so loose passengers slide toward the stern (−x).
    const dir = Math.sign(this.trimDeg || 1) * (this.broken ? -1 : 1);
    return speed * dir;
  }

  _stepNPC(npc, dt, ctx, playerWorld, slide) {
    const st = npc.state;
    const pos = npc.group.position;
    const behaviour = st.behaviour;

    // Separation from neighbours (only for things that can move).
    _sep.x = 0; _sep.z = 0;
    if (behaviour !== 'sit' && behaviour !== 'play') this._separation(npc, _sep);

    // Talking: hold still, face the player.
    if (st.talk > 0) {
      st.talk -= dt;
      st.moving = false; st.speed = 0;
    } else {
      const fn = STEPS[behaviour] || STEPS.stand;
      fn(npc, ctx, dt);
    }

    // Face the player when idle and near.
    const local = this._playerLocal(npc.group.parent, playerWorld);
    const dxp = local.x - pos.x, dzp = local.z - pos.z;
    const lookR = behaviour === 'stand' ? 6 : 4;
    const near = (dxp * dxp + dzp * dzp) < lookR * lookR && Math.abs(local.y - pos.y) < 3.5;
    const shouldFace = near && !st.moving && behaviour !== 'sit' && behaviour !== 'play' && st.pause <= 0;
    if (shouldFace || st.talk > 0) {
      turnToward(st, yawToward(dxp, dzp), 3, dt);
      st.facingPlayer = true;
    } else st.facingPlayer = false;
    const shouldLook = near || st.talk > 0;
    if (shouldLook !== st.looking) {
      st.looking = shouldLook;
      try { npc.character.setLookTarget(shouldLook ? playerWorld : null); } catch (_) { /* stub */ }
    }

    // Tilt: standing NPCs slide along x when the ship is steeply trimmed.
    if (slide !== 0 && behaviour !== 'sit' && behaviour !== 'play') {
      pos.x += slide * dt;
      if (pos.x < SHIP_X_MIN) pos.x = SHIP_X_MIN; else if (pos.x > SHIP_X_MAX) pos.x = SHIP_X_MAX;
      if (pos.z < -SHIP_Z_MAX) pos.z = -SHIP_Z_MAX; else if (pos.z > SHIP_Z_MAX) pos.z = SHIP_Z_MAX;
    }

    // Keep y on the deck floor (flee may be climbing to the Boat Deck).
    if (behaviour !== 'flee' || !(npc.data.deck === 'boat' || npc.data.deck === 'A')) pos.y = npc.data.home.y;

    // Safety net against NaNs from bad data.
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z) || !Number.isFinite(pos.y)) {
      pos.set(npc.data.home.x, npc.data.home.y, npc.data.home.z);
      st.hasTarget = false;
    }
    if (!Number.isFinite(st.yaw)) st.yaw = npc.data.home.yaw;

    // Pose + animation.
    let pose;
    if (st.talk > 0) pose = 'talk';
    else if (st.gesture > 0 && behaviour === 'work') pose = st.gestureKind;
    else pose = st.moving ? 'walk' : restPose(behaviour);
    this._applyPose(npc, pose);
    this._applyYaw(npc);
    try { npc.character.update(dt, st.speed, st.moving); } catch (_) { /* stub */ }
  }

  _applyPose(npc, pose) {
    if (npc.state.pose === pose) return;
    npc.state.pose = pose;
    try { npc.character.setPose(pose); } catch (_) { /* stub */ }
  }

  _applyYaw(npc) {
    npc.group.rotation.y = npc.state.yaw + npc.state.yawOffset;
  }

  /** Player position in the frame of `parent` (ship.group, or a bow/stern part after the break). */
  _playerLocal(parent, playerWorld) {
    for (const f of this._frames) if (f.parent === parent) return f.pos;
    const f = this._framePool(this._frames.length);
    f.parent = parent;
    f.pos.copy(playerWorld);
    if (parent && typeof parent.worldToLocal === 'function') parent.worldToLocal(f.pos);
    this._frames.push(f);
    return f.pos;
  }

  _framePool(i) {
    if (!this._pool) this._pool = [];
    while (this._pool.length <= i) this._pool.push({ parent: null, pos: new THREE.Vector3() });
    return this._pool[i];
  }

  // ------------------------------------------------------------------------------------------
  // Separation grid (rebuilt per frame; arrays reused)
  // ------------------------------------------------------------------------------------------

  _cellKey(p) {
    const ix = Math.floor(p.x / GRID_CELL) + 512, iz = Math.floor(p.z / GRID_CELL) + 64, iy = Math.floor(p.y / 2.4) + 32;
    return ((iy * 1024) + ix) * 256 + iz;
  }

  _beginGrid() {
    for (const arr of this._cellsUsed) arr.length = 0;
    this._cellsUsed.length = 0;
  }

  _gridInsert(npc) {
    const key = this._cellKey(npc.group.position);
    let arr = this._grid.get(key);
    if (!arr) { arr = []; this._grid.set(key, arr); }
    if (arr.length === 0) this._cellsUsed.push(arr);
    arr.push(npc);
  }

  _separation(npc, out) {
    const p = npc.group.position;
    const parent = npc.group.parent;
    const r2 = SEP_RADIUS * SEP_RADIUS;
    const ix0 = Math.floor(p.x / GRID_CELL) + 512, iz0 = Math.floor(p.z / GRID_CELL) + 64, iy = Math.floor(p.y / 2.4) + 32;
    for (let ix = ix0 - 1; ix <= ix0 + 1; ix++) {
      for (let iz = iz0 - 1; iz <= iz0 + 1; iz++) {
        const arr = this._grid.get(((iy * 1024) + ix) * 256 + iz);
        if (!arr) continue;
        for (const other of arr) {
          if (other === npc || other.group.parent !== parent) continue;
          const q = other.group.position;
          const dx = p.x - q.x, dz = p.z - q.z;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r2 || Math.abs(p.y - q.y) > 2) continue;
          if (d2 < 1e-6) { out.x += (this.rng() - 0.5) * 0.5; out.z += (this.rng() - 0.5) * 0.5; continue; }
          const d = Math.sqrt(d2);
          const w = (1 - d / SEP_RADIUS) * 1.2;
          out.x += (dx / d) * w; out.z += (dz / d) * w;
        }
      }
    }
  }
}
