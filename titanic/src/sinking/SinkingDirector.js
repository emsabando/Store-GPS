/**
 * SinkingDirector — Act IV (ARCHITECTURE.md §7, §1 frames, §11 collision parts & drowning).
 *
 *   const sinking = new SinkingDirector({ ship, world, clock, bus, spec, npcs, player, audio });
 *   sinking.start();                 // at the strike (23:40); sets the clock to 23:40 if earlier
 *   sinking.update(dt);              // every frame (main.js)
 *   sinking.setClockSpeed(0.5);      // game-minutes per real second from the strike (default 0.5)
 *   sinking.jumpTo(minutesAfter);    // tests/debug: move the clock and settle the state
 *   sinking.active, sinking.state    // { minutesAfter, trimDeg, listDeg, sinkM, floodY, floodWorldY,
 *                                    //   floodDeck, floodAftX, broken, lightsOn, phase, hhmm, bow, stern }
 *
 * Ship pose model (ship-local pivot = amidships at the waterline, contract §1):
 *   group.rotation.z = -trim, group.rotation.x = -list, group.position.y = -sinkM, where trim/list/
 *   sinkM are sampled from the timeline (monotone cubic). The keyframe sinkage is additionally
 *   clamped so the forecastle reference point P = (x +80, y = forecastle deck) is at or below the sea
 *   on a smooth schedule reaching y = 0 by 140 min (position.y = min(-sinkM, hP(t) - yP_rot)); with
 *   the default trims the rotation alone already puts P awash around 118 min, so the clamp only
 *   bites for a shallow user timeline. After 'breakup' the Ship.group pose is frozen and the two
 *   parts are driven by BreakupRig (bow trims to ~35° sinking at 1.5 m/s; stern settles, rises to
 *   ~90° about its forward end, then slides under). The clock is dilated 20× during the break-up so
 *   the 3 game-minutes 158→161 take ~120 real seconds at the default pace.
 *
 * Emits: sinking:state (every frame, the state object), sinking:event { id: 'strike'|'floodDeck'|
 * 'lightsOut'|'funnel1'|'breakup'|'plunge'|'gone'|'lifeboat' ... }, camera:shake, audio:play (creaks
 * and rumbles only — sounds tied to a sinking:event are left to the AudioEngine), player:died.
 */
import * as THREE from 'three';
import {
  STRIKE_MIN, STRIKE_HHMM, DEG, clamp, lerp, smoothstep,
  normalizeTimeline, eventTimes, TimelineSampler,
} from './Timeline.js';
import { Flooding } from './Flooding.js';
import { BreakupRig, BREAKUP_TOTAL, updateOwnWorldMatrix } from './Breakup.js';
import { LifeboatLauncher } from './LifeboatLaunch.js';
import { IcebergPass, FunnelCollapse, PropSlider } from './Effects.js';

export const DEFAULT_CLOCK_SPEED = 0.5;        // game-min per real second → 160 min in ~5.3 real min
export const BREAKUP_DILATION = 1 / 20;        // clock speed multiplier during the break-up
export const BREAKUP_SECONDS_PER_MIN = 40;     // cinematic seconds per game minute while broken
export const DROWN_SECONDS = 8;
export const ABYSS_Y = -25;

const DAY = 1440;
const dayIndex = (iso) => {
  if (typeof iso !== 'string') return 0;
  const t = Date.parse(iso + 'T00:00:00Z');
  return Number.isFinite(t) ? Math.round(t / 86400000) : 0;
};
const pad = (n) => String(n).padStart(2, '0');

const _v = new THREE.Vector3();

