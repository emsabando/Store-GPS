import { useEffect, useRef } from 'react'
import type { Cell, Product, Route, Store } from '../types'
import { METERS_PER_CELL } from '../lib/navigation'

export type ViewMode = 'overview' | 'navigate'

interface Props {
  store: Store
  route: Route | null
  target: Product | null
  userCell: Cell
  mode: ViewMode
  /** True while the avatar should animate along the route. */
  playing: boolean
  onPickCell?: (cell: Cell) => void
  /** Fires when the active turn-by-turn step changes (throttled, not per-frame). */
  onProgress?: (stepIndex: number, remainingMeters: number) => void
  onArrive?: () => void
}

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Indices in route.cells where a new straight segment begins. Used to map the
// avatar's continuous progress back to a discrete turn-by-turn step.
function segmentStarts(cells: Cell[]): number[] {
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

const SPEED_CELLS_PER_SEC = 4.2
const TILE_COLORS: Record<string, string> = {
  floor: '#111a2e',
  wall: '#1f2a44',
  shelf: '#2a3650',
  entrance: '#1d4ed8',
  checkout: '#334155',
}

export default function StoreCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Latest props, read inside the rAF loop without restarting it every render.
  const propsRef = useRef(props)
  propsRef.current = props

  const progressRef = useRef(0) // float index along route.cells
  const lastRouteRef = useRef<Route | null>(null)
  const lastStepRef = useRef(-1)
  const arrivedRef = useRef(false)

  // Reset animation whenever the route changes.
  useEffect(() => {
    progressRef.current = 0
    lastStepRef.current = -1
    arrivedRef.current = false
    lastRouteRef.current = props.route
  }, [props.route])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let prevT = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prevT) / 1000)
      prevT = now
      const p = propsRef.current
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      // Advance the avatar.
      const route = p.route
      const maxProgress = route ? route.cells.length - 1 : 0
      if (p.playing && route && progressRef.current < maxProgress) {
        progressRef.current = Math.min(maxProgress, progressRef.current + SPEED_CELLS_PER_SEC * dt)
      }
      const progress = progressRef.current

      // Avatar world position + heading.
      let ax: number
      let ay: number
      let heading: number
      if (route && route.cells.length > 1) {
        const i = Math.min(Math.floor(progress), route.cells.length - 2)
        const frac = progress - i
        const a = route.cells[i]
        const b = route.cells[i + 1]
        ax = lerp(a.x, b.x, frac) + 0.5
        ay = lerp(a.y, b.y, frac) + 0.5
        heading = Math.atan2(b.y - a.y, b.x - a.x)
      } else {
        ax = p.userCell.x + 0.5
        ay = p.userCell.y + 0.5
        heading = -Math.PI / 2
      }

      // Emit step changes + arrival.
      if (route && p.onProgress) {
        const starts = segmentStarts(route.cells)
        let step = 0
        for (let k = 0; k < starts.length; k++) if (progress >= starts[k]) step = k
        if (progress >= maxProgress) step = route.steps.length - 1
        if (step !== lastStepRef.current) {
          lastStepRef.current = step
          const remaining = Math.round((maxProgress - progress) * METERS_PER_CELL)
          p.onProgress(step, remaining)
        }
      }
      if (route && p.playing && progress >= maxProgress && !arrivedRef.current) {
        arrivedRef.current = true
        p.onArrive?.()
      }

      render(ctx, w, h, p, ax, ay, heading, progress, now)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Click-to-set "you are here" (overview only).
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = propsRef.current
    if (p.mode !== 'overview' || !p.onPickCell) return
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const layout = overviewLayout(rect.width, rect.height, p.store)
    const cellX = Math.floor((e.clientX - rect.left - layout.tx) / layout.s)
    const cellY = Math.floor((e.clientY - rect.top - layout.ty) / layout.s)
    if (cellX >= 0 && cellY >= 0 && cellX < p.store.cols && cellY < p.store.rows) {
      p.onPickCell({ x: cellX, y: cellY })
    }
  }

  return <canvas ref={canvasRef} className="store-canvas" onClick={handleClick} />
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function overviewLayout(w: number, h: number, store: Store) {
  const s = Math.min(w / store.cols, h / store.rows) * 0.96
  const tx = (w - store.cols * s) / 2
  const ty = (h - store.rows * s) / 2
  return { s, tx, ty }
}

function render(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: Props,
  ax: number,
  ay: number,
  heading: number,
  progress: number,
  now: number,
) {
  const { store } = p
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  if (p.mode === 'navigate') {
    const visibleCells = 15
    const s = h / visibleCells
    ctx.translate(w / 2, h * 0.74)
    ctx.rotate(-Math.PI / 2 - heading) // heading points "up"
    ctx.translate(-ax * s, -ay * s)
    ctx.scale(s, s)
  } else {
    const { s, tx, ty } = overviewLayout(w, h, store)
    ctx.translate(tx, ty)
    ctx.scale(s, s)
  }

  drawTiles(ctx, store)
  drawDepartments(ctx, store, p.mode)
  drawProductDots(ctx, store)
  if (p.route) drawRoute(ctx, p.route, progress, now)
  if (p.target) drawTargetPin(ctx, p.target, now)
  drawAvatar(ctx, ax, ay, heading)

  ctx.restore()

  if (p.mode === 'navigate') drawCompass(ctx, w, heading)
}

