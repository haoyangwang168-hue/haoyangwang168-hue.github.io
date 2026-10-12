import type { SVGProps } from 'react'

/** Original text wordmark; the author's brand artwork is not reused. */
export function HaoyangLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 340 90" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Haoyang" {...props}>
      <text x="8" y="65" fill="currentColor" fontFamily="Mansalva, cursive" fontSize="72" letterSpacing="-3">Haoyang.</text>
    </svg>
  )
}
