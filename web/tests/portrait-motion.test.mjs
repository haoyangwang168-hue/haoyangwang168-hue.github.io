import test from 'node:test'
import assert from 'node:assert/strict'
import { portraitInertia, portraitParallax, portraitPosition, workCardPose, workCardStop, workCardSurfaceRotation } from '../src/ui/portrait-math.ts'

test('portrait cycles preserve positions after complete forward and backward laps', () => {
  for (let index = 0; index < 12; index++) {
    const original = portraitPosition(index, 123, 324, 12)
    assert.equal(portraitPosition(index, 123 + 324 * 12, 324, 12), original)
    assert.equal(portraitPosition(index, 123 - 324 * 12, 324, 12), original)
  }
})

test('release travel is symmetric and independent of refresh rate', () => {
  const simulate = (fps, initial) => {
    let velocity = initial
    let distance = 0
    for (let frame = 0; frame < fps; frame++) {
      const next = portraitInertia(velocity, 1 / fps)
      distance += next.distance
      velocity = next.velocity
    }
    return { distance, velocity }
  }
  const at60 = simulate(60, 800)
  const at144 = simulate(144, 800)
  assert.ok(Math.abs(at60.distance - at144.distance) < 1e-9)
  // 800 px/s with friction 8 approaches 100 px of total release travel.
  assert.ok(at60.distance > 99 && at60.distance < 100)
  assert.ok(at60.velocity < 1)
  assert.ok(Math.abs(simulate(60, -800).distance + at60.distance) < 1e-9)
  assert.deepEqual(portraitInertia(NaN, 0.1), { distance: 0, velocity: 0 })
  assert.deepEqual(portraitInertia(800, -1), { distance: 0, velocity: 800 })
})

test('photo parallax stays inside overscan and is neutral at screen centre', () => {
  assert.equal(Math.abs(portraitParallax(500, 1000, 300)), 0)
  assert.ok(portraitParallax(600, 1000, 300) > 8 * 1.5)
  assert.ok(portraitParallax(600, 1000, 300) < 8 * 2)
  assert.equal(portraitParallax(400, 1000, 300), -portraitParallax(600, 1000, 300))
  assert.ok(portraitParallax(1000, 1000, 300) > 24.3 * 1.5)
  for (const scale of [1.12, 1.3, 1.32]) {
    assert.ok(portraitParallax(100000, 1000, 300, scale) < 300 * (scale - 1) / 2)
  }
  assert.equal(portraitParallax(0, 0, 300), 0)
  assert.equal(portraitParallax(600, 1000, 300, 1), 0)
})
test('work stack enters, flips, and exposes each clickable card in order', () => {
  for (const progress of [0, 0.1, 0.25, 0.4, 0.5, 0.75, 0.9]) {
    const poses = Array.from({ length: 4 }, (_, index) => workCardPose(progress, index, 4))
    assert.equal(poses.filter(pose => pose.active).length, 1)
  }
  assert.equal(workCardPose(0, 0, 4).y, 65)
  assert.equal(workCardPose(0.12, 0, 4).rotateY, 0)
  assert.equal(workCardPose(0.25, 0, 4).rotateY, 180)
  assert.equal(workCardPose(0, 1, 4).opacity, 1)
  for (let index = 0; index < 4; index++) {
    const progress = workCardStop(index, 4) + 0.015
    assert.equal(workCardPose(progress, index, 4).active, true)
    assert.equal(workCardPose(progress, index, 4).opacity, 1)
    assert.equal(workCardPose(progress, index, 4).rotateY, 180)
    if (index > 0) assert.equal(workCardPose(progress, index - 1, 4).opacity, 0)
    const departure = workCardPose(workCardStop(index, 4) + 0.65 / 4 * 0.8, index, 4)
    assert.ok(departure.y < -90 && departure.y > -230)
    // Reversing scroll restores the reading pose without accumulated state.
    assert.equal(workCardPose(progress, index, 4).y, index * 2)
  }
  assert.equal(workCardPose(1, 3, 4).opacity, 0)
  assert.deepEqual(workCardPose(NaN, 0, 4), workCardPose(0, 0, 4))
  assert.equal(workCardPose(0.5, 0, 0).active, false)
})

test('cards respond during the first quarter of their scroll interval and reverse immediately', () => {
  const count = 4
  const interval = 0.65 / count
  for (let index = 0; index < count; index++) {
    const start = workCardStop(index, count)
    const resting = workCardPose(start, index, count)
    const quarter = workCardPose(start + interval * 0.25, index, count)
    // At one-quarter travel, 13/88 of the 230% departure is already visible.
    assert.ok(Math.abs(quarter.y - (resting.y - 230 * 13 / 88)) < 1e-9)
    const halfway = workCardPose(start + interval * 0.5, index, count)
    assert.ok(halfway.y < quarter.y)
    assert.equal(workCardPose(start + interval * 0.25, index, count).y, quarter.y)
    assert.equal(quarter.active, true)
    assert.equal(workCardPose(start + interval * 0.1, index, count).y, resting.y)
  }
})

