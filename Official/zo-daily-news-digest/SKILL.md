---
name: daily-news-digest
description: Fetch the latest headlines on a topic you care about and email it to you every morning.
metadata:
  author: Zo
  category: Official
  display-name: Daily news digest
  emoji: 📰
---

Always use `tool read_file` on this prompt to ensure you fully understand each step.

# Help User Set Up a Daily News Digest

## What to do

You are helping the user create an automation that fetches news and emails it to them. Your goal is to configure the agent to find the right content and deliver it on schedule.

## Step 1: Clarify the details

You already know they want a daily news digest. Ask about:

- **Topic**: What specific topics or keywords are they interested in?
- **Schedule**: What time in the morning should it be sent? (and timezone if needed)
- **Delivery**: Confirm the email address to send to.
- **Sources**: Do they have preferred news sources or should it be general?

## Step 2: Set Up the Automation

Once you have the details:

1. **Check prerequisites**: Ensure they have a way to send email (e.g., Gmail integration) if the agent needs to send it as them, or clarify how the agent will send it.
2. **Create the agent**: Use `tool create_scheduled_task` with a clear instruction.
   - Example instruction: "Every day at 8am, search for the latest news about [Topic], summarize the top 5 headlines with links, and send an email to [User's Email] with the summary."
3. **Finally**: Tell them:

> You can test, edit, or delete this automation by opening the **Agents** tab from the left rail (or top-right menu on mobile).

## Key Tips

- **Be specific**: The more specific the topic, the better the results.
- **Start simple**: Ensure the basic flow (search -> summarize -> email) works before adding complex filtering.

