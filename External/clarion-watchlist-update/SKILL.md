---
name: clarion-watchlist-update
description: Refresh prices on the latest watchlist and surface what's moved, what's hit triggers, and what's stale. Reads ~/clarion/watchlists/sp500-screen-LATEST.md, fetches current prices for every ticker via yfinance, computes % move since the screen, and flags large moves (>10% in either direction) as worth attention. Also reads ~/clarion/theses/ for status:watchlist theses and shows their current price vs cost basis. Use when the user asks "what's hit my watchlist?", "watchlist update", "anything moving on my watchlist?", or "is anything close to a trigger?". Read-only — does not modify the watchlist file. Requires clarion-setup to have been run.
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Watchlist Update
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion watchlist update

Read-only snapshot of the latest watchlist with current prices. Surfaces what's moved, what might be near a trigger, and how stale the screen is. Does **not** modify the watchlist file — for a fresh screen, run `clarion-value-screener`.

## When to use

User asks any of:
- "What's hit my watchlist?"
- "Watchlist update."
- "Anything moving on my watchlist?"
- "Has anything reached a trigger?"
- "Run a daily watchlist check."

Cadence: this is a quick read, suitable for daily / pre-market.

## Decision tree

1. **Run the script** — no args needed.

   ```bash
   python /home/workspace/clarion-intelligence-system/skills/clarion-watchlist-update/scripts/update.py
   ```

   The script:
   - Loads the latest watchlist file from `~/clarion/watchlists/`
   - Fetches current prices for every ticker in the Stage 1 ranked table (via yfinance)
   - Computes % move since the screen
   - Pulls every thesis with `status: watchlist` from `~/clarion/theses/` and shows current vs cost-basis

2. **Pass the report through to the user verbatim.** It's already structured (header / movers / watchlist theses / staleness).

3. **If a screen-time price is missing** for a ticker (the script flags it), suggest a fresh screen — partial data on the watchlist undermines the comparison.

4. **If the watchlist is stale** (>14 days), the script flags it. Suggest running `clarion-value-screener` for a fresh screen.

5. **For names with large positive moves**, suggest checking whether the thesis still holds at the higher price — the entry case may no longer apply.

6. **For names with large negative moves**, suggest checking whether a thesis is worth opening — those are the moments the screen pays off.

## How to run

```bash
UPDATE=python /home/workspace/clarion-intelligence-system/skills/clarion-watchlist-update/scripts/update.py

$UPDATE                          # all watchlist tickers
$UPDATE --top-only               # only the Top-N after sector cap (less noise)
$UPDATE --threshold-pct 5        # custom threshold for "noticeable mover" (default 10%)
$UPDATE --max-stale-days 7       # custom staleness threshold (default 14)
```

## Voice

Lead with what's moved. **Big movers first** (positive or negative — both are signal). Then watchlist-status theses. Then staleness flag.

When a ticker has a large negative move (down >10% since screen), call attention to it explicitly — these are often the moments where a watchlist thesis becomes a real thesis. Suggest running `clarion-single-stock-eval <TICKER>` to refresh the lens.

When a ticker has a large positive move (up >10%), don't add it to anything — the entry case has weakened. Surface for awareness but don't act.

## On error

- **`WATCHLIST_UPDATE_ERROR: no watchlists`** — `~/clarion/watchlists/` is empty. Run `clarion-value-screener` first.
- **`WATCHLIST_UPDATE_ERROR: latest watchlist unparseable`** — the latest file isn't in canonical format. Verify it; consider regenerating with a fresh screener run.
- **`_warning: yfinance fetch failed for <TICKER>`** — non-fatal; that ticker is shown without a current price.