test('exposed next cards can be clicked before they become the current keyboard reading stop', () => {
  const photo = workCardPose(0.6, 2, 4)
  assert.equal(photo.rotateY, 180)
  assert.equal(photo.opacity, 1)
  assert.equal(photo.active, false)
  assert.equal(photo.clickable, true)
  assert.equal(workCardPose(0.1, 2, 4).clickable, false)
  assert.equal(workCardPose(1, 2, 4).clickable, false)
  assert.equal(workCardPose(0.6, 2, 0).clickable, false)
  for (const progress of [0.3, 0.6, 0.63, 0.7, 0.9]) {
    for (let index = 0; index < 4; index++) {
      const pose = workCardPose(progress, index, 4)
      assert.ok(!pose.active || pose.clickable)
    }
  }
})

test('rear cards turn with the cover and unfold continuously without an opacity switch', () => {
  for (const progress of [0.12, 0.18, 0.22, 0.2499, 0.25, 0.2501, 0.28, 0.3]) {
    const cover = workCardPose(progress, 0, 4)
    for (let index = 1; index < 4; index++) {
      const rear = workCardPose(progress, index, 4)
      assert.equal(rear.rotateY, cover.rotateY)
      assert.equal(rear.opacity, 1)
      if (progress <= 0.22) {
        assert.equal(Math.abs(rear.rotate), 0)
        assert.equal(rear.y, cover.y)
      }
    }
  }
  const middle = workCardPose(0.26, 1, 4)
  assert.ok(Math.abs(middle.rotate + 5.5) < 1e-10)
  assert.ok(Math.abs(middle.y - 10) < 1e-10)
  for (const boundary of [0.22, 0.25, 0.3]) {
    for (let index = 0; index < 4; index++) {
      const before = workCardPose(boundary - 0.00001, index, 4)
      const after = workCardPose(boundary + 0.00001, index, 4)
      assert.ok(Math.abs(after.y - before.y) < 0.01)
      assert.ok(Math.abs(after.rotate - before.rotate) < 0.01)
      assert.ok(Math.abs(after.rotateY - before.rotateY) < 0.05)
      assert.equal(after.opacity, before.opacity)
    }
  }
})

test('incoming cards move while their predecessor is visible and settle at unchanged reading stops', () => {
  const count = 5
  const interval = 0.65 / count
  for (let index = 1; index < count; index++) {
    const stop = workCardStop(index, count)
    const start = workCardPose(stop - interval * 0.5, index, count)
    const middle = workCardPose(stop - interval * 0.25, index, count)
    const settled = workCardPose(stop, index, count)
    // Halfway through arrival, half of the 18% lift has completed.
    assert.ok(Math.abs(start.y - (index * 2 + 18)) < 1e-9)
    assert.ok(Math.abs(middle.y - (index * 2 + 9)) < 1e-9)
    assert.ok(Math.abs(settled.y - index * 2) < 1e-9)
    assert.equal(workCardPose(stop - interval * 0.25, index - 1, count).opacity, 1)
    assert.equal(middle.clickable, true)
    for (const boundary of [stop - interval * 0.5, stop]) {
      assert.ok(Math.abs(workCardPose(boundary + 1e-7, index, count).y - workCardPose(boundary - 1e-7, index, count).y) < 0.001)
    }
    assert.deepEqual(workCardPose(stop - interval * 0.25, index, count), middle)
  }
})

test('mobile face swapping keeps the visible orientation and settles to a flat card', () => {
  // Front: 0 -> 45 -> edge. Back: edge -> -45 -> 0, equivalent to parent + back's 180deg.
  for (const [angle, mobile] of [[0, 0], [45, 45], [90, -90], [135, -45], [180, 0]]) {
    assert.equal(workCardSurfaceRotation(angle, true), mobile)
    assert.equal(workCardSurfaceRotation(angle, false), angle)
    const oldVisibleAngle = angle < 90 ? angle : angle + 180
    assert.ok(Math.abs(Math.cos(oldVisibleAngle * Math.PI / 180) - Math.cos(mobile * Math.PI / 180)) < 1e-12)
    assert.ok(Math.abs(Math.sin(oldVisibleAngle * Math.PI / 180) - Math.sin(mobile * Math.PI / 180)) < 1e-12)
  }
  for (const progress of [0.3, 0.445, 0.575, 0.705, 0.835, 1]) {
    assert.equal(workCardSurfaceRotation(workCardPose(progress, 0, 5, true).rotateY, true), 0)
  }
  assert.equal(workCardSurfaceRotation(NaN, true), 0)
})
