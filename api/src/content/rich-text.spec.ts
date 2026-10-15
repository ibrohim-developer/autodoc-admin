import {
  excerpt,
  isEmptyRichText,
  isSafeHref,
  type RichText,
  richTextSchema,
  richTextToPlain,
} from './rich-text.js'

const MEDIA_ID = '6d1f6a3e-2b8c-4b2f-9a54-3f0a8a9d1c21'

const article: RichText = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Инфокиоски' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Подробнее ' },
        {
          type: 'text',
          text: 'в видео',
          marks: [{ type: 'link', attrs: { href: 'https://www.youtube.com/watch?v=x' } }],
        },
        { type: 'hardBreak' },
        { type: 'text', text: 'и на сайте.', marks: [{ type: 'bold' }] },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'пункт' }] }],
        },
      ],
    },
    {
      type: 'image',
      attrs: { mediaId: MEDIA_ID, src: `/media/2026/10/${MEDIA_ID}-960.webp`, alt: 'Киоск' },
    },
  ],
}

describe('richTextSchema', () => {
  it('accepts what the editor produces', () => {
    expect(richTextSchema.parse(article)).toEqual(article)
  })

  it('drops attributes the site does not use, such as link targets and classes', () => {
    const parsed = richTextSchema.parse({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [
                { type: 'link', attrs: { href: 'https://a.uz', target: '_blank', class: 'evil' } },
              ],
            },
          ],
        },
      ],
    })
    expect(parsed.content[0]).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://a.uz' } }] },
      ],
    })
  })

  it('refuses script links', () => {
    const result = richTextSchema.safeParse({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('refuses unknown elements and headings other than h2/h3', () => {
    expect(
      richTextSchema.safeParse({ type: 'doc', content: [{ type: 'iframe', attrs: { src: 'x' } }] })
        .success,
    ).toBe(false)
    expect(
      richTextSchema.safeParse({
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'x' }] }],
      }).success,
    ).toBe(false)
  })

  it('only takes photos from the media library', () => {
    const external = {
      type: 'doc',
      content: [{ type: 'image', attrs: { mediaId: MEDIA_ID, src: 'https://evil.example/x.png' } }],
    }
    expect(richTextSchema.safeParse(external).success).toBe(false)
  })
})

describe('isSafeHref', () => {
  it('allows web, mail, phone and on-site links', () => {
    for (const href of [
      'https://autodoc.uz',
      'http://a.uz/x',
      'mailto:info@autodoc.uz',
      'tel:+998555057575',
      '/ru/blog/',
      '#contacts',
    ]) {
      expect(isSafeHref(href)).toBe(true)
    }
  })

  it('refuses everything else', () => {
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,x',
      'vbscript:x',
      '//evil.example',
      'ftp://x',
    ]) {
      expect(isSafeHref(href)).toBe(false)
    }
  })
})

describe('plain text', () => {
  it('extracts readable text', () => {
    expect(richTextToPlain(article)).toBe('Инфокиоски Подробнее в видео и на сайте. пункт')
  })

  it('treats an empty document as empty, and a photo-only one as not', () => {
    expect(isEmptyRichText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true)
    expect(
      isEmptyRichText({ type: 'doc', content: [{ type: 'image', attrs: { mediaId: MEDIA_ID } }] }),
    ).toBe(false)
  })
})

describe('excerpt', () => {
  it('cuts a long text at a word, with an ellipsis', () => {
    expect(excerpt('Infokiosklar Toshkent bo‘ylab o‘rnatildi', 25)).toBe('Infokiosklar Toshkent…')
    expect(excerpt('Qisqa', 25)).toBe('Qisqa')
  })
})
