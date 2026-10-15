import { useEffect, type RefObject } from 'react'
import type { MotionValue } from 'framer-motion'
import { workTouchSnap } from './work-touch.ts'

interface Geometry { top: number; range: number; cardHeight: number }
interface Gesture {
  id: number
  x: number
  y: number
  travel: number
  moved: boolean
  startProgress: number
  lastScroll: number
  direction: number
}

const IDLE_DELAY = 200
const POSITION_TOLERANCE = 0.5
const clamp = (value: number): number => Math.max(0, Math.min(1, value))

/** Observe native scrolling and snap only after both the finger and page have stopped. */
export function bindWorkCardTouch(gallery: HTMLDivElement, stage: HTMLDivElement, deck: HTMLDivElement, _progress: Pick<MotionValue<number>, 'get' | 'set'>, count: number): () => void {
  let gesture: Gesture | null = null
  let touching = false
  let snapping = false
  let disposed = false
  let suppressClickUntil = 0
  let idleTimer: number | null = null
  let stableFrame: number | null = null

  const measure = (): Geometry => ({
    top: gallery.getBoundingClientRect().top + window.scrollY,
    range: Math.max(0, gallery.clientHeight - document.documentElement.clientHeight),
    cardHeight: deck.offsetHeight,
  })
  const blocked = (): boolean => document.hidden || [document.body, document.documentElement]
    .some(element => element && /^(hidden|clip)$/.test(element.style.overflow))
  const cancelCheck = (): void => {
    if (idleTimer !== null) window.clearTimeout(idleTimer)
    if (stableFrame !== null) window.cancelAnimationFrame(stableFrame)
    idleTimer = null
    stableFrame = null
  }
  const interrupt = (): void => {
    cancelCheck()
    gesture = null
    // Only our own smooth snap may be stopped; native momentum is never rewritten.
    if (snapping) {
      snapping = false
      window.scrollTo({ top: window.scrollY, behavior: 'instant' })
    }
  }
  const settle = (): void => {
    if (snapping) { snapping = false; return }
    const finished = gesture
    gesture = null
    if (!finished?.moved || touching || blocked()) return
    const geometry = measure()
    const current = (window.scrollY - geometry.top) / geometry.range
    // Leaving either edge belongs to the surrounding page, including native inertia.
    if (geometry.range <= 0 || geometry.cardHeight <= 0 || current < 0 || current > 1) return
    const target = workTouchSnap(finished.startProgress, current, finished.travel, geometry.cardHeight, count, finished.direction)
    const destination = geometry.top + target * geometry.range
    if (Math.abs(destination - window.scrollY) <= 1) return
    snapping = true
    window.scrollTo({ top: destination, behavior: 'smooth' })
    scheduleIdle()
  }
  const verifyStopped = (): void => {
    cancelCheck()
    if (touching || blocked()) { gesture = null; return }
    let previous = window.scrollY
    let frames = 0
    const check = (): void => {
      stableFrame = null
      if (disposed || touching || blocked()) { gesture = null; return }
      if (Math.abs(window.scrollY - previous) > POSITION_TOLERANCE) { scheduleIdle(); return }
      previous = window.scrollY
      if (++frames < 2) { stableFrame = window.requestAnimationFrame(check); return }
      settle()
    }
    stableFrame = window.requestAnimationFrame(check)
  }
  function scheduleIdle(): void {
    cancelCheck()
    if (disposed || touching || (!gesture && !snapping)) return
    idleTimer = window.setTimeout(() => { idleTimer = null; verifyStopped() }, IDLE_DELAY)
  }
  const scroll = (): void => {
    if (blocked()) { interrupt(); return }
    if (gesture) {
      const step = window.scrollY - gesture.lastScroll
      if (Math.abs(step) > POSITION_TOLERANCE) gesture.direction = Math.sign(step)
      gesture.lastScroll = window.scrollY
    }
    if (!touching) scheduleIdle()
  }
  const scrollEnd = (): void => {
    if (!touching && (gesture || snapping)) verifyStopped()
  }
  const start = (event: TouchEvent): void => {
    interrupt()
    touching = event.touches.length > 0
    suppressClickUntil = 0
    if (event.touches.length !== 1 || blocked()) return
    const geometry = measure()
    if (geometry.range <= 0 || geometry.cardHeight <= 0 || window.scrollY < geometry.top || window.scrollY > geometry.top + geometry.range) return
    const touch = event.touches[0]
    gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, travel: 0, moved: false, startProgress: clamp((window.scrollY - geometry.top) / geometry.range), lastScroll: window.scrollY, direction: 0 }
  }
  const move = (event: TouchEvent): void => {
    if (!gesture) return
    if (event.touches.length !== 1) { interrupt(); return }
    const touch = Array.from(event.touches).find(item => item.identifier === gesture?.id)
    if (!touch) { interrupt(); return }
    const delta = gesture.y - touch.clientY
    if (!gesture.moved && Math.abs(touch.clientX - gesture.x) >= 5 && Math.abs(touch.clientX - gesture.x) > Math.abs(delta)) { interrupt(); return }
    gesture.travel = delta
    if (Math.abs(delta) >= 5) {
      gesture.moved = true
      suppressClickUntil = performance.now() + 750
    }
  }
  const release = (event: TouchEvent): void => {
    touching = event.touches.length > 0
    if (touching || !gesture?.moved) { interrupt(); return }
    suppressClickUntil = performance.now() + 350
    scheduleIdle()
  }
  const cancel = (): void => { touching = false; interrupt() }
  const click = (event: MouseEvent): void => {
    if (event.detail !== 0 && performance.now() < suppressClickUntil) {
      event.preventDefault()
      event.stopPropagation()
      suppressClickUntil = 0
    }
  }
  const outsideClick = (event: MouseEvent): void => {
    if (!stage.contains(event.target as Node | null)) interrupt()
  }
  // Observe geometry changes without adjusting the document under a moving finger.
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(interrupt)
  observer?.observe(gallery)
  observer?.observe(deck)
  if (document.body) observer?.observe(document.body)
  stage.addEventListener('touchstart', start, { passive: true })
  stage.addEventListener('touchmove', move, { passive: true })
  stage.addEventListener('touchend', release, { passive: true })
  stage.addEventListener('touchcancel', cancel, { passive: true })
  stage.addEventListener('click', click, true)
  // Capture new input before stage handlers so a fresh gesture can replace a snap.
  document.addEventListener('touchstart', interrupt, { passive: true, capture: true })
  document.addEventListener('click', outsideClick, true)
  document.addEventListener('scrollend', scrollEnd)
  document.addEventListener('visibilitychange', interrupt)
  document.addEventListener('load', interrupt, true)
  document.fonts?.addEventListener('loadingdone', interrupt)
  window.addEventListener('scroll', scroll, { passive: true })
  window.addEventListener('resize', interrupt)
  window.addEventListener('blur', cancel)
  window.addEventListener('wheel', interrupt, { passive: true })
  window.addEventListener('keydown', interrupt)
  window.addEventListener('hashchange', interrupt)
  return () => {
    disposed = true
    interrupt()
    observer?.disconnect()
    stage.removeEventListener('touchstart', start)
    stage.removeEventListener('touchmove', move)
    stage.removeEventListener('touchend', release)
    stage.removeEventListener('touchcancel', cancel)
    stage.removeEventListener('click', click, true)
    document.removeEventListener('touchstart', interrupt, true)
    document.removeEventListener('click', outsideClick, true)
    document.removeEventListener('scrollend', scrollEnd)
    document.removeEventListener('visibilitychange', interrupt)
    document.removeEventListener('load', interrupt, true)
    document.fonts?.removeEventListener('loadingdone', interrupt)
    window.removeEventListener('scroll', scroll)
    window.removeEventListener('resize', interrupt)
    window.removeEventListener('blur', cancel)
    window.removeEventListener('wheel', interrupt)
    window.removeEventListener('keydown', interrupt)
    window.removeEventListener('hashchange', interrupt)
  }
}

/** The document scroll value owns every card pose on desktop and touch devices. */
export function useWorkCardTouch(galleryRef: RefObject<HTMLDivElement | null>, stageRef: RefObject<HTMLDivElement | null>, deckRef: RefObject<HTMLDivElement | null>, scrollProgress: MotionValue<number>, enabled: boolean, count: number): MotionValue<number> {
  useEffect(() => {
    const gallery = galleryRef.current
    const stage = stageRef.current
    const deck = deckRef.current
    if (!enabled || !gallery || !stage || !deck) return
    return bindWorkCardTouch(gallery, stage, deck, scrollProgress, count)
  }, [galleryRef, stageRef, deckRef, scrollProgress, enabled, count])
  return scrollProgress
}
