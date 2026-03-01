import type { Entry } from '../../types'
import { formatDateRu } from './utils'

interface SpeedPoint {
  occurred_at: string
  date: string
  speed: number // ml/h
}

const MOVING_AVG_WINDOW = 8

function computeSpeedPoints(entries: Entry[]): SpeedPoint[] {
  // Filter to feedings with a positive value, sorted by time
  const feedings = entries
    .filter((e) => e.entry_type === 'feeding' && e.value != null && e.value > 0)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  const points: SpeedPoint[] = []

  for (let i = 1; i < feedings.length; i++) {
    const prev = new Date(feedings[i - 1].occurred_at).getTime()
    const curr = new Date(feedings[i].occurred_at).getTime()
    const hoursGap = (curr - prev) / (1000 * 60 * 60)

    // Skip if gap is too short (< 10 min) — likely data entry issue
    if (hoursGap < 10 / 60) continue

    const speed = feedings[i].value! / hoursGap
    points.push({
      occurred_at: feedings[i].occurred_at,
      date: feedings[i].date,
      speed,
    })
  }

  return points
}

function computeMovingAverage(points: SpeedPoint[]): number[] {
  return points.map((_, i) => {
    const start = Math.max(0, i - MOVING_AVG_WINDOW + 1)
    const window = points.slice(start, i + 1)
    return window.reduce((sum, p) => sum + p.speed, 0) / window.length
  })
}

interface FeedingSpeedChartProps {
  entries: Entry[]
}

export function FeedingSpeedChart({ entries }: FeedingSpeedChartProps) {
  const points = computeSpeedPoints(entries)
  if (points.length < 2) return null

  const movingAvg = computeMovingAverage(points)

  const maxSpeed = Math.max(...points.map((p) => p.speed), ...movingAvg)
  const yMax = Math.ceil(maxSpeed / 10) * 10 || 10

  // Layout
  const leftPad = 32
  const rightPad = 8
  const topPad = 12
  const chartHeight = 140
  const bottomPad = 30
  const totalHeight = topPad + chartHeight + bottomPad

  const pointGap = 20
  const chartWidth = (points.length - 1) * pointGap
  const totalWidth = leftPad + chartWidth + rightPad
  const minPixelWidth = points.length > 15 ? points.length * pointGap : undefined

  const x = (i: number) => leftPad + i * pointGap
  const y = (val: number) => topPad + chartHeight - (val / yMax) * chartHeight

  // Y-axis ticks
  const yTickCount = 4
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) =>
    Math.round((yMax / yTickCount) * i),
  )

  // Date labels — show one per unique date
  const dateLabels: { x: number; label: string }[] = []
  let lastDate = ''
  for (let i = 0; i < points.length; i++) {
    if (points[i].date !== lastDate) {
      lastDate = points[i].date
      dateLabels.push({ x: x(i), label: formatDateRu(points[i].date) })
    }
  }

  // Build moving average polyline
  const maPath = movingAvg.map((val, i) => `${x(i)},${y(val)}`).join(' ')

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        height={200}
        preserveAspectRatio="xMinYEnd meet"
        style={{ minWidth: minPixelWidth ? `${minPixelWidth}px` : undefined }}
      >
        {/* Y-axis grid lines and labels */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={leftPad}
              x2={totalWidth - rightPad}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />
            <text
              x={leftPad - 4}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-gray-400"
              fontSize={7}
            >
              {tick}
            </text>
          </g>
        ))}

        {/* Individual speed dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.speed)}
            r={2}
            className="fill-blue-300"
            opacity={0.5}
          />
        ))}

        {/* Moving average line */}
        <polyline
          points={maPath}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Date labels */}
        {dateLabels.map(({ x: dx, label }) => (
          <text
            key={dx}
            x={dx}
            y={topPad + chartHeight + 14}
            textAnchor="middle"
            className="fill-gray-400"
            fontSize={8}
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}
