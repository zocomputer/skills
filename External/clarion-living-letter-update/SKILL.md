---
name: clarion-living-letter-update
description: Update the annual investor letter at ~/clarion/letters/{YEAR}-letter.md with a new quarterly section, or finalize it at year-end. Auto-fills the system-deterministic parts (regime snapshot, thesis health table, portfolio bucket positions from active theses); marks the narrative-heavy parts (What We Did, What We Learned, Year in Context, Mistakes & Lessons, Looking Ahead) as [TODO] for the user to write with chat assistance. Append-only — refuses to overwrite an already-populated quarter without --force. Use when the user asks "update the letter", "quarterly letter update", "finalize the letter", or "write the {Q1/Q2/Q3/Q4} entry". Requires clarion-setup to have been run.
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Living Letter
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion living-letter update

The annual investor letter is the system's self-accountability tool — a real-time, timestamped record of how the system thought, what it did, and what it learned. Per [`docs/PRINCIPLES.md` Principle 10 (Compound Knowledge, Not Just Capital)](../../docs/PRINCIPLES.md#10-compound-knowledge-not-just-capital), it's where the institutional memory accrues.

This skill scaffolds quarterly entries and the year-end finalization. The system fills in regime + thesis health automatically; the human writes the narrative.

## When to use

User says any of:
- "Update the letter."
- "Quarterly letter update."
- "Write the Q2 entry."
- "Finalize the {YEAR} letter."

Cadence:
- **Quarterly (minimum)** — at the end of each quarter, run `update`. The script writes the structured sections; the user fills the narrative.
- **Year-end** — after Q4 is filled in, run `finalize` to add the Year in Context intro and the Full Year Summary scaffold.

## Decision tree

1. **Pick the operation:**
   - `update` (default) — append the current quarter's section
   - `finalize` — year-end Year in Context + Full Year Summary
   - `status` — show what's already in the letter

2. **Run the script.**

   ```bash
   python /home/workspace/clarion-intelligence-system/skills/clarion-living-letter-update/scripts/letter.py update
   python ... letter.py update --quarter 2 --year 2026
   python ... letter.py finalize --year 2026
   python ... letter.py status --year 2026
   ```

   If the letter file doesn't exist for the requested year, the script creates the skeleton (placeholder quarters + section headers) before writing.

3. **For `update`:** the script:
   - Refuses to overwrite a populated quarter without `--force`
   - Pulls regime via the shared `clarion-regime-check` data path
   - Pulls active theses from `~/clarion/theses/` and renders the Thesis Health table + Portfolio Snapshot bucket positions
   - Leaves the narrative sections as `[TODO]`
   - Prints the path written and a checklist of TODOs the user must fill

4. **Walk the user through filling the [TODO] sections in order.** The most important to nail:
   - **What We Did** — be specific (named tickers, prices, reasoning **at the time**)
   - **What We Learned** — surprises, mistakes, patterns (per the format spec, this is the section that compounds in value over years)

5. **For `finalize`:** the script:
   - Refuses to finalize before all four quarters are populated (override with `--force`)
   - Scaffolds the Year in Context and Full Year Summary sections
   - Pre-populates the Theses: Final Scorecard with every thesis on file (active + closed)
   - Leaves performance numbers, mistakes & lessons, looking ahead as `[TODO]`

## How to run

```bash
LETTER=python /home/workspace/clarion-intelligence-system/skills/clarion-living-letter-update/scripts/letter.py

$LETTER update                          # current year, current quarter
$LETTER update --quarter 2              # current year, Q2 specifically
$LETTER update --year 2026 --quarter 3  # explicit year + quarter
$LETTER update --quarter 2 --force      # overwrite an already-populated Q2

$LETTER finalize                        # current year
$LETTER finalize --year 2026

$LETTER status                          # current year status
$LETTER status --year 2026
```

## Voice

The letter is **honest** and **specific**. Per the format spec rule #3:
> "Show the reasoning, not just the outcome. 'We bought X and it went up 30%' is useless. 'We bought X because the filing showed Y, the valuation was Z, and the regime was Green — it went up 30% but mostly for reasons we didn't anticipate' is how you actually learn."

Avoid PR voice. Include the bad with the good. The mistakes section is the most valuable.

When walking the user through TODOs, push back on vague language. "Performance was strong" → "Portfolio +12.4% vs S&P 500 +9.1% in Q2; ~80% of that came from NVDA's catalyst landing earlier than expected."

## Hard rules

1. **Never edit past quarters retroactively.** The whole point is a timestamped record. Hindsight commentary belongs in NEW sections in brackets — not as edits to old quarters. The script enforces this by refusing to overwrite populated quarters without `--force`.
2. **The narrative sections are human-written.** The system can fill regime, theses, and portfolio bucket *positions* — but never What We Did or What We Learned. Those have to come from the principal.
3. **Show the reasoning, not the outcome.** A quarterly entry that only chronicles wins is fiction.
4. **Keep it concise.** Each quarterly update should be readable in 5-10 minutes. Link to thesis files for depth rather than duplicating.

## On error

- **`LETTER_ERROR: quarter already populated`** — the requested quarter has structural content. Pass `--force` to overwrite (rare; usually means re-running for the same period).
- **`LETTER_ERROR: cannot finalize`** — at least one quarter is still placeholder. Fill in Q1-Q4 first, then finalize.
- **`LETTER_ERROR: unknown quarter`** — pass an integer 1-4 for `--quarter`.
