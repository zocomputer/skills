---
name: moonpay-swap-tokens
description: Swap tokens or bridge assets with MoonPay on Zo. Use when the user wants to swap one token for another, bridge between supported chains, or move crypto through a MoonPay wallet workflow.
compatibility: Created for Zo Computer
metadata:
  author: Zo
  category: Official
  display-name: MoonPay Swap Tokens
---

# MoonPay Swap Tokens

Swap assets on the same chain or bridge them across supported chains using MoonPay on Zo.

## What Zo Uses

- [Terminal](/?t=terminal) for `mp token swap`, `mp token bridge`, and balance checks

## Prerequisites

- MoonPay CLI installed
- User authenticated
- Source wallet available
- Source balance available on the intended chain
- Token addresses or symbols resolved

## Preflight

Before any write action:

1. Confirm auth:

```bash
mp user retrieve
```

2. Confirm the wallet:

```bash
mp wallet list
```

3. Check source balance:

```bash
mp token balance list --wallet <address> --chain <chain>
```

4. If the user gave token names instead of addresses, resolve them first:

```bash
mp token search --query "USDC" --chain solana
```

5. Generate a quote before execution:

```bash
mp token quote \
  --from-chain <from-chain> \
  --from-token <from-token> \
  --from-amount <from-amount> \
  --to-chain <to-chain> \
  --to-token <to-token>
```

6. Summarize back to the user:
- source wallet
- source chain
- source token and amount
- destination token and chain
- quoted output amount
- quoted fees / route timing if available

Then require explicit confirmation before executing the swap or bridge.

## Swap Command

```bash
mp token swap \
  --wallet <wallet-name> \
  --chain <chain> \
  --from-token <token-address> \
  --from-amount <amount> \
  --to-token <token-address>
```

## Bridge Command

```bash
mp token bridge \
  --from-wallet <wallet-name> \
  --from-chain <chain> \
  --from-token <token-address> \
  --from-amount <amount> \
  --to-chain <chain> \
  --to-token <token-address> \
  --to-wallet <wallet-name>
```

## Notes

- Same-chain swaps use `mp token swap`
- Cross-chain movements use `mp token bridge`
- Native tokens use chain-specific native-token placeholders

## Failure Handling

- If the wallet is missing, switch to `moonpay-auth`
- If the balance is insufficient, stop before execution
- If token identification is unclear, resolve it before execution
- If the quote step fails, do not execute the swap or bridge blindly
- If the user does not clearly confirm the write action, do not proceed

## Safety Notes

- This is a write skill. Explicit confirmation is required before execution.
- Never infer a destination token or chain if the user did not specify it clearly.
- Present the planned route and amount in plain language before running the command.

## Related Skills

- `moonpay-auth`
- `moonpay-check-wallet`
- `moonpay-buy-crypto`
