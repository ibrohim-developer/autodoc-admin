import { PREVIEW_TTL_SECONDS, previewUrl, verifyPreview } from './preview.js'

const SECRET = 'preview-secret-preview-secret-preview-secret'
const NOW = Date.UTC(2026, 9, 13, 9, 0, 0)

function parse(url: string) {
  const params = new URL(url).searchParams
  return {
    path: params.get('path') ?? '',
    exp: params.get('exp') ?? '',
    sig: params.get('sig') ?? '',
  }
}

describe('preview links', () => {
  it('point at the site and verify with the same secret', () => {
    const url = previewUrl('https://autodoc.uz', '/ru/blog/info-kiosks/', SECRET, NOW)
    expect(url.startsWith('https://autodoc.uz/api/draft/?')).toBe(true)
    expect(verifyPreview(parse(url), SECRET, NOW)).toBe(true)
  })

  it('stop working after ten minutes', () => {
    const url = previewUrl('https://autodoc.uz', '/blog/x/', SECRET, NOW)
    expect(verifyPreview(parse(url), SECRET, NOW + (PREVIEW_TTL_SECONDS - 1) * 1000)).toBe(true)
    expect(verifyPreview(parse(url), SECRET, NOW + (PREVIEW_TTL_SECONDS + 1) * 1000)).toBe(false)
  })

  it('only open their own path', () => {
    const link = parse(previewUrl('https://autodoc.uz', '/blog/x/', SECRET, NOW))
    expect(verifyPreview({ ...link, path: '/blog/y/' }, SECRET, NOW)).toBe(false)
    expect(verifyPreview(link, 'another-secret-another-secret-another', NOW)).toBe(false)
  })

  it('never open another site', () => {
    const link = parse(previewUrl('https://autodoc.uz', '//evil.example/', SECRET, NOW))
    expect(verifyPreview(link, SECRET, NOW)).toBe(false)
  })
})
