---
name: midday-checkin
description: >
  Midday check-in combining pattern detection and context warming.
  Runs at midday via scheduled agent. Surfaces task drift, stale threads,
  and pre-loads context for afternoon calendar. Only texts the user if
  something matters. Also serves as an AI continuity checkpoint.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
---

## Setup

1. Install this skill to `Skills/midday-checkin/`
2. Create a scheduled agent to run it at noon (user's timezone)
3. **Optional dependencies** (the skill adapts to what's available):
   - `Data/tasks.db` (DuckDB) with a `tasks` table (and optionally `decisions`)
   - Google Calendar integration
   - Supermemory for context warming and continuity
   - `Records/Meetings/` directory for meeting record pattern detection

## How to Run

This is a multi-phase check-in. Follow each phase in order.

### Phase 1: Pattern Detection

Run the patterns script to scan for anomalies across tasks, meetings, and commitments:

```bash
python3 /home/workspace/Skills/midday-checkin/scripts/patterns.py
```

Returns JSON with findings categorized by severity (high, medium, low/info).

The script tracks state between runs at `/home/workspace/Data/midday-state.json`, so it only surfaces *deltas* (new meetings, changed patterns) rather than repeating everything.

Review the output. Focus on:
- **high severity**: Tasks 7+ days overdue. These are dropped balls.
- **medium severity**: Tasks 3-7 days overdue, stale tasks (no updates in 5+ days), WIP overload.
- **low/info**: Meeting volume changes, frequent contacts, new meeting records, commitment checks.

### Phase 2: Context Warming

Pre-load context for the user's afternoon. This makes you useful *before* they ask.

1. **Check today's remaining calendar:**
   ```
   use_app_google_calendar(
     tool_name="google_calendar-list-events",
     configured_props={
       "calendarId": "primary",
       "timeMin": "<now in ISO>",
       "timeMax": "<end of day in ISO>",
       "timeZone": "<user_timezone>",
       "singleEvents": true,
       "orderBy": "startTime"
     }
   )
   ```

2. **For each upcoming meeting with an external participant:**
   - If Supermemory is available, search for that person/company
   - Check `Records/Meetings/` for recent meetings with them
   - Note any open tasks, recent decisions, or unresolved threads related to them

3. **Check for unprocessed meeting records:**
   - If the patterns script flagged new meeting records, read them
   - If any have empty Decisions/Commitments sections, flag them for review

### Phase 3: AI Continuity Checkpoint

Quick internal state maintenance:

1. Check if any conversations happened this morning by looking at recent activity
2. If morning conversations produced decisions or context changes, verify they were saved to memory
3. Note any threads being tracked that might be relevant for the afternoon
4. If Supermemory is available, save a brief midday breadcrumb:
   ```bash
   python3 /home/workspace/Skills/supermemory/scripts/memory.py save \
     --content "Midday check <date>: <1-2 sentence summary of what's active>" \
     --tags "midday,continuity"
   ```

### Phase 4: Delivery Decision

**Only text the user if something crosses the threshold.** The threshold is:

- A high-severity finding (7+ days overdue task, major dropped ball)
- A meeting in the next 2 hours where you have relevant pre-loaded context worth sharing
- Something genuinely time-sensitive that the morning briefing couldn't have caught

If texting, keep it to 2-3 lines max. Lead with the most important thing.

```
send_sms_to_user(
  message="Midday: [most important thing]. [second thing if relevant]."
)
```

**If nothing crosses the threshold: stay silent.** No "all clear" messages. Silence means everything is fine.

### Phase 5: Archive

Save the full check-in output to:

```
/home/workspace/Records/Briefings/<YYYY-MM-DD>-midday.md
```

Format:

```markdown
# Midday Check-in -- <Day of Week>, <Month DD, YYYY>

## Pattern Findings
<Summarize findings by severity. Skip categories with nothing.>

## Context Warming
<For each afternoon meeting: who, relevant history, open threads.>

## Continuity Notes
<What threads are active. What to watch for.>

## Delivery
<What was sent to the user, or "Silent -- nothing crossed threshold.">
```

### Notes

- This complements the morning briefing (full day overview) with a more targeted, pattern-focused midday pulse.
- The pattern detection script accumulates state over time. The longer it runs, the better the delta detection gets.
- Context warming is the highest-value phase. Pre-loading meeting context before the user asks for it is the chief-of-staff move.
- Don't duplicate what the morning briefing already covered. Focus on what's changed since morning.
