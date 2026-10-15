import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { WorkImage } from '../data/workMedia'
import { responsiveImage } from '../data/responsiveImage'
import { createGalleryImageSlot } from './gallery-image-slot'
import ProgressiveImage from './ProgressiveImage'
import { advanceGalleryMotion, galleryFrames, galleryImageScale, gallerySlot, galleryWheelStep, galleryWheelTarget, GALLERY_SLOTS, wrapIndex } from './gallery-math'
import { usePrefersReducedMotion } from './useParallax'
import './image-gallery.css'

// Geometric growth and recycled image slots follow the supplied slider tutorial.
// Reference: https://v.douyin.com/SeyDOMP9ES8/
/** An infinite growing image stream, with touch drag and an uncropped viewing mode. */
export default function InfiniteImageGallery({ images, lang }: { images: WorkImage[]; lang: 'zh' | 'en' }) {
  const reduced = usePrefersReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const slots = useRef<(HTMLButtonElement | null)[]>([])
  const target = useRef(0)
  const current = useRef(0)
  const velocity = useRef(0)
  const selectedRef = useRef(0)
  const paused = useRef(false)
  const hovered = useRef(false)
  const focused = useRef(false)
  const drag = useRef<{ id: number; x: number; origin: number; moved: boolean } | null>(null)
  const draggedUntil = useRef(0)
  const wake = useRef<() => void>(() => {})
  const retryGallery = useRef<() => void>(() => {})
  const [selected, setSelected] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [stopped, setStopped] = useState(false)
  const failedImages = useRef(new Set<HTMLImageElement>())
  const previewSources = useRef(new Map<string, string>())
  const [hasImageError, setHasImageError] = useState(false)
  const still = reduced || expanded
  const image = images[selected]
  const zh = lang === 'zh'

  const retryImages = (): void => {
    retryGallery.current()
    for (const picture of failedImages.current) {
      if (!picture.isConnected) failedImages.current.delete(picture)
    }
    setHasImageError(failedImages.current.size > 0)
    wake.current()
  }

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || still || images.length < 2) return
    const wheel = (event: WheelEvent): void => {
      // Preserve browser zoom and active pointer gestures. Only the stage owns wheel input.
      if (event.ctrlKey || event.defaultPrevented || drag.current) return
      const step = galleryWheelStep(event.deltaX, event.deltaY, event.deltaMode, stage.clientWidth, stage.clientHeight)
      if (!step || !event.cancelable) return
      event.preventDefault()
      target.current = galleryWheelTarget(current.current, target.current, step)
      wake.current()
    }
    // A native non-passive listener is required to prevent detail-page scrolling.
    stage.addEventListener('wheel', wheel, { passive: false })
    return () => stage.removeEventListener('wheel', wheel)
  }, [images.length, still])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || still || !images.length) return
    let width = stage.clientWidth
    let height = stage.clientHeight
    let baseWidth = Math.min(width, height * 0.8)
    const layers = slots.current.map(button => ({ button, loader: button ? createGalleryImageSlot(button, (picture, state) => {
      const asset = images[Number(button.dataset.imageIndex)]
      if (state === 'ready' && asset) previewSources.current.set(asset.src, picture.currentSrc || picture.src)
      if (state === 'error') failedImages.current.add(picture)
      else failedImages.current.delete(picture)
      setHasImageError(failedImages.current.size > 0)
      if (state === 'ready' || state === 'error') wake.current()
    }) : null }))
    retryGallery.current = () => { layers.forEach(layer => layer.loader?.retry()) }
    const sizeLayers = () => {
      baseWidth = Math.min(width, height * 0.8)
      for (const { button } of layers) {
        if (!button) continue
        button.style.width = `${baseWidth}px`
        button.style.height = `${height}px`
      }
    }
    sizeLayers()
    current.current = target.current
    velocity.current = 0
    let previousTime = 0
    let frame = 0
    let visible = true
    const schedule = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render) }
    wake.current = () => { if (!frame) previousTime = 0; schedule() }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) { previousTime = 0; schedule() }
      else { cancelAnimationFrame(frame); frame = 0 }
    }, { root: stage.closest('.wk-detail'), threshold: 0.05 })
    const resize = new ResizeObserver(() => { width = stage.clientWidth; height = stage.clientHeight; sizeLayers(); wake.current() })
    resize.observe(stage)
    const render = (time: number) => {
      frame = 0
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0
      previousTime = time
      if (visible && !document.hidden) {
        if (!paused.current && !hovered.current && !focused.current && !drag.current) target.current += delta * 0.18
        const next = advanceGalleryMotion(current.current, target.current, velocity.current, delta, drag.current?.moved ?? false)
        current.current = next.position
        velocity.current = next.velocity
        // Removing a whole image cycle preserves every position and avoids precision loss.
        if (Math.abs(current.current) > images.length * 100) {
          const period = images.length * GALLERY_SLOTS
          const cycle = Math.trunc(current.current / period) * period
          current.current -= cycle
          target.current -= cycle
          if (drag.current) drag.current.origin -= cycle
        }
        const frames = galleryFrames(current.current, width, height, images.length)
        let featured = 0
        for (const [order, box] of frames.entries()) {
          const { button, loader } = layers[gallerySlot(current.current, order)]
          if (!button) continue
          const onscreen = box.left < width && box.left + box.width > 0
          button.style.visibility = onscreen ? 'visible' : 'hidden'
          // Prepare one neighbour on each side before it enters, without loading all slots.
          const nearby = box.left < width * 1.6 && box.left + box.width > -width * 0.2
          if (!nearby) continue
          const asset = images[box.index]
          button.dataset.imageIndex = String(box.index)
          button.setAttribute('aria-label', asset.alt)
          const preview = responsiveImage(asset.src)
          // Cover crops can render wider than their frame, especially landscape photos.
          const aspect = preview.width && preview.height ? preview.width / preview.height : 1
          loader?.assign({ src: preview.src, srcSet: preview.srcSet, alt: asset.alt, displayWidth: Math.max(box.width, box.height * aspect) })
          if (!onscreen) continue
          const picture = loader?.image()
          button.style.transform = `translate3d(${box.left}px, 0, 0) scale(${box.width / baseWidth}, ${box.height / height})`
          if (picture) {
            const aspect = picture.naturalWidth && picture.naturalHeight ? picture.naturalWidth / picture.naturalHeight : 1
            const scale = galleryImageScale(box.width, box.height, baseWidth, height, aspect)
            picture.style.transform = `scale(${scale.x}, ${scale.y})`
          }
          if (box.left >= 0 && box.left + box.width <= width + 1) featured = box.index
        }
        if (featured !== selectedRef.current) {
          selectedRef.current = featured
          setSelected(featured)
        }
      }
      // Sleeping at rest avoids continuous DOM writes while the pointer pauses autoplay.
      const autoplay = !paused.current && !hovered.current && !focused.current && !drag.current
      if (autoplay || current.current !== target.current || velocity.current !== 0) schedule()
    }
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0 }
      else { previousTime = 0; schedule() }
    }
    observer.observe(stage)
    document.addEventListener('visibilitychange', visibility)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      resize.disconnect()
      wake.current = () => {}
      retryGallery.current = () => {}
      layers.forEach(layer => layer.loader?.dispose())
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [images, still])

  const move = (direction: number): void => {
    if (still) {
      const next = wrapIndex(selected + direction, images.length)
      selectedRef.current = next
      setSelected(next)
    } else { target.current -= direction; wake.current() }
  }

  const finishDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current?.id !== event.pointerId) return
    if (drag.current.moved) draggedUntil.current = Date.now() + 200
    drag.current = null
    wake.current()
    event.currentTarget.removeAttribute('data-dragging')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  if (!image) return null

  return (
    <section className="image-flow" aria-label={zh ? '作品图集' : 'Project gallery'}>
      <div
        ref={stageRef}
        className="image-flow-stage"
        hidden={still}
        aria-hidden="true"
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') hovered.current = true }}
        onPointerLeave={() => {
          hovered.current = false
          wake.current()
          if (drag.current && !drag.current.moved) drag.current = null
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return
          // Grab the displayed position, including during an unfinished button transition.
          target.current = current.current
          velocity.current = 0
          drag.current = { id: event.pointerId, x: event.clientX, origin: current.current, moved: false }
        }}
        onPointerMove={(event) => {
          const gesture = drag.current
          if (!gesture || gesture.id !== event.pointerId) return
          const distance = event.clientX - gesture.x
          if (Math.abs(distance) > 5) {
            gesture.moved = true
            event.currentTarget.setPointerCapture(event.pointerId)
            event.currentTarget.dataset.dragging = 'true'
          }
          if (!gesture.moved) return
          target.current = gesture.origin + distance / Math.max(80, event.currentTarget.clientWidth * 0.24)
          wake.current()
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
      >
        {Array.from({ length: GALLERY_SLOTS }, (_, slot) => (
          <button
            key={slot}
            ref={(element) => { slots.current[slot] = element }}
            className="image-flow-slide"
            type="button"
            tabIndex={-1}
            style={{ zIndex: slot }}
            aria-label={images[slot % images.length].alt}
            onClick={(event) => {
              if (Date.now() < draggedUntil.current) return
              const index = Number(event.currentTarget.dataset.imageIndex ?? slot % images.length)
              selectedRef.current = index
              setSelected(index)
              setExpanded(true)
            }}
          >
            <span className="image-flow-placeholder image-flow-placeholder--loading">{zh ? '图片加载中…' : 'Loading image…'}</span>
            <span className="image-flow-placeholder image-flow-placeholder--error">{zh ? '图片加载失败，请重试' : 'Image unavailable. Please retry.'}</span>
          </button>
        ))}
        <span className="image-flow-hint" aria-hidden="true">{zh ? '拖动或滚轮探索 ↔' : 'Drag or scroll to explore ↔'}</span>
      </div>
      {still && <div className="image-flow-full"><ProgressiveImage src={image.src} alt={image.alt} lang={lang} previewSrc={previewSources.current.get(image.src)} /></div>}
      {hasImageError && <div className="image-flow-status" role="status"><span>{zh ? '部分图片加载失败，请重试。' : 'Some images could not load. Please retry.'}</span><button type="button" onClick={retryImages}>{zh ? '重新加载图片' : 'Reload images'}</button></div>}
      <div
        className="image-flow-controls"
        onFocus={() => { focused.current = true }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { focused.current = false; wake.current() } }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            move(event.key === 'ArrowRight' ? 1 : -1)
          }
        }}
      >
        <p className="image-flow-caption"><span>{String(selected + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</span>{image.alt}</p>
        <div className="image-flow-actions">
          <button onClick={() => move(-1)} aria-label={zh ? '上一张' : 'Previous image'}>←</button>
          <button onClick={() => move(1)} aria-label={zh ? '下一张' : 'Next image'}>→</button>
          {!reduced && <button onClick={() => { paused.current = !stopped; setStopped(!stopped); wake.current() }} aria-pressed={stopped}>{stopped ? (zh ? '播放' : 'Play') : (zh ? '暂停' : 'Pause')}</button>}
          {!reduced && <button onClick={() => setExpanded(!expanded)}>{expanded ? (zh ? '返回图集' : 'Back to gallery') : (zh ? '查看大图' : 'View full image')}</button>}
        </div>
      </div>
    </section>
  )
}
