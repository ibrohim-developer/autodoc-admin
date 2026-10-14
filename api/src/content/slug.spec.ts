import { isSlug, slugify } from './slug.js'

describe('slugify', () => {
  it('keeps Uzbek Latin readable, dropping the apostrophe marks', () => {
    expect(slugify('Avtomobillarni roʻyxatdan oʻtkazish')).toBe('avtomobillarni-royxatdan-otkazish')
    expect(slugify("G'alaba kuni bilan!")).toBe('galaba-kuni-bilan')
  })

  it('transliterates Russian and Uzbek Cyrillic', () => {
    expect(slugify('Регистрация транспорта')).toBe('registratsiya-transporta')
    expect(slugify('Щедрая ёлка')).toBe('schedraya-yolka')
    expect(slugify('Қўшимча ғоя ҳақида')).toBe('qoshimcha-goya-haqida')
  })

  it('collapses punctuation and trims hyphens', () => {
    expect(slugify('  CEO-завтрак — 2026!  ')).toBe('ceo-zavtrak-2026')
    expect(slugify('a --- b')).toBe('a-b')
  })

  it('stays within the length limit without a trailing hyphen', () => {
    const slug = slugify(`${'слово '.repeat(40)}`)
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('returns an empty slug for text with nothing usable', () => {
    expect(slugify('!!! ???')).toBe('')
  })
})

describe('isSlug', () => {
  it('accepts clean slugs only', () => {
    expect(isSlug('info-kiosks-2026')).toBe(true)
    expect(isSlug('14')).toBe(true)
    expect(isSlug('Info')).toBe(false)
    expect(isSlug('a--b')).toBe(false)
    expect(isSlug('-a')).toBe(false)
  })
})
