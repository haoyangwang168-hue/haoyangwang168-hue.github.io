import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { portraitInertia, portraitParallax, portraitPosition } from './portrait-math'
import { galleryWheelStep } from './gallery-math'
import { responsiveImage } from '../data/responsiveImage'
import { useIsCompact, useMobileInput, usePrefersReducedMotion } from './useParallax'
import './portrait-gallery.css'

const PHOTOS = ['haoyang-sunglasses.jpg', 'haoyang-portrait.jpg', 'haoyang-coast.jpg', 'haoyang-outdoors.jpg']
// Preserve hair in selfies and the off-centre subject in the seaside photograph.
const PHOTO_FRAMING = [
  { scale: 1.3, position: '50% 0%', origin: '50% 0%', bias: 0.1 },
  { scale: 1.32, position: '60% 0%', origin: '50% 0%', bias: 0 },
  { scale: 1.12, position: '25% 50%', origin: '50% 50%', bias: 0 },
  { scale: 1.3, position: '50% 0%', origin: '50% 0%', bias: 0 },
]
const LABELS = {
  zh: ['戴墨镜的我', '日常自拍', '海边的拍立得', '户外活动中的我'],
  en: ['Me in sunglasses', 'An everyday portrait', 'A seaside Polaroid', 'An outdoor moment'],
}
interface PortraitDrag { id: number; startX: number; lastX: number; time: number; moved: boolean }

