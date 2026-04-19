import type { ChartOptions } from 'chart.js'
import { MONTH_SHORT_RU } from './utils'

// Blade Runner neo-noir palette — amber primary, cyan secondary, rose accent.
export const COLORS = {
  blue400: '#64f0e8', // cyan
  purple400: '#d7a85c',
  sky400: '#64f0e8',
  amber400: '#ffb347',
  amber500: '#d7a85c',
  pink400: '#ff9ea3',
  green400: '#b8946a',
  blue300alpha: 'rgba(100, 240, 232, 0.35)',
  amber300alpha: 'rgba(255, 179, 71, 0.35)',
  pink300alpha: 'rgba(255, 158, 163, 0.35)',
  green300alpha: 'rgba(184, 148, 106, 0.35)',
  blue600: '#64f0e8',
  amber600: '#ffb347',
  pink600: '#ff9ea3',
  green600: '#b8946a',
  teal500: '#64f0e8',
  teal300alpha: 'rgba(100, 240, 232, 0.35)',
  teal600: '#64f0e8',
}

const GRID = 'rgba(215,170,110,0.14)'
const TICK = '#f0e3cc'
const TICK_FONT = {
  family: '"JetBrains Mono", ui-monospace, monospace',
  size: 10,
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
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(11, 15, 18, 0.95)',
        borderColor: 'rgba(255, 179, 71, 0.4)',
        borderWidth: 1,
        titleColor: '#ffb347',
        bodyColor: '#f0e3cc',
        titleFont: TICK_FONT,
        bodyFont: TICK_FONT,
      },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          autoSkip: true,
          autoSkipPadding: 8,
          maxRotation: 0,
          font: TICK_FONT,
          color: 'rgba(215,200,180,0.55)',
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID },
        ticks: {
          font: TICK_FONT,
          color: 'rgba(215,200,180,0.55)',
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
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(11, 15, 18, 0.95)',
        borderColor: 'rgba(255, 179, 71, 0.4)',
        borderWidth: 1,
        titleColor: '#ffb347',
        bodyColor: '#f0e3cc',
        titleFont: TICK_FONT,
        bodyFont: TICK_FONT,
      },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          autoSkip: true,
          autoSkipPadding: 8,
          maxRotation: 0,
          font: TICK_FONT,
          color: 'rgba(215,200,180,0.55)',
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID },
        ticks: {
          font: TICK_FONT,
          color: 'rgba(215,200,180,0.55)',
        },
      },
    },
  }
}

export { TICK, GRID }
