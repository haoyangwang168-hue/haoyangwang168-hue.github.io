import { IMAGE_VARIANTS } from './imageVariants.ts'

interface ResponsiveImage {
  src: string
  srcSet?: string
  width?: number
  height?: number
}

/** Select local previews without changing external URLs or full-size media references. */
export function responsiveImage(src: string): ResponsiveImage {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src)) return { src }
  const match = /^(.*?)(media\/[^?#]+)$/.exec(src)
  const image = match && IMAGE_VARIANTS[match[2]]
  if (!match || !image) return { src }
  const prefix = match[1]
  const small = `${prefix}${image.small} ${image.smallWidth}w`
  const large = `${prefix}${image.large} ${image.largeWidth}w`
  return {
    src: prefix + image.large,
    srcSet: image.smallWidth === image.largeWidth ? small : `${small}, ${large}`,
    width: image.width,
    height: image.height,
  }
}
