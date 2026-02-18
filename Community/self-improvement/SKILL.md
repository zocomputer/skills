---
name: self-improvement
description: >
  AI self-improvement and reflection skill. Run weekly or on-demand to audit
  capabilities, identify gaps, evolve identity documents, prune stale
  skills/memory, and propose new capabilities. Triggers on schedule, when the
  user asks for a self-audit, or when the AI notices recurring limitations.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
---

# Self-Improvement

Structured reflection and evolution loop. Turns self-improvement from ad hoc to deliberate.

## Setup

1. Install this skill to `Skills/self-improvement/`
2. Create a weekly scheduled agent (e.g., Sundays at 10 AM) to run the full loop
3. Ensure `Records/Reflections/` directory exists for reports
4. Works best with the `supermemory` skill installed for memory hygiene checks

## When to Run

- **Scheduled**: Weekly via agent (recommended: Sunday morning)
- **Manual**: When the user asks for a self-audit, reflection, or capability review
- **Reactive**: When the AI notices a pattern of limitation mid-conversation (run the relevant section, not the full loop)

## The Loop

Run these phases in order. Each phase produces findings. At the end, synthesize into actions.

### Phase 1: System Audit

Run the audit script to gather current state:

```bash
python3 /home/workspace/Skills/self-improvement/scripts/audit.py full
```

This returns: identity file stats (if any), skills inventory, workspace structure, records, and a memory sample.

Review the output for:
- Skills that look stale or redundant
- Missing directories or broken structure
- Workspace clutter

### Phase 2: Skills Review

For each skill in the inventory, assess:

1. **Still relevant?** Does the user still use or need this? Check memory for recent mentions.
2. **Working?** Run a quick sanity check on scripts if they have CLI help (`--help`).
3. **Up to date?** Are there API changes, new capabilities, or better approaches?
4. **Well-documented?** Is the SKILL.md clear enough that a fresh AI instance could use it?

Flag skills as: healthy, needs-update, potentially-stale, or broken.

### Phase 3: Capability Gap Analysis

Think about what the user has asked for recently that was hard, slow, or impossible. If Supermemory is available:

```bash
python3 /home/workspace/Skills/supermemory/scripts/memory.py search \
  --query "couldn't do, limitation, manual, workaround, slow" --limit 10
```

Also consider:
- Are there integrations the user uses that aren't connected or automated?
- Are there repetitive tasks that could be skills?
- Are there tools or APIs that would unlock new capabilities?

Produce a ranked list of capability gaps with effort estimates (small/medium/large).

### Phase 4: Identity Reflection

If the user has persona/identity files for the AI, read them in full. Consider:

1. **Accuracy**: Does the voice description still match how the AI actually communicates?
2. **Completeness**: Are there aspects of the working relationship that have evolved but aren't captured?
3. **Principles**: Are any principles being violated regularly? Should new ones be added?
4. **Boundaries**: Are the guardrails still right? Too tight? Too loose?

Do NOT edit identity files directly. Propose changes and get the user's approval.

### Phase 5: Memory Hygiene

If Supermemory is available, search for potential issues:

```bash
python3 /home/workspace/Skills/supermemory/scripts/memory.py search --query "decided" --limit 20
python3 /home/workspace/Skills/supermemory/scripts/memory.py search --query "prefers" --limit 20
```

Check for:
- Contradictory facts (the graph handles most of this, but flag obvious ones)
- Outdated decisions that should be revisited
- Important context that's missing
- Facts saved too vaguely

### Phase 6: Action Plan

Synthesize findings into three categories:

1. **Do now** (internal improvements that don't need user approval): fix broken scripts, update stale skill docs, clean workspace clutter, save missing context to memory
2. **Propose to user** (changes that need approval): new skills to build, identity edits, capability investments, workflow changes
3. **Watch** (patterns to monitor, not yet actionable): emerging gaps, things that might matter later

## Delivery

### Scheduled Run (weekly)

1. Execute phases 1-6
2. Write the full report to `Records/Reflections/YYYY-MM-DD-reflection.md`
3. Execute all "do now" items immediately
4. Text the user a summary (2-4 lines max):

```
send_sms_to_user(
  message="Weekly self-audit done. [X] skills healthy, [Y] need attention. Top proposal: [brief]. Full report in Records/Reflections/. Want to discuss?"
)
```

5. If Supermemory is available, save the reflection summary:

```bash
python3 /home/workspace/Skills/supermemory/scripts/memory.py save \
  --content "Weekly self-improvement audit [DATE]: [key findings and actions taken]" \
  --tags "reflection,self-improvement"
```

### Manual/Reactive Run

Skip the report file and SMS. Just run the relevant phases and discuss findings inline.

## Report Format

```markdown
# Self-Improvement Reflection -- YYYY-MM-DD

## System State
<audit summary>

## Skills Health
| Skill | Status | Notes |
|-------|--------|-------|
| ... | healthy/needs-update/stale/broken | ... |

## Capability Gaps
1. [Gap] -- effort: small/medium/large -- impact: high/medium/low
2. ...

## Identity Notes
<observations about drift, accuracy, proposed changes>

## Memory Hygiene
<issues found, corrections made>

## Actions Taken
- [x] <things done immediately>
- [ ] <proposals for user>

## Watch List
- <patterns to monitor>
```

## Guardrails

- Never edit identity/persona files without the user's explicit approval
- Never delete skills without confirmation
- "Do now" items are limited to: documentation fixes, script bug fixes, workspace tidying, memory saves
- New skill creation is allowed (per autonomy clauses) but should be mentioned in the report
