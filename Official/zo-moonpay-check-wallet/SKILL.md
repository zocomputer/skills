---
name: moonpay-check-wallet
description: Check MoonPay wallet balances, token holdings, and portfolio breakdown on Zo. Use when the user asks what is in their wallet, wants a portfolio summary, or needs balances before a MoonPay swap or buy flow.
compatibility: Created for Zo Computer
metadata:
  author: Zo
  category: Official
  display-name: MoonPay Wallet Check
---

# MoonPay Wallet Check

Inspect a MoonPay wallet on Zo and summarize balances cleanly for chat.

## What Zo Uses

- [Terminal](/?t=terminal) for `mp` wallet and balance commands

## Prerequisites

- MoonPay CLI installed
- User authenticated
- At least one MoonPay wallet exists, or the user is ready to create one

## Workflow

1. Confirm the user can access MoonPay:

```bash
mp user retrieve
```

2. Find available wallets:

```bash
mp wallet list
```

3. If no wallet exists, stop and switch to `moonpay-auth`.

4. Retrieve balances on the relevant chain:

```bash
mp token balance list --wallet <address> --chain solana
mp token balance list --wallet <address> --chain ethereum
mp token balance list --wallet <address> --chain base
```

5. For Bitcoin wallets:

```bash
mp bitcoin balance retrieve --wallet <btc-address>
```

6. Summarize the result in chat:
- total value if available
- major holdings ordered by value
- dust / near-zero holdings only if relevant
- any obvious missing funds for a planned action

## Supported Chains

`solana`, `ethereum`, `base`, `polygon`, `arbitrum`, `optimism`, `bnb`, `avalanche`, `tron`, `bitcoin`, `ton`

## Failure Handling

- If the user is not authenticated, use `moonpay-auth`.
- If the wallet name or address is unclear, list wallets first and ask which one to inspect.
- If a chain is unclear, ask which chain the user expects funds on before checking multiple chains blindly.

## Output Rules

- Do not dump raw CLI output unless the user explicitly wants it.
- Prefer a concise portfolio summary.
- Mention when the wallet appears empty on the requested chain.

## Safety Notes

- This is a read-only skill. No extra confirmation is needed.
- Do not move into swap or transfer execution without handing off to the appropriate write skill.

## Related Skills

- `moonpay-auth`
- `moonpay-buy-crypto`
- `moonpay-swap-tokens`
