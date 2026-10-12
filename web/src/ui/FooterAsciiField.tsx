import { useEffect, useRef } from 'react'
import type { MotionValue } from 'framer-motion'

interface FooterAsciiFieldProps {
  progress: MotionValue<number>
  reduced: boolean
  compact: boolean
}

interface Glyph {
  x: number
  y: number
  opacity: number
  character: string
}

const CHARACTERS = '.:+*01#'

/** A decorative field that redraws only while visible and responding to input. */
export default function FooterAsciiField({ progress, reduced, compact }: FooterAsciiFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const surface = canvas?.parentElement
    const context = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !surface || !context) return

    let width = 0
    let height = 0
    let frame = 0
    let visible = false
    let glyphs: Glyph[] = []
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, targetStrength: 0 }

    function requestDraw(): void {
      if (!frame && visible && !document.hidden) frame = window.requestAnimationFrame(draw)
    }

    function draw(): void {
      frame = 0
      if (!context || !visible || document.hidden) return
      pointer.x += (pointer.targetX - pointer.x) * 0.14
      pointer.y += (pointer.targetY - pointer.y) * 0.14
      pointer.strength += (pointer.targetStrength - pointer.strength) * 0.14
      context.clearRect(0, 0, width, height)
      context.font = `${compact ? 10 : 12}px monospace`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const driftX = reduced ? 0 : (pointer.x / Math.max(width, 1) - 0.5) * 16 * pointer.strength
      const driftY = reduced ? 0 : (progress.get() - 0.5) * (compact ? 20 : 54)

      for (const glyph of glyphs) {
        const distance = Math.hypot(glyph.x - pointer.x, glyph.y - pointer.y)
        const highlight = Math.max(0, 1 - distance / 150) * pointer.strength
        context.fillStyle = highlight > 0.12 ? '#e7f7a6' : '#bcc993'
        context.globalAlpha = Math.min(0.9, glyph.opacity + highlight * 0.72)
        context.fillText(glyph.character, glyph.x + driftX, glyph.y + driftY)
      }
      context.globalAlpha = 1
      const moving = Math.abs(pointer.targetX - pointer.x) + Math.abs(pointer.targetY - pointer.y) > 0.4
      if (!reduced && (moving || Math.abs(pointer.targetStrength - pointer.strength) > 0.005)) requestDraw()
    }

    function resize(): void {
      if (!canvas || !surface || !context) return
      width = surface.clientWidth
      height = surface.clientHeight
      const ratio = Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.5)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      glyphs = []
      const cellWidth = compact ? 15 : 17
      const cellHeight = compact ? 19 : 21
      for (let row = 0; row < Math.ceil(height / cellHeight); row += 1) {
        for (let column = 0; column < Math.ceil(width / cellWidth); column += 1) {
          const x = column * cellWidth
          const y = row * cellHeight
          const first = Math.hypot((x / width - 0.85) / 0.31, (y / height - 0.43) / 0.4)
          const second = Math.hypot((x / width - 0.17) / 0.22, (y / height - 0.8) / 0.27)
          const density = Math.max(0, 1 - Math.min(first, second))
          const seed = (column * 13 + row * 7) % 17
          if (density < 0.08 || seed / 20 > density) continue
          glyphs.push({ x, y, opacity: density * (compact ? 0.15 : 0.23), character: CHARACTERS[(row * 3 + column * 5) % CHARACTERS.length] })
        }
      }
      requestDraw()
    }

    function move(event: PointerEvent): void {
      if (!surface || event.pointerType !== 'mouse') return
      const bounds = surface.getBoundingClientRect()
      pointer.targetX = (event.clientX - bounds.left) * width / Math.max(bounds.width, 1)
      pointer.targetY = (event.clientY - bounds.top) * height / Math.max(bounds.height, 1)
      pointer.targetStrength = 1
      requestDraw()
    }

    function leave(): void {
      pointer.targetStrength = 0
      requestDraw()
    }

    const resizeObserver = new ResizeObserver(resize)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) requestDraw()
      else {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
    })
    resizeObserver.observe(surface)
    intersectionObserver.observe(surface)
    resize()
    const unsubscribe = reduced ? undefined : progress.on('change', requestDraw)
    if (!reduced && !compact) {
      surface.addEventListener('pointermove', move, { passive: true })
      surface.addEventListener('pointerleave', leave)
    }
    document.addEventListener('visibilitychange', requestDraw)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      unsubscribe?.()
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerleave', leave)
      document.removeEventListener('visibilitychange', requestDraw)
    }
  }, [compact, progress, reduced])

  return <canvas ref={canvasRef} className="pf-ascii-field" aria-hidden="true" />
}
