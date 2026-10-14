import { expect, test } from '@playwright/test'
import { fakeApi, logIn } from './support/fake-api'

test('marketing takes a submission into work and leaves a comment', async ({ page }) => {
  const api = await fakeApi(page, 'marketing')
  await logIn(page, 'marketing')
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Заявки' })
    .click()

  await page.getByRole('link', { name: 'Алишер Каримов' }).click()
  await expect(page.getByRole('heading', { name: /Заявка №1/ })).toBeVisible()
  await page.getByLabel('Статус').click()
  await page.getByRole('option', { name: 'В работе' }).click()
  await expect(page.getByRole('heading', { name: /Заявка №1/ }).getByText('В работе')).toBeVisible()

  await page.getByLabel('Комментарий').fill('Перезвонить в понедельник')
  await page.getByRole('button', { name: 'Сохранить комментарий' }).click()
  await expect(page.getByText(/Изменил\(а\) Мадина/)).toBeVisible()

  const patches = api.calls.filter((call) => call.method === 'PATCH')
  expect(patches.map((call) => call.body)).toEqual([
    { status: 'in_progress' },
    { comment: 'Перезвонить в понедельник' },
  ])
})

test('HR downloads a resume, deletes the application and restores it from the trash', async ({
  page,
}) => {
  await fakeApi(page, 'hr')
  await logIn(page, 'hr')
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Отклики' })
    .click()
  await page.getByRole('link', { name: 'Дилноза' }).click()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать резюме' }).click()
  // The name comes from Content-Disposition (Cyrillic, through filename*).
  expect((await download).suggestedFilename()).toMatch(/\.pdf$|^download$/)

  await page.getByRole('button', { name: 'Удалить' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
  await expect(page).toHaveURL(/\/applications$/)
  await expect(page.getByText('Откликов пока нет')).toBeVisible()

  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Корзина' })
    .click()
  const row = page.getByRole('row', { name: /Отклик №1 · Дилноза/ })
  await row.getByRole('button', { name: 'Восстановить' }).click()
  await expect(page.getByText('Корзина пуста')).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Отклики' })
    .click()
  await expect(page.getByRole('link', { name: 'Дилноза' })).toBeVisible()
})
