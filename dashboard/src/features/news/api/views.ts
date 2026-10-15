import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '@/lib/api-client'

const viewsSchema = z.object({ views: z.record(z.string(), z.number()) })

/** Page views per post (the site's own statistics): id → views; a post nobody opened is absent. */
export function usePostViews(ids: string[], enabled: boolean) {
  const sorted = [...ids].sort()
  return useQuery({
    queryKey: ['stats', 'views', sorted] as const,
    queryFn: () =>
      request('admin/stats/views', {
        schema: viewsSchema,
        searchParams: { ids: sorted.join(',') },
      }),
    enabled: enabled && sorted.length > 0,
    placeholderData: keepPreviousData,
    select: (data) => data.views,
  })
}
