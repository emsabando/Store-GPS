// Unit tests for src/npc/NPCManager.js — runs in Node with three.js math only (no WebGL).
//   node --test tests/unit/npc.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import { EventBus } from '../../src/core/Events.js';
import { NPCManager } from '../../src/npc/NPCManager.js';
import { insideArea, findArea } from '../../src/npc/Behaviours.js';
import { makeLook, pickLines } from '../../src/npc/Looks.js';

const ROOM = { id: 'lounge', name: 'Lounge', class: 'first', x0: -20, x1: 10, z0: -8, z1: 8, ceiling: 3 };
const SMOKE = { id: 'smoke', name: 'Smoking Room', x0: -45, x1: -25, z0: -7, z1: 7, ceiling: 3 };

function makeShip() {
  return {
    group: new Group(),
    quality: 'high',
    locations: new Map([
      ['a', { id: 'a', x: 0, y: 19, z: 0, yaw: 0, deck: 'boat' }],
      ['b', { id: 'b', x: 30, y: 19, z: 2, yaw: Math.PI, deck: 'boat' }],
      ['far', { id: 'far', x: -100, y: 19, z: 0, yaw: 0, deck: 'boat' }],
      ['below', { id: 'below', x: 0, y: 16.1, z: 0, yaw: 0, deck: 'A' }],
    ]),
    spec: {
      dims: { beamMoulded: 28.19 },
      decks: [
        { id: 'boat', y: 19, rooms: [ROOM, SMOKE] },
        { id: 'A', y: 16.1, rooms: [] },
      ],
      lifeboats: [{ id: 'b1', side: 'port', x: 60 }, { id: 'b2', side: 'starboard', x: -30 }],
    },
    deckAt() { return 'boat'; },
    deckY(id) { return id === 'A' ? 16.1 : 19; },
    lifeboats: [],
  };
}

const materials = { get: () => new MeshStandardMaterial(), clone: () => new MeshStandardMaterial() };

const CHARACTERS = {
  jack: { id: 'jack', name: 'Jack', faction: 'third', behaviour: 'wander', look: { sex: 'm', hat: 'flatcap' }, greeting: ['Hullo.'], idle: ['Fine day.'] },
  rosie: { id: 'rosie', name: 'Rosie', faction: 'first', behaviour: 'stand', greeting: ['Good evening.'] },
  bandleader: { id: 'bandleader', name: 'Mr Heartstring', faction: 'band', behaviour: 'play' },
  officer: { id: 'officer', name: 'Mr Lamplighter', faction: 'officer', behaviour: 'patrol' },
  steward: { id: 'steward', name: 'Promptly', faction: 'crew', behaviour: 'work' },
  sitter: { id: 'sitter', name: 'Dolly', faction: 'first', behaviour: 'sit' },
};

function setup() {
  const ship = makeShip();
  const bus = new EventBus();
  const npcs = new NPCManager({ ship, materials, characters: CHARACTERS, bus, clock: null, engine: { quality: 'high' }, world: null, player: null });
  return { ship, bus, npcs };
}

function finite(npc) {
  const p = npc.group.position;
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) && Number.isFinite(npc.group.rotation.y) && Number.isFinite(npc.state.yaw);
}

test('spawnNamed places a character at the location, parented to ship.group, with interactables', () => {
  const { ship, npcs } = setup();
  const jack = npcs.spawnNamed('jack', 'a');
  assert.ok(jack);
  assert.equal(jack.group.parent, ship.group);
  assert.deepEqual([jack.group.position.x, jack.group.position.y, jack.group.position.z], [0, 19, 0]);
  assert.equal(jack.data.behaviour, 'wander');
  assert.equal(jack.data.area.roomId, 'lounge');
  let meshes = 0;
  jack.group.traverse((o) => { if (o.isMesh) { meshes++; assert.deepEqual({ id: o.userData.interactable.id, type: o.userData.interactable.type, label: o.userData.interactable.label }, { id: 'jack', type: 'npc', label: 'Talk to Jack' }); } });
  assert.ok(meshes > 0);
  assert.equal(npcs.get('jack'), jack);
  assert.equal(npcs.all.length, 1);
  assert.equal(npcs.spawnNamed('nobody', 'a'), null);
  // Spawning again moves rather than duplicates.
  const again = npcs.spawnNamed('jack', 'b');
  assert.equal(again, jack);
  assert.equal(npcs.all.length, 1);
  assert.equal(jack.group.position.x, 30);
});

