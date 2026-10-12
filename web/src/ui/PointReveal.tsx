import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { motion, useMotionValue, useScroll, type MotionValue } from 'framer-motion'
import { pinnedViewportTop, pointRevealTransform, type Rect } from './point-reveal-math'
import { usePrefersReducedMotion } from './useParallax'

interface OriginFrame {
  documentTop: number
  containerHeight: number
  stageHeight: number
  left: number
  viewportWidth: number
  viewportHeight: number
}

interface RevealContext {
  frame: MotionValue<OriginFrame>
  scrollY: MotionValue<number>
  trackX: MotionValue<number>
  stageRef: RefObject<HTMLDivElement>
  trackRef: RefObject<HTMLDivElement>
  vertical: boolean
}

const PointContext = createContext<RevealContext | null>(null)
const EMPTY_RECT: Rect = { left: 0, top: 0, width: 0, height: 0 }

/** Share one viewport origin while the containing gallery pins and translates. */
export function PointRevealStage({ children, galleryRef, stageRef, trackRef, trackX, vertical, layoutKey }: {
  children: ReactNode
  galleryRef: RefObject<HTMLDivElement>
  stageRef: RefObject<HTMLDivElement>
  trackRef: RefObject<HTMLDivElement>
  trackX: MotionValue<number>
  vertical: boolean
  layoutKey: string
}) {
  const { scrollY } = useScroll()
  const frame = useMotionValue<OriginFrame>({ documentTop: 0, containerHeight: 0, stageHeight: 0, left: 0, viewportWidth: 0, viewportHeight: 0 })

  useEffect(() => {
    const gallery = galleryRef.current
    const stage = stageRef.current
    const track = trackRef.current
    if (!gallery || !stage || !track) return
    let disposed = false
    const measure = () => {
      if (disposed) return
      frame.set({
        documentTop: gallery.getBoundingClientRect().top + window.scrollY,
        containerHeight: gallery.offsetHeight,
        stageHeight: stage.offsetHeight,
        left: stage.getBoundingClientRect().left,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: window.innerHeight,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(gallery)
    observer.observe(stage)
    observer.observe(track)
    observer.observe(document.body)
    window.addEventListener('resize', measure)
    void document.fonts.ready.then(measure)
    return () => {
      disposed = true
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [frame, galleryRef, stageRef, trackRef, vertical, layoutKey])

  return <PointContext.Provider value={{ frame, scrollY, trackX, stageRef, trackRef, vertical }}>{children}</PointContext.Provider>
}

/** Animate a visual child; its stationary wrapper remains the geometry anchor. */
export default function PointReveal({ children, label, progress, fanAngle = 0, start = 0, end = 0.46, className = '', layerClassName = '', inTrack = true, as = 'div', decorative = false }: {
  children: ReactNode
  label: string
  progress: MotionValue<number>
  /** Negative angles open upward from the right-hand origin; positive open downward. */
  fanAngle?: number
  start?: number
  end?: number
  className?: string
  layerClassName?: string
  inTrack?: boolean
  as?: 'div' | 'li'
  decorative?: boolean
}) {
  const context = useContext(PointContext)
  if (!context) throw new Error('PointReveal requires a PointRevealStage')
  const { frame, scrollY, trackX, stageRef, trackRef, vertical } = context
  const reduced = usePrefersReducedMotion()
  const anchorRef = useRef<HTMLDivElement & HTMLLIElement>(null)
  const bounds = useMotionValue<Rect>(EMPTY_RECT)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(reduced ? 1 : 0)
  const rotate = useMotionValue(0)
  const opacity = useMotionValue(reduced ? 1 : 0)

  useEffect(() => {
    const anchor = anchorRef.current
    const stage = stageRef.current
    const track = trackRef.current
    if (!anchor || !stage || !track) return
    const measure = () => {
      const rect = anchor.getBoundingClientRect()
      const stageRect = stage.getBoundingClientRect()
      // Relative DOM rectangles cancel the track's current rendered transform.
      bounds.set({
        left: inTrack ? rect.left - track.getBoundingClientRect().left + track.offsetLeft : rect.left - stageRect.left,
        top: rect.top - stageRect.top,
        width: rect.width,
        height: rect.height,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(anchor)
    const card = anchor.closest('.wk-card')
    if (card) observer.observe(card)
    const unsubscribe = frame.on('change', measure)
    return () => { observer.disconnect(); unsubscribe() }
  }, [bounds, frame, inTrack, stageRef, trackRef, vertical])

  useEffect(() => {
    // Set the five output values together so derived scroll values cannot lag
    // behind the moving track by one frame during a direction change.
    const update = () => {
      const measured = bounds.get()
      const viewport = frame.get()
      const stageTop = vertical
        ? viewport.documentTop - scrollY.get()
        : pinnedViewportTop(viewport.documentTop, viewport.stageHeight, viewport.containerHeight, scrollY.get())
      const rest = {
        ...measured,
        left: viewport.left + measured.left + (inTrack && !vertical ? trackX.get() : 0),
        top: stageTop + measured.top,
      }
      // Tall phone cards reveal each block as it enters the same viewport origin.
      const amount = vertical
        ? (viewport.viewportHeight * 0.98 - rest.top) / (viewport.viewportHeight * 0.46)
        : (progress.get() - start) / Math.max(0.001, end - start)
      const next = reduced
        ? { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }
        : pointRevealTransform(rest, { x: viewport.viewportWidth - 18, y: viewport.viewportHeight / 2 }, amount, {
          angle: fanAngle,
          radius: Math.min(viewport.viewportWidth * 0.46, viewport.viewportHeight * 0.48),
        })
      x.set(next.x)
      y.set(next.y)
      scale.set(next.scale)
      rotate.set(next.rotate)
      opacity.set(next.opacity)
    }
    update()
    const unsubscribe = [bounds, frame, scrollY, trackX, progress].map(value => value.on('change', update))
    return () => unsubscribe.forEach(stop => stop())
  }, [bounds, frame, scrollY, trackX, progress, vertical, inTrack, reduced, fanAngle, start, end, x, y, scale, rotate, opacity])
  const Anchor = as

  return (
    <Anchor
      ref={anchorRef}
      className={`wk-point-anchor ${className}`}
      data-point-anchor={label}
      data-point-angle={fanAngle}
      aria-hidden={decorative || undefined}
      onFocusCapture={event => {
        if (vertical || !inTrack || !(event.target instanceof HTMLElement) || !event.target.matches(':focus-visible')) return
        const card = event.currentTarget.closest<HTMLElement>('.wk-card')
        const track = trackRef.current
        if (!card || !track) return
        const viewport = frame.get()
        const cardLeft = card.getBoundingClientRect().left - track.getBoundingClientRect().left
        const travel = Math.min(Math.max(0, cardLeft - (viewport.viewportWidth - card.offsetWidth) / 2), viewport.containerHeight - viewport.stageHeight)
        window.scrollTo({ top: viewport.documentTop + travel, behavior: 'instant' })
      }}
    >
      <motion.div className={`wk-point-layer ${layerClassName}`} style={{ x, y, scale, rotate, opacity }} data-point-layer={label}>
        {children}
      </motion.div>
    </Anchor>
  )
}
