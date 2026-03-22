---
name: zo-mengram-setup
description: Install and secure a self-hosted Mengram memory stack on Zo Computer. Includes service setup, API auth, and starter documentation for local operation.
category: Data & Integrations
compatibility: Created for Zo Computer
metadata:
  author: curtastrophe.zo.computer
  emoji: 🧠
  emojis: ["🧠", "🔐", "⚙️"]
tags:
  - memory
  - mengram
  - self-hosted
  - setup
  - security
---

# Zo Mengram Setup

Use this skill to install and configure Mengram as a local, self-hosted memory service.

## What this skill covers

- Clone and install Mengram dependencies
- Configure local runtime (Ollama + API)
- Configure API key auth and safe defaults
- Verify health and auth enforcement
- Provide starter docs and operational checks

## What this skill does not cover

- Daily memory workflows in chat sessions
- Ongoing recall/store automation patterns

Use `zo-mengram-memory` for runtime operations.

## Primary commands

```bash
cd /home/workspace/Skills/zo-mengram-setup/scripts
python3 setup.py install
python3 security.py generate
python3 mengram.py status
```

## Post-setup verification

```bash
curl -s http://localhost:8420/api/health
curl -s http://localhost:8420/api/profile
curl -s -H "Authorization: Bearer $MENGRAM_API_KEY" http://localhost:8420/api/profile
```

Expected:
- health returns status ok
- unauthenticated profile is unauthorized
- authenticated profile succeeds

## Shared resources

The runtime CLI script (`mengram_memory.py`) lives in `zo-mengram-memory/scripts/`.
Reference docs (API, architecture, security) are maintained here in `references/` and shared by both skills.
