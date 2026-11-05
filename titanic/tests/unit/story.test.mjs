// Unit tests for the story systems (QuestManager + DialogueRunner) — run with `node --test tests/unit/story.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../src/core/Events.js';
import { QuestManager } from '../../src/story/QuestManager.js';
import { DialogueRunner } from '../../src/story/DialogueRunner.js';

// ---------------------------------------------------------------- fakes

const pad = (n) => String(n).padStart(2, '0');
class FakeClock {
  constructor() { this.date = '1912-04-09'; this.minutes = 12 * 60; this.calls = []; }   // a fresh clock, not yet on the watch's date
  get hhmm() { const m = ((Math.floor(this.minutes) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
  set(hhmm) { const [h, m] = hhmm.split(':').map(Number); this.minutes = h * 60 + (m || 0); this.calls.push(['set', hhmm]); }
  setDate(iso) { this.date = iso; this.calls.push(['setDate', iso]); }
  advanceTo(hhmm, seconds) { this.calls.push(['advanceTo', hhmm, seconds]); this.set(hhmm); }
  tick(mins) {
    this.minutes += mins;
    while (this.minutes >= 1440) {
      this.minutes -= 1440;
      const d = new Date(this.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); this.date = d.toISOString().slice(0, 10);
    }
  }
}

// PlayerController.position is the FEET point in world space (standing: 0.1 m above the deck floor).
class FakePlayer {
  constructor() { this.position = { x: 0, y: 0.1, z: 0 }; this.yaw = 0; this.teleports = []; }
  teleportLocal(x, y, z, yaw) { this.position = { x, y, z }; this.yaw = yaw; this.teleports.push([x, y, z, yaw]); }
  moveTo(x, y, z) { this.position = { x, y: y + 0.1, z }; }
}

const fakeShip = (interactables = new Map()) => ({
  worldToLocal: (v) => ({ x: v.x, y: v.y, z: v.z }),
  localToWorld: (v) => ({ x: v.x, y: v.y, z: v.z }),
  locations: new Map(),
  interactables,
  lights: { power: 1, setPower(p) { this.power = p; }, flickers: 0, flicker() { this.flickers++; } },
});

const fakeNpcs = () => ({
  spawned: [], moved: [], removed: [], panic: 0,
  spawnNamed(id, loc) { this.spawned.push([id, loc]); }, moveNamed(id, loc) { this.moved.push([id, loc]); },
  despawn(id) { this.removed.push(id); return true; }, setPanic(l) { this.panic = l; },
});

const CHARACTERS = {
  rosie: { id: 'rosie', name: 'Rosie Bukater', faction: 'first', look: { sex: 'f', hat: 'wide' } },
  tommy: { id: 'tommy', name: 'Tommy Ryan', faction: 'third', look: { sex: 'm', hat: 'flatcap' } },
};

const LOCATIONS = {
  bow_tip: { name: 'The bow', deck: 'boat', x: 128, y: 13.5, z: 0, yaw: 0 },
  stern_rail: { name: 'Stern rail', deck: 'B', x: -128, y: 13.5, z: 0, yaw: Math.PI },
  lounge: { name: 'Lounge', deck: 'A', x: 10, y: 16, z: 0, yaw: 0 },
};

const DISCOVERIES = [{ id: 'clock_panel', name: 'Honour and Glory', deck: 'boat', x: 20, y: 19, z: 0, plaque: 'A carved clock.' }];
const COLLECTIBLES = [{ id: 'menu_apr10', kind: 'menu', name: 'Luncheon menu', deck: 'D', x: 0, y: 5, z: 0, text: 'Consommé fermier.' }];

const DIALOGUES = {
  rosie_rail: {
    npcId: 'rosie', start: 'start',
    nodes: {
      start: { speaker: 'rosie', text: 'Oh — it\'s you, {player}.', choices: [
        { text: 'Lovely evening.', next: 'nice', effects: [{ type: 'reputation', faction: 'first', delta: 1 }] },
        { text: 'Mind the rail.', next: null, effects: [{ type: 'setFlag', flag: 'rude' }] },
        { text: 'About that sketch…', next: null, conditions: { flag: 'has_sketch' } },
      ] },
      nice: { speaker: 'player', text: 'Stars are out.', next: 'end' },
      end: { speaker: 'narrator', text: 'She almost smiles.', next: null, effects: [{ type: 'setFlag', flag: 'met_rosie' }] },
    },
  },
  tommy_default: { npcId: 'tommy', start: 'start', nodes: { start: { speaker: 'tommy', text: 'Grand ship, eh?', next: null } } },
  tommy_gossip: { npcId: 'tommy', ambient: true, requires: { flag: 'met_rosie' }, start: 'start', nodes: { start: { speaker: 'tommy', text: 'Heard you met the lady.', next: null } } },
};

const STORY = {
  watches: [
    { id: 'watch1', title: 'Sailing Day', date: '1912-04-10', startTime: '11:30', beats: [
      { id: 'w1_bow', title: 'King of the world', objective: 'Reach the bow.', locationId: 'bow_tip',
        trigger: { type: 'reach', locationId: 'bow_tip', radius: 4 }, onStart: [{ type: 'spawn', npcId: 'rosie', locationId: 'stern_rail' }], onComplete: [{ type: 'setFlag', flag: 'saw_bow' }], dialogueId: null, next: 'w1_rosie' },
      { id: 'w1_rosie', title: 'A lady at the rail', objective: 'Talk to Rosie.', locationId: 'stern_rail',
        trigger: { type: 'talk', npcId: 'rosie' }, onStart: [], onComplete: [{ type: 'give', item: 'sketch' }], dialogueId: 'rosie_rail', next: 'w1_wait' },
      { id: 'w1_wait', title: 'Dinner', objective: 'Wait for the bugle.', locationId: null,
        trigger: { type: 'time', at: '19:00' }, onStart: [], onComplete: [{ type: 'sound', id: 'bell' }], dialogueId: null, next: null },
      { id: 'w1_side', title: 'Side: the menu', objective: 'Pocket a menu.', locationId: null, optional: true,
        trigger: { type: 'flag', flag: 'got_menu' }, onStart: [], onComplete: [{ type: 'reputation', faction: 'third', delta: 2 }], dialogueId: null, next: null },
    ] },
    { id: 'watch2', title: 'The Last Night', date: '1912-04-14', startTime: '23:30', beats: [
      { id: 'w2_strike', title: 'Iceberg', objective: 'Hold on.', locationId: null,
        trigger: { type: 'time', at: '00:05' }, onStart: [{ type: 'setFlag', flag: 'last_night' }], onComplete: [{ type: 'startSinking' }], dialogueId: null, next: null },
    ] },
  ],
};

function makeGame({ story = STORY } = {}) {
  const bus = new EventBus();
  const events = [];
  for (const t of ['quest:watchStart', 'quest:beatStart', 'quest:objective', 'quest:beatComplete', 'quest:flag', 'quest:discover', 'quest:collect',
    'quest:reputation', 'quest:action:startSinking', 'quest:player', 'dialogue:start', 'dialogue:node', 'dialogue:end', 'notify', 'audio:play', 'ui:fade', 'cutscene:play']) {
    bus.on(t, (p) => events.push({ type: t, p }));
  }
  const clock = new FakeClock();
  const player = new FakePlayer();
  const npcs = fakeNpcs();
  const ship = fakeShip();
  const dialogue = new DialogueRunner({ dialogues: DIALOGUES, characters: CHARACTERS, bus });
  const quest = new QuestManager({ story, dialogues: DIALOGUES, locations: LOCATIONS, discoveries: DISCOVERIES, collectibles: COLLECTIBLES, characters: CHARACTERS, bus, clock, player, npcs, ship, dialogue, world: null });
  dialogue.quest = quest;
  const of = (type) => events.filter((e) => e.type === type).map((e) => e.p);
  return { bus, events, of, clock, player, npcs, ship, dialogue, quest };
}

// ---------------------------------------------------------------- tests

test('start() sets the clock from the watch and starts beats[0] with its onStart actions', () => {
  const g = makeGame();
  g.quest.start('watch1');
  assert.equal(g.clock.date, '1912-04-10');
  assert.equal(g.clock.hhmm, '11:30');
  assert.equal(g.of('quest:watchStart')[0].watch.id, 'watch1');
  assert.equal(g.quest.currentBeat.id, 'w1_bow');
  assert.equal(g.quest.watch.id, 'watch1');
  assert.deepEqual(g.npcs.spawned, [['rosie', 'stern_rail']]);
  const obj = g.of('quest:objective').at(-1);
  assert.equal(obj.text, 'Reach the bow.');
  assert.equal(obj.locationId, 'bow_tip');
  assert.equal(g.quest.beats.get('w1_rosie').title, 'A lady at the rail');
  assert.deepEqual(g.quest.progress, { done: 0, total: 4 });
  // the optional beat runs in parallel from the start of the watch
  assert.deepEqual(g.quest.activeOptional.map((b) => b.id), ['w1_side']);
});

test('reach trigger completes when the fake player moves to the location (ship-local)', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.quest.update(0.016);
  assert.equal(g.quest.currentBeat.id, 'w1_bow');
  g.player.moveTo(126.5, 13.5, 1);          // within 4 m horizontally, standing on the deck
  g.quest.update(0.016);
  assert.equal(g.of('quest:beatComplete')[0].beat.id, 'w1_bow');
  assert.ok(g.quest.flags.has('saw_bow'));
  assert.ok(g.of('quest:flag').some((e) => e.flag === 'saw_bow'));
  assert.equal(g.quest.currentBeat.id, 'w1_rosie');
  assert.deepEqual(g.quest.progress, { done: 1, total: 4 });
});

test('a player on the deck below or above does not satisfy a reach trigger (feet-based window)', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.player.moveTo(128, 13.5 - 2.7, 0);
  g.quest.update(0.1);
  assert.equal(g.quest.currentBeat.id, 'w1_bow');
  g.player.moveTo(128, 13.5 + 2.6, 0);          // the tightest deck spacing is 2.6 m
  g.quest.update(0.1);
  assert.equal(g.quest.currentBeat.id, 'w1_bow');
  g.player.position = { x: 128, y: 13.5 + 1.65, z: 0 };   // free/photo camera: position is the eye
  g.quest.update(0.1);
  assert.equal(g.quest.currentBeat.id, 'w1_rosie');
});

test('after the break-up the player is measured in the frame of the part under them (ship.partAt)', () => {
  const g = makeGame();
  g.quest.start('watch1');
  // Pretend the stern has pitched: a part whose local frame maps world → the original ship frame.
  g.ship.broken = true;
  g.ship.partAt = () => ({ group: { worldToLocal: (v) => { v.x += 100; v.y -= 30; return v; } } });
  g.player.moveTo(28, 43.5, 0);                 // world point that is bow_tip in the part's frame
  g.quest.update(0.1);
  assert.equal(g.quest.currentBeat.id, 'w1_rosie');
});

test('start() is a new game: state is reset, earlier watches count as skipped, a pre-positioned clock is kept', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.player.moveTo(128, 13.5, 0); g.quest.update(0.1);
  g.quest.setFlag('custom'); g.quest.give('ticket');
  assert.equal(g.quest.currentBeat.id, 'w1_rosie');
  // Quit to menu → New Game: the first beat must run again, not be skipped as "already completed".
  g.quest.start('watch1');
  assert.equal(g.quest.currentBeat.id, 'w1_bow');
  assert.equal(g.quest.flags.size, 0);
  assert.equal(g.quest.inventory.size, 0);
  assert.deepEqual(g.quest.progress, { done: 0, total: 4 });
  // main.js anchors the clock first and may apply ?time=: a clock already on the watch date at/after startTime is kept.
  g.clock.setDate('1912-04-10'); g.clock.set('23:40');
  g.quest.start('watch1');
  assert.equal(g.clock.hhmm, '23:40');
  g.quest.start('watch1', { setClock: true });
  assert.equal(g.clock.hhmm, '11:30');
  // Starting at watch2 directly (?watch=watch2): watch1's beats are skipped, progress counts them.
  g.quest.start('watch2');
  assert.equal(g.clock.date, '1912-04-14');
  assert.equal(g.quest.currentBeat.id, 'w2_strike');
  assert.deepEqual(g.quest.progress, { done: 3, total: 4 });
});

