from datetime import datetime, timedelta

from fastapi import APIRouter

from app.database import get_db
from app.models.dashboard import DashboardDay, DashboardResponse, LatestWeight

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(
    from_date: str | None = None,
    to_date: str | None = None,
) -> DashboardResponse:
    if not from_date:
        from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    if not to_date:
        to_date = datetime.now().strftime("%Y-%m-%d")

    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT
                date,
                SUM(CASE WHEN entry_type='feeding' THEN 1 ELSE 0 END) as feeding_count,
                SUM(CASE WHEN entry_type='feeding' AND value IS NOT NULL THEN value ELSE 0 END) as feeding_total_ml,
                SUM(CASE WHEN entry_type='feeding' AND subtype='breast' AND value IS NOT NULL THEN value ELSE 0 END) as feeding_breast_ml,
                SUM(CASE WHEN entry_type='feeding' AND subtype='formula' AND value IS NOT NULL THEN value ELSE 0 END) as feeding_formula_ml,
                SUM(CASE WHEN entry_type='diaper' AND subtype='pee' THEN 1 ELSE 0 END) as diaper_pee_count,
                SUM(CASE WHEN entry_type='diaper' AND subtype='poo' THEN 1 ELSE 0 END) as diaper_poo_count,
                SUM(CASE WHEN entry_type='diaper' AND subtype='dry' THEN 1 ELSE 0 END) as diaper_dry_count,
                SUM(CASE WHEN entry_type='diaper' AND subtype='pee+poo' THEN 1 ELSE 0 END) as diaper_pee_poo_count
            FROM entries
            WHERE date >= ? AND date <= ?
            GROUP BY date
            ORDER BY date ASC
            """,
            (from_date, to_date),
        )
        day_rows = await cursor.fetchall()

        # Latest weight
        cursor = await db.execute(
            """
            SELECT value, occurred_at, date
            FROM entries
            WHERE entry_type='weight' AND value IS NOT NULL
            ORDER BY occurred_at DESC
            LIMIT 1
            """
        )
        weight_row = await cursor.fetchone()

    days = [
        DashboardDay(
            date=row["date"],
            feeding_total_ml=row["feeding_total_ml"] or 0,
            feeding_count=row["feeding_count"],
            feeding_breast_ml=row["feeding_breast_ml"] or 0,
            feeding_formula_ml=row["feeding_formula_ml"] or 0,
            diaper_pee_count=row["diaper_pee_count"],
            diaper_poo_count=row["diaper_poo_count"],
            diaper_dry_count=row["diaper_dry_count"],
            diaper_pee_poo_count=row["diaper_pee_poo_count"],
        )
        for row in day_rows
    ]

    latest_weight = None
    if weight_row:
        latest_weight = LatestWeight(
            value=weight_row["value"],
            occurred_at=weight_row["occurred_at"],
            date=weight_row["date"],
        )

    return DashboardResponse(
        from_date=from_date,
        to_date=to_date,
        days=days,
        latest_weight=latest_weight,
    )
