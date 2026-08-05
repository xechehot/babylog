"""Predicts the next night feeding from the baby's own feeding history.

Pure module: no FastAPI, no database. Takes feeding records, returns a
prediction, so the statistics can be tested against fabricated data.

The model is a recency-windowed least-squares fit of `gap ~ volume` over night
feedings, chosen because volume genuinely predicts how long the baby then
sleeps (r ~ 0.4 on real data), while the pattern drifts fast enough as the baby
grows that all-time history badly under-predicts.
"""

import statistics
from dataclasses import dataclass
from datetime import datetime, timedelta

# Entries this far apart or closer belong to one feeding session. Wider than the
# 20 min used elsewhere in the app: unmeasured breast top-ups follow a bottle by
# ~40 min and are part of the same waking, not a separate one.
MERGE_GAP_MINUTES = 45

NIGHT_START_HOUR = 21
NIGHT_END_HOUR = 7

# Gaps longer than this mean missing data, not a long sleep.
MAX_GAP_HOURS = 8.0
MIN_GAP_HOURS = 1.0

MIN_GAP_SAMPLE = 5
MIN_REGRESSION_SAMPLE = 15
MIN_CORRELATION = 0.2
MIN_VOLUME_SAMPLE = 5

CANDIDATE_WINDOWS: tuple[int | None, ...] = (30, 60, None)

Basis = str  # "regression" | "median_measured" | "median_unmeasured" | "insufficient_data"


@dataclass(frozen=True)
class FeedingRecord:
    occurred_at: datetime
    value: float | None = None


@dataclass(frozen=True)
class Session:
    start: datetime
    end: datetime
    total_ml: float


@dataclass(frozen=True)
class NightGap:
    hours: float
    from_ml: float
    to_ml: float


@dataclass(frozen=True)
class Prediction:
    basis: Basis
    sample_size: int
    window_days: int | None
    predicted_at: datetime | None = None
    earliest_at: datetime | None = None
    latest_at: datetime | None = None
    predicted_ml: int | None = None
    ml_low: int | None = None
    ml_high: int | None = None


def build_sessions(records: list[FeedingRecord]) -> list[Session]:
    """Merge feedings less than MERGE_GAP_MINUTES apart into single sessions.

    The merge window is measured from the previous *entry*, not the session
    start, so a long chain of closely spaced top-ups stays one session.
    """
    ordered = sorted(records, key=lambda r: r.occurred_at)
    sessions: list[Session] = []
    start: datetime | None = None
    end: datetime | None = None
    total = 0.0

    for record in ordered:
        if start is not None and end is not None:
            if (record.occurred_at - end) <= timedelta(minutes=MERGE_GAP_MINUTES):
                end = record.occurred_at
                total += record.value or 0
                continue
            sessions.append(Session(start=start, end=end, total_ml=total))
        start = record.occurred_at
        end = record.occurred_at
        total = record.value or 0

    if start is not None and end is not None:
        sessions.append(Session(start=start, end=end, total_ml=total))

    return sessions


def is_night(moment: datetime) -> bool:
    """True when the hour falls in [21:00, 07:00) — note this wraps midnight."""
    return moment.hour >= NIGHT_START_HOUR or moment.hour < NIGHT_END_HOUR


def night_gaps(sessions: list[Session]) -> list[NightGap]:
    """Gaps from the end of each night session to the start of the next session."""
    gaps: list[NightGap] = []
    for current, following in zip(sessions, sessions[1:], strict=False):
        if not is_night(current.start):
            continue
        hours = (following.start - current.end).total_seconds() / 3600
        if hours < 0 or hours > MAX_GAP_HOURS:
            continue
        gaps.append(NightGap(hours=hours, from_ml=current.total_ml, to_ml=following.total_ml))
    return gaps


def _percentile(values: list[float], fraction: float) -> float:
    """Nearest-rank percentile. Robust on the small samples this model works with."""
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round(fraction * (len(ordered) - 1)))))
    return ordered[index]


def _fit(gaps: list[NightGap]) -> tuple[float, float, float] | None:
    """Least-squares fit of gap on volume. Returns (intercept, slope, r) or None."""
    xs = [g.from_ml for g in gaps]
    ys = [g.hours for g in gaps]
    x_dev = statistics.pstdev(xs)
    y_dev = statistics.pstdev(ys)
    if x_dev == 0 or y_dev == 0:
        return None

    x_mean = statistics.fmean(xs)
    y_mean = statistics.fmean(ys)
    covariance = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys, strict=True)) / len(gaps)
    slope = covariance / (x_dev**2)
    return y_mean - slope * x_mean, slope, covariance / (x_dev * y_dev)


