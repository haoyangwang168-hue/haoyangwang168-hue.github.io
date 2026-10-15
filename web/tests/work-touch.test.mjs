import test from 'node:test'
import assert from 'node:assert/strict'
import { workTouchScroll, workTouchSnap } from '../src/ui/work-touch.ts'
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

function fixture(t, initial = 0.12) {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const previousResizeObserver = globalThis.ResizeObserver
  const calls = []
  const values = []
  const frames = new Map()
  let frameId = 0
  let current = 0
  let prevented = 0
  const reads = { top: 0, height: 0, deck: 0 }
  const layout = { top, height: 9900, cardHeight: height }
  const observers = []
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this) }
    observe(target) { this.targets.push(target) }
    disconnect() { this.targets = [] }
  }
  const documentRoot = { clientHeight: 900 }
  const host = {
    ...eventTarget(), scrollY: at(initial),
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId },
    cancelAnimationFrame: id => frames.delete(id),
    scrollTo: ({ top, behavior }) => {
      assert.equal(behavior, 'instant')
      host.scrollY = Math.max(0, top)
      calls.push(host.scrollY)
      host.send('scroll')
    },
  }
  globalThis.window = host
  const doc = { ...eventTarget(), documentElement: documentRoot, body: {}, fonts: eventTarget() }
  globalThis.document = doc
  const stage = { ...eventTarget(), offsetHeight: 800 }
  // The sticky stage is deliberately 100px shorter than the document viewport.
  const gallery = { get clientHeight() { reads.height++; return layout.height }, getBoundingClientRect: () => { reads.top++; return { top: layout.top - host.scrollY } } }
  const deck = { get offsetHeight() { reads.deck++; return layout.cardHeight } }
  const progress = { get: () => current, set: value => { current = value; values.push(value) } }
  const dispose = bindWorkCardTouch(gallery, stage, deck, progress, count)
  t.after(() => {
    dispose()
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument
    if (previousResizeObserver === undefined) delete globalThis.ResizeObserver; else globalThis.ResizeObserver = previousResizeObserver
  })
  const finger = y => ({ identifier: 1, clientX: 150, clientY: y })
  return {
    host, stage, gallery, deck, documentRoot, doc, layout, reads, observers, calls, values, frames, progress, dispose, finger,
    start: y => stage.send('touchstart', { touches: [finger(y)] }),
    move: y => stage.send('touchmove', { touches: [finger(y)], cancelable: true, preventDefault: () => prevented++ }),
    end: () => stage.send('touchend'),
    cancel: () => stage.send('touchcancel'),
    prevented: () => prevented,
    flush: (now = 0) => { const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback(now)) },
  }
}

test('local drag ignores scroll notifications and performs zero page writes until release', t => {
  const f = fixture(t)
  f.host.send('scroll') // A frame queued before touching must not replay the old position.
  f.start(600)
  f.move(598)
  assert.equal(f.prevented(), 0)
  f.move(400)
  near(f.progress.get(), 0.185)
  near(f.host.scrollY, at(0.12))
  f.host.send('scroll')
  f.flush()
  near(f.progress.get(), 0.185)
  assert.equal(f.calls.length, 0)
  f.cancel()
  near(f.host.scrollY, at(0.185))
  near(f.progress.get(), 0.185)
  assert.equal(f.calls.length, 1)
  f.host.send('scroll')
  f.flush()
  near(f.progress.get(), 0.185)
  f.move(100)
  assert.equal(f.calls.length, 1)
})

test('viewport change preserves the pose and rebases the finger without canceling touch', t => {
  const f = fixture(t)
  f.start(600)
  f.move(400)
  const poseBefore = workCardPose(f.progress.get(), 0, count, true)
  f.documentRoot.clientHeight = 1000
  f.host.send('resize')
  assert.deepEqual(workCardPose(f.progress.get(), 0, count, true), poseBefore)
  f.move(400)
  near(f.progress.get(), 0.185)
  f.move(300)
  near(f.progress.get(), 0.2175)
  assert.equal(f.calls.length, 0)
  f.cancel()
  near(f.host.scrollY, top + (9900 - 1000) * 0.2175)
  near(f.progress.get(), 0.2175)
  f.host.send('scroll')
  f.flush()
  near(f.progress.get(), 0.2175)
})

