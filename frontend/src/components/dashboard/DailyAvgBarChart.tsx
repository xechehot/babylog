import { formatDateRu } from './utils'

interface DailyValue {
  date: string
  value: number
}

interface DailyAvgBarChartProps {
  data: DailyValue[]
  color: string
  formatValue?: (v: number) => string
}

export function DailyAvgBarChart({
  data,
  color,
  formatValue = (v) => v.toFixed(1),
}: DailyAvgBarChartProps) {
  const count = data.length
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

  const maxVal = Math.max(...data.map((d) => d.value), 0.1)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        height={200}
        preserveAspectRatio="xMinYEnd meet"
        style={{ minWidth: count > 8 ? `${count * step}px` : undefined }}
      >
        {data.map((d, i) => {
          const x = i * step
          const barH = (d.value / maxVal) * chartHeight
          const barY = topPad + chartHeight - barH

          return (
            <g key={d.date}>
              <rect
                x={x}
                y={barY}
                width={barWidth}
                height={barH}
                rx={3}
                className={color}
              />
              {d.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={barY - 4}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize={9}
                >
                  {formatValue(d.value)}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={topPad + chartHeight + 14}
                textAnchor="middle"
                className="fill-gray-400"
                fontSize={8}
              >
                {formatDateRu(d.date)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
