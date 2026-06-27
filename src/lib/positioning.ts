import type { Cell, Pose, Route, Store } from '../types'
import { isWalkable } from './pathfinding'
import { METERS_PER_CELL } from './navigation'

// ---------------------------------------------------------------------------
// Pedestrian Dead Reckoning (PDR) engine with map-matching
// ---------------------------------------------------------------------------
//
// Indoor positioning without beacons: start from a known point, then advance
// the position using motion (steps + heading, or a simulated walk). Raw dead
// reckoning drifts, so every move is "map-matched" — constrained to the store's
// walkable corridors by sliding along walls instead of passing through shelves.
// This is what keeps an infrastructure-free indoor track usable.

const HEADING_UP = -Math.PI / 2

function cellCenter(cell: Cell): Pose {
  return { x: cell.x + 0.5, y: cell.y + 0.5, heading: HEADING_UP }
}

export class PositioningEngine {
  readonly pose: Pose

  constructor(
    private store: Store,
    origin: Cell,
  ) {
    this.pose = cellCenter(origin)
  }

  setStore(store: Store) {
    this.store = store
  }

  /** Teleport to a known cell (calibration / "I'm standing here"). */
  setOrigin(cell: Cell, heading = HEADING_UP) {
    this.pose.x = cell.x + 0.5
    this.pose.y = cell.y + 0.5
    this.pose.heading = heading
  }

  setHeading(heading: number) {
    this.pose.heading = heading
  }

  private free(px: number, py: number): boolean {
    return isWalkable(this.store, Math.floor(px), Math.floor(py))
  }

  /**
   * Move by a vector in cell units, map-matched. If the diagonal/target cell is
   * blocked, slide along whichever axis stays walkable (wall following).
   * Heading follows the intended direction so facing stays natural even when a
   * wall blocks part of the motion.
   */
  moveBy(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return
    const { x, y } = this.pose
    const nx = x + dx
    const ny = y + dy
    if (this.free(nx, ny)) {
      this.pose.x = nx
      this.pose.y = ny
    } else if (this.free(nx, y)) {
      this.pose.x = nx
    } else if (this.free(x, ny)) {
      this.pose.y = ny
    }
    this.pose.heading = Math.atan2(dy, dx)
  }

  /** Take one stride of `meters` along the current heading (device step). */
  stride(meters: number) {
    const cells = meters / METERS_PER_CELL
    this.moveBy(Math.cos(this.pose.heading) * cells, Math.sin(this.pose.heading) * cells)
  }

  /** Nearest walkable grid cell to the current position. */
  snapCell(): Cell {
    return { x: Math.floor(this.pose.x), y: Math.floor(this.pose.y) }
  }
}

// ---------------------------------------------------------------------------
// Route projection — where am I along the planned path?
// ---------------------------------------------------------------------------

export interface RouteProjection {
  /** Continuous index along route.cells (segment i + fraction t). */
  index: number
  /** Walking distance remaining to the destination, in cells. */
  remainingCells: number
}

function projectPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  const cx = ax + t * dx
  const cy = ay + t * dy
  const dist = Math.hypot(px - cx, py - cy)
  return { t, dist }
}

/** Project a position onto the route polyline; find nearest point + remaining distance. */
export function projectOntoRoute(route: Route, px: number, py: number): RouteProjection {
  const pts = route.cells.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }))
  if (pts.length < 2) return { index: 0, remainingCells: 0 }

  // Suffix length: distance from each vertex to the end.
  const suffix = new Array(pts.length).fill(0)
  for (let i = pts.length - 2; i >= 0; i--) {
    suffix[i] = suffix[i + 1] + Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  }

  let best = { index: 0, remainingCells: suffix[0], dist: Infinity }
  for (let i = 0; i < pts.length - 1; i++) {
    const { t, dist } = projectPointOnSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    if (dist < best.dist) {
      const segLen = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
      best = { index: i + t, remainingCells: suffix[i + 1] + (1 - t) * segLen, dist }
    }
  }
  return { index: best.index, remainingCells: best.remainingCells }
}

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

/** Cell-path indices where a new straight segment (turn-by-turn step) begins. */
export function segmentStarts(cells: Cell[]): number[] {
  const starts = [0]
  for (let i = 2; i < cells.length; i++) {
    const px = sign(cells[i - 1].x - cells[i - 2].x)
    const py = sign(cells[i - 1].y - cells[i - 2].y)
    const cx = sign(cells[i].x - cells[i - 1].x)
    const cy = sign(cells[i].y - cells[i - 1].y)
    if (px !== cx || py !== cy) starts.push(i - 1)
  }
  return starts
}

/** Map a continuous route index to the active turn-by-turn step number. */
export function stepIndexForIndex(route: Route, index: number): number {
  const starts = segmentStarts(route.cells)
  let step = 0
  for (let k = 0; k < starts.length; k++) if (index >= starts[k]) step = k
  return step
}
