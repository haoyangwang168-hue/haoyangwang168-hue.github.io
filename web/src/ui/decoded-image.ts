/** Decode offscreen before replacing a preview; disposal invalidates late callbacks. */
export function loadDecodedImage(src: string, ready: () => void, failed: () => void, makeImage: () => HTMLImageElement = () => new Image()): () => void {
  const image = makeImage()
  let active = true
  image.decoding = 'async'
  image.fetchPriority = 'low'
  image.onerror = () => { if (active) failed() }
  image.onload = async (): Promise<void> => {
    try {
      await image.decode()
      if (active) ready()
    } catch { if (active) failed() }
  }
  image.src = src
  return () => { active = false; image.onload = null; image.onerror = null }
}
