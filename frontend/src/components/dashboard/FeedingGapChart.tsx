import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import { baseLineOptions, formatDateTickRu, BR_CHART } from './chartConfig'
import { ChartCard } from '../br/ChartCard'
import { LegendRow } from '../br/LegendRow'

interface GapPoint {
  occurred_at: string
  date: string
  gap: number
}

const MOVING_AVG_WINDOW = 8
const LONG_GAP_THRESHOLD = 3.5

function computeGapPoints(entries: Entry[]): GapPoint[] {
  const feedings = entries
    .filter((e) => e.entry_type === 'feeding' && e.value != null && e.value > 0)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  const points: GapPoint[] = []

  for (let i = 1; i < feedings.length; i++) {
    const prev = new Date(feedings[i - 1].occurred_at).getTime()
    const curr = new Date(feedings[i].occurred_at).getTime()
    const hoursGap = (curr - prev) / (1000 * 60 * 60)

    if (hoursGap < 10 / 60) continue

    points.push({
      occurred_at: feedings[i].occurred_at,
      date: feedings[i].date,
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

interface FeedingGapChartProps {
  entries: Entry[]
}

export function FeedingGapChart({ entries }: FeedingGapChartProps) {
  const points = useMemo(() => computeGapPoints(entries), [entries])
  if (points.length < 2) return null

  const movingAvg = computeMovingAverage(points)

  const labels = buildDeduplicatedLabels(points)

  const pointColors = points.map((p) =>
    p.gap > LONG_GAP_THRESHOLD ? BR_CHART.blood : BR_CHART.cyan,
  )

  const chartData = {
    labels,
    datasets: [
      {
        label: 'ч',
        data: points.map((p) => p.gap),
        showLine: false,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: pointColors,
        pointBorderColor: BR_CHART.ink,
        pointBorderWidth: 1,
        datalabels: { display: false },
        order: 1,
      },
      {
        label: 'MA',
        data: movingAvg,
        pointRadius: 0,
        borderColor: BR_CHART.amber,
        borderDash: [4, 3],
        borderWidth: 1.5,
        tension: 0.2,
        fill: false,
        datalabels: { display: false },
        order: 0,
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
    <ChartCard
      kicker="SCATTER · INTERVAL"
      title="Feeding gaps"
      subtitle="интервал между кормлениями"
      footer={
        <LegendRow
          items={[
            { color: BR_CHART.cyan, label: `normal (<${LONG_GAP_THRESHOLD}ч)` },
            { color: BR_CHART.blood, label: 'long gap' },
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
