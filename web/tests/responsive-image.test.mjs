import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { IMAGE_VARIANTS } from '../src/data/imageVariants.ts'
import { responsiveImage } from '../src/data/responsiveImage.ts'

test('preview URLs retain root, relative and subdirectory deployment paths', () => {
  for (const prefix of ['', './', '/', '/portfolio/']) {
    const preview = responsiveImage(`${prefix}media/haoyang-sunglasses.jpg`)
    assert.equal(preview.src, `${prefix}media/optimized/haoyang-sunglasses-1280.webp`)
    assert.equal(preview.srcSet, `${prefix}media/optimized/haoyang-sunglasses-640.webp 640w, ${prefix}media/optimized/haoyang-sunglasses-1280.webp 1280w`)
    // EXIF orientation 6 is baked into the previews, giving a portrait aspect ratio.
    assert.deepEqual([preview.width, preview.height], [2316, 3088])
  }
})

test('external media and assets without previews keep their exact original URLs', () => {
  for (const source of ['https://example.com/media/haoyang-sunglasses.jpg', '//example.com/media/haoyang-sunglasses.jpg', 'data:image/png;base64,abc', './media/new-photo.jpg', './media/haoyang-sunglasses.jpg?download=1', '']) {
    assert.deepEqual(responsiveImage(source), { src: source })
  }
})

test('all preview candidates exist and reduce the collective image payload', () => {
  let originalBytes = 0
  let smallBytes = 0
  for (const [source, image] of Object.entries(IMAGE_VARIANTS)) {
    originalBytes += statSync(resolve('public', source)).size
    assert.ok(image.smallWidth <= 640 && image.largeWidth <= 1280)
    assert.ok(image.smallWidth <= image.largeWidth && image.largeWidth <= image.width)
    for (const candidate of [image.small, image.large]) {
      const file = readFileSync(resolve('public', candidate))
      assert.equal(file.toString('ascii', 0, 4), 'RIFF')
      assert.equal(file.toString('ascii', 8, 12), 'WEBP')
    }
    smallBytes += statSync(resolve('public', image.small)).size
  }
  assert.ok(smallBytes < originalBytes * 0.2)
  assert.ok(statSync('public/media/optimized/haoyang-sunglasses-640.webp').size < 100 * 1024)
})
