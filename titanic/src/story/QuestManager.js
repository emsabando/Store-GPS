/**
 * QuestManager — drives STORY watches/beats, triggers, actions, discoveries, collectibles,
 * reputation and the save/load of narrative state (ARCHITECTURE.md §2, §7, §11).
 *
 *   const quest = new QuestManager({ story, dialogues, locations, discoveries, collectibles, characters,
 *                                    bus, clock, player, npcs, ship, dialogue, world });
 *   quest.start('watch1');  quest.update(dt);  quest.handleInteract(interactable) → boolean
 *   quest.currentBeat, quest.watch, quest.beats (Map id→beat), quest.activeOptional (beat[]),
 *   quest.flags (Set), quest.inventory (Map item→count), quest.reputation { first, third },
 *   quest.discovered (Set), quest.collected (Set), quest.completedBeats (Set), quest.progress → { done, total },
 *   quest.nextTime → { at, date } | null  (the time the current beat is waiting for; UI "Advance the Watch")
 *   quest.complete(beatId), quest.runActions(actions), quest.collect(id, interactable?), quest.discover(id),
 *   quest.setFlag(flag, on=true), quest.addReputation(faction, delta), quest.save() → json, quest.load(json)
 *   quest.playerId / quest.playerName (the playable character; Watch IV hands off Jack ↔ Rosie via the `setPlayer` action)
 *
 * Beat semantics: a beat's `dialogueId` is the conversation that *completes* it — for a 'talk' trigger it plays when
 * the player speaks to the npc, for 'reach'/'time'/'flag'/… it plays when the trigger fires, for 'dialogueEnd' (or no
 * trigger) it plays as soon as the beat starts; the beat completes on that dialogue's `dialogue:end`.
 *
 * Emits: quest:watchStart { watch }, quest:watchEnd { watch }, quest:beatStart { beat }, quest:objective { text, locationId, title, beatId, optional },
 *        quest:beatComplete { beat }, quest:flag { flag, on }, quest:discover { id, name }, quest:collect { id, kind, name },
 *        quest:reputation { faction, delta, value, reputation }, quest:storyEnd {}, quest:action:startSinking {}, quest:player { id, name },
 *        notify { text, kind }, audio:play { id }, cutscene:play { id }, ui:fade { seconds }, camera:shake { intensity, seconds }
 * Listens: dialogue:end { dialogueId }
 */
import * as THREE from 'three';
import {
  hhmmToMinutes, dayIndex, absMinutes, clockAbs, clockMinutes, withinLocation, clamp, findLocation, jsonClone,
} from './storyUtil.js';

const DISCOVERY_RADIUS = 3;
const DISCOVERY_POLL = 0.25;      // seconds between discovery proximity scans
const SET_TIME_SECONDS = 4;
/** Actions that place things in the world and must be replayed when a save is loaded (NPCs are despawned by main.js first). */
const WORLD_ACTIONS = new Set(['spawn', 'moveNpc', 'despawn', 'lights']);

const _v = new THREE.Vector3();   // scratch for world→ship-local conversion (no per-frame allocation)
const _local = { x: 0, y: 0, z: 0 };

export class QuestManager {
  constructor({
    story, dialogues = {}, locations = {}, discoveries = [], collectibles = [], characters = {},
    bus, clock, player, npcs, ship, dialogue = null, world = null,
  } = {}) {
    this.story = story && Array.isArray(story.watches) ? story : { watches: [] };
    this.dialogues = dialogues || {};
    this.locations = locations || {};
    this.discoveries = Array.isArray(discoveries) ? discoveries : [];
    this.collectibles = Array.isArray(collectibles) ? collectibles : [];
    this.characters = characters || {};
    this.bus = bus;
    this.clock = clock;
    this.player = player;
    this.npcs = npcs;
    this.ship = ship;
    this.dialogue = dialogue;
    this.world = world;

    // Narrative state
    this.flags = new Set();
    this.inventory = new Map();
    this.reputation = { first: 0, third: 0 };
    this.discovered = new Set();
    this.collected = new Set();
    this.completedBeats = new Set();
    this.watch = null;
    this.currentBeat = null;
    this.activeOptional = [];
    this.storyComplete = false;
    this.playerId = null;
    this.playerName = null;
    this._guessPlayer();

    // Index beats across all watches
    this.beats = new Map();
    this._beatWatch = new Map();
    for (const w of this.story.watches) {
      for (const b of w.beats || []) {
        if (!b || !b.id) continue;
        this.beats.set(b.id, b);
        this._beatWatch.set(b.id, w);
      }
    }

    // Runtime bookkeeping
    this._beatStart = new Map();          // beatId → absolute minutes when the beat started (time triggers)
    this._awaitDialogue = new Map();      // dialogueId → beatId completing when that dialogue ends (talk beats)
    this._transition = 0;                 // re-entrancy depth
    this._pending = [];                   // beat ids whose completion was requested mid-transition
    this._discoveryTimer = 0;
    this._locCache = new Map();           // locationId → resolved { id, x, y, z, ... } (LOCATIONS / ship.locations)
    this._warned = new Set();             // one-shot data warnings
    this._offs = [];
    if (bus && typeof bus.on === 'function') {
      this._offs.push(bus.on('dialogue:end', (p) => this._onDialogueEnd(p)));
    }
  }

