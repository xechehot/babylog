from pydantic import BaseModel


class DashboardDay(BaseModel):
    date: str
    feeding_total_ml: float
    feeding_count: int
    pee_count: int
    poo_count: int
    diaper_dry_count: int


class LatestWeight(BaseModel):
    value: float
    occurred_at: str
    date: str


class DashboardResponse(BaseModel):
    from_date: str
    to_date: str
    days: list[DashboardDay]
    latest_weight: LatestWeight | None = None
