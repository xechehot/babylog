# Dashboard Period Averages + Custom Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Period Averages" summary section and a custom date range picker to the Dashboard page; surface a banner when logging gaps exist in the selected range.

**Architecture:** Frontend-only. Pure-function module (`periodAverages.ts`) computes per-logged-day averages, pooled gap intervals, and missing-day lists from data already fetched by the dashboard page. Two new presentational components (`PeriodAverages.tsx`, `MissingDaysBanner.tsx`) render the results using the existing `ReadoutTile` + BR theme. The period selector state is widened to a discriminated union (`preset | custom`) and a `CUSTOM` button reveals two `<input type="date">` fields.

**Tech Stack:** React 19, TypeScript, Vitest, TanStack Query, Tailwind v4, the existing BR neo-noir component library (`frontend/src/components/br/*`).

**Spec:** [docs/superpowers/specs/2026-04-20-dashboard-period-averages-design.md](docs/superpowers/specs/2026-04-20-dashboard-period-averages-design.md)

**Running tests:** `cd frontend && npm test` (vitest run) or a single file with `npm test -- periodAverages`.
**Build check:** `cd frontend && npm run build` (tsc -b && vite build).

---

## File Structure

**New files:**
- `frontend/src/components/dashboard/periodAverages.ts` — pure functions (`getLoggedDays`, `pooledAvgGapHours`, `computePeriodAverages`, `findMissingDays`).
- `frontend/src/components/dashboard/periodAverages.test.ts` — Vitest tests.
- `frontend/src/components/dashboard/PeriodAverages.tsx` — 9-tile presentational component.
- `frontend/src/components/dashboard/MissingDaysBanner.tsx` — amber-bordered banner.

**Modified:**
- `frontend/src/routes/dashboard.tsx` — widen selector state, mount new components.

---

## Task 1: `getLoggedDays` helper

Returns the set of dates (in `YYYY-MM-DD` form) that fall inside `[from, to]` and have at least one entry in either the feeding or diaper list. This set is the divisor for every per-day average.

**Files:**
- Create: `frontend/src/components/dashboard/periodAverages.ts`
- Test: `frontend/src/components/dashboard/periodAverages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/dashboard/periodAverages.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- periodAverages`
Expected: FAIL — cannot find module `./periodAverages`.

- [ ] **Step 3: Create `periodAverages.ts` with minimal implementation**

Create `frontend/src/components/dashboard/periodAverages.ts`:

```ts
import type { Entry } from '../../types'

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- periodAverages`
Expected: PASS — 4 tests in `getLoggedDays`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/periodAverages.ts frontend/src/components/dashboard/periodAverages.test.ts
git commit -m "feat(dashboard): add getLoggedDays helper"
```

---

## Task 2: `pooledAvgGapHours` helper

Computes the mean of consecutive gaps (in hours) across a sorted list of entries. Drops sub-10-minute gaps (parsing noise). No overnight cap.

**Files:**
- Modify: `frontend/src/components/dashboard/periodAverages.ts`
- Modify: `frontend/src/components/dashboard/periodAverages.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `frontend/src/components/dashboard/periodAverages.test.ts`:

```ts
import { pooledAvgGapHours } from './periodAverages'

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- periodAverages`
Expected: FAIL — `pooledAvgGapHours` is not exported.

- [ ] **Step 3: Add implementation**

Append to `frontend/src/components/dashboard/periodAverages.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- periodAverages`
Expected: PASS — all `pooledAvgGapHours` tests pass plus the existing `getLoggedDays` tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/periodAverages.ts frontend/src/components/dashboard/periodAverages.test.ts
git commit -m "feat(dashboard): add pooledAvgGapHours helper"
```

---

## Task 3: `computePeriodAverages` aggregator

Combines the two helpers into a single object with nine numeric (or null) fields consumed by the UI.

**Files:**
- Modify: `frontend/src/components/dashboard/periodAverages.ts`
- Modify: `frontend/src/components/dashboard/periodAverages.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `frontend/src/components/dashboard/periodAverages.test.ts`:

```ts
import { computePeriodAverages } from './periodAverages'
import type { DashboardDay } from '../../types'

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

describe('computePeriodAverages', () => {
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- periodAverages`
Expected: FAIL — `computePeriodAverages` is not exported.

- [ ] **Step 3: Add implementation**

Append to `frontend/src/components/dashboard/periodAverages.ts`:

```ts
import type { DashboardDay } from '../../types'

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- periodAverages`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/periodAverages.ts frontend/src/components/dashboard/periodAverages.test.ts
git commit -m "feat(dashboard): add computePeriodAverages aggregator"
```

---

## Task 4: `findMissingDays` helper

Returns the sorted list of calendar dates in `[from, to]` that are not in the logged-days set. Excludes today and yesterday (local time) so mid-day "haven't logged yet" gaps do not trigger the banner.

**Files:**
- Modify: `frontend/src/components/dashboard/periodAverages.ts`
- Modify: `frontend/src/components/dashboard/periodAverages.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `frontend/src/components/dashboard/periodAverages.test.ts`:

