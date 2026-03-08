import { useState } from 'react'
import type { DashboardDay } from '../../types'
import { formatDateRu } from './utils'

interface FeedingChartProps {
  days: DashboardDay[]
}

export function FeedingChart({ days }: FeedingChartProps) {
  const [breakdown, setBreakdown] = useState(true)
  const count = days.length
  if (count === 0) return null

  const barWidth = 24
  const barGap = 16
  const step = barWidth + barGap
  const chartWidth = count * step - barGap
  const chartHeight = 140
  const topPad = breakdown ? 28 : 20
  const bottomPad = 30
  const totalHeight = topPad + chartHeight + bottomPad
  const totalWidth = Math.max(chartWidth, 7 * step - barGap)

  const maxVal = Math.max(...days.map((d) => d.feeding_total_ml), 1)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 overflow-x-auto">
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
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        height={200}
        preserveAspectRatio="xMinYEnd meet"
        style={{ minWidth: count > 8 ? `${count * step}px` : undefined }}
      >
        {days.map((day, i) => {
          const x = i * step
          const total = day.feeding_total_ml
          const formula = day.feeding_formula_ml
          const breast = day.feeding_breast_ml
          const totalH = (total / maxVal) * chartHeight
          const barY = topPad + chartHeight - totalH

          if (!breakdown) {
            return (
              <g key={day.date}>
                <rect
                  x={x}
                  y={barY}
                  width={barWidth}
                  height={totalH}
                  rx={3}
                  className="fill-blue-400"
                />
                {total > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={barY - 4}
                    textAnchor="middle"
                    className="fill-gray-500"
                    fontSize={9}
                  >
                    {Math.round(total)}
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
          }

          const formulaH = (formula / maxVal) * chartHeight
          const breastH = (breast / maxVal) * chartHeight
          const stackedY = topPad + chartHeight - formulaH - breastH

          return (
            <g key={day.date}>
              {breast > 0 && (
                <rect
                  x={x}
                  y={stackedY}
                  width={barWidth}
                  height={breastH}
                  rx={3}
                  className="fill-purple-400"
                />
              )}
              {formula > 0 && (
                <rect
                  x={x}
                  y={stackedY + breastH}
                  width={barWidth}
                  height={formulaH}
                  rx={3}
                  className="fill-blue-400"
                />
              )}
              {total > 0 && (
                <>
                  <text
                    x={x + barWidth / 2}
                    y={stackedY - 12}
                    textAnchor="middle"
                    className="fill-gray-500"
                    fontSize={9}
                  >
                    {Math.round(total)}
                  </text>
                  {breast > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={stackedY - 3}
                      textAnchor="middle"
                      className="fill-purple-400"
                      fontSize={7}
                    >
                      ({Math.round((breast / total) * 100)}%)
                    </text>
                  )}
                </>
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
