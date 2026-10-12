import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode, type Ref, type RefObject } from 'react'
import { motion, AnimatePresence, useScroll, useTransform, type MotionValue, type Variants } from 'framer-motion'
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { WORKS, type WorkListItem, type WorksLang } from '../data/works'
import { getWorkDoc } from '../data/workDocs'
import { extractWorkMedia } from '../data/workMedia'
import { getWorkBrief } from '../data/workBriefs'
import { PHOTOGRAPHY_SERIES, photographySeriesImages } from '../data/photographySeries'
import InfiniteImageGallery from './InfiniteImageGallery'
import RevealHeading from './RevealHeading'
import ScrollWorkCards from './ScrollWorkCards'
import { EDITORIAL_EASE } from './motion-config'
import { useParallaxLayer, usePrefersReducedMotion } from './useParallax'
import './works-motion.css'

function riseVariants(reduced: boolean): Variants {
  return {
    hidden: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.32, ease: EDITORIAL_EASE } },
  }
}

const DetailScrollContext = createContext<RefObject<HTMLElement> | undefined>(undefined)

/** Measure an untransformed block inside the article's own scroll container. */
function DetailParallax({ children, label, depth = 18, drift = 0, rotate = 0, className = '' }: {
  children: ReactNode
  label: string
  depth?: number
  drift?: number
  rotate?: number
  className?: string
}) {
  const container = useContext(DetailScrollContext)
  const anchorRef = useRef<HTMLDivElement>(null)
  // The dialog ref belongs to our parent and is only ready after layout effects.
  const { scrollYProgress } = useScroll({ container, target: anchorRef, layoutEffect: false, offset: ['start end', 'end start'] })
  const layer = useParallaxLayer(scrollYProgress, { y: depth, x: drift, rotate, mobileScale: 0.7 })
  // Each block keeps its complete travel inside its own layout space.
  const travelStyle = { '--detail-travel': `${Math.abs(depth)}px` } as CSSProperties
  return (
    <div className={`wk-detail-parallax ${className}`} ref={anchorRef} style={travelStyle} data-parallax-anchor={label}>
      <motion.div className="wk-detail-parallax-layer" style={layer} data-parallax-layer={label}>
        {children}
      </motion.div>
    </div>
  )
}

function DetailParagraph({ node, ...props }: ComponentProps<'p'> & ExtraProps) {
  const hasMedia = node?.children.some(child => child.type === 'element' && (child.tagName === 'img' || child.tagName === 'video')) ?? false
  return (
    <DetailParallax label={hasMedia ? 'detail-media' : 'detail-paragraph'} depth={hasMedia ? -32 : 0}>
      <p {...props} />
    </DetailParallax>
  )
}

function DetailHeading({ node, ...props }: ComponentProps<'h2'> & ExtraProps) {
  const Heading = node?.tagName === 'h3' ? 'h3' : 'h2'
  return (
    <DetailParallax label="detail-heading" depth={0}>
      <Heading {...props} />
    </DetailParallax>
  )
}

function DetailList({ node: _node, ...props }: ComponentProps<'ul'> & ExtraProps) {
  return (
    <DetailParallax label="detail-list" depth={0}>
      <ul {...props} />
    </DetailParallax>
  )
}

const DETAIL_MARKDOWN_COMPONENTS: Components = {
  p: DetailParagraph,
  h2: DetailHeading,
  h3: DetailHeading,
  ul: DetailList,
}