  dispose() {
    for (const off of this._offs) { try { off(); } catch (_) { /* ignore */ } }
    this._offs = [];
  }

  /** The playable character: CHARACTERS entry flagged isPlayer/playable, else 'player', else 'jack', else "Jack". */
  _guessPlayer() {
    const chars = this.characters || {};
    let id = Object.keys(chars).find((k) => chars[k] && (chars[k].isPlayer || chars[k].playable)) || null;
    if (!id && chars.player) id = 'player';
    if (!id && chars.jack) id = 'jack';
    this.playerId = id;
    this.playerName = (id && chars[id] && chars[id].name) || 'Jack';
  }

  /** Hand player control to another character (Watch IV: Jack ↔ Rosie). Emits quest:player { id, name }. */
  setPlayer(characterId) {
    const c = characterId && this.characters ? this.characters[characterId] : null;
    this.playerId = characterId || null;
    this.playerName = (c && c.name) || (characterId ? String(characterId) : 'Jack');
    this._emit('quest:player', { id: this.playerId, name: this.playerName });
  }

  // ------------------------------------------------------------------ watches

  /**
   * Start a NEW game from a watch: narrative state is reset (beats of earlier watches count as skipped),
   * the clock is anchored to the watch's date/startTime unless it already sits on that date at or after
   * startTime (main.js positions it first and honours `?time=`), and the watch's first beat begins.
   */
  start(watchId, { setClock = 'auto' } = {}) {
    const w = this.story.watches.find((x) => x.id === watchId) || this.story.watches[0] || null;
    if (!w) { console.warn('[quest] story has no watches'); return false; }
    this._reset();
    for (const prev of this.story.watches) {
      if (prev === w) break;
      for (const b of prev.beats || []) if (b && b.id) this.completedBeats.add(b.id);
    }
    let anchor = setClock === 'auto' ? true : !!setClock;
    const c = this.clock;
    if (setClock === 'auto' && c && w.date && c.date === w.date) {
      const startMin = hhmmToMinutes(w.startTime);
      if (startMin === null || clockMinutes(c) % 1440 >= startMin) anchor = false;
    }
    this._beginWatch(w, { setClock: anchor });
    return true;
  }

  /** Forget every bit of narrative state (new game). The dialogue runner is closed as well. */
  _reset() {
    if (this.dialogue && this.dialogue.active && typeof this.dialogue.end === 'function') {
      try { this.dialogue.end(); } catch (_) { /* ignore */ }
    }
    this.flags = new Set();
    this.inventory = new Map();
    this.reputation = { first: 0, third: 0 };
    this.discovered = new Set();
    this.collected = new Set();
    this.completedBeats = new Set();
    this.watch = null;
    this.currentBeat = null;
    this.activeOptional = [];
    this.storyComplete = false;
    this._beatStart = new Map();
    this._awaitDialogue = new Map();
    this._pending = [];
    this._discoveryTimer = 0;
    this._guessPlayer();
  }

  _beginWatch(w, { setClock }) {
    this.watch = w;
    this.storyComplete = false;
    if (setClock && this.clock) {
      if (w.date && typeof this.clock.setDate === 'function') this.clock.setDate(w.date);
      if (w.startTime && typeof this.clock.set === 'function') this.clock.set(w.startTime);
    }
    this._emit('quest:watchStart', { watch: w });
    // Optional beats without an explicit `after` run from the start of the watch, in parallel.
    for (const b of w.beats || []) {
      if (b && b.optional && !b.after && !this.completedBeats.has(b.id) && !this._isActive(b.id)) this._startBeat(b, true);
    }
    const first = (w.beats || []).find((b) => b && !b.optional && !this.completedBeats.has(b.id)) || null;
    if (first) this._startBeat(first, false);
    else this._endWatch(w);
  }

  _endWatch(w) {
    this.currentBeat = null;
    this._emit('quest:watchEnd', { watch: w });
    const idx = this.story.watches.indexOf(w);
    const next = idx >= 0 ? this.story.watches[idx + 1] : null;
    if (!next) {
      this.storyComplete = true;
      this._emit('quest:storyEnd', { watch: w });
      return;
    }
    // Clock: a new date always re-anchors the clock; the same date only when the design asks for it.
    if (this.clock) {
      const differentDate = next.date && next.date !== this.clock.date;
      if (differentDate || next.autoSetTime === true) {
        if (next.date && typeof this.clock.setDate === 'function') this.clock.setDate(next.date);
        if (next.startTime && typeof this.clock.set === 'function') this.clock.set(next.startTime);
      }
    }
    this._beginWatch(next, { setClock: false });
  }

