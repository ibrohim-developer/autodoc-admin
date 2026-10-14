import { UnprocessableEntityException } from '@nestjs/common'
import sharp, { type Metadata } from 'sharp'

/** Widths produced for every photo: phones, tablets, laptops, large screens. */
export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920, 2560] as const
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
/** Refuse decompression bombs: a small file that expands to gigapixels. */
const MAX_INPUT_PIXELS = 100_000_000
const WEBP_QUALITY = 80

export type ProcessedImage = {
  mime: string
  extension: string
  /** After fixing the camera rotation. */
  width: number
  height: number
  variants: { width: number; height: number; buffer: Buffer }[]
}

const unsupported = (message: string) =>
  new UnprocessableEntityException({ code: 'unsupported_image', message })

function formatOf(meta: Metadata): { mime: string; extension: string } {
  switch (meta.format) {
    case 'jpeg':
      return { mime: 'image/jpeg', extension: 'jpg' }
    case 'png':
      return { mime: 'image/png', extension: 'png' }
    case 'webp':
      return { mime: 'image/webp', extension: 'webp' }
    case 'heif':
      // AVIF is HEIF with AV1 inside; iPhone HEIC (HEVC inside) can't be decoded here.
      if (meta.compression === 'av1') return { mime: 'image/avif', extension: 'avif' }
      throw unsupported(
        'Формат HEIC (iPhone) не поддерживается. Сохраните фото как JPG и загрузите снова.',
      )
    default:
      // SVG is refused on purpose: it can carry scripts.
      throw unsupported('Поддерживаются фото в форматах JPG, PNG, WebP и AVIF.')
  }
}

/**
 * Checks the file by its content (not its name), fixes the rotation from the camera, strips
 * all metadata (GPS, camera, author) and writes WebP copies at the widths above, never wider
 * than the original.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  let meta: Metadata
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
  } catch {
    throw unsupported('Файл не похож на изображение или повреждён.')
  }
  const format = formatOf(meta)
  if (!meta.width || !meta.height) throw unsupported('Не удалось прочитать размеры изображения.')

  // EXIF orientations 5–8 are rotated by 90°: width and height swap once applied.
  const rotated = (meta.orientation ?? 1) >= 5
  const width = rotated ? meta.height : meta.width
  const height = rotated ? meta.width : meta.height

  const largest = Math.min(width, VARIANT_WIDTHS.at(-1) ?? width)
  const widths = [...new Set([...VARIANT_WIDTHS.filter((w) => w < largest), largest])]

  // Metadata is dropped because .withMetadata() is never called; .rotate() bakes the orientation in.
  const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate()
  const variants: ProcessedImage['variants'] = []
  for (const target of widths) {
    const { data, info } = await base
      .clone()
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true })
    variants.push({ width: info.width, height: info.height, buffer: data })
  }

  return { ...format, width, height, variants }
}
