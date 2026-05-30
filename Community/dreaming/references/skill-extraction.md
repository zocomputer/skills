# Skill Extraction

How to spot a workflow worth promoting to a Skill, and how to scaffold the SKILL.md.

## The Three-Strike Rule

A workflow earns a Skill when it has been done **three times the same way**. Not the first time. Not the second time. The third time.

- First time = exploration. Don't generalize from one example.
- Second time = coincidence. Watch it.
- Third time = pattern. Promote it.

This rule alone prevents Skills folders full of speculative scaffolding that no agent ever invokes.

## How To Detect Repetition

Scan the last 30 days of memory files (`memory/YYYY-MM-DD.md` or equivalent) for sequences that share at least three of:

- Same starting trigger (e.g. "user asks for a campaign brief")
- Same intermediate steps (in roughly the same order)
- Same output shape (a file, a report, a decision, a handoff)

Don't require exact word matches. The shape is what counts. If the user has run "research → outline → draft → brand voice review → schedule" three times, that's a pattern even if the topic differed.

## What To Capture In The Skeleton

A SKILL.md only needs:

- `name` — slug, lowercase, dash-separated
- `description` — one line that tells Zo when to load this skill (Zo's progressive loading reads this first)
- A short body with **When to use**, **Steps**, **Output**, and **Boundaries**

Aim for 90% signal, 10% readability. No filler.

## Scope: Project Or Global?

Default to project-scoped. A skill should only be promoted to global if:

- More than one project has used it
- Its behavior doesn't depend on a specific project's files
- It's at no risk of being misused by the wrong agent in the wrong workspace

When in doubt, project-scope it. You can always promote later. You can rarely demote without confusion.

## Mirror Rule

Once a skill exists, the Skill is the source of truth. Prompts and memory files should mirror the skill, not duplicate it. If a workflow rule appears in three places (skill + prompt + memory), it will drift. Centralize.

## After A Skill Is Created

- Test it on the next real instance of the workflow it captures
- If it fails or feels wrong, edit the skill, don't work around it
- If a fourth occurrence of the underlying workflow doesn't trigger the skill, the skill's `description` is wrong — fix the description first

## Promotion Loop

If a skill repeatedly proves useful across multiple Zo projects:

1. Document why it's worth promoting (in a workspace-level memory file)
2. If the skill currently lives in a project-specific location, move it to the top-level `Skills/<skill>/` directory in your Zo computer
3. Update its description to reflect cross-project applicability — Zo's progressive loading reads the description first, so it's the only thing that decides whether the skill fires

## Skill Demotion / Deletion

A skill should be retired when:

- It hasn't been invoked in 60+ days
- The workflow it captured is no longer how you do the work
- A newer skill subsumes it

Demotion goes: global → project-scoped → archived → deleted. Don't skip steps. Each demotion is a chance to confirm the skill is really dead.
