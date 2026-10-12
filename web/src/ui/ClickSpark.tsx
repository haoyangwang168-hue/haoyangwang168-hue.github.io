import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from './useParallax'
import './click-spark.css'

type SparkEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

interface ClickSparkProps {
  enabled?: boolean
  sparkColor?: string
  sparkSize?: number
  sparkRadius?: number
  sparkCount?: number
  duration?: number
  easing?: SparkEasing
  extraScale?: number
}

interface Spark {
  x: number
  y: number
  angle: number
  startTime: number
}

interface ClickGesture {
  pointerId: number
  x: number
  y: number
  dragged: boolean
}

/** React Bits ClickSpark, adapted to a viewport canvas for this scrolling portfolio. */
export default function ClickSpark({
  enabled = true,
  sparkColor = '#fff',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !enabled || reduced) return
    const context = canvas.getContext('2d')
    if (!context) return

    const count = Number.isFinite(sparkCount) ? Math.max(1, Math.min(32, Math.round(sparkCount))) : 8
    const lifetime = Number.isFinite(duration) ? Math.max(100, duration) : 400
    const size = Number.isFinite(sparkSize) ? Math.max(0, sparkSize) : 10
    const radius = Number.isFinite(sparkRadius) ? Math.max(0, sparkRadius) : 15
    const scale = Number.isFinite(extraScale) ? Math.max(0, extraScale) : 1
    let sparks: Spark[] = []
    let gesture: ClickGesture | null = null
    let animationId: number | null = null
    let width = 0
    let height = 0

    const resizeCanvas = (): void => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.lineCap = 'round'
      sparks = []
      if (animationId !== null) cancelAnimationFrame(animationId)
      animationId = null
    }

    const ease = (progress: number): number => {
      switch (easing) {
        case 'linear': return progress
        case 'ease-in': return progress * progress
        case 'ease-in-out': return progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress
        default: return progress * (2 - progress)
      }
    }

    const draw = (timestamp: number): void => {
      animationId = null
      context.clearRect(0, 0, width, height)
      sparks = sparks.filter(spark => timestamp - spark.startTime < lifetime)

      for (const spark of sparks) {
        const progress = Math.max(0, (timestamp - spark.startTime) / lifetime)
        const eased = ease(progress)
        const distance = eased * radius * scale
        const length = size * (1 - eased)
        const cosine = Math.cos(spark.angle)
        const sine = Math.sin(spark.angle)
        context.globalAlpha = 1 - progress
        context.strokeStyle = sparkColor
        context.lineWidth = 2
        // A faint dark edge keeps the gold visible on the cream works pages.
        context.shadowColor = 'rgba(35, 29, 18, 0.55)'
        context.shadowBlur = 2
        context.beginPath()
        context.moveTo(spark.x + distance * cosine, spark.y + distance * sine)
        context.lineTo(spark.x + (distance + length) * cosine, spark.y + (distance + length) * sine)
        context.stroke()
      }

      // Leave the canvas idle between clicks instead of running another permanent loop.
      if (sparks.length > 0) animationId = requestAnimationFrame(draw)
    }

    const onPointerDown = (event: PointerEvent): void => {
      gesture = event.isPrimary && event.button === 0
        ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragged: false }
        : null
    }
    const onPointerMove = (event: PointerEvent): void => {
      if (gesture && event.pointerId === gesture.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) {
        gesture.dragged = true
      }
    }
    const onPointerCancel = (): void => { gesture = null }
    const onClick = (event: MouseEvent): void => {
      const dragged = gesture?.dragged ?? false
      gesture = null
      if (event.button !== 0 || event.detail === 0 || dragged) return
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || x > width || y > height) return
      const startTime = performance.now()
      sparks.push(...Array.from({ length: count }, (_, index): Spark => ({
        x, y, angle: (2 * Math.PI * index) / count, startTime,
      })))
      sparks = sparks.slice(-count * 32)
      if (animationId === null) animationId = requestAnimationFrame(draw)
    }

    resizeCanvas()
    // Capture includes buttons and galleries that stop bubbling, without consuming their input.
    window.addEventListener('click', onClick, { capture: true, passive: true })
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true })
    window.addEventListener('pointercancel', onPointerCancel, { capture: true, passive: true })
    window.addEventListener('resize', resizeCanvas, { passive: true })
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointercancel', onPointerCancel, true)
      window.removeEventListener('resize', resizeCanvas)
      if (animationId !== null) cancelAnimationFrame(animationId)
      context.clearRect(0, 0, width, height)
    }
  }, [enabled, reduced, sparkColor, sparkSize, sparkRadius, sparkCount, duration, easing, extraScale])

  return <canvas ref={canvasRef} className="click-spark" aria-hidden="true" />
}
