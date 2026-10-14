import { screen } from '@testing-library/react'
import { meFixtures, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { HomePage } from './home-page'

const week = {
  scope: 'vacancies',
  totals: { views: 12, visitors: 9, avgSeconds: null },
  previous: { views: 6, visitors: 9, avgSeconds: null },
  daily: [{ day: '2026-10-14', views: 12, visitors: 9 }],
}

describe('HomePage', () => {
  it("shows HR new applications, the vacancies' week and vacancy drafts", async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/home': {
          body: {
            leads: null,
            applications: {
              new: 2,
              latest: [
                {
                  id: 'a1',
                  number: 1,
                  name: 'Дилноза',
                  vacancyTitle: null,
                  status: 'new',
                  createdAt: '2026-10-14T06:00:00.000Z',
                },
              ],
            },
            views: week,
            drafts: {
              total: 1,
              items: [
                {
                  id: 'd1',
                  type: 'vacancy',
                  typeLabel: 'Вакансия',
                  title: 'Dizayner',
                  status: 'draft',
                  updatedAt: '2026-10-14T06:00:00.000Z',
                },
              ],
            },
          },
        },
      }),
    )
    renderWithProviders(<HomePage />, { session: meFixtures.hr })

    expect(await screen.findByRole('link', { name: /Дилноза/ })).toHaveAttribute(
      'href',
      '/applications/a1',
    )
    expect(screen.getByText('Другая позиция')).toBeInTheDocument()
    expect(screen.getByText('Вакансии за неделю')).toBeInTheDocument()
    expect(screen.getByText('+100% к прошлому периоду')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Dizayner/ })).toHaveAttribute('href', '/vacancies/d1')
    expect(screen.queryByText('Новые заявки')).not.toBeInTheDocument()
  })
})
