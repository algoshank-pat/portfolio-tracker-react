// Number and date formatting. All money is USD (v1).

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const qty = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const DASH = "–";

export function money(v: number | null | undefined, opts: { whole?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return (opts.whole ? usdWhole : usd).format(v);
}

export function moneyCompact(v: number): string {
  return usdCompact.format(v);
}

/** Signed money for gains/losses: +$1,234.00 / −$56.00 */
export function signedMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const s = usd.format(Math.abs(v));
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function quantity(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return qty.format(v);
}

/** Fraction to percent (0.123 → 12.3%). */
export function percent(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return pct.format(v);
}

export function signedPercent(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const s = pct.format(Math.abs(v));
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function tone(v: number | null | undefined): "gain" | "loss" | undefined {
  if (v == null || !Number.isFinite(v) || v === 0) return undefined;
  return v > 0 ? "gain" : "loss";
}

const longDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", timeZone: "UTC" });

/** "2024-01-15" → "Jan 15, 2024" (dates are calendar days, so format in UTC). */
export function date(iso: string | null | undefined): string {
  if (!iso) return DASH;
  return longDate.format(new Date(`${iso}T00:00:00Z`));
}

export function monthLabel(iso: string): string {
  return monthYear.format(new Date(`${iso}T00:00:00Z`));
}
