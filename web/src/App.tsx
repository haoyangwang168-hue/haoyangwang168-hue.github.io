import { Suspense, useCallback, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { MotionConfig, motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion'
import * as THREE from 'three'
import Scene from './scene/Scene'
import RenderActivity from './scene/RenderActivity'
import Resume from './ui/Resume'
import Works from './ui/Works'
import PortraitGallery from './ui/PortraitGallery'
import RevealHeading from './ui/RevealHeading'
import ExploreNav from './ui/ExploreNav'
import ParallaxFooter from './ui/ParallaxFooter'
import { EDITORIAL_EASE } from './ui/motion-config'
import { useParallaxLayer, usePrefersReducedMotion } from './ui/useParallax'
import { SceneBoundary } from './ui/SceneBoundary'
import DissolveTransition from './ui/DissolveTransition'
import ClickSpark from './ui/ClickSpark'
import { useStore } from './store'

function Backdrop() {
  // 点击空白处收起详情
  const setActive = useStore((s) => s.setActive)
  return (
    <mesh position={[0, 0, -40]} onClick={() => setActive(null)}>
      <planeGeometry args={[600, 300]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

type Lang = 'en' | 'zh'

const COPY = {
  en: {
    title: 'HAOYANG WANG',
    tagline: 'Making ideas real through AI, design and images.',
    introduction: "I'm Haoyang Wang. An 18-year-old first-year student from Guangzhou.",
    paragraphs: [
      'Good conversations, different perspectives and the small moments of everyday life.',
      'AI projects, visual design and photography. Explore the work below and the stories behind it.',
    ],
  },
  zh: {
    title: '汪昊阳',
    tagline: '用 AI、设计和影像，把想法做出来。',
    introduction: '我是汪昊阳。18 岁，来自广州，大一在读，ENFJ。',
    paragraphs: [
      '与人交流，听听不同的看法；也用镜头，留住生活里值得记住的瞬间。',
      '从 AI 应用到班服设计，再到摄影与剪辑。向下看看作品，也看看它们背后的故事。',
    ],
  },
}

function Hero({ lang, cueOpacity, ready }: { lang: Lang; cueOpacity: MotionValue<number>; ready: boolean }) {
  const { title, tagline, introduction, paragraphs } = COPY[lang]
  const reduced = useReducedMotion()
  const heroRef = useRef<HTMLElement>(null)
  // Keep the complete introduction readable before its section starts to leave.
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['end end', 'end start'],
  })
  const opacity = useTransform(scrollYProgress, [0.5, 1], [1, 0])
  // Move copy within its columns while the portrait leaves the hero.
  const departure = useTransform(scrollYProgress, [0, 1], [0.5, 1])
  const titleLayer = useParallaxLayer(departure, { y: 24, x: 0, mobileScale: 0.25 })
  const bodyLayer = useParallaxLayer(departure, { y: -16, x: 0, mobileScale: 0.25 })
  const copyVariants = (delay: number) => ({
    hidden: { y: reduced ? 0 : 12, opacity: reduced ? 1 : 0 },
    show: { y: 0, opacity: 1, transition: { duration: reduced ? 0 : 0.55, delay: reduced ? 0 : delay, ease: EDITORIAL_EASE } },
  })
  return (
    <section className="hero" id="about" ref={heroRef}>
      {ready && <span className="face-play-hint">
        {lang === 'en' ? 'Drag my cheeks · give them a pinch' : '拖动脸颊 · 捏捏试试'}
      </span>}
      <motion.div
        className="about"
        lang={lang}
        style={{ opacity: reduced ? 1 : opacity }}
      >
        {/* 入场动画放内层，避免其 fill 锁住 opacity 覆盖外层滚动 opacity */}
        <motion.div className="about-intro" initial="hidden" animate={ready ? 'show' : 'hidden'}>
          <motion.div className="hero-identity" style={titleLayer} data-parallax-layer="hero-title">
            <motion.p className="hero-kicker" variants={copyVariants(0.25)}>PERSONAL PORTFOLIO — 2026</motion.p>
            <RevealHeading text={title} as="h1" className="about-title" inherit delay={0.45} />
            <motion.p className="hero-tagline" variants={copyVariants(0.6)}>{lang === 'zh' ? <><span>用 AI、设计和影像，</span><span>把想法做出来。</span></> : tagline}</motion.p>
            <div className="hero-copy-mask">
              <motion.p className="about-body about-lead" variants={copyVariants(0.9)}>{introduction}</motion.p>
            </div>
          </motion.div>
          <motion.div className="hero-statement" style={bodyLayer} data-parallax-layer="hero-body">
            {paragraphs.map((p, i) => (
              <div key={i} className="hero-copy-mask">
                <motion.div variants={copyVariants(1.05 + i * 0.15)}><h2 className="hero-statement-label">{lang === 'zh' ? ['我喜欢什么', '我在探索什么'][i] : ['WHAT I ENJOY', 'WHAT I’M EXPLORING'][i]}</h2><p className="about-body">{p}</p></motion.div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
      <motion.div className="scroll-cue" style={{ opacity: cueOpacity }} aria-hidden="true">
        <span className="scroll-cue-label">{lang === 'en' ? 'SCROLL TO DISCOVER' : '向下滚动 · 开始探索'}</span>
        <span className="scroll-cue-track">
          <span className="scroll-cue-dot" />
        </span>
      </motion.div>
    </section>
  )
}

export default function App() {
  const [lang, setLang] = useState<Lang>('zh')
  const [sceneFailed, setSceneFailed] = useState(false)
  const [paperDissolveAvailable, setPaperDissolveAvailable] = useState(true)
  const reduced = usePrefersReducedMotion()
  const onSceneError = useCallback(() => setSceneFailed(true), [])
  const onPaperDissolveUnavailable = useCallback(() => setPaperDissolveAvailable(false), [])
  const paperDissolveEnabled = paperDissolveAvailable && !reduced && !sceneFailed
  const { scrollY } = useScroll()
  // 作品区蒙层：以作品区顶部从视口底进入到视口中部的进度，驱动 3D 渐暗 + 模糊
  const worksRef = useRef<HTMLElement>(null)
  const { scrollYProgress: worksProgress } = useScroll({
    target: worksRef,
    offset: ['start end', 'start start'],
  })
  // The paper edge protects measured copy bounds while both pages share the viewport.
  const { scrollYProgress: rawPaperProgress } = useScroll({
    target: worksRef,
    offset: ['start end', 'start start'],
  })
  // Share a short, overdamped response between the background and both page layers.
  const smoothPaperProgress = useSpring(rawPaperProgress, { stiffness: 300, damping: 32, mass: 0.45, restDelta: 0.00001, restSpeed: 0.00001 })
  const paperProgress = useTransform(() => Math.max(0, Math.min(1, reduced ? rawPaperProgress.get() : smoothPaperProgress.get())))
  const fogBg = useTransform(
    worksProgress,
    [0, 1],
    ['rgba(10, 10, 13, 0)', 'rgba(10, 10, 13, 0.22)'] // 压暗减半（原 0.82）
  )
  // 滚动渐暗：离开首屏后压暗 3D 场景，保证履历文字可读
  const scrimOpacity = useTransform(scrollY, [0, 520], [0, 0.4])
  // 首屏滚动提示随之淡出
  const cueOpacity = useTransform(scrollY, [0, 160], [1, 0])
  // 磨砂右轨：进入履历区后淡入（首屏不磨砂）
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const railOpacity = useTransform(scrollY, [vh * 0.5, vh * 1.1], [0, 1])

  return (
    <MotionConfig reducedMotion="user">
      {/* The page stays usable while the portrait loads in Suspense. */}
      <div>

      {/* 固定的 3D 背景 */}
      <div className="scene-bg">
        {sceneFailed ? (
          <div className="scene-fallback">
            <img src={`${import.meta.env.BASE_URL}avatar/haoyang-toy-front.png`} alt="" />
          </div>
        ) : (
        <SceneBoundary onError={onSceneError}>
        <Canvas
          shadows={false}
          dpr={[1, 1.25]}
          frameloop="demand"
          camera={{ position: [0, 5, 19], fov: 39, near: 0.1, far: 500 }}
          gl={{ antialias: true, stencil: false, depth: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <color attach="background" args={['#0a0a0d']} />
          <Suspense fallback={null}>
            <Backdrop />
            <Scene />
            <RenderActivity coverProgress={paperProgress} />
          </Suspense>
        </Canvas>
        </SceneBoundary>
        )}
      </div>
      {sceneFailed && (
        <button className="scene-retry" onClick={() => {
          useGLTF.clear(`${import.meta.env.BASE_URL}models/me.glb`)
          setSceneFailed(false)
        }}>
          {lang === 'zh' ? '重新加载 3D' : 'Reload 3D'}
        </button>
      )}

      {/* 滚动渐暗蒙层 */}
      <motion.div className="scrim" style={{ opacity: scrimOpacity }} aria-hidden="true" />

      {/* 作品区固定蒙层：仅压暗（减半），模糊先注释掉 */}
      <motion.div
        className="stage-fog"
        style={{ background: fogBg /* , backdropFilter: fogBlur, WebkitBackdropFilter: fogBlur */ }}
        aria-hidden="true"
      />

      {/* 固定磨砂右轨（进入履历区淡入） */}
      <motion.div className="glass-rail" style={{ opacity: railOpacity }} aria-hidden="true" />

      <DissolveTransition mode="paper" containerRef={worksRef} progress={paperProgress} enabled={paperDissolveEnabled} onUnavailable={onPaperDissolveUnavailable} />

      {/* 首屏底部渐变底色，滚动后淡出 —— 暂时注释查看效果 */}
      {/* <motion.div
        className="hero-gradient"
        style={{ opacity: heroGradientOpacity }}
        aria-hidden="true"
      /> */}

      <ExploreNav
        lang={lang}
        ready
        onToggleLanguage={() => setLang((value) => value === 'en' ? 'zh' : 'en')}
      />

      {/* 可滚动内容 */}
      <main className="content" lang={lang}>
        <Hero lang={lang} cueOpacity={cueOpacity} ready />
        <PortraitGallery lang={lang} />
        <Resume lang={lang} transitionProgress={paperProgress} />
        <Works lang={lang} innerRef={worksRef} dissolveProgress={paperProgress} dissolveEnabled={paperDissolveEnabled} />
        <ParallaxFooter lang={lang} />
      </main>
      </div>
      <ClickSpark enabled sparkColor="#e6c979" sparkSize={14} sparkRadius={30} sparkCount={8} duration={450} />
    </MotionConfig>
  )
}
