import { describe, it, expect } from 'vitest'
import {
  computeDailyAvgFeedingInterval,
  computeDailyAvgBreastInterval,
  computeDailyAvgDiaperInterval,
  computeDailyAvgFeedingSpeed,
} from './dailyAggregates'
import type { Entry } from '../../types'

function makeEntry(overrides: Partial<Entry> & { occurred_at: string; entry_type: string }): Entry {
  return {
    id: 0,
    upload_id: null,
    entry_type: overrides.entry_type as Entry['entry_type'],
    subtype: overrides.subtype ?? null,
    occurred_at: overrides.occurred_at,
    date: overrides.occurred_at.slice(0, 10),
    value: overrides.value ?? null,
    notes: null,
    confidence: null,
    raw_text: null,
    confirmed: false,
    created_at: overrides.occurred_at,
    updated_at: overrides.occurred_at,
  }
}

describe('computeDailyAvgFeedingSpeed', () => {
  it('returns empty for no entries', () => {
    expect(computeDailyAvgFeedingSpeed([])).toEqual([])
  })

  it('computes total_ml / 24 per day', () => {
    const entries = [
      makeEntry({
        entry_type: 'feeding',
        subtype: 'breast',
        occurred_at: '2026-03-10T08:00:00',
        value: 240,
      }),
    ]
    const result = computeDailyAvgFeedingSpeed(entries)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe(10) // 240 / 24
  })

  it('ignores non-feeding entries', () => {
    const entries = [
      makeEntry({ entry_type: 'diaper', subtype: 'pee', occurred_at: '2026-03-10T08:00:00' }),
    ]
    expect(computeDailyAvgFeedingSpeed(entries)).toEqual([])
  })
})

describe('computeDailyAvgFeedingInterval', () => {
  it('returns empty for no entries', () => {
    expect(computeDailyAvgFeedingInterval([])).toEqual([])
  })

  it('computes average gap between merged sessions', () => {
    const entries = [
      makeEntry({
        entry_type: 'feeding',
        subtype: 'breast',
        occurred_at: '2026-03-10T08:00:00',
        value: 60,
      }),
      makeEntry({
        entry_type: 'feeding',
        subtype: 'breast',
        occurred_at: '2026-03-10T11:00:00',
        value: 60,
      }),
    ]
    const result = computeDailyAvgFeedingInterval(entries)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe(3) // 3 hours gap
  })
})

describe('computeDailyAvgBreastInterval', () => {
  it('only considers breast feedings', () => {
    const entries = [
      makeEntry({
        entry_type: 'feeding',
        subtype: 'breast',
        occurred_at: '2026-03-10T08:00:00',
        value: 60,
      }),
      makeEntry({
        entry_type: 'feeding',
        subtype: 'formula',
        occurred_at: '2026-03-10T09:00:00',
        value: 60,
      }),
      makeEntry({
        entry_type: 'feeding',
        subtype: 'breast',
        occurred_at: '2026-03-10T10:00:00',
        value: 60,
      }),
    ]
    const result = computeDailyAvgBreastInterval(entries)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe(2) // 2 hours between the two breast feedings
  })
})

describe('computeDailyAvgDiaperInterval', () => {
  it('excludes dry diapers', () => {
    const entries = [
      makeEntry({ entry_type: 'diaper', subtype: 'pee', occurred_at: '2026-03-10T08:00:00' }),
      makeEntry({ entry_type: 'diaper', subtype: 'dry', occurred_at: '2026-03-10T09:00:00' }),
      makeEntry({ entry_type: 'diaper', subtype: 'poo', occurred_at: '2026-03-10T11:00:00' }),
    ]
    const result = computeDailyAvgDiaperInterval(entries)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe(3) // 3 hours between pee and poo
  })
})