export class SinkingDirector {
  constructor({ ship, world, clock, bus, spec, npcs, player, audio } = {}) {
    this.ship = ship;
    this.world = world;
    this.clock = clock;
    this.bus = bus;
    this.spec = spec || {};
    this.npcs = npcs || null;
    this.player = player || null;
    this.audio = audio || null;

    const tl = normalizeTimeline(this.spec.sinkingTimeline);
    this.timeline = tl.keys;
    this.timelineIsDefault = tl.isDefault;
    this.sampler = new TimelineSampler(this.timeline);
    this.events = eventTimes(this.timeline);
    this.breakX = this._breakX();

    this.active = false;
    this.started = false;
    this.state = {
      minutesAfter: 0, hhmm: STRIKE_HHMM, trimDeg: 0, listDeg: 0, sinkM: 0,
      floodY: -20, floodWorldY: -9, floodDeck: null, floodAftX: 40,
      broken: false, lightsOn: true, phase: 'idle',
      bow: { trimDeg: 0, y: 0 }, stern: { trimDeg: 0, y: 0 },
    };

    this._speed = DEFAULT_CLOCK_SPEED;
    this._strikeAbs = 0;
    this._fired = new Set();
    this._floodIndex = -1;
    this._elapsed = 0;
    this._dimTimer = 0;
    this._creakTimer = 20;
    this._panic = -1;
    this._panicTimer = 0;
    this._mode = 'playing';
    this._drownSec = 0;
    this._drownSince = -1e9;
    this._dead = false;
    this._dilated = false;
    this._deckRef = null;
    this._subs = [];
    this.rig = null;
    this.flooding = null;
    this.lifeboats = null;
    this.iceberg = null;
    this.funnel = null;
    this.props = null;

    if (bus && typeof bus.on === 'function') {
      this._subs.push(bus.on('player:drowning', (p) => this._onDrowning(p)));
      this._subs.push(bus.on('game:mode', (p) => { if (p && p.mode) this._mode = p.mode; }));
    }
  }

  // ------------------------------------------------------------------ setup helpers
  _breakX() {
    const s = this.spec;
    if (this.ship && typeof this.ship.breakX === 'number') return this.ship.breakX;
    if (typeof s.breakX === 'number') return s.breakX;
    const k = this.timeline.find((e) => typeof e.breakX === 'number');
    if (k) return k.breakX;
    const f = s.funnels || [];
    if (f.length >= 4 && typeof f[2].x === 'number' && typeof f[3].x === 'number') return (f[2].x + f[3].x) / 2;
    return -32;
  }

  _scene() {
    if (this.world && this.world.engine && this.world.engine.scene) return this.world.engine.scene;
    let o = this.ship && this.ship.group;
    while (o && o.parent) o = o.parent;
    return o && o.isScene ? o : null;
  }

  _clockAbs() {
    const c = this.clock;
    if (!c) return this._strikeAbs;
    const m = typeof c.minutes === 'number' && Number.isFinite(c.minutes) ? c.minutes : STRIKE_MIN;
    return dayIndex(c.date) * DAY + m;
  }

  _setClockAbs(abs) {
    const c = this.clock;
    if (!c) return;
    const day = Math.floor(abs / DAY);
    const m = abs - day * DAY;
    if (typeof c.date === 'string' && Number.isFinite(Date.parse(c.date + 'T00:00:00Z'))) {
      const iso = new Date(day * 86400000).toISOString().slice(0, 10);
      if (typeof c.setDate === 'function') c.setDate(iso); else c.date = iso;
    }
    c.minutes = m;
    if ('_target' in c) c._target = null;
  }

  // ------------------------------------------------------------------ public API
  /** Begin Act IV at the strike. If the clock is earlier than 23:40 it is set to 23:40. */
  start() {
    if (this.started) { this.active = true; return; }
    this.started = true;
    this.active = true;
    const c = this.clock;
    let abs = this._clockAbs();
    const minutesToday = ((abs % DAY) + DAY) % DAY;
    if (minutesToday < STRIKE_MIN && minutesToday > 3 * 60) {
      // afternoon/evening before the strike → set the clock to 23:40 today
      if (c && typeof c.set === 'function') c.set(STRIKE_HHMM); else if (c) c.minutes = STRIKE_MIN;
      abs = this._clockAbs();
      this._strikeAbs = abs;
    } else if (minutesToday <= 3 * 60) {
      // small hours: the strike was last night (e.g. a loaded save at 00:30)
      this._strikeAbs = Math.floor(abs / DAY) * DAY - DAY + STRIKE_MIN;
    } else {
      this._strikeAbs = Math.floor(abs / DAY) * DAY + STRIKE_MIN;
    }
    this.setClockSpeed(this._speed);

    const scene = this._scene();
    this.flooding = new Flooding({ ship: this.ship, world: this.world, spec: this.spec, scene });
    try { this.flooding.build(); } catch (err) { console.warn('[sinking] flood water not built', err); }
    this.lifeboats = new LifeboatLauncher({ ship: this.ship, world: this.world, spec: this.spec, bus: this.bus, scene });
    this.iceberg = new IcebergPass({ ship: this.ship, world: this.world });
    this.funnel = new FunnelCollapse({ ship: this.ship, bus: this.bus });
    this.props = new PropSlider({ ship: this.ship });
    const fc = (this.spec.decks || []).find((d) => d.id === 'B');
    this._fcY = fc ? fc.y : 13.2;
    this.state.phase = 'strike';
    this.update(0);
  }

