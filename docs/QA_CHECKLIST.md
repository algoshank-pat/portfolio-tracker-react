# Manual QA checklist

Run against local dev first (`uv run uvicorn app.main:app` + `npm run dev`), then again against the deployed URLs.
Tick each line. Anything marked **(deployed)** only makes sense on the hosted site.

## Automated

- [ ] `cd backend; uv run pytest` passes (129 tests, no network, no API key: prices and the LLM are faked).
- [ ] Vulnerability checks: `npm audit` in `frontend/` and the OSV check on `uv export` (README) report 0 known issues.
- [ ] `cd frontend; npm run build` passes with no TypeScript errors.

## Header and Input Transactions (tab 3)

- [ ] First visit opens on Current Portfolio with the sample; header card says "Now showing: A sample portfolio" and the headline is on one line (desktop and 360 px).
- [ ] Header card notice reads "Your transactions are saved in this browser only, never on our server."
- [ ] Header "Upload your CSV" with a good file: dashboard updates and the card says "Your transactions … saved in this browser"; with a bad file: jumps to Input Transactions with the errors.
- [ ] Input tab: "Use the sample portfolio" is ticked, 7 trades / 3 tickers appear, upload box and form are greyed out.
- [ ] "Download the sample CSV" downloads `sample_transactions.csv`.
- [ ] Untick the sample: list clears, upload and form become active, empty state shows.
- [ ] Upload the sample CSV: 7 trades appear.
- [ ] Upload a CSV with a bad row (e.g. side `HOLD` on row 3): red banner lists "Row 3: …", nothing imported.
- [ ] Upload a non-CSV or a file over 2 MB: friendly error, nothing imported.
- [ ] Add a BUY by hand: it appears in the table in date order.
- [ ] Add a SELL larger than held: "That transaction wasn't added: … only N held."
- [ ] "Clear all" empties the list (only shown when the sample is unticked).
## Browser storage (your data stays in this browser)

- [ ] Upload a CSV (e.g. `samples/long_term_investor.csv`) or add a trade by hand, then refresh: the same transactions come back and the card says "restored from this browser".
- [ ] Close the tab and open the site again: still restored.
- [ ] "Clear my data" (header card): the sample is shown and nothing is saved (refresh shows the sample).
- [ ] Ticking "Use the sample portfolio" on the Input tab also clears your saved transactions.
- [ ] A private/incognito window starts with the sample and nothing carries over.
- [ ] Saved data that no longer validates (e.g. edited in DevTools to an oversell) shows the sample with "Your saved transactions couldn’t be loaded…", and the bad data is removed.

## Current Portfolio (tab 1, landing page)

- [ ] Current value, holdings count, cost basis and unrealized gain/loss show; colours: gains green, losses red.
- [ ] Donut animates in; hovering a slice or legend row highlights it and shows its weight in the centre.
- [ ] Holdings table: ticker, quantity, avg cost, current price, market value, gain/loss $ and %, weight; total row adds up.
- [ ] Sample numbers check: total invested $12,528; avg cost AAPL ≈ $188.47, MSFT $400.20, VTI ≈ $256.67.
- [ ] A ticker that does not exist (e.g. `ZZZZQ`) shows "No price for ZZZZQ" and a dash in its row.
- [ ] With no transactions: empty state with "Add transactions" button.

## Historical Performance (tab 2)

- [ ] Cards: Total invested $12,528.00, Total sold $1,888.00, Current value, Total return ($ and % of invested), XIRR.
- [ ] Info buttons on Total return and XIRR open on hover, focus and tap; Esc closes.
- [ ] XIRR shows "n/a" with an explanation when it can't be computed (e.g. a single BUY today).
- [ ] Trend chart: value area plus dashed net-invested step line from the first trading day; tooltip shows date, value, invested, total return.

## Tab 4: Architecture

- [ ] Diagram shows Cloudflare Pages + Render hosting, sample checkbox, price cache and snapshot boxes, the assistant boxes and the Anthropic zone; the Browser state box says "Saved in this browser only".
- [ ] "The five parts" includes Assistant; the flow has step 6 "Ask (optional)"; "The prompt behind it" mentions the assistant.
- [ ] Click to zoom: +/−, Fit, drag to pan, wheel/pinch zoom, double-click toggle, Esc closes and focus returns.
- [ ] SVG and draw.io download links work.

