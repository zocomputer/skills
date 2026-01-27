---
name: Texting positive affirmations daily
description: Send yourself a daily text message with a randomly selected or rotating positive affirmation.
metadata:
  author: Zo
  emoji: ✨
---

Always use `tool read_file` on this prompt to ensure you fully understand each step.

# Help User Set Up Daily Affirmations

## What to do

You are helping the user create an automation that sends them a daily positive message. Your goal is to set up a reliable, uplifting schedule.

## Step 1: Clarify the details

You already know they want daily affirmations. Ask about:

- **Schedule**: What time of day would they like to receive it?
- **Delivery Method**: Do they want a text message (SMS) or another method (email, chat app)?
- **Content Source**: Should the agent generate them, or pick from a list the user provides?

## Step 2: Set Up the Automation

Once you have the details:

1. **Check prerequisites**: Verify the delivery method is possible (e.g., Twilio integration for SMS, or fallback to email).
2. **Create the agent**: Use `tool create_scheduled_task`.
   - Example instruction: "Every day at 9am, generate a unique, uplifting positive affirmation and send it via [Method] to [User's Contact Info]."
3. **Finally**: Tell them:

> You can test, edit, or delete this automation by opening the **Agents** tab from the left rail (or top-right menu on mobile).

## Key Tips

- **Tone**: Ask if they prefer a specific tone (gentle, energetic, stoic).
- **Delivery**: If SMS is hard to set up, offer Email or a Zo chat message as an alternative.

