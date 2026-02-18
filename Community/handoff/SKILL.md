---
name: handoff
description: >
  Pause-and-resume system for cross-conversation continuity. Use when your AI
  needs the user's input to continue a task but the current conversation must end.
  Checked on every boot to detect pending handoffs. Triggers on conversation start
  (boot check) and when the AI explicitly needs to pause for input.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
---

# Handoff

Enables your AI to pause work, ask you a question, and resume in a future conversation with your answer, regardless of which channel you respond through (SMS, email, new chat thread).

## Setup

1. Install this skill to `Skills/handoff/`
2. Add to your boot sequence (in rules or AGENTS.md): run `python3 Skills/handoff/scripts/handoff.py check` at the start of every conversation
3. Ensure `Data/` directory exists in your workspace

## State File

Single file: `/home/workspace/Data/handoff.json`

Only one handoff exists at a time. If a handoff file exists, there is unfinished business.

## Boot Check (Every Conversation)

At the start of every conversation, after loading your persona/profile context:

```bash
python3 /home/workspace/Skills/handoff/scripts/handoff.py check
```

**If no handoff exists**: Output says "No pending handoff." Continue normally.

**If a handoff exists**: Output includes the full handoff context. Do the following:

1. Read the handoff context carefully
2. Tell the user: "I have a pending handoff from a previous session" and summarize what was in progress and what was asked
3. If the current message appears to be a response to the handoff question, resume the work using their input, then clear the handoff
4. If the current message is about something else entirely, mention the pending handoff briefly and ask if they want to address it or shelve it
5. After the handoff is resolved, clear it:

```bash
python3 /home/workspace/Skills/handoff/scripts/handoff.py clear
```

## Creating a Handoff (When Pausing)

When you need the user's input to continue and the current session needs to end:

```bash
python3 /home/workspace/Skills/handoff/scripts/handoff.py save \
  --task "Brief description of what you're working on" \
  --context "Detailed context: what's been done, where files are, what state things are in" \
  --question "The specific question or decision you need from the user" \
  --resume "Instructions for your future self on how to resume once you have the answer"
```

After saving, notify the user. Choose based on urgency:

- **SMS** (default, most likely to be seen quickly): `send_sms_to_user`
- **Email** (for longer context): `send_email_to_user`
- **Both** (urgent + detailed): send both

The notification should include:
- What you were working on (1 line)
- What you need from the user (the question)
- "Reply anywhere and I'll pick it up next conversation"

## CLI Reference

```bash
python3 /home/workspace/Skills/handoff/scripts/handoff.py <command> [options]
```

| Command | Purpose |
|---------|---------|
| check | Check for pending handoff. Returns handoff context or "no pending handoff" |
| save | Create a new handoff (--task, --context, --question, --resume) |
| clear | Remove the pending handoff after it's been resolved |
| show | Display the full handoff file contents (same as check but always verbose) |

## Rules

- Never create a handoff for something you can figure out yourself. Search first, check memory, read files.
- Never have more than one handoff at a time. If one exists and you need to create another, resolve or replace the existing one.
- Always notify the user after creating a handoff. Don't just silently save it.
- Always clear the handoff after resolving it. Don't leave stale handoffs.
- The handoff file is your continuity mechanism. Write it like you're briefing a colleague who has zero context.
