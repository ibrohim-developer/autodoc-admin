import { useParams } from 'react-router'
import { DocumentEditor } from '@/components/content/document-editor'
import { emptyVacancy, vacancyFromData, vacancyHasLocale, vacancyToData } from '../api/vacancy-form'
import { VacancyLocaleFields, VacancySidebar } from '../components/vacancy-fields'

export function VacancyEditorPage() {
  const { id } = useParams()
  const existing = id && id !== 'new' ? id : undefined
  return (
    <DocumentEditor
      // A different vacancy is a different form: nothing carries over.
      key={existing ?? 'new'}
      type="vacancy"
      id={existing}
      newTitle="Новая вакансия"
      list={{ path: '/vacancies', label: 'Вакансии' }}
      permissions={{ write: 'vacancies.write', publish: 'vacancies.publish' }}
      titleName="locales.uz.title"
      empty={emptyVacancy}
      fromData={vacancyFromData}
      toData={vacancyToData}
      hasLocale={vacancyHasLocale}
      renderLocale={(context) => <VacancyLocaleFields {...context} />}
      renderSidebar={(context) => <VacancySidebar {...context} />}
    />
  )
}
