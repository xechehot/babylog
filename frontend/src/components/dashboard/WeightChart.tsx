import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { Link } from '@tanstack/react-router'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import type { BabySex } from '../../hooks/useProfile'
import { baseLineOptions, BR_CHART } from './chartConfig'
import { WHO_BOYS, WHO_GIRLS, PERCENTILE_KEYS, PERCENTILE_LABELS } from './whoWeightData'
import { getAllVelocityIntervals, type VelocityInterval } from './whoVelocityData'
import { ChartCard } from '../br/ChartCard'
import { LegendRow } from '../br/LegendRow'
import { BR } from '../br/theme'

interface WeightPoint {
  date: string
  occurred_at: string
  weight: number // grams
  ageMonths: number | null
  ageDays: number | null
}

function buildWeightPoints(entries: Entry[], birthDate: string | null): WeightPoint[] {
  const birthTime = birthDate ? new Date(birthDate + 'T00:00:00').getTime() : null
  const msPerDay = 1000 * 60 * 60 * 24
  return entries
    .filter((e) => e.value != null && e.value > 0)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    .map((e) => {
      const entryTime = new Date(e.occurred_at).getTime()
      const ageDays = birthTime != null ? (entryTime - birthTime) / msPerDay : null
      const ageMonths = ageDays != null ? ageDays / 30.4375 : null
      return {
        date: e.date,
        occurred_at: e.occurred_at,
        weight: e.value!,
        ageMonths,
        ageDays,
      }
    })
}

/** Interpolate WHO percentile value at a fractional month age */
function interpolateWHO(data: number[], ageMonths: number): number | null {
  if (ageMonths < 0 || ageMonths > 24) return null
  const lower = Math.floor(ageMonths)
  const upper = Math.ceil(ageMonths)
  if (lower === upper || upper >= data.length) return data[Math.min(lower, data.length - 1)]
  const frac = ageMonths - lower
  return data[lower] * (1 - frac) + data[upper] * frac
}

const MONTH_NAMES = [
  'Birth',
  '1 mo',
  '2 mo',
  '3 mo',
  '4 mo',
  '5 mo',
  '6 mo',
  '7 mo',
  '8 mo',
  '9 mo',
  '10 mo',
  '11 mo',
  '12 mo',
  '13 mo',
  '14 mo',
  '15 mo',
  '16 mo',
  '17 mo',
  '18 mo',
  '19 mo',
  '20 mo',
  '21 mo',
  '22 mo',
  '23 mo',
  '24 mo',
]

// Blade Runner WHO palette — outer band amber tint, inner band cyan tint.
const BAND_COLORS = {
  outer: 'rgba(255,179,71,0.10)',
  inner: 'rgba(100,240,232,0.10)',
}

const WHO_LINE_COLORS = {
  p3: 'rgba(255,77,77,0.55)',
  p15: 'rgba(255,179,71,0.60)',
  p50: 'rgba(240,225,200,0.80)',
  p85: 'rgba(255,179,71,0.60)',
  p97: 'rgba(255,77,77,0.55)',
}

interface WeightChartProps {
  entries: Entry[]
  birthDate: string | null
  birthWeight: number | null // grams
  sex: BabySex | null
}

