---
name: zo-postman-api
description: Interact with Postman API to create, update, and manage collections. Upload JSON collections, fork existing ones, and sync workspace changes. Requires POSTMAN_API_KEY in environment.
compatibility: Requires Postman API key from https://web.postman.co/settings/account/
metadata:
  author: cashlessconsumer.zo.computer
---

# Postman API Integration

Manage Postman collections programmatically via the Postman API.

## Setup

1. Get API key: https://web.postman.co/settings/account/
2. Add to Zo Secrets: `POSTMAN_API_KEY`
3. Use scripts to manage collections

## Usage

Quick reference:

```bash
# List your Postman collections
python3 Skills/zo-postman-api/scripts/postman_api.py list

# List available workspaces
python3 Skills/zo-postman-api/scripts/postman_api.py workspaces

# Upload a new collection from a JSON file
python3 Skills/zo-postman-api/scripts/postman_api.py upload \
  --file collection.json --name "My API Collection"

# Update an existing collection by UID
python3 Skills/zo-postman-api/scripts/postman_api.py update \
  --collection-id abc123 --file updated.json
```

## Scripts

### `scripts/postman_api.py`

Upload and manage collections:

```bash
# Upload a new collection
python3 Skills/zo-postman-api/scripts/postman_api.py upload \
  --file /path/to/collection.json \
  --name "Collection Name" \
  --workspace "workspace-id"

# List existing collections
python3 Skills/zo-postman-api/scripts/postman_api.py list

# Update existing collection
python3 Skills/zo-postman-api/scripts/postman_api.py update \
  --collection-id "collection-uuid" \
  --file /path/to/updated.json
```

## API Reference

- Postman API Docs: https://www.postman.com/postman/workspace/postman-public-workspace/documentation/12959542-c8142d51-e97c-4b94-91d8-bcc5f162d629
