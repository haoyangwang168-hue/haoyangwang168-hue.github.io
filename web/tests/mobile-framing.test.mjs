import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MathUtils, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three'

// This independently projects the exported asset; no renderer or source-text
// matching is involved. Bounds include the decal's transparent rectangular edge.
const bytes = readFileSync(process.env.HAOYANG_TEST_MODEL || new URL('../public/models/me.glb', import.meta.url))
assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic')
assert.equal(bytes.readUInt32LE(4), 2, 'glTF 2.0')
assert.equal(bytes.readUInt32LE(8), bytes.length, 'complete model')
const jsonSize = bytes.readUInt32LE(12)
const document = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString('utf8'))
const binary = bytes.subarray(28 + jsonSize)
const parents = new Map()
const accessorCache = new Map()
document.nodes.forEach((node, index) => node.children?.forEach(child => parents.set(child, index)))

function accessorValues(index) {
  if (accessorCache.has(index)) return accessorCache.get(index)
  const accessor = document.accessors[index]
  const view = document.bufferViews[accessor.bufferView]
  assert.equal(accessor.componentType, 5126, 'animation/position accessors use float32')
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type]
  assert(width, `supported accessor type: ${accessor.type}`)
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const stride = view.byteStride ?? width * 4
  const values = Array.from({ length: accessor.count }, (_, row) =>
    Array.from({ length: width }, (_, column) => binary.readFloatLE(offset + row * stride + column * 4)),
  )
  accessorCache.set(index, values)
  return values
}

function matricesAt(time) {
  const transforms = document.nodes.map(node => ({
    translation: node.translation ?? [0, 0, 0],
    rotation: node.rotation ?? [0, 0, 0, 1],
    scale: node.scale ?? [1, 1, 1],
    matrix: node.matrix,
  }))
  for (const animation of document.animations ?? []) {
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler]
      const times = accessorValues(sampler.input).map(value => value[0])
      const values = accessorValues(sampler.output)
      let row = times.findIndex(value => value >= time - 1e-6)
      if (row < 0) row = times.length - 1
      const previous = Math.max(0, row - 1)
      assert.equal(sampler.interpolation ?? 'LINEAR', 'LINEAR', 'camera uses baked linear samples')
      const fraction = times[row] === times[previous] ? 0 : MathUtils.clamp((time - times[previous]) / (times[row] - times[previous]), 0, 1)
      const value = channel.target.path === 'rotation'
        ? new Quaternion().fromArray(values[previous]).slerp(new Quaternion().fromArray(values[row]), fraction).toArray()
        : values[row].map((end, column) => MathUtils.lerp(values[previous][column], end, fraction))
      transforms[channel.target.node][channel.target.path] = value
      transforms[channel.target.node].matrix = undefined
    }
  }
  const memo = new Map()
  function world(index) {
    if (memo.has(index)) return memo.get(index)
    const transform = transforms[index]
    const matrix = transform.matrix ? new Matrix4().fromArray(transform.matrix) : new Matrix4().compose(
      new Vector3().fromArray(transform.translation),
      new Quaternion().fromArray(transform.rotation),
      new Vector3().fromArray(transform.scale),
    )
    if (parents.has(index)) matrix.premultiply(world(parents.get(index)))
    memo.set(index, matrix)
    return matrix
  }
  const group = new Matrix4().compose(new Vector3(0, 0.4, -0.7), new Quaternion(), new Vector3(2.25, 2.25, 2.25))
  return document.nodes.map((_, index) => group.clone().multiply(world(index)))
}

const CAMERA = document.nodes.findIndex(node => node.camera !== undefined)
assert(CAMERA >= 0, 'export includes its animated camera')
const cameraData = document.cameras[document.nodes[CAMERA].camera].perspective
assert(cameraData, 'exported camera uses perspective projection')
const EPSILON = 0.01
const CARD_TOP = 0.3

for (const [width, height] of [[390, 844], [430, 932]]) {
  for (let stop = 1; stop <= 5; stop++) {
    test(`${width}×${height}: frame ${stop * 50} keeps the entire sticker above the résumé card`, () => {
      const frame = stop * 50
      const matrices = matricesAt(frame / 24)
      const focusIndex = document.nodes.findIndex(node => node.name === `focus-${stop}`)
      assert(focusIndex >= 0, `focus-${stop} exists`)
      const focus = new Vector3().setFromMatrixPosition(matrices[focusIndex])
      const camera = new PerspectiveCamera(cameraData.yfov * 180 / Math.PI, width / height, 0.1, 500)
      matrices[CAMERA].decompose(camera.position, camera.quaternion, new Vector3())

      // The mobile camera contract preserves the desktop export, blending the
      // pullback and offsets only while the résumé's focus stops are active.
      const weight = MathUtils.smoothstep(stop - 1, -0.8, 0) * (1 - MathUtils.smoothstep(frame, 250, 300))
      camera.position.sub(focus).multiplyScalar(MathUtils.lerp(1.2, 1.5, weight)).add(focus)
      const distance = camera.position.distanceTo(focus)
      camera.translateX(-distance * 0.165 * weight)
      camera.translateY(-distance * 0.13 * weight)
      camera.updateMatrixWorld(true)

      const center = focus.clone().project(camera)
      const centerX = (center.x + 1) / 2
      assert(centerX >= 0.35 && centerX <= 0.5, `focus X is ${(centerX * 100).toFixed(2)}%`)
      const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
      let vertexCount = 0
      document.nodes.forEach((node, index) => {
        if (node.mesh === undefined || !node.name?.startsWith(`sticker-${stop}-`)) return
        for (const primitive of document.meshes[node.mesh].primitives) {
          for (const position of accessorValues(primitive.attributes.POSITION)) {
            const point = new Vector3().fromArray(position).applyMatrix4(matrices[index]).project(camera)
            assert([point.x, point.y, point.z].every(Number.isFinite), 'finite projected decal vertex')
            assert(point.z >= -1 && point.z <= 1, 'decal lies inside the camera depth range')
            const x = (point.x + 1) / 2
            const y = (1 - point.y) / 2
            bounds.left = Math.min(bounds.left, x)
            bounds.right = Math.max(bounds.right, x)
            bounds.top = Math.min(bounds.top, y)
            bounds.bottom = Math.max(bounds.bottom, y)
            vertexCount += 1
          }
        }
      })
      assert(vertexCount > 0, `sticker-${stop} contains real mesh vertices`)
      const details = JSON.stringify(bounds)
      assert(bounds.left >= -EPSILON && bounds.right <= 1 + EPSILON, `decal stays within screen width: ${details}`)
      assert(bounds.top >= -EPSILON && bounds.bottom <= 1 + EPSILON, `decal stays within screen height: ${details}`)
      assert(bounds.bottom <= CARD_TOP + EPSILON, `decal ends before the résumé card: ${details}`)
    })
  }
}
