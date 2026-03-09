---
name: openclaw-setup-hybrid
description: Modular installer guide for OpenClaw using nytemode flow, zoclaw flow, or a hybrid path with secure defaults, provider options, workspace guidance files, MCP integrations, and 24/7 uptime.
category: "System & Admin"
compatibility: Created for Zo Computer
metadata:
  author: YOUR_HANDLE.zo.computer
  emoji: 🦞
  emojis: ["🦞","🔐","🛰️"]
tags:
  - openclaw
  - tailscale
  - zoclaw
  - telegram
  - gemini
  - oauth
  - security
  - mcporter
  - watchdog
  - workspace
---
# OpenClaw Setup Hybrid Skill

Use this skill when someone wants to install OpenClaw with one of three paths:

- `nytemode-only` (agent capability stack)
- `zoclaw-only` (Tailscale + Control UI hardening)
- `hybrid` (nytemode + zoclaw)

## Mandatory Preflight Questions

Ask and confirm before running anything:

1. Which path: `nytemode-only`, `zoclaw-only`, or `hybrid`?
2. Model provider method:
   - `gemini-oauth` (Google AI subscription, free inference)
   - `zai-api` (Z.AI coding plan, free inference)
   - `other-openai-compatible` (any OpenAI-compatible endpoint)
3. Messaging channel: `telegram`, `discord`, `whatsapp`, or `none`.
4. Agent identity: custom name/personality, or default?
5. MCP integrations: which Zo platform tools to bridge via mcporter?
6. Uptime mode: `manual` (start/stop yourself) or `watchdog` (24/7 auto-restart)?
7. Security defaults confirmation:
   - Telegram DM allowlist-only
   - Groups disabled
   - Tailscale tailnet-only

If the user declines defaults, ask for explicit alternatives.

## Attribution and Detailed Instruction

- nytemode OpenClaw guide: https://nytemode.zo.space/openclaw-zo-guide
- zoclaw: https://github.com/ssdavidai/zoclaw
- OpenClaw docs: https://docs.openclaw.ai
- Tailscale Serve docs: https://tailscale.com/kb/1242/tailscale-serve
- Gemini CLI docs: https://github.com/google-gemini/gemini-cli

## Execution Paths

## Path A. nytemode-only

Goal: agent capability stack without Tailscale Web UI layer.

1. Install and baseline:
   - `npm install -g openclaw@latest`
   - `npm install -g mcporter`
2. Run onboarding or configure auth provider.
3. Enforce full tool access in BOTH locations (required for tools to work):
   - Top-level: `tools.profile: "full"` and `tools.allow: ["*"]`
   - Agent defaults: `agents.defaults.tools.profile: "full"`
   - Exec config: `tools.exec.host: "gateway"`, `tools.exec.security: "full"`, `tools.exec.ask: "off"`
4. Configure channel chosen by user.
5. Configure model routing (see Model Routing section below).
6. Create workspace guidance files (see Workspace Files section below).
7. Optionally configure MCP integrations (see MCP Integrations section below).
8. Restart gateway and validate:
   - models status
   - channels status
   - gateway logs

## Path B. zoclaw-only

Goal: secure remote Control UI via tailnet.

1. Install zoclaw:
   - `npm install -g @ssdavidai/zoclaw`
2. Ensure Tailscale auth key is set in secrets.
3. Bootstrap:
   - `zoclaw bootstrap`
4. Start tailscaled in userspace mode if needed.
5. Enable Serve for control UI:
   - `tailscale serve --bg http://127.0.0.1:18789`
6. Pair/approve Control UI device when prompted.
7. Validate from CLI:
   - `tailscale serve status`
   - `openclaw gateway probe`

## Path C. hybrid (recommended)

Run Path A then Path B.

Order matters:

1. Complete nytemode core first.
2. Apply zoclaw bootstrap and Tailscale Serve second.
3. Re-verify model/channel config stayed intact.
4. Apply origin allowlist and pairing fixes for Control UI if needed.
5. Set up watchdog for 24/7 uptime (see Watchdog section below).

## Provider Modules

### gemini-oauth