  // -------------------------------------------------------------------- beats

  _isActive(beatId) {
    return (this.currentBeat && this.currentBeat.id === beatId) || this.activeOptional.some((b) => b.id === beatId);
  }

  _startBeat(beat, optional) {
    if (!beat) return;
    this._transition++;
    try {
      if (optional) {
        if (!this.activeOptional.includes(beat)) this.activeOptional.push(beat);
      } else {
        this.currentBeat = beat;
        // A main beat chained (`next`) into another watch carries the watch with it.
        const w = this._beatWatch.get(beat.id);
        if (w && w !== this.watch) { this.watch = w; this._emit('quest:watchStart', { watch: w }); }
      }
      this._beatStart.set(beat.id, clockAbs(this.clock));
      this._emit('quest:beatStart', { beat, optional: !!optional });
      this._emitObjective(beat, !!optional);
      this.runActions(beat.onStart);
      // onStart may have moved the clock (setTime with a date): time triggers count from *after* it.
      if (this._isActive(beat.id)) this._beatStart.set(beat.id, clockAbs(this.clock));
      const type = beat.trigger && typeof beat.trigger === 'object' ? beat.trigger.type : null;
      if (beat.dialogueId && this._isActive(beat.id) && (type === 'dialogueEnd' || !type)) {
        // The conversation IS the beat: play it now, complete when it ends.
        this._playBeatDialogue(beat);
      }
    } finally {
      this._transition--;
    }
    this._flushPending();
  }

  /**
   * Fire a beat's trigger: play its dialogue (completing on dialogue:end) when it has one that the
   * data defines, otherwise complete at once. Returns true when the beat was handled.
   */
  _fire(beat) {
    if (!beat || !this._isActive(beat.id)) return false;
    if (beat.dialogueId && this.dialogues[beat.dialogueId]) return this._playBeatDialogue(beat);
    if (beat.dialogueId) this._warnOnce(`beat "${beat.id}" names unknown dialogue "${beat.dialogueId}"`);
    this.complete(beat.id);
    return true;
  }

  _playBeatDialogue(beat) {
    const id = beat.dialogueId;
    if (!this.dialogues[id]) { this.complete(beat.id); return true; }
    this._awaitDialogue.set(id, beat.id);
    if (!this._startDialogue(id)) {
      if (this._awaitDialogue.get(id) === beat.id) this._awaitDialogue.delete(id);
      this.complete(beat.id);
    }
    return true;
  }

  _awaitingDialogue(beatId) {
    for (const v of this._awaitDialogue.values()) if (v === beatId) return true;
    return false;
  }

  _warnOnce(msg) {
    if (this._warned.has(msg)) return;
    this._warned.add(msg);
    console.warn(`[quest] ${msg}`);
  }

  _emitObjective(beat, optional) {
    if (optional && this.currentBeat) return;   // the HUD shows the main line's objective
    this._emit('quest:objective', {
      text: beat.objective || beat.title || '',
      locationId: beat.locationId || (beat.trigger && beat.trigger.locationId) || null,
      title: beat.title || '',
      beatId: beat.id,
      optional: !!optional,
    });
  }

  /** Complete an active beat (main or optional): onComplete actions, then chain to the next beat. */
  complete(beatId) {
    const id = typeof beatId === 'object' && beatId ? beatId.id : beatId;
    const beat = this.beats.get(id);
    if (!beat) return false;
    if (!this._isActive(id)) {
      if (!this.completedBeats.has(id)) this.completedBeats.add(id);
      return false;
    }
    if (this._transition > 0) {
      if (!this._pending.includes(id)) this._pending.push(id);
      return true;
    }
    this._transition++;
    let chained = null;
    try {
      const wasMain = this.currentBeat && this.currentBeat.id === id;
      this.completedBeats.add(id);
      this._beatStart.delete(id);
      for (const [dId, bId] of [...this._awaitDialogue]) if (bId === id) this._awaitDialogue.delete(dId);
      if (wasMain) this.currentBeat = null;
      else this.activeOptional = this.activeOptional.filter((b) => b.id !== id);
      this.runActions(beat.onComplete);
      this._emit('quest:beatComplete', { beat, optional: !wasMain });
      // Optional beats gated on this one (`after`) begin now.
      const w = this._beatWatch.get(id) || this.watch;
      for (const b of (w && w.beats) || []) {
        if (b && b.optional && b.after === id && !this.completedBeats.has(b.id) && !this._isActive(b.id)) this._startBeat(b, true);
      }
      if (wasMain) chained = this._resolveNext(beat, w);
      else if (beat.next && this.beats.get(beat.next) && this.beats.get(beat.next).optional) {
        const nb = this.beats.get(beat.next);
        if (!this.completedBeats.has(nb.id) && !this._isActive(nb.id)) this._startBeat(nb, true);
      }
    } finally {
      this._transition--;
    }
    if (chained === 'end') this._endWatch(this._beatWatch.get(id) || this.watch);
    else if (chained) this._startBeat(chained, false);
    else if (this.currentBeat === null && this.activeOptional.length === 0 && this.watch) {
      // Main line finished and nothing else runs → the watch is over.
    }
    this._flushPending();
    return true;
  }

