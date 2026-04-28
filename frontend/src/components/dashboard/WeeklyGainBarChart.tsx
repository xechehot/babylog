import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import { baseBarOptions, BR_CHART } from './chartConfig'
import { ChartCard } from '../br/ChartCard'

interface WeightPoint {
  ageDays: number
  weight: number // grams
}

interface WeeklyGainBarChartProps {
  entries: Entry[]
  birthDate: string | null
  birthWeight: number | null // grams
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function buildPoints(
  entries: Entry[],
  birthDate: string | null,
  birthWeight: number | null,
): { points: WeightPoint[]; anchorIsBirth: boolean } {
  const sorted = entries
    .filter((e) => e.value != null && e.value > 0)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())

  const birthTime = birthDate ? new Date(birthDate + 'T00:00:00').getTime() : null

  if (birthTime != null) {
    const points: WeightPoint[] = []
    if (birthWeight) points.push({ ageDays: 0, weight: birthWeight })
    for (const e of sorted) {
      const ageDays = (new Date(e.occurred_at).getTime() - birthTime) / MS_PER_DAY
      if (ageDays < 0) continue
      if (points.length > 0 && Math.abs(points[0].ageDays - ageDays) < 0.05) continue
      points.push({ ageDays, weight: e.value! })
    }
    return { points, anchorIsBirth: true }
  }

  if (sorted.length === 0) return { points: [], anchorIsBirth: false }
  const baseTime = new Date(sorted[0].occurred_at).getTime()
  const points = sorted.map((e) => ({
    ageDays: (new Date(e.occurred_at).getTime() - baseTime) / MS_PER_DAY,
    weight: e.value!,
  }))
  return { points, anchorIsBirth: false }
}

function interpolate(points: WeightPoint[], ageDays: number): number | null {
  if (points.length === 0) return null
  if (ageDays < points[0].ageDays - 0.01) return null
  if (ageDays > points[points.length - 1].ageDays + 0.01) return null
  if (ageDays <= points[0].ageDays) return points[0].weight
  if (ageDays >= points[points.length - 1].ageDays) return points[points.length - 1].weight
  for (let i = 0; i < points.length - 1; i++) {
    if (ageDays >= points[i].ageDays && ageDays <= points[i + 1].ageDays) {
      const span = points[i + 1].ageDays - points[i].ageDays
      if (span < 0.01) return points[i].weight
      const frac = (ageDays - points[i].ageDays) / span
      return points[i].weight * (1 - frac) + points[i + 1].weight * frac
    }
  }
  return null
}

interface WeekBar {
  weekNum: number
  fromDay: number
  toDay: number
  gain: number
}

function computeWeeklyGains(points: WeightPoint[]): WeekBar[] {
  if (points.length < 2) return []
  const minDay = points[0].ageDays
  const maxDay = points[points.length - 1].ageDays
  const startWeek = Math.floor(minDay / 7)
  const endWeek = Math.floor(maxDay / 7)

  const bars: WeekBar[] = []
  for (let w = startWeek; w < endWeek; w++) {
    const fromDay = w * 7
    const toDay = (w + 1) * 7
    const sampleFrom = Math.max(fromDay, minDay)
    const sampleTo = Math.min(toDay, maxDay)
    if (sampleTo - sampleFrom < 1) continue
    const w0 = interpolate(points, sampleFrom)
    const w1 = interpolate(points, sampleTo)
    if (w0 == null || w1 == null) continue
    bars.push({
      weekNum: w + 1,
      fromDay: sampleFrom,
      toDay: sampleTo,
      gain: Math.round(w1 - w0),
    })
  }
  return bars
}

export function WeeklyGainBarChart({ entries, birthDate, birthWeight }: WeeklyGainBarChartProps) {
  const { bars, anchorIsBirth } = useMemo(() => {
    const { points, anchorIsBirth } = buildPoints(entries, birthDate, birthWeight)
    return { bars: computeWeeklyGains(points), anchorIsBirth }
  }, [entries, birthDate, birthWeight])

  if (bars.length === 0) return null

  const chartData = {
    labels: bars.map((b) =>
      anchorIsBirth ? `Wk ${b.weekNum}` : `+${b.weekNum * 7 - 7}–${b.weekNum * 7}d`,
    ),
    datasets: [
      {
        data: bars.map((b) => b.gain),
        backgroundColor: `${BR_CHART.rose}2d`,
        borderColor: BR_CHART.rose,
        borderWidth: 1.5,
        borderRadius: 0,
        borderSkipped: false,
        datalabels: {
          display: true,
          anchor: 'end' as const,
          align: 'top' as const,
          color: BR_CHART.rose,
          font: { family: '"JetBrains Mono"', size: 9 },
          formatter: (v: number) => (v >= 0 ? `+${v}` : `${v}`),
        },
      },
    ],
  }

  const base = baseBarOptions()
  const options: ReturnType<typeof baseBarOptions> = {
    ...base,
    layout: { padding: { top: 18 } },
    plugins: {
      ...base.plugins,
      tooltip: {
        ...base.plugins!.tooltip,
        callbacks: {
          title: (items: TooltipItem<'bar'>[]) => {
            if (!items.length) return ''
            const bar = bars[items[0].dataIndex]
            return anchorIsBirth
              ? `Week ${bar.weekNum} (day ${Math.round(bar.fromDay)}–${Math.round(bar.toDay)})`
              : `Day ${Math.round(bar.fromDay)}–${Math.round(bar.toDay)}`
          },
          label: (ctx: TooltipItem<'bar'>) => {
            const v = Math.round(ctx.parsed.y ?? 0)
            return `${v >= 0 ? '+' : ''}${v} g`
          },
        },
      },
    },
  }

  return (
    <ChartCard
      kicker="BARS · WEEKLY GAIN"
      title="Weight gain by week"
      subtitle="grams gained · per week"
      accent={BR_CHART.rose}
    >
      <Bar data={chartData} options={options} />
    </ChartCard>
  )
}
