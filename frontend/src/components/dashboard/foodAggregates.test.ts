import { describe, expect, it } from 'vitest'
import type { Entry } from '../../types'
import {
  computeAllergenStats,
  computeFoodGroupDays,
  computePillsBreakdown,
  daysBetween,
  enumerateDates,
} from './foodAggregates'

let nextId = 1

function food(
  date: string,
  opts: { allergens?: string[] | null; groups?: string[] | null; notes?: string } = {},
): Entry {
  return {
    id: nextId++,
    upload_id: null,
    entry_type: 'food',
    subtype: null,
    occurred_at: `${date} 12:30`,
    date,
    value: null,
    notes: opts.notes ?? 'банан',
    confidence: 'high',
    raw_text: null,
    confirmed: false,
    allergens: opts.allergens === undefined ? [] : opts.allergens,
    food_groups: opts.groups === undefined ? [] : opts.groups,
    created_at: '',
    updated_at: '',
  }
}

function pills(date: string, subtype: string | null, notes: string | null = null): Entry {
  return {
    ...food(date),
    entry_type: 'pills',
    subtype,
    notes,
    allergens: null,
    food_groups: null,
  }
}

const RANGE = { from: '2026-11-15', to: '2026-11-21', today: '2026-11-21' }

describe('enumerateDates', () => {
  it('includes both endpoints', () => {
    expect(enumerateDates('2026-11-19', '2026-11-21')).toEqual([
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
    ])
  })

  it('returns a single day when from equals to', () => {
    expect(enumerateDates('2026-11-19', '2026-11-19')).toEqual(['2026-11-19'])
  })

  it('returns nothing for an inverted range', () => {
    expect(enumerateDates('2026-11-21', '2026-11-19')).toEqual([])
  })

  it('crosses a month boundary', () => {
    expect(enumerateDates('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })
})

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-11-15', '2026-11-21')).toBe(6)
  })

  it('is zero for the same day', () => {
    expect(daysBetween('2026-11-21', '2026-11-21')).toBe(0)
  })
})

describe('computeAllergenStats', () => {
  it('counts one exposure per meal containing the allergen', () => {
    const { stats } = computeAllergenStats(
      [
        food('2026-11-16', { allergens: ['milk'] }),
        food('2026-11-17', { allergens: ['milk', 'egg'] }),
        food('2026-11-18', { allergens: [] }),
      ],
      RANGE,
    )
    const milk = stats.find((s) => s.allergen === 'milk')!
    const egg = stats.find((s) => s.allergen === 'egg')!

    expect(milk.periodExposures).toBe(2)
    expect(egg.periodExposures).toBe(1)
  })

  it('reports all eight allergens even when never given', () => {
    const { stats } = computeAllergenStats([food('2026-11-16', { allergens: ['egg'] })], RANGE)
    expect(stats).toHaveLength(8)
    const soy = stats.find((s) => s.allergen === 'soy')!
    expect(soy.totalExposures).toBe(0)
    expect(soy.lastDate).toBeNull()
    expect(soy.daysSince).toBeNull()
  })

  it('takes recency from all-time data, not just the period', () => {
    const { stats } = computeAllergenStats(
      [food('2026-10-01', { allergens: ['fish'] })], // before the period
      RANGE,
    )
    const fish = stats.find((s) => s.allergen === 'fish')!

    expect(fish.periodExposures).toBe(0)
    expect(fish.totalExposures).toBe(1)
    expect(fish.lastDate).toBe('2026-10-01')
    expect(fish.daysSince).toBe(51)
  })

  it('uses the latest exposure for recency', () => {
    const { stats } = computeAllergenStats(
      [
        food('2026-11-01', { allergens: ['gluten'] }),
        food('2026-11-20', { allergens: ['gluten'] }),
        food('2026-11-10', { allergens: ['gluten'] }),
      ],
      RANGE,
    )
    const gluten = stats.find((s) => s.allergen === 'gluten')!
    expect(gluten.lastDate).toBe('2026-11-20')
    expect(gluten.daysSince).toBe(1)
  })

  it('sorts never-given first, then by staleness', () => {
    const { stats } = computeAllergenStats(
      [
        food('2026-11-20', { allergens: ['egg'] }), // 1 day ago
        food('2026-11-01', { allergens: ['fish'] }), // 20 days ago
        food('2026-11-10', { allergens: ['milk'] }), // 11 days ago
      ],
      RANGE,
    )
    const given = stats.filter((s) => s.daysSince !== null).map((s) => s.allergen)
    const never = stats.slice(0, 5).map((s) => s.daysSince)

    expect(never.every((d) => d === null)).toBe(true)
    expect(given).toEqual(['fish', 'milk', 'egg'])
  })

  it('treats null tags as untagged, not as allergen-free', () => {
    const summary = computeAllergenStats(
      [
        food('2026-11-16', { allergens: null }),
        food('2026-11-17', { allergens: null }),
        food('2026-11-18', { allergens: ['egg'] }),
      ],
      RANGE,
    )
    expect(summary.untaggedMeals).toBe(2)
    expect(summary.taggedMeals).toBe(1)
  })

  it('counts an empty tag list as a tagged, allergen-free meal', () => {
    const summary = computeAllergenStats([food('2026-11-16', { allergens: [] })], RANGE)
    expect(summary.taggedMeals).toBe(1)
    expect(summary.untaggedMeals).toBe(0)
  })

  it('ignores tags outside the closed list', () => {
    const { stats } = computeAllergenStats(
      [food('2026-11-16', { allergens: ['treenut', 'egg'] })],
      RANGE,
    )
    expect(stats.find((s) => s.allergen === 'egg')!.periodExposures).toBe(1)
    expect(stats.reduce((sum, s) => sum + s.periodExposures, 0)).toBe(1)
  })

  it('ignores non-food entries', () => {
    const summary = computeAllergenStats([pills('2026-11-16', 'vigantol')], RANGE)
    expect(summary.taggedMeals).toBe(0)
    expect(summary.untaggedMeals).toBe(0)
  })
})

