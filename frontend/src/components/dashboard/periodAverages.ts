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
