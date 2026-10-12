import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { smoothPortraitNormals } from '../src/scene/portrait-normals.ts'

const eyes = [new THREE.Vector3(-0.13645, 0.123, 0.299), new THREE.Vector3(0.14044, 0.12256, 0.307)]

test('local shading noise falls without moving geometry, UVs or source normals', () => {
  const source = new THREE.PlaneGeometry(0.06, 0.06, 4, 4).translate(0.24, -0.1, 0.44)
  const normal = source.getAttribute('normal')
  for (let vertex = 0; vertex < normal.count; vertex++) {
    const value = new THREE.Vector3(vertex % 2 ? 0.25 : -0.25, 0, 1).normalize()
    normal.setXYZ(vertex, value.x, value.y, value.z)
  }
  const before = normal.array.slice()
  const result = smoothPortraitNormals(source, eyes)
  assert.deepEqual(source.getAttribute('normal').array, before)
  assert.deepEqual(result.getAttribute('position').array, source.getAttribute('position').array)
  assert.deepEqual(result.getAttribute('uv').array, source.getAttribute('uv').array)
  assert.deepEqual(result.index.array, source.index.array)
  const filtered = result.getAttribute('normal')
  const originalNoise = Array.from({ length: normal.count }, (_, i) => normal.getX(i) ** 2).reduce((a, b) => a + b)
  const filteredNoise = Array.from({ length: normal.count }, (_, i) => filtered.getX(i) ** 2).reduce((a, b) => a + b)
  assert.ok(filteredNoise < originalNoise * 0.3)
  for (let i = 0; i < filtered.count; i++) assert.ok(Math.abs(Math.hypot(filtered.getX(i), filtered.getY(i), filtered.getZ(i)) - 1) < 1e-6)
  result.dispose()
  source.dispose()
})

test('unindexed or incomplete meshes return a private unchanged geometry', () => {
  for (const source of [new THREE.BufferGeometry(), new THREE.PlaneGeometry().toNonIndexed()]) {
    const result = smoothPortraitNormals(source, eyes)
    assert.notEqual(result, source)
    if (source.getAttribute('position')) assert.deepEqual(result.getAttribute('position').array, source.getAttribute('position').array)
    result.dispose()
    source.dispose()
  }
})

test('the actual portrait reduces cheek normal variation while protecting features and texture coordinates', () => {
  const bytes = readFileSync(new URL('../public/models/me.glb', import.meta.url))
  const size = bytes.readUInt32LE(12)
  const document = JSON.parse(bytes.subarray(20, 20 + size).toString('utf8'))
  const binary = bytes.subarray(28 + size)
  const material = document.materials.findIndex(value => value.name === 'Haoyang-Complete-Mesh-Portrait')
  const primitive = document.meshes.flatMap(mesh => mesh.primitives).find(value => value.material === material)
  const attribute = index => {
    const accessor = document.accessors[index]
    const view = document.bufferViews[accessor.bufferView]
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[accessor.type]
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const bytesPerElement = { 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType]
    const stride = view.byteStride ?? width * bytesPerElement
    const read = { 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' }[accessor.componentType]
    const values = Array.from({ length: accessor.count * width }, (_, i) => binary[read](offset + Math.floor(i / width) * stride + i % width * bytesPerElement))
    return new THREE.BufferAttribute(accessor.componentType === 5126 ? new Float32Array(values) : new Uint32Array(values), width)
  }
  const source = new THREE.BufferGeometry()
  source.setAttribute('position', attribute(primitive.attributes.POSITION))
  source.setAttribute('normal', attribute(primitive.attributes.NORMAL))
  source.setAttribute('uv', attribute(primitive.attributes.TEXCOORD_0))
  source.setIndex(attribute(primitive.indices))
  const result = smoothPortraitNormals(source, eyes)
  const positions = source.getAttribute('position')
  const before = source.getAttribute('normal'), after = result.getAttribute('normal')
  let protectedCount = 0, cheekEdges = 0, oldVariation = 0, newVariation = 0
  const cheek = i => Math.abs(positions.getX(i)) > 0.19 && Math.abs(positions.getX(i)) < 0.28 && positions.getY(i) < -0.035 && positions.getY(i) > -0.18 && positions.getZ(i) > 0.38
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const protectedFeature = z <= 0.25 || y >= 0.36 || y <= -0.36
      || Math.hypot(x / 0.105, (y + 0.065) / 0.17) <= 0.8
      || Math.hypot(x / 0.17, (y + 0.24) / 0.07) <= 0.8
      || eyes.some(eye => Math.hypot((x - eye.x) / 0.16, (y - eye.y) / 0.10) <= 0.9)
    if (protectedFeature) {
      for (const axis of ['getX', 'getY', 'getZ']) assert.equal(after[axis](i), before[axis](i))
      protectedCount++
    }
  }
  for (let i = 0; i < source.index.count; i += 3) {
    const triangle = [source.index.getX(i), source.index.getX(i + 1), source.index.getX(i + 2)]
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge], b = triangle[(edge + 1) % 3]
      if (!cheek(a) || !cheek(b)) continue
      for (const axis of ['getX', 'getY', 'getZ']) {
        oldVariation += (before[axis](a) - before[axis](b)) ** 2
        newVariation += (after[axis](a) - after[axis](b)) ** 2
      }
      cheekEdges++
    }
  }
  assert.ok(protectedCount > 1000)
  assert.ok(cheekEdges > 100)
  assert.ok(newVariation < oldVariation * 0.75)
  assert.deepEqual(result.getAttribute('position').array, positions.array)
  assert.deepEqual(result.getAttribute('uv').array, source.getAttribute('uv').array)
  source.dispose()
  result.dispose()
})
