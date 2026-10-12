import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceProfileAxis, profileCardAim, profileCardPose } from '../src/ui/profile-card-motion.ts'

test('pointer coordinates stay attached to the visible card after scrolling', () => {
  const bounds = { left: 300, top: 200, width: 380, height: 500 }
  assert.deepEqual(profileCardAim(490, 450, bounds), { x: 0, y: 0 })
  assert.deepEqual(profileCardAim(680, 200, bounds), { x: 1, y: -1 })
  assert.deepEqual(profileCardAim(1500, -100, bounds), { x: 1, y: -1 })
  assert.deepEqual(profileCardAim(490, 350, { ...bounds, top: 100 }), { x: 0, y: 0 })
})

test('card edges map to bounded tilt, light position and independent image parallax', () => {
  assert.deepEqual(profileCardPose(1, -1, 1), {
    pointerX: 100, pointerY: 0, bandX: 65, bandY: 35,
    rotateX: -10, rotateY: -10, shiftX: 6, shiftY: -6, active: 1, tilt: 1,
  })
  const extreme = profileCardPose(100, -100, 4, 100, 100)
  assert.equal(extreme.rotateX, -18)
  assert.equal(extreme.rotateY, -18)
  assert.equal(extreme.shiftX, 12)
  assert.equal(extreme.shiftY, -12)
})

test('spring movement stays consistent at 30, 60, 120 and 144 fps', () => {
  const positions = [30, 60, 120, 144].map(fps => {
    let axis = { position: 0, velocity: 0 }
    for (let frame = 0; frame < fps; frame++) axis = advanceProfileAxis(axis, 0.8, 1 / fps)
    assert.ok(Math.abs(axis.position - 0.8) < 0.001)
    return axis.position
  })
  assert.ok(Math.max(...positions) - Math.min(...positions) < 0.001)
})

test('a fast reversal returns smoothly to a neutral card without residual velocity', () => {
  let axis = { position: 0, velocity: 0 }
  for (let frame = 0; frame < 12; frame++) axis = advanceProfileAxis(axis, 1, 1 / 60)
  const before = axis.position
  axis = advanceProfileAxis(axis, -1, 1 / 60)
  assert.ok(Math.abs(axis.position - before) < 0.15, 'reversal must not jump to its new destination')
  for (let frame = 0; frame < 120; frame++) axis = advanceProfileAxis(axis, 0, 1 / 60)
  assert.ok(Math.abs(axis.position) < 0.00001)
  assert.ok(Math.abs(axis.velocity) < 0.00001)
})

test('invalid coordinates and timing never produce broken CSS transforms', () => {
  assert.deepEqual(profileCardAim(NaN, 0, { left: 0, top: 0, width: 0, height: 0 }), { x: 0, y: 0 })
  assert.deepEqual(advanceProfileAxis({ position: NaN, velocity: Infinity }, NaN, -1), { position: 0, velocity: 0 })
  assert.ok(Object.values(profileCardPose(NaN, Infinity, NaN)).every(Number.isFinite))
})
