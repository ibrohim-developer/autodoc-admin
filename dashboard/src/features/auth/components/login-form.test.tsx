import { screen } from '@testing-library/react'
import { meFixtures, sentBody, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { LoginForm } from './login-form'

describe('LoginForm', () => {
  it('logs in with email and password', async () => {
    const fetchMock = stubApi({
      'POST admin/auth/login': { body: { status: 'ok', user: meFixtures.hr } },
    })
    vi.stubGlobal('fetch', fetchMock)
    const onSuccess = vi.fn()
    const { user } = renderWithProviders(<LoginForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Email'), 'hr@autodoc.uz')
    await user.type(screen.getByLabelText('Пароль'), 'Correct-Horse-42')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
    const body = sentBody(fetchMock, 'POST admin/auth/login')
    expect(body).toEqual({ email: 'hr@autodoc.uz', password: 'Correct-Horse-42' })
  })

  it('asks for the 2FA code and resends it with the password', async () => {
    const fetchMock = stubApi({
      'POST admin/auth/login': (body) =>
        (body as { code?: string }).code
          ? { body: { status: 'ok', user: meFixtures.marketing } }
          : { body: { status: 'two_factor_required' } },
    })
    vi.stubGlobal('fetch', fetchMock)
    const onSuccess = vi.fn()
    const { user } = renderWithProviders(<LoginForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Email'), 'marketing@autodoc.uz')
    await user.type(screen.getByLabelText('Пароль'), 'Correct-Horse-42')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    const code = await screen.findByLabelText('Код')
    expect(onSuccess).not.toHaveBeenCalled()
    await user.type(code, '123456')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
    const second = sentBody(fetchMock, 'POST admin/auth/login', 1)
    expect(second).toEqual({
      email: 'marketing@autodoc.uz',
      password: 'Correct-Horse-42',
      code: '123456',
    })
  })

  it("shows the API's message on a wrong password", async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'POST admin/auth/login': {
          status: 401,
          body: { code: 'invalid_credentials', message: 'Неверный email или пароль' },
        },
      }),
    )
    const onSuccess = vi.fn()
    const { user } = renderWithProviders(<LoginForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Email'), 'hr@autodoc.uz')
    await user.type(screen.getByLabelText('Пароль'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByText('Неверный email или пароль')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('validates before sending anything', async () => {
    const fetchMock = stubApi({})
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<LoginForm onSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByText('Введите email')).toBeInTheDocument()
    expect(screen.getByText('Введите пароль')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
