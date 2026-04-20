import type { ChartOptions } from 'chart.js'
import { MONTH_SHORT } from './utils'

// Blade Runner neo-noir Chart.js theme.
// Series palette exported as BR_CHART so individual charts stay consistent.
export const BR_CHART = {
  amber: '#ffb347',
  amberA: 'rgba(255,179,71,0.45)',
  amberFill: 'rgba(255,179,71,0.18)',
  cyan: '#64f0e8',
  cyanA: 'rgba(100,240,232,0.45)',
  cyanFill: 'rgba(100,240,232,0.18)',
  rose: '#ff9ea3',
  roseA: 'rgba(255,158,163,0.45)',
  roseFill: 'rgba(255,158,163,0.18)',
  stool: '#b8946a',
  stoolFill: 'rgba(184,148,106,0.25)',
  blood: '#ff4d4d',
  body: '#f0e3cc',
  dim: 'rgba(240,225,200,0.55)',
  grid: 'rgba(215,170,110,0.10)',
  gridStrong: 'rgba(215,170,110,0.22)',
  ink: '#06080a',
}

// Back-compat COLORS — kept because individual charts still import these.
export const COLORS = {
  blue400: BR_CHART.cyan,
  purple400: BR_CHART.rose,
  sky400: BR_CHART.cyan,
  amber400: BR_CHART.amber,
  amber500: BR_CHART.stool,
  pink400: BR_CHART.rose,
  green400: BR_CHART.cyan,
  blue300alpha: BR_CHART.cyanFill,
  amber300alpha: BR_CHART.amberFill,
  pink300alpha: BR_CHART.roseFill,
  green300alpha: BR_CHART.cyanFill,
  blue600: BR_CHART.cyan,
  amber600: BR_CHART.amber,
  pink600: BR_CHART.rose,
  green600: BR_CHART.cyan,
  teal500: BR_CHART.cyan,
  teal300alpha: BR_CHART.cyanFill,
  teal600: BR_CHART.cyan,
}

const TICK_FONT = {
  family: '"JetBrains Mono", ui-monospace, monospace',
  size: 10,
}

export function formatDateTickRu(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

export function baseBarOptions(): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.8,
    events: ['mousemove', 'mouseenter', 'touchstart', 'touchmove'],
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(6,8,10,0.92)',
        borderColor: BR_CHART.amberA,
        borderWidth: 1,
        titleFont: { ...TICK_FONT, weight: 500 },
        titleColor: BR_CHART.amber,
        bodyFont: { ...TICK_FONT, size: 11 },
        bodyColor: BR_CHART.body,
        padding: 10,
        cornerRadius: 0,
        displayColors: false,
      },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { display: false, color: BR_CHART.grid },
        border: { color: BR_CHART.gridStrong, display: true },
        ticks: {
          autoSkip: true,
          autoSkipPadding: 8,
          maxRotation: 0,
          font: TICK_FONT,
          color: BR_CHART.dim,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: BR_CHART.grid },
        border: { color: BR_CHART.gridStrong, display: false },
        ticks: { font: TICK_FONT, color: BR_CHART.dim },
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
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(6,8,10,0.92)',
        borderColor: BR_CHART.amberA,
        borderWidth: 1,
        titleFont: { ...TICK_FONT, weight: 500 },
        titleColor: BR_CHART.amber,
        bodyFont: { ...TICK_FONT, size: 11 },
        bodyColor: BR_CHART.body,
        padding: 10,
        cornerRadius: 0,
        displayColors: false,
      },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { display: false, color: BR_CHART.grid },
        border: { color: BR_CHART.gridStrong, display: true },
        ticks: {
          autoSkip: true,
          autoSkipPadding: 8,
          maxRotation: 0,
          font: TICK_FONT,
          color: BR_CHART.dim,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: BR_CHART.grid },
        border: { color: BR_CHART.gridStrong, display: false },
        ticks: { font: TICK_FONT, color: BR_CHART.dim },
      },
    },
  }
}
