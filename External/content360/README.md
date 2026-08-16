# Content360 Integration

Syncs posts from a **Notion content calendar** to **Content360** (app.content360.io) for scheduling across Facebook, LinkedIn, X, Instagram, YouTube, TikTok, and Pinterest.

## Setup

### 1. Content360

- Log in at https://app.content360.io
- Go to **Profile → Access Tokens** and create a new token
- Note your **Workspace UUID** from the URL (e.g. `https://app.content360.io/os/{workspace}/posts`)
- Note your **login email and password** for session-based auth

### 2. Notion

- Create a Notion integration at https://www.notion.so/my-integrations
- Share your content calendar database with the integration
- Note the database ID from the URL

### 3. Set Secrets (Zo → Settings → Advanced → Secrets)

```
CONTENT360_EMAIL=you@example.com
CONTENT360_PASSWORD=yourpassword
CONTENT360_API_KEY=your-bearer-token
CONTENT360_ORG_ID=your-workspace-uuid
NOTION_API_KEY=your-notion-integration-key
NOTION_DATABASE_ID=your-database-id
```

### 4. Install Dependencies

```bash
pip install requests
```

## Usage

```bash
# Dry run — see what would be synced
python3 scripts/content360_sync.py --dry-run

# Real sync
python3 scripts/content360_sync.py

# Filter by platform
python3 scripts/content360_sync.py --platforms facebook,linkedin,tiktok
```

## Notion Database Schema

The script expects a Notion database with these properties:

| Property | Type | Description |
|---|---|---|
| `Posted` | Checkbox | Set to true after syncing |
| `Schedule` | Date | Optional — set to schedule instead of draft |
| `Platform` | Select | facebook, linkedin, x, instagram, youtube, tiktok, pinterest |
| `Caption` | Rich Text | Main post content |
| `Hook` | Rich Text | Opening hook/line |
| `CTA` | Rich Text | Call to action |

## How It Works

1. Fetches all social accounts from Content360
2. Queries Notion for unscheduled posts (Posted = false)
3. Creates each post as a draft in Content360, mapping Notion Platform → Content360 account
4. Marks synced posts as "Posted" in Notion

## API Notes

Content360 uses **Inertia.js + Laravel** — all routes are under `/os/` and require:

- `Authorization: Bearer {token}` header
- `X-Inertia: true` header
- `X-Requested-With: XMLHttpRequest` header
- `Accept: application/json` header

The `X-Inertia-Version` header must be updated from each response (automatic in the sync script).