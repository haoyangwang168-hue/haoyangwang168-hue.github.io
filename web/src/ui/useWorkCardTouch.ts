import { useEffect, type RefObject } from 'react'
import type { MotionValue } from 'framer-motion'
import { workTouchScroll } from './work-touch.ts'

interface Drag {
  id: number
  x: number
  y: number
  scroll: number
  top: number
  range: number
  cardHeight: number
  moved: boolean
}

/** Bind touch input locally; return complete cleanup for breakpoint changes and unmounts. */
export function bindWorkCardTouch(gallery: HTMLDivElement, stage: HTMLDivElement, deck: HTMLDivElement, progress: Pick<MotionValue<number>, 'set'>, count: number): () => void {
  let drag: Drag | null = null
  let suppressClickUntil = 0
  const start = (event: TouchEvent): void => {
    suppressClickUntil = 0
    if (event.touches.length !== 1) { drag = null; return }
    const touch = event.touches[0]
    const range = gallery.offsetHeight - stage.offsetHeight
    if (range <= 0 || deck.offsetHeight <= 0) return
    drag = { id: touch.identifier, x: touch.clientX, y: touch.clientY, scroll: window.scrollY, top: gallery.getBoundingClientRect().top + window.scrollY, range, cardHeight: deck.offsetHeight, moved: false }
  }
  const move = (event: TouchEvent): void => {
    if (!drag) return
    if (event.touches.length !== 1 || !event.cancelable) { drag = null; return }
    const touch = Array.from(event.touches).find(item => item.identifier === drag?.id)
    if (!touch) { drag = null; return }
    const delta = drag.y - touch.clientY
    if (!drag.moved && Math.abs(touch.clientX - drag.x) >= 5 && Math.abs(touch.clientX - drag.x) > Math.abs(delta)) { drag = null; return }
    // Claim even a tiny first move before the browser can start inertial scrolling.
    event.preventDefault()
    if (!drag.moved && Math.abs(delta) < 5) return
    drag.moved = true
    suppressClickUntil = performance.now() + 750
    const target = workTouchScroll(drag.scroll, delta, drag.top, drag.range, count, drag.cardHeight)
    // Keep chapter navigation and the footer synchronized with the direct drag.
    window.scrollTo({ top: target, behavior: 'instant' })
    progress.set(Math.max(0, Math.min(1, (window.scrollY - drag.top) / drag.range)))
  }
  const end = (): void => {
    if (drag?.moved) suppressClickUntil = performance.now() + 750
    drag = null
  }
  const click = (event: MouseEvent): void => {
    if (event.detail !== 0 && performance.now() < suppressClickUntil) {
      event.preventDefault()
      event.stopPropagation()
      suppressClickUntil = 0
    }
  }
  stage.addEventListener('touchstart', start, { passive: true })
  stage.addEventListener('touchmove', move, { passive: false })
  stage.addEventListener('touchend', end, { passive: true })
  stage.addEventListener('touchcancel', end, { passive: true })
  stage.addEventListener('click', click, true)
  window.addEventListener('resize', end)
  window.addEventListener('blur', end)
  return () => {
    stage.removeEventListener('touchstart', start)
    stage.removeEventListener('touchmove', move)
    stage.removeEventListener('touchend', end)
    stage.removeEventListener('touchcancel', end)
    stage.removeEventListener('click', click, true)
    window.removeEventListener('resize', end)
    window.removeEventListener('blur', end)
  }
}

/** Scrub the original animation without momentum or an independent animation clock. */
export function useWorkCardTouch(galleryRef: RefObject<HTMLDivElement | null>, stageRef: RefObject<HTMLDivElement | null>, deckRef: RefObject<HTMLDivElement | null>, progress: MotionValue<number>, enabled: boolean, count: number): void {
  useEffect(() => {
    const gallery = galleryRef.current
    const stage = stageRef.current
    const deck = deckRef.current
    if (!enabled || !gallery || !stage || !deck) return
    return bindWorkCardTouch(gallery, stage, deck, progress, count)
  }, [galleryRef, stageRef, deckRef, progress, enabled, count])
}
