import { useState, useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { DashboardDay } from '../../types'
import { baseBarOptions, formatDateTickRu, BR_CHART } from './chartConfig'
import { ChartCard } from '../br/ChartCard'
import { Pill } from '../br/Pill'
import { LegendRow } from '../br/LegendRow'

interface FeedingChartProps {
  days: DashboardDay[]
}

export function FeedingChart({ days }: FeedingChartProps) {
  const [breakdown, setBreakdown] = useState(true)

  const count = days.length

  const chartData = useMemo(() => {
    const labels = days.map((d) => formatDateTickRu(d.date))

    if (!breakdown) {
      return {
        labels,
        datasets: [
          {
            label: 'Всего',
            data: days.map((d) => d.feeding_total_ml),
            backgroundColor: BR_CHART.amberFill,
            borderColor: BR_CHART.amber,
            borderWidth: 1.5,
            borderRadius: 0,
            borderSkipped: false,
            datalabels: {
              display: (ctx: { dataIndex: number }) => days[ctx.dataIndex].feeding_total_ml > 0,
              anchor: 'end' as const,
              align: 'top' as const,
              color: BR_CHART.amber,
              font: { family: '"JetBrains Mono"', size: 9, weight: 500 },
              formatter: (v: number) => Math.round(v).toString(),
            },
          },
        ],
      }
    }

    return {
      labels,
      datasets: [
        {
          label: 'грудь',
          data: days.map((d) => d.feeding_breast_ml),
          backgroundColor: BR_CHART.cyanFill,
          borderColor: BR_CHART.cyan,
          borderWidth: 1.5,
          borderRadius: 0,
          borderSkipped: false,
          datalabels: { display: false },
        },
        {
          label: 'смесь',
          data: days.map((d) => d.feeding_formula_ml),
          backgroundColor: BR_CHART.amberFill,
          borderColor: BR_CHART.amber,
          borderWidth: 1.5,
          borderRadius: 0,
          borderSkipped: false,
          datalabels: {
            display: (ctx: { dataIndex: number }) => days[ctx.dataIndex].feeding_total_ml > 0,
            anchor: 'end' as const,
            align: 'top' as const,
            color: BR_CHART.amber,
            font: { family: '"JetBrains Mono"', size: 9, weight: 500 },
            formatter: (_v: number, ctx: { dataIndex: number }) =>
              Math.round(days[ctx.dataIndex].feeding_total_ml).toString(),
          },
        },
      ],
    }
  }, [days, breakdown])

  const options = useMemo(() => {
    const opts = baseBarOptions()
    opts.layout = { padding: { top: 22 } }
    opts.scales = {
      ...opts.scales,
      x: { ...opts.scales!.x, stacked: breakdown },
      y: { ...opts.scales!.y, stacked: breakdown },
    }
    if (breakdown) {
      opts.plugins = {
        ...opts.plugins,
        tooltip: {
          ...opts.plugins!.tooltip,
          callbacks: {
            afterBody: (items: { dataIndex: number }[]) => {
              const idx = items[0]?.dataIndex
              if (idx == null) return ''
              const day = days[idx]
              if (day.feeding_breast_ml > 0) {
                const pct = Math.round((day.feeding_breast_ml / day.feeding_total_ml) * 100)
                return `грудь: ${pct}%`
              }
              return ''
            },
          },
        },
      }
    }
    return opts
  }, [days, breakdown])

  if (count === 0) return null

  return (
    <ChartCard
      kicker="BAR · VOLUME"
      title="Feeding / day"
      subtitle="мл грудного молока и смеси"
      toolbar={
        <>
          <Pill active={breakdown} onClick={() => setBreakdown(true)}>
            разбивка
          </Pill>
          <Pill active={!breakdown} onClick={() => setBreakdown(false)}>
            всего
          </Pill>
        </>
      }
      footer={
        <LegendRow
          items={
            breakdown
              ? [
                  { color: BR_CHART.cyan, label: 'грудь · breast' },
                  { color: BR_CHART.amber, label: 'смесь · formula' },
                ]
              : [{ color: BR_CHART.amber, label: 'всего · total ml' }]
          }
        />
      }
    >
      <Bar data={chartData} options={options} />
    </ChartCard>
  )
}