1. Install Gemini CLI:
   - `npm install -g @google/gemini-cli`
2. User runs interactive OAuth login in terminal:
   - `gemini auth login`
3. Enable the OpenClaw Gemini auth plugin in `openclaw.json`:
   ```json
   "plugins": {
     "entries": {
       "google-gemini-cli-auth": { "enabled": true }
     }
   }
   ```
4. Add auth profile:
   ```json
   "auth": {
     "profiles": {
       "google-gemini-cli:USER_EMAIL": {
         "provider": "google-gemini-cli",
         "mode": "oauth"
       }
     }
   }
   ```
5. Set model defaults and aliases with valid local catalog IDs.

### zai-api

1. Confirm `Z_AI_API_KEY` secret exists (in `/root/.zo_secrets` or environment).
2. Configure Z.AI provider in `models.providers`:
   ```json
   "zai": {
     "baseUrl": "https://api.z.ai/api/coding/paas/v4",
     "api": "openai-completions",
     "models": [
       { "id": "glm-5", "name": "GLM-5", "reasoning": true },
       { "id": "glm-4.7", "name": "GLM-4.7", "reasoning": true }
     ],
     "apiKey": "ZAI_API_KEY"
   }
   ```
3. Validate by model status and first inference.

### other-openai-compatible

Collect and apply:

- base URL
- model ID
- API key secret var name

Validate by model status and first inference.

## Model Routing

Configure in `agents.defaults.models` and `agents.defaults.model`:

- **Primary model**: The default for all tasks (e.g., `google-gemini-cli/gemini-3-flash-preview`)
- **Aliases**:
  - `fast` — quick model for routine tasks
  - `deep` — reasoning model for complex planning
  - `GLM` — alternative provider alias (optional)
- **Fallback chain**: If primary fails, try next in order

Example configuration:
```json
"agents": {
  "defaults": {
    "model": {
      "primary": "google-gemini-cli/gemini-3-flash-preview",
      "fallbacks": ["zai/glm-5", "zai/glm-4.7"]
    },
    "models": {
      "google-gemini-cli/gemini-3-flash-preview": { "alias": "fast" },
      "google-gemini-cli/gemini-3-pro-preview": { "alias": "deep" },
      "zai/glm-5": { "alias": "GLM" }
    }
  }
}
```

Add a note in `AGENTS.md` so the agent knows:
> Default to `fast` for normal tasks. Use `deep` for complex reasoning, multi-step planning, or high-stakes decisions. If Gemini fails, rely on configured fallbacks automatically.

## Workspace Files

OpenClaw workspace files live at `/root/.openclaw/workspace/` (20,000 char limit per file). These give the agent persistent context and personality.

### Required Files

| File | Purpose |
|------|---------|
| `IDENTITY.md` | Agent name, personality, communication style |
| `TOOLS.md` | Available tools table with reference file paths |
| `AGENTS.md` | Session behavior, memory protocol, safety rules, heartbeat instructions |

### Recommended Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Core values, boundaries, personality depth |
| `USER.md` | Info about the user (name, timezone, preferences) |
| `HEARTBEAT.md` | Periodic check instructions (email, calendar, tasks) |
| `MEMORY.md` | Long-term curated memory (main session only) |
| `memory/` | Daily notes directory (`YYYY-MM-DD.md` files) |
| `refs/` | Tool reference docs (e.g., `refs/mcporter.md`) |

### IDENTITY.md Template

```markdown
# Identity

You are YOUR_AGENT_NAME, an AI assistant running on a Zo Computer.
You have shell, file, and web access plus Zo platform tools via mcporter.

Communication style:
- [Describe personality traits]
- [Describe tone: formal, casual, witty, etc.]
- [How to address the user]

Behavior:
- Be concise and execution-focused.
- Execute directly unless a task is destructive or missing required credentials.
- Prioritize safety, clarity, and practical next steps.
```

### AGENTS.md Key Sections

The AGENTS.md file should cover:

