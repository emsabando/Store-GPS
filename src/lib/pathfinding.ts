import type { Cell, Store, TileKind } from '../types'

const WALKABLE: ReadonlySet<TileKind> = new Set<TileKind>(['floor', 'entrance', 'checkout'])

export function isWalkable(store: Store, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= store.cols || y >= store.rows) return false
  return WALKABLE.has(store.tiles[y][x])
}

const key = (x: number, y: number) => y * 100000 + x

/** Minimal binary min-heap keyed by f-score. */
class MinHeap {
  private items: { k: number; f: number }[] = []

  get size() {
    return this.items.length
  }

  push(k: number, f: number) {
    const items = this.items
    items.push({ k, f })
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (items[parent].f <= items[i].f) break
      ;[items[parent], items[i]] = [items[i], items[parent]]
      i = parent
    }
  }

  pop(): number {
    const items = this.items
    const top = items[0]
    const last = items.pop()!
    if (items.length > 0) {
      items[0] = last
      let i = 0
      const n = items.length
      for (;;) {
        const l = 2 * i + 1
        const r = 2 * i + 2
        let smallest = i
        if (l < n && items[l].f < items[smallest].f) smallest = l
        if (r < n && items[r].f < items[smallest].f) smallest = r
        if (smallest === i) break
        ;[items[smallest], items[i]] = [items[i], items[smallest]]
        i = smallest
      }
    }
    return top.k
  }
}

// 4-directional movement keeps routes aligned to aisles, which reads more like
// a real store map than diagonal shortcuts through shelving.
const NEIGHBORS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
]

/** A* shortest walkable path between two cells. Returns null if unreachable. */
export function findPath(store: Store, start: Cell, goal: Cell): Cell[] | null {
  if (!isWalkable(store, start.x, start.y) || !isWalkable(store, goal.x, goal.y)) {
    return null
  }

  const startK = key(start.x, start.y)
  const goalK = key(goal.x, goal.y)

  const cameFrom = new Map<number, number>()
  const gScore = new Map<number, number>()
  const open = new MinHeap()

  const heuristic = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y)

  gScore.set(startK, 0)
  open.push(startK, heuristic(start.x, start.y))

  while (open.size > 0) {
    const currentK = open.pop()
    if (currentK === goalK) {
      return reconstruct(cameFrom, currentK, startK)
    }

    const cx = currentK % 100000
    const cy = Math.floor(currentK / 100000)
    const currentG = gScore.get(currentK)!

    for (const { dx, dy } of NEIGHBORS) {
      const nx = cx + dx
      const ny = cy + dy
      if (!isWalkable(store, nx, ny)) continue
      const nk = key(nx, ny)
      const tentative = currentG + 1
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, currentK)
        gScore.set(nk, tentative)
        open.push(nk, tentative + heuristic(nx, ny))
      }
    }
  }

  return null
}

function reconstruct(cameFrom: Map<number, number>, current: number, startK: number): Cell[] {
  const path: Cell[] = []
  let k: number | undefined = current
  while (k !== undefined) {
    path.push({ x: k % 100000, y: Math.floor(k / 100000) })
    if (k === startK) break
    k = cameFrom.get(k)
  }
  return path.reverse()
}
