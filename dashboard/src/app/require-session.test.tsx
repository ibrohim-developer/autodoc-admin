import { screen } from '@testing-library/react'
import { meFixtures } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { RequirePermission } from './require-session'

describe('RequirePermission', () => {
  it('renders the screen for a role that has the permission', () => {
    renderWithProviders(
      <RequirePermission permission="users.read">
        <p>Список пользователей</p>
      </RequirePermission>,
      { session: meFixtures.marketing },
    )
    expect(screen.getByText('Список пользователей')).toBeInTheDocument()
  })

  it('says "no access" instead of rendering it for a role without', async () => {
    renderWithProviders(
      <RequirePermission permission="users.read">
        <p>Список пользователей</p>
      </RequirePermission>,
      { session: meFixtures.hr },
    )
    expect(await screen.findByText('Нет доступа')).toBeInTheDocument()
    expect(screen.queryByText('Список пользователей')).not.toBeInTheDocument()
  })
})
