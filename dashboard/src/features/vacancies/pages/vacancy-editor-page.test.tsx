import { screen, waitFor } from '@testing-library/react'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { VacancyEditorPage } from './vacancy-editor-page'

const ID = '44444444-4444-4444-8444-444444444444'
const DIRECTION = '55555555-5555-4555-8555-555555555555'

const directions = {
  'GET admin/content': {
    body: {
      items: [
        {
          id: DIRECTION,
          type: 'vacancy_direction',
          typeLabel: 'Направление вакансий',
          slug: 'dasturlash',
          title: 'Dasturlash',
          status: 'published',
          locales: ['uz'],
          firstPublishedAt: null,
          publishedAt: null,
          scheduledAt: null,
          updatedAt: '2026-10-13T10:00:00.000Z',
          updatedBy: null,
          shared: { order: 1 },
        },
      ],
      total: 1,
    },
  },
}

describe('VacancyEditorPage', () => {
  it('takes up to four requirements and leaves empty lines out', async () => {
    const fetchMock = stubApi({
      ...directions,
      'POST admin/content': {
        status: 400,
        body: {
          code: 'invalid_document',
          message: 'Проверьте заполнение полей',
          issues: [{ path: 'shared.directionId', message: 'Выберите направление' }],
        },
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<VacancyEditorPage />, {
      path: '/vacancies/:id',
      route: '/vacancies/new',
      session: meFixtures.hr,
    })

    await user.type(await screen.findByRole('textbox', { name: 'Название' }), 'Frontend dasturchi')
    const add = screen.getByRole('button', { name: 'Добавить требование' })
    for (let i = 0; i < 4; i++) await user.click(add)
    expect(screen.queryByRole('button', { name: 'Добавить требование' })).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Требования: 1' }), 'React')
    await user.type(screen.getByRole('textbox', { name: 'Требования: 3' }), 'TypeScript')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(sentBody(fetchMock, 'POST admin/content')).toMatchObject({
        type: 'vacancy',
        data: {
          shared: { employment: 'fullTime', closed: false },
          locales: { uz: { title: 'Frontend dasturchi', requirements: ['React', 'TypeScript'] } },
        },
      }),
    )
    // No direction chosen: the API's answer lands on that field.
    expect(await screen.findByText('Выберите направление')).toBeInTheDocument()
  })

  it('opens an existing vacancy for HR with publishing', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        ...directions,
        [`GET admin/content/${ID}`]: {
          body: {
            ...directions['GET admin/content'].body.items[0],
            id: ID,
            type: 'vacancy',
            typeLabel: 'Вакансия',
            slug: 'frontend-dasturchi',
            title: 'Frontend dasturchi',
            status: 'draft',
            shared: {},
            data: {
              shared: { directionId: DIRECTION, employment: 'partTime' },
              locales: {
                uz: { title: 'Frontend dasturchi', city: 'Toshkent', description: 'Interfeyslar' },
              },
            },
            revision: 3,
            isLive: false,
            publishedSlug: null,
            previewLocales: ['uz', 'ru', 'en'],
            liveUrl: null,
          },
        },
      }),
    )
    renderWithProviders(<VacancyEditorPage />, {
      path: '/vacancies/:id',
      route: `/vacancies/${ID}`,
      session: meFixtures.hr,
    })

    expect(await screen.findByRole('textbox', { name: 'Название' })).toHaveValue(
      'Frontend dasturchi',
    )
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Занятость/ })).toHaveTextContent(
      'Частичная занятость',
    )
  })
})
