import { describe, it, expect } from 'vitest'
import { buildWeightRows } from './WeightTable'
import type { Entry } from '../../types'

function makeWeight(date: string, grams: number): Entry {
  return {
    id: 1,
    upload_id: null,
    entry_type: 'weight',
    subtype: null,
    occurred_at: date + 'T10:00:00',
    date,
    value: grams,
    notes: null,
    confidence: null,
    raw_text: null,
    confirmed: false,
    created_at: date + 'T10:00:00',
    updated_at: date + 'T10:00:00',
  }
}

describe('buildWeightRows', () => {
  it('returns only birth row when entries is empty', () => {
    const rows = buildWeightRows([], 3200, '2024-01-15')
    expect(rows).toHaveLength(1)
    expect(rows[0].isBirth).toBe(true)
    expect(rows[0].weightGrams).toBe(3200)
    expect(rows[0].dateStr).toBe('2024-01-15')
    expect(rows[0].gainGrams).toBeNull()
    expect(rows[0].pctBirth).toBeNull()
    expect(rows[0].gPerWeek).toBeNull()
    expect(rows[0].days).toBeNull()
  })

  it('computes gain from birth weight for first entry', () => {
    const entries = [makeWeight('2024-01-22', 3500)]
    const rows = buildWeightRows(entries, 3200, '2024-01-15')
    expect(rows).toHaveLength(2)
    const row = rows[1]
    expect(row.isBirth).toBe(false)
    expect(row.weightGrams).toBe(3500)
    expect(row.days).toBe(7)
    expect(row.gainGrams).toBe(300)
    expect(row.pctBirth).toBeCloseTo(9.375, 2)
    expect(row.gPerWeek).toBe(300) // 300g in 7 days = 300 g/week
  })

  it('computes gain between two entries', () => {
    const entries = [makeWeight('2024-01-22', 3500), makeWeight('2024-02-05', 4100)]
    const rows = buildWeightRows(entries, 3200, '2024-01-15')
    expect(rows).toHaveLength(3)
    const row = rows[2]
    expect(row.days).toBe(14)
    expect(row.gainGrams).toBe(600)
    expect(row.pctBirth).toBeCloseTo(28.125, 2) // (4100-3200)/3200*100
    expect(row.gPerWeek).toBe(300) // 600g / 14 days * 7 = 300 g/week
  })

  it('sets days and gPerWeek to null when birth_date is missing and it is the first entry', () => {
    const entries = [makeWeight('2024-01-22', 3500)]
    const rows = buildWeightRows(entries, 3200, null)
    expect(rows[1].days).toBeNull()
    expect(rows[1].gPerWeek).toBeNull()
  })

  it('sets gPerWeek to null when days is 0', () => {
    const entries = [makeWeight('2024-01-15', 3100), makeWeight('2024-01-15', 3150)]
    const rows = buildWeightRows(entries, 3200, '2024-01-15')
    // first entry: days from birth = 0
    expect(rows[1].days).toBe(0)
    expect(rows[1].gPerWeek).toBeNull()
  })

  it('filters out entries with null or zero value', () => {
    const bad: Entry = { ...makeWeight('2024-01-20', 0), value: null }
    const good = makeWeight('2024-01-22', 3500)
    const rows = buildWeightRows([bad, good], 3200, '2024-01-15')
    expect(rows).toHaveLength(2) // birth + good
  })

  it('sorts entries oldest-first regardless of input order', () => {
    const entries = [makeWeight('2024-02-05', 4100), makeWeight('2024-01-22', 3500)]
    const rows = buildWeightRows(entries, 3200, '2024-01-15')
    expect(rows[1].weightGrams).toBe(3500)
    expect(rows[2].weightGrams).toBe(4100)
  })

  it('shows birth row with null dateStr when birth_date is null', () => {
    const rows = buildWeightRows([], 3200, null)
    expect(rows[0].dateStr).toBeNull()
  })

  it('handles negative gain (weight loss)', () => {
    const entries = [makeWeight('2024-01-22', 3000)]
    const rows = buildWeightRows(entries, 3200, '2024-01-15')
    expect(rows[1].gainGrams).toBe(-200)
    expect(rows[1].pctBirth).toBeCloseTo(-6.25, 2)
    expect(rows[1].gPerWeek).toBe(-200) // -200g in 7 days = -200 g/week
  })
})
