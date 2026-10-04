// Tab 3: lifetime totals, total return, XIRR and value over time from POST /api/performance.

import { TrendChart } from "../components/charts/TrendChart";
import { AsOf, PriceBanner } from "../components/PriceBanner";
import { Button, Card, EmptyState, ErrorState, Metric, Skeleton, cx, ui } from "../components/ui";
import type { PerformanceResponse } from "../api/types";
import { date, money, signedMoney, signedPercent, tone } from "../lib/format";
import { usePortfolio } from "../state/portfolio";
import s from "./ResultTabs.module.css";

const XIRR_TIP =
  "XIRR is the annualized return that accounts for when each buy and sell happened (365-day year). " +
  "Today's value counts as a final sale.";

function xirrUnavailableReason(d: PerformanceResponse): string {
  if (d.summary.current_value === 0 && d.summary.total_sold === 0)
    return "XIRR can't be computed: there are no prices for your holdings and nothing has been sold, so there is no money coming back to measure against.";
  if (d.trend.length > 0 && d.trend[0].date === d.trend[d.trend.length - 1].date)
    return "XIRR can't be computed yet: all cash flows fall on the same day, so there is no time period to annualize.";
  return "XIRR can't be computed for these cash flows: no single annual rate makes them balance (this happens with very short histories or extreme results).";
}

export function PerformanceTab({ onGo }: { onGo: (tab: string) => void }) {
  const { transactions, performance, input, retryResults } = usePortfolio();

  if (!transactions.length) {
    if (input.kind === "loading") return <PerformanceSkeleton />;
    return (
      <EmptyState
        icon="trend"
        title="No history to show yet"
        actions={<Button onClick={() => onGo("input")}>Add transactions</Button>}
      >
        Once you load transactions, this tab shows what you put in, what you took out, and how the portfolio has grown.
      </EmptyState>
    );
  }
  if (performance.status === "error") return <ErrorState errors={performance.errors} onRetry={retryResults} />;
  if (performance.status !== "success") return <PerformanceSkeleton />;
  return <PerformanceView data={performance.data} />;
}

function PerformanceView({ data }: { data: PerformanceResponse }) {
  const { summary, trend } = data;
  const xirr = summary.xirr;
  const since = trend.length ? trend[0].date : null;

  return (
    <div className={ui.stack}>
      <PriceBanner source={data.price_source} note={data.price_note} missing={data.missing_prices} />

      <div className={s.metrics}>
        <Card className={s.metricCard}>
          <Metric label="Total invested" value={money(summary.total_invested)} sub="All buys, including fees" />
        </Card>
        <Card className={s.metricCard}>
          <Metric label="Total sold" value={money(summary.total_sold)} sub="Sale proceeds, after fees" />
        </Card>
        <Card className={s.metricCard}>
          <Metric
            label="Current value"
            value={money(summary.current_value)}
            sub={<AsOf asOf={data.as_of} source={data.price_source} />}
          />
        </Card>
        <Card className={cx(s.metricCard, s.metricFeature)}>
          <Metric
            label="Total return"
            value={signedMoney(summary.total_return)}
            valueClass={tone(summary.total_return)}
            sub={
              <span className={tone(summary.total_return_pct)}>
                {summary.total_return_pct == null ? "–" : `${signedPercent(summary.total_return_pct)} of invested`}
              </span>
            }
            tip="Current value plus total sold, minus total invested."
          />
        </Card>
        <Card className={cx(s.metricCard, s.metricFeature)}>
          {xirr == null ? (
            <Metric
              label="XIRR (annualized)"
              value={<span className={s.na}>n/a</span>}
              sub="Not available for these cash flows"
              tip={xirrUnavailableReason(data)}
            />
          ) : (
            <Metric
              label="XIRR (annualized)"
              value={signedPercent(xirr)}
              valueClass={tone(xirr)}
              sub="Per year, timing-weighted"
              tip={XIRR_TIP}
            />
          )}
        </Card>
      </div>

      <Card
        title="Portfolio value over time"
        meta={since ? <span>Daily closes since {date(since)}</span> : undefined}
      >
        {trend.length ? (
          <TrendChart points={trend} />
        ) : (
          <p className={s.muted}>No price history is available for these tickers, so the trend can’t be drawn.</p>
        )}
      </Card>
    </div>
  );
}

function PerformanceSkeleton() {
  return (
    <div className={ui.stack} role="status" aria-label="Loading performance">
      <div className={s.metrics}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={cx(ui.card, s.metricCard)}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="80%" height={34} style={{ marginTop: 12 }} />
            <Skeleton width="50%" height={12} style={{ marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className={ui.card}>
        <Skeleton width={220} height={20} />
        <Skeleton height={300} style={{ marginTop: 24 }} />
      </div>
    </div>
  );
}
