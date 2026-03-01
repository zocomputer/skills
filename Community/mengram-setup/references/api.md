# Mengram API Reference

## Overview

Mengram provides a REST API for AI memory operations. All endpoints (except health check) require authentication via Bearer token.

**Base URL**: `http://localhost:8420`

**Authentication**: `Authorization: Bearer <api_key>`

---

## Endpoints

### Health Check

```
GET /api/health
```

Check if the API is running. No authentication required.

**Response**:
```json
{
  "status": "ok",
  "version": "2.14.5",
  "auth": true
}
```

---

### Remember from Conversation

```
POST /api/remember
```

Extract and save knowledge from a conversation.

**Request**:
```json
{
  "conversation": [
    {"role": "user", "content": "I deployed my app to Railway today."},
    {"role": "assistant", "content": "Great! How did it go?"}
  ]
}
```

**Response**:
```json
{
  "status": "ok",
  "created": ["Railway", "my-app"],
  "updated": [],
  "knowledge_count": 1
}
```

---

### Remember from Text

```
POST /api/remember/text
```

Save knowledge from plain text.

**Request**:
```json
{
  "text": "Alice works as a software engineer at Google. She uses Python and Go."
}
```

**Response**:
```json
{
  "status": "ok",
  "created": ["Alice", "Google"],
  "updated": [],
  "knowledge_count": 0
}
```

---

### Semantic Search (Context)

```
POST /api/recall
```

Search memories and return rich context.

**Request**:
```json
{
  "query": "deployment issues",
  "top_k": 5
}
```

**Response**:
```json
{
  "query": "deployment issues",
  "context": "## Railway (service) [relevance: 0.85]\n- Platform for deploying apps\n- Used for my-app deployment\n..."
}
```

---

### Structured Search

```
POST /api/search
```

Search memories and return structured JSON results.

**Request**:
```json
{
  "query": "Alice programming languages",
  "top_k": 5
}
```

**Response**:
```json
{
  "query": "Alice programming languages",
  "results": [
    {
      "entity": "Alice",
      "type": "person",
      "score": 0.92,
      "facts": [
        "works as a software engineer at Google",
        "uses Python and Go"
      ],
      "relations": [
        {"type": "works_at", "target": "Google", "direction": "outgoing"}
      ],
      "knowledge": []
    }
  ]
}
```

---

### Get Entity

```
GET /api/entity/{name}
```

Get details for a specific entity.

**Response**:
```json
{
  "entity": "Alice",
  "type": "person",
  "facts": [
    "works as a software engineer at Google",
    "uses Python and Go"
  ],
  "relations": [
    {"type": "works_at", "target": "Google", "direction": "outgoing"}
  ],
  "knowledge": []
}
```

---

### User Profile

```
GET /api/profile
```

Get a comprehensive user knowledge profile.

**Response**:
```json
{
  "profile": "# User Knowledge Profile\n\n## People\n\n### Alice\n- works as a software engineer at Google\n- uses Python and Go\n..."
}
```

---

### Recent Knowledge

```
GET /api/knowledge/recent?limit=10
```

Get recent knowledge entries across all entities.

---

### Statistics

```
GET /api/stats
```

Get vault and graph statistics.

**Response**:
```json
{
  "vault": {
    "total_notes": 42,
    "total_facts": 156
  },
  "graph": {
    "total_entities": 42,
    "total_relations": 28
  }
}
```

---

### Knowledge Graph

```
GET /api/graph
```

Get the full knowledge graph as nodes and edges.

**Response**:
```json
{
  "nodes": [
    {
      "id": "Alice",
      "name": "Alice",
      "type": "person",
      "facts_count": 2,
      "knowledge_count": 0
    }
  ],
  "edges": [
    {
      "source": "Alice",
      "target": "Google",
      "type": "works_at",
      "description": ""
    }
  ]
}
```

---

### Full Vault Overview

```
GET /api/recall/all
```

Get complete vault overview with all entities and knowledge.

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Unauthorized",
  "detail": "Missing Authorization header. Include: Authorization: Bearer <api_key>"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid JSON, missing fields)
- `401` - Unauthorized (missing/invalid API key)
- `404` - Not Found
- `500` - Internal Server Error

---

## Example Usage

### curl

```bash
# Health check
curl http://localhost:8420/api/health

# Remember text
curl -X POST http://localhost:8420/api/remember/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mg_your_api_key" \
  -d '{"text": "Bob prefers TypeScript for frontend development."}'

# Search
curl -X POST http://localhost:8420/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mg_your_api_key" \
  -d '{"query": "programming preferences", "top_k": 5}'
```

### Python

```python
import requests

API_URL = "http://localhost:8420"
API_KEY = "mg_your_api_key"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}

# Remember
response = requests.post(
    f"{API_URL}/api/remember/text",
    headers=HEADERS,
    json={"text": "Carol uses VS Code as her editor."}
)
print(response.json())

# Search
response = requests.post(
    f"{API_URL}/api/search",
    headers=HEADERS,
    json={"query": "editor preferences", "top_k": 5}
)
for result in response.json()["results"]:
    print(f"{result['entity']}: {result['facts']}")
```

### JavaScript/TypeScript

```typescript
const API_URL = "http://localhost:8420";
const API_KEY = "mg_your_api_key";

async function remember(text: string) {
  const response = await fetch(`${API_URL}/api/remember/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ text }),
  });
  return response.json();
}

async function search(query: string) {
  const response = await fetch(`${API_URL}/api/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ query, top_k: 5 }),
  });
  return response.json();
}
```
