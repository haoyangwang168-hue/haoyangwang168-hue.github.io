import test from 'node:test'
import assert from 'node:assert/strict'
import { horizontalProgress } from '../src/ui/parallax-math.ts'

test('horizontal card progress follows entry, centered reading and exit', () => {
  // An 800px card starts at x=1700 on a 1200px viewport.
  assert.equal(horizontalProgress(1700, 800, 1200, -500), 0)
  assert.equal(horizontalProgress(1700, 800, 1200, -1500), 0.5)
  assert.equal(horizontalProgress(1700, 800, 1200, -2500), 1)
})

test('card progress is bounded outside the viewport and reversible', () => {
  const forward = [-100, -500, -1500, -2500, -3000].map(x => horizontalProgress(1700, 800, 1200, x))
  assert.deepEqual(forward, [0, 0, 0.5, 1, 1])
  const backward = [-3000, -2500, -1500, -500, -100].map(x => horizontalProgress(1700, 800, 1200, x))
  assert.deepEqual(backward, [...forward].reverse())
})

test('unmeasured and invalid geometry does not create NaN transforms', () => {
  for (const args of [[0, 0, 1200, 0], [0, 800, 0, 0], [NaN, 800, 1200, 0], [0, 800, 1200, Infinity]]) {
    assert.equal(horizontalProgress(...args), 0)
  }
})
