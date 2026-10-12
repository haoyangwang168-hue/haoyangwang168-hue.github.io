/** Keep facial pulls small enough to preserve the original silhouette. */
export function facePull(distance: number, viewport: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(viewport) || viewport <= 0) return 0
  return Math.max(-0.045, Math.min(0.045, distance / viewport * 0.9))
}

/** Exponential recovery has the same duration at different refresh rates. */
export function recoverFace(current: number, target: number, seconds: number, held: boolean): number {
  if (![current, target, seconds].every(Number.isFinite)) return 0
  if (seconds <= 0) return current
  const next = target + (current - target) * Math.exp(-seconds / (held ? 0.045 : 0.34))
  return Math.abs(next - target) < 0.0001 ? target : next
}

/** Only cheeks are interactive; exclude the forehead, eyes, nose, lips and chin. */
export function faceRegion(x: number, y: number, z: number): 'cheek' | null {
  if (![x, y, z].every(Number.isFinite) || z < 0.28 || Math.abs(x) > 0.34) return null
  if (Math.abs(x) > 0.15 && y > -0.23 && y < 0.035) return 'cheek'
  return null
}
