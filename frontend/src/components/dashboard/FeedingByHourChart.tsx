import { useState, useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { Entry } from '../../types'
import { baseBarOptions, COLORS } from './chartConfig'

type Filter = 'all' | 'formula' | 'breast'

interface FeedingByHourChartProps {
  entries: Entry[]
}

export function FeedingByHourChart({ entries }: FeedingByHourChartProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const { chartData, options } = useMemo(() => {
    const filtered =
      filter === 'all' ? entries : entries.filter((e) => e.subtype === filter)

    const counts = new Array(24).fill(0) as number[]
    for (const e of filtered) {
      const hour = new Date(e.occurred_at).getHours()
      counts[hour]++
    }

    const color = filter === 'breast' ? COLORS.purple400 : COLORS.blue400

    const data = {
      labels: Array.from({ length: 24 }, (_, i) => i.toString()),
      datasets: [
        {
          data: counts,
          backgroundColor: color,
          borderRadius: 2,
          datalabels: {
            display: (ctx: { dataIndex: number }) => counts[ctx.dataIndex] > 0,
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
      layout: { padding: { top: 12 } },
    }
    opts.scales = {
      ...opts.scales,
      x: {
        ...opts.scales!.x,
        ticks: {
          ...opts.scales!.x!.ticks,
          callback: function (_value: string | number, index: number) {
            return index % 3 === 0 ? index.toString() : ''
          },
        },
      },
    }

    return { chartData: data, options: opts }
  }, [entries, filter])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-end gap-1 mb-1">
        {(['all', 'formula', 'breast'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2 py-0.5 rounded-full border ${
              filter === f
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-gray-50 border-gray-300 text-gray-500'
            }`}
          >
            {f === 'all' ? 'все' : f === 'formula' ? 'смесь' : 'грудь'}
          </button>
        ))}
      </div>
      <Bar data={chartData} options={options} />
    </div>
  )
}
