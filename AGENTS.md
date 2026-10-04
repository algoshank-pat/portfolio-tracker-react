# AGENTS.md

Instructions for AI coding agents (Claude Code and others) working in this repo.
Product spec: [SPEC.md](SPEC.md). Owner: Shashank (GitHub: algoshank-pat).

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
- The earlier Streamlit version lives at `C:\Maven\Projects\Week1\portfolio-tracker`. **Do not modify it.** Reusable modules are copied from it (never moved); see SPEC.md, "Reused code".
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
| 10 | Repo and deploy: checklist first, each action on my go | Not started |

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
