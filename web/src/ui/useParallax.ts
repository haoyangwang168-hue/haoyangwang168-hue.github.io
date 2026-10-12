import { useSyncExternalStore } from 'react'
import { useTransform, type MotionValue } from 'framer-motion'

const COMPACT_QUERY = '(max-width: 640px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
export const VERTICAL_GALLERY_QUERY = '(max-width: 900px), (max-height: 720px)'

function subscribeGallery(onChange: () => void): () => void {
  const query = window.matchMedia(VERTICAL_GALLERY_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function gallerySnapshot(): boolean {
  return window.matchMedia(VERTICAL_GALLERY_QUERY).matches
}

/** Use document flow when a pinned card cannot comfortably fit the viewport. */
export function useIsVerticalGallery(): boolean {
  return useSyncExternalStore(subscribeGallery, gallerySnapshot, () => false)
}

function subscribeCompact(onChange: () => void): () => void {
  const query = window.matchMedia(COMPACT_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function compactSnapshot(): boolean {
  return window.matchMedia(COMPACT_QUERY).matches
}

/** Match the gallery's phone breakpoint without subscribing React to scroll frames. */
export function useIsCompact(): boolean {
  return useSyncExternalStore(subscribeCompact, compactSnapshot, () => false)
}

function subscribeReduced(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function reducedSnapshot(): boolean {
  return window.matchMedia(REDUCED_QUERY).matches
}

/** Keep decorative motion in sync when the OS preference changes while browsing. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, reducedSnapshot, () => false)
}

interface ParallaxOptions {
  y?: number
  x?: number
  rotate?: number
  mobileScale?: number
}

interface ParallaxStyle {
  y: MotionValue<number>
  x: MotionValue<number>
  rotate: MotionValue<number>
}

/** Move an inner visual layer; its measured section must remain untransformed. */
export function useParallaxLayer(
  progress: MotionValue<number>,
  { y = 64, x = 0, rotate = 0, mobileScale = 0.4 }: ParallaxOptions = {},
): ParallaxStyle {
  const compact = useIsCompact()
  const reduced = usePrefersReducedMotion()
  const strength = reduced ? 0 : compact ? mobileScale : 1
  const translateY = useTransform(progress, [0, 0.5, 1], [y * strength, 0, -y * strength])
  const translateX = useTransform(progress, [0, 0.5, 1], [x * strength, 0, -x * strength])
  const rotation = useTransform(progress, [0, 0.5, 1], [rotate * strength, 0, -rotate * strength])
  return { y: translateY, x: translateX, rotate: rotation }
}
