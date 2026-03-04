# Mengram Architecture

## Overview

Mengram is a human-like memory system for AI agents with three memory types:

```
┌─────────────────────────────────────────────────────────────┐
│                    Mengram Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Semantic   │    │   Episodic   │    │  Procedural  │  │
│  │    Memory    │    │    Memory    │    │    Memory    │  │
│  │              │    │              │    │              │  │
│  │ • Entities   │    │ • Events     │    │ • Workflows  │  │
│  │ • Facts      │    │ • Context    │    │ • Steps      │  │
│  │ • Relations  │    │ • Outcome    │    │ • Evolution  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                      Storage Layer                           │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    Vault     │    │ Vector Store │    │Knowledge Grph│  │
│  │  (Markdown)  │    │  (SQLite)    │    │   (SQLite)   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                     Processing Layer                         │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │Conversation  │    │   LLM        │    │   Hybrid     │  │
│  │  Extractor   │───▶│  (Ollama)    │◀───│    Search    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                       API Layer                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              FastAPI REST Server                      │  │
│  │                                                       │  │
│  │  /api/remember  /api/recall  /api/search  /api/stats │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                     Security Layer                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           API Key Authentication                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Memory Types

### 1. Semantic Memory (Facts)

Stores knowledge about entities:

```yaml
Entity: Alice
Type: person
Facts:
  - works as a software engineer at Google
  - uses Python and Go
Relations:
  - → works_at: Google
```

### 2. Episodic Memory (Events)

Stores experiences and events:

```yaml
Episode:
  Summary: "Deployed app to Railway"
  Context: "First deployment of my-app to Railway platform"
  Outcome: "Successful deployment"
  Participants: [my-app, Railway]
  Emotional_valence: positive
  Importance: 0.7
  Happened_at: 2024-01-15
```

### 3. Procedural Memory (Workflows)

Stores repeatable procedures with evolution:

```yaml
Procedure:
  Name: "Deploy to Railway"
  Trigger: "When deploying an app to Railway"
  Steps:
    - step: 1
      action: "Build the application"
    - step: 2
      action: "Run migrations"
    - step: 3
      action: "Push to Railway"
  Version: 2
  Evolution_log:
    - change: "Added migration step"
      reason: "Database crash due to missing migrations"
```

## Data Flow

### Remember Flow

```
User Message
    │
    ▼
┌─────────────────────┐
│ Conversation        │
│ Extractor (LLM)     │
│                     │
│ Input: text         │
│ Output: entities,   │
│         facts,      │
│         relations   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Vault Manager       │
│                     │
│ • Create .md files  │
│ • Update existing   │
│ • Link entities     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Vector Store        │
│                     │
│ • Generate embeds   │
│ • Index chunks      │
└─────────────────────┘
```

### Recall Flow

```
Query
    │
    ▼
┌─────────────────────┐
│ Vector Search       │
│                     │
│ • Embed query       │
│ • Find top-k chunks │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Graph Expansion     │
│                     │
│ • Find neighbors    │
│ • Multi-hop expand  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Context Assembly    │
│                     │
│ • Build rich context│
│ • Include artifacts │
└─────────────────────┘
          │
          ▼
      Response
```

## Storage

### Vault (Markdown Files)

```
vault/
├── Alice.md
│   ---
│   type: person
│   created: 2024-01-15
│   ---
│   
│   # Alice
│   
│   ## Facts
│   - works as a software engineer at Google
│   - uses Python and Go
│   
│   ## Relations
│   - → **works_at** [[Google]]
│
├── Google.md
└── Railway.md
```

### Vector Store (SQLite)

```sql
CREATE TABLE chunks (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    section TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    position INTEGER
);
```

### Knowledge Graph (SQLite)

```sql
CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    source_file TEXT
);

CREATE TABLE relations (
    id TEXT PRIMARY KEY,
    from_entity TEXT NOT NULL,
    to_entity TEXT NOT NULL,
    relation_type TEXT NOT NULL
);
```

## Procedure Evolution

Mengram's unique feature: procedures learn from failures.

```
Week 1: "Deploy" → build → push → deploy
                                   ↓ FAILURE: forgot migrations
Week 2: "Deploy" v2 → build → run migrations → push → deploy
                                                    ↓ FAILURE: OOM
Week 3: "Deploy" v3 → build → run migrations → check memory → push → deploy ✅
```

### Evolution Process

1. **Failure Detection**: Episode with negative outcome linked to procedure
2. **LLM Analysis**: Analyze what went wrong
3. **Version Creation**: New procedure version with fix
4. **Evolution Log**: Track changes and reasons

## Configuration

```yaml
# config.yaml

# Memory vault location
vault_path: "~/mengram/vault"

# LLM Provider
llm:
  provider: "ollama"  # ollama, openai, anthropic, openrouter
  ollama:
    base_url: "http://localhost:11434"
    model: "llama3.2"

# Semantic search
semantic_search:
  enabled: true
  embedding_model: "all-MiniLM-L6-v2"  # 384 dimensions, 80MB

# Security
security:
  enabled: true
  api_keys_file: "~/mengram/api_keys.json"

# Knowledge graph
graph:
  max_depth: 3
  min_relation_strength: 0.3
```

## Security Model

### API Key Authentication

All endpoints (except `/api/health`) require authentication:

```http
Authorization: Bearer mg_your_api_key
```

### Key Generation

Keys are generated with secure random:

```python
key = "mg_" + ''.join(secrets.choice(alphabet) for _ in range(44))
```

### Key Storage

Keys stored in JSON file:

```json
{
  "keys": [
    {
      "key": "mg_...",
      "created": "2024-01-15T10:00:00",
      "description": "Primary key"
    }
  ]
}
```

## Performance

### Scalability

- **Vault**: Tested up to 10,000 notes
- **Vector Store**: In-memory caching for fast search
- **Graph**: Efficient neighbor queries with indexes

### Latency

| Operation | Latency |
|-----------|---------|
| Remember (with LLM) | 2-5s |
| Search | <100ms |
| Profile | <50ms |

## Integration Points

### 1. REST API

Direct HTTP calls from any client.

### 2. CLI Tool

Command-line interface for scripts.

### 3. Zo Integration

- Unified memory system
- Scheduled health checks
- Auto-restart services

### 4. External Agents

API accessible to Claude Code, Cursor, or any external tool with valid API key.
