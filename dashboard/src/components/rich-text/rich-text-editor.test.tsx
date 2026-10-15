import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type { RichTextDoc } from '@/lib/rich-text'
import { meFixtures, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { RichTextEditor } from './rich-text-editor'

/** Like a real form: keeps the latest content in state, which re-renders on every keystroke. */
function Harness({
  onChange,
  initial,
}: {
  onChange: (doc: RichTextDoc) => void
  initial?: RichTextDoc
}) {
  const [, setValue] = useState<RichTextDoc | null>(null)
  return (
    <RichTextEditor
      label="Текст новости"
      initialValue={initial}
      onChange={(doc) => {
        setValue(doc)
        onChange(doc)
      }}
    />
  )
}

describe('RichTextEditor', () => {
  it('reports what is typed as editor JSON', async () => {
    vi.stubGlobal('fetch', stubApi({}))
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Harness onChange={onChange} />, {
      session: meFixtures.marketing,
    })

    const box = await screen.findByRole('textbox', { name: 'Текст новости' })
    await user.click(box)
    await user.keyboard('Привет')

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Привет' }] }],
      }),
    )
  })

  it('makes the selection bold from the toolbar', async () => {
    vi.stubGlobal('fetch', stubApi({}))
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Harness onChange={onChange} />, {
      session: meFixtures.marketing,
    })

    const box = await screen.findByRole('textbox', { name: 'Текст новости' })
    await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Жирный' }))
    await user.keyboard('важно')

    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] as RichTextDoc
      expect(last.content?.[0]?.content?.[0]).toEqual({
        type: 'text',
        text: 'важно',
        marks: [{ type: 'bold' }],
      })
    })
  })

  it('refuses a link the site would not accept', async () => {
    vi.stubGlobal('fetch', stubApi({}))
    const { user } = renderWithProviders(<Harness onChange={vi.fn()} />, {
      session: meFixtures.marketing,
    })

    await user.click(await screen.findByRole('textbox', { name: 'Текст новости' }))
    await user.click(screen.getByRole('button', { name: 'Ссылка' }))
    await user.type(screen.getByLabelText('Адрес'), 'javascript:alert(1)')
    await user.click(screen.getByRole('button', { name: /^Сохранить/ }))

    expect(await screen.findByText(/Нужна ссылка вида https/)).toBeInTheDocument()
  })

  it('starts from the content it was given', async () => {
    vi.stubGlobal('fetch', stubApi({}))
    renderWithProviders(
      <Harness
        onChange={vi.fn()}
        initial={{
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Сарлавҳа' }] },
          ],
        }}
      />,
      { session: meFixtures.marketing },
    )
    const box = await screen.findByRole('textbox', { name: 'Текст новости' })
    expect(box.querySelector('h2')?.textContent).toBe('Сарлавҳа')
  })

  it('offers only the formatting the site supports', async () => {
    vi.stubGlobal('fetch', stubApi({}))
    renderWithProviders(<Harness onChange={vi.fn()} />, { session: meFixtures.marketing })
    const toolbar = await screen.findByRole('toolbar', { name: 'Оформление текста' })
    const labels = [...toolbar.querySelectorAll('button')].map((button) =>
      button.getAttribute('aria-label'),
    )
    expect(labels).toEqual([
      'Заголовок',
      'Подзаголовок',
      'Жирный',
      'Курсив',
      'Ссылка',
      'Список',
      'Нумерованный список',
      'Цитата',
      'Разделитель',
      'Фото из медиатеки',
      'Отменить',
      'Повторить',
    ])
  })
})
