---
name: zo-mengram-memory
description: Run Mengram memory in daily use with gated recall/search, proactive remember patterns, and health checks for reliable operation.
category: Data & Integrations
compatibility: Created for Zo Computer
metadata:
  author: curtastrophe.zo.computer
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

## Proactive Patterns

### Procedural Extraction
After any successful multi-step task, extract verified workflows as procedural memories:
- **Prefix**: `PROCEDURAL: <Topic>`
- **Content**: Exact command sequences, tool parameters, and stable outcomes.
- **Trigger**: Success state reached.

### Environmental Anchoring
At session start, read the workspace knowledge map to anchor context:
- **File**: `file '/home/workspace/.zo/KNOWLEDGE_MAP.md'`
- **Action**: Anchor to projects and skills without manual disk searches.

## Reflexive Safety (L4 Gated)

### SMS Guardrail
- **Rule**: NEVER send SMS if `new_tasks == 0` or any technical error occurs.
- **Recall**: Triggered automatically via gated recall before notification tasks.

### Anti-Hallucination
- **Rule**: NEVER fabricate data to demonstrate format. Report "No results" honestly.
- **Recall**: Triggered before any data extraction/reporting task.

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

## Shared references

API, architecture, and security docs live in `zo-mengram-setup/references/` to avoid duplication.
Consult those when troubleshooting or extending the setup.
