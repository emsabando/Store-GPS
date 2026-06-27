import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Cell, Pose, Route, Store } from '../types'
import { PositioningEngine, projectOntoRoute, stepIndexForIndex } from '../lib/positioning'
import { METERS_PER_CELL } from '../lib/navigation'
import {
  createHeadingSource,
  createStepDetector,
  requestMotionPermission,
  STRIDE_METERS,
  type Stoppable,
} from '../lib/sensors'

export type PositioningMode = 'autopilot' | 'walk' | 'device'
export type WalkDir = 'up' | 'down' | 'left' | 'right'
export type DeviceStatus = 'idle' | 'active' | 'denied' | 'unsupported'

export interface NavState {
  stepIndex: number
  remainingMeters: number
  arrived: boolean
}

interface Params {
  store: Store
  /** Current route, by ref — App computes it after this hook runs (the route's
   * origin depends on liveCell), so it's read live inside the loop. */
  routeRef: MutableRefObject<Route | null>
  mode: PositioningMode
  active: boolean
  originCell: Cell
}

const AUTO_SPEED = 4.2 // cells/sec (autopilot demo)
const WALK_SPEED = 3.6 // cells/sec (simulated walking)
const ARRIVE_CELLS = 1.3

const KEY_DIR: Record<string, WalkDir> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}

