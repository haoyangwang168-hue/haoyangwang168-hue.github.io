export interface GalleryImageRequest { src: string; srcSet?: string; alt: string; displayWidth: number }
type ImageState = 'loading' | 'ready' | 'error' | 'removed'

/** A recycled slot never displays pixels from an earlier request, even if it finishes late. */
export function createGalleryImageSlot(button: HTMLButtonElement, notify: (image: HTMLImageElement, state: ImageState) => void, makeImage: () => HTMLImageElement = () => new Image()) {
  let request: GalleryImageRequest | null = null
  let picture: HTMLImageElement | null = null
  let generation = 0
  let candidate = 0
  let state: ImageState = 'removed'
  let requestedWidth = 0
  const remove = (): void => {
    if (!picture) return
    picture.onload = null
    picture.onerror = null
    picture.remove()
    notify(picture, 'removed')
    picture = null
  }
  const assign = (next: GalleryImageRequest, retry = false): void => {
    // Grow a responsive candidate in place, keeping decoded pixels on screen.
    const width = Math.max(1, Math.ceil(next.displayWidth / 64) * 64)
    if (!retry && request?.src === next.src && request?.srcSet === next.srcSet) {
      if (picture && width > requestedWidth) {
        requestedWidth = width
        request = { ...next, displayWidth: width }
        picture.sizes = `${width}px`
      }
      return
    }
    request = next
    requestedWidth = width
    const version = ++generation
    candidate++
    remove()
    const image = makeImage()
    picture = image
    state = 'loading'
    button.dataset.imageState = state
    image.dataset.galleryPreview = 'true'
    image.style.visibility = 'hidden'
    image.alt = next.alt
    image.draggable = false
    image.decoding = 'async'
    image.sizes = `${width}px`
    const failed = (resolution: number, source: string): void => {
      if (version !== generation || resolution !== candidate || source !== image.currentSrc) return
      state = 'error'
      button.dataset.imageState = state
      notify(image, state)
    }
    image.onerror = () => failed(candidate, image.currentSrc)
    image.onload = async (): Promise<void> => {
      const resolution = ++candidate
      const source = image.currentSrc
      try {
        await image.decode()
        if (version !== generation || resolution !== candidate || source !== image.currentSrc) return
        state = 'ready'
        button.dataset.imageState = state
        // A ready preload must remain hidden with its offscreen slot.
        image.style.visibility = 'inherit'
        notify(image, state)
      } catch { failed(resolution, source) }
    }
    button.prepend(image)
    notify(image, state)
    // A new node also makes retry meaningful; no already-failed currentSrc is retained.
    if (next.srcSet) image.srcset = next.srcSet
    image.src = next.src
  }
  return {
    assign,
    image: (): HTMLImageElement | null => picture,
    retry: (): void => { if (state === 'error' && request) assign(request, true) },
    dispose: (): void => { generation++; remove(); request = null },
  }
}
