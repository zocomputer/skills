---
name: supermemory
description: >
  Long-term memory for AI agents via Supermemory's knowledge graph API. Primary
  CLI is `npx supermemory`; companion script covers conversation ingestion and
  memory listing not yet in the official CLI.
compatibility: Any machine with Node.js (npx) and SUPERMEMORY_API_KEY
metadata:
  author: skeletorjs
  category: Community
---

## Setup

1. Sign up at [supermemory.ai](https://supermemory.ai) and get an API key
2. Add `SUPERMEMORY_API_KEY` to your Zo secrets at [Settings > Advanced](/?t=settings&s=advanced)
3. Install this skill to `Skills/supermemory/`
4. (Optional) Install the CLI globally: `npm install -g supermemory`
5. (Optional) Set a default container tag: `npx supermemory config --set tag=<your-tag>`

**Important**: Always run commands through the Zo shell (`run_bash_command`), not the local shell. The API key is only available in the Zo environment.

## CLI

Primary CLI (official):
```bash
npx supermemory <command> [options]
```

Companion script (for commands not in the official CLI):
```bash
python3 Skills/supermemory/scripts/memory.py <command> [--container <name>] [options]
```

Container is set via `SUPERMEMORY_TAG` env var or `--tag` flag per command.

### Primary Commands (npx supermemory)

| Command | Purpose |
|---------|---------|
| remember | Save a memory directly (v4, immediately searchable) |
| search | Search memories with hybrid mode + reranking (v4) |
| profile | Get profile (static facts + dynamic context) |
| forget | Soft-delete a memory (v4) |
| update | Update a memory with versioning (v4) |
| add | Ingest content (text, file, URL) via document pipeline |
| tags | Manage container tags (list, info, create, delete, merge) |
| docs | Manage documents (list, get, delete, chunks, status) |

### Companion Commands (memory.py)

| Command | Purpose |
|---------|---------|
| conversation | Ingest structured messages via v4/conversations (role-attributed, incremental) |
| memories | List extracted memory entries with version history (v4/memories/list) |

## How Supermemory Works

Supermemory is a knowledge graph, not a key-value store. When you save content, it:

1. **Extracts facts** from the content
2. **Builds relationships** between memories:
   - **Updates**: New fact contradicts old one. Old gets deprioritized. Searches return current info.
   - **Extends**: New fact enriches existing one. Both remain valid.
   - **Derives**: System infers new facts from patterns.
3. **Maintains profiles** via `/v4/profile`, auto-generated from all accumulated memories.

### Two ingestion paths

- **Direct (v4/memories)**: `remember` command. Bypasses document pipeline. Immediately searchable. Best for entity-centric facts, decisions, preferences.
- **Pipeline (v3/documents)**: `add` command. Content goes through extraction, chunking, embedding. Best for URLs, long documents, files.

### Static vs dynamic memories

- **Static** (`--static`): Permanent traits that don't decay. Name, role, hometown, core preferences. Use for facts that should always surface in profiles.
- **Dynamic** (default): Normal memories subject to graph evolution, contradiction resolution, and time-based decay.

### Automatic forgetting

- **Contradiction resolution**: New facts supersede old ones in search results.
- **Noise filtering**: Casual content doesn't become permanent.
- **Soft delete**: `forget` marks memories as forgotten but preserves history.

You do NOT need to manually delete stale memories. The graph handles it.

## How to Use It

### RECALL (search when you need context)

Run `search` or `profile` whenever context would help:

- **Conversation start**: Profile for general context, search for topic-specific memories.
- **Mid-conversation**: When uncertain about prior decisions or preferences. Don't guess when you can check.
- **First mention of a person/company/project**: Search for existing context before responding.

Search modes:
- **memories** (default): Searches extracted memory entries only. Fast, low latency.
- **hybrid**: Searches both memories and document chunks. Best when you need both extracted facts and raw context.
- **documents**: Searches document chunks only. Use for RAG-style retrieval from ingested content.

Use `--rerank` when precision matters more than speed (~100ms overhead).
Use `--rewrite` to let Supermemory rewrite the query for better retrieval.

### CAPTURE (save when something worth remembering happens)

**For individual facts**: Use `remember`. Write entity-centric statements.
- Good: "User decided to use DuckDB for task management because of embedded SQL and zero dependencies."
- Bad: "We talked about databases and decided on DuckDB"

**For conversations**: Use `conversation` (companion script). The graph extracts multiple connected memories from the conversation structure, preserving relationships between facts that individual saves would lose.

**For URLs and documents**: Use `add`. Supermemory fetches the content, chunks it, extracts memories, and makes it searchable.

What to save:
- **Decisions** the moment they're made
- **Preferences** about tools, workflow, communication
- **Key facts** about people, companies, projects
- **Corrections** when a previous decision changes (reference what changed from what)

What NOT to save:
- Trivial exchanges
- Temporary/session-specific context
- Raw data that belongs in files
- Information already captured elsewhere

### Save Quality

Every save should be useful cold, readable with zero context about the current conversation.

Minimum bar: who/what entity, what the fact is, enough context that the "why" is inferrable. Under 15 words is probably too thin.

### Correction Saves

When a previous decision changes, use `update` for versioned corrections (preserves history), or save with explicit supersession language:
- "User changed X from Y to Z because [reason]."

The graph uses this to mark old memories as stale.

### Tags

Optional. Pass as JSON metadata via `--metadata '{"tags":"a,b"}'`. Simple categories: decision, preference, fact, meeting, project, lesson.

### Containers

Use container tags to separate contexts (e.g., one for the user's personal context, another for a specific project or team). Set the default with `npx supermemory config --set tag=<name>` or override per command with `--tag <name>`.

## Conversation Ingestion

The most powerful capture method. Accepts structured messages with proper role attribution:

```bash
# From a JSON file with structured messages
python3 memory.py conversation --file /path/to/messages.json --id "conv-2026-03-28-topic"

# Piped JSON array of messages
echo '[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]' | python3 memory.py conversation

# Raw text (wrapped as single user message, backward compatible)
python3 memory.py conversation --content "Long conversation transcript..." --id "conv-id"
```

Message format: `{"role": "user|assistant|system|tool", "content": "..."}`

Using `--id` enables incremental updates. Send the same conversation ID with additional messages and Supermemory updates its extraction without duplicating.

## Command Reference

### remember (npx supermemory)
```
npx supermemory remember "content" [options]
  --tag          Container tag
  --static       Mark as permanent trait
  --metadata     JSON metadata to attach
```

### search (npx supermemory)
```
npx supermemory search "query" [options]
  --tag          Filter by container tag
  --limit N      Max results (default: 10)
  --mode MODE    memories|hybrid|documents (default: memories)
  --rerank       Enable reranking
  --rewrite      Rewrite query for better retrieval
  --threshold N  0-1, lower = more results (default: 0.6)
  --include      Comma-separated: summaries,documents,relatedMemories,forgottenMemories
  --filter       Metadata filter (JSON)
```

### profile (npx supermemory)
```
npx supermemory profile [options]
  --tag          Container tag
  --query        Also run a search within the profile
```

### forget (npx supermemory)
```
npx supermemory forget [ID] [options]
  --tag          Container tag (required)
  --reason       Reason for forgetting
  --content      Find and forget by content match (instead of ID)
```

### update (npx supermemory)
```
npx supermemory update <ID> "new content" [options]
  --tag          Container tag
  --metadata     Updated metadata (JSON)
  --reason       Reason for update
```

### add (npx supermemory)
```
npx supermemory add <content|file|url> [options]
  --tag          Container tag
  --stdin        Read content from stdin
  --title        Document title
  --metadata     JSON metadata to attach
  --id           Custom document ID (for idempotency)
  --batch        Read JSON array from stdin (batch mode)
```

### conversation (companion script)
```
python3 memory.py conversation [options]
  --content "text"    Raw text or JSON messages (or pipe)
  --file "path.json"  Load messages from JSON file
  --id "conv-id"      Conversation ID (enables incremental updates)
  --container <name>  Override target container
```

### memories (companion script)
```
python3 memory.py memories [options]
  --limit N           Max results (default: 30)
  --container <name>  Override target container
```

### tags (npx supermemory)
```
npx supermemory tags list
npx supermemory tags info <tag>
npx supermemory tags create <tag>
npx supermemory tags delete <tag>
npx supermemory tags context <tag> --set "context text"
npx supermemory tags merge <source> --into <target>
```

### docs (npx supermemory)
```
npx supermemory docs list --tag <tag>
npx supermemory docs get <id>
npx supermemory docs delete <id>
npx supermemory docs chunks <id>
npx supermemory docs status <id>
```
