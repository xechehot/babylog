import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import { mergeCloseFeedings } from './utils'
import { baseLineOptions, formatDateTickRu, COLORS } from './chartConfig'

interface SpeedPoint {
  occurred_at: string
  date: string
  speed: number
}

const MOVING_AVG_WINDOW = 8

function computeSpeedPoints(entries: Entry[]): SpeedPoint[] {
  const feedings = mergeCloseFeedings(entries)
  const points: SpeedPoint[] = []

  for (let i = 1; i < feedings.length; i++) {
    const prev = new Date(feedings[i - 1].occurred_at).getTime()
    const curr = new Date(feedings[i].occurred_at).getTime()
    const hoursGap = (curr - prev) / (1000 * 60 * 60)

    const speed = feedings[i].value / hoursGap
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
  const points = useMemo(() => computeSpeedPoints(entries), [entries])
  if (points.length < 2) return null

  const movingAvg = computeMovingAverage(points)

  const labels = buildDeduplicatedLabels(points)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'мл/ч',
        data: points.map((p) => p.speed),
        showLine: false,
        pointRadius: 3,
        pointBackgroundColor: COLORS.blue300alpha,
        pointBorderColor: 'transparent',
        datalabels: { display: false },
      },
      {
        label: 'MA',
        data: movingAvg,
        pointRadius: 0,
        borderColor: COLORS.blue600,
        borderWidth: 2,
        tension: 0.2,
        datalabels: { display: false },
      },
    ],
  }

  const options = {
    ...baseLineOptions(),
    plugins: {
      ...baseLineOptions().plugins,
      tooltip: {
        ...baseLineOptions().plugins!.tooltip,
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            const v = (ctx.parsed.y ?? 0).toFixed(1)
            return ctx.datasetIndex === 0 ? `${v} мл/ч` : `MA: ${v} мл/ч`
          },
        },
      },
    },
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <Line data={chartData} options={options} />
    </div>
  )
}

function buildDeduplicatedLabels(
  points: { date: string }[],
): string[] {
  let lastDate = ''
  return points.map((p) => {
    if (p.date !== lastDate) {
      lastDate = p.date
      return formatDateTickRu(p.date)
    }
    return ''
  })
}
