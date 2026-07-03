---
name: clarion-thesis-monitor
description: Monitor the health of every active thesis in ~/clarion/theses/. For each one — refresh price, recompute Risk Environment from the current regime, check kill conditions (read from the file's status column), aggregate to an Overall score, recommend an action (EXIT / REDUCE / HOLD / ADD), and write the updated scores + history back to the thesis file. Produces a dashboard surfacing what needs attention. Use when the user asks "monitor my theses", "thesis health check", "any kill conditions triggered?", "what's the action on <TICKER>", or as part of a daily / weekly review. Requires clarion-setup to have been run.
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Thesis Monitor
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion thesis monitor

Reads every active thesis from `~/clarion/theses/`, scores health, checks kill conditions, and produces an action recommendation per thesis. Updates each file with the new scores and timestamps; appends a History entry when the action changes.

Implements [`docs/PRINCIPLES.md` Principle 2 (Thesis-First, Always)](../../docs/PRINCIPLES.md#2-thesis-first-always) — *"a thesis that isn't monitored is just a hope."*

## When to use

User asks any of:
- "Monitor my theses."
- "Thesis health check."
- "Any kill conditions triggered?"
- "What's the action on NVDA right now?"
- "Run a full health check across the portfolio."

Cadence guidance:
- **Daily** — `--quick` mode (kill condition statuses + price refresh + Risk Environment recompute, no full re-scoring)
- **Weekly** — full mode (all directly-derivable components recomputed; carries forward LLM-driven components)
- **Monthly** — full mode + manual review of the LLM-driven components (Business Health, Insider Alignment, Thesis Integrity)

## Decision tree

1. **Default invocation:** run with no args to process all active theses.

   ```bash
   python /home/workspace/clarion-intelligence-system/skills/clarion-thesis-monitor/scripts/monitor.py
   ```

   Filters to `status: active` theses; skips `draft`, `watchlist`, `closed`, `killed`. (`draft` is the default status of a freshly scaffolded thesis from `clarion-thesis-write` — the user promotes to `active` once the prose is filled in.)

2. **Single-thesis review:** if the user asks about one ticker, scope it.

   ```bash
   python ... monitor.py --ticker NVDA
   ```

3. **Quick mode (daily):** skip the full health re-scoring; just check kill conditions, refresh prices, recompute Risk Environment.

   ```bash
   python ... monitor.py --quick
   ```

4. **Read-only mode:** preview the dashboard without writing back to thesis files.

   ```bash
   python ... monitor.py --no-write
   ```

5. **Pass the dashboard output to the user verbatim.** It's already structured (per-thesis action + score, kill alerts at the top).

6. **Surface "Action Items"** — if any thesis flips to EXIT or REDUCE, raise it explicitly. The user makes the call; the system does not pull triggers automatically. ([`docs/PRINCIPLES.md` Anti-principle 5](../../docs/PRINCIPLES.md#the-anti-principles-what-the-system-refuses-to-be).)

## What gets recomputed

| Component | v1 behavior | Notes |
|---|---|---|
| Valuation Safety | If `--current-price` provided AND a `base_case_fair_value` is in the thesis metadata, recomputed. Else carried forward. | Add `base_case_fair_value: 480.0` to the thesis metadata block to enable auto-scoring. |
| Business Health | Carried forward in v1 | Future: `/zo/ask` over recent MD&A snippets |
| Insider Alignment | Carried forward in v1 | Future: WebSearch over recent Form 4s |
| Catalyst Proximity | If `catalyst_date` in metadata, recomputed. Else carried forward. | Add `catalyst_date: 2026-08-15` to enable auto-scoring. |
| Thesis Integrity | Carried forward in v1 | Future: `/zo/ask` over thesis evidence + new filings |
| Risk Environment | **Always recomputed** | regime × bucket matrix |

When the lib's deterministic-scoring v2 lands (LLM-driven Business Health / Thesis Integrity via `/zo/ask`), the carry-forward defaults will be replaced. The user's manually-set scores remain authoritative until then.

## How to run

```bash
MONITOR=python /home/workspace/clarion-intelligence-system/skills/clarion-thesis-monitor/scripts/monitor.py

$MONITOR                                 # all active theses, full mode
$MONITOR --quick                         # kill checks + Risk Env only
$MONITOR --ticker NVDA                   # single thesis
$MONITOR --no-write                      # preview, don't update files
$MONITOR --ticker NVDA --current-price 142.50  # force re-score Valuation Safety
```

## Voice

Lead with **action items** (any EXIT or REDUCE), then the dashboard. Don't bury bad news. The whole point of monitoring is the moments when things degrade.

When a kill condition is triggered, surface it explicitly: *"NVDA — kill condition triggered (gross margin < 60% per latest 10-Q). Action is EXIT regardless of score. Review within 48 hours per the thesis hard rule."*

## Hard rules

1. **Kill conditions are binary.** A triggered kill condition forces EXIT — no exceptions, no "well, maybe it's fine." This is enforced in code.
2. **Never fabricate health scores.** If the script can't compute a component (no current price, no base case fair value), it carries forward the previous score and marks "data unavailable."
3. **Always update the thesis files.** The monitor is not read-only by default. It writes back updated scores, dates, and findings. (Use `--no-write` to opt out for previews.)
4. **Regime overrides are conservative.** In Danger state, all theses downgrade one action level. Shorts upgrade. This is enforced in `lib/ai_buffett_zo/theses/health.py:adjust_for_regime`.
5. **Show the evidence.** Every component score in the output has a one-line rationale traceable to a regime, a price, or a previous-run carry-forward.

## On error

- **`THESIS_MONITOR_ERROR: no active theses`** — `~/clarion/theses/` is empty, or every thesis has `status: draft/closed/killed/watchlist`. If you have draft theses, finish filling them in and promote the metadata `status: draft` → `status: active`. Otherwise run `clarion-thesis-write` to scaffold a new one.
- **`THESIS_MONITOR_ERROR: regime unavailable`** — yfinance cache empty for SPY/TLT/RSP. Run `clarion-regime-check` first to seed it.
- **`THESIS_MONITOR_ERROR: malformed thesis`** — a specific thesis file failed to parse. The dashboard still runs for the others; the failed one is listed separately for the user to fix.
