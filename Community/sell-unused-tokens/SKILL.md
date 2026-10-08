---
name: sell-unused-tokens
description: List leftover LLM API credits on tokensto.cash with its secret-safe local CLI. Use when the user wants to sell unused or included OpenRouter, OpenAI, Anthropic, Gemini, Venice, Capminal, DeepSeek, Groq, Mistral, or other supported provider capacity for USDC.
license: MIT
metadata:
  author: Galleon Labs
  version: "2.0.1"
  homepage: https://tokensto.cash/skills/sell-unused-tokens
---

# Sell unused tokens

List unused provider capacity through tokensto.cash without putting a provider key in chat, shell history, or browser automation. The bundled CLI accepts sensitive values only through hidden terminal prompts.

Requires Node.js 20+, a macOS or Linux terminal, and network access to https://tokensto.cash. Browser sign-in is used only to create a one-time pairing code.

## Completion

Done when the CLI reports a created or already-listed result for every requested model and `status` shows the listings. Mixed results are partial completion: preserve successful rows and report unresolved models. Cash-out is a separate manual action and is never part of the agent session.

## Stop conditions

Stop before pairing or asking for a key when:

- The user has not confirmed their provider terms allow resale, sharing, brokering, or monetization of unused capacity.
- The request is to bypass provider limits, billing controls, fraud checks, rate limits, or terms.
- The provider is not in `providers` and its URL is not already supported by Surplus Intelligence.
- The user asks the agent to paste a provider key or pairing code into chat, a command argument, a log, or a file.

Use confirmation already provided in the conversation; do not request it again. Before selling, obtain the provider and total daily USD budget from the user's request or ask for the missing value. Never invent a spending limit. Explain the specific unmet prerequisite when blocked; continue independent read-only work where possible.

## Run locally

Set `CLI` to the absolute path of this installed skill's script. Do not copy the script elsewhere.

```bash
CLI="<installed-skill-directory>/scripts/tokenstocash.mjs"
```

Run `node "$CLI" status` to check for a usable session. If unpaired or expired, run `node "$CLI" login` in the user's terminal and have them create a pairing code at https://tokensto.cash/agent in their normal browser. They enter it directly into the hidden prompt, never chat. The listing-only session expires after eight hours and is stored at `~/.config/tokenstocash/session.json` with mode `0600`. If direct user terminal input is unavailable, stop at this handoff; do not collect secrets through another channel.

Run `node "$CLI" providers` to resolve the requested provider. Untrusted providers reach only opted-in buyers; report this when `trusted` is false. With terms confirmation and budget established, run:

```bash
node "$CLI" sell <provider> --confirm-provider-terms --budget <daily-usd>
```

The CLI prompts for the provider key without echo, probes it, selects up to eight attainable text models, and lists one model per request. It never writes the key to disk. The total budget must be at least $0.50 per selected model and at most $10,000.

Optional controls:

```bash
node "$CLI" sell <provider> --confirm-provider-terms --budget 25 \
  --basis prepaid --models model-a,model-b --floor 0.10

node "$CLI" sell <provider> --confirm-provider-terms --budget 25 \
  --from 23:00 --until 08:00 --time-zone Europe/London
```

- `--basis`: `allowance`, `prepaid`, or `payg`; defaults to the provider's product default.
- `--models`: comma-separated model IDs returned by that key. Without it, the server's demand-ranked recommendation is used.
- `--floor`: cost multiplier from `0.02` to `1.2`. Autopilot is on by default; omit the flag to use its basis floor.
- `--base-url`: only for a custom or regional endpoint already supported by Surplus.
- `--from`, `--until`, `--time-zone`: optional leftover hours; supply all times together.

Run `node "$CLI" status` after listing. Report created, skipped, and failed models concisely, including any unresolved status check. Do not imply earnings or liquidity that the output does not establish. Follow the bounded retry guidance below rather than repeating successful work.

Run `node "$CLI" logout` only when the user wants to remove the local session.

## Authority boundary

The paired token can only discover supported providers, probe a credential, create listings, and read listing status. It cannot cash out, send USDC, change payout settings, pause, delete, or relist offers. Never try to work around that boundary. If the user wants to cash out, direct them to https://tokensto.cash/cash-out and leave wallet approval to them.

## Failures

Read `references/troubleshooting.md` for probe, listing, pairing, or status failures. Read `references/invariants.md` only when the user asks how credentials, pricing, or payouts work.
