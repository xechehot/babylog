# Dashboard Period Averages + Custom Date Range

**Date:** 2026-04-20
**Scope:** Frontend-only changes to the Dashboard page.

## Problem

The dashboard shows a snapshot for "yesterday" plus per-day charts, but there is no at-a-glance summary of averages across the selected period. The period selector also only supports fixed presets (7D / 14D / 30D); users cannot pick an arbitrary range.

## Goals

1. Let the user pick an arbitrary date range in addition to 7/14/30-day presets.
2. Display per-period averages (per-day rates and pooled intervals) for the selected range.
3. Alert the user when logging gaps exist inside the range so averages are interpreted correctly.

## Non-goals

- No changes to the backend `/api/dashboard` or `/api/entries` endpoints.
- No change to the existing Yesterday summary, All-Time Totals, or chart components.
- No persistence of the chosen custom range across sessions (in-memory only).

## Design

### 1. Period selector (custom range support)

Replace the current `Period` type in [frontend/src/routes/dashboard.tsx](frontend/src/routes/dashboard.tsx) with a discriminated union and extend `PeriodSelector`:

```ts
type PresetDays = 7 | 14 | 30
type RangeSelection =
  | { kind: 'preset'; days: PresetDays }
  | { kind: 'custom'; from: string; to: string }
```

- Buttons: `7D · 14D · 30D · CUSTOM` (unchanged styling — BR theme, mono, 40px min-height).
- When `CUSTOM` is active, two `<input type="date">` fields render below the button row (bordered `BR.line`, mono font, BR theme).
- Clicking `CUSTOM` for the first time seeds the inputs from the currently displayed `from_date` / `to_date`.
- Validation:
  - Empty values: keep the last valid pair; do not dispatch a query with empty dates.
  - `from > to`: keep the last valid pair; highlight the offending input with `BR.blood` border.
  - `to > today`: clamp to today (silently).
- Active query `from_date` / `to_date` are derived from `RangeSelection`:
  - Preset → `getDateRange(days)` (existing helper in [frontend/src/components/dashboard/utils.ts](frontend/src/components/dashboard/utils.ts)).
  - Custom → the validated `{ from, to }` pair.
- The existing `queryKey: ['dashboard', { from_date, to_date }]` already keys on dates, so refetch is automatic.

### 2. Period Averages section

New component `PeriodAverages` rendered between the Yesterday summary and the All-Time Totals. Preceded by `<Rule label="AVERAGES · PER LOGGED DAY" />`.

**Tiles (2-column grid, `ReadoutTile` component):**

| Label | Value | Unit | Accent |
|---|---|---|---|
| INTAKE / DAY | avg feeding ml / logged day | ml | amber (default) |
| BREAST / DAY | avg breast feeding count / logged day | × | rose |
| FORMULA / DAY | avg formula feeding count / logged day | × | amber |
| WET / DAY | avg (pee + pee+poo) count / logged day | × | cyan |
| SOIL / DAY | avg (poo + pee+poo) count / logged day | × | stool |
| FEED INT | pooled avg gap between all feedings | h | amber |
| BREAST INT | pooled avg gap between breast feedings | h | rose |
| FORMULA INT | pooled avg gap between formula feedings | h | amber |
| DIAPER INT | pooled avg gap between non-dry diapers | h | cyan |

Number formatting:
- ml values: `Math.round(v)` → integer.
- per-day counts: one decimal (`v.toFixed(1)`) unless the value is an integer.
- intervals in hours: one decimal (`v.toFixed(1)`).
- Display `—` for any metric with insufficient data (fewer than the required entries).

### 3. Computation

All computation is client-side in a new module `frontend/src/components/dashboard/periodAverages.ts` with unit tests in `periodAverages.test.ts`. No backend changes.

**Inputs:** `days: DashboardDay[]`, `feedingEntries: Entry[]`, `diaperEntries: Entry[]`.

**Logged days (divisor):**

```
loggedDays = distinct set of entry.date across feedingEntries ∪ diaperEntries
           (restricted to dates that fall inside [from_date, to_date])
```

- Per-day averages use `loggedDays.size` as divisor.
- If `loggedDays.size === 0`, all per-day tiles show `—`.

**Per-day averages:**

