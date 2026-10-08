// Header card (top right): says which data the dashboards show and invites people to analyze their own.

import { useId, useRef } from "react";
import { SAMPLE_URL, usePortfolio } from "../state/portfolio";
import { Button, Icon } from "./ui";
import s from "./DataSource.module.css";

export function DataSource({ onGo }: { onGo: (tab: string) => void }) {
  const { transactions, useSample, input, uploadCsv, clearMyData, restored } = usePortfolio();
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const loading = input.kind === "loading";
  const tickers = [...new Set(transactions.map((t) => t.ticker))];

  const pick = async (files: FileList | null) => {
    const f = files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    const ok = await uploadCsv(f);
    onGo(ok ? "portfolio" : "input"); // on errors, show them next to the upload form
  };

  const tickerList =
    tickers.length <= 4 ? tickers.join(", ") : `${tickers.slice(0, 3).join(", ")} +${tickers.length - 3} more`;

  return (
    <aside className={s.card} aria-labelledby={`${id}-title`}>
      <div className={s.now}>
        <span className={s.eyebrow}>{useSample ? "Now showing" : "Now analyzing"}</span>
        <h2 id={`${id}-title`} className={s.title}>
          {useSample ? "A sample portfolio" : "Your transactions"}
        </h2>
        <p className={s.meta}>
          {loading ? (
            <>
              <span className={s.spinner} aria-hidden="true" /> {input.label}
            </>
          ) : transactions.length ? (
            <>
              {transactions.length} {transactions.length === 1 ? "trade" : "trades"} · {tickerList}
              {useSample ? " · made up" : restored ? " · restored from this browser" : " · saved in this browser"}
            </>
          ) : (
            "No transactions loaded"
          )}
        </p>
      </div>

      <div className={s.cta}>
        <p className={s.ask}>{useSample ? "Want to see your own?" : "Try different data"}</p>
        <div className={s.actions}>
          <label htmlFor={id} className={s.upload} aria-disabled={loading}>
            <Icon name="upload" className={s.icon} />
            {useSample ? "Upload your CSV" : "Upload another CSV"}
          </label>
          <input
            ref={fileRef}
            id={id}
            type="file"
            accept=".csv,text/csv"
            className="visually-hidden"
            disabled={loading}
            onChange={(e) => void pick(e.target.files)}
          />
          {useSample ? (
            <Button variant="ghost" size="small" onClick={() => onGo("input")}>
              or enter trades by hand
            </Button>
          ) : (
            <Button variant="ghost" size="small" onClick={clearMyData} disabled={loading}>
              Clear my data
            </Button>
          )}
        </div>
        <p className={s.fine}>
          Columns: trade_date, ticker, side, quantity, price, fees.{" "}
          <a href={SAMPLE_URL} download="sample_transactions.csv">
            Download the template
          </a>
        </p>
      </div>

      <p className={s.notice}>
        <Icon name="info" className={s.noticeIcon} />
        Your transactions are saved in this browser only, never on our server.
      </p>
    </aside>
  );
}
