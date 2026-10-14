import {
  collectMediaIds,
  type DocumentData,
  filledLocales,
  hashData,
  localize,
  stableStringify,
} from './document-data.js'

const body = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})
const emptyBody = { type: 'doc', content: [{ type: 'paragraph' }] }

const data: DocumentData = {
  shared: { date: '2026-10-10', cover: { mediaId: 'a1' } },
  locales: {
    uz: { title: 'Infokiosklar', excerpt: 'Qisqa', body: body('Matn') },
    ru: { title: 'Инфокиоски', excerpt: '', body: emptyBody },
  },
}

describe('localize', () => {
  it('returns Uzbek as is', () => {
    expect(localize(data, 'uz')).toEqual({
      fields: {
        date: '2026-10-10',
        cover: { mediaId: 'a1' },
        title: 'Infokiosklar',
        excerpt: 'Qisqa',
        body: body('Matn'),
      },
      translated: true,
    })
  })

  it('fills untranslated fields from Uzbek, field by field', () => {
    const { fields, translated } = localize(data, 'ru')
    expect(translated).toBe(true)
    expect(fields.title).toBe('Инфокиоски')
    // Empty string and an empty editor both count as "not translated".
    expect(fields.excerpt).toBe('Qisqa')
    expect(fields.body).toEqual(body('Matn'))
  })

  it('shows a document with no English at all in Uzbek, marked untranslated', () => {
    const { fields, translated } = localize(data, 'en')
    expect(translated).toBe(false)
    expect(fields.title).toBe('Infokiosklar')
  })
})

describe('hashData', () => {
  it('ignores key order, which Postgres jsonb changes', () => {
    expect(hashData({ b: 1, a: { d: [1, 2], c: 'x' } })).toBe(
      hashData({ a: { c: 'x', d: [1, 2] }, b: 1 }),
    )
    expect(hashData({ a: 1 })).not.toBe(hashData({ a: 2 }))
  })

  it('treats a missing key and an undefined one the same', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }))
  })
})

describe('collectMediaIds', () => {
  it('finds photos anywhere: shared fields, galleries, inside the text', () => {
    const ids = collectMediaIds({
      shared: { cover: { mediaId: 'a1' }, gallery: [{ mediaId: 'b2' }, { mediaId: 'a1' }] },
      locales: {
        uz: { body: { type: 'doc', content: [{ type: 'image', attrs: { mediaId: 'c3' } }] } },
      },
    })
    expect([...ids].sort()).toEqual(['a1', 'b2', 'c3'])
  })
})

describe('filledLocales', () => {
  it('lists Uzbek and any language with real content', () => {
    expect(filledLocales(data)).toEqual(['uz', 'ru'])
    expect(filledLocales({ shared: {}, locales: { uz: {}, en: { title: ' ' } } })).toEqual(['uz'])
  })
})
