import { Plus, X } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useController, useFormContext, useWatch } from 'react-hook-form'
import { RichTextEditor } from '@/components/rich-text/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import type { RichTextDoc } from '@/lib/rich-text'
import { slugify } from '@/lib/slug'

/**
 * Form fields for content documents. They read the form from context, so a section's form is
 * a list of `<TextField name="locales.uz.title" …/>`. Field names follow the document's shape,
 * which lets the API's error paths (`locales.uz.title`) land on the right field.
 */

export function Field({
  id,
  label,
  required = false,
  hint,
  error,
  aside,
  children,
  className,
}: {
  /** The input's id; without one the label is plain text (editor, photo fields). */
  id?: string
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  error?: string
  /** Right of the label: a character counter, a link. */
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  const labelText = (
    <>
      {label}
      {required ? (
        <span className="text-destructive" aria-hidden="true">
          {' '}
          *
        </span>
      ) : null}
    </>
  )
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        {id ? (
          <Label htmlFor={id}>{labelText}</Label>
        ) : (
          <span className="font-medium text-sm leading-none">{labelText}</span>
        )}
        {aside}
      </div>
      {children}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

export function useFieldError(name: string): string | undefined {
  const { getFieldState, formState } = useFormContext()
  return getFieldState(name, formState).error?.message
}

function Counter({ value, max }: { value: string | undefined; max: number }) {
  const length = value?.length ?? 0
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        length > max ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {length}/{max}
    </span>
  )
}

export function TextField({
  name,
  label,
  required,
  hint,
  maxLength,
  multiline = false,
  rows = 3,
  placeholder,
  type = 'text',
}: {
  name: string
  label: string
  required?: boolean
  hint?: ReactNode
  /** Shows a counter; the API enforces the limit. */
  maxLength?: number
  multiline?: boolean
  rows?: number
  placeholder?: string
  type?: 'text' | 'url' | 'email' | 'tel'
}) {
  const id = useId()
  const { register } = useFormContext()
  const error = useFieldError(name)
  const value = useWatch({ name }) as string | undefined
  const props = {
    id,
    ...register(name),
    placeholder,
    'aria-invalid': error ? true : undefined,
  }
  return (
    <Field
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      aside={maxLength ? <Counter value={value} max={maxLength} /> : null}
    >
      {multiline ? <Textarea rows={rows} {...props} /> : <Input type={type} {...props} />}
    </Field>
  )
}

export function NumberField({
  name,
  label,
  hint,
  min = 0,
  max,
  step,
}: {
  name: string
  label: string
  hint?: ReactNode
  min?: number
  max?: number
  /** "any" for decimals (map coordinates); whole numbers otherwise. */
  step?: number | 'any'
}) {
  const id = useId()
  const { register } = useFormContext()
  const error = useFieldError(name)
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <Input
        id={id}
        type="number"
        inputMode={step === 'any' ? 'decimal' : 'numeric'}
        min={min}
        max={max}
        step={step}
        {...register(name, {
          setValueAs: (value: string) => (value === '' ? undefined : Number(value)),
        })}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  )
}

export function DateField({
  name,
  label,
  required,
  hint,
}: {
  name: string
  label: string
  required?: boolean
  hint?: ReactNode
}) {
  const id = useId()
  const { register } = useFormContext()
  const error = useFieldError(name)
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error}>
      <Input id={id} type="date" {...register(name)} aria-invalid={error ? true : undefined} />
    </Field>
  )
}

export function SwitchField({
  name,
  label,
  hint,
}: {
  name: string
  label: string
  hint?: ReactNode
}) {
  const id = useId()
  const { field } = useController({ name })
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      <Switch id={id} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
    </div>
  )
}

// Radix Select can't hold an empty string: this stands for "nothing chosen".
const NONE = '__none__'

