import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import { baseLineOptions, formatDateTickRu, COLORS } from './chartConfig'

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
        borderColor: COLORS.teal600,
        backgroundColor: COLORS.teal300alpha,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: COLORS.teal500,
        tension: 0.2,
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
        borderColor: COLORS.teal600,
        backgroundColor: COLORS.teal300alpha,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: COLORS.teal500,
        tension: 0.2,
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
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <Line data={absData} options={absOptions} />
      </div>
      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Изменение веса (%)</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <Line data={pctData} options={pctOptions} />
        </div>
      </section>
    </>
  )
}