test('a beat with a reach/time trigger AND a dialogueId plays the dialogue when the trigger fires and completes on its end', () => {
  const story = { watches: [{ id: 'w', title: 'w', date: '1912-04-12', startTime: '09:00', beats: [
    { id: 'car', title: 'The Car', objective: 'Reach the Renault.', locationId: 'bow_tip', trigger: { type: 'reach', locationId: 'bow_tip', radius: 4 }, onStart: [], onComplete: [{ type: 'setFlag', flag: 'kissed' }], dialogueId: 'tommy_default', next: 'late' },
    { id: 'late', title: 'Late', objective: 'Wait.', trigger: { type: 'time', at: '23:30' }, onStart: [], onComplete: [], dialogueId: 'rosie_rail', next: 'opening' },
    { id: 'opening', title: 'Opening', objective: 'Listen.', trigger: { type: 'dialogueEnd', dialogueId: 'tommy_default' }, onStart: [], onComplete: [], dialogueId: 'tommy_default', next: null },
  ] }] };
  const g = makeGame({ story });
  g.quest.start('w');
  assert.equal(g.dialogue.active, false);                   // NOT played at beat start
  g.player.moveTo(128, 13.5, 0); g.quest.update(0.1);
  assert.equal(g.dialogue.dialogueId, 'tommy_default');
  assert.equal(g.quest.currentBeat.id, 'car');              // waits for the conversation
  g.quest.update(0.1); g.quest.update(0.1);                 // the trigger must not re-fire while it runs
  assert.equal(g.of('dialogue:start').length, 1);
  g.dialogue.advance();
  assert.ok(g.quest.flags.has('kissed'));
  assert.equal(g.quest.currentBeat.id, 'late');
  assert.equal(g.dialogue.active, false);
  g.clock.set('23:30'); g.quest.update(0.1);
  assert.equal(g.dialogue.dialogueId, 'rosie_rail');
  g.dialogue.choose(1);
  // 'dialogueEnd' (the conversation IS the beat): it plays as soon as the beat starts.
  assert.equal(g.quest.currentBeat.id, 'opening');
  assert.equal(g.dialogue.dialogueId, 'tommy_default');
  g.dialogue.advance();
  assert.equal(g.quest.storyComplete, true);
});

