from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import get_db, init_db
from app.routers import dashboard, entries, uploads


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    await init_db()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    # Reset any uploads stuck in 'processing' back to 'pending'
    async with get_db() as db:
        await db.execute("UPDATE uploads SET status='pending' WHERE status='processing'")
        await db.commit()
    yield


app = FastAPI(
    title="babylog",
    description="Baby log parser and dashboard",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(uploads.router)
app.include_router(entries.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
