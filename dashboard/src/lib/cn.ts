import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge class names, resolving Tailwind conflicts so the *last* class wins.
 *
 * `clsx` handles conditionals/arrays/objects; `twMerge` then dedupes conflicting
 * Tailwind utilities, which is what makes component `className` overrides work:
 *
 *   cn('px-4 py-2', 'px-8')            // -> 'py-2 px-8'
 *   cn('text-sm', isLarge && 'text-lg') // -> 'text-lg' when isLarge
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
