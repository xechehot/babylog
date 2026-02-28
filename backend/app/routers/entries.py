from fastapi import APIRouter

from app.models.entry import EntryCreate, EntryListResponse, EntryResponse, EntryUpdate

router = APIRouter(prefix="/api/entries", tags=["entries"])


@router.get("")
async def list_entries() -> EntryListResponse:
    return EntryListResponse(entries=[])


@router.post("", status_code=201)
async def create_entry(entry: EntryCreate) -> EntryResponse:
    return EntryResponse(
        id=0,
        entry_type=entry.entry_type,
        occurred_at=entry.occurred_at,
        date=entry.occurred_at[:10],
        value=entry.value,
        notes=entry.notes,
        created_at="",
        updated_at="",
    )


@router.patch("/{entry_id}")
async def update_entry(entry_id: int, entry: EntryUpdate) -> EntryResponse:
    return EntryResponse(
        id=entry_id,
        entry_type=entry.entry_type or "",
        occurred_at=entry.occurred_at or "",
        date="",
        value=entry.value,
        notes=entry.notes,
        created_at="",
        updated_at="",
    )


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(entry_id: int) -> None:
    pass