export function usePositioning({ store, routeRef, mode, active, originCell }: Params) {
  const engineRef = useRef<PositioningEngine | null>(null)
  if (engineRef.current === null) engineRef.current = new PositioningEngine(store, originCell)

  // Stable pose object (mutated in place) the canvas can read each frame.
  const poseRef = useRef<Pose>(engineRef.current.pose)
  poseRef.current = engineRef.current.pose

  const [liveCell, setLiveCell] = useState<Cell>(originCell)
  const [nav, setNav] = useState<NavState>({ stepIndex: 0, remainingMeters: 0, arrived: false })
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('idle')

  // Latest values for the animation loop, without restarting it each render.
  const modeRef = useRef(mode)
  modeRef.current = mode
  const activeRef = useRef(active)
  const originRef = useRef(originCell)
  originRef.current = originCell

  const heldRef = useRef<Set<WalkDir>>(new Set())
  const autoProgressRef = useRef(0)
  const lastCellRef = useRef('')
  const lastNavRef = useRef<NavState>({ stepIndex: -1, remainingMeters: -1, arrived: false })
  const sensorsRef = useRef<Stoppable[]>([])

  const stopDevice = useCallback(() => {
    sensorsRef.current.forEach((s) => s.stop())
    sensorsRef.current = []
  }, [])

  // Keep the engine bound to the current store; recenter on store swap.
  useEffect(() => {
    const engine = engineRef.current!
    engine.setStore(store)
    engine.setOrigin(originRef.current)
    autoProgressRef.current = 0
    setLiveCell(originRef.current)
  }, [store])

  // Manual placement ("you are here") updates the start while idle.
  useEffect(() => {
    if (activeRef.current) return
    engineRef.current!.setOrigin(originCell)
    setLiveCell(originCell)
  }, [originCell])

  // Begin / end a navigation session.
  useEffect(() => {
    activeRef.current = active
    if (active) {
      engineRef.current!.setOrigin(originRef.current)
      autoProgressRef.current = 0
      lastNavRef.current = { stepIndex: -1, remainingMeters: -1, arrived: false }
    }
  }, [active])

  // Switching mode mid-trip: keep position, sync autopilot progress to it.
  useEffect(() => {
    if (mode !== 'device') {
      stopDevice()
      setDeviceStatus((s) => (s === 'active' ? 'idle' : s))
    }
    if (activeRef.current && routeRef.current) {
      autoProgressRef.current = projectOntoRoute(
        routeRef.current,
        poseRef.current.x,
        poseRef.current.y,
      ).index
    }
  }, [mode, stopDevice])

  // Keyboard driving for the simulated walk mode.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.code]
      if (!dir || modeRef.current !== 'walk') return
      e.preventDefault()
      heldRef.current.add(dir)
    }
    const up = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.code]
      if (dir) heldRef.current.delete(dir)
    }
    const clear = () => heldRef.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // The animation / integration loop.
  useEffect(() => {
    let raf = 0
    let prev = performance.now()

    const heldVector = () => {
      const h = heldRef.current
      let x = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0)
      let y = (h.has('down') ? 1 : 0) - (h.has('up') ? 1 : 0)
      if (x && y) {
        const inv = 1 / Math.SQRT2
        x *= inv
        y *= inv
      }
      return { x, y }
    }

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const engine = engineRef.current!
      const m = modeRef.current
      const isActive = activeRef.current
      const route = routeRef.current

      if (isActive && route) {
        if (m === 'autopilot') {
          const max = route.cells.length - 1
          autoProgressRef.current = Math.min(max, autoProgressRef.current + AUTO_SPEED * dt)
          const p = autoProgressRef.current
          const i = Math.min(Math.floor(p), route.cells.length - 2)
          const f = p - i
          const a = route.cells[i]
          const b = route.cells[i + 1]
          engine.pose.x = a.x + (b.x - a.x) * f + 0.5
          engine.pose.y = a.y + (b.y - a.y) * f + 0.5
          engine.pose.heading = Math.atan2(b.y - a.y, b.x - a.x)
        } else if (m === 'walk') {
          const v = heldVector()
          if (v.x || v.y) engine.moveBy(v.x * WALK_SPEED * dt, v.y * WALK_SPEED * dt)
        }
        // 'device': pose is driven by sensor callbacks between frames.
      }

      // Publish live cell (for re-routing) only when it changes.
      const cell = engine.snapCell()
      const ck = `${cell.x},${cell.y}`
      if (ck !== lastCellRef.current) {
        lastCellRef.current = ck
        setLiveCell(cell)
      }

      // Publish nav readout only on meaningful change.
      if (route) {
        let stepIndex: number
        let remainingMeters: number
        let arrived: boolean
        if (m === 'autopilot') {
          const max = route.cells.length - 1
          arrived = isActive && autoProgressRef.current >= max
          stepIndex = arrived ? route.steps.length - 1 : stepIndexForIndex(route, autoProgressRef.current)
          remainingMeters = Math.round((max - autoProgressRef.current) * METERS_PER_CELL)
        } else {
          const proj = projectOntoRoute(route, engine.pose.x, engine.pose.y)
          arrived = isActive && proj.remainingCells <= ARRIVE_CELLS
          stepIndex = arrived ? route.steps.length - 1 : stepIndexForIndex(route, proj.index)
          remainingMeters = Math.round(proj.remainingCells * METERS_PER_CELL)
        }
        const last = lastNavRef.current
        if (
          stepIndex !== last.stepIndex ||
          remainingMeters !== last.remainingMeters ||
          arrived !== last.arrived
        ) {
          lastNavRef.current = { stepIndex, remainingMeters, arrived }
          setNav({ stepIndex, remainingMeters, arrived })
        }
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => () => stopDevice(), [stopDevice])

  const recenter = useCallback((cell: Cell) => {
    engineRef.current!.setOrigin(cell)
    autoProgressRef.current = 0
    lastCellRef.current = `${cell.x},${cell.y}`
    setLiveCell(cell)
  }, [])

  const setHeld = useCallback((dir: WalkDir, pressed: boolean) => {
    if (pressed) heldRef.current.add(dir)
    else heldRef.current.delete(dir)
  }, [])

  const startDevice = useCallback(async () => {
    const perm = await requestMotionPermission()
    if (perm !== 'granted') {
      setDeviceStatus(perm === 'unsupported' ? 'unsupported' : 'denied')
      return
    }
    stopDevice()
    sensorsRef.current = [
      createStepDetector(() => engineRef.current!.stride(STRIDE_METERS)),
      createHeadingSource((rad) => engineRef.current!.setHeading(rad)),
    ]
    setDeviceStatus('active')
  }, [stopDevice])

  return { poseRef, liveCell, nav, deviceStatus, recenter, setHeld, startDevice }
}
