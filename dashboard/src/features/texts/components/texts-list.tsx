import { Search } from 'lucide-react'
import { memo, useDeferredValue, useId, useMemo, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useFieldError } from '@/components/content/fields'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Locale } from '@/lib/media'
import { flatten, isEditableText, placeholdersOf } from '../api/site-texts'

/** Sections of the site, in the order a visitor meets them; anything new goes last. */
const GROUPS: Record<string, string> = {
  Header: 'Шапка сайта',
  Nav: 'Меню',
  Hero: 'Главная · первый экран',
  PartnerStrip: 'Главная · лента партнёров',
  Stats: 'Цифры холдинга',
  Position: 'Главная · о холдинге',
  Video: 'Главная · видео',
  Directions: 'Направления и проекты',
  PhotoBand: 'Фото-ленты',
  Leaders: 'Руководство',
  Trust: 'Нам доверяют',
  News: 'Главная · новости',
  Feedback: 'Форма обратной связи',
  About: 'О компании',
  Projects: 'Проекты',
  Blog: 'Блог',
  Career: 'Карьера и вакансии',
  Partners: 'Партнёры',
  Contacts: 'Контакты',
  Footer: 'Подвал',
  NotFound: 'Страница 404',
  Locale: 'Названия языков',
}

const fieldName = (locale: Locale, key: string) => `shared.overrides.${locale}.${key}`

const TextRow = memo(function TextRow({
  locale,
  textKey,
  fallback,
}: {
  locale: Locale
  textKey: string
  fallback: string
}) {
  const id = useId()
  const name = fieldName(locale, textKey)
  const { register, setValue } = useFormContext()
  const value = useWatch({ name }) as string | undefined
  const error = useFieldError(name)
  const changed = Boolean(value?.trim())
  const expected = placeholdersOf(fallback)
  const lost = changed && expected.join() !== placeholdersOf(value ?? '').join()

  return (
    <div className="grid gap-2 py-3 md:grid-cols-2 md:gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="block break-all font-mono text-[11px] text-muted-foreground">
          {textKey}
        </label>
        <p className="mt-1 whitespace-pre-line text-sm">{fallback}</p>
      </div>
      <div className="min-w-0 space-y-1">
        <Textarea
          id={id}
          rows={1}
          placeholder="Как в коде"
          aria-invalid={error || lost ? true : undefined}
          className="field-sizing-content min-h-9 resize-none"
          {...register(name)}
        />
        {error ? (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : lost ? (
          <p className="text-amber-700 text-xs dark:text-amber-300">
            {expected.length
              ? `Оставьте ${expected.map((item) => `{${item}}`).join(', ')}: сайт подставляет туда значение`
              : 'Уберите фигурные скобки: здесь сайт ничего не подставляет'}
          </p>
        ) : null}
        {changed ? (
          <button
            type="button"
            onClick={() => setValue(name, '', { shouldDirty: true })}
            className="text-primary text-xs hover:underline"
          >
            Вернуть текст из кода
          </button>
        ) : null}
      </div>
    </div>
  )
})

function GroupSummary({ locale, group, count }: { locale: Locale; group: string; count: number }) {
  const subtree = useWatch({ name: `shared.overrides.${locale}.${group}` })
  const changed = Object.values(flatten(subtree)).filter((value) => value.trim()).length
  return (
    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
      <span className="font-medium text-sm">{GROUPS[group] ?? group}</span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {count}
        {changed ? ` · изменено ${changed}` : ''}
      </span>
    </summary>
  )
}

/** One language's texts, by section of the site, with search and "only changed". */
export function TextsList({
  locale,
  defaults,
}: {
  locale: Locale
  defaults: Record<string, unknown>
}) {
  const [q, setQ] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const query = useDeferredValue(q.trim().toLowerCase())
  const switchId = useId()
  const overrides = useWatch({ name: `shared.overrides.${locale}` })
  const changedKeys = useMemo(() => {
    if (!onlyChanged) return null
    return new Set(
      Object.entries(flatten(overrides))
        .filter(([, value]) => value.trim())
        .map(([key]) => key),
    )
  }, [onlyChanged, overrides])

  const groups = useMemo(() => {
    const texts = Object.entries(flatten(defaults)).filter(([key]) => isEditableText(key))
    const byGroup = new Map<string, [string, string][]>()
    for (const entry of texts) {
      const group = entry[0].split('.')[0] ?? ''
      byGroup.set(group, [...(byGroup.get(group) ?? []), entry])
    }
    const order = Object.keys(GROUPS)
    return [...byGroup.entries()].sort(
      ([a], [b]) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999),
    )
  }, [defaults])

  const visible = groups
    .map(([group, rows]) => {
      const shown = rows.filter(([key, fallback]) => {
        if (changedKeys && !changedKeys.has(key)) return false
        if (!query) return true
        return key.toLowerCase().includes(query) || fallback.toLowerCase().includes(query)
      })
      return [group, shown, rows.length] as const
    })
    .filter(([, shown]) => shown.length > 0)

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Слева — текст из кода, справа — ваш вариант. Пустое поле — на сайте текст из кода на этом
        языке.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Найти текст или ключ"
            aria-label="Поиск по текстам"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id={switchId} checked={onlyChanged} onCheckedChange={setOnlyChanged} />
          <Label htmlFor={switchId}>Только изменённые</Label>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">Ничего не найдено</p>
      ) : null}
      {visible.map(([group, rows, count]) => (
        <details
          key={group}
          open={Boolean(query) || Boolean(changedKeys)}
          className="rounded-lg border"
        >
          <GroupSummary locale={locale} group={group} count={count} />
          <div className="divide-y border-t px-4">
            {rows.map(([key, fallback]) => (
              <TextRow key={key} locale={locale} textKey={key} fallback={fallback} />
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