test('wandering NPCs and a crowd stay inside their room rectangle over 200 frames with no NaNs', () => {
  const { npcs } = setup();
  npcs.spawnNamed('jack', 'a');
  npcs.spawnNamed('rosie', 'a');
  npcs.spawnNamed('officer', 'a');
  npcs.spawnNamed('steward', 'a');
  npcs.spawnNamed('sitter', 'a');
  npcs.spawnNamed('bandleader', 'a');
  const crowd = npcs.spawnCrowd({ deck: 'boat', room: 'lounge', count: 30, faction: 'first', seed: 7 });
  assert.equal(crowd.length, 30);
  assert.equal(npcs.all.length, 36);
  for (const n of crowd) assert.equal(n.data.area.roomId, 'lounge');
  const player = new Vector3(2, 20.6, 1);
  const dt = 1 / 60;
  const moved = new Set();
  for (let f = 0; f < 200; f++) {
    npcs.update(dt, player);
    for (const npc of npcs.all) {
      assert.ok(finite(npc), `npc ${npc.id} has a non-finite transform at frame ${f}`);
      const p = npc.group.position;
      assert.ok(p.x >= ROOM.x0 && p.x <= ROOM.x1 && p.z >= ROOM.z0 && p.z <= ROOM.z1, `npc ${npc.id} left the room: ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
      assert.ok(insideArea(npc.data.area, p.x, p.z, 1e-6), `npc ${npc.id} left its area`);
      assert.equal(p.y, 19);
      if (npc.state.moving) moved.add(npc.id);
    }
  }
  assert.ok(moved.size > 0, 'somebody should have walked');
  const sitter = npcs.get('sitter'), band = npcs.get('bandleader');
  assert.equal(sitter.state.pose, 'sit');
  assert.equal(band.state.pose, 'play');
  assert.equal(sitter.group.position.x, 0);
});

test('crowd interaction emits a speech notification; named NPCs are left to main.js', () => {
  const { bus, npcs } = setup();
  const [c] = npcs.spawnCrowd({ deck: 'boat', room: 'lounge', count: 1, faction: 'third', seed: 3 });
  npcs.spawnNamed('jack', 'a');
  const got = [];
  bus.on('notify', (n) => got.push(n));
  bus.emit('player:interact', { interactable: c.group.userData.interactable });
  assert.equal(got.length, 1);
  assert.equal(got[0].kind, 'speech');
  assert.match(got[0].text, /^Steerage (man|woman): “.+”$/);
  bus.emit('player:interact', { interactable: npcs.get('jack').group.userData.interactable });
  assert.equal(got.length, 1);
  assert.equal(npcs.get('jack').state.talk > 0, true);
  npcs.update(1 / 60, new Vector3(1, 20.6, 0));
  assert.equal(npcs.get('jack').state.pose, 'talk');
});

test('quality cap limits crowd size; low cap is 40', () => {
  const ship = makeShip();
  const npcs = new NPCManager({ ship, materials, characters: CHARACTERS, bus: new EventBus(), engine: { quality: 'low' } });
  const a = npcs.spawnCrowd({ deck: 'boat', room: 'lounge', count: 35, faction: 'second' });
  const b = npcs.spawnCrowd({ deck: 'boat', room: 'smoke', count: 35, faction: 'first' });
  assert.equal(a.length, 35);
  assert.equal(b.length, 5);
  assert.equal(npcs.all.length, 40);
  npcs.despawnAll();
  assert.equal(npcs.all.length, 0);
  assert.equal(ship.group.children.length, 0);
});

test('crowd with no room data wanders within a disc and never leaves the ship', () => {
  const ship = makeShip();
  ship.spec.decks[0].rooms = [];
  const npcs = new NPCManager({ ship, materials, characters: CHARACTERS, bus: new EventBus(), engine: { quality: 'ultra' } });
  const jack = npcs.spawnNamed('jack', 'a');
  assert.equal(jack.data.area.r, 6);
  const crowd = npcs.spawnCrowd({ deck: 'boat', count: 20, faction: 'crew', seed: 11 });
  assert.equal(crowd.length, 20);
  for (let f = 0; f < 200; f++) {
    npcs.update(1 / 60, new Vector3(0, 20.6, 0));
    for (const npc of npcs.all) {
      assert.ok(finite(npc));
      const p = npc.group.position;
      assert.ok(insideArea(npc.data.area, p.x, p.z, 1e-6), `${npc.id} left its disc`);
    }
  }
  const p = jack.group.position;
  assert.ok(Math.hypot(p.x, p.z) <= 6 + 1e-6);
});

test('moveNamed walks on the same deck and teleports across decks or far away', () => {
  const { npcs } = setup();
  const jack = npcs.spawnNamed('jack', 'a');
  npcs.moveNamed('jack', 'b');
  assert.equal(jack.state.behaviour, 'goto');
  assert.equal(jack.group.position.x, 0, 'walks, does not teleport');
  let frames = 0;
  while (jack.state.behaviour === 'goto' && frames < 60 * 60) { npcs.update(1 / 60, new Vector3(200, 20, 0)); frames++; }
  assert.equal(jack.state.behaviour, 'wander');
  assert.ok(Math.hypot(jack.group.position.x - 30, jack.group.position.z - 2) < 0.5);
  assert.ok(frames > 60 * 15 && frames < 60 * 40, `walked 30 m in ${frames} frames`);
  npcs.moveNamed('jack', 'far');
  assert.equal(jack.group.position.x, -100, 'teleports when > 60 m');
  npcs.moveNamed('jack', 'below');
  assert.equal(jack.group.position.y, 16.1);
  assert.equal(jack.data.deck, 'A');
  assert.ok(finite(jack));
});

test('setPanic sends everyone (except the band) aft and toward the boats, then clustering near lifeboats', () => {
  const { npcs } = setup();
  const crowd = npcs.spawnCrowd({ deck: 'boat', room: 'lounge', count: 20, faction: 'second', seed: 5 });
  const band = npcs.spawnNamed('bandleader', 'a');
  const before = crowd.map((n) => n.group.position.x);
  npcs.setPanic(0.4);
  for (const n of crowd) assert.equal(n.state.behaviour, 'flee');
  assert.equal(band.state.behaviour, 'play');
  for (let f = 0; f < 600; f++) npcs.update(1 / 60, new Vector3(0, 20.6, 0));
  let aft = 0;
  crowd.forEach((n, i) => { assert.ok(finite(n)); if (n.group.position.x < before[i] - 1) aft++; });
  assert.ok(aft >= crowd.length * 0.7, `${aft}/${crowd.length} moved aft`);
  npcs.setPanic(1);
  for (let f = 0; f < 1500; f++) npcs.update(1 / 60, new Vector3(0, 20.6, 0));
  const zEdge = 28.19 / 2 - 1.6;
  let near = 0;
  for (const n of crowd) {
    assert.ok(finite(n));
    const p = n.group.position;
    assert.ok(Math.abs(p.z) <= 13.2 + 1e-6 && p.x >= -132 && p.x <= 132);
    const d = Math.min(Math.hypot(p.x - 60, p.z + zEdge), Math.hypot(p.x + 30, p.z - zEdge));
    if (d < 8) near++;
  }
  assert.ok(near >= crowd.length * 0.6, `${near}/${crowd.length} near a lifeboat station`);
  npcs.setPanic(0);
  for (const n of crowd) assert.equal(n.state.behaviour, n.data.behaviour);
});

test('steep trim slides standing NPCs toward the bow, and toward the stern after the break', () => {
  const { bus, npcs } = setup();
  const rosie = npcs.spawnNamed('rosie', 'a');
  const sitter = npcs.spawnNamed('sitter', 'a');
  bus.emit('sinking:state', { state: { trimDeg: 25, listDeg: 0, broken: false } });
  for (let f = 0; f < 120; f++) npcs.update(1 / 60, new Vector3(50, 20, 0));
  assert.ok(rosie.group.position.x > 0.3, `slid toward the bow: ${rosie.group.position.x}`);
  assert.equal(sitter.group.position.x, 0, 'seated passengers do not slide');
  const x1 = rosie.group.position.x;
  bus.emit('sinking:state', { trimDeg: 30, broken: true });
  for (let f = 0; f < 120; f++) npcs.update(1 / 60, new Vector3(50, 20, 0));
  assert.ok(rosie.group.position.x < x1, 'slides toward the stern after the break');
  assert.ok(finite(rosie));
});

test('LOD hides NPCs beyond 250 m and freezes them', () => {
  const { npcs } = setup();
  const jack = npcs.spawnNamed('jack', 'a');
  npcs.update(1 / 60, new Vector3(300, 20, 0));
  assert.equal(jack.group.visible, false);
  assert.equal(jack.state.lod, 3);
  const x = jack.group.position.x;
  for (let f = 0; f < 60; f++) npcs.update(1 / 60, new Vector3(300, 20, 0));
  assert.equal(jack.group.position.x, x);
  npcs.update(1 / 60, new Vector3(10, 20, 0));
  assert.equal(jack.group.visible, true);
  assert.equal(jack.state.lod, 0);
  npcs.update(1 / 60, new Vector3(100, 20, 0));
  assert.equal(jack.state.lod, 1);
});

test('looks follow the contract shape per faction and chatter lines are short', () => {
  for (const faction of ['first', 'second', 'third', 'crew', 'officer', 'band', 'modern']) {
    for (let i = 0; i < 20; i++) {
      const look = makeLook(faction, Math.random);
      assert.ok(['m', 'f'].includes(look.sex));
      assert.match(look.skin, /^#[0-9a-f]{6}$/i);
      assert.match(look.top.color, /^#[0-9a-f]{6}$/i);
      assert.ok(['none', 'tophat', 'bowler', 'flatcap', 'officer', 'bonnet', 'wide', 'straw'].includes(look.hat));
      assert.ok(['tailcoat', 'suit', 'jacket', 'waistcoat', 'shirt', 'uniform', 'gown', 'dress', 'blouse'].includes(look.top.kind));
      assert.ok(['trousers', 'skirt', 'gown'].includes(look.bottom.kind));
      assert.ok(look.height > 1.5 && look.height < 1.9);
    }
    for (const line of pickLines(faction, Math.random, 3)) assert.ok(line.length <= 140);
  }
  assert.equal(findArea({ decks: [] }, 'boat', 1, 2).r, 6);
});
