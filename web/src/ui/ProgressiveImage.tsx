import { useEffect, useState } from 'react'
import { responsiveImage } from '../data/responsiveImage'
import { loadDecodedImage } from './decoded-image'
import './progressive-image.css'

interface Props { src: string; alt: string; lang: 'zh' | 'en'; previewSrc?: string; className?: string }

/** Keep the cached preview visible until the full photograph has decoded. */
export default function ProgressiveImage({ src, alt, lang, previewSrc, className = '' }: Props) {
  const [readySrc, setReadySrc] = useState<string | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => loadDecodedImage(src, () => setReadySrc(src), () => setFailedSrc(src)), [src, attempt])
  const ready = readySrc === src
  const failed = !ready && failedSrc === src
  const preview = previewSrc ? { src: previewSrc } : responsiveImage(src)
  return <span className={`progressive-image ${className}`} aria-busy={!ready && !failed}>
    <img key={src} {...(ready ? { src } : preview)} sizes="100vw" alt={alt} decoding="async" />
    {failed && <span className="progressive-image-status" role="status">
      <span>{lang === 'zh' ? '高清图片暂未加载，保留预览。' : 'Full image unavailable. Preview retained.'}</span>
      <button type="button" onClick={() => { setFailedSrc(null); setAttempt(value => value + 1) }}>{lang === 'zh' ? '重试' : 'Retry'}</button>
    </span>}
  </span>
}
