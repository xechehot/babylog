import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { DashboardDay } from '../../types'
import { baseBarOptions, formatDateTickRu, BR_CHART } from './chartConfig'
import { ChartCard } from '../br/ChartCard'
import { LegendRow } from '../br/LegendRow'

interface DiaperChartProps {
  days: DashboardDay[]
}

function wetCount(day: DashboardDay): number {
  return day.diaper_pee_count + day.diaper_pee_poo_count
}

function dirtyCount(day: DashboardDay): number {
  return day.diaper_poo_count + day.diaper_pee_poo_count
}

export function DiaperChart({ days }: DiaperChartProps) {
  const { chartData, options } = useMemo(() => {
    const data = {
      labels: days.map((d) => formatDateTickRu(d.date)),
      datasets: [
        {
          label: 'wet',
          data: days.map(wetCount),
          backgroundColor: BR_CHART.cyanFill,
          borderColor: BR_CHART.cyan,
          borderWidth: 1.5,
          borderRadius: 0,
          borderSkipped: false,
          datalabels: {
            display: (ctx: { dataIndex: number }) => wetCount(days[ctx.dataIndex]) > 0,
            anchor: 'end' as const,
            align: 'top' as const,
            color: BR_CHART.cyan,
            font: { family: '"JetBrains Mono"', size: 9 },
          },
        },
        {
          label: 'soiled',
          data: days.map(dirtyCount),
          backgroundColor: BR_CHART.stoolFill,
          borderColor: BR_CHART.stool,
          borderWidth: 1.5,
          borderRadius: 0,
          borderSkipped: false,
          datalabels: {
            display: (ctx: { dataIndex: number }) => dirtyCount(days[ctx.dataIndex]) > 0,
            anchor: 'end' as const,
            align: 'top' as const,
            color: BR_CHART.stool,
            font: { family: '"JetBrains Mono"', size: 9 },
          },
        },
      ],
    }

    const opts = { ...baseBarOptions(), layout: { padding: { top: 18 } } }

    return { chartData: data, options: opts }
  }, [days])

  if (days.length === 0) return null

  return (
    <ChartCard
      kicker="BAR · GROUPED"
      title="Diapers / day"
      subtitle="wet and soiled, counts"
      footer={
        <LegendRow
          items={[
            { color: BR_CHART.cyan, label: 'wet' },
            { color: BR_CHART.stool, label: 'soiled' },
          ]}
        />
      }
    >
      <Bar data={chartData} options={options} />
    </ChartCard>
  )
}
