import { z } from 'zod'
import { request } from '@/lib/api-client'
import { editorPath } from '@/lib/content'

export const auditEntrySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  userId: z.string().nullable(),
  userEmail: z.string().nullable(),
  action: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  summary: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()).nullable(),
})
export type AuditEntry = z.infer<typeof auditEntrySchema>

const listSchema = z.object({ items: z.array(auditEntrySchema), total: z.number() })

/** The part of `action` before the first dot, as the API filters by it. */
export const SECTIONS: Record<string, string> = {
  auth: 'Вход и безопасность',
  users: 'Пользователи',
  documents: 'Контент',
  media: 'Медиатека',
  leads: 'Заявки',
  applications: 'Отклики',
  integrations: 'Интеграции',
  hh: 'hh.uz',
  retention: 'Сроки хранения',
}

/** Every action the API writes (grep `action:` in api/src). Unknown ones show as they are. */
export const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Вход',
  'auth.login_failed': 'Неудачный вход',
  'auth.locked': 'Учётная запись заблокирована на 15 минут',
  'auth.logout': 'Выход',
  'auth.refresh_reuse': 'Повторное использование сессии: вход завершён везде',
  'auth.password_changed': 'Смена пароля',
  'auth.password_reset': 'Новый пароль по ссылке',
  'auth.invite_accepted': 'Приглашение принято',
  'auth.2fa_enabled': '2FA включена',
  'auth.2fa_disabled': '2FA выключена',
  'auth.recovery_code_used': 'Вход по резервному коду',
  'auth.recovery_codes_regenerated': 'Новые резервные коды',
  'users.invite': 'Приглашение пользователя',
  'users.invite_link': 'Новая ссылка-приглашение',
  'users.update': 'Изменение пользователя',
  'users.reset_link': 'Ссылка для нового пароля',
  'users.reset_2fa': 'Сброс 2FA',
  'documents.create': 'Создание',
  'documents.save': 'Сохранение',
  'documents.publish': 'Публикация',
  'documents.unpublish': 'Снятие с публикации',
  'documents.schedule': 'Публикация по расписанию',
  'documents.unschedule': 'Отмена расписания',
  'documents.schedule_failed': 'Публикация по расписанию не удалась',
  'documents.restore_version': 'Восстановление версии',
  'documents.delete': 'В корзину',
  'documents.restore': 'Из корзины',
  'documents.purge': 'Удалено навсегда',
  'media.upload': 'Загрузка фото',
  'media.update': 'Описание фото',
  'media.delete': 'Фото в корзину',
  'media.restore': 'Фото из корзины',
  'media.purge': 'Фото удалено навсегда',
  'leads.update': 'Заявка: статус или комментарий',
  'leads.export': 'Выгрузка заявок в Excel',
  'leads.delete': 'Заявка в корзину',
  'leads.restore': 'Заявка из корзины',
  'leads.purge': 'Заявка удалена навсегда',
  'applications.create': 'Отклик добавлен вручную',
  'applications.update': 'Отклик: статус или комментарий',
  'applications.export': 'Выгрузка откликов в Excel',
  'applications.resume_download': 'Скачано резюме',
  'applications.delete': 'Отклик в корзину',
  'applications.restore': 'Отклик из корзины',
  'applications.purge': 'Отклик удалён навсегда',
  'integrations.telegram.update': 'Настройки Telegram',
  'integrations.hh.update': 'Настройки hh.uz',
  'hh.sync': 'Синхронизация с hh.uz',
  'retention.run': 'Удаление по срокам хранения',
}

/** Where the thing an entry is about can be opened, if it still can. */
export function entityLink(entry: AuditEntry): string | null {
  const { entityType: type, entityId: id } = entry
  if (!type || !id) return null
  if (type === 'lead') return `/leads/${id}`
  if (type === 'application') return `/applications/${id}`
  if (type === 'media') return '/library'
  if (type === 'user') return '/users'
  if (type === 'integration') return '/integrations'
  const path = editorPath(type, id)
  return path === '/' ? null : path
}

export type AuditFilters = {
  section?: string
  userId?: string
  q?: string
  /** ISO instants. */
  from?: string
  to?: string
}

export function fetchAudit(filters: AuditFilters & { page: number; pageSize: number }) {
  const searchParams = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number>
  return request('admin/audit', { schema: listSchema, searchParams })
}

const userSchema = z.object({ id: z.string(), name: z.string(), email: z.string() })

export function fetchAuditUsers() {
  return request('admin/users', {
    schema: z.object({ items: z.array(userSchema) }).loose(),
  })
}
