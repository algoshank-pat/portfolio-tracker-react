// Allocation donut with a direct-labelled legend. Top 7 holdings by value, the rest grouped as "Other".

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Holding } from "../../api/types";
import { money, moneyCompact, percent } from "../../lib/format";
import { CHART_COLORS, MAX_SLICES, OTHER_COLOR, prefersReducedMotion } from "./chartUtils";
import s from "./charts.module.css";

interface Slice {
  name: string;
  value: number;
  weight: number;
  color: string;
  members?: string[];
}

export function useSlices(holdings: Holding[]): Slice[] {
  return useMemo(() => {
    const priced = holdings
      .filter((h) => h.market_value != null && h.market_value > 0)
      .sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0));
    const total = priced.reduce((sum, h) => sum + (h.market_value ?? 0), 0);
    if (!total) return [];
    const needOther = priced.length > MAX_SLICES + 1;
    const head = needOther ? priced.slice(0, MAX_SLICES) : priced;
    const tail = needOther ? priced.slice(MAX_SLICES) : [];
    const slices: Slice[] = head.map((h, i) => ({
      name: h.ticker,
      value: h.market_value ?? 0,
      weight: (h.market_value ?? 0) / total,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
    if (tail.length) {
      const v = tail.reduce((sum, h) => sum + (h.market_value ?? 0), 0);
      slices.push({
        name: `Other (${tail.length})`,
        value: v,
        weight: v / total,
        color: OTHER_COLOR,
        members: tail.map((h) => h.ticker),
      });
    }
    return slices;
  }, [holdings]);
}

export function AllocationDonut({ holdings, total }: { holdings: Holding[]; total: number }) {
  const slices = useSlices(holdings);
  const [active, setActive] = useState<number | null>(null);
  const animate = !prefersReducedMotion();

  if (!slices.length) return null;
  const summary = slices.map((x) => `${x.name} ${percent(x.weight)}`).join(", ");
  const focus = active != null ? slices[active] : null;

  return (
    <div className={s.donutWrap}>
      <div className={s.donut} role="img" aria-label={`Allocation by market value: ${summary}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={slices.length > 1 ? 1.5 : 0}
              stroke="var(--surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={animate}
              animationDuration={700}
              animationEasing="ease-out"
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {slices.map((x, i) => (
                <Cell key={x.name} fill={x.color} opacity={active == null || active === i ? 1 : 0.35} />
              ))}
            </Pie>
            <Tooltip content={() => null} />
          </PieChart>
        </ResponsiveContainer>
        <div className={s.donutCenter} aria-hidden="true">
          <span className={s.donutCenterLabel}>{focus ? focus.name : "Total value"}</span>
          <span className={s.donutCenterValue}>{focus ? percent(focus.weight) : moneyCompact(total)}</span>
          {focus && <span className={s.donutCenterSub}>{money(focus.value, { whole: true })}</span>}
        </div>
      </div>
      <ul className={s.legend} aria-label="Allocation legend">
        {slices.map((x, i) => (
          <li
            key={x.name}
            className={s.legendItem}
            data-dim={active != null && active !== i ? "" : undefined}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            title={x.members ? x.members.join(", ") : undefined}
          >
            <span className={s.legendSwatch} style={{ background: x.color }} aria-hidden="true" />
            <span className={s.legendName}>{x.name}</span>
            <span className={s.legendBar} aria-hidden="true">
              <span style={{ width: `${Math.max(2, x.weight * 100)}%`, background: x.color }} />
            </span>
            <span className={s.legendPct}>{percent(x.weight)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
