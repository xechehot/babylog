import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { AllTimeTotals as AllTimeTotalsData, DashboardDay, DashboardResponse, Entry } from '../types'
import { FeedingChart } from '../components/dashboard/FeedingChart'
import { FeedingSpeedChart } from '../components/dashboard/FeedingSpeedChart'
import { FeedingGapChart } from '../components/dashboard/FeedingGapChart'
import { DiaperChart } from '../components/dashboard/DiaperChart'
import { BreastGapChart } from '../components/dashboard/BreastGapChart'
import { DiaperGapChart } from '../components/dashboard/DiaperGapChart'
import { DailyAvgBarChart } from '../components/dashboard/DailyAvgBarChart'
import {
  computeDailyAvgFeedingInterval,
  computeDailyAvgBreastInterval,
  computeDailyAvgDiaperInterval,
  computeDailyAvgFeedingSpeed,
} from '../components/dashboard/dailyAggregates'
import { getDateRange, formatDateRu } from '../components/dashboard/utils'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

type Period = 7 | 14 | 30
const PERIODS: Period[] = [7, 14, 30]

function DashboardPage() {
  const [period, setPeriod] = useState<Period>(7)
  const { from_date, to_date } = getDateRange(period)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', { from_date, to_date }],
    queryFn: () =>
      api.get<DashboardResponse>(
        `/api/dashboard?from_date=${from_date}&to_date=${to_date}`,
      ),
  })

  const { data: feedingData } = useQuery({
    queryKey: ['entries', { type: 'feeding', from_date, to_date }],
    queryFn: () =>
      api.get<{ entries: Entry[] }>(
        `/api/entries?type=feeding&from_date=${from_date}&to_date=${to_date}`,
      ),
  })

  const { data: diaperData } = useQuery({
    queryKey: ['entries', { type: 'diaper', from_date, to_date }],
    queryFn: () =>
      api.get<{ entries: Entry[] }>(
        `/api/entries?type=diaper&from_date=${from_date}&to_date=${to_date}`,
      ),
  })

  const days = data?.days ?? []
  const yesterdayStr = getRelativeDateStr(-1)
  const dayBeforeStr = getRelativeDateStr(-2)
  const yesterdayData = days.find((d) => d.date === yesterdayStr) ?? null
  const dayBeforeData = days.find((d) => d.date === dayBeforeStr) ?? null
  const yesterdayFeedings = (feedingData?.entries ?? []).filter((e) => e.date === yesterdayStr)
  const yesterdayDiapers = (diaperData?.entries ?? []).filter(
    (e) => e.date === yesterdayStr && e.subtype !== 'dry',
  )

  return (
    <div className="p-4 space-y-4">
      <PeriodSelector period={period} onChange={setPeriod} />

      {isLoading && <p className="text-gray-400 text-center py-8">Загрузка...</p>}
      {isError && (
        <p className="text-red-500 text-center text-sm">{(error as Error).message}</p>
      )}

      {data && (
        <>
          <YesterdaySummary
            yesterday={yesterdayData}
            dayBefore={dayBeforeData}
            feedingEntries={yesterdayFeedings}
            diaperEntries={yesterdayDiapers}
            latestWeight={data.latest_weight}
            previousWeight={data.previous_weight}
          />
          <AllTimeTotals totals={data.all_time_totals} />

          <section>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Кормление (мл/день)
            </h2>
            {days.length > 0 ? <FeedingChart days={days} /> : <EmptyState />}
          </section>

          {feedingData && feedingData.entries.length > 0 && (
            <>
              {computeDailyAvgFeedingSpeed(feedingData.entries).length > 0 && (
                <section>
                  <h2 className="text-sm font-medium text-gray-500 mb-2">
                    Среднее потребление (мл/ч по дням)
                  </h2>
                  <DailyAvgBarChart
                    data={computeDailyAvgFeedingSpeed(feedingData.entries)}
                    color="fill-blue-400"
                    formatValue={(v) => Math.round(v).toString()}
                  />
                </section>
              )}

              {computeDailyAvgFeedingInterval(feedingData.entries).length > 0 && (
                <section>
                  <h2 className="text-sm font-medium text-gray-500 mb-2">
                    Средний интервал кормления (ч/день)
                  </h2>
                  <DailyAvgBarChart
                    data={computeDailyAvgFeedingInterval(feedingData.entries)}
                    color="fill-amber-400"
                  />
                </section>
              )}

              <section>
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  Скорость кормления (мл/ч)
                </h2>
                <FeedingSpeedChart entries={feedingData.entries} />
              </section>

              <section>
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  Интервал кормления (ч)
                </h2>
                <FeedingGapChart entries={feedingData.entries} />
              </section>

              {computeDailyAvgBreastInterval(feedingData.entries).length > 0 && (
                <section>
                  <h2 className="text-sm font-medium text-gray-500 mb-2">
                    Средний интервал грудного вскармливания (ч/день)
                  </h2>
                  <DailyAvgBarChart
                    data={computeDailyAvgBreastInterval(feedingData.entries)}
                    color="fill-pink-400"
                  />
                </section>
              )}

              <section>
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  Интервал грудного вскармливания (ч)
                </h2>
                <BreastGapChart entries={feedingData.entries} />
              </section>
            </>
          )}

          <section>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Подгузники (шт/день)
            </h2>
            {days.length > 0 ? <DiaperChart days={days} /> : <EmptyState />}
          </section>

          {diaperData && diaperData.entries.length > 0 && (
            <>
              {computeDailyAvgDiaperInterval(diaperData.entries).length > 0 && (
                <section>
                  <h2 className="text-sm font-medium text-gray-500 mb-2">
                    Средний интервал подгузников (ч/день)
                  </h2>
                  <DailyAvgBarChart
                    data={computeDailyAvgDiaperInterval(diaperData.entries)}
                    color="fill-green-400"
                  />
                </section>
              )}

              <section>
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  Интервал пописов/покаков (ч)
                </h2>
                <DiaperGapChart entries={diaperData.entries} />
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

function PeriodSelector({
  period,
  onChange,
}: {
  period: Period
  onChange: (p: Period) => void
}) {
  return (
    <div className="flex gap-2">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
            period === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {p} дн.
        </button>
      ))}
    </div>
  )
}

function getRelativeDateStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function computeAvgInterval(entries: Entry[]): number | null {
  if (entries.length < 2) return null
  const sorted = [...entries].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  )
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const hours =
      (new Date(sorted[i].occurred_at).getTime() - new Date(sorted[i - 1].occurred_at).getTime()) /
      (1000 * 60 * 60)
    if (hours >= 10 / 60) gaps.push(hours)
  }
  if (gaps.length === 0) return null
  return gaps.reduce((s, g) => s + g, 0) / gaps.length
}

