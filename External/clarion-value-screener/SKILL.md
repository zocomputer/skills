---
name: clarion-value-screener
description: Run a value-quality screen and write a watchlist file. The script accepts either a list of tickers (fundamentals fetched from yfinance) or a JSON input file the chat agent prepared from a screener site (multpl.com, finviz, Yardeni, etc.). Computes the 8-factor composite score (P/E, P/FCF, ROE, ROIC, Operating Margin, D/E, Profit Margin, Insider) per docs/ALLOCATION-POLICY.md, applies regime-tightened thresholds, and produces a sector-capped Top-10 watchlist. Saves to ~/clarion/watchlists/sp500-screen-YYYY-MM-DD.md. Use when the user asks "run a value screen", "screen the S&P 500", "screen these tickers <list>", or after market drawdowns / regime changes. Requires clarion-setup to have been run.
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Value Screener
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion value screener

Implements the two-stage pipeline from [`docs/ALLOCATION-POLICY.md`](../../docs/ALLOCATION-POLICY.md). Stage 1 (cast the net + score + sector cap + watchlist) is the script's job. Stage 2 (filing-level deep dives + thesis starters) is delegated to `clarion-single-stock-eval` per top candidate.

## When to use

User asks any of:
- "Run a value screen."
- "Screen the S&P 500 for new candidates."
- "Screen NVDA, AAPL, ADBE."
- "What names should I be looking at right now?"

Cadence guidance (from AWB):
- **Monthly** — full screen
- **After market drawdowns** — opportunistic
- **After regime changes** — especially Green→Orange or Orange→Red

## Decision tree

1. **Resolve scope.** If the user named specific tickers, use `--tickers`. Otherwise, the chat agent should prepare a JSON input by:
   - Running [`clarion-regime-check`](../clarion-regime-check) to confirm regime
   - Running [`clarion-expected-return-calc`](../clarion-expected-return-calc) to confirm hurdle
   - Using `WebFetch` on a screener site (multpl.com / Yardeni / finviz) with regime-appropriate filters per [`docs/ALLOCATION-POLICY.md`](../../docs/ALLOCATION-POLICY.md)
   - Building a JSON file with the resulting candidates (see schema below)

2. **Run the script.**

   ```bash
   # Tickers list mode (script fetches yfinance fundamentals)
   python /home/workspace/clarion-intelligence-system/skills/clarion-value-screener/scripts/screen.py \
       --tickers NVDA,AAPL,ADBE,LULU,AOS

   # JSON input mode (chat agent prepared the candidates)
   python ... screen.py --input ~/clarion/queue/screen-input.json
   ```

3. **Read the watchlist file the script wrote.** Path is printed at the end. The file is the structured output; pass it through to the user verbatim for the tables, then walk them through the [TODO] sections (Sniff Test, Passed On, Existing Theses Impact).

4. **Fill the Sniff Test sections** by running `clarion-single-stock-eval` on each top-cap candidate that isn't already covered by an active thesis. Use the eval output to write the sniff-test snapshot per the AWB watchlist examples.

5. **Existing Theses Impact** — list any top candidate that already has a thesis in `~/clarion/theses/`. If so, summarize whether the screen confirms or challenges the existing thesis.

## How to run

```bash
SCREEN=python /home/workspace/clarion-intelligence-system/skills/clarion-value-screener/scripts/screen.py

# Tickers mode (most common when user names a list)
$SCREEN --tickers NVDA,AAPL,ADBE,LULU,AOS

# JSON input mode (full S&P 500 screen via WebFetch by chat agent)
$SCREEN --input ~/clarion/queue/screen-input.json

# Override context
$SCREEN --tickers NVDA,AAPL --rf-rate-pct 4.45 --sp500-cape 35.2

# Custom universe label and target size
$SCREEN --tickers NVDA,AAPL,... --universe "Russell 1000" --top-size 15
```

### JSON input schema

```json
{
  "screen_date": "2026-05-07",
  "context": {
    "regime_color": "orange",
    "danger_state": false,
    "rf_rate_pct": 4.45,
    "hurdle_rate_pct": 10.45,
    "sp500_cape": 35.2,
    "sp500_trailing_pe": 28.4,
    "implied_return_low_pct": 0.0,
    "implied_return_high_pct": 3.0,
    "universe": "S&P 500",
    "notes": "Mega-cap led rally; verify breadth before sizing."
  },
  "candidates": [
    {
      "ticker": "NVDA",
      "company": "NVIDIA Corp",
      "sector": "Tech",
      "pe": 35.2,
      "pfcf": 40.0,
      "roe": 0.55,
      "roic": 0.42,
      "op_margin": 0.62,
      "profit_margin": 0.55,
      "de": 0.25,
      "insider_pct": -0.2,
      "market_cap": 3000000000000,
      "price": 140.50
    }
  ]
}
```

Margin / yield / return fields are decimals (0.20 = 20%). Insider activity is a signed percent (positive = net buying). Any field can be omitted; the composite formula reduces its weight share when data is missing.

## Voice

Lead with the **regime + screening stance** (one line). Then surface the **top 3 by composite** with the most interesting one-line take. Then point at the watchlist file for the full ranked table and detail.

When the script flags a candidate's `contributing_weight` as low (< 60), call it out — that means the score is based on partial data and shouldn't be over-weighted.

## Hard rules

1. **Never fabricate fundamental data.** If the screener site or yfinance doesn't return a metric, leave it None and let the contributing-weight surface the gap.
2. **Regime adjusts aggressiveness, not quality.** In Red/Danger, deeper discounts required — never lower the quality bar.
3. **The screener finds candidates, not positions.** The output is a watchlist with thesis starters. The principal reviews and decides what gets a full thesis.
4. **Document what you passed on.** The "Passed On" section is as valuable as the winners.
5. **Stage 2 requires filings.** Don't generate a thesis starter without indexed filings — run `clarion-sec-research index <TICKER>` first if needed.

## On error

- **`SCREEN_ERROR: regime unavailable`** — yfinance cache empty for SPY/TLT/RSP. Run `clarion-regime-check` first.
- **`SCREEN_ERROR: --tickers or --input required`** — supply one of them.
- **`SCREEN_ERROR: input file not found`** — check the `--input` path.
- **`_warning: yfinance fetch failed for <TICKER>`** — non-fatal; that ticker's score will be based on partial data. The script continues.
