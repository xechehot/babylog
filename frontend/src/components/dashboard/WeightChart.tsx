import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { Link } from '@tanstack/react-router'
import type { TooltipItem } from 'chart.js'
import type { Entry } from '../../types'
import type { BabySex } from '../../hooks/useProfile'
import { baseLineOptions } from './chartConfig'
import { WHO_BOYS, WHO_GIRLS, PERCENTILE_KEYS, PERCENTILE_LABELS } from './whoWeightData'

interface WeightPoint {
  date: string
  occurred_at: string
  weight: number // grams
  ageMonths: number | null // age in fractional months from birth
}

function buildWeightPoints(entries: Entry[], birthDate: string | null): WeightPoint[] {
  const birthTime = birthDate ? new Date(birthDate + 'T00:00:00').getTime() : null
  return entries
    .filter((e) => e.value != null && e.value > 0)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    .map((e) => {
      const entryTime = new Date(e.occurred_at).getTime()
      const ageMonths =
        birthTime != null ? (entryTime - birthTime) / (1000 * 60 * 60 * 24 * 30.4375) : null
      return {
        date: e.date,
        occurred_at: e.occurred_at,
        weight: e.value!,
        ageMonths,
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

interface WeightChartProps {
  entries: Entry[]
  birthDate: string | null
  birthWeight: number | null // grams
  sex: BabySex | null
}

export function WeightChart({ entries, birthDate, birthWeight, sex }: WeightChartProps) {
  const points = useMemo(() => buildWeightPoints(entries, birthDate), [entries, birthDate])

  if (points.length < 2 && !birthWeight) return null

  // If sex not set, show invitation
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

  // Build full points array: include birth weight as first point if available
  const allPoints = useMemo(() => {
    if (!birthWeight || !birthDate) return points
    const birthEntry: WeightPoint = {
      date: birthDate,
      occurred_at: birthDate + 'T00:00:00',
      weight: birthWeight,
      ageMonths: 0,
    }
    // Avoid duplicate if first point is already at birth
    if (points.length > 0 && points[0].ageMonths != null && points[0].ageMonths < 0.1) {
      return points
    }
    return [birthEntry, ...points]
  }, [points, birthWeight, birthDate])

  if (allPoints.length < 2) return null

  const hasBirthData = birthDate != null && allPoints[0].ageMonths != null

  if (!hasBirthData) {
    // Without birth date, show simple weight chart (no WHO curves)
    return <SimpleWeightChart points={allPoints} />
  }

  // Build a unified x-axis (in months) with WHO month marks + baby data points
  const minAge = Math.max(0, Math.floor(allPoints[0].ageMonths!))
  const maxAge = Math.min(24, Math.ceil(allPoints[allPoints.length - 1].ageMonths!))
  const allXValues = new Set<number>()
  for (let m = minAge; m <= maxAge; m++) {
    allXValues.add(m)
  }
  for (const p of allPoints) {
    if (p.ageMonths != null) {
      allXValues.add(Math.round(p.ageMonths * 100) / 100)
    }
  }
  const sortedX = Array.from(allXValues).sort((a, b) => a - b)

  // Re-interpolate WHO data at all x-values
  const whoInterpolated = PERCENTILE_KEYS.map((key, i) => ({
    label: `WHO ${PERCENTILE_LABELS[i]}`,
    data: sortedX.map((x) => interpolateWHO(whoData[key], x)! * 1000),
    borderColor: [
      'rgba(156, 163, 175, 0.4)',
      'rgba(156, 163, 175, 0.5)',
      'rgba(107, 114, 128, 0.6)',
      'rgba(156, 163, 175, 0.5)',
      'rgba(156, 163, 175, 0.4)',
    ][i],
    borderWidth: key === 'p50' ? 1.5 : 1,
    borderDash: key === 'p50' ? [] : ([4, 3] as number[]),
    pointRadius: 0,
    pointHoverRadius: 0,
    tension: 0.3,
    fill: false,
    datalabels: { display: false },
  }))

  // Baby weight data - place at the correct x positions
  const babyData = sortedX.map((x) => {
    // Find matching point
    const match = allPoints.find((p) => p.ageMonths != null && Math.abs(p.ageMonths - x) < 0.05)
    return match ? match.weight : null
  })

  const monthNames = [
    'Рожд.',
    '1 мес',
    '2 мес',
    '3 мес',
    '4 мес',
    '5 мес',
    '6 мес',
    '7 мес',
    '8 мес',
    '9 мес',
    '10 мес',
    '11 мес',
    '12 мес',
    '13 мес',
    '14 мес',
    '15 мес',
    '16 мес',
    '17 мес',
    '18 мес',
    '19 мес',
    '20 мес',
    '21 мес',
    '22 мес',
    '23 мес',
    '24 мес',
  ]

  const labels = sortedX.map((x) => {
    const rounded = Math.round(x)
    if (Math.abs(x - rounded) < 0.05 && rounded >= 0 && rounded <= 24) {
      return monthNames[rounded]
    }
    return ''
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Вес (г)',
        data: babyData,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(94, 234, 212, 0.5)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#14b8a6',
        tension: 0.2,
        fill: false,
        spanGaps: true,
        datalabels: { display: false },
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
      y: {
        ...baseLineOptions().scales!.y,
        beginAtZero: false,
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
            if (ctx.dataset.label === 'Вес (г)') {
              return `${Math.round(val)} г (${(val / 1000).toFixed(2)} кг)`
            }
            return `${ctx.dataset.label}: ${(val / 1000).toFixed(1)} кг`
          },
        },
      },
    },
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <Line data={chartData} options={options} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
        <span className="text-xs text-gray-400">ВОЗ:</span>
        {PERCENTILE_LABELS.map((label) => (
          <span key={label} className="text-xs text-gray-400">
            {label}
          </span>
        ))}
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
        'янв',
        'фев',
        'мар',
        'апр',
        'май',
        'июн',
        'июл',
        'авг',
        'сен',
        'окт',
        'ноя',
        'дек',
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <Line data={absData} options={absOptions} />
    </div>
  )
}
