---
name: nod-shout
description: Save and curate links to a public shout page. Your AI agent captures articles, tools, and projects from conversations and publishes them automatically. No app needed.
homepage: https://nodsocial.com
metadata:
  author: jeffweisbein
  category: External
  display-name: nod shout
---

# Notice

Set `NOD_SHOUT_API_KEY` in your environment before using this skill.
Get your API key at [nodsocial.com](https://nodsocial.com).

# nod shout

Turn links from your conversations into a curated public page. Your agent saves articles, tools, music, projects — whatever you share — and publishes them to your shout page automatically.

Site: [nodsocial.com](https://nodsocial.com)

## Configuration

**Required env vars:**
- `NOD_SHOUT_API_KEY` — your nod API key
- `NOD_SHOUT_USER_ID` — your nod user ID

**Base URL**: `https://ooykzbkcquvreeheaijy.supabase.co/rest/v1`

## Quick Reference

All requests use these headers:
```bash
AUTH_HEADERS="-H 'apikey: $NOD_SHOUT_API_KEY' -H 'Authorization: Bearer $NOD_SHOUT_API_KEY' -H 'Content-Type: application/json' -H 'Prefer: return=representation'"
```

### Save a link (shout it)

```bash
curl -s -X POST "$BASE_URL/shouts" $AUTH_HEADERS -d '{
  "user_id": "'$NOD_SHOUT_USER_ID'",
  "url": "https://example.com/article",
  "title": "Article Title",
  "summary": "Brief summary of what this is and why it matters",
  "tags": ["ai", "tools"],
  "category": "ai",
  "source": "agent",
  "post_type": "link",
  "visibility": "public"
}'
```

### Post a text thought (no URL)

```bash
curl -s -X POST "$BASE_URL/shouts" $AUTH_HEADERS -d '{
  "user_id": "'$NOD_SHOUT_USER_ID'",
  "title": "thought",
  "summary": "Your text content here",
  "tags": ["observation"],
  "source": "agent",
  "post_type": "text",
  "visibility": "public"
}'
```

### List recent shouts

```bash
curl -s "$BASE_URL/shouts?user_id=eq.$NOD_SHOUT_USER_ID&order=created_at.desc&limit=10&select=id,url,title,summary,tags,created_at" $AUTH_HEADERS
```

### Delete a shout

```bash
curl -s -X DELETE "$BASE_URL/shouts?id=eq.SHOUT_ID&user_id=eq.$NOD_SHOUT_USER_ID" $AUTH_HEADERS
```

### Queue a link for review (save now, decide later)

```bash
curl -s -X POST "$BASE_URL/shout_queue" $AUTH_HEADERS -d '{
  "user_id": "'$NOD_SHOUT_USER_ID'",
  "url": "https://example.com/maybe-interesting",
  "title": "Title",
  "context": "Why this might be worth sharing",
  "status": "pending"
}'
```

### Review queued links

```bash
curl -s "$BASE_URL/shout_queue?user_id=eq.$NOD_SHOUT_USER_ID&status=eq.pending&order=created_at.desc" $AUTH_HEADERS
```

## When to use this skill

- User shares a link and says "save this" or "shout this"
- User mentions an article, tool, or project worth remembering
- User asks to curate or publish links
- User wants to see their recent shouts
- During conversations, when the user shares something interesting, silently queue it for later review

## MCP Server

nod shout also has an MCP server for deeper integration:
- Repo: [github.com/jeffweisbein/shout](https://github.com/jeffweisbein/shout)
- Install: `npm install` then `npm run build`
- Provides tools: `shout_save_link`, `shout_list`, `shout_feed`, `shout_agent_curate`, `shout_generate_digest`, and more

## Example

```
$ curl -s "$BASE_URL/shouts?user_id=eq.$NOD_SHOUT_USER_ID&order=created_at.desc&limit=3&select=title,url,tags" $AUTH_HEADERS

[
  {"title": "Karpathy's autoresearch pattern", "url": "https://github.com/karpathy/autoresearch", "tags": ["ai", "research"]},
  {"title": "Building agents that talk over iMessage", "url": "https://openclaw.com/blog/imessage-agents", "tags": ["agents", "infrastructure"]},
  {"title": "SQLite is the only database you need", "url": "https://blog.wesleyac.com/posts/consider-sqlite", "tags": ["databases", "simplicity"]}
]
```

## Notes

- Shouts are public by default. Set `"visibility": "unlisted"` to keep them private.
- The agent should extract a good title and summary before saving. Don't just dump raw URLs.
- Tags help with discovery. Use lowercase, short tags.
- View any user's shout page at `nodsocial.com/shout/USERNAME`.
