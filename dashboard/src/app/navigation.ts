import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  History,
  House,
  Image,
  Inbox,
  type LucideIcon,
  Newspaper,
  Plug,
  Settings,
  Shuffle,
  Trash2,
  Type,
  UserRoundSearch,
  Users,
} from 'lucide-react'
import type { Me, Permission } from '@/lib/session'
import { can } from '@/lib/session'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Shown only to roles that have it — the API refuses the rest with 403 anyway. */
  permission: Permission
  /** False until the module ships: listed (so everyone sees what is coming), not clickable. */
  ready: boolean
}

export type NavGroup = { label: string | null; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [{ to: '/', label: 'Главная', icon: House, permission: 'home.view', ready: true }],
  },
  {
    label: 'Сайт',
    items: [
      { to: '/news', label: 'Новости', icon: Newspaper, permission: 'content.read', ready: true },
      {
        to: '/projects',
        label: 'Проекты',
        icon: FolderKanban,
        permission: 'content.read',
        ready: false,
      },
      { to: '/pages', label: 'Страницы', icon: FileText, permission: 'content.read', ready: true },
      { to: '/texts', label: 'Тексты сайта', icon: Type, permission: 'content.read', ready: true },
      { to: '/library', label: 'Медиатека', icon: Image, permission: 'media.read', ready: true },
      {
        to: '/settings',
        label: 'Настройки сайта',
        icon: Settings,
        permission: 'content.read',
        ready: true,
      },
      {
        to: '/redirects',
        label: 'Редиректы',
        icon: Shuffle,
        permission: 'content.read',
        ready: true,
      },
    ],
  },
  {
    label: 'Карьера',
    items: [
      {
        to: '/vacancies',
        label: 'Вакансии',
        icon: BriefcaseBusiness,
        permission: 'vacancies.read',
        ready: true,
      },
      {
        to: '/applications',
        label: 'Отклики',
        icon: UserRoundSearch,
        permission: 'applications.read',
        ready: true,
      },
    ],
  },
  {
    label: 'Обращения',
    items: [{ to: '/leads', label: 'Заявки', icon: Inbox, permission: 'leads.read', ready: true }],
  },
  {
    label: 'Аналитика',
    items: [
      // HR sees the vacancy tab only; the page itself decides which tabs to show.
      {
        to: '/stats',
        label: 'Статистика',
        icon: BarChart3,
        permission: 'stats.vacancies',
        ready: true,
      },
    ],
  },
  {
    label: 'Управление',
    items: [
      { to: '/trash', label: 'Корзина', icon: Trash2, permission: 'trash.vacancies', ready: true },
      { to: '/users', label: 'Пользователи', icon: Users, permission: 'users.read', ready: true },
      {
        to: '/audit',
        label: 'Журнал действий',
        icon: History,
        permission: 'audit.read',
        ready: false,
      },
      {
        to: '/integrations',
        label: 'Интеграции',
        icon: Plug,
        permission: 'integrations.manage',
        ready: true,
      },
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
