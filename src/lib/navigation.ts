import type { Cell, Maneuver, NavStep, Route } from '../types'

// Roughly how much real floor one grid cell represents. Used only for the
// human-facing distance readouts ("12 m"), not for pathfinding.
export const METERS_PER_CELL = 1

interface Segment {
  dx: number
  dy: number
  length: number
}

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

/** Group a cell path into straight runs (segments) broken at every corner. */
function toSegments(path: Cell[]): Segment[] {
  const segments: Segment[] = []
  for (let i = 1; i < path.length; i++) {
    const dx = sign(path[i].x - path[i - 1].x)
    const dy = sign(path[i].y - path[i - 1].y)
    const last = segments[segments.length - 1]
    if (last && last.dx === dx && last.dy === dy) {
      last.length += 1
    } else {
      segments.push({ dx, dy, length: 1 })
    }
  }
  return segments
}

/**
 * Direction change between two headings on a top-down map (y grows downward).
 * The 2D cross product's sign tells us which way we pivoted.
 */
function turn(prev: Segment, next: Segment): Maneuver {
  const cross = prev.dx * next.dy - prev.dy * next.dx
  if (cross > 0) return 'right'
  if (cross < 0) return 'left'
  // Same or reversed heading; reversal is rare in a shortest path.
  const dot = prev.dx * next.dx + prev.dy * next.dy
  return dot < 0 ? 'left' : 'straight'
}

function meters(cells: number): number {
  return Math.max(1, Math.round(cells * METERS_PER_CELL))
}

function instructionFor(maneuver: Maneuver, dist: number, destinationLabel: string): string {
  switch (maneuver) {
    case 'start':
      return `Head into the store and continue ${dist} m`
    case 'left':
      return `Turn left and continue ${dist} m`
    case 'right':
      return `Turn right and continue ${dist} m`
    case 'straight':
      return `Continue straight for ${dist} m`
    case 'arrive':
      return `Arrive at ${destinationLabel}`
    default:
      return `Continue ${dist} m`
  }
}

/** Assemble a full Route (cells + distance + turn-by-turn steps) from a path. */
export function buildRoute(path: Cell[], destinationLabel: string): Route {
  const segments = toSegments(path)
  const steps: NavStep[] = []

  segments.forEach((seg, idx) => {
    const maneuver: Maneuver = idx === 0 ? 'start' : turn(segments[idx - 1], seg)
    const dist = meters(seg.length)
    steps.push({ maneuver, distance: dist, instruction: instructionFor(maneuver, dist, destinationLabel) })
  })

  steps.push({ maneuver: 'arrive', distance: 0, instruction: instructionFor('arrive', 0, destinationLabel) })

  return {
    cells: path,
    distance: Math.max(0, path.length - 1),
    steps,
  }
}

/** Total walking time estimate in seconds at a casual in-store pace. */
export function etaSeconds(route: Route): number {
  const metersTotal = route.distance * METERS_PER_CELL
  const pace = 0.9 // m/s, slow browsing walk
  return Math.round(metersTotal / pace)
}