test('world-state actions: despawn uses npcs.despawn, lights clamp/flicker, panic, setPlayer renames {player}', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.quest.runActions([{ type: 'despawn', npcId: 'rosie' }, { type: 'lights' }, { type: 'lights', power: 5 }, { type: 'lights', flicker: true, power: 0.2 }, { type: 'panic', level: 0.7 }]);
  assert.deepEqual(g.npcs.removed, ['rosie']);
  assert.equal(g.ship.lights.power, 0.2);
  assert.equal(g.ship.lights.flickers, 1);
  assert.equal(g.npcs.panic, 0.7);
  assert.equal(g.quest.playerName, 'Jack');
  g.quest.runActions([{ type: 'setPlayer', characterId: 'rosie' }]);
  assert.equal(g.quest.playerId, 'rosie');
  g.dialogue.start('rosie_rail');
  assert.equal(g.of('dialogue:node').at(-1).text, 'Oh — it\'s you, Rosie Bukater.');
  assert.deepEqual(g.of('dialogue:node').at(-1).choiceKinds, [null, null]);
  g.dialogue.end();
  const saved = g.quest.save();
  const h = makeGame();
  h.quest.load(saved);
  assert.equal(h.quest.playerId, 'rosie');
  // Re-reading a plaque shows its text again and stays handled.
  assert.equal(g.quest.handleInteract({ id: 'p1', type: 'plaque', data: { text: 'Brass.' } }), true);
  assert.equal(g.quest.handleInteract({ id: 'p1', type: 'plaque', data: { text: 'Brass.' } }), true);
  assert.equal(g.of('notify').filter((n) => n.text.includes('Brass.')).length, 2);
});