test('reversal stays exact across repeated drags and a new gesture before scroll delivery', t => {
  const f = fixture(t)
  f.start(600)
  f.move(400)
  f.cancel()
  f.start(400)
  f.move(600)
  near(f.progress.get(), 0.12)
  f.flush()
  near(f.progress.get(), 0.12)
  f.cancel()
  near(f.host.scrollY, at(0.12))
})

test('only overflow beyond the gallery moves the page and reversing re-enters the deck', t => {
  const f = fixture(t, 0.99)
  f.start(600)
  // The last .01 of progress uses 24px; the other 76px belongs to the next section.
  f.move(500)
  near(f.progress.get(), 1)
  near(f.host.scrollY, at(1) + 76)
  f.move(600)
  near(f.progress.get(), 0.99)
  near(f.host.scrollY, at(0.99))
  f.cancel()
  near(f.host.scrollY, at(0.99))
})

test('upward exit and pre-entry gestures preserve normal document scrolling', t => {
  const f = fixture(t, 0)
  f.start(500)
  f.move(580)
  assert.equal(f.prevented(), 0)
  assert.equal(f.calls.length, 0)
  // Native scrolling supplies the movement; the handler must leave it untouched.
  f.host.scrollY = top - 80
  f.host.send('scroll')
  f.flush()
  near(f.progress.get(), 0)
  f.cancel()
  const countBefore = f.calls.length
  f.start(500)
  f.move(450)
  assert.equal(f.calls.length, countBefore)
})

test('tap, drag-click suppression, cancellation, multitouch and cleanup remain safe', t => {
  const f = fixture(t)
  f.start(600)
  f.move(400)
  f.stage.send('touchcancel')
  near(f.progress.get(), 0.185)
  assert.equal(f.calls.length, 1)
  let blocked = false
  const click = { detail: 1, preventDefault: () => { blocked = true }, stopPropagation() {} }
  f.stage.send('click', click)
  assert.equal(blocked, true)
  blocked = false
  f.start(600)
  f.cancel()
  f.stage.send('click', click)
  assert.equal(blocked, false)
  f.start(600)
  f.move(500)
  const saved = f.progress.get()
  f.stage.send('touchstart', { touches: [f.finger(500), { ...f.finger(550), identifier: 2 }] })
  f.move(300)
  near(f.progress.get(), saved)
  f.host.send('scroll')
  f.dispose()
  assert.equal(f.stage.listeners.size, 0)
  assert.equal(f.host.listeners.size, 0)
  assert.equal(f.doc.listeners.size, 0)
  assert.equal(f.doc.fonts.listeners.size, 0)
  assert.equal(f.observers[0].targets.length, 0)
  assert.equal(f.frames.size, 0)
})

test('ordinary chapter navigation updates mobile progress when no finger owns it', t => {
  const f = fixture(t)
  f.host.scrollY = at(0.7)
  f.host.send('scroll')
  f.flush()
  near(f.progress.get(), 0.7)
})

test('a quarter-card swipe selects exactly one next project; small gestures return', () => {
  near(workTouchSnap(0.12, 100, 400, 5), 0.315)
  near(workTouchSnap(0.315, 100, 400, 5), 0.445)
  near(workTouchSnap(0.445, -100, 400, 5), 0.315)
  near(workTouchSnap(0.315, 80, 400, 5), 0.315)
  near(workTouchSnap(0.835, 100, 400, 5), 1)
})

