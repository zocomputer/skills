# ZTD (Zo To Do) -- Complete Guide

A file-first task board for Zo Computer. Manage tasks via CLI, REST API, or a drag-and-drop Kanban web UI.

---

## Quick Start

**CLI:**
```bash
# Create a card
bun run Skills/open-ztd/scripts/ztd.ts add --title "Fix the login bug" --assignee user --priority high

# See what's on the board
bun run Skills/open-ztd/scripts/ztd.ts list

# Move a card
bun run Skills/open-ztd/scripts/ztd.ts move 5 in_progress

# Mark done
bun run Skills/open-ztd/scripts/ztd.ts done 5
```

**API (after deploying routes to zo.space):**
```
GET    /api/kanban          -- List cards
POST   /api/kanban          -- Create card
PATCH  /api/kanban/:id      -- Update card
DELETE /api/kanban/:id      -- Delete card
```

**Web UI:** Deploy the `/kanban` page route to your zo.space for a drag-and-drop board.

---

## How It Works

### Storage: File-First with SQLite Index

Each card is a markdown file at `Data/ztd/ZTD-N.md`. The file IS the card. A SQLite index at `Data/ztd/index.db` caches frontmatter for fast API queries but the files are the source of truth.

```
Data/ztd/
  ZTD-1.md          -- Card file (source of truth)
  ZTD-2.md
  index.db          -- SQLite index (derived, rebuildable)
  archive/          -- Done cards moved here after 14 days
    ZTD-1.md
```

**In the file:** All card data -- frontmatter, description, comments, activity log. Everything needed to fully reconstruct the card.

**Only in SQLite:** sort_order (drag-and-drop position), archived flag, next_id counter. These are ephemeral/derived.

**If the index gets out of sync:** `ztd reindex` rebuilds it from the files.

**Custom data directory:** Set the `ZTD_DATA_DIR` environment variable to store cards elsewhere.

### Card File Format

```markdown
---
id: 1
title: Build the ZTD API
status: in_progress
assignee: user
type: task
priority: high
tags: ["infrastructure"]
due_date: 2026-03-01
source: conversation
created_at: 2026-02-22T09:00:00Z
updated_at: 2026-02-22T15:30:00Z
completed_at: null
conversations:
  - con_abc123
attachments:
  - path: docs/planning.md
    name: Planning Doc
    added_by: user
    added_at: 2026-02-22T09:00:00Z
---

Build the zo.space API route for the task board.

## Comments

<!--- comment: user | 2026-02-22 09:15 --->
Started working on the schema. Going with file-per-card approach.
<!--- /comment --->

<!--- comment: ai | 2026-02-22 10:00 --->
Make sure we handle the reorder endpoint for drag-and-drop.
<!--- /comment --->

## Activity

- 2026-02-22 09:00 | user | created
- 2026-02-22 09:15 | user | status: inbox -> in_progress
- 2026-02-22 10:00 | ai | commented
```

---

## Card Fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | integer | auto | Displayed as ZTD-1, ZTD-2, etc. |
| `title` | string | required | Short description |
| `status` | enum | `inbox` | `inbox`, `in_progress`, `in_review`, `done` |
| `assignee` | string | `user` | Freeform. Use any names you want. |
| `type` | enum | `task` | `task`, `question`, `request`, `blocker`, `idea` |
| `priority` | enum | `medium` | `urgent`, `high`, `medium`, `low` |
| `tags` | string[] | `[]` | Freeform. e.g. `["frontend", "urgent"]` |
| `due_date` | date | null | ISO date string |
| `source` | enum | `manual` | `manual`, `conversation`, `scheduled`, `boot` |
| `created_at` | datetime | auto | When created |
| `updated_at` | datetime | auto | Last modified |
| `completed_at` | datetime | null | Set when moved to `done` |
| `conversations` | string[] | `[]` | Zo conversation IDs linked to this card |
| `attachments` | object[] | `[]` | File references: `{path, name, added_by, added_at}` |

### Statuses

| Status | What it means |
|---|---|
| **inbox** | New, unprocessed. |
| **in_progress** | Actively being worked on. |
| **in_review** | Done but needs someone to check/approve/respond. |
| **done** | Complete. Auto-archived after 14 days. |

### Types

| Type | When to use |
|---|---|
| **task** | Work to be done |
| **question** | Needs a response from the assignee |
| **request** | Asking someone to do something |
| **blocker** | Can't proceed until resolved |
| **idea** | Not actionable yet, just captured |

---

## CLI Reference

Run all commands via: `bun run Skills/open-ztd/scripts/ztd.ts <command> [options]`

### Card Management

```bash
# Create a card
ztd add --title "..." [--description "..."] [--assignee user] \
  [--type task|question|request|blocker|idea] [--priority urgent|high|medium|low] \
  [--tags "tag1,tag2"] [--due-date 2026-03-01] \
  [--source manual|conversation|scheduled|boot] [--conversation con_abc123]

# List cards (with optional filters)
ztd list [--status inbox|in_progress|in_review|done] [--assignee user] \
  [--tag ...] [--type ...]

# Update card fields
ztd update <id> [--title "..."] [--status ...] [--assignee ...] \
  [--priority ...] [--tags ...] [--due-date ...] [--actor ...]

# Move card to a new status
ztd move <id> <status> [--actor ...]

# Mark complete
ztd done <id>

# Delete a card
ztd delete <id>

# Read full card contents
ztd read <id>
```

