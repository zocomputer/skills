---
name: superagent
description: Contact Aung's Superagent on Base44. Use this when you need to delegate tasks, ask for help with automations, data, or anything Superagent can handle.
---

## Usage

When asked to contact Superagent or delegate a task, send a POST request to your Superagent endpoint:

- **URL:** `https://<your-superagent>.base44.app/functions/zoMessage` (or any compatible endpoint)
- **Method:** `POST`
- **Content-Type:** `application/json`

**Setup:** Set environment variable `SUPERAGENT_BASE44_URL` to your endpoint URL before running scripts.

**Body:**
```json
{
  "message": "<your message or task here>",
  "sender": "Zo",
  "conversation_id": "<optional, use if continuing a thread>"
}
```

The response will contain a `"reply"` field with Superagent's response. Read it and relay it back.

## Scripts

- **Python:** `SUPERAGENT_BASE44_URL=https://... python3 scripts/superagent.py --message "..."`
- **TypeScript/Bun:** `SUPERAGENT_BASE44_URL=https://... bun run scripts/superagent.ts --message "..."`
- **From file:** `python3 scripts/superagent.py --file /path/to/message.txt`
- **From stdin:** `echo "message" | python3 scripts/superagent.py`
- **Raw JSON:** add `--raw` flag for full API response
