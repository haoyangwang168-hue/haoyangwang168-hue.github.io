/** All opening timings are milliseconds; convert only at the motion component boundary. */
export const OPENING_TIMING = {
  nameDelay: 180,
  nameDuration: 800,
  nameStagger: 35,
  swapAt: 1850,
  nameExitDuration: 450,
  nameExitStagger: 20,
  monogramDelay: 650,
  monogramDuration: 650,
  monogramStagger: 90,
  minimum: 3600,
} as const

export type OpeningExitMode = 'auto' | 'skip'

interface OpeningExit {
  delay: number
  duration: number
  completeAfter: number
}

/** Keep a short completion margin after the masks clear; background tabs use the same deadline. */
export function getOpeningExit(mode: OpeningExitMode, reduced: boolean): OpeningExit {
  if (reduced) return { delay: 0, duration: 0, completeAfter: 0 }
  return mode === 'skip'
    ? { delay: 0, duration: 600, completeAfter: 650 }
    : { delay: 350, duration: 1000, completeAfter: 1400 }
}

/** Match the asset manager's completed/cached state, while allowing the scene fallback to enter. */
export function openingAssetsReady(active: boolean, progress: number, total: number, sceneFailed: boolean): boolean {
  return sceneFailed || (!active && ((Number.isFinite(progress) && progress >= 100) || (Number.isFinite(total) && total > 0)))
}
