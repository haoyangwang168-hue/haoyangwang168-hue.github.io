/** Return a recycled card position without accumulating DOM nodes. */
export function portraitPosition(index: number, offset: number, stride: number, count: number): number {
  if (![index, offset, stride, count].every(Number.isFinite) || stride <= 0 || count <= 0) return 0
  const cycle = stride * count
  return ((index * stride + offset + stride) % cycle + cycle) % cycle - stride
}

/** Integrate exponential drag exactly so release distance is independent of frame rate. */
export function portraitInertia(velocity: number, seconds: number): { distance: number; velocity: number } {
  if (!Number.isFinite(velocity) || !Number.isFinite(seconds) || seconds <= 0) return { distance: 0, velocity: Number.isFinite(velocity) ? velocity : 0 }
  const decay = Math.exp(-8 * seconds)
  return { distance: velocity * (1 - decay) / 8, velocity: velocity * decay }
}

/** Keep the reference drift inside each photo's overscan without cropping the face. */
export function portraitParallax(center: number, viewport: number, width: number, scale = 1.32): number {
  if (![center, viewport, width, scale].every(Number.isFinite) || viewport <= 0 || width <= 0 || scale < 1) return 0
  const limit = width * (scale - 1) * 0.45
  // Smooth saturation keeps pictures moving near the edges without exposing blank space.
  return limit > 0 ? limit * Math.tanh((center - viewport / 2) * 0.16 / limit) : 0
}

/** Match the reference sequence: enter, reveal the fan, then dismiss cards in order. */
export function workCardPose(progress: number, index: number, count: number, mobile = false): { y: number; rotate: number; rotateY: number; opacity: number; active: boolean; clickable: boolean } {
  const clamp = (value: number): number => Math.max(0, Math.min(1, value))
  const p = clamp(Number.isFinite(progress) ? progress : 0)
  if (count <= 0 || index < 0 || index >= count) return { y: 0, rotate: 0, rotateY: 0, opacity: 0, active: false, clickable: false }
  const enter = clamp(p / 0.12)
  const flip = clamp((p - 0.12) / 0.13)
  const reveal = flip * flip * (3 - 2 * flip)
  // Keep the stack aligned through most of the turn, then ease its edges apart.
  const fan = clamp((p - 0.22) / 0.08)
  const spread = fan * fan * (3 - 2 * fan)
  const local = (p - 0.3) / 0.65 * count - index
  // Touch scrolling gets a longer reading interval before the card starts leaving.
  const hold = mobile ? 0.35 : 0.12
  const departure = clamp((local - hold) / (1 - hold))
  // Let the next card rise into its reading position while its predecessor leaves.
  const arrival = clamp((local + 0.5) / 0.5)
  const approach = index > 0 ? (1 - arrival * arrival * (3 - 2 * arrival)) * spread : 0
  const angles = [0, -8, 7, -12]
  const activeIndex = Math.min(count - 1, Math.max(0, Math.floor((p - 0.3) / 0.65 * count)))
  return {
    y: (1 - enter) * 65 + index * 2 * spread + approach * 18 - departure * 230,
    rotate: (angles[index % angles.length] + (index === 0 ? 4 : 0)) * spread + approach * (index % 2 ? -3 : 3) + departure * (index % 2 ? 24 : -24),
    rotateY: reveal * 180,
    // Translucent parents flatten the 3D faces; reveal cards by moving them instead.
    opacity: departure >= 1 ? 0 : 1,
    active: index === activeIndex && departure < 1,
    // The next card is exposed before its reading stop; let the visible surface receive clicks.
    clickable: departure < 1 && (index === 0 || reveal >= 0.5),
  }
}

/** Land navigation on the readable portion of each revealed card. */
export function workCardStop(index: number, count: number): number {
  return count > 0 ? 0.3 + 0.65 * Math.max(0, Math.min(count - 1, index)) / count : 0
}

/** Project the phone flip onto a flat surface without a nested 3D rendering context. */
export function workCardFlipScale(angle: number): number {
  const rotation = Number.isFinite(angle) ? Math.max(0, Math.min(180, angle)) : 0
  return Math.abs(Math.cos(rotation * Math.PI / 180))
}
