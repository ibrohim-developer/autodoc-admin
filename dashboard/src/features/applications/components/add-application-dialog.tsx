import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api-client'
import { APPLICATION_SOURCES, SOURCE_LABELS, type VacancyOption } from '../api/applications-api'
import { useCreateApplication } from '../hooks/use-applications'

const NO_VACANCY = 'none'
const MAX_RESUME = 10 * 1024 * 1024
const MANUAL_SOURCES = APPLICATION_SOURCES.filter((source) => source !== 'site')

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите имя').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{7,40}$/, 'Укажите телефон: +998 90 123 45 67'),
  email: z.union([z.literal(''), z.email({ message: 'Неверный email' })]),
  vacancyId: z.string(),
  source: z.enum(MANUAL_SOURCES as [string, ...string[]], { message: 'Выберите источник' }),
  about: z.string().max(4000),
  comment: z.string().max(4000),
})
type Form = z.infer<typeof schema>

/** HR adds a candidate who wrote somewhere else: hh.uz, Instagram, Telegram, a colleague. */
export function AddApplicationDialog({ vacancies }: { vacancies: VacancyOption[] }) {
  const [open, setOpen] = useState(false)
  const [resume, setResume] = useState<File | null>(null)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const navigate = useNavigate()
  const create = useCreateApplication()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      vacancyId: NO_VACANCY,
      source: 'hh',
      about: '',
      comment: '',
    },
  })
  const { errors } = form.formState

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      form.reset()
      create.reset()
      setResume(null)
      setResumeError(null)
    }
  }

  async function submit(values: Form) {
    try {
      const created = await create.mutateAsync({
        ...values,
        source: values.source as (typeof MANUAL_SOURCES)[number],
        vacancyId: values.vacancyId === NO_VACANCY ? '' : values.vacancyId,
        resume,
      })
      toast.success(`Отклик №${created.number} добавлен`)
      onOpenChange(false)
      navigate(`/applications/${created.id}`)
    } catch {
      // Shown in the dialog.
    }
  }

  const field = (name: 'name' | 'phone' | 'email', label: string, type = 'text') => (
    <div className="space-y-2">
      <Label htmlFor={`add-${name}`}>{label}</Label>
      <Input
        id={`add-${name}`}
        type={type}
        aria-invalid={errors[name] ? true : undefined}
        {...form.register(name)}
      />
      {errors[name] ? <p className="text-destructive text-sm">{errors[name]?.message}</p> : null}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" />
          Добавить кандидата
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Добавить кандидата</DialogTitle>
            <DialogDescription>
              Для откликов не с сайта: hh.uz, Instagram, Telegram, рекомендации.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('name', 'Имя и фамилия')}
            {field('phone', 'Телефон', 'tel')}
            {field('email', 'Email (необязательно)', 'email')}
            <div className="space-y-2">
              <Label htmlFor="add-source">Источник</Label>
              <Controller
                control={form.control}
                name="source"
                render={({ field: control }) => (
                  <Select value={control.value} onValueChange={control.onChange}>
                    <SelectTrigger id="add-source" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MANUAL_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {SOURCE_LABELS[source]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-vacancy">Вакансия</Label>
            <Controller
              control={form.control}
              name="vacancyId"
              render={({ field: control }) => (
                <Select value={control.value} onValueChange={control.onChange}>
                  <SelectTrigger id="add-vacancy" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VACANCY}>Другая позиция</SelectItem>
                    {vacancies.map((vacancy) => (
                      <SelectItem key={vacancy.id} value={vacancy.id}>
                        {vacancy.title}
                        {vacancy.closed ? ' (закрыта)' : vacancy.isLive ? '' : ' (черновик)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-resume">Резюме (PDF, DOC или DOCX до 10 МБ)</Label>
            <Input
              id="add-resume"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setResumeError(file && file.size > MAX_RESUME ? 'Файл больше 10 МБ' : null)
                setResume(file && file.size <= MAX_RESUME ? file : null)
              }}
            />
            {resumeError ? <p className="text-destructive text-sm">{resumeError}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-about">О кандидате</Label>
            <Textarea id="add-about" rows={3} {...form.register('about')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-comment">Комментарий</Label>
            <Textarea id="add-comment" rows={2} {...form.register('comment')} />
          </div>
          {create.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(create.error)}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={create.isPending || Boolean(resumeError)}>
              {create.isPending ? 'Сохраняем…' : 'Добавить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
