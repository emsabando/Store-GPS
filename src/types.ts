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

/**
 * Continuous position + facing of the user on the grid. x/y are in cell-center
 * units (an integer + 0.5 is the middle of a cell); heading is radians, where
 * -PI/2 points "up" (toward smaller y / the top of the map).
 */
export interface Pose {
  x: number
  y: number
  heading: number
}

export type TileKind =
  | 'floor' // walkable
  | 'wall' // store perimeter / structural, blocked
  | 'shelf' // product fixture, blocked
  | 'entrance' // walkable, the "you are here" start
  | 'checkout' // walkable, register area

/**
 * Availability normalized across data sources. Count-based sources (the mock
 * catalog) derive this from a number; level-based sources (Kroger) map their
 * HIGH/LOW/TEMPORARILY_OUT_OF_STOCK directly. 'unknown' means the source had
 * no inventory signal for this item/location.
 */
export type Availability = 'in' | 'low' | 'out' | 'unknown'

/** Inventory + merchandising info for one product in one store. */
export interface Product {
  id: string
  name: string
  brand: string
  category: string
  /** Human-facing aisle label, e.g. "Aisle 7" or "Produce". */
  aisle: string
  /** Null when the source doesn't expose a price for this location. */
  price: number | null
  /** On-hand units when known, else -1 (level-only sources like Kroger). */
  stock: number
  availability: Availability
  /** Rich physical location string when available, e.g. "Aisle 12 · Left · Shelf 4". */
  locationDetail?: string
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
