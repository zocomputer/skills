---
name: okx-cex-trade
description: Execute and manage OKX spot, perpetual, futures, and supported options trades on Zo. Use when the user wants to place, cancel, amend, or inspect tradable orders, but require explicit same-thread confirmation before any live execution.
compatibility: Created for Zo Computer
metadata:
  author: Zo
  category: Official
  display-name: OKX Trade
  version: "1.2.8"
  homepage: "https://www.okx.com"
---

# OKX Trade

Execute OKX trades on Zo with a strict quote, validate, confirm, execute flow.

## Preflight

Before running any OKX command in this session, follow `../_shared/preflight.md`.
Use `metadata.version` from this file as the comparison version for drift checks.

## What Zo Uses

- [Terminal](/?t=terminal) for `okx` trading commands
- [Settings > Advanced](/?t=settings&s=advanced) for OKX credentials stored as Zo secrets

## Credential Model

Zo secrets are the source of truth for:
- `OKX_API_KEY`
- `OKX_SECRET_KEY`
- `OKX_PASSPHRASE`

Generate local OKX config from those secrets if the CLI requires it. Do not ask the user to paste credentials into chat.

If the CLI needs a local config file, generate it from Zo secrets:

```bash
mkdir -p /root/.okx
cat > /root/.okx/config.toml <<EOF
default_profile = "demo"

[profiles.demo]
api_key = "${OKX_API_KEY}"
secret_key = "${OKX_SECRET_KEY}"
passphrase = "${OKX_PASSPHRASE}"
demo = true

[profiles.live]
api_key = "${OKX_API_KEY}"
secret_key = "${OKX_SECRET_KEY}"
passphrase = "${OKX_PASSPHRASE}"
EOF
```

## Non-Negotiable Safety Rules

- Never place a live trade without explicit same-thread confirmation.
- If the user’s profile is ambiguous, default to asking whether they mean `demo` or `live`.
- Always report which profile was executed.
- For derivatives, validate contract value before execution.

## Profiles

- `demo`: simulated funds
- `live`: real funds

If the user has not clearly specified one, ask.

## Required Execution Pattern

### 1. Quote / Validate

Before any write action:
- confirm market and side
- confirm amount or contract count
- confirm profile
- for derivatives, fetch contract information and validate sizing
- summarize back exactly what will happen

### 2. Confirm

Require explicit confirmation in the current conversation before executing any live write action.

For demo writes, still confirm if the order details are ambiguous.

### 3. Execute

Only after confirmation, run the specific command.

## Common Command Shapes

### Spot

```bash
okx --profile demo spot place --instId BTC-USDT --side buy --ordType market --sz 0.01
okx --profile demo spot cancel --instId BTC-USDT --ordId <ordId>
okx --profile demo spot amend --instId BTC-USDT --ordId <ordId> --newPx 100000
```

### Perpetual / Futures

```bash
okx --profile demo swap place --instId BTC-USDT-SWAP --side buy --ordType market --sz 1 --tdMode cross --posSide long
okx --profile demo swap close --instId BTC-USDT-SWAP --mgnMode cross --posSide long
okx --profile demo swap leverage --instId BTC-USDT-SWAP --lever 10 --mgnMode cross
```

### Algo / TP / SL

```bash
okx --profile demo swap algo trail --instId BTC-USDT-SWAP --side sell --sz 1 --tdMode cross --posSide long --callbackRatio 0.02
```

## Reference Files

Load the matching reference file before running anything beyond the simplest spot or swap flow:

- spot orders and spot algo commands: `references/spot-commands.md`
- perpetual swap execution and swap algo commands: `references/swap-commands.md`
- delivery futures execution: `references/futures-commands.md`
- options contracts, Greeks, and premium conversion: `references/options-commands.md`
- MCP mappings, output rules, and amount safety rules: `references/templates.md`
- cross-skill workflows and example execution sequences: `references/workflows.md`

## Derivatives Validation Rule

Before placing SWAP, FUTURES, or OPTION orders, retrieve instrument details and validate contract face value. Do not assume contract sizing.

Examples:

```bash
okx market instruments --instType SWAP --instId BTC-USDT-SWAP
okx market instruments --instType FUTURES --instId BTC-USDT-250328
okx market instruments --instType OPTION --instId BTC-USD-250328-95000-C
```

Use the validated contract value to explain:
- contract count
- approximate notional size
- relevant margin implications

## Failure Handling

- If credentials are missing or invalid, stop and direct the user to [Settings > Advanced](/?t=settings&s=advanced).
- If profile is unclear, ask before proceeding.
- If the requested amount is ambiguous, do not infer.
- If contract information cannot be validated for a derivatives order, do not execute.

## Output Rules

- After execution, state what happened in plain language.
- Always append the executed profile.
- If the command failed, summarize the failure and the next fix, not just raw stderr.

## Scope Limits

- This v1 skill covers spot, swap, futures, and supported options execution basics.
- Do not introduce OKX bots here.
- Keep advanced options workflows out unless the user clearly requests them and the inputs are complete.

## Related Skills

- `okx-cex-market`
- `okx-cex-portfolio`
