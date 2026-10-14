import { screen } from '@testing-library/react'
import { meFixtures, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { StatsPage } from './stats-page'

const totals = { views: 1284, visitors: 400, avgSeconds: 65 }
const period = { from: '2026-09-15', to: '2026-10-14' }

const overview = {
  period,
  totals,
  previous: { views: 1000, visitors: 500, avgSeconds: 60 },
  daily: [
    { day: '2026-10-13', views: 10, visitors: 5 },
    { day: '2026-10-14', views: 20, visitors: 8 },
  ],
  sources: [
    { source: 'search', visits: 30 },
    { source: 'social', visits: 10 },
  ],
  referrers: [{ source: 'search', name: 'google', visits: 30 }],
  devices: [{ device: 'mobile', visitors: 300 }],
  locales: [{ locale: 'ru', views: 900 }],
  pages: [{ path: '/', views: 600, visitors: 300, avgSeconds: 40 }],
  forms: { leads: 4, applications: 7 },
}

const vacancies = {
  period,
  careerPage: { views: 50, visitors: 40, avgSeconds: null },
  totals: { views: 30, visitors: 20, avgSeconds: null },
  applications: { total: 3, otherPosition: 1 },
  vacancies: [
    {
      id: 'v1',
      title: 'Frontend dasturchi',
      slug: 'frontend-dasturchi',
      closed: false,
      views: 30,
      visitors: 20,
      applications: 2,
      conversion: 10,
    },
  ],
}

describe('StatsPage', () => {
  it('shows marketing the whole site with the change against the previous period', async () => {
    vi.stubGlobal('fetch', stubApi({ 'GET admin/stats/overview': { body: overview } }))
    renderWithProviders(<StatsPage />, { session: meFixtures.marketing })

    expect(await screen.findByText(/^1\s284$/)).toBeInTheDocument()
    expect(screen.getByText('+28% к прошлому периоду')).toBeInTheDocument()
    expect(screen.getByText('-20% к прошлому периоду')).toBeInTheDocument()
    expect(screen.getByText('1 мин 05 с')).toBeInTheDocument()
    expect(screen.getByText('Поисковики')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Вакансии' })).toBeInTheDocument()
  })

  it('shows HR the vacancies only', async () => {
    vi.stubGlobal('fetch', stubApi({ 'GET admin/stats/vacancies': { body: vacancies } }))
    renderWithProviders(<StatsPage />, { session: meFixtures.hr })

    expect(await screen.findByText('Frontend dasturchi')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Общая' })).not.toBeInTheDocument()
  })
})
