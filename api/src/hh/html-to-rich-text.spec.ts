import { richTextSchema } from '../content/rich-text.js'
import { excerpt, htmlToPlain, htmlToRichText } from './html-to-rich-text.js'

const HH = `<p><strong>Обязанности:</strong></p>
<ul>
  <li>Разработка интерфейсов на <em>React</em></li>
  <li>Код-ревью</li>
  <li></li>
</ul>
<p>Мы предлагаем:<br />офис в Ташкенте &amp; ДМС&nbsp;&laquo;Премиум&raquo;</p>
<h3>Как откликнуться</h3><p><a href="javascript:alert(1)">Напишите</a> нам <script>bad()</script></p>`

describe('htmlToRichText', () => {
  it('keeps paragraphs, lists, headings, bold and italic, and passes the editor schema', () => {
    const doc = htmlToRichText(HH)
    expect(richTextSchema.safeParse(doc).success).toBe(true)
    expect(doc.content).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Обязанности:', marks: [{ type: 'bold' }] }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Разработка интерфейсов на ' },
                  { type: 'text', text: 'React', marks: [{ type: 'italic' }] },
                ],
              },
            ],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Код-ревью' }] }],
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Мы предлагаем:' },
          { type: 'hardBreak' },
          { type: 'text', text: 'офис в Ташкенте & ДМС «Премиум»' },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Как откликнуться' }],
      },
      { type: 'paragraph', content: [{ type: 'text', text: 'Напишите нам' }] },
    ])
  })

  it('makes an empty document of nothing', () => {
    expect(htmlToRichText('')).toEqual({ type: 'doc', content: [] })
    expect(htmlToRichText('<p> </p><ul></ul>')).toEqual({ type: 'doc', content: [] })
  })
})

describe('htmlToPlain and excerpt', () => {
  it('make the card text from the description', () => {
    const plain = htmlToPlain(HH)
    expect(plain.startsWith('Обязанности: Разработка интерфейсов на React Код-ревью')).toBe(true)
    expect(excerpt(plain, 40)).toBe('Обязанности: Разработка интерфейсов на…')
    expect(excerpt('short', 40)).toBe('short')
  })
})
