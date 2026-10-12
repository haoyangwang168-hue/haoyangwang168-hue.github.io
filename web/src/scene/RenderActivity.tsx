import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { MotionValue } from 'framer-motion'

// Allow camera damping and released cheeks to settle before suspending GPU work.
const SETTLE_MS = 3000

/** Render on interaction, and sleep when idle or fully covered by the works page. */
export default function RenderActivity({ coverProgress }: { coverProgress: MotionValue<number> }) {
  const invalidate = useThree(state => state.invalidate)
  const canvas = useThree(state => state.gl.domElement)
  const deadline = useRef(0)

  useEffect(() => {
    const wake = (): void => {
      if (document.hidden || coverProgress.get() >= 1) {
        deadline.current = 0
        canvas.dataset.renderActivity = document.hidden ? 'hidden' : 'covered'
        return
      }
      deadline.current = performance.now() + SETTLE_MS
      canvas.dataset.renderActivity = 'active'
      invalidate()
    }
    const events = ['pointermove', 'pointerdown', 'pointerup', 'pointercancel', 'scroll', 'resize', 'blur'] as const
    events.forEach(event => window.addEventListener(event, wake, { passive: true }))
    document.addEventListener('visibilitychange', wake)
    const unsubscribe = coverProgress.on('change', wake)
    wake()
    return () => {
      events.forEach(event => window.removeEventListener(event, wake))
      document.removeEventListener('visibilitychange', wake)
      unsubscribe()
      delete canvas.dataset.renderActivity
    }
  }, [canvas, coverProgress, invalidate])

  useFrame(() => {
    if (!document.hidden && coverProgress.get() < 1 && performance.now() < deadline.current) {
      invalidate()
    } else if (canvas.dataset.renderActivity === 'active') {
      canvas.dataset.renderActivity = 'idle'
    }
  })

  return null
}
