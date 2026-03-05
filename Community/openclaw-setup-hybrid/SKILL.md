---
name: openclaw-setup-hybrid
description: Modular installer guide for OpenClaw using nytemode flow, zoclaw flow, or a hybrid path with secure defaults and provider options.
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
   - `gemini-oauth`
   - `zai-api`
   - `other-openai-compatible`
3. Messaging channel: `telegram`, `discord`, `whatsapp`, or `none`.
4. Security defaults confirmation:
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
3. Enforce full tool access:
   - `openclaw config set tools.profile full`
4. Configure channel chosen by user.
5. Configure model routing:
   - fast model as default
   - deep alias
   - fallback chain if requested
6. Add workspace guidance files:
   - `file TOOLS.md`
   - `file IDENTITY.md`
   - optional model-routing note in `file AGENTS.md`
7. Restart gateway and validate:
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

## Provider Modules

## gemini-oauth

1. Install Gemini CLI:
   - `npm install -g @google/gemini-cli`
2. User runs interactive OAuth login in terminal:
   - `gemini auth login`
3. Ensure OpenClaw Gemini auth plugin enabled.
4. Set model defaults and aliases with valid local catalog IDs.

## zai-api

1. Confirm `Z_AI_API_KEY` secret exists.
2. Configure Z.AI provider and model ID.
3. Validate by model status and first inference.

## other-openai-compatible

Collect and apply:

- base URL
- model ID
- API key secret var name

Validate by model status and first inference.

## Security Hardening Defaults

Apply these unless user opts out:

- Telegram DM policy: allowlist-only
- Telegram allowFrom: only approved IDs
- Telegram group policy: allowlist with empty list (effective deny)
- Tailscale exposure: tailnet-only, no public exposure
- Control UI origins: explicit allowlist only

Before applying, ask:\
"Apply hardened defaults now? This locks access to approved users only."

## Validation Checklist (must pass)

- `openclaw models status --plain`
- `openclaw channels list`
- `openclaw gateway probe`
- `tailscale status` (if zoclaw path used)
- `tailscale serve status` (if zoclaw path used)
- no pending pairing requests unless expected

If validation fails, diagnose root cause before retrying.

## Output Format

After completion, return:

1. path used
2. provider module used
3. hardening mode (enabled or custom)
4. validation results
5. next-step commands for user