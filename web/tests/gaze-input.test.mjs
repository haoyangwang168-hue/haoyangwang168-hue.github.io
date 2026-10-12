import test from 'node:test'
import assert from 'node:assert/strict'
import { gazeInput } from '../src/scene/gaze-input.ts'

test('mouse gaze remains active in a narrow desktop viewport', () => {
  assert.deepEqual(gazeInput('mouse', 100, 150, 400, 600), { x: -0.5, y: 0.5 })
  assert.deepEqual(gazeInput('mouse', 400, 600, 400, 600), { x: 1, y: -1 })
  assert.deepEqual(gazeInput('pen', 200, 300, 400, 600), { x: 0, y: 0 })
})

test('touch and invalid coordinates do not produce gaze targets', () => {
  assert.equal(gazeInput('touch', 100, 150, 400, 600), null)
  assert.equal(gazeInput('mouse', NaN, 150, 400, 600), null)
  assert.equal(gazeInput('mouse', 100, 150, 0, 600), null)
  assert.deepEqual(gazeInput('mouse', -20, 700, 400, 600), { x: -1, y: -1 })
})
