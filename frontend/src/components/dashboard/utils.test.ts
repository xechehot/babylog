import { describe, it, expect } from 'vitest'
import { mergeCloseFeedings, formatDateRu, getDateRange, formatDateRuFull } from './utils'
import type { Entry } from '../../types'

function makeFeeding(occurred_at: string, value: number): Entry {
  return {
    id: 0,
    upload_id: null,
    entry_type: 'feeding',
    subtype: 'breast',
    occurred_at,
    date: occurred_at.slice(0, 10),
    value,
    notes: null,
    confidence: null,
    raw_text: null,
    confirmed: false,
    created_at: occurred_at,
    updated_at: occurred_at,
  }
}

describe('mergeCloseFeedings', () => {
  it('returns empty for no entries', () => {
    expect(mergeCloseFeedings([])).toEqual([])
  })

  it('returns single feeding unchanged', () => {
    const entries = [makeFeeding('2026-03-10T08:00:00', 60)]
    const merged = mergeCloseFeedings(entries)
    expect(merged).toHaveLength(1)
    expect(merged[0].value).toBe(60)
  })

  it('merges feedings within 20 minutes', () => {
    const entries = [makeFeeding('2026-03-10T08:00:00', 30), makeFeeding('2026-03-10T08:15:00', 40)]
    const merged = mergeCloseFeedings(entries)
    expect(merged).toHaveLength(1)
    expect(merged[0].value).toBe(70)
    expect(merged[0].occurred_at).toBe('2026-03-10T08:15:00')
  })

  it('does not merge feedings more than 20 minutes apart', () => {
    const entries = [makeFeeding('2026-03-10T08:00:00', 30), makeFeeding('2026-03-10T08:30:00', 40)]
    const merged = mergeCloseFeedings(entries)
    expect(merged).toHaveLength(2)
  })

  it('filters out non-feeding entries', () => {
    const entries = [{ ...makeFeeding('2026-03-10T08:00:00', 60), entry_type: 'diaper' as const }]
    const merged = mergeCloseFeedings(entries)
    expect(merged).toHaveLength(0)
  })

  it('filters out zero-value feedings', () => {
    const entries = [makeFeeding('2026-03-10T08:00:00', 0)]
    const merged = mergeCloseFeedings(entries)
    expect(merged).toHaveLength(0)
  })

  it('handles chain of close feedings', () => {
    const entries = [
      makeFeeding('2026-03-10T08:00:00', 20),
      makeFeeding('2026-03-10T08:10:00', 20),
      makeFeeding('2026-03-10T08:20:00', 20),
    ]
    const merged = mergeCloseFeedings(entries)
    expect(merged).toHaveLength(1)
    expect(merged[0].value).toBe(60)
  })
})

describe('formatDateRu', () => {
  it('formats date as "day month_short"', () => {
    expect(formatDateRu('2026-03-01')).toBe('1 Mar')
    expect(formatDateRu('2026-01-15')).toBe('15 Jan')
    expect(formatDateRu('2026-12-25')).toBe('25 Dec')
  })
})

describe('formatDateRuFull', () => {
  it('includes day of week', () => {
    // 2026-03-10 is a Tuesday
    const result = formatDateRuFull('2026-03-10')
    expect(result).toContain('10')
    expect(result).toContain('Mar')
    expect(result).toContain('Tuesday')
  })
})

describe('getDateRange', () => {
  it('returns from_date and to_date strings', () => {
    const range = getDateRange(7)
    expect(range.from_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(range.to_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('range of 1 day means from == to', () => {
    const range = getDateRange(1)
    expect(range.from_date).toBe(range.to_date)
  })
})
