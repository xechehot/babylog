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

  // Calculate velocity points (g/day) between consecutive measurements
  const velocityPoints: {
    ageDays: number
    gPerDay: number
    date: string
    gainGrams: number
    days: number
  }[] = []
  const msPerDay = 1000 * 60 * 60 * 24
  for (let i = 1; i < allPoints.length; i++) {
    const prev = allPoints[i - 1]
    const curr = allPoints[i]
    if (prev.ageDays == null || curr.ageDays == null) continue
    const days =
      (new Date(curr.occurred_at).getTime() - new Date(prev.occurred_at).getTime()) / msPerDay
    if (days < 0.5) continue
    const gainGrams = curr.weight - prev.weight
    const gPerDay = gainGrams / days
    const midAgeDays = (prev.ageDays + curr.ageDays) / 2
    velocityPoints.push({
      ageDays: midAgeDays,
      gPerDay: Math.round(gPerDay * 10) / 10,
      date: curr.date,
      gainGrams: Math.round(gainGrams),
      days: Math.round(days),
    })
  }

  const velocityIntervals = getAllVelocityIntervals(sex, birthWeight)

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

/** Chart showing daily weight gain (g/day) with WHO velocity norms */
function VelocityChart({
  points,
  intervals,
}: {
  points: { ageDays: number; gPerDay: number; date: string; gainGrams: number; days: number }[]
  intervals: VelocityInterval[]
}) {
  // Build x-axis in days, with interval boundaries + baby data points
  const allX = new Set<number>()
  for (const interval of intervals) {
    // Only add interval boundaries that are within the range of baby data
    const minDay = Math.max(0, points[0].ageDays - 5)
    const maxDay = points[points.length - 1].ageDays + 5
    if (interval.fromDay >= minDay && interval.fromDay <= maxDay) allX.add(interval.fromDay)
    if (interval.toDay >= minDay && interval.toDay <= maxDay) allX.add(interval.toDay)
  }
  for (const p of points) allX.add(Math.round(p.ageDays))
  const sortedX = Array.from(allX).sort((a, b) => a - b)

  // Labels: show weeks for first 60 days, months after
  const labels = sortedX.map((d) => {
    if (d === 0) return 'Рожд.'
    if (d <= 60) {
      const weeks = Math.round(d / 7)
      if (Math.abs(d - weeks * 7) < 2) return `${weeks} нед`
      return ''
    }
    const months = Math.round(d / 30.4375)
    if (Math.abs(d - months * 30.4375) < 5) return `${months} мес`
    return ''
  })

  // Baby velocity at correct x positions
  const babyVelocity = sortedX.map((x) => {
    const match = points.find((p) => Math.abs(p.ageDays - x) < 2)
    return match ? match.gPerDay : null
  })

  // WHO velocity norm curves (stepped, using interval midpoints)
  const whoP5 = sortedX.map((x) => {
    const interval = intervals.find((i) => x >= i.fromDay && x < i.toDay)
    return interval ? interval.p5 : null
  })
  const whoP25 = sortedX.map((x) => {
    const interval = intervals.find((i) => x >= i.fromDay && x < i.toDay)
    return interval ? interval.p25 : null
  })
  const whoP50 = sortedX.map((x) => {
    const interval = intervals.find((i) => x >= i.fromDay && x < i.toDay)
    return interval ? interval.p50 : null
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Набор (г/день)',
        data: babyVelocity,
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
      // P5 line (danger threshold)
      {
        label: 'WHO 5-й',
        data: whoP5,
        borderColor: 'rgba(239, 68, 68, 0.5)',
        borderWidth: 1,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        fill: false,
        stepped: 'middle' as const,
        datalabels: { display: false },
        order: 2,
      },
      // P25 line (watch threshold) — fill band to P5
      {
        label: 'WHO 25-й',
        data: whoP25,
        borderColor: 'rgba(251, 191, 36, 0.6)',
        borderWidth: 1,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        fill: { target: 1, above: 'rgba(251, 191, 36, 0.12)', below: 'rgba(251, 191, 36, 0.12)' },
        stepped: 'middle' as const,
        datalabels: { display: false },
        order: 2,
      },
      // P50 line (median) — fill band to P25
      {
        label: 'WHO медиана',
        data: whoP50,
        borderColor: 'rgba(107, 114, 128, 0.8)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        fill: { target: 2, above: 'rgba(74, 222, 128, 0.12)', below: 'rgba(74, 222, 128, 0.12)' },
        stepped: 'middle' as const,
        datalabels: { display: false },
        order: 2,
      },
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
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
      y: {
        ...baseLineOptions().scales!.y,
        beginAtZero: false,
        ticks: {
          font: { size: 10 },
          color: '#9ca3af',
          callback: function (value: string | number) {
            return `${value}`
          },
        },
      },
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
            if (ctx.dataset.label === 'Набор (г/день)') {
              const pt = points.find((p) => Math.abs(p.gPerDay - val) < 0.15)
              if (pt) {
                const sign = pt.gainGrams >= 0 ? '+' : ''
                return `${val.toFixed(1)} г/день (${sign}${pt.gainGrams} г за ${pt.days} дн.)`
              }
              return `${val.toFixed(1)} г/день`
            }
            return `${ctx.dataset.label}: ${val} г/день`
          },
        },
      },
    },
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-medium text-gray-500 mb-2">Набор веса (г/день)</p>
      <Line data={chartData} options={options as Parameters<typeof Line>[0]['options']} />
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
