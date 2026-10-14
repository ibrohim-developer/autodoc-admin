import { screen, waitFor } from '@testing-library/react'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { SettingsPage } from './settings-page'

describe('SettingsPage', () => {
  it('starts from what the site shows and saves the menu’s order and visibility', async () => {
    const fetchMock = stubApi({
      'GET admin/content/singleton/site_settings': { body: null },
      'POST admin/content': { status: 400, body: { code: 'stop', message: 'Тест' } },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<SettingsPage />, {
      path: '/settings',
      route: '/settings',
      session: meFixtures.marketing,
    })

    expect(await screen.findByRole('textbox', { name: /Телефон/ })).toHaveValue('+998 55 505 75 75')
    await user.click(screen.getByRole('button', { name: '«Контакты» выше' }))
    await user.click(screen.getByRole('switch', { name: 'Показывать «Руководство»' }))
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => {
      const body = sentBody(fetchMock, 'POST admin/content') as {
        data: { shared: { menu: { key: string; visible: boolean }[]; map: unknown } }
      }
      expect(body.data.shared.menu.map((item) => item.key)).toEqual([
        'home',
        'media',
        'history',
        'leadership',
        'projects',
        'career',
        'contacts',
        'partners',
      ])
      expect(body.data.shared.menu.find((item) => item.key === 'leadership')?.visible).toBe(false)
      expect(body.data.shared.map).toEqual({ lat: 41.3203, lon: 69.2673 })
    })
  })
})
