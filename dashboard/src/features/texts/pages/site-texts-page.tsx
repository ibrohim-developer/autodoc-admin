import { DocumentEditor } from '@/components/content/document-editor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-client'
import {
  emptyTexts,
  placeholderIssues,
  textsFromData,
  textsHasLocale,
  textsToData,
  useTextDefaults,
} from '../api/site-texts'
import { TextsList } from '../components/texts-list'

export function SiteTextsPage() {
  const defaults = useTextDefaults()

  if (defaults.isPending) return <p className="text-muted-foreground text-sm">Загружаем…</p>
  if (defaults.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-4">
          {errorMessage(defaults.error)}
          <Button size="sm" variant="outline" onClick={() => defaults.refetch()}>
            Повторить
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  const loaded = defaults.data

  return (
    <DocumentEditor
      type="site_texts"
      singleton
      newTitle="Тексты сайта"
      list={{ path: '/texts', label: 'Тексты сайта' }}
      permissions={{ write: 'content.write', publish: 'content.publish' }}
      // A fixed name: there is no title field.
      titleName="title"
      empty={emptyTexts}
      fromData={textsFromData}
      toData={textsToData}
      hasLocale={textsHasLocale}
      languages="independent"
      // Text keys contain dots: an API problem points at the exact field.
      fieldOfIssue={(path) => path}
      validate={(values) => placeholderIssues(values, loaded)}
      renderLocale={({ locale }) => <TextsList locale={locale} defaults={loaded[locale]} />}
    />
  )
}
