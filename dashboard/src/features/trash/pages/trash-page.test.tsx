import { screen, within } from '@testing-library/react'
import { meFixtures, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { TrashPage } from './trash-page'

const DOC = '33333333-3333-4333-8333-333333333333'
const PHOTO = '44444444-4444-4444-8444-444444444444'

const items = [
  {
    kind: 'document',
    id: DOC,
    type: 'post',
    typeLabel: 'Новость',
    title: 'Инфокиоски',
    thumbUrl: null,
    deletedAt: '2026-10-12T08:00:00.000Z',
    deletedBy: { id: meFixtures.marketing.id, name: 'Мадина Маркетова' },
    purgeAt: new Date(Date.now() + 29.5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    kind: 'media',
    id: PHOTO,
    type: 'media',
    typeLabel: 'Фото',
    title: 'office.jpg',
    thumbUrl: '/media/2026/10/x-320.webp',
    deletedAt: '2026-10-11T08:00:00.000Z',
    deletedBy: null,
    purgeAt: new Date(Date.now() + 1.5 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

describe('TrashPage', () => {
  it('lists deleted items with when they go for good', async () => {
    vi.stubGlobal('fetch', stubApi({ 'GET admin/trash': { body: { items } } }))
    renderWithProviders(<TrashPage />, { session: meFixtures.marketing })

    const row = (await screen.findByText('Инфокиоски')).closest('tr') as HTMLElement
    expect(within(row).getByText('Новость')).toBeInTheDocument()
    expect(within(row).getByText('через 30 дней')).toBeInTheDocument()
    const photoRow = screen.getByText('office.jpg').closest('tr') as HTMLElement
    expect(within(photoRow).getByText('через 2 дня')).toBeInTheDocument()
  })

  it('restores an item', async () => {
    const fetchMock = stubApi({
      'GET admin/trash': { body: { items } },
      [`POST admin/trash/document/${DOC}/restore`]: { status: 204, body: null },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<TrashPage />, { session: meFixtures.marketing })

    const row = (await screen.findByText('Инфокиоски')).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Восстановить' }))
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).endsWith(`/document/${DOC}/restore`)),
      ).toBe(true),
    )
  })

  it('asks before deleting for good', async () => {
    const fetchMock = stubApi({
      'GET admin/trash': { body: { items } },
      [`DELETE admin/trash/media/${PHOTO}`]: { status: 204, body: null },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<TrashPage />, { session: meFixtures.marketing })

    await user.click(await screen.findByRole('button', { name: 'Удалить навсегда: office.jpg' }))
    expect(screen.getByText('Восстановить будет нельзя.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Удалить навсегда' }))
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).endsWith(`/media/${PHOTO}`) && (init as RequestInit).method === 'DELETE',
        ),
      ).toBe(true),
    )
  })

  it('says when the trash is empty', async () => {
    vi.stubGlobal('fetch', stubApi({ 'GET admin/trash': { body: { items: [] } } }))
    renderWithProviders(<TrashPage />, { session: meFixtures.hr })
    expect(await screen.findByText('Корзина пуста')).toBeInTheDocument()
  })
})