```ts
import { findMissingDays } from './periodAverages'

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- periodAverages`
Expected: FAIL — `findMissingDays` is not exported.

- [ ] **Step 3: Add implementation**

Append to `frontend/src/components/dashboard/periodAverages.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- periodAverages`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/periodAverages.ts frontend/src/components/dashboard/periodAverages.test.ts
git commit -m "feat(dashboard): add findMissingDays helper"
```

---

## Task 5: `PeriodAverages` component

Presentational — 9 tiles in a 2-column grid using existing `ReadoutTile`. Displays `—` for null values.

**Files:**
- Create: `frontend/src/components/dashboard/PeriodAverages.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/PeriodAverages.tsx`:

```tsx
import { BR } from '../br/theme'
import { ReadoutTile } from '../br/ReadoutTile'
import type { PeriodAveragesResult } from './periodAverages'

function fmtCount(v: number | null): string {
  if (v == null) return '—'
  return v.toFixed(1)
}

function fmtHours(v: number | null): string {
  if (v == null) return '—'
  return v.toFixed(1)
}

function fmtMl(v: number | null): string {
  if (v == null) return '—'
  return Math.round(v).toString()
}

export function PeriodAverages({ result }: { result: PeriodAveragesResult }) {
  const n = result.loggedDayCount
  return (
    <div className="px-5 grid grid-cols-2 gap-3">
      <ReadoutTile
        label="INTAKE / DAY"
        value={fmtMl(result.mlPerDay)}
        unit="ml"
        note={n > 0 ? `${n} logged day${n === 1 ? '' : 's'}` : undefined}
      />
      <ReadoutTile
        label="BREAST / DAY"
        value={fmtCount(result.breastPerDay)}
        unit="×"
        accent={BR.rose}
      />
      <ReadoutTile label="FORMULA / DAY" value={fmtCount(result.formulaPerDay)} unit="×" />
      <ReadoutTile
        label="WET / DAY"
        value={fmtCount(result.wetPerDay)}
        unit="×"
        accent={BR.cyan}
      />
      <ReadoutTile
        label="SOIL / DAY"
        value={fmtCount(result.soilPerDay)}
        unit="×"
        accent={BR.stool}
      />
      <ReadoutTile label="FEED INT" value={fmtHours(result.feedingInterval)} unit="h" />
      <ReadoutTile
        label="BREAST INT"
        value={fmtHours(result.breastInterval)}
        unit="h"
        accent={BR.rose}
      />
      <ReadoutTile label="FORMULA INT" value={fmtHours(result.formulaInterval)} unit="h" />
      <ReadoutTile
        label="DIAPER INT"
        value={fmtHours(result.diaperInterval)}
        unit="h"
        accent={BR.cyan}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/PeriodAverages.tsx
git commit -m "feat(dashboard): add PeriodAverages component"
```

---

## Task 6: `MissingDaysBanner` component

Amber-bordered banner, hidden when list is empty. Shows up to 5 dates, then `· +N MORE`.

**Files:**
- Create: `frontend/src/components/dashboard/MissingDaysBanner.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/MissingDaysBanner.tsx`:

```tsx
import { BR } from '../br/theme'
import { formatDateRu } from './utils'

const MAX_DATES_SHOWN = 5

export function MissingDaysBanner({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null
  const shown = missing.slice(0, MAX_DATES_SHOWN).map(formatDateRu).join(' · ')
  const extra = missing.length - MAX_DATES_SHOWN
  const suffix = extra > 0 ? ` · +${extra} MORE` : ''
  return (
    <div
      className="mx-5 mt-3 px-3 py-2 uppercase"
      style={{
        border: `1px solid ${BR.amber}`,
        background: 'rgba(255,179,71,0.06)',
        fontFamily: BR.mono,
        fontSize: 10,
        letterSpacing: 1.5,
        color: BR.amber,
        textShadow: `0 0 8px ${BR.amberGlow}`,
      }}
    >
      ⚠ MISSING DATA: {shown}
      {suffix}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/MissingDaysBanner.tsx
git commit -m "feat(dashboard): add MissingDaysBanner component"
```

---

## Task 7: Refactor `PeriodSelector` for custom range

Widen state to a discriminated union, add a `CUSTOM` button, and render two `<input type="date">` fields when custom is active. Validate: clamp `to` to today, require `from <= to`.

**Files:**
- Modify: `frontend/src/routes/dashboard.tsx`

- [ ] **Step 1: Replace the `Period` type and `PeriodSelector` usages**

Open `frontend/src/routes/dashboard.tsx`. Near the top (around line 39):

Replace:

```ts
type Period = 7 | 14 | 30
const PERIODS: Period[] = [7, 14, 30]
```

With:

```ts
type PresetDays = 7 | 14 | 30
const PRESETS: PresetDays[] = [7, 14, 30]

type RangeSelection =
  | { kind: 'preset'; days: PresetDays }
  | { kind: 'custom'; from: string; to: string }
```

- [ ] **Step 2: Update `DashboardPage` to use `RangeSelection`**

Import `getTodayStr` near the existing `getDateRange` import:

```ts
import { getDateRange, getTodayStr, formatDateRu } from '../components/dashboard/utils'
```

Replace inside `DashboardPage`:

```ts
const [period, setPeriod] = useState<Period>(7)
const { from_date, to_date } = getDateRange(period)
```

With:

```ts
const [selection, setSelection] = useState<RangeSelection>({ kind: 'preset', days: 7 })
const { from_date, to_date } =
  selection.kind === 'preset'
    ? getDateRange(selection.days)
    : { from_date: selection.from, to_date: selection.to }
```

Update the `<PeriodSelector ...>` render to pass the new props:

Replace:

```tsx
<PeriodSelector period={period} onChange={setPeriod} />
```

With:

```tsx
<PeriodSelector selection={selection} onChange={setSelection} />
```

- [ ] **Step 3: Replace the `PeriodSelector` component**

Replace the entire existing `PeriodSelector` function (currently at [frontend/src/routes/dashboard.tsx:269](frontend/src/routes/dashboard.tsx:269)) with:

```tsx
function PeriodSelector({
  selection,
  onChange,
}: {
  selection: RangeSelection
  onChange: (s: RangeSelection) => void
}) {
  const today = getTodayStr()
  const custom = selection.kind === 'custom'
  // Seed the inputs from the currently-active range when switching to custom.
  const initialFrom =
    selection.kind === 'custom' ? selection.from : getDateRange(selection.days).from_date
  const initialTo = custom ? selection.to : today

  function setCustom(from: string, to: string) {
    // Clamp `to` to today.
    const clampedTo = to > today ? today : to
    // Require non-empty; require from <= to.
    if (!from || !clampedTo || from > clampedTo) return
    onChange({ kind: 'custom', from, to: clampedTo })
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex gap-2 flex-wrap"
        style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2 }}
      >
        {PRESETS.map((p) => {
          const on = selection.kind === 'preset' && selection.days === p
          return (
            <button
              key={p}
              onClick={() => onChange({ kind: 'preset', days: p })}
              className="uppercase"
              style={{
                padding: '8px 14px',
                border: `1px solid ${on ? BR.amber : BR.line}`,
                color: on ? BR.amber : BR.dim,
                background: on ? 'rgba(255,179,71,0.08)' : 'transparent',
                textShadow: on ? `0 0 8px ${BR.amberGlow}` : 'none',
                minHeight: 40,
              }}
            >
              {p}D
            </button>
          )
        })}
        <button
          key="custom"
          onClick={() =>
            custom ? undefined : onChange({ kind: 'custom', from: initialFrom, to: initialTo })
          }
          className="uppercase"
          style={{
            padding: '8px 14px',
            border: `1px solid ${custom ? BR.amber : BR.line}`,
            color: custom ? BR.amber : BR.dim,
            background: custom ? 'rgba(255,179,71,0.08)' : 'transparent',
            textShadow: custom ? `0 0 8px ${BR.amberGlow}` : 'none',
            minHeight: 40,
          }}
        >
          CUSTOM
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 uppercase" style={{ color: BR.dim }}>
          <span>LIVE</span>
          <span
            className="inline-block rounded-full"
            style={{
              width: 6,
              height: 6,
              background: BR.amber,
              boxShadow: `0 0 8px ${BR.amberGlow}`,
              animation: 'brPulse 1.4s infinite ease-in-out',
            }}
          />
        </div>
      </div>
      {custom && (
        <div
          className="flex gap-2 items-center"
          style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 1.5 }}
        >
          <input
            type="date"
            value={selection.from}
            max={selection.to}
            onChange={(e) => setCustom(e.target.value, selection.to)}
            style={{
              padding: '6px 10px',
              border: `1px solid ${BR.line}`,
              color: BR.text,
              background: BR.char,
              fontFamily: BR.mono,
              fontSize: 11,
              colorScheme: 'dark',
            }}
          />
          <span style={{ color: BR.dim }}>→</span>
          <input
            type="date"
            value={selection.to}
            min={selection.from}
            max={today}
            onChange={(e) => setCustom(selection.from, e.target.value)}
            style={{
              padding: '6px 10px',
              border: `1px solid ${BR.line}`,
              color: BR.text,
              background: BR.char,
              fontFamily: BR.mono,
              fontSize: 11,
              colorScheme: 'dark',
            }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/dashboard.tsx
git commit -m "feat(dashboard): add custom date range to period selector"
```

---

## Task 8: Mount `MissingDaysBanner` and `PeriodAverages` in the dashboard

Wire the new helpers and components into `DashboardPage`. Banner and averages are placed between the Yesterday summary and the All-Time Totals block.

**Files:**
- Modify: `frontend/src/routes/dashboard.tsx`

- [ ] **Step 1: Add imports**

Near the existing dashboard-component imports, add:

```ts
import { PeriodAverages } from '../components/dashboard/PeriodAverages'
import { MissingDaysBanner } from '../components/dashboard/MissingDaysBanner'
import {
  computePeriodAverages,
  findMissingDays,
  getLoggedDays,
} from '../components/dashboard/periodAverages'
```

- [ ] **Step 2: Compute period values inside `DashboardPage`**

Immediately after the block that derives `yesterdayFeedings` / `yesterdayDiapers` (around [dashboard.tsx:83-86](frontend/src/routes/dashboard.tsx:83)), add:

```ts
const allFeedings = feedingData?.entries ?? []
const allDiapers = diaperData?.entries ?? []
const loggedDays = getLoggedDays(allFeedings, allDiapers, from_date, to_date)
const periodResult = computePeriodAverages({
  days,
  feedingEntries: allFeedings,
  diaperEntries: allDiapers,
  from: from_date,
  to: to_date,
})
const missingDays = findMissingDays(from_date, to_date, loggedDays, getTodayStr())
```

- [ ] **Step 3: Render the new section between Yesterday and All-Time Totals**

In the JSX returned by `DashboardPage`, locate the block:

```tsx
          <Rule label="TOTALS · ALL-TIME" accent={BR.cyan} />
          <AllTimeTotals totals={data.all_time_totals} />
```

Insert the following **above** that block (i.e., after `<YesterdaySummary ... />`):

```tsx
          <MissingDaysBanner missing={missingDays} />
          <Rule label="AVERAGES · PER LOGGED DAY" />
          <PeriodAverages result={periodResult} />
```

- [ ] **Step 4: Run tests and build**

Run: `cd frontend && npm test && npm run build`
Expected: All tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/dashboard.tsx
git commit -m "feat(dashboard): mount period averages and missing-days banner"
```

---

## Task 9: Manual QA + final push

Verify the feature works end-to-end in the browser.

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

Open the dashboard in the browser (via the usual local URL).

- [ ] **Step 2: QA checklist**

- [ ] Toggle between 7D / 14D / 30D buttons — tiles recalculate and the highlighted preset updates.
- [ ] Click CUSTOM — two date inputs appear below the buttons, seeded to the current range.
- [ ] Change the `from` input to an earlier date — dashboard refetches and the averages update.
- [ ] Try to set `to` beyond today — the input clamps (has `max={today}`) and does not break state.
- [ ] Pick a range you know has a missing day (but not today/yesterday) — the amber `⚠ MISSING DATA:` banner appears with the correct date(s).
- [ ] Pick a range where only today/yesterday have no data — banner does **not** appear.
- [ ] With few or no entries of a given type, the corresponding tile displays `—`.
- [ ] Mobile viewport (iOS simulator or narrow browser): tiles stay in 2 columns and remain legible; date inputs are tappable.

- [ ] **Step 3: Stop the dev server and push**

Push the branch:

```bash
git push -u origin HEAD
```

- [ ] **Step 4: Confirm plan complete**

All nine tasks should now be committed on the branch and the feature should work end-to-end. No further code changes required for this plan.

---

## Spec coverage map

| Spec requirement | Task |
|---|---|
| Custom range button + date inputs + validation | Task 7 |
| `RangeSelection` type | Task 7 |
| `INTAKE/DAY`, `BREAST/DAY`, `FORMULA/DAY`, `WET/DAY`, `SOIL/DAY` tiles | Tasks 3, 5 |
| `FEED INT`, `BREAST INT`, `FORMULA INT`, `DIAPER INT` tiles | Tasks 3, 5 |
| Logged-days divisor | Tasks 1, 3 |
| Pooled interval, 10-min floor, no overnight cap | Task 2 |
| Missing-day banner with today/yesterday exclusion | Tasks 4, 6, 8 |
| Banner truncation at 5 dates + `+N MORE` | Task 6 |
| Placement between Yesterday and All-Time | Task 8 |
| Unit tests for helpers | Tasks 1-4 |
| Build & manual QA | Tasks 8, 9 |