  /** Next main-line beat after `beat` — explicit `next`, else array order (skipping optional beats). 'end' closes the watch. */
  _resolveNext(beat, w) {
    const beats = (w && w.beats) || [];
    if (beat.next === null) return 'end';
    if (typeof beat.next === 'string') {
      const nb = this.beats.get(beat.next);
      if (!nb) { console.warn(`[quest] beat "${beat.id}" → unknown next "${beat.next}"`); return 'end'; }
      if (nb.optional) {
        if (!this.completedBeats.has(nb.id) && !this._isActive(nb.id)) this._startBeat(nb, true);
        return this._nextInOrder(beats, beats.indexOf(nb));
      }
      return nb;
    }
    return this._nextInOrder(beats, beats.indexOf(beat));
  }

  _nextInOrder(beats, fromIndex) {
    for (let i = fromIndex + 1; i < beats.length; i++) {
      const b = beats[i];
      if (b && !b.optional && !this.completedBeats.has(b.id)) return b;
    }
    return 'end';
  }

  _flushPending() {
    if (this._transition > 0) return;
    while (this._pending.length) {
      const id = this._pending.shift();
      if (this._isActive(id)) this.complete(id);
    }
  }

  // ------------------------------------------------------------------ update

  update(dt = 0) {
    if (this._transition > 0) return;
    const local = this._playerLocal();
    const now = clockAbs(this.clock);
    const main = this.currentBeat;
    if (main) this._tick(main, local, now);
    // Snapshot-free walk: completing an optional beat rebuilds `activeOptional`, so re-check liveness.
    const opts = this.activeOptional;
    for (let i = 0; i < opts.length; i++) {
      const beat = opts[i];
      if (!this._isActive(beat.id)) continue;   // completed by an earlier beat's actions this frame
      this._tick(beat, local, now);
      if (this.activeOptional !== opts) break;  // list was replaced; the rest is picked up next frame
    }
    this._discoveryTimer -= dt;
    if (this._discoveryTimer <= 0) {
      this._discoveryTimer = DISCOVERY_POLL;
      if (local) this._scanDiscoveries(local);
    }
  }

  _tick(beat, local, now) {
    if (!this._isActive(beat.id) || this._awaitingDialogue(beat.id)) return;
    if (this._triggerFires(beat, local, now)) this._fire(beat);
  }

  /** Resolve (and cache) a location by id from LOCATIONS, then ship.locations. */
  _loc(id) {
    if (!id) return null;
    let loc = this._locCache.get(id);
    if (loc === undefined) {
      loc = findLocation(this.locations, this.ship, id);
      if (loc) this._locCache.set(id, loc);   // misses are not cached: ship.locations may fill in later
    }
    return loc;
  }

  _triggerFires(beat, local, now) {
    const t = beat.trigger;
    if (!t || typeof t !== 'object') return false;
    switch (t.type) {
      case 'reach': {
        if (!local) return false;
        const locId = t.locationId || beat.locationId;
        const loc = this._loc(locId);
        if (!loc) { this._warnOnce(`beat "${beat.id}" reach trigger: unknown location "${locId}"`); return false; }
        return withinLocation(local, loc, Number.isFinite(t.radius) ? t.radius : 3);
      }
      case 'time': {
        const target = this._timeTarget(beat, t);
        return target !== null && now >= target;
      }
      case 'flag':
        return !!t.flag && this.flags.has(t.flag);
      case 'reputation': {
        const v = Number(this.reputation[t.faction] || 0);
        return Number.isFinite(t.min) ? v >= t.min : Number.isFinite(t.max) ? v <= t.max : false;
      }
      case 'item':
        return !!t.item && (this.inventory.get(t.item) || 0) >= (Number.isFinite(t.count) ? t.count : 1);
      case 'collect':
        return !!t.id && this.collected.has(t.id);
      case 'discover':
        return !!t.id && this.discovered.has(t.id);
      default:
        return false;   // talk, dialogueEnd, interact are event driven
    }
  }

  /** Absolute minutes at which a time trigger fires: explicit date, else relative to the beat's start (crossing midnight). */
  _timeTarget(beat, t) {
    const at = hhmmToMinutes(t.at);
    if (at === null) return null;
    if (t.date && dayIndex(t.date) !== null) return absMinutes(t.date, at) + (Number(t.dayOffset) || 0) * 1440;
    const started = this._beatStart.has(beat.id) ? this._beatStart.get(beat.id) : clockAbs(this.clock);
    const startDay = Math.floor(started / 1440) * 1440;
    const startMin = started - startDay;
    let target = startDay + at;
    if (at < startMin - 1) target += 1440;   // "00:05" started at "23:40" means tomorrow
    return target + (Number(t.dayOffset) || 0) * 1440;
  }

