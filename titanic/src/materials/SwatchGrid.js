/**
 * SwatchGrid — debug helper: a Group of labelled swatches (sphere + 1 m flat tile at true texture
 * scale) for every material in a MaterialLibrary. Not used by the game; used by tests/screenshots:
 *   window.__game.engine.scene.add(window.__game.game.materials.makeSwatchGrid());
 */
import * as THREE from 'three';

function labelSprite(text, width = 1) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,20,34,0.85)'; g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#f4e3b2'; g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 96 / 512), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.name = 'label:' + text;
  return m;
}

export function makeSwatchGrid(materials, { names = materials.names, columns = 8, spacing = 1.3, labels = true } = {}) {
  const group = new THREE.Group();
  group.name = 'MaterialSwatches';
  const sphereGeo = new THREE.SphereGeometry(0.3, 48, 32);
  const tileGeo = new THREE.PlaneGeometry(1, 1); tileGeo.rotateX(-Math.PI / 2);
  // aoMap uses uv2 in older three; r187 uses uv for aoMap by default, but keep uv1 for safety.
  for (const geo of [sphereGeo, tileGeo]) if (!geo.attributes.uv1) geo.setAttribute('uv1', geo.attributes.uv);
  names.forEach((name, i) => {
    const col = i % columns, row = Math.floor(i / columns);
    const cell = new THREE.Group(); cell.name = 'swatch:' + name;
    cell.position.set((col - (columns - 1) / 2) * spacing, 0, row * spacing);
    const mat = materials.get(name);
    const sphere = new THREE.Mesh(sphereGeo, mat); sphere.position.y = 0.36; sphere.castShadow = sphere.receiveShadow = true;
    const tileMat = materials.setRepeat(materials.clone(name), 1, 1); // 1 m × 1 m at true scale
    const tile = new THREE.Mesh(tileGeo, tileMat); tile.receiveShadow = true;
    cell.add(sphere, tile);
    if (labels) { const l = labelSprite(name, 1.1); l.position.set(0, 0.02, 0.62); l.rotation.x = -Math.PI / 2; cell.add(l); }
    group.add(cell);
  });
  group.userData.rows = Math.ceil(names.length / columns);
  group.userData.columns = columns;
  group.userData.spacing = spacing;
  return group;
}
