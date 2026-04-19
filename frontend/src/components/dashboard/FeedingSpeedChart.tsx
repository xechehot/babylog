import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import { mergeCloseFeedings } from './utils'
import { baseLineOptions, formatDateTickRu, BR_CHART } from './chartConfig'
import { ChartCard } from '../br/ChartCard'
import { LegendRow } from '../br/LegendRow'

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
        pointRadius: 3.5,
        pointBackgroundColor: BR_CHART.cyan,
        pointBorderColor: BR_CHART.ink,
        pointBorderWidth: 1,
        datalabels: { display: false },
      },
      {
        label: 'MA',
        data: movingAvg,
        pointRadius: 0,
        borderColor: BR_CHART.amber,
        borderWidth: 2,
        borderDash: [4, 3],
        tension: 0.2,
        fill: false,
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
    <ChartCard
      kicker="LINE · VELOCITY"
      title="Intake velocity"
      subtitle="мл в час"
      footer={
        <LegendRow
          items={[
            { color: BR_CHART.cyan, label: 'per feed' },
            { color: BR_CHART.amber, line: true, label: 'moving avg' },
          ]}
        />
      }
    >
      <Line data={chartData} options={options} />
    </ChartCard>
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
