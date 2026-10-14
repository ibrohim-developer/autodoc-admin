import { screen, waitFor } from '@testing-library/react'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { SiteTextsPage } from './site-texts-page'

const messages = (title: string) => ({
  Metadata: { title: 'Autodoc' },
  Hero: { title },
  Blog: { metaTitle: 'Blog', shareOn: '{network} orqali ulashish' },
})
const defaults = {
  uz: messages('Raqamli yechimlar'),
  ru: messages('Цифровые решения'),
  en: messages('Digital solutions'),
}

const view = (overrides: unknown) => ({
  id: '66666666-6666-4666-8666-666666666666',
  type: 'site_texts',
  typeLabel: 'Тексты сайта',
  slug: null,
  title: 'Тексты сайта',
  status: 'draft',
  locales: ['uz'],
  firstPublishedAt: null,
  publishedAt: null,
  scheduledAt: null,
  updatedAt: '2026-10-14T10:00:00.000Z',
  updatedBy: null,
  shared: {},
  data: { shared: { overrides }, locales: { uz: {} } },
  revision: 1,
  isLive: false,
  publishedSlug: null,
  previewLocales: ['uz', 'ru', 'en'],
  liveUrl: null,
})

function render(fetchMock: ReturnType<typeof stubApi>) {
  vi.stubGlobal('fetch', fetchMock)
  return renderWithProviders(<SiteTextsPage />, {
    path: '/texts',
    route: '/texts',
    session: meFixtures.marketing,
  })
}

describe('SiteTextsPage', () => {
  it('saves only the texts that differ from the code, per language', async () => {
    const fetchMock = stubApi({
      'GET admin/site-texts/defaults': { body: defaults },
      'GET admin/content/singleton/site_texts': { body: null },
      'POST admin/content': {
        status: 201,
        body: view({ uz: { 'Hero.title': 'Yangi' }, ru: {}, en: {} }),
      },
    })
    const { user } = render(fetchMock)

    // SEO texts are edited under "Страницы", not here.
    expect(await screen.findByText('Hero.title')).toBeInTheDocument()
    expect(screen.queryByText('Blog.metaTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('Metadata.title')).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Hero.title' }), 'Yangi')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(sentBody(fetchMock, 'POST admin/content')).toEqual({
        type: 'site_texts',
        data: {
          shared: { overrides: { uz: { 'Hero.title': 'Yangi' }, ru: {}, en: {} } },
          locales: { uz: {} },
        },
      }),
    )
  })

  it('stops a change that drops a {placeholder} the site fills in', async () => {
    const fetchMock = stubApi({
      'GET admin/site-texts/defaults': { body: defaults },
      'GET admin/content/singleton/site_texts': { body: null },
    })
    const { user } = render(fetchMock)

    await user.type(await screen.findByRole('textbox', { name: 'Blog.shareOn' }), 'Ulashish')
    expect(screen.getByText(/Оставьте \{network\}/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Оставьте в тексте {network}')
    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST'),
    ).toBe(false)
  })

  it('loads earlier changes and brings a text back to the code', async () => {
    const fetchMock = stubApi({
      'GET admin/site-texts/defaults': { body: defaults },
      'GET admin/content/singleton/site_texts': {
        body: view({ uz: { 'Hero.title': 'Oldingi' }, ru: {}, en: {} }),
      },
      'GET admin/content/66666666-6666-4666-8666-666666666666': {
        body: view({ uz: { 'Hero.title': 'Oldingi' }, ru: {}, en: {} }),
      },
    })
    const { user } = render(fetchMock)

    // Fields mount again once the saved document loads: look the field up afresh.
    const field = () => screen.getByRole('textbox', { name: 'Hero.title' })
    await waitFor(() => expect(field()).toHaveValue('Oldingi'))
    await user.click(screen.getByRole('button', { name: 'Вернуть текст из кода' }))
    expect(field()).toHaveValue('')
    expect(screen.getByText('Есть несохранённые правки')).toBeInTheDocument()
  })
})