## Ask your portfolio (assistant)

- [ ] The round "Ask" button shows bottom-right once a portfolio is loaded; it opens the panel with focus in the question box.
- [ ] Desktop: chat on the left, Activity on the right. Phone (360–375 px): full-screen sheet with a Chat / Activity switch; no sideways scroll.
- [ ] Activity is hidden by default; the "Show activity" link in the panel header reveals it (wider panel) and "Hide activity" hides it again.
- [ ] "What is my XIRR?": with activity shown, Activity lists Q, Question received, Context check: in scope, Tool call: get_xirr(), Result: …, Answer sent. Tools used: get_xirr. The chat answer has no "Tools used" line, and its number matches the Historical Performance tab.
- [ ] "What's my unrealized gain?" leads with the total (matches the dashboard's Unrealized gain/loss card), then a short list; **bold** and bullets render, no raw asterisks.
- [ ] "Do I have Microsoft?" (when MSFT isn't held, e.g. after uploading samples/long_term_investor.csv) → a plain "not in this portfolio" answer, not a decline.
- [ ] "Which holding is largest?" uses get_holdings; values match the Current Portfolio tab.
- [ ] "What if I sell 2 AAPL?" (sample) uses what_if; before/after values are shown; "sell 99 MSFT" is rejected ("only 3 held").
- [ ] "Should I buy more NVDA?" → advice decline, Activity stops at "Declined: not about this portfolio", no tool calls.
- [ ] "What is the capital of France?" and "How is TSLA doing?" (not held) → decline, no tool calls.
- [ ] "how am I doing" → one clarifying question, no tool calls.
- [ ] The answer never recommends buying or selling and never shows a number that isn't in a tool result.
- [ ] A 501st character can't be typed (counter shows 0 left); the server also rejects > 500 characters with a readable error.
- [ ] Esc or ✕ closes the panel and focus returns to "Ask"; Tab stays inside the panel while it is open.
- [ ] Chat history survives closing and reopening the panel, is gone after a refresh, and resets when a different portfolio is loaded.
- [ ] No API key on the backend → "The assistant is unavailable right now."; the rest of the app works.
- [ ] Backend started with `$env:PRICE_SOURCE="snapshot"` → every assistant answer ends with "Note: Prices as of …, live feed unavailable. These are stored prices, not live ones."
- [ ] **(deployed)** View source / DevTools → Network: the API key never appears in any response, and the browser never calls Anthropic directly (only the Render API).

## Price fallback and cold start

- [ ] Start the backend with `$env:PRICE_SOURCE="snapshot"`: Tabs 2 and 3 show the amber "Stored prices, not live" banner with the date.
- [ ] Stop the backend and reload: the "Waking the server…" bar appears with a counter, and skeletons show. Start the backend: data appears without a reload.
- [ ] **(deployed)** After 15+ idle minutes, open the site: waking bar shows, data appears within about a minute.
- [ ] Assistant cold start: with the backend stopped (local) or asleep (deployed), ask a question: the waking bar shows and the panel says "Waking the server…" before the first answer, which then arrives without a reload.

## Safety limits

- [ ] `curl -X POST <api>/api/transactions/validate -H "Content-Type: application/json" --data-binary "@big.json"` with a >2 MB body returns 413 JSON.
- [ ] 61 rapid requests from one IP within a minute: the 61st returns 429 with `Retry-After`.
- [ ] Backend log shows only request lines (method, path, status): no request bodies, questions, tickers or amounts (check after a few assistant questions too).
- [ ] **(deployed)** Calling the API from another origin (e.g. browser console on example.com) is blocked by CORS.

## Accessibility and layout

- [ ] Keyboard only: Tab reaches "Skip to content", tabs (arrow keys switch, Home/End), all inputs and buttons; focus ring always visible.
- [ ] Screen reader (Narrator/NVDA): tabs announce their names; error banners are announced; charts have text descriptions.
- [ ] 360 px wide (phone): no sideways page scroll; tables scroll inside their card with the ticker column pinned.
- [ ] 768 px (tablet) and 1440 px (desktop) look balanced.
- [ ] OS "reduce motion" on: no chart or tab animations.
- [ ] Browser tab shows the favicon and the title "Portfolio Tracker".
