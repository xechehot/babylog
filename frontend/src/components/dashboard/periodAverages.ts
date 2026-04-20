import type { Entry, DashboardDay } from '../../types'

export interface PeriodAveragesInput {
  days: DashboardDay[]
  feedingEntries: Entry[]
  diaperEntries: Entry[]
  from: string
  to: string
}

export interface PeriodAveragesResult {
  loggedDayCount: number
  mlPerDay: number | null
  breastPerDay: number | null
  formulaPerDay: number | null
  wetPerDay: number | null
  soilPerDay: number | null
  feedingInterval: number | null
  breastInterval: number | null
  formulaInterval: number | null
  diaperInterval: number | null
}

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

export function computePeriodAverages(input: PeriodAveragesInput): PeriodAveragesResult {
  const { days, feedingEntries, diaperEntries, from, to } = input
  const loggedDays = getLoggedDays(feedingEntries, diaperEntries, from, to)
  const n = loggedDays.size

  const inRange = (e: Entry) => e.date >= from && e.date <= to
  const feedingsInRange = feedingEntries.filter(inRange)
  const diapersInRange = diaperEntries.filter(inRange)
  const daysInRange = days.filter((d) => d.date >= from && d.date <= to)

  if (n === 0) {
    return {
      loggedDayCount: 0,
      mlPerDay: null,
      breastPerDay: null,
      formulaPerDay: null,
      wetPerDay: null,
      soilPerDay: null,
      feedingInterval: null,
      breastInterval: null,
      formulaInterval: null,
      diaperInterval: null,
    }
  }

  const mlTotal = daysInRange.reduce((s, d) => s + d.feeding_total_ml, 0)
  const breastCount = feedingsInRange.filter((e) => e.subtype === 'breast').length
  const formulaCount = feedingsInRange.filter((e) => e.subtype === 'formula').length
  const wetCount = diapersInRange.filter(
    (e) => e.subtype === 'pee' || e.subtype === 'pee+poo',
  ).length
  const soilCount = diapersInRange.filter(
    (e) => e.subtype === 'poo' || e.subtype === 'pee+poo',
  ).length

  const breastEntries = feedingsInRange.filter((e) => e.subtype === 'breast')
  const formulaEntries = feedingsInRange.filter((e) => e.subtype === 'formula')
  const nonDryDiapers = diapersInRange.filter((e) => e.subtype !== 'dry')

  return {
    loggedDayCount: n,
    mlPerDay: mlTotal / n,
    breastPerDay: breastCount / n,
    formulaPerDay: formulaCount / n,
    wetPerDay: wetCount / n,
    soilPerDay: soilCount / n,
    feedingInterval: pooledAvgGapHours(feedingsInRange),
    breastInterval: pooledAvgGapHours(breastEntries),
    formulaInterval: pooledAvgGapHours(formulaEntries),
    diaperInterval: pooledAvgGapHours(nonDryDiapers),
  }
}

/**
 * Returns dates in [from, to] not present in loggedDays, sorted ascending.
 * Today and yesterday are always excluded (a current-day or just-past gap is
 * not yet a logging failure). `todayStr` is passed in for testability; callers
 * should use `getTodayStr()` from `./utils`.
 */
export function findMissingDays(
  from: string,
  to: string,
  loggedDays: Set<string>,
  todayStr: string,
): string[] {
  const yesterdayStr = addDays(todayStr, -1)
  const missing: string[] = []
  let cursor = from
  while (cursor <= to) {
    if (cursor !== todayStr && cursor !== yesterdayStr && !loggedDays.has(cursor)) {
      missing.push(cursor)
    }
    cursor = addDays(cursor, 1)
  }
  return missing
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
