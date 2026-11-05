/**
 * Entry point — wires every module per ARCHITECTURE.md. The game state machine lives here.
 */
import * as THREE from 'three';
import { bus } from './core/Events.js';
import { settings } from './core/Settings.js';
import { input } from './core/Input.js';
import { Engine } from './core/Engine.js';
import { MaterialLibrary } from './materials/MaterialLibrary.js';
import { SHIP } from './data/shipSpec.js';
import { CHARACTERS } from './data/characters.js';
import { STORY, LOCATIONS, DISCOVERIES, COLLECTIBLES } from './data/story.js';
import { DIALOGUES } from './data/dialogue.js';
import { Ship } from './ship/Ship.js';
import { World } from './world/World.js';
import { GameClock } from './world/GameClock.js';
import { PlayerController } from './player/PlayerController.js';
import { NPCManager } from './npc/NPCManager.js';
import { QuestManager } from './story/QuestManager.js';
import { DialogueRunner } from './story/DialogueRunner.js';
import { SinkingDirector } from './sinking/SinkingDirector.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { UI } from './ui/UI.js';
import { installDebugAPI } from './debug/DebugAPI.js';

window.__errors = window.__errors || [];
window.__GAME_READY = false;
window.addEventListener('error', (e) => { window.__errors.push(String(e.message || e)); });
window.addEventListener('unhandledrejection', (e) => { window.__errors.push('unhandledrejection: ' + String(e.reason && (e.reason.stack || e.reason.message || e.reason))); });

const params = new URLSearchParams(location.search);
const SAVE_KEY = 'titanic.save.v1';

