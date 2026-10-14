import { Navigate, useParams } from 'react-router'
import { DocumentEditor } from '@/components/content/document-editor'
import { RichTextField, TextField } from '@/components/content/fields'
import { LEGAL, legalForm } from '../api/page-specs'
import { SeoFields } from '../components/seo-fields'

export function LegalEditorPage() {
  const { key } = useParams()
  const page = LEGAL.find((item) => item.key === key)
  if (!page) return <Navigate to="/pages" replace />

  return (
    <DocumentEditor
      key={page.key}
      type={`legal_${page.key}`}
      singleton
      showBack
      newTitle={page.label}
      list={{ path: '/pages', label: 'Страницы' }}
      permissions={{ write: 'content.write', publish: 'content.publish' }}
      titleName="locales.uz.title"
      empty={legalForm.empty}
      fromData={legalForm.fromData}
      toData={legalForm.toData}
      hasLocale={legalForm.hasLocale}
      renderLocale={({ locale, resetKey }) => (
        <>
          <TextField
            name={`locales.${locale}.title`}
            label="Заголовок"
            required={locale === 'uz'}
            maxLength={160}
          />
          <RichTextField
            name={`locales.${locale}.body`}
            label="Текст документа"
            hint="Текст, согласованный с юристом. Ссылка в подвале сайта появится после публикации."
            resetKey={`${resetKey}-${locale}`}
          />
          <details className="rounded-lg border px-4 py-3">
            <summary className="cursor-pointer select-none font-medium text-sm">SEO</summary>
            <div className="mt-4 space-y-5">
              <SeoFields
                locale={locale}
                titleHint="Если пусто — заголовок документа."
                descriptionHint="Короткое описание для поисковиков."
              />
            </div>
          </details>
        </>
      )}
    />
  )
}