export function WeightChart({ entries, birthDate, birthWeight, sex }: WeightChartProps) {
  const points = useMemo(() => buildWeightPoints(entries, birthDate), [entries, birthDate])

  const allPoints = useMemo(() => {
    if (!birthWeight || !birthDate) return points
    const birthEntry: WeightPoint = {
      date: birthDate,
      occurred_at: birthDate + 'T00:00:00',
      weight: birthWeight,
      ageMonths: 0,
      ageDays: 0,
    }
    if (points.length > 0 && points[0].ageMonths != null && points[0].ageMonths < 0.1) {
      return points
    }
    return [birthEntry, ...points]
  }, [points, birthWeight, birthDate])

  if (points.length < 2 && !birthWeight) return null

  if (!sex) {
    return (
      <div
        style={{
          border: `1px solid ${BR.line}`,
          background: 'linear-gradient(180deg, rgba(255,179,71,0.025), rgba(6,8,10,0.4))',
          padding: 24,
          textAlign: 'center',
          marginBottom: 14,
        }}
      >
        <div
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 8.5,
            letterSpacing: 2.5,
            color: BR.rose,
            textShadow: `0 0 8px ${BR.rose}55`,
            marginBottom: 8,
          }}
        >
          PROFILE · CONFIG REQUIRED
        </div>
        <p
          style={{
            fontFamily: BR.serif,
            fontStyle: 'italic',
            fontSize: 13,
            color: BR.body,
            marginBottom: 14,
          }}
        >
          Set the baby's sex to display WHO growth curves
        </p>
        <Link
          to="/profile"
          className="inline-block uppercase"
          style={{
            border: `1px solid ${BR.amber}`,
            color: BR.amber,
            fontFamily: BR.mono,
            letterSpacing: 2,
            fontSize: 11,
            padding: '10px 14px',
            background: 'rgba(255,179,71,0.12)',
            textShadow: `0 0 10px ${BR.amberGlow}`,
          }}
        >
          Go to profile
        </Link>
      </div>
    )
  }

  if (allPoints.length < 2) return null

  const whoData = sex === 'boy' ? WHO_BOYS : WHO_GIRLS

  const hasBirthData = birthDate != null && allPoints[0].ageMonths != null

  if (!hasBirthData) {
    return <SimpleWeightChart points={allPoints} />
  }

  // Build unified x-axis
  const minAge = Math.max(0, Math.floor(allPoints[0].ageMonths!))
  const maxAge = Math.min(24, Math.ceil(allPoints[allPoints.length - 1].ageMonths!))
  const allXValues = new Set<number>()
  for (let m = minAge; m <= maxAge; m++) allXValues.add(m)
  for (const p of allPoints) {
    if (p.ageMonths != null) allXValues.add(Math.round(p.ageMonths * 100) / 100)
  }
  const sortedX = Array.from(allXValues).sort((a, b) => a - b)

  const labels = sortedX.map((x) => {
    const rounded = Math.round(x)
    if (Math.abs(x - rounded) < 0.05 && rounded >= 0 && rounded <= 24) return MONTH_NAMES[rounded]
    return ''
  })

  // WHO weight-for-age curves with colored bands
  const whoLineColors = Object.values(WHO_LINE_COLORS)
  const whoInterpolated = PERCENTILE_KEYS.map((key, i) => ({
    label: `WHO ${PERCENTILE_LABELS[i]}`,
    data: sortedX.map((x) => interpolateWHO(whoData[key], x)! * 1000),
    borderColor: whoLineColors[i],
    borderWidth: key === 'p50' ? 2 : 1,
    borderDash: key === 'p50' ? [] : ([4, 3] as number[]),
    pointRadius: 0,
    pointHoverRadius: 0,
    tension: 0.3,
    fill: false as boolean | { target: number; above: string; below: string },
    datalabels: { display: false },
    order: 1,
  }))

  if (whoInterpolated.length >= 5) {
    whoInterpolated[1].fill = { target: 1, above: BAND_COLORS.outer, below: BAND_COLORS.outer }
    whoInterpolated[2].fill = { target: 2, above: BAND_COLORS.inner, below: BAND_COLORS.inner }
    whoInterpolated[3].fill = { target: 3, above: BAND_COLORS.inner, below: BAND_COLORS.inner }
    whoInterpolated[4].fill = { target: 4, above: BAND_COLORS.outer, below: BAND_COLORS.outer }
  }

  const babyData = sortedX.map((x) => {
    const match = allPoints.find((p) => p.ageMonths != null && Math.abs(p.ageMonths - x) < 0.05)
    return match ? match.weight : null
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Weight (g)',
        data: babyData,
        borderColor: BR_CHART.amber,
        backgroundColor: BR_CHART.amber,
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: BR_CHART.amber,
        pointBorderColor: BR_CHART.ink,
        pointBorderWidth: 1,
        tension: 0.25,
        fill: false,
        spanGaps: true,
        datalabels: { display: false },
        order: 0,
      },
      ...whoInterpolated,
    ],
  }

  const options = {
    ...baseLineOptions(),
    scales: {
      ...baseLineOptions().scales,
      x: {
        ...baseLineOptions().scales!.x,
        ticks: {
          ...((baseLineOptions().scales!.x as Record<string, unknown>)?.ticks as object),
          callback: function (_value: unknown, index: number) {
            return labels[index] || null
          },
        },
      },
      y: { ...baseLineOptions().scales!.y, beginAtZero: false },
    },
    plugins: {
      ...baseLineOptions().plugins,
      tooltip: {
        ...baseLineOptions().plugins!.tooltip,
        filter: (item: TooltipItem<'line'>) => item.raw != null,
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            const val = ctx.parsed.y
            if (val == null) return ''
            if (ctx.dataset.label === 'Weight (g)') {
              return `${Math.round(val)} g (${(val / 1000).toFixed(2)} kg)`
            }
            return `${ctx.dataset.label}: ${(val / 1000).toFixed(1)} kg`
          },
        },
      },
    },
  }

  // Aggregate baby weight gain into WHO-matching intervals
  // For each interval, interpolate baby weight at start/end and compute gain → g/week
  const velocityPoints: {
    ageDays: number // midpoint of interval
    gPerDay: number // g/day rate
    gainGrams: number // total grams gained in interval
    days: number // interval length
  }[] = []

  /** Interpolate baby weight at a given age in days */
  function interpolateBabyWeight(ageDays: number): number | null {
    // Find surrounding points
    const pts = allPoints.filter((p) => p.ageDays != null) as (WeightPoint & { ageDays: number })[]
    if (pts.length === 0) return null
    if (ageDays <= pts[0].ageDays) return pts[0].weight
    if (ageDays >= pts[pts.length - 1].ageDays) return pts[pts.length - 1].weight
    for (let i = 0; i < pts.length - 1; i++) {
      if (ageDays >= pts[i].ageDays && ageDays <= pts[i + 1].ageDays) {
        const span = pts[i + 1].ageDays - pts[i].ageDays
        if (span < 0.01) return pts[i].weight
        const frac = (ageDays - pts[i].ageDays) / span
        return pts[i].weight * (1 - frac) + pts[i + 1].weight * frac
      }
    }
    return null
  }

  const velocityIntervals = getAllVelocityIntervals(sex, birthWeight)

  // Compute baby's gain for each WHO interval that overlaps with baby data range
  const babyMinDay = allPoints[0].ageDays ?? 0
  const babyMaxDay = allPoints[allPoints.length - 1].ageDays ?? 0
  for (const interval of velocityIntervals) {
    // Skip intervals completely outside baby data range
    if (interval.toDay <= babyMinDay || interval.fromDay >= babyMaxDay) continue
    // Clamp interval to baby data range
    const from = Math.max(interval.fromDay, babyMinDay)
    const to = Math.min(interval.toDay, babyMaxDay)
    const span = to - from
    if (span < 1) continue // need at least 1 day of overlap
    const w0 = interpolateBabyWeight(from)
    const w1 = interpolateBabyWeight(to)
    if (w0 == null || w1 == null) continue
    const gainGrams = w1 - w0
    const gPerDay = gainGrams / span
    velocityPoints.push({
      ageDays: (from + to) / 2,
      gPerDay: Math.round(gPerDay * 10) / 10,
      gainGrams: Math.round(gainGrams),
      days: Math.round(span),
    })
  }

  return (
    <>
      <ChartCard
        kicker="LINE · WHO BANDS"
        title="Weight vs WHO"
        subtitle="kg · against WHO percentile curves"
        accent={BR_CHART.rose}
        footer={
          <LegendRow
            items={[
              { color: BR_CHART.amber, label: 'baby' },
              { color: 'rgba(240,225,200,0.80)', line: true, label: 'WHO · 50th' },
              { color: 'rgba(255,179,71,0.60)', line: true, label: '15 / 85' },
              { color: 'rgba(255,77,77,0.55)', line: true, label: '3 / 97' },
            ]}
          />
        }
      >
        <Line data={chartData} options={options} />
      </ChartCard>

      {velocityPoints.length >= 1 && (
        <VelocityChart points={velocityPoints} intervals={velocityIntervals} />
      )}
    </>
  )
}

