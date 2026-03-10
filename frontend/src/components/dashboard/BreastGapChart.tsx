import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import { baseLineOptions, formatDateTickRu, COLORS } from './chartConfig'

interface GapPoint {
  occurred_at: string
  date: string
  gap: number
}

const MOVING_AVG_WINDOW = 8

function computeGapPoints(entries: Entry[]): GapPoint[] {
  const breast = entries
    .filter((e) => e.entry_type === 'feeding' && e.subtype === 'breast')
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  const points: GapPoint[] = []

  for (let i = 1; i < breast.length; i++) {
    const prev = new Date(breast[i - 1].occurred_at).getTime()
    const curr = new Date(breast[i].occurred_at).getTime()
    const hoursGap = (curr - prev) / (1000 * 60 * 60)

    if (hoursGap < 10 / 60) continue

    points.push({
      occurred_at: breast[i].occurred_at,
      date: breast[i].date,
      gap: hoursGap,
    })
  }

  return points
}

function computeMovingAverage(points: GapPoint[]): number[] {
  return points.map((_, i) => {
    const start = Math.max(0, i - MOVING_AVG_WINDOW + 1)
    const window = points.slice(start, i + 1)
    return window.reduce((sum, p) => sum + p.gap, 0) / window.length
  })
}

interface BreastGapChartProps {
  entries: Entry[]
}

export function BreastGapChart({ entries }: BreastGapChartProps) {
  const points = useMemo(() => computeGapPoints(entries), [entries])
  if (points.length < 2) return null

  const movingAvg = computeMovingAverage(points)

  const labels = buildDeduplicatedLabels(points)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'ч',
        data: points.map((p) => p.gap),
        showLine: false,
        pointRadius: 3,
        pointBackgroundColor: COLORS.pink300alpha,
        pointBorderColor: 'transparent',
        datalabels: { display: false },
      },
      {
        label: 'MA',
        data: movingAvg,
        pointRadius: 0,
        borderColor: COLORS.pink600,
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
            return ctx.datasetIndex === 0 ? `${v} ч` : `MA: ${v} ч`
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

function buildDeduplicatedLabels(points: { date: string }[]): string[] {
  let lastDate = ''
  return points.map((p) => {
    if (p.date !== lastDate) {
      lastDate = p.date
      return formatDateTickRu(p.date)
    }
    return ''
  })
}
