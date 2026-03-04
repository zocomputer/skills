# zo-mengram-memory

Operate Mengram in daily workflows with gated memory retrieval.

## Scope

This skill is for **runtime use**.

- initialize context at conversation start
- recall with gated endpoints by default
- remember important facts proactively
- run periodic health checks

## Prerequisite

Install with **zo-mengram-setup** first.

## Quick start

```bash
cd /home/workspace/.zo && source /root/.zo_secrets
python3 mengram_memory.py initialize
python3 mengram_memory.py recall "what are my current projects"
python3 mengram_memory.py remember "User prefers Telegram notifications"
python3 mengram_memory.py status
```

## Endpoint policy

Default:
- `POST /api/recall/gated`
- `POST /api/search/gated`

Break-glass:
- `POST /api/recall`
- `POST /api/search`
