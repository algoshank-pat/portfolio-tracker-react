// Tab 2: current value, allocation donut and holdings table from POST /api/portfolio.

import { AllocationDonut, useSlices } from "../components/charts/AllocationDonut";
import { AsOf, PriceBanner } from "../components/PriceBanner";
import { Button, Card, EmptyState, ErrorState, Metric, Skeleton, cx, ui } from "../components/ui";
import type { Holding, PortfolioResponse } from "../api/types";
import { money, percent, quantity, signedMoney, signedPercent, tone } from "../lib/format";
import { usePortfolio } from "../state/portfolio";
import s from "./ResultTabs.module.css";

export function PortfolioTab({ onGo }: { onGo: (tab: string) => void }) {
  const { transactions, portfolio, input, retryResults } = usePortfolio();

  if (!transactions.length) {
    if (input.kind === "loading") return <PortfolioSkeleton />;
    return (
      <EmptyState
        icon="pie"
        title="No portfolio to show yet"
        actions={<Button onClick={() => onGo("input")}>Add transactions</Button>}
      >
        Load the sample portfolio or your own transactions in the Input tab, and your holdings will appear here.
      </EmptyState>
    );
  }
  if (portfolio.status === "error") return <ErrorState errors={portfolio.errors} onRetry={retryResults} />;
  if (portfolio.status !== "success") return <PortfolioSkeleton />;
  return <PortfolioView data={portfolio.data} onGo={onGo} />;
}

function PortfolioView({ data, onGo }: { data: PortfolioResponse; onGo: (tab: string) => void }) {
  const { holdings, current_value } = data;
  const cost = holdings.reduce((sum, h) => sum + (h.current_price != null ? h.avg_cost * h.quantity : 0), 0);
  const unrealized = holdings.reduce((sum, h) => sum + (h.unrealized_pl ?? 0), 0);
  const slices = useSlices(holdings);

  if (!holdings.length) {
    return (
      <EmptyState icon="pie" title="Every position is closed" actions={<Button onClick={() => onGo("performance")}>See performance</Button>}>
        All shares bought have been sold, so there is nothing currently held. Your realised results are on the
        Historical Performance tab.
      </EmptyState>
    );
  }

  return (
    <div className={ui.stack}>
      <PriceBanner source={data.price_source} note={data.price_note} missing={data.missing_prices} />

      <div className={s.heroGrid}>
        <Card className={s.hero}>
          <Metric
            large
            label="Current value"
            value={money(current_value)}
            sub={<AsOf asOf={data.as_of} source={data.price_source} />}
          />
          <dl className={s.heroStats}>
            <div>
              <dt>Holdings</dt>
              <dd className="num">{holdings.length}</dd>
            </div>
            <div>
              <dt>Cost basis</dt>
              <dd className="num">{money(cost, { whole: true })}</dd>
            </div>
            <div>
              <dt>Unrealized gain/loss</dt>
              <dd className={cx("num", tone(unrealized))}>
                {signedMoney(unrealized)}
                {cost > 0 && <span className={s.subPct}> {signedPercent(unrealized / cost)}</span>}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Allocation" meta="By market value">
          {slices.length ? (
            <AllocationDonut holdings={holdings} total={current_value} />
          ) : (
            <p className={s.muted}>No prices available to chart.</p>
          )}
        </Card>
      </div>

      <Card title="Holdings" meta={<span>Weighted-average cost · sorted by value</span>}>
        <HoldingsTable holdings={holdings} total={current_value} colorOf={(t) => slices.find((x) => x.name === t)?.color} />
      </Card>
    </div>
  );
}

function HoldingsTable({
  holdings,
  total,
  colorOf,
}: {
  holdings: Holding[];
  total: number;
  colorOf: (ticker: string) => string | undefined;
}) {
  const rows = [...holdings].sort((a, b) => (b.market_value ?? -1) - (a.market_value ?? -1));
  const pl = holdings.reduce((sum, h) => sum + (h.unrealized_pl ?? 0), 0);
  return (
    <div className={ui.tableWrap} tabIndex={0} role="region" aria-label="Holdings table">
      <table className={ui.table}>
        <caption className="visually-hidden">Current holdings with gain or loss and portfolio weight</caption>
        <thead>
          <tr>
            <th scope="col">Ticker</th>
            <th scope="col" className={ui.right}>Quantity</th>
            <th scope="col" className={ui.right}>Avg cost</th>
            <th scope="col" className={ui.right}>Current price</th>
            <th scope="col" className={ui.right}>Market value</th>
            <th scope="col" className={ui.right}>Gain/loss</th>
            <th scope="col" className={ui.right}>Gain/loss %</th>
            <th scope="col" className={ui.right}>Weight</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.ticker}>
              <th scope="row" className={ui.ticker}>
                <span className={ui.swatch} style={{ background: colorOf(h.ticker) ?? "var(--chart-other)" }} aria-hidden="true" />
                {h.ticker}
              </th>
              <td className={ui.right}>{quantity(h.quantity)}</td>
              <td className={ui.right}>{money(h.avg_cost)}</td>
              <td className={ui.right}>{h.current_price == null ? <span className={s.na}>no price</span> : money(h.current_price)}</td>
              <td className={ui.right}>{money(h.market_value)}</td>
              <td className={cx(ui.right, tone(h.unrealized_pl))}>{signedMoney(h.unrealized_pl)}</td>
              <td className={cx(ui.right, tone(h.unrealized_pl_pct))}>{signedPercent(h.unrealized_pl_pct)}</td>
              <td className={ui.right}>{percent(h.weight)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td />
            <td />
            <td />
            <td className={ui.right}>{money(total)}</td>
            <td className={cx(ui.right, tone(pl))}>{signedMoney(pl)}</td>
            <td />
            <td className={ui.right}>{total > 0 ? percent(1) : "–"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className={ui.stack} role="status" aria-label="Loading portfolio">
      <div className={s.heroGrid}>
        <div className={ui.card}>
          <Skeleton width={120} height={14} />
          <Skeleton width="70%" height={48} style={{ marginTop: 12 }} />
          <Skeleton width="50%" height={14} style={{ marginTop: 12 }} />
          <Skeleton width="90%" height={40} style={{ marginTop: 32 }} />
        </div>
        <div className={ui.card}>
          <div className={s.skeletonDonut}>
            <Skeleton width={200} height={200} style={{ borderRadius: "50%" }} />
            <div className={s.skeletonLines}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={14} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={ui.card}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={18} style={{ marginBottom: 16 }} />
        ))}
      </div>
    </div>
  );
}
