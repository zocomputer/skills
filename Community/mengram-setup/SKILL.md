---
name: mengram-setup
description: Set up self-hosted Mengram memory system for AI agents with semantic, episodic, and procedural memory. Includes knowledge graph, hybrid search, and experience-driven procedure evolution.
category: "Data & Integrations"
metadata:
  author: your-handle.zo.computer
  emoji: 🧠
  emojis: ["🧠","💾","🔮"]
tags:
  - memory
  - ai-agents
  - knowledge-graph
  - self-hosted
  - rag
---
# Mengram Memory System Setup

A human-like memory system for AI agents with three memory types:
- **Semantic**: Facts about entities (who, what, where)
- **Episodic**: Events and experiences (when, what happened)
- **Procedural**: Workflows and procedures (how to)

## Features

- 🧠 **Knowledge Graph**: Entities, facts, and relations
- 🔍 **Hybrid Search**: Vector + graph retrieval
- 📈 **Procedure Evolution**: Workflows improve from failures
- 🔐 **Security**: API key authentication for all endpoints
- 🏠 **Fully Local**: Ollama for LLM, local embeddings, SQLite storage

## Quick Start

```bash
# Run the setup script
cd /home/workspace/Skills/mengram-setup/scripts
python3 setup.py install
```

## Requirements

- Python 3.10+
- Ollama (for local LLM)
- 4GB RAM minimum
- 2GB disk space

## What Gets Installed

1. **Mengram Engine**: Core memory extraction and storage
2. **REST API**: FastAPI server on port 8420
3. **Security Layer**: API key authentication
4. **CLI Tools**: Memory management commands

## Usage After Setup

```bash
# Check status
python3 /home/workspace/Skills/mengram-setup/scripts/mengram.py status

# Add memory
python3 /home/workspace/Skills/mengram-setup/scripts/mengram.py remember "Your text here"

# Search memories
python3 /home/workspace/Skills/mengram-setup/scripts/mengram.py search "query"

# Get cognitive profile
python3 /home/workspace/Skills/mengram-setup/scripts/mengram.py profile
```

## Configuration

Edit `~/mengram/config.yaml` to customize:
- LLM provider (ollama, openai, anthropic, openrouter)
- Embedding model
- Vault location
- API keys

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/remember` | POST | Save conversation |
| `/api/remember/text` | POST | Save text |
| `/api/recall` | POST | Semantic search |
| `/api/search` | POST | Structured search |
| `/api/profile` | GET | User knowledge profile |
| `/api/stats` | GET | Vault statistics |

All endpoints (except `/api/health`) require `Authorization: Bearer <api_key>` header.

## Files

- `scripts/setup.py` - Installation and configuration
- `scripts/mengram.py` - CLI for memory operations
- `scripts/mengram_memory.py` - Zo automation client (copy to `.zo/`)
- `scripts/security.py` - API key management
- `references/api.md` - Full API documentation
- `references/architecture.md` - System architecture

## Zo Automation Setup

After installation, set up automatic memory for your Zo agent:

1. **Copy the memory client** to your `.zo/` directory:
   ```bash
   cp scripts/mengram_memory.py /home/workspace/.zo/
   ```

2. **Create a Persona** with Mengram memory instructions (see README for template)

3. **Create an Initialization Rule** (condition: "At the start of a new conversation"):
   ```
   cd /home/workspace/.zo && source /root/.zo_secrets && python3 mengram_memory.py initialize
   ```

4. **Create a Storage Rule** (condition: "When user shares important information"):
   ```
   cd /home/workspace/.zo && source /root/.zo_secrets && python3 mengram_memory.py remember "<info>"
   ```

## Integration with Zo

Mengram integrates with Zo Computer via:
1. **REST API**: Call from any Zo agent or script
2. **Rules & Personas**: Automatic memory initialization and storage
3. **Scheduled Health Checks**: Monitor and auto-restart services

## License

Mengram is Apache 2.0 licensed. See https://github.com/alibaizhanov/mengram
