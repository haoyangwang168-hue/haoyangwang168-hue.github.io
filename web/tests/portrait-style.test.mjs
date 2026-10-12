import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { clonePortraitMaterial, stylePortraitMaterial } from '../src/scene/portrait-style.ts'

test('portrait styling preserves original textures, colors and shared source materials', () => {
  for (const name of ['Haoyang-Complete-Mesh-Portrait', 'Haoyang-Nose-Continuous-Portrait']) {
    const source = new THREE.MeshPhysicalMaterial({ name, map: new THREE.Texture(), roughness: 0.88, color: '#debfa6' })
    const copy = source.clone()
    stylePortraitMaterial(copy)
    assert.equal(copy.map, source.map)
    assert.equal(copy.color.getHex(), source.color.getHex())
    assert.equal(source.roughness, 0.88)
    assert.ok(copy.roughness > 0.8 && copy.roughness < source.roughness)
    assert.ok(copy.specularIntensity < 0.25)
    assert.ok(copy.envMapIntensity < source.envMapIntensity)
    assert.equal(copy.transparent, source.transparent)
    assert.equal(copy.side, source.side)
    copy.dispose()
    source.map.dispose()
    source.dispose()
  }
})

test('stickers, hair and socket shadows keep their authored materials and shaders', () => {
  for (const name of ['original-sticker-1', 'ReferenceHair_SoftCharcoalLocks', 'FixedSocketShadow']) {
    const material = new THREE.MeshPhysicalMaterial({ name, roughness: 0.82, specularIntensity: 0.12 })
    const shader = { vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader }
    const before = { ...shader }
    stylePortraitMaterial(material)
    assert.equal(material.roughness, 0.82)
    assert.equal(material.specularIntensity, 0.12)
    assert.deepEqual(shader, before)
    material.dispose()
  }
})

test('the vertex-colored head and portrait atlas have equal reflectance at their shared boundaries', () => {
  const head = new THREE.MeshStandardMaterial({ name: 'Haoyang_Colored_Resin', vertexColors: true, roughness: 0.82, color: '#ffffff' })
  const portrait = new THREE.MeshPhysicalMaterial({ name: 'Haoyang-Complete-Mesh-Portrait', map: new THREE.Texture(), roughness: 0.82, specularIntensity: 0.44 })
  const bodyCopy = clonePortraitMaterial(head), faceCopy = clonePortraitMaterial(portrait)
  assert.ok(bodyCopy instanceof THREE.MeshPhysicalMaterial)
  assert.equal(bodyCopy.defines.PHYSICAL, '')
  assert.equal(bodyCopy.vertexColors, true)
  assert.equal(bodyCopy.color.getHex(), head.color.getHex())
  assert.equal(faceCopy.map, portrait.map)
  for (const property of ['roughness', 'metalness', 'ior', 'specularIntensity', 'envMapIntensity', 'clearcoat', 'transmission', 'thickness']) {
    assert.ok(Number.isFinite(bodyCopy[property]), `${property} remains finite after upgrading a standard material`)
    assert.equal(bodyCopy[property], faceCopy[property], `${property} cannot create a rectangular lighting seam`)
  }
  assert.equal(bodyCopy.specularColor.getHex(), faceCopy.specularColor.getHex())
  // At normal incidence the dielectric F0 is 0.04 × 0.18 = 0.0072 on both parts.
  const reflectance = material => ((material.ior - 1) / (material.ior + 1)) ** 2 * material.specularIntensity
  assert.ok(Math.abs(reflectance(bodyCopy) - 0.0072) < 1e-9)
  assert.equal(reflectance(bodyCopy), reflectance(faceCopy))
  assert.equal(head.roughness, 0.82)
  assert.equal(head.type, 'MeshStandardMaterial')
  assert.equal(portrait.specularIntensity, 0.44)
  bodyCopy.dispose()
  faceCopy.dispose()
  head.dispose()
  portrait.map.dispose()
  portrait.dispose()
})

test('both iris materials receive highlights without losing their photographic maps', () => {
  for (const name of ['original-photographic-iris', 'original-photographic-iris.001']) {
    const material = new THREE.MeshPhysicalMaterial({ name, map: new THREE.Texture(), roughness: 0.3 })
    const map = material.map
    stylePortraitMaterial(material)
    assert.equal(material.map, map)
    assert.ok(material.roughness < 0.3)
    assert.ok(material.specularIntensity > 0.75)
    map.dispose()
    material.dispose()
  }
})
