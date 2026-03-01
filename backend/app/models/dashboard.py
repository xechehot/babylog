from pydantic import BaseModel


class DashboardDay(BaseModel):
    date: str
    feeding_total_ml: float
    feeding_count: int
    feeding_breast_ml: float
    feeding_formula_ml: float
    diaper_pee_count: int
    diaper_poo_count: int
    diaper_dry_count: int
    diaper_pee_poo_count: int


class LatestWeight(BaseModel):
    value: float
    occurred_at: str
    date: str


class DashboardResponse(BaseModel):
    from_date: str
    to_date: str
    days: list[DashboardDay]
    latest_weight: LatestWeight | None = None