/** Recycled photo slots follow input immediately and coast only after input ends. */
export default function PortraitGallery({ lang }: { lang: 'zh' | 'en' }) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const offset = useRef(0)
  const target = useRef(0)
  const velocity = useRef(0)
  const strideRef = useRef(300)
  const wake = useRef<() => void>(() => {})
  const drag = useRef<PortraitDrag | null>(null)
  const suppressClickUntil = useRef(0)
  const [selected, setSelected] = useState<number | null>(null)
  const reduced = usePrefersReducedMotion()
  const compact = useIsCompact()
  const native = useMobileInput()
  // Keep moving while the gallery is visible, not just before photos appear.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] })
  const strength = reduced ? 0 : compact ? 0.65 : 1
  const titleY = useTransform(scrollYProgress, [0, 0.4, 0.62, 1], [100 * strength, 0, 0, -160 * strength])
  const photoY = useTransform(scrollYProgress, [0, 0.5, 0.65, 1], [320 * strength, 0, 0, -200 * strength])
  const photoScale = useTransform(scrollYProgress, [0, 0.5, 0.7, 1], [compact ? 0.94 : 0.86, 1, 1, 0.92])
  const labelOpacity = useTransform(scrollYProgress, [0.04, 0.18, 0.62, 0.82], [0, 1, 1, 0])
  const headingOpacity = useTransform(scrollYProgress, [0.08, 0.24, 0.66, 0.86], [0, 1, 1, 0])
  const bodyOpacity = useTransform(scrollYProgress, [0.12, 0.3, 0.7, 0.9], [0, 1, 1, 0])
  const photoOpacity = useTransform(scrollYProgress, [0.14, 0.36, 0.74, 0.96], [0, 1, 1, 0])
  // Only clip the decorative surface; modal and keyboard focus remain unrestricted.
  const surfaceClip = useTransform(scrollYProgress, [0, 0.32, 0.68, 1], [
    'inset(22% 0 0% 0 round 12vw 12vw 0vw 0vw)',
    'inset(0% 0 0% 0 round 0vw 0vw 0vw 0vw)',
    'inset(0% 0 0% 0 round 0vw 0vw 0vw 0vw)',
    'inset(0% 0 30% 0 round 0vw 0vw 12vw 12vw)',
  ])
  const titleLayer = { y: native ? 0 : titleY }
  const photoLayer = native ? {} : { y: photoY, scale: reduced ? 1 : photoScale, opacity: reduced ? 1 : photoOpacity }
  const viewing = selected !== null
  const zh = lang === 'zh'
  const photoUrl = (index: number): string => `${import.meta.env.BASE_URL}media/${PHOTOS[index]}`

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || reduced || viewing || native) return
    const cards = Array.from(stage.querySelectorAll<HTMLButtonElement>('.portrait-card'))
    const pictures = cards.map(card => card.querySelector('img'))
    let frame = 0
    let visible = false
    let previousTime = 0
    let previousStride = 0
    const draw = (time: number): void => {
      frame = 0
      const seconds = previousTime ? Math.min(0.05, (time - previousTime) / 1000) : 0
      previousTime = time
      if (!drag.current) {
        const next = portraitInertia(velocity.current, seconds)
        target.current += next.distance
        velocity.current = Math.abs(next.velocity) < 2 ? 0 : next.velocity
      }
      // Frame-rate independent equivalent of the tutorial's per-frame lerp.
      offset.current += (target.current - offset.current) * (1 - Math.exp(-seconds * 14))
      const width = stage.clientWidth < 640 ? stage.clientWidth * 0.78 : Math.min(360, stage.clientHeight * 0.8)
      const stride = width + (stage.clientWidth < 640 ? 16 : 24)
      if (previousStride && stride !== previousStride) {
        offset.current *= stride / previousStride
        target.current *= stride / previousStride
      }
      previousStride = stride
      strideRef.current = stride
      const laps = Math.trunc(offset.current / (stride * cards.length)) * stride * cards.length
      offset.current -= laps
      target.current -= laps
      cards.forEach((card, index) => {
        const x = portraitPosition(index, offset.current, stride, cards.length)
        const hidden = x + width <= 0 || x >= stage.clientWidth
        card.style.width = `${width}px`
        card.style.transform = `translate3d(${x}px,0,0)`
        card.inert = hidden
        card.setAttribute('aria-hidden', String(hidden))
        const framing = PHOTO_FRAMING[index % PHOTOS.length]
        const limit = width * (framing.scale - 1) * 0.45
        const drift = Math.max(-limit, Math.min(limit, portraitParallax(x + width / 2, stage.clientWidth, width, framing.scale) + width * framing.bias))
        if (pictures[index]) pictures[index]!.style.transform = `translate3d(${drift}px,0,0) scale(${framing.scale})`
      })
      if (visible && ((velocity.current && !drag.current) || Math.abs(target.current - offset.current) > 0.1)) frame = requestAnimationFrame(draw)
    }
    const requestDraw = (): void => {
      if (visible && !frame) { previousTime = performance.now(); frame = requestAnimationFrame(draw) }
    }
    wake.current = requestDraw
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) requestDraw()
      else { cancelAnimationFrame(frame); frame = 0; velocity.current = 0 }
    }, { rootMargin: '240px 0px' })
    const resize = new ResizeObserver(requestDraw)
    const wheel = (event: WheelEvent): void => {
      if (event.ctrlKey || drag.current || !event.cancelable) return
      // Wheels over photographs browse the track; the surrounding page still scrolls.
      const step = galleryWheelStep(event.deltaX, event.deltaY, event.deltaMode, stage.clientWidth, stage.clientHeight)
      if (!step) return
      event.preventDefault()
      const distance = -step * Math.max(80, stage.clientWidth * 0.24)
      target.current += distance
      velocity.current = Math.max(-1200, Math.min(1200, distance * 6))
      requestDraw()
    }
    observer.observe(stage)
    resize.observe(stage)
    stage.addEventListener('wheel', wheel, { passive: false })
    return () => {
      observer.disconnect()
      resize.disconnect()
      cancelAnimationFrame(frame)
      stage.removeEventListener('wheel', wheel)
      wake.current = () => {}
      drag.current = null
      delete stage.dataset.dragging
    }
  }, [reduced, viewing, native])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!viewing || !dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    velocity.current = 0
    target.current = offset.current
    dialog.showModal()
    return () => {
      dialog.close()
      document.documentElement.style.overflow = overflow
      previousFocus?.focus({ preventScroll: true })
    }
  }, [viewing])

  const finishDrag = (pointerId: number): void => {
    const active = drag.current
    if (!active || active.id !== pointerId) return
    if (active.moved) suppressClickUntil.current = performance.now() + 350
    if (performance.now() - active.time > 80 || !active.moved) velocity.current = 0
    drag.current = null
    if (stageRef.current) {
      delete stageRef.current.dataset.dragging
      if (stageRef.current.hasPointerCapture(pointerId)) stageRef.current.releasePointerCapture(pointerId)
    }
    wake.current()
  }
  const navigate = (direction: number): void => {
    if (native) {
      const stage = stageRef.current
      const card = stage?.querySelector<HTMLElement>('.portrait-card')
      if (stage && card) stage.scrollBy({ left: -direction * (card.offsetWidth + 16), behavior: reduced ? 'instant' : 'smooth' })
      return
    }
    velocity.current = direction * strideRef.current * 8
    wake.current()
  }
  return <section ref={sectionRef} className="portraits" aria-label={zh ? '我的照片' : 'My photographs'}>
    <motion.div className="portrait-surface" style={{ clipPath: reduced || native ? undefined : surfaceClip }} aria-hidden="true" />
    <motion.header style={titleLayer} data-parallax-layer="portrait-title"><motion.span style={{ opacity: reduced ? 1 : labelOpacity }}>BEHIND THE AVATAR / 01—04</motion.span><motion.h2 style={{ opacity: reduced ? 1 : headingOpacity }}>{zh ? '这就是我。' : 'This is me.'}</motion.h2><motion.p style={{ opacity: reduced ? 1 : bodyOpacity }}>{zh ? '生活里的几个瞬间。左右拖动或滚动鼠标探索，点击照片放大。' : 'A few moments from life. Drag or use the mouse wheel to explore. Click a photo to take a closer look.'}</motion.p></motion.header>
    <motion.div className="portrait-photo-layer" style={photoLayer} data-parallax-layer="portrait-photos">
      <div key={native ? 'native' : 'recycled'} ref={stageRef} className={`portrait-stage${reduced ? ' portrait-stage--still' : native ? ' portrait-stage--native' : ''}`}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0 || reduced || native) return
          velocity.current = 0
          target.current = offset.current
          drag.current = { id: event.pointerId, startX: event.clientX, lastX: event.clientX, time: performance.now(), moved: false }
        }}
        onPointerMove={event => {
          const active = drag.current
          if (!active || active.id !== event.pointerId) return
          if (!active.moved && Math.abs(event.clientX - active.startX) < 6) return
          const time = performance.now()
          const delta = event.clientX - (active.moved ? active.lastX : active.startX)
          if (!active.moved) {
            event.currentTarget.setPointerCapture(event.pointerId)
            event.currentTarget.dataset.dragging = 'true'
          }
          target.current += delta
          velocity.current = Math.max(-2200, Math.min(2200, delta / Math.max(8, time - active.time) * 1000))
          active.moved = true
          active.lastX = event.clientX
          active.time = time
          wake.current()
        }}
        onPointerUp={event => finishDrag(event.pointerId)}
        onPointerCancel={event => { velocity.current = 0; finishDrag(event.pointerId) }}
        onLostPointerCapture={event => finishDrag(event.pointerId)}>
        {Array.from({ length: reduced || native ? 4 : 12 }, (_, index) => <button type="button" className="portrait-card" key={index}
          aria-label={`${zh ? '放大照片' : 'View photograph'}: ${LABELS[lang][index % 4]}`}
          onClick={event => {
            if (event.detail > 0 && performance.now() < suppressClickUntil.current) return
            setSelected(index % 4)
          }}>
          <img {...responsiveImage(photoUrl(index % 4))} sizes="(max-width: 640px) 78vw, 360px" alt={LABELS[lang][index % 4]} style={{ objectPosition: PHOTO_FRAMING[index % 4].position, transformOrigin: PHOTO_FRAMING[index % 4].origin }} loading="lazy" decoding="async" draggable={false} />
          <span className="portrait-caption"><span>{String(index % 4 + 1).padStart(2, '0')} / HAOYANG</span><span>↗</span></span>
        </button>)}
      </div>
      {!reduced && <div className="portrait-controls"><button aria-label={zh ? '上一张照片' : 'Previous photograph'} onClick={() => navigate(1)}>←</button><span>{zh ? '拖动探索 · 点击放大' : 'DRAG TO EXPLORE · CLICK TO VIEW'}</span><button aria-label={zh ? '下一张照片' : 'Next photograph'} onClick={() => navigate(-1)}>→</button></div>}
    </motion.div>
    {selected !== null && <dialog ref={dialogRef} className="portrait-viewer" aria-label={LABELS[lang][selected]} onCancel={event => { event.preventDefault(); setSelected(null) }}
      onClick={event => { if (event.target === event.currentTarget) setSelected(null) }}>
      <header><span>HAOYANG / {String(selected + 1).padStart(2, '0')}—04</span><button autoFocus onClick={() => setSelected(null)}>{zh ? '返回' : 'Back'} ×</button></header>
      <img className="portrait-full-image" src={photoUrl(selected)} alt={LABELS[lang][selected]} />
      <footer><button aria-label={zh ? '上一张大图' : 'Previous full-size photo'} onClick={() => setSelected((selected + 3) % 4)}>←</button><span>{LABELS[lang][selected]}</span><button aria-label={zh ? '下一张大图' : 'Next full-size photo'} onClick={() => setSelected((selected + 1) % 4)}>→</button></footer>
    </dialog>}
  </section>
}
