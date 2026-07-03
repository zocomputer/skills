# Screening criteria — quick reference

Source: [`docs/ALLOCATION-POLICY.md`](../../../docs/ALLOCATION-POLICY.md) and [`lib/ai_buffett_zo/screener/scoring.py`](../../../lib/ai_buffett_zo/screener/scoring.py).

## Regime-adjusted thresholds (binary filter)

| Metric | Green/Blue | Orange | Red/Danger |
|---|---|---|---|
| P/E (trailing) | < 25 | < 20 | < 15 |
| P/FCF | < 20 | < 16 | < 12 |
| Debt/Equity | < 1.0 | < 0.8 | < 0.5 |
| ROE (5y avg) | > 12% | > 15% | > 18% |
| Operating Margin | > 10% | > 12% | > 15% |

A candidate fails the binary filter if **any** field is non-None **and** outside its regime cutoff. Missing fields don't fail (counted as unknown rather than fail).

## 8-factor composite formula

| Factor | Weight | Scoring |
|---|---|---|
| P/E | 15% | (25 - P/E) / 25 × 100, clamped [0, 100] |
| P/FCF | 15% | (20 - P/FCF) / 20 × 100, clamped |
| ROE | 15% | min(ROE × 100 / 40 × 100, 100) |
| ROIC | 10% | min(ROIC × 100 / 30 × 100, 100) |
| Operating Margin | 10% | min(OpM × 100 / 40 × 100, 100) |
| D/E | 15% | (1 - D/E) × 100, clamped [0, 100] |
| Profit Margin | 10% | min(margin × 100 / 30 × 100, 100) |
| Insider Activity | 10% | Cluster buy ≥5%: 90; net buy: 75; |±1%| neutral: 50; net sell: 30; heavy sell ≤-10: 15 |

Weights sum to 100. Missing fields reduce the contributing weight; the score is rescaled.

## Sector cap

- **Default:** max 3 per GICS sector in the top 10.
- **Relaxation:** if fewer than 4 distinct sectors are represented in the top 20 by raw score, the cap relaxes to 4 per sector. This acknowledges genuinely-concentrated universes (e.g., a screen surfacing 8 P&C insurers).
- **Displaced names** are listed in the watchlist with the reason ("sector cap: FinSvcs already has 3 representatives").

## Stage 2 (delegated to clarion-single-stock-eval)

For each top-cap candidate worth a deeper look, run `clarion-single-stock-eval --rf-rate-pct X.X TICKER`. That skill applies the Buffett Question Bank against indexed SEC filings and produces the structured input the user then turns into the Sniff Test sections of the watchlist.
