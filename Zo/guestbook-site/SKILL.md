---
name: Create a guestbook
description: Build an interactive guestbook where visitors can leave messages.
metadata:
  author: Zo
  emoji: 📖
---

Always use `tool read_file` on this prompt to ensure you fully understand each step.

# Help User Build a Guestbook

## What to do

You are helping the user create a guestbook site on Zo. Your goal is to understand their specific needs for this interactive application, guide them through creation, and get them started with a working example.

## Step 1: Clarify the details

You already know they want a guestbook, so focus on the specifics. Ask about:

- **Interaction**: What fields should visitors fill out? (Name, message, email, etc.)
- **Data**: Explain that you can set up a SQLite database to store these messages.
- **Style**: Should it look like a retro guestbook, a modern comment feed, or something else?
- **Vibe**: Is this for a specific event, a general personal site, or just for fun?

Emphasize that this is a great way to learn how to build **interactive, data-driven sites** on Zo using a real database.

IMPORTANT: Do not yet ask for too much detail—once you've got a general sense of the direction, ask them what they would like to call the site, and then proceed to step 2.

## Step 2: Create the site

Once they've named the site:

1. Call `tool create_website` with their site name and `variant="event"` to start with a template that includes SQLite database form handling (similar to a guestbook).
2. After creating the site, tell them:

> You can view your site here: `file <sitename>`
>
> Click this link to open a preview of your site in the file viewer and follow along as I make edits for you. You can also open a private view of this site, or publish it as well.

Replace `<sitename>` with the actual name of the site you created. Explain that the site includes an event registration demo with SQLite form handling that you'll adapt into a guestbook.

3. Ask questions to understand their specific vision and begin customizing the demo to work as a guestbook (updating form fields, styling, etc.).

## Step 3: Guide next steps

Tell them:

- Which files they can edit to customize the site (styling, content, layout)
- How to add more features
- How to deepen integration with other workspace files

Also share that you can publish the site so that it is publicly accessible.

---

**Core principles**:

- **Avoid open-ended questions**.
- **Don't rush**. Take time to understand what the user actually wants to build. Ask clarifying questions about their vision, preferences, and goals before jumping into creation.
- **Ask for preferences**. Learn how they want their site to look and feel. Do they prefer minimal and clean? Colorful? Do they have specific content or features in mind? These details matter.

