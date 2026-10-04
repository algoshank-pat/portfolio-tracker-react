// Shapes of the backend API (SPEC.md section 5). Percentages are fractions (0.12 = 12%).

export type Side = "BUY" | "SELL";

export interface Transaction {
  trade_date: string; // YYYY-MM-DD
  ticker: string;
  side: Side;
  quantity: number;
  price: number;
  fees: number;
}

export interface ValidateResponse {
  transactions: Transaction[];
  count: number;
}

export type PriceSource = "live" | "snapshot" | "demo";

export interface Holding {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number | null;
  market_value: number | null;
  unrealized_pl: number | null;
  unrealized_pl_pct: number | null;
  weight: number | null;
}

export interface PortfolioResponse {
  as_of: string | null;
  price_source: PriceSource;
  price_note: string;
  current_value: number;
  holdings: Holding[];
  missing_prices: string[];
}

export interface PerformanceSummary {
  total_invested: number;
  total_sold: number;
  current_value: number;
  total_return: number;
  total_return_pct: number | null;
  xirr: number | null;
}

export interface TrendPoint {
  date: string;
  portfolio_value: number;
  net_invested: number;
}

export interface PerformanceResponse {
  as_of: string | null;
  price_source: PriceSource;
  price_note: string;
  summary: PerformanceSummary;
  trend: TrendPoint[];
  missing_prices: string[];
}
