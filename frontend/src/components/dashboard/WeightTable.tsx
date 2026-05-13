import type { Entry } from '../../types'

export interface WeightRow {
  dateStr: string | null    // YYYY-MM-DD for display; null if birth row and no birth_date
  weightGrams: number
  days: number | null       // null = unknown (no birth_date for first row)
  gainGrams: number | null  // null for birth row
  pctBirth: number | null   // null for birth row
  gPerWeek: number | null   // null for birth row, or when days <= 0
  isBirth: boolean
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr + 'T00:00:00').getTime()
  const to = new Date(toDateStr + 'T00:00:00').getTime()
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}

export function buildWeightRows(
  entries: Entry[],
  birthWeight: number,
  birthDate: string | null,
): WeightRow[] {
  const sorted = entries
    .filter((e) => e.value != null && e.value > 0)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())

  const birthRow: WeightRow = {
    dateStr: birthDate,
    weightGrams: birthWeight,
    days: null,
    gainGrams: null,
    pctBirth: null,
    gPerWeek: null,
    isBirth: true,
  }

  const rows: WeightRow[] = [birthRow]

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    const prevWeight = i === 0 ? birthWeight : sorted[i - 1].value!
    const prevDate = i === 0 ? birthDate : sorted[i - 1].date

    const days = prevDate != null ? daysBetween(prevDate, entry.date) : null
    const gainGrams = entry.value! - prevWeight
    const pctBirth = ((entry.value! - birthWeight) / birthWeight) * 100
    const gPerWeek = days != null && days > 0 ? Math.round((gainGrams / days) * 7) : null

    rows.push({
      dateStr: entry.date,
      weightGrams: entry.value!,
      days,
      gainGrams,
      pctBirth,
      gPerWeek,
      isBirth: false,
    })
  }

  return rows
}
