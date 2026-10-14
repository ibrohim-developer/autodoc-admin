import type { Page, Route } from '@playwright/test'
import { meFixtures } from '../../src/test/fixtures'

export type Role = keyof typeof meFixtures

const now = '2026-10-14T06:00:00.000Z'
const LEAD = '0d5f7a52-3c44-4f0e-9d7b-6a1e2b3c4d5e'
const APPLICATION = '4b1e2f3a-5c6d-4e7f-8a9b-0c1d2e3f4a5b'
const VACANCY = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

/**
 * An in-memory admin API for browser tests: just enough state for the key flows (log in,
 * handle a submission, an application and the trash). Every call is recorded; a call nobody
 * stubbed answers 404 so a test that relies on it fails loudly.
 */
export async function fakeApi(page: Page, role: Role, options: { twoFactor?: boolean } = {}) {
  const me = meFixtures[role]
  const calls: { method: string; path: string; body: unknown }[] = []
  let loggedIn = false
  const lead = {
    id: LEAD,
    number: 1,
    form: 'feedback',
    formLabel: 'Обратная связь',
    name: 'Алишер Каримов',
    phone: '+998 90 123 45 67',
    topic: 'Сотрудничество',
    message: 'Хотим обсудить проект',
    locale: 'ru',
    page: '/ru/contacts/',
    status: 'new',
    comment: null as string | null,
    consentAt: now,
    createdAt: now,
    updatedAt: now,
    updatedBy: null as { id: string; name: string } | null,
  }
  const application = {
    id: APPLICATION,
    number: 1,
    vacancy: { id: VACANCY, title: 'Frontend dasturchi' },
    name: 'Дилноза',
    phone: '+998 91 000 00 00',
    email: null,
    about: 'Три года React',
    resume: { name: 'Резюме Дилноза.pdf', size: 15, mime: 'application/pdf' },
    source: 'site',
    sourceLabel: 'Сайт',
    locale: 'uz',
    page: null,
    status: 'new',
    comment: null,
    consentAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
  }
  let applicationDeleted = false

  const leadCounts = () => ({
    new: lead.status === 'new' ? 1 : 0,
    in_progress: lead.status === 'in_progress' ? 1 : 0,
    done: lead.status === 'done' ? 1 : 0,
    spam: lead.status === 'spam' ? 1 : 0,
  })

  // Only the API: Vite also serves source files from folders named api/.
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route: Route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname.replace(/^\/api\//, '')
      const method = request.method()
      const body = request.postDataJSON?.() ?? null
      calls.push({ method, path, body })
      const json = (data: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      const key = `${method} ${path}`

      if (key === 'GET admin/auth/me')
        return loggedIn ? json(me) : json({ code: 'no_session' }, 401)
      if (key === 'POST admin/auth/refresh') return json({ code: 'session_expired' }, 401)
      if (key === 'POST admin/auth/login') {
        const sent = body as { email: string; password: string; code?: string }
        if (sent.password !== 'Correct-Horse-42') {
          return json({ code: 'invalid_credentials', message: 'Неверный email или пароль' }, 401)
        }
        if (options.twoFactor && !sent.code) return json({ status: 'two_factor_required' })
        if (options.twoFactor && sent.code !== '123456') {
          return json({ code: 'invalid_code', message: 'Неверный код' }, 401)
        }
        loggedIn = true
        return json({ status: 'ok', user: me })
      }
      if (!loggedIn) return json({ code: 'no_session' }, 401)

      if (key === 'GET admin/home') {
        const can = (permission: string) => me.permissions.includes(permission)
        return json({
          leads: can('leads.read') ? { new: leadCounts().new, latest: [lead] } : null,
          applications: can('applications.read')
            ? {
                new: 1,
                latest: [{ ...application, vacancyTitle: application.vacancy.title }],
              }
            : null,
          views: null,
          drafts: null,
        })
      }
      if (key === 'GET admin/leads') return json({ items: [lead], total: 1, counts: leadCounts() })
      if (key === `GET admin/leads/${LEAD}`) return json(lead)
      if (key === `PATCH admin/leads/${LEAD}`) {
        Object.assign(lead, body, { updatedBy: { id: me.id, name: me.name }, updatedAt: now })
        return json(lead)
      }
      if (key === 'GET admin/applications/vacancies') {
        return json({
          items: [
            {
              id: VACANCY,
              title: 'Frontend dasturchi',
              closed: false,
              isLive: true,
              applications: 1,
              newApplications: 1,
            },
          ],
        })
      }
      if (key === 'GET admin/applications') {
        const items = applicationDeleted ? [] : [application]
        return json({
          items,
          total: items.length,
          counts: { new: items.length, reviewing: 0, interview: 0, hired: 0, rejected: 0 },
        })
      }
      if (key === `GET admin/applications/${APPLICATION}`) {
        return applicationDeleted ? json({ code: 'application_not_found' }, 404) : json(application)
      }
      if (key === `GET admin/applications/${APPLICATION}/resume`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          headers: {
            'Content-Disposition': `attachment; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent(application.resume.name)}`,
          },
          body: '%PDF-1.4\n%%EOF\n',
        })
      }
      if (key === `DELETE admin/applications/${APPLICATION}`) {
        applicationDeleted = true
        return route.fulfill({ status: 204 })
      }
      if (key === 'GET admin/trash') {
        return json({
          items: applicationDeleted
            ? [
                {
                  kind: 'application',
                  id: APPLICATION,
                  type: 'application',
                  typeLabel: 'Отклик',
                  title: 'Отклик №1 · Дилноза',
                  thumbUrl: null,
                  deletedAt: now,
                  deletedBy: { id: me.id, name: me.name },
                  purgeAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
                },
              ]
            : [],
        })
      }
      if (key === `POST admin/trash/application/${APPLICATION}/restore`) {
        applicationDeleted = false
        return route.fulfill({ status: 204 })
      }
      return json({ message: `No fake for ${key}` }, 404)
    },
  )

  return { calls, ids: { lead: LEAD, application: APPLICATION } }
}

/** The login form, as a person fills it in. */
export async function logIn(page: Page, role: Role) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(`${role}@autodoc.uz`)
  await page.getByLabel('Пароль').fill('Correct-Horse-42')
  await page.getByRole('button', { name: /Войти/ }).click()
}