  /** Pause the director (ship stays where it is). */
  stop() {
    this.active = false;
    if (this.clock && this._dilated) { this.clock.speed = this._speed; this._dilated = false; }
  }

  /** Game-minutes per real second from the strike on (default 0.5 → 1 game-min per 2 s). */
  setClockSpeed(gameMinPerRealSec) {
    const v = Number(gameMinPerRealSec);
    if (!Number.isFinite(v) || v < 0) return;
    this._speed = v;
    if (this.clock && this.started) this.clock.speed = this._dilated ? v * BREAKUP_DILATION : v;
  }

  /** Move the clock to `minutesAfter` minutes past the strike and settle the state (tests/debug). */
  jumpTo(minutesAfter) {
    if (!this.started) this.start();
    const m = Math.max(0, Number(minutesAfter) || 0);
    this._setClockAbs(this._strikeAbs + m);
    this.update(0);
    // Jumping past the strike: the berg has already passed down the side — put it where the pass ends.
    if (m > 0.5 && this.iceberg && this.iceberg.active) { this.iceberg.t = this.iceberg.seconds; this.iceberg.update(0); }
    return this.state;
  }

  get minutesAfter() { return this.state.minutesAfter; }

  dispose() {
    for (const off of this._subs) { try { off(); } catch (_) { /* ignore */ } }
    this._subs = [];
    if (this.flooding) this.flooding.dispose();
    this.stop();
  }

  // ------------------------------------------------------------------ frame
  update(dt = 0) {
    if (!this.active || !this.started) return;
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this._elapsed += dt;
    const t = Math.max(0, this._clockAbs() - this._strikeAbs);
    const st = this.state;
    st.minutesAfter = t;
    st.hhmm = this._hhmm(t);
    const ev = this.events;

    // ---- one-shot events in time order
    this._fire('strike', t >= ev.strike, () => {
      this._emit('sinking:event', { id: 'strike' });
      this._emit('camera:shake', { intensity: 0.8, seconds: 6 });
      this.iceberg.trigger();
    });
    this._fire('lightsDim', t >= ev.lightsDim, () => this._dimLights());
    this._fire('funnel1', t >= ev.funnel1, () => this.funnel.trigger());
    this._fire('lightsOut', t >= ev.lightsOut, () => this._lightsOut());
    this._fire('breakup', t >= ev.breakup, () => this._breakup());

    // ---- hull pose
    const broken = this._fired.has('breakup');
    if (!broken) this._poseWhole(t);
    else this._poseParts(t);

    // ---- flooding
    this.flooding.update(dt, { minutesAfter: t, broken: st.broken, bowGroup: this.ship.bowGroup, sternGroup: this.ship.sternGroup, breakX: this.breakX });
    st.floodWorldY = this.flooding.floodWorldY;
    st.floodAftX = this.flooding.aftX;
    st.floodY = this._floodYUnderPlayer();
    this._floodDecks(t);

    // ---- cinematic pieces & crowds
    this.iceberg.update(dt);
    this.funnel.update(dt, t >= ev.lightsOut + 0.4);
    this.props.update(dt);
    this.lifeboats.update(t, this._speed || DEFAULT_CLOCK_SPEED, this._elapsed);
    this._lightsTick(dt, t);
    this._panicTick(dt, t);
    this._creaks(dt, t);
    this._playerTick(dt);

    // ---- phase + final events
    this._phase(t);
    this._fire('plunge', st.phase === 'gone' || t >= ev.gone, () => {
      this._emit('sinking:event', { id: 'plunge' });
      this._emit('sinking:event', { id: 'gone' });
      this._calmSea();
      if (this.clock && this._dilated) { this.clock.speed = this._speed; this._dilated = false; }
    });
    if (this._fired.has('plunge')) st.phase = 'gone';
    this._sanitize();
    this._emit('sinking:state', st);
  }

  // ------------------------------------------------------------------ pose
  _poseWhole(t) {
    const s = this.sampler.at(t);
    const st = this.state;
    st.trimDeg = s.trimDeg; st.listDeg = s.listDeg; st.sinkM = s.sinkM;
    const g = this.ship.group;
    const trim = s.trimDeg * DEG, list = s.listDeg * DEG;
    // forecastle reference P = (+80, fcY): keep it at/below a smooth target reaching 0 by 140 min
    const yProt = -80 * Math.sin(trim) + this._fcY * Math.cos(trim);
    const hP = this._fcY * (1 - smoothstep(0, 140, t)) - 12 * smoothstep(140, 158, t);
    const posY = Math.min(-s.sinkM, hP - yProt);
    g.rotation.set(-list, 0, -trim, 'XYZ');
    g.position.set(0, posY, 0);
    updateOwnWorldMatrix(g);
    st.bow.trimDeg = s.trimDeg; st.bow.y = posY;
    st.stern.trimDeg = s.trimDeg; st.stern.y = posY;
  }

