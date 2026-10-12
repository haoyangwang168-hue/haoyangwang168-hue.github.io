/** Track travel becomes local card progress, independent of its animated children. */
export function horizontalProgress(
  offsetLeft: number,
  width: number,
  viewport: number,
  trackX: number,
): number {
  if (![offsetLeft, width, viewport, trackX].every(Number.isFinite) || width <= 0 || viewport <= 0) return 0
  return Math.min(1, Math.max(0, (viewport - offsetLeft - trackX) / (viewport + width)))
}
