# Sample CSVs (all made up)

Upload these with "Upload your CSV" (top right) or on the Input Transactions tab. None of them are anyone's real holdings.

| File | What it shows |
| --- | --- |
| `long_term_investor.csv` | 24 trades, 2023–2026: monthly-ish buys of VOO, QQQ, VXUS, BND and GLD, a few rebalancing sells, no fees. |
| `active_trader.csv` | 27 trades, 2024–2026: 9 stocks (MSFT, AMZN, META, JPM, TSLA, KO, GOOGL, COST, XOM), $4.95 fees, partial sells, a losing trade (TSLA), and XOM fully closed. |
| `with_errors.csv` | Deliberately broken: bad date, side `HOLD`, negative quantity, non-numeric price, invalid ticker, negative fee. The app should reject the whole file and list rows 3–8. |

Tickers with stock splits in this period (e.g. NVDA, AVGO, WMT, SCHD) are avoided because v1 ignores splits.
