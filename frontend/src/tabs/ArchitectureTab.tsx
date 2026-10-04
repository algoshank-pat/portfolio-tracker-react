// Tab 4: the architecture diagram plus a plain-English tour of the parts and the request flow.

import { Card, Icon, ui } from "../components/ui";
import { ZoomableImage } from "../components/ZoomableImage";
import s from "./ArchitectureTab.module.css";

const PARTS = [
  {
    name: "Browser",
    tone: "browser",
    body: "A React app (Vite + TypeScript). It holds your transactions in memory only, so a refresh clears them. It draws the charts with Recharts and shows a friendly notice while the free server wakes up.",
  },
  {
    name: "Backend",
    tone: "backend",
    body: "A small, stateless FastAPI service. Every request carries its own transactions; the server checks them, does the accounting (weighted-average cost, total return, XIRR, value over time) and forgets them. It caps request size, rate-limits each visitor and never logs what you send.",
  },
  {
    name: "External: Yahoo Finance",
    tone: "external",
    body: "Daily closing prices come from Yahoo Finance through the unofficial yfinance library. Prices are cached per ticker for 15 minutes. If Yahoo is slow or blocked, the app falls back to a stored snapshot and says so clearly.",
  },
  {
    name: "Hosting",
    tone: "hosting",
    body: "The built React files are served by Cloudflare Pages. The API runs on Render’s free tier, which sleeps after 15 idle minutes and takes about a minute to wake. Only the frontend’s address is allowed to call the API (CORS).",
  },
] as const;

const FLOW = [
  ["Choose data", "Tick the sample, upload a CSV or add a row in the Input tab."],
  ["Validate", "The browser sends it to /api/transactions/validate. Clean rows come back and stay in browser memory."],
  ["Ask for results", "The Portfolio and Performance tabs send those rows to /api/portfolio and /api/performance."],
  ["Compute", "The backend re-checks the rows, gets prices (cache, then Yahoo, then the snapshot) and computes holdings, XIRR and the trend."],
  ["Render", "JSON comes back and React draws the donut, tables, metric cards and chart."],
] as const;

export function ArchitectureTab() {
  return (
    <div className={ui.stack}>
      <Card title="How it’s built" meta={<span>React + FastAPI · stateless</span>}>
        <figure className={s.figure}>
          <ZoomableImage
            src="/architecture.svg"
            alt="Architecture diagram: browser, backend, Yahoo Finance and hosting"
            width={1300}
            height={920}
          />
          <figcaption className={s.caption}>
            The browser sends its transactions with each request; the server computes the results and stores nothing.{" "}
            <span className={s.downloads}>
              <a href="/architecture.svg" download="portfolio-tracker-architecture.svg">
                <Icon name="download" className={s.dlIcon} />
                SVG
              </a>
              <a href="/architecture.drawio" download="portfolio-tracker-architecture.drawio">
                <Icon name="download" className={s.dlIcon} />
                draw.io source
              </a>
            </span>
          </figcaption>
        </figure>
      </Card>

      <div className={s.columns}>
        <section aria-labelledby="parts-h" className={s.parts}>
          <h2 id="parts-h" className={s.sectionTitle}>
            The four parts
          </h2>
          {PARTS.map((p) => (
            <article key={p.name} className={s.part} data-tone={p.tone}>
              <h3 className={s.partName}>{p.name}</h3>
              <p className={s.partBody}>{p.body}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="flow-h" className={s.flowCard}>
          <h2 id="flow-h" className={s.sectionTitle}>
            What happens on a request
          </h2>
          <ol className={s.flow}>
            {FLOW.map(([title, text], i) => (
              <li key={title} className={s.step}>
                <span className={s.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3 className={s.stepTitle}>{title}</h3>
                  <p className={s.stepText}>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className={s.note}>
            Why stateless? Nothing to secure, back up or leak: close the tab and your data is gone. The trade-off is that
            every request resends the transactions, which is fine at this size (up to 5,000 rows).
          </p>
        </section>
      </div>
    </div>
  );
}
