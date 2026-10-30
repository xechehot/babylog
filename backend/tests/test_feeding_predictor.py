"""Unit tests for the feeding predictor (pure module, no DB)."""

from datetime import datetime, timedelta

from app.services.feeding_predictor import (
    FeedingRecord,
    build_sessions,
    predict_next_feeding,
    session_gaps,
)

NOW = datetime(2026, 8, 5, 1, 15)


def rec(when: str, value: float | None = None) -> FeedingRecord:
    return FeedingRecord(occurred_at=datetime.fromisoformat(when), value=value)


# --- sessionization ---------------------------------------------------------


def test_entries_45_minutes_apart_merge_into_one_session():
    sessions = build_sessions([rec("2026-08-01T01:00", 60), rec("2026-08-01T01:45", 40)])

    assert len(sessions) == 1
    assert sessions[0].total_ml == 100
    assert sessions[0].start == datetime.fromisoformat("2026-08-01T01:00")
    assert sessions[0].end == datetime.fromisoformat("2026-08-01T01:45")


def test_entries_46_minutes_apart_stay_separate_sessions():
    sessions = build_sessions([rec("2026-08-01T01:00", 60), rec("2026-08-01T01:46", 40)])

    assert len(sessions) == 2
    assert [s.total_ml for s in sessions] == [60, 40]


def test_merge_window_measured_from_previous_entry_not_session_start():
    # 01:00 -> 01:40 -> 02:20: each step is 40 min, so all three chain together
    sessions = build_sessions(
        [rec("2026-08-01T01:00", 10), rec("2026-08-01T01:40", 10), rec("2026-08-01T02:20", 10)]
    )

    assert len(sessions) == 1
    assert sessions[0].total_ml == 30


def test_unmeasured_entries_join_sessions_and_contribute_zero_ml():
    sessions = build_sessions([rec("2026-08-01T01:00", None), rec("2026-08-01T01:30", 80)])

    assert len(sessions) == 1
    assert sessions[0].total_ml == 80


def test_session_of_only_unmeasured_entries_has_zero_total():
    sessions = build_sessions([rec("2026-08-01T01:00", None)])

    assert sessions[0].total_ml == 0


# --- night filter -----------------------------------------------------------


def gaps_from(*times: str) -> list:
    return session_gaps(build_sessions([rec(t, 50) for t in times]), "night")


def test_night_window_includes_21_00_and_excludes_20_59():
    assert len(gaps_from("2026-08-01T21:00", "2026-08-02T01:00")) == 1
    assert gaps_from("2026-08-01T20:59", "2026-08-02T01:00") == []


def test_night_window_includes_06_59_and_excludes_07_00():
    assert len(gaps_from("2026-08-01T06:59", "2026-08-01T09:00")) == 1
    assert gaps_from("2026-08-01T07:00", "2026-08-01T09:00") == []


def test_gap_is_measured_from_session_end_to_next_session_start():
    sessions = build_sessions(
        [
            rec("2026-08-01T22:00", 50),
            rec("2026-08-01T22:30", 50),  # same session, ends at 22:30
            rec("2026-08-02T02:30", 50),
        ]
    )

    gaps = session_gaps(sessions, "night")

    assert len(gaps) == 1
    assert gaps[0].hours == 4.0
    assert gaps[0].from_ml == 100
    assert gaps[0].to_ml == 50


def test_gaps_longer_than_8_hours_are_dropped_as_missing_data():
    sessions = build_sessions([rec("2026-08-01T22:00", 50), rec("2026-08-02T06:01", 50)])

    assert session_gaps(sessions, "night") == []


def test_gap_of_exactly_8_hours_is_kept():
    sessions = build_sessions([rec("2026-08-01T22:00", 50), rec("2026-08-02T06:00", 50)])

    assert len(session_gaps(sessions, "night")) == 1


# --- day vs night pool ------------------------------------------------------


