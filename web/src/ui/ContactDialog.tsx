import { useEffect, useRef, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { usePrefersReducedMotion } from './useParallax'
import { EDITORIAL_EASE } from './motion-config'
import './contact-dialog.css'

/** Native modal keeps contact details above the scene and restores keyboard focus. */
export default function ContactDialog({ lang, onClose }: { lang: 'zh' | 'en'; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const reduced = usePrefersReducedMotion()
  const zh = lang === 'zh'
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copyWeChat = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText('topteam1219')
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.close()
      document.documentElement.style.overflow = overflow
      focus?.focus({ preventScroll: true })
    }
  }, [])
  const reveal: Variants = {
    hidden: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 24 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.55, ease: EDITORIAL_EASE } },
  }
  return <dialog ref={dialog} id="contact-info" className="contact-dialog" aria-labelledby="contact-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <motion.div className="contact-card" initial="hidden" animate="show"
      variants={{ show: { transition: { staggerChildren: reduced ? 0 : 0.1 } } }}>
      <button className="contact-close" autoFocus onClick={onClose} aria-label={zh ? '关闭联系方式' : 'Close contact details'}>×</button>
      <motion.header variants={reveal}><span>LET’S TALK / HAOYANG</span><h2 id="contact-title">{zh ? '一起聊聊。' : 'Let’s talk.'}</h2><p>{zh ? '想聊创作、交流想法，或一起做点有意思的事？欢迎联系我。' : 'Have a creative idea, something to share, or a project in mind? Get in touch.'}</p></motion.header>
      <div className="contact-details">
        <div className="contact-addresses">
          <motion.div variants={reveal}><span>{zh ? '微信号' : 'WECHAT'}</span><strong>topteam1219</strong><button className="contact-action" onClick={copyWeChat}>{zh ? '复制微信号' : 'Copy WeChat ID'} ↗</button><p role="status">{copyStatus === 'copied' ? (zh ? '已复制，打开微信搜索即可。' : 'Copied. Search this ID in WeChat.') : copyStatus === 'failed' ? (zh ? '暂时无法自动复制，请长按或选中微信号复制。' : 'Copy unavailable. Select the ID above to copy it manually.') : (zh ? '搜索微信号，或扫描二维码添加我。' : 'Search my WeChat ID or scan the QR code.')}</p></motion.div>
          <motion.div variants={reveal}><span>{zh ? '电话号码' : 'PHONE'}</span><a href="tel:+8619120353235">191 2035 3235 ↗</a><p>{zh ? '点击号码即可拨打电话。' : 'Tap the number to call.'}</p></motion.div>
        </div>
        <motion.figure variants={reveal}><img src={`${import.meta.env.BASE_URL}media/haoyang-wechat.jpg`} alt={zh ? '汪昊阳的微信二维码，微信号 topteam1219' : 'Haoyang’s WeChat QR code, ID topteam1219'} /><figcaption>{zh ? '扫码添加微信 · 期待认识你' : 'SCAN TO CONNECT'}</figcaption><a className="contact-action" href={`${import.meta.env.BASE_URL}media/haoyang-wechat.jpg`} download="haoyang-wechat.jpg">{zh ? '保存二维码' : 'Save QR code'} ↓</a><p className="contact-save-note">{zh ? '也可以长按图片保存。' : 'You can also press and hold the image to save.'}</p></motion.figure>
      </div>
    </motion.div>
  </dialog>
}
