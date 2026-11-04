// STUB — replaced by the Story engineer (ARCHITECTURE.md §7).
export class QuestManager {
  constructor({ story, bus }) { this.story = story; this.bus = bus; this.currentBeat = null; this.flags = new Set(); this.inventory = new Map(); this.reputation = { first: 0, third: 0 }; this.discovered = new Set(); this.collected = new Set(); }
  start(watchId) { const w = this.story.watches.find((x) => x.id === watchId) || this.story.watches[0]; this.currentBeat = w ? w.beats[0] : null; if (this.currentBeat) this.bus.emit('quest:objective', { text: this.currentBeat.objective, locationId: this.currentBeat.locationId }); }
  update() {} complete() {} runActions() {} handleInteract() { return false; } collect(id) { this.collected.add(id); } discover(id) { this.discovered.add(id); }
  save() { return { flags: [...this.flags] }; } load() {}
}
