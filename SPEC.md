# Portfolio Tracker (React + FastAPI): specification

Source: "Portfolio Tracker React - Claude Code Handoff.md" (sections 2, 4 and 8), plus decisions made at kickoff on 2026-10-04.
Working rules for agents are in [AGENTS.md](AGENTS.md).

## 1. Objective

A read-only stock portfolio tracker published at a public URL that anyone can open for at least a week. The URL is the Maven Week 1 submission (handout drops Tue Oct 6, 2026; due Sun Oct 11, 2026).

The course demo used Streamlit + uv + yfinance. This version deliberately uses **React + FastAPI**, with the same scope plus the additions below.

## 2. Decisions

| Area | Decision |
| --- | --- |
| Frontend | React + Vite + TypeScript. Charts: Recharts. Styling decided in step 4 (propose, wait for approval). |
| Backend | Python 3.10+ FastAPI, managed with uv. **Stateless**: browser sends transactions with each request; server stores nothing, no database. |
| Prices | yfinance (unofficial Yahoo Finance), unadjusted daily closes. Short-lived in-memory cache. |
| Hosting | Frontend on **Cloudflare Pages** (free). Backend on **Render free** web service. Free backend sleeps after 15 min idle and takes about a minute to wake. Optionally upgrade the backend for the review week only (about $7/month, prorated). |
| Tabs | 1 Input Transactions, 2 Current Portfolio, 3 Historical Performance, 4 Architecture (explainer). |
| Tab 1 | Manual entry form + CSV upload + a **checkbox "Use the sample portfolio"** (pre-checked; when checked it loads the bundled sample and greys out the upload box). Sample goes through the same validation path. "Download sample CSV" link. |
| Tab 4 | Shows the architecture picture (static SVG/PNG, with zoom and caption) plus short written explanations of each component and the request flow. |
| Look and feel | **Beautiful and stunning, clean light editorial** (see section 6). |
| Public safety | Upload cap about 2 MB and 5,000 rows, max about 25 tickers per request, per-IP rate limit, request timeouts, no persistence, never log request bodies, CORS allow-list limited to the frontend origin, visible notice "Use sample or made-up data. Nothing is saved." (Notice and storage changed 2026-10-07: see A11.) |
| Resilience | Friendly "Waking the server" loading state for the cold start. A clearly labelled **price snapshot fallback** if Yahoo fails ("Prices as of <date>, live feed unavailable"). Never present synthetic or snapshot data as live. |
| Expected load | About 350 users over a week: light. The slow part is Yahoo, so cache per ticker, share concurrent fetches of the same ticker, and remember bad tickers briefly. Run one worker process (512 MB RAM). |

### Named dependencies

Backend: FastAPI, uvicorn, pandas, yfinance, pytest, httpx (numpy comes with pandas and is used by the demo price provider).
Added 2026-10-07 for the assistant (section 11): `langchain-core`, `langchain-anthropic`.
Frontend: React, Vite, TypeScript, Recharts.
Anything else needs approval first (AGENTS.md rule 7).

## 3. Metrics (do not invent other formulas)

