import { NamedListPage } from '@/components/content/named-list-page'
import { DIRECTION_TYPE } from '../hooks/use-directions'

export function VacancyDirectionsPage() {
  return (
    <NamedListPage
      type={DIRECTION_TYPE}
      back={{ path: '/vacancies', label: 'Вакансии' }}
      writePermission="vacancies.write"
      texts={{
        title: 'Направления вакансий',
        description:
          'Зелёная плашка на карточке вакансии: Разработка, Продажи, HR… Направление, выбранное в вакансиях, удалить нельзя.',
        createLabel: 'Новое направление',
        itemLabel: 'Направление',
        empty: 'Направлений пока нет. Добавьте хотя бы одно — без него вакансию не сохранить.',
        orderHint: 'Порядок в списках выбора.',
        saved: 'Направление сохранено',
        deleteTitle: 'Удалить направление?',
        deleteDescription: (name) => `«${name}» попадёт в корзину.`,
        deleted: 'Направление в корзине',
      }}
    />
  )
}