  /** The time the current main beat waits for (UI "Advance the Watch"), or null. */
  get nextTime() {
    const b = this.currentBeat;
    if (!b || !b.trigger || b.trigger.type !== 'time') return null;
    const target = this._timeTarget(b, b.trigger);
    if (target === null) return null;
    const day = Math.floor(target / 1440);
    const mins = target - day * 1440;
    const date = new Date(day * 86400000).toISOString().slice(0, 10);
    return { at: b.trigger.at, date, abs: target, minutes: mins };
  }

  get progress() {
    let total = 0;
    for (const w of this.story.watches) total += (w.beats || []).filter((b) => b && !b.optional).length;
    let done = 0;
    for (const id of this.completedBeats) { const b = this.beats.get(id); if (b && !b.optional) done++; }
    return { done, total };
  }

  /**
   * The player's feet in ship-local metres (the frame LOCATIONS/DISCOVERIES use). After the break-up the
   * part under the player (`ship.partAt`) is the frame that still matches the data, since each part's
   * local frame is the ship frame at the moment of the split. Reuses one scratch object per frame.
   */
  _playerLocal() {
    const p = this.player && this.player.position;
    if (!p || !Number.isFinite(p.x)) return null;
    const ship = this.ship;
    try {
      let group = null;
      if (ship && ship.broken && typeof ship.partAt === 'function') {
        const part = ship.partAt(p);
        group = part && part.group ? part.group : null;
      }
      if (!group && ship && ship.group && typeof ship.group.worldToLocal === 'function') group = ship.group;
      if (group) {
        group.worldToLocal(_v.set(p.x, p.y, p.z));
        _local.x = _v.x; _local.y = _v.y; _local.z = _v.z;
        return _local;
      }
      if (ship && typeof ship.worldToLocal === 'function') {
        const l = ship.worldToLocal(p);
        _local.x = l.x; _local.y = l.y; _local.z = l.z;
        return _local;
      }
    } catch (_) { /* fall through to world coordinates */ }
    _local.x = p.x; _local.y = p.y; _local.z = p.z;
    return _local;
  }

  _scanDiscoveries(local) {
    for (const d of this.discoveries) {
      if (!d || !d.id || this.discovered.has(d.id)) continue;
      if (withinLocation(local, d, Number.isFinite(d.radius) ? d.radius : DISCOVERY_RADIUS)) this.discover(d.id);
    }
  }

  // --------------------------------------------------------------- interact

  /** The story gets first refusal on every player interaction. Returns true when handled. */
  handleInteract(interactable) {
    if (!interactable || typeof interactable !== 'object') return false;
    const type = interactable.type;
    const id = interactable.id || (interactable.data && (interactable.data.npcId || interactable.data.id));
    // Any active beat waiting for an 'interact' trigger on this object (doors, clocks, the Renault…)
    for (const beat of this._activeBeats()) {
      const t = beat.trigger;
      if (t && t.type === 'interact' && t.id === id) { this.complete(beat.id); return true; }
    }
    switch (type) {
      case 'npc': return this._interactNpc(id, interactable);
      case 'item': return this.isCollectible(id, interactable) ? this.collect(id, interactable) : false;
      case 'plaque':
        if (this.discover(id, interactable)) return true;
        // Re-reading a plaque shows its text again.
        if (id && this.discovered.has(id)) { this._notify(this._plaqueText(id, interactable), 'discover'); return true; }
        return false;
      default: return false;
    }
  }

  _plaqueText(id, interactable = null) {
    const d = this.discoveries.find((x) => x && x.id === id) || null;
    const data = (interactable && interactable.data) || {};
    const name = (d && d.name) || data.name || (interactable && interactable.label) || id;
    const plaque = (d && d.plaque) || data.plaque || data.text || null;
    return plaque ? `${name} — ${plaque}` : `Discovered: ${name}`;
  }

  /** An 'item' interactable is a story collectible when COLLECTIBLES lists its id (or the builder flagged data.collectible). */
  isCollectible(id, interactable = null) {
    if (!id) return false;
    if (this.collectibles.some((x) => x && x.id === id)) return true;
    return !!(interactable && interactable.data && interactable.data.collectible);
  }

  _activeBeats() {
    return this.currentBeat ? [this.currentBeat, ...this.activeOptional] : [...this.activeOptional];
  }

