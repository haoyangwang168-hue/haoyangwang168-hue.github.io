import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceGalleryMotion, galleryEdge, galleryFrames, galleryImageScale, galleryWheelStep, galleryWheelTarget, wrapIndex } from '../src/ui/gallery-math.ts'

test('wheel bursts accumulate, bound backlog, and reverse immediately from the displayed position', () => {
  let target = 0
  for (let i = 0; i < 3; i++) target = galleryWheelTarget(0, target, 0.2)
  near(target, -0.6)
  near(galleryWheelTarget(-0.1, target, -0.2), 0.1)
  assert.equal(galleryWheelTarget(0, -1.9, 1), -2)
  assert.equal(galleryWheelTarget(0, 1.9, -1), 2)
  assert.equal(galleryWheelTarget(2, NaN, 1), 2)
})

test('composited pictures keep native proportions and exactly cover growing frames', () => {
  for (const aspect of [0.75, 1, 1.8]) {
    for (const [width, height] of [[120, 150], [600, 500], [900, 500]]) {
      const baseWidth = 400, baseHeight = 500
      const fittedWidth = Math.min(baseWidth, baseHeight * aspect)
      const fittedHeight = fittedWidth / aspect
      const scale = galleryImageScale(width, height, baseWidth, baseHeight, aspect)
      const actualWidth = fittedWidth * scale.x * width / baseWidth
      const actualHeight = fittedHeight * scale.y * height / baseHeight
      near(actualWidth / actualHeight, aspect)
      near(actualWidth, Math.max(width, height * aspect))
      near(actualHeight, Math.max(height, width / aspect))
    }
  }
  assert.deepEqual(galleryImageScale(0, 0, 400, 500, NaN), { x: 1, y: 1 })
})

test('wheel pixels, lines, and pages have consistent direction and bounded travel', () => {
  near(galleryWheelStep(0, 48, 0, 1000, 600), 0.2)
  near(galleryWheelStep(0, 3, 1, 1000, 600), 0.2)
  near(galleryWheelStep(0, 0.08, 2, 1000, 600), 0.2)
  near(galleryWheelStep(-48, 2, 0, 1000, 600), -0.2)
  assert.equal(galleryWheelStep(0, 10000, 0, 1000, 600), 1)
  assert.equal(galleryWheelStep(0, -10000, 0, 1000, 600), -1)
})

test('small trackpad events accumulate proportionally and reverse without residual motion', () => {
  let position = 0
  for (let i = 0; i < 12; i++) position -= galleryWheelStep(0, 4, 0, 1000, 600)
  near(position, -0.2)
  for (let i = 0; i < 12; i++) position -= galleryWheelStep(0, -4, 0, 1000, 600)
  near(position, 0)
  for (const args of [[0, NaN, 0, 1000, 600], [0, 48, 3, 1000, 600], [0, 48, 0, 0, 600], [0, 48, 0, 1000, Infinity]]) {
    assert.equal(galleryWheelStep(...args), 0)
  }
})

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)

test('active drags follow the latest input immediately in either direction', () => {
  for (const seconds of [0, 1 / 120, 1 / 60, 0.05]) {
    assert.deepEqual(advanceGalleryMotion(1, 2.5, -4, seconds, true), { position: 2.5, velocity: 0 })
    assert.deepEqual(advanceGalleryMotion(2.5, -0.5, 4, seconds, true), { position: -0.5, velocity: 0 })
  }
})

test('released or button-driven motion settles without overshoot, independent of refresh rate', () => {
  // Critical damping from rest leaves (1 + 24t) * exp(-24t) of the gap.
  const expected = 10 * (1 - 7 * Math.exp(-6))
  for (const fps of [60, 120, 144]) {
    let state = { position: 0, velocity: 0 }
    for (let step = 0; step < fps / 4; step++) {
      const next = advanceGalleryMotion(state.position, 10, state.velocity, 1 / fps, false)
      assert.ok(next.position > state.position && next.position < 10)
      state = next
    }
    near(state.position, expected)
  }
  const grabbed = advanceGalleryMotion(expected, expected, 3, 1 / 60, true)
  assert.deepEqual(grabbed, { position: expected, velocity: 0 })
})

