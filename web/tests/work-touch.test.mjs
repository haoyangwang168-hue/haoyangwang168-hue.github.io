import test from 'node:test'
import assert from 'node:assert/strict'
import { workTouchSnap } from '../src/ui/work-touch.ts'
import { bindWorkCardTouch } from '../src/ui/useWorkCardTouch.ts'

const top = 2000
const range = 9000
const height = 400
const count = 5
const at = p => top + range * p
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)

function eventTarget() {
  const listeners = new Map()
  return {
    listeners,
    addEventListener: (name, listener, options) => listeners.set(name, { listener, options }),
    removeEventListener: name => listeners.delete(name),
    send: (name, event = {}) => listeners.get(name)?.listener(event),
  }
}

function fixture(t, initial = 0.315) {
  const previous = { window: globalThis.window, document: globalThis.document, ResizeObserver: globalThis.ResizeObserver }
  const calls = []
  const writes = []
  const timers = new Map()
  const frames = new Map()
  const observers = []
  let id = 0
  let clock = 0
  let prevented = 0
  const geometry = { top, height: range + 900, cardHeight: height }
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this) }
    observe(target) { this.targets.push(target) }
    disconnect() { this.targets = [] }
  }
  const host = {
    ...eventTarget(), scrollY: at(initial),
    requestAnimationFrame: callback => { frames.set(++id, callback); return id },
    cancelAnimationFrame: key => frames.delete(key),
    setTimeout: (callback, delay) => { timers.set(++id, { callback, due: clock + delay }); return id },
    clearTimeout: key => timers.delete(key),
    scrollTo: ({ top, behavior }) => {
      calls.push({ top, behavior })
      if (behavior === 'instant') { host.scrollY = top; host.send('scroll') }
    },
  }
  const doc = { ...eventTarget(), hidden: false, body: { style: {} }, documentElement: { clientHeight: 900, style: {} }, fonts: eventTarget() }
  globalThis.window = host
  globalThis.document = doc
  const stage = { ...eventTarget(), contains: target => target === stage }
  const gallery = { get clientHeight() { return geometry.height }, getBoundingClientRect: () => ({ top: geometry.top - host.scrollY }) }
  const deck = { get offsetHeight() { return geometry.cardHeight } }
  const progress = { get: () => initial, set: value => writes.push(value) }
  const dispose = bindWorkCardTouch(gallery, stage, deck, progress, count)
  t.after(() => {
    dispose()
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  })
  const finger = (y, x = 150) => ({ identifier: 1, clientX: x, clientY: y })
  const flushFrame = () => { const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback(clock)) }
  const advance = ms => {
    clock += ms
    for (const [key, timer] of [...timers]) if (timer.due <= clock) { timers.delete(key); timer.callback() }
  }
  const scroll = p => { host.scrollY = at(p); host.send('scroll') }
  const start = (y = 600) => {
    const event = { touches: [finger(y)], target: stage }
    doc.send('touchstart', event)
    stage.send('touchstart', event)
  }
  const move = (y, x = 150) => stage.send('touchmove', { touches: [finger(y, x)], preventDefault: () => prevented++ })
  const end = () => stage.send('touchend', { touches: [] })
  const idle = () => { advance(200); flushFrame(); flushFrame() }
  return { host, doc, stage, geometry, calls, writes, timers, frames, observers, finger, dispose, scroll, start, move, end, idle, advance, flushFrame, prevented: () => prevented }
}

test('short swipes select the adjacent reading stop; micro swipes may settle back', () => {
  near(workTouchSnap(0.315, 0.325, 100, 400, 5), 0.445)
  near(workTouchSnap(0.445, 0.435, -100, 400, 5), 0.315)
  near(workTouchSnap(0.315, 0.32, 40, 400, 5), 0.315)
  near(workTouchSnap(0.12, 0.13, 100, 400, 5), 0.315)
})

test('long native travel snaps ahead of the final position instead of returning to the first neighbour', () => {
  near(workTouchSnap(0.315, 0.68, 300, 400, 5), 0.705)
  near(workTouchSnap(0.705, 0.51, -300, 400, 5), 0.445)
  near(workTouchSnap(0.315, 0.705, 300, 400, 5), 0.705)
  near(workTouchSnap(0.835, 0.95, 100, 400, 5), 1)
})

test('reversal follows the last native scroll direction near the final position', () => {
  near(workTouchSnap(0.445, 0.6, 200, 400, 5, -1), 0.575)
  near(workTouchSnap(0.705, 0.51, -200, 400, 5, 1), 0.575)
})

test('invalid geometry and progress never create invalid destinations', () => {
  near(workTouchSnap(0.3, 0.4, NaN, 400, 5), 0.4)
  near(workTouchSnap(0.3, 2, 100, 0, 5), 1)
  near(workTouchSnap(0.3, NaN, 100, 400, 5), 0)
  near(workTouchSnap(0.3, 0.4, 100, 400, 0), 0.4)
})

test('dragging stays passive and never writes page position or a separate progress value', t => {
  const f = fixture(t)
  assert.equal(f.stage.listeners.get('touchmove').options.passive, true)
  f.start(); f.move(500); f.scroll(0.326)
  f.advance(500); f.flushFrame(); f.doc.send('scrollend')
  assert.equal(f.calls.length, 0)
  assert.equal(f.writes.length, 0)
  assert.equal(f.prevented(), 0)
  f.end()
  assert.equal(f.calls.length, 0)
  f.idle()
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].behavior, 'smooth')
  near(f.calls[0].top, at(0.445))
})

