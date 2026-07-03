---
name: moonpay-virtual-account
description: Set up and operate MoonPay virtual accounts on Zo for fiat onramp and offramp flows. Use when the user wants to complete KYC, register payout or deposit details, or move between fiat and supported stablecoins.
compatibility: Created for Zo Computer
metadata:
  author: Zo
  category: Official
  display-name: MoonPay Virtual Account
---

# MoonPay Virtual Account

Run MoonPay virtual-account flows on Zo for fiat onramp and offramp workflows.

## What Zo Uses

- [Terminal](/?t=terminal) for `mp virtual-account` commands
- [Browser](/browser) for KYC, agreement review, and continuation links

## Prerequisites

- MoonPay CLI installed
- User authenticated
- A wallet available for registration if the flow needs one

## Workflow

### 1. Create or inspect the account

```bash
mp virtual-account create
mp virtual-account retrieve
```

Use `retrieve` to summarize current status before deciding the next step.

### 2. Continue or restart KYC

```bash
mp virtual-account kyc continue
mp virtual-account kyc restart
```

If MoonPay returns a URL or continuation step, move the user to Zo browser.

### 3. Review agreements

```bash
mp virtual-account agreement list
```

Show the user the agreement name and URL. Do not accept an agreement until the user explicitly confirms they reviewed it.

```bash
mp virtual-account agreement accept --contentId <content-id>
```

### 4. Register a wallet if needed

```bash
mp virtual-account wallet register --wallet main --chain solana
mp virtual-account wallet list
```

### 5. Run onramp or offramp flows

Examples:

```bash
mp virtual-account onramp create \
  --name "My Onramp" \
  --fiat USD \
  --stablecoin USDC \
  --wallet <registered-wallet-address> \
  --chain solana

mp virtual-account onramp retrieve --onrampId <id>
```

For bank-account registration or payout/offramp flows, keep the user informed about which steps are informational and which steps will create or move financial rails.

## Failure Handling

- If auth is missing, switch to `moonpay-auth`
- If KYC is incomplete, do not continue to onramp or offramp execution
- If agreements are pending, stop and get user confirmation after review
- If a wallet is required but missing, register one first

## Safety Notes

- Treat agreement acceptance and money-movement steps as explicit user-approval boundaries.
- KYC, agreement review, and some legal disclosures are browser-dependent. Use Zo browser, not local-browser assumptions.
- Explain clearly which parts Zo can complete and which parts the user must finish directly.

## Related Skills

- `moonpay-auth`
- `moonpay-check-wallet`
- `moonpay-buy-crypto`
- `moonpay-swap-tokens`
