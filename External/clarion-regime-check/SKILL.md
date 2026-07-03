---
name: clarion-regime-check
description: Reads the SPY/TLT/RSP color regime and the equity hurdle rate. Use when the user asks about the market regime, risk-on / risk-off, market color, SPY/TLT regime, breadth, or what hurdle rate to use for new positions. Pulls daily bars via yfinance (cached locally). Optionally accepts a 1Y T-bill yield to compute the equity hurdle rate. Requires clarion-setup to have been run.
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Regime Check
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion regime check

Reports the current market regime color (GREEN / BLUE / ORANGE / RED / DANGER) and, if a risk-free rate is supplied, the equity hurdle rate.

## When to use

User asks any of:
- "What's the market regime?"
- "Is the market risk-on or risk-off?"
- "What color is SPY/TLT today?"
- "What's the breadth signal?"
- "What hurdle rate should I use for new positions?"

## How to run

```bash
python /home/workspace/clarion-intelligence-system/skills/clarion-regime-check/scripts/regime.py
```

If the user mentioned a 1Y T-bill yield, risk-free rate, or "rf rate", pass it (a percent value, no `%` sign):

```bash
python ... regime.py --rf-rate-pct 4.5
```

If the user wants the latest cached read without re-fetching from yfinance:

```bash
python ... regime.py --offline
```

## Output

The script prints a structured markdown report:

- **Heading** — color and as-of date
- **Rationale** — a short paragraph stating which signal triggered the color
- **Signals table** — SPY 20d return, TLT 20d return, RSP-SPY 60d spread, SPY 252d drawdown
- **Hurdle rate** — only when `--rf-rate-pct` is supplied
- **Footer** — sources and timestamp

Pass the script output through to the user verbatim. Do not paraphrase the numbers or invent a new format.

If the user asks what a color **means** — e.g. "what does ORANGE imply?" or "how should I size positions in this regime?" — load `references/regime-color-guide.md` and answer from it.

## On error

If the script prints `REGIME_ERROR: ...`, surface the error to the user. Common cases:

- **`empty history for SPY` / `TLT` / `RSP`** — yfinance returned no rows. Network glitch or rate limit. Suggest waiting a minute and retrying, or running with `--offline` if there's a recent cache.
- **`need at least 61 bars`** — the workspace is brand new and the cache hasn't backfilled enough history. Tell the user to wait for the first full fetch (the script will fetch ~5 years on first run).