export function SelectField({
  name,
  label,
  options,
  required,
  hint,
  emptyLabel = 'Не выбрано',
  placeholder = 'Выберите',
}: {
  name: string
  label: string
  options: { value: string; label: string }[]
  /** Without it the list starts with "Не выбрано", which stores null. */
  required?: boolean
  hint?: ReactNode
  emptyLabel?: string
  placeholder?: string
}) {
  const id = useId()
  const { field, fieldState } = useController({ name })
  const value = typeof field.value === 'string' && field.value ? field.value : required ? '' : NONE
  return (
    <Field id={id} label={label} required={required} hint={hint} error={fieldState.error?.message}>
      <Select value={value} onValueChange={(next) => field.onChange(next === NONE ? null : next)}>
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={fieldState.error ? true : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {required ? null : <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function TagsField({
  name,
  label,
  hint,
  max = 10,
}: {
  name: string
  label: string
  hint?: ReactNode
  max?: number
}) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const { field, fieldState } = useController({ name })
  const tags: string[] = Array.isArray(field.value) ? field.value : []

  function add() {
    const tag = draft.trim().replace(/^#/, '')
    setDraft('')
    if (!tag || tags.includes(tag) || tags.length >= max) return
    field.onChange([...tags, tag])
  }

  return (
    <Field
      id={id}
      label={label}
      hint={hint ?? 'Enter или запятая — добавить тег'}
      error={fieldState.error?.message}
    >
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-sm"
          >
            {tag}
            <button
              type="button"
              aria-label={`Убрать тег «${tag}»`}
              onClick={() => field.onChange(tags.filter((item) => item !== tag))}
              className="rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add()
            } else if (event.key === 'Backspace' && !draft && tags.length > 0) {
              field.onChange(tags.slice(0, -1))
            }
          }}
          onBlur={add}
          disabled={tags.length >= max}
          placeholder={tags.length >= max ? `Не больше ${max}` : 'Новый тег'}
          className="min-w-28 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </Field>
  )
}

/** A short list of lines (a vacancy's requirements): one input each, up to `max`. */
export function TextListField({
  name,
  label,
  hint,
  max,
  maxLength,
  addLabel = 'Добавить',
}: {
  name: string
  label: string
  hint?: ReactNode
  max: number
  maxLength?: number
  addLabel?: string
}) {
  const { field, fieldState } = useController({ name })
  const items: string[] = Array.isArray(field.value) ? field.value : []
  const set = (next: string[]) => field.onChange(next)

  return (
    <Field
      label={label}
      hint={hint}
      error={fieldState.error?.message}
      aside={
        <span className="text-muted-foreground text-xs tabular-nums">
          {items.length}/{max}
        </span>
      }
    >
      <ol className="space-y-2">
        {items.map((item, index) => (
          // Lines may repeat while typed, and only removal reorders them: the index is the key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <li key={index} className="flex gap-2">
            <Input
              value={item}
              maxLength={maxLength}
              aria-label={`${label}: ${index + 1}`}
              onChange={(event) =>
                set(items.map((value, i) => (i === index ? event.target.value : value)))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Убрать ${index + 1}`}
              onClick={() => set(items.filter((_, i) => i !== index))}
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
      {items.length < max ? (
        <Button type="button" variant="outline" size="sm" onClick={() => set([...items, ''])}>
          <Plus aria-hidden="true" />
          {addLabel}
        </Button>
      ) : null}
    </Field>
  )
}

/**
 * The page's address. It follows the title until the page first goes live, unless edited by
 * hand; after that it changes only by hand, because links to the old address exist.
 */
export function SlugField({
  name,
  titleName,
  follow,
  prefix,
  hint,
}: {
  name: string
  titleName: string
  follow: boolean
  /** Shown before the field: "autodoc.uz/blog/". */
  prefix: string
  hint?: ReactNode
}) {
  const id = useId()
  const { field, fieldState } = useController({ name })
  const title = useWatch({ name: titleName }) as string | undefined
  // An address that isn't simply the title was set by hand: leave it alone.
  const custom = useRef<boolean | null>(null)
  if (custom.current === null) {
    const current = typeof field.value === 'string' ? field.value : ''
    custom.current = current !== '' && current !== slugify(title ?? '')
  }

  useEffect(() => {
    if (follow && !custom.current) field.onChange(slugify(title ?? ''))
    // field.onChange is stable for a field; following the title is the point.
  }, [follow, title, field.onChange])

  return (
    <Field id={id} label="Адрес страницы" hint={hint} error={fieldState.error?.message}>
      <div className="flex h-9 items-center rounded-md border shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <span className="select-none truncate pl-3 text-muted-foreground text-sm">{prefix}</span>
        <input
          id={id}
          value={typeof field.value === 'string' ? field.value : ''}
          onChange={(event) => {
            custom.current = true
            field.onChange(slugify(event.target.value, { trim: false }))
          }}
          onBlur={() => field.onChange(slugify(String(field.value ?? '')))}
          className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none"
          spellCheck={false}
        />
      </div>
    </Field>
  )
}

export function RichTextField({
  name,
  label,
  resetKey,
  required,
  hint,
  placeholder,
}: {
  name: string
  label: string
  /** Changes when the form loads other content: the editor then mounts afresh. */
  resetKey: number | string
  required?: boolean
  hint?: ReactNode
  placeholder?: string
}) {
  const { field, fieldState } = useController({ name })
  return (
    <Field label={label} required={required} hint={hint} error={fieldState.error?.message}>
      <RichTextEditor
        key={resetKey}
        label={label}
        initialValue={field.value as RichTextDoc | undefined}
        onChange={field.onChange}
        invalid={Boolean(fieldState.error)}
        placeholder={placeholder}
      />
    </Field>
  )
}
