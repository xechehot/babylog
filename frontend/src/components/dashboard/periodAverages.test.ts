import { describe, it, expect } from 'vitest'
import { getLoggedDays, pooledAvgGapHours, computePeriodAverages, findMissingDays } from './periodAverages'
import type { Entry, DashboardDay } from '../../types'

function makeEntry(overrides: Partial<Entry> & { occurred_at: string; entry_type: Entry['entry_type'] }): Entry {
  return {
    id: 0,
    upload_id: null,
    entry_type: overrides.entry_type,
    subtype: overrides.subtype ?? null,
    occurred_at: overrides.occurred_at,
    date: overrides.date ?? overrides.occurred_at.slice(0, 10),
    value: overrides.value ?? null,
    notes: null,
    confidence: null,
    raw_text: null,
    confirmed: false,
    created_at: overrides.occurred_at,
    updated_at: overrides.occurred_at,
  }
}

describe('getLoggedDays', () => {
  it('returns empty set when no entries', () => {
    const result = getLoggedDays([], [], '2026-03-01', '2026-03-07')
    expect(result.size).toBe(0)
  })

  it('unions feeding and diaper dates', () => {
    const feedings = [makeEntry({ entry_type: 'feeding', occurred_at: '2026-03-02T08:00:00' })]
    const diapers = [makeEntry({ entry_type: 'diaper', occurred_at: '2026-03-03T09:00:00' })]
    const result = getLoggedDays(feedings, diapers, '2026-03-01', '2026-03-07')
    expect(result).toEqual(new Set(['2026-03-02', '2026-03-03']))
  })

  it('deduplicates same-day entries', () => {
    const feedings = [
      makeEntry({ entry_type: 'feeding', occurred_at: '2026-03-02T08:00:00' }),
      makeEntry({ entry_type: 'feeding', occurred_at: '2026-03-02T14:00:00' }),
    ]
    const result = getLoggedDays(feedings, [], '2026-03-01', '2026-03-07')
    expect(result).toEqual(new Set(['2026-03-02']))
  })

  it('restricts to [from, to] bounds inclusive', () => {
    const feedings = [
      makeEntry({ entry_type: 'feeding', occurred_at: '2026-02-28T08:00:00' }),
      makeEntry({ entry_type: 'feeding', occurred_at: '2026-03-01T08:00:00' }),
      makeEntry({ entry_type: 'feeding', occurred_at: '2026-03-07T08:00:00' }),
      makeEntry({ entry_type: 'feeding', occurred_at: '2026-03-08T08:00:00' }),
    ]
    const result = getLoggedDays(feedings, [], '2026-03-01', '2026-03-07')
    expect(result).toEqual(new Set(['2026-03-01', '2026-03-07']))
  })
})

describe('pooledAvgGapHours', () => {
  it('returns null for empty input', () => {
    expect(pooledAvgGapHours([])).toBeNull()
  })

  it('returns null for a single entry', () => {
    expect(pooledAvgGapHours([{ occurred_at: '2026-03-01T08:00:00' }])).toBeNull()
  })

  it('averages gaps between two entries', () => {
    const result = pooledAvgGapHours([
      { occurred_at: '2026-03-01T08:00:00' },
      { occurred_at: '2026-03-01T10:00:00' },
    ])
    expect(result).toBeCloseTo(2, 5)
  })

  it('averages multiple gaps', () => {
    const result = pooledAvgGapHours([
      { occurred_at: '2026-03-01T08:00:00' },
      { occurred_at: '2026-03-01T10:00:00' }, // +2h
      { occurred_at: '2026-03-01T14:00:00' }, // +4h
    ])
    expect(result).toBeCloseTo(3, 5) // (2 + 4) / 2
  })

  it('includes overnight gaps (no upper filter)', () => {
    const result = pooledAvgGapHours([
      { occurred_at: '2026-03-01T22:00:00' },
      { occurred_at: '2026-03-02T08:00:00' }, // +10h
    ])
    expect(result).toBeCloseTo(10, 5)
  })

  it('drops gaps shorter than 10 minutes', () => {
    const result = pooledAvgGapHours([
      { occurred_at: '2026-03-01T08:00:00' },
      { occurred_at: '2026-03-01T08:05:00' }, // +5min, dropped
      { occurred_at: '2026-03-01T10:05:00' }, // +2h, kept
    ])
    expect(result).toBeCloseTo(2, 5)
  })

  it('returns null when all gaps are dropped', () => {
    const result = pooledAvgGapHours([
      { occurred_at: '2026-03-01T08:00:00' },
      { occurred_at: '2026-03-01T08:05:00' },
    ])
    expect(result).toBeNull()
  })

  it('sorts input before computing gaps', () => {
    const result = pooledAvgGapHours([
      { occurred_at: '2026-03-01T14:00:00' },
      { occurred_at: '2026-03-01T08:00:00' },
      { occurred_at: '2026-03-01T10:00:00' },
    ])
    expect(result).toBeCloseTo(3, 5)
  })
})

