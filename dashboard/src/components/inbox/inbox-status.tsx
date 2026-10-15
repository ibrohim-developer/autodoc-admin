import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

/** How far along a submission or application is: waiting, being handled, closed well, closed. */
export type InboxTone = 'new' | 'active' | 'done' | 'closed'

const TONES: Record<InboxTone, string> = {
  new: 'border-transparent bg-info-soft text-info',
  active: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300',
  done: 'border-transparent bg-success-soft text-success',
  closed: 'border-transparent bg-neutral-soft text-neutral',
}

export function InboxStatusBadge({
  tone,
  label,
  className,
}: {
  tone: InboxTone
  label: string
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn('font-normal', TONES[tone], className)}>
      {label}
    </Badge>
  )
}