async function main() {
  const canvas = document.getElementById('game');
  const root = document.getElementById('ui');
  input.attach(canvas);

  // URL overrides (debug / smoke test)
  if (params.get('quality')) settings.set('quality', params.get('quality'));
  if (params.get('res')) settings.set('resolution', params.get('res'));
  if (params.get('scale')) settings.set('renderScale', parseFloat(params.get('scale')));
  const quality = settings.get('quality');

  const ui = new UI({ root, bus, settings, spec: SHIP, story: STORY, characters: CHARACTERS, discoveries: DISCOVERIES, collectibles: COLLECTIBLES, locations: LOCATIONS });
  const engine = new Engine({ canvas, settings, preserveDrawingBuffer: !!params.get('manual') });
  if (params.get('manual')) engine.manualRender = true;
  const clock = new GameClock();
  const progress = (pct, label) => bus.emit('loading:progress', { pct: Math.round(pct), label });
  progress(1, 'Laying the keel at Harland & Wolff');

  const materials = await MaterialLibrary.load({ quality, onProgress: (p, l) => progress(1 + p * 0.09, l || 'Mixing paint and varnish') });
  const ship = new Ship({ spec: SHIP, materials, quality });
  await ship.build((p, l) => progress(10 + p * 0.65, l));
  for (const [id, loc] of Object.entries(LOCATIONS || {})) if (!ship.locations.has(id)) ship.locations.set(id, { id, ...loc });
  engine.scene.add(ship.group);

  progress(76, 'Filling the North Atlantic');
  const world = new World({ engine, materials, clock, quality, ship });
  await world.build();

  progress(88, 'Mustering passengers and crew');
  const player = new PlayerController({ engine, input, ship, settings, bus, materials, world });
  const npcs = new NPCManager({ ship, materials, characters: CHARACTERS, bus, clock, engine, world, player });
  const audio = new AudioEngine({ settings, bus });
  audio.attachCamera?.(engine.camera);
  const dialogue = new DialogueRunner({ dialogues: DIALOGUES, characters: CHARACTERS, bus });
  const quest = new QuestManager({ story: STORY, dialogues: DIALOGUES, locations: LOCATIONS, discoveries: DISCOVERIES, collectibles: COLLECTIBLES, characters: CHARACTERS, bus, clock, player, npcs, ship, dialogue, world });
  dialogue.quest = quest;
  const sinking = new SinkingDirector({ ship, world, clock, bus, spec: SHIP, npcs, player, audio });

  const state = {
    mode: 'loading', clock: { date: clock.date, hhmm: clock.hhmm }, heading: 0, deck: 'C',
    player: { x: 0, y: 0, z: 0 }, objective: null, sinking: null, stats: null, reputation: { first: 0, third: 0 }, fps: 0,
    inventory: [], discovered: [], collected: [], flags: [],
  };
  const game = { engine, ship, world, clock, player, npcs, quest, dialogue, sinking, audio, ui, materials, state, spec: SHIP };
  installDebugAPI(game);

  // ---- state machine ----
  // Attract view: while the menu is up the camera circles the ship from off the port bow.
  const attract = { on: false, t: 0, a0: -2.2 };
  const setMode = (mode) => {
    state.mode = mode;
    const playing = mode === 'playing';
    player.enabled = playing;
    if (!playing && mode !== 'photo') input.exitPointerLock();
    if (mode === 'menu') { attract.on = true; attract.t = 0; player.setMode('free'); }
    else attract.on = false;
    bus.emit('game:mode', { mode });
  };
  const startNewGame = ({ watch = params.get('watch') || 'watch1', at = params.get('at') } = {}) => {
    const w = STORY.watches.find((x) => x.id === watch) || STORY.watches[0];
    if (w) { clock.setDate(w.date); clock.set(w.startTime); }
    if (params.get('time')) clock.set(params.get('time'));
    const spawnId = at || (w && w.beats[0] && w.beats[0].locationId) || 'spawn_southampton';
    const loc = ship.locations.get(spawnId) || ship.locations.get('spawn_southampton') || { x: 0, y: ship.deckY('boat') || 19, z: 0, yaw: 0 };
    player.setMode(loc.mode || 'first');          // before the teleport: free mode would offset the eye
    player.teleportLocal(loc.x, (loc.y ?? 0) + 0.1, loc.z, loc.yaw || 0);
    if (loc.pitch !== undefined) player.pitch = loc.pitch;
    npcs.despawnAll();
    quest.start(w ? w.id : 'watch1');
    audio.init().catch(() => {});
    setMode('playing');
    bus.emit('ui:requestPointerLock');
  };
  const save = () => {
    try {
      const local = ship.worldToLocal(player.position);
      const data = { quest: quest.save(), player: { x: local.x, y: local.y, z: local.z, yaw: player.yaw }, clock: { date: clock.date, minutes: clock.minutes }, sinking: sinking.active };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      bus.emit('notify', { text: 'Entered in the ship\'s log.', kind: 'save' });
    } catch (err) { console.warn('save failed', err); }
  };
  const load = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { bus.emit('notify', { text: 'No entry in the log to return to.', kind: 'warn' }); return false; }
      const data = JSON.parse(raw);
      clock.setDate(data.clock.date); clock.minutes = data.clock.minutes;
      npcs.despawnAll();
      quest.load(data.quest);
      player.setMode('first');
      player.teleportLocal(data.player.x, data.player.y + 0.05, data.player.z, data.player.yaw || 0);
      if (data.sinking && !sinking.active) sinking.start();
      setMode('playing');
      bus.emit('ui:requestPointerLock');
      return true;
    } catch (err) { console.warn('load failed', err); return false; }
  };

  bus.on('ui:newGame', () => startNewGame({}));
  bus.on('ui:continue', () => { if (!load()) startNewGame({}); });
  bus.on('ui:save', save);
  bus.on('ui:load', load);
  bus.on('ui:resume', () => { setMode('playing'); bus.emit('ui:requestPointerLock'); });
  bus.on('ui:quitToMenu', () => { setMode('menu'); });
  bus.on('ui:mode', ({ mode }) => { if (mode) setMode(mode); });
  bus.on('ui:requestPointerLock', () => { if (state.mode === 'playing' || state.mode === 'photo') input.requestPointerLock(); });
  bus.on('ui:toggleView', () => player.setMode(player.mode === 'first' ? 'third' : 'first'));
  bus.on('ui:advanceTime', ({ to, date }) => { if (!to) return; if (date && date !== clock.date) { clock.setDate(date); clock.set(to); } else clock.advanceTo(to, settings.get('reduceMotion') ? 0.5 : 4); });
  // crowds and the band follow the watches
  const CROWDS = {
    watch1: [['C', 'grand_staircase_C', 10, 'first'], ['D', 'open_space_3rd', 14, 'third'], ['C', null, 8, 'third'], ['boat', null, 10, 'first'], ['B', 'cafe_parisien', 6, 'first'], ['boat', 'bridge', 3, 'officer']],
    watch2: [['A', 'lounge', 10, 'first'], ['D', 'reception_room', 12, 'first'], ['D', 'dining_saloon', 16, 'first'], ['A', null, 10, 'first'], ['C', 'general_room_3rd', 14, 'third'], ['B', null, 8, 'third'], ['tankTop', 'boiler_room_6', 6, 'crew']],
    watch3: [['D', 'dining_saloon', 14, 'first'], ['A', 'smoking_room', 8, 'first'], ['C', 'general_room_3rd', 12, 'third'], ['boat', null, 10, 'first'], ['tankTop', 'boiler_room_6', 6, 'crew'], ['E', null, 6, 'crew']],
    watch4: [['boat', null, 24, 'first'], ['boat', null, 10, 'crew'], ['A', 'smoking_room', 6, 'first'], ['D', 'open_space_3rd', 12, 'third'], ['B', null, 10, 'third']],
    epilogue: [],
  };
  const BAND = { watch1: ['ragtime', 'band_reception'], watch2: ['waltz', 'band_reception'], watch3: ['autumn', 'band_reception'], watch4: ['nearerMyGod', 'boat_deck_entrance_fwd'], epilogue: [null, null] };
  const scale = { low: 0.4, medium: 0.6, high: 1, ultra: 1.3 }[quality] || 1;
  bus.on('quest:watchStart', ({ watch }) => {
    if (!watch) return;
    for (const [deck, room, count, faction] of CROWDS[watch.id] || []) { try { npcs.spawnCrowd({ deck, room, count: Math.max(2, Math.round(count * scale)), faction }); } catch (err) { console.warn('crowd spawn failed', err); } }
    const [piece, locId] = BAND[watch.id] || [];
    const loc = locId ? ship.locations.get(locId) : null;
    if (piece && loc) { audio.band.setPosition(ship.localToWorld(new THREE.Vector3(loc.x, loc.y + 1.2, loc.z))); audio.band.play(piece, { loop: true }); } else audio.band.stop(2);
    state.watchTitle = watch.title;
  });
  bus.on('quest:flag', ({ flag }) => { if (flag === 'band_ragtime') audio.band.play('ragtime', { loop: true }); if (flag === 'band_hymn') audio.band.play('nearerMyGod', { loop: true }); });
  window.addEventListener('keydown', async (e) => {
    if (e.code === 'KeyC' && state.mode === 'photo') {
      try { const blob = await engine.screenshot(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `titanic-plate-${Date.now()}.png`; a.click(); bus.emit('notify', { text: 'Plate exposed.', kind: 'log' }); bus.emit('audio:play', { id: 'ui_click' }); } catch (err) { console.warn(err); }
    }
  });
  bus.on('ui:teleport', ({ locationId }) => { const l = ship.locations.get(locationId); if (!l) return; player.teleportLocal(l.x, (l.y ?? 0) + 0.1, l.z, l.yaw || 0); if (world.setInside) { world.setInside(!!player.inside); world.snapInside?.(); } });
  bus.on('ui:photoMode', ({ on }) => { setMode(on ? 'photo' : 'playing'); player.setMode(on ? 'free' : settings.get('viewMode')); });
  bus.on('input:escape', () => { if (state.mode === 'playing') setMode('paused'); });
  bus.on('input:pointerlockchange', ({ locked }) => { if (!locked && state.mode === 'playing' && !params.get('debug')) setMode('paused'); });
  bus.on('dialogue:node', () => { if (state.mode === 'playing') setMode('dialogue'); });
  bus.on('dialogue:end', () => { if (state.mode === 'dialogue') { setMode('playing'); bus.emit('ui:requestPointerLock'); } });
  bus.on('player:died', () => { setMode('gameover'); });
  bus.on('quest:action:startSinking', () => { if (!params.get('nosink')) sinking.start(); });
  bus.on('sinking:event', (e) => { if (e && e.id === 'breakup') ship.split(ship.breakX); });

  // Default interaction handling (story gets first refusal)
  bus.on('player:interact', ({ interactable }) => {
    if (!interactable) return;
    if (quest.handleInteract && quest.handleInteract(interactable)) return;
    switch (interactable.type) {
      case 'door': case 'gate':
        if (interactable.data && typeof interactable.data.toggle === 'function') interactable.data.toggle();
        audio.play(interactable.type === 'gate' ? 'gate' : 'door');
        break;
      case 'item': quest.collect ? quest.collect(interactable.id) : null; break;
      case 'plaque': quest.discover ? quest.discover(interactable.id) : null; break;
      case 'npc': {
        const c = CHARACTERS[interactable.id];
        const lines = (c && c.greeting) || ['Good day to you.'];
        bus.emit('notify', { text: `${c ? c.name : 'Passenger'}: “${lines[Math.floor(Math.random() * lines.length)]}”`, kind: 'speech' });
        break;
      }
      case 'sit': if (player.sit) player.sit(interactable); break;
      default: break;
    }
  });

  // ---- frame loop ----
  let fpsAcc = 0, fpsN = 0, roomTimer = 0;
  const camPos = new THREE.Vector3();
  engine.onUpdate((dt, elapsed) => {
    input.beginFrame();
    const playing = state.mode === 'playing' || state.mode === 'photo';
    if (playing || state.mode === 'dialogue') clock.update(dt);
    engine.camera.getWorldPosition(camPos);
    if (typeof world.setInside === 'function') world.setInside(!!player.inside);
    world.update(dt, camPos);
    ship.update(dt, camPos);
    if (playing) {
      player.update(dt);
      npcs.update(dt, player.position);
      quest.update(dt);
    } else if (attract.on && state.mode === 'menu') {
      attract.t += dt;
      const a = attract.a0 + attract.t * 0.025, r = 250, h = 32;
      player.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
      player.yaw = Math.atan2(player.position.z, -player.position.x);   // look at the ship's centre
      player.pitch = -0.07;
      player.update(dt);
    }
    if (state.mode !== 'menu' && state.mode !== 'loading') sinking.update(dt);
    audio.update(dt, { inside: player.inside, deck: player.currentDeck, wind: world.wind || 0.3, speed: player.speed || 0, sinking: sinking.active, mode: state.mode });
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) { state.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    state.clock = { date: clock.date, hhmm: clock.hhmm };
    state.heading = player.heading || 0;
    state.deck = player.currentDeck || state.deck;
    const lp = ship.worldToLocal(player.position);
    state.player = { x: lp.x, y: lp.y, z: lp.z };
    state.objective = quest.currentBeat ? { title: quest.currentBeat.title, text: quest.currentBeat.objective, locationId: quest.currentBeat.locationId } : null;
    state.nextTime = quest.nextTime || null;
    state.inventory = quest.inventory ? [...quest.inventory.keys()] : [];
    roomTimer += dt;
    if (roomTimer > 0.5) { roomTimer = 0; const d = SHIP.decks.find((x) => x.id === state.deck); const r = d && d.rooms.find((rr) => lp.x >= rr.x0 && lp.x <= rr.x1 && lp.z >= rr.z0 && lp.z <= rr.z1 && !/casing/.test(rr.id)); state.room = r ? r.name.split(/[—(]/)[0].trim() : ''; }
    state.sinking = sinking.active ? sinking.state : null;
    state.reputation = quest.reputation || state.reputation;
    state.stats = engine.stats;
    state.pointerLocked = input.locked;
    state.viewMode = player.mode;
    ui.update(state);
    input.endFrame();
  });
  engine.start();

  progress(100, 'All aboard');
  setMode('menu');
  bus.emit('game:ready');
  window.__GAME_READY = true;
  if (params.get('autostart')) startNewGame({});
}

main().catch((err) => {
  console.error(err);
  window.__errors.push('main: ' + (err && (err.stack || err.message || err)));
  const el = document.getElementById('ui');
  if (el) el.innerHTML = `<div style="color:#f4e3b2;background:#0b1e33;font:16px Georgia,serif;padding:2rem;height:100%">The ship could not be launched: <pre style="white-space:pre-wrap">${String(err && (err.stack || err))}</pre></div>`;
});