  _poseParts(t) {
    const st = this.state;
    const tb = (t - this.events.breakup) * BREAKUP_SECONDS_PER_MIN;
    if (this.rig && this.rig.attach()) {
      const r = this.rig.update(tb);
      st.broken = true;
      st.bow.trimDeg = r.bow.trimDeg; st.bow.y = r.bow.y;
      st.stern.trimDeg = r.stern.trimDeg; st.stern.y = r.stern.y;
      st.trimDeg = r.bow.trimDeg;
      st.sinkM = -r.bow.y;
      st.listDeg = lerp(this.rig.list0, 0, smoothstep(0, 60, tb));
    } else {
      // no split available (fallback): keep the whole hull going down by the bow
      const s = this.sampler.at(t);
      const trim = lerp(s.trimDeg, 35, smoothstep(0, 30, tb));
      const sink = s.sinkM + 1.5 * Math.max(0, tb);
      const g = this.ship.group;
      g.rotation.set(-s.listDeg * DEG, 0, -trim * DEG, 'XYZ');
      g.position.set(0, -sink, 0);
      updateOwnWorldMatrix(g);
      st.trimDeg = trim; st.listDeg = s.listDeg; st.sinkM = sink;
      st.bow.trimDeg = trim; st.bow.y = -sink; st.stern.trimDeg = trim; st.stern.y = -sink;
    }
  }

  _breakup() {
    const st = this.state;
    const s = this.sampler.at(this.events.breakup);
    this._poseWhole(this.events.breakup);
    this.ship.group.updateMatrixWorld(true);
    this.rig = new BreakupRig({ ship: this.ship, breakX: this.breakX, trimDeg: st.trimDeg || s.trimDeg, listDeg: st.listDeg || s.listDeg });
    this._emit('sinking:event', { id: 'breakup', x: this.breakX });
    this._emit('camera:shake', { intensity: 2, seconds: 3 });
    // main.js splits the ship synchronously in its handler; attach now if it did, else next frame
    if (this.rig.attach()) st.broken = true;
    if (this.clock) { this.clock.speed = this._speed * BREAKUP_DILATION; this._dilated = true; }
  }

  // ------------------------------------------------------------------ flooding helpers
  _floodYUnderPlayer() {
    const p = this.player && this.player.position;
    if (!p || !Number.isFinite(p.x)) return this.flooding.localYAtX(this.flooding.xRef);
    let frame = this.ship.group;
    if (this.state.broken && typeof this.ship.partAt === 'function') {
      try { const part = this.ship.partAt(p); if (part && part.group) frame = part.group; } catch (_) { /* keep whole */ }
    }
    return this.flooding.localYUnder(p, frame);
  }

  _floodDecks(t) {
    const fl = this.flooding;
    const frame = this.state.broken && this.ship.bowGroup ? this.ship.bowGroup : this.ship.group;
    const localY = fl.localYAtX(fl.xRef, frame);
    const deck = fl.deckFor(localY);
    const idx = deck ? fl.deckIndex(deck) : -1;
    if (idx > this._floodIndex) {
      for (let i = this._floodIndex + 1; i <= idx; i++) {
        const id = fl.decks[i].id;
        this.state.floodDeck = id;
        this._emit('sinking:event', { id: 'floodDeck', deck: id, minutesAfter: t });
      }
      this._floodIndex = idx;
    }
  }

  // ------------------------------------------------------------------ lights
  _dimLights() {
    const ship = this.ship;
    if (typeof ship.flickerTo === 'function') ship.flickerTo(0.8, 0.6);
    else if (ship.lights) { if (ship.lights.flicker) ship.lights.flicker(0.6); this._reassertDim = 0.7; }
    this._dimTimer = 20 + Math.random() * 20;
  }

  _lightsTick(dt, t) {
    if (!this.state.lightsOn || !this._fired.has('lightsDim')) return;
    const ship = this.ship;
    if (this._reassertDim !== undefined) {
      this._reassertDim -= dt;
      if (this._reassertDim <= 0) { if (ship.lights && ship.lights.setPower) ship.lights.setPower(0.8); this._reassertDim = undefined; }
    }
    this._dimTimer -= dt;
    if (this._dimTimer <= 0) {
      this._dimTimer = 20 + Math.random() * 20;
      if (typeof ship.flickerTo === 'function') ship.flickerTo(0.8, 0.4);
      else if (ship.lights && ship.lights.flicker) { ship.lights.flicker(0.4); this._reassertDim = 0.5; }
    }
  }

