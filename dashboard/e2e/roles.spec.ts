import { expect, test } from '@playwright/test'
import { fakeApi, logIn } from './support/fake-api'

test("marketing logs in and sees submissions, but not the administrator's sections", async ({
  page,
}) => {
  await fakeApi(page, 'marketing')
  await logIn(page, 'marketing')

  await expect(page.getByRole('heading', { name: /Мадина/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Алишер Каримов/ })).toBeVisible()
  const menu = page.getByRole('navigation', { name: 'Разделы' })
  await expect(menu.getByRole('link', { name: 'Заявки' })).toBeVisible()
  await expect(menu.getByText('Журнал действий')).toHaveCount(0)
  await expect(menu.getByText('Интеграции')).toHaveCount(0)
})

test('HR sees vacancies and applications only; other sections answer "Нет доступа"', async ({
  page,
}) => {
  await fakeApi(page, 'hr')
  await logIn(page, 'hr')

  const menu = page.getByRole('navigation', { name: 'Разделы' })
  await expect(menu.getByRole('link', { name: 'Отклики' })).toBeVisible()
  await expect(menu.getByText('Заявки')).toHaveCount(0)
  await expect(menu.getByText('Новости')).toHaveCount(0)

  await page.goto('/leads')
  await expect(page.getByRole('heading', { name: 'Нет доступа' })).toBeVisible()
  await page.goto('/audit')
  await expect(page.getByRole('heading', { name: 'Нет доступа' })).toBeVisible()
})

test('a user with 2FA gives the code after the password', async ({ page }) => {
  await fakeApi(page, 'marketing', { twoFactor: true })
  await logIn(page, 'marketing')

  await page.getByLabel('Код').fill('000000')
  await page.getByRole('button', { name: /Войти|Подтвердить/ }).click()
  await expect(page.getByText('Неверный код')).toBeVisible()
  await page.getByLabel('Код').fill('123456')
  await page.getByRole('button', { name: /Войти|Подтвердить/ }).click()
  await expect(page.getByRole('heading', { name: /Мадина/ })).toBeVisible()
})

test('a wrong password says so and lets nobody in', async ({ page }) => {
  await fakeApi(page, 'marketing')
  await page.goto('/leads')
  await expect(page).toHaveURL(/\/login\?next=%2Fleads/)
  await page.getByLabel('Email').fill('marketing@autodoc.uz')
  await page.getByLabel('Пароль').fill('wrong-password')
  await page.getByRole('button', { name: /Войти/ }).click()
  await expect(page.getByText('Неверный email или пароль')).toBeVisible()
})
