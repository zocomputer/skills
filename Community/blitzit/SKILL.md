---
name: blitzit
description: Interact with Blitzit task management via MCP. Create, update, and manage tasks, lists, and schedules. Use when the user mentions "Blitzit", wants to manage tasks, or needs focus/productivity tools.
category: Productivity & Planning
metadata:
  author: YOUR_HANDLE.zo.computer
  emojis: ["⚡", "✅", "📋"]
tags:
  - tasks
  - productivity
  - focus
  - time-management
  - mcp
---

# Blitzit Task Management

Interact with Blitzit - a task management and focus app - via the Model Context Protocol (MCP).

## When to Use

Use this skill when the user wants to:
- Create, update, or delete tasks
- Manage task lists
- Schedule tasks for specific times
- Get today's tasks
- Track time estimates and completions
- Organize work with subtasks

## Available Tools

### Task Operations
- `create_task` - Create a new task (MUST call `list_lists` first to get available lists)
- `create_multiple_tasks` - Batch create multiple tasks
- `list_tasks` - List tasks with optional filtering
- `get_task` - Get details of a specific task
- `update_task` - Update an existing task
- `delete_task` - Permanently delete a task
- `complete_task` - Mark a task as completed
- `duplicate_task` - Duplicate a task

### List Operations
- `list_lists` - Get all lists (ALWAYS call this first before creating tasks)
- `create_list` - Create a new list
- `update_list` - Rename or change list color
- `archive_list` / `unarchive_list` - Archive or restore lists
- `duplicate_list` - Duplicate a list with all tasks

### Schedule & Time
- `get_todays_tasks` - Get tasks scheduled for today
- `get_current_time` - Get current time with user timezone (CALL THIS before scheduling)

## Usage via mcporter

```bash
# List available tools
npx mcporter list blitzit

# Call a tool
npx mcporter call blitzit.list_lists
npx mcporter call blitzit.create_task title="My task" listId="list-id-here"
```

## Important Notes

### Before Creating Tasks
1. **ALWAYS call `list_lists` first** to get available list IDs
2. Pick the appropriate list based on task context, or ask the user

### Scheduling Tasks
1. **ALWAYS call `get_current_time` first** to get timezone context
2. Convert target local time to UTC, then calculate timestamp
3. Use `scheduleTime` in milliseconds

### Notes vs Subtasks
- `description` = Task notes/details (supports HTML formatting)
- `subtasks` = Checklist items within the task (array of {title, isDone})

### Time Values
All time values (`estimateTime`, `timeTaken`) must be in **milliseconds**:
- 10 minutes = 600000 ms
- 1 hour = 3600000 ms

## Authentication

The Blitzit MCP server uses OAuth authentication. Tokens are stored in:
- mcporter config: `/home/workspace/config/mcporter.json`
- Zo Secrets: `BLITZIT_ACCESS_TOKEN`, `BLITZIT_REFRESH_TOKEN`

If authentication expires, re-run the OAuth flow by opening:
`https://integration-prd.blitzit.app/mcp/authorize`

## Configuration

- **MCP Server URL**: `https://integration-prd.blitzit.app/mcp`
- **OAuth Discovery**: `https://integration-prd.blitzit.app/.well-known/oauth-authorization-server`
- **Scopes**: `tasks:read`, `tasks:write`, `lists:read`, `lists:write`

## Examples

### Create a task
```bash
# First get lists
npx mcporter call blitzit.list_lists

# Then create task
npx mcporter call blitzit.create_task \
  title="Review pull request" \
  listId="work-list-id" \
  board="today" \
  estimateTime=1800000
```

### Get today's tasks
```bash
npx mcporter call blitzit.get_todays_tasks
```

### Schedule a task for tomorrow at 2pm
```bash
# Get current time first
npx mcporter call blitzit.get_current_time

# Calculate timestamp and create/update task
npx mcporter call blitzit.update_task \
  taskId="task-id" \
  scheduleTime=1769589000000 \
  scheduleTimeEnabled=true
```
