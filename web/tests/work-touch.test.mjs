import test from 'node:test'
import assert from 'node:assert/strict'
import { workTouchScroll } from '../src/ui/work-touch.ts'
import { workCardPose } from '../src/ui/portrait-math.ts'
import { bindWorkCardTouch } from '../src/ui/useWorkCardTouch.ts'

const top = 2000
const range = 9000
const height = 400
const count = 5
const at = p => top + range * p
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)
const dragTo = (start, delta) => workTouchScroll(start, delta, top, range, count, height)

test('one card-height drag retains the complete 180-degree flip and reverses exactly', () => {
  const halfway = (dragTo(at(0.12), 200) - top) / range
  near(workCardPose(halfway, 0, count, true).rotateY, 90)
  const flipped = dragTo(at(0.12), 400)
  near(workCardPose((flipped - top) / range, 0, count, true).rotateY, 180)
  near(dragTo(flipped, -400), at(0.12))
})

test('departing card translation matches a manually measured 80px finger move', () => {
  for (let index = 0; index < count; index++) {
    const p = 0.3 + 0.65 * (index + 0.5) / count
    const next = (dragTo(at(p), 80) - top) / range
    const before = workCardPose(p, index, count, true)
    const after = workCardPose(next, index, count, true)
    near((before.y - after.y) * height / 100, 80)
    near(dragTo(at(next), -80), at(p))
  }
})

test('mapping is continuous across poses and exits into adjacent page sections', () => {
  for (const p of [0, 0.12, 0.25, 0.3, 0.3455, 0.43, 0.95, 1]) {
    near(dragTo(at(p), 0), at(p))
    const moved = dragTo(at(p), 100)
    near(dragTo(moved, -100), at(p))
    assert.ok(dragTo(at(p), 0.001) >= at(p))
  }
  near(dragTo(at(1), 80), at(1) + 80)
  near(dragTo(at(0), -80), at(0) - 80)
  near(workTouchScroll(100, NaN, top, range, count, height), 100)
  near(workTouchScroll(100, 10, top, 0, count, height), 100)
})

function eventTarget() {
  const listeners = new Map()
  return {
    listeners,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
    send: (name, event = {}) => listeners.get(name)?.(event),
  }
}

test('touch move updates immediately, release stays put, tap and multi-touch remain safe', t => {
  const previousWindow = globalThis.window
  const scrollCalls = []
  const progress = []
  const host = { ...eventTarget(), scrollY: at(0.12), scrollTo: ({ top, behavior }) => {
    assert.equal(behavior, 'instant')
    host.scrollY = top
    scrollCalls.push(top)
  } }
  globalThis.window = host
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow })
  const stage = { ...eventTarget(), offsetHeight: 800 }
  const gallery = { offsetHeight: 9800, getBoundingClientRect: () => ({ top: top - host.scrollY }) }
  const dispose = bindWorkCardTouch(gallery, stage, { offsetHeight: height }, { set: value => progress.push(value) }, count)
  const touch = y => ({ identifier: 1, clientX: 150, clientY: y })
  let prevented = 0
  const move = y => stage.send('touchmove', { touches: [touch(y)], cancelable: true, preventDefault: () => prevented++ })
  stage.send('touchstart', { touches: [touch(600)] })
  move(598)
  assert.equal(prevented, 1)
  assert.equal(scrollCalls.length, 0)
  move(400)
  near(progress.at(-1), 0.185)
  move(600)
  near(progress.at(-1), 0.12)
  stage.send('touchend')
  const releaseCount = scrollCalls.length
  move(300)
  assert.equal(scrollCalls.length, releaseCount)
  let clickBlocked = false
  stage.send('click', { detail: 1, preventDefault: () => { clickBlocked = true }, stopPropagation() {} })
  assert.equal(clickBlocked, true)
  stage.send('touchstart', { touches: [touch(600)] })
  stage.send('touchend')
  clickBlocked = false
  stage.send('click', { detail: 1, preventDefault: () => { clickBlocked = true }, stopPropagation() {} })
  assert.equal(clickBlocked, false)
  stage.send('touchstart', { touches: [touch(600), { ...touch(550), identifier: 2 }] })
  move(300)
  assert.equal(scrollCalls.length, releaseCount)
  dispose()
  assert.equal(stage.listeners.size, 0)
  assert.equal(host.listeners.size, 0)
})
