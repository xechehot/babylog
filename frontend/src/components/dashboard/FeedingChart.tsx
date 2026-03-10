import { useState, useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { DashboardDay } from '../../types'
import { baseBarOptions, formatDateTickRu, COLORS } from './chartConfig'

interface FeedingChartProps {
  days: DashboardDay[]
}

export function FeedingChart({ days }: FeedingChartProps) {
  const [breakdown, setBreakdown] = useState(true)

  const count = days.length
  if (count === 0) return null

  const chartData = useMemo(() => {
    const labels = days.map((d) => formatDateTickRu(d.date))

    if (!breakdown) {
      return {
        labels,
        datasets: [
          {
            label: 'Всего',
            data: days.map((d) => d.feeding_total_ml),
            backgroundColor: COLORS.blue400,
            borderRadius: 3,
            datalabels: {
              display: (ctx: { dataIndex: number }) => days[ctx.dataIndex].feeding_total_ml > 0,
              anchor: 'end' as const,
              align: 'top' as const,
              color: '#6b7280',
              font: { size: 10 },
              formatter: (v: number) => Math.round(v).toString(),
            },
          },
        ],
      }
    }

    return {
      labels,
      datasets: [
        {
          label: 'грудь',
          data: days.map((d) => d.feeding_breast_ml),
          backgroundColor: COLORS.purple400,
          borderRadius: 3,
          datalabels: { display: false },
        },
        {
          label: 'смесь',
          data: days.map((d) => d.feeding_formula_ml),
          backgroundColor: COLORS.blue400,
          borderRadius: 3,
          datalabels: {
            display: (ctx: { dataIndex: number }) => days[ctx.dataIndex].feeding_total_ml > 0,
            anchor: 'end' as const,
            align: 'top' as const,
            color: '#6b7280',
            font: { size: 10 },
            formatter: (_v: number, ctx: { dataIndex: number }) =>
              Math.round(days[ctx.dataIndex].feeding_total_ml).toString(),
          },
        },
      ],
    }
  }, [days, breakdown])

  const options = useMemo(() => {
    const opts = baseBarOptions()
    opts.layout = { padding: { top: 20 } }
    opts.scales = {
      ...opts.scales,
      x: {
        ...opts.scales!.x,
        stacked: breakdown,
      },
      y: {
        ...opts.scales!.y,
        stacked: breakdown,
      },
    }
    if (breakdown) {
      opts.plugins = {
        ...opts.plugins,
        tooltip: {
          ...opts.plugins!.tooltip,
          callbacks: {
            afterBody: (items: { dataIndex: number }[]) => {
              const idx = items[0]?.dataIndex
              if (idx == null) return ''
              const day = days[idx]
              if (day.feeding_breast_ml > 0) {
                const pct = Math.round((day.feeding_breast_ml / day.feeding_total_ml) * 100)
                return `грудь: ${pct}%`
              }
              return ''
            },
          },
        },
      }
    }
    return opts
  }, [days, breakdown])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-1 ml-1">
        {breakdown ? (
          <div className="flex gap-3">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-400" />
              смесь
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-purple-400" />
              грудь
            </span>
          </div>
        ) : (
          <div />
        )}
        <button
          onClick={() => setBreakdown((v) => !v)}
          className={`text-xs px-2 py-0.5 rounded-full border ${
            breakdown
              ? 'bg-blue-50 border-blue-300 text-blue-600'
              : 'bg-gray-50 border-gray-300 text-gray-500'
          }`}
        >
          разбивка
        </button>
      </div>
      <Bar data={chartData} options={options} />
    </div>
  )
}
