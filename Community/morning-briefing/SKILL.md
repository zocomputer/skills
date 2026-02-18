---
name: morning-briefing
description: >
  Generate and deliver a daily morning briefing. Run via scheduled agent at your
  preferred morning time, or manually when the user asks for a briefing. Pulls
  tasks, calendar, inbox highlights, and news into a single digest delivered by
  email and SMS.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
---

## Setup

1. Install this skill to `Skills/morning-briefing/`
2. Create a scheduled agent to run it at your preferred morning time
3. **Optional dependencies** (the skill adapts to what's available):
   - `Data/tasks.db` (DuckDB) with a `tasks` table for task tracking. If you use the `task-manager` skill, this exists already. If not, the tasks section is skipped.
   - Gmail integration (connected via [Settings > Integrations](/?t=settings&s=integrations))
   - Google Calendar integration
   - Supermemory for meeting prep context

## How to Run

This is an orchestration skill. Follow these steps in order, then compose and deliver the briefing.

### Step 1: Gather Today's Tasks

If `Data/tasks.db` exists, run the helper script:

```bash
python3 /home/workspace/Skills/morning-briefing/scripts/tasks_query.py
```

Returns JSON with `overdue` and `due_today` arrays, sorted by priority.

If the database doesn't exist, skip this section.

### Step 2: Gather Today's Calendar

Use the Google Calendar tool:

```
use_app_google_calendar(
  tool_name="google_calendar-list-events",
  configured_props={
    "calendarId": "primary",
    "timeMin": "<today>T00:00:00<tz_offset>",
    "timeMax": "<today>T23:59:59<tz_offset>",
    "timeZone": "<user_timezone>",
    "singleEvents": true,
    "orderBy": "startTime"
  }
)
```

Replace `<today>` with current date, `<tz_offset>` with the user's UTC offset, and `<user_timezone>` with their timezone.

### Step 3: Gather Inbox Highlights

Use Gmail to find important unread emails:

```
use_app_gmail(
  tool_name="gmail-find-email",
  configured_props={
    "q": "is:unread is:important newer_than:1d",
    "withTextPayload": true,
    "maxResults": 5
  }
)
```

If fewer than 3 results, also try:

```
use_app_gmail(
  tool_name="gmail-find-email",
  configured_props={
    "q": "is:unread newer_than:1d -category:promotions -category:social",
    "withTextPayload": true,
    "maxResults": 5
  }
)
```

### Step 4: Gather News Digest

Customize these searches for the user's interests. Examples:

**Tech/AI news:**
```
web_search(
  query="AI technology news highlights",
  time_range="day",
  topic="news"
)
```

**Industry-specific news (customize for user's industry):**
```
web_search(
  query="<user's industry> news",
  time_range="day",
  topic="news"
)
```

### Step 5: Compose the Briefing

Write the briefing in this format:

```markdown
# Morning Briefing -- <Day of Week>, <Month DD, YYYY>

## Today's Schedule
<Calendar events with times, attendees, and any prep notes>

## Tasks
### Overdue
<List with priority badges, source, title>

### Due Today
<List with priority badges, source, title>

## Inbox Highlights
<3-5 most important emails with sender, subject, 1-line summary>

## News Digest
### <Category 1>
<3-5 notable items with 1-line summaries>

### <Category 2>
<2-3 relevant items>
```

Add a one-liner observation at the top if something stands out (overdue count, big meeting, breaking news).

### Step 6: Deliver

**Email:**
```
send_email_to_user(
  subject="Morning Briefing -- <Month DD>",
  markdown_body="<full briefing markdown>"
)
```

**SMS (condensed version, max 3-4 lines):**
```
send_sms_to_user(
  message="Morning: <X> tasks due, <Y> overdue. <top meeting>. <one notable item>"
)
```

### Step 7: Archive

Save the full briefing to:

```
/home/workspace/Records/Briefings/<YYYY-MM-DD>-morning.md
```

### Customization

- **News categories**: Edit step 4 to match the user's interests and industry
- **Delivery timing**: Adjust the scheduled agent time
- **Delivery channels**: Email only, SMS only, or both
- **Meeting prep**: If Supermemory is available, search for context about upcoming meeting attendees
- **Tone**: Match the user's AI persona voice

### Notes

- If any section fails to load (API error, no results), include it with a "Could not load" note rather than skipping entirely.
- News items should be deduplicated across sources.
- The SMS should be ruthlessly brief. Only the most critical info.
