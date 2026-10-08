# Developer guide

How to run, test, configure and monitor the app. The project overview is in the [README](../README.md); every design decision is in [SPEC.md](SPEC.md).

## Folder layout

```
portfolio-tracker-react/
  README.md   AGENTS.md (rules for AI coding agents)   CLAUDE.md
  backend/    FastAPI app (app/), tests, sample CSV + price snapshot (data/), snapshot script
  frontend/   Vite React TypeScript app (src/), static files (public/)
  docs/       SPEC, STATUS, this guide, QA checklist, deploy notes, build prompt, architecture diagram
  samples/    extra made-up CSVs for testing uploads (two valid, one with errors)
```

## Run locally (Windows, PowerShell)

Needs uv and Node 20+. Use two terminals.

```powershell
cd backend
uv sync
uv run uvicorn app.main:app --reload      # API on http://127.0.0.1:8000, docs at /docs
```

```powershell
cd frontend
npm install
npm run dev                               # http://localhost:5173
```

The frontend calls `http://127.0.0.1:8000` unless `VITE_API_URL` says otherwise (see `frontend/.env.example`).

## Tests and checks

```powershell
cd backend;  uv run pytest            # 129 tests, offline (prices and the LLM are faked)
cd frontend; npm run build            # TypeScript check + production build
```

Manual checks before a release: [QA_CHECKLIST.md](QA_CHECKLIST.md).

## Settings (backend environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (none) | The assistant's key. Set it in your own terminal or Render's Environment tab, never in a file. Without it the assistant replies "unavailable" and the rest of the app works |
| `LLM_PROVIDER`, `CHAT_MODEL` | `anthropic`, `claude-haiku-5-5` | Which model the assistant uses |
| `CORS_ORIGINS` | Vite dev origins | Comma-separated sites allowed to call the API |
| `PRICE_SOURCE` | `live` | `live` (Yahoo, then the snapshot), `snapshot` (stored prices only) or `demo` (synthetic, labelled; offline) |
| `MAX_BODY_BYTES`, `MAX_ROWS`, `MAX_TICKERS`, `RATE_LIMIT_PER_MINUTE` | 2 MB, 5,000, 25, 60 | Public-safety limits |
| `CHAT_MAX_MESSAGE_CHARS`, `CHAT_MAX_TOOL_TURNS`, `CHAT_MAX_HISTORY` | 500, 4, 10 | Assistant limits |
| `CHAT_PRICE_IN_PER_MTOK`, `CHAT_PRICE_OUT_PER_MTOK` | 0.10, 0.50 | List prices used for the cost estimate in the monitoring line |

Never set `LANGSMITH_TRACING` or `LANGCHAIN_TRACING_V2`: tracing would send chat text to a third party (the app forces it off anyway).

## Monitoring the assistant

Each question writes one line to the backend log (Render → your service → **Logs**, search `chat_metrics`):

```text
chat_metrics outcome=answer decision=in_scope type=xirr tools=get_xirr turns=1 ms=2310 in_tokens=1850 out_tokens=210 est_cost_usd=0.00029
```

| Field | Meaning |
| --- | --- |
| `outcome` | `answer`, `declined`, `clarify`, `error` (or `aborted` if the visitor left mid-answer) |
| `decision`, `type` | The scope check's verdict and question type |
| `tools`, `turns` | Tool names used and how many tool-call turns (max 4) |
| `ms` | Time from question to answer |
| `in_tokens`, `out_tokens` | Tokens across the scope check and every model call |
| `est_cost_usd` | Estimate from list prices; the Anthropic Console's Usage page has the billed amount |

The line never contains the question, the answer, tickers or amounts.

## Refreshing the price snapshot

```powershell
cd backend
uv run python scripts/snapshot_prices.py
```

This writes `backend/data/price_snapshot.json` (daily closes for the sample tickers). The backend uses it only when Yahoo fails, and labels it "Prices as of <date>, live feed unavailable".

## Keeping copies in sync

`backend/data/sample_transactions.csv`, `docs/architecture.svg` / `.drawio` and the prompt block in `docs/PROMPT.md` are the sources; their copies live in `frontend/public/`. A backend test fails if the copies drift.

## Deploy

Every push to `main` redeploys both hosts: Cloudflare Pages (frontend, root `frontend`) and Render (backend, root `backend`). Details and the original setup checklist: [DEPLOY.md](DEPLOY.md).
