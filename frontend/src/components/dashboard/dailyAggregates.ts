import type { Entry } from '../../types'
import { mergeCloseFeedings } from './utils'

interface DailyValue {
  date: string
  value: number
}

const MIN_GAP_HOURS = 10 / 60 // 10 minutes

/**
 * Average feeding interval per day (hours).
 * Merges close feedings into sessions, then computes gaps between sessions.
 */
export function computeDailyAvgFeedingInterval(entries: Entry[]): DailyValue[] {
  const feedings = mergeCloseFeedings(entries)
  return averageGapsByDate(feedings)
}

/**
 * Average breast feeding interval per day (hours).
 */
export function computeDailyAvgBreastInterval(entries: Entry[]): DailyValue[] {
  const breast = entries
    .filter((e) => e.entry_type === 'feeding' && e.subtype === 'breast')
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  return averageGapsByDate(breast)
}

/**
 * Average diaper interval per day (hours), excluding dry.
 */
export function computeDailyAvgDiaperInterval(entries: Entry[]): DailyValue[] {
  const diapers = entries
    .filter(
      (e) =>
        e.entry_type === 'diaper' &&
        (e.subtype === 'pee' || e.subtype === 'poo' || e.subtype === 'pee+poo'),
    )
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  return averageGapsByDate(diapers)
}

/**
 * Average feeding speed per day (ml/h) = total_ml / 24.
 */
export function computeDailyAvgFeedingSpeed(entries: Entry[]): DailyValue[] {
  const byDate = new Map<string, number>()

  for (const e of entries) {
    if (e.entry_type !== 'feeding' || e.value == null || e.value <= 0) continue
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.value)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totalMl]) => ({ date, value: totalMl / 24 }))
}

function averageGapsByDate(sorted: { occurred_at: string; date: string }[]): DailyValue[] {
  const byDate = new Map<string, number[]>()

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].occurred_at).getTime()
    const curr = new Date(sorted[i].occurred_at).getTime()
    const hours = (curr - prev) / (1000 * 60 * 60)
    if (hours < MIN_GAP_HOURS) continue

    const date = sorted[i].date
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(hours)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, gaps]) => ({
      date,
      value: gaps.reduce((s, v) => s + v, 0) / gaps.length,
    }))
}
