# Living writing-quality gate

This gate catches generic, over-smoothed, or untrustworthy prose before publication. It does not define one universal voice. The creator profile owns voice-specific rules.

## Before drafting

- Name the author, audience, platform, purpose, and source of truth.
- Pull two or three recent approved samples from the actual author when available.
- Decide what the reader should understand, feel, or do after one pass.

## Human writing test

1. Truth: every claim, story, number, and result is sourced or clearly qualified.
2. Specificity: replace abstract praise with a concrete detail, choice, cost, or consequence.
3. Point of view: the piece makes a real judgment instead of balancing every side into mush.
4. Rhythm: sentence and paragraph lengths vary naturally. The prose survives reading aloud.
5. Friction: remove canned setup, fake suspense, empty transitions, summary repetition, and ornamental conclusions.
6. Voice: the author could plausibly say every line. Preserve their vocabulary, contractions, humor, intensity, and restraint.
7. Platform: the hook, container, pacing, and call to action belong on the target surface.
8. Restraint: do not use decorative headings, forced three-part lists, needless bolding, or audience flattery as a substitute for substance.
9. Attribution: borrowed ideas are credited, and creator mechanics do not become creator imitation.

## Common synthetic tells

Treat these as prompts to inspect, not forbidden strings:

- generic openings such as "in today's fast-paced world";
- repeated "not just X, but Y" constructions;
- vague authority claims such as "experts agree";
- excessive symmetry, stacked triads, and identical paragraph lengths;
- fake quotations, invented personal experience, and unsupported numbers;
- transition words carrying the argument instead of evidence;
- an inspirational ending that merely repeats the introduction;
- constant hedging or breathless certainty;
- vocabulary the named author never uses.

## Detector panel

Read `detector_mode` from the creator profile.

- `off`: do not run a detector.
- `requested`: run the panel only when the author asks.
- `panel`: run the panel for outward-facing prose whenever detector access exists. If access does not exist, mark it `not run` instead of pretending.

Use two independent, currently accessible detector services when practical. Record the service name, URL or version, date, input identifier or hash, score or label, and highlighted passages in `references/research/detector-runs.md` or a private equivalent. Do not commit private draft text to a public ledger.

A score alone never triggers a rewrite. Map each highlight to a real defect in the human writing test, revise only those defects, rerun once, and stop after at most two detector-led passes. Truth, clarity, rhythm, and authentic voice outrank every score.

## Creator-specific rules

Load the creator profile for hard constraints. A profile may ban punctuation, phrases, tones, or formatting. These rules override generic stylistic advice.
