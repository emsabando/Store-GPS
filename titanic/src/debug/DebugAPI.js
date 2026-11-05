// Debug API for the smoke test and manual testing (ARCHITECTURE.md §9). Owned by the integrator.
export function installDebugAPI(game) {
  const { engine, ship, player, world, quest, npcs, sinking, clock } = game;
  // after a teleport the indoor/outdoor lighting settles at once instead of easing over a second
  const settle = () => { if (player.refreshInside) player.refreshInside(); if (world && world.setInside) { world.setInside(!!player.inside); if (world.snapInside) world.snapInside(); } };
  const api = {
    engine, ship, player, world, quest, npcs, sinking, clock, game,
    listLocations: () => [...ship.locations.keys()],
    teleport: (target) => {
      if (typeof target === 'string') {
        const l = ship.locations.get(target);
        if (!l) throw new Error(`unknown location ${target}`);
        player.setMode(l.mode || 'first');          // mode first: teleportLocal places the eye for free-fly
        if (l.mode === 'free' && typeof player.teleportWorld === 'function') player.teleportWorld(l.x, (l.y ?? 0) + 0.1, l.z, l.yaw || 0);   // exterior spots stay put while the ship sinks
        else player.teleportLocal(l.x, (l.y ?? 0) + 0.1, l.z, l.yaw || 0);
        if (l.pitch !== undefined) player.pitch = l.pitch;
        settle();
        return l;
      }
      const { x, y, z, yaw = 0, pitch = 0, mode } = target;
      player.setMode(mode || 'first');
      if (mode === 'free' && typeof player.teleportWorld === 'function') player.teleportWorld(x, y, z, yaw);
      else player.teleportLocal(x, y, z, yaw);
      player.pitch = pitch;
      settle();
      return target;
    },
    setTime: (hhmm) => clock.set(hhmm),
    setQuality: (q) => { game.settings?.set?.('quality', q); engine.setQuality(q); },
    setMode: (m) => player.setMode(m),
    startSinking: () => sinking.start(),
    frame: (n = 1) => new Promise((resolve) => { let k = 0; const tick = () => { if (engine.manualRender && engine.renderOnce) engine.renderOnce(); if (++k >= n) resolve(engine.stats); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }),
    stats: () => engine.stats,
  };
  window.__game = api;
  return api;
}
