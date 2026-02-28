# Fabric.so API Reference Notes

Quick reference for Fabric.so API endpoints and concepts.

## Authentication

### Personal API Key
```
Header: X-Api-Key: <API_KEY>
```
- For personal usage
- Create at: https://fabric.so/settings/api-keys
- Rate limit: 10 requests/second per user

### Developer API Key
```
Header: X-Api-Key: <API_KEY>
Header: X-Fabric-Workspace-Id: <WORKSPACE_ID>
```
- For delegated workspaces
- Create at: https://developers.fabric.so/signin
- Rate limits: 1000/hr (Free) or 5000/hr (Scale)

## Base URL

```
https://api.fabric.so
```

## Key Endpoints

### Account
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/user/me` | GET | Get account details |

### Resources
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/resources/filter` | POST | List resources with ordering |
| `/v2/resources/search` | POST | Semantic + keyword search |
| `/v2/resources/{id}` | GET | Get resource by ID |
| `/v2/resources/{id}` | DELETE | Delete resource |

### Bookmarks
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/bookmarks` | POST | Create bookmark |
| `/v2/bookmarks/{id}` | PATCH | Update bookmark |

### Notes (Notepads)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/notepads` | POST | Create note (markdown only) |
| `/v2/notepads/{id}` | PATCH | Update note |

### Folders
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/folders` | POST | Create folder |
| `/v2/folders` | POST | List folders (with body filters) |

### Spaces
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/spaces` | POST | Create space (top-level folder) |

### Files
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/upload` | GET | Get signed upload URL |
| `/v2/files` | POST | Create file resource |

### Tags
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/tags` | GET | List all tags |

### Resource Roots
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/resource-roots` | GET | List top-level folders |

## Filesystem Structure

### Resource Types (kind property)
- `bookmark` - Web bookmark
- `notepad` - Note (markdown)
- `folder` - Container for resources
- `image` - Image file
- `file` - Generic file

### Resource Roots Types
1. **System** - Cannot create/delete (e.g., Inbox)
2. **Space** - User-created top-level folders
3. **Integration** - Auto-created for 3rd party connections

### Aliases
- `@alias::inbox` - Inbox folder ID

## File Upload Process

### Step 1: Get Signed URL
```
GET /v2/upload?filename=<name>&size=<bytes>
```
Returns: `{ url, headers, path }`

### Step 2: Upload Binary
```
PUT <signed_url>
Headers: <headers from step 1>
Body: file binary
```

### Step 3: Create Resource
```
POST /v2/files
{
  "attachment": { "path": "<path>", "filename": "<name>" },
  "parentId": "<id>",
  "mimeType": "<type>"
}
```

## Tags

### Assigning Tags on Creation
```json
{
  "tags": [
    { "name": "ideas" },
    { "id": "existing-tag-uuid" },
    { "name": "code snippets" }
  ]
}
```
- `{ "name": "..." }` - Creates new or uses existing
- `{ "id": "..." }` - Uses specific existing tag

## Search

### Basic Search
```json
{
  "text": "query",
  "pagination": { "page": 1, "pageSize": 20 }
}
```

### Search with Filters
```json
{
  "text": "query",
  "filters": {
    "kinds": ["image", "notepad"],
    "tags": ["work", "ideas"],
    "color": [50, 50, 200]
  }
}
```

## Error Codes

| Status | Detail | Description |
|--------|--------|-------------|
| 401 | - | Invalid API key |
| 403 | `exceeds_storage_limit` | Storage quota exceeded |
| 403 | `exceeds_credit_limit` | Credit balance depleted |
| 404 | - | Resource not found |
| 429 | - | Rate limit exceeded |

## Rate Limits

| Auth Type | Limit | Period | Scope |
|-----------|-------|--------|-------|
| Personal API Key | 10 | 1 second | Per user |
| Developer (Free) | 1000 | 1 hour | Per developer |
| Developer (Scale) | 5000 | 1 hour | Per developer |

## Limits

- Note content: Markdown only via API
- Max file size: 5GB
- Storage: Per subscription plan

## SDK

Official TypeScript SDK: `@fbrc/sdk`

```typescript
import { Fabric } from "@fbrc/sdk";

const api = new Fabric({
  apiKey: process.env.FABRIC_API_KEY,
});

// Examples
const user = await api.user.me();
const search = await api.resources.search({ text: "query" });
const bookmark = await api.bookmarks.create({
  url: "https://example.com",
  parentId: "@alias::inbox",
});
```

---

*Last updated: 2026-02-26*