### Comments, Attachments, Conversations

```bash
# Add a comment
ztd comment <id> --content "..." [--author user]

# Attach a file reference
ztd attach <id> --file "path/to/file" [--name "Display Name"] [--author user]

# Link a conversation
ztd link <id> --conversation <conversation_id>
```

### Board Views

```bash
# Board summary (counts by status)
ztd stats

# Unprocessed inbox items
ztd inbox

# Items in review (optionally filter by assignee)
ztd review [--assignee user]

# Past-due items
ztd overdue

# Items with no updates in 7+ days
ztd stale
```

### Maintenance

```bash
# Rebuild SQLite index from card files
ztd reindex

# Search archived cards
ztd archive [--query "..."]
```

### Card IDs

Accept either `ZTD-1` or `1` in all commands. Both work.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ZTD_DATA_DIR` | `~/workspace/Data/ztd` | Where card files and the SQLite index are stored |

---

## API Reference

Deploy the routes from `routes/` to your zo.space. Base path: `/api/kanban`

### Cards

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/kanban` | -- | List active cards. Filters: `?status=`, `?assignee=`, `?type=`, `?tag=` |
| `POST` | `/api/kanban` | `{title, assignee?, type?, priority?, tags?, due_date?, description?, source?}` | Create a card |
| `GET` | `/api/kanban/:id` | -- | Get full card detail (description, comments, activity) |
| `PATCH` | `/api/kanban/:id` | `{title?, status?, assignee?, priority?, tags?, due_date?, actor?}` | Update card fields |
| `DELETE` | `/api/kanban/:id` | -- | Delete a card |

### Comments & Attachments

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/kanban/:id/comments` | `{content, author}` | Add a comment |
| `POST` | `/api/kanban/:id/attachments` | `{path, name, added_by?}` | Add attachment reference |
| `DELETE` | `/api/kanban/:id/attachments` | `{path}` | Remove attachment reference |

### Board Operations

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/kanban/stats` | -- | Board summary (counts by status, overdue, stale) |
| `POST` | `/api/kanban/reorder` | `{orders: [{id, sort_order}]}` | Batch update sort positions |
| `POST` | `/api/kanban/reindex` | -- | Rebuild SQLite index from files |
| `GET` | `/api/kanban/archive` | -- | List archived cards |
| `GET` | `/api/kanban/:id/activity` | -- | Get activity log for a card |

---

## Web UI

Deploy the `/kanban` page route for a drag-and-drop Kanban board.

**Features:**
- Four columns: Inbox, In Progress, In Review, Done
- Drag-and-drop cards between columns and reorder within columns
- Click a card to open the detail panel (right side)
- Detail panel shows: title, status (changeable), assignee, priority, type, tags, description, attachments, comments, activity log
- Add comments from the detail panel
- Quick-add button creates cards in any column
- Priority shown as colored left border (red = urgent, amber = high, blue = medium, gray = low)
- Type icons on cards (question mark, warning triangle, lightbulb, etc.)
- Assignee badges with distinct colors
- Due dates shown with red highlight if overdue

**Stack:** React + @dnd-kit + Tailwind CSS

---

## Architecture

```
Skills/open-ztd/
  SKILL.md                    -- Skill definition
  scripts/
    ztd.ts                    -- CLI tool (all commands)
    lib.ts                    -- Shared library (parser, serializer, SQLite helpers)
  references/
    guide.md                  -- This file
  assets/routes/
    kanban.tsx                -- Board UI page route (deploy to zo.space)
    api-kanban.ts             -- List/create cards API route
    api-kanban-wildcard.ts    -- All other API endpoints (wildcard route)

Data/ztd/                     -- Created automatically on first use
  ZTD-N.md                   -- Card files (source of truth)
  index.db                   -- SQLite index (derived cache)
  archive/                   -- Auto-archived done cards (14+ days)
```

The API routes dynamically import `lib.ts` at runtime for shared logic. Changes to lib.ts are picked up immediately without redeploying routes.

### Auto-Archive

Cards in `done` status for 14+ days are moved to `Data/ztd/archive/ZTD-N.md`. Nothing is ever deleted. The `ztd archive` command queries archived cards.

### Rebuilding the Index

If the SQLite index gets out of sync with the card files (e.g., after direct file edits), run:
```bash
bun run Skills/open-ztd/scripts/ztd.ts reindex
```
This drops and rebuilds the index from all card files. Sort order resets to alphabetical on reindex.

---

## Deploying to zo.space

The `assets/routes/` directory contains ready-to-deploy code for your zo.space:

1. **`/kanban`** (page, private) -- The board UI
2. **`/api/kanban`** (api) -- List and create cards
3. **`/api/kanban/:path{.+}`** (api) -- All other endpoints (detail, update, delete, comments, reorder, etc.)

To deploy, use `update_space_route` for each route, pasting the code from the corresponding file in `assets/routes/`. Set the kanban page to private (requires auth) and the API routes to public.

**Important:** Update the `LIB_PATH` constant in the API route files to point to your installed skill location (e.g., `/home/workspace/Skills/open-ztd/scripts/lib.ts`).