describe('computePeriodAverages', () => {
  function makeDay(overrides: Partial<DashboardDay> & { date: string }): DashboardDay {
    return {
      date: overrides.date,
      feeding_total_ml: overrides.feeding_total_ml ?? 0,
      feeding_count: overrides.feeding_count ?? 0,
      feeding_breast_ml: overrides.feeding_breast_ml ?? 0,
      feeding_formula_ml: overrides.feeding_formula_ml ?? 0,
      diaper_pee_count: overrides.diaper_pee_count ?? 0,
      diaper_poo_count: overrides.diaper_poo_count ?? 0,
      diaper_dry_count: overrides.diaper_dry_count ?? 0,
      diaper_pee_poo_count: overrides.diaper_pee_poo_count ?? 0,
    }
  }

  it('returns all nulls when no logged days', () => {
    const result = computePeriodAverages({
      days: [],
      feedingEntries: [],
      diaperEntries: [],
      from: '2026-03-01',
      to: '2026-03-07',
    })
    expect(result).toEqual({
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
    })
  })

  it('computes per-day averages divided by logged-day count', () => {
    const feedings = [
      makeEntry({ entry_type: 'feeding', subtype: 'breast', occurred_at: '2026-03-01T08:00:00', value: 100 }),
      makeEntry({ entry_type: 'feeding', subtype: 'formula', occurred_at: '2026-03-01T12:00:00', value: 50 }),
      makeEntry({ entry_type: 'feeding', subtype: 'breast', occurred_at: '2026-03-02T08:00:00', value: 120 }),
    ]
    const diapers = [
      makeEntry({ entry_type: 'diaper', subtype: 'pee', occurred_at: '2026-03-01T10:00:00' }),
      makeEntry({ entry_type: 'diaper', subtype: 'pee+poo', occurred_at: '2026-03-01T14:00:00' }),
      makeEntry({ entry_type: 'diaper', subtype: 'poo', occurred_at: '2026-03-02T10:00:00' }),
      makeEntry({ entry_type: 'diaper', subtype: 'dry', occurred_at: '2026-03-02T12:00:00' }),
    ]
    const days = [
      makeDay({ date: '2026-03-01', feeding_total_ml: 150 }),
      makeDay({ date: '2026-03-02', feeding_total_ml: 120 }),
    ]
    const result = computePeriodAverages({
      days,
      feedingEntries: feedings,
      diaperEntries: diapers,
      from: '2026-03-01',
      to: '2026-03-07',
    })
    expect(result.loggedDayCount).toBe(2)
    expect(result.mlPerDay).toBeCloseTo(135, 5) // (150+120)/2
    expect(result.breastPerDay).toBeCloseTo(1, 5) // 2 breast / 2 days
    expect(result.formulaPerDay).toBeCloseTo(0.5, 5) // 1 formula / 2 days
    expect(result.wetPerDay).toBeCloseTo(1, 5) // pee + pee+poo = 2 / 2 days
    expect(result.soilPerDay).toBeCloseTo(1, 5) // poo + pee+poo = 2 / 2 days
  })

  it('restricts sums to entries in [from,to] range', () => {
    const feedings = [
      makeEntry({ entry_type: 'feeding', subtype: 'breast', occurred_at: '2026-02-28T08:00:00', value: 9999 }),
      makeEntry({ entry_type: 'feeding', subtype: 'breast', occurred_at: '2026-03-01T08:00:00', value: 100 }),
    ]
    const days = [makeDay({ date: '2026-03-01', feeding_total_ml: 100 })]
    const result = computePeriodAverages({
      days,
      feedingEntries: feedings,
      diaperEntries: [],
      from: '2026-03-01',
      to: '2026-03-07',
    })
    expect(result.loggedDayCount).toBe(1)
    expect(result.mlPerDay).toBeCloseTo(100, 5)
    expect(result.breastPerDay).toBeCloseTo(1, 5)
  })

  it('computes pooled intervals for each subset', () => {
    const feedings = [
      makeEntry({ entry_type: 'feeding', subtype: 'breast', occurred_at: '2026-03-01T08:00:00' }),
      makeEntry({ entry_type: 'feeding', subtype: 'formula', occurred_at: '2026-03-01T10:00:00' }),
      makeEntry({ entry_type: 'feeding', subtype: 'breast', occurred_at: '2026-03-01T14:00:00' }),
    ]
    const diapers = [
      makeEntry({ entry_type: 'diaper', subtype: 'pee', occurred_at: '2026-03-01T08:00:00' }),
      makeEntry({ entry_type: 'diaper', subtype: 'dry', occurred_at: '2026-03-01T09:00:00' }),
      makeEntry({ entry_type: 'diaper', subtype: 'poo', occurred_at: '2026-03-01T11:00:00' }),
    ]
    const result = computePeriodAverages({
      days: [makeDay({ date: '2026-03-01' })],
      feedingEntries: feedings,
      diaperEntries: diapers,
      from: '2026-03-01',
      to: '2026-03-07',
    })
    // All feedings: gaps [2, 4] => avg 3
    expect(result.feedingInterval).toBeCloseTo(3, 5)
    // Breast only: 08 -> 14 => single 6h gap
    expect(result.breastInterval).toBeCloseTo(6, 5)
    // Formula only: one entry => null
    expect(result.formulaInterval).toBeNull()
    // Diapers, excluding dry: 08 -> 11 => single 3h gap
    expect(result.diaperInterval).toBeCloseTo(3, 5)
  })
})

