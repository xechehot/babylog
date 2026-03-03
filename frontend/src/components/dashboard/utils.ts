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

const DAY_NAMES_RU = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
]

export const MONTH_SHORT_RU: Record<number, string> = {
  0: 'янв',
  1: 'фев',
  2: 'мар',
  3: 'апр',
  4: 'май',
  5: 'июн',
  6: 'июл',
  7: 'авг',
  8: 'сен',
  9: 'окт',
  10: 'ноя',
  11: 'дек',
}

function formatISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Formats "2026-03-01" as "1 мар" */
export function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTH_SHORT_RU[d.getMonth()]}`
}

/** Returns inclusive date range for the given period in days. */
export function getDateRange(days: number): { from_date: string; to_date: string } {
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - (days - 1))
  return { from_date: formatISO(from), to_date: formatISO(now) }
}

/** Returns today's date as YYYY-MM-DD in local timezone. */
export function getTodayStr(): string {
  return formatISO(new Date())
}

/** Formats "2026-03-01" as "1 мар, суббота" */
export function formatDateRuFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTH_SHORT_RU[d.getMonth()]}, ${DAY_NAMES_RU[d.getDay()]}`
}