def _round_to_5min(moment: datetime) -> datetime:
    remainder = timedelta(
        minutes=moment.minute % 5, seconds=moment.second, microseconds=moment.microsecond
    )
    moment -= remainder
    if remainder >= timedelta(minutes=2, seconds=30):
        moment += timedelta(minutes=5)
    return moment


def _select_window(
    history: list[FeedingRecord], ml: float | None, now: datetime
) -> tuple[int | None, list[NightGap]]:
    """Pick the narrowest window holding enough of the sample the estimate needs."""
    widest: tuple[int | None, list[NightGap]] = (None, [])
    for window in CANDIDATE_WINDOWS:
        if window is None:
            records = history
        else:
            cutoff = now - timedelta(days=window)
            records = [r for r in history if r.occurred_at >= cutoff]

        gaps = night_gaps(build_sessions(records))
        widest = (window, gaps)
        relevant = [g for g in gaps if (g.from_ml > 0 if ml is not None else g.from_ml == 0)]
        if len(relevant) >= MIN_REGRESSION_SAMPLE:
            return window, gaps
    return widest


def _estimate_gap(gaps: list[NightGap], ml: float | None) -> tuple[float, float, float, Basis]:
    """Returns (hours, low_hours, high_hours, basis)."""
    measured = [g for g in gaps if g.from_ml > 0]
    unmeasured = [g for g in gaps if g.from_ml == 0]

    if ml is None and len(unmeasured) >= MIN_GAP_SAMPLE:
        return (*_median_estimate(unmeasured), "median_unmeasured")

    sample = measured or unmeasured
    if ml is None:
        return (*_median_estimate(sample), "median_measured" if measured else "median_unmeasured")

    if len(measured) >= MIN_REGRESSION_SAMPLE:
        fit = _fit(measured)
        if fit is not None:
            intercept, slope, r = fit
            if slope > 0 and r >= MIN_CORRELATION:
                hours = intercept + slope * ml
                observed = [g.hours for g in measured]
                hours = min(
                    max(hours, _percentile(observed, 0.10)),
                    _percentile(observed, 0.90),
                )
                hours = min(max(hours, MIN_GAP_HOURS), MAX_GAP_HOURS)
                residuals = [g.hours - (intercept + slope * g.from_ml) for g in measured]
                return (
                    hours,
                    hours + _percentile(residuals, 0.25),
                    hours + _percentile(residuals, 0.75),
                    "regression",
                )

    return (*_median_estimate(sample), "median_measured" if measured else "median_unmeasured")


def _median_estimate(gaps: list[NightGap]) -> tuple[float, float, float]:
    hours = [g.hours for g in gaps]
    return statistics.median(hours), _percentile(hours, 0.25), _percentile(hours, 0.75)


def _estimate_volume(gaps: list[NightGap]) -> tuple[int, int, int] | None:
    closing = [g.to_ml for g in gaps if g.to_ml > 0]
    if len(closing) < MIN_VOLUME_SAMPLE:
        return None

    def to_10(value: float) -> int:
        return int(round(value / 10) * 10)

    return (
        to_10(statistics.median(closing)),
        to_10(_percentile(closing, 0.25)),
        to_10(_percentile(closing, 0.75)),
    )


def predict_next_feeding(
    at: datetime,
    ml: float | None,
    history: list[FeedingRecord],
    now: datetime,
) -> Prediction:
    """Predict when — and how much — the baby will feed after a feed at `at`."""
    window_days, gaps = _select_window(history, ml, now)

    if len(gaps) < MIN_GAP_SAMPLE:
        return Prediction(basis="insufficient_data", sample_size=len(gaps), window_days=window_days)

    hours, low_hours, high_hours, basis = _estimate_gap(gaps, ml)
    volume = _estimate_volume(gaps)

    return Prediction(
        basis=basis,
        sample_size=len(gaps),
        window_days=window_days,
        predicted_at=_round_to_5min(at + timedelta(hours=hours)),
        earliest_at=_round_to_5min(at + timedelta(hours=low_hours)),
        latest_at=_round_to_5min(at + timedelta(hours=high_hours)),
        predicted_ml=volume[0] if volume else None,
        ml_low=volume[1] if volume else None,
        ml_high=volume[2] if volume else None,
    )
