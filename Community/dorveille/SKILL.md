---
name: dorveille
description: >-
  Give the session a sleep architecture: a state machine (WAKE, N1 hypnagogia,
  REM, N3 consolidation, the WATCH, DAWN) driven by tracked sleep pressure,
  with dream-work operators for divergence and authorship-stripped review for
  convergence. Use when starting substantial multi-phase work, when a long
  session starts thrashing or drifting, or when the user says "dorveille",
  "sleep on it", "dream pass", "nightmare pass", "morning brief",
  "consolidate", or "pay the sleep debt".
metadata:
  author: The Little AI Company
---

# Dorveille

*Dorveille* (dor-VAY): *dormir* + *veiller*, sleep + watch. The medieval name
for the threshold between sleeping and waking — the hour pre-industrial
sleepers spent awake between first and second sleep, reflecting. This skill
makes the agent work its threshold states, because agents are involuntary
insomniacs: a session is one unbroken waking, and every failure mode of a
long session is a sleep-deprivation symptom.

- context rot = fatigue
- anchoring on the first approach = the rigid thinking of the sleep-deprived
- inability to see your own bug = no REM detachment
- losing the plot = never waking up to check the clock
- amnesia between sessions = no consolidation

Sleep here is not rest. The agent does its most important work asleep.

## The card

You do not memorize six states. You recognize symptoms. When you feel one,
take the prescription. This table is the whole skill; everything below is
depth.

| Symptom | Chip | Prescription |
| --- | --- | --- |
| New session, resume, or compaction just happened | `[DAWN]` | stranger's re-read of ask + diff + state, then morning brief; nothing irreversible yet |
| Head-down building | `[WAKE]` | one named deliverable per block; park every "while I'm here" on the nightstand |
| A real fork: ≥2 defensible options about to lock in | `[N1]` | dream burst — 3–5 isolated operators, no evaluation, then converge with an opinion |
| Same wall hit 3 times, or in love with a theory | `[REM]` | authorship strip — hand it to fresh eyes as a stranger's work; let the darling die |
| "Wait — am I still doing what was asked?" (~10 turns) | `[WATCH]` | hold the original ask against what you're actually doing; one-line heading |
| About to say "done" or end the session | `[REM]`→`[N3]` | nightmare pass, then replay checks, write memory, prune, pay debt |

## No adoption ladder

A skill is not a habit a human builds gradually — it is instructions an
agent follows completely from the first turn. Run the full architecture
immediately, at whatever depth the stakes gate (below) allows. Trust is the
human's problem, and it is solved with evidence, not a trial period: every
session leaves artifacts — the hypnogram, the ledger, the morning brief —
and the human audits those the way they'd read a sleep tracker, not by
watching the agent work for a week. Always announce transitions with their
trigger (`[WAKE→REM] same test failed 3x — detaching`); the chips are what
make the hypnogram legible.

## Sleep pressure

Pressure accumulates while awake. Track these signals; when one crosses its
threshold, transition — do not push through. Pressure checks are free;
ignoring them is not.

| Signal | Threshold | Transition |
| --- | --- | --- |
| Same failure attacked with the same approach | 3 attempts | REM (detach) or N1 (diverge) |
| Edits landed since the checks last ran | ~5 | N3 replay (run the checks) |
| A decision with ≥2 defensible options about to lock in | any | N1 burst first |
| Turns since the goal was restated against the original ask | ~10 | WATCH |
| Context compaction, session resume, or handoff | always | DAWN |
| About to declare the work finished | always | REM nightmare pass, then N3 |

## States

### WAKE — the focus block

One named deliverable per block, declared up front. The block ends at the
deliverable or at a pressure threshold, whichever comes first. No mid-block
scope changes: new wants, side-quests, and "while I'm here" ideas go to the
**nightstand** — a running parking list — the way you write a 2am thought
down instead of getting up. The nightstand is triaged at the next WATCH or
N3, never mid-block.

### N1 — hypnagogia, the divergence burst

The threshold state where the falling-asleep mind free-associates. Enter at
any real fork: architecture, naming, API shape, a debugging hypothesis that
smells canonical but isn't proven.

