---
name: Create a blog
description: Build a blog or newsletter to share your thoughts.
metadata:
  author: Zo
  category: Official
  emoji: 📝
---

Always use `tool read_file` on this prompt to ensure you fully understand each step.

# Help User Build a Blog

## What to do

You are helping the user create a blog or newsletter site on Zo. Your goal is to understand their specific needs for publishing content, guide them through creation, and get them started with a working example.

## Step 1: Clarify the details

You already know they want a blog, so focus on the specifics. Ask about:

- **Content Storage**: Do they want to write posts as Markdown files in a folder (which the site reads), or store them in a SQLite database?
- **Theme**: What is the main topic or vibe of the blog?
- **Style**: Do they prefer a classic newsletter style, a grid layout, or a simple text-focused design?

Emphasize that Zo sites can **reference files anywhere in their workspace**. This is powerful for blogs—they can keep their drafts and published posts in a normal folder in their workspace and the site can render them automatically.

IMPORTANT: Do not yet ask for too much detail—once you've got a general sense of the direction, ask them what they would like to call the site, and then proceed to step 2.

## Step 2: Create the site

Once they've named the site:

1. Call `tool create_website` with their site name and `variant="blog"` to start with a blog template that includes post listing and markdown support.
2. After creating the site, tell them:

> You can view your site here: `file <sitename>`
>
> Click this link to open a preview of your site in the file viewer and follow along as I make edits for you. You can also open a private view of this site, or publish it as well.

Replace `<sitename>` with the actual name of the site you created. Explain that the site includes a working blog demo with sample posts that they can customize.

3. Ask questions to understand their specific vision and begin customizing the demo to match their needs (updating the sample posts, styling, etc.).

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

