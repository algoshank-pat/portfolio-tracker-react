import type { PriceSource } from "../api/types";
import { date } from "../lib/format";
import { Banner } from "./ui";

/** Says plainly when prices are not live, and which tickers have no price at all. */
export function PriceBanner({
  source,
  note,
  missing,
}: {
  source: PriceSource;
  note: string;
  missing: string[];
}) {
  return (
    <>
      {source === "snapshot" && (
        <Banner tone="warn" title="Stored prices, not live">
          {note} Values below use those stored closing prices.
        </Banner>
      )}
      {source === "demo" && (
        <Banner tone="warn" title="Synthetic prices">
          {note}
        </Banner>
      )}
      {missing.length > 0 && (
        <Banner tone="warn" title={`No price for ${missing.join(", ")}`}>
          {missing.length === 1 ? "This holding is" : "These holdings are"} left out of current value, weights and
          returns. Check the ticker symbol, or note that non-US and delisted tickers are not supported.
        </Banner>
      )}
    </>
  );
}

export function AsOf({ asOf, source }: { asOf: string | null; source: PriceSource }) {
  if (!asOf) return null;
  const label = source === "live" ? "Prices as of" : source === "snapshot" ? "Stored prices as of" : "Synthetic prices,";
  return (
    <span>
      {label} {date(asOf)}
    </span>
  );
}
