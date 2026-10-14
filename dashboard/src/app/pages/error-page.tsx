import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { buttonVariants } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-client'

/**
 * Rendered by the router whenever a route (or anything it renders) throws.
 * Without an `errorElement` React Router shows its own default screen.
 */
export function ErrorPage() {
  const error = useRouteError()

  const title = isRouteErrorResponse(error) ? `Ошибка ${error.status}` : 'Что-то пошло не так'
  const detail = isRouteErrorResponse(error)
    ? typeof error.data === 'string'
      ? error.data
      : 'Страница не открылась.'
    : errorMessage(error, error instanceof Error ? error.message : 'Неизвестная ошибка.')

  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="font-semibold text-2xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{detail}</p>
      <Link to="/" className={`${buttonVariants({ variant: 'outline' })} mt-6`}>
        На главную
      </Link>
    </div>
  )
}
