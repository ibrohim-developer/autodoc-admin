import { Pin, Tags } from 'lucide-react'
import { Link } from 'react-router'
import { DocumentList } from '@/components/content/document-list'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/session'
import { useCategoryOptions } from '../hooks/use-categories'

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'UTC' })

export function NewsListPage() {
  const canWrite = useCan('content.write')
  const { names } = useCategoryOptions()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Новости</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Раздел «Блог» на сайте и блок новостей на главной.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/news/categories">
            <Tags aria-hidden="true" />
            Категории
          </Link>
        </Button>
      </div>
      <DocumentList
        type="post"
        basePath="/news"
        canCreate={canWrite}
        createLabel="Новая новость"
        empty="Новостей пока нет"
        columns={[
          {
            header: 'Категория',
            className: 'hidden lg:table-cell',
            cell: (item) =>
              typeof item.shared.categoryId === 'string'
                ? (names.get(item.shared.categoryId) ?? '—')
                : '—',
          },
          {
            header: 'Дата',
            className: 'hidden sm:table-cell whitespace-nowrap',
            cell: (item) => (
              <span className="inline-flex items-center gap-1.5">
                {typeof item.shared.date === 'string'
                  ? dateFormat.format(new Date(item.shared.date))
                  : '—'}
                {item.shared.pinned === true ? (
                  <Pin className="size-3.5 text-primary" aria-label="Закреплена" />
                ) : null}
              </span>
            ),
          },
        ]}
      />
    </div>
  )
}
