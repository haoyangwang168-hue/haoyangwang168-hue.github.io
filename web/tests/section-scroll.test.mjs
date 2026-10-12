import test from 'node:test'
import assert from 'node:assert/strict'
import { getSectionStops, normalizeStops, horizontalCardStop } from '../src/ui/section-scroll.ts'

test('document limits collapse out-of-range stops and discard invalid geometry', () => {
  assert.deepEqual(normalizeStops([
    { id: 'footer', top: 3000 }, { id: 'start', top: -100 },
    { id: 'invalid', top: NaN }, { id: 'duplicate', top: 0.4 }, { id: 'middle', top: 800 },
  ], 2000), [{ id: 'start', top: 0 }, { id: 'middle', top: 800 }, { id: 'footer', top: 2000 }])
})

test('invalid or short documents never produce negative navigation destinations', () => {
  for (const maximum of [-100, NaN, Infinity, 0]) {
    assert.deepEqual(normalizeStops([{ id: 'hero', top: 0 }, { id: 'footer', top: 100 }], maximum), [{ id: 'hero', top: 0 }])
  }
})

test('pinned cards land at the viewport centre using actual measured card widths', () => {
  // With 1000px left padding and a 780px card, 890px travel centres the first card.
  assert.equal(horizontalCardStop(5000, 1000, 780, 1000, 3230), 5890)
  assert.equal(horizontalCardStop(5000, 1780, 780, 1000, 3230), 6670)
  assert.equal(horizontalCardStop(5000, 3340, 780, 1000, 3230), 8230)
  assert.equal(horizontalCardStop(5000, 0, 780, 1000, 3230), 5000)
  assert.equal(horizontalCardStop(5000, 3340, 780, 1000, 1200), 6200)
})

test('chapter navigation measures flow and horizontal layouts without owning scroll input', (t) => {
  // Each bounding box is relative to the viewport after 200px of native scrolling.
  const element = (top, height = 0, left = 0, width = 0) => ({
    getBoundingClientRect: () => ({ top: top - 200, height, left, width }),
  })
  const introduction = element(900)
  const timeline = { ...element(1700), dataset: { point: 'focus-1' } }
  const gallery = element(5000)
  const card = element(5000, 1400, -600, 780)
  const track = { ...element(5000, 0, -1600), scrollWidth: 4230, querySelectorAll: () => [card] }
  const selectors = { '.hero .about': introduction, '.wk-gallery': gallery, '.wk-track': track, '.parallax-footer': {} }
  const environment = {
    window: { innerHeight: 800, innerWidth: 1000, scrollY: 200 },
    document: {
    documentElement: { scrollHeight: 8000 },
    querySelector: selector => selectors[selector] ?? null,
    querySelectorAll: () => [timeline],
    },
  }
  for (const [key, value] of Object.entries(environment)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value })
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous)
      else delete globalThis[key]
    })
  }
  assert.deepEqual(getSectionStops(false), [
    { id: 'hero', top: 0 }, { id: 'introduction', top: 740 },
    { id: 'focus-1', top: 1460 }, { id: 'work-0', top: 5890 },
    { id: 'contact', top: 7200 },
  ])
  // Flow card starts below the header. Its final reading stop shows the bottom with 32px space.
  assert.deepEqual(getSectionStops(true), [
    { id: 'hero', top: 0 }, { id: 'introduction', top: 740 },
    { id: 'focus-1', top: 1460 }, { id: 'work-0', top: 4912 },
    { id: 'work-0-1', top: 5592 }, { id: 'work-0-2', top: 5632 },
    { id: 'contact', top: 7200 },
  ])
})
