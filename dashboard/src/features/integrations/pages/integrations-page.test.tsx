import { screen } from '@testing-library/react'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { IntegrationsPage } from './integrations-page'

const hhEmpty = {
  enabled: false,
  employerId: null,
  directionId: null,
  autoPublish: false,
  hasToken: false,
  updatedAt: null,
  lastRun: null,
}

/** Both cards load; each test stubs what it is about on top. */
const base = {
  'GET admin/integrations/hh': { body: hhEmpty },
  'GET admin/content': { body: { items: [{ id: 'dir-1', title: 'Dasturlash' }], total: 1 } },
}

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
      ...base,
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
    await user.click(screen.getAllByRole('button', { name: 'Сохранить' })[0] as HTMLElement)

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

  it('shows the last hh.uz sync and runs one on demand', async () => {
    const run = {
      at: '2026-10-14T06:00:00.000Z',
      ok: true,
      error: null,
      created: 2,
      updated: 1,
      closed: 0,
      reopened: 0,
      protected: 1,
      failed: 0,
    }
    const fetchMock = stubApi({
      ...base,
      'GET admin/integrations/telegram': { body: empty },
      'GET admin/integrations/hh': {
        body: {
          ...hhEmpty,
          enabled: true,
          employerId: '123',
          directionId: 'dir-1',
          hasToken: true,
          lastRun: run,
        },
      },
      'POST admin/integrations/hh/sync': { body: run },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<IntegrationsPage />, { session: meFixtures.admin })

    expect(
      await screen.findByText(/новых 2, обновлено 1, закрыто 0, правленых вручную 1/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Синхронизировать сейчас' }))
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).endsWith('/integrations/hh/sync')),
      ).toBe(true),
    )
  })
})
