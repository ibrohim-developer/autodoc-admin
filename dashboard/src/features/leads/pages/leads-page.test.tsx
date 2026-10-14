import { screen, within } from '@testing-library/react'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { LeadPage } from './lead-page'
import { LeadsPage } from './leads-page'

const LEAD = '0d5f7a52-3c44-4f0e-9d7b-6a1e2b3c4d5e'

const lead = {
  id: LEAD,
  number: 12,
  form: 'feedback',
  formLabel: 'Обратная связь',
  name: 'Алишер Каримов',
  phone: '+998 90 123 45 67',
  topic: 'Сотрудничество',
  message: 'Хотим обсудить проект',
  locale: 'ru',
  page: '/ru/contacts/',
  status: 'new',
  comment: null,
  consentAt: '2026-10-14T06:00:00.000Z',
  createdAt: '2026-10-14T06:00:00.000Z',
  updatedAt: '2026-10-14T06:00:00.000Z',
  updatedBy: null,
}

const counts = { new: 1, in_progress: 2, done: 3, spam: 0 }

const listUrl = (fetchMock: ReturnType<typeof stubApi>, nth: number) =>
  new URL(
    String(fetchMock.mock.calls.filter(([input]) => String(input).includes('/leads?'))[nth]?.[0]),
  )

describe('LeadsPage', () => {
  it('lists submissions with counts per status and filters by them', async () => {
    const fetchMock = stubApi({ 'GET admin/leads': { body: { items: [lead], total: 1, counts } } })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<LeadsPage />, { session: meFixtures.marketing })

    const row = (await screen.findByRole('link', { name: 'Алишер Каримов' })).closest(
      'tr',
    ) as HTMLElement
    expect(within(row).getByText('Сотрудничество')).toBeInTheDocument()
    expect(within(row).getByText('Новая')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Все\s*6/ })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: /В работе\s*2/ }))
    await vi.waitFor(() =>
      expect(listUrl(fetchMock, 1).searchParams.get('status')).toBe('in_progress'),
    )
  })

  it('exports the filtered list to Excel', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const json = stubApi({ 'GET admin/leads': { body: { items: [lead], total: 1, counts } } })
    const fetchMock = vi.fn(async (input: URL | string, init?: RequestInit) => {
      if (String(input).includes('/leads/export')) {
        return new Response('PK', {
          headers: { 'Content-Disposition': 'attachment; filename="zayavki-2026-10-14.xlsx"' },
        })
      }
      return json(input, init)
    })
    vi.stubGlobal('fetch', fetchMock)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { user } = renderWithProviders(<LeadsPage />, { session: meFixtures.marketing })

    await user.click(await screen.findByRole('button', { name: 'Выгрузить в Excel' }))
    await vi.waitFor(() => expect(click).toHaveBeenCalled())
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('zayavki-2026-10-14.xlsx')
  })

  it('says when there is nothing yet', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/leads': {
          body: { items: [], total: 0, counts: { new: 0, in_progress: 0, done: 0, spam: 0 } },
        },
      }),
    )
    renderWithProviders(<LeadsPage />, { session: meFixtures.marketing })
    expect(await screen.findByText('Заявок пока нет')).toBeInTheDocument()
  })
})

describe('LeadPage', () => {
  it('shows the submission and saves a comment', async () => {
    const fetchMock = stubApi({
      [`GET admin/leads/${LEAD}`]: { body: lead },
      [`PATCH admin/leads/${LEAD}`]: (body) => ({ body: { ...lead, ...(body as object) } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<LeadPage />, {
      path: '/leads/:id',
      route: `/leads/${LEAD}`,
      session: meFixtures.marketing,
    })

    expect(await screen.findByRole('heading', { name: /Заявка №12/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+998 90 123 45 67' })).toHaveAttribute(
      'href',
      'tel:+998901234567',
    )
    await user.type(screen.getByRole('textbox', { name: 'Комментарий' }), 'Перезвонить')
    await user.click(screen.getByRole('button', { name: 'Сохранить комментарий' }))
    await vi.waitFor(() =>
      expect(sentBody(fetchMock, `PATCH admin/leads/${LEAD}`)).toEqual({ comment: 'Перезвонить' }),
    )
  })

  it('moves the submission to the trash after asking', async () => {
    const fetchMock = stubApi({
      [`GET admin/leads/${LEAD}`]: { body: lead },
      [`DELETE admin/leads/${LEAD}`]: { status: 204, body: null },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<LeadPage />, {
      path: '/leads/:id',
      route: `/leads/${LEAD}`,
      session: meFixtures.marketing,
    })

    await user.click(await screen.findByRole('button', { name: 'Удалить' }))
    expect(
      screen.getByText('Она пролежит в корзине 30 дней, потом удалится навсегда.'),
    ).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/leads')
  })
})
