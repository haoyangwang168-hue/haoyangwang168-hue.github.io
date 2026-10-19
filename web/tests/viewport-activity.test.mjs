import test from 'node:test'
import assert from 'node:assert/strict'
import { observeViewportActivity } from '../src/ui/useViewportActivity.ts'

test('animation stages resume before entering view and stop drawing after leaving', t => {
  const previous = globalThis.IntersectionObserver
  let callback
  let observed
  let disconnected = false
  globalThis.IntersectionObserver = class {
    constructor(onChange, options) {
      callback = onChange
      assert.equal(options.rootMargin, '160px')
    }
    observe(element) { observed = element }
    disconnect() { disconnected = true }
  }
  t.after(() => { globalThis.IntersectionObserver = previous })
  const stage = { dataset: {}, style: { height: '100svh' } }
  const dispose = observeViewportActivity(stage)
  assert.equal(observed, stage)
  for (const active of [false, true, false, true]) {
    callback([{ isIntersecting: active }])
    assert.equal(stage.dataset.viewportActive, String(active))
    assert.equal(stage.style.height, '100svh')
  }
  dispose()
  assert.equal(disconnected, true)
  callback([{ isIntersecting: false }])
  assert.equal(stage.dataset.viewportActive, undefined)
})

test('browsers without visibility observation keep every stage available', t => {
  const previous = globalThis.IntersectionObserver
  globalThis.IntersectionObserver = undefined
  t.after(() => { globalThis.IntersectionObserver = previous })
  const stage = { dataset: {} }
  const dispose = observeViewportActivity(stage)
  assert.equal(stage.dataset.viewportActive, undefined)
  dispose()
})
