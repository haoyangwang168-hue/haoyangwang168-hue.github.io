import test from 'node:test'
import assert from 'node:assert/strict'
import { createGalleryImageSlot } from '../src/ui/gallery-image-slot.ts'
import { galleryFrames, gallerySlot } from '../src/ui/gallery-math.ts'

function fixture() {
  const images = []
  const states = []
  const button = { dataset: {}, prepend: image => { image.attached = true } }
  const create = () => {
    let resolve, reject
    const decoding = new Promise((yes, no) => { resolve = yes; reject = no })
    const image = { dataset: {}, style: {}, attached: false, onload: null, onerror: null,
      decode: () => decoding, resolve, reject, remove() { this.attached = false } }
    images.push(image)
    return image
  }
  const slot = createGalleryImageSlot(button, (image, state) => states.push({ image, state }), create)
  return { slot, button, images, states }
}
const asset = name => ({ src: `${name}.webp`, srcSet: `${name}-640.webp 640w, ${name}.webp 1280w`, alt: name, displayWidth: 150 })

test('crossing a sequence boundary keeps every shared photo in its existing DOM slot', () => {
  for (const pair of [[0.99, 1.01], [1.01, 0.99], [-0.01, 0.01]]) {
    const assignments = pair.map(p => new Map(galleryFrames(p, 1200, 600, 20).map((box, order) => [box.index, gallerySlot(p, order)])))
    let shared = 0
    for (const [index, slot] of assignments[0]) {
      if (!assignments[1].has(index)) continue
      assert.equal(assignments[1].get(index), slot)
      shared++
    }
    assert.equal(shared, 9)
  }
})

test('image stays hidden until decode finishes, with no repeated request on redraw', async () => {
  const f = fixture()
  f.slot.assign(asset('a'))
  f.slot.assign(asset('a'))
  assert.equal(f.images.length, 1)
  const image = f.images[0]
  assert.equal(image.style.visibility, 'hidden')
  const loaded = image.onload()
  assert.equal(f.button.dataset.imageState, 'loading')
  image.resolve()
  await loaded
  assert.equal(image.style.visibility, 'visible')
  assert.equal(f.button.dataset.imageState, 'ready')
})

test('late completion cannot replace the next image or expose a previous photograph', async () => {
  const f = fixture()
  f.slot.assign(asset('a'))
  const old = f.images[0]
  const pending = old.onload()
  f.slot.assign(asset('b'))
  assert.equal(old.attached, false)
  old.resolve()
  await pending
  assert.equal(f.button.dataset.imageState, 'loading')
  assert.equal(f.slot.image().alt, 'b')
  assert.equal(f.slot.image().style.visibility, 'hidden')
  assert.equal(f.states.filter(s => s.state === 'ready').length, 0)
})

test('growing frames upgrade their responsive size without blanking or replacing decoded pixels', async () => {
  const f = fixture()
  f.slot.assign(asset('a'))
  const picture = f.images[0]
  assert.equal(picture.sizes, '192px')
  const loaded = picture.onload()
  picture.resolve()
  await loaded
  f.slot.assign({ ...asset('a'), displayWidth: 700 })
  assert.equal(f.images.length, 1)
  assert.equal(picture.sizes, '704px')
  assert.equal(picture.style.visibility, 'visible')
  assert.equal(f.button.dataset.imageState, 'ready')
  f.slot.assign(asset('a'))
  assert.equal(picture.sizes, '704px', 'backward movement keeps the already downloaded resolution')
  f.slot.assign(asset('b'))
  assert.equal(f.images[1].sizes, '192px', 'a recycled slot starts at its new photograph size')
})

test('late candidate decoding cannot overwrite a higher-resolution image and retry keeps its size', async () => {
  const f = fixture()
  f.slot.assign(asset('a'))
  const picture = f.images[0]
  picture.currentSrc = 'a-640.webp'
  const oldDecode = picture.onload()
  f.slot.assign({ ...asset('a'), displayWidth: 900 })
  picture.currentSrc = 'a.webp'
  picture.decode = () => Promise.resolve()
  await picture.onload()
  f.images[0].reject(new Error('Old candidate was replaced'))
  await oldDecode
  assert.equal(f.button.dataset.imageState, 'ready')
  picture.onerror()
  f.slot.retry()
  assert.equal(f.images[1].sizes, '960px')
})

test('a size change that keeps the same candidate does not invalidate its only load event', async () => {
  const f = fixture()
  f.slot.assign({ ...asset('a'), displayWidth: 300 })
  const picture = f.images[0]
  picture.currentSrc = 'a-640.webp'
  const loaded = picture.onload()
  f.slot.assign({ ...asset('a'), displayWidth: 350 })
  picture.resolve()
  await loaded
  assert.equal(picture.style.visibility, 'visible')
  assert.equal(f.button.dataset.imageState, 'ready')
})

test('failure shows a placeholder and retries the current responsive source in a fresh node', async () => {
  const f = fixture()
  f.slot.assign(asset('b'))
  f.images[0].onerror()
  assert.equal(f.button.dataset.imageState, 'error')
  f.slot.retry()
  assert.equal(f.images.length, 2)
  assert.equal(f.images[0].attached, false)
  assert.equal(f.images[1].srcset, asset('b').srcSet)
  const loaded = f.images[1].onload()
  f.images[1].resolve()
  await loaded
  assert.equal(f.button.dataset.imageState, 'ready')
})

test('unmount invalidates pending decoding and detached error callbacks', async () => {
  const f = fixture()
  f.slot.assign(asset('a'))
  const image = f.images[0]
  const pending = image.onload()
  const error = image.onerror
  f.slot.dispose()
  const count = f.states.length
  image.resolve()
  await pending
  error()
  assert.equal(f.states.length, count)
  assert.equal(image.attached, false)
})
