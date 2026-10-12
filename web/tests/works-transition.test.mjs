import test from 'node:test'
import assert from 'node:assert/strict'
import { worksPaperBand, worksPageParallax } from '../src/ui/works-transition.ts'

test('dissolve stays in the reading gap throughout both pages entering and leaving', () => {
  for (const viewport of [320, 550, 740, 900, 1200]) {
    for (const compact of [false, true]) {
      for (let step = 1; step < 100; step++) {
        const progress = step / 100
        const worksTop = viewport * (1 - progress)
        const parallax = worksPageParallax(progress, compact)
        // Independently measured layout: 22vh of trailing space, then the work labels.
        const previousBottom = worksTop - viewport * 0.22 + parallax.outgoingY
        const incomingTop = worksTop + Math.min(80, viewport * 0.17) + parallax.incomingY
        const band = worksPaperBand(progress, viewport, previousBottom, incomingTop)
        const clearance = Math.min(24, viewport * 0.035)
        assert.ok(band.top >= previousBottom + clearance - 1e-9)
        assert.ok(band.top + band.height <= incomingTop - clearance + 1e-9)
        // FBM is bounded by [0, 1]. Even extreme noise must preserve text contrast.
        const oldTextField = (previousBottom - band.top) / band.height + 0.5 * 0.96
        const newTextField = (incomingTop - band.top) / band.height - 0.5 * 0.96
        assert.ok(oldTextField < 0.49, 'paper alpha is zero behind the outgoing copy')
        assert.ok(newTextField > 0.51, 'paper alpha is one behind the incoming copy')
      }
    }
  }
})

test('a manually checked mid-transition sample keeps 24px clear of both texts', () => {
  // 900px viewport, CREATE ends at y=300; works labels begin at y=600.
  const band = worksPaperBand(0.5, 900, 300, 600)
  assert.deepEqual(band, { top: 324, height: 252 })
  assert.equal(band.top + band.height, 600 - 24)
  assert.deepEqual(worksPaperBand(1, 900, -300, 88), { top: -1, height: 1 })
})

test('two page layers move at different speeds and return to identical positions on reversal', () => {
  const start = worksPageParallax(0)
  const middle = worksPageParallax(0.5)
  const end = worksPageParallax(1)
  assert.equal(start.incomingY, -48)
  assert.deepEqual(middle, { outgoingY: -70, incomingY: -24, deckY: -18 })
  assert.equal(end.incomingY, 0)
  assert.equal(end.deckY, 0)
  assert.equal(end.outgoingY, -140)
  for (const progress of [0.1, 0.25, 0.5, 0.9, 0.5, 0.25, 0.1]) {
    const compact = worksPageParallax(progress, true)
    const full = worksPageParallax(progress)
    assert.equal(compact.incomingY, full.incomingY * 0.6)
    assert.equal(compact.outgoingY, full.outgoingY * 0.6)
  }
  assert.deepEqual(worksPageParallax(0.5, false, true), { outgoingY: 0, incomingY: 0, deckY: 0 })
})

test('transition calculations clamp overscroll and reject invalid geometry', () => {
  assert.deepEqual(worksPageParallax(NaN), worksPageParallax(0))
  assert.deepEqual(worksPageParallax(-2), worksPageParallax(0))
  assert.deepEqual(worksPageParallax(2), worksPageParallax(1))
  assert.deepEqual(worksPaperBand(NaN, 900, 0, 100), { top: 0, height: 1 })
  assert.deepEqual(worksPaperBand(0.5, 0, 0, 100), { top: 0, height: 1 })
})

test('the first and last scroll pixels do not toggle a visible full-sized dissolve band', () => {
  for (const viewport of [500, 844, 1000]) {
    for (const compact of [false, true]) {
      const sample = progress => {
        const worksTop = viewport * (1 - progress)
        const pose = worksPageParallax(progress, compact)
        const header = viewport <= 550 ? 70 : compact ? 80 : 88
        return worksPaperBand(progress, viewport, worksTop - viewport * 0.22 + pose.outgoingY, worksTop + header + pose.incomingY)
      }
      const start = sample(0)
      const end = sample(1)
      assert.ok(start.top >= viewport, 'all noise is below the viewport before the first scroll pixel')
      assert.ok(end.top + end.height <= 0, 'all noise is above the viewport before switching to the works surface')
      assert.equal(start.height, 1)
      assert.equal(end.height, 1)
      for (const progress of [0.0001, 0.001, 0.01]) {
        const entering = sample(progress)
        // Ten pixels of scroll on a 1000px screen cannot suddenly fill 100px of paper.
        assert.ok(Math.max(0, viewport - entering.top) <= viewport * progress * 1.3)
        const leaving = sample(1 - progress)
        assert.ok(Math.max(0, leaving.top + leaving.height) <= viewport * progress * 0.4)
      }
      assert.ok(sample(0.35).height > viewport * 0.25, 'retain the stronger tear in the middle')
    }
  }
})

test('band size and position stay continuous at taper boundaries in both directions', () => {
  const sample = progress => {
    const worksTop = 1000 * (1 - progress)
    const pose = worksPageParallax(progress)
    return worksPaperBand(progress, 1000, worksTop - 220 + pose.outgoingY, worksTop + 88 + pose.incomingY)
  }
  for (const boundary of [0, 0.001, 0.14, 0.35, 0.86, 0.999, 1]) {
    const before = sample(Math.max(0, boundary - 0.0001))
    const after = sample(Math.min(1, boundary + 0.0001))
    assert.ok(Math.abs(after.top - before.top) < 1)
    assert.ok(Math.abs(after.height - before.height) < 1)
  }
})
