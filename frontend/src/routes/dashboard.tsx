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
import { getDateRange, getTodayStr, formatDateRu } from '../components/dashboard/utils'

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
  const todayStr = getTodayStr()
  const todayData = days.find((d) => d.date === todayStr) ?? null

  return (
    <div className="p-4 space-y-4">
      <PeriodSelector period={period} onChange={setPeriod} />

      {isLoading && <p className="text-gray-400 text-center py-8">Загрузка...</p>}
      {isError && (
        <p className="text-red-500 text-center text-sm">{(error as Error).message}</p>
      )}

      {data && (
        <>
          <WeightCard weight={data.latest_weight} />
          <AllTimeTotals totals={data.all_time_totals} />

          <section>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Кормление (мл/день)
            </h2>
            {days.length > 0 ? <FeedingChart days={days} /> : <EmptyState />}
          </section>

          {feedingData && feedingData.entries.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-2">
                Скорость кормления (мл/ч)
              </h2>
              <FeedingSpeedChart entries={feedingData.entries} />
            </section>
          )}

          {feedingData && feedingData.entries.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-2">
                Интервал кормления (ч)
              </h2>
              <FeedingGapChart entries={feedingData.entries} />
            </section>
          )}

          {feedingData && feedingData.entries.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-2">
                Интервал грудного вскармливания (ч)
              </h2>
              <BreastGapChart entries={feedingData.entries} />
            </section>
          )}

          <section>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Подгузники (шт/день)
            </h2>
            {days.length > 0 ? <DiaperChart days={days} /> : <EmptyState />}
          </section>

          {diaperData && diaperData.entries.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-2">
                Интервал пописов/покаков (ч)
              </h2>
              <DiaperGapChart entries={diaperData.entries} />
            </section>
          )}

          <TodaySummary data={todayData} />
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

function WeightCard({
  weight,
}: {
  weight: DashboardResponse['latest_weight']
}) {
  if (!weight) return null

  const kg = (weight.value / 1000).toFixed(2).replace(/\.?0+$/, '')
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">Последний вес</p>
      <p className="text-2xl font-bold mt-1">{kg} кг</p>
      <p className="text-xs text-gray-400 mt-1">{formatDateRu(weight.date)}</p>
    </div>
  )
}

function TodaySummary({ data }: { data: DashboardDay | null }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Сегодня</p>
      {data ? (
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-bold">{data.feeding_count}</p>
            <p className="text-xs text-gray-500">кормлений</p>
            <p className="text-xs text-gray-400">{Math.round(data.feeding_total_ml)} мл</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {data.diaper_pee_count + data.diaper_pee_poo_count}
            </p>
            <p className="text-xs text-gray-500">пописал</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {data.diaper_poo_count + data.diaper_pee_poo_count}
            </p>
            <p className="text-xs text-gray-500">покакал</p>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center">Нет данных</p>
      )}
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
