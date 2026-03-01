import type { DashboardDay } from '../../types'
import { formatDateRu } from './utils'

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
  const count = days.length
  if (count === 0) return null

  const halfBar = 10
  const pairGap = 2
  const pairWidth = halfBar * 2 + pairGap
  const groupGap = 16
  const step = pairWidth + groupGap
  const chartWidth = count * step - groupGap
  const chartHeight = 140
  const topPad = 20
  const bottomPad = 30
  const totalHeight = topPad + chartHeight + bottomPad
  const totalWidth = Math.max(chartWidth, 7 * step - groupGap)

  const maxVal = Math.max(
    ...days.map((d) => Math.max(wetCount(d), dirtyCount(d))),
    1,
  )

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 overflow-x-auto">
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

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        height={200}
        preserveAspectRatio="xMinYEnd meet"
        style={{ minWidth: count > 8 ? `${count * step}px` : undefined }}
      >
        {days.map((day, i) => {
          const x = i * step
          const wet = wetCount(day)
          const dirty = dirtyCount(day)

          const wetH = (wet / maxVal) * chartHeight
          const dirtyH = (dirty / maxVal) * chartHeight
          const wetY = topPad + chartHeight - wetH
          const dirtyY = topPad + chartHeight - dirtyH

          return (
            <g key={day.date}>
              {/* Wet (pee) bar — left */}
              <rect
                x={x}
                y={wetY}
                width={halfBar}
                height={wetH}
                rx={2}
                className="fill-sky-400"
              />
              {wet > 0 && (
                <text
                  x={x + halfBar / 2}
                  y={wetY - 3}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize={8}
                >
                  {wet}
                </text>
              )}

              {/* Dirty (poo) bar — right */}
              <rect
                x={x + halfBar + pairGap}
                y={dirtyY}
                width={halfBar}
                height={dirtyH}
                rx={2}
                className="fill-amber-500"
              />
              {dirty > 0 && (
                <text
                  x={x + halfBar + pairGap + halfBar / 2}
                  y={dirtyY - 3}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize={8}
                >
                  {dirty}
                </text>
              )}

              {/* Date label */}
              <text
                x={x + pairWidth / 2}
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
