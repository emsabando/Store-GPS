/**
 * DialogueRunner — plays DIALOGUES trees (ARCHITECTURE.md §2, §7).
 *
 *   const dialogue = new DialogueRunner({ dialogues, characters, bus, quest? });
 *   dialogue.quest = quest;          // main.js wires it after construction
 *   dialogue.start('rosie_rail');    // → 'dialogue:start', then 'dialogue:node' per node
 *   dialogue.choose(0); dialogue.advance();   // or via bus 'ui:dialogueChoice' / 'ui:dialogueAdvance'
 *   dialogue.active, dialogue.dialogueId, dialogue.nodeId, dialogue.node
 *
 * Emits  'dialogue:start' { dialogueId, npcId }
 *        'dialogue:node'  { dialogueId, nodeId, speaker, speakerName, text, choices:[text], choiceKinds:[kind|null], portraitHint, npcId, hasNext, timed }
 *        'dialogue:end'   { dialogueId, npcId }
 * `{player}` resolves to quest.playerName when a quest is attached (the playable character can change), else a guess from CHARACTERS.
 * Node and choice `effects` are forwarded to quest.runActions (when a quest is attached).
 * Choice `conditions` ({ flag, notFlag, reputationMin:{faction,value}, reputationMax, item }) filter the
 * choices before they are emitted; `choose(index)` indexes into the filtered list the UI received.
 */
import { resolvePlaceholders } from './storyUtil.js';

export class DialogueRunner {
  constructor({ dialogues = {}, characters = {}, bus, quest = null } = {}) {
    this.dialogues = dialogues || {};
    this.characters = characters || {};
    this.bus = bus;
    this.quest = quest;
    this.active = false;
    this.dialogueId = null;
    this.nodeId = null;
    this.node = null;
    this.npcId = null;
    this.playerName = this._guessPlayerName();
    this._choices = [];
    this._gen = 0;
    this._offs = [];
    if (bus && typeof bus.on === 'function') {
      this._offs.push(bus.on('ui:dialogueChoice', (p) => this.choose(p && typeof p.index === 'number' ? p.index : Number(p && p.index))));
      this._offs.push(bus.on('ui:dialogueAdvance', () => this.advance()));
    }
  }

  dispose() {
    for (const off of this._offs) { try { off(); } catch (_) { /* ignore */ } }
    this._offs = [];
  }

  /** Begin a dialogue tree at its 'start' node. Returns true when a node was shown. */
  start(dialogueId) {
    const def = this.dialogues ? this.dialogues[dialogueId] : null;
    if (!def || !def.nodes) {
      console.warn(`[dialogue] unknown dialogue "${dialogueId}"`);
      this._emit('dialogue:end', { dialogueId, npcId: null, missing: true });
      return false;
    }
    if (this.active) this._finish();   // ends the previous conversation cleanly (emits dialogue:end)
    this._gen++;
    this.active = true;
    this.dialogueId = dialogueId;
    this.npcId = def.npcId || null;
    this.node = null;
    this.nodeId = null;
    this._choices = [];
    this._emit('dialogue:start', { dialogueId, npcId: this.npcId });
    const startId = def.start || 'start';
    return this._enter(startId);
  }

  /** Pick one of the choices the UI was given (index into the filtered list). */
  choose(index) {
    if (!this.active || !this.node) return false;
    const gen = this._gen;
    const choice = this._choices[index];
    if (!choice) {
      // Nodes without choices treat any pick as "advance" so a stray click never strands the player.
      if (this._choices.length === 0) return this.advance();
      console.warn(`[dialogue] choice ${index} does not exist on node "${this.nodeId}" of "${this.dialogueId}"`);
      return false;
    }
    this._runEffects(choice.effects);
    if (gen !== this._gen || !this.active) return true;   // an effect started another dialogue or ended this one
    if (choice.next === null || choice.next === undefined) { this._finish(); return true; }
    return this._enter(choice.next);
  }

  /** Continue past a node that has no choices. */
  advance() {
    if (!this.active || !this.node) return false;
    if (this._choices.length > 0) return false;   // the UI must pick a choice
    const next = this.node.next;
    if (next === null || next === undefined) { this._finish(); return true; }
    return this._enter(next);
  }

  /** Abort the running dialogue (still emits dialogue:end so listeners unwind). */
  end() {
    if (!this.active) return;
    this._finish();
  }

  // ---------------------------------------------------------------- internals

