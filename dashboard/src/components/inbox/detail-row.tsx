import type { ReactNode } from 'react'

/** One "label: value" line of a submission or application card. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-sm">{children ?? '—'}</dd>
    </div>
  )
}
