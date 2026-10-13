import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { usePrefersReducedMotion } from './useParallax'
import { footerPose } from './footer-motion'
import ContactDialog from './ContactDialog'
import './parallax-footer.css'

interface ParallaxFooterProps { lang: 'en' | 'zh' }
const COPY = {
  zh: { chapter: '下一站，一起创造', headline: ['有个新想法？', '我们一起做出来。'], contact: '来聊聊你的想法', phone: '电话联系汪昊阳', back: '回到开头', note: '保持好奇，继续创造。', button: '联系我' },
  en: { chapter: 'THE NEXT CHAPTER, TOGETHER', headline: ['Have an idea?', 'Let’s make it real.'], contact: 'START A CONVERSATION', phone: 'Call Haoyang', back: 'BACK TO TOP', note: 'Stay curious. Keep creating.', button: 'CONTACT ME' },
} as const
// Fixed outlines keep echoes registered independently of font loading.
// High-contrast serif outlines: slender stems and hairlines remain crisp at every scale.
const BUILD_PATH = 'M65 100H145C232 100 237 182 163 196C252 204 247 300 151 300H65V297H85V103H65Z M101 103V194H140C215 194 211 103 140 103Z M101 197V297H145C230 297 230 197 145 197Z M262 100H316V103H298V238C298 276 315 297 346 297C380 297 397 275 397 237V103H378V100H419V103H401V237C401 281 381 303 342 303C303 303 282 279 282 238V103H262Z M515 100H572V103H552V297H614C640 297 646 277 651 252H654L650 300H515V297H536V103H515Z M697 100H766C880 100 880 300 766 300H697V297H717V103H697Z M733 103V297H765C864 297 864 103 765 103Z'
const I_SERIFS = 'M423 100H477V103H423Z M423 297H477V300H423Z'
const I_PATH = 'M423 100H477V103H458V297H477V300H423V297H442V103H423Z'
function EchoLayer({ index, progress, reduced }: { index: number; progress: MotionValue<number>; reduced: boolean }) {
  const group = useRef<SVGGElement>(null)
  const transform = useTransform(progress, (p) => {
    const pose = footerPose(p, index)
    return `translate(450 ${200 + pose.y}) scale(${pose.scale}) translate(-450 -200)`
  })
  useMotionValueEvent(transform, 'change', (value) => group.current?.setAttribute('transform', value))
  return <g ref={group} style={{ display: reduced ? 'none' : undefined, opacity: 0.4 + index * 0.07 }} transform={transform.get()} className="pf-echo"><path d={BUILD_PATH} fillRule="evenodd" /><path d={I_PATH} /></g>
}
/** Scroll owns the reversible timeline; no wheel interception or timers. */
export default function ParallaxFooter({ lang }: ParallaxFooterProps) {
  const [contactOpen, setContactOpen] = useState(false)
  const closeContact = useCallback(() => setContactOpen(false), [])
  const stage = useRef<HTMLElement>(null)
  const front = useRef<SVGGElement>(null)
  const letter = useRef<SVGGElement>(null)
  const reduced = usePrefersReducedMotion()
  const copy = COPY[lang]
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start start', 'end end'] })
  // Native scroll drives every layer without a delayed spring tail.
  const progress = scrollYProgress
  const morphProgress = useTransform(scrollYProgress, p => reduced ? 1 : footerPose(p).morph)
  const letterTransform = useTransform(() => {
    const value = morphProgress.get()
    const morph = reduced ? 1 : value
    const pose = footerPose(progress.get(), 5)
    const scale = reduced ? 1.3 : pose.scale + (1.3 - pose.scale) * morph
    return `translate(450 ${200 + pose.y + morph * 145}) rotate(${morph * 90}) scale(${scale}) translate(-450 -200)`
  })
  const frontTransform = useTransform(progress, (p) => {
    const pose = footerPose(reduced ? 1 : p, 5)
    return `translate(450 ${200 + pose.y}) scale(${pose.scale}) translate(-450 -200)`
  })
  useMotionValueEvent(letterTransform, 'change', (value) => letter.current?.setAttribute('transform', value))
  useMotionValueEvent(frontTransform, 'change', (value) => front.current?.setAttribute('transform', value))
  useEffect(() => {
    letter.current?.setAttribute('transform', letterTransform.get())
    front.current?.setAttribute('transform', frontTransform.get())
  }, [reduced, letterTransform, frontTransform])
  const labelOpacity = useTransform(morphProgress, [0.85, 1], [0, 1])
  // Widen only the I stem during the morph; the final contact hit area stays generous.
  const letterWidth = useTransform(morphProgress, p => 16 + 24 * (reduced ? 1 : p))
  const letterX = useTransform(letterWidth, width => 450 - width / 2)
  const serifOpacity = useTransform(morphProgress, p => reduced ? 0 : 1 - p)
  const mobileStroke = useTransform(morphProgress, (p) => `${(reduced ? 1 : p) * 40}px`)
  return (
    <footer className={`parallax-footer${reduced ? ' pf-reduced' : ''}`} ref={stage} lang={lang} aria-labelledby="footer-invitation">
      <div className="pf-sticky">
        <div className="pf-topline"><p>{copy.chapter}</p><span>GUANGZHOU, CN</span></div>
        <div className="pf-invitation"><h2 id="footer-invitation">{copy.headline.map((line) => <span key={line}>{line}</span>)}</h2><div className="pf-contact"><p>{copy.contact}</p><a href="tel:+8619120353235" aria-label={`${copy.phone} · 191 2035 3235`}>191 2035 3235 ↗</a></div></div>
        <motion.div className="pf-build" style={{ '--pf-button-stroke': mobileStroke } as import('framer-motion').MotionStyle}><svg viewBox="0 0 900 440" xmlns="http://www.w3.org/2000/svg">
          <g aria-hidden="true">{[0, 1, 2, 3, 4].map((index) => <EchoLayer key={index} index={index} progress={progress} reduced={reduced} />)}<g ref={front} transform={frontTransform.get()} className="pf-build-front"><path d={BUILD_PATH} fillRule="evenodd" /></g></g>
          <motion.a href="#contact-info" onClick={event => { event.preventDefault(); setContactOpen(true) }} aria-label={lang === 'zh' ? '打开联系方式' : 'Open contact details'} aria-haspopup="dialog" className="pf-morph-link">
            <g ref={letter} transform={letterTransform.get()}><motion.path d={I_SERIFS} style={{ opacity: serifOpacity }} /><motion.rect x={letterX} y="100" width={letterWidth} height="200" /></g>
            <motion.text x="450" y="371" textAnchor="middle" dominantBaseline="middle" style={{ opacity: reduced ? 1 : labelOpacity }} aria-hidden="true">{copy.button}</motion.text>
          </motion.a>
        </svg></motion.div>
        <div className="pf-bottomline"><span>© {new Date().getFullYear()} HAOYANG WANG<br />{copy.note}</span><button type="button" className="pf-back" onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })}>{copy.back} ↑</button></div>
      </div>
      {contactOpen && <ContactDialog lang={lang} onClose={closeContact} />}
    </footer>
  )
}
