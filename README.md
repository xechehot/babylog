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

To access from any device on your tailnet:

```bash
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --set-path /babylog -bg localhost:5174
```

Add the Tailscale hostname to `FRONTEND_URL` in `backend/.env` for CORS:

```
FRONTEND_URL=http://localhost:5174/babylog,https://<your-machine>.tailb94fe6.ts.net/babylog
```

Then open `https://<your-machine>.tailb94fe6.ts.net/babylog/`
