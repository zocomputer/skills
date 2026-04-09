---
name: granola
description: Access your Granola meeting notes, transcripts, and AI summaries via the Granola MCP server. Use when the user asks to search, retrieve, summarize, or work with their meeting notes from Granola.
metadata:
  author: tanveer-ai-gb
  category: Community
  display-name: Granola Meeting Notes
  emoji: 🎙️
---

# Granola Meeting Notes

Access your Granola meeting notes, transcripts, folders, and AI summaries using the Granola MCP server. No API key required — authentication is handled via browser OAuth.

## Setup

Run these commands once to connect Granola to Zo:

```bash
# 1. Add the Granola MCP server
claude mcp add granola --transport http https://mcp.granola.ai/mcp

# 2. Authenticate (opens browser OAuth flow)
```

After running `claude mcp add`, restart the session and run `/mcp`, select `granola`, then choose **Authenticate** to complete the browser sign-in.

> **Requirements:** A Granola account with existing meeting notes. Free accounts can access notes from the last 30 days; paid accounts get full history including shared notes and private folders.

## Available Tools

Once connected, the following MCP tools are available:

| Tool | Description |
|------|-------------|
| `query_granola_meetings` | Chat with your notes — ask questions, extract action items, get insights |
| `list_meetings` | Scan your meeting list |
| `get_meetings` | Search meeting content |
| `get_meeting_transcript` | Access full transcripts (paid plans only) |
| `list_meeting_folders` | View your meeting folders (paid plans only) |

## Usage Examples

Once the MCP server is connected, you can ask Zo things like:

- *"What did we decide in my last product meeting?"*
- *"List all my meetings from this week"*
- *"Get the transcript from my standup yesterday"*
- *"What action items came out of my meetings today?"*
- *"Search my notes for anything about the Q3 budget"*

Zo will use the appropriate MCP tool to answer directly from your Granola notes.

## Fallback: REST API

If MCP is unavailable, you can use the Granola REST API directly with a Personal API key (requires Business or Enterprise plan).

**Get an API key:** Granola desktop app → Settings → API → Create new key

**Base URL:** `https://public-api.granola.ai/v1`  
**Auth header:** `Authorization: Bearer $GRANOLA_API_KEY`

```bash
# List recent notes
curl "https://public-api.granola.ai/v1/notes?page_size=10" \
  -H "Authorization: Bearer $GRANOLA_API_KEY"

# Get a specific note with transcript
curl "https://public-api.granola.ai/v1/notes/not_XXXXXXXXXXXXXX?include=transcript" \
  -H "Authorization: Bearer $GRANOLA_API_KEY"
```

REST API rate limits: 25 requests burst / 5 per second sustained. Returns `429` when exceeded.

> Note IDs use the format `not_[14 alphanumeric chars]`. Only notes with a completed AI summary appear in responses.
