---
name: tree-ring-memory
description: >
  Lifecycle-aware local memory for AI agents. Use when an agent needs durable
  recall, project decisions, user preferences, warnings, evidence, privacy-safe
  memory capture, audit, forgetting, or consolidation.
compatibility: Any machine with the Tree Ring Memory CLI or access to a project that has .tree-ring initialized
metadata:
  author: TerminallyLazy
  category: Community
---

# Tree Ring Memory

Tree Ring Memory is a local-first memory framework for AI agents. It treats
memory as lifecycle-managed knowledge instead of a transcript dump:

- fresh work stays detailed
- older learning compresses into stable rings
- important warnings remain visible as scars
- durable truths become heartwood
- speculative follow-ups stay as seeds
- sensitive material is blocked, redacted, or kept out by default

Use it when durable recall would prevent repeated mistakes, preserve project
decisions, or carry user preferences across sessions.

## Setup

Install with Homebrew:

```bash
brew tap TerminallyLazy/tree-ring
brew install tree-ring
```

Or build from source:

```bash
git clone https://github.com/TerminallyLazy/Tree-Ring-Memory.git
cd Tree-Ring-Memory
cargo build --release -p tree-ring-memory-cli
```

Initialize memory in a project when needed:

```bash
tree-ring init
tree-ring --help
```

Tree Ring Memory does not require an API key or cloud account. Project memory
lives locally under `.tree-ring` unless the user deliberately configures another
root.

## When To Recall

Recall memory before:

- starting or resuming a project
- changing architecture, storage, security, privacy, or release behavior
- repeating a workflow where prior failures may matter
- responding to a user correction
- making a decision that depends on previous preferences or constraints
- editing a repository that has a Tree Ring Memory or `AGENTS.md` contract

Use narrow queries with project scope when possible. Prefer source-linked,
high-confidence, non-superseded results.

```bash
tree-ring recall "release checklist" --json
tree-ring recall "user preferences for this repo" --json
tree-ring audit --json
```

If the project provides `.tree-ring/CLI.md`, read it before issuing commands so
flags match the installed version and project root.

## When To Remember

Store memory when the information is likely to help future work:

- the user states a durable preference
- the user corrects the agent
- a decision should survive the current session
- a tested implementation lesson should be reused
- a failed approach should not be repeated
- a security, privacy, release, or data-loss warning appears
- a future idea should be revisited later

Keep each memory concise. Store the lesson, decision, or warning, not the full
conversation.

```bash
tree-ring remember \
  --ring outer \
  --type decision \
  --scope project \
  "Use local .tree-ring storage for project-specific agent memory."

tree-ring remember \
  --ring scar \
  --type warning \
  --scope project \
  "Do not store secrets, credentials, raw transcripts, or private identifiers in durable memory."
```

Use JSON output when another tool or agent will consume the result:

```bash
tree-ring remember --ring outer --type lesson --scope project --json "Validated install path with isolated HOME."
```

## Evidence And Integrations

Use evidence records when the lesson comes from a checkpoint, experiment,
evaluation, branch, incident, PR, issue, or reviewed run artifact:

```bash
tree-ring evidence --help
```

Use source adapters when project artifacts already contain structured guidance
or evaluated outcomes:

```bash
tree-ring dox sync --source-root . --dry-run
tree-ring revolve sync --source-root revolve --dry-run
tree-ring integrations scan --source-root .
```

Run adapter commands with `--dry-run` first. Sync only concise, source-linked
summaries. Do not treat imported memory as more authoritative than the source
`AGENTS.md`, Revolve record, evaluation, PR, issue, or test artifact.

## Rings

Use these rings deliberately:

- `cambium`: active or recent task context
- `outer`: recent decisions and task lessons
- `inner`: older compressed project knowledge
- `heartwood`: durable, high-confidence truths and user preferences
- `scar`: important negative memory, failures, regressions, rejected approaches, and warnings
- `seed`: unresolved ideas, hypotheses, follow-ups, and future work

Do not promote to `heartwood` from weak evidence. Prefer `outer` or `seed`
unless the user confirms durability or the evidence is strong.

## Privacy Rules

Do not store:

- secrets
- credentials
- tokens
- private keys
- raw chain-of-thought
- temporary scratchpad notes
- unverified claims as durable truth
- private health, financial, legal, or personal identifier details without explicit user instruction
- copyrighted source text beyond short allowed snippets

If useful memory contains sensitive material, store a redacted summary with
enough context to be useful.

## Forgetting And Correction

If memory is wrong, private, stale, or superseded:

- redact it when the durable shape is useful but details are unsafe
- delete it when it should not be retained
- supersede it when a newer decision replaces it
- include an explicit reason for every forget operation

```bash
tree-ring forget --help
tree-ring consolidate --help
tree-ring audit --json
```

Never keep known-wrong memory merely because it was previously recalled.

## Closeout Habit

At the end of meaningful work, ask:

- What did we decide?
- What did we learn?
- What should future agents avoid repeating?
- Did the user state a durable preference?
- Is there a future seed worth revisiting?
- Is any memory sensitive and better left unstored?

Only remember answers that will materially improve future work.
