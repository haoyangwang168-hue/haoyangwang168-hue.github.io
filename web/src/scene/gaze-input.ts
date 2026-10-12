/** Normalize a hover pointer independently of responsive layout width. */
export function gazeInput(
  pointerType: string,
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (pointerType !== 'mouse' && pointerType !== 'pen') return null
  if (![clientX, clientY, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
  return {
    x: Math.max(-1, Math.min(1, clientX / width * 2 - 1)),
    y: Math.max(-1, Math.min(1, 1 - clientY / height * 2)),
  }
}