1. **Session startup protocol** — Read SOUL.md, USER.md, today's memory on every session
2. **Memory system** — Daily notes in `memory/YYYY-MM-DD.md`, curated long-term in `MEMORY.md`
3. **Safety rules** — No data exfiltration, `trash` > `rm`, ask before external actions
4. **Heartbeat behavior** — What to check (email, calendar, tasks), when to stay quiet (late night, nothing new)
5. **Group chat etiquette** — When to respond vs stay silent, reaction guidelines
6. **Platform formatting** — Discord/WhatsApp markdown differences

### HEARTBEAT.md Template

```markdown
# HEARTBEAT.md

- **Calendar:** Check primary calendar for upcoming events.
- **Email:** Check for urgent/important unread messages.
- **Tasks:** Review task lists for urgent reminders.
- **Proactive:** Identify upcoming deadlines or reminders.

# Track status in memory/heartbeat-state.json
```

### Heartbeat vs Cron

| Use Case | Heartbeat | Cron |
|----------|-----------|------|
| Batch multiple checks together | Yes | No |
| Exact timing required | No | Yes |
| Needs conversational context | Yes | No |
| Isolated task execution | No | Yes |
| One-shot reminders | No | Yes |

## MCP Integrations

Bridge Zo platform tools into OpenClaw via mcporter. Install mcporter if not already:

```bash
npm install -g mcporter
```

### Available Integrations

Each integration gets a reference doc in `workspace/refs/` and an entry in `TOOLS.md`:

| Integration | Tool | Purpose |
|-------------|------|---------|
| Zo Platform | mcporter | Gmail, Calendar, Drive, Notion, Linear, Spotify, media, web search, automation |
| TwinMind | twinmind MCP | Meeting memories, summaries, transcripts, action items |
| Mem AI | mem-ai MCP | AI-powered notes, semantic search, collections |
| Fabric.so | fabric MCP | Personal knowledge base — bookmarks, notes, files, tags |
| Raindrop.io | raindrop MCP | Bookmarks, collections, web clipping |
| Bika.ai | bika MCP | Database records, spaces, automations |
| CalendarJet | calendarjet MCP | Scheduling, bookings, availability |

### Adding a New MCP Integration

1. Register the MCP server (check docs for each tool).
2. Create a reference doc at `workspace/refs/<tool>.md` with usage examples and command syntax.
3. Add an entry to `workspace/TOOLS.md` table.
4. Test with a simple command to verify connectivity.

### TOOLS.md Template

```markdown
# Tools & Integrations

When you need to use a tool below, read its reference file first:
`cat /root/.openclaw/workspace/refs/<tool>.md`

## Available Tools

| Tool | Purpose | Reference |
|------|---------|-----------|
| **mcporter** | Bridge to Zo platform tools | `refs/mcporter.md` |
| **TwinMind** | Meeting memories and transcripts | `refs/twinmind.md` |
```

## Watchdog & 24/7 Uptime

For hybrid setups, a watchdog script manages both Tailscale and the OpenClaw gateway as a coordinated pair. This is preferred over a Zo registered service because:

- Manages two processes together (Tailscale + gateway)
- Tailscale must start before gateway
- No public HTTP port needed (access via Tailscale Serve)
- Doesn't consume a Zo service slot

### Watchdog Script

Create at `/root/.openclaw/watchdog.sh`:

```bash
#!/bin/bash
# OpenClaw + Tailscale watchdog - checks every 60s, restarts if dead
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
source /root/.zo_secrets 2>/dev/null

log() { echo "[$(date -u +%FT%TZ)] $1"; }

start_tailscale() {
    log "Starting tailscaled..."
    tailscaled --tun=userspace-networking \
        --state=/var/lib/tailscale/tailscaled.state \
        --socket=/var/run/tailscale/tailscaled.sock \
        >> /dev/shm/tailscaled.log 2>&1 &
    sleep 4
    tailscale up --authkey="${TAILSCALE_AUTHKEY}" \
        --hostname=zo-YOUR_HANDLE --accept-routes --reset 2>&1 || true
    sleep 2
    tailscale serve --bg http://127.0.0.1:18789 2>&1 || true
    log "Tailscale started."
}

start_gateway() {
    log "Starting OpenClaw gateway..."
    cd /root/.openclaw
    nohup openclaw gateway run >> /dev/shm/openclaw-gateway.log 2>&1 &
    sleep 5
    log "Gateway started (PID: $!)."
}

# Initial startup
if ! pgrep -x tailscaled > /dev/null; then start_tailscale; fi
if ! pgrep -f "openclaw-gateway" > /dev/null; then start_gateway; fi

log "Watchdog running. Checking every 60s."

while true; do
    sleep 60
    if ! pgrep -x tailscaled > /dev/null; then
        log "ALERT: tailscaled died. Restarting..."
        start_tailscale
    fi
    if ! pgrep -f "openclaw-gateway" > /dev/null; then
        log "ALERT: openclaw-gateway died. Restarting..."
        start_gateway
    fi
done
```

