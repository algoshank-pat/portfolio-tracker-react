# Portfolio Tracker (React + FastAPI)

A read-only stock portfolio tracker. Upload a CSV of buy and sell transactions (or use the made-up sample portfolio) and see:

1. **Current Portfolio** (landing page, sample loaded): current value, allocation donut and holdings table.
2. **Historical Performance**: total invested, total sold, current value, total return, XIRR, and portfolio value vs net invested over time.
3. **Input Transactions**: sample portfolio, CSV upload (drag and drop), or manual entry, all validated by the backend. A header card on every page also offers "Upload your CSV".
4. **Architecture**: how the app is built, with a zoomable diagram and the request flow.

Plus an **"Ask your portfolio" assistant**: the round "Ask" button bottom-right opens a chat about the loaded portfolio only. Every question first goes through a scope check; the numbers come from tools that wrap the same tested calculations as the dashboards (the model never does arithmetic), and an Activity panel shows each step as it happens. It explains; it never recommends buying or selling.

**Privacy:** your transactions are saved in this browser only (localStorage), never on our server. "Clear my data" removes them and shows the sample again. The backend is stateless: the browser sends its transactions with each request and the server stores nothing. Chat history lives in the open tab only. Use sample or made-up data.

Built for the Maven "Mastering Agentic AI" (Gen Academy) Week 1 project. The course demo used Streamlit; an earlier Streamlit version of this tracker lives in the sibling folder `portfolio-tracker`. This version uses React + FastAPI.

## Stack

- **Frontend:** React 19, Vite, TypeScript, Recharts, self-hosted Inter and Source Serif 4 fonts. Hosted on Cloudflare Pages.
- **Backend:** Python 3.12 FastAPI, managed with uv. Hosted on Render (free tier, so the first request after 15 idle minutes takes about a minute; the app shows a "Waking the server" notice).
- **Prices:** Yahoo Finance via yfinance (unofficial, unadjusted daily closes), cached per ticker, with a clearly labelled price snapshot fallback.
- **Assistant:** Claude Haiku 5.5 (`claude-haiku-5-5`) through LangChain (`langchain-core` + `langchain-anthropic`), so another provider can be swapped in via settings. LangSmith tracing is forced off.

## Folder layout

```
portfolio-tracker-react/
  README.md  SPEC.md  AGENTS.md  CLAUDE.md
  docs/       architecture diagram (.svg, .drawio), QA checklist
  backend/    FastAPI app (app/), tests, sample CSV + price snapshot (data/), snapshot script
  frontend/   Vite React TypeScript app (src/), static files (public/)
  samples/    extra made-up CSVs for testing uploads (two valid, one with errors)
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

The assistant needs `ANTHROPIC_API_KEY` in the backend's environment (set it in your own terminal, never in a file). Without it the app still works and the assistant answers "The assistant is unavailable right now." Optional: `LLM_PROVIDER` (default `anthropic`), `CHAT_MODEL` (default `claude-haiku-5-5`).

## Checks

```powershell
cd backend;  uv run pytest            # 121 tests, offline (prices and the LLM are faked)
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

All 10 steps done. Deployed on 2026-10-05:

- **App:** https://portfolio-tracker-react.pages.dev (Cloudflare Pages)
- **API:** https://portfolio-tracker-react.onrender.com (Render free; `/health`, `/docs`)
- **Repo:** https://github.com/algoshank-pat/portfolio-tracker-react

The "Ask your portfolio" assistant and browser storage were added on 2026-10-08 (SPEC.md section 11). Every push to `main` redeploys both. Extra made-up CSVs for testing uploads are in [samples/](samples/README.md).

## Limits (v1)

USD only. Splits, dividends and non-US tickers are ignored. Daily closing prices. About 2 MB, 5,000 rows and 25 tickers per request; 60 requests per minute per visitor. Assistant: questions up to 500 characters, at most 4 tool-call turns per question, the last 10 chat messages sent as context.

Read-only demo. Not investment advice.
