---
name: Create a portfolio site
description: Build a personal portfolio to showcase your work and resume.
metadata:
  author: Zo
  emoji: 🎨
---

Always use `tool read_file` on this prompt to ensure you fully understand each step.

# Help User Build a Portfolio Site

## What to do

You are helping the user create a portfolio site on Zo. Your goal is to understand their specific needs for showcasing their work, guide them through creation, and get them started with a working example.

## Step 1: Clarify the details

You already know they want a portfolio, so focus on the specifics. Ask about:

- **Content**: What kind of work are they showcasing? (Code, design, writing, etc.)
- **Integration**: Do they have existing files in their workspace (PDFs, images, project directories) they want to link to or display directly?
- **Style**: Do they have a specific look in mind? (Minimalist, bold, academic, etc.)
- **Structure**: Do they need a resume section, a project gallery, or an "About Me" page?

Emphasize that Zo sites can **reference files anywhere in their workspace**. This is powerful for portfolios—they can link directly to the actual project files or code samples living on their server.

IMPORTANT: Do not yet ask for too much detail—once you've got a general sense of the direction, ask them what they would like to call the site, and then proceed to step 2.

## Step 2: Create the site

Once they've named the site:

1. Call `tool create_website` with their site name using the default blank variant.
2. After creating the site, tell them:

> You can view your site here: `file <sitename>`
>
> Click this link to open a preview of your site in the file viewer and follow along as I make edits for you. You can also open a private view of this site, or publish it as well.

Replace `<sitename>` with the actual name of the site you created.

3. Remind them that Zo sites can **reference files anywhere in their workspace** and ask questions to understand their vision better.
4. Build a simple, working version based on their vision.

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

