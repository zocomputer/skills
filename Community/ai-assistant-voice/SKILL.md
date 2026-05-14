---
name: ai-assistant-voice
description: >
  Full-screen voice AI PWA for any Zo persona, wired to OpenAI Realtime GA with
  **native MCP**. GPT-Realtime-2 calls your remote MCP server directly — no
  per-tool orchestrator hop. Three tool packs (essentials / power /
  power_with_writes) expose up to 36 Zo tools with approval gating on writes.
  Includes one-command installer for zo.space routes. Three TTS backends.
compatibility: Created for Zo Computer
metadata:
  author: marlandoj.zo.computer
  version: 3.1.0
  requires:
    - ZO_ASK_TOKEN (required — Zo access token for AI proxy, Settings > Advanced)
    - ZO_API_KEY (required — used by /api/<slug>-mcp to call api.zo.computer/mcp)
    - MCP_SHARED_TOKEN (required — shared secret authenticating OpenAI Realtime → /api/<slug>-mcp; env-var name is configurable via deploy flag --mcp-token-secret)
    - OPENAI_API_KEY (required for Realtime mode — GA token mint)
    - ELEVENLABS_API_KEY (optional — for ElevenLabs TTS backend)
    - MEMORY_DB_PATH (optional — absolute path to SQLite memory backend; default /home/workspace/.zo/memory/shared-facts.db; memory tools degrade gracefully if missing)
---

# AI Assistant Voice

Full-screen voice AI PWA — works with any persona on your Zo Computer.

## Architecture

This skill implements a **native MCP pipeline** with OpenAI Realtime GA:

```
┌─────────────┐     ┌─────────────────┐     ┌────────────────────┐
│  BROWSER    │◄───►│ GPT-Realtime-2  │◄───►│ /api/<slug>-mcp    │
│  (WebRTC)   │     │  (Audio brain)  │     │  (MCP server)      │
└─────────────┘     └─────────────────┘     └────────────────────┘
       │                    │                          │
       │  Speech in         │  Native MCP tool         │  Proxies to
       │  Audio out         │  config + approval       │  api.zo.computer/mcp
       │                    │                          │
       ▼                    ▼                          ▼
   Realtime GA API     Direct tool calls          36 Zo tools
   v1/realtime/calls   (no orchestrator hop)      in 3 packs
```

`<slug>` is the lowercased `--name` flag (default `voice`).

| Layer | Path | Purpose |
|---|---|---|
| **Audio** | `gpt-realtime-2` via WebRTC | Native speech→speech, ~300ms latency |
| **MCP server** | `/api/<slug>-mcp` on zo.space | JSON-RPC 2.0 endpoint exposing Zo tools to OpenAI |
| **Tool backend** | `https://api.zo.computer/mcp` | Upstream Zo tool execution |

**Why native MCP?** OpenAI Realtime GA speaks MCP over HTTP directly. Removing the orchestrator hop cuts per-tool latency, lets us expose 36 tools instead of 11, and adds first-class approval gating for write operations.

---

## Quick Install (recommended)

One command deploys everything: the PWA page + all API routes.

```bash
# 1. Save required secrets in Settings > Advanced first:
#    ZO_ASK_TOKEN, ZO_API_KEY, MCP_SHARED_TOKEN, OPENAI_API_KEY
#    (rename MCP_SHARED_TOKEN with --mcp-token-secret if you prefer)
# 2. Run with YOUR assistant name + YOUR persona id:
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts \
  --deploy-all \
  --name "Aria" \
  --path "/aria-voice" \
  --persona-id "<your-persona-uuid>"
```

The slug (`--name` lowercased; `aria` in this example) drives all route paths.

This deploys:
- `/aria-voice` — the voice PWA page (private, owner sign-in required)
- `/api/tts` — TTS proxy (keeps ElevenLabs key server-side)
- `/api/aria-ask` — Zo ask proxy (keeps ZO_ASK_TOKEN server-side)
- `/api/aria-bootstrap` — HMAC session-token issuer (24h TTL)
- `/api/realtime-session` — OpenAI Realtime GA API token endpoint + MCP tool config
- `/api/aria-mcp` — MCP server exposing Zo tools (v3.0+)
- `/api/aria-personas` — Dynamic persona catalog (`list_personas` MCP, 5-min ETag cache)

After deploying, open `https://yourhandle.zo.space/aria-voice`.

### Options

| Flag | Default | Description |
|---|---|---|
| `--name "Aria"` | `My Assistant` | Assistant display name; sets the route slug (`/api/<slug>-*`) |
| `--path "/aria"` | `/ai-assistant-voice` | URL path for the PWA page |
| `--persona-id <uuid>` | *(none)* | Default persona (must be one of your Zo personas) |
| `--default-voice` | `alloy` | Fallback OpenAI voice when persona has no mapping |
| `--backend openai` | `elevenlabs` | TTS backend (elevenlabs/openai/edge) |
| `--host myhandle.zo.space` | Auto-detected | Override Zo Space hostname |

