import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse

from app.config import settings
from app.database import get_db
from app.models.entry import EntryResponse
from app.models.upload import (
    UploadDetailResponse,
    UploadListItem,
    UploadListResponse,
    UploadResponse,
    UploadUpdate,
)
from app.services.upload_processor import process_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("", status_code=201)
async def create_upload(file: UploadFile, background_tasks: BackgroundTasks) -> UploadResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Save file to disk
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filepath = upload_dir / unique_name

    content = await file.read()
    filepath.write_bytes(content)
    size_mb = len(content) / 1024 / 1024
    logger.info("Upload received: %s (%.1f MB)", file.filename, size_mb)

    # Insert DB record
    async with get_db() as db:
        cursor = await db.execute(
            "INSERT INTO uploads (filename, filepath, status) VALUES (?, ?, 'pending')",
            (file.filename, str(filepath)),
        )
        await db.commit()
        upload_id = cursor.lastrowid

    assert upload_id is not None
    logger.info("Upload saved: id=%d filename=%s (%.1f MB)", upload_id, file.filename, size_mb)

    # Queue background processing
    background_tasks.add_task(process_upload, upload_id)

    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM uploads WHERE id=?", (upload_id,))
        row = await cursor.fetchone()
        assert row is not None

    return UploadResponse(
        id=row["id"],
        filename=row["filename"],
        status=row["status"],
        created_at=row["created_at"],
    )


@router.get("")
async def list_uploads(status: str | None = None) -> UploadListResponse:
    query = """
        SELECT u.*, COUNT(e.id) as entry_count
        FROM uploads u
        LEFT JOIN entries e ON e.upload_id = u.id
    """
    params: list = []
    if status:
        query += " WHERE u.status = ?"
        params.append(status)
    query += " GROUP BY u.id ORDER BY u.created_at DESC"

    async with get_db() as db:
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()

        # Fetch per-date entry counts for all uploads in one query
        upload_ids = [row["id"] for row in rows]
        date_counts_map: dict[int, dict[str, int]] = {}
        if upload_ids:
            placeholders = ",".join("?" * len(upload_ids))
            dc_cursor = await db.execute(
                f"SELECT upload_id, date, COUNT(*) as cnt FROM entries"
                f" WHERE upload_id IN ({placeholders})"
                f" GROUP BY upload_id, date ORDER BY date",
                upload_ids,
            )
            for dc_row in await dc_cursor.fetchall():
                date_counts_map.setdefault(dc_row["upload_id"], {})[dc_row["date"]] = dc_row["cnt"]

    return UploadListResponse(
        uploads=[
            UploadListItem(
                id=row["id"],
                filename=row["filename"],
                status=row["status"],
                error_message=row["error_message"],
                entry_count=row["entry_count"],
                date_counts=date_counts_map.get(row["id"], {}),
                created_at=row["created_at"],
                processed_at=row["processed_at"],
                reviewed=bool(row["reviewed"]),
                reviewed_at=row["reviewed_at"],
            )
            for row in rows
        ]
    )


@router.get("/{upload_id}")
async def get_upload(upload_id: int) -> UploadDetailResponse:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM uploads WHERE id=?", (upload_id,))
        upload = await cursor.fetchone()
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")

        cursor = await db.execute(
            "SELECT * FROM entries WHERE upload_id=? ORDER BY occurred_at ASC",
            (upload_id,),
        )
        entry_rows = await cursor.fetchall()

    return UploadDetailResponse(
        id=upload["id"],
        filename=upload["filename"],
        status=upload["status"],
        error_message=upload["error_message"],
        created_at=upload["created_at"],
        processed_at=upload["processed_at"],
        reviewed=bool(upload["reviewed"]),
        reviewed_at=upload["reviewed_at"],
        entries=[
            EntryResponse(
                id=e["id"],
                upload_id=e["upload_id"],
                entry_type=e["entry_type"],
                subtype=e["subtype"],
                occurred_at=e["occurred_at"],
                date=e["date"],
                value=e["value"],
                notes=e["notes"],
                confidence=e["confidence"],
                raw_text=e["raw_text"],
                confirmed=bool(e["confirmed"]),
                created_at=e["created_at"],
                updated_at=e["updated_at"],
            )
            for e in entry_rows
        ],
    )


