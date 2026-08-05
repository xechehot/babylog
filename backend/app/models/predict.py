from pydantic import BaseModel


class NextFeedingPrediction(BaseModel):
    predicted_at: str | None = None
    earliest_at: str | None = None
    latest_at: str | None = None
    predicted_ml: int | None = None
    ml_low: int | None = None
    ml_high: int | None = None
    basis: str
    period: str
    sample_size: int
    window_days: int | None = None
