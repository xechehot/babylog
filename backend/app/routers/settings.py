from fastapi import APIRouter

from app.database import get_db
from app.models.settings import SettingsResponse, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTING_KEYS = ("baby_name", "birth_date", "birth_weight")


@router.get("", response_model=SettingsResponse)
async def get_settings() -> SettingsResponse:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key IN (?, ?, ?)",
            SETTING_KEYS,
        )
        rows = await cursor.fetchall()
    data: dict[str, str | int | None] = {}
    for row in rows:
        key, value = row["key"], row["value"]
        if key == "birth_weight":
            data[key] = int(value) if value else None
        else:
            data[key] = value
    return SettingsResponse(**data)


@router.put("", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate) -> SettingsResponse:
    async with get_db() as db:
        for key in SETTING_KEYS:
            value = getattr(body, key)
            if value is not None:
                await db.execute(
                    "INSERT INTO settings (key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (key, str(value)),
                )
            else:
                await db.execute("DELETE FROM settings WHERE key = ?", (key,))
        await db.commit()
    return SettingsResponse(
        baby_name=body.baby_name,
        birth_date=body.birth_date,
        birth_weight=body.birth_weight,
    )
