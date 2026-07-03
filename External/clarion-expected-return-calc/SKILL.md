---
name: clarion-expected-return-calc
description: Compute the equity-vs-T-bill allocation for the Value bucket (50% of portfolio). Implements the Expected-Return Framework — looks up the historical 10-year forward return from the S&P 500 Shiller CAPE, computes the regime-adjusted hurdle (rf + regime premium), and produces a 5-tier verdict (STRONG EQUITY / LEAN EQUITY / NEUTRAL / LEAN T-BILLS / MAXIMUM T-BILLS) with recommended Value-bucket equity/T-bill split. Use when the user asks "should I be in stocks or bonds right now?", "what's the equity hurdle?", "is the market overvalued?", "what's the right Value bucket allocation?", or before adding any new equity to the Value bucket. Requires clarion-setup to have been run.
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Expected Return
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion expected-return calculator

Answers one question for the Value bucket (50% of portfolio): **what's the right equity/T-bill mix right now?**

Implements the Expected-Return Framework from [`docs/ALLOCATION-POLICY.md`](../../docs/ALLOCATION-POLICY.md) and the hurdle-rate framework from [`docs/DESIGN-LANGUAGE.md`](../../docs/DESIGN-LANGUAGE.md).

## When to use

User asks any of:
- "Should I be in stocks or bonds?"
- "What's the equity hurdle right now?"
- "Is the market overvalued?"
- "What's the right Value bucket allocation?"
- "Is this a good time to buy stocks?"

Also: before any major new equity allocation decision in the Value bucket, this skill should run first.

## Decision tree

1. **Fetch the inputs the script can't auto-source.** Use WebSearch to look up:
   - **Shiller CAPE** (required) — search `"Shiller PE Ratio current"` or `"S&P 500 CAPE current"`. Primary sources: multpl.com, Yardeni Research.
   - **Trailing P/E** (optional but useful for cross-check) — search `"S&P 500 trailing P/E current"` (multpl.com).
   - **Forward P/E** (optional) — multpl.com or Yardeni.
   - **10-year Treasury yield** (optional context) — Treasury.gov daily rates or any major financial site.

   Use multpl.com or Yardeni Research as the primary sources. **Never fabricate.** If WebSearch returns conflicting numbers, present both and use the more conservative one.

2. **Run the script** with the values you found:

   ```bash
   python /home/workspace/clarion-intelligence-system/skills/clarion-expected-return-calc/scripts/expected_return.py \
       --cape 35.2 --trailing-pe 28.4
   ```

   The script auto-fetches the 3-month T-bill yield from Treasury.gov (no API key), computes the regime via the shared regime layer, looks up implied 10-year forward return, computes the regime-adjusted hurdle, and produces a 5-tier verdict.

3. **Present the script output to the user verbatim.** It's already structured (Numbers / Math / Verdict / Recommended Split / Context).

4. **If the user asks "what would change this?"** — point at the Context section, which already lists the most likely scenario shifts.

5. **If the user wants to act on the verdict** — for new equity additions, suggest `clarion-single-stock-eval` so each candidate goes through the Buffett Question Bank.

## How to run

```bash
EXPECTED=python /home/workspace/clarion-intelligence-system/skills/clarion-expected-return-calc/scripts/expected_return.py

# Required: --cape (Shiller CAPE, primary lookup)
$EXPECTED --cape 35.2

# Add trailing P/E as cross-check (warns if divergence > 5 points)
$EXPECTED --cape 35.2 --trailing-pe 28.4

# Override risk-free rate (skip Treasury.gov fetch)
$EXPECTED --cape 35.2 --rf-rate-pct 4.45

# Skip Treasury.gov fetch (require manual rf)
$EXPECTED --cape 35.2 --rf-rate-pct 4.45 --no-fetch-rf

# Add 10-year Treasury and forward P/E for context
$EXPECTED --cape 35.2 --forward-pe 21.3 --ten-year-yield-pct 4.85
```

## Voice

Show the math. Lead with the verdict, then the spread, then the context. Don't soften — if the math says MAXIMUM T-BILLS, say so plainly. The framework is doing its job; bad news is signal.

When the trailing P/E and CAPE diverge meaningfully, the script flags it. **Do not ignore the flag** — point the user at the divergence and invite cross-checking the inputs.

## Hard rules

1. **Never fabricate P/E ratios or yields.** If WebSearch returns conflicting numbers, present both with sources and use the more conservative one.
2. **Always show the math.** The recommendation is only as good as the calculation behind it.
3. **DANGER state overrides everything.** When the regime is DANGER, the verdict is automatically MAXIMUM T-BILLS regardless of P/E math. The script enforces this.
4. **This skill is a Value-bucket allocation tool, not a per-position decision.** For per-position decisions (single-stock evaluations, theses), use `clarion-single-stock-eval`.

## On error

- **`EXPECTED_RETURN_ERROR: could not resolve risk-free rate`** — Treasury.gov unreachable AND no `--rf-rate-pct` passed AND no `rf_rate_pct` in `~/clarion/config.json`. Pass `--rf-rate-pct X.X` (current 3-month T-bill, look up on Treasury.gov website).
- **`EXPECTED_RETURN_ERROR: could not compute regime`** — yfinance cache empty for SPY/TLT/RSP. Run `clarion-regime-check` first to seed the cache.
- **`EXPECTED_RETURN_ERROR: --cape is required`** — Shiller CAPE wasn't supplied. Look up on multpl.com (search: "Shiller PE Ratio current").
