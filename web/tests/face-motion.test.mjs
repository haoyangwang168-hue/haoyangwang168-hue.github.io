import test from 'node:test'
import assert from 'node:assert/strict'
import { facePull, faceRegion, recoverFace } from '../src/scene/face-motion.ts'

test('only cheeks can be pinched; forehead, eyes, nose, lips and chin stay unpickable', () => {
  assert.equal(faceRegion(0, 0.28, 0.4), null)
  assert.equal(faceRegion(-0.2, -0.1, 0.45), 'cheek')
  assert.equal(faceRegion(0.2, -0.1, 0.45), 'cheek')
  for (const point of [[0.14, 0.14, 0.4], [0.1, -0.17, 0.5], [0.2, 0.28, 0.4], [0, 0, 0.6], [0, -0.24, 0.5], [0.15, -0.35, 0.45], [0, 0.6, 0.4], [NaN, 0, 0.5]]) assert.equal(faceRegion(...point), null)
})

test('facial pulls clamp large drags and reject invalid input', () => {
  assert.equal(facePull(10000, 1000), 0.045)
  assert.equal(facePull(-10000, 1000), -0.045)
  assert.ok(Math.abs(facePull(20, 1000) - 0.018) < 1e-10)
  assert.equal(facePull(50, 0), 0)
  assert.equal(facePull(NaN, 1000), 0)
})


test('face returns gradually without overshoot at different refresh rates', () => {
  for (const fps of [60, 120, 144]) {
    let value = 1
    for (let frame = 0; frame < fps; frame++) value = recoverFace(value, 0, 1 / fps, false)
    assert.ok(Math.abs(value - Math.exp(-1 / 0.34)) < 1e-10)
    for (let frame = 0; frame < fps * 3; frame++) value = recoverFace(value, 0, 1 / fps, false)
    assert.equal(value, 0)
  }
  assert.ok(recoverFace(0, 1, 0.05, true) > 0.6)
  assert.equal(recoverFace(1, 0, -1, false), 1)
})

test('hair, back of head and clothes do not trigger facial picking', () => {
  assert.equal(faceRegion(0.2, -0.15, 0.45), 'cheek')
  for (const point of [[0, 0.6, 0.4], [0, -0.8, 0.4], [0, 0, -0.4], [1, 0, 0.4], [NaN, 0, 0.4]]) assert.equal(faceRegion(...point), null)
})
