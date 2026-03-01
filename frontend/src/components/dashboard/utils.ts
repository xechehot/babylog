const MONTH_SHORT_RU: Record<number, string> = {
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
