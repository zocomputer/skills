---
name: fabric
description: Interact with Fabric.so personal knowledge base - manage bookmarks, notes, files, folders, and search your knowledge library. Requires FABRIC_API_KEY secret.
category: Data & Integrations
compatibility: Created for Zo Computer
metadata:
  author: YOUR_HANDLE.zo.computer
  emojis: ["🧠", "📝", "📁"]
tags:
  - knowledge-base
  - notes
  - bookmarks
  - file-storage
  - personal-os
---

# Fabric.so Integration

Interact with your Fabric.so personal knowledge base through a comprehensive CLI tool.

## Setup

1. **Get API Key**: Visit [Fabric Settings > API Keys](https://fabric.so/settings/api-keys) to create a personal API key

2. **Add Secret**: Go to [Settings > Advanced](/?t=settings&s=advanced) and add:
   - Secret name: `FABRIC_API_KEY`
   - Value: Your Fabric API key

## Usage

```bash
bun Skills/fabric/scripts/fabric.ts <command> [options]
```

### Account

| Command | Description |
|---------|-------------|
| `me` | Get account details |

### Resources - List & Search

| Command | Description |
|---------|-------------|
| `list [--limit <n>] [--parent <id>] [--order <field>]` | List recent resources |
| `search <query> [--kinds <types>] [--tags <names>]` | Search your knowledge library |
| `get <id>` | Get a specific resource |
| `children <parentId>` | List children of a folder |

### Folders & Spaces

| Command | Description |
|---------|-------------|
| `roots` | List top-level folders (resource roots) |
| `folders [--parent <id>]` | List all folders |
| `create-folder <name> [--parent <id>]` | Create a new folder |
| `create-space <name>` | Create a new space (top-level folder) |

### Bookmarks

| Command | Description |
|---------|-------------|
| `create-bookmark <url> [--tags <names>] [--parent <id>]` | Add a bookmark |
| `update-bookmark <id> [--url <url>] [--name <name>] [--tags <names>]` | Update a bookmark |

### Notes

| Command | Description |
|---------|-------------|
| `create-note <name> [text] [--tags <names>] [--parent <id>]` | Create a note (markdown supported) |
| `update-note <id> [text]` | Replace note content |
| `append-note <id> <text>` | Append to existing note |

### Files

| Command | Description |
|---------|-------------|
| `upload <filepath> [--name <name>] [--parent <id>]` | Upload a file |

### Tags

| Command | Description |
|---------|-------------|
| `tags` | List all tags |

### Delete

| Command | Description |
|---------|-------------|
| `delete <id>` | Delete a resource |

## Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help message |
| `--json` | Output raw JSON response |
| `--limit <n>` | Limit number of results |
| `--parent <id>` | Parent folder ID or alias |
| `--tags <names>` | Comma-separated tag names |
| `--kinds <types>` | Filter by resource kind (bookmark, notepad, image, folder) |

## Aliases

Fabric supports special aliases for system folders:
- `@alias::inbox` - The Inbox folder (default parent for new resources)

## Examples

### Search and Retrieve
```bash
# Search for badminton-related content
bun Skills/fabric/scripts/fabric.ts search "badminton"

# Search only images
bun Skills/fabric/scripts/fabric.ts search "vacation" --kinds image

# List recent items
bun Skills/fabric/scripts/fabric.ts list --limit 20

# Get a specific resource
bun Skills/fabric/scripts/fabric.ts get abc123-uuid
```

### Create Content
```bash
# Create a quick note
bun Skills/fabric/scripts/fabric.ts create-note "Meeting Notes" "Discussed Q1 goals with team"

# Create a note with tags
bun Skills/fabric/scripts/fabric.ts create-note "Idea" "New product concept" --tags "ideas,work"

# Save a bookmark with tags
bun Skills/fabric/scripts/fabric.ts create-bookmark "https://example.com/article" --tags "reference,reading"

# Create a folder
bun Skills/fabric/scripts/fabric.ts create-folder "Projects" --parent "@alias::inbox"
```

### File Operations
```bash
# Upload a file to Inbox
bun Skills/fabric/scripts/fabric.ts upload ./report.pdf

# Upload with custom name
bun Skills/fabric/scripts/fabric.ts upload ./image.png --name "Vacation Photo"

# Upload to specific folder
bun Skills/fabric/scripts/fabric.ts upload ./document.docx --parent "folder-uuid"
```

### Modify Existing Content
```bash
# Append to a note
bun Skills/fabric/scripts/fabric.ts append-note "note-uuid" "Additional thoughts..."

# Update note content (replaces existing)
bun Skills/fabric/scripts/fabric.ts update-note "note-uuid" "New content"

# Update bookmark tags
bun Skills/fabric/scripts/fabric.ts update-bookmark "bookmark-uuid" --tags "new,tags"
```

## Rate Limits

Fabric API limits:
- **Personal API Key**: 10 requests/second per user
- **Developer API Key (Free)**: 1000 requests/hour
- **Developer API Key (Scale)**: 5000 requests/hour

The CLI automatically handles rate limiting with:
- Proactive request throttling
- Exponential backoff on 429 responses
- Automatic retries (up to 5 attempts)

## Error Handling

The CLI provides clear error messages for common issues:

| Error | Description |
|-------|-------------|
| `exceeds_storage_limit` | Storage quota exceeded |
| `exceeds_credit_limit` | Credit balance depleted |
| `429 Rate Limited` | Too many requests (auto-retries) |
| `404 Not Found` | Resource not found |
| `401 Unauthorized` | Invalid API key |

## File Uploads

File uploads use Fabric's 3-step process:
1. Request a signed upload URL
2. Upload file binary to signed URL
3. Create file resource in Fabric

**Limitations**:
- Maximum file size: 5GB
- Supported formats: All common file types
- Storage: Limited by subscription plan

## References

- Developer Docs: https://developers.fabric.so/developer-guide/getting-started
- API Reference: https://developers.fabric.so/api-reference
- Local API Notes: `references/api-notes.md`

## Files

```
Skills/fabric/
├── SKILL.md              # This file
├── scripts/
│   ├── fabric.ts         # CLI tool
│   ├── package.json
│   └── tsconfig.json
├── references/
│   └── api-notes.md      # API reference notes
└── assets/
    └── examples/         # Example files
```
