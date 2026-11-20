import type { Entry } from '../../types'
import { formatISO } from './utils'
import {
  ALLERGENS,
  ALLERGEN_LABELS,
  ALLERGEN_LABELS_RU,
  FOOD_GROUPS,
  isAllergen,
  isFoodGroup,
  type Allergen,
  type FoodGroup,
} from './foodTags'

/**
 * Counting semantics for solids, in one place:
 *
 * - One `food` entry is one прикорм meal. A meal that lists five products is still one meal.
 * - One exposure to an allergen = one meal whose tags include it. Two allergens in the same
 *   meal are one exposure each.
 * - `allergens === null` means the entry was never tagged (recognized before tagging existed,
 *   or missed by the backfill). Those meals are excluded from counts and reported separately,
 *   so an untagged history can't masquerade as "allergen never given".
 * - `allergens === []` means the meal was tagged and genuinely contained none of the eight.
 */

export function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr + 'T00:00:00').getTime()
  const to = new Date(toDateStr + 'T00:00:00').getTime()
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}

/** Every date from `from` to `to` inclusive, ascending. */
export function enumerateDates(from: string, to: string): string[] {
  if (from > to) return []
  const dates: string[] = []
  const cursor = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cursor <= end) {
    // formatISO, not toISOString: these Dates are local midnight and UTC would shift the day.
    dates.push(formatISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function tagsOf(entry: Entry, kind: 'allergens' | 'food_groups'): string[] | null {
  const raw = entry[kind]
  return Array.isArray(raw) ? raw : null
}

export interface AllergenStat {
  allergen: Allergen
  label: string
  labelRu: string
  /** Meals in the selected period that contained this allergen. */
  periodExposures: number
  /** Meals ever logged that contained it — the "introduced at all?" answer. */
  totalExposures: number
  /** Date of the most recent exposure, all-time. */
  lastDate: string | null
  /** Days from `lastDate` to today; null when never given. */
  daysSince: number | null
}

export interface AllergenSummary {
  /** Never-given allergens first, then the longest since the last exposure. */
  stats: AllergenStat[]
  /** Tagged meals all-time — the denominator behind the numbers above. */
  taggedMeals: number
  /** Meals with no tags at all; they contribute to nothing and need a backfill run. */
  untaggedMeals: number
}

/**
 * Allergen frequency and recency.
 *
 * Recency is deliberately all-time: "when did he last get fish" is not a question about the
 * selected period. Frequency is period-scoped, so changing the range changes the counts.
 */
export function computeAllergenStats(
  allFoodEntries: Entry[],
  { from, to, today }: { from: string; to: string; today: string },
): AllergenSummary {
  const periodExposures = new Map<Allergen, number>()
  const totalExposures = new Map<Allergen, number>()
  const lastDate = new Map<Allergen, string>()
  let taggedMeals = 0
  let untaggedMeals = 0

  for (const entry of allFoodEntries) {
    if (entry.entry_type !== 'food') continue
    const tags = tagsOf(entry, 'allergens')
    if (tags === null) {
      untaggedMeals++
      continue
    }
    taggedMeals++

    const inPeriod = entry.date >= from && entry.date <= to
    for (const tag of tags) {
      if (!isAllergen(tag)) continue
      totalExposures.set(tag, (totalExposures.get(tag) ?? 0) + 1)
      if (inPeriod) periodExposures.set(tag, (periodExposures.get(tag) ?? 0) + 1)
      const previous = lastDate.get(tag)
      if (previous === undefined || entry.date > previous) lastDate.set(tag, entry.date)
    }
  }

  const stats: AllergenStat[] = ALLERGENS.map((allergen) => {
    const last = lastDate.get(allergen) ?? null
    return {
      allergen,
      label: ALLERGEN_LABELS[allergen],
      labelRu: ALLERGEN_LABELS_RU[allergen],
      periodExposures: periodExposures.get(allergen) ?? 0,
      totalExposures: totalExposures.get(allergen) ?? 0,
      lastDate: last,
      daysSince: last === null ? null : daysBetween(last, today),
    }
  })

  // Never given is the biggest gap of all, so it sorts above any stale allergen.
  stats.sort((a, b) => {
    if (a.daysSince === null && b.daysSince === null) return a.label.localeCompare(b.label)
    if (a.daysSince === null) return -1
    if (b.daysSince === null) return 1
    if (b.daysSince !== a.daysSince) return b.daysSince - a.daysSince
    return a.label.localeCompare(b.label)
  })

  return { stats, taggedMeals, untaggedMeals }
}

export interface FoodGroupDay {
  date: string
  /** Meals logged that day, tagged or not. */
  mealCount: number
  /** Meals that day covering each group. 0 = gap. */
  counts: Record<FoodGroup, number>
  untaggedMeals: number
}

/**
 * Per-day food-group coverage over the selected period, newest day first.
 *
 * Days with no solids at all are kept as empty rows: a gap is exactly what this grid is for.
 */
export function computeFoodGroupDays(
  foodEntries: Entry[],
  { from, to }: { from: string; to: string },
): FoodGroupDay[] {
  const byDate = new Map<string, FoodGroupDay>()
  for (const date of enumerateDates(from, to)) {
    byDate.set(date, {
      date,
      mealCount: 0,
      counts: Object.fromEntries(FOOD_GROUPS.map((g) => [g, 0])) as Record<FoodGroup, number>,
      untaggedMeals: 0,
    })
  }

  for (const entry of foodEntries) {
    if (entry.entry_type !== 'food') continue
    const day = byDate.get(entry.date)
    if (!day) continue
    day.mealCount++

    const tags = tagsOf(entry, 'food_groups')
    if (tags === null) {
      day.untaggedMeals++
      continue
    }
    for (const tag of tags) {
      if (isFoodGroup(tag)) day.counts[tag]++
    }
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export interface PillsBreakdownRow {
  key: string
  label: string
  count: number
}

/**
 * Which medicines made up the pills entries, most frequent first.
 *
 * Entries carry a `subtype` only for medicines the parser knows (vigantol). Everything else
 * arrives as free text in `notes`, where the same medicine is written with varying detail
 * ("слабительное", "слабительное лекарство 60"), so the first word is used as the identity.
 */
export function computePillsBreakdown(pillsEntries: Entry[]): PillsBreakdownRow[] {
  const counts = new Map<string, number>()

  for (const entry of pillsEntries) {
    if (entry.entry_type !== 'pills') continue
    const firstWord = entry.notes
      ?.trim()
      .toLowerCase()
      .split(/[\s,.;]+/)[0]
    const key = entry.subtype ?? (firstWord || 'unspecified')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key.toUpperCase(), count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}
