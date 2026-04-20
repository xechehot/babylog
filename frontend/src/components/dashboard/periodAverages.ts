import type { Entry } from '../../types'

export function getLoggedDays(
  feedingEntries: Entry[],
  diaperEntries: Entry[],
  from: string,
  to: string,
): Set<string> {
  const days = new Set<string>()
  for (const e of feedingEntries) {
    if (e.date >= from && e.date <= to) days.add(e.date)
  }
  for (const e of diaperEntries) {
    if (e.date >= from && e.date <= to) days.add(e.date)
  }
  return days
}

const MIN_GAP_HOURS = 10 / 60

export function pooledAvgGapHours(entries: { occurred_at: string }[]): number | null {
  if (entries.length < 2) return null
  const sorted = [...entries].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const h =
      (new Date(sorted[i].occurred_at).getTime() - new Date(sorted[i - 1].occurred_at).getTime()) /
      (1000 * 60 * 60)
    if (h >= MIN_GAP_HOURS) gaps.push(h)
  }
  if (gaps.length === 0) return null
  return gaps.reduce((s, g) => s + g, 0) / gaps.length
}
