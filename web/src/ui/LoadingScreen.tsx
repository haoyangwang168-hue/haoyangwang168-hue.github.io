import { useCallback, useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { EDITORIAL_EASE, MASK_EASE } from './motion-config'
import { getOpeningExit, openingAssetsReady, OPENING_TIMING, type OpeningExitMode } from './opening-timing'

const NAME = 'HAOYANG WANG'
const MONOGRAM = 'HW'
const NAME_VARIANTS: Variants = {
  hidden: { y: '115%' },
  shown: (index: number) => ({
    y: '0%',
    transition: { duration: OPENING_TIMING.nameDuration / 1000, delay: (OPENING_TIMING.nameDelay + index * OPENING_TIMING.nameStagger) / 1000, ease: EDITORIAL_EASE },
  }),
  departed: (index: number) => ({
    y: '-115%',
    transition: { duration: OPENING_TIMING.nameExitDuration / 1000, delay: index * OPENING_TIMING.nameExitStagger / 1000, ease: MASK_EASE },
  }),
}
const MONOGRAM_VARIANTS: Variants = {
  hidden: { y: '115%' },
  shown: (index: number) => ({
    y: '0%',
    transition: { duration: OPENING_TIMING.monogramDuration / 1000, delay: (OPENING_TIMING.monogramDelay + index * OPENING_TIMING.monogramStagger) / 1000, ease: EDITORIAL_EASE },
  }),
}

/** Both clipped halves render the same viewport-centred type, so each glyph tears at the same seam. */
function OpeningType({ swapped, leaving, reduced }: { swapped: boolean; leaving: boolean; reduced: boolean }) {
  return (
    <div className="opening-type">
      <p className="opening-name">
        {Array.from(NAME).map((letter, index) => (
          <span className="opening-char-mask" key={index}>
            <motion.span className="opening-char" initial={reduced ? false : 'hidden'} animate={swapped && !reduced ? 'departed' : 'shown'} custom={index} variants={NAME_VARIANTS}>
              {letter === ' ' ? '\u00a0' : letter}
            </motion.span>
          </span>
        ))}
      </p>
      {!reduced && (
        <motion.p className="opening-monogram" initial={false} animate={{ scale: leaving ? 2.45 : 1 }} transition={{ duration: 1.05, ease: MASK_EASE }}>
          {Array.from(MONOGRAM).map((letter, index) => (
            <span className="opening-char-mask" key={index}>
              <motion.span className="opening-char" initial="hidden" animate={swapped ? 'shown' : 'hidden'} custom={index} variants={MONOGRAM_VARIANTS}>{letter}</motion.span>
            </span>
          ))}
        </motion.p>
      )}
    </div>
  )
}

/** Play the opening once, then enter automatically even if the model is still downloading. */
export default function LoadingScreen({ sceneFailed, onReveal, onComplete }: { sceneFailed: boolean; onReveal: () => void; onComplete: () => void }) {
  const { progress, active, total } = useProgress()
  const reduced = Boolean(useReducedMotion())
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const [swapped, setSwapped] = useState(false)
  const [leaving, setLeaving] = useState<OpeningExitMode | null>(null)
  const started = useRef(false)
  const openingPanel = useRef<HTMLDivElement>(null)
  const ready = openingAssetsReady(active, progress, total, sceneFailed)
  const percentage = sceneFailed ? 100 : Math.round(Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0)
  const exit = getOpeningExit(leaving ?? 'auto', reduced)

  const reveal = useCallback((mode: OpeningExitMode) => {
    if (started.current) return
    started.current = true
    setLeaving(mode)
    onReveal()
  }, [onReveal])

  useEffect(() => {
    const previous = document.body.style.overflow
    const previousRestoration = window.history.scrollRestoration
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    window.history.scrollRestoration = 'manual'
    window.scrollTo({ top: 0, behavior: 'instant' })
    openingPanel.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = previous
      window.history.scrollRestoration = previousRestoration
      const focus = previousFocus instanceof HTMLElement && previousFocus.isConnected && previousFocus !== document.body && !previousFocus.closest('[inert]')
        ? previousFocus : document.querySelector<HTMLElement>('.portfolio-brand')
      focus?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (reduced || leaving) return
    const timer = window.setTimeout(() => setSwapped(true), OPENING_TIMING.swapAt)
    return () => window.clearTimeout(timer)
  }, [reduced, leaving])

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumElapsed(true), reduced ? 0 : OPENING_TIMING.minimum)
    return () => window.clearTimeout(timer)
  }, [reduced])

  useEffect(() => {
    // Network delays must never hold visitors behind the opening curtain.
    if (minimumElapsed) reveal('auto')
  }, [minimumElapsed, reveal])

  useEffect(() => {
    if (!leaving) return
    // Timers also finish the curtain when the tab is backgrounded.
    const timer = window.setTimeout(onComplete, exit.completeAfter)
    return () => window.clearTimeout(timer)
  }, [leaving, onComplete, exit.completeAfter])

  return (
    <div
      ref={openingPanel}
      tabIndex={-1}
      className="loading-screen opening"
      data-phase={leaving ? 'revealing' : minimumElapsed && !ready ? 'loading' : swapped ? 'monogram' : 'name'}
      data-assets-ready={ready}
      onKeyDown={(event) => { if (event.key === 'Escape') reveal('skip') }}
      aria-label="Haoyang Wang portfolio opening"
      role="dialog"
      aria-modal="true"
    >
      {(['top', 'bottom'] as const).map((half) => (
        <motion.div
          key={half}
          className={`opening-half opening-half--${half}`}
          initial={false}
          animate={{ y: leaving ? (half === 'top' ? '-52%' : '52%') : '0%' }}
          transition={{ duration: exit.duration / 1000, delay: leaving ? exit.delay / 1000 : 0, ease: MASK_EASE }}
          aria-hidden="true"
        >
          <motion.div className="opening-frame" animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: reduced ? 0 : 0.25 }}>
            <div className="opening-topline"><span>HAOYANG WANG</span><span>SELECTED EXPLORATIONS — 2026</span></div>
            <p className="opening-caption opening-caption--left">A CURIOUS MIND,<br />IN MOTION.</p>
            <p className="opening-caption opening-caption--right">AI / DESIGN / IMAGE-MAKING</p>
          </motion.div>
          <OpeningType swapped={swapped} leaving={Boolean(leaving)} reduced={reduced} />
        </motion.div>
      ))}
      <motion.div className="opening-controls" animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: reduced ? 0 : 0.15 }}>
        <span className="opening-counter" aria-hidden="true">{String(percentage).padStart(3, '0')}<span>%</span></span>
      </motion.div>
      <motion.div className="opening-load" role="progressbar" aria-label="Loading scene" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: reduced ? 0 : 0.15 }}>
        <motion.span animate={{ scaleX: percentage / 100 }} transition={{ duration: reduced ? 0 : 0.4, ease: EDITORIAL_EASE }} />
      </motion.div>
    </div>
  )
}
