import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { type DocumentStatus, STATUS_LABELS } from '@/lib/content'

const STYLES: Record<DocumentStatus, string> = {
  draft: 'border-transparent bg-neutral-soft text-neutral',
  published: 'border-transparent bg-success-soft text-success',
  changed: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300',
  scheduled: 'border-transparent bg-info-soft text-info',
}

const SHORT: Partial<Record<DocumentStatus, string>> = { changed: 'Есть изменения' }

export function StatusBadge({
  status,
  short = false,
  className,
}: {
  status: DocumentStatus
  /** Lists are narrow: "Есть изменения" instead of the full wording. */
  short?: boolean
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn('font-normal', STYLES[status], className)}>
      {(short && SHORT[status]) || STATUS_LABELS[status]}
    </Badge>
  )
}
