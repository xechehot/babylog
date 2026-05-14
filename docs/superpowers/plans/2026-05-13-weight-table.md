# Weight Entries Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weight log table to the bottom of the Dashboard that shows every recorded weight entry plus a synthesised birth-weight row, with columns for days elapsed, absolute gain, % of birth weight, and weekly-normalised gain.

**Architecture:** Pure frontend change. A new `WeightTable` component owns its own row-computation logic (extracted as a testable pure function `buildWeightRows`). The dashboard adds one new all-time weight query and renders the component after the existing WHO charts block.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS v4, TanStack Query v5

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/components/dashboard/WeightTable.tsx` | **Create** | `buildWeightRows` pure function + `WeightTable` React component |
| `frontend/src/components/dashboard/WeightTable.test.ts` | **Create** | Unit tests for `buildWeightRows` |
| `frontend/src/routes/dashboard.tsx` | **Modify** | Add all-time weight query; import and render `WeightTable` |

---

## Task 1: `buildWeightRows` — pure function with tests

**Files:**
- Create: `frontend/src/components/dashboard/WeightTable.tsx`
- Create: `frontend/src/components/dashboard/WeightTable.test.ts`

- [ ] **Step 1: Create the file with the pure function**

Create `frontend/src/components/dashboard/WeightTable.tsx` with the following content (React component added in Task 2):

```typescript
import type { CSSProperties } from 'react'
import type { Entry } from '../../types'
import { BR } from '../br/theme'
import { formatDateRu } from './utils'

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
```

- [ ] **Step 2: Write failing tests**

Create `frontend/src/components/dashboard/WeightTable.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run tests and confirm they fail**

```bash
cd frontend && npm run test -- WeightTable
```

Expected: All tests fail with "buildWeightRows is not a function" or import errors (the file exists but the tests will fail because the test file will be picked up before it can reference the correct export — actually since we created the file in step 1, tests should fail only if something is wrong, or PASS if the implementation is correct already). If they pass, move on.

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd frontend && npm run test -- WeightTable
```

Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/WeightTable.tsx frontend/src/components/dashboard/WeightTable.test.ts
git commit -m "feat: add buildWeightRows pure function with tests"
```

---

## Task 2: `WeightTable` React component

**Files:**
- Modify: `frontend/src/components/dashboard/WeightTable.tsx` (add component after `buildWeightRows`)

- [ ] **Step 1: Append the React component**

Append the following to `frontend/src/components/dashboard/WeightTable.tsx` (after the existing `buildWeightRows` function). The `CSSProperties`, `BR`, and `formatDateRu` imports are already at the top of the file from Task 1.