/** Chart showing weight gain (g/week) with WHO velocity norms */
function VelocityChart({
  points,
  intervals,
}: {
  points: { ageDays: number; gPerDay: number; gainGrams: number; days: number }[]
  intervals: VelocityInterval[]
}) {
  // Determine x-axis range from baby data
  const minDay = Math.max(0, Math.floor(points[0].ageDays) - 3)
  const maxDay = Math.ceil(points[points.length - 1].ageDays) + 3

  // Build WHO norm step data as {x,y} points for linear x-axis
  // Each interval becomes two points (start and end) at the same y value
  const relevantIntervals = intervals.filter((i) => i.toDay > minDay && i.fromDay < maxDay)

  function whoStepData(key: 'p5' | 'p25' | 'p50') {
    const pts: { x: number; y: number }[] = []
    for (const interval of relevantIntervals) {
      const x0 = Math.max(interval.fromDay, minDay)
      const x1 = Math.min(interval.toDay, maxDay)
      pts.push({ x: x0, y: interval[key] * 7 }) // g/day → g/week
      pts.push({ x: x1, y: interval[key] * 7 })
    }
    return pts
  }

  // Baby data as {x,y} points — normalized to g/week
  const babyData = points.map((p) => ({
    x: Math.round(p.ageDays),
    y: Math.round(p.gPerDay * 7 * 10) / 10,
  }))

  const chartData = {
    datasets: [
      {
        label: 'Gain (g/wk)',
        data: babyData,
        borderColor: BR_CHART.amber,
        backgroundColor: BR_CHART.amber,
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: BR_CHART.amber,
        pointBorderColor: BR_CHART.ink,
        pointBorderWidth: 1,
        tension: 0.25,
        fill: false,
        spanGaps: true,
        datalabels: { display: false },
        order: 0,
      },
      {
        label: 'WHO 5th',
        data: whoStepData('p5'),
        borderColor: 'rgba(255,77,77,0.55)',
        borderWidth: 1,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        fill: false,
        datalabels: { display: false },
        order: 2,
      },
      {
        label: 'WHO 25th',
        data: whoStepData('p25'),
        borderColor: 'rgba(255,179,71,0.60)',
        borderWidth: 1,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        fill: { target: 1, above: 'rgba(255,179,71,0.10)', below: 'rgba(255,179,71,0.10)' },
        datalabels: { display: false },
        order: 2,
      },
      {
        label: 'WHO median',
        data: whoStepData('p50'),
        borderColor: 'rgba(240,225,200,0.80)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        fill: { target: 2, above: 'rgba(100,240,232,0.10)', below: 'rgba(100,240,232,0.10)' },
        datalabels: { display: false },
        order: 2,
      },
    ],
  }

  const TICK_FONT = {
    family: '"JetBrains Mono", ui-monospace, monospace',
    size: 10,
  }

  const options: Parameters<typeof Line>[0]['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.8,
    events: ['mousemove', 'mouseenter', 'touchstart', 'touchmove'],
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      x: {
        type: 'linear' as const,
        min: minDay,
        max: maxDay,
        grid: { display: false, color: BR_CHART.grid },
        border: { color: BR_CHART.gridStrong, display: true },
        ticks: {
          font: TICK_FONT,
          color: BR_CHART.dim,
          maxRotation: 0,
          callback: function (value: string | number) {
            const d = Number(value)
            if (d === 0) return 'Birth'
            if (d <= 60) {
              if (d % 7 === 0) return `${d / 7} wk`
              return null
            }
            const months = Math.round(d / 30.4375)
            if (Math.abs(d - months * 30.4375) < 3) return `${months} mo`
            return null
          },
          stepSize: maxDay <= 60 ? 7 : 30,
        },
      },
      y: {
        grid: { color: BR_CHART.grid },
        border: { color: BR_CHART.gridStrong, display: false },
        ticks: {
          font: TICK_FONT,
          color: BR_CHART.dim,
        },
      },
    },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(6,8,10,0.92)',
        borderColor: BR_CHART.amberA,
        borderWidth: 1,
        titleFont: { ...TICK_FONT, weight: 500 },
        titleColor: BR_CHART.amber,
        bodyFont: { ...TICK_FONT, size: 11 },
        bodyColor: BR_CHART.body,
        padding: 10,
        cornerRadius: 0,
        displayColors: false,
        filter: (item: TooltipItem<'line'>) => item.raw != null,
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            if (!items.length) return ''
            const d = items[0].parsed.x ?? 0
            if (d <= 60) return `Day ${Math.round(d)} (${(d / 7).toFixed(1)} wk)`
            return `${Math.round(d / 30.4375)} mo`
          },
          label: (ctx: TooltipItem<'line'>) => {
            const val = ctx.parsed.y
            if (val == null) return ''
            if (ctx.dataset.label === 'Gain (g/wk)') {
              const px = ctx.parsed.x ?? 0
              const pt = points.find((p) => Math.abs(Math.round(p.ageDays) - px) < 2)
              if (pt) {
                const sign = pt.gainGrams >= 0 ? '+' : ''
                return `${Math.round(val)} g/wk (${sign}${pt.gainGrams} g over ${pt.days} days)`
              }
              return `${Math.round(val)} g/wk`
            }
            return `${ctx.dataset.label}: ${Math.round(val)} g/wk`
          },
        },
      },
    },
  }

  return (
    <ChartCard
      kicker="LINE · VELOCITY"
      title="Weight gain"
      subtitle="g per week"
      accent={BR_CHART.amber}
      footer={
        <LegendRow
          items={[
            { color: BR_CHART.amber, label: 'baby' },
            { color: 'rgba(240,225,200,0.80)', line: true, label: 'WHO · 50th' },
            { color: 'rgba(255,179,71,0.60)', line: true, label: 'WHO · 25' },
            { color: 'rgba(255,77,77,0.55)', line: true, label: 'WHO · 5' },
          ]}
        />
      }
    >
      <Line data={chartData} options={options} />
    </ChartCard>
  )
}

/** Simple chart without WHO curves (when birth date is not available) */
function SimpleWeightChart({ points }: { points: WeightPoint[] }) {
  let lastDate = ''
  const labels = points.map((p) => {
    if (p.date !== lastDate) {
      lastDate = p.date
      const d = new Date(p.date + 'T00:00:00')
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]
      return `${d.getDate()} ${months[d.getMonth()]}`
    }
    return ''
  })

  const weights = points.map((p) => p.weight)

  const absData = {
    labels,
    datasets: [
      {
        label: 'Weight (g)',
        data: weights,
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

  const absOptions = {
    ...baseLineOptions(),
    scales: {
      ...baseLineOptions().scales,
      y: { ...baseLineOptions().scales!.y, beginAtZero: false },
    },
    plugins: {
      ...baseLineOptions().plugins,
      tooltip: {
        ...baseLineOptions().plugins!.tooltip,
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => `${Math.round(ctx.parsed.y ?? 0)} g`,
        },
      },
    },
  }

  return (
    <ChartCard kicker="LINE · MASS" title="Weight" subtitle="grams" accent={BR_CHART.rose}>
      <Line data={absData} options={absOptions} />
    </ChartCard>
  )
}