// 全屏沉浸详情：渲染该作品的 md（banner + 标题 + markdown 正文 + 外链）；
// 无 md 时回退到占位 banner + meta/标签简介
function WorkDetail({
  item,
  data,
  onClose,
  lang,
}: {
  item: WorkListItem
  data: WorksLang
  onClose: () => void
  lang: 'zh' | 'en'
}) {
  const reduced = usePrefersReducedMotion()
  const detailRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [series, setSeries] = useState('all')
  const { scrollYProgress: detailProgress } = useScroll({ container: detailRef })
  const doc = getWorkDoc(item.slug)
  const title = (doc && doc.title) || item.name
  const media = useMemo(() => extractWorkMedia(doc?.body ?? '', doc?.banner, title), [doc, title])
  const photography = item.slug?.replace(/-en$/, '') === 'photography'
  const galleryImages = useMemo(() => photography ? photographySeriesImages(media.images, series) : media.images, [media.images, photography, series])
  const brief = getWorkBrief(item.slug, lang)
  // 有 md 详情时展示完整信息；无 md 时详情页只保留标题 + 统一占位文案
  const link = doc ? doc.link || item.link : null
  const tags = doc ? doc.tags || item.tags : null
  // 副标题不含年份；标签单独做 badge 展示
  const sub = doc?.role ?? ''
  const rise = riseVariants(reduced)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus({ preventScroll: true })
    return () => previousFocus?.focus({ preventScroll: true })
  }, [])

  return (
    <DetailScrollContext.Provider value={detailRef}>
      <motion.div
        className="wk-detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.1 : 0.18, ease: EDITORIAL_EASE }}
        onClick={onClose}
      />
      <motion.div
        className="wk-detail"
        ref={detailRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          // Keep keyboard exploration within the open article.
          const stops = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], audio[controls], [tabindex]:not([tabindex="-1"])'))
            .filter(element => element.getClientRects().length > 0)
          const first = stops[0]
          const last = stops[stops.length - 1]
          if (!first || !last) return
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }}
        initial="hidden"
        animate="show"
        exit="exit"
        variants={{
          hidden: { opacity: 0, y: reduced ? 0 : 32 },
          show: { opacity: 1, y: 0, transition: { duration: reduced ? 0.1 : 0.36, ease: EDITORIAL_EASE, staggerChildren: reduced ? 0 : 0.025 } },
          exit: { opacity: 0, y: reduced ? 0 : 12, transition: { duration: reduced ? 0.1 : 0.18, ease: EDITORIAL_EASE } },
        }}
      >
        <motion.div className="wk-detail-progress" style={{ scaleX: detailProgress }} aria-hidden="true" />
        <button ref={closeRef} className="wk-detail-close" onClick={onClose} aria-label={data.closeLabel}>
          ✕
        </button>

        <div className="wk-detail-intro">
          <DetailParallax label="detail-title" depth={0}>
            <header className="wk-detail-head">
              <motion.span className="wk-detail-eyebrow" variants={rise}>IN FOCUS / SELECTED WORK</motion.span>
              <RevealHeading text={title} className="wk-detail-title" as="h3" inherit duration={0.36} stagger={0.025} />
              {sub && <motion.div className="wk-detail-sub" variants={rise}>{sub}</motion.div>}
              {tags && tags.length > 0 && (
                <motion.div className="wk-detail-tags" variants={rise}>
                  {tags.map((t, i) => (
                    <span key={i} className="wk-badge">
                      {t}
                    </span>
                  ))}
                </motion.div>
              )}
            </header>
          </DetailParallax>
        </div>
        {brief && <dl className="wk-project-facts">{[
          [lang === 'zh' ? '做了什么' : 'THE PROJECT', brief.objective],
          [lang === 'zh' ? '我的参与' : 'MY CONTRIBUTION', brief.contribution],
          [lang === 'zh' ? '留下的成果' : 'THE OUTCOME', brief.outcome],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        {photography && <div className="photography-series" role="group" aria-label={lang === 'zh' ? '摄影系列' : 'Photography series'}>
          <button aria-pressed={series === 'all'} onClick={() => setSeries('all')}>{lang === 'zh' ? '全部作品' : 'All photographs'} <span>{media.images.length}</span></button>
          {PHOTOGRAPHY_SERIES.map(group => <button key={group.id} aria-pressed={series === group.id} onClick={() => setSeries(group.id)}>{group[lang]} <span>{group.files.length}</span></button>)}
        </div>}
        {galleryImages.length > 0 && <InfiniteImageGallery key={series} images={galleryImages} lang={lang} />}

        <motion.article className="wk-detail-article" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.025 } } }}>
          {doc && media.body ? (
            <motion.div className="wk-md" variants={rise}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={DETAIL_MARKDOWN_COMPONENTS}>
                {media.body}
              </ReactMarkdown>
            </motion.div>
          ) : (
            // 无 md：演示详情页支持的组件 —— 介绍文本 + 图片/视频占位 + 跳转按钮
            <>
              <DetailParallax label="detail-placeholder-text" depth={26}>
                <p className="wk-detail-desc">{data.detailPlaceholder}</p>
              </DetailParallax>
              <DetailParallax label="detail-placeholder-media" depth={-88}>
                <div className="wk-detail-ph-img" aria-hidden="true">
                  <span className="wk-detail-ph-img-label">{data.phImageLabel}</span>
                </div>
              </DetailParallax>
              <span className="wk-detail-link is-ph" role="button" aria-disabled="true">
                {data.phButtonLabel} <span aria-hidden="true">↗</span>
              </span>
            </>
          )}

          {link && (
            <a
              className="wk-detail-link"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {data.visitLabel} <span aria-hidden="true">↗</span>
            </a>
          )}
        </motion.article>
      </motion.div>
    </DetailScrollContext.Provider>
  )
}

export default function Works({ lang, innerRef, dissolveProgress, dissolveEnabled }: {
  lang: 'en' | 'zh'
  innerRef: Ref<HTMLElement>
  dissolveProgress: MotionValue<number>
  dissolveEnabled: boolean
}) {
  const data = WORKS[lang]
  const [active, setActive] = useState<WorkListItem | null>(null)
  useEffect(() => setActive(null), [lang])
  const paperOpacity = useTransform(dissolveProgress, value => value >= 1 ? 1 : 0)

  // 详情打开时锁滚动 + ESC 关闭
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [active])

  return (
    <section className="works works--editorial" lang={lang} ref={innerRef}>
      <motion.div className="wk-paper-surface" style={{ opacity: dissolveEnabled ? paperOpacity : 1 }} aria-hidden="true" />
      <ScrollWorkCards lang={lang} data={data} onOpen={setActive} entryProgress={dissolveProgress} />

      <AnimatePresence>
        {active && (
          <WorkDetail
            key={active.slug || active.name}
            item={active}
            data={data}
            lang={lang}
            onClose={() => setActive(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
