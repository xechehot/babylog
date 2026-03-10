import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { DashboardDay } from '../../types'
import { baseBarOptions, formatDateTickRu, COLORS } from './chartConfig'

interface DiaperChartProps {
  days: DashboardDay[]
}

function wetCount(day: DashboardDay): number {
  return day.diaper_pee_count + day.diaper_pee_poo_count
}

function dirtyCount(day: DashboardDay): number {
  return day.diaper_poo_count + day.diaper_pee_poo_count
}

export function DiaperChart({ days }: DiaperChartProps) {
  if (days.length === 0) return null

  const { chartData, options } = useMemo(() => {
    const data = {
      labels: days.map((d) => formatDateTickRu(d.date)),
      datasets: [
        {
          label: 'Мокрые',
          data: days.map(wetCount),
          backgroundColor: COLORS.sky400,
          borderRadius: 2,
          datalabels: {
            display: (ctx: { dataIndex: number }) => wetCount(days[ctx.dataIndex]) > 0,
            anchor: 'end' as const,
            align: 'top' as const,
            color: '#6b7280',
            font: { size: 9 },
          },
        },
        {
          label: 'Грязные',
          data: days.map(dirtyCount),
          backgroundColor: COLORS.amber500,
          borderRadius: 2,
          datalabels: {
            display: (ctx: { dataIndex: number }) => dirtyCount(days[ctx.dataIndex]) > 0,
            anchor: 'end' as const,
            align: 'top' as const,
            color: '#6b7280',
            font: { size: 9 },
          },
        },
      ],
    }

    const opts = {
      ...baseBarOptions(),
      layout: { padding: { top: 16 } },
    }

    return { chartData: data, options: opts }
  }, [days])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex gap-4 mb-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-sky-400" />
          Мокрые
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-500" />
          Грязные
        </span>
      </div>
      <Bar data={chartData} options={options} />
    </div>
  )
}
