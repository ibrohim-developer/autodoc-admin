import { meFixtures } from '@/test/fixtures'
import { NAV, navFor } from './navigation'

const labels = (me: Parameters<typeof navFor>[0]) =>
  navFor(me).flatMap((group) => group.items.map((item) => item.label))

describe('navFor', () => {
  it('shows HR only vacancies, applications, vacancy stats and the trash', () => {
    expect(labels(meFixtures.hr)).toEqual(['Обзор', 'Вакансии', 'Отклики', 'Аналитика', 'Корзина'])
  })

  it('shows marketing everything except the audit log and integrations', () => {
    const marketing = labels(meFixtures.marketing)
    expect(marketing).toContain('Новости и блог')
    expect(marketing).toContain('Заявки')
    expect(marketing).toContain('Пользователи')
    expect(marketing).not.toContain('Журнал действий')
    expect(marketing).not.toContain('Интеграции')
  })

  it('shows the administrator every section', () => {
    expect(labels(meFixtures.admin)).toContain('Журнал действий')
    expect(labels(meFixtures.admin)).toContain('Интеграции')
  })

  it('drops groups that end up empty', () => {
    const hr = { ...meFixtures.hr, permissions: ['vacancies.read', 'applications.read'] }
    expect(navFor(hr).map((group) => group.label)).toEqual(['HR'])
  })

  // The server sends /api and /media to the API and the file handler, so a dashboard page
  // there opens fine from the menu but breaks on reload or from a shared link.
  it('never uses a path the server keeps for itself', () => {
    const paths = NAV.flatMap((group) => group.items.map((item) => item.to))
    for (const path of paths) expect(path).not.toMatch(/^\/(api|media)(\/|$)/)
  })
})
