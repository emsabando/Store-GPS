/**
 * Keyboard / mouse / pointer-lock / gamepad input — ARCHITECTURE.md §3.
 * Call input.beginFrame() at the top of the frame and input.endFrame() at the end.
 */
import { bus } from './Events.js';

class Input {
  constructor() {
    this.keys = new Set();
    this._pressed = new Set();
    this._released = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: 0, x: 0, y: 0, wheel: 0 };
    this.axes = { lx: 0, ly: 0, rx: 0, ry: 0 };
    this.gamepadButtons = {};
    this.locked = false;
    this._element = null;
    this._keyListeners = new Set();
    this._attached = false;
  }

  attach(element) {
    if (this._attached) return;
    this._attached = true;
    this._element = element;
    const isTyping = (e) => {
      const t = e.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (!this.keys.has(e.code)) this._pressed.add(e.code);
      this.keys.add(e.code);
      for (const fn of this._keyListeners) fn(e.code, true, e);
      if (e.code === 'Escape') bus.emit('input:escape');
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this._released.add(e.code);
      for (const fn of this._keyListeners) fn(e.code, false, e);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons = 0; });
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    document.addEventListener('mousedown', (e) => { this.mouse.buttons |= (1 << e.button); if (this.locked) this._pressed.add(`Mouse${e.button}`); });
    document.addEventListener('mouseup', (e) => { this.mouse.buttons &= ~(1 << e.button); });
    document.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this._element;
      bus.emit('input:pointerlockchange', { locked: this.locked });
    });
    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      bus.emit('input:pointerlockchange', { locked: false });
    });
  }

  isDown(code) { return this.keys.has(code); }
  pressed(code) { return this._pressed.has(code); }
  released(code) { return this._released.has(code); }
  onKey(fn) { this._keyListeners.add(fn); return () => this._keyListeners.delete(fn); }

  requestPointerLock() {
    if (!this._element || this.locked) return;
    try {
      const p = this._element.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this._element.requestPointerLock(); } catch { /* ignore */ } });
    } catch { try { this._element.requestPointerLock(); } catch { /* ignore */ } }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  beginFrame() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p && p.connected);
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v);
    if (gp) {
      this.axes.lx = dz(gp.axes[0] || 0); this.axes.ly = dz(gp.axes[1] || 0);
      this.axes.rx = dz(gp.axes[2] || 0); this.axes.ry = dz(gp.axes[3] || 0);
      const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'Up', 'Down', 'Left', 'Right'];
      gp.buttons.forEach((b, i) => {
        const name = `Pad${names[i] || i}`;
        const was = !!this.gamepadButtons[name];
        if (b.pressed && !was) this._pressed.add(name);
        this.gamepadButtons[name] = b.pressed;
        if (b.pressed) this.keys.add(name); else this.keys.delete(name);
      });
    } else {
      this.axes.lx = this.axes.ly = this.axes.rx = this.axes.ry = 0;
    }
  }

  endFrame() {
    this._pressed.clear();
    this._released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
  }
}

export const input = new Input();