test('talk trigger via handleInteract starts the dialogue; choices apply effects and the beat completes on dialogue:end', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.player.moveTo(128, 13.5, 0);
  g.quest.update(0.1);
  assert.equal(g.quest.currentBeat.id, 'w1_rosie');
  // Talking to someone else first: Tommy has a '<npcId>_default' ambient dialogue → handled, not gated.
  assert.equal(g.quest.handleInteract({ id: 'tommy', type: 'npc', label: 'Tommy Ryan' }), true);
  assert.equal(g.of('dialogue:node').at(-1).speakerName, 'Tommy Ryan');
  g.dialogue.advance();
  assert.equal(g.of('dialogue:end').at(-1).dialogueId, 'tommy_default');
  assert.equal(g.quest.currentBeat.id, 'w1_rosie');
  // Now Rosie.
  assert.equal(g.quest.handleInteract({ id: 'rosie', type: 'npc', label: 'Rosie Bukater' }), true);
  assert.equal(g.dialogue.active, true);
  const node = g.of('dialogue:node').at(-1);
  assert.equal(node.speaker, 'rosie');
  assert.equal(node.speakerName, 'Rosie Bukater');
  assert.equal(node.text, 'Oh — it\'s you, Jack.');
  assert.deepEqual(node.choices, ['Lovely evening.', 'Mind the rail.']);   // the gated third choice is filtered
  assert.deepEqual(node.portraitHint, CHARACTERS.rosie.look);
  g.bus.emit('ui:dialogueChoice', { index: 0 });
  assert.equal(g.quest.reputation.first, 1);
  assert.equal(g.of('dialogue:node').at(-1).speakerName, 'You');
  g.bus.emit('ui:dialogueAdvance');
  assert.equal(g.of('dialogue:node').at(-1).speakerName, 'Narrator');
  assert.ok(g.quest.flags.has('met_rosie'));          // node effects ran on entry
  assert.equal(g.quest.currentBeat.id, 'w1_rosie');   // not complete until the dialogue ends
  g.bus.emit('ui:dialogueAdvance');
  assert.equal(g.dialogue.active, false);
  assert.equal(g.of('dialogue:end').at(-1).dialogueId, 'rosie_rail');
  assert.equal(g.of('quest:beatComplete').at(-1).beat.id, 'w1_rosie');
  assert.equal(g.quest.inventory.get('sketch'), 1);
  assert.equal(g.quest.currentBeat.id, 'w1_wait');
  // A conditional ambient dialogue now outranks Tommy's default line.
  g.quest.handleInteract({ id: 'tommy', type: 'npc' });
  assert.equal(g.of('dialogue:node').at(-1).text, 'Heard you met the lady.');
  g.dialogue.end();
});