test('inertia keeps postponing the fallback until 200ms idle and two stable frames', t => {
  const f = fixture(t)
  f.start(); f.move(450); f.scroll(0.33); f.end()
  f.advance(190); f.scroll(0.5)
  f.advance(190); f.scroll(0.68)
  f.advance(199); assert.equal(f.calls.length, 0)
  f.advance(1); f.flushFrame(); assert.equal(f.calls.length, 0)
  f.flushFrame(); near(f.calls[0].top, at(0.705))
  assert.equal(f.writes.length, 0)
})

test('native scrollend verifies rest and the snap completion cannot start another snap', t => {
  const f = fixture(t)
  f.start(); f.move(500); f.scroll(0.326); f.end()
  f.doc.send('scrollend'); f.flushFrame(); assert.equal(f.calls.length, 0)
  f.flushFrame(); assert.equal(f.calls.length, 1)
  f.scroll(0.445); f.doc.send('scrollend'); f.flushFrame(); f.flushFrame(); f.idle()
  assert.equal(f.calls.length, 1)
})

test('movement during a stability frame restarts the wait without snapping', t => {
  const f = fixture(t)
  f.start(); f.move(500); f.scroll(0.326); f.end()
  f.doc.send('scrollend'); f.flushFrame()
  f.host.scrollY = at(0.5)
  f.flushFrame(); assert.equal(f.calls.length, 0)
  f.idle(); near(f.calls[0].top, at(0.575))
})

test('the hook retains the final actual direction through a long reversal', t => {
  const f = fixture(t, 0.445)
  f.start(); f.move(300); f.scroll(0.7); f.move(400); f.scroll(0.6); f.end()
  f.idle(); near(f.calls[0].top, at(0.575))
})

test('a new touch cancels only an active programmatic snap at the current position', t => {
  const f = fixture(t)
  f.start(); f.move(500); f.scroll(0.326); f.end(); f.idle()
  f.scroll(0.38); f.start()
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[1].behavior, 'instant')
  near(f.calls[1].top, at(0.38))
  f.advance(500); f.flushFrame(); assert.equal(f.calls.length, 2)
})

for (const cause of ['body-lock', 'html-lock', 'outside-click', 'new-touch', 'wheel', 'keydown', 'resize', 'font-load', 'layout', 'hidden']) {
  test(`${cause} invalidates a pending snap without rewriting native momentum`, t => {
    const f = fixture(t)
    f.start(); f.move(500); f.scroll(0.326); f.end()
    if (cause === 'body-lock') f.doc.body.style.overflow = 'hidden'
    if (cause === 'html-lock') f.doc.documentElement.style.overflow = 'hidden'
    if (cause === 'outside-click') f.doc.send('click', { target: {} })
    if (cause === 'new-touch') f.doc.send('touchstart')
    if (['wheel', 'keydown', 'resize'].includes(cause)) f.host.send(cause)
    if (cause === 'font-load') f.doc.fonts.send('loadingdone')
    if (cause === 'layout') { f.geometry.top += 100; f.observers[0].callback() }
    if (cause === 'hidden') { f.doc.hidden = true; f.doc.send('visibilitychange') }
    f.idle(); f.doc.send('scrollend'); f.flushFrame(); f.flushFrame()
    assert.equal(f.calls.length, 0)
    assert.equal(f.writes.length, 0)
  })
}

for (const destination of [-0.02, 1.02]) {
  test(`native travel to ${destination} exits the pinned section without being pulled back`, t => {
    const f = fixture(t, destination < 0 ? 0 : 0.835)
    f.start(); f.move(destination < 0 ? 750 : 450); f.scroll(destination); f.end(); f.idle()
    assert.equal(f.calls.length, 0)
    assert.equal(f.prevented(), 0)
  })
}

test('taps, horizontal swipes, multitouch and touch cancellation never arm snapping', t => {
  const f = fixture(t)
  f.start(); f.end(); f.idle()
  f.start(); f.move(598, 200); f.end(); f.idle()
  f.start(); f.move(500); f.stage.send('touchmove', { touches: [f.finger(500), { ...f.finger(550), identifier: 2 }] }); f.end(); f.idle()
  f.start(); f.move(500); f.stage.send('touchcancel'); f.idle()
  assert.equal(f.calls.length, 0)
})

test('drag clicks are filtered while keyboard and fresh intentional taps remain usable', t => {
  const f = fixture(t)
  let clicks = 0
  const click = detail => f.stage.send('click', { detail, preventDefault: () => clicks++, stopPropagation() {} })
  f.start(); f.move(500); f.end()
  click(0); assert.equal(clicks, 0)
  click(1); assert.equal(clicks, 1)
  f.start(); f.end(); click(1); assert.equal(clicks, 1)
})

test('cleanup cancels timers, frame checks and listeners without writing a pending destination', t => {
  const f = fixture(t)
  f.start(); f.move(500); f.scroll(0.326); f.end(); f.advance(200)
  f.dispose()
  assert.equal(f.timers.size, 0)
  assert.equal(f.frames.size, 0)
  assert.equal(f.calls.length, 0)
  assert.equal(f.stage.listeners.size, 0)
  assert.equal(f.host.listeners.size, 0)
  assert.equal(f.doc.listeners.size, 0)
  assert.equal(f.observers[0].targets.length, 0)
})
