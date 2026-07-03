# Buffett Question Bank — single-stock-eval reference

The full Question Bank lives in [`docs/DESIGN-LANGUAGE.md`](../../../docs/DESIGN-LANGUAGE.md#the-buffett-question-bank) — load that for the complete set when the user asks what a dimension means or wants the full methodology.

This file holds the **synthesis template** for writing a Buffett-style evaluation after the script has produced its structured output.

---

## How the four lenses map to evaluation

The script's `eval.py` runs four lenses against the indexed filings:

- **Moat & competitive position** — *Business quality* questions from the Question Bank
- **Management & capital allocation** — *Management quality* questions
- **Financial trends** — *Valuation* and revenue / margin / FCF questions
- **Risk factors** — *Risk* questions

Each lens returns search hits with citations. Use the Question Bank in `docs/DESIGN-LANGUAGE.md` to interrogate the snippets.

---

## Synthesis template

After running the four lenses, write a brief that answers:

1. **What I believe** — one paragraph, plain English.
2. **Why I believe it** — numbered evidence drawn from filings. Cite each (the script's `citation` lines are canonical).
3. **What it's worth** — bear / base / bull scenarios with rough numbers (margin range × revenue range × multiple range, then sanity-check against current price).
4. **What changes my mind** — kill conditions: specific, measurable, falsifiable.
5. **Why now** — the catalyst, or the patience case for waiting.

End with one of three verdicts: **Add** / **Watchlist** / **Skip**.

A good evaluation is concise — under 800 words is plenty. If you need more, the thesis isn't clear enough yet.

---

## Anti-patterns to avoid

From [`docs/DESIGN-LANGUAGE.md#anti-patterns`](../../../docs/DESIGN-LANGUAGE.md#anti-patterns-what-the-system-never-does):

- Never present a recommendation without showing the alternative ("Buy X" is incomplete; "Buy X versus holding T-bills" is a decision)
- Never use relative language without an anchor ("cheap" means nothing without context)
- Never bury the conclusion (verdict goes early, evidence follows)
- Never ignore the base rate (what *usually* happens in this situation?)
- Never conflate precision with accuracy (use ranges, not false-precision point estimates)
- Never recommend without sizing (a great idea at the wrong size is a bad idea)
