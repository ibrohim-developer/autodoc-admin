import { useDocuments } from '@/lib/content'

export const CATEGORY_TYPE = 'post_category'

/** News categories in their set order, as select options and an id → name map. */
export function useCategoryOptions() {
  const list = useDocuments(CATEGORY_TYPE, { pageSize: 100 })
  const options = (list.data?.items ?? []).map((item) => ({ value: item.id, label: item.title }))
  return { list, options, names: new Map(options.map((option) => [option.value, option.label])) }
}