  _interactNpc(npcId, interactable) {
    if (!npcId) return false;
    // 1. A pending 'talk' trigger for this npc (the main beat first, then side quests).
    for (const beat of this._activeBeats()) {
      const t = beat.trigger;
      if (!t || t.type !== 'talk' || !t.npcId || t.npcId !== npcId) continue;
      if (this._awaitingDialogue(beat.id)) continue;   // its conversation is already running
      return this._fire(beat);
    }
    // 2. An ambient conversation for this npc that the story does not currently gate.
    const ambientId = this._ambientDialogueFor(npcId);
    if (ambientId) return this._startDialogue(ambientId);
    return false;
  }

  /**
   * The ambient conversation for an npc the story is not currently gating:
   * a conditional `ambient:true` dialogue whose `requires` pass (most specific first), else '<npcId>_default',
   * else any unconditional `ambient:true` dialogue for that npc.
   */
  _ambientDialogueFor(npcId) {
    const ok = (d) => d && d.npcId === npcId && this._requirementsMet(d.requires || d.conditions);
    let generic = null;
    for (const [id, d] of Object.entries(this.dialogues)) {
      if (!d || d.npcId !== npcId || !d.ambient || !ok(d)) continue;
      if (d.requires || d.conditions) return id;   // a conditional ambient line beats a generic one
      if (!generic) generic = id;
    }
    const defId = `${npcId}_default`;
    if (ok(this.dialogues[defId])) return defId;
    return generic;
  }

  _requirementsMet(req) {
    if (!req || typeof req !== 'object') return true;
    const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
    if (!list(req.flag).every((f) => this.flags.has(f))) return false;
    if (list(req.notFlag).some((f) => this.flags.has(f))) return false;
    if (req.reputationMin && Number(this.reputation[req.reputationMin.faction] || 0) < Number(req.reputationMin.value || 0)) return false;
    if (req.reputationMax && Number(this.reputation[req.reputationMax.faction] || 0) > Number(req.reputationMax.value || 0)) return false;
    if (!list(req.item).every((it) => (this.inventory.get(it) || 0) > 0)) return false;
    return true;
  }

  _startDialogue(dialogueId) {
    const d = this.dialogue;
    if (!d || typeof d.start !== 'function') return false;
    try { return d.start(dialogueId) !== false; } catch (err) { console.warn('[quest] dialogue failed', err); return false; }
  }

  _onDialogueEnd(p) {
    const dialogueId = p && p.dialogueId;
    if (!dialogueId) return;
    const awaiting = this._awaitDialogue.get(dialogueId);
    if (awaiting !== undefined) {
      this._awaitDialogue.delete(dialogueId);
      if (this._isActive(awaiting)) this.complete(awaiting);
    }
    for (const beat of this._activeBeats()) {
      const t = beat.trigger;
      if (t && t.type === 'dialogueEnd' && t.dialogueId === dialogueId) this.complete(beat.id);
    }
  }

  // ------------------------------------------------------- collect / discover

  /** Collect an 'item' interactable. Returns true when it was newly collected; non-collectible items (e.g. the Renault) are left alone. */
  collect(id, interactable = null) {
    if (!id || this.collected.has(id)) return false;
    if (!this.isCollectible(id, interactable)) return false;
    const c = this.collectibles.find((x) => x && x.id === id) || null;
    this.collected.add(id);
    const obj = (interactable && interactable.object) || (interactable && interactable.data && interactable.data.object)
      || (this.ship && this.ship.interactables && typeof this.ship.interactables.get === 'function' && this.ship.interactables.get(id)
        ? this.ship.interactables.get(id).object : null);
    if (obj) {
      obj.visible = false;
      if (obj.userData) delete obj.userData.interactable;
      if (typeof obj.traverse === 'function') obj.traverse((o) => { if (o.userData && o.userData.interactable) delete o.userData.interactable; });
    }
    const name = (c && c.name) || (interactable && interactable.label) || id;
    const kind = (c && c.kind) || 'item';
    this._emit('quest:collect', { id, kind, name });
    this._notify(c && c.text ? `${name} — ${c.text}` : `Collected: ${name}`, 'collect');
    return true;
  }

  /** Mark a DISCOVERIES entry (or plaque) discovered. Returns true when new. */
  discover(id, interactable = null) {
    if (!id || this.discovered.has(id)) return false;
    const d = this.discoveries.find((x) => x && x.id === id) || null;
    this.discovered.add(id);
    const data = (interactable && interactable.data) || {};
    const name = (d && d.name) || data.name || (interactable && interactable.label) || id;
    this._emit('quest:discover', { id, name });
    this._notify(this._plaqueText(id, interactable), 'discover');
    return true;
  }

  // ----------------------------------------------------------------- actions

  setFlag(flag, on = true) {
    if (!flag) return;
    if (on) this.flags.add(flag); else this.flags.delete(flag);
    this._emit('quest:flag', { flag, on: !!on });
  }

