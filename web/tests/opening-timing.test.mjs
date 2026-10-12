import test from 'node:test'
import assert from 'node:assert/strict'
import { getOpeningExit, openingAssetsReady, OPENING_TIMING } from '../src/ui/opening-timing.ts'

test('automatic opening finishes at five seconds, after both masks clear', () => {
  const exit = getOpeningExit('auto', false)
  assert.equal(OPENING_TIMING.minimum + exit.delay + exit.duration, 4950)
  assert.equal(OPENING_TIMING.minimum + exit.completeAfter, 5000)
  assert.ok(exit.completeAfter > exit.delay + exit.duration)
})

test('all name letters arrive before the swap, and HW has time to settle before tearing', () => {
  // Twelve name characters finish at 1365ms; the final monogram character finishes at 3240ms.
  const nameDone = OPENING_TIMING.nameDelay + OPENING_TIMING.nameDuration + 11 * OPENING_TIMING.nameStagger
  const monogramDone = OPENING_TIMING.swapAt + OPENING_TIMING.monogramDelay + OPENING_TIMING.monogramDuration + OPENING_TIMING.monogramStagger
  assert.equal(nameDone, 1365)
  assert.ok(nameDone < OPENING_TIMING.swapAt)
  assert.equal(monogramDone, 3240)
  assert.ok(OPENING_TIMING.minimum - monogramDone >= 350)
})

test('skipping clears the curtain within 650ms and reduced motion has no staged wait', () => {
  const skip = getOpeningExit('skip', false)
  assert.equal(skip.delay, 0)
  assert.equal(skip.duration, 600)
  assert.equal(skip.completeAfter, 650)
  assert.ok(skip.completeAfter > skip.duration)
  for (const mode of ['auto', 'skip']) assert.deepEqual(getOpeningExit(mode, true), { delay: 0, duration: 0, completeAfter: 0 })
})

test('auto entry waits for active asset loading, including when progress briefly reaches 100', () => {
  assert.equal(openingAssetsReady(true, 50, 4, false), false)
  assert.equal(openingAssetsReady(true, 100, 4, false), false)
  assert.equal(openingAssetsReady(false, 0, 0, false), false)
  assert.equal(openingAssetsReady(false, 100, 0, false), true)
  assert.equal(openingAssetsReady(false, 100, 4, false), true)
  assert.equal(openingAssetsReady(false, 50, 4, false), true)
})

test('scene failure can enter the fallback; invalid counters cannot imply initial readiness', () => {
  assert.equal(openingAssetsReady(true, 0, 0, true), true)
  assert.equal(openingAssetsReady(false, NaN, 0, false), false)
  assert.equal(openingAssetsReady(false, Infinity, 0, false), false)
  assert.equal(openingAssetsReady(false, 0, NaN, false), false)
  assert.equal(openingAssetsReady(false, -1, -1, false), false)
})