test('time trigger fires when the fake clock advances, and the watch ends into the next watch (new date → clock re-anchored)', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.player.moveTo(128, 13.5, 0); g.quest.update(0.1);
  g.quest.handleInteract({ id: 'rosie', type: 'npc' }); g.dialogue.choose(1);
  assert.equal(g.quest.currentBeat.id, 'w1_wait');
  g.clock.tick(60); g.quest.update(0.1);
  assert.equal(g.quest.currentBeat.id, 'w1_wait');
  g.clock.set('19:00'); g.quest.update(0.1);
  assert.ok(g.of('audio:play').some((e) => e.id === 'bell'));
  assert.equal(g.of('quest:watchStart').at(-1).watch.id, 'watch2');
  assert.equal(g.clock.date, '1912-04-14');
  assert.equal(g.clock.hhmm, '23:30');
  assert.equal(g.quest.currentBeat.id, 'w2_strike');
  assert.ok(g.quest.flags.has('last_night'));
  // '00:05' is after midnight relative to the beat's 23:30 start.
  g.clock.tick(20); g.quest.update(0.1);
  assert.equal(g.quest.currentBeat.id, 'w2_strike');
  g.clock.tick(20); g.quest.update(0.1);               // 00:10 on the 15th
  assert.equal(g.clock.date, '1912-04-15');
  assert.equal(g.of('quest:action:startSinking').length, 1);
  assert.equal(g.quest.currentBeat, null);
  assert.equal(g.quest.storyComplete, true);
});

