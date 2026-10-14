/** Complete the echoes early and give the letter most of the native scroll range. */
export function footerPose(progress: number, layer = 0): { scale: number; y: number; morph: number } {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  const index = Number.isFinite(layer) ? Math.max(0, Math.min(5, layer)) : 0
  const cascade = Math.min(p / 0.3, 1)
  const morphProgress = Math.max(0, (p - 0.35) / (1 - 0.35))
  // Smoothstep has zero velocity at both ends of the letter-to-button phase.
  const morph = morphProgress * morphProgress * (3 - 2 * morphProgress)
  return { scale: 1 - index * 0.075 * cascade, y: index * 5 * cascade, morph }
}
