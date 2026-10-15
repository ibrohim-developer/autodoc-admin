import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { DocumentList } from '@/components/content/document-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/session'
import { EMPLOYMENT, type Employment } from '../api/vacancy-form'
import { useDirectionOptions } from '../hooks/use-directions'

export function VacanciesListPage() {
  const canWrite = useCan('vacancies.write')
  const { names } = useDirectionOptions()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Вакансии</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Раздел «Карьера» на сайте. Черновик не виден, опубликованная — открыта, закрытая
            пропадает из списка.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/vacancies/directions">
            <Compass aria-hidden="true" />
            Направления
          </Link>
        </Button>
      </div>
      <DocumentList
        type="vacancy"
        basePath="/vacancies"
        canCreate={canWrite}
        createLabel="Новая вакансия"
        empty="Вакансий пока нет"
        columns={[
          {
            header: 'Направление',
            className: 'hidden @4xl:table-cell',
            cell: (item) =>
              typeof item.shared.directionId === 'string'
                ? (names.get(item.shared.directionId) ?? '—')
                : '—',
          },
          {
            header: 'Занятость',
            className: 'hidden @5xl:table-cell text-sm',
            cell: (item) => EMPLOYMENT[item.shared.employment as Employment] ?? '—',
          },
          {
            header: 'Набор',
            className: 'hidden @xl:table-cell',
            cell: (item) =>
              item.shared.closed === true ? (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  Закрыт
                </Badge>
              ) : (
                <span className="text-sm">Открыт</span>
              ),
          },
        ]}
      />
    </div>
  )
}
