import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractWorkMedia } from '../src/data/workMedia.ts'
import { PHOTOGRAPHY_SERIES, photographySeriesImages } from '../src/data/photographySeries.ts'

test('curated photography series cover every photo exactly once in both languages', () => {
  for (const suffix of ['', '-en']) {
    const raw = readFileSync(new URL(`../src/content/works/photography${suffix}.md`, import.meta.url), 'utf8')
    const images = extractWorkMedia(raw.split(/^---\s*$/m).at(-1)).images
    const groups = PHOTOGRAPHY_SERIES.map(group => photographySeriesImages(images, group.id))
    assert.deepEqual(groups.map(group => group.length), [6, 3, 3])
    const curated = groups.flat()
    assert.equal(new Set(curated.map(image => image.src)).size, 12)
    assert.deepEqual(curated, images)
    assert.deepEqual(photographySeriesImages(images, 'all'), images)
  }
})

test('empty or incomplete photo collections retain only available photos in curated order', () => {
  assert.deepEqual(photographySeriesImages([], 'all'), [])
  const photos = [{ src: './media/ladder-silhouette.jpg', alt: 'Ladder' }, { src: './media/red-carved-lacquer.jpg', alt: 'Lacquer' }]
  assert.deepEqual(photographySeriesImages(photos, 'structure'), [photos[1], photos[0]])
  assert.deepEqual(photographySeriesImages(photos, 'coast'), [])
})
