# Watchlist update — what to watch for

Source: [`docs/PRINCIPLES.md` Principle 8 (Patience Is a Position)](../../../docs/PRINCIPLES.md#8-patience-is-a-position) and the AWB watchlist examples.

## Why a watchlist is a position

A watchlist is what we don't own *yet*. It's where the discipline of "wait for the pitch" ([Principle 8](../../../docs/PRINCIPLES.md#8-patience-is-a-position)) gets operationalized. The names on the list are the ones we've decided are interesting at the right price; this skill tells us when those prices show up.

## What "moved" means

| Move since screen | What it tells you |
|---|---|
| > +10% | Entry case has likely weakened. Don't add. Watch. |
| +5% to +10% | Marginally less interesting. Re-check the thesis if you're inclined. |
| ±5% | Noise. Ignore. |
| -5% to -10% | Getting more interesting. Worth a fresh look. |
| < -10% | This is what the watchlist exists for. Run `clarion-single-stock-eval <TICKER>`. |

## Trigger hits (status:watchlist theses)

A `watchlist` thesis is one with a defined entry zone in its **Position Management** section. The script reads each watchlist-status thesis from `~/clarion/theses/` and shows current price vs the thesis's `cost_basis` field (when present, it's the prior entry; otherwise the script just shows current price).

For an explicit "did the entry zone hit?" check, look at the thesis's **Entry/Exit Levels** section directly — the script doesn't parse the prose-heavy add-zone fields in v1.

## Staleness

A watchlist older than 14 days is flagged. By that point regime, hurdle, and fundamentals have likely drifted enough that the screen needs a refresh — run `clarion-value-screener`.

## What this skill does NOT do

- Doesn't modify the watchlist file. For a fresh screen, run `clarion-value-screener`.
- Doesn't auto-run `clarion-single-stock-eval` for big movers — that's the chat agent's call after surfacing the move.
- Doesn't parse the prose-heavy Sniff Test or Passed-On sections — only the structured Stage 1 table.
