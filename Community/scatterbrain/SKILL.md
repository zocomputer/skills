---
name: scatterbrain
description: Gives Zo a deliberate case of ADHD for hard open-ended problems. Scatters N isolated child sessions across distorted cognitive frames (night dispatcher, salvage mechanic, paid saboteur, mycologist), then snaps into hyperfocus with a separate critic pass that scores, clusters, prunes traps, and deepens the survivors. Use on "scatterbrain", "give me a few ways to", brainstorm or ideate intents, naming, architecture, API surface, positioning, strategy, or fuzzy debugging with no known root cause. Skip for syntax, lookups, bugs with a known cause, or closed phrasing like "quick", "standard", "just".
compatibility: Created for Zo Computer
metadata:
  author: jeffkazzee.zo.computer
  inspired-by: https://github.com/UditAkhourii/adhd (MIT)
---

# Scatterbrain

The first three answers to any open question are the answers a competent
person gives in thirty seconds. Correct, safe, forgettable. The ideas worth
paying for live past number three, and a single line of thinking never
reaches them because it anchors on whatever it said first.

Scatterbrain is the architectural fix, not a prompting trick. It scatters
the problem across several child Zo sessions that run in parallel and never
see each other. Each one thinks under a deliberately distorted frame: a
night dispatcher, a salvage mechanic, a paid saboteur, a mycologist. No
shared context means no anchoring. Then a separate critic session, running
with the opposite instructions, scores everything, clusters it by angle,
flags the ideas that look good but aren't, and deepens the few worth
building.

Method lineage: this is a ground-up Zo rebuild of the divergent ideation
loop from [ADHD by Udit Akhouri](https://github.com/UditAkhourii/adhd),
MIT licensed. Same core insight, new engine, new frames, new prose.

## Gate: should this run at all?

A run costs roughly 8 to 11 child Zo sessions. That is real money and one
to three minutes of wall clock. Do not pay it for questions with one right
answer.

**Explicit invocation.** If the user said "scatterbrain", "scatter this",
"give Zo ADHD on this", or named the skill, skip the gate and run.

**Otherwise, three checks. Any no means abort and answer directly.**

1. Open-ended? Would a sharp person give several defensible answers, or is
   there a canonical one? Canonical means abort.
2. Worth it? Is the cost of the obvious answer being wrong actually high?
   Architecture, public API surface, naming something real, positioning,
   fuzzy bugs with no root cause: yes. A quick utility script: no.
3. Open phrasing? Words like "quick", "standard", "canonical", "just",
   "one-liner" mean the user wants the direct answer. Abort.

On abort, answer the question normally. Optionally add one line: run
`scatterbrain` on this if you want the wide version with trap detection.

## How to run it

### Preferred: the engine script

The script makes branch isolation mechanical instead of promised. Each
frame is its own /zo/ask session.

```bash
bun Skills/scatterbrain/scripts/scatterbrain.ts \
  "the problem, stated plainly" \
  --context "any constraints or background worth passing" \
  --frames 5 --ideas 6 --top 3 --mode build
```

(Adjust the path to wherever this skill lives. On Zo Computer the
convention is `/home/workspace/Skills/scatterbrain/`.)

Flags worth knowing:

- `--mode build` for code-shaped problems, `--mode open` for product,
  content, strategy, or life-ops problems. Controls frame selection bias.
- `--frames`, `--ideas`, `--top` scale cost to stakes. Small question:
  `--frames 3 --ideas 4 --top 2`. Big decision: defaults or higher.
- `--model` passes a model id to every child call. Pass the session's
  current model when known.
- `--no-reframe` skips the anchor-stripping pass when the problem statement
  is already clean.
- `--dry-run` stubs the API to test plumbing. Costs nothing.
- `--help` prints every flag with its default.

Output: in a terminal the script prints the human-readable render. When
piped (which is how an agent should run it) it prints JSON. Force either
with `--text` or `--json`. If you are an agent reading the JSON, render it
using the output shape below. Do not dump raw JSON at the user.

### Fallback: inline, only when the script can't run

If bun or the API is unavailable, simulate the scatter by writing each
frame's ideas in strictly separate passes, never letting one frame's output
inform another, then run the critic pass last. This is weaker than real
isolation. Say so in one line when you use it.

## The two-phase law

Scatter and hyperfocus never mix. The generator is forbidden to evaluate.
The critic is forbidden to invent. Mixing them is how every ordinary
brainstorm collapses back into the first plausible idea wearing five hats.

Phase order: reframe (strip incidental anchors, keep real constraints),
scatter (parallel isolated frames), critic (score on spark, legs, aim;
flag traps; cluster by angle), deepen (top survivors get a sketch, the
load-bearing risk, a first step, and child ideas).

Scoring axes, 0 to 10 each: **spark** is distance from the obvious
default, **legs** is whether it could actually run, **aim** is whether it
hits the stated problem. Weighted total: legs 0.40, spark 0.35, aim 0.25.
Legs is the gatekeeper because a brilliant unshippable idea is a trap with
good lighting.

## Output shape

Render in this order. The structure is half the value; do not melt it into
prose.

1. **Brief.** One or two lines: the problem, plus the reframe if one was
   applied.
2. **Wide set.** Every idea, grouped by cluster, each cluster labeled by
   its angle. Score chips like `[S7 L8 A9]` on each idea.
3. **Shortlist.** 2 to 4 picks with reasons. Mark the sleeper, the
   non-obvious pick with real legs, with a star. List traps separately,
   each with its one-line reason.
4. **Deepened.** For each of the top ideas: the sketch, the load-bearing
   risk, the first concrete step, the child ideas.
5. **Provocation.** One question that opens a new direction if nothing
   above landed.

## Anti-patterns

- Ten variations of one idea dressed as breadth. If every candidate shares
  an assumption, you decorated, you didn't diverge.
- A pile of absurdities with no convergence. Always land on a position.
- Refusing to commit. "Here are 20 ideas, you pick" is a cop-out. Converge
  with an opinion.
- Serializing the branches through one context. That is a wider single
  thought, not a scatter. The isolation is the method.
- Running this on everything. It is a decision-point tool, not a default.

## Frames

The full catalog with authoring guidance lives in
`references/frames.md`. Pick lineup changes run to run on purpose, so the
same problem scattered twice maps different territory.