test('invalid motion inputs cannot corrupt gallery positions', () => {
  assert.deepEqual(advanceGalleryMotion(2, NaN, 1, 0.02, true), { position: 2, velocity: 0 })
  assert.deepEqual(advanceGalleryMotion(NaN, Infinity, NaN, 0.02, false), { position: 0, velocity: 0 })
  for (const seconds of [0, -1, NaN, Infinity]) {
    assert.deepEqual(advanceGalleryMotion(2, 4, 1, seconds, false), { position: 2, velocity: 1 })
  }
})

test('new wheel destinations preserve instantaneous velocity instead of restarting the easing', () => {
  const moving = advanceGalleryMotion(0, 1, 0, 0.06, false)
  const continued = advanceGalleryMotion(moving.position, 2, moving.velocity, 0.000001, false)
  assert.ok(Math.abs(continued.velocity - moving.velocity) < 0.001)
  assert.ok(continued.position > moving.position)
  // Even at high speed, reversal changes direction within 50ms and then settles exactly.
  let state = advanceGalleryMotion(0, 0.1, -20, 0.05, false)
  assert.ok(state.velocity > 0)
  for (let i = 0; i < 120; i++) state = advanceGalleryMotion(state.position, 0.1, state.velocity, 1 / 120, false)
  assert.deepEqual(state, { position: 0.1, velocity: 0 })
  assert.deepEqual(advanceGalleryMotion(0, 0.01, 20, 0.05, false), { position: 0.01, velocity: 0 })
})

test('growing edges match a manually summed geometric series', () => {
  // A 100px stage begins with a 12px image. Each next width grows by exp(0.32).
  const ratio = Math.exp(0.32)
  near(galleryEdge(0, 100), 0)
  near(galleryEdge(1, 100), 12)
  near(galleryEdge(2, 100), 12 + 12 * ratio)
  near(galleryEdge(3, 100), 12 + 12 * ratio + 12 * ratio ** 2)
})

test('neighbouring slides share edges in both drag directions', () => {
  for (const progress of [-51.3, -1, -0.01, 0, 0.7, 1, 50.5]) {
    const frames = galleryFrames(progress, 1200, 600, 5)
    for (let i = 1; i < frames.length; i++) {
      near(frames[i - 1].left + frames[i - 1].width, frames[i].left)
      assert.ok(frames[i].width > frames[i - 1].width)
      assert.ok(frames[i].height <= 600)
      assert.ok(frames[i].index >= 0 && frames[i].index < 5)
    }
  }
})

test('a full image cycle returns the same frames without adding nodes', () => {
  for (const count of [1, 2, 5]) {
    const before = galleryFrames(0.35, 1000, 600, count)
    for (const direction of [-1, 1]) {
      const after = galleryFrames(0.35 + count * direction, 1000, 600, count)
      assert.equal(after.length, before.length)
      before.forEach((box, i) => {
        assert.equal(after[i].index, box.index)
        near(after[i].left, box.left)
        near(after[i].width, box.width)
      })
    }
  }
})

test('positive modulo handles backward cycling and invalid geometry safely', () => {
  assert.equal(wrapIndex(-1, 5), 4)
  assert.equal(wrapIndex(5, 5), 0)
  assert.equal(wrapIndex(-11, 5), 4)
  for (const width of [0, -1, NaN, Infinity]) assert.deepEqual(galleryFrames(0, width, 600, 5), [])
  assert.deepEqual(galleryFrames(NaN, 800, 600, 5), [])
  assert.deepEqual(galleryFrames(0, 800, 600, 0), [])
})

test('left neighbour is available for preloading before it enters, with ten fixed frames', () => {
  const before = galleryFrames(0, 1200, 600, 20)
  assert.equal(before.length, 10)
  assert.equal(before[0].index, 19)
  near(before[0].left + before[0].width, 0)
  assert.ok(before[0].left + before[0].width > -240)
  const after = galleryFrames(0.01, 1200, 600, 20)
  const entering = after.find(frame => frame.index === 19)
  assert.ok(entering.left < 0 && entering.left + entering.width > 0)
  // Existing visible geometry remains the same: the first image is still 144px wide.
  near(before[1].left, 0)
  near(before[1].width, 144)
  assert.equal(before[1].index, 0)
})
