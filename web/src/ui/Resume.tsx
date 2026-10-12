import { motion, useTransform, type MotionValue } from 'framer-motion'
import { FOCUS_POINTS } from '../data/focusPoints'
import RevealHeading from './RevealHeading'
import { EDITORIAL_EASE } from './motion-config'
import { useIsCompact, usePrefersReducedMotion } from './useParallax'
import { worksPageParallax } from './works-transition'
import './resume-motion.css'

type Lang = 'zh' | 'en'
interface JourneyEntry { chapter: string; period: string; title: string; role: string; points: string[] }
const JOURNEY: Record<Lang, JourneyEntry[]> = {
  zh: [
    { chapter: 'START', period: '高二 → 高考后', title: '从真实的尝试开始', role: '起点 · 认识自己的兴趣', points: ['高二时尝试打印机销售，高考后在家人的带领下接触数字资产交易。', '这些经历让我开始思考自己的方向，也让我更愿意通过实践了解一件事。'] },
    { chapter: 'TOGETHER', period: 'LPT 第七期', title: '让不同的想法一起向前', role: '小组组长 · 获评最佳组长', points: ['组织讨论、跟进学习与打卡，协调合作，支持组员完成各自的目标。', '在共同构思的「知识星域」项目中，我负责独立设计与实现，并参与合作讲解；项目获得 Demo 视觉美学奖。'] },
    { chapter: 'CREATE', period: 'AI · 视觉设计 · 摄影', title: '把表达落在具体作品上', role: '创作 · 在画面与实践之间', points: ['为我们班设计班服，用设计留下属于这个集体的记忆。', '用摄影记录旅途与日常，也尝试剪辑和舞台表演。下面是这些尝试留下的作品与片段。'] },
  ],
  en: [
    { chapter: 'START', period: 'High school → After graduation', title: 'Learning through real attempts', role: 'Beginnings · Finding my interests', points: ['Tried selling printers in high school and explored digital assets with guidance from family after graduation.', 'These experiences made me think about my direction and learn through practice.'] },
    { chapter: 'TOGETHER', period: 'LPT · Cohort 7', title: 'Moving different ideas forward together', role: 'Group leader · Best Group Leader recognition', points: ['Organized discussions, supported learning and check-ins, and coordinated collaboration.', 'For the team-conceived Knowledge Star project, I designed and built the application and joined the presentation. The project received the Demo Visual Aesthetics Award.'] },
    { chapter: 'CREATE', period: 'AI · Visual design · Photography', title: 'Giving ideas a visible form', role: 'Creating · Through images and practice', points: ['Designed a T-shirt for our class, turning shared memories into something we could wear.', 'Record travel and everyday life through photography, alongside editing and stage performance. Explore the work and moments below.'] },
  ],
}

/** Stationary chapter anchors keep the original camera journey aligned with the text. */
export default function Resume({ lang, transitionProgress }: { lang: Lang; transitionProgress: MotionValue<number> }) {
  const reduced = usePrefersReducedMotion()
  const compact = useIsCompact()
  const departureY = useTransform(transitionProgress, p => worksPageParallax(p, compact, reduced).outgoingY)
  const reveal = { hidden: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 12 }, show: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.5, ease: EDITORIAL_EASE } } }
  return <section className="resume resume--editorial" lang={lang} aria-label={lang === 'zh' ? '我的经历' : 'My journey'}>
    <motion.div className="resume-heading" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={reveal}>
      <p className="resume-kicker"><span>{lang === 'zh' ? '三个片段，认识我' : 'THREE CHAPTERS ABOUT ME'}</span><span>01 — 03</span></p>
      <RevealHeading text="JOURNEY" className="resume-title" inherit />
      <p className="resume-explore">{lang === 'zh' ? '从尝试，到合作，再到创作。' : 'From beginnings, to collaboration, to creating.'}<span aria-hidden="true">↘</span></p>
    </motion.div>
    <div className="timeline">{JOURNEY[lang].map((entry, index) => <div className="tl-entry" data-point={FOCUS_POINTS[index]} key={entry.chapter}>
      <motion.div className="tl-body" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }} variants={reveal}>
        <motion.div className="tl-parallax-story" data-works-outgoing={index === JOURNEY[lang].length - 1 ? '' : undefined} style={index === JOURNEY[lang].length - 1 ? { y: departureY } : undefined}>
          <div className="tl-chapter"><div className="tl-chapter-meta" aria-hidden="true"><span className="tl-chapter-number">0{index + 1}</span><span className="tl-chapter-rule" /><span>/ 03</span></div><h3 className="tl-chapter-title">{entry.chapter}</h3></div>
          <div className="tl-content"><p className="tl-period">{entry.period}</p><h4 className="tl-place">{entry.title}</h4><p className="tl-role">{entry.role}</p><ul className="tl-points">{entry.points.map(point => <li key={point}>{point}</li>)}</ul></div>
        </motion.div>
      </motion.div>
    </div>)}</div>
  </section>
}
