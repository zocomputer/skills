---
name: moonpay-auth
description: Set up the MoonPay CLI on Zo, authenticate the current user, and create or inspect local wallets. Use when MoonPay commands fail because the user is not logged in, when a wallet is missing, or when a MoonPay flow needs login completed before continuing.
compatibility: Created for Zo Computer
metadata:
  author: Zo
  category: Official
  display-name: MoonPay Auth
---

# MoonPay Auth

Set up MoonPay on Zo so later wallet, buy, swap, or virtual-account flows can run cleanly.

## What Zo Uses

- [Terminal](/?t=terminal) for `mp` CLI commands
- [Browser](/browser) for any verification or continuation links
- Optional Gmail connection only if OTP retrieval is explicitly appropriate and available

## Prerequisites

- Node.js and npm available on Zo
- A MoonPay account email address

## Zo-Native Setup

1. Install the MoonPay CLI in the terminal:

```bash
npm i -g @moonpay/cli
```

2. Verify the install:

```bash
mp --version
mp --help
```

3. Check whether the user is already authenticated:

```bash
mp user retrieve
```

4. If not authenticated, start login:

```bash
mp login --email user@example.com
```

`mp login` generates a sign-in link and attempts to open it in a browser. On Zo, treat that as a Zo browser step, not a local-desktop browser step.

5. If MoonPay returns a sign-in link or asks for browser continuation, move the user to Zo browser and complete that step there.

6. Complete verification:

```bash
mp verify --email user@example.com --code 123456
```

7. Inspect available wallets:

```bash
mp wallet list
```

8. If no wallet exists, create one:

```bash
mp wallet create --name "default"
```

## Wallet Operations

```bash
# Create a new wallet
mp wallet create --name "default"

# Import from mnemonic
mp wallet import --name "restored" --mnemonic "word1 word2 ..."

# Import from private key for a single chain
mp wallet import --name "imported" --key <hex-key> --chain ethereum

# List wallets
mp wallet list

# Retrieve one wallet
mp wallet retrieve --wallet "default"
```

## Config and Storage Notes

- Wallets: `~/.config/moonpay/wallets.json`
- Credentials: `~/.config/moonpay/credentials.json`
- General config: `~/.config/moonpay/config.json`

These are local to the Zo machine. Do not assume the user is on a desktop with local MoonPay state elsewhere.

## Failure Handling

- If `mp` is missing, install it and verify again.
- If `mp user retrieve` fails, do not continue to buy, swap, or virtual-account flows until login is complete.
- If `mp login` produces a sign-in link or browser continuation step, move the user to Zo browser rather than describing local-browser steps.
- If the user has no wallet, create or import one before balance or swap flows.

## Safety Notes

- Do not ask the user to paste private keys, mnemonics, or secrets into chat.
- `mp wallet export` is interactive and should not be used as part of a normal Zo agent flow.
- Only retrieve OTP codes from Gmail if the user has Gmail connected and the flow clearly requires it.

## Related Skills

- `moonpay-check-wallet`
- `moonpay-buy-crypto`
- `moonpay-swap-tokens`
- `moonpay-virtual-account`
