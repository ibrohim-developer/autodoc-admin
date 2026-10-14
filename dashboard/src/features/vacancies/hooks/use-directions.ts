import { useDocuments } from '@/lib/content'

export const DIRECTION_TYPE = 'vacancy_direction'

/** Vacancy directions in their set order, as select options and an id → name map. */
export function useDirectionOptions() {
  const list = useDocuments(DIRECTION_TYPE, { pageSize: 100 })
  const options = (list.data?.items ?? []).map((item) => ({ value: item.id, label: item.title }))
  return { list, options, names: new Map(options.map((option) => [option.value, option.label])) }
}
