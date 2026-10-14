import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCan } from '@/lib/session'
import type { PeriodQuery } from '../api/stats-api'
import { ContentTab } from '../components/content-tab'
import { OverviewTab } from '../components/overview-tab'
import { VacanciesTab } from '../components/vacancies-tab'

const RANGES = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
  { days: 365, label: 'Год' },
] as const

const tashkentDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' })

/** The last `days` days in Tashkent, today included. */
function lastDays(days: number, now = new Date()): PeriodQuery {
  const to = tashkentDay.format(now)
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  return { from, to }
}

/** Each tab has its own permission: HR sees only "Вакансии". */
export function StatsPage() {
  const tabs = [
    { value: 'overview', label: 'Общая', allowed: useCan('stats.general') },
    { value: 'content', label: 'Новости', allowed: useCan('stats.content') },
    { value: 'vacancies', label: 'Вакансии', allowed: useCan('stats.vacancies') },
  ].filter((tab) => tab.allowed)
  const [days, setDays] = useState<number>(30)
  const [tab, setTab] = useState(tabs[0]?.value ?? 'vacancies')
  const period = lastDays(days)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Статистика</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Собственная статистика сайта: без cookies, IP-адреса не хранятся. Боты не учитываются.
          </p>
        </div>
        <fieldset className="flex gap-1" aria-label="Период">
          {RANGES.map((range) => (
            <Button
              key={range.days}
              size="sm"
              variant={days === range.days ? 'default' : 'outline'}
              aria-pressed={days === range.days}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </Button>
          ))}
        </fieldset>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {tabs.length > 1 ? (
          <TabsList>
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}
        {tabs.some((item) => item.value === 'overview') ? (
          <TabsContent value="overview">
            <OverviewTab period={period} />
          </TabsContent>
        ) : null}
        {tabs.some((item) => item.value === 'content') ? (
          <TabsContent value="content">
            <ContentTab period={period} />
          </TabsContent>
        ) : null}
        {tabs.some((item) => item.value === 'vacancies') ? (
          <TabsContent value="vacancies">
            <VacanciesTab period={period} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