  _enter(nodeId) {
    const def = this.dialogues[this.dialogueId];
    const node = def && def.nodes ? def.nodes[nodeId] : null;
    if (!node) {
      console.warn(`[dialogue] "${this.dialogueId}" has no node "${nodeId}" — ending`);
      this._finish();
      return false;
    }
    const gen = this._gen;
    this.nodeId = nodeId;
    this.node = node;
    this._choices = [];
    this._runEffects(node.effects);
    if (gen !== this._gen || !this.active) return true;   // effects re-routed the conversation

    // Auto-skip empty pass-through nodes (effects-only).
    const text = typeof node.text === 'string' ? node.text : '';
    const choices = this._filterChoices(node.choices);
    if (!text && choices.length === 0) {
      if (node.next === null || node.next === undefined) { this._finish(); return true; }
      return this._enter(node.next);
    }
    this._choices = choices;

    const speaker = node.speaker || this.npcId || 'narrator';
    const speakerName = this.speakerNameFor(speaker);
    const character = this.characters ? this.characters[speaker] : null;
    // The quest knows who the player currently is (Watch IV hands off Jack ↔ Rosie).
    const playerName = (this.quest && typeof this.quest.playerName === 'string' && this.quest.playerName) || this.playerName;
    const vars = { player: playerName, npc: this.speakerNameFor(this.npcId || speaker) };
    const payload = {
      dialogueId: this.dialogueId,
      nodeId,
      npcId: this.npcId,
      speaker,
      speakerName,
      text: resolvePlaceholders(text, vars),
      choices: choices.map((c) => resolvePlaceholders(c.text, vars)),
      choiceKinds: choices.map((c) => c.kind || c.tone || null),   // 'heart' | 'wit' | 'spine' | null (design §4 icons)
      portraitHint: character && character.look ? character.look : null,
      hasNext: choices.length === 0 && node.next !== null && node.next !== undefined,
      timed: Number.isFinite(node.timed) ? node.timed : null,
    };
    this._emit('dialogue:node', payload);
    return true;
  }

  _finish() {
    const dialogueId = this.dialogueId;
    const npcId = this.npcId;
    this.active = false;
    this.dialogueId = null;
    this.nodeId = null;
    this.node = null;
    this.npcId = null;
    this._choices = [];
    this._gen++;
    this._emit('dialogue:end', { dialogueId, npcId });
  }

  _runEffects(effects) {
    if (!Array.isArray(effects) || effects.length === 0) return;
    const q = this.quest;
    if (q && typeof q.runActions === 'function') {
      try { q.runActions(effects); } catch (err) { console.warn('[dialogue] effects failed', err); }
    }
  }

  _filterChoices(choices) {
    if (!Array.isArray(choices)) return [];
    return choices.filter((c) => c && typeof c === 'object' && this.conditionsMet(c.conditions));
  }

  /** Evaluate a conditions object against the attached quest state. Missing quest → only flag-free conditions pass. */
  conditionsMet(cond) {
    if (!cond || typeof cond !== 'object') return true;
    const q = this.quest;
    const flags = q && q.flags && typeof q.flags.has === 'function' ? q.flags : null;
    const has = (f) => !!(flags && flags.has(f));
    if (cond.flag !== undefined) {
      const list = Array.isArray(cond.flag) ? cond.flag : [cond.flag];
      if (!list.every(has)) return false;
    }
    if (cond.notFlag !== undefined) {
      const list = Array.isArray(cond.notFlag) ? cond.notFlag : [cond.notFlag];
      if (list.some(has)) return false;
    }
    if (cond.reputationMin) {
      const rep = (q && q.reputation) || {};
      const v = Number(rep[cond.reputationMin.faction] || 0);
      if (v < Number(cond.reputationMin.value || 0)) return false;
    }
    if (cond.reputationMax) {
      const rep = (q && q.reputation) || {};
      const v = Number(rep[cond.reputationMax.faction] || 0);
      if (v > Number(cond.reputationMax.value || 0)) return false;
    }
    if (cond.item !== undefined) {
      const inv = q && q.inventory && typeof q.inventory.get === 'function' ? q.inventory : null;
      const list = Array.isArray(cond.item) ? cond.item : [cond.item];
      if (!list.every((it) => inv && (inv.get(it) || 0) > 0)) return false;
    }
    return true;
  }

  speakerNameFor(speaker) {
    if (!speaker || speaker === 'narrator') return 'Narrator';
    if (speaker === 'player') return 'You';
    const c = this.characters ? this.characters[speaker] : null;
    return (c && c.name) || String(speaker);
  }

  _guessPlayerName() {
    const chars = this.characters || {};
    for (const [id, c] of Object.entries(chars)) {
      if (c && (c.isPlayer || c.playable || id === 'player')) return c.name || 'Jack';
    }
    if (chars.jack && chars.jack.name) return chars.jack.name;
    return 'Jack';
  }

  _emit(type, payload) {
    if (this.bus && typeof this.bus.emit === 'function') this.bus.emit(type, payload);
  }
}
