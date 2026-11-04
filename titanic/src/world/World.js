// STUB — replaced by the World engineer (ARCHITECTURE.md §6).
import * as THREE from 'three';
export class World {
  constructor({ engine, materials, clock, quality }) { this.engine = engine; this.materials = materials; this.clock = clock; this.quality = quality; this.wind = 0.3; this.iceberg = null; this.ocean = { heightAt: () => 0 }; }
  async build() { const sea = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: '#0e2a3a', roughness: 0.3, metalness: 0.1 })); sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; this.engine.scene.add(sea); this.sunLight = new THREE.DirectionalLight(0xfff1dd, 3); this.sunLight.position.set(200, 300, 100); this.sunLight.castShadow = true; this.engine.scene.add(this.sunLight); this.engine.scene.background = new THREE.Color('#7fa7cf'); }
  update() {}
  setWeather() {}
  spawnIceberg() {}
}
