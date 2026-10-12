import type { WorkImage } from './workMedia'

export const PHOTOGRAPHY_SERIES = [
  { id: 'coast', zh: '山海与旅途', en: 'Coasts & journeys', files: ['sunset-camera.webp', 'teal-sea.webp', 'friends-at-dusk.webp', 'island-village.webp', 'pine-framed-bay.webp', 'sunset-fishing-boat.jpg'] },
  { id: 'structure', zh: '光影与结构', en: 'Light & structure', files: ['runners-blue-sky.jpg', 'red-carved-lacquer.jpg', 'ladder-silhouette.jpg'] },
  { id: 'everyday', zh: '日常细节', en: 'Everyday details', files: ['branches-blue-sky.jpg', 'bamboo-cat-figurines.jpg', 'red-good-fortune-tags.jpg'] },
] as const

/** Preserve the curated order and return only media available in the current document. */
export function photographySeriesImages(images: WorkImage[], series: string): WorkImage[] {
  const group = PHOTOGRAPHY_SERIES.find(item => item.id === series)
  if (!group) return PHOTOGRAPHY_SERIES.flatMap(item => photographySeriesImages(images, item.id))
  return group.files.flatMap(file => images.filter(image => image.src.split('/').pop() === file))
}
