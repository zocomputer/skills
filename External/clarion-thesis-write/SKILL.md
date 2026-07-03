---
name: clarion-thesis-write
description: Scaffold a new thesis document for a ticker in the canonical Clarion thesis format. Pre-fills the YAML metadata block, opens the History with an OPENED entry, and (when filings are indexed) seeds the "Why I Believe It" evidence section with draft citations from the Buffett-lens search. The user fills in the actual prose. Outputs a markdown file at ~/clarion/theses/{TICKER}.md. Use when the user says "write a thesis on <TICKER>", "scaffold a thesis for <TICKER>", "draft a thesis for <TICKER>", or after clarion-single-stock-eval returns an Add verdict and the user wants to formalize the position. Requires clarion-setup to have been run.
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Thesis Write
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion thesis write

Scaffolds a new thesis in the canonical [`docs/`](../../docs)-defined format. The script generates the structure with metadata + draft citations; the user (with your help) fills in the prose.

## When to use

User says any of:
- "Write a thesis on NVDA."
- "Scaffold a thesis for AAPL."
- "Draft the thesis for KO."
- After `clarion-single-stock-eval` returns an **Add** verdict.

## Decision tree

1. **Confirm the inputs.** Ask the user (or default) for:
   - **Ticker** (required)
   - **Bucket**: `value` (default), `systematic`, `short`, or `yolo` — see [`docs/ALLOCATION-POLICY.md`](../../docs/ALLOCATION-POLICY.md) for what each means
   - **Opened**: today's date by default, or a backfilled date if the user is documenting an existing position

2. **Verify the ticker has indexed SEC filings.** If not, suggest running `clarion-sec-research index <TICKER>` first and waiting 1–5 minutes — without indexed filings, the evidence section won't be seeded with citations and the user will have to gather them manually.

3. **Run `write.py`** with the ticker and bucket:

   ```bash
   python /home/workspace/clarion-intelligence-system/skills/clarion-thesis-write/scripts/write.py NVDA --bucket value
   ```

   The script will:
   - Refuse to overwrite an existing thesis file unless `--force` is passed
   - Pull fundamentals from yfinance for the metadata block
   - Pull Buffett-lens snippets from indexed filings for the evidence section
   - Render the canonical template to `~/clarion/theses/{TICKER}.md`
   - Print the path written + a short list of "TODO" sections the user must fill in

4. **Walk the user through the TODO sections in order.** The most important to get right early:
   - **What I Believe** — the core insight, 1-3 paragraphs
   - **Why I Believe It** — numbered evidence, each citing a filing or data source
   - **What's It Worth** — bear/base/bull scenarios with rough numbers
   - **Why Now** — catalyst or patience rationale
   - **Kill Conditions** — specific, measurable, falsifiable

   Reference [`docs/PRINCIPLES.md` Principle 2 (Thesis-First)](../../docs/PRINCIPLES.md#2-thesis-first-always) and [`docs/DESIGN-LANGUAGE.md` Anti-patterns](../../docs/DESIGN-LANGUAGE.md#anti-patterns-what-the-system-never-does) when guiding the user.

5. **Promote `status: draft` → `status: active`.** Scaffolded theses ship at `status: draft` so `clarion-thesis-monitor` skips them while they're still being written. Once the prose is in (especially Kill Conditions, which are load-bearing), update the metadata block: `status: draft` → `status: active`. Until that flip, the thesis is invisible to the monitor.

6. **After promoting to active,** suggest running `clarion-thesis-monitor --ticker <TICKER>` to compute the initial health score.

## How to run

```bash
WRITE=python /home/workspace/clarion-intelligence-system/skills/clarion-thesis-write/scripts/write.py

$WRITE NVDA                          # value bucket, opened today
$WRITE NVDA --bucket yolo            # YOLO bucket
$WRITE NVDA --opened 2024-08-01      # backfill an existing position
$WRITE NVDA --force                  # overwrite an existing file
$WRITE NVDA --no-lens                # skip the secrag lens pre-population
```

## Voice

After scaffolding, switch into co-author mode. Help the user write specific, measurable, sourced prose. Cite every claim drawn from filings (the script's seeded citations are canonical). Show the math in the valuation table. Use the [Buffett Question Bank](../../docs/DESIGN-LANGUAGE.md#the-buffett-question-bank) to interrogate weak sections.

The thesis should be **conversational and direct** — the style described in [`docs/DESIGN-LANGUAGE.md`](../../docs/DESIGN-LANGUAGE.md). Vague claims ("strong moat," "good management") are flags to push back on.

## On error

- **`THESIS_WRITE_ERROR: file already exists`** — pass `--force` to overwrite, or pick a different filename.
- **`THESIS_WRITE_ERROR: failed to fetch fundamentals`** — yfinance hiccup. Retry, or pass `--no-fundamentals` to skip the snapshot pre-fill.
- **`THESIS_WRITE_ERROR: ticker not indexed`** — only when `--require-indexed` is set. Run `clarion-sec-research index <TICKER>` first.
