/**
 * Tiny synchronous event bus shared by every module (see ARCHITECTURE.md §3, §10).
 */
export class EventBus {
  constructor() { this._map = new Map(); }

  on(type, fn) {
    if (!this._map.has(type)) this._map.set(type, new Set());
    this._map.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (p) => { off(); fn(p); });
    return off;
  }

  off(type, fn) {
    const set = this._map.get(type);
    if (set) set.delete(fn);
  }

  emit(type, payload) {
    const set = this._map.get(type);
    if (!set || set.size === 0) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[bus] handler for "${type}" threw`, err); }
    }
  }
}

export const bus = new EventBus();
