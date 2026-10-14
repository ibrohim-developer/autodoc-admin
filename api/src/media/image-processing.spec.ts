import sharp from 'sharp'
import { processImage } from './image-processing.js'

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 47, g: 138, b: 61 } } })

describe('processImage', () => {
  it('writes WebP copies at every width up to the original', async () => {
    const input = await photo(1500, 1000).jpeg().toBuffer()
    const result = await processImage(input)

    expect(result).toMatchObject({
      mime: 'image/jpeg',
      extension: 'jpg',
      width: 1500,
      height: 1000,
    })
    expect(result.variants.map((v) => v.width)).toEqual([320, 640, 960, 1280, 1500])
    const meta = await sharp(result.variants[0]?.buffer).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.height).toBe(213)
  })

  it('never makes copies wider than 2560 px', async () => {
    const result = await processImage(await photo(4000, 1000).png().toBuffer())
    expect(result.variants.at(-1)?.width).toBe(2560)
  })

  it('applies the camera rotation and strips the metadata', async () => {
    const input = await photo(1200, 800).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const result = await processImage(input)

    expect(result.width).toBe(800)
    expect(result.height).toBe(1200)
    const meta = await sharp(result.variants.at(-1)?.buffer).metadata()
    expect(meta.width).toBe(800)
    expect(meta.orientation).toBeUndefined()
    expect(meta.exif).toBeUndefined()
  })

  it('keeps small images at their own size', async () => {
    const result = await processImage(await photo(200, 100).webp().toBuffer())
    expect(result.variants.map((v) => v.width)).toEqual([200])
  })

  it('refuses SVG, GIF and anything that is not an image', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    )
    await expect(processImage(svg)).rejects.toMatchObject({
      response: { code: 'unsupported_image' },
    })
    const gif = await photo(10, 10).gif().toBuffer()
    await expect(processImage(gif)).rejects.toMatchObject({
      response: { code: 'unsupported_image' },
    })
    await expect(processImage(Buffer.from('not an image'))).rejects.toMatchObject({
      response: { code: 'unsupported_image' },
    })
  })
})
