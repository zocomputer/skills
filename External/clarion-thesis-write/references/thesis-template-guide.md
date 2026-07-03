# Thesis template guide

Source: the canonical thesis structure is fixed by [`lib/ai_buffett_zo/theses/`](../../../lib/ai_buffett_zo/theses) and [`docs/PRINCIPLES.md` Principle 2](../../../docs/PRINCIPLES.md#2-thesis-first-always). This file is a quick-reference for filling in the scaffold the script produces.

## Sections in order

| # | Section | What goes here |
|---|---|---|
| 1 | Metadata (YAML block) | Pre-filled by the script. The user adjusts `cost_basis`, `shares`, `portfolio_weight` after position is taken. `health_score` is set by `clarion-thesis-monitor`. |
| 2 | Core Thesis → What I Believe | 1-3 paragraphs. The core insight the market is missing or underweighting. **Specific.** "This is cheap" is not a thesis. |
| 3 | Core Thesis → Why I Believe It | Numbered evidence. Each item cites a filing, data point, or verified external source. The script seeds candidates from the indexed-filing lens. |
| 4 | Core Thesis → What's It Worth | Bear/Base/Bull scenarios. Show the math. Use ranges, not false-precision point estimates. |
| 5 | Core Thesis → Why Now | The catalyst, or the patience rationale. Be explicit. |
| 6 | Kill Conditions | Specific, measurable, falsifiable. Each row: condition + how to monitor + last checked. |
| 7 | Health Scoring | Six components, weights summing to 100. The Overall row equals the metadata's `health_score`. Set on first monitor run. |
| 8 | Position Management | Sizing rules, entry/exit levels, options strategy if any. |
| 9 | Monitoring Schedule | Default cadence; adjust if the position warrants tighter monitoring. |
| 10 | History | Append-only event log. The script seeds with an OPENED entry. |
| 11 | Notes | Free-form observations, dated. |

## Anti-patterns to avoid

From [`docs/DESIGN-LANGUAGE.md`](../../../docs/DESIGN-LANGUAGE.md#anti-patterns-what-the-system-never-does):

- **Never use relative language without an anchor.** "Cheap" → "trades at 12x owner earnings, vs 18x 10-year median."
- **Never bury the conclusion.** The thesis appears in the first paragraph of "What I Believe."
- **Never ignore the base rate.** Before "this time is different," present what usually happens in this situation.
- **Never conflate precision with accuracy.** A DCF that says fair value is $147.32 is precise but not accurate. Use ranges.
- **Never recommend without sizing.** A great idea at the wrong size is a bad idea.

## Kill condition examples

Strong (specific, measurable, falsifiable):
- `Operating margin falls below 25% in any quarter`
- `Top 3 customers exceed 50% of revenue`
- `CEO departure (8-K filing)`
- `Long-term debt / EBITDA exceeds 3.0`
- `Stock above 3x tangible book value` (for shorts)

Weak (avoid):
- `Business gets worse` — not measurable
- `Sentiment turns bearish` — not falsifiable; sentiment is always mixed
- `If I lose conviction` — circular
