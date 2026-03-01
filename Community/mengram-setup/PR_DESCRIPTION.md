# Add Mengram Memory System Skill

## Summary

This PR adds a new skill for setting up a self-hosted [Mengram](https://github.com/alibaizhanov/mengram) memory system on Zo Computer. Mengram provides human-like memory for AI agents with three memory types:

- **Semantic Memory** - Facts about entities (who, what, where)
- **Episodic Memory** - Events and experiences (when, what happened)
- **Procedural Memory** - Workflows and procedures (how to)

## Features

- **Self-hosted**: No external API dependencies for core functionality
- **REST API**: Full REST API with authentication for external access
- **Knowledge Graph**: Entities, relations, and knowledge artifacts
- **Semantic Search**: Vector embeddings for similarity-based retrieval
- **Procedural Evolution**: Procedures can evolve from failures
- **Security**: API key authentication with configurable access control

## Skill Structure

```
System/zo-mengram-setup/
├── SKILL.md              # Skill instructions and usage
├── README.md             # Comprehensive documentation
├── manifest.json         # Zo Skills Hub manifest entry
├── scripts/
│   ├── setup.py          # Installation and configuration script
│   ├── mengram.py        # CLI for memory operations
│   └── security.py       # API key management
├── references/
│   ├── api.md            # REST API reference
│   └── architecture.md   # System architecture overview
└── assets/
    └── config.yaml       # Configuration template
```

## Installation

```bash
cd Skills/zo-mengram-setup/scripts
python3 setup.py install
```

## Usage

After installation, the user can:

1. **Store memories**: `python3 mengram.py remember "Alice works at Google on Kubernetes"`
2. **Search memories**: `python3 mengram.py search "database issues"`
3. **Get profile**: `python3 mengram.py profile`
4. **Manage API keys**: `python3 security.py generate "description"`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/remember` | Save knowledge from conversation |
| `POST /api/recall` | Semantic search |
| `GET /api/profile` | User knowledge profile |
| `GET /api/stats` | Vault statistics |
| `GET /api/graph` | Knowledge graph visualization |

## Requirements

- Python 3.10+
- Ollama (optional, for local LLM)
- sentence-transformers (for embeddings)

## Testing

The skill has been tested with:
- Ollama llama3.2 for knowledge extraction
- sentence-transformers/all-MiniLM-L6-v2 for embeddings
- FastAPI REST API with authentication

## Documentation

See `README.md` for complete documentation including:
- Architecture overview
- API reference
- Configuration options
- Security best practices
- External agent access