describe('computeFoodGroupDays', () => {
  const range = { from: '2026-11-19', to: '2026-11-21' }

  it('returns a row per day in range, newest first', () => {
    const days = computeFoodGroupDays([], range)
    expect(days.map((d) => d.date)).toEqual(['2026-11-21', '2026-11-20', '2026-11-19'])
  })

  it('keeps days with no solids as empty rows', () => {
    const days = computeFoodGroupDays([food('2026-11-20', { groups: ['protein'] })], range)
    const empty = days.find((d) => d.date === '2026-11-19')!
    expect(empty.mealCount).toBe(0)
    expect(empty.counts.protein).toBe(0)
  })

  it('counts meals covering each group', () => {
    const days = computeFoodGroupDays(
      [
        food('2026-11-20', { groups: ['protein', 'fat'] }),
        food('2026-11-20', { groups: ['protein', 'produce', 'fiber'] }),
      ],
      range,
    )
    const day = days.find((d) => d.date === '2026-11-20')!

    expect(day.mealCount).toBe(2)
    expect(day.counts.protein).toBe(2)
    expect(day.counts.fat).toBe(1)
    expect(day.counts.fiber).toBe(1)
    expect(day.counts.produce).toBe(1)
    expect(day.counts.carbs).toBe(0)
  })

  it('counts an untagged meal toward the day but not toward any group', () => {
    const days = computeFoodGroupDays([food('2026-11-20', { groups: null })], range)
    const day = days.find((d) => d.date === '2026-11-20')!

    expect(day.mealCount).toBe(1)
    expect(day.untaggedMeals).toBe(1)
    expect(day.counts.protein).toBe(0)
  })

  it('drops entries outside the range', () => {
    const days = computeFoodGroupDays([food('2026-10-01', { groups: ['protein'] })], range)
    expect(days.every((d) => d.mealCount === 0)).toBe(true)
  })

  it('ignores unknown group tags', () => {
    const days = computeFoodGroupDays([food('2026-11-20', { groups: ['vitamins'] })], range)
    const day = days.find((d) => d.date === '2026-11-20')!
    expect(Object.values(day.counts).every((c) => c === 0)).toBe(true)
    expect(day.mealCount).toBe(1)
  })
})

describe('computePillsBreakdown', () => {
  it('groups by subtype when the parser recognized the medicine', () => {
    const rows = computePillsBreakdown([
      pills('2026-11-16', 'vigantol'),
      pills('2026-11-17', 'vigantol'),
    ])
    expect(rows).toEqual([{ key: 'vigantol', label: 'VIGANTOL', count: 2 }])
  })

  it('falls back to the first word of notes when there is no subtype', () => {
    const rows = computePillsBreakdown([
      pills('2026-11-15', null, 'слабительное лекарство 60'),
      pills('2026-11-16', null, 'слабительное'),
    ])
    expect(rows).toEqual([{ key: 'слабительное', label: 'СЛАБИТЕЛЬНОЕ', count: 2 }])
  })

  it('labels an entry with neither subtype nor notes', () => {
    const rows = computePillsBreakdown([pills('2026-11-16', null, null)])
    expect(rows).toEqual([{ key: 'unspecified', label: 'UNSPECIFIED', count: 1 }])
  })

  it('sorts by count descending', () => {
    const rows = computePillsBreakdown([
      pills('2026-11-15', null, 'слабительное'),
      pills('2026-11-16', 'vigantol'),
      pills('2026-11-17', 'vigantol'),
    ])
    expect(rows.map((r) => r.key)).toEqual(['vigantol', 'слабительное'])
  })

  it('ignores non-pills entries', () => {
    expect(computePillsBreakdown([food('2026-11-16')])).toEqual([])
  })
})
