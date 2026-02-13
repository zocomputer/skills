---
name: claude-code-window-primer
description: Optimize Claude Code Pro/Max usage by starting the 5-hour rolling window early morning, giving you more resets during waking hours.
metadata:
  author: va.zo.computer
  category: Community
  display-name: Claude Code Window Primer
  emoji: ⏰
---

Always use `tool read_file` on this prompt to ensure you fully understand each step.

# Help User Set Up Claude Code Window Priming

## What This Does

Claude Code Pro/Max plans have a 5-hour rolling usage window. This skill sets up an automated early-morning ping to start that window while you sleep, so resets happen during your productive hours instead of mid-evening.

**Example with 6:30am primer:**
- 6:30am: Window starts (you're asleep)
- 11:30am: First reset (mid-morning)
- 4:30pm: Second reset (afternoon)
- 9:30pm: Third reset (evening if needed)

Without priming, your first real usage at 9am means resets at 2pm and 7pm — less aligned with typical work patterns.

## Step 1: Clarify the Details

Ask the user:

- **Wake time**: When do they typically start working? (Default: 9am)
- **Primer time**: Suggest 2.5-3 hours before their wake time for optimal alignment
- **Timezone**: Confirm their timezone for scheduling

## Step 2: Set Up the Automation

Create a scheduled agent that makes a trivial Opus call:

```
Use tool create_agent with:
- rrule: FREQ=DAILY;BYHOUR=6;BYMINUTE=30 (adjust for their timezone)
- instruction: "Make a single trivial call to Claude Opus: ask it to return either 0 or 1 at random. This starts the 5-hour rolling window. No response needed."
- delivery_method: silent (or "none")
```

## Step 3: Confirm Setup

Tell them:

> Your Claude Code window primer is set for [TIME]. You can test, edit, or delete this automation in the **Agents** tab.
>
> **How it helps:** Your 5-hour windows will now reset at [RESET_TIME_1] and [RESET_TIME_2] — better aligned with your work hours.

## Key Tips

- **Weekly limits unchanged**: This only optimizes *when* resets happen, not total weekly usage
- **Minimal cost**: Each primer is ~10 tokens — negligible against your usage
- **Adjust as needed**: If your schedule changes, edit the agent timing

## Technical Note

The primer works because Claude Code's rate limit is based on a rolling 5-hour window from your *first* usage. By making that first usage happen early, subsequent resets align better with active work hours.
