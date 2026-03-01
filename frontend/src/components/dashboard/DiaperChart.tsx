import type { DashboardDay } from '../../types'
import { formatDateRu } from './utils'

interface DiaperChartProps {
  days: DashboardDay[]
}

const SEGMENTS = [
  { key: 'diaper_pee_count' as const, color: 'fill-sky-400', label: 'пис' },
  { key: 'diaper_pee_poo_count' as const, color: 'fill-violet-400', label: 'оба' },
  { key: 'diaper_poo_count' as const, color: 'fill-amber-500', label: 'как' },
]

function dayTotal(day: DashboardDay): number {
  return (
    day.diaper_pee_count +
    day.diaper_poo_count +
    day.diaper_pee_poo_count +
    day.diaper_dry_count
  )
}

export function DiaperChart({ days }: DiaperChartProps) {
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

  const maxVal = Math.max(...days.map(dayTotal), 1)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 overflow-x-auto">
      <div className="flex gap-3 mb-2 text-xs text-gray-500">
        {SEGMENTS.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1">
            <span
              className={`w-2.5 h-2.5 rounded-sm ${seg.color.replace('fill-', 'bg-')}`}
            />
            {seg.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        height={200}
        preserveAspectRatio="xMinYEnd meet"
        style={{ minWidth: count > 8 ? `${count * step}px` : undefined }}
      >
        {days.map((day, i) => {
          const x = i * step
          const total = dayTotal(day)
          let yOffset = topPad + chartHeight

          return (
            <g key={day.date}>
              {SEGMENTS.map((seg) => {
                const val = day[seg.key]
                if (val === 0) return null
                const segH = (val / maxVal) * chartHeight
                yOffset -= segH
                return (
                  <rect
                    key={seg.key}
                    x={x}
                    y={yOffset}
                    width={barWidth}
                    height={segH}
                    rx={3}
                    className={seg.color}
                  />
                )
              })}
              {total > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={topPad + chartHeight - (total / maxVal) * chartHeight - 4}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize={9}
                >
                  {total}
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
