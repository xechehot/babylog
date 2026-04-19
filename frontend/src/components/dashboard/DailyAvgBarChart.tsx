import { Bar } from 'react-chartjs-2'
import { baseBarOptions, formatDateTickRu, BR_CHART } from './chartConfig'

interface DailyValue {
  date: string
  value: number
}

interface DailyAvgBarChartProps {
  data: DailyValue[]
  color: string
  formatValue?: (v: number) => string
}

export function DailyAvgBarChart({
  data,
  color,
  formatValue = (v) => v.toFixed(1),
}: DailyAvgBarChartProps) {
  if (data.length === 0) return null

  const chartData = {
    labels: data.map((d) => formatDateTickRu(d.date)),
    datasets: [
      {
        data: data.map((d) => d.value),
        backgroundColor: `${color}2d`,
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 0,
        borderSkipped: false,
        datalabels: {
          display: (ctx: { dataIndex: number }) => data[ctx.dataIndex].value > 0,
          anchor: 'end' as const,
          align: 'top' as const,
          color,
          font: { family: '"JetBrains Mono"', size: 9 },
          formatter: (v: number) => formatValue(v),
        },
      },
    ],
  }

  const options = {
    ...baseBarOptions(),
    layout: { padding: { top: 18 } },
  }

  return (
    <div
      className="relative"
      style={{
        border: `1px solid ${BR_CHART.gridStrong}`,
        background: 'rgba(6,8,10,0.4)',
        padding: 12,
      }}
    >
      <Bar data={chartData} options={options} />
    </div>
  )
}
