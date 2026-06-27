// Device motion sources for dead-reckoning: a step detector (accelerometer) and
// a heading source (compass). Both degrade gracefully when the browser/device
// lacks the sensors, so the app can fall back to the simulated "Walk" mode.

export type SensorPermission = 'granted' | 'denied' | 'unsupported'

interface IOSDeviceMotion {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/**
 * iOS 13+ requires an explicit user-gesture permission request for motion +
 * orientation. Other browsers expose the events without prompting.
 */
export async function requestMotionPermission(): Promise<SensorPermission> {
  if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') {
    return 'unsupported'
  }
  const dm = window.DeviceMotionEvent as unknown as IOSDeviceMotion
  if (typeof dm.requestPermission === 'function') {
    try {
      const res = await dm.requestPermission()
      return res === 'granted' ? 'granted' : 'denied'
    } catch {
      return 'denied'
    }
  }
  return 'granted'
}

export interface Stoppable {
  stop: () => void
}

/**
 * Peak-detection step counter over total acceleration. A slow-moving baseline
 * tracks gravity; a step is the upward crossing of a threshold on the
 * gravity-removed signal, rate-limited so one footfall counts once.
 */
export function createStepDetector(onStep: () => void): Stoppable {
  let baseline = 9.81
  let armed = true
  let lastStepAt = 0
  const THRESHOLD = 1.15 // m/s^2 above baseline
  const MIN_INTERVAL = 280 // ms between steps (~3.5 steps/sec max)

  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity
    if (!a || a.x == null || a.y == null || a.z == null) return
    const mag = Math.hypot(a.x, a.y, a.z)
    baseline = baseline * 0.9 + mag * 0.1
    const dynamic = mag - baseline
    const now = e.timeStamp || performance.now()

    if (armed && dynamic > THRESHOLD && now - lastStepAt > MIN_INTERVAL) {
      armed = false
      lastStepAt = now
      onStep()
    } else if (dynamic < THRESHOLD * 0.4) {
      armed = true // reset for the next footfall
    }
  }

  window.addEventListener('devicemotion', handler)
  return { stop: () => window.removeEventListener('devicemotion', handler) }
}

/**
 * Compass heading in grid radians (-PI/2 = map-up = geographic north), with an
 * optional calibration offset so the user can align "north" to the store's
 * orientation. Prefers iOS's true-north webkitCompassHeading; falls back to the
 * standard `alpha` angle.
 */
export function createHeadingSource(onHeading: (rad: number) => void, offset = 0): Stoppable {
  const handler = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
    let deg: number | null = null
    if (typeof e.webkitCompassHeading === 'number') {
      deg = e.webkitCompassHeading // already clockwise from true north
    } else if (typeof e.alpha === 'number') {
      deg = 360 - e.alpha // alpha is counter-clockwise; flip to compass sense
    }
    if (deg == null) return
    // 0deg (north) -> map-up (-PI/2); 90deg (east) -> +x (0).
    onHeading((deg * Math.PI) / 180 - Math.PI / 2 + offset)
  }
  window.addEventListener('deviceorientation', handler, true)
  return { stop: () => window.removeEventListener('deviceorientation', handler, true) }
}

export const STRIDE_METERS = 0.72 // average adult step length
