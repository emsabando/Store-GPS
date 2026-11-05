return (async () => {
  const p = game.player, ship = game.ship;
  const V = p.position.constructor;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const run = async (b) => {
    const dm = b.door.matrixWorld;
    const pos = new V().setFromMatrixPosition(dm), front = new V(0, 0, 1).transformDirection(dm);
    const local = ship.worldToLocal(pos);
    const start = local.clone().addScaledVector(front, 1.5);
    const yaw = Math.atan2(front.z, -front.x);           // face the door (forward = -front)
    game.setMode('playing'); p.setMode('first');
    p.teleportLocal(start.x, local.y + 0.1, start.z, yaw);
    const dist = () => ship.worldToLocal(p.position.clone()).sub(local).dot(front);
    const out = { door: b.door.name, id: (b.leaves[0].userData.interactable || {}).id, startD: +dist().toFixed(2), wasOpen: b.data.open };
    if (b.data.open) { b.data.toggle(); await wait(700); }
    p.input.isDown = (c) => c === 'KeyW'; p.enabled = true;
    await game.frame(45); out.closedD = +dist().toFixed(2);
    p.input.isDown = () => false;
    b.data.toggle(); await wait(700); out.leafX = +b.leaves[0].parent.position.x.toFixed(2); out.leafRot = +b.leaves[0].parent.rotation.y.toFixed(2);
    p.teleportLocal(start.x, local.y + 0.1, start.z, yaw);
    p.input.isDown = (c) => c === 'KeyW';
    await game.frame(45); out.openD = +dist().toFixed(2);
    p.input.isDown = () => false;
    return out;
  };
  const res = [];
  const doors = ship.doorBlockers.filter((b) => /door\.(oak|white)/.test(b.door.name) && b.data.open === false).slice(0, 2);
  const wt = ship.doorBlockers.filter((b) => /wtDoor/.test(b.door.name)).slice(0, 1);
  for (const b of [...doors, ...wt]) { try { res.push(await run(b)); } catch (e) { res.push({ err: String(e).slice(0, 120) }); } }
  console.log('DOORTEST ' + JSON.stringify(res));
})();
