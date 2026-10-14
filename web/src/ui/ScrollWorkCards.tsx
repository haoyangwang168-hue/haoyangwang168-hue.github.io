import { useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { SECTION_COVERS, type WorkSection, type WorkListItem, type WorksLang } from '../data/works'
import { responsiveImage } from '../data/responsiveImage'
import { useIsCompact, useMobileInput, usePrefersReducedMotion } from './useParallax'
import { workOutroPose, workTimeline } from './work-outro'
import { workCardPose } from './portrait-math'
import { worksPageParallax } from './works-transition'
import ProfileCard from './ProfileCard'
import { useWorkCardTouch } from './useWorkCardTouch'
import './scroll-work-cards.css'

function Card({ section, index, count, progress, data, onOpen, reduced, mobile }: { section: WorkSection; index: number; count: number; progress: MotionValue<number>; data: WorksLang; onOpen: (item: WorkListItem) => void; reduced: boolean; mobile: boolean }) {
  const pose = useTransform(progress, value => workCardPose(value, index, count, mobile))
  const cardRef = useRef<HTMLElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const buttons = Array.from(cardRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    let previousHidden: boolean | undefined
    let previousFront: boolean | undefined
    let previousTabIndex: number | undefined
    let previousBackVisible: boolean | undefined
    if (!mobile) {
      frontRef.current?.style.removeProperty('visibility')
      backRef.current?.style.removeProperty('visibility')
    }
    const update = (): void => {
      const current = pose.get()
      const hidden = !reduced && !current.clickable
      const frontVisible = !reduced && index === 0 && current.rotateY < 90
      const backVisible = reduced || (current.rotateY >= 90 && current.opacity > 0)
      // Explicit face visibility avoids relying only on mobile 3D backface compositing.
      if (mobile && backVisible !== previousBackVisible) {
        if (frontRef.current) frontRef.current.style.visibility = backVisible ? 'hidden' : 'visible'
        if (backRef.current) backRef.current.style.visibility = backVisible ? 'visible' : 'hidden'
        previousBackVisible = backVisible
      }
      if (cardRef.current) {
        if (hidden !== previousHidden) {
          cardRef.current.inert = hidden
          cardRef.current.setAttribute('aria-hidden', String(hidden))
        }
        // Keep covered projects out of the tab sequence while allowing exposed card surfaces to click.
        const tabIndex = reduced || current.active ? 0 : -1
        if (tabIndex !== previousTabIndex) {
          for (const button of buttons) button.tabIndex = tabIndex
          previousTabIndex = tabIndex
        }
      }
      if (frontRef.current && (frontVisible !== previousFront || hidden !== previousHidden)) {
        frontRef.current.inert = !frontVisible || hidden
        frontRef.current.setAttribute('aria-hidden', String(!frontVisible || hidden))
      }
      if (backRef.current && (frontVisible !== previousFront || hidden !== previousHidden)) {
        backRef.current.inert = frontVisible || hidden
        backRef.current.setAttribute('aria-hidden', String(frontVisible || hidden))
      }
      previousHidden = hidden
      previousFront = frontVisible
    }
    update()
    return pose.on('change', update)
  }, [pose, reduced, index, mobile])
  const y = useTransform(pose, value => `${value.y}%`)
  const rotate = useTransform(pose, value => value.rotate)
  const rotateY = useTransform(pose, value => value.rotateY)
  const opacity = useTransform(pose, value => value.opacity)
  const pointerEvents = useTransform(pose, value => value.clickable ? 'auto' as const : 'none' as const)
  const items = section.items ?? section.groups?.flatMap(group => group.items.map(name => ({ name }))) ?? []
  return <motion.article ref={cardRef} className={`scroll-work-card scroll-work-card--${index % 4}`} data-work-card={index} onClick={event => {
    // Keep individual project buttons independent from the whole-card hit area.
    if (!(event.target as Element).closest('button') && items[0]) onOpen(items[0])
  }} style={reduced ? {} : { y, rotate, rotateY, opacity, pointerEvents, zIndex: count - index }}>
    {index === 0 && !reduced && <div ref={frontRef} className="scroll-work-side">
      <ProfileCard className="scroll-work-profile"><div className="scroll-work-face scroll-work-front">
      <span className="scroll-work-eyebrow">SELECTED WORKS / 2026</span>
      <h3>FIRST<br />FRAME</h3><span className="scroll-work-stamp">START HERE</span>
      <p>{data.hint}<br />SCROLL TO DISCOVER</p>
      <button className="scroll-work-open" disabled={!items.length} onClick={() => items[0] && onOpen(items[0])} aria-label={`${data.openLabel}: ${items[0]?.name ?? section.title}`}>{data.openLabel}<span aria-hidden="true">↗</span></button>
      </div></ProfileCard>
    </div>}
    <div ref={backRef} className="scroll-work-side scroll-work-back">
      <ProfileCard className="scroll-work-profile" enabled={!reduced}><div className="scroll-work-face">
      <span className="scroll-work-eyebrow">{section.no} / SELECTED WORK</span>
      <h3>{section.title}</h3>
      <button className="scroll-work-cover" disabled={!items.length} onClick={() => items[0] && onOpen(items[0])} aria-label={`${data.openLabel}: ${items[0]?.name ?? section.title}`}>
        <img {...responsiveImage(SECTION_COVERS[section.id])} sizes="(max-width: 640px) 72vw, 380px" alt="" loading="lazy" decoding="async" draggable={false} /><span className="scroll-work-open" aria-hidden="true">{data.openLabel}<span>↗</span></span>
      </button>
      <p>{section.tagline}</p>
      <div className="scroll-work-links">{items.map(item => <button key={item.name} onClick={() => onOpen(item)}>{item.name}<span className="scroll-work-link-hint" aria-hidden="true">{data.openLabel}<span>↗</span></span></button>)}</div>
      </div></ProfileCard>
    </div>
  </motion.article>
}

