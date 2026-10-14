import { screen, within } from '@testing-library/react'
import { meFixtures, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { ApplicationPage } from './application-page'
import { ApplicationsPage } from './applications-page'

const ID = '4b1e2f3a-5c6d-4e7f-8a9b-0c1d2e3f4a5b'
const VACANCY = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

const application = {
  id: ID,
  number: 3,
  vacancy: { id: VACANCY, title: 'Frontend dasturchi' },
  name: 'Дилноза',
  phone: '+998 91 000 00 00',
  email: null,
  about: 'Три года React',
  resume: { name: 'Резюме.pdf', size: 52_000, mime: 'application/pdf' },
  source: 'site',
  sourceLabel: 'Сайт',
  locale: 'uz',
  page: '/vacancies/frontend-dasturchi/',
  status: 'new',
  comment: null,
  consentAt: '2026-10-14T06:00:00.000Z',
  createdAt: '2026-10-14T06:00:00.000Z',
  updatedAt: '2026-10-14T06:00:00.000Z',
  createdBy: null,
  updatedBy: null,
}

const counts = { new: 1, reviewing: 0, interview: 0, hired: 0, rejected: 0 }
const vacancies = {
  items: [
    {
      id: VACANCY,
      title: 'Frontend dasturchi',
      closed: false,
      isLive: true,
      applications: 1,
      newApplications: 1,
    },
  ],
}

describe('ApplicationsPage', () => {
  it('lists candidates with their vacancy, status and resume', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/applications': { body: { items: [application], total: 1, counts } },
        'GET admin/applications/vacancies': { body: vacancies },
      }),
    )
    renderWithProviders(<ApplicationsPage />, { session: meFixtures.hr })

    const row = (await screen.findByRole('link', { name: 'Дилноза' })).closest('tr') as HTMLElement
    expect(within(row).getByText('Frontend dasturchi')).toBeInTheDocument()
    expect(within(row).getByText('Новый')).toBeInTheDocument()
    expect(within(row).getByLabelText('Есть резюме')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Добавить кандидата' })).toBeInTheDocument()
  })

  it('adds a candidate from hh.uz by hand', async () => {
    const fetchMock = stubApi({
      'GET admin/applications': { body: { items: [], total: 0, counts } },
      'GET admin/applications/vacancies': { body: vacancies },
      'POST admin/applications': {
        status: 201,
        body: { ...application, source: 'hh', sourceLabel: 'hh.uz', number: 4 },
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<ApplicationsPage />, { session: meFixtures.hr })

    await user.click(await screen.findByRole('button', { name: 'Добавить кандидата' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Имя и фамилия'), 'Сардор')
    await user.type(within(dialog).getByLabelText('Телефон'), '+998 93 111 22 33')
    await user.click(within(dialog).getByRole('button', { name: 'Добавить' }))

    await vi.waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      )
      const body = (call as [unknown, RequestInit])[1].body as FormData
      expect(body.get('name')).toBe('Сардор')
      expect(body.get('source')).toBe('hh')
      expect(body.has('vacancyId')).toBe(false)
    })
  })

  it('checks the form before sending', async () => {
    const fetchMock = stubApi({
      'GET admin/applications': { body: { items: [], total: 0, counts } },
      'GET admin/applications/vacancies': { body: vacancies },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<ApplicationsPage />, { session: meFixtures.hr })
    await user.click(await screen.findByRole('button', { name: 'Добавить кандидата' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Добавить' }))
    expect(await screen.findByText('Укажите имя')).toBeInTheDocument()
    expect(screen.getByText('Укажите телефон: +998 90 123 45 67')).toBeInTheDocument()
  })
})

describe('ApplicationPage', () => {
  it('downloads the resume through the API', async () => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() }),
    )
    const json = stubApi({ [`GET admin/applications/${ID}`]: { body: application } })
    const fetchMock = vi.fn(async (input: URL | string, init?: RequestInit) => {
      if (String(input).endsWith('/resume')) {
        return new Response('%PDF', {
          headers: {
            'Content-Disposition': `attachment; filename="______.pdf"; filename*=UTF-8''${encodeURIComponent('Резюме.pdf')}`,
          },
        })
      }
      return json(input, init)
    })
    vi.stubGlobal('fetch', fetchMock)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { user } = renderWithProviders(<ApplicationPage />, {
      path: '/applications/:id',
      route: `/applications/${ID}`,
      session: meFixtures.hr,
    })

    expect(await screen.findByRole('heading', { name: /Дилноза/ })).toBeInTheDocument()
    expect(screen.getByText('Три года React')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Скачать резюме' }))
    await vi.waitFor(() => expect(click).toHaveBeenCalled())
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('Резюме.pdf')
  })
})