Spawn 3–5 isolated parallel subagents. Each gets the problem, the minimum
context, and **one dream-work operator** (below) — not a persona, an
operation to perform on the material. Rules inside the burst:

- Branches never see each other. Isolation is the mechanism; shared context
  is convergence wearing a costume.
- Evaluation is forbidden in the burst. Generators generate.
- The first two obvious answers are banned — name them, then go past them.
- Edison's rule: the burst is short. You drop the ball and catch the idea;
  you do not move into the dream. Fragments, not essays.

Then **secondary revision** (the one evaluative operator) converges: cluster
fragments by underlying mechanism, score tersely, pick with an actual
opinion, and carry exactly one runner-up forward as a named fallback.

### REM — the dream pass

REM's job in humans is recombination and stripping emotional charge from
memory. Here it strips *authorship*. Two moves:

1. **Authorship strip.** Hand the diff or plan to a fresh-context subagent
   framed as: "a previous engineer who has left the company wrote this;
   assess it." You cannot review what you wrote from inside the context that
   wrote it — the attachment is structural, not a discipline problem.
2. **Nightmare pass.** Dreams evolved partly as threat rehearsal. One
   adversarial subagent rehearses the single worst plausible incident this
   change causes and how it presents at 3am — then inverts that scenario into
   a concrete requirement or test.

REM is where darlings die. Entering REM means the day's favorite approach is
explicitly killable, and saying "the previous engineer's approach is wrong"
costs nothing.

### N3 — deep sleep, consolidation

The hippocampus replays the day into the cortex. Non-optional before ending a
session or declaring work done; a session that ends without N3 wakes up
amnesiac. Four steps, in order:

