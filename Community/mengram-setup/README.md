# Mengram Memory System for Zo Computer

A human-like memory system for AI agents with semantic, episodic, and procedural memory. Self-hosted on your Zo Computer with full data sovereignty.

## Features

- 🧠 **Three Memory Types**: Semantic (facts), Episodic (events), Procedural (workflows)
- 🔍 **Hybrid Search**: Vector + knowledge graph retrieval
- 📈 **Procedure Evolution**: Workflows automatically improve from failures
- 🔐 **Security**: API key authentication for all endpoints
- 🏠 **Fully Local**: Ollama for LLM, local embeddings, SQLite storage
- 🤖 **Zo Integration**: Works with Zo's unified memory system

## Quick Start

```bash
# Install the skill
cd /home/workspace/Skills/mengram-setup/scripts
python3 setup.py install

# The setup will:
# 1. Clone Mengram from GitHub
# 2. Create configuration
# 3. Generate API key
# 4. Create vault directory
# 5. Set up CLI tools
```

## Requirements

- Python 3.10+
- Ollama (for local LLM)
- 4GB RAM minimum
- 2GB disk space

## Usage

### CLI

```bash
# Set API key
export MENGRAM_API_KEY=mg_your_key_here

# Check status
python3 mengram.py status

# Remember something
python3 mengram.py remember "Alice works at Google as a software engineer"

# Search memories
python3 mengram.py search "Alice"

# Get knowledge profile
python3 mengram.py profile
```

### REST API

```bash
# Health check
curl http://localhost:8420/api/health

# Remember text
curl -X POST http://localhost:8420/api/remember/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mg_your_key" \
  -d '{"text": "Bob prefers TypeScript for frontend."}'

# Search
curl -X POST http://localhost:8420/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mg_your_key" \
  -d '{"query": "programming preferences"}'
```

### Python

```python
import requests

API_URL = "http://localhost:8420"
API_KEY = "mg_your_key"
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

# Search
response = requests.post(
    f"{API_URL}/api/search",
    headers=HEADERS,
    json={"query": "editor preferences"}
)
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Health check |
| `/api/remember` | POST | Yes | Save conversation |
| `/api/remember/text` | POST | Yes | Save text |
| `/api/recall` | POST | Yes | Semantic search (context) |
| `/api/search` | POST | Yes | Structured search (JSON) |
| `/api/profile` | GET | Yes | User knowledge profile |
| `/api/stats` | GET | Yes | Vault statistics |
| `/api/graph` | GET | Yes | Knowledge graph |

## Configuration

Edit `~/mengram/config.yaml`:

```yaml
# LLM Provider
llm:
  provider: "ollama"
  ollama:
    base_url: "http://localhost:11434"
    model: "llama3.2"

# Or use OpenAI/Anthropic/OpenRouter
llm:
  provider: "openrouter"
  llm_settings:
    model: "anthropic/claude-3-haiku"

# Semantic search
semantic_search:
  enabled: true
  embedding_model: "all-MiniLM-L6-v2"
```

## Security

- All endpoints require API key authentication (except health check)
- Keys are 48-character secure random tokens
- Store keys in environment variables (`MENGRAM_API_KEY`)
  - On Zo Computer: Settings > Advanced > Secrets
- Keys are **never** stored in files or committed to git
- Zo services automatically get HTTPS via edge proxy
- Localhost bypass is disabled by default

## Zo Automation

Set up automatic memory for your Zo agent so memories are stored and retrieved implicitly:

### 1. Copy the memory client
```bash
cp /home/workspace/Skills/mengram-setup/scripts/mengram_memory.py /home/workspace/.zo/
```

### 2. Create a Memory-Enabled Persona
Create a persona with these key instructions in the prompt:
- Initialize memory at conversation start: `python3 /home/workspace/.zo/mengram_memory.py initialize`
- Recall during conversation: `python3 /home/workspace/.zo/mengram_memory.py recall "<query>"`
- Store important info: `python3 /home/workspace/.zo/mengram_memory.py remember "<info>"`

### 3. Create Automation Rules
- **Initialization Rule** (condition: "At the start of a new conversation"):
  Runs `mengram_memory.py initialize` to load context
- **Storage Rule** (condition: "When user shares important information"):
  Runs `mengram_memory.py remember` to store knowledge proactively

### 4. Health Check Agent (optional)
Create a daily scheduled agent that runs:
```bash
python3 /home/workspace/.zo/mengram_memory.py health
python3 /home/workspace/.zo/mengram_memory.py status
```

## Files

```
mengram-setup/
├── SKILL.md              # Skill definition
├── scripts/
│   ├── setup.py          # Installation script
│   ├── mengram.py        # CLI tool
│   ├── mengram_memory.py # Zo automation client
│   └── security.py       # API key management
├── references/
│   ├── api.md            # Full API documentation
│   └── architecture.md   # System architecture
└── assets/               # Static resources
```

## License

Mengram is Apache 2.0 licensed.
See https://github.com/alibaizhanov/mengram

## Credits

- Mengram by [Ali Baizhanov](https://github.com/alibaizhanov)
- Zo Skill by your-handle.zo.computer