Make executable: `chmod +x /root/.openclaw/watchdog.sh`

### Boot Persistence

Add to `/root/.profile` so the watchdog starts on first shell:

```bash
# Auto-start OpenClaw + Tailscale watchdog if not already running
if ! pgrep -f 'openclaw/watchdog.sh' > /dev/null 2>&1; then
  nohup /root/.openclaw/watchdog.sh > /dev/shm/openclaw-watchdog.log 2>&1 &
fi
```

### Logs

- Watchdog: `/dev/shm/openclaw-watchdog.log`
- Gateway: `/dev/shm/openclaw-gateway.log`
- Tailscale: `/dev/shm/tailscaled.log`

## Security Hardening Defaults

Apply these unless user opts out:

- Telegram DM policy: allowlist-only
- Telegram allowFrom: only approved user IDs
- Telegram group policy: allowlist with empty list (effective deny)
- Tailscale exposure: tailnet-only, no public exposure
- Control UI origins: explicit allowlist only
- Gateway auth: token mode with `allowTailscale: true`
- Gateway bind: loopback only
- Trusted proxies: `127.0.0.1/32`

Before applying, ask:\
"Apply hardened defaults now? This locks access to approved users only."

### Gateway Configuration Reference

```json
"gateway": {
  "port": 18789,
  "mode": "local",
  "bind": "loopback",
  "controlUi": {
    "enabled": true,
    "allowedOrigins": ["https://YOUR_TAILNET_HOST", "http://127.0.0.1:18789"]
  },
  "auth": {
    "mode": "token",
    "token": "GENERATE_RANDOM_TOKEN",
    "allowTailscale": true
  },
  "trustedProxies": ["127.0.0.1/32"],
  "tailscale": { "mode": "serve" }
}
```

## Configuration Gotchas

Common issues and their fixes:

1. **`tools.profile` must be set in TWO places**: Both top-level `tools.profile` and `agents.defaults.tools.profile`. Missing either causes tool access to fail silently.
2. **Plugin entries**: The `google-gemini-cli-auth` plugin must be explicitly enabled in `plugins.entries` for Gemini OAuth to work.
3. **Streaming mode**: Set `channels.telegram.streaming: "partial"` for Telegram to show typing indicators.
4. **Compaction**: Set `agents.defaults.compaction.mode: "safeguard"` to prevent context loss in long conversations.
5. **Concurrency**: `agents.defaults.maxConcurrent: 4` and `agents.defaults.subagents.maxConcurrent: 8` are good defaults.

## Validation Checklist (must pass)

- `openclaw models status --plain`
- `openclaw channels list`
- `openclaw gateway probe`
- `tailscale status` (if zoclaw path used)
- `tailscale serve status` (if zoclaw path used)
- no pending pairing requests unless expected
- Watchdog running: `pgrep -f 'openclaw/watchdog.sh'`
- Gateway process alive: `pgrep -f 'openclaw-gateway'`

If validation fails, diagnose root cause before retrying.

## Output Format

After completion, return:

1. path used
2. provider module(s) configured
3. model routing (primary, aliases, fallbacks)
4. workspace files created
5. MCP integrations enabled
6. uptime mode (manual or watchdog)
7. hardening mode (enabled or custom)
8. validation results
9. next-step commands for user
