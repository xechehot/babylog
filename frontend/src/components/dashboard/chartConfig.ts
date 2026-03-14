import type { ChartOptions } from 'chart.js'
import { MONTH_SHORT_RU } from './utils'

export const COLORS = {
  blue400: '#60a5fa',
  purple400: '#c084fc',
  sky400: '#38bdf8',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  pink400: '#f472b6',
  green400: '#4ade80',
  blue300alpha: 'rgba(147, 197, 253, 0.5)',
  amber300alpha: 'rgba(252, 211, 77, 0.5)',
  pink300alpha: 'rgba(249, 168, 212, 0.5)',
  green300alpha: 'rgba(134, 239, 172, 0.5)',
  blue600: '#2563eb',
  amber600: '#d97706',
  pink600: '#db2777',
  green600: '#16a34a',
  teal500: '#14b8a6',
  teal300alpha: 'rgba(94, 234, 212, 0.5)',
  teal600: '#0d9488',
}

export function formatDateTickRu(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTH_SHORT_RU[d.getMonth()]}`
}

export function baseBarOptions(): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.8,
    events: ['mousemove', 'mouseenter', 'touchstart', 'touchmove'],
    interaction: {
      mode: 'nearest',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          autoSkip: true,
          autoSkipPadding: 8,
          maxRotation: 0,
          font: { size: 10 },
          color: '#9ca3af',
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f3f4f6' },
        ticks: {
          font: { size: 10 },
          color: '#9ca3af',
        },
      },
    },
  }
}

export function baseLineOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.8,
    events: ['mousemove', 'mouseenter', 'touchstart', 'touchmove'],
    interaction: {
      mode: 'nearest',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          autoSkip: true,
          autoSkipPadding: 8,
          maxRotation: 0,
          font: { size: 10 },
          color: '#9ca3af',
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f3f4f6' },
        ticks: {
          font: { size: 10 },
          color: '#9ca3af',
        },
      },
    },
  }
}
