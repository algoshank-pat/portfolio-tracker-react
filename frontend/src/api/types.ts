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

// ---- "Ask your portfolio" assistant (SPEC.md A8) -----------------------------------
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  transactions: Transaction[];
  message: string;
  history: ChatTurn[];
}

export type ChatEvent =
  | { type: "received"; chars: number }
  | { type: "scope"; decision: "in_scope" | "out_of_scope" | "unclear"; reason: string; question_type: string }
  | { type: "declined"; text: string; activity: string }
  | { type: "clarify"; text: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; turn: number }
  | { type: "tool_result"; tool: string; summary: string }
  | { type: "answer"; text: string; tools_used: string[]; price_source: string | null; turns: number }
  | { type: "error"; text: string };
