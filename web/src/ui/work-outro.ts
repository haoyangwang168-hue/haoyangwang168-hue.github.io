/** Keep a one-viewport invitation hold; touch layouts give cards triple scroll travel. */
export function workTimeline(count: number, mobile = false): { heightVh: number; cardFraction: number } {
  const sections = Number.isFinite(count) ? Math.max(0, count) : 0
  const cardTravelVh = ((sections + 2) * 65 - 100) * (mobile ? 3 : 1)
  const holdVh = 100
  return { heightVh: cardTravelVh + holdVh + 100, cardFraction: cardTravelVh / (cardTravelVh + holdVh) }
}

/** Overlap the final card departure, then dissolve into the contact section. */
export function workOutroPose(progress: number, exitProgress: number, line = 0): { opacity: number; y: number; rotate: number; blur: number; lineScale: number } {
  const clamp = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const ease = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t) }
  const index = Math.max(0, Math.min(1, Number.isFinite(line) ? line : 0))
  const enter = ease((clamp(progress) - 0.855 - index * 0.025) / 0.1)
  const exit = ease((clamp(exitProgress) - index * 0.045) / 0.5)
  return { opacity: enter * (1 - exit), y: (1 - enter) * 100 - exit * (90 + index * 25), rotate: (1 - enter) * 5 - exit * 4, blur: (1 - enter) * 8 + exit * 6, lineScale: enter * (1 - exit) }
}
