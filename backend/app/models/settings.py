from pydantic import BaseModel, Field, field_validator


class SettingsUpdate(BaseModel):
    baby_name: str | None = None
    birth_date: str | None = None  # YYYY-MM-DD
    birth_weight: int | None = Field(default=None, ge=200, le=10000)  # grams

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: str | None) -> str | None:
        if v is None:
            return v
        import re

        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("birth_date must be in YYYY-MM-DD format")
        return v


class SettingsResponse(BaseModel):
    baby_name: str | None = None
    birth_date: str | None = None
    birth_weight: int | None = None
