---
name: clarion-single-stock-eval
description: Evaluate a single stock using the Buffett lens. Pulls a quality snapshot from yfinance, current SPY/TLT regime context, and snippets from the indexed SEC filings across four dimensions (moat, management, financial trends, risks). The chat agent reasons over the structured output to produce a written evaluation. Use when the user says "evaluate <TICKER>", "is <TICKER> a buy?", "Buffett evaluation of <TICKER>", "what's <TICKER>'s moat?", or asks about a specific company's management, financials, or risks. Requires clarion-setup to have been run, and the ticker to be indexed first via clarion-sec-research.
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Single-Stock Eval
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion single-stock evaluation

Pulls structured data + filing snippets for a ticker, then helps you compose a Buffett-style evaluation.

## When to use

User asks any of:
- "Evaluate NVDA."
- "Is KO still a long-term hold?"
- "Buffett take on AAPL."
- "What's NVDA's moat?"
- "How does AMD's management allocate capital?"
- "What are the biggest risks for INTC?"

## Decision tree

1. **Check indexing.** If the ticker hasn't been indexed yet, do not try to evaluate. Tell the user to run `clarion-sec-research index <TICKER>` first, wait 1–5 minutes, then come back.
2. **Run `eval.py <TICKER>`.** If the user mentioned a 1Y T-bill yield or risk-free rate, pass `--rf-rate-pct X.X`. The script prints market context, a quality snapshot, and four dimensions of filing snippets.
3. **Read the brief end-to-end.** Then synthesize an evaluation using the `references/buffett-question-bank.md` (load it on demand) — answer the four (or five, if hurdle was supplied) numbered questions in the script's "Reading guide" section, in order, citing the filing on every claim drawn from filings.
4. **Conclude with one of three verdicts:**
   - **Add** — clear thesis; expected return likely clears the regime hurdle; ready to size a position
   - **Watchlist** — promising but waiting for {a better price / a specific catalyst / a clearer signal}
   - **Skip** — material issue (no durable moat / impaired financials / unaligned management / risk profile too severe)
5. **If the verdict is Add** and the user wants to act on it, suggest `clarion-thesis-write` to formalize the position into a thesis file.

## How to run

```bash
EVAL=python /home/workspace/clarion-intelligence-system/skills/clarion-single-stock-eval/scripts/eval.py

$EVAL NVDA                       # default — pulls all four dimensions
$EVAL NVDA --rf-rate-pct 4.5     # adds equity hurdle to market context
$EVAL NVDA --no-regime           # skip regime/hurdle if user just wants the lens
```

## Voice

Conservative and direct. Show your math (numbers from the snippets and the quality table). Lead with what the filings actually say; surface uncertainty where the snippets are vague.

**Always cite the filing on every claim drawn from filings.** Each snippet's `citation` line is canonical (`NVDA 10-K filed 2026-02-21 → risk_factors`). Do not paraphrase the citation — copy it.

Don't fabricate. If a snippet doesn't directly support a claim you'd like to make, say so explicitly — "the indexed sections don't address customer concentration" beats inventing.

The yfinance quality table is point-in-time and occasionally wrong (ticker remappings, delistings, foreign listings). For high-conviction calls, suggest the user verify against the latest filing.

## On error

- **`No filings indexed`** — run `clarion-sec-research index <TICKER>`, wait for completion, retry.
- **`EVAL_ERROR: failed to fetch fundamentals`** — yfinance hiccup. Retry in a minute. The lens still works without fundamentals; consider running with `--no-regime` and noting the gap.
