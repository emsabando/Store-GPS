// Core domain types for Store GPS.
//
// Everything is modeled on a uniform grid. A store is a grid of cells; some
// cells are walkable floor, others are blocked (shelves, walls, fixtures).
// Products live on shelves and are reached via an adjacent walkable "access"
// cell — that access cell is where navigation routes you to.

/** A grid coordinate. Integer cell indices, not pixels. */
export interface Cell {
  x: number
  y: number
}

export type TileKind =
  | 'floor' // walkable
  | 'wall' // store perimeter / structural, blocked
  | 'shelf' // product fixture, blocked
  | 'entrance' // walkable, the "you are here" start
  | 'checkout' // walkable, register area

/** Inventory + merchandising info for one product in one store. */
export interface Product {
  id: string
  name: string
  brand: string
  category: string
  /** Human-facing aisle label, e.g. "Aisle 7" or "Produce". */
  aisle: string
  price: number
  /** On-hand units. 0 means out of stock. */
  stock: number
  /** Walkable cell directly in front of the product's shelf. */
  access: Cell
  /** The shelf cell the product sits on (for drawing a marker). */
  shelf: Cell
  emoji: string
}

/** A labeled region of the store (used for the legend + step directions). */
export interface Department {
  id: string
  label: string
  /** Approximate center cell, used to anchor the label on the map. */
  center: Cell
  color: string
}

export interface Store {
  id: string
  name: string
  address: string
  /** Grid dimensions in cells. */
  cols: number
  rows: number
  /** Row-major tile grid: tiles[y][x]. */
  tiles: TileKind[][]
  entrance: Cell
  checkout: Cell
  departments: Department[]
  products: Product[]
}

/** A computed route from a start cell to a destination cell. */
export interface Route {
  /** Ordered list of cells from start to destination (inclusive). */
  cells: Cell[]
  /** Total walking distance in cells. */
  distance: number
  /** Turn-by-turn navigation steps derived from the path. */
  steps: NavStep[]
}

export type Maneuver = 'start' | 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'arrive'

export interface NavStep {
  maneuver: Maneuver
  /** Distance in cells covered by this step. */
  distance: number
  instruction: string
}
