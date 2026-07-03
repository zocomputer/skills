# Expected-Return Framework — quick reference

Full source: [`docs/ALLOCATION-POLICY.md → Expected-Return Framework`](../../../docs/ALLOCATION-POLICY.md#expected-return-framework). Load that for the complete reasoning.

This file is a quick-lookup reference for use during a chat turn.

---

## S&P 500 CAPE → 10-year forward return (historical)

| CAPE range | 10-year CAGR | Confidence |
|---|---|---|
| < 10 | 12-16% | High (strong base rate) |
| 10-15 | 8-12% | High |
| 15-20 | 5-8% | Moderate |
| 20-25 | 2-5% | Moderate |
| 25-30 | 0-3% | Moderate (wide dispersion) |
| > 30 | -2% to 0% | Low (small sample, extreme valuations) |

**Use Shiller CAPE as the primary lookup. Trailing P/E is a secondary cross-check.** If the two diverge by more than 5 P/E points, note the divergence in the output and verify both inputs.

---

## Hurdle = rf + regime premium

| Regime | Premium |
|---|---|
| Green / Blue | +4% |
| Orange | +6% |
| Red | +8% |
| Danger | +10% (effectively: buy almost nothing) |

---

## Verdict map

| Spread (implied vs hurdle) | Verdict | Equity % |
|---|---|---|
| > Hurdle + 3% | STRONG EQUITY | 80-100% |
| > Hurdle | LEAN EQUITY | 60-80% |
| Within ±1% | NEUTRAL | 40-60% |
| < Hurdle | LEAN T-BILLS | 20-40% |
| < rf rate | MAXIMUM T-BILLS | 0-20% |
| DANGER state | MAXIMUM T-BILLS | 0-20% (hard override) |

---

## Where each input comes from

| Input | Source | Why |
|---|---|---|
| Shiller CAPE | WebSearch → multpl.com / Yardeni | Primary 10-year-forward-return lookup |
| Trailing P/E | WebSearch → multpl.com | Cross-check; warn on divergence > 5 points |
| Forward P/E | WebSearch → multpl.com / Yardeni | Optional context |
| Regime color | clarion-regime-check (auto) | Determines premium |
| 3-month T-bill | Treasury.gov daily CSV (auto) | Risk-free rate; user can override with `--rf-rate-pct` |
| 10-year Treasury | WebSearch (optional) | Long-duration benchmark for context |