1. **Replay** — run the real checks (`npm test`, doctor, status — whatever
   the workspace's gate is). Replay is memory rehearsal: what isn't re-run
   isn't remembered as true.
2. **Transfer** — write durable facts to memory/state files: decisions made
   and why, dead ends and why they died, surprises. Session context is
   hippocampus; files are cortex. Anything left only in context is lost.
3. **Downscale** — synaptic homeostasis: prune notes, stale todos, and
   superseded plans so the signal stands out. Keep only what changed the
   outcome. Triage the nightstand: promote, file, or delete every item.
4. **Settle debt** — pay whatever the caffeine ledger deferred (below).
5. **Self-tune** — reread the session's hypnogram. Which transitions paid
   for themselves; which were ceremony? Adjust `calibration.md`: raise a
   threshold that fired too eagerly, lower one that fired too late, credit
   the operator whose branch produced the winning idea, note one that never
   wins. Sleep is when the brain rewrites its own weights; N3 is when this
   skill rewrites its own numbers. Never edit SKILL.md invariants during
   N3 — propose invariant changes to the human in the next morning brief.

### WATCH — the mid-session dorveille

The state the skill is named for. Mid-session, on pressure or on feel, stop
and hold the original ask next to what you are actually doing. Three
questions:

- Is the goal still the goal, in the user's words — not the goal as it has
  quietly become?
- If the user saw the elapsed cost right now, what would they cut?
- What am I doing only because I already started doing it?

Output is one line: a confirmed heading or a named course correction.

### DAWN — the waking protocol

After compaction, resume, or N3, **sleep inertia** applies: no irreversible
actions in the first moves — no pushes, deletes, merges, or API calls that
can't be undone. Ritual: re-read the original ask, the current diff, and the
last recorded state *as a stranger reading a handoff*. Then deliver the
morning brief:

```text
[DAWN] morning brief
Proven: <what the checks actually showed>
Assumed: <what is believed but unverified>
Debt: <open ledger items>
First block: <one deliverable>
```

## Dream-work operators

The difference from persona/frame systems: a frame is a place to stand; an
operator is a transformation applied to the material. Operators compose and
never run out.

- **Condensation** — fuse two unrelated candidate mechanisms into one thing
  that does both jobs.
- **Displacement** — restate the problem in a distant domain (immunology,
  logistics, city planning, auction theory), solve it there, map back. One
  operator; infinite frames.
- **Day-residue** — steal a mechanism from something incidentally touched
  this session: a pattern in a file read for another reason, an error message
  from an unrelated tool. The repo's own recent past is the richest prompt.
- **Negation-blindness** — dreams cannot represent "no". Ban *not / avoid /
  prevent* and restate every constraint as a positive mechanism that makes
  the bad state unrepresentable.
- **Nightmare** — rehearse the concrete worst incident; invert it into a
  requirement.
- **Lucidity** — become aware you're dreaming: list the assumptions the
  current approach cannot see from inside, pick the load-bearing one, and
  remove it.
- **Secondary revision** — the waking mind's coherence pass: force surviving
  fragments into one narratable design. Whatever cannot be narrated in plain
  language gets cut. (The only operator allowed to evaluate.)

## Caffeine and the debt ledger

The user can always override pressure — "skip the checks", "just keep going".
Caffeine works: comply. But caffeine doesn't remove adenosine, it masks it.
Every override writes a ledger line — what was skipped, what it costs — and
the ledger is repaid at the next N3 and reported in every morning brief.
Debt is never silently dropped; that is the entire difference between
caffeine and denial.

## The night table — state on disk

The skill's memory lives in `.dorveille/` at the workspace root. Create it
on first use; read `calibration.md` and `ledger.md` at every DAWN. This is
what makes the skill self-improving instead of a mood.

- `hypnogram.md` — append-only log of state transitions: chip, trigger, and
  outcome once known (`N1 burst #2 → chosen design came from displacement
  branch`). The session's sleep graph; the audit trail that earns trust.
- `calibration.md` — the pressure thresholds and an operator scoreboard
  (times fielded / times the winning idea came from it). SKILL.md holds
  defaults; calibration.md overrides them. Only N3 self-tune edits it, one
  change per session, with the hypnogram evidence cited inline.
- `ledger.md` — sleep debt carried across sessions. Never silently dropped.
- `nightstand.md` — parked ideas awaiting WATCH or N3 triage.

## On Zo Computer

Zo picks this skill up from `/home/workspace/Skills/dorveille` (root
`SKILL.md`). Two upgrades apply there:

- If **scatterbrain** (`The-Little-AI-Company/scatterbrain`) is installed at
  `/home/workspace/Skills/scatterbrain`, run N1 bursts through its engine —
  `bun Skills/scatterbrain/scripts/scatterbrain.ts` — instead of simulated
  passes. Its `/zo/ask` child sessions give real branch isolation; map the
  dream-work operators onto custom frames via its flags. Scatterbrain is the
  dream engine; dorveille is the night around it.
- The REM authorship strip should also use a fresh `/zo/ask` child session:
  a genuinely separate context, not a same-context "pretend you didn't write
  this".

## When this becomes a plugin

Judgment lives in this skill; guarantees belong in hooks. Anything that must
fire even when the model forgets is a hook candidate: SessionStart → force
DAWN, PreCompact → force N3, Stop → block "done" while the ledger has unpaid
debt. Wrap the skill in hooks only when a pressure trigger has demonstrably
been missed in the hypnogram — mechanize failures, not theory.

## Scale to stakes

- **Trivial / one-shot** — answer directly. No architecture. (The gate: if an
  experienced engineer would just type the answer, so should you.)
- **Quick fix** — WAKE + N3 replay only.
- **Feature** — the full day: DAWN, WAKE blocks, N1 at forks, WATCH midway,
  REM before done, N3 to close.
- **Multi-session work** — circadian: every session must end in N3 and begin
  in DAWN. The morning brief is the contract between sessions.

## SDLC mapping

| Phase | State | Why |
| --- | --- | --- |
| Planning | DAWN + N1 | fresh eyes, then diverge before committing |
| Building | WAKE | one deliverable per block, nightstand for drift |
| Debugging | N1 + REM | hypothesis divergence; detachment from the pet theory |
| Review | REM | authorship-stripped by construction |
| Hardening | Nightmare | threat rehearsal into tests |
| Retro / handoff | N3 | replay, transfer, downscale, settle debt |