  _lightsOut() {
    const ship = this.ship;
    if (typeof ship.flickerTo === 'function') ship.flickerTo(0, 3);
    else if (ship.lights) {
      if (ship.lights.flicker) ship.lights.flicker(3);
      if (ship.lights.setPower) ship.lights.setPower(0);
    }
    this.state.lightsOn = false;
    this._reassertDim = undefined;
    this._emit('sinking:event', { id: 'lightsOut' });
  }

  // ------------------------------------------------------------------ crowds, sounds, sea
  _panicTick(dt, t) {
    if (t < this.events.panic || !this.npcs || typeof this.npcs.setPanic !== 'function') return;
    this._panicTimer -= dt;
    const level = Math.min(1, t / 120);
    if (this._panicTimer > 0 && Math.abs(level - this._panic) < 0.01) return;
    this._panicTimer = 1;
    if (Math.abs(level - this._panic) >= 0.005) { this._panic = level; try { this.npcs.setPanic(level); } catch (_) { /* ignore */ } }
  }

  _creaks(dt, t) {
    if (t < 60 || this.state.phase === 'gone') return;
    this._creakTimer -= dt;
    if (this._creakTimer > 0) return;
    const late = t >= 140;
    this._creakTimer = late ? 12 + Math.random() * 15 : 30 + Math.random() * 30;
    this._emit('audio:play', { id: late && Math.random() < 0.5 ? 'rumble' : 'creak' });
  }

  _calmSea() {
    const w = this.world;
    if (w && typeof w.setWeather === 'function') { try { w.setWeather({ wind: 0, swell: 0 }); } catch (_) { /* ignore */ } }
  }

  // ------------------------------------------------------------------ player
  _onDrowning(p) {
    if (!this.active || this._dead || this._mode !== 'playing') return;
    const sec = p && Number.isFinite(p.seconds) ? p.seconds : 1;
    if (this._elapsed - this._drownSince > 2.5) this._drownSec = 0;      // surfaced in between: recover
    this._drownSince = this._elapsed;
    this._drownSec += sec;
    if (this._drownSec >= DROWN_SECONDS) this._die('drowned');
  }

  _playerTick() {
    if (this._dead || !this.player || !this.player.position) return;
    const y = this.player.position.y;
    if (Number.isFinite(y) && y < ABYSS_Y && this._mode === 'playing') this._die('drowned');
  }

  _die(cause) {
    if (this._dead) return;
    this._dead = true;
    this._emit('player:died', { cause });
  }

  // ------------------------------------------------------------------ misc
  _phase(t) {
    const st = this.state, ev = this.events;
    if (st.broken || t >= ev.breakup) {
      const tb = (t - ev.breakup) * BREAKUP_SECONDS_PER_MIN;
      st.phase = tb >= BREAKUP_TOTAL ? 'gone' : tb >= BREAKUP_TOTAL - 20 ? 'plunge' : 'breakup';
      return;
    }
    const trim = st.trimDeg * DEG;
    const bowDeckY = -100 * Math.sin(trim) + this._fcY * Math.cos(trim) + (this.ship.group.position.y || 0);
    if (bowDeckY <= 0) st.phase = 'bowUnder';
    else if (t >= 60) st.phase = 'listing';
    else if (t >= 10) st.phase = 'flooding';
    else st.phase = 'strike';
  }

  _hhmm(t) {
    const abs = this._strikeAbs + t;
    const m = ((Math.floor(abs) % DAY) + DAY) % DAY;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  _fire(id, cond, fn) {
    if (!cond || this._fired.has(id)) return;
    this._fired.add(id);
    try { fn(); } catch (err) { console.error(`[sinking] ${id} failed`, err); }
  }

  _emit(type, payload) {
    if (this.bus && typeof this.bus.emit === 'function') this.bus.emit(type, payload);
  }

  _sanitize() {
    const st = this.state;
    for (const k of ['minutesAfter', 'trimDeg', 'listDeg', 'sinkM', 'floodY', 'floodWorldY', 'floodAftX']) if (!Number.isFinite(st[k])) st[k] = 0;
    for (const p of [st.bow, st.stern]) { if (!Number.isFinite(p.trimDeg)) p.trimDeg = 0; if (!Number.isFinite(p.y)) p.y = 0; }
  }
}

export { clamp as _clamp, _v as _tmpVec };
