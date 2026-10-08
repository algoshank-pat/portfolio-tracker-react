// Tab 4: the architecture diagram plus a plain-English tour of the parts and the request flow.

import { REPO } from "../components/AppShell";
import { PromptCard } from "../components/PromptCard";
import { Card, Icon, ui } from "../components/ui";
import { ZoomableImage } from "../components/ZoomableImage";
import s from "./ArchitectureTab.module.css";

const PARTS = [
  {
    name: "Browser",
    tone: "browser",
    body: "A React app (Vite + TypeScript). Your transactions are saved in this browser only (localStorage) so a refresh or a return visit brings them back; “Clear my data” removes them. It draws the charts with Recharts and shows a friendly notice while the free server wakes up.",
  },
  {
    name: "Assistant",
    tone: "assistant",
    body: "“Ask your portfolio” uses Claude Haiku 5.5 through LangChain. A scope check declines anything not about this portfolio. The model never does arithmetic: five tools wrap the same tested code as the dashboards, and every step streams into the Activity panel. The API key lives only on the server, and chat history only in your open tab.",
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
  ["Validate", "The browser sends it to /api/transactions/validate. Clean rows come back and are saved in this browser."],
  ["Ask for results", "The Portfolio and Performance tabs send those rows to /api/portfolio and /api/performance."],
  ["Compute", "The backend re-checks the rows, gets prices (cache, then Yahoo, then the snapshot) and computes holdings, XIRR and the trend."],
  ["Render", "JSON comes back and React draws the donut, tables, metric cards and chart."],
  ["Ask (optional)", "A question goes to /api/chat with the rows. A scope check runs first; then tools compute every number, and each step streams back to the Activity panel."],
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
            height={1060}
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
              <a href={REPO} target="_blank" rel="noopener noreferrer">
                <Icon name="github" className={s.dlIcon} />
                Code on GitHub
              </a>
            </span>
          </figcaption>
        </figure>
      </Card>

      <div className={s.columns}>
        <section aria-labelledby="parts-h" className={s.parts}>
          <h2 id="parts-h" className={s.sectionTitle}>
            The five parts
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
            Why a stateless server? Nothing to secure, back up or leak on our side: your transactions live only in your
            own browser, and “Clear my data” removes them. The trade-off is that every request resends the transactions,
            which is fine at this size (up to 5,000 rows).
          </p>
        </section>
      </div>

      <PromptCard />
    </div>
  );
}
