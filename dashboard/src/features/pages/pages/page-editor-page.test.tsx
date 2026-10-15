import { screen, waitFor } from '@testing-library/react'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { PageEditorPage } from './page-editor-page'

describe('PageEditorPage', () => {
  it('saves the blocks switched off as hidden, and only the photos chosen', async () => {
    const fetchMock = stubApi({
      'GET admin/content/singleton/page_contacts': { body: null },
      'POST admin/content': { status: 400, body: { code: 'stop', message: 'Тест' } },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<PageEditorPage />, {
      path: '/pages/:key',
      route: '/pages/contacts',
      session: meFixtures.marketing,
    })

    await user.click(await screen.findByRole('switch', { name: 'Форма обратной связи' }))
    await user.type(screen.getByRole('textbox', { name: 'SEO-заголовок' }), 'Kontaktlar — Autodoc')
    await user.click(screen.getByRole('button', { name: /^Сохранить/ }))

    await waitFor(() =>
      expect(sentBody(fetchMock, 'POST admin/content')).toEqual({
        type: 'page_contacts',
        data: {
          shared: { hidden: ['feedback'], photos: {}, ogImage: null },
          locales: { uz: { seoTitle: 'Kontaktlar — Autodoc', seoDescription: '' } },
        },
      }),
    )
  })

  it('sends an unknown page back to the list', async () => {
    vi.stubGlobal('fetch', stubApi({}))
    const { router } = renderWithProviders(<PageEditorPage />, {
      path: '/pages/:key',
      route: '/pages/nope',
      session: meFixtures.marketing,
    })
    await waitFor(() => expect(router?.state.location.pathname).toBe('/pages'))
  })
})
