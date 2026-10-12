export interface PaperBand { top: number; height: number }

/** Keep every noisy pixel between the outgoing copy and the incoming work labels. */
export function worksPaperBand(progress: number, viewport: number, previousBottom: number, incomingTop: number): PaperBand {
  if (![progress, viewport, previousBottom, incomingTop].every(Number.isFinite) || viewport <= 0) return { top: 0, height: 1 }
  const p = Math.max(0, Math.min(1, progress))
  const clearance = Math.min(24, viewport * 0.035)
  const first = previousBottom + clearance
  const last = incomingTop - clearance
  const ease = (value: number): number => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }
  // Grow and close the tear continuously instead of removing a full-width band at 0/1.
  const envelope = ease(p / 0.14) * ease((1 - p) / 0.14)
  const height = Math.max(1, Math.min(280, viewport * 0.34, last - first) * envelope)
  // A faster background edge creates depth, while the measured text bounds take priority.
  const desired = viewport * Math.pow(1 - p, 1.25) - height * p
  const top = Math.max(first, Math.min(last - height, desired))
  return { top, height }
}

/** Distinct layer speeds preserve the measured chapter and card navigation anchors. */
export function worksPageParallax(progress: number, compact = false, reduced = false): { outgoingY: number; incomingY: number; deckY: number } {
  if (reduced) return { outgoingY: 0, incomingY: 0, deckY: 0 }
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0))
  const strength = compact ? 0.6 : 1
  return { outgoingY: -140 * p * strength, incomingY: 48 * (p - 1) * strength, deckY: 36 * (p - 1) * strength }
}
