import { NamedListPage } from '@/components/content/named-list-page'
import { CATEGORY_TYPE } from '../hooks/use-categories'

export function NewsCategoriesPage() {
  return (
    <NamedListPage
      type={CATEGORY_TYPE}
      back={{ path: '/news', label: 'Новости' }}
      writePermission="content.write"
      texts={{
        title: 'Категории новостей',
        description:
          'Фильтр над списком новостей на сайте. Категорию, выбранную в новостях, удалить нельзя.',
        createLabel: 'Новая категория',
        itemLabel: 'Категория',
        empty: 'Категорий пока нет. Без них фильтра на сайте не будет.',
        orderHint: 'Меньше — левее в фильтре на сайте.',
        saved: 'Категория сохранена',
        deleteTitle: 'Удалить категорию?',
        deleteDescription: (name) => `«${name}» попадёт в корзину и пропадёт из фильтра на сайте.`,
        deleted: 'Категория в корзине',
      }}
    />
  )
}
