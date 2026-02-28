from fastapi import APIRouter

from app.models.dashboard import DashboardResponse

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard() -> DashboardResponse:
    return DashboardResponse(from_date="", to_date="", days=[], latest_weight=None)
