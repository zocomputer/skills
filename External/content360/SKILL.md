---
name: content360
description: Integrates with Content360 (app.content360.io) to create, schedule, and publish social media content across Facebook, LinkedIn, X, Instagram, YouTube, TikTok, Pinterest, Reddit, and more. Supports post creation, scheduling, analytics, media upload, and inbox management. Built on MixPost/Laravel + Inertia.js.
compatibility: Created for Zo Computer
metadata:
  author: jaknyfe.zo.computer
---
# Content360 Skill

## Authentication

Content360 uses a **session + bearer token** auth mechanism built on Laravel Sanctum + Inertia.js.

### Setup

1. **Get your bearer token** at `https://app.content360.io/os/profile/access-tokens`
2. **Set secrets in Zo**: [Settings → Advanced → Secrets](/?t=settings&s=advanced)
   - `CONTENT360_API_KEY` = your bearer token (e.g. `N4P1Rg...`)
   - `CONTENT360_ORG_ID` = your workspace UUID (e.g. `3f3006c0-a68f-4ac6-b4ee-c14d70356cbb`)
3. **Set your credentials** (for session auth):
   - `CONTENT360_EMAIL` = your login email
   - `CONTENT360_PASSWORD` = your login password

**Note**: Access tokens require an active web session to work. If the token returns 401, re-authenticate by logging in via the web interface or using the session login flow in `content360_sync.py`.

### Auth Flow

The API requires **all** of these headers on every request:
```
Authorization: Bearer {token}
X-Requested-With: XMLHttpRequest
X-Inertia: true
X-Inertia-Version: {version}       # from any authenticated page response
Accept: application/json
Content-Type: application/json
```

The `X-Inertia-Version` is a hash that changes on app updates. It's returned in every Inertia JSON response under the `X-Inertia-Version` response header. The script handles this automatically.

---

## Base URLs

- **App**: `https://app.content360.io`
- **API namespace**: `/os/api/{workspace}` (workspace = org UUID, e.g. `3f3006c0-a68f-4ac6-b4ee-c14d70356cbb`)
- **Web namespace**: `/os/{workspace}` (same routing, differs only by Accept header)

---

## API Endpoints

All require auth headers above. Responses are Inertia JSON.

### Posts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/os/api/{workspace}/posts` | List posts (paginated) |
| POST | `/os/api/{workspace}/posts` | Create post |
| GET | `/os/api/{workspace}/posts/{uuid}` | Get single post |
| PUT | `/os/api/{workspace}/posts/{uuid}` | Update post |
| DELETE | `/os/api/{workspace}/posts/{uuid}` | Delete single post |
| POST | `/os/api/{workspace}/posts/add-to-queue/{uuid}` | Add to queue |
| POST | `/os/api/{workspace}/posts/schedule/{uuid}` | Schedule queued post |
| POST | `/os/api/{workspace}/posts/approve/{uuid}` | Approve post |
| POST | `/os/api/{workspace}/posts/duplicate/{uuid}` | Duplicate post |

### Create Post Payload

```json
{
  "content": "Post text content",
  "accounts": ["126117", "126129"],
  "status": "draft",
  "versions": [
    {
      "account_id": 126117,
      "is_original": true,
      "content": [
        {
          "body": "<div>Post content</div>",
          "media": [],
          "url": "",
          "opened": true
        }
      ]
    }
  ]
}
```

- `status`: `"draft"` or `"schedule"`
- `accounts`: array of account IDs
- `versions`: per-account content blocks (body uses HTML)
- For plain text, use `"<div>text</div>"` in body

### Accounts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/os/api/{workspace}/accounts` | List all connected accounts |
| GET | `/os/api/{workspace}/accounts/{id}` | Get single account |

### Media

| Method | Path | Description |
|--------|------|-------------|
| GET | `/os/api/{workspace}/media` | List media library |
| POST | `/os/api/{workspace}/media` | Upload media |
| DELETE | `/os/api/{workspace}/media` | Delete media |

### Tags

| Method | Path | Description |
|--------|------|-------------|
| GET | `/os/api/{workspace}/tags` | List tags |
| POST | `/os/api/{workspace}/tags` | Create tag |
| PUT | `/os/api/{workspace}/tags/{id}` | Update tag |
| DELETE | `/os/api/{workspace}/tags/{id}` | Delete tag |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/os/{workspace}/calendar` | Calendar view |
| GET | `/os/{workspace}/posts/rss_campaigns` | RSS campaigns |
| GET | `/os/{workspace}/repeated-posts` | Repeated posts |
| GET | `/os/{workspace}/templates` | Templates |
| GET | `/os/{workspace}/inbox` | Inbox |
| POST | `/os/api/{workspace}/posts/import` | Import posts |

### Webhook Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/os/{workspace}/webhooks` | List webhooks |
| POST | `/os/{workspace}/webhooks/store` | Create webhook |
| PUT | `/os/{workspace}/webhooks/{id}` | Update webhook |
| DELETE | `/os/{workspace}/webhooks/{id}` | Delete webhook |

---

## Connected Accounts

Your workspace `3f3006c0-a68f-4ac6-b4ee-c14d70356cbb` has:
- **YouTube**: Noēsis (126117), D.E. Lowery (126118), Rhusty Ironheart (126116)
- **Instagram**: aaronlodge49 (126129), azchapter_demolay (22117)
- **Facebook**: Aaron Masonic Lodge #49 (6648), Arizona DeMolay Crusader Club (22114), Southern Arizona DeMolay (22115), Arizona Chapter of the Order of DeMolay (22116)
- **Instagram Direct**: delowery67 (126141)
- **Pinterest**: chrome67 (126151), cbhrhusty (126146)
- **TikTok**: DE Lowery (126130)
- **Reddit**: Chrome67 (126145)

---

## Running the Sync Script

```bash
# Dry run
python3 /home/workspace/Skills/content360/scripts/content360_sync.py --dry-run

# Real sync
python3 /home/workspace/Skills/content360/scripts/content360_sync.py

# Sync specific platforms
python3 /home/workspace/Skills/content360/scripts/content360_sync.py --platforms facebook,linkedin,youtube
```

The script reads from your Notion content calendar, creates posts in Content360 as drafts, and schedules them. See `README.md` for full setup instructions.
