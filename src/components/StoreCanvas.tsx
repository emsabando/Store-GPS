import { useEffect, useRef, type MutableRefObject } from 'react'
import type { Cell, Pose, Product, Route, Store } from '../types'
import { projectOntoRoute } from '../lib/positioning'

export type ViewMode = 'overview' | 'navigate'

interface Props {
  store: Store
  route: Route | null
  target: Product | null
  /** Live user pose, mutated in place by the positioning layer. */
  poseRef: MutableRefObject<Pose>
  mode: ViewMode
  onPickCell?: (cell: Cell) => void
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const TILE_COLORS: Record<string, string> = {
  floor: '#111a2e',
  wall: '#1f2a44',
  shelf: '#2a3650',
  entrance: '#1d4ed8',
  checkout: '#334155',
}

export default function StoreCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0

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
      const p = propsRef.current
      const rect = canvas.getBoundingClientRect()
      const pose = p.poseRef.current
      const progress = p.route ? projectOntoRoute(p.route, pose.x, pose.y).index : 0
      render(ctx, rect.width, rect.height, p, pose, progress, now)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

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
  pose: Pose,
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
    ctx.rotate(-Math.PI / 2 - pose.heading) // heading points "up"
    ctx.translate(-pose.x * s, -pose.y * s)
    ctx.scale(s, s)
  } else {
    const { s, tx, ty } = overviewLayout(w, h, store)
    ctx.translate(tx, ty)
    ctx.scale(s, s)
  }

  drawTiles(ctx, store)
  drawDepartments(ctx, store)
  drawProductDots(ctx, store)
  if (p.route) drawRoute(ctx, p.route, progress, now)
  if (p.target) drawTargetPin(ctx, p.target, now)
  drawAvatar(ctx, pose.x, pose.y, pose.heading)

  ctx.restore()

  if (p.mode === 'navigate') drawCompass(ctx, w, pose.heading)
}

function drawTiles(ctx: CanvasRenderingContext2D, store: Store) {
  for (let y = 0; y < store.rows; y++) {
    for (let x = 0; x < store.cols; x++) {
      const kind = store.tiles[y][x]
      if (kind === 'floor') continue
      ctx.fillStyle = TILE_COLORS[kind]
      ctx.fillRect(x, y, 1, 1)
    }
  }
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

function drawDepartments(ctx: CanvasRenderingContext2D, store: Store) {
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
    ctx.fillStyle = dept.color
    ctx.fillText(dept.label, dept.center.x, dept.center.y)
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

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(56,120,255,0.28)'
  ctx.lineWidth = 0.5
  trace(ctx, pts)
  ctx.stroke()

  const i = Math.min(Math.floor(progress), pts.length - 1)
  const frac = progress - i
  const head =
    i < pts.length - 1 ? { x: lerp(pts[i].x, pts[i + 1].x, frac), y: lerp(pts[i].y, pts[i + 1].y, frac) } : pts[i]
  const remaining = [head, ...pts.slice(i + 1)]

  ctx.save()
  ctx.shadowColor = 'rgba(56,140,255,0.9)'
  ctx.shadowBlur = 8
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 0.4
  trace(ctx, remaining)
  ctx.stroke()

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

  ctx.beginPath()
  ctx.arc(0, 0, 0.9, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(56,189,248,0.18)'
  ctx.fill()

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
  ctx.fillText('N', cx, cy - 12)
}
