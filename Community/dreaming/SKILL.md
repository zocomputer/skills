---
name: dreaming
description: |
  Background pattern-finding for a Zo Computer workspace, modeled on Anthropic's Dreaming feature for Claude Managed Agents (released 2026-05-06). Runs between sessions, reviews recent activity across projects plus Files, Skills, Personas, Rules, Automations, and hosted Sites, and surfaces cross-project bleed, drifted Rules, unused Skills, and other patterns the agent can't see in any single session. Asks the user before any destructive action. Triggers on "run dreaming", "let zo dream", "dream over my workspace", "consolidate the workspace", "what's drifting", or on a scheduled Automation.
compatibility: Created for Zo Computer
metadata:
  author: jeffkazzee.zo.computer
  category: Workspace
---
# Dreaming

Background workspace consolidation for Zo. Borrowed from Anthropic's Dreaming feature for Claude Managed Agents — same four-phase pattern (Orient → Gather Signal → Consolidate → Surface), tailored for Zo's surfaces (Files, Skills, Personas, Rules, Automations, hosted Sites and Services).

Dreaming is reflective, not reactive. It's not an audit that finds stale files. It reviews what actually happened across recent sessions and projects, finds patterns no in-session agent could spot (cross-project bleed, drifted Rules, recurring user corrections, visual style sticking across sites that should look distinct), and proposes refinements to the workspace itself.

The skill never modifies anything destructively without user confirmation. It surfaces; the user decides.

## Usage

Install the skill and the agent picks it up on any matching prompt (`let zo dream`, `run dreaming`, `dream over my workspace`, `consolidate the workspace`, `what's drifting`). Run it manually for a deep interactive pass, or schedule it as a Zo Automation (recipes below in `## Two-mode recipes for Zo Automations`). Reports are written to `dream-reports/YYYY-MM-DD-dream.md` at the workspace root; create that directory the first time you run the skill. Companion skills `dreaming-operations-review` and `Chief Systems Officer` persona are optional.

## When to run

- **Daily light dream** — scheduled Automation, \~5 minute pass, writes a dream report only. Default for background runs.
- **Weekly deep dream** — scheduled or on-demand, walks the user through findings interactively. Asks per item before any move, archive, or delete.
- **On-demand** — when the user says "let zo dream" or "dream over my workspace", run the deep dream interactively.
- **Executive operations review** — when Jeff asks for self-improvement, workspace critique, operating-system review, or "what's drifting," use the `Chief Systems Officer` persona and pair this skill with `dreaming-operations-review`.

## The four phases

### 1. Orient

Read the current shape of the workspace before assuming anything is missing or stale:

- Top-level project folders inside `Files/`
- The `Skills/` folder (which Skills exist, when each was last edited)
- The active Personas, Rules, and Automations
- Hosted Sites and Services
- Any prior dream reports (so this run picks up where the last one left off)

Don't read file contents at this stage. Just structure.

### 2. Gather signal

Scan recent activity for patterns the agent couldn't see in any single session. The targets, in order of priority:

- **Cross-project bleed** — content from one project surfacing in conversations or outputs about another. Most urgent because it can ship to public surfaces before the user notices.
- **Visual style drift** — fonts, color palettes, layout choices repeating across sites that should look distinct. Especially when the user has explicitly said two sites should look different.
- **Personal-detail intrusion** — user's name, location, or other personal identifiers showing up in copy that's supposed to read generic. The user did not ask for first-person attribution; the agent inserted it.
- **Recurring user corrections** — same kind of correction made by the user across multiple sessions. Pattern means the agent is drifting in a way Rules or Skills should be updated to prevent.
- **Workflow repetition** — same sequence of steps performed three or more times. Candidate for a new Skill (the third-strike rule).
- **Idle Skills** — Skills that haven't been invoked in 60+ days. Candidates for retirement.
- **Drifted Rules** — Rules that conflict with newer Rules or that the agent is no longer honoring.
- **Stale Personas** — Personas tied to retired projects or never re-activated.
- **Broken Automations** — Automations erroring on their last run, or pointing at projects that no longer exist.
- **Quiet hosted Sites** — Sites that haven't been updated, that aren't reachable, or that nobody visits anymore.

