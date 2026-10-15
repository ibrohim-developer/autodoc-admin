import type { Me, Permission } from '@/lib/session'
import { can } from '@/lib/session'

export type NavItem = {
  to: string
  label: string
  /** Shown only to roles that have it — the API refuses the rest with 403 anyway. */
  permission: Permission
  /** False until the module ships: listed (so everyone sees what is coming), not clickable. */
  ready: boolean
}

export type NavGroup = { label: string; items: NavItem[] }

/** Grouped as in the design: what the site shows, HR's part, and the running of the admin. */
export const NAV: NavGroup[] = [
  {
    label: 'Контент',
    items: [
      { to: '/', label: 'Обзор', permission: 'home.view', ready: true },
      { to: '/pages', label: 'Страницы', permission: 'content.read', ready: true },
      { to: '/news', label: 'Новости и блог', permission: 'content.read', ready: true },
      { to: '/projects', label: 'Проекты холдинга', permission: 'content.read', ready: false },
      { to: '/texts', label: 'Тексты сайта', permission: 'content.read', ready: true },
      { to: '/library', label: 'Медиатека', permission: 'media.read', ready: true },
      { to: '/leads', label: 'Заявки', permission: 'leads.read', ready: true },
    ],
  },
  {
    label: 'HR',
    items: [
      { to: '/vacancies', label: 'Вакансии', permission: 'vacancies.read', ready: true },
      { to: '/applications', label: 'Отклики', permission: 'applications.read', ready: true },
    ],
  },
  {
    label: 'Система',
    items: [
      // HR sees the vacancy tab only; the page itself decides which tabs to show.
      { to: '/stats', label: 'Аналитика', permission: 'stats.vacancies', ready: true },
      { to: '/settings', label: 'Настройки сайта', permission: 'content.read', ready: true },
      { to: '/redirects', label: 'Редиректы', permission: 'content.read', ready: true },
      { to: '/trash', label: 'Корзина', permission: 'trash.vacancies', ready: true },
      { to: '/users', label: 'Пользователи', permission: 'users.read', ready: true },
      { to: '/audit', label: 'Журнал действий', permission: 'audit.read', ready: true },
      { to: '/integrations', label: 'Интеграции', permission: 'integrations.manage', ready: true },
    ],
  },
]

/** The menu for one user: items they may not use are left out, empty groups too. */
export function navFor(me: Me): NavGroup[] {
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(me, item.permission)),
  })).filter((group) => group.items.length > 0)
}