Find your persona ID at [Settings → AI → Personas](/?t=settings&s=ai&d=personas). The PWA's persona dropdown is populated at runtime from `list_personas` — your own personas, not anyone else's.

---

## Required Secrets

Add these in [Settings → Advanced → Secrets](/?t=settings&s=advanced):

| Secret | Required | Purpose |
|---|---|---|
| `ZO_ASK_TOKEN` | ✅ Yes | Zo access token — used by `/api/<slug>-ask` + HMAC session-token issuer. |
| `ZO_API_KEY` | ✅ Yes | Used by `/api/<slug>-mcp` + `/api/<slug>-personas` to call `api.zo.computer/mcp`. |
| `MCP_SHARED_TOKEN` | ✅ Yes | Shared secret. Sent by `/api/realtime-session` in the MCP server_url query, validated by `/api/<slug>-mcp`. Generate via `openssl rand -hex 32`. **Env-var name is configurable** — pass `--mcp-token-secret YOUR_NAME` to the deploy script (e.g. `ARIA_MCP_TOKEN`) and save the secret under that name. |
| `OPENAI_API_KEY` | For Realtime mode | GPT-Realtime-2 GA token mint |
| `ELEVENLABS_API_KEY` | If using ElevenLabs TTS | From elevenlabs.io → Profile → API Keys |
| `MEMORY_DB_PATH` | Optional | Absolute path to a SQLite memory backend (default `/home/workspace/.zo/memory/shared-facts.db`). Powers the `memory_search` + `list_open_loops` tools. Missing file = those tools return "memory not configured"; everything else still works. |

---

## TTS Backends

| Backend | Quality | Cost | Secret |
|---|---|---|---|
| ⭐ **ElevenLabs** *(default)* | Best — natural, expressive | ~$0.30/1K chars | `ELEVENLABS_API_KEY` |
| **OpenAI TTS** | Very good — 6 voices | ~$0.015/1K chars | `OPENAI_API_KEY` |
| **edge-tts** | Good — 300+ Neural voices | Free forever | None |

### edge-tts (no API key)

```bash
bash /home/workspace/Skills/ai-assistant-voice/scripts/setup-edge-tts.sh
bun deploy-tts-endpoint.ts --deploy-all --backend edge
```

---

## Tool Packs

`/api/realtime-session` accepts a `pack` field in the POST body that selects which tools the model can call. The PWA defaults to `essentials`.

| Pack | Tools | Use case |
|---|---|---|
| `essentials` | 19 read-only | Default. Calendar, mail read, search, memory recall, open-loops. |
| `power` | 28 read/light-write | Adds richer search, file reads, agent listings. No destructive actions. |
| `power_with_writes` | 36 incl. writes | Full surface. Writes (`create_agent`, `edit_agent`, `create_automation`, `write_space_route`, `publish_site`, `send_email`, `send_sms`, etc.) require approval per call. |

To switch packs, change the PWA's `pack` arg to `connectRealtime` (currently hard-coded to `"essentials"` at the call to `/api/realtime-session`).

---

## Realtime Mode

Realtime mode uses **GPT-Realtime-2** with native MCP tool access.

### How it works

1. **Connect** → Browser requests ephemeral token + MCP tool config from `/api/realtime-session`
2. **MCP config** → Session response includes `tools: [{type: "mcp", server_label: "<slug>", server_url: "...?t=<shared-secret>", allowed_tools, require_approval}]` (secret read from the env var configured via `--mcp-token-secret`, default `MCP_SHARED_TOKEN`)
3. **WebRTC** → Browser exchanges SDP with `api.openai.com/v1/realtime/calls`
4. **Tool discovery** → OpenAI calls `tools/list` on `/api/<slug>-mcp`; emits `mcp_list_tools` event
5. **Listen & respond** → User speaks; GPT-Realtime-2 calls MCP tools directly when needed
6. **Approval (writes only)** → For `power_with_writes`, write tools emit `mcp_approval_request`; the PWA must call `mcp_approval_response` to authorize

### Auth (why the token is in the URL)

The zo.space Cloudflare proxy strips `Authorization: Bearer` headers. OpenAI Realtime's MCP integration only supports `authorization` (which maps to that header). The workaround is a query-param token (`?t=<shared-secret>`) baked into `server_url`. OpenAI redacts path/query from stored logs.

