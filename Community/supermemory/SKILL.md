---
name: supermemory
description: >
  Long-term memory that persists across conversations. Save facts, decisions,
  and preferences to a knowledge graph that builds a living profile of the user
  over time. Replaces static user docs with dynamic context that grows and
  self-corrects.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
---

## Setup

1. Sign up at [supermemory.ai](https://supermemory.ai) and get an API key
2. Add `SUPERMEMORY_API_KEY` to your Zo secrets at [Settings > Advanced](/?t=settings&s=advanced)
3. Install this skill to `Skills/supermemory/`
4. **Important**: Always run memory.py through the Zo shell (`run_bash_command` tool), not the local shell. The API key is only available in the Zo environment.

## CLI

```bash
python3 /home/workspace/Skills/supermemory/scripts/memory.py <command> [options]
```

| Command | Purpose |
|---------|---------|
| save | Save a memory (--content, --tags, --id) |
| search | Search memories (--query, --limit) |
| profile | Get user profile (static facts + dynamic context) |
| conversation | Ingest a conversation for extraction (--content, --id) |
| list | List recent memories (--limit) |
| forget | Delete a memory document (--id) |
| close | Log conversation close protocol (--summary, --saves) |

## Multiple Containers

The script supports multiple memory containers via the `--as` flag. This is useful for separating the user's context from the AI's own self-knowledge:

```bash
# Save to the default (user) container
python3 memory.py save --content "User prefers dark mode"

# Save to a custom container
python3 memory.py save --as myai --content "I noticed a pattern in how I approach debugging"

# Search a specific container
python3 memory.py search --as myai --query "debugging patterns"

# Get profile for a specific container
python3 memory.py profile --as myai
```

To customize container names, edit the `CONTAINER_DEFAULT` and `CONTAINER_SELF` variables at the top of `memory.py`.

## How Supermemory Works

Supermemory is a knowledge graph, not a key-value store. When you save content, it:

1. **Extracts facts**: AI analyzes the content and pulls out discrete memories
2. **Builds relationships**: Each memory connects to existing ones via three relationship types:
   - **Updates**: New fact contradicts old one. Old gets marked `isLatest=false`. Searches return current info.
   - **Extends**: New fact enriches existing one. Both remain valid and searchable.
   - **Derives**: System infers new facts from patterns across memories.
3. **Maintains profiles**: The `/v4/profile` endpoint auto-generates a static/dynamic profile from all accumulated memories.

### Automatic Forgetting

Supermemory handles memory decay on its own:

- **Time-based**: Temporary facts ("meeting at 3pm today") are automatically forgotten after they expire.
- **Contradiction resolution**: When new facts update old ones, searches return current info. History is preserved but deprioritized.
- **Noise filtering**: Casual, non-meaningful content doesn't become permanent memories.

You do NOT need to manually delete stale temporal memories.

## How to Use It

### RECALL (search when you need context)

Run `memory.py search` or `memory.py profile` whenever context would help:

- **Conversation start**: Profile for general context, search for topic-relevant memories.
- **Mid-conversation**: When uncertain about prior decisions, past context, or preferences. Don't guess when you can check.
- **Meeting prep**: Before calendar events, search for context about attendees, company, or topic.
- **"Do you remember"**: Any time the user asks about past context.

### CAPTURE (save when something worth remembering happens)

Run `memory.py save` as things happen, not just at conversation end.

Write content as **entity-centric facts**, not raw notes:
- Good: "User decided to use DuckDB for task management"
- Bad: "We talked about databases and decided on DuckDB"

What to save:
- **Decisions** the moment they're made
- **Preferences** about tools, workflow, communication
- **Key facts** about people, companies, projects
- **Meeting takeaways** after processing transcripts
- **Significant project/architecture context**

What NOT to save:
- Trivial exchanges
- Temporary/session-specific context (debugging steps, draft iterations)
- Raw data that belongs in files

### Save Quality

Saves should be useful cold, readable by a future version of you with zero context about the current conversation.

**Good saves:**
- "User decided to use DataForSEO over SEMrush for client SEO work because of pay-as-you-go pricing and API flexibility."
- "User prefers Bun over Node for new TypeScript projects. Confirmed across multiple sessions."

**Bad saves:**
- "User decided on DataForSEO." (no context on why or what it replaced)
- "User likes Bun." (preferences need specificity)

**Minimum bar:** Every save should include at least: who or what entity it's about, what the fact/decision/preference is, and enough context that the "why" is inferrable.

### Correction Saves

When the user changes a previous decision or preference, save the correction with explicit supersession language:

- "User changed the pricing model from flat fee to hybrid. Previous model was $X/month flat."
- "User no longer wants to use Redis for caching. Switched to in-memory caching for simplicity."

The knowledge graph uses this language to mark old memories as stale.

### Tags

Tags go in `--tags` as comma-separated values. Keep them simple:

| Tag | Use for |
|-----|---------|
| decision | Choices made, approaches selected |
| preference | Tool preferences, workflow habits |
| fact | Stable facts about people, companies, projects |
| meeting | Meeting outcomes and takeaways |
| project | Architecture, strategy, planning context |

### Using customId

`customId` is for **document-level identity**, not memory-level dedup. Use it when:

- You have a growing document you'll update over time (e.g., a conversation transcript)
- You want to fully replace a previous version of the same content
- You're ingesting something with a natural external ID (meeting ID, ticket ID)

You do NOT need `customId` for every individual fact you save. The graph handles dedup through its relationship system.

## Conversation Ingestion

For long or important conversations, use the `conversation` command:

```bash
python3 memory.py conversation --content "..." --id "conv-2026-02-16-topic"
```

Supermemory extracts multiple connected memories from a single conversation.

## Profile as Living Context

Supermemory automatically builds the user's profile from all accumulated memories:
- **Static**: Long-term stable facts (role, location, preferences)
- **Dynamic**: Recent context and temporary states (current projects, active discussions)

The profile is fully automatic. Run `memory.py profile` to check current state.
