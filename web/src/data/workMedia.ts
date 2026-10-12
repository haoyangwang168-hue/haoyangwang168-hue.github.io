export interface WorkImage {
  src: string
  alt: string
}

/** Keep Markdown as the source of truth while presenting each image once in a gallery. */
export function extractWorkMedia(body: string, banner?: string, title = ''): { images: WorkImage[]; body: string } {
  const images: WorkImage[] = []
  const seen = new Set<string>()
  const imagePattern = /!\[([^\]]*)\]\(([^\s)]+)\)/g
  const text = body.replace(imagePattern, (_, alt: string, src: string) => {
    if (!seen.has(src)) { images.push({ src, alt }); seen.add(src) }
    return ''
  }).replace(/\n{3,}/g, '\n\n').trim()
  if (banner && !seen.has(banner)) images.unshift({ src: banner, alt: title })
  return { images, body: text }
}
