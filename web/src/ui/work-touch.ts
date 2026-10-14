interface TouchStop { progress: number; distance: number }

/** Express the original flip poses in finger travel instead of document height. */
function touchStops(count: number, height: number): TouchStop[] {
  const stops: TouchStop[] = [
    { progress: 0, distance: 0 },
    { progress: 0.12, distance: height * 0.65 },
    { progress: 0.25, distance: height * 1.65 },
    { progress: 0.3, distance: height * 1.9 },
  ]
  let distance = height * 1.9
  for (let index = 0; index < count; index++) {
    // Keep a short reading pause; departing cards then track finger travel 1:1.
    distance += 24
    stops.push({ progress: 0.3 + 0.65 * (index + 0.35) / count, distance })
    distance += height * 2.3
    stops.push({ progress: 0.3 + 0.65 * (index + 1) / count, distance })
  }
  stops.push({ progress: 1, distance: distance + height * 0.3 })
  return stops
}

function interpolate(value: number, stops: TouchStop[], from: keyof TouchStop, to: keyof TouchStop): number {
  for (let index = 1; index < stops.length; index++) {
    const end = stops[index]
    const start = stops[index - 1]
    if (value <= end[from]) return start[to] + (end[to] - start[to]) * (value - start[from]) / (end[from] - start[from])
  }
  return stops[stops.length - 1][to]
}

/** Reversible drag mapping, with normal page travel outside the pinned gallery. */
export function workTouchScroll(startScroll: number, delta: number, galleryTop: number, range: number, count: number, cardHeight: number): number {
  if (![startScroll, delta, galleryTop, range, count, cardHeight].every(Number.isFinite) || range <= 0 || count < 1 || !Number.isInteger(count) || cardHeight <= 0) return Number.isFinite(startScroll) ? startScroll : 0
  const stops = touchStops(count, cardHeight)
  const endDistance = stops[stops.length - 1].distance
  const relative = startScroll - galleryTop
  const distance = relative < 0 ? relative : relative > range ? endDistance + relative - range : interpolate(relative / range, stops, 'progress', 'distance')
  const next = distance + delta
  if (next < 0) return galleryTop + next
  if (next > endDistance) return galleryTop + range + next - endDistance
  return galleryTop + range * interpolate(next, stops, 'distance', 'progress')
}
