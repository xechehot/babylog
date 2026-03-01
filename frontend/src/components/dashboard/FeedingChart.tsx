import type { DashboardDay } from '../../types'
import { formatDateRu } from './utils'

interface FeedingChartProps {
  days: DashboardDay[]
}

export function FeedingChart({ days }: FeedingChartProps) {
  const count = days.length
  if (count === 0) return null

  const barWidth = 24
  const barGap = 16
  const step = barWidth + barGap
  const chartWidth = count * step - barGap
  const chartHeight = 140
  const topPad = 20
  const bottomPad = 30
  const totalHeight = topPad + chartHeight + bottomPad
  const totalWidth = Math.max(chartWidth, 7 * step - barGap)

  const maxVal = Math.max(...days.map((d) => d.feeding_total_ml), 1)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        height={200}
        preserveAspectRatio="xMinYEnd meet"
        style={{ minWidth: count > 8 ? `${count * step}px` : undefined }}
      >
        {days.map((day, i) => {
          const x = i * step
          const val = day.feeding_total_ml
          const barH = (val / maxVal) * chartHeight
          const barY = topPad + chartHeight - barH

          return (
            <g key={day.date}>
              <rect
                x={x}
                y={barY}
                width={barWidth}
                height={barH}
                rx={3}
                className="fill-blue-400"
              />
              {val > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={barY - 4}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize={9}
                >
                  {Math.round(val)}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={topPad + chartHeight + 14}
                textAnchor="middle"
                className="fill-gray-400"
                fontSize={8}
              >
                {formatDateRu(day.date)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
