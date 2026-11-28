# tokensto.cash invariants

Read only when the user asks how credentials, listing, pricing, or payouts work.

## Agent access

Browser sign-in creates an encrypted one-time pairing code that expires after 10 minutes. Exchange records only a SHA-256 code digest and timestamps so a code cannot be reused. The returned opaque listing token expires after eight hours and embeds the bound user and payout wallet under AES-256-GCM.

Only four surfaces accept that token: provider catalog, routed-provider hosts, credential probe, and offer create/read. Cash-out, sends, settings, pause, delete, and relist still require a normal Privy browser session. The local session file is mode `0600`; `logout` deletes it.

## Provider credentials

The CLI reads pairing codes and provider keys through a hidden terminal prompt. It does not accept them as command arguments. A provider key transits the tokensto.cash route in memory and is sent to Surplus, which stores it encrypted per listing. tokensto.cash does not persist the provider key.

## House seller

tokensto.cash holds one Surplus seller identity. Users never SIWE with Surplus and never see a seller key. `payout_address` is always the wallet bound during tokensto.cash sign-in.

Untrusted upstreams only route to buyers who opted in. Trusted-only is Surplus's default for buyers.

## Pricing

Autopilot keeps each listing just under the cheapest healthy, trusted competitor it can beat, floored at the chosen cost basis. Dead offers at the top of the book do not count. A quote at or below the floor is ignored rather than chased.

The CLI posts one model per request. The server accepts 1-8. Its recommendation includes only text models with demand that the chosen floor can plausibly win. This is a ranking signal, not an earnings forecast.

## Money

Earnings accrue per request and Surplus batches Base USDC payouts. Accrued and in-flight earnings come from Surplus's per-recipient payout snapshot. Ready and received earnings come from inbound USDC sent by learned Surplus relayers; other inbound is balance, not earned.

Cash-out remains a separate browser workflow. The agent token has no authority to create an order, transfer USDC, or approve a wallet action.

## Support

gm@galleonlabs.io
