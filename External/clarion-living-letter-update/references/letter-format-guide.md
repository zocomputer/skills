# Letter format guide

Source: [`docs/PRINCIPLES.md` Principle 10](../../../docs/PRINCIPLES.md#10-compound-knowledge-not-just-capital) and the AWB `LIVING-LETTER-FORMAT.md`.

This file is a quick-reference for filling in the [TODO] sections after the script writes the scaffold.

## File location

`~/clarion/letters/{YEAR}-letter.md` — one file per calendar year.

## Quarterly section structure (filled in throughout the year)

```
## Q{N}: {months}

**Updated: {YYYY-MM-DD}**

### Regime & Environment           ← system-filled (regime + rationale)
### Portfolio Snapshot             ← system-filled positions, manual weights
### What We Did                    ← human, narrative
### Thesis Health                  ← system-filled (thesis archive)
### What We Learned                ← human, narrative
### Performance                    ← human-supplied numbers
```

## Year-end sections (added by `finalize`)

```
## Year in Context                 ← human, opening narrative
## Full Year Summary
  ### Performance                  ← human (multi-benchmark table)
  ### By Bucket                    ← human (per-bucket attribution)
  ### Mistakes & Lessons           ← human, ranked-by-impact
  ### Theses: Final Scorecard      ← system-filled list, human outcomes
  ### Looking Ahead                ← human, observations not predictions
```

## Voice rules (from the format spec)

1. **Never edit past quarters retroactively.** Hindsight goes in NEW sections in brackets, not edits.
2. **Include the bad with the good.** Mistakes section is the most valuable.
3. **Show the reasoning, not the outcome.**
   - Bad: "We bought X and it went up 30%."
   - Good: "We bought X at $42 because the 10-K showed Y, valuation was 12x trailing earnings, regime was Green. It went up 30% — mostly from a macro tailwind we didn't anticipate, not the catalyst we expected. The thesis was right but for the wrong reason."
4. **Keep each quarterly section to 5-10 minutes of reading.** Link to the thesis file for depth.
5. **The finalized year-end letter can be shared.** Aim for self-contained.

## What goes in "What We Learned"

This is the section that compounds in value over years. Look for:

- **Surprises** — what you didn't expect to happen
- **Mistakes** — wrong inputs, wrong reasoning, wrong sizing, wrong patience
- **Patterns** — multi-quarter or multi-position observations the system didn't have a model for yet
- **Process changes** — what you'd do differently next time

Don't write generic lessons. "Be patient" isn't a lesson; "I bought ADBE 4 weeks before earnings expecting the AI hype to resolve, and it took 6 months — next time I'll widen catalyst windows on hype-driven names" is a lesson.

## What "Looking Ahead" is NOT

It's not predictions. It's not "I think rates will fall." It's:

- Observations about the current environment
- The opportunity set the system is watching
- The places risk seems concentrated
- The asymmetry the system might be willing to underwrite

Per the format spec: *"What regimes might we be entering? Where is the risk? Where is the asymmetry?"*
