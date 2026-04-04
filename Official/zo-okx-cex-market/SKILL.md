---
name: okx-cex-market
description: Query OKX market data on Zo, including prices, candles, order books, funding rates, open interest, instruments, and technical indicators. Use for read-only market questions and never for account or trading actions.
compatibility: Created for Zo Computer
metadata:
  author: Zo
  category: Official
  display-name: OKX Market Data
  version: "1.2.8"
  homepage: "https://www.okx.com"
---

# OKX Market Data

Use the OKX CLI on Zo for read-only market data and technical indicator queries.

## Preflight

Before running any OKX command in this session, follow `../_shared/preflight.md`.
Use `metadata.version` from this file as the comparison version for drift checks.

## What Zo Uses

- [Terminal](/?t=terminal) for `okx market ...` commands

## Prerequisites

- OKX CLI installed:

```bash
npm install -g @okx_ai/okx-trade-cli
```

- Verify:

```bash
okx market ticker BTC-USDT
```

No API credentials are required for this skill.

## Read-Only Rule

All commands in this skill are read-only. No confirmation is needed unless the requested historical pull is unusually large.

## Common Commands

```bash
okx market ticker BTC-USDT
okx market orderbook BTC-USDT --sz 20
okx market candles BTC-USDT --bar 1H --limit 100
okx market funding-rate BTC-USDT-SWAP
okx market open-interest --instType SWAP --instId BTC-USDT-SWAP
okx market instruments --instType SPOT
```

## Reference Files

Load the matching reference file before running less-obvious commands or multi-step workflows:

- price, candles, order book, trades: `references/price-data-commands.md`
- indicators: `references/indicator-commands.md`
- funding, mark price, open interest, price limits, index data: `references/derivatives-commands.md`
- instrument discovery and non-crypto categories: `references/instrument-commands.md`
- cross-skill workflows and MCP mappings: `references/workflows.md`

## Workflow

1. Identify whether the user wants:
- spot price / ticker
- candles / OHLCV
- order book / recent trades
- funding, mark price, open interest
- instrument discovery
- indicators

2. If the user wants indicators, verify the subcommand exists before using any indicator reference:

```bash
okx market --help
```

Only continue with indicator commands if `indicator` appears in the available market subcommands. If it does not, stop and tell the user that this installed OKX CLI build does not expose indicator commands yet.

3. Run the minimal command that answers the question.

4. Summarize the result in chat rather than dumping raw terminal output unless the user asked for raw output.

## Historical Pull Guardrail

Before large candle pulls with pagination or broad ranges, estimate the number of candles. If the request will produce more than roughly 500 rows, tell the user the estimate and ask before continuing.

## Failure Handling

- If the CLI is missing, install and verify it.
- If an instrument is invalid, discover valid instruments first.
- If the requested market is ambiguous, clarify the instrument ID before running multiple commands.

## Safety Notes

- This skill must not be used for balance, portfolio, or trading actions.
- Use `okx-cex-portfolio` for account state.
- Use `okx-cex-trade` for execution.

## Related Skills

- `okx-cex-portfolio`
- `okx-cex-trade`