function OutroLine({ text, index, progress, exitProgress, reduced }: { text: string; index: number; progress: MotionValue<number>; exitProgress: MotionValue<number>; reduced: boolean }) {
  const pose = useTransform(() => workOutroPose(progress.get(), exitProgress.get(), index))
  const opacity = useTransform(pose, value => value.opacity)
  const y = useTransform(pose, value => `${value.y}%`)
  const rotate = useTransform(pose, value => value.rotate)
  const filter = useTransform(pose, value => `blur(${value.blur}px)`)
  return <span className="scroll-work-outro-mask"><motion.span style={reduced ? {} : { opacity, y, rotate, filter }}>{text}</motion.span></span>
}

/** Native document scrolling controls a reversible stack of clickable work cards. */
export default function ScrollWorkCards({ data, lang, onOpen, entryProgress }: { data: WorksLang; lang: 'zh' | 'en'; onOpen: (item: WorkListItem) => void; entryProgress: MotionValue<number> }) {
  const galleryRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const compact = useIsCompact()
  const mobile = useMobileInput()
  const entryY = useTransform(entryProgress, p => worksPageParallax(p, compact, reduced).incomingY)
  const deckY = useTransform(entryProgress, p => worksPageParallax(p, compact, reduced).deckY)
  const { scrollYProgress } = useScroll({ target: galleryRef, offset: ['start start', 'end end'] })
  const timeline = workTimeline(data.sections.length, mobile)
  const inputProgress = useWorkCardTouch(galleryRef, stageRef, deckRef, scrollYProgress, mobile && !reduced, data.sections.length)
  const cardProgress = useTransform(inputProgress, p => Math.min(1, p / timeline.cardFraction))
  // Keep the invitation on the same native scroll timeline as the departing cards.
  const outroProgress = cardProgress
  const { scrollYProgress: rawExitProgress } = useScroll({ target: galleryRef, offset: ['end end', 'end start'] })
  const exitProgress = rawExitProgress
  const outroOpacity = useTransform(() => workOutroPose(outroProgress.get(), exitProgress.get()).opacity)
  const outroVisibility = useTransform(outroOpacity, opacity => opacity > 0.001 ? 'visible' as const : 'hidden' as const)
  const lineScale = useTransform(() => workOutroPose(outroProgress.get(), exitProgress.get()).lineScale)
  const headingDepartureY = useTransform(cardProgress, [0, 0.12], [0, -110])
  const headingY = useTransform(() => headingDepartureY.get() + entryY.get())
  const headingOpacity = useTransform(cardProgress, [0.04, 0.12], [1, 0])
  return <div id="work-overview" ref={galleryRef} className={`scroll-work-gallery${reduced ? ' scroll-work-gallery--still' : ''}`} data-scroll-work-gallery data-mobile-timeline={mobile} style={{ height: reduced ? 'auto' : `${timeline.heightVh}svh` }}>
    <div ref={stageRef} className="scroll-work-stage">
      <motion.header style={{ y: entryY }} data-works-incoming><span>A FEW THINGS I'VE MADE</span><span>SELECTED WORKS / 2026</span></motion.header>
      <motion.h2 className="scroll-work-title" style={reduced ? {} : { y: headingY, opacity: headingOpacity }}>SCROLL DOWN AND WATCH<br />EVERYTHING FALL INTO PLACE</motion.h2>
      <motion.div ref={deckRef} className="scroll-work-deck" style={{ y: deckY }}>{data.sections.map((section, index) => <Card key={section.id} section={section} index={index} count={data.sections.length} progress={cardProgress} data={data} onOpen={onOpen} reduced={reduced} mobile={mobile} />)}</motion.div>
      <motion.div className="scroll-work-outro" style={reduced ? {} : { visibility: outroVisibility }}>
        <motion.p className="scroll-work-outro-caption" style={reduced ? {} : { opacity: outroOpacity }}>{lang === 'zh' ? '从我的作品，到我们的下一次创作' : 'FROM MY WORK, TO WHAT WE MAKE TOGETHER'}</motion.p>
        <h2><OutroLine text={lang === 'zh' ? '下一件作品，' : 'The next creation,'} index={0} progress={outroProgress} exitProgress={exitProgress} reduced={reduced} /><OutroLine text={lang === 'zh' ? '也许我们一起完成。' : 'could be ours.'} index={1} progress={outroProgress} exitProgress={exitProgress} reduced={reduced} /></h2>
        <motion.div className="scroll-work-outro-line" style={reduced ? {} : { scaleX: lineScale }} aria-hidden="true" />
        <motion.p className="scroll-work-outro-invite" style={reduced ? {} : { opacity: outroOpacity }}>{lang === 'zh' ? '继续向下，一起聊聊你的想法' : 'Keep scrolling. Let’s talk about your idea.'}<span aria-hidden="true">↓</span></motion.p>
      </motion.div>
      <div className="scroll-work-hint">{data.hint} ↓ <span>{data.openLabel} ↗</span></div>
      {!reduced && <div className="scroll-work-progress" aria-hidden="true"><motion.div style={{ scaleX: inputProgress }} /></div>}
    </div>
  </div>
}
