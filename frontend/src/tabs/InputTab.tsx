// Tab 1: choose data (sample, CSV upload or manual entry) and review the validated transactions.

import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import type { Side } from "../api/types";
import { Banner, Button, Card, EmptyState, ErrorList, Icon, Skeleton, cx, ui } from "../components/ui";
import { date, money, quantity } from "../lib/format";
import { SAMPLE_URL, usePortfolio } from "../state/portfolio";
import s from "./InputTab.module.css";

export function InputTab({ onGo }: { onGo: (tab: string) => void }) {
  const { transactions, useSample, input, setUseSample, clearAll, dismissInputError } = usePortfolio();
  const loading = input.kind === "loading";
  const tickers = new Set(transactions.map((t) => t.ticker)).size;

  return (
    <div className={ui.stack}>
      <Card title="Choose your data">
        <SampleToggle checked={useSample} onChange={setUseSample} disabled={loading} />

        <div className={s.inputs} aria-disabled={useSample}>
          <FileDrop disabled={useSample || loading} />
          <ManualEntry disabled={useSample || loading} />
        </div>
        {useSample && (
          <p className={s.hint}>Uncheck the sample to upload your own CSV or add transactions by hand.</p>
        )}

        <div className={s.statusArea} aria-live="polite">
          {input.kind === "loading" && (
            <p className={s.loading}>
              <span className={s.spinner} aria-hidden="true" /> {input.label}
            </p>
          )}
          {input.kind === "error" && (
            <Banner
              tone="error"
              title={input.title ?? "Nothing was imported. Please fix these and try again:"}
              action={
                <Button variant="ghost" size="small" onClick={dismissInputError}>
                  Dismiss
                </Button>
              }
            >
              <ErrorList errors={input.errors} />
            </Banner>
          )}
        </div>
      </Card>

      <Card
        title="Transactions"
        meta={
          transactions.length > 0 && (
            <div className={s.tableMeta}>
              <span className="num">
                {transactions.length} {transactions.length === 1 ? "trade" : "trades"} · {tickers}{" "}
                {tickers === 1 ? "ticker" : "tickers"}
              </span>
              {!useSample && (
                <Button variant="secondary" size="small" onClick={clearAll} disabled={loading}>
                  Clear all
                </Button>
              )}
            </div>
          )
        }
      >
        {transactions.length > 0 ? (
          <>
            <TransactionsTable />
            <div className={s.next}>
              <Button onClick={() => onGo("portfolio")}>
                See current portfolio <span aria-hidden="true">→</span>
              </Button>
            </div>
          </>
        ) : loading ? (
          <TableSkeleton />
        ) : (
          <EmptyState icon="upload" title="No transactions yet">
            Tick “Use the sample portfolio”, upload a CSV, or add a trade with the form above. Your transactions are saved in this browser only, never on our server.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}

// ---- Sample checkbox ------------------------------------------------------------
function SampleToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <div className={cx(s.sample, checked && s.sampleOn)}>
      <input
        id={id}
        type="checkbox"
        className={s.checkbox}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-desc`}
      />
      <div className={s.sampleText}>
        <label htmlFor={id} className={s.sampleLabel}>
          Use the sample portfolio
        </label>
        <p id={`${id}-desc`} className={s.sampleDesc}>
          Seven made-up trades in AAPL, MSFT and VTI from 2024 to 2025.{" "}
          {!checked && "Ticking this clears your transactions saved in this browser. "}
          <a href={SAMPLE_URL} download="sample_transactions.csv" className={s.download}>
            <Icon name="download" className={s.inlineIcon} />
            Download the sample CSV
          </a>
        </p>
      </div>
    </div>
  );
}

// ---- CSV upload -----------------------------------------------------------------
function FileDrop({ disabled }: { disabled: boolean }) {
  const { uploadCsv } = usePortfolio();
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void uploadCsv(f);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) take(e.dataTransfer.files);
  };

  return (
    <div className={s.block}>
      <h3 className={s.blockTitle}>Upload a CSV</h3>
      <div
        className={cx(s.drop, over && !disabled && s.dropOver, disabled && s.disabled)}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Icon name="upload" className={s.dropIcon} />
        <p className={s.dropText}>
          <label htmlFor={id} className={s.dropLink}>
            Choose a file
          </label>{" "}
          or drag it here
        </p>
        <p className={s.dropHint}>
          Columns: <code>trade_date, ticker, side, quantity, price, fees</code>
          <br />
          Dates as YYYY-MM-DD, fees optional, up to 2 MB. Replaces the current list.
        </p>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".csv,text/csv"
          className="visually-hidden"
          disabled={disabled}
          onChange={(e) => take(e.target.files)}
        />
      </div>
    </div>
  );
}

// ---- Manual entry ---------------------------------------------------------------
const today = () => {
  const d = new Date(); // local calendar day, not UTC
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function ManualEntry({ disabled }: { disabled: boolean }) {
  const { addTransaction } = usePortfolio();
  const [tradeDate, setTradeDate] = useState(today);
  const [ticker, setTicker] = useState("");
  const [side, setSide] = useState<Side>("BUY");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [busy, setBusy] = useState(false);
  const base = useId();

  const ready = tradeDate && ticker.trim() && Number(qty) > 0 && price !== "" && Number(price) >= 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || disabled) return;
    setBusy(true);
    const ok = await addTransaction({
      trade_date: tradeDate,
      ticker: ticker.trim().toUpperCase(),
      side,
      quantity: Number(qty),
      price: Number(price),
      fees: fees === "" ? 0 : Number(fees),
    });
    setBusy(false);
    if (ok) {
      setQty("");
      setPrice("");
      setFees("");
    }
  };

  return (
    <form className={cx(s.block, disabled && s.disabled)} onSubmit={submit} aria-label="Add a transaction">
      <h3 className={s.blockTitle}>Add a transaction</h3>
      <fieldset className={s.fields} disabled={disabled || busy}>
        <div className={cx(s.field, s.fieldDate)}>
          <label htmlFor={`${base}-date`}>Date</label>
          <input id={`${base}-date`} type="date" value={tradeDate} max={today()} required onChange={(e) => setTradeDate(e.target.value)} />
        </div>
        <div className={s.field}>
          <label htmlFor={`${base}-ticker`}>Ticker</label>
          <input
            id={`${base}-ticker`}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="AAPL"
            maxLength={10}
            value={ticker}
            required
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
        </div>
        <div className={cx(s.field, s.fieldWide)} role="radiogroup" aria-label="Side">
          <span className={s.fieldLabel} aria-hidden="true">
            Side
          </span>
          <div className={s.segmented}>
            {(["BUY", "SELL"] as const).map((v) => (
              <label key={v} className={cx(s.segment, side === v && s.segmentOn)}>
                <input type="radio" name={`${base}-side`} value={v} checked={side === v} onChange={() => setSide(v)} />
                {v === "BUY" ? "Buy" : "Sell"}
              </label>
            ))}
          </div>
        </div>
        <div className={s.field}>
          <label htmlFor={`${base}-qty`}>Quantity</label>
          <input id={`${base}-qty`} type="number" inputMode="decimal" min="0" step="any" placeholder="10" value={qty} required onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className={s.field}>
          <label htmlFor={`${base}-price`}>Price ($)</label>
          <input id={`${base}-price`} type="number" inputMode="decimal" min="0" step="any" placeholder="185.00" value={price} required onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className={s.field}>
          <label htmlFor={`${base}-fees`}>
            Fees ($) <span className={s.optional}>optional</span>
          </label>
          <input id={`${base}-fees`} type="number" inputMode="decimal" min="0" step="any" placeholder="0.00" value={fees} onChange={(e) => setFees(e.target.value)} />
        </div>
        <div className={cx(s.field, s.submit)}>
          <Button type="submit" disabled={!ready || disabled || busy}>
            <Icon name="plus" style={{ width: 16, height: 16 }} />
            Add transaction
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

// ---- Table ----------------------------------------------------------------------
function TransactionsTable() {
  const { transactions } = usePortfolio();
  return (
    <div className={ui.tableWrap} tabIndex={0} role="region" aria-label="Transactions table">
      <table className={ui.table}>
        <caption className="visually-hidden">Validated transactions, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Ticker</th>
            <th scope="col">Side</th>
            <th scope="col" className={ui.right}>
              Quantity
            </th>
            <th scope="col" className={ui.right}>
              Price
            </th>
            <th scope="col" className={ui.right}>
              Fees
            </th>
            <th scope="col" className={ui.right}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, i) => {
            const amount = t.side === "BUY" ? t.quantity * t.price + t.fees : t.quantity * t.price - t.fees;
            return (
              <tr key={`${t.trade_date}-${t.ticker}-${i}`}>
                <td>{date(t.trade_date)}</td>
                <td className={ui.ticker}>{t.ticker}</td>
                <td>
                  <span className={cx(ui.pill, t.side === "BUY" ? ui.pillBuy : ui.pillSell)}>{t.side}</span>
                </td>
                <td className={ui.right}>{quantity(t.quantity)}</td>
                <td className={ui.right}>{money(t.price)}</td>
                <td className={ui.right}>{money(t.fees)}</td>
                <td className={ui.right}>{money(amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className={s.skeletonRows} aria-label="Loading transactions" role="status">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} height={18} width={`${92 - (i % 3) * 8}%`} />
      ))}
    </div>
  );
}
