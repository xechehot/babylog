from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models.entry import EntryCreate, EntryListResponse, EntryResponse, EntryUpdate

router = APIRouter(prefix="/api/entries", tags=["entries"])


def _row_to_response(row) -> EntryResponse:
    return EntryResponse(
        id=row["id"],
        upload_id=row["upload_id"],
        entry_type=row["entry_type"],
        subtype=row["subtype"],
        occurred_at=row["occurred_at"],
        date=row["date"],
        value=row["value"],
        notes=row["notes"],
        confidence=row["confidence"],
        raw_text=row["raw_text"],
        confirmed=bool(row["confirmed"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("")
async def list_entries(
    type: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
) -> EntryListResponse:
    # Default to last 7 days
    if not from_date:
        from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    if not to_date:
        to_date = datetime.now().strftime("%Y-%m-%d")

    query = "SELECT * FROM entries WHERE date >= ? AND date <= ?"
    params: list = [from_date, to_date]

    if type:
        query += " AND entry_type = ?"
        params.append(type)

    query += " ORDER BY occurred_at ASC"

    async with get_db() as db:
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()

    return EntryListResponse(entries=[_row_to_response(r) for r in rows])


@router.post("", status_code=201)
async def create_entry(entry: EntryCreate) -> EntryResponse:
    date = entry.occurred_at[:10]

    async with get_db() as db:
        cursor = await db.execute(
            """INSERT INTO entries (entry_type, subtype, occurred_at, date, value, notes, confidence, raw_text)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                entry.entry_type,
                entry.subtype,
                entry.occurred_at,
                date,
                entry.value,
                entry.notes,
                entry.confidence,
                entry.raw_text,
            ),
        )
        await db.commit()
        entry_id = cursor.lastrowid

        cursor = await db.execute("SELECT * FROM entries WHERE id=?", (entry_id,))
        row = await cursor.fetchone()

    return _row_to_response(row)


@router.patch("/{entry_id}")
async def update_entry(entry_id: int, entry: EntryUpdate) -> EntryResponse:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM entries WHERE id=?", (entry_id,))
        existing = await cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Entry not found")

        updates = {}
        if entry.entry_type is not None:
            updates["entry_type"] = entry.entry_type
        if entry.subtype is not None:
            updates["subtype"] = entry.subtype
        if entry.occurred_at is not None:
            updates["occurred_at"] = entry.occurred_at
            updates["date"] = entry.occurred_at[:10]
        if entry.value is not None:
            updates["value"] = entry.value
        if entry.notes is not None:
            updates["notes"] = entry.notes
        if entry.confirmed is not None:
            updates["confirmed"] = int(entry.confirmed)

        if updates:
            set_clause = ", ".join(f"{k}=?" for k in updates)
            values = list(updates.values())
            await db.execute(
                f"UPDATE entries SET {set_clause}, updated_at=datetime('now') WHERE id=?",
                [*values, entry_id],
            )
            await db.commit()

        cursor = await db.execute("SELECT * FROM entries WHERE id=?", (entry_id,))
        row = await cursor.fetchone()

    return _row_to_response(row)


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(entry_id: int) -> None:
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM entries WHERE id=?", (entry_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Entry not found")

        await db.execute("DELETE FROM entries WHERE id=?", (entry_id,))
        await db.commit()
