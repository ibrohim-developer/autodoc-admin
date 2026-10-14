import { ChevronRight, FileText, Scale } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '@/components/ui/card'
import { LEGAL, PAGES } from '../api/page-specs'

function PageLink({
  to,
  label,
  path,
  detail,
}: {
  to: string
  label: string
  path: string
  detail: string
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="min-w-0">
          <span className="block font-medium">{label}</span>
          <span className="block truncate text-muted-foreground text-xs">
            autodoc.uz{path} · {detail}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}

const count = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10
  const mod100 = n % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many
  return `${n} ${word}`
}

export function PagesListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Страницы</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          SEO каждой страницы, какие блоки показывать и главные фото. Тексты блоков — в разделе
          «Тексты сайта».
        </p>
      </div>
      <Card className="p-2">
        <h2 className="flex items-center gap-2 px-4 pt-3 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          <FileText className="size-3.5" aria-hidden="true" />
          Страницы сайта
        </h2>
        <ul>
          {PAGES.map((page) => (
            <PageLink
              key={page.key}
              to={`/pages/${page.key}`}
              label={page.label}
              path={page.path}
              detail={[
                count(page.blocks.length, 'блок', 'блока', 'блоков'),
                page.photos.length ? count(page.photos.length, 'фото', 'фото', 'фото') : null,
              ]
                .filter(Boolean)
                .join(', ')}
            />
          ))}
        </ul>
      </Card>
      <Card className="p-2">
        <h2 className="flex items-center gap-2 px-4 pt-3 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          <Scale className="size-3.5" aria-hidden="true" />
          Документы в подвале
        </h2>
        <ul>
          {LEGAL.map((page) => (
            <PageLink
              key={page.key}
              to={`/pages/legal/${page.key}`}
              label={page.label}
              path={page.path}
              detail="текст документа, ссылка в подвале появится после публикации"
            />
          ))}
        </ul>
      </Card>
    </div>
  )
}
