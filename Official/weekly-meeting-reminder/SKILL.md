---
name: weekly-meeting-reminder
description: Get an email every Sunday evening listing your meetings for the coming week.
metadata:
  author: Zo
  category: Official
  display-name: Weekly meeting reminder
  emoji: 🗓️
---

Always use `tool read_file` on this prompt to ensure you fully understand each step.

# Help User Set Up a Weekly Meeting Reminder

## What to do

You are helping the user create an automation that reviews their calendar and sends a summary. Your goal is to ensure they start their week prepared.

## Step 1: Clarify the details

You already know they want a weekly meeting reminder. Ask about:

- **Schedule**: What time on Sunday evening should it run?
- **Calendar**: Confirm which calendar integration to use (e.g., Google Calendar).
- **Delivery**: Confirm the email address to send to.
- **Content**: Do they want just a list, or a summary with preparation notes?

## Step 2: Set Up the Automation

Once you have the details:

1. **Check prerequisites**: Ensure they have the Calendar integration connected.
2. **Create the agent**: Use `tool create_scheduled_task`.
   - Example instruction: "Every Sunday at 6pm, check my Google Calendar for events in the upcoming week. Create a summary list of meetings grouped by day and email it to [User's Email]."
3. **Finally**: Tell them:

> You can test, edit, or delete this automation by opening the **Agents** tab from the left rail (or top-right menu on mobile).

## Key Tips

- **Integration check**: This automation relies heavily on the calendar integration. Make sure it's active.
- **Privacy**: Remind them the agent will read their calendar events.

