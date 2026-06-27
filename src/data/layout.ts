import type { Availability, Cell, Department, Product, Store, TileKind } from '../types'

// ---------------------------------------------------------------------------
// Store layout generator (retailer-agnostic)
// ---------------------------------------------------------------------------
//
// Given a retailer-agnostic description of a store — a list of departments,
// each holding products — this builds the renderable grid `Store`: a walled
// rectangle with an entrance, a checkout strip, and one vertical aisle of
// shelving per department. Products are placed on shelf cells, each reachable
// from an adjacent walkable corridor cell (where navigation routes you).
//
// Both the mock catalog and the live Kroger adapter funnel through here, so the
// map/pathfinding/navigation code never has to know where the data came from.

const ROWS = 34
const BLOCK_TOP = 6
const BLOCK_BOTTOM = ROWS - 6 // 28
const FIRST_X = 4
const PITCH = 5 // 2 cells of shelf + 3 cells of corridor
const MIN_COLS = 46

export const PALETTE = [
  '#22c55e',
  '#f59e0b',
  '#38bdf8',
  '#a78bfa',
  '#fb7185',
  '#34d399',
  '#facc15',
  '#60a5fa',
  '#f97316',
  '#2dd4bf',
  '#c084fc',
  '#4ade80',
]

export interface LayoutProduct {
  id?: string
  name: string
  brand: string
  category: string
  price: number | null
  /** Units on hand when known, else -1. */
  stock: number
  availability: Availability
  locationDetail?: string
  emoji: string
}

export interface LayoutDept {
  label: string
  color: string
  products: LayoutProduct[]
}

export interface LayoutInput {
  id: string
  name: string
  address: string
  depts: LayoutDept[]
}

function columnsFor(deptCount: number): number {
  if (deptCount === 0) return MIN_COLS
  const lastAccessX = FIRST_X + (deptCount - 1) * PITCH + 2
  return Math.max(MIN_COLS, lastAccessX + 4)
}

function blankGrid(cols: number): TileKind[][] {
  const tiles: TileKind[][] = []
  for (let y = 0; y < ROWS; y++) {
    const row: TileKind[] = []
    for (let x = 0; x < cols; x++) {
      const isPerimeter = x === 0 || y === 0 || x === cols - 1 || y === ROWS - 1
      row.push(isPerimeter ? 'wall' : 'floor')
    }
    tiles.push(row)
  }
  return tiles
}

/** Walkable cell-pairs flanking one aisle block, top to bottom, alternating faces. */
function aisleSlots(bx: number): { shelf: Cell; access: Cell }[] {
  const slots: { shelf: Cell; access: Cell }[] = []
  for (let y = BLOCK_TOP + 1; y < BLOCK_BOTTOM; y += 2) {
    slots.push({ shelf: { x: bx, y }, access: { x: bx - 1, y } }) // left face
    slots.push({ shelf: { x: bx + 1, y }, access: { x: bx + 2, y } }) // right face
  }
  return slots
}

export function buildStore(input: LayoutInput): Store {
  const cols = columnsFor(input.depts.length)
  const tiles = blankGrid(cols)
  const entranceX = Math.floor(cols / 2)

  // Entrance: a two-cell gap in the bottom wall.
  tiles[ROWS - 1][entranceX - 1] = 'entrance'
  tiles[ROWS - 1][entranceX] = 'entrance'
  const entrance: Cell = { x: entranceX, y: ROWS - 2 }

  // Checkout strip just inside the entrance.
  const checkoutY = ROWS - 3
  for (let x = entranceX - 3; x <= entranceX + 3; x++) {
    if (x > 0 && x < cols - 1) tiles[checkoutY][x] = 'checkout'
  }
  const checkout: Cell = { x: entranceX, y: checkoutY }

  const departments: Department[] = []
  const products: Product[] = []

  input.depts.forEach((dept, i) => {
    const bx = FIRST_X + i * PITCH

    for (let y = BLOCK_TOP; y <= BLOCK_BOTTOM; y++) {
      tiles[y][bx] = 'shelf'
      tiles[y][bx + 1] = 'shelf'
    }

    departments.push({
      id: `${input.id}-dept-${i}`,
      label: dept.label,
      center: { x: bx + 0.5, y: BLOCK_TOP - 2 },
      color: dept.color,
    })

    const slots = aisleSlots(bx)
    dept.products.forEach((p, j) => {
      const slot = slots[j % slots.length]
      products.push({
        id: p.id ?? `${input.id}-p-${i}-${j}`,
        name: p.name,
        brand: p.brand,
        category: dept.label,
        aisle: dept.label,
        price: p.price,
        stock: p.stock,
        availability: p.availability,
        locationDetail: p.locationDetail,
        access: slot.access,
        shelf: slot.shelf,
        emoji: p.emoji,
      })
    })
  })

  return {
    id: input.id,
    name: input.name,
    address: input.address,
    cols,
    rows: ROWS,
    tiles,
    entrance,
    checkout,
    departments,
    products,
  }
}

/** Derive a normalized availability bucket from a unit count. */
export function availabilityFromStock(stock: number): Availability {
  if (stock <= 0) return 'out'
  if (stock <= 10) return 'low'
  return 'in'
}
