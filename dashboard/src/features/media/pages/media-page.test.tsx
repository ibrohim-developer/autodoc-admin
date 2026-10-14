import { screen } from '@testing-library/react'
import { meFixtures, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { MediaPage } from './media-page'

const photo = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  originalName: `${id.slice(0, 4)}.jpg`,
  mime: 'image/jpeg',
  size: 120_000,
  width: 1600,
  height: 1200,
  alt: {},
  url: `/media/2026/10/${id}-1280.webp`,
  thumbUrl: `/media/2026/10/${id}-320.webp`,
  variants: [],
  createdAt: '2026-10-13T08:00:00.000Z',
  usageCount: 0,
  ...extra,
})

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('MediaPage', () => {
  it('lists photos and marks the ones in use or without a description', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/media': {
          body: {
            items: [photo(A, { usageCount: 2, alt: { uz: 'Ofis' } }), photo(B)],
            total: 2,
          },
        },
      }),
    )
    renderWithProviders(<MediaPage />, { session: meFixtures.marketing })

    expect(await screen.findByText('1111.jpg')).toBeInTheDocument()
    expect(screen.getByText('используется')).toBeInTheDocument()
    expect(screen.getAllByText('без описания')).toHaveLength(1)
  })

  it('uploads the chosen files one by one', async () => {
    const fetchMock = stubApi({
      'GET admin/media': { body: { items: [], total: 0 } },
      'POST admin/media': { status: 201, body: { ...photo(A), duplicate: false } },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user, container } = renderWithProviders(<MediaPage />, {
      session: meFixtures.marketing,
    })

    expect(await screen.findByText('Пока ни одного фото')).toBeInTheDocument()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, [
      new File(['a'], 'one.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'two.jpg', { type: 'image/jpeg' }),
    ])

    await vi.waitFor(() => {
      const posts = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      )
      expect(posts).toHaveLength(2)
      const first = posts[0]?.[1] as RequestInit | undefined
      expect(first?.body).toBeInstanceOf(FormData)
    })
  })

  it('offers no upload to someone who may only look', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({ 'GET admin/media': { body: { items: [photo(A)], total: 1 } } }),
    )
    renderWithProviders(<MediaPage />, {
      session: { ...meFixtures.marketing, permissions: ['home.view', 'media.read'] },
    })
    await screen.findByText('1111.jpg')
    expect(screen.queryByRole('button', { name: /Загрузить фото/ })).not.toBeInTheDocument()
  })
})
