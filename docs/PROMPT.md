# The prompt behind it

One prompt that captures everything this app does. It is shown in the Architecture tab, which loads `frontend/public/build-prompt.txt`. Keep that file identical to the block below; a backend test checks it.

```text
Build a read-only stock portfolio tracker and deploy it to a public URL. Brainstorm and plan with me first. Don't write code until I say "go", and work one step at a time.

STACK
- Frontend: React + Vite + TypeScript, charts with Recharts. Host on Cloudflare Pages.
- Backend: Python FastAPI managed with uv. Host on Render's free tier.
- Prices: yfinance (Yahoo Finance), unadjusted daily closes.
- Stateless: the browser keeps transactions in memory and sends them with every request. The server stores nothing, has no database and never logs request bodies.

DATA
- CSV columns: trade_date,ticker,side,quantity,price,fees (fees optional, dates YYYY-MM-DD).
- Any invalid row rejects the whole file and lists every problem with its row number. Selling more than you hold is an error (same-day buys count first).

METRICS (use exactly these)
- Total invested = sum of BUY quantity x price + fees. Total sold = sum of SELL quantity x price - fees.
- Holdings use weighted-average cost: sells don't change the average, closed positions disappear.
- Current value = shares held x latest price. Total return = current value + total sold - total invested, also as % of invested.
- XIRR on dated cash flows (buys negative, sells positive, today's value as the final inflow), 365-day year, bisection solver; show "n/a" with a reason when it can't be computed.
- Trend: daily portfolio value vs cumulative net invested since the first trade.

API
GET /health, POST /api/transactions/validate (csv or rows), POST /api/portfolio, POST /api/performance. JSON in and out, readable JSON errors.

SCREENS (dashboards first)
1. Current Portfolio (landing page, sample loaded): current value, allocation donut, holdings table with avg cost, price, gain/loss $ and %, weight.
2. Historical Performance: cards for invested, sold, value, total return, XIRR; value-vs-invested trend chart.
3. Input Transactions: "Use the sample portfolio" checkbox (on by default), CSV drag-and-drop, manual entry form, download the sample CSV.
4. Architecture: zoomable diagram plus a plain-English tour and the request flow.
- Top-right card: "Now showing: a sample portfolio" with "Upload your CSV". Footer with my LinkedIn and GitHub.

PUBLIC SAFETY
- Caps: about 2 MB, 5,000 rows and 25 tickers per request. Per-IP rate limit, request timeouts, CORS allow-list from an env var.
- Visible notice: "Use sample or made-up data. Nothing is saved." Only made-up sample data in the repo, no secrets.

RESILIENCE
- Cache prices per ticker, share concurrent fetches of the same ticker, briefly remember bad tickers.
- If Yahoo fails, fall back to a stored price snapshot labelled "Prices as of <date>, live feed unavailable". Never present snapshot or synthetic prices as live.
- Show a friendly "Waking the server" state while the free backend cold-starts (about a minute).

DESIGN
Clean, light, editorial and beautiful: warm white background, one ink-blue accent, serif headings and big numbers, clean sans body, self-hosted fonts, tabular numerals. Restrained motion that respects reduced-motion. Design every screen in its empty, loading, error and populated states. Responsive from 360 px phones to wide desktops, keyboard accessible, WCAG AA contrast.

QUALITY AND PROCESS
- Backend tests with pytest using fake prices (no network). The frontend must type-check and build.
- Ask before adding any dependency. Never commit, push or deploy unless I say so for that specific action.
```
