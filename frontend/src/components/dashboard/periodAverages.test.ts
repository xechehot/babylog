import { describe, it, expect } from 'vitest'
import { getLoggedDays, pooledAvgGapHours } from './periodAverages'
import type { Entry } from '../../types'

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
