import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { DashboardDay, DashboardResponse, Entry } from '../types'
import { FeedingChart } from '../components/dashboard/FeedingChart'
import { FeedingSpeedChart } from '../components/dashboard/FeedingSpeedChart'
import { DiaperChart } from '../components/dashboard/DiaperChart'
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

          <section>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Подгузники (шт/день)
            </h2>
            {days.length > 0 ? <DiaperChart days={days} /> : <EmptyState />}
          </section>

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