  addReputation(faction, delta) {
    const f = faction === 'third' ? 'third' : 'first';
    const d = Number(delta) || 0;
    this.reputation[f] = clamp((this.reputation[f] || 0) + d, -10, 10);
    this._emit('quest:reputation', { faction: f, delta: d, value: this.reputation[f], reputation: { ...this.reputation } });
    if (d !== 0) this._notify(`${f === 'first' ? 'First Class' : 'Third Class'} standing ${d > 0 ? '+' : ''}${d}`, 'reputation');
  }

  give(item, count = 1) {
    if (!item) return;
    const n = Number(count) || 1;
    const cur = this.inventory.get(item) || 0;
    const next = cur + n;
    if (next <= 0) this.inventory.delete(item); else this.inventory.set(item, next);
    this._emit('quest:inventory', { item, count: Math.max(0, next), delta: n });
    const c = this.collectibles.find((x) => x && x.id === item) || null;
    const name = (c && c.name) || String(item).replace(/[_-]+/g, ' ');
    this._notify(n > 0 ? `Received: ${name}` : `Lost: ${name}`, 'item');
  }

  /** Execute a list of story actions (ARCHITECTURE §2 Action). Unknown types are ignored with a warning. */
  runActions(actions) {
    if (!actions) return;
    const list = Array.isArray(actions) ? actions : [actions];
    for (const a of list) {
      if (!a || typeof a !== 'object') continue;
      try { this._runAction(a); } catch (err) { console.warn(`[quest] action ${a.type} failed`, err); }
    }
  }

  _runAction(a) {
    switch (a.type) {
      case 'setFlag': this.setFlag(a.flag, a.value !== false); break;
      case 'clearFlag': this.setFlag(a.flag, false); break;
      case 'spawn':
        if (this.npcs && typeof this.npcs.spawnNamed === 'function') this.npcs.spawnNamed(a.npcId, a.locationId);
        break;
      case 'moveNpc':
        if (this.npcs && typeof this.npcs.moveNamed === 'function') this.npcs.moveNamed(a.npcId, a.locationId);
        break;
      case 'despawn':
        if (this.npcs && typeof this.npcs.despawnNamed === 'function') this.npcs.despawnNamed(a.npcId);
        else if (this.npcs && typeof this.npcs.despawn === 'function') this.npcs.despawn(a.npcId);
        break;
      case 'setPlayer': this.setPlayer(a.characterId || a.npcId || a.id); break;
      case 'setTime': this._setTime(a); break;
      case 'startSinking': this._emit('quest:action:startSinking', {}); break;
      case 'sound': this._emit('audio:play', { id: a.id }); break;
      case 'reputation': this.addReputation(a.faction, a.delta); break;
      case 'give': this.give(a.item, a.count); break;
      case 'take': this.give(a.item, -(Number(a.count) || 1)); break;
      case 'discover': this.discover(a.id); break;
      case 'cutscene':
        this._emit('cutscene:play', { id: a.id, text: a.text || null });
        this._notify(a.text || `Cutscene: ${a.id}`, 'cutscene');
        break;
      case 'dialogue': this._startDialogue(a.dialogueId || a.id); break;
      case 'teleport': {
        const loc = findLocation(this.locations, this.ship, a.locationId);
        if (loc && this.player && typeof this.player.teleportLocal === 'function') {
          this.player.teleportLocal(loc.x, (loc.y ?? 0) + 0.1, loc.z, loc.yaw || 0);
        }
        break;
      }
      case 'fade': this._emit('ui:fade', { seconds: Number.isFinite(a.seconds) ? a.seconds : 1 }); break;
      case 'notify': this._notify(a.text, a.kind || 'log'); break;
      case 'complete': this.complete(a.beatId); break;
      case 'panic':
        if (this.npcs && typeof this.npcs.setPanic === 'function') this.npcs.setPanic(Number(a.level) || 0);
        break;
      case 'lights': {
        const lights = this.ship && this.ship.lights;
        if (!lights) break;
        if (a.flicker && typeof lights.flicker === 'function') lights.flicker(Number.isFinite(a.seconds) ? a.seconds : 1.5);
        if (a.power !== undefined && typeof lights.setPower === 'function') lights.setPower(clamp(Number(a.power) || 0, 0, 1));
        break;
      }
      case 'shake': this._emit('camera:shake', { intensity: a.intensity ?? 0.5, seconds: a.seconds ?? 1 }); break;
      default: console.warn(`[quest] unknown action type "${a.type}"`);
    }
  }

  _setTime(a) {
    const c = this.clock;
    if (!c || !a.time) return;
    if (a.date && a.date !== c.date) {
      if (typeof c.setDate === 'function') c.setDate(a.date);
      if (typeof c.set === 'function') c.set(a.time);
      return;
    }
    const target = hhmmToMinutes(a.time);
    const cur = clockMinutes(c) % 1440;
    if (a.immediate || typeof c.advanceTo !== 'function') {
      if (typeof c.set === 'function') c.set(a.time);
      return;
    }
    if (target !== null && Math.abs(target - cur) < 0.5) return;   // already there
    c.advanceTo(a.time, Number.isFinite(a.seconds) ? a.seconds : SET_TIME_SECONDS);
  }