def day_and_night_history(count: int = 10) -> list[FeedingRecord]:
    """Nights spaced 4h apart, days spaced 2h apart, at a constant volume.

    Constant volume means the fit has no x-variance, so every prediction falls
    to the median of whichever pool was chosen — making the pool visible in the
    predicted gap.
    """
    records: list[FeedingRecord] = []
    for k in range(count):
        midnight = (NOW - timedelta(days=2 + k)).replace(hour=0, minute=0, second=0, microsecond=0)
        for hour in (1, 5, 9, 11, 13, 15, 17, 19, 21):
            records.append(FeedingRecord(occurred_at=midnight.replace(hour=hour), value=120))
    return sorted(records, key=lambda r: r.occurred_at)


def predicted_gap_hours(at: datetime, history: list[FeedingRecord]) -> float:
    result = predict_next_feeding(at=at, ml=120, history=history, now=NOW)
    return (result.predicted_at - at).total_seconds() / 3600


def test_daytime_feed_is_predicted_from_daytime_gaps():
    history = day_and_night_history()

    result = predict_next_feeding(
        at=NOW.replace(hour=14, minute=0), ml=120, history=history, now=NOW
    )

    assert result.period == "day"
    assert abs(predicted_gap_hours(NOW.replace(hour=14, minute=0), history) - 2.0) < 0.1


def test_night_feed_is_predicted_from_night_gaps():
    history = day_and_night_history()

    result = predict_next_feeding(
        at=NOW.replace(hour=1, minute=0), ml=120, history=history, now=NOW
    )

    assert result.period == "night"
    assert abs(predicted_gap_hours(NOW.replace(hour=1, minute=0), history) - 4.0) < 0.1


def test_07_00_uses_the_day_pool_and_06_59_uses_the_night_pool():
    history = day_and_night_history()

    assert abs(predicted_gap_hours(NOW.replace(hour=7, minute=0), history) - 2.0) < 0.1
    assert abs(predicted_gap_hours(NOW.replace(hour=6, minute=59), history) - 4.0) < 0.1


def test_21_00_uses_the_night_pool_and_20_59_uses_the_day_pool():
    history = day_and_night_history()

    assert abs(predicted_gap_hours(NOW.replace(hour=21, minute=0), history) - 4.0) < 0.1
    assert abs(predicted_gap_hours(NOW.replace(hour=20, minute=59), history) - 2.0) < 0.1


def test_day_pool_ignores_night_history_entirely():
    # only night feeds exist, so a daytime question has nothing to answer with
    records: list[FeedingRecord] = []
    for k in range(10):
        t = (NOW - timedelta(days=2 + k)).replace(hour=21, minute=0, second=0, microsecond=0)
        for _ in range(3):
            records.append(FeedingRecord(occurred_at=t, value=120))
            t = t + timedelta(hours=3)

    result = predict_next_feeding(
        at=NOW.replace(hour=14, minute=0), ml=120, history=records, now=NOW
    )

    assert result.basis == "insufficient_data"


# --- prediction: regression path -------------------------------------------


def nights(
    count: int,
    days_before: int = 2,
    gap_for_ml=lambda ml: 1.0 + 0.02 * ml,
    ml_for=lambda k, j: 80 + ((k + j) % 7) * 20,
) -> list[FeedingRecord]:
    """`count` consecutive nights ending `days_before` days before NOW.

    Each night runs three feeds starting at 21:00, spaced by `gap_for_ml` applied
    to the feed's own volume, plus a closing feed. Night-to-night gaps always
    exceed 8h, so they drop out and only the intra-night gaps survive.
    """
    records: list[FeedingRecord] = []
    for k in range(count):
        t = (NOW - timedelta(days=days_before + k)).replace(
            hour=21, minute=0, second=0, microsecond=0
        )
        for j in range(3):
            ml = ml_for(k, j)
            records.append(FeedingRecord(occurred_at=t, value=ml))
            t = t + timedelta(hours=gap_for_ml(ml if ml is not None else 0))
        records.append(FeedingRecord(occurred_at=t, value=100))
    return sorted(records, key=lambda r: r.occurred_at)


