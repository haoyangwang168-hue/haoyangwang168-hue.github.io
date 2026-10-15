import test from 'node:test'
import assert from 'node:assert/strict'
import { loadDecodedImage } from '../src/ui/decoded-image.ts'

function fixture() {
  let resolve, reject
  const decode = new Promise((yes, no) => { resolve = yes; reject = no })
  const image = { decode: () => decode, onload: null, onerror: null }
  const events = []
  const dispose = loadDecodedImage('full.jpg', () => events.push('ready'), () => events.push('error'), () => image)
  return { image, events, resolve, reject, dispose }
}

test('a full image replaces its preview only after decoding completes', async () => {
  const f = fixture()
  const loaded = f.image.onload()
  assert.deepEqual(f.events, [])
  assert.equal(f.image.fetchPriority, 'low')
  f.resolve()
  await loaded
  assert.deepEqual(f.events, ['ready'])
})

test('navigating away invalidates a delayed full-image decode and failure', async () => {
  const f = fixture()
  const loaded = f.image.onload()
  const failed = f.image.onerror
  f.dispose()
  f.resolve()
  await loaded
  failed()
  assert.deepEqual(f.events, [])
})

test('network and decode failures retain the preview instead of marking the original ready', async () => {
  const network = fixture()
  network.image.onerror()
  assert.deepEqual(network.events, ['error'])
  const decoding = fixture()
  const loaded = decoding.image.onload()
  decoding.reject(new Error('Decode failed'))
  await loaded
  assert.deepEqual(decoding.events, ['error'])
})
