# Feeding Predictor — Design Spec

**Date:** 2026-08-05
**Feature:** A standalone screen where the parent enters the last feeding (time + optional ml) and gets a predicted time and volume for the next feeding. Day and night are modelled separately.

---

## Overview

At night the parent wants one thing: *when will the baby wake next, and how much will they take?* This adds a `/night` screen with two inputs (time, optional ml) and one large result card showing a predicted time with an uncertainty range, plus a predicted volume with a range.

The prediction is computed on the backend from the parent's own feeding history. Nothing is written to the database — the screen is a calculator, not a logging surface.

---

## Empirical Basis

The model was chosen after measuring the actual data (1145 merged feeding sessions, 2026-02-25 → 2026-08-02). Three findings drove the design:

1. **Volume predicts gap length.** Correlation between a feed's volume and the gap that follows it is r ≈ 0.39–0.52 over 60-day windows. This is real signal, not noise, and it is the core of the model.

2. **The pattern drifts fast.** Median night gap was 3.6h all-time but 4.6h over the last 30 days; typical feed volume grew 110ml → 156ml over the same period. A model trained on all history badly under-predicts. **Recency windowing is mandatory, not an optimisation.**

3. **Breast feeds are often unmeasured and cluster with bottles.** In the last 30 days, 128 breast feedings carry no ml value while all 194 formula feedings do. Unmeasured feeds are followed by another feed in ~40 minutes (median 0.63h) — they are top-ups within one waking, not separate wakeups. The 20-minute merge window used elsewhere in the app is too tight here; **45 minutes** raises the 30-day p25 gap from 1.83h to 3.33h (removing top-up artifacts) while barely reducing sample size.

Validation: 150ml entered at 01:15 predicts **05:31** on a 30-day window, matching the parent's own intuition of "about 5:30".

---

## Architecture

### Backend

**`app/services/feeding_predictor.py`** — pure module, no FastAPI and no database imports. Takes a list of feeding records and returns a prediction. All statistics live here so they can be unit-tested against fabricated data.

**`app/routers/predict.py`** — thin router: queries entries, delegates, returns the model.

**`app/models/predict.py`** — Pydantic response model.

### Frontend

**`src/routes/night.tsx`** — the screen.
**`src/components/BottomNav.tsx`** — add a fifth tab with a moon icon.

The app's existing theme is dark amber-on-black (`BR` theme), which already suits night use. No new theming.

---

## Prediction Algorithm

Input: `at` (datetime of the feed just given), `ml` (optional int).

### 1. Window selection

Candidate windows are **30 days**, **60 days**, then all history. Widening is driven by two independent reasons:

1. **Too few gaps** — fewer than **15** in the sample the estimate will use (**measured** gaps when `ml` is provided, **unmeasured** when it is not).
2. **No usable fit** — the window holds enough gaps, but they say nothing about volume (fewer than 15 measured, non-positive slope, or r < 0.2).

The second reason matters as much as the first. A window can be rich in data yet flat in signal, and stopping there silently ignores the volume the parent typed. Real example: the 30-day night window holds 63 measured gaps at r = 0.19, just under the guard, while the 60-day window reaches r = 0.34 — the difference between volume mattering and being discarded.

When **no** window supports a fit, the narrowest window with enough gaps wins: a recent median beats a stale one. The window actually used is reported in the response.

### 2. Sessionize

Merge consecutive feeding entries into sessions using a **45-minute** gap threshold, measured from the previous *entry's* timestamp (not the session start). A session holds:

- `start` — first entry's `occurred_at`
- `end` — last entry's `occurred_at`
- `total_ml` — sum of non-null values (0 when all entries are unmeasured)

Entries with a null value participate in sessionization and contribute 0 ml.

### 3. Period filter

A session belongs to the **night** pool when its `start` hour is in **`[21:00, 07:00)`** — i.e. `hour >= 21 or hour < 7`, a range that wraps midnight — and to the **day** pool otherwise.

Day and night are modelled from separate pools, because daytime gaps run about 1.2h shorter (median 2.53h vs 3.75h over the last 30 days). Pooling them would over-predict every daytime feed by roughly that margin.

The pool is chosen from the hour of the feed being asked about, not configured by the user: entering a 14:00 feed answers from daytime gaps, a 01:15 feed from night gaps. The response reports which pool answered so the UI can label it.

### 4. Gaps

For each night session, `gap = next_session.start - this_session.end`, in hours. The "next session" is the next one chronologically regardless of whether it is itself a night session.

Discard a gap when it is negative or greater than **8 hours** (these indicate missing data rather than real sleep stretches).

### 5. Point estimate — with `ml` provided

Fit ordinary least squares `gap = a + b·ml` over night gaps whose *originating* session had `total_ml > 0`.

Use the regression only when **all** of these hold:
- n ≥ 15
- b > 0 (slope must run the physically sensible direction)
- r ≥ 0.2

These are the same guards window selection applies, shared through one `_usable_fit` helper so the two cannot drift apart.

Otherwise fall back to the median gap of measured sessions (`basis: "median_measured"`).

