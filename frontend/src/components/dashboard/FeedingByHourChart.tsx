import { useState } from 'react'
import type { Entry } from '../../types'

type Filter = 'all' | 'formula' | 'breast'

interface FeedingByHourChartProps {
  entries: Entry[]
}

export function FeedingByHourChart({ entries }: FeedingByHourChartProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered =
    filter === 'all' ? entries : entries.filter((e) => e.subtype === filter)

  const counts = new Array(24).fill(0)
  for (const e of filtered) {
    const hour = new Date(e.occurred_at).getHours()
    counts[hour]++
  }

  const maxVal = Math.max(...counts, 1)

  const barWidth = 12
  const barGap = 4
  const step = barWidth + barGap
  const chartWidth = 24 * step - barGap
  const chartHeight = 120
  const topPad = 20
  const bottomPad = 20
  const totalHeight = topPad + chartHeight + bottomPad

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
      <svg viewBox={`0 0 ${chartWidth} ${totalHeight}`} className="w-full">
        {counts.map((count, hour) => {
          const x = hour * step
          const barH = (count / maxVal) * chartHeight
          const barY = topPad + chartHeight - barH
          const color = filter === 'breast' ? 'fill-purple-400' : 'fill-blue-400'

          return (
            <g key={hour}>
              <rect
                x={x}
                y={barY}
                width={barWidth}
                height={barH}
                rx={2}
                className={color}
              />
              {count > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={barY - 3}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize={7}
                >
                  {count}
                </text>
              )}
              {hour % 3 === 0 && (
                <text
                  x={x + barWidth / 2}
                  y={topPad + chartHeight + 12}
                  textAnchor="middle"
                  className="fill-gray-400"
                  fontSize={7}
                >
                  {hour}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
