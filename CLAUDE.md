# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is babylog

A full-stack app that turns photos of handwritten baby logs (in Russian) into structured data. Parents photograph paper notes tracking feedings, diaper changes, and weight — an LLM (Claude/OpenAI vision API) extracts entries, which are then reviewed and visualized on a dashboard. Single-user, no auth (Tailscale handles network security), SQLite storage.

## Development Commands

### Backend (FastAPI + Python 3.12+ with uv)
```bash
cd backend
uv run fastapi dev app/main.py --host 0.0.0.0 --port 3849
```
Requires `.env` file (copy from `.env.example`, set `ANTHROPIC_API_KEY`).

Lint: `cd backend && uv run ruff check app/`
Format: `cd backend && uv run ruff format app/`
Type check: `cd backend && uv run mypy app/`
Tests: `cd backend && uv run pytest`

### Frontend (React 19 + Vite 7 + TypeScript)
```bash
cd frontend
npm install
npm run dev        # dev server on port 5174
npm run build      # tsc -b && vite build
```

## Architecture

### Data Flow
Upload photo → `POST /api/uploads` → saved to disk, DB record created (status=pending) → FastAPI `BackgroundTask` calls `process_upload` → image sent to LLM vision API → JSON array of entries parsed → entries inserted in DB → status=done. On startup, any stuck `processing` uploads are reset to `pending`.

### Entry Types (differs from original spec)
- `feeding` with subtype `breast` | `formula` — value in ml
- `diaper` with subtype `pee` | `poo` | `dry` | `pee+poo` — no value
- `weight` — value in grams (displayed as kg in UI)

Entries also carry `confidence` (high/medium/low) and `raw_text` from LLM parsing.

### Backend Structure
- `app/main.py` — FastAPI app, CORS, lifespan (DB init + crash recovery), mounts routers
- `app/config.py` — Pydantic Settings from `.env` (LLM provider, keys, paths, CORS origins)
- `app/database.py` — async SQLite via aiosqlite, WAL mode, schema init, `get_db()` context manager
- `app/routers/` — uploads, entries, dashboard endpoints under `/api`
- `app/services/llm.py` — LLM provider abstraction (Anthropic/OpenAI), system prompt for Russian handwriting parsing
- `app/services/upload_processor.py` — background task: base64 encode image → LLM → parse → bulk insert entries

Ruff config: py312, line-length 100, select E/F/I/N/W/UP.

### Frontend Structure
- TanStack Router with file-based routing in `src/routes/`
- TanStack Query for server state; query keys: `['uploads']`, `['entries', {from, to, type}]`, `['dashboard', {from, to}]`
- `src/api/client.ts` — fetch wrapper using `BASE_URL` from Vite; all API calls go through `/babylog/api` proxy
- `src/types/index.ts` — TypeScript interfaces matching backend models
- Bottom tab navigation: Upload (`/`), Log (`/log`), Review (`/review`), Dashboard (`/dashboard`)
- Mobile-first, Tailwind CSS v4

### Tailscale Serve / Path Routing
Both frontend and backend are designed for Tailscale Serve with path-based routing:
- Frontend: `base: '/babylog/'` in vite.config.ts, served at `/babylog`
- Backend: API at `/babylog/api`, Vite proxy strips the prefix before forwarding to port 3849
- CORS origins configured via `FRONTEND_URL` env var (comma-separated)

### Database
SQLite with WAL mode. Two tables: `uploads` (photo tracking with status machine) and `entries` (typed log entries linked to uploads via nullable foreign key with ON DELETE SET NULL). `date` column is denormalized from `occurred_at` for efficient date-range queries.