@router.get("/{upload_id}/image")
async def get_upload_image(upload_id: int) -> FileResponse:
    async with get_db() as db:
        cursor = await db.execute("SELECT filepath, filename FROM uploads WHERE id=?", (upload_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Upload not found")

    filepath = Path(row["filepath"])
    if not filepath.exists():
        filepath = Path(settings.upload_dir) / filepath.name
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(filepath, filename=row["filename"])


@router.patch("/{upload_id}")
async def update_upload(upload_id: int, payload: UploadUpdate) -> UploadDetailResponse:
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM uploads WHERE id=?", (upload_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Upload not found")

        if payload.reviewed is not None:
            if payload.reviewed:
                await db.execute(
                    "UPDATE uploads SET reviewed=1, reviewed_at=datetime('now') WHERE id=?",
                    (upload_id,),
                )
            else:
                await db.execute(
                    "UPDATE uploads SET reviewed=0, reviewed_at=NULL WHERE id=?",
                    (upload_id,),
                )
            await db.commit()

        cursor = await db.execute("SELECT * FROM uploads WHERE id=?", (upload_id,))
        upload = await cursor.fetchone()
        assert upload is not None

        cursor = await db.execute(
            "SELECT * FROM entries WHERE upload_id=? ORDER BY occurred_at ASC",
            (upload_id,),
        )
        entry_rows = await cursor.fetchall()

    return UploadDetailResponse(
        id=upload["id"],
        filename=upload["filename"],
        status=upload["status"],
        error_message=upload["error_message"],
        created_at=upload["created_at"],
        processed_at=upload["processed_at"],
        reviewed=bool(upload["reviewed"]),
        reviewed_at=upload["reviewed_at"],
        entries=[
            EntryResponse(
                id=e["id"],
                upload_id=e["upload_id"],
                entry_type=e["entry_type"],
                subtype=e["subtype"],
                occurred_at=e["occurred_at"],
                date=e["date"],
                value=e["value"],
                notes=e["notes"],
                confidence=e["confidence"],
                raw_text=e["raw_text"],
                confirmed=bool(e["confirmed"]),
                created_at=e["created_at"],
                updated_at=e["updated_at"],
            )
            for e in entry_rows
        ],
    )


@router.delete("/{upload_id}", status_code=204)
async def delete_upload(upload_id: int) -> Response:
    async with get_db() as db:
        cursor = await db.execute("SELECT filepath FROM uploads WHERE id=?", (upload_id,))
        upload = await cursor.fetchone()
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")

        await db.execute("DELETE FROM entries WHERE upload_id=?", (upload_id,))
        await db.execute("DELETE FROM uploads WHERE id=?", (upload_id,))
        await db.commit()

    stored = Path(upload["filepath"])
    for candidate in (stored, Path(settings.upload_dir) / stored.name):
        if candidate.exists():
            try:
                candidate.unlink()
            except OSError as exc:
                logger.warning("Failed to remove upload file %s: %s", candidate, exc)
            break

    return Response(status_code=204)


@router.post("/{upload_id}/reprocess")
async def reprocess_upload(upload_id: int, background_tasks: BackgroundTasks) -> UploadResponse:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM uploads WHERE id=?", (upload_id,))
        upload = await cursor.fetchone()
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")

        if upload["status"] not in ("failed", "done"):
            raise HTTPException(status_code=400, detail="Can only reprocess failed or done uploads")

        # Delete old entries and reset status
        await db.execute("DELETE FROM entries WHERE upload_id=?", (upload_id,))
        await db.execute(
            "UPDATE uploads SET status='pending', error_message=NULL, processed_at=NULL,"
            " reviewed=0, reviewed_at=NULL WHERE id=?",
            (upload_id,),
        )
        await db.commit()

    background_tasks.add_task(process_upload, upload_id)

    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM uploads WHERE id=?", (upload_id,))
        row = await cursor.fetchone()
        assert row is not None

    return UploadResponse(
        id=row["id"],
        filename=row["filename"],
        status=row["status"],
        created_at=row["created_at"],
    )