test('optional beats run in parallel with the main line (flag trigger)', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.quest.setFlag('got_menu');
  g.quest.update(0.1);
  assert.equal(g.quest.currentBeat.id, 'w1_bow');          // main line untouched
  assert.equal(g.quest.activeOptional.length, 0);
  assert.equal(g.quest.reputation.third, 2);
  assert.ok(g.quest.completedBeats.has('w1_side'));
});

test('discoveries fire within 3 m, plaques discover, collectibles collect and hide their object, other items are left alone', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.player.moveTo(21, 19, 1); g.quest.update(0.3);
  assert.deepEqual(g.of('quest:discover').map((e) => e.id), ['clock_panel']);
  assert.ok(g.of('notify').some((e) => e.text.includes('A carved clock.')));
  g.quest.update(0.3);
  assert.equal(g.of('quest:discover').length, 1);          // only once
  assert.equal(g.quest.handleInteract({ id: 'boiler_plaque', type: 'plaque', label: 'Boiler No. 6', data: { text: '29 boilers.' } }), true);
  assert.ok(g.quest.discovered.has('boiler_plaque'));
  assert.ok(g.of('notify').at(-1).text.includes('29 boilers.'));
  const obj = { visible: true, userData: { interactable: { id: 'menu_apr10', type: 'item' } } };
  assert.equal(g.quest.handleInteract({ id: 'menu_apr10', type: 'item', label: 'Menu', object: obj }), true);
  assert.equal(obj.visible, false);
  assert.equal(obj.userData.interactable, undefined);
  assert.ok(g.quest.collected.has('menu_apr10'));
  assert.equal(g.of('quest:collect')[0].kind, 'menu');
  assert.equal(g.quest.handleInteract({ id: 'menu_apr10', type: 'item', object: obj }), false);   // already taken
  const car = { visible: true, userData: {} };
  assert.equal(g.quest.handleInteract({ id: 'renault', type: 'item', label: 'Renault', object: car }), false);
  assert.equal(car.visible, true);
  assert.equal(g.quest.handleInteract({ id: 'door_1', type: 'door' }), false);
  assert.equal(g.quest.handleInteract(null), false);
});

test('runActions covers the contract action types', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.quest.runActions([
    { type: 'moveNpc', npcId: 'rosie', locationId: 'lounge' },
    { type: 'setTime', time: '14:00' },
    { type: 'reputation', faction: 'first', delta: 50 },
    { type: 'give', item: 'ticket' }, { type: 'give', item: 'ticket' },
    { type: 'discover', id: 'clock_panel' },
    { type: 'cutscene', id: 'kiss' },
    { type: 'teleport', locationId: 'lounge' },
    { type: 'fade', seconds: 2 },
    { type: 'dialogue', dialogueId: 'tommy_default' },
    { type: 'bogus' },
  ]);
  assert.deepEqual(g.npcs.moved, [['rosie', 'lounge']]);
  assert.deepEqual(g.clock.calls.at(-2), ['advanceTo', '14:00', 4]);
  assert.equal(g.quest.reputation.first, 10);               // clamped
  assert.equal(g.quest.inventory.get('ticket'), 2);
  assert.ok(g.quest.discovered.has('clock_panel'));
  assert.equal(g.of('cutscene:play')[0].id, 'kiss');
  assert.deepEqual(g.player.teleports.at(-1), [10, 16.1, 0, 0]);
  assert.deepEqual(g.of('ui:fade')[0], { seconds: 2 });
  assert.equal(g.dialogue.dialogueId, 'tommy_default');
});

