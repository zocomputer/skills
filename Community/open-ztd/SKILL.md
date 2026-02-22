---
name: open-ztd
description: |
  ZTD (Zo To Do) is a file-first task board for Zo Computer. Manage tasks via CLI, REST API, or a drag-and-drop Kanban web UI on zo.space. Cards are stored as markdown files with YAML frontmatter, backed by a SQLite index for fast queries. Supports assignees, priorities, types, tags, due dates, comments, attachments, and activity logs. Use this skill to create, update, query, or manage tasks.
license: MIT
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs.zo.computer
  category: Community
  display-name: ZTD Task Board
  emoji: "\u2705"
---

# ZTD (Zo To Do)

File-first task board for Zo. Cards stored as markdown at `Data/ztd/`, indexed by SQLite.

## Setup

Set `ZTD_DATA_DIR` to customize where cards are stored (default: `Data/ztd` relative to your workspace root).

## CLI

Run via: `bun run Skills/open-ztd/scripts/ztd.ts <command> [options]`

### Quick Reference

| Command | What it does |
|---|---|
| `ztd add --title "..."` | Create a card (defaults: inbox, user, task, medium) |
| `ztd list` | List all active cards |
| `ztd list --status inbox --assignee user` | Filter cards |
| `ztd move <id> in_progress` | Change status |
| `ztd done <id>` | Mark complete |
| `ztd comment <id> --content "..."` | Add a comment |
| `ztd attach <id> --file "path"` | Attach a file reference |
| `ztd link <id> --conversation con_xyz` | Link a conversation |
| `ztd read <id>` | Print full card file |
| `ztd stats` | Board summary |
| `ztd inbox` | Unprocessed items |
| `ztd review` | Items in review |
| `ztd overdue` | Past-due items |
| `ztd stale` | Items with no updates in 7+ days |
| `ztd reindex` | Rebuild SQLite from files |

### Card IDs

Format: ZTD-N (e.g., ZTD-1, ZTD-42). Accept either `ZTD-1` or `1` in commands.

### Statuses

`inbox` -> `in_progress` -> `in_review` -> `done`

### Types

`task`, `question`, `request`, `blocker`, `idea`

### Web UI

Deploy the kanban page and API routes from `assets/routes/` to your zo.space for a drag-and-drop board UI. See `references/guide.md` for details.
