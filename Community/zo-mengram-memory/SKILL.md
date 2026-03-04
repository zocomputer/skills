---
name: zo-mengram-memory
description: Run Mengram memory in daily use with gated recall/search, proactive remember patterns, and health checks for reliable operation.
category: Data & Integrations
compatibility: Created for Zo Computer
metadata:
  author: YOUR_HANDLE.zo.computer
  emoji: 🧩
  emojis: ["🧩", "🧠", "📡"]
tags:
  - memory
  - mengram
  - runtime
  - gated-recall
  - automation
---

# Zo Mengram Memory

Use this skill for day-to-day memory operations after setup is complete.

## Prerequisite

Install first with `zo-mengram-setup`.

## Runtime defaults

- Use gated endpoints by default:
  - `/api/recall/gated`
  - `/api/search/gated`
- Use raw endpoints only for break-glass troubleshooting:
  - `/api/recall`
  - `/api/search`

## Primary commands

```bash
cd /home/workspace/.zo && source /root/.zo_secrets
python3 mengram_memory.py initialize
python3 mengram_memory.py recall "<query>"
python3 mengram_memory.py remember "<text>"
python3 mengram_memory.py status
```

## Break-glass

```bash
python3 /home/workspace/.zo/mengram_memory.py recall-raw "<query>"
```

## Health workflow

Run daily checks for:
- API health
- auth enforcement
- gated skip/query behavior
- Ollama availability