test('re-entrancy: an onStart action that completes the beat is deferred until the start finishes', () => {
  const story = { watches: [{ id: 'w', title: 'w', date: '1912-04-11', startTime: '09:00', beats: [
    { id: 'a', title: 'A', objective: 'a', trigger: { type: 'flag', flag: 'x' }, onStart: [{ type: 'setFlag', flag: 'x' }, { type: 'complete', beatId: 'a' }], onComplete: [], next: 'b' },
    { id: 'b', title: 'B', objective: 'b', trigger: { type: 'flag', flag: 'y' }, onStart: [], onComplete: [], next: null },
  ] }] };
  const g = makeGame({ story });
  g.quest.start('w');
  assert.deepEqual(g.of('quest:beatStart').map((e) => e.beat.id), ['a', 'b']);
  assert.deepEqual(g.of('quest:beatComplete').map((e) => e.beat.id), ['a']);
  assert.equal(g.quest.currentBeat.id, 'b');
  assert.equal(g.of('quest:objective').at(-1).beatId, 'b');
});

test('save()/load() roundtrip restores narrative state and re-emits the objective', () => {
  const g = makeGame();
  g.quest.start('watch1');
  g.player.moveTo(128, 13.5, 0); g.quest.update(0.1);
  g.quest.setFlag('custom');
  g.quest.give('ticket', 3);
  g.quest.addReputation('third', -4);
  g.quest.discover('clock_panel');
  g.quest.collect('menu_apr10');
  const json = JSON.stringify(g.quest.save());

  const h = makeGame();
  const obj = { visible: true, userData: { interactable: { id: 'menu_apr10' } } };
  h.ship.interactables.set('menu_apr10', { id: 'menu_apr10', type: 'item', object: obj });
  assert.equal(h.quest.load(json), true);
  assert.equal(h.quest.watch.id, 'watch1');
  assert.equal(h.quest.currentBeat.id, 'w1_rosie');
  assert.deepEqual(h.quest.activeOptional.map((b) => b.id), ['w1_side']);
  assert.ok(h.quest.flags.has('custom') && h.quest.flags.has('saw_bow'));
  assert.equal(h.quest.inventory.get('ticket'), 3);
  assert.deepEqual(h.quest.reputation, { first: 0, third: -4 });
  assert.ok(h.quest.discovered.has('clock_panel'));
  assert.ok(h.quest.collected.has('menu_apr10'));
  assert.ok(h.quest.completedBeats.has('w1_bow'));
  assert.deepEqual(h.quest.progress, { done: 1, total: 4 });
  assert.equal(obj.visible, false);                        // picked-up collectible stays hidden
  assert.equal(h.of('quest:objective').at(-1).text, 'Talk to Rosie.');
  assert.equal(h.of('quest:watchStart').at(-1).restored, true);
  assert.deepEqual(h.npcs.spawned, [['rosie', 'stern_rail']]);   // main.js despawns everyone before load(): placements are replayed
  // play on from the restored state
  assert.equal(h.quest.handleInteract({ id: 'rosie', type: 'npc' }), true);
  h.dialogue.choose(1);
  assert.equal(h.quest.currentBeat.id, 'w1_wait');
  assert.equal(h.quest.load('not json'[0] && null), false);
});

test('DialogueRunner ends unknown ids gracefully and treats stray picks on choice-less nodes as advance', () => {
  const bus = new EventBus();
  const ends = [];
  bus.on('dialogue:end', (p) => ends.push(p));
  const warn = console.warn;
  const warned = [];
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    const d = new DialogueRunner({ dialogues: DIALOGUES, characters: CHARACTERS, bus });
    assert.equal(d.start('nope'), false);
    assert.equal(d.active, false);
    assert.equal(ends.length, 1);
    assert.ok(warned.some((w) => w.includes('unknown dialogue')));
    assert.equal(d.start('tommy_default'), true);
    assert.equal(d.choose(3), true);            // no choices → advance → end
    assert.equal(d.active, false);
    assert.equal(ends.at(-1).dialogueId, 'tommy_default');
    assert.equal(d.advance(), false);           // nothing active
  } finally {
    console.warn = warn;
  }
});
