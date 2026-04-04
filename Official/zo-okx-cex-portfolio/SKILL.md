---
name: okx-cex-portfolio
description: Inspect OKX account balances, positions, PnL, bills, fee levels, and related account state on Zo. Use when the user asks about holdings, positions, realized or unrealized PnL, transfers, or account configuration.
compatibility: Created for Zo Computer
metadata:
  author: Zo
  category: Official
  display-name: OKX Portfolio
  version: "1.2.8"
  homepage: "https://www.okx.com"
---

# OKX Portfolio

Inspect OKX account state on Zo, including balances, positions, PnL, bills, fees, and selected account operations.

## Preflight

Before running any OKX command in this session, follow `../_shared/preflight.md`.
Use `metadata.version` from this file as the comparison version for drift checks.

## What Zo Uses

- [Terminal](/?t=terminal) for `okx account ...` commands
- [Settings > Advanced](/?t=settings&s=advanced) for storing OKX credentials as Zo secrets

## Credential Model

Zo secrets are the source of truth for:
- `OKX_API_KEY`
- `OKX_SECRET_KEY`
- `OKX_PASSPHRASE`

If local OKX config is needed, generate it from those secrets on the Zo machine instead of asking the user to paste credentials into chat.

## Prerequisites

1. Install the CLI:

```bash
npm install -g @okx_ai/okx-trade-cli
```

2. Ensure OKX secrets exist in [Settings > Advanced](/?t=settings&s=advanced).

3. Generate local config from Zo secrets if required by the CLI flow:

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

4. Verify configuration status:

```bash
okx config show
```

## Profile Rule

Authenticated commands must always use an explicit profile:
- `demo`
- `live`

If the user has not specified a profile and none is clearly established in the conversation, ask before proceeding.

## Common Commands

```bash
okx --profile demo account balance
okx --profile demo account positions
okx --profile demo account positions-history
okx --profile demo account bills
okx --profile demo account fees --instType SPOT
okx --profile demo account config
```

## Workflow

1. Verify the CLI is available.
2. Verify credentials are configured and masked correctly.
3. Confirm the profile.
4. Run the smallest account command that answers the user’s question.
5. Summarize the output in chat and append the active profile.

## Failure Handling

- If credentials are missing or invalid, stop and direct the user to [Settings > Advanced](/?t=settings&s=advanced).
- If config generation fails, do not proceed with authenticated account calls.
- If the profile is unclear, ask before continuing.

## Output Rules

- Prefer concise portfolio summaries over raw output dumps.
- Mention whether the result came from `demo` or `live`.
- Disclose scope when the result is partial, for example one currency or one position set.

## Safety Notes

- Read-only portfolio queries do not require extra confirmation.
- If the action becomes a write action such as a transfer or account-setting change, confirm profile and intent first.

## Related Skills

- `okx-cex-market`
- `okx-cex-trade`
