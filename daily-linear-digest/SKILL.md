---
name: Daily Linear digest
description: Creates an automation to email you a summary of your Linear activity from the previous day
metadata:
  author: Zo
  emoji: 📋
---

# Prerequisites

- [ ] User has Linear account connected

# Input

- The desired schedule (days/time, e.g. Every weekday at 8am)

# Protocol

1. Use `tool use_app_linear` with `linear-get-current-user` to get the user's information, as well as their team(s).
2. Confirm with the user which team they would like to create a digest for.
3. Use `tool create_scheduled_task` to create a task for the user's desired schedule with email delivery method and the exact following instruction, replacing `<USER_ID>` with the user's Linear ID and `<TEAM_ID>` with their team ID:

> 1. Use `tool use_app_linear` with `linear-search-issues` and the following props:\
>    `{ "assigneeId": <USER_ID>, "teamId": <TEAM_ID>, "orderBy": "updatedAt", "limit": 50 }`.
> 2. Output a summary of ONLY YESTERDAY's activity and a bulleted list of each issue and short description.