- Total invested = sum of BUY quantity x price + fees.
- Total sold (proceeds) = sum of SELL quantity x price - fees.
- Holdings: weighted-average cost. BUY adds quantity and (qty x price + fees) to cost; SELL removes shares at the current average cost (average unchanged). Closed positions are dropped. Selling more than held is a validation error (same-day BUYs are processed before SELLs).
- Current value = sum of shares held x latest price.
- Total return = current value + total sold - total invested; also shown as % of invested.
- XIRR = annualized rate of dated cash flows (BUY negative, SELL positive, today's current value as the final positive flow), 365-day year, bisection solver; return null if it cannot be computed.
- Holdings table per ticker: quantity, avg cost, current price, market value, unrealized gain/loss ($ and %), weight %.
- Trend: daily portfolio value and cumulative net invested (buys minus sell proceeds) from the first trade date.
- v1 limits: USD only; splits, dividends and non-US tickers ignored; daily closes.

## 4. CSV format

```
trade_date,ticker,side,quantity,price,fees
2024-01-15,AAPL,BUY,10,185.00,1.00
```

`fees` optional. Dates `YYYY-MM-DD`. Any invalid row rejects the whole file with row numbers listed (never half-import).

## 5. API (all JSON, stateless)

- `GET /health` returns `{"status":"ok"}`.
- `POST /api/transactions/validate` with `{"csv": "<text>"}` or `{"rows": [...]}` returns `{"transactions":[...], "count":n}` or HTTP 422 `{"errors":[ "Row 3: ...", ... ]}`.
- `POST /api/portfolio` with `{"transactions":[...]}` returns `{"as_of", "price_source":"live"|"snapshot", "price_note", "current_value", "holdings":[{ticker, quantity, avg_cost, current_price, market_value, unrealized_pl, unrealized_pl_pct, weight}], "missing_prices":[...]}`.
- `POST /api/performance` with `{"transactions":[...]}` returns `{"price_source", "price_note", "summary":{total_invested,total_sold,current_value,total_return,total_return_pct,xirr}, "trend":[{date, portfolio_value, net_invested}]}`. See kickoff decision K2 for an added `missing_prices` field.
- Limits: body about 2 MB, 5,000 rows, about 25 tickers. Errors are JSON with a readable message. CORS allow-list from an env var.

## 6. Design brief ("beautiful and stunning", clean light editorial)

- Warm white and soft gray backgrounds, generous whitespace, **one** strong accent color, subtle borders and soft shadows.
- Editorial typography: a refined serif for headings and numbers of emphasis, a clean sans for body. Self-hosted fonts (no third-party requests). Tabular numerals for all money columns.
- Motion: restrained and purposeful (chart entrance animations, tab transitions, skeleton loaders). Respect `prefers-reduced-motion`.
- Data viz: accessible color palette, direct labels where possible, legible tooltips, no chartjunk.
- Every tab must be designed in all states: empty, loading, error, and populated. Includes the cold-start 'Waking the server' state and the 'snapshot prices' banner.
- Responsive from 360 px phones to wide desktops; keyboard accessible; WCAG AA contrast.
- Light mode only for v1 (dark mode is out of scope unless asked).
- Propose the design system in writing before building (step 4) and wait for approval.

## 7. Folder layout (agreed at kickoff)

```
portfolio-tracker-react/
  README.md  SPEC.md  AGENTS.md  CLAUDE.md
  docs/                     architecture.svg/.png/.drawio (updated copies, step 8)
  backend/
    pyproject.toml  uv.lock  .python-version
    app/
      main.py               app factory, CORS, middleware, router wiring
      config.py             env settings (CORS_ORIGINS, limits, PRICE_SOURCE)
      limits.py             body/row/ticker caps, rate limiter, timeouts
      schemas.py            Pydantic request/response models
      routes/               health.py, transactions.py, portfolio.py, performance.py
      services/portfolio.py turns core results into API responses
      core/                 copied: transactions, accounting, xirr, history, prices
      pricing/              cache.py (TTL + single-flight + negative cache),
                            snapshot.py, service.py (live, then snapshot; sets price_source)
    data/                   sample_transactions.csv, price_snapshot.json
    scripts/snapshot_prices.py
    tests/                  copied tests + API and pricing tests
  frontend/
    package.json  vite.config.ts  tsconfig*.json  index.html
    public/                 sample_transactions.csv, favicon
    src/
      main.tsx  App.tsx
      api/                  client.ts (VITE_API_URL, timeouts, wake detection), types.ts
      state/                transactions store (React context + reducer)
      design/               tokens.css, global.css
      components/           Tabs, MetricCard, DataTable, Banner, WakingServer, Skeleton,
                            EmptyState, ErrorState, ErrorBoundary, charts/
      tabs/                 InputTab, PortfolioTab, PerformanceTab, ArchitectureTab
      lib/format.ts         currency, percent and date formatting
```

### Reused code

Copied from the earlier Streamlit version (retired 2026-10-08) into `backend/app/core/` and `backend/tests/`, adapting imports only:
`transactions.py`, `accounting.py`, `xirr.py`, `history.py`, `prices.py`, and tests `test_transactions.py`, `test_accounting.py`, `test_xirr.py`, `test_history.py`, `test_prices.py`, `conftest.py` (26 tests).
Not copied: `store.py`, `app.py`, `test_store.py`, `test_app.py`.
`data/samples/sample_transactions.csv` (7 made-up trades: AAPL, MSFT, VTI) seeds the new sample.

## 8. Decisions from kickoff (2026-10-04)

### API and behaviour

K9 was chosen explicitly. The others are the recommended defaults, accepted when step 1 was approved; each is re-checked in the plan of the step that implements it.

| # | Topic | Decision |
| --- | --- | --- |
| K1 | Snapshot scope | `price_snapshot.json` holds daily closes (not just the latest price) for the sample tickers, so the trend chart works on snapshot data. Tickers not in the snapshot appear in `missing_prices`. |
| K2 | Missing prices | `/api/performance` also returns `missing_prices` (and `as_of`), so an understated current value or XIRR is visible. |
| K3 | Units | The API returns fractions (0.12 = 12%) for all percentages; the UI formats them. |
| K4 | Row numbers | CSV errors use spreadsheet numbering (header = row 1, first data row = row 2). `{"rows": [...]}` errors use 1-based row numbers. Oversell errors name the date and ticker. |
| K5 | Sample vs manual rows | Checked sample = sample only, upload and manual entry disabled. Unchecking clears it and enables upload and manual entry. Manual rows append to whatever is loaded. |
| K6 | Sample CSV copies | One copy in `backend/data/`, one in `frontend/public/`; a backend test fails if they differ. |
| K7 | Trend size | Return daily points; add downsampling only if it proves slow. |
| K8 | Dates | "As of" and the XIRR end date use the date of the last price used, not the server clock (Render runs on UTC). |
| K9 | Browser storage | ~~Transactions are held in React state only and cleared on refresh. No localStorage.~~ **Superseded 2026-10-07 by A11:** transactions are saved in this browser's localStorage; the server still stores nothing. |
| K10 | NaN | Missing numeric values are sent as JSON `null`, never NaN. |
| K11 | Price fetching | The cache is per ticker, so step 3 adds a per-ticker fetch layer (`yf.Ticker(...).history`, unadjusted) instead of the batch `yf.download`, which is not safe to call concurrently. |
| K12 | Price sources (step 3) | `price_source` is `live` or `snapshot` in production. If any ticker falls back to the snapshot, the whole response is labelled `snapshot` and the note names the tickers. `demo` (synthetic, labelled) exists only when `PRICE_SOURCE=demo` for offline testing. After a Yahoo error or timeout, live calls pause for 60 s (circuit breaker). |
| K13 | Error shape (step 3) | Every error response is `{"errors": ["readable message", ...]}`: 422 validation, 413 too large, 429 rate limited (with `Retry-After`), 500 unexpected. |
| K14 | Rate limit (step 3) | 60 requests per minute per IP on `/api/*` (`/health` is exempt). Client IP is the first `X-Forwarded-For` address; that header can be spoofed, which is acceptable for this demo. |

### Dependencies (decided 2026-10-04)

| Need | Decision |
| --- | --- |
| Rate limiting | Hand-rolled in-memory limiter, no new package. |
| Self-hosted fonts | **Approved:** `@fontsource-variable/inter`, `@fontsource-variable/source-serif-4`. |
| Frontend tests | Vitest **not approved**. The frontend check is `npm run build` (TypeScript + build) plus the manual QA checklist. |
| Linting | ESLint **not approved**; the frontend was set up by hand without the Vite template's ESLint packages. |

### Design system (approved 2026-10-04)

Source Serif 4 (headings, big numbers) + Inter (body, tables, tabular numerals). Warm-white `#FBFAF7` background, white cards,
one ink-blue accent `#2B3A8C`, gain `#17704A`, loss `#B42318`. 8-colour chart palette; the donut shows the top 7 holdings and
groups the rest as "Other". Type scale 12/14/16/20/25/31/39/49, 4 px spacing grid, radius 8/12, one soft card shadow.
Motion 150–250 ms ease-out, off under `prefers-reduced-motion`. Plain CSS custom properties (`src/design/tokens.css`)
plus CSS Modules. Light mode only.

### Architecture diagram (applied in step 8)

The original files in `Week1` stay untouched; the copies in `docs/` get these edits.

| # | Area | Change |
| --- | --- | --- |
| D1 | Hosting zone | Header "HOSTING · CLOUDFLARE PAGES + RENDER". Frontend: Cloudflare Pages (free), `*.pages.dev`. Backend: Render free, sleeps after 15 min idle, about 1 min to wake. Wiring box keeps the env var and CORS lines. |
| D2 | Input box | "☑ Use the sample portfolio (default)" / "CSV upload (drag and drop)" / "Manual entry form · Download sample CSV". |
| D3 | Browser state | "Held in React state only · cleared on refresh" / "No account, no database, nothing saved". Changed 2026-10-07 (A11) to "Saved in this browser only (localStorage)" / "\"Clear my data\" removes it · nothing on our server"; the diagram also gained the assistant boxes and an Anthropic zone. |
| D4 | Prices | Two boxes. **Price cache**: per-ticker TTL, shared in-flight fetch, bad-ticker memory. **Prices + snapshot fallback**: live yfinance, else `price_snapshot.json` labelled "Prices as of <date>". |
| D5 | FastAPI box | Add "Limits: 2 MB · 5,000 rows · 25 tickers · rate limit · timeouts · no body logging". |
| D6 | Views box | Add "'Waking the server' screen · snapshot-prices banner"; "pie" becomes "donut". |
| D7 | Request flow | 1 Pick sample, upload CSV or add a row → 2 POST /validate; clean rows kept in React state → 3 Tabs POST them to /portfolio and /performance → 4 Backend re-validates, gets prices (cache → Yahoo → snapshot), computes holdings, XIRR, trend → 5 JSON back; React renders donut, tables, metrics, chart. |
| D8 | Labels | Plain name plus small file hint, e.g. "Validation · core/transactions.py", "Price cache · pricing/cache.py". |
| D9 | Title | "Portfolio Tracker: React + FastAPI architecture" in all three files. |
| D10 | Process | Hand-edit the `.drawio` and `.svg` copies. Shashank exports the PNG from draw.io, unless a rendering tool is approved. |

Status: D1–D10 applied to `docs/architecture.svg` and `docs/architecture.drawio` (canvas grew to 1300×920). `docs/architecture.png` is **not yet exported**; Tab 4 uses the SVG.

### Frontend behaviour decided while building (steps 4–9)

| # | Topic | Decision |
| --- | --- | --- |
| F1 | Tabs | Hash URLs (`#input`, `#portfolio`, `#performance`, `#architecture`) so a tab can be linked; ARIA tabs with arrow/Home/End keys. |
| F2 | Upload | A CSV upload replaces the current list; manual rows append. Files over 2 MB are rejected in the browser before sending. |
| F3 | Cold start | `/health` is pinged on page load. If a request takes over 2.5 s, or the server is unreachable or returns 502/503/504, the "Waking the server" bar shows and requests retry for about a minute (timeout 100 s each). |
| F4 | Results | Portfolio and performance are both requested whenever the transactions change, so switching tabs is instant. |
| F6 | Landing page (2026-10-04, Shashank) | Dashboards first. Tab order is now 1 Current Portfolio, 2 Historical Performance, 3 Input Transactions, 4 Architecture, and the app opens on Current Portfolio with the sample loaded. A top-right header card says "Now showing: A sample portfolio" and offers "Upload your CSV" (straight to the dashboard on success, to the Input tab on errors), "or enter trades by hand", the template download, and the "Use sample or made-up data. Nothing is saved." notice (now "Your transactions are saved in this browser only, never on our server.", A11). Headline is one line: "Every trade, one clear picture." |
| F5 | Derived display values | Cost basis (avg cost × quantity), total unrealized P/L and the chart tooltip's total return (value − net invested) are sums or rearrangements of the spec formulas, not new metrics. |

## 9. Risks and open questions

- Yahoo may rate-limit or block cloud IPs. The snapshot fallback mitigates this. Live prices have never been tested; test on the laptop from step 3.
- Render free has 512 MB RAM and loads pandas: keep payload caps, one worker, avoid heavy imports.
- The cold start (about a minute) could look like a broken app to a reviewer, so the wake-up screen is required.
- Public repo and public sample: the sample CSV must be made-up.
- Cloudflare has been steering new static sites towards Workers; confirm Pages setup against current docs in step 10.

## 10. Maven handout changes

The handout drops Tue Oct 6, 2026. Record any submission format or extra requirements here, and update this spec before step 9.

_None yet._

## 11. "Ask your portfolio" assistant (decided 2026-10-07)

A chat assistant that answers questions about the loaded portfolio only (the sample or the user's upload). It explains; it never recommends buying or selling.

| # | Topic | Decision |
| --- | --- | --- |
| A1 | Placement | A pop-up assistant: a round "Ask" button bottom-right on every tab once a portfolio is loaded. Desktop: a floating panel about 720 px wide, chat left, activity steps right. Phone: a full-screen sheet, chat first, with an "Activity" toggle. Closes with ✕ or Esc; focus is trapped while open. |
| A2 | Model | Claude Haiku 5.5 (`claude-haiku-5-5`) through LangChain (`langchain-core` + `langchain-anthropic`). Chosen for cost (estimated $0.002–0.004 per question, to be measured) and so GPT or Llama can be swapped in later. |
| A3 | Provider switch | One factory builds the chat model from settings: `LLM_PROVIDER` (default `anthropic`) and `CHAT_MODEL` (default `claude-haiku-5-5`). Everything else is provider-neutral LangChain code. Another provider = its LangChain package + these two settings. |
| A4 | Scope check | Every message first goes through one LLM call with structured output: `decision` (`in_scope` \| `out_of_scope` \| `unclear`), a one-line `reason`, and a `question_type`. Out of scope (general knowledge, "should I buy X", tickers not in the portfolio) → a polite decline saying it only covers the loaded portfolio; no tools run. Unclear → one clarifying question; no tools run. |
| A5 | Tools (all math) | The model never does arithmetic. Five tools wrap the existing tested code: `get_holdings` (holdings + current value, as `/api/portfolio`), `get_performance` (summary as `/api/performance`), `get_xirr`, `get_price_status` (price source, note, as-of date, missing prices) and `what_if`. Every answer names the tools it used. If prices came from the stored snapshot, the answer says so. |
| A6 | `what_if` | One hypothetical BUY or SELL of a ticker that already appears in the transactions: `side`, `ticker`, `quantity` (> 0), `price` (default: that ticker's latest price), `fees` (default 0), dated at the as-of date. It is appended to the transactions, re-validated by the same code (an oversell is rejected) and recomputed by the same engine. Returns before/after: current value, total invested, total sold, total return ($ and %), XIRR, and that ticker's quantity, avg cost and weight. Nothing is saved. |
| A7 | Activity panel | Streams one line per step as it happens: question received → context check result → each tool call with its arguments → tool result summary → answer with tools used. A declined question stops after the check with "Declined: not about this portfolio". |
| A8 | API | `POST /api/chat` with `{transactions, message, history}` → a streamed `application/x-ndjson` response, one JSON event per line (`received`, `scope`, `tool_call`, `tool_result`, `answer`, `declined`, `clarify`, `error`). Stateless: the browser sends the transactions and recent history with every question. No API key set → the chat replies "The assistant is unavailable right now" and the rest of the app is unaffected. |
| A9 | Limits | Existing upload limits (2 MB, 5,000 rows, 25 tickers) and 60 requests a minute per IP apply to `/api/chat` too. New: a message is at most 500 characters; at most 4 tool-call turns per question; at most the last 10 history messages are sent, each capped at 500 characters. No app-side daily cap: cost is bounded by a monthly spend limit on a dedicated Anthropic Console workspace that owns the key. |
| A10 | Security | The key lives only in the server environment variable `ANTHROPIC_API_KEY`, never in the browser, a response, an error or a log. Text from the CSV and from tool results is passed to the model as data inside clearly marked blocks, never as instructions (CSV fields are already restricted to dates, ticker symbols, BUY/SELL and numbers). Message text, history and transactions are never logged. LangSmith/LangChain tracing is forced off. CORS stays locked to the site. "Not investment advice" is shown in the panel and stated in the system prompt. |
| A11 | Browser storage | Uploaded or hand-entered transactions are saved in this browser's localStorage and reloaded (and re-validated) on refresh or a return visit. Nothing saved → the made-up sample. A "Clear my data" button removes them and returns to the sample. The notice "Use sample or made-up data. Nothing is saved." becomes "Your transactions are saved in this browser only, never on our server." README, the Architecture tab, the diagram and the build prompt are updated to match. |
| A12 | Chat history | Kept in the open browser tab only; cleared on refresh. Never stored on the server or in localStorage. |
| A13 | Tests | Backend tests use LangChain's fake chat model (no key, no network): scope in / out / unclear, each tool, `what_if`, the turn cap, the message cap, prompt-injection text in a CSV, no key leak, snapshot labelling, tracing off. Plus the existing 58 tests and the dependency vulnerability checks. |
| A14 | Feedback 2026-10-08 (Shashank) | (1) "Tools used" is no longer appended to answers; tools are listed in the Activity panel only (supersedes that part of A5). (2) The Activity panel is hidden by default behind a small "Show activity" link in the pop-up header, for demos (refines A1/A7); the panel is ~440 px wide without it, ~760 px with it. (3) "Do I hold X / how much X do I have" is in scope (holdings), answered "not in this portfolio" when it isn't held; questions about a ticker that isn't held are still declined (refines A4). (4) `get_holdings` also returns total cost basis and total unrealized gain/loss ($ and %), computed like the dashboard card; `what_if` also returns the trade's cost or proceeds and every before-to-after change, so the model never needs arithmetic. (5) Answers lead with the direct answer, then an optional short list; the chat renders **bold** and lists safely (React elements only, no HTML). |
| A15 | Monitoring (2026-10-08) | One privacy-safe log line per question, `chat_metrics`: outcome, scope decision and type, tool names, turns, ms, input/output tokens (LangChain usage metadata, scope check included) and an estimated cost from list prices (`CHAT_PRICE_IN_PER_MTOK` / `CHAT_PRICE_OUT_PER_MTOK`, Haiku 5.5 defaults). Never text, tickers or amounts. LangSmith stays off (free tier exists, but it would store questions and answers with a third party). |
