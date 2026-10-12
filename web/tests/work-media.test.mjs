import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractWorkMedia } from '../src/data/workMedia.ts'

test('banner and body references produce one image with the descriptive caption', () => {
  const media = extractWorkMedia('A short story.\n\n![Front](./front.webp)\n\n![Back](./back.webp)\n\n![Again](./front.webp)', './front.webp', 'Shirt')
  assert.deepEqual(media.images, [{ src: './front.webp', alt: 'Front' }, { src: './back.webp', alt: 'Back' }])
  assert.equal(media.body, 'A short story.')
})

test('a missing gallery can still use its banner; no media preserves the text', () => {
  assert.deepEqual(extractWorkMedia('Text', './cover.webp', 'Cover'), { images: [{ src: './cover.webp', alt: 'Cover' }], body: 'Text' })
  assert.deepEqual(extractWorkMedia('Text'), { images: [], body: 'Text' })
})

test('every bilingual project retains its complete, available image collection', () => {
  for (const [slug, count] of [['knowledge-star', 5], ['four', 6], ['photography', 12], ['cycling-fitness', 4], ['stage', 2], ['home-cooking', 12]]) {
    for (const suffix of ['', '-en']) {
      const raw = readFileSync(new URL(`../src/content/works/${slug}${suffix}.md`, import.meta.url), 'utf8')
      const body = raw.split(/^---\s*$/m).at(-1)
      const banner = /^banner:\s*(.*)$/m.exec(raw)?.[1]
      const media = extractWorkMedia(body, banner)
      assert.equal(media.images.length, count, slug + suffix)
      assert.equal(new Set(media.images.map(image => image.src)).size, count)
      for (const image of media.images) {
        assert.ok(image.alt.length > 0)
        assert.ok(existsSync(resolve('public', image.src)), image.src)
      }
      assert.ok(!media.body.includes('!['))
    }
  }
})
