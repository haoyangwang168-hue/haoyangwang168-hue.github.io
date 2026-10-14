import { useEffect, type RefObject } from 'react'
import { useMotionValue, type MotionValue } from 'framer-motion'
import { workTouchScroll } from './work-touch.ts'

interface Geometry { top: number; range: number; cardHeight: number }
interface Drag extends Geometry {
  id: number
  x: number
  y: number
  lastX: number
  lastY: number
  scroll: number
  target: number
  moved: boolean
  pageOutside: boolean
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value))

/** Own mobile progress exclusively; synchronize the page only on release or exit. */
export function bindWorkCardTouch(gallery: HTMLDivElement, stage: HTMLDivElement, deck: HTMLDivElement, progress: Pick<MotionValue<number>, 'get' | 'set'>, count: number): () => void {
  let drag: Drag | null = null
  let suppressClickUntil = 0
  let scrollFrame: number | null = null
  const measure = (): Geometry => ({
    top: gallery.getBoundingClientRect().top + window.scrollY,
    // Match document geometry, not the sticky stage's small-viewport height.
    range: Math.max(0, gallery.clientHeight - document.documentElement.clientHeight),
    cardHeight: deck.offsetHeight,
  })
  const followPage = (): void => {
    if (drag) return
    const geometry = measure()
    progress.set(geometry.range > 0 ? clamp((window.scrollY - geometry.top) / geometry.range) : 0)
  }
  const cancelScrollFrame = (): void => {
    if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame)
    scrollFrame = null
  }
  const onScroll = (): void => {
    if (drag || scrollFrame !== null) return
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = null
      // Read current geometry rather than replaying a previously sampled progress.
      followPage()
    })
  }
  const end = (): void => {
    if (!drag) return
    const finished = drag
    if (finished.moved) {
      suppressClickUntil = performance.now() + 750
      window.scrollTo({ top: finished.target, behavior: 'instant' })
    }
    drag = null
    followPage()
  }
  const start = (event: TouchEvent): void => {
    end()
    suppressClickUntil = 0
    if (event.touches.length !== 1) return
    const geometry = measure()
    // Keep entry/exit scrolling native until the deck is actually pinned.
    if (geometry.range <= 0 || geometry.cardHeight <= 0 || window.scrollY < geometry.top || window.scrollY > geometry.top + geometry.range) return
    cancelScrollFrame()
    const touch = event.touches[0]
    const scroll = window.scrollY
    progress.set(clamp((scroll - geometry.top) / geometry.range))
    drag = { ...geometry, id: touch.identifier, x: touch.clientX, y: touch.clientY, lastX: touch.clientX, lastY: touch.clientY, scroll, target: scroll, moved: false, pageOutside: false }
  }
  const move = (event: TouchEvent): void => {
    if (!drag) return
    if (event.touches.length !== 1 || !event.cancelable) { end(); return }
    const touch = Array.from(event.touches).find(item => item.identifier === drag?.id)
    if (!touch) { end(); return }
    const delta = drag.y - touch.clientY
    if (!drag.moved && Math.abs(touch.clientX - drag.x) >= 5 && Math.abs(touch.clientX - drag.x) > Math.abs(delta)) { end(); return }
    event.preventDefault()
    drag.lastX = touch.clientX
    drag.lastY = touch.clientY
    if (!drag.moved && Math.abs(delta) < 5) return
    drag.moved = true
    suppressClickUntil = performance.now() + 750
    drag.target = workTouchScroll(drag.scroll, delta, drag.top, drag.range, count, drag.cardHeight)
    progress.set(clamp((drag.target - drag.top) / drag.range))
    const outside = drag.target < drag.top || drag.target > drag.top + drag.range
    // Past either boundary, use normal 1:1 page movement, including reversal.
    if (outside || drag.pageOutside) window.scrollTo({ top: drag.target, behavior: 'instant' })
    drag.pageOutside = outside
  }
  const resize = (): void => {
    cancelScrollFrame()
    if (!drag) { followPage(); return }
    const geometry = measure()
    if (geometry.range <= 0 || geometry.cardHeight <= 0) { end(); return }
    const target = drag.pageOutside ? window.scrollY : geometry.top + progress.get() * geometry.range
    // Toolbar/viewport changes rebase the finger origin without ending the drag.
    Object.assign(drag, geometry, { scroll: target, target, x: drag.lastX, y: drag.lastY })
  }
  const click = (event: MouseEvent): void => {
    if (event.detail !== 0 && performance.now() < suppressClickUntil) {
      event.preventDefault()
      event.stopPropagation()
      suppressClickUntil = 0
    }
  }
  followPage()
  stage.addEventListener('touchstart', start, { passive: true })
  stage.addEventListener('touchmove', move, { passive: false })
  stage.addEventListener('touchend', end, { passive: true })
  stage.addEventListener('touchcancel', end, { passive: true })
  stage.addEventListener('click', click, true)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', resize)
  window.addEventListener('blur', end)
  return () => {
    end()
    cancelScrollFrame()
    stage.removeEventListener('touchstart', start)
    stage.removeEventListener('touchmove', move)
    stage.removeEventListener('touchend', end)
    stage.removeEventListener('touchcancel', end)
    stage.removeEventListener('click', click, true)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', resize)
    window.removeEventListener('blur', end)
  }
}

/** Desktop retains its scroll value; mobile uses a separate, single-owner value. */
export function useWorkCardTouch(galleryRef: RefObject<HTMLDivElement | null>, stageRef: RefObject<HTMLDivElement | null>, deckRef: RefObject<HTMLDivElement | null>, scrollProgress: MotionValue<number>, enabled: boolean, count: number): MotionValue<number> {
  const touchProgress = useMotionValue(0)
  useEffect(() => {
    const gallery = galleryRef.current
    const stage = stageRef.current
    const deck = deckRef.current
    if (!enabled || !gallery || !stage || !deck) return
    return bindWorkCardTouch(gallery, stage, deck, touchProgress, count)
  }, [galleryRef, stageRef, deckRef, touchProgress, enabled, count])
  return enabled ? touchProgress : scrollProgress
}
