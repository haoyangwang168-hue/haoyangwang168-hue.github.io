import test from 'node:test'
import assert from 'node:assert/strict'
import { footerPose } from '../src/ui/footer-motion.ts'

test('six echoes stay registered initially and finish before the I morph begins', () => {
  assert.deepEqual(footerPose(0, 5), { scale: 1, y: 0, morph: 0 })
  assert.deepEqual(footerPose(0.5, 5), { scale: 0.625, y: 25, morph: 0 })
  assert.deepEqual(footerPose(1, 5), { scale: 0.625, y: 25, morph: 1 })
  assert.equal(footerPose(0.75).morph, 0)
  assert.equal(footerPose(0.78).morph, 0)
  assert.ok(Math.abs(footerPose(0.89).morph - 0.5) < 1e-12)
  assert.deepEqual(footerPose(NaN, Infinity), { scale: 1, y: 0, morph: 0 })
  assert.deepEqual(footerPose(2, 9), footerPose(1, 5))
  const forwards = [0, 0.25, 0.5, 0.75, 1].map(p => footerPose(p, 3))
  const backwards = [1, 0.75, 0.5, 0.25, 0].map(p => footerPose(p, 3)).reverse()
  assert.deepEqual(forwards, backwards)
})
test('morph eases gently at each endpoint and stays monotonic through reversal', () => {
  const step = 0.001
  assert.ok(footerPose(0.78 + step).morph < 0.0001)
  assert.ok(1 - footerPose(1 - step).morph < 0.0001)
  let previous = 0
  for (let i = 0; i <= 100; i++) {
    const morph = footerPose(i / 100).morph
    assert.ok(morph >= previous && morph <= 1)
    previous = morph
  }
})
