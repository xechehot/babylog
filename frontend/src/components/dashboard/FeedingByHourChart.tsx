import { useState, useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { Entry } from '../../types'
import { baseBarOptions, BR_CHART } from './chartConfig'
import { ChartCard } from '../br/ChartCard'
import { Pill } from '../br/Pill'

type Filter = 'all' | 'formula' | 'breast'

interface FeedingByHourChartProps {
  entries: Entry[]
}

export function FeedingByHourChart({ entries }: FeedingByHourChartProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const { chartData, options } = useMemo(() => {
    const filtered = filter === 'all' ? entries : entries.filter((e) => e.subtype === filter)

    const counts = new Array(24).fill(0) as number[]
    for (const e of filtered) {
      const hour = new Date(e.occurred_at).getHours()
      counts[hour]++
    }

    const color = filter === 'breast' ? BR_CHART.cyan : BR_CHART.amber
    const fill = filter === 'breast' ? BR_CHART.cyanFill : BR_CHART.amberFill

    const data = {
      labels: Array.from({ length: 24 }, (_, i) => i.toString()),
      datasets: [
        {
          data: counts,
          backgroundColor: fill,
          borderColor: color,
          borderWidth: 1.2,
          borderRadius: 0,
          borderSkipped: false,
          datalabels: {
            display: (ctx: { dataIndex: number }) => counts[ctx.dataIndex] > 0,
            anchor: 'end' as const,
            align: 'top' as const,
            color,
            font: { family: '"JetBrains Mono"', size: 9 },
          },
        },
      ],
    }

    const opts = { ...baseBarOptions(), layout: { padding: { top: 18 } } }
    opts.scales = {
      ...opts.scales,
      x: {
        ...opts.scales!.x,
        ticks: {
          ...opts.scales!.x!.ticks,
          callback: function (_value: string | number, index: number) {
            return index % 3 === 0 ? String(index).padStart(2, '0') : ''
          },
        },
      },
    }

    return { chartData: data, options: opts }
  }, [entries, filter])

  return (
    <ChartCard
      kicker="BAR · 24H DISTRIBUTION"
      title="Feeding by hour"
      subtitle="when feedings happen"
      toolbar={
        <>
          <Pill active={filter === 'all'} onClick={() => setFilter('all')}>
            all
          </Pill>
          <Pill
            active={filter === 'breast'}
            onClick={() => setFilter('breast')}
            accent={BR_CHART.cyan}
          >
            breast
          </Pill>
          <Pill active={filter === 'formula'} onClick={() => setFilter('formula')}>
            formula
          </Pill>
        </>
      }
    >
      <Bar data={chartData} options={options} />
    </ChartCard>
  )
}
