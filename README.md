# Portfolio Tracker (React + FastAPI)

A read-only stock portfolio tracker. Upload a CSV of buy and sell transactions (or use the made-up sample portfolio) and see:

1. **Current Portfolio** (landing page, sample loaded): current value, allocation donut and holdings table.
2. **Historical Performance**: total invested, total sold, current value, total return, XIRR, and portfolio value vs net invested over time.
3. **Input Transactions**: sample portfolio, CSV upload (drag and drop), or manual entry, all validated by the backend. A header card on every page also offers "Upload your CSV".
4. **Architecture**: how the app is built, with a zoomable diagram and the request flow.

The backend is stateless: the browser sends its transactions with each request and nothing is saved anywhere. Use sample or made-up data only.

Built for the Maven "Mastering Agentic AI" (Gen Academy) Week 1 project. The course demo used Streamlit; an earlier Streamlit version of this tracker lives in the sibling folder `portfolio-tracker`. This version uses React + FastAPI.

## Stack

- **Frontend:** React 19, Vite, TypeScript, Recharts, self-hosted Inter and Source Serif 4 fonts. Hosted on Cloudflare Pages.
- **Backend:** Python 3.12 FastAPI, managed with uv. Hosted on Render (free tier, so the first request after 15 idle minutes takes about a minute; the app shows a "Waking the server" notice).
- **Prices:** Yahoo Finance via yfinance (unofficial, unadjusted daily closes), cached per ticker, with a clearly labelled price snapshot fallback.

## Folder layout

```
portfolio-tracker-react/
  README.md  SPEC.md  AGENTS.md  CLAUDE.md
  docs/       architecture diagram (.svg, .drawio), QA checklist
  backend/    FastAPI app (app/), tests, sample CSV + price snapshot (data/), snapshot script
  frontend/   Vite React TypeScript app (src/), static files (public/)
```

Full details: [SPEC.md](SPEC.md). Rules for AI coding agents: [AGENTS.md](AGENTS.md).

## Running locally (Windows, PowerShell)

Needs uv and Node 20+. Use two terminals.

**Backend** (from `backend/`):

```powershell
uv sync
uv run pytest
uv run uvicorn app.main:app --reload
```

The API runs on http://127.0.0.1:8000 with interactive docs at `/docs`.

**Frontend** (from `frontend/`):

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The frontend calls `http://127.0.0.1:8000` unless `VITE_API_URL` says otherwise (see `frontend/.env.example`).

Useful backend switches: `$env:PRICE_SOURCE="snapshot"` (use only the stored prices) or `"demo"` (synthetic, labelled; offline).

## Checks

```powershell
cd backend;  uv run pytest            # 57 tests, offline
cd frontend; npm run build            # TypeScript check + production build
```

Manual checks before a release: [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md).

## Refreshing the price snapshot

```powershell
cd backend
uv run python scripts/snapshot_prices.py
```

This writes `backend/data/price_snapshot.json` (daily closes for the sample tickers). The backend uses it only when Yahoo fails, and says "Prices as of <date>, live feed unavailable".

## Keeping copies in sync

`backend/data/sample_transactions.csv` and `docs/architecture.svg` / `.drawio` are the sources. After changing one, copy it to `frontend/public/`. A backend test fails if the copies drift.

## Status

Steps 1 to 9 of 10 done (built and tested locally). Step 10, repo and deploy, has not started.

## Limits (v1)

USD only. Splits, dividends and non-US tickers are ignored. Daily closing prices. About 2 MB, 5,000 rows and 25 tickers per request; 60 requests per minute per visitor.

Read-only demo. Not investment advice.