**Expect this fallback to be permanent for the day pool.** Daytime volume→gap correlation measures 0.11–0.20 and moves substantially with small amounts of new data, against night's stable 0.34. Daytime feeding appears to be schedule-driven rather than satiety-driven, so volume genuinely does not predict daytime spacing — the median is the right answer there, not a degraded one.

Clamp the regression output to the **p10–p90** range of observed gaps, then clamp again to an absolute `[1.0h, 8.0h]`, so an extreme ml entry cannot produce an absurd time.

### 6. Point estimate — without `ml`

Use the median gap over night sessions with `total_ml == 0` (`basis: "median_unmeasured"`). This is a genuinely different distribution — median ~0.6–0.9h, reflecting the top-up pattern — and must not be pooled with the measured one.

If there are fewer than 5 unmeasured night gaps, fall back to `median_measured`.

### 7. Time range

For the regression path: compute residuals of the fit, take their p25 and p75, and add them to the point estimate. This is robust and assumes no particular distribution shape.

For median paths: use the p25 and p75 of the gap sample directly.

### 8. Volume prediction

Median `total_ml` of the sessions that **closed** each gap, counting only those with a measured volume. Range is p25–p75 of the same set. Round all three to the nearest 10 ml.

If fewer than 5 such sessions exist, return null volume fields and the UI omits the volume line.

### 9. Insufficient data

If fewer than **5** night gaps exist in any window, return `basis: "insufficient_data"` with null predictions.

### Rounding

Predicted times round to the nearest 5 minutes.

---

## API

```
GET /api/predict/next-feeding?at=<ISO8601>&ml=<int>
```

`at` is required. `ml` is optional; omit it entirely for an unmeasured (breast) feed.

**Response:**

```json
{
  "predicted_at": "2026-08-05T05:30:00",
  "earliest_at": "2026-08-05T04:40:00",
  "latest_at": "2026-08-05T06:10:00",
  "predicted_ml": 130,
  "ml_low": 100,
  "ml_high": 160,
  "basis": "regression",
  "period": "night",
  "sample_size": 67,
  "window_days": 30
}
```

`basis` is one of `"regression"`, `"median_measured"`, `"median_unmeasured"`, `"insufficient_data"`. `period` is `"day"` or `"night"`, reporting which pool answered.

When `basis` is `"insufficient_data"`, all of `predicted_at`, `earliest_at`, `latest_at`, `predicted_ml`, `ml_low`, `ml_high` are null. When volume data is too thin, only the three ml fields are null.

`window_days` is `30`, `60`, or `null` (meaning all history).

---

## UI

### Route `/night`

**Input card** — two fields, no submit button:

- **Time**: `<input type="time">` (native iOS wheel), defaults to now rounded to the nearest 5 minutes.
- **Volume**: numeric input with `inputMode="numeric"`, optional, placeholder `ml (optional)`.

The prediction refetches on change, debounced 300ms, through TanStack Query with key `['prediction', at, ml]`. No submit button — at 2am fewer taps matters.

**Result card** — the visual centre of the screen:

```
NEXT FEEDING
   05:30
04:40 – 06:10
  ~130 ml  ·  100–160

67 night feeds · last 30 days
```

The footnote states the basis when it is not the regression, e.g. *"volume signal weak — using median gap"*. When `basis` is `"insufficient_data"`, the result card is replaced by an explanation of what is missing rather than a fabricated number.

### Clock-time resolution

The time field gives a clock time with no date. Resolve it to **the most recent past occurrence within the last 24 hours**.

This matters: typing `23:30` at `00:30` must mean *last night*, 1 hour ago. Naively attaching today's date would place the feeding 23 hours in the future and produce a nonsense prediction. Implemented as a pure function in the route module, unit-tested.

---

## Testing

### Backend (`backend/tests/test_feeding_predictor.py`)

Against fabricated session lists, no database:

- Sessionization merges entries 45 minutes apart and splits at 46
- Unmeasured entries participate in sessions and contribute 0 ml
- Night filter includes 21:00 and 06:59, excludes 07:00 and 20:59, and correctly wraps midnight
- Gaps greater than 8 hours are dropped; negative gaps are dropped
- Regression recovers a known slope from synthetic linear data
- Fallback to `median_measured` when n < 15
- Fallback to `median_measured` when slope ≤ 0
- Fallback to `median_measured` when r < 0.2
- `median_unmeasured` path is used when `ml` is omitted
- p10–p90 clamping bounds an extreme ml input
- `insufficient_data` returned below 5 night gaps
- Window widens 30 → 60 → all when samples are thin

### Frontend (`src/routes/night.test.ts`)

- Clock-time resolver: same-day case, previous-day wrap case, exact-now case

Both test suites already exist in this repo (`pytest`, `vitest`); no new infrastructure.

---

## Out of Scope

Deliberately excluded:

- **No database writes.** The screen is a calculator; entries still arrive only via photo upload.
- **No chaining to morning.** Single prediction per input. Chained predictions compound uncertainty — a ±1h range becomes ±2h by the second step.
- **No hour-of-night adjustment.** Per-bucket sample sizes are 7–20 over 30 days; the adjustment would be mostly noise.
- **No LLM call.** Slow, costs a request per keystroke-debounce, and non-reproducible.
- **No breast/formula model split.** Halves the sample size for a distinction the measured/unmeasured split already captures.
