import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { EDITORIAL_EASE } from './motion-config'

interface RevealHeadingProps {
  text: string
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'p'
  delay?: number
  inherit?: boolean
  trigger?: boolean
  duration?: number
  stagger?: number
}

/** Reveal words through individual masks while exposing one accessible title. */
export default function RevealHeading({ text, className = '', as = 'h2', delay = 0, inherit = false, trigger, duration = 1.35, stagger = 0.075 }: RevealHeadingProps) {
  const reduced = useReducedMotion()
  const Heading = { h1: motion.h1, h2: motion.h2, h3: motion.h3, p: motion.p }[as]
  const wordVariants: Variants = {
    hidden: { y: reduced ? '0%' : '115%', scaleY: reduced ? 1 : 0.48, scaleX: reduced ? 1 : 0.88, rotate: reduced ? 0 : 4 },
    show: (index: number) => ({ y: '0%', scaleY: 1, scaleX: 1, rotate: 0, transition: { duration: reduced ? 0 : duration, delay: reduced ? 0 : delay + index * stagger, ease: EDITORIAL_EASE } }),
  }
  const controls = inherit ? {} : trigger !== undefined
    ? { initial: 'hidden', animate: trigger ? 'show' : 'hidden' }
    : { initial: 'hidden', whileInView: 'show', viewport: { once: true, amount: 0.35 } }

  return (
    <Heading className={`reveal-heading ${className}`} aria-label={text} {...controls}>
      {text.split(' ').map((word, index) => (
        <span className="reveal-word-mask" aria-hidden="true" key={`${index}-${word}`}>
          <motion.span className="reveal-word" custom={index} variants={wordVariants}>{word}</motion.span>
        </span>
      ))}
    </Heading>
  )
}