```typescript
function fmtKg(grams: number): string {
  return (grams / 1000).toFixed(3) + ' kg'
}

function fmtGain(g: number | null): { text: string; color: string } {
  if (g === null) return { text: '—', color: BR.dim }
  if (g === 0) return { text: '±0 g', color: BR.dim }
  const sign = g > 0 ? '+' : '−'
  return {
    text: `${sign}${Math.abs(g)} g`,
    color: g > 0 ? BR.cyan : BR.blood,
  }
}

function fmtPct(pct: number | null): { text: string; color: string } {
  if (pct === null) return { text: '—', color: BR.dim }
  if (Math.abs(pct) < 0.05) return { text: '±0.0%', color: BR.dim }
  const sign = pct > 0 ? '+' : '−'
  return {
    text: `${sign}${Math.abs(pct).toFixed(1)}%`,
    color: pct > 0 ? BR.cyan : BR.blood,
  }
}

function fmtGPerWeek(gpw: number | null): { text: string; color: string } {
  if (gpw === null) return { text: '—', color: BR.dim }
  if (gpw === 0) return { text: '±0', color: BR.dim }
  const sign = gpw > 0 ? '+' : '−'
  return {
    text: `${sign}${Math.abs(gpw)}`,
    color: gpw > 0 ? BR.cyan : BR.blood,
  }
}

interface WeightTableProps {
  entries: Entry[]
  birthWeight: number
  birthDate: string | null
}

export function WeightTable({ entries, birthWeight, birthDate }: WeightTableProps) {
  const rows = buildWeightRows(entries, birthWeight, birthDate)

  const headerStyle: React.CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: BR.dim,
    textTransform: 'uppercase' as const,
    paddingBottom: 4,
    paddingTop: 2,
  }

  const cellStyle: React.CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 11,
    paddingTop: 5,
    paddingBottom: 5,
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['DATE', 'WEIGHT', 'DAYS', '+G', '% BIRTH', 'G/WK'].map((h) => (
              <th key={h} style={{ ...headerStyle, textAlign: 'left', fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const gain = fmtGain(row.gainGrams)
            const pct = fmtPct(row.pctBirth)
            const gpw = fmtGPerWeek(row.gPerWeek)
            return (
              <tr key={i} style={{ borderTop: `1px solid rgba(215,200,180,0.08)` }}>
                <td style={{ ...cellStyle, color: row.isBirth ? BR.rose : 'rgba(215,200,180,0.7)', paddingRight: 8 }}>
                  {row.dateStr ? formatDateRu(row.dateStr) : '—'}
                  {row.isBirth && (
                    <span style={{ color: BR.dim, marginLeft: 4, fontSize: 9 }}>★</span>
                  )}
                </td>
                <td style={{ ...cellStyle, color: 'rgba(215,200,180,0.9)', paddingRight: 8 }}>
                  {fmtKg(row.weightGrams)}
                </td>
                <td style={{ ...cellStyle, color: BR.dim, paddingRight: 8 }}>
                  {row.days != null ? row.days : '—'}
                </td>
                <td style={{ ...cellStyle, color: gain.color, paddingRight: 8 }}>
                  {gain.text}
                </td>
                <td style={{ ...cellStyle, color: pct.color, paddingRight: 8 }}>
                  {pct.text}
                </td>
                <td style={{ ...cellStyle, color: gpw.color }}>
                  {gpw.text}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors in WeightTable.tsx.

- [ ] **Step 4: Run tests to confirm they still pass**

```bash
cd frontend && npm run test -- WeightTable
```

Expected: All 9 tests still pass (component code doesn't affect pure function tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/WeightTable.tsx
git commit -m "feat: add WeightTable React component"
```

---

## Task 3: Dashboard integration

**Files:**
- Modify: `frontend/src/routes/dashboard.tsx`
  - Add import for `WeightTable`
  - Add all-time weight query
  - Add render block after WHO charts

- [ ] **Step 1: Add import**

In `frontend/src/routes/dashboard.tsx`, find the existing imports block (around line 18–19):

```typescript
import { WeightChart } from '../components/dashboard/WeightChart'
import { WeeklyGainBarChart } from '../components/dashboard/WeeklyGainBarChart'
```

Add after those two lines:

```typescript
import { WeightTable } from '../components/dashboard/WeightTable'
```

- [ ] **Step 2: Add the all-time weight query**

In `DashboardPage()`, after the existing `weightData` query (currently around line 85–91):

```typescript
const { data: weightData } = useQuery({
  queryKey: ['entries', { type: 'weight', from_date, to_date }],
  queryFn: () =>
    api.get<{ entries: Entry[] }>(
      `/api/entries?type=weight&from_date=${from_date}&to_date=${to_date}`,
    ),
})
```

Add:

```typescript
const { data: allWeightData } = useQuery({
  queryKey: ['entries', { type: 'weight' }],
  queryFn: () => api.get<{ entries: Entry[] }>('/api/entries?type=weight'),
})
```

- [ ] **Step 3: Add the render block**

Find the block ending the WHO charts section (currently around line 274–283):

```tsx
          )}

          {feedingData && feedingData.entries.length > 0 && (
            <>
              <Rule label="INTAKE · BY HOUR" />
```

Insert the WeightTable section between those two blocks:

```tsx
          )}

          {allWeightData && profile.birth_weight && (
            <>
              <Rule label="WEIGHT · LOG" accent={BR.rose} />
              <ChartArea>
                <WeightTable
                  entries={allWeightData.entries}
                  birthWeight={profile.birth_weight}
                  birthDate={profile.birth_date ?? null}
                />
              </ChartArea>
            </>
          )}

          {feedingData && feedingData.entries.length > 0 && (
            <>
              <Rule label="INTAKE · BY HOUR" />
```

- [ ] **Step 4: Build and verify no TypeScript errors**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: clean build, no errors.

- [ ] **Step 5: Run all frontend tests**

```bash
cd frontend && npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit and push**

```bash
git add frontend/src/routes/dashboard.tsx
git commit -m "feat: add weight log table to dashboard"
git push
```
