---
name: google-calendar
description: |
  Query Google Calendar for events and free time blocks. Requires google-direct-oauth skill to be 
  set up first. Ask Zo things like "what's on my calendar today", "find free time tomorrow", 
  "show my week", or "when am I free on Friday between 10am and 4pm".
  
compatibility: Requires google-direct-oauth skill with valid tokens at /home/.z/google-oauth/
metadata:
  author: Zo
---

# Google Calendar Skill

Query your calendar and find free time using your direct Google OAuth connection.

## Prerequisites

Set up the `google-direct-oauth` skill first. You should have valid tokens at `/home/.z/google-oauth/token.json`.

## Usage

The main script is `scripts/gcal.py`. Run with `--help` for all options:

```bash
python Skills/google-calendar/scripts/gcal.py --help
```

### List Events

```bash
# Today's events
python scripts/gcal.py events

# Specific date
python scripts/gcal.py events 2026-01-25
python scripts/gcal.py events tomorrow
python scripts/gcal.py events "next monday"
```

### Find Free Time

```bash
# Free blocks today (9am-6pm, min 15 min)
python scripts/gcal.py free

# Custom hours
python scripts/gcal.py free tomorrow --start 10 --end 16

# Longer blocks only
python scripts/gcal.py free friday --min-duration 60
```

### Week Overview

```bash
python scripts/gcal.py week
```

### JSON Output (for programmatic use)

```bash
python scripts/gcal.py json today
```

## For Zo

When the user asks about their calendar:

1. **"What's on my calendar [date]?"** → Run `events` command
2. **"When am I free [date]?"** → Run `free` command  
3. **"Show my week"** → Run `week` command
4. **"Find me a 1-hour slot tomorrow afternoon"** → Run `free tomorrow --start 12 --end 18 --min-duration 60`

Parse natural language dates:
- "today", "tomorrow", "yesterday"
- "next monday", "next friday"
- "January 25" → "01-25"
- "2026-01-25"
