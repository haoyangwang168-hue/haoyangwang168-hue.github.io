export interface GalleryImageRequest { src: string; srcSet?: string; alt: string }
type ImageState = 'loading' | 'ready' | 'error' | 'removed'

/** A recycled slot never displays pixels from an earlier request, even if it finishes late. */
export function createGalleryImageSlot(button: HTMLButtonElement, notify: (image: HTMLImageElement, state: ImageState) => void, makeImage: () => HTMLImageElement = () => new Image()) {
  let request: GalleryImageRequest | null = null
  let picture: HTMLImageElement | null = null
  let generation = 0
  let state: ImageState = 'removed'
  const remove = (): void => {
    if (!picture) return
    picture.onload = null
    picture.onerror = null
    picture.remove()
    notify(picture, 'removed')
    picture = null
  }
  const assign = (next: GalleryImageRequest, retry = false): void => {
    if (!retry && request?.src === next.src && request?.srcSet === next.srcSet) return
    request = next
    const version = ++generation
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
    image.sizes = '(max-width: 640px) 90vw, 60vw'
    const failed = (): void => {
      if (version !== generation) return
      state = 'error'
      button.dataset.imageState = state
      notify(image, state)
    }
    image.onerror = failed
    image.onload = async (): Promise<void> => {
      try {
        await image.decode()
        if (version !== generation) return
        state = 'ready'
        button.dataset.imageState = state
        image.style.visibility = 'visible'
        notify(image, state)
      } catch { failed() }
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
