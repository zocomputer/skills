---
name: astra-memory
compatibility: Created for Zo Computer
description: Sync and query the unified memory layer backed by DataStax AstraDB. Mirrors facts from zobodhi-memory (Skills/zobodhi-memory/memory.json) and Clarion markdown tree (memory/**) into the AstraDB `memories` collection, and provides cross-source query. Use when the user wants to sync memory to AstraDB, query unified memories, check sync status, or add a fact. Requires ASTRA_DB_ENDPOINT and ASTRA_DB_APPLICATION_TOKEN in env (Settings > Advanced).
metadata:
  author: jaknyfe.zo.computer
  category: Community
---

# AstraDB Memory

Unified memory layer that mirrors both the zobodhi JSON fact store and the Clarion markdown tree into a single AstraDB collection, then queries across both.

## Requirements

Set in [Settings > Advanced](/?t=settings&s=advanced) → Secrets:
- `ASTRA_DB_ENDPOINT` — e.g. `https://<dbid>-<region>.apps.astra.datastax.com`
- `ASTRA_DB_APPLICATION_TOKEN` — generated in Astra portal; needs Database read/write

`ASTRA_DB_KEYSPACE` is optional (defaults to `default_keyspace`).

> **Token safety:** Application tokens are sensitive. Never paste them in chat. Store them as env vars in Settings > Advanced so they stay out of conversation history. Rotate quarterly and after any team-member change.

## Usage

```bash
cd /home/workspace/Skills/astra-memory/scripts
bun run sync.ts sync                    # full sync (both sources)
bun run sync.ts sync --source=zobodhi   # one source only
bun run sync.ts sync --source=clarion
bun run sync.ts status                  # counts by source/layer + last sync
bun run sync.ts query <text>            # cross-source search
bun run sync.ts query paperclip --source=clarion
bun run sync.ts add "New fact to remember"
bun run sync.ts tail 10                 # most recent N
```

## Schema (collection `memories`)

Each document:

| field      | type     | notes                                                  |
| ---------- | -------- | ------------------------------------------------------ |
| `_id`      | string   | auto-generated UUID                                    |
| `source`   | string   | `zobodhi` \| `clarion_daily` \| `clarion_project` \| `clarion_feedback` \| `clarion_reference` \| `clarion_topics` \| `clarion_bootstrap` |
| `layer`    | string   | `fact` \| `session` \| `semantic` (Clarion's 3-layer model) |
| `text`     | string   | full document text                                     |
| `title`    | string   | short title (first heading or fact preview)            |
| `path`     | string   | absolute path to source file                           |
| `timestamp`| string   | ISO 8601                                               |
| `tags`     | string[] | from frontmatter or `[]`                               |
| `project`  | string   | e.g. `scottish-rite`, `kilo-ui`, `paperclip`, `daily`  |

## Sync behavior

- **Idempotent upserts** keyed on `source + first 200 chars of text`. Re-running sync adds nothing new.
- **File system is source of truth.** Astra is a mirror for unified search.
- **Local zobodhi writes are mirrored to Astra** automatically on `add`.
- **No automatic sync on file edit** — run `bun run sync.ts sync` after editing markdown in `memory/**` to keep Astra in step.

## Hooking into chat

This skill is read/write via the CLI. To auto-mirror incoming chat messages to Astra (similar to the zobodhi `event="chatMessage"` rule), add a custom rule in [Settings > AI > Rules](/?t=settings&s=ai&d=rules):

> When a chat message arrives, run `bun run /home/workspace/Skills/astra-memory/scripts/sync.ts add "{{event.message.text}}"` if the message contains a fact, preference, decision, or non-trivial context.

## Rotation

If the application token is ever exposed (in chat, in a screenshot, in a public repo):

1. Go to Astra portal → Database → Connect → Application Tokens
2. Revoke the old token
3. Generate a new one
4. Update `ASTRA_DB_APPLICATION_TOKEN` in [Settings > Advanced](/?t=settings&s=advanced)
5. Re-run `bun run sync.ts status` to confirm connectivity

## Files

- `scripts/sync.ts` — CLI for sync, query, add, tail, status
- `scripts/last-sync.json` — last sync timestamp + counts (regenerated on every sync)
