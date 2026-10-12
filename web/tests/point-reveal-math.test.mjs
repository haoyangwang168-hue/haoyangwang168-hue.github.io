import test from 'node:test'
import assert from 'node:assert/strict'
import { pinnedViewportTop, pointRevealTransform } from '../src/ui/point-reveal-math.ts'

const origin = { x: 1200, y: 450 }
const title = { left: 120, top: 180, width: 360, height: 100 }
const image = { left: 380, top: 360, width: 600, height: 320 }
const flights = [{ angle: -55, radius: 480 }, { angle: 0, radius: 400 }, { angle: 55, radius: 280 }]

function assertNear(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${actual} to be close to ${expected}`)
}

function transformedCenter(rect, transform) {
  // Rotation and scale leave the center fixed when transform-origin is center.
  return {
    x: rect.left + rect.width / 2 + transform.x,
    y: rect.top + rect.height / 2 + transform.y,
  }
}

test('different sized elements and departure angles collapse to one exact viewport point', () => {
  for (const rect of [title, image, { left: 60, top: 700, width: 900, height: 24 }]) {
    for (const flight of flights) {
      const transform = pointRevealTransform(rect, origin, 0, flight)
      assert.deepEqual(transformedCenter(rect, transform), origin)
      assert.equal(transform.scale, 0)
      assert.equal(transform.opacity, 0)
    }
  }
})

test('the reveal point stays fixed as the horizontal track moves', () => {
  for (const trackX of [0, -500, -1800]) {
    const movingRect = { ...image, left: image.left + trackX }
    assert.deepEqual(transformedCenter(movingRect, pointRevealTransform(movingRect, origin, 0)), origin)
  }
})

test('half progress follows independently calculated cubic Bezier control points', () => {
  const rect = { left: 100, top: 350, width: 200, height: 100 }
  const start = { x: 1000, y: 400 }
  // P0=(1000,400), P1=(600,400), P2=(560,400), P3=(200,400).
  // At u=1/2, center=(P0+3P1+3P2+P3)/8=(585,400), so translation=(385,0).
  const transform = pointRevealTransform(rect, start, 0.5, { angle: 0, radius: 400 })
  const center = transformedCenter(rect, transform)
  assertNear(center.x, 585)
  assertNear(center.y, 400)
  assertNear(transform.x, 385)
  assertNear(transform.y, 0)
  assert.equal(transform.scale, 0.5)
  assert.equal(transform.rotate, 0)
  assert.equal(transform.opacity, 1)
  // At 1/4 progress the smoothstep fraction is 5/32, not a linear 1/4.
  assert.equal(pointRevealTransform(title, origin, 0.25).scale, 5 / 32)
})

test('every fan path initially travels left even when its destination is to the right', () => {
  const rightDestination = { left: 1900, top: 350, width: 200, height: 200 }
  for (const rect of [title, image, rightDestination]) {
    for (const angle of [-70, -40, 0, 40, 70]) {
      const center = transformedCenter(rect, pointRevealTransform(rect, origin, 0.02, { angle, radius: 400 }))
      assert.ok(center.x < origin.x, `angle ${angle} should depart into the viewport`)
    }
  }
})

test('opposite departure angles spread symmetrically above and below the shared point', () => {
  const rect = { left: 100, top: 350, width: 200, height: 100 }
  const start = { x: 1000, y: 400 }
  const upper = pointRevealTransform(rect, start, 0.25, { angle: -45, radius: 400 })
  const lower = pointRevealTransform(rect, start, 0.25, { angle: 45, radius: 400 })
  const upperCenter = transformedCenter(rect, upper)
  const lowerCenter = transformedCenter(rect, lower)
  assertNear(upperCenter.x, lowerCenter.x)
  assert.ok(upperCenter.y < start.y)
  assert.ok(lowerCenter.y > start.y)
  assertNear(start.y - upperCenter.y, lowerCenter.y - start.y)
  assertNear(upper.rotate, -lower.rotate)
})

test('default flight is neutral and extreme finite angles are clamped toward the viewport', () => {
  const neutral = pointRevealTransform(title, origin, 0.5)
  assert.deepEqual(neutral, pointRevealTransform(title, origin, 0.5, { angle: 0, radius: 0 }))
  // With both controls at the origin, u=1/2 covers 1/8 of the destination distance.
  assert.deepEqual(transformedCenter(title, neutral), { x: 1087.5, y: 422.5 })
  for (const sign of [-1, 1]) {
    assert.deepEqual(
      pointRevealTransform(title, origin, 0.3, { angle: 200 * sign, radius: 400 }),
      pointRevealTransform(title, origin, 0.3, { angle: 70 * sign, radius: 400 }),
    )
  }
})

test('completed reveals restore the original position, size and rotation', () => {
  for (const rect of [title, image]) {
    for (const flight of flights) {
      assert.deepEqual(pointRevealTransform(rect, origin, 1, flight), { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 })
    }
  }
})

test('scrolling backward and revisiting the same progress reproduces the same geometry', () => {
  const steps = [0, 0.05, 0.25, 0.5, 0.8, 1]
  const flight = { angle: -35, radius: 500 }
  const forward = steps.map(progress => pointRevealTransform(image, origin, progress, flight))
  const backward = [...steps].reverse().map(progress => pointRevealTransform(image, origin, progress, flight))
  assert.deepEqual(backward, [...forward].reverse())
  assert.equal(forward[1].opacity, 0.4)
  assert.deepEqual(pointRevealTransform(image, origin, 0.25, flight), forward[2])
})

test('progress is clamped and nonfinite progress begins at the reveal point', () => {
  const start = pointRevealTransform(title, origin, 0)
  const end = pointRevealTransform(title, origin, 1)
  for (const progress of [-10, NaN, Infinity, -Infinity]) {
    assert.deepEqual(pointRevealTransform(title, origin, progress), start)
  }
  assert.deepEqual(pointRevealTransform(title, origin, 10), end)
})

test('unknown or invalid geometry is hidden without nonfinite transforms', () => {
  const invalidGeometry = [
    [{ ...title, width: 0 }, origin],
    [{ ...title, height: -1 }, origin],
    [{ ...title, left: NaN }, origin],
    [{ ...title, top: Infinity }, origin],
    [title, { x: Infinity, y: 450 }],
    [title, { x: 1200, y: NaN }],
    [{ ...title, left: Number.MAX_VALUE, width: Number.MAX_VALUE }, origin],
  ]
  for (const [rect, point] of invalidGeometry) {
    const transform = pointRevealTransform(rect, point, 0.5)
    assert.deepEqual(transform, { x: 0, y: 0, scale: 0, rotate: 0, opacity: 0 })
    assert.ok(Object.values(transform).every(Number.isFinite))
  }
})

test('invalid fan geometry is hidden without nonfinite transforms', () => {
  const invalidFlights = [
    { angle: NaN, radius: 400 },
    { angle: Infinity, radius: 400 },
    { angle: 20, radius: NaN },
    { angle: 20, radius: Infinity },
    { angle: 20, radius: -1 },
    { angle: 0, radius: Number.MAX_VALUE },
  ]
  for (const flight of invalidFlights) {
    const transform = pointRevealTransform(title, origin, 0.5, flight)
    assert.deepEqual(transform, { x: 0, y: 0, scale: 0, rotate: 0, opacity: 0 })
    assert.ok(Object.values(transform).every(Number.isFinite))
  }
})

test('sticky top follows entry, pinning and its container bottom during exit', () => {
  // Container occupies document y=2000..5000; the stage is 900px high.
  assert.equal(pinnedViewportTop(2000, 900, 3000, 1500), 500)
  assert.equal(pinnedViewportTop(2000, 900, 3000, 2000), 0)
  assert.equal(pinnedViewportTop(2000, 900, 3000, 3500), 0)
  assert.equal(pinnedViewportTop(2000, 900, 3000, 4100), 0)
  // At scrollY=4400 the container bottom is y=600, so stage top must be -300.
  assert.equal(pinnedViewportTop(2000, 900, 3000, 4400), -300)
})

test('short and equal-height containers still constrain the stage bottom', () => {
  assert.equal(pinnedViewportTop(1000, 900, 900, 800), 200)
  assert.equal(pinnedViewportTop(1000, 900, 900, 1200), -200)
  // A 900px stage in a 500px container is offset by -400 even before pinning.
  assert.equal(pinnedViewportTop(1000, 900, 500, 0), 600)
  assert.equal(pinnedViewportTop(1000, 900, 500, 1000), -400)
  assert.equal(pinnedViewportTop(1000, 900, 500, 1300), -700)
})

test('invalid sticky geometry produces a finite neutral top', () => {
  const invalidInputs = [
    [NaN, 900, 3000, 0],
    [2000, 0, 3000, 0],
    [2000, 900, -1, 0],
    [2000, 900, 3000, Infinity],
    [Number.MAX_VALUE, 900, 3000, -Number.MAX_VALUE],
  ]
  for (const input of invalidInputs) assert.equal(pinnedViewportTop(...input), 0)
})