function drawTiles(ctx: CanvasRenderingContext2D, store: Store) {
  for (let y = 0; y < store.rows; y++) {
    for (let x = 0; x < store.cols; x++) {
      const kind = store.tiles[y][x]
      if (kind === 'floor') continue // background already covers floor
      ctx.fillStyle = TILE_COLORS[kind]
      ctx.fillRect(x, y, 1, 1)
    }
  }
  // Subtle floor grid for a "blueprint" feel.
  ctx.strokeStyle = 'rgba(120,150,210,0.06)'
  ctx.lineWidth = 0.03
  ctx.beginPath()
  for (let x = 0; x <= store.cols; x++) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, store.rows)
  }
  for (let y = 0; y <= store.rows; y++) {
    ctx.moveTo(0, y)
    ctx.lineTo(store.cols, y)
  }
  ctx.stroke()
}

function drawDepartments(ctx: CanvasRenderingContext2D, store: Store, mode: ViewMode) {
  // Tint each shelving block with its department color.
  for (const dept of store.departments) {
    ctx.fillStyle = dept.color
    ctx.globalAlpha = 0.18
    const bx = Math.round(dept.center.x - 0.5)
    for (let y = 0; y < store.rows; y++) {
      if (store.tiles[y][bx] === 'shelf') ctx.fillRect(bx, y, 2, 1)
    }
    ctx.globalAlpha = 1
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '0.9px system-ui, sans-serif'
  for (const dept of store.departments) {
    ctx.save()
    ctx.translate(dept.center.x, dept.center.y)
    if (mode === 'navigate') ctx.scale(1, 1) // labels stay readable enough
    ctx.fillStyle = dept.color
    ctx.fillText(dept.label, 0, 0)
    ctx.restore()
  }
}

function drawProductDots(ctx: CanvasRenderingContext2D, store: Store) {
  for (const product of store.products) {
    ctx.beginPath()
    ctx.arc(product.shelf.x + 0.5, product.shelf.y + 0.5, 0.16, 0, Math.PI * 2)
    ctx.fillStyle = product.availability === 'out' ? 'rgba(120,130,150,0.4)' : 'rgba(186,210,255,0.55)'
    ctx.fill()
  }
}

function drawRoute(ctx: CanvasRenderingContext2D, route: Route, progress: number, now: number) {
  if (route.cells.length < 2) return
  const pts = route.cells.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }))

  // Full route: faint base line.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(56,120,255,0.28)'
  ctx.lineWidth = 0.5
  trace(ctx, pts)
  ctx.stroke()

  // Remaining route from the avatar onward: bright glowing blue.
  const i = Math.min(Math.floor(progress), pts.length - 1)
  const frac = progress - i
  const head = i < pts.length - 1 ? { x: lerp(pts[i].x, pts[i + 1].x, frac), y: lerp(pts[i].y, pts[i + 1].y, frac) } : pts[i]
  const remaining = [head, ...pts.slice(i + 1)]

  ctx.save()
  ctx.shadowColor = 'rgba(56,140,255,0.9)'
  ctx.shadowBlur = 8
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 0.4
  trace(ctx, remaining)
  ctx.stroke()

  // Animated flow dashes drifting toward the destination.
  ctx.strokeStyle = 'rgba(180,220,255,0.9)'
  ctx.lineWidth = 0.16
  ctx.setLineDash([0.5, 1.0])
  ctx.lineDashOffset = -((now / 280) % 1.5)
  trace(ctx, remaining)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

function trace(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y)
}

function drawTargetPin(ctx: CanvasRenderingContext2D, target: Product, now: number) {
  const cx = target.shelf.x + 0.5
  const cy = target.shelf.y + 0.5
  const pulse = 0.5 + 0.5 * Math.sin(now / 350)

  ctx.beginPath()
  ctx.arc(cx, cy, 0.8 + pulse * 0.6, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(244,114,182,${0.18 * (1 - pulse)})`
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, 0.45, 0, Math.PI * 2)
  ctx.fillStyle = '#f472b6'
  ctx.fill()
  ctx.lineWidth = 0.12
  ctx.strokeStyle = '#fff'
  ctx.stroke()
}

function drawAvatar(ctx: CanvasRenderingContext2D, ax: number, ay: number, heading: number) {
  ctx.save()
  ctx.translate(ax, ay)
  ctx.rotate(heading)

  // Accuracy halo.
  ctx.beginPath()
  ctx.arc(0, 0, 0.9, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(56,189,248,0.18)'
  ctx.fill()

  // Direction chevron.
  ctx.beginPath()
  ctx.moveTo(0.7, 0)
  ctx.lineTo(-0.45, 0.5)
  ctx.lineTo(-0.2, 0)
  ctx.lineTo(-0.45, -0.5)
  ctx.closePath()
  ctx.fillStyle = '#38bdf8'
  ctx.fill()
  ctx.lineWidth = 0.1
  ctx.strokeStyle = '#e0f2fe'
  ctx.stroke()
  ctx.restore()
}

function drawCompass(ctx: CanvasRenderingContext2D, w: number, heading: number) {
  // Small north indicator that counter-rotates with the map.
  const cx = w - 36
  const cy = 36
  const angle = -Math.PI / 2 - heading
  ctx.save()
  ctx.translate(cx, cy)
  ctx.beginPath()
  ctx.arc(0, 0, 18, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(15,23,42,0.8)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(148,163,184,0.5)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.lineTo(5, 4)
  ctx.lineTo(0, 0)
  ctx.lineTo(-5, 4)
  ctx.closePath()
  ctx.fillStyle = '#ef4444'
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('N', cx + Math.cos(angle - Math.PI / 2) * 0, cy - 12)
}
