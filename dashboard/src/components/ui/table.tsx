import type * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Tables never scroll sideways: one column per table is `grow` and shrinks, its text cut with
 * an ellipsis; less important columns hide when the table is narrow (container queries, `@2xl:`
 * etc., so the sidebar counts).
 */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="@container relative w-full">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  grow = false,
  ...props
}: React.ComponentProps<'th'> & { grow?: boolean }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        grow && 'w-full max-w-0',
        'h-10 whitespace-nowrap px-3 text-left align-middle font-normal text-muted-foreground text-xs [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

/** `grow`: takes the room left and gives it back first; wrap its text in `truncate`. */
function TableCell({
  className,
  grow = false,
  ...props
}: React.ComponentProps<'td'> & { grow?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        grow && 'w-full max-w-0',
        'whitespace-nowrap px-3 py-2.5 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow }
