---
name: zo-qa-app
description: Install the Zo Q&A App - a real-time Q&A application for live events with submission, voting, TV wall display, and admin controls.
metadata:
  author: jonahprice.zo.computer
  category: Official
  display-name: Zo Q&A App
  emoji: ❓
---

# Zo Q&A App Installer

Installs a complete Q&A application into the user's Zo Space for live events.

## What it does

1. Creates all necessary API routes in the user's Zo Space
2. Creates all page routes (landing, setup, submit, vote, TV, admin)
3. Sets up the data directory
4. Provides setup wizard for configuration

## Usage

```
Install the Zo Q&A app
```

## After installation

- Visit `/qa/setup` to configure your event
- Visit `/qa` to see the landing page
- Share `/qa/submit` with attendees
- Display `/qa/tv` on projectors
- Use `/qa/admin` for runtime controls

## Features

- **Submit questions** — Simple form with optional name field
- **Vote on questions** — One-click upvote
- **TV wall display** — Beautiful full-screen view for projectors
- **Setup wizard** — Configure title, logo, and branding
- **Admin controls** — Enable/disable submissions, export, reset
- **White-label ready** — Customize all branding
- **4 logo options** — None, URL, upload, or ask Zo to generate

## Routes created

### Pages (6)
- `/qa` — Landing page
- `/qa/setup` — Setup wizard
- `/qa/submit` — Submit questions
- `/qa/vote` — Vote on questions
- `/qa/tv` — TV wall for projectors
- `/qa/admin` — Admin panel

### API (8)
- `/api/qa/questions` — List/create questions
- `/api/qa/questions/:id` — Edit/delete questions
- `/api/qa/questions/:id/vote` — Toggle vote
- `/api/qa/admin/settings` — Runtime settings
- `/api/qa/admin/config` — Branding config
- `/api/qa/admin/export` — Export data
- `/api/qa/admin/reset` — Reset data
- `/api/qa/admin/merge` — Merge questions

## Files

The installer fetches route templates from:
https://github.com/jyonah/zo-qa-app

## Installation process

1. Fetches route code from GitHub
2. Creates routes via Zo API
3. Reports success with next steps

## Requirements

- Zo Computer with space routes enabled
- No external dependencies
- Works immediately after installation
