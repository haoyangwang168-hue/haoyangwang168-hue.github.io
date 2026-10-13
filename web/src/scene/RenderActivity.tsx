import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { MotionValue } from 'framer-motion'

const SETTLE_MS = 1200
const WARMUP_FRAMES = 12

/** Use the renderer's own frame loop; never debounce or cap scroll-driven rotation. */
export default function RenderActivity({ coverProgress }: { coverProgress: MotionValue<number> }) {
  const invalidate = useThree(state => state.invalidate)
  const canvas = useThree(state => state.gl.domElement)
  const activity = useRef({ deadline: 0, active: false, frames: 0, last: 0, sampleMs: 0, samples: 0 })

  useFrame(state => {
    const current = activity.current
    const now = performance.now()
    if (document.hidden || coverProgress.get() >= 1) {
      current.active = false
      canvas.dataset.renderActivity = document.hidden ? 'hidden' : 'covered'
      return
    }
    if (!current.active) return
    current.frames += 1
    if (current.frames > WARMUP_FRAMES && current.last > 0) {
      current.sampleMs += now - current.last
      current.samples += 1
      if (current.samples >= 45) {
        const averageMs = current.sampleMs / current.samples
        canvas.dataset.portraitFrameMs = averageMs.toFixed(1)
        // Lower pixel cost only after sustained slow frames, retaining the chosen level.
        const dpr = state.viewport.dpr
        const nextDpr = averageMs > 22 ? Math.max(0.65, Math.round((dpr - 0.15) * 100) / 100) : dpr
        if (nextDpr !== dpr) state.setDpr(nextDpr)
        canvas.dataset.portraitDpr = nextDpr.toFixed(2)
        current.sampleMs = 0
        current.samples = 0
      }
    }
    current.last = now
    if (now < current.deadline || current.frames < WARMUP_FRAMES) {
      invalidate()
    } else {
      current.active = false
      canvas.dataset.renderActivity = 'idle'
    }
  })

  useEffect(() => {
    const wake = (): void => {
      const current = activity.current
      if (document.hidden || coverProgress.get() >= 1) {
        current.active = false
        canvas.dataset.renderActivity = document.hidden ? 'hidden' : 'covered'
        return
      }
      if (!current.active) {
        current.frames = 0
        current.last = 0
        current.sampleMs = 0
        current.samples = 0
      }
      current.active = true
      current.deadline = performance.now() + SETTLE_MS
      canvas.dataset.renderActivity = 'active'
      invalidate()
    }
    const events = ['pointermove', 'pointerdown', 'pointerup', 'pointercancel', 'scroll', 'resize'] as const
    events.forEach(event => window.addEventListener(event, wake, { passive: true }))
    document.addEventListener('visibilitychange', wake)
    const unsubscribe = coverProgress.on('change', wake)
    wake()
    const current = activity.current
    return () => {
      current.active = false
      events.forEach(event => window.removeEventListener(event, wake))
      document.removeEventListener('visibilitychange', wake)
      unsubscribe()
      delete canvas.dataset.renderActivity
      delete canvas.dataset.portraitFrameMs
      delete canvas.dataset.portraitDpr
    }
  }, [canvas, coverProgress, invalidate])

  return null
}