describe('findMissingDays', () => {
  it('returns empty when every day is logged', () => {
    const logged = new Set(['2026-03-01', '2026-03-02', '2026-03-03'])
    const result = findMissingDays('2026-03-01', '2026-03-03', logged, '2026-03-05')
    expect(result).toEqual([])
  })

  it('returns dates not in logged set in ascending order', () => {
    const logged = new Set(['2026-03-01', '2026-03-04'])
    const result = findMissingDays('2026-03-01', '2026-03-05', logged, '2026-03-10')
    // Today=2026-03-10, yesterday=2026-03-09 — both outside range, no exclusion effect
    expect(result).toEqual(['2026-03-02', '2026-03-03', '2026-03-05'])
  })

  it('excludes today from the result', () => {
    const logged = new Set(['2026-03-01'])
    const result = findMissingDays('2026-03-01', '2026-03-03', logged, '2026-03-03')
    // today=2026-03-03 excluded; yesterday=2026-03-02 excluded
    expect(result).toEqual([])
  })

  it('excludes yesterday from the result', () => {
    const logged = new Set(['2026-03-01'])
    const result = findMissingDays('2026-03-01', '2026-03-04', logged, '2026-03-05')
    // today=2026-03-05 (outside), yesterday=2026-03-04 excluded
    expect(result).toEqual(['2026-03-02', '2026-03-03'])
  })

  it('handles a single-day range with no data', () => {
    const logged = new Set<string>()
    const result = findMissingDays('2026-03-01', '2026-03-01', logged, '2026-03-05')
    expect(result).toEqual(['2026-03-01'])
  })

  it('handles a single-day range that is today', () => {
    const logged = new Set<string>()
    const result = findMissingDays('2026-03-05', '2026-03-05', logged, '2026-03-05')
    expect(result).toEqual([])
  })
})
