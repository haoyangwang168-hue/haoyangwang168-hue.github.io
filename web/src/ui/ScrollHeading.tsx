import { motion, useTransform, type MotionValue } from 'framer-motion'
import { usePrefersReducedMotion } from './useParallax'

interface ScrollHeadingProps {
  text: string
  progress: MotionValue<number>
  as?: 'h2' | 'h3'
  className?: string
}

function ScrollLetter({ letter, index, count, progress, reduced }: {
  letter: string
  index: number
  count: number
  progress: MotionValue<number>
  reduced: boolean
}) {
  // All letters settle before the heading reaches its central reading position.
  const delay = count > 1 ? index / (count - 1) * 0.1 : 0
  const y = useTransform(progress, [delay, 0.25 + delay], ['112%', '0%'])
  const rotate = useTransform(progress, [delay, 0.25 + delay], [14, 0])
  return (
    <span className="scroll-letter-mask">
      <motion.span className="scroll-letter" style={{ y: reduced ? 0 : y, rotate: reduced ? 0 : rotate }}>{letter}</motion.span>
    </span>
  )
}

/** Scrub typography in both directions while keeping a single accessible label. */
export default function ScrollHeading({ text, progress, as: Heading = 'h2', className = '' }: ScrollHeadingProps) {
  const reduced = usePrefersReducedMotion()
  const words = text.split(' ')
  const count = [...words.join('')].length
  return (
    <Heading className={`scroll-heading ${className}`} aria-label={text}>
      {words.map((word, wordIndex) => {
        const offset = words.slice(0, wordIndex).join('').length
        return (
          <span className="scroll-word" aria-hidden="true" key={`${wordIndex}-${word}`}>
            {[...word].map((letter, index) => (
              <ScrollLetter key={index} letter={letter} index={offset + index} count={count} progress={progress} reduced={reduced} />
            ))}
          </span>
        )
      })}
    </Heading>
  )
}
