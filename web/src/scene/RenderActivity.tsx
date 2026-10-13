import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { MotionValue } from 'framer-motion'

const SETTLE_MS = 3000
const FRAME_INTERVAL_MS = 1000 / 30
const MIN_SETTLE_FRAMES = 12

/** Limit portrait rendering to 30 fps so HTML scrolling has time to run. */
export default function RenderActivity({ coverProgress }: { coverProgress: MotionValue<number> }) {
  const invalidate = useThree(state => state.invalidate)
  const canvas = useThree(state => state.gl.domElement)
  const renderedFrames = useRef(0)

  useFrame(() => { renderedFrames.current += 1 })

  useEffect(() => {
    let deadline = 0
    let frame = 0
    let lastRender = -Infinity
    const blocked = (): boolean => document.hidden || coverProgress.get() >= 1
    const stop = (): void => {
      cancelAnimationFrame(frame)
      frame = 0
      canvas.dataset.renderActivity = document.hidden ? 'hidden' : coverProgress.get() >= 1 ? 'covered' : 'idle'
    }
    const tick = (now: number): void => {
      frame = 0
      // Shader compilation must not consume the entire initial settling budget.
      if (blocked() || (now >= deadline && renderedFrames.current >= MIN_SETTLE_FRAMES)) {
        stop()
        return
      }
      if (now - lastRender >= FRAME_INTERVAL_MS) {
        // Carry the fractional remainder to avoid dropping to 20 fps on 60 Hz screens.
        lastRender = Number.isFinite(lastRender) ? now - ((now - lastRender) % FRAME_INTERVAL_MS) : now
        invalidate()
      }
      frame = requestAnimationFrame(tick)
    }
    const wake = (): void => {
      if (blocked()) { stop(); return }
      deadline = performance.now() + SETTLE_MS
      renderedFrames.current = 0
      canvas.dataset.renderActivity = 'active'
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const events = ['pointermove', 'pointerdown', 'pointerup', 'pointercancel', 'scroll', 'resize', 'blur'] as const
    events.forEach(event => window.addEventListener(event, wake, { passive: true }))
    document.addEventListener('visibilitychange', wake)
    const unsubscribe = coverProgress.on('change', wake)
    wake()
    return () => {
      stop()
      events.forEach(event => window.removeEventListener(event, wake))
      document.removeEventListener('visibilitychange', wake)
      unsubscribe()
      delete canvas.dataset.renderActivity
    }
  }, [canvas, coverProgress, invalidate])

  return null
}
