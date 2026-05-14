# Weight Entries Table — Design Spec

**Date:** 2026-05-13
**Feature:** Add a weight log table to the bottom of the Dashboard screen

---

## Overview

Add a `WeightTable` component below the existing WHO charts section on the Dashboard. The table shows every recorded weight entry plus a synthesized birth weight row (from profile), with columns for days elapsed, absolute gain, cumulative gain as % of birth weight, and weekly-normalised gain.

---

## Data Sources

### Birth weight row
- Source: `profile.birth_weight` (grams) and `profile.birth_date` (YYYY-MM-DD)
- This row is always first; it is not a database entry
- All gain columns display "—" for this row

### Subsequent rows
- Source: new all-time weight query — `GET /api/entries?type=weight` with **no date bounds**
- This is a separate TanStack Query from the existing date-bounded `weightData` query used by charts
- Query key: `['entries', { type: 'weight' }]` (no from/to)
- Entries sorted oldest → newest by `occurred_at`

---

## Component

**File:** `src/components/dashboard/WeightTable.tsx`

**Props:**
```typescript
interface WeightTableProps {
  entries: Entry[]           // all-time weight entries, sorted oldest→newest
  birthWeight: number        // grams, from profile
  birthDate: string | null   // YYYY-MM-DD, from profile; null if not set
}
```

**Rendering guard:** Only rendered when `profile.birth_weight` is set (non-null, non-zero).

---

## Columns

| Column | Header | Birth row | Subsequent rows |
|--------|--------|-----------|-----------------|
| Date | DATE | `profile.birth_date` formatted as "15 Jan" | `entry.occurred_at` formatted as "15 Jan" |
| Weight | WEIGHT | `birth_weight / 1000` kg (e.g. "3.250 kg") | `entry.value / 1000` kg |
| Days since prev | DAYS | — | Days between this entry's `occurred_at` and the previous row's date |
| Absolute gain | +G | — | `current.value − prev.value` grams, with sign (e.g. "+320 g", "−150 g") |
| % of birth weight | % BIRTH | — | `(current.value − birth_weight) / birth_weight × 100`, cumulative, with sign |
| Gain per week | G/WEEK | — | `(gain_g / days) × 7` rounded to integer; "—" if days = 0 |

**Notes:**
- For the first non-birth row, "prev" is the birth weight row: `prev.value = birth_weight`, `prev.date = birth_date`
- Date format: `formatDateRu()` (already in utils.ts) — produces "15 Jan" style
- Weights display with 3 decimal places (e.g. "3.250 kg")
- Gain sign: explicitly show "+" for positive, "−" for negative (use minus sign U+2212, not hyphen)
- % column: 1 decimal place, show sign

---

## Math Definitions

```
// For row i (0-indexed over entries, birth row excluded):
prev_date_i  = i === 0 ? birth_date : entry_{i-1}.occurred_at
days_i       = prev_date_i != null ? floor((Date.parse(entry_i.occurred_at) − Date.parse(prev_date_i)) / 86_400_000) : null
gain_g_i     = entry_i.value − (i === 0 ? birth_weight : entry_{i-1}.value)
pct_birth_i  = (entry_i.value − birth_weight) / birth_weight × 100
g_per_week_i = days_i > 0 ? round((gain_g_i / days_i) × 7) : null
```

- `days_i` is null (show "—") when `birth_date` is missing and i = 0
- `days_i` is 0 (g/week shows "—") when two entries share the same calendar date

---

## Dashboard Integration

**New query in `dashboard.tsx`:**
```typescript
const { data: allWeightData } = useQuery({
  queryKey: ['entries', { type: 'weight' }],
  queryFn: () => api.get<{ entries: Entry[] }>('/api/entries?type=weight'),
})
```

**Placement:** After the existing WHO charts block and before the "INTAKE · BY HOUR" section, with its own section header:
```tsx
<Rule label="WEIGHT · LOG" accent={BR.rose} />
<ChartArea>
  <WeightTable
    entries={allWeightData.entries}
    birthWeight={profile.birth_weight}
    birthDate={profile.birth_date}
  />
</ChartArea>
```

**Visibility condition:**
```tsx
{allWeightData && profile.birth_weight && (
  <>
    <Rule label="WEIGHT · LOG" accent={BR.rose} />
    ...
  </>
)}
```

---

## Styling

- Follows existing dashboard aesthetic: monospace font (`BR.mono`), small uppercase headers, muted colour palette
- Table takes full width within `ChartArea` (px-5 padding from parent)
- Header row: 9px uppercase mono, `BR.dim` colour, letter-spacing 2
- Data rows: 11px mono, alternating subtle row tint or plain background
- Negative gains: `BR.blood` colour; positive gains: `BR.lime` (or equivalent positive accent); zero: `BR.dim`
- "—" placeholders: `BR.dim` colour
- No horizontal scrolling — columns sized to fit on mobile

---

## Edge Cases

- `profile.birth_weight` not set → component not rendered
- `profile.birth_date` not set but `birth_weight` set → birth row shows "—" in Date column; first entry's Days column also shows "—"
- No weight entries yet → only birth row shown
- Two entries on same day (days = 0) → g/week shows "—"
- Single weight entry → one data row below birth row, all columns computed normally
