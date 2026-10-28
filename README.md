# babylog

Parse, organize, and visualize baby logs from handwritten notes.

## What is this?

Parents track feedings, diaper changes, and weight on paper. This app turns those handwritten logs into structured data and presents it as a clear dashboard.

**How it works:**

1. Take a photo of your handwritten log
2. The app recognizes and parses the entries (feedings, diapers, weight)
3. Data is structured and stored
4. View everything on a dashboard with charts and stats

## Dashboard

- **Feeding**: total ml per day, feeding frequency, trends over time
- **Diapers**: pee and poo count per day, patterns
- **Weight**: growth curve, percentile tracking
- Charts and visualizations for all metrics

## Tech stack

**Backend**: Python, uv, FastAPI

**Frontend**: React, Vite, TanStack (Router + Query), Tailwind CSS

## Getting started

### Prerequisites

- Python 3.12+, [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- Anthropic API key

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY
uv run fastapi dev app/main.py --host 0.0.0.0 --port 3849
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5174/babylog/

### Tailscale Serve

To access from any device on your tailnet, start both services then run:

```bash
bash tail_serve.sh
```

This sets up two paths — `/babylog/api` routes to the backend, `/babylog` routes to the frontend.

Add the Tailscale hostname to `FRONTEND_URL` in `backend/.env` for CORS:

```
FRONTEND_URL=http://localhost:5174/babylog,https://<your-machine>.tailb94fe6.ts.net/babylog
```

Then open `https://<your-machine>.tailb94fe6.ts.net/babylog/`

## API access (scripts and agents)

The backend is a FastAPI app, so the OpenAPI schema is generated from the code and always
current. Both it and the interactive docs are served under `/api`, which is the only prefix
Tailscale Serve forwards to the backend:

| What | URL |
|------|-----|
| OpenAPI schema | `https://<machine>.<tailnet>.ts.net/babylog/api/openapi.json` |
| Swagger UI | `https://<machine>.<tailnet>.ts.net/babylog/api/docs` |
| ReDoc | `https://<machine>.<tailnet>.ts.net/babylog/api/redoc` |
| Health check | `https://<machine>.<tailnet>.ts.net/babylog/api/health` |

Set `PUBLIC_BASE_URL` in `backend/.env` to that `.../babylog` prefix so the schema advertises
the right base URL — otherwise a client that reads the schema will resolve `/api/entries`
against the bare host and miss the `/babylog` prefix.

Endpoints an agent is likely to want (all read-only GETs):

```bash
# raw entries; type is one of feeding | diaper | weight | pills | food
curl "$BASE/api/entries?from_date=2026-09-01&to_date=2026-09-09&type=food"

# per-day aggregates: feeding ml and counts, diaper counts, latest weight
curl "$BASE/api/dashboard?from_date=2026-09-01&to_date=2026-09-09"

# uploaded photos and their parsing status
curl "$BASE/api/uploads"
```

`from_date` / `to_date` are `YYYY-MM-DD` and default to the last 7 days.

There is no authentication: anything that can reach the tailnet address can also POST, PATCH
and DELETE entries. Keep the service inside the tailnet, and use Tailscale ACLs if the agent
should only reach it from specific devices.
