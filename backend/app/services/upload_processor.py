import logging
import mimetypes
import time
from pathlib import Path

from app.database import get_db
from app.services.llm import LLMService

logger = logging.getLogger(__name__)


async def process_upload(upload_id: int) -> None:
    start = time.monotonic()
    logger.info("Processing upload %d", upload_id)

    async with get_db() as db:
        await db.execute(
            "UPDATE uploads SET status='processing' WHERE id=?", (upload_id,)
        )
        await db.commit()

    try:
        # Read upload record
        async with get_db() as db:
            cursor = await db.execute(
                "SELECT filepath, filename FROM uploads WHERE id=?", (upload_id,)
            )
            row = await cursor.fetchone()
            if not row:
                raise ValueError(f"Upload {upload_id} not found")
            filepath = row["filepath"]
            filename = row["filename"]

        # Read image file
        image_path = Path(filepath)
        if not image_path.exists():
            raise FileNotFoundError(f"Image file not found: {filepath}")
        image_bytes = image_path.read_bytes()
        size_mb = len(image_bytes) / 1024 / 1024
        logger.info("Upload %d: file=%s size=%.1f MB", upload_id, filename, size_mb)

        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type or not mime_type.startswith("image/"):
            mime_type = "image/jpeg"

        # Call LLM
        llm = LLMService()
        llm_start = time.monotonic()
        entries = await llm.parse_image(image_bytes, mime_type)
        llm_duration = time.monotonic() - llm_start
        logger.info(
            "LLM returned %d entries for upload %d in %.1fs", len(entries), upload_id, llm_duration
        )

        # Insert entries
        async with get_db() as db:
            for entry in entries:
                date = entry["occurred_at"][:10]
                await db.execute(
                    """INSERT INTO entries
                       (upload_id, entry_type, subtype, occurred_at, date, value, notes, confidence, raw_text)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        upload_id,
                        entry["entry_type"],
                        entry.get("subtype"),
                        entry["occurred_at"],
                        date,
                        entry.get("value"),
                        entry.get("notes"),
                        entry.get("confidence"),
                        entry.get("raw_text"),
                    ),
                )

            await db.execute(
                "UPDATE uploads SET status='done', processed_at=datetime('now') WHERE id=?",
                (upload_id,),
            )
            await db.commit()

        total_duration = time.monotonic() - start
        logger.info("Upload %d processed successfully in %.1fs", upload_id, total_duration)

    except Exception as e:
        total_duration = time.monotonic() - start
        logger.exception("Failed to process upload %d after %.1fs", upload_id, total_duration)
        async with get_db() as db:
            await db.execute(
                "UPDATE uploads SET status='failed', error_message=? WHERE id=?",
                (str(e), upload_id),
            )
            await db.commit()
