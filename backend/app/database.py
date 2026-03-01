from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import aiosqlite

from app.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS uploads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    filename        TEXT NOT NULL,
    filepath        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at);

CREATE TABLE IF NOT EXISTS entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id       INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
    entry_type      TEXT NOT NULL,
    subtype         TEXT,
    occurred_at     TEXT NOT NULL,
    date            TEXT NOT NULL,
    value           REAL,
    notes           TEXT,
    confidence      TEXT,
    raw_text        TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_occurred_at ON entries(occurred_at);
CREATE INDEX IF NOT EXISTS idx_entries_upload_id ON entries(upload_id);
"""


async def _migrate(db: aiosqlite.Connection) -> None:
    """Run migrations for columns added after initial schema."""
    cursor = await db.execute("PRAGMA table_info(entries)")
    columns = {row[1] for row in await cursor.fetchall()}
    if "confirmed" not in columns:
        await db.execute(
            "ALTER TABLE entries ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 0"
        )
        await db.commit()


async def init_db() -> None:
    async with aiosqlite.connect(settings.database_path) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")
        await db.executescript(SCHEMA)
        await _migrate(db)
        await db.commit()


@asynccontextmanager
async def get_db() -> AsyncGenerator[aiosqlite.Connection]:
    async with aiosqlite.connect(settings.database_path) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys=ON")
        yield db
