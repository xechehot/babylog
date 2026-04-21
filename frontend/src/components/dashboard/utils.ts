import type { Entry } from '../../types'

const MERGE_GAP_MINUTES = 20

interface MergedFeeding {
  occurred_at: string
  date: string
  value: number
}

/**
 * Merge feedings that are within MERGE_GAP_MINUTES of each other into a single
 * feeding session. Sums ml values and uses the last entry's timestamp/date.
 * Only considers feedings with a positive value.
 */
export function mergeCloseFeedings(entries: Entry[]): MergedFeeding[] {
  const feedings = entries
    .filter((e) => e.entry_type === 'feeding' && e.value != null && e.value > 0)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  if (feedings.length === 0) return []

  const merged: MergedFeeding[] = []
  let groupValue = feedings[0].value!
  let groupEnd = feedings[0]

  for (let i = 1; i < feedings.length; i++) {
    const prevTime = new Date(groupEnd.occurred_at).getTime()
    const currTime = new Date(feedings[i].occurred_at).getTime()
    const gapMinutes = (currTime - prevTime) / (1000 * 60)

    if (gapMinutes <= MERGE_GAP_MINUTES) {
      groupValue += feedings[i].value!
      groupEnd = feedings[i]
    } else {
      merged.push({
        occurred_at: groupEnd.occurred_at,
        date: groupEnd.date,
        value: groupValue,
      })
      groupValue = feedings[i].value!
      groupEnd = feedings[i]
    }
  }

  merged.push({
    occurred_at: groupEnd.occurred_at,
    date: groupEnd.date,
    value: groupValue,
  })

  return merged
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const MONTH_SHORT: Record<number, string> = {
  0: 'Jan',
  1: 'Feb',
  2: 'Mar',
  3: 'Apr',
  4: 'May',
  5: 'Jun',
  6: 'Jul',
  7: 'Aug',
  8: 'Sep',
  9: 'Oct',
  10: 'Nov',
  11: 'Dec',
}

function formatISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Formats "2026-03-01" as "1 Mar" */
export function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

/**
 * Returns an inclusive date range of the last `days` full days, ending yesterday.
 * E.g. on 2026-04-21 with days=7, returns 2026-04-14 → 2026-04-20.
 */
export function getDateRange(days: number): { from_date: string; to_date: string } {
  const to = new Date()
  to.setDate(to.getDate() - 1)
  const from = new Date(to)
  from.setDate(from.getDate() - (days - 1))
  return { from_date: formatISO(from), to_date: formatISO(to) }
}

/** Returns today's date as YYYY-MM-DD in local timezone. */
export function getTodayStr(): string {
  return formatISO(new Date())
}

/** Formats "2026-03-01" as "1 Mar, Saturday" */
export function formatDateRuFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}, ${DAY_NAMES[d.getDay()]}`
}