function pctChange(curr: number, prev: number): string | null {
  if (prev === 0) return null
  const pct = Math.round(((curr - prev) / prev) * 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
}

function PctBadge({ value }: { value: string | null }) {
  if (!value) return null
  const isPositive = value.startsWith('+')
  return (
    <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
      {value}
    </span>
  )
}

function YesterdaySummary({
  yesterday,
  dayBefore,
  feedingEntries,
  diaperEntries,
  latestWeight,
  previousWeight,
}: {
  yesterday: DashboardDay | null
  dayBefore: DashboardDay | null
  feedingEntries: Entry[]
  diaperEntries: Entry[]
  latestWeight: DashboardResponse['latest_weight']
  previousWeight: DashboardResponse['previous_weight']
}) {
  const weightKg = latestWeight
    ? (latestWeight.value / 1000).toFixed(2).replace(/\.?0+$/, '')
    : null
  const weightDiffG =
    latestWeight && previousWeight ? Math.round(latestWeight.value - previousWeight.value) : null
  const weightDiffPct =
    latestWeight && previousWeight ? pctChange(latestWeight.value, previousWeight.value) : null
  const weightDiffStr =
    weightDiffG != null ? (weightDiffG >= 0 ? `+${weightDiffG} г` : `${weightDiffG} г`) : null

  if (!yesterday && !latestWeight) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Вчера</p>
        <p className="text-gray-400 text-sm text-center">Нет данных</p>
      </div>
    )
  }

  const diaperTotal = yesterday
    ? yesterday.diaper_pee_count + yesterday.diaper_poo_count + yesterday.diaper_pee_poo_count
    : 0
  const diaperTotalPrev = dayBefore
    ? dayBefore.diaper_pee_count + dayBefore.diaper_poo_count + dayBefore.diaper_pee_poo_count
    : 0

  const breastCount = feedingEntries.filter((e) => e.subtype === 'breast').length
  const formulaCount = feedingEntries.filter((e) => e.subtype === 'formula').length

  const feedingWithMl = feedingEntries.filter((e) => e.value != null && e.value > 0)
  const avgFeedingInterval = computeAvgInterval(feedingWithMl)
  const avgDiaperInterval = computeAvgInterval(diaperEntries)
  const velocity = yesterday ? yesterday.feeding_total_ml / 24 : 0

  const mlPct = dayBefore && yesterday ? pctChange(yesterday.feeding_total_ml, dayBefore.feeding_total_ml) : null
  const diaperPct = dayBefore ? pctChange(diaperTotal, diaperTotalPrev) : null

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Вчера</p>

      <div className="space-y-3">
        {yesterday && (
          <>
            {/* Feedings */}
            <div>
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">{yesterday.feeding_count}</span>
                  <span className="text-sm text-gray-600">кормлений</span>
                  <span className="text-sm text-gray-400">{Math.round(yesterday.feeding_total_ml)} мл</span>
                </div>
                <PctBadge value={mlPct} />
              </div>
              <div className="flex gap-3 ml-4 text-sm text-gray-500">
                <span>грудное {breastCount}</span>
                <span>смесь {formulaCount}</span>
              </div>
            </div>

            {/* Diapers */}
            <div>
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">{diaperTotal}</span>
                  <span className="text-sm text-gray-600">подгузников</span>
                </div>
                <PctBadge value={diaperPct} />
              </div>
              <div className="flex gap-3 ml-4 text-sm text-gray-500">
                <span>пописал {yesterday.diaper_pee_count + yesterday.diaper_pee_poo_count}</span>
                <span>покакал {yesterday.diaper_poo_count + yesterday.diaper_pee_poo_count}</span>
              </div>
            </div>

            {/* Intervals & velocity */}
            <div className="pt-2 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">
                  {avgFeedingInterval != null ? avgFeedingInterval.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-gray-500">инт. корм. (ч)</p>
              </div>
              <div>
                <p className="text-lg font-bold">
                  {avgDiaperInterval != null ? avgDiaperInterval.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-gray-500">инт. подг. (ч)</p>
              </div>
              <div>
                <p className="text-lg font-bold">{velocity > 0 ? velocity.toFixed(1) : '—'}</p>
                <p className="text-xs text-gray-500">мл/ч</p>
              </div>
            </div>
          </>
        )}

        {!yesterday && (
          <p className="text-gray-400 text-sm text-center">Нет данных за вчера</p>
        )}

        {/* Weight */}
        {latestWeight && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold">{weightKg} кг</span>
                <span className="text-xs text-gray-400">{formatDateRu(latestWeight.date)}</span>
              </div>
              <div className="flex items-baseline gap-1">
                {weightDiffStr && <span className="text-xs text-gray-500">{weightDiffStr}</span>}
                <PctBadge value={weightDiffPct} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>
}

function nextBeautifulNumber(n: number): number {
  const candidates: number[] = []
  // Round numbers: 50, 100, 200, ..., 900, 1000, 2000, ...
  candidates.push(50)
  for (let base = 100; base <= 100000; base *= 10) {
    for (let mult = 1; mult <= 9; mult++) {
      candidates.push(base * mult)
    }
  }
  // Repeating digits: 111, 222, ..., 999, 1111, 2222, ..., 9999, ...
  for (let digits = 3; digits <= 5; digits++) {
    const unit = Number('1'.repeat(digits))
    for (let mult = 1; mult <= 9; mult++) {
      candidates.push(unit * mult)
    }
  }
  candidates.sort((a, b) => a - b)
  return candidates.find((c) => c > n) ?? candidates[candidates.length - 1]
}

const THRESHOLD = 3

function AllTimeTotals({ totals }: { totals: AllTimeTotalsData | null }) {
  if (!totals) return null

  const stats: { label: string; value: number; sub?: string }[] = [
    { label: 'Подгузники', value: totals.diaper_total },
    { label: 'пописал', value: totals.diaper_pee, sub: 'sub' },
    { label: 'покакал', value: totals.diaper_poo, sub: 'sub' },
    { label: 'Грудное', value: totals.feeding_breast },
    { label: 'Смесь', value: totals.feeding_formula },
  ]

  const hints: string[] = []
  for (const s of stats) {
    const next = nextBeautifulNumber(s.value)
    const remaining = next - s.value
    if (remaining <= THRESHOLD) {
      hints.push(`до ${next} ${s.label.toLowerCase()}: ${remaining === 0 ? 'сейчас!' : remaining}`)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
        Всего за всё время
      </p>

      <div className="space-y-2">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold">{totals.diaper_total}</span>
            <span className="text-sm text-gray-600">подгузников</span>
          </div>
          <div className="flex gap-4 ml-4 text-sm text-gray-500">
            <span>пописал {totals.diaper_pee}</span>
            <span>покакал {totals.diaper_poo}</span>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold">{totals.feeding_breast}</span>
            <span className="text-sm text-gray-600">грудное</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold">{totals.feeding_formula}</span>
            <span className="text-sm text-gray-600">смесь</span>
          </div>
        </div>
      </div>

      {hints.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          {hints.map((hint) => (
            <p key={hint} className="text-xs text-amber-600 font-medium">
              {hint}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
