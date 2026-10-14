import { Button } from '@/components/ui/button'

/** "Назад · 2 из 5 · Дальше" under a list. Nothing when everything fits on one page. */
export function Pager({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Назад
      </Button>
      <span className="text-muted-foreground tabular-nums">
        {page} из {pages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Дальше
      </Button>
    </div>
  )
}
