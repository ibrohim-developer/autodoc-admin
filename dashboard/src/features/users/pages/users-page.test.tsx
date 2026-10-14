import { screen, within } from '@testing-library/react'
import type { Me } from '@/lib/session'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { UsersPage } from './users-page'

const users = [
  {
    id: meFixtures.marketing.id,
    email: 'marketing@autodoc.uz',
    name: 'Мадина Маркетова',
    role: 'marketing',
    roleLabel: 'Маркетинг',
    status: 'active',
    totpEnabled: true,
    lastLoginAt: '2026-10-13T06:47:43.985Z',
    createdAt: '2026-10-01T06:47:30.474Z',
  },
  {
    id: '11111111-2222-4333-8444-555555555555',
    email: 'boss@autodoc.uz',
    name: 'Босс Админов',
    role: 'admin',
    roleLabel: 'Администратор',
    status: 'active',
    totpEnabled: false,
    lastLoginAt: null,
    createdAt: '2026-10-01T06:47:30.474Z',
  },
  {
    id: '22222222-3333-4444-8555-666666666666',
    email: 'hr@autodoc.uz',
    name: 'Нигора Кадрова',
    role: 'hr',
    roleLabel: 'HR',
    status: 'invited',
    totpEnabled: false,
    lastLoginAt: null,
    createdAt: '2026-10-12T06:47:30.474Z',
  },
]

function render(me: Me) {
  return renderWithProviders(<UsersPage />, { session: me })
}

describe('UsersPage', () => {
  it('lists users with role, status and 2FA', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/users': {
          body: { items: users, assignableRoles: meFixtures.marketing.assignableRoles },
        },
      }),
    )
    render(meFixtures.marketing)

    const row = (await screen.findByText('Нигора Кадрова')).closest('tr') as HTMLElement
    expect(within(row).getByText('Приглашён')).toBeInTheDocument()
    expect(within(row).getByText('ещё не входил')).toBeInTheDocument()
    expect(screen.getByText('это вы')).toBeInTheDocument()
  })

  it("doesn't offer marketing actions on an administrator or on themselves", async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/users': {
          body: { items: users, assignableRoles: meFixtures.marketing.assignableRoles },
        },
      }),
    )
    render(meFixtures.marketing)
    await screen.findByText('Босс Админов')

    expect(screen.queryByRole('button', { name: 'Действия: Босс Админов' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Действия: Мадина Маркетова' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Действия: Нигора Кадрова' })).toBeInTheDocument()
  })

  it('invites a user and shows the one-time link to pass on', async () => {
    const fetchMock = stubApi({
      'GET admin/users': {
        body: { items: users, assignableRoles: meFixtures.marketing.assignableRoles },
      },
      'POST admin/users': (body) => ({
        status: 201,
        body: {
          user: {
            ...users[2],
            ...(body as object),
            id: '33333333-4444-4555-8666-777777777777',
            status: 'invited',
          },
          link: 'http://localhost:5173/set-password#token-abc',
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = render(meFixtures.marketing)

    await user.click(await screen.findByRole('button', { name: 'Пригласить' }))
    await user.type(screen.getByLabelText('Имя и фамилия'), 'Новый Сотрудник')
    await user.type(screen.getByLabelText('Email'), 'new@autodoc.uz')
    await user.click(screen.getByRole('button', { name: 'Создать приглашение' }))

    expect(await screen.findByText('Приглашение готово')).toBeInTheDocument()
    expect(screen.getByLabelText('Ссылка-приглашение')).toHaveValue(
      'http://localhost:5173/set-password#token-abc',
    )
    expect(sentBody(fetchMock, 'POST admin/users')).toEqual({
      name: 'Новый Сотрудник',
      email: 'new@autodoc.uz',
      role: 'hr',
    })
  })

  it('hides the invite button from someone who can only view', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({ 'GET admin/users': { body: { items: users, assignableRoles: [] } } }),
    )
    render({ ...meFixtures.marketing, permissions: ['home.view', 'users.read'] })
    await screen.findByText('Нигора Кадрова')
    expect(screen.queryByRole('button', { name: 'Пригласить' })).not.toBeInTheDocument()
  })
})