Use targeted scans. Don't read every file in the workspace.

### 3. Consolidate

Merge the signal into proposed refinements. For each finding:

- **Bleed and drift findings** — propose a Rule update or Skill update that would prevent the pattern recurring. Show the proposed change before writing it.
- **Skill candidates** — propose a `file SKILL.md` skeleton (name, description, body outline) for any workflow that fired three or more times.
- **Idle Skills, drifted Rules, stale Personas, broken Automations, quiet Sites** — propose retire / pause / fix per item.
- **Resolve contradictions** — if two Rules conflict, surface them together and ask which to keep.
- **Remove dead references** — if a Skill points at a file that no longer exists, propose updating or retiring it.

Never auto-apply. Every consolidation step shows the proposed change first.

### 4. Surface

Write the dream report. Path:

```markdown
dream-reports/YYYY-MM-DD-dream.md
```

Sections in this order:

 1. **Run summary** — date, scope of scan, time taken
 2. **Cross-project bleed** — files, conversations, or outputs that crossed project lines, with proposed moves
 3. **Visual style drift** — sites pulling similar fonts/palettes/layouts when they shouldn't
 4. **Personal-detail intrusion** — copy where the user's name or location appeared uninvited
 5. **Recurring user corrections** — patterns suggesting a Rule or Skill update
 6. **Skill candidates** — workflows that fired 3+ times
 7. **Idle Skills** — candidates for retirement
 8. **Drifted Rules** — Rules that conflict or aren't being honored
 9. **Stale Personas** — Personas to retire
10. **Broken Automations** — Automations that need fix, pause, or delete
11. **Quiet hosted Sites and Services** — propose keep / sleep / retire per item
12. **Open decisions** — anything deferred from prior dream reports

In light mode, this is the whole output (report only, no destructive prompts).

In deep mode, walk the user through findings interactively. See `file references/cleanup-prompts.md` for literal interaction templates per finding type.

## Boundaries

- **Never modify anything destructively without explicit confirmation.** Require the user to type the literal item name to confirm any delete.
- **Never auto-apply a Rule update, a Persona retirement, a Skill scaffold, or a hosted Site change.** Show the proposed change; let the user accept, modify, or reject.
- **If yesterday's dream report shows decisions the user never resolved, mention them at the top of today's report.** Don't re-surface the same item every day silently.
- **If the workspace shape has changed significantly since the last dream**, stop and ask. Something may have moved deliberately that dreaming shouldn't be flagging as drift.

## After a deep dream run

- Append one line to the user's main memory file: "Dream YYYY-MM-DD:  bleed findings resolved,  Skill candidates accepted,  Rules updated,  deferred."
- If a new Skill or Rule was created, link to it from the report.
- If the dream proposed a Skill but the user deferred for the third time, soften next time's proposal: ask whether to retire the candidate rather than keep re-suggesting it.
- If safe changes were implemented, record which Skills, Personas, Rules, routes, files, or services changed.

## Two-mode recipes for Zo Automations

**Daily light dream:**

> Run the dreaming skill in light mode. Write the report to `dream-reports/`. DM me only if there's a critical finding (cross-project bleed flagged, hosted Site unreachable, Automation erroring three days running).

**Weekly deep dream:**

> Run the dreaming skill in deep mode. Walk me through findings interactively. Save decisions to today's report and update memory.

## Lineage

This skill is a port of Anthropic's Dreaming feature for Claude Managed Agents (announced 2026-05-06) into a Zo-specific Skill. Same conceptual model: asynchronous, reflective, learns-from-past-sessions, refines the durable layer of the workspace without modifying the underlying agent. Different surfaces — Anthropic's version operates over agent memory and session transcripts; this version operates over Zo's Files, Skills, Personas, Rules, Automations, and hosted Sites.

The four-phase pattern (Orient → Gather Signal → Consolidate → Surface) mirrors Claude Code's AutoDream consolidation pass. The user-control posture (auto-report by default, ask-before-anything-destructive) mirrors Anthropic's "you decide how much control you want" framing.

For the underlying inspiration, see Anthropic's [Dreams documentation](https://platform.claude.com/docs/en/managed-agents/dreams).