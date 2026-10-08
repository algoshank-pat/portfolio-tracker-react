# AGENTS.md

Instructions for AI coding agents (Claude Code and others) working in this repo.
Product spec: [docs/SPEC.md](docs/SPEC.md). Owner: Shashank (GitHub: algoshank-pat).

## Rules (read first, non-negotiable)

1. **Do only the step I name.** Do not start the next step, add features, or refactor outside the step.
2. **Plan first.** For every step: state your plan and the files you will touch, then wait for my "go". Do not write code before I say go.
3. **Never run `git commit`, `git push`, create a GitHub repo, or deploy anything unless I explicitly tell you to in that message.** Local file edits and tests are fine once I have said go for the step.
4. **Never enter, store or ask me to paste passwords, tokens or API keys into files or commands.** Sign-ins and authorizations are done by me in my browser.
5. **Show me the diff / list of changed files and how to run and test it at the end of each step.** Then stop.
6. No real holdings or personal data anywhere in the repo. Sample data only, and it must be made-up.
7. Ask before adding any dependency not named in SPEC.md.
8. Windows laptop, PowerShell. Node v24, uv 0.11, git 2.54 are installed.

## Project context

- Week 1 project for Maven "Mastering Agentic AI" (Gen Academy). The deliverable is a public URL.
- The tested calculation code in `backend/app/core/` was copied from an earlier Streamlit version (see SPEC.md, "Reused code"). That version was retired on 2026-10-08; this repo is self-contained.
- The original diagrams in `C:\Maven\Projects\Week1` (`portfolio-tracker-architecture.svg/.png/.drawio`) are not edited in place; edits go to the copies in `docs/` (step 8).

## Build steps

| Step | Scope | Status |
| --- | --- | --- |
| 0 | Kickoff: plan only | Done |
| 1 | Docs only: README, SPEC, AGENTS, CLAUDE | Done |
| 2 | Backend skeleton: uv project, copied modules and tests, `GET /health` | Done |
| 3 | Backend API: three POST endpoints, limits, cache, snapshot fallback | Done |
| 4 | Frontend skeleton and design system (proposal approved first) | Done |
| 5 | Tab 1: Input Transactions | Done |
| 6 | Tab 2: Current Portfolio | Done |
| 7 | Tab 3: Historical Performance | Done |
| 8 | Tab 4: Architecture (and diagram updates) | Done (PNG export pending) |
| 9 | Polish and hardening | Done |
| 10 | Repo and deploy: checklist first, each action on my go | Done 2026-10-05 (see docs/DEPLOY.md) |

### "Ask your portfolio" assistant (SPEC.md section 11)

One step at a time; each starts only on Shashank's "go". Commits, pushes, env vars and deploys each need their own "go".

| Step | Scope | Status |
| --- | --- | --- |
| C1 | Spec: SPEC.md section 11, K9 superseded, this table | Done |
| C2 | Backend setup: `langchain-core` + `langchain-anthropic`, settings, model factory, tracing off, chat off without a key | Done |
| C3 | Tools: `get_holdings`, `get_performance`, `get_xirr`, `get_price_status`, `what_if` + unit tests | Done |
| C4 | Scope check (structured output) + tests with the fake model | Done |
| C5 | `POST /api/chat`: NDJSON activity stream, tool loop, caps, data-not-instructions, no logging | Done |
| C6 | Backend tests: scope, tools, turn cap, message cap, prompt injection, no key leak, snapshot label, tracing off | Done |
| C7 | Browser storage: localStorage transactions, "Clear my data", new privacy notice | Done |
| C8 | Pop-up assistant UI: chat + activity panel, streaming, waking bar, not-advice line | Done |
| C9 | Docs kept true: README, Architecture tab, diagram, build prompt, QA checklist | Done |
| C10 | Local verification: all tests, build, npm audit + OSV, local end-to-end | Done |
| C11 | Shashank sets `ANTHROPIC_API_KEY` on Render (key from the `portfolio-tracker` Console workspace) | Done |
| C12 | Deploy: small commits, push, confirm both hosts rebuilt, live chat smoke test | Done |
| C13 | Live QA checklist run, honest report | Done 2026-10-08 (cold start, real file upload and phone checks left to Shashank) |

## Run / test commands

Filled in as steps land.

### Backend (from step 2)

Run from `backend/` in PowerShell:

```powershell
uv sync                                           # create .venv and install (Python 3.12, pinned in .python-version)
uv run pytest                                     # all tests, offline (fake prices, no Yahoo)
uv run uvicorn app.main:app --reload              # API on http://127.0.0.1:8000 (docs at /docs)
uv run python scripts/snapshot_prices.py          # refresh data/price_snapshot.json from Yahoo
```

Environment variables (all optional, defaults in `app/config.py`):
`CORS_ORIGINS` (comma-separated, default the Vite dev origins), `PRICE_SOURCE` (`live` | `snapshot` | `demo`),
`MAX_BODY_BYTES`, `MAX_ROWS`, `MAX_TICKERS`, `RATE_LIMIT_PER_MINUTE`, `PRICE_TIMEOUT_S`, `PRICE_TTL_S`, `BAD_TICKER_TTL_S`.

Tests never call Yahoo: they inject `tests/fakes.py`. Do not add tests that need the network.

Assistant settings (from step C2):
`ANTHROPIC_API_KEY` (secret; set only in Render's Environment tab or your own terminal, never in a file, command or chat),
`LLM_PROVIDER` (default `anthropic`), `CHAT_MODEL` (default `claude-haiku-5-5`).
Never set `LANGSMITH_TRACING` or `LANGCHAIN_TRACING_V2`: tracing would send chat text to LangSmith. Chat tests use LangChain's fake chat model; they never need a key.

### Frontend (from step 4)

Run from `frontend/`:

```powershell
npm install
npm run dev          # http://localhost:5173, calls VITE_API_URL (default http://127.0.0.1:8000)
npm run build        # tsc --noEmit + vite build into dist/  (this is the frontend "test pass")
npm run preview      # serve dist/ locally
```

Approved frontend dependencies: react, react-dom, recharts, @fontsource-variable/inter, @fontsource-variable/source-serif-4
(dev: vite, @vitejs/plugin-react, typescript, @types/react, @types/react-dom). Vitest and ESLint were **not** approved.

`docs/architecture.svg`/`.drawio` and `backend/data/sample_transactions.csv` are copied into `frontend/public/`;
`backend/tests/test_sample_copies.py` fails if the copies drift.

Manual QA: `docs/QA_CHECKLIST.md`.
