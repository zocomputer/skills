---
name: agent-model-healer
description: |
  Self-healing watchdog that monitors model health across all Zo scheduled agents.
  When a model fails (402 credits, 429 rate limit, 503 unavailable, timeout), the
  healer automatically switches affected agents to the next healthy fallback model.
  When the original model recovers, it restores agents to their preferred model.
  Sends a daily heartbeat email so you know it's still running.
compatibility: Created for Zo Computer
metadata:
  author: marlandoj.zo.computer
  category: Community
  version: 2.1.0
---

## Agent Model Healer

Self-healing model fallback system for Zo scheduled agents.

### Problem

Zo scheduled agents are configured with a single model. When that model becomes unavailable
(insufficient credits, rate limits, provider outage), the agent fails silently.
There is no platform-level retry or fallback.

### Solution

A watchdog agent on `zo:fast` runs `healer.ts auto` every 30 minutes. The script is fully autonomous — all orchestration uses **direct MCP API calls** (zero model cost). The only AI cost is the probe prompts (~5 tokens per model).

1. **Probe** — Tests all configured models with a tiny prompt via `/zo/ask`
2. **List** — Fetches agents via direct MCP `list_agents` (zero cost)
3. **Heal** — Switches agents on unhealthy models via direct MCP `edit_agent` (zero cost)
4. **Restore** — When original models recover, restores agents to their preferred model
5. **Notify** — Sends email only when switches or restores happen
6. **Heartbeat** — Sends a daily "still alive" email with model health summary. If you stop receiving it, the healer or Zo platform is down.
7. **State** — Tracks all switches in a state file for audit

### Setup

1. Install the skill to `Skills/agent-model-healer/`
2. Edit `assets/fallback-chain.json` to add your models and fallback chains (see Configuration below)
3. Create a scheduled agent:
   - **Instruction:** `Run the model healer: bun Skills/agent-model-healer/scripts/healer.ts auto`
   - **Schedule:** Every 30 minutes
   - **Model:** `zo:fast` (critical — see Safety below)
4. After creating the agent, copy its agent ID into the `healerAgentId` field in `assets/fallback-chain.json`

### Usage

```bash
# Full autonomous pipeline (what the scheduled agent runs)
bun Skills/agent-model-healer/scripts/healer.ts auto

# Check model health
bun Skills/agent-model-healer/scripts/healer.ts probe

# See current state (active switches, probe results)
bun Skills/agent-model-healer/scripts/healer.ts status

# Show unhealthy models and active switches
bun Skills/agent-model-healer/scripts/healer.ts diagnose
```

### Safety: Watchmen Independence Rule

**The healer agent MUST run on `zo:fast` (or another Zo-native model) that is NOT in any fallback chain it monitors.**

If the healer shares a model with the agents it heals, a single provider outage kills both the healer and its patients — a cascade where nothing can self-repair.

This is enforced two ways:
- The `healerAgentId` field in config prevents the healer from switching its own model
- A title-based pattern match (`/model healer/i`) acts as a backup safety net

### Configuration

Edit `assets/fallback-chain.json`:

- **`healerAgentId`** — The agent ID of the healer's own scheduled agent (so it never switches itself)
- **`fallbackChains`** — Map of model ID → label + ordered fallback list. When a model is unhealthy, agents on that model are switched to the first healthy fallback.
- **`modelLabels`** — Human-readable names for model IDs (used in emails and logs)
- **`probeConfig`** — Probe prompt, timeout, retry count, and latency thresholds

Example fallback chain entry:
```json
"byok:your-model-id": {
  "label": "My Primary Model",
  "fallbacks": [
    "byok:backup-model-id",
    "zo:smart"
  ]
}
```

`zo:smart` is the last-resort fallback if no chain fallback is healthy.

### Files

- `scripts/healer.ts` — Main healer engine (auto, probe, diagnose, status)
- `assets/fallback-chain.json` — Fallback chain config and model labels
- `~/.healer/state.json` — Runtime state (switches, probe results, heartbeat timestamp)
- `/dev/shm/agent-model-healer.log` — Operational log (auto-trimmed to 500 lines)
