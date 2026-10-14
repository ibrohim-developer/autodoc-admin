import { Link } from 'react-router'
import type { EditorContext } from '@/components/content/document-editor'
import {
  RichTextField,
  SelectField,
  SlugField,
  SwitchField,
  TextField,
  TextListField,
} from '@/components/content/fields'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EMPLOYMENT, MAX_REQUIREMENTS } from '../api/vacancy-form'
import { useDirectionOptions } from '../hooks/use-directions'

/** One language: the card on the list and the vacancy's own page. */
export function VacancyLocaleFields({ locale, resetKey }: EditorContext) {
  const uz = locale === 'uz'
  return (
    <>
      <TextField name={`locales.${locale}.title`} label="Название" required={uz} maxLength={120} />
      <TextField name={`locales.${locale}.city`} label="Город" required={uz} maxLength={60} />
      <TextField
        name={`locales.${locale}.description`}
        label="Короткое описание"
        required={uz}
        hint="На карточке вакансии, 2–3 строки."
        multiline
        rows={3}
        maxLength={400}
      />
      <TextListField
        name={`locales.${locale}.requirements`}
        label="Требования"
        hint="На карточке, до четырёх коротких пунктов."
        max={MAX_REQUIREMENTS}
        maxLength={120}
        addLabel="Добавить требование"
      />
      <RichTextField
        name={`locales.${locale}.body`}
        label="Полное описание"
        hint="На странице вакансии: обязанности, условия, что предлагаем."
        resetKey={`${resetKey}-${locale}`}
      />
      <details className="rounded-lg border px-4 py-3">
        <summary className="cursor-pointer select-none font-medium text-sm">
          SEO: заголовок и описание для поисковиков
        </summary>
        <div className="mt-4 space-y-5">
          <TextField
            name={`locales.${locale}.seoTitle`}
            label="SEO-заголовок"
            hint="Если пусто — название вакансии."
            maxLength={120}
          />
          <TextField
            name={`locales.${locale}.seoDescription`}
            label="SEO-описание"
            hint="Если пусто — короткое описание."
            multiline
            rows={2}
            maxLength={300}
          />
        </div>
      </details>
    </>
  )
}

export function VacancySidebar({ doc }: EditorContext) {
  const { options, list } = useDirectionOptions()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Вакансия</CardTitle>
        <CardDescription>Одинаково для всех языков.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {doc?.data.shared.hh ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground text-sm">
            Импортирована с hh.uz. Пока её не правят здесь, текст обновляется с hh каждый час; после
            правки — только открывается и закрывается вместе с hh.
          </p>
        ) : null}
        <SelectField
          name="shared.directionId"
          label="Направление"
          required
          options={options}
          placeholder={
            list.data && options.length === 0 ? 'Сначала добавьте направления' : 'Выберите'
          }
          hint={
            <Link to="/vacancies/directions" className="text-primary hover:underline">
              Справочник направлений
            </Link>
          }
        />
        <SelectField
          name="shared.employment"
          label="Занятость"
          required
          options={Object.entries(EMPLOYMENT).map(([value, label]) => ({ value, label }))}
        />
        <SwitchField
          name="shared.closed"
          label="Вакансия закрыта"
          hint="Пропадает из списка на сайте; её страница сообщает, что набор закрыт."
        />
        <SlugField
          name="shared.slug"
          titleName="locales.uz.title"
          follow={!doc?.firstPublishedAt}
          prefix="autodoc.uz/vacancies/"
          hint={
            doc?.firstPublishedAt
              ? 'Вакансия уже была на сайте: со старого адреса посетители попадут на новый.'
              : 'Пока вакансия не опубликована, адрес берётся из названия.'
          }
        />
      </CardContent>
    </Card>
  )
}
