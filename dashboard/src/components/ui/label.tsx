import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn(
        'font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  )
}
