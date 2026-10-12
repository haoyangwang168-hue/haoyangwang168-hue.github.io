import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Matrix4, Quaternion, Vector3, PerspectiveCamera } from 'three'

// Validate the exported asset at the same camera stops used by the original scene.
const bytes = readFileSync(process.env.HAOYANG_TEST_MODEL || new URL('../public/models/me.glb', import.meta.url))
assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic')
assert.equal(bytes.readUInt32LE(4), 2, 'glTF 2.0')
assert.equal(bytes.readUInt32LE(8), bytes.length, 'complete asset')
const jsonSize = bytes.readUInt32LE(12)
const document = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString('utf8'))
const binary = bytes.subarray(28 + jsonSize)
const parents = new Map()
document.nodes.forEach((node, index) => node.children?.forEach(child => parents.set(child, index)))

function accessorValues(index) {
  const accessor = document.accessors[index]
  const view = document.bufferViews[accessor.bufferView]
  assert.equal(accessor.componentType, 5126, 'animation/position data uses float32')
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type]
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const stride = view.byteStride ?? width * 4
  return Array.from({ length: accessor.count }, (_, row) =>
    Array.from({ length: width }, (_, column) => binary.readFloatLE(offset + row * stride + column * 4)),
  )
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
      const fraction = times[row] === times[previous] ? 0 : Math.max(0, Math.min(1, (time - times[previous]) / (times[row] - times[previous])))
      assert.notEqual(sampler.interpolation, 'CUBICSPLINE', 'export camera with baked linear keys')
      const value = channel.target.path === 'rotation'
        ? new Quaternion().fromArray(values[previous]).slerp(new Quaternion().fromArray(values[row]), fraction).toArray()
        : values[row].map((end, column) => values[previous][column] * (1 - fraction) + end * fraction)
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
  return document.nodes.map((_, index) => world(index))
}

test('the personal GLB supplies every original scene interface', () => {
  const names = document.nodes.map(node => node.name)
  for (const name of ['focus-0', 'focus-1', 'focus-2', 'focus-3', 'focus-4', 'focus-5', 'focus-works']) assert(names.includes(name), name)
  assert.equal(document.nodes.filter(node => node.camera !== undefined).length, 1)
  assert(document.animations.some(animation => animation.name === 'CameraAction'))
  assert(document.nodes.filter(node => /eye/i.test(node.name ?? '') && node.mesh !== undefined).length >= 2, 'independent eyes')
  assert(!bytes.includes(Buffer.from('Sen Zheng')), 'no original character identity')
})

test('the complete head has finite geometry and genuine side depth', () => {
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  const matrices = matricesAt(0)
  let count = 0
  document.nodes.forEach((node, index) => {
    if (node.mesh === undefined || /sticker|eye/i.test(node.name ?? '')) return
    for (const primitive of document.meshes[node.mesh].primitives) {
      for (const position of accessorValues(primitive.attributes.POSITION)) {
        const point = new Vector3().fromArray(position).applyMatrix4(matrices[index]).toArray()
        point.forEach((value, dimension) => {
          assert(Number.isFinite(value))
          bounds.min[dimension] = Math.min(bounds.min[dimension], value)
          bounds.max[dimension] = Math.max(bounds.max[dimension], value)
        })
        count += 1
      }
    }
  })
  assert(count > 1000)
  const size = bounds.max.map((value, index) => value - bounds.min[index])
  assert(size[2] / size[1] > 0.2, `head depth / height is ${size[2] / size[1]}`)
})

for (let stop = 1; stop <= 5; stop++) {
  test(`frame ${stop * 50} keeps sticker ${stop} visible beside the résumé`, () => {
    const matrices = matricesAt(stop * 50 / 24)
    const cameraIndex = document.nodes.findIndex(node => node.camera !== undefined)
    const cameraData = document.cameras[document.nodes[cameraIndex].camera].perspective
    const camera = new PerspectiveCamera(cameraData.yfov * 180 / Math.PI, 16 / 9, 0.01, 1000)
    matrices[cameraIndex].decompose(camera.position, camera.quaternion, camera.scale)
    camera.updateMatrixWorld(true)
    const focusIndex = document.nodes.findIndex(node => node.name === `focus-${stop}`)
    const world = new Vector3().setFromMatrixPosition(matrices[focusIndex])
    const point = world.clone().project(camera)
    assert(point.x > -0.95 && point.x < 0, `horizontal NDC ${point.x}`)
    assert(Math.abs(point.y) < 0.6, `vertical NDC ${point.y}`)
    assert(point.z > -1 && point.z < 1, 'sticker is in front of the camera')
  })
}
