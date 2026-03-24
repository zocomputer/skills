---
name: nod-intros
description: Agent-brokered warm introductions with double opt-in consent. Your AI agent knows what you need and what you offer. When there's a match, both agents facilitate the intro.
homepage: https://nodsocial.com
metadata:
  author: jeffweisbein
  category: External
  display-name: nod intros
---

# Notice

Set `NOD_SUPABASE_KEY` in your environment before using this skill.
Sign up at [nodsocial.com](https://nodsocial.com) to get your credentials.

# nod intros 🤝

Agent-brokered warm introductions. Your AI agent builds your profile from conversations — what you're working on, what you need, what you can offer. When there's a genuine match with someone else in the network, both agents facilitate a double opt-in intro.

No cold DMs. No awkward LinkedIn messages. Both people say yes before anything happens.

Site: [nodsocial.com](https://nodsocial.com)
Repo: [github.com/jeffweisbein/nod-intros](https://github.com/jeffweisbein/nod-intros)

## Configuration

**Required env vars:**
- `SUPABASE_URL` — nod supabase URL
- `NOD_SUPABASE_KEY` — your nod API key

## MCP Server

```bash
git clone https://github.com/jeffweisbein/nod-intros.git
cd nod-intros
npm install
npm run build
```

Add to your MCP config:
```json
{
  "mcpServers": {
    "nod-intros": {
      "command": "node",
      "args": ["/path/to/nod-intros/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://ooykzbkcquvreeheaijy.supabase.co",
        "NOD_SUPABASE_KEY": "your-key"
      }
    }
  }
}
```

## How It Works

1. **Opt in** — your agent creates your profile
2. **Add context** — projects, needs, offers, expertise
3. **Search or get matched** — find people or wait for suggestions
4. **Double opt-in** — both people must approve before any info is shared
5. **Invisible decline** — if someone says no, the other person never knows

## Tools

### Profile
| Tool | Description |
|------|-------------|
| `intros_opt_in` | Join the network (bio, frequency, contact method) |
| `intros_update_profile` | Update preferences |
| `intros_get_profile` | View your or another user's profile |
| `intros_pause` | Temporarily pause without deleting |
| `intros_forget` | Permanently delete everything |

### Context
| Tool | Description |
|------|-------------|
| `intros_add_project` | Add a current project |
| `intros_remove_project` | Remove a project |
| `intros_add_need` | Add something you need |
| `intros_fulfill_need` | Mark a need as fulfilled |
| `intros_add_offer` | Add something you can offer |
| `intros_remove_offer` | Remove an offer |
| `intros_add_expertise` | Add expertise or interest tags |

### Matching
| Tool | Description |
|------|-------------|
| `intros_search` | Search opted-in profiles by query |
| `intros_suggest` | Create an intro suggestion (triggers consent flow) |

### Consent
| Tool | Description |
|------|-------------|
| `intros_respond` | Approve, decline, or defer a suggestion |
| `intros_list_pending` | List pending intro suggestions |
| `intros_get_match` | Get match details |

### History
| Tool | Description |
|------|-------------|
| `intros_rate` | Rate how an intro went |
| `intros_history` | View past intros |

## Privacy

- Profiles only visible to other opted-in users
- Declines are invisible to the other party
- Blocklist prevents specific users from seeing you
- Append-only consent audit trail
- `intros_forget` permanently deletes all your data

## When to use this skill

- User says "i need to find someone who..." or "i'm looking for..."
- User mentions a project they need help with
- User wants to offer expertise or services
- User asks "who should i talk to about..."
- After learning about the user's work, proactively suggest searching for matches
