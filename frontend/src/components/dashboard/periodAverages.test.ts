import { describe, it, expect } from 'vitest'
import { getLoggedDays } from './periodAverages'
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
