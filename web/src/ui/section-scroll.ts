import { workTimeline } from './work-outro.ts'
import { workCardStop } from './portrait-math.ts'

export interface ScrollStop {
  id: string
  top: number
}

const LANDING_TOLERANCE = 24

/** Collapse clamped destinations so the document ends never become empty pages. */
export function normalizeStops(stops: ScrollStop[], maximum: number): ScrollStop[] {
  const limit = Number.isFinite(maximum) ? Math.max(0, maximum) : 0
  return stops
    .filter(stop => Number.isFinite(stop.top))
    .map(stop => ({ ...stop, top: Math.min(limit, Math.max(0, stop.top)) }))
    .sort((a, b) => a.top - b.top)
    .filter((stop, index, all) => index === 0 || stop.top - all[index - 1].top > 2)
}

/** Shared with the pinned gallery: vertical travel equals horizontal card travel. */
export function horizontalCardStop(galleryTop: number, relativeLeft: number, cardWidth: number, viewportWidth: number, range: number): number {
  return galleryTop + Math.min(Math.max(0, range), Math.max(0, relativeLeft - (viewportWidth - cardWidth) / 2))
}

/** Measure stationary outer anchors afresh after fonts, language or viewport changes. */
export function getSectionStops(verticalGallery: boolean): ScrollStop[] {
  const height = window.innerHeight
  const maximum = document.documentElement.scrollHeight - height
  const documentTop = (element: Element): number => element.getBoundingClientRect().top + window.scrollY
  const stops: ScrollStop[] = [{ id: 'hero', top: 0 }]
  const intro = document.querySelector('.hero .about')
  // Narrow layouts have a full portrait screen before the introduction.
  if (intro && documentTop(intro) > height * 0.75) {
    stops.push({ id: 'introduction', top: documentTop(intro) - height * 0.2 })
  }
  document.querySelectorAll<HTMLElement>('.tl-entry[data-point]').forEach(entry => {
    stops.push({ id: entry.dataset.point ?? '', top: documentTop(entry) - height * 0.3 })
  })
  const gallery = document.querySelector('.wk-gallery')
  const cardGallery = document.querySelector<HTMLElement>('[data-scroll-work-gallery]')
  if (cardGallery) {
    const cards = cardGallery.querySelectorAll<HTMLElement>('[data-work-card]')
    const travel = Math.max(0, cardGallery.offsetHeight - height)
    const still = cardGallery.classList.contains('scroll-work-gallery--still')
    const mobile = cardGallery.dataset.mobileTimeline === 'true'
    // Land inside the active interval; fractional viewport pixels can straddle its boundary.
    cards.forEach((card, index) => {
      stops.push({ id: `work-${index}`, top: still ? documentTop(card) - 88 : documentTop(cardGallery) + travel * workTimeline(cards.length, mobile).cardFraction * Math.min(1, workCardStop(index, cards.length) + 0.015) })
    })
  }
  const track = document.querySelector<HTMLElement>('.wk-track')
  if (gallery && track) {
    const range = Math.max(0, track.scrollWidth - window.innerWidth)
    const trackLeft = track.getBoundingClientRect().left
    track.querySelectorAll<HTMLElement>('.wk-card').forEach((card, index) => {
      const box = card.getBoundingClientRect()
      const top = verticalGallery
        ? documentTop(card) - 88
        : horizontalCardStop(documentTop(gallery), box.left - trackLeft, box.width, window.innerWidth, range)
      stops.push({ id: `work-${index}`, top })
      // Tall flow-mode cards still expose their lower content before changing chapter.
      if (verticalGallery) {
        const last = documentTop(card) + box.height - height + 32
        const page = Math.max(120, height - 120)
        for (let part = 1, y = top + page; y < last + page; part++, y += page) {
          const tail = Math.min(y, last)
          if (tail > top + LANDING_TOLERANCE) stops.push({ id: `work-${index}-${part}`, top: tail })
          if (tail === last) break
        }
      }
    })
  }
  if (document.querySelector('.parallax-footer')) stops.push({ id: 'contact', top: maximum })
  return normalizeStops(stops, maximum)
}
