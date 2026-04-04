---
name: moonpay-buy-crypto
description: Generate a MoonPay fiat-to-crypto checkout flow on Zo. Use when the user wants to buy crypto with card or bank transfer and then complete the purchase in the Zo browser.
compatibility: Created for Zo Computer
metadata:
  author: Zo
  category: Official
  display-name: MoonPay Buy Crypto
---

# MoonPay Buy Crypto

Create a MoonPay checkout flow on Zo for fiat-to-crypto purchases.

## What Zo Uses

- [Terminal](/?t=terminal) for `mp buy`
- [Browser](/browser) for the returned checkout URL and any KYC or payment completion

## Prerequisites

- MoonPay CLI installed
- User authenticated
- Destination wallet available
- Token, amount, and destination chain are known

## Workflow

1. Verify auth:

```bash
mp user retrieve
```

2. Find or confirm the destination wallet:

```bash
mp wallet list
```

3. Generate the checkout flow:

```bash
mp buy \
  --token <currency-code> \
  --amount <usd-amount> \
  --wallet <destination-address> \
  --email <buyer-email>
```

4. Tell the user that the next step is in Zo browser.

5. Open or guide the user to open the returned checkout URL in Zo browser.

## Supported Token Codes

`btc`, `sol`, `eth`, `trx`, `pol_polygon`, `usdc`, `usdc_sol`, `usdc_base`, `usdc_arbitrum`, `usdc_optimism`, `usdc_polygon`, `usdt_trx`, `eth_polygon`, `eth_optimism`, `eth_base`, `eth_arbitrum`

## Failure Handling

- If auth is missing, switch to `moonpay-auth`.
- If destination wallet is unclear, stop and confirm before generating the checkout.
- If the token code is unclear, clarify it before running the command.

## Safety Notes

- Treat this as a write / payment flow. Require explicit confirmation if the amount, token, or destination wallet is ambiguous.
- Do not describe the returned URL as if it opens on the user's local machine. The correct next step is Zo browser.
- Completion may require identity verification or payment steps that the user must handle in browser.

## Related Skills

- `moonpay-auth`
- `moonpay-check-wallet`
- `moonpay-swap-tokens`