def test_regression_recovers_a_known_slope():
    history = nights(20, gap_for_ml=lambda ml: 1.0 + 0.02 * ml)

    result = predict_next_feeding(at=NOW, ml=150, history=history, now=NOW)

    assert result.basis == "regression"
    # gap = 1.0 + 0.02*150 = 4.0h
    predicted_gap = (result.predicted_at - NOW).total_seconds() / 3600
    assert abs(predicted_gap - 4.0) < 0.25


def test_predicted_range_brackets_the_point_estimate():
    result = predict_next_feeding(at=NOW, ml=150, history=nights(20), now=NOW)

    assert result.earliest_at <= result.predicted_at <= result.latest_at


def test_predicted_times_round_to_five_minutes():
    result = predict_next_feeding(at=NOW, ml=150, history=nights(20), now=NOW)

    assert result.predicted_at.minute % 5 == 0
    assert result.predicted_at.second == 0


# --- prediction: fallbacks --------------------------------------------------


def test_falls_back_to_median_when_sample_below_fifteen():
    # 3 nights -> 9 gaps: enough to predict at all, too few to trust a fit
    result = predict_next_feeding(at=NOW, ml=150, history=nights(3), now=NOW)

    assert result.basis == "median_measured"


def test_falls_back_to_median_when_slope_is_not_positive():
    # bigger feeds followed by *shorter* gaps -> negative slope
    history = nights(10, gap_for_ml=lambda ml: 6.0 - 0.02 * ml)

    result = predict_next_feeding(at=NOW, ml=150, history=history, now=NOW)

    assert result.basis == "median_measured"


def test_falls_back_to_median_when_gaps_do_not_vary_with_volume():
    # volumes vary but every gap is the same length -> slope is flat
    history = nights(10, gap_for_ml=lambda _ml: 3.5)

    result = predict_next_feeding(at=NOW, ml=150, history=history, now=NOW)

    assert result.basis == "median_measured"
    predicted_gap = (result.predicted_at - NOW).total_seconds() / 3600
    assert abs(predicted_gap - 3.5) < 0.1


# Deterministic jitter with a period coprime to the 7-step volume cycle, so it
# stays uncorrelated with volume over the sample.
NOISE = [-0.7, 0.9, -0.5, 0.8, -0.6, 0.4, 0.7, -0.4, 0.2, -0.8]


def test_falls_back_to_median_when_volume_signal_is_swamped_by_noise():
    # Slope is positive but tiny next to night-to-night variation: r ~ 0.13.
    # The fit would technically run; the correlation guard is what rejects it.
    records: list[FeedingRecord] = []
    step = 0
    for k in range(30):
        t = (NOW - timedelta(days=2 + k)).replace(hour=21, minute=0, second=0, microsecond=0)
        for j in range(3):
            ml = 80 + ((k + j) % 7) * 20
            records.append(FeedingRecord(occurred_at=t, value=ml))
            t = t + timedelta(hours=2.0 + 0.002 * ml + NOISE[step % len(NOISE)])
            step += 1
        records.append(FeedingRecord(occurred_at=t, value=100))

    result = predict_next_feeding(at=NOW, ml=150, history=records, now=NOW)

    assert result.basis == "median_measured"


def test_omitting_ml_uses_the_unmeasured_gap_distribution():
    # unmeasured feeds are followed by a top-up 50 min later; measured ones by 4h
    records: list[FeedingRecord] = []
    for k in range(20):
        t = (NOW - timedelta(days=2 + k)).replace(hour=21, minute=0, second=0, microsecond=0)
        for _ in range(2):
            records.append(FeedingRecord(occurred_at=t, value=None))
            t = t + timedelta(minutes=50)  # > 45min merge window, so a real gap
            records.append(FeedingRecord(occurred_at=t, value=120))
            t = t + timedelta(hours=4)

    result = predict_next_feeding(at=NOW, ml=None, history=records, now=NOW)

    assert result.basis == "median_unmeasured"
    predicted_gap = (result.predicted_at - NOW).total_seconds() / 3600
    assert abs(predicted_gap - (50 / 60)) < 0.1


