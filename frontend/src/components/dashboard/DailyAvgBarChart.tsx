import { Bar } from 'react-chartjs-2'
import { baseBarOptions, formatDateTickRu } from './chartConfig'

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
        backgroundColor: color,
        borderRadius: 3,
        datalabels: {
          display: (ctx: { dataIndex: number }) => data[ctx.dataIndex].value > 0,
          anchor: 'end' as const,
          align: 'top' as const,
          color: '#6b7280',
          font: { size: 10 },
          formatter: (v: number) => formatValue(v),
        },
      },
    ],
  }

  const options = {
    ...baseBarOptions(),
    layout: { padding: { top: 16 } },
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <Bar data={chartData} options={options} />
    </div>
  )
}
