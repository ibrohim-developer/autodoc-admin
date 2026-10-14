import { screen } from '@testing-library/react'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { IntegrationsPage } from './integrations-page'

const empty = {
  enabled: false,
  hasToken: false,
  leadsChatId: null,
  applicationsChatId: null,
  updatedAt: null,
}

describe('IntegrationsPage', () => {
  it('saves the bot token and chats, and never shows the token again', async () => {
    const fetchMock = stubApi({
      'GET admin/integrations/telegram': { body: empty },
      'PUT admin/integrations/telegram': {
        body: {
          enabled: true,
          hasToken: true,
          leadsChatId: '-1001',
          applicationsChatId: null,
          updatedAt: '2026-10-14T06:00:00.000Z',
        },
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<IntegrationsPage />, { session: meFixtures.admin })

    await user.click(await screen.findByRole('switch', { name: 'Отправлять уведомления' }))
    await user.type(screen.getByLabelText('Токен бота'), '123456789:AAE-token')
    await user.type(screen.getByLabelText('Чат маркетинга (заявки)'), '-1001')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    await vi.waitFor(() =>
      expect(sentBody(fetchMock, 'PUT admin/integrations/telegram')).toEqual({
        enabled: true,
        token: '123456789:AAE-token',
        leadsChatId: '-1001',
        applicationsChatId: null,
      }),
    )
    expect(await screen.findByLabelText('Токен бота')).toHaveValue('')
    expect(screen.getByLabelText('Токен бота')).toHaveAttribute(
      'placeholder',
      'Сохранён. Введите новый, чтобы заменить',
    )
  })

  it("reports Telegram's answer for each chat", async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/integrations/telegram': {
          body: {
            ...empty,
            enabled: true,
            hasToken: true,
            leadsChatId: '-1',
            applicationsChatId: '-2',
          },
        },
        'POST admin/integrations/telegram/test': {
          body: { leads: { ok: true }, applications: { ok: false, error: 'chat not found' } },
        },
      }),
    )
    const { user } = renderWithProviders(<IntegrationsPage />, { session: meFixtures.admin })
    await user.click(await screen.findByRole('button', { name: 'Проверить' }))
    expect(await screen.findByText('Чат маркетинга: сообщение отправлено')).toBeInTheDocument()
    expect(screen.getByText('Чат HR: ошибка — chat not found')).toBeInTheDocument()
  })
})
