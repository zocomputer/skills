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

Set `NOD_SUPABASE_KEY` in your environment before using this skill.
Sign up at [nodsocial.com](https://nodsocial.com) to get your credentials.

# nod shout

Turn links from your conversations into a curated public page. Your agent saves articles, tools, music, projects — whatever you share — and publishes them to your shout page automatically.

Site: [nodsocial.com](https://nodsocial.com)
Repo: [github.com/jeffweisbein/nod-shout](https://github.com/jeffweisbein/nod-shout)

## Configuration

**Required env vars:**
- `SUPABASE_URL` — nod supabase URL
- `NOD_SUPABASE_KEY` — your nod API key

## MCP Server

nod-shout is an MCP server. Install it directly:

```bash
git clone https://github.com/jeffweisbein/nod-shout.git
cd nod-shout
npm install
npm run build
```

Add to your MCP config:
```json
{
  "mcpServers": {
    "nod-shout": {
      "command": "node",
      "args": ["/path/to/nod-shout/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://ooykzbkcquvreeheaijy.supabase.co",
        "NOD_SUPABASE_KEY": "your-key"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `shout_save_link` | Save a URL with AI-generated summary and tags |
| `shout_list` | List recent shouts, filter by collection or search |
| `shout_remove` | Delete a shout by ID |
| `shout_create_collection` | Create a named collection to organize shouts |
| `shout_list_collections` | List all your collections |
| `shout_generate_digest` | Generate a digest from recent shouts |
| `shout_follow` | Follow another user's shouts |
| `shout_feed` | Aggregated feed from followed users |
| `shout_agent_curate` | Auto-curate links from conversation context |
| `shout_settings` | Configure auto-detect, visibility, digest frequency |

## When to use this skill

- User shares a link and says "save this" or "shout this"
- User mentions an article, tool, or project worth remembering
- User asks to curate or publish links
- User wants to see their recent shouts
- During conversations, when the user shares something interesting, queue it for later review

## Example

```
> shout_save_link("https://github.com/karpathy/autoresearch")

Saved: "Karpathy's autoresearch"
Summary: Automated research pipeline that generates literature reviews...
Tags: [ai, research, automation]
URL: nodsocial.com/shout/yourname
```

## Notes

- Shouts are public by default. Use `shout_settings` to change visibility.
- The agent extracts title, summary, and tags automatically.
- View any user's page at `nodsocial.com/shout/USERNAME`.
