import { screen, waitFor } from '@testing-library/react'
import { todayInTashkent } from '@/lib/content'
import { EMPTY_DOC } from '@/lib/rich-text'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { NewsEditorPage } from './news-editor-page'

const ID = '33333333-3333-4333-8333-333333333333'

const draft = {
  shared: { slug: 'yangi-kiosklar', date: '2026-10-01', cover: null, gallery: [] },
  locales: { uz: { title: 'Yangi kiosklar', body: EMPTY_DOC } },
}

const view = (data: unknown = draft, extra: Record<string, unknown> = {}) => ({
  id: ID,
  type: 'post',
  typeLabel: 'Новость',
  slug: 'yangi-kiosklar',
  title: 'Yangi kiosklar',
  status: 'draft',
  locales: ['uz'],
  firstPublishedAt: null,
  publishedAt: null,
  scheduledAt: null,
  updatedAt: '2026-10-13T10:00:00.000Z',
  updatedBy: { id: 'u1', name: 'Мадина Маркетова' },
  shared: {},
  data,
  revision: 1,
  isLive: false,
  publishedSlug: null,
  previewLocales: ['uz', 'ru', 'en'],
  liveUrl: null,
  ...extra,
})

const noCategories = { 'GET admin/content': { body: { items: [], total: 0 } } }

describe('NewsEditorPage', () => {
  it('creates a post: the address follows the title, empty translations stay out', async () => {
    const fetchMock = stubApi({
      ...noCategories,
      'POST admin/content': { status: 201, body: view() },
      [`GET admin/content/${ID}`]: { body: view() },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user, router } = renderWithProviders(<NewsEditorPage />, {
      path: '/news/:id',
      route: '/news/new',
      session: meFixtures.marketing,
    })

    await user.type(await screen.findByRole('textbox', { name: /^Заголовок/ }), 'Yangi kiosklar')
    expect(screen.getByLabelText('Адрес страницы')).toHaveValue('yangi-kiosklar')
    await user.click(screen.getByRole('button', { name: /^Сохранить/ }))

    await waitFor(() => expect(router?.state.location.pathname).toBe(`/news/${ID}`))
    const sent = sentBody(fetchMock, 'POST admin/content') as {
      data: { shared: { blocks: { id: string }[] }; locales: Record<string, unknown> }
    }
    expect(sent).toEqual({
      type: 'post',
      data: {
        shared: {
          slug: 'yangi-kiosklar',
          date: todayInTashkent(),
          cover: null,
          coverFull: false,
          pinned: false,
          categoryId: null,
          // A new post starts with one empty text block.
          blocks: [{ id: expect.any(String), type: 'text' }],
          ogImage: null,
        },
        // Russian and English were left empty: not sent, so the site shows Uzbek. Nor are
        // empty blocks' texts.
        locales: {
          uz: { title: 'Yangi kiosklar', tags: [], seoTitle: '', seoDescription: '' },
        },
      },
    })
  })

  it('opens a post saved before blocks as blocks, and adds, moves and removes them', async () => {
    const fetchMock = stubApi({
      ...noCategories,
      [`GET admin/content/${ID}`]: {
        body: view({
          shared: {
            slug: 'eski',
            date: '2026-10-01',
            cover: null,
            gallery: [{ mediaId: '44444444-4444-4444-8444-444444444444' }],
            videoUrl: 'https://youtu.be/abc',
          },
          locales: {
            uz: {
              title: 'Eski',
              body: {
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Matn' }] }],
              },
            },
          },
        }),
      },
      'GET admin/media': { body: { items: [], total: 0 } },
      [`PUT admin/content/${ID}`]: (body) => ({ body: view((body as { data: unknown }).data) }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<NewsEditorPage />, {
      path: '/news/:id',
      route: `/news/${ID}`,
      session: meFixtures.marketing,
    })

    // Text, gallery, video: the old fields as three blocks.
    expect(await screen.findByRole('button', { name: 'Удалить блок «Текст»' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Удалить блок «Галерея»' })).toBeInTheDocument()
    expect(screen.getByText('YouTube')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Удалить блок «Галерея»' }))
    await user.click(screen.getByRole('button', { name: 'Фото' }))
    await user.click(screen.getByRole('button', { name: 'Блок «Видео» ниже' }))
    await user.click(screen.getByRole('button', { name: /^Сохранить/ }))

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PUT')).toBe(
        true,
      ),
    )
    const { data } = sentBody(fetchMock, `PUT admin/content/${ID}`) as {
      data: { shared: Record<string, unknown>; locales: { uz: Record<string, unknown> } }
    }
    const blocks = data.shared.blocks as { id: string; type: string }[]
    expect(blocks.map((block) => block.type)).toEqual(['text', 'image', 'video'])
    expect(data.shared).not.toHaveProperty('gallery')
    expect(data.shared).not.toHaveProperty('videoUrl')
    expect(data.locales.uz).not.toHaveProperty('body')
    expect(data.locales.uz.blocks).toEqual({
      [blocks[0]?.id as string]: {
        text: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Matn' }] }],
        },
      },
    })
  })

  it('shows why a post cannot be published on the field itself', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        ...noCategories,
        [`GET admin/content/${ID}`]: { body: view() },
        [`POST admin/content/${ID}/publish`]: {
          status: 400,
          body: {
            code: 'not_publishable',
            message: 'Чтобы опубликовать: выберите обложку',
            issues: [{ path: 'shared.cover', message: 'Выберите обложку' }],
          },
        },
      }),
    )
    const { user } = renderWithProviders(<NewsEditorPage />, {
      path: '/news/:id',
      route: `/news/${ID}`,
      session: meFixtures.marketing,
    })

    await user.click(await screen.findByRole('button', { name: 'Опубликовать' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Выберите обложку')
  })

  it('asks before leaving with unsaved edits', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({ ...noCategories, [`GET admin/content/${ID}`]: { body: view() } }),
    )
    const { user, router } = renderWithProviders(<NewsEditorPage />, {
      path: '/news/:id',
      route: `/news/${ID}`,
      session: meFixtures.marketing,
    })

    const title = await screen.findByRole('textbox', { name: /^Заголовок/ })
    await waitFor(() => expect(title).toHaveValue('Yangi kiosklar'))
    await user.type(title, ' 2026')
    await user.click(screen.getByRole('link', { name: 'Назад: Новости и блог' }))

    expect(await screen.findByText('Уйти без сохранения?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(router?.state.location.pathname).toBe(`/news/${ID}`)
    expect(title).toHaveValue('Yangi kiosklar 2026')
  })

  it('offers no publishing to a role that may only write', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({ ...noCategories, [`GET admin/content/${ID}`]: { body: view() } }),
    )
    renderWithProviders(<NewsEditorPage />, {
      path: '/news/:id',
      route: `/news/${ID}`,
      session: {
        ...meFixtures.marketing,
        permissions: ['home.view', 'content.read', 'content.write', 'media.read'],
      },
    })

    expect(await screen.findByRole('button', { name: /^Сохранить/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Опубликовать' })).not.toBeInTheDocument()
  })
})