  // --------------------------------------------------------------- save/load

  save() {
    return {
      version: 1,
      watchId: this.watch ? this.watch.id : null,
      beatId: this.currentBeat ? this.currentBeat.id : null,
      optional: this.activeOptional.map((b) => b.id),
      completed: [...this.completedBeats],
      flags: [...this.flags],
      inventory: [...this.inventory],
      reputation: { ...this.reputation },
      discovered: [...this.discovered],
      collected: [...this.collected],
      beatStart: [...this._beatStart],
      awaitDialogue: [...this._awaitDialogue],
      storyComplete: this.storyComplete,
      playerId: this.playerId,
    };
  }

  load(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : jsonClone(json);
    if (!d || typeof d !== 'object') return false;
    this.flags = new Set(Array.isArray(d.flags) ? d.flags : []);
    this.inventory = new Map(Array.isArray(d.inventory) ? d.inventory.filter((e) => Array.isArray(e) && e.length === 2) : []);
    this.reputation = {
      first: clamp(Number((d.reputation && d.reputation.first) || 0), -10, 10),
      third: clamp(Number((d.reputation && d.reputation.third) || 0), -10, 10),
    };
    this.discovered = new Set(Array.isArray(d.discovered) ? d.discovered : []);
    this.collected = new Set(Array.isArray(d.collected) ? d.collected : []);
    this.completedBeats = new Set(Array.isArray(d.completed) ? d.completed.filter((id) => this.beats.has(id)) : []);
    this._beatStart = new Map(Array.isArray(d.beatStart) ? d.beatStart.filter((e) => Array.isArray(e) && this.beats.has(e[0])) : []);
    // A conversation cannot survive a reload: its beat goes back to waiting for its trigger.
    this._awaitDialogue = new Map();
    if (this.dialogue && this.dialogue.active && typeof this.dialogue.end === 'function') {
      try { this.dialogue.end(); } catch (_) { /* ignore */ }
    }
    this._pending = [];
    this.storyComplete = !!d.storyComplete;
    this.watch = this.story.watches.find((w) => w.id === d.watchId) || this.story.watches[0] || null;
    this.currentBeat = (d.beatId && this.beats.get(d.beatId)) || null;
    this.activeOptional = (Array.isArray(d.optional) ? d.optional : []).map((id) => this.beats.get(id)).filter((b) => b && b.optional !== false);
    if (d.playerId && this.characters && this.characters[d.playerId]) this.setPlayer(d.playerId); else this._guessPlayer();
    // Hide collectibles already picked up.
    if (this.ship && this.ship.interactables && typeof this.ship.interactables.get === 'function') {
      for (const id of this.collected) {
        const it = this.ship.interactables.get(id);
        if (it && it.object) { it.object.visible = false; if (it.object.userData) delete it.object.userData.interactable; }
      }
    }
    this._replayWorldActions();
    if (this.watch) this._emit('quest:watchStart', { watch: this.watch, restored: true });
    if (this.currentBeat) this._emitObjective(this.currentBeat, false);
    else if (this.activeOptional.length) this._emitObjective(this.activeOptional[0], true);
    else if (this.watch && !this.storyComplete && !this._watchExhausted(this.watch)) {
      // Saved between beats (should not happen) — resume the watch's first unfinished beat.
      const next = this._nextInOrder(this.watch.beats || [], -1);
      if (next !== 'end') this._startBeat(next, false);
    }
    return true;
  }

  _watchExhausted(w) {
    return (w.beats || []).every((b) => !b || b.optional || this.completedBeats.has(b.id));
  }

  /**
   * Put the world back the way the story left it: main.js despawns every NPC before load(), so the
   * spawn/moveNpc/despawn (and lights) actions of completed beats, then of the active beats' onStart,
   * are replayed in story order. Flags, items, reputation and the clock come from the save itself.
   */
  _replayWorldActions() {
    const replay = (actions) => {
      if (!Array.isArray(actions)) return;
      for (const a of actions) if (a && WORLD_ACTIONS.has(a.type)) this.runActions(a);
    };
    for (const w of this.story.watches) {
      for (const b of w.beats || []) {
        if (!b || !b.id) continue;
        if (this.completedBeats.has(b.id)) { replay(b.onStart); replay(b.onComplete); }
        else if (this._isActive(b.id)) replay(b.onStart);
      }
    }
  }

  // ------------------------------------------------------------------ utils

  _emit(type, payload) {
    if (this.bus && typeof this.bus.emit === 'function') this.bus.emit(type, payload);
  }

  _notify(text, kind = 'log') {
    if (!text) return;
    this._emit('notify', { text: String(text), kind });
  }
}
