# Step 10: repo and deploy

## What was deployed (2026-10-05)

| Piece | Where | Notes |
| --- | --- | --- |
| Repo | https://github.com/algoshank-pat/portfolio-tracker-react | Public, branch `main` |
| Backend | https://portfolio-tracker-react.onrender.com | Render web service **`portfolio-tracker-react`** (not `portfolio-tracker-api` as planned below), Free instance, Python 3.12, uv |
| Frontend | https://portfolio-tracker-react.pages.dev | Cloudflare **Pages** project `portfolio-tracker-react` |

What differed from the plan:

- Cloudflare's "Create an app" screen now defaults to **Workers**. Pages is reached via the small link at the bottom: *"Need to use the legacy Pages workflow? Continue to Pages"*. The Workers form (with `npx wrangler deploy`) must not be used for this repo as-is.
- Because the Pages URL came out as planned, `CORS_ORIGINS=https://portfolio-tracker-react.pages.dev` set during the Render setup was already correct; step (e) needed no change.
- Render's outbound IPs (shown under Connect) are `74.220.48.0/24` and `74.220.56.0/24`. They're only relevant if Yahoo ever blocks them.
- Smoke test passed: `/health` ok, CORS allows exactly the Pages origin, live Yahoo prices from Render (`price_source: live`), sample value $16,229.19, XIRR 18.4%.
- Not yet verified on the hosted site: cold start after 15 idle minutes, and a CSV upload from a real browser.

Every push to `main` triggers a new build on both Render and Cloudflare.

---

## Original checklist


Nothing here is run until Shashank says "go" for that specific action. All sign-ins happen in Shashank's own browser; no tokens or passwords go into files or commands.
Settings were checked against the Render and Cloudflare docs on 2026-10-04. Re-check anything that looks different on screen.

## (a) Local git repo and first commit

From `C:\Maven\Projects\Week1\portfolio-tracker-react`:

```powershell
git init -b main
git status                      # review: no .venv, node_modules, dist or .env should be listed
git add .
git commit -m "Portfolio tracker: React + FastAPI, steps 1-9"
```

`.gitignore` files (root, `backend/`, `frontend/`) already exclude `.venv/`, `node_modules/`, `dist/`, `.env*` and caches.
The repo includes made-up sample data and `backend/data/price_snapshot.json` (public daily closes for AAPL, MSFT and VTI), and nothing personal.

## (b) Public GitHub repo and push

1. Shashank signs in at github.com as `algoshank-pat` and creates a **public**, **empty** repo named `portfolio-tracker-react` (no README, licence or .gitignore, so the first push is clean).
2. Then:

```powershell
git remote add origin https://github.com/algoshank-pat/portfolio-tracker-react.git
git push -u origin main
```

Git Credential Manager opens a browser window for the GitHub sign-in.

## (c) Backend on Render (do this before Cloudflare, so the API URL is known)

Render dashboard → **New** → **Web Service** → connect GitHub → pick `portfolio-tracker-react`.

| Setting | Value |
| --- | --- |
| Name | `portfolio-tracker-api` (gives `https://portfolio-tracker-api.onrender.com` if free) |
| Language | Python 3 |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `uv sync --frozen --no-dev` |
| Start Command | `uv run --frozen --no-dev uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | **Free** |
| Health Check Path | `/health` |

Environment variables:

| Key | Value |
| --- | --- |
| `CORS_ORIGINS` | placeholder for now, e.g. `https://portfolio-tracker-react.pages.dev`; finalised in step (e) |
| `PRICE_SOURCE` | `live` |

Python version: Render reads `backend/.python-version` (3.12). uv is used automatically because `backend/uv.lock` exists.
If Render asks for a card for the free tier, stop and check with Shashank.

Check: open `https://<render-name>.onrender.com/health` and you should see `{"status":"ok"}`.

## (d) Frontend on Cloudflare Pages

Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick `portfolio-tracker-react`.

| Setting | Value |
| --- | --- |
| Project name | `portfolio-tracker-react` (gives `https://portfolio-tracker-react.pages.dev` if free) |
| Production branch | `main` |
| Framework preset | None (or Vite; the values below are what matter) |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `VITE_API_URL` = `https://<render-name>.onrender.com` (no trailing slash) |
| Environment variable | `NODE_VERSION` = `24` (match the laptop) |

Note: Cloudflare is steering new sites toward Workers static assets, but Pages Git projects are still supported. If the dashboard only offers Workers, stop and ask.

## (e) Final CORS origin and redeploy

1. Copy the exact Pages URL, e.g. `https://portfolio-tracker-react.pages.dev`.
2. Render → service → **Environment** → set `CORS_ORIGINS` to exactly that origin (no trailing slash). Save, which redeploys.
3. Preview deployments (`<hash>.portfolio-tracker-react.pages.dev`) are deliberately **not** allowed to call the API.

## (f) Post-deploy smoke test

- [ ] `https://<render-name>.onrender.com/health` returns `{"status":"ok"}`.
- [ ] Open the Pages URL: the sample loads; Tabs 2 and 3 show numbers; no "Stored prices" banner means Yahoo works from Render.
  - If the amber "Stored prices, not live" banner shows, Yahoo is blocking Render. The app still works with the labelled snapshot; refresh it locally with `uv run python scripts/snapshot_prices.py`, then commit and push before submitting.
- [ ] Cold start: wait 15+ minutes and reload. The "Waking the server" bar appears and data loads within about a minute.
- [ ] Browser console on another site: `fetch("https://<render-name>.onrender.com/api/portfolio", {method: "POST"})` is blocked by CORS.
- [ ] Run the deployed items in `docs/QA_CHECKLIST.md`.
- [ ] Shortly before submitting, open the site to wake the backend. Optionally upgrade Render to the paid instance for the review week only.
