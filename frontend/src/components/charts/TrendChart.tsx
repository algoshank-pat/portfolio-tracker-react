// Portfolio value vs cumulative net invested over time, with direct end labels.

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { TrendPoint } from "../../api/types";
import { date, money, moneyCompact, monthLabel, signedMoney, tone } from "../../lib/format";
import { prefersReducedMotion } from "./chartUtils";
import s from "./charts.module.css";

const VALUE = "var(--chart-1)";
const INVESTED = "var(--chart-muted)";

function ticksFor(points: TrendPoint[]): string[] {
  if (points.length < 2) return points.map((p) => p.date);
  const months = new Map<string, string>();
  for (const p of points) {
    const key = p.date.slice(0, 7);
    if (!months.has(key)) months.set(key, p.date);
  }
  const all = [...months.values()];
  const step = Math.max(1, Math.ceil(all.length / 6));
  return all.filter((_, i) => i % step === 0);
}

function TrendTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as TrendPoint;
  const gain = p.portfolio_value - p.net_invested;
  return (
    <div className={s.tooltip}>
      <div className={s.tooltipDate}>{date(p.date)}</div>
      <div className={s.tooltipRow}>
        <span className={s.tooltipKey}>
          <i style={{ background: VALUE }} /> Portfolio value
        </span>
        <span className="num">{money(p.portfolio_value)}</span>
      </div>
      <div className={s.tooltipRow}>
        <span className={s.tooltipKey}>
          <i style={{ background: INVESTED }} /> Net invested
        </span>
        <span className="num">{money(p.net_invested)}</span>
      </div>
      <div className={s.tooltipRow}>
        <span className={s.tooltipKey}>Total return</span>
        <span className={`num ${tone(gain) ?? ""}`}>{signedMoney(gain)}</span>
      </div>
    </div>
  );
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const ticks = useMemo(() => ticksFor(points), [points]);
  const animate = !prefersReducedMotion();
  if (!points.length) return null;
  const last = points[points.length - 1];
  const first = points[0];

  return (
    <figure className={s.trend}>
      <div className={s.trendLegend} aria-hidden="true">
        <span>
          <i style={{ background: VALUE }} /> Portfolio value
        </span>
        <span>
          <i className={s.dash} style={{ borderColor: INVESTED }} /> Net invested (buys minus sale proceeds)
        </span>
      </div>
      <div
        className={s.trendChart}
        role="img"
        aria-label={`Line chart from ${date(first.date)} to ${date(last.date)}. Portfolio value went from ${money(
          first.portfolio_value,
        )} to ${money(last.portfolio_value)}; net invested is ${money(last.net_invested)}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2b3a8c" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#2b3a8c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={monthLabel}
              tick={{ fill: "var(--text-3)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border-strong)" }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => moneyCompact(v)}
              tick={{ fill: "var(--text-3)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={[0, "auto"]}
            />
            <Tooltip content={TrendTooltip} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="portfolio_value"
              name="Portfolio value"
              stroke={VALUE}
              strokeWidth={2.25}
              fill="url(#valueFill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              isAnimationActive={animate}
              animationDuration={900}
            />
            <Line
              type="stepAfter"
              dataKey="net_invested"
              name="Net invested"
              stroke={INVESTED}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--surface)" }}
              isAnimationActive={animate}
              animationDuration={900}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className={s.trendEnd}>
        <span>
          <b style={{ color: VALUE }}>Value</b> <span className="num">{money(last.portfolio_value, { whole: true })}</span>
        </span>
        <span>
          <b style={{ color: "var(--text-2)" }}>Invested</b>{" "}
          <span className="num">{money(last.net_invested, { whole: true })}</span>
        </span>
        <span className="num">on {date(last.date)}</span>
      </figcaption>
    </figure>
  );
}
