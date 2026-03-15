import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { Link } from '@tanstack/react-router'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import type { BabySex } from '../../hooks/useProfile'
import { baseLineOptions } from './chartConfig'
import { WHO_BOYS, WHO_GIRLS, PERCENTILE_KEYS, PERCENTILE_LABELS } from './whoWeightData'
import { getAllVelocityIntervals, type VelocityInterval } from './whoVelocityData'

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
  'Рожд.', '1 мес', '2 мес', '3 мес', '4 мес', '5 мес', '6 мес',
  '7 мес', '8 мес', '9 мес', '10 мес', '11 мес', '12 мес',
  '13 мес', '14 мес', '15 мес', '16 мес', '17 мес', '18 мес',
  '19 мес', '20 мес', '21 мес', '22 мес', '23 мес', '24 мес',
]

const BAND_COLORS = {
  outer: 'rgba(251, 191, 36, 0.15)',
  inner: 'rgba(74, 222, 128, 0.15)',
}

const WHO_LINE_COLORS = {
  p3: 'rgba(239, 68, 68, 0.5)',
  p15: 'rgba(251, 191, 36, 0.6)',
  p50: 'rgba(107, 114, 128, 0.8)',
  p85: 'rgba(251, 191, 36, 0.6)',
  p97: 'rgba(239, 68, 68, 0.5)',
}

interface WeightChartProps {
  entries: Entry[]
  birthDate: string | null
  birthWeight: number | null // grams
  sex: BabySex | null
}

export function WeightChart({ entries, birthDate, birthWeight, sex }: WeightChartProps) {
  const points = useMemo(() => buildWeightPoints(entries, birthDate), [entries, birthDate])

  if (points.length < 2 && !birthWeight) return null

  if (!sex) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-gray-500 text-sm mb-2">
          Для отображения кривых роста ВОЗ укажите пол ребёнка
        </p>
        <Link
          to="/profile"
          className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Перейти в профиль
        </Link>
      </div>
    )
  }

  const whoData = sex === 'boy' ? WHO_BOYS : WHO_GIRLS

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

  if (allPoints.length < 2) return null

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
        label: 'Вес (г)',
        data: babyData,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(94, 234, 212, 0.5)',
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: '#14b8a6',
        tension: 0.2,
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
            if (ctx.dataset.label === 'Вес (г)') {
              return `${Math.round(val)} г (${(val / 1000).toFixed(2)} кг)`
            }
            return `${ctx.dataset.label}: ${(val / 1000).toFixed(1)} кг`
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
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <Line data={chartData} options={options} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 px-1">
          <span className="text-xs text-gray-500 font-medium">ВОЗ:</span>
          <span className="flex items-center gap-1 text-xs text-red-400">
            <span className="inline-block w-3 h-0.5 bg-red-400 opacity-60" />
            3-й / 97-й
          </span>
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <span className="inline-block w-3 h-0.5 bg-amber-400 opacity-70" />
            15-й / 85-й
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <span className="inline-block w-3 h-0.5 bg-gray-500" />
            50-й
          </span>
        </div>
      </div>

      {velocityPoints.length >= 1 && (
        <VelocityChart points={velocityPoints} intervals={velocityIntervals} />
      )}
    </div>
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
  const relevantIntervals = intervals.filter(
    (i) => i.toDay > minDay && i.fromDay < maxDay,
  )

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
        label: 'Набор (г/нед)',
        data: babyData,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(94, 234, 212, 0.5)',
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: '#14b8a6',
        tension: 0.2,
        fill: false,
        spanGaps: true,
        datalabels: { display: false },
        order: 0,
      },
      {
        label: 'WHO 5-й',
        data: whoStepData('p5'),
        borderColor: 'rgba(239, 68, 68, 0.5)',
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
        label: 'WHO 25-й',
        data: whoStepData('p25'),
        borderColor: 'rgba(251, 191, 36, 0.6)',
        borderWidth: 1,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        fill: { target: 1, above: 'rgba(251, 191, 36, 0.12)', below: 'rgba(251, 191, 36, 0.12)' },
        datalabels: { display: false },
        order: 2,
      },
      {
        label: 'WHO медиана',
        data: whoStepData('p50'),
        borderColor: 'rgba(107, 114, 128, 0.8)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        fill: { target: 2, above: 'rgba(74, 222, 128, 0.12)', below: 'rgba(74, 222, 128, 0.12)' },
        datalabels: { display: false },
        order: 2,
      },
    ],
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
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          color: '#9ca3af',
          maxRotation: 0,
          callback: function (value: string | number) {
            const d = Number(value)
            if (d === 0) return 'Рожд.'
            if (d <= 60) {
              if (d % 7 === 0) return `${d / 7} нед`
              return null
            }
            const months = Math.round(d / 30.4375)
            if (Math.abs(d - months * 30.4375) < 3) return `${months} мес`
            return null
          },
          stepSize: maxDay <= 60 ? 7 : 30,
        },
      },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: {
          font: { size: 10 },
          color: '#9ca3af',
        },
      },
    },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        enabled: true,
        filter: (item: TooltipItem<'line'>) => item.raw != null,
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            if (!items.length) return ''
            const d = items[0].parsed.x ?? 0
            if (d <= 60) return `День ${Math.round(d)} (${(d / 7).toFixed(1)} нед)`
            return `${Math.round(d / 30.4375)} мес`
          },
          label: (ctx: TooltipItem<'line'>) => {
            const val = ctx.parsed.y
            if (val == null) return ''
            if (ctx.dataset.label === 'Набор (г/нед)') {
              const px = ctx.parsed.x ?? 0
              const pt = points.find((p) => Math.abs(Math.round(p.ageDays) - px) < 2)
              if (pt) {
                const sign = pt.gainGrams >= 0 ? '+' : ''
                return `${Math.round(val)} г/нед (${sign}${pt.gainGrams} г за ${pt.days} дн.)`
              }
              return `${Math.round(val)} г/нед`
            }
            return `${ctx.dataset.label}: ${Math.round(val)} г/нед`
          },
        },
      },
    },
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-medium text-gray-500 mb-2">Набор веса (г/неделю)</p>
      <Line data={chartData} options={options} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 px-1">
        <span className="text-xs text-gray-500 font-medium">ВОЗ:</span>
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <span className="inline-block w-3 h-0.5 bg-gray-500" />
          медиана
        </span>
        <span className="flex items-center gap-1 text-xs text-amber-500">
          <span className="inline-block w-2 h-2 rounded-sm bg-amber-400 opacity-30" />
          25-й
        </span>
        <span className="flex items-center gap-1 text-xs text-red-400">
          <span className="inline-block w-3 h-0.5 bg-red-400 opacity-60" />
          5-й
        </span>
      </div>
    </div>
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
        'янв', 'фев', 'мар', 'апр', 'май', 'июн',
        'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
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
        label: 'Вес (г)',
        data: weights,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(94, 234, 212, 0.5)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#14b8a6',
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
      y: { ...baseLineOptions().scales!.y, beginAtZero: false },
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <Line data={absData} options={absOptions} />
    </div>
  )
}
