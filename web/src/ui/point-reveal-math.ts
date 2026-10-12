export type Point = { x: number; y: number }
export type Rect = { left: number; top: number; width: number; height: number }
/** Departure angle in degrees and the fan's reach in viewport pixels. */
export type FanFlight = { angle: number; radius: number }
export type PointRevealTransform = {
  x: number
  y: number
  scale: number
  rotate: number
  opacity: number
}

/**
 * Reveal an element along a curved fan path from a shared viewport point.
 * Negative departure angles travel left/up; positive angles travel left/down.
 * Apply translate, rotate, then scale with transform-origin: center center.
 */
export function pointRevealTransform(
  rest: Rect,
  origin: Point,
  progress: number,
  fan: FanFlight = { angle: 0, radius: 0 },
): PointRevealTransform {
  const hidden: PointRevealTransform = { x: 0, y: 0, scale: 0, rotate: 0, opacity: 0 }
  if (
    ![rest.left, rest.top, rest.width, rest.height, origin.x, origin.y, fan.angle, fan.radius].every(Number.isFinite)
    || rest.width <= 0
    || rest.height <= 0
    || fan.radius < 0
  ) return hidden

  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const eased = p * p * (3 - 2 * p)
  const remaining = 1 - eased
  const centerX = rest.left + rest.width / 2
  const centerY = rest.top + rest.height / 2
  const offsetX = origin.x - centerX
  const offsetY = origin.y - centerY
  if (![offsetX, offsetY].every(Number.isFinite)) return hidden

  const angle = Math.min(70, Math.max(-70, fan.angle))
  const radians = angle * Math.PI / 180
  const flightX = -Math.cos(radians) * fan.radius
  const flightY = Math.sin(radians) * fan.radius
  const control1 = { x: origin.x + flightX, y: origin.y + flightY }
  const control2 = { x: origin.x + flightX * 1.1, y: origin.y + flightY * 1.1 }
  if (![control1.x, control1.y, control2.x, control2.y].every(Number.isFinite)) return hidden

  // Exact endpoints keep every element on the same point and restore identity.
  if (p === 0) return { x: offsetX, y: offsetY, scale: 0, rotate: angle === 0 ? 0 : -angle * 0.72, opacity: 0 }
  if (p === 1) return { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }

  const originWeight = remaining ** 3
  const control1Weight = 3 * remaining ** 2 * eased
  const control2Weight = 3 * remaining * eased ** 2
  const destinationWeight = eased ** 3
  const x = originWeight * origin.x + control1Weight * control1.x + control2Weight * control2.x + destinationWeight * centerX - centerX
  const y = originWeight * origin.y + control1Weight * control1.y + control2Weight * control2.y + destinationWeight * centerY - centerY
  if (![x, y].every(Number.isFinite)) return hidden

  return {
    x,
    y,
    scale: eased,
    rotate: angle === 0 ? 0 : -angle * 0.72 * remaining,
    opacity: Math.min(1, p * 8),
  }
}

/** Return a top: 0 sticky stage's viewport top, including its container exit. */
export function pinnedViewportTop(
  documentTop: number,
  stageHeight: number,
  containerHeight: number,
  scrollY: number,
): number {
  if (
    ![documentTop, stageHeight, containerHeight, scrollY].every(Number.isFinite)
    || stageHeight <= 0
    || containerHeight <= 0
  ) return 0

  const top = documentTop - scrollY
  const bottomLimit = top + containerHeight - stageHeight
  if (![top, bottomLimit].every(Number.isFinite)) return 0
  return Math.min(Math.max(top, 0), bottomLimit)
}
