// STUB — replaced by the Materials engineer (ARCHITECTURE.md §4). Flat colours only.
import * as THREE from 'three';
const PALETTE = {
  teakDeck: '#8b6a3e', pineDeck: '#c2a36b', oakPanel: '#7a5a34', oakDark: '#4b3620', mahogany: '#4e2416', walnut: '#5b3a23', sycamore: '#c9b48c',
  whiteEnamel: '#f2efe6', whitePaintedSteel: '#e9e6dc', hullBlack: '#111214', hullBlackRiveted: '#111214', antifouling: '#7a2a1e', boottop: '#2a1a16', sheerStripe: '#d4b25a',
  funnelBuff: '#c9a66b', funnelBlack: '#101010', brass: '#b08d57', bronze: '#8c6b3d', wroughtIron: '#2b2b2e', ironDark: '#26272a', steelGrey: '#6f7378', steelRusty: '#6b4a3a',
  linoDining: '#d9cfae', linoCorridor: '#9c3b36', carpetRed: '#8b1e2b', carpetBlue: '#1f2f5a', carpetGreen: '#2f5a3a', roseCarpet: '#b86b7a', moorishTile: '#2a7a7a', marbleWhite: '#e8e4dc',
  plasterWhite: '#f4f1ea', plasterCream: '#efe6cf', canvas: '#d8cfb8', canvasCover: '#cfc6ad', glass: '#9fc4d8', glassFrosted: '#e6eef2', glassStained: '#c47a3a', lifeboatWhite: '#f1eee5', rope: '#b59a6a',
  velvetGreen: '#1f4d33', velvetRed: '#7a1f2a', leatherDark: '#3a2418', leatherGreen: '#2c4a36', wicker: '#c7a66a', coal: '#151515', boilerIron: '#3a3a3c', copper: '#b87333', gold: '#d4af37', ice: '#cfe8f3', snow: '#f5fbff',
  woodCrate: '#a07c4c', carRed: '#8e1b1b', skin: '#e0b89a', hairDark: '#2c1b12', hairLight: '#c8a165', clothBlack: '#141416', clothWhite: '#f3f0ea', clothNavy: '#182540', clothGrey: '#6e6e70', clothBrown: '#5a3d2a', clothCream: '#e9dcc2', clothBurgundy: '#5e1a26', clothBlue: '#2a4b7c', clothGreen: '#2e5a3c',
};
export class MaterialLibrary {
  constructor(quality) { this.quality = quality; this._cache = new Map(); this.textures = {}; }
  static async load({ quality = 'high', onProgress = () => {} } = {}) { onProgress(100, 'Palette ready'); return new MaterialLibrary(quality); }
  get(name) {
    if (!this._cache.has(name)) {
      const hex = PALETTE[name] || '#ff00ff';
      const metal = /brass|bronze|iron|steel|copper|gold|boiler/.test(name) ? 0.8 : 0;
      const rough = /glass|marble|brass|gold/.test(name) ? 0.25 : 0.75;
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), metalness: metal, roughness: rough, transparent: /glass/.test(name), opacity: /glass/.test(name) ? 0.35 : 1 });
      mat.name = name;
      this._cache.set(name, mat);
    }
    return this._cache.get(name);
  }
  clone(name, overrides = {}) { const m = this.get(name).clone(); Object.assign(m, overrides); return m; }
  setQuality(q) { this.quality = q; }
}