- `INTAKE / DAY` = sum of `feeding_total_ml` across `days` ÷ `loggedDays.size`.
- `BREAST / DAY` = count of feeding entries with `subtype === 'breast'` ÷ `loggedDays.size`.
- `FORMULA / DAY` = count of feeding entries with `subtype === 'formula'` ÷ `loggedDays.size`.
- `WET / DAY` = count of diaper entries with `subtype ∈ { 'pee', 'pee+poo' }` ÷ `loggedDays.size`.
- `SOIL / DAY` = count of diaper entries with `subtype ∈ { 'poo', 'pee+poo' }` ÷ `loggedDays.size`.

**Pooled intervals:**

Utility `pooledAvgGapHours(entries: { occurred_at: string }[]): number | null`:

1. Sort entries ascending by `occurred_at`.
2. Compute every consecutive gap `(t[i] - t[i-1])` in hours.
3. Exclude gaps shorter than `10 / 60` hours (consistent with existing `computeAvgInterval` at [frontend/src/routes/dashboard.tsx:439](frontend/src/routes/dashboard.tsx:439) — removes parsing-noise duplicates).
4. Return mean of remaining gaps, or `null` if fewer than 2 entries or no gaps survived.
5. **No upper-bound filter** — overnight gaps are included (per user requirement).

Apply to each filtered subset:
- `FEED INT` → all feeding entries.
- `BREAST INT` → `subtype === 'breast'` feeding entries.
- `FORMULA INT` → `subtype === 'formula'` feeding entries.
- `DIAPER INT` → `subtype !== 'dry'` diaper entries.

### 4. Missing-day gap alert

New helper `findMissingDays(from: string, to: string, loggedDays: Set<string>): string[]`:

1. Iterate every calendar date from `from` to `to` inclusive (`YYYY-MM-DD`).
2. Exclude today's date and yesterday's date. Use the existing `getTodayStr` helper (local time) from [frontend/src/components/dashboard/utils.ts](frontend/src/components/dashboard/utils.ts) to compute "today"; derive "yesterday" by subtracting one day in local time via the same formatting helper (not `.toISOString()`, which is UTC and can drift by one day).
3. Return dates not present in `loggedDays`, in ascending order.

Rendered above `Period Averages`, only when the result is non-empty, using the same amber-bordered hint style as the milestones banner in [frontend/src/routes/dashboard.tsx:609-626](frontend/src/routes/dashboard.tsx:609):

```
⚠ MISSING DATA: MAR 12 · MAR 15 · MAR 18
```

- Show up to 5 dates, formatted via `formatDateRu` (existing helper).
- If more than 5: append ` · +N MORE`.
- If 0 missing → do not render the banner.

### 5. File map

**New:**
- `frontend/src/components/dashboard/periodAverages.ts` — pure functions: `computePeriodAverages`, `pooledAvgGapHours`, `findMissingDays`, `getLoggedDays`.
- `frontend/src/components/dashboard/periodAverages.test.ts` — vitest tests.
- `frontend/src/components/dashboard/PeriodAverages.tsx` — presentational component.
- `frontend/src/components/dashboard/MissingDaysBanner.tsx` — presentational component.

**Modified:**
- `frontend/src/routes/dashboard.tsx` — period selector refactor, mount the new components.

### 6. Test plan

**Unit tests** (`periodAverages.test.ts`):
- `getLoggedDays`: empty input → empty set; mixed feeding+diaper entries → union of dates; restricts to range bounds.
- `pooledAvgGapHours`: <2 entries → null; filters gaps <10min; computes mean correctly; no overnight filtering (gap of 10h included).
- `computePeriodAverages`: single logged day with known entries → expected per-day values; zero logged days → nulls; subtype filtering for breast/formula/wet/soil.
- `findMissingDays`: empty `loggedDays` → all range dates except today/yesterday; `from === to` and that date has data → empty; `from === to` with no data → empty (if that date is today or yesterday); mid-range gaps are listed in order.

**Manual QA:**
- Toggle between 7D / 14D / 30D / CUSTOM; observe that averages tiles recalculate and network requests refire.
- Pick a custom range with a known gap → banner appears with the correct dates.
- Pick a custom range including today/yesterday → those dates never appear in the banner even with no entries.
- Pick a 1-day range with at least one entry → intervals show `—` when <2 entries of that type, numeric otherwise.
- `npm run build` passes (tsc -b && vite build).
- Mobile viewport (iOS PWA) — confirm date inputs are tappable and tiles remain readable.

## Out of scope (future)

- Persisting the custom range to the URL or local storage.
- "Best/worst day" callouts.
- Per-period totals (we have per-day and all-time already).
- Comparing the selected period to the prior equivalent period.
