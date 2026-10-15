import { screen, within } from '@testing-library/react'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { NewsListPage } from './news-list-page'

const LIVE = '11111111-1111-4111-8111-111111111111'
const DRAFT = '22222222-2222-4222-8222-222222222222'
const TRASHED = '33333333-3333-4333-8333-333333333333'
const CATEGORY = '44444444-4444-4444-8444-444444444444'

function summary(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'post',
    typeLabel: 'Новость',
    slug: null,
    title,
    status: 'draft',
    locales: ['uz'],
    firstPublishedAt: null,
    publishedAt: null,
    scheduledAt: null,
    updatedAt: '2026-10-12T08:00:00.000Z',
    updatedBy: null,
    shared: { date: '2026-10-12' },
    ...extra,
  }
}

const posts = [
  summary(LIVE, 'Samarqandda yangi servis', {
    status: 'published',
    locales: ['uz', 'ru'],
    shared: { date: '2026-10-12', pinned: true, categoryId: CATEGORY },
  }),
  summary(DRAFT, 'Qoralama'),
]
const counts = { draft: 1, published: 1, changed: 0, scheduled: 0, live: 1 }

/** Posts and categories share one endpoint: told apart by `type`. */
function stub(extra: Parameters<typeof stubApi>[0] = {}) {
  const api = stubApi({
    'GET admin/stats/views': { body: { views: { [LIVE]: 1240 } } },
    'GET admin/trash': {
      body: {
        items: [
          {
            kind: 'document',
            id: TRASHED,
            type: 'post',
            typeLabel: 'Новость',
            title: 'Eski xabar',
            thumbUrl: null,
            deletedAt: '2026-10-10T08:00:00.000Z',
            deletedBy: null,
            purgeAt: '2026-11-09T08:00:00.000Z',
          },
          {
            kind: 'document',
            id: CATEGORY,
            type: 'vacancy',
            typeLabel: 'Вакансия',
            title: 'Не новость',
            thumbUrl: null,
            deletedAt: '2026-10-10T08:00:00.000Z',
            deletedBy: null,
            purgeAt: '2026-11-09T08:00:00.000Z',
          },
        ],
      },
    },
    ...extra,
  })
  return vi.fn(async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/admin/content' && (init?.method ?? 'GET') === 'GET') {
      const body =
        url.searchParams.get('type') === 'post_category'
          ? { items: [summary(CATEGORY, 'Tadbirlar', { type: 'post_category' })], total: 1 }
          : { items: posts, total: posts.length, counts }
      return new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return api(input, init)
  })
}

const listCalls = (fetchMock: ReturnType<typeof stub>) =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter(
      (url) => url.pathname === '/api/admin/content' && url.searchParams.get('type') === 'post',
    )

describe('NewsListPage', () => {
  it('shows each post with its state, languages, views and pin, and counts per tab', async () => {
    vi.stubGlobal('fetch', stub())
    renderWithProviders(<NewsListPage />, { session: meFixtures.marketing })

    const link = await screen.findByRole('link', { name: 'Samarqandda yangi servis' })
    const row = link.closest('.grid') as HTMLElement
    expect(within(row).getByText('Закреплено')).toBeInTheDocument()
    expect(within(row).getByText('Опубликовано')).toBeInTheDocument()
    expect(await within(row).findByText('Tadbirlar')).toBeInTheDocument()
    expect(await within(row).findByText('1 240')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: /Открепить/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    expect(screen.getByRole('tab', { name: /^Все\s*2$/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /^Опубликовано\s*1$/ })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: /^Корзина\s*1$/ })).toBeInTheDocument()
  })

  it('filters by tab and category', async () => {
    const fetchMock = stub()
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<NewsListPage />, { session: meFixtures.marketing })
    await screen.findByText('Qoralama')

    await user.click(screen.getByRole('tab', { name: /Опубликовано/ }))
    await vi.waitFor(() =>
      expect(listCalls(fetchMock).at(-1)?.searchParams.get('status')).toBe('live'),
    )

    await user.click(screen.getByRole('combobox', { name: 'Категория' }))
    await user.click(await screen.findByRole('option', { name: 'Tadbirlar' }))
    await vi.waitFor(() =>
      expect(listCalls(fetchMock).at(-1)?.searchParams.get('ref')).toBe(`categoryId:${CATEGORY}`),
    )
  })

  it('pins a post in one click', async () => {
    const fetchMock = stub({
      [`PUT admin/content/${DRAFT}/flags/pinned`]: {
        body: {
          ...summary(DRAFT, 'Qoralama'),
          shared: { date: '2026-10-12', pinned: true },
          data: {
            shared: { date: '2026-10-12', pinned: true },
            locales: { uz: { title: 'Qoralama' } },
          },
          revision: 3,
          isLive: false,
          publishedSlug: null,
          previewLocales: ['uz'],
          liveUrl: null,
        },
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<NewsListPage />, { session: meFixtures.marketing })

    await user.click(await screen.findByRole('button', { name: 'Закрепить «Qoralama» вверху' }))
    await vi.waitFor(() =>
      expect(sentBody(fetchMock, `PUT admin/content/${DRAFT}/flags/pinned`)).toEqual({
        value: true,
      }),
    )
  })

  it('moves a post to the trash and lists the trashed posts in their tab', async () => {
    const fetchMock = stub({ [`DELETE admin/content/${DRAFT}`]: { status: 204, body: null } })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<NewsListPage />, { session: meFixtures.marketing })

    await user.click(await screen.findByRole('button', { name: 'В корзину «Qoralama»' }))
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).endsWith(`/admin/content/${DRAFT}`) &&
            (init as RequestInit).method === 'DELETE',
        ),
      ).toBe(true),
    )

    await user.click(screen.getByRole('tab', { name: /Корзина/ }))
    expect(await screen.findByText('Eski xabar')).toBeInTheDocument()
    expect(screen.queryByText('Не новость')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Восстановить «Eski xabar»' })).toBeInTheDocument()
  })
})
