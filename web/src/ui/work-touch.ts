import { workCardStop } from './portrait-math.ts'

/** Snap after native momentum; a swipe that passes a reading stop never returns to it. */
export function workTouchSnap(start: number, current: number, delta: number, height: number, count: number, lastDirection = 0): number {
  const clamp = (value: number): number => Math.max(0, Math.min(1, value))
  if (![start, current, delta, height, count].every(Number.isFinite) || height <= 0 || count < 1 || !Number.isInteger(count)) return Number.isFinite(current) ? clamp(current) : 0
  const stops = [0, 0.12, ...Array.from({ length: count }, (_, index) => workCardStop(index, count) + 0.015), 1]
  const origin = clamp(start)
  const position = clamp(current)
  const displacementDirection = Math.sign(position - origin)
  const direction = (Number.isFinite(lastDirection) ? Math.sign(lastDirection) : 0) || displacementDirection || Math.sign(delta)
  const nearest = (): number => stops.reduce((best, stop) => Math.abs(stop - position) < Math.abs(best - position) ? stop : best)
  if (direction === 0) return nearest()
  const adjacent = direction > 0
    ? stops.find(stop => stop > origin + 0.02) ?? 1
    : [...stops].reverse().find(stop => stop < origin - 0.02) ?? 0
  const passedAdjacent = direction > 0 ? position > adjacent + 0.000001 : position < adjacent - 0.000001
  // A reversal can finish ahead of the gesture's origin; follow its final motion locally.
  const reversed = displacementDirection !== 0 && displacementDirection !== direction
  if (passedAdjacent || reversed) {
    return direction > 0
      ? stops.find(stop => stop >= position - 0.000001) ?? 1
      : [...stops].reverse().find(stop => stop <= position + 0.000001) ?? 0
  }
  if (Math.abs(delta) < Math.min(110, height * 0.25)) return nearest()
  return adjacent
}
