import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import { baseLineOptions, formatDateTickRu, BR_CHART } from './chartConfig'
import { ChartCard } from '../br/ChartCard'

interface WeightPoint {
  date: string
  occurred_at: string
  weight: number
}

function buildWeightPoints(entries: Entry[]): WeightPoint[] {
  return entries
    .filter((e) => e.value != null && e.value > 0)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    .map((e) => ({
      date: e.date,
      occurred_at: e.occurred_at,
      weight: e.value!,
    }))
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

interface WeightChartProps {
  entries: Entry[]
}

export function WeightChart({ entries }: WeightChartProps) {
  const points = useMemo(() => buildWeightPoints(entries), [entries])

  if (points.length < 2) return null

  const labels = buildDeduplicatedLabels(points)
  const weights = points.map((p) => p.weight)
  const firstWeight = weights[0]
  const pctChanges = weights.map((w) => ((w - firstWeight) / firstWeight) * 100)

  const absData = {
    labels,
    datasets: [
      {
        label: 'Вес (г)',
        data: weights,
        borderColor: BR_CHART.rose,
        backgroundColor: BR_CHART.roseFill,
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: BR_CHART.rose,
        pointBorderColor: BR_CHART.ink,
        pointBorderWidth: 1,
        tension: 0.25,
        fill: true,
        datalabels: { display: false },
      },
    ],
  }

  const absOptions = {
    ...baseLineOptions(),
    scales: {
      ...baseLineOptions().scales,
      y: {
        ...baseLineOptions().scales!.y,
        beginAtZero: false,
      },
    },
    plugins: {
      ...baseLineOptions().plugins,
      tooltip: {
        ...baseLineOptions().plugins!.tooltip,
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => `${Math.round(ctx.parsed.y ?? 0)} г`,
        },
      },
    },
  }

  const pctData = {
    labels,
    datasets: [
      {
        label: 'Изменение (%)',
        data: pctChanges,
        borderColor: BR_CHART.amber,
        backgroundColor: BR_CHART.amberFill,
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: BR_CHART.amber,
        pointBorderColor: BR_CHART.ink,
        pointBorderWidth: 1,
        tension: 0.25,
        fill: true,
        datalabels: { display: false },
      },
    ],
  }

  const pctOptions = {
    ...baseLineOptions(),
    scales: {
      ...baseLineOptions().scales,
      y: {
        ...baseLineOptions().scales!.y,
        beginAtZero: false,
      },
    },
    plugins: {
      ...baseLineOptions().plugins,
      tooltip: {
        ...baseLineOptions().plugins!.tooltip,
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => `${(ctx.parsed.y ?? 0).toFixed(2)}%`,
        },
      },
    },
  }

  return (
    <>
      <ChartCard
        kicker="LINE · ABSOLUTE"
        title="Mass"
        subtitle="граммы по дням"
        accent={BR_CHART.rose}
      >
        <Line data={absData} options={absOptions} />
      </ChartCard>
      <ChartCard kicker="LINE · DELTA" title="Change since first" subtitle="изменение (%)">
        <Line data={pctData} options={pctOptions} />
      </ChartCard>
    </>
  )
}
