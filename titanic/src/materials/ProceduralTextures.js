// STUB — replaced by the Materials engineer (ARCHITECTURE.md §4).
import * as THREE from 'three';
function solid(hex) { const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, 4, 4); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const pack = (hex) => { const map = solid(hex); map.colorSpace = THREE.SRGBColorSpace; return { map, normalMap: null, roughnessMap: null }; };
export const makePlanks = (o = {}) => pack(o.color || '#8b6a3e');
export const makeRivetedPlates = (o = {}) => pack(o.color || '#111214');
export const makeTiles = (o = {}) => pack((o.colours && o.colours[0]) || '#d9cfae');
export const makeCarpet = (o = {}) => pack(o.color || '#8b1e2b');
export const makePanel = (o = {}) => pack(o.color || '#7a5a34');
export const makeBrushedMetal = (o = {}) => pack(o.color || '#6f7378');
export const makePaint = (o = {}) => pack(o.color || '#e9e6dc');
export const makeCanvas = (o = {}) => pack(o.color || '#d8cfb8');
export const makeNameplate = (o = {}) => pack(o.color || '#d4af37');
export const normalFromHeight = (canvas) => null;
export const makeNoise = () => solid('#808080');
