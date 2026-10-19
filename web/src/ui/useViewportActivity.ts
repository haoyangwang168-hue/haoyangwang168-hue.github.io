import { useEffect, type RefObject } from 'react'

/** Observe the fixed-size stage, leaving its scroll geometry and content mounted. */
export function observeViewportActivity(element: HTMLElement): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {}
  let disposed = false
  const observer = new IntersectionObserver(([entry]) => {
    if (!disposed && entry) {
      element.dataset.viewportActive = String(entry.isIntersecting)
    }
  }, { rootMargin: '160px' })
  observer.observe(element)
  return () => {
    disposed = true
    observer.disconnect()
    delete element.dataset.viewportActive
  }
}

/** Release compositor hints while fixed-size animation stages are outside the viewport. */
export function useViewportActivity(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (ref.current) return observeViewportActivity(ref.current)
  }, [ref])
}