def test_extreme_volume_is_clamped_to_observed_gap_range():
    result = predict_next_feeding(at=NOW, ml=5000, history=nights(20), now=NOW)

    predicted_gap = (result.predicted_at - NOW).total_seconds() / 3600
    assert predicted_gap <= 8.0


def test_insufficient_data_returns_null_prediction():
    history = [rec("2026-08-01T22:00", 100), rec("2026-08-02T02:00", 100)]

    result = predict_next_feeding(at=NOW, ml=150, history=history, now=NOW)

    assert result.basis == "insufficient_data"
    assert result.predicted_at is None
    assert result.predicted_ml is None


# --- window widening --------------------------------------------------------


def test_window_stays_at_30_days_when_recent_data_is_sufficient():
    result = predict_next_feeding(at=NOW, ml=150, history=nights(10, days_before=2), now=NOW)

    assert result.window_days == 30


def test_window_widens_to_60_days_when_recent_sample_is_thin():
    # nothing in the last 30 days, plenty within 60
    history = nights(10, days_before=35)

    result = predict_next_feeding(at=NOW, ml=150, history=history, now=NOW)

    assert result.window_days == 60


def test_window_widens_when_the_narrow_one_has_data_but_no_usable_fit():
    """Sample size is not the only reason to widen — a flat window is useless too.

    The last 30 days hold plenty of gaps, but at a constant length, so volume
    explains nothing. The 60-day window carries a real slope, and reaching it is
    the difference between the entered volume mattering and being ignored.
    """
    recent = nights(10, days_before=2, gap_for_ml=lambda _ml: 3.8)
    older = nights(10, days_before=35, gap_for_ml=lambda ml: 1.0 + 0.02 * ml)

    result = predict_next_feeding(at=NOW, ml=150, history=recent + older, now=NOW)

    assert result.window_days == 60
    assert result.basis == "regression"


def test_window_stays_narrow_when_it_already_supports_a_fit():
    recent = nights(10, days_before=2, gap_for_ml=lambda ml: 1.0 + 0.02 * ml)
    older = nights(10, days_before=35, gap_for_ml=lambda ml: 1.0 + 0.02 * ml)

    result = predict_next_feeding(at=NOW, ml=150, history=recent + older, now=NOW)

    assert result.window_days == 30
    assert result.basis == "regression"


def test_prefers_the_recent_median_when_no_window_supports_a_fit():
    # flat everywhere: widening would only trade recent data for stale data
    recent = nights(10, days_before=2, gap_for_ml=lambda _ml: 3.8)
    older = nights(10, days_before=35, gap_for_ml=lambda _ml: 2.0)

    result = predict_next_feeding(at=NOW, ml=150, history=recent + older, now=NOW)

    assert result.window_days == 30
    assert result.basis == "median_measured"
    assert abs((result.predicted_at - NOW).total_seconds() / 3600 - 3.8) < 0.1


def test_window_widens_to_all_history_when_60_days_is_still_thin():
    history = nights(10, days_before=90)

    result = predict_next_feeding(at=NOW, ml=150, history=history, now=NOW)

    assert result.window_days is None


# --- volume prediction ------------------------------------------------------


def test_predicted_volume_is_median_of_feeds_that_closed_each_gap():
    result = predict_next_feeding(at=NOW, ml=150, history=nights(20), now=NOW)

    assert result.predicted_ml is not None
    assert result.ml_low <= result.predicted_ml <= result.ml_high
    assert result.predicted_ml % 10 == 0


def test_volume_fields_are_null_when_closing_feeds_are_unmeasured():
    # every feed is unmeasured, so nothing closes a gap with a known volume
    records: list[FeedingRecord] = []
    for k in range(20):
        t = (NOW - timedelta(days=2 + k)).replace(hour=21, minute=0, second=0, microsecond=0)
        for _ in range(3):
            records.append(FeedingRecord(occurred_at=t, value=None))
            t = t + timedelta(hours=3)

    result = predict_next_feeding(at=NOW, ml=None, history=records, now=NOW)

    assert result.predicted_at is not None
    assert result.predicted_ml is None
