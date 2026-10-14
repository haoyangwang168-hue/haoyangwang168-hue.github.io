import test from 'node:test'
import assert from 'node:assert/strict'
import { workOutroPose, workTimeline } from '../src/ui/work-outro.ts'
import { workCardPose, workCardStop } from '../src/ui/portrait-math.ts'

test('invitation overlaps the departing last card and fills its former empty tail', () => {
  assert.equal(workOutroPose(0.8, 0).opacity, 0)
  assert.ok(workOutroPose(0.92, 0).opacity > 0.5)
  assert.equal(workCardPose(0.96, 3, 4).opacity, 0)
  assert.ok(workOutroPose(0.95, 0, 1).opacity > 0.7)
  assert.equal(workOutroPose(1, 0).opacity, 1)
  assert.equal(workOutroPose(1, 0, 1).y, 0)
})
test('invitation leaves with contact, reverses exactly and rejects invalid input', () => {
  assert.equal(workOutroPose(1, 1).opacity, 0)
  assert.ok(workOutroPose(1, 0.25).y < 0)
  const frames = [0, 0.25, 0.5, 0.75, 1]
  assert.deepEqual(frames.map(p => workOutroPose(1, p)), [...frames].reverse().map(p => workOutroPose(1, p)).reverse())
  assert.deepEqual(workOutroPose(NaN, Infinity), workOutroPose(0, 0))
})

test('reading hold adds a full viewport without slowing down cards or moving their navigation stops', () => {
  for (const count of [1, 4, 5, 6]) {
    const timeline = workTimeline(count)
    const oldTravel = (count + 2) * 65 - 100
    const newTravel = timeline.heightVh - 100
    assert.ok(Math.abs(newTravel * timeline.cardFraction - oldTravel) < 1e-10)
    assert.ok(Math.abs(newTravel * (1 - timeline.cardFraction) - 100) < 1e-10)
    for (const position of [0, 0.25, 0.5, 0.75, 1]) {
      const cardProgress = Math.min(1, (timeline.cardFraction + (1 - timeline.cardFraction) * position) / timeline.cardFraction)
      assert.equal(workOutroPose(cardProgress, 0, 1).opacity, 1)
      assert.equal(workOutroPose(cardProgress, 0, 1).blur, 0)
    }
  }
  assert.deepEqual(workTimeline(NaN), workTimeline(0))
})

test('mobile cards have triple travel and a readable hold without changing desktop timing', () => {
  const desktop = workTimeline(5)
  const mobile = workTimeline(5, true)
  // Five cards: 355vh becomes 1065vh, followed by the same 100vh invitation hold.
  assert.equal(desktop.heightVh, 555)
  assert.equal(mobile.heightVh, 1265)
  const travel = (mobile.heightVh - 100) * mobile.cardFraction
  assert.ok(Math.abs(travel - 1065) < 1e-10)
  for (let index = 0; index < 5; index++) {
    const start = workCardStop(index, 5)
    const resting = workCardPose(start + 0.015, index, 5, true)
    // A 25vh movement from the navigation stop still stays within the reading hold.
    assert.deepEqual(workCardPose(start + 0.015 + 25 / travel, index, 5, true), resting)
    const forward = [0, 25, 60, 100].map(distance => workCardPose(start + distance / travel, index, 5, true))
    const reverse = [100, 60, 25, 0].map(distance => workCardPose(start + distance / travel, index, 5, true)).reverse()
    assert.deepEqual(forward, reverse)
    assert.equal(resting.active, true)
    assert.equal(workCardPose(start + 0.65 / 5 + 0.00001, index, 5, true).opacity, 0)
  }
})
