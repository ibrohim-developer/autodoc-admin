import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <p className="font-medium text-muted-foreground text-sm">404</p>
      <h1 className="mt-2 font-semibold text-2xl">Страница не найдена</h1>
      <p className="mt-2 text-muted-foreground">Проверьте адрес или вернитесь на главную.</p>
      <Link to="/" className={`${buttonVariants()} mt-6`}>
        На главную
      </Link>
    </div>
  )
}
