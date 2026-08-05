from datetime import datetime

from fastapi import APIRouter, Query

from app.database import get_db
from app.models.predict import NextFeedingPrediction
from app.services.feeding_predictor import FeedingRecord, predict_next_feeding

router = APIRouter(prefix="/api/predict", tags=["predict"])


def _iso(moment: datetime | None) -> str | None:
    return moment.isoformat() if moment else None


@router.get("/next-feeding")
async def next_feeding(
    at: datetime = Query(..., description="When the feed just given occurred"),
    ml: float | None = Query(None, ge=0, description="Volume in ml; omit for an unmeasured feed"),
) -> NextFeedingPrediction:
    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT occurred_at, value
            FROM entries
            WHERE entry_type='feeding'
            ORDER BY occurred_at ASC
            """
        )
        rows = await cursor.fetchall()

    history = [
        FeedingRecord(
            occurred_at=datetime.fromisoformat(row["occurred_at"]),
            value=row["value"],
        )
        for row in rows
    ]

    result = predict_next_feeding(at=at, ml=ml, history=history, now=datetime.now())

    return NextFeedingPrediction(
        predicted_at=_iso(result.predicted_at),
        earliest_at=_iso(result.earliest_at),
        latest_at=_iso(result.latest_at),
        predicted_ml=result.predicted_ml,
        ml_low=result.ml_low,
        ml_high=result.ml_high,
        basis=result.basis,
        sample_size=result.sample_size,
        window_days=result.window_days,
    )