test('short swipe settles one card in 280ms without page writes during animation', t => {
  const f = fixture(t, 0.315)
  f.start(600)
  f.move(500)
  const releaseProgress = f.progress.get()
  f.end()
  assert.equal(f.calls.length, 0)
  f.flush(0)
  f.flush(140)
  assert.ok(f.progress.get() > releaseProgress && f.progress.get() < 0.445)
  f.host.send('scroll')
  assert.equal(f.calls.length, 0)
  f.flush(280)
  near(f.progress.get(), 0.445)
  assert.equal(f.calls.length, 1)
  near(f.host.scrollY, at(0.445))
  // Self-generated scroll rounding and viewport resize cannot flash back to another pose.
  f.host.scrollY += 0.4
  f.documentRoot.clientHeight = 1000
  f.host.send('scroll')
  f.host.send('resize')
  f.flush(300)
  near(f.progress.get(), 0.445)
})

test('subthreshold swipe eases back and reversing switches to the previous project', t => {
  const f = fixture(t, 0.445)
  f.start(600)
  f.move(550)
  f.end()
  f.flush(0)
  f.flush(280)
  near(f.progress.get(), 0.445)
  f.start(500)
  f.move(600)
  f.end()
  f.flush(300)
  f.flush(580)
  near(f.progress.get(), 0.315)
})

test('a new touch interrupts settling with no remaining animation callback', t => {
  const f = fixture(t, 0.315)
  f.start(600)
  f.move(500)
  f.end()
  f.flush(0)
  f.flush(100)
  const mid = f.progress.get()
  f.start(500)
  near(f.progress.get(), mid)
  assert.equal(f.frames.size, 0)
  f.move(550)
  assert.ok(f.progress.get() < mid)
})

test('outward swipe from the completed deck remains native, while inward swipe still controls cards', t => {
  const f = fixture(t, 1)
  f.start(600)
  f.move(598)
  f.move(500)
  f.end()
  assert.equal(f.prevented(), 0)
  assert.equal(f.calls.length, 0)
  assert.equal(f.frames.size, 0)
  near(f.progress.get(), 1)
  f.start(500)
  f.move(600)
  assert.equal(f.prevented(), 1)
  assert.ok(f.progress.get() < 1)
})

for (const [initial, destination, delta] of [[0, 0.12, 600], [0.12, 0.315, 700], [0.445, 0.315, -1400]]) {
  test(`long swipe from ${initial} stops at ${destination} without a reverse settling animation`, t => {
    const f = fixture(t, initial)
    f.start(700)
    f.move(700 - delta)
    near(f.progress.get(), destination)
    assert.equal(f.calls.length, 0)
    f.end()
    assert.equal(f.frames.size, 0)
    f.flush(0)
    near(f.progress.get(), destination)
    f.flush(140)
    near(f.progress.get(), destination)
    f.flush(280)
    near(f.progress.get(), destination)
    near(f.host.scrollY, at(destination))
  })
}

test('long swipe reversal stays exact when a toolbar resize occurs at the capped pose', t => {
  const f = fixture(t, 0.12)
  f.start(700)
  f.move(0)
  near(f.progress.get(), 0.315)
  f.documentRoot.clientHeight = 1000
  f.host.send('resize')
  f.move(0)
  near(f.progress.get(), 0.315)
  f.move(700)
  near(f.progress.get(), 0.12)
  assert.equal(f.calls.length, 0)
})

test('footer scrolling reuses geometry and observed upstream layout changes refresh the gallery position', t => {
  const f = fixture(t, 1)
  const readsBefore = { ...f.reads }
  for (let step = 1; step <= 8; step++) {
    f.host.scrollY = at(1) + step * 80
    f.host.send('scroll')
    f.flush()
  }
  assert.deepEqual(f.reads, readsBefore)
  near(f.progress.get(), 1)
  assert.ok(f.observers[0].targets.includes(f.doc.body))
  f.layout.top += 240
  f.host.scrollY = f.layout.top + range * 0.5
  f.observers[0].callback()
  near(f.progress.get(), 0.5)
  assert.equal(f.reads.top, readsBefore.top + 1)
  f.layout.top += 100
  f.doc.send('load')
  near(f.progress.get(), (f.host.scrollY - f.layout.top) / range)
})
