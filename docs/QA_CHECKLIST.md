# Manual QA checklist

Run against local dev first (`uv run uvicorn app.main:app` + `npm run dev`), then again against the deployed URLs.
Tick each line. Anything marked **(deployed)** only makes sense on the hosted site.

## Automated

- [ ] `cd backend; uv run pytest` passes (57 tests, no network).
- [ ] `cd frontend; npm run build` passes with no TypeScript errors.

## Header and Input Transactions (tab 3)

- [ ] First visit opens on Current Portfolio with the sample; header card says "Now showing: A sample portfolio" and the headline is on one line (desktop and 360 px).
- [ ] Header "Upload your CSV" with a good file: dashboard updates and the card says "Your transactions"; with a bad file: jumps to Input Transactions with the errors. "Back to the sample" restores it.
- [ ] Input tab: "Use the sample portfolio" is ticked, 7 trades / 3 tickers appear, upload box and form are greyed out.
- [ ] "Download the sample CSV" downloads `sample_transactions.csv`.
- [ ] Untick the sample: list clears, upload and form become active, empty state shows.
- [ ] Upload the sample CSV: 7 trades appear.
- [ ] Upload a CSV with a bad row (e.g. side `HOLD` on row 3): red banner lists "Row 3: …", nothing imported.
- [ ] Upload a non-CSV or a file over 2 MB: friendly error, nothing imported.
- [ ] Add a BUY by hand: it appears in the table in date order.
- [ ] Add a SELL larger than held: "That transaction wasn't added: … only N held."
- [ ] "Clear all" empties the list (only shown when the sample is unticked).
- [ ] Refresh the page: everything resets to the sample (nothing is saved).

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

- [ ] Diagram shows Cloudflare Pages + Render hosting, sample checkbox, price cache and snapshot boxes.
- [ ] Click to zoom: +/−, Fit, drag to pan, wheel/pinch zoom, double-click toggle, Esc closes and focus returns.
- [ ] SVG and draw.io download links work.

## Price fallback and cold start

- [ ] Start the backend with `$env:PRICE_SOURCE="snapshot"`: Tabs 2 and 3 show the amber "Stored prices, not live" banner with the date.
- [ ] Stop the backend and reload: the "Waking the server…" bar appears with a counter, and skeletons show. Start the backend: data appears without a reload.
- [ ] **(deployed)** After 15+ idle minutes, open the site: waking bar shows, data appears within about a minute.

## Safety limits

- [ ] `curl -X POST <api>/api/transactions/validate -H "Content-Type: application/json" --data-binary "@big.json"` with a >2 MB body returns 413 JSON.
- [ ] 61 rapid requests from one IP within a minute: the 61st returns 429 with `Retry-After`.
- [ ] Backend log shows only request lines (method, path, status): no request bodies, tickers or amounts.
- [ ] **(deployed)** Calling the API from another origin (e.g. browser console on example.com) is blocked by CORS.

## Accessibility and layout

- [ ] Keyboard only: Tab reaches "Skip to content", tabs (arrow keys switch, Home/End), all inputs and buttons; focus ring always visible.
- [ ] Screen reader (Narrator/NVDA): tabs announce their names; error banners are announced; charts have text descriptions.
- [ ] 360 px wide (phone): no sideways page scroll; tables scroll inside their card with the ticker column pinned.
- [ ] 768 px (tablet) and 1440 px (desktop) look balanced.
- [ ] OS "reduce motion" on: no chart or tab animations.
- [ ] Browser tab shows the favicon and the title "Portfolio Tracker".
