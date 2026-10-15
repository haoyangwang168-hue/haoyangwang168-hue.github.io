export interface GalleryFrame {
  index: number
  left: number
  width: number
  height: number
}

const MIN_SIZE = 0.12
const GROWTH = 0.32
const RATIO = Math.exp(GROWTH)
export const GALLERY_SLOTS = 10

/** Tie each stream item to a physical node until that item has left the visible window. */
export function gallerySlot(progress: number, order: number): number {
  return wrapIndex(Math.floor(-progress) - 1 + order, GALLERY_SLOTS)
}

/** Accumulate wheel bursts, but discard an unfinished destination when direction reverses. */
export function galleryWheelTarget(current: number, target: number, step: number): number {
  if (![current, target, step].every(Number.isFinite)) return Number.isFinite(current) ? current : 0
  const pending = target - current
  const origin = pending * step > 0 ? current : target
  return current + Math.max(-2, Math.min(2, origin - step - current))
}

/** Compensate the container's nonuniform scale so photos keep their native aspect ratio. */
export function galleryImageScale(width: number, height: number, baseWidth: number, baseHeight: number, aspect: number): { x: number; y: number } {
  if (![width, height, baseWidth, baseHeight, aspect].every(Number.isFinite) || Math.min(width, height, baseWidth, baseHeight, aspect) <= 0) return { x: 1, y: 1 }
  const fittedWidth = Math.min(baseWidth, baseHeight * aspect)
  const fittedHeight = fittedWidth / aspect
  const cover = Math.max(width / fittedWidth, height / fittedHeight)
  return { x: cover * baseWidth / width, y: cover * baseHeight / height }
}

/** Normalize mouse and trackpad input into bounded gallery steps. */
export function galleryWheelStep(deltaX: number, deltaY: number, mode: number, width: number, height: number): number {
  if (![deltaX, deltaY, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return 0
  if (mode !== 0 && mode !== 1 && mode !== 2) return 0
  const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? height : 1)
  return Math.max(-1, Math.min(1, pixels / Math.max(80, width * 0.24)))
}

/** Integrate critical damping exactly, preserving velocity across wheel events and frame rates. */
export function advanceGalleryMotion(current: number, target: number, velocity: number, seconds: number, dragging: boolean): { position: number; velocity: number } {
  const position = Number.isFinite(current) ? current : 0
  const speed = Number.isFinite(velocity) ? velocity : 0
  if (!Number.isFinite(target)) return { position, velocity: 0 }
  if (dragging) return { position: target, velocity: 0 }
  if (!Number.isFinite(seconds) || seconds <= 0) return { position, velocity: speed }
  const frequency = 24
  const error = position - target
  const coefficient = speed + frequency * error
  const decay = Math.exp(-frequency * seconds)
  const nextError = (error + coefficient * seconds) * decay
  const nextSpeed = (speed - frequency * coefficient * seconds) * decay
  // A destination changed during motion must not create bounce past the new target.
  if (error === 0 || error * nextError < 0 || (Math.abs(nextError) < 0.0001 && Math.abs(nextSpeed) < 0.002)) return { position: target, velocity: 0 }
  return { position: target + nextError, velocity: nextSpeed }
}

/** Positive modulo keeps the image sequence continuous in either drag direction. */
export function wrapIndex(value: number, count: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(count) || count <= 0) return 0
  return ((Math.floor(value) % count) + count) % count
}

/** Geometric edges make neighbouring images grow together without gaps. */
export function galleryEdge(position: number, width: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(width) || width <= 0) return 0
  return width * MIN_SIZE * Math.expm1(GROWTH * position) / (RATIO - 1)
}

/** Recycle a fixed number of slots; no DOM nodes accumulate during an infinite loop. */
export function galleryFrames(progress: number, width: number, height: number, count: number): GalleryFrame[] {
  if (![progress, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || !Number.isInteger(count) || count <= 0) return []
  // Keep the next left-hand image in a stable slot before it enters the viewport.
  const start = Math.floor(-progress) - 1
  return Array.from({ length: GALLERY_SLOTS }, (_, slot) => {
    const stream = start + slot
    const left = galleryEdge(stream + progress, width)
    const right = galleryEdge(stream + progress + 1, width)
    const frameWidth = right - left
    return { index: wrapIndex(stream, count), left, width: frameWidth, height: Math.min(height, frameWidth * 1.25) }
  })
}
