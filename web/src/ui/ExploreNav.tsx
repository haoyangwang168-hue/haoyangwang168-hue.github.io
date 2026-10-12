import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useScroll } from 'framer-motion'
import { EDITORIAL_EASE } from './motion-config'
import { usePrefersReducedMotion, VERTICAL_GALLERY_QUERY } from './useParallax'
import { WORKS } from '../data/works'
import { getSectionStops } from './section-scroll'

const DESTINATIONS = [
  { selector: '.hero', en: 'HELLO', zh: '认识汪昊阳' },
  { selector: '[data-point="focus-1"]', en: 'START', zh: '寻找方向' },
  { selector: '[data-point="focus-2"]', en: 'TOGETHER', zh: '一起向前' },
  { selector: '[data-point="focus-3"]', en: 'CREATE', zh: '创作表达' },
  { selector: '.works', en: 'SELECTED WORKS', zh: '探索作品' },
  { selector: '.parallax-footer', en: 'CONTACT', zh: '一起聊聊' },
] as const

/** A small chapter index makes the long camera journey easy to revisit. */
export default function ExploreNav({ lang, ready, onToggleLanguage }: { lang: 'en' | 'zh'; ready: boolean; onToggleLanguage: () => void }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(0)
  const toggle = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll()

  useEffect(() => {
    // Observe chapter crossings instead of re-rendering React on every scroll frame.
    let observer: IntersectionObserver
    const observe = () => {
      observer?.disconnect()
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = DESTINATIONS.findIndex((item) => entry.target.matches(item.selector))
          if (index >= 0) setCurrent(index)
        }
      }, { rootMargin: `-${window.innerHeight * 0.3}px 0px -${window.innerHeight * 0.69}px 0px`, threshold: 0 })
      DESTINATIONS.forEach(({ selector }) => {
        const element = document.querySelector(selector)
        if (element) observer.observe(element)
      })
    }
    observe()
    window.addEventListener('resize', observe)
    return () => { observer.disconnect(); window.removeEventListener('resize', observe) }
  }, [])

  useEffect(() => {
    if (!open) return
    const destination = panel.current?.querySelector<HTMLButtonElement>('button[aria-current]') ?? panel.current?.querySelector<HTMLButtonElement>('button')
    destination?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggle.current?.focus({ preventScroll: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const visit = (selector: string, restoreFocus = false, workIndex?: number): void => {
    setOpen(false)
    const target = document.querySelector(selector)
    if (target) {
      // Match the 3D camera's 30vh reading line for timeline stops.
      const readingOffset = selector.startsWith('[data-point') ? window.innerHeight * 0.3 : 0
      const stopId = workIndex !== undefined ? `work-${workIndex}` : selector === '.works' ? 'work-0' : selector === '.parallax-footer' ? 'contact' : undefined
      const stop = stopId ? getSectionStops(reduced || window.matchMedia(VERTICAL_GALLERY_QUERY).matches).find(item => item.id === stopId) : undefined
      window.scrollTo({ top: stop?.top ?? target.getBoundingClientRect().top + window.scrollY - readingOffset, behavior: reduced ? 'instant' : 'smooth' })
    }
    if (restoreFocus) toggle.current?.focus({ preventScroll: true })
  }

  return (
    <>
    <motion.header
      className="portfolio-header"
      data-theme={current >= 4 ? 'light' : current >= 1 && current <= 3 ? 'portrait' : 'dark'}
      initial={{ opacity: 0 }}
      animate={{ opacity: ready ? 1 : 0 }}
      transition={{ duration: reduced ? 0 : 0.8 }}
    >
      <button className="portfolio-brand" onClick={() => visit('.hero')} aria-label={lang === 'zh' ? '汪昊阳 · 返回首页' : 'Haoyang Wang · Back to home'}>
        <span>haoyang.</span><small>汪昊阳</small>
      </button>
      <div className="portfolio-links">
        <button onClick={() => visit('.hero')}>ABOUT</button>
        <button onClick={() => visit('.works')}>WORKS</button>
        <button onClick={() => visit('.parallax-footer')}>CONTACT</button>
      </div>
      <button className="lang-toggle" onClick={onToggleLanguage} aria-label="切换语言 / Switch language">{lang === 'en' ? '中文' : 'EN'}</button>
    </motion.header>
    <motion.nav className="explore-nav" aria-label={lang === 'zh' ? '探索章节' : 'Explore chapters'} initial={{ y: 24, opacity: 0 }} animate={{ y: ready ? 0 : 24, opacity: ready ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : 0.8, ease: EDITORIAL_EASE }}>
      <AnimatePresence>
        {open && (
          <motion.div ref={panel} id="explore-index" className="explore-index" initial={{ clipPath: 'inset(100% 0 0 0)', y: reduced ? 0 : 12 }} animate={{ clipPath: 'inset(0% 0 0 0)', y: 0 }} exit={{ clipPath: 'inset(100% 0 0 0)', y: reduced ? 0 : 6, transition: { duration: reduced ? 0 : 0.16, ease: EDITORIAL_EASE } }} transition={{ duration: reduced ? 0 : 0.22, ease: EDITORIAL_EASE }}>
            <p className="explore-index-label">CHOOSE YOUR NEXT STOP</p>
            {DESTINATIONS.map((item, index) => (
              <div key={item.en}>
                <button onClick={() => visit(item.selector, true)} aria-current={current === index ? 'location' : undefined}>
                  <span className="explore-number">0{index}</span><span>{item.en}<small>{lang === 'zh' ? item.zh : ''}</small></span><span className="explore-arrow" aria-hidden="true">↗</span>
                </button>
                {item.selector === '.works' && <div className="explore-work-shortcuts" role="group" aria-label={lang === 'zh' ? '快速选择作品' : 'Choose a work category'}>
                  {WORKS[lang].sections.map((section, workIndex) => <button key={section.id} onClick={() => visit('.works', true, workIndex)}>{section.title}<span aria-hidden="true">↗</span></button>)}
                </div>}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button className="explore-toggle" aria-expanded={open} aria-controls="explore-index" ref={toggle} onClick={() => setOpen((value) => !value)} tabIndex={ready ? 0 : -1}>
        <span className="explore-current">0{current}</span><span>{open ? 'CLOSE INDEX' : 'EXPLORE'}</span><span aria-hidden="true">{open ? '−' : '+'}</span>
        <motion.span className="explore-progress" style={{ scaleX: scrollYProgress }} />
      </button>
    </motion.nav>
    </>
  )
}