`/api/<slug>-mcp` accepts the token in this order:
1. `X-Mcp-Token` header (preferred for direct callers)
2. `Authorization: Bearer ...` (works on origins that don't strip it)
3. `?t=` query (Realtime path)

### Event flow

```
[input_audio_buffer.speech_started]  → isRecording = true
[input_audio_buffer.speech_stopped]  → isRecording = false
[session.updated]                    → confirm tools loaded
[mcp_list_tools]                     → log discovered tools (debug)
[response.output_item.added]         → if item.type==='mcp_call', show "Calling X" + nudge
[response.output_item.done]          → if item.type==='mcp_call', show result/error
```

---

## Native MCP Migration (v3.0)

v3.0 swaps the per-tool orchestrator hop for native MCP. The PWA no longer touches tool execution.

| | v2.2 (Orchestrator) | v3.0 (Native MCP) |
|---|---|---|
| Tool config | Inline `tools: [function...]` at session.update | Single `{type: "mcp", server_url}` reference |
| Tool count | 11 (one per function definition) | Up to 36 via `allowed_tools` filter |
| Tool execution | Browser → `/api/<slug>-orchestrator` → Zo | OpenAI → `/api/<slug>-mcp` → Zo (no browser hop) |
| PWA tool event | `response.function_call_arguments.done` | `response.output_item.added/done` w/ `item.type==='mcp_call'` |
| Writes | Either always-on or omitted | Per-call approval via `require_approval` |
| Pack tiering | No | Yes (essentials / power / power_with_writes) |

The PWA's `handleToolCall` and `ORCHESTRATOR_ENDPOINT` are gone. Slow-tool nudges still fire — wired to `response.output_item.added` so they speak while the MCP call is in flight.

---

## TTS-Only Deploy

If you only need the TTS proxy (not the full PWA):

```bash
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts
```

---

## CLI

```bash
cd /home/workspace/Skills/ai-assistant-voice/scripts

# List available ElevenLabs voices
bun ai-assistant-voice.ts voices

# Save a persona voice config
bun ai-assistant-voice.ts config set \
  --persona <your-persona-id> \
  --name "My Assistant" \
  --voice ErXwobaYiN019PkySvjV

# List saved configs
bun ai-assistant-voice.ts config list

# Speak text
bun ai-assistant-voice.ts speak "Hello." --voice ErXwobaYiN019PkySvjV
```

---

## PWA Features

- Full-screen mobile-friendly UI with push-to-talk and hands-free modes
- Wake word activation ("Hey [name]") when tab is active
- Classic mode: Speech → Zo proxy → AI response → TTS (full context + memory)
- **Realtime Mode (Native MCP)**: GPT-Realtime-2 calls Zo tools directly via `/api/<slug>-mcp`
- Tool packs: choose `essentials` (read-only) up to `power_with_writes` (36 tools, approval-gated)
- Persona selector — switch between any of your Zo personas mid-session
- New session button — clear conversation history
- Falls back to browser Web Speech API if TTS is unavailable

## Voice Config File

Configs are saved to `~/.zo/voice/persona-voices.json`:
```json
{
  "personas": [
    { "id": "<your-persona-id>", "name": "My Assistant", "voiceId": "ErXwobaYiN019PkySvjV" }
  ]
}
```

---

## Troubleshooting

| Symptom | Root Cause | Fix |
|---|---|---|
| Model never calls tools | MCP server unreachable from OpenAI | Check console for `mcp_list_tools`. Test manually: `curl -X POST 'https://<host>/api/<slug>-mcp?t=<token>' -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` |
| `Unauthorized` from `/api/<slug>-mcp` | MCP shared secret missing or wrong | Verify your token secret is set (default name `MCP_SHARED_TOKEN`, or whatever you passed to `--mcp-token-secret`); both the MCP route and `/api/realtime-session` read `process.env[<that name>]` |
| `memory_search` returns "memory not configured" | `MEMORY_DB_PATH` points to a missing file (default `/home/workspace/.zo/memory/shared-facts.db`) | Either install a Zo memory backend at the default path, or point `MEMORY_DB_PATH` at your own SQLite DB exposing `facts`/`facts_fts`/`open_loops` tables |
| `Authorization: Bearer ...` works locally but not from OpenAI | zo.space proxy strips it | Use `?t=` query-param token (the default for v3.0) |
| Write tool runs without approval | Pack is `essentials` or `power` (no writes), or `require_approval` is `"never"` | Use `power_with_writes` pack and confirm `require_approval` includes `{always: {tool_names: [...]}}` |
| `"Unknown parameter: 'model'"` | Sending `model` to `/client_secrets` | Bare `POST {}` — config goes in `tools` instead |
| "No ephemeral token" | Token field path mismatch | GA uses `session.value` directly |

---

## Historical Notes

- **v2.1.0**: Single-model Realtime with `gpt-4o-mini-realtime-preview` via `/v1/realtime/sessions`. Tools pre-configured at token mint time.
- **v2.2.0**: Multi-model hybrid with `gpt-realtime-2` GA API. Personality + 11 function tools injected via data channel. `/api/<slug>-orchestrator` mediates Zo tool calls.
- **v3.0.0**: Native MCP. `/api/<slug>-mcp` exposes 36 Zo tools to OpenAI Realtime directly. Orchestrator removed from the hot path. Tool packs + approval gating added. Query-param token auth (zo.space proxy strips `Authorization`).
- **v3.1.0**: Public-repo hardening. MCP shared-secret env var is configurable (`--mcp-token-secret`, default `MCP_SHARED_TOKEN`). Memory backend is pluggable via `MEMORY_DB_PATH` with graceful degradation. Architecture diagram cleanup. Header rename: `X-Alaric-Token` → `X-Mcp-Token`.
