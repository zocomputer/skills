---
name: oauth-mcp-connect
description: Generic connector for authorizing any remote MCP server that uses OAuth 2.1 (with dynamic client registration + PKCE) on Zo Computer. Use this whenever a new MCP server needs OAuth and there is no dedicated skill for it yet, instead of writing a bespoke auth script or a bespoke Zo Space callback route per provider.
compatibility: Created for Zo Computer
metadata:
  author: YOUR_HANDLE.zo.computer
---
# OAuth MCP Connector

Most remote MCP servers assume a local CLI or desktop client that can open a
browser and receive a redirect on `http://127.0.0.1:<port>/callback`. That
doesn't work inside Zo's sandbox: there's no browser here, and the sandbox has
no public inbound port of its own for a random localhost redirect to land on.

This skill solves that once, generically, by using a **shared Zo Space API
route** (`https://<handle>.zo.space/api/oauth-mcp/callback`) as the
`redirect_uri` for every OAuth MCP server. That route is already public,
already deployed, and persists tokens straight into the workspace - so the
provider's redirect actually lands somewhere real, regardless of which
provider it is.

Before this skill existed, each OAuth MCP integration (ChatPRD, TwinMind,
Buildin, ByDesign, Slideshot, Magnific) needed its own bespoke auth script and
often its own bespoke `/api/<provider>/callback` Space route, duplicating the
PKCE + token-exchange logic every time. Use this skill instead of repeating
that pattern for new providers.

## When to use this vs. a dedicated skill

- **New OAuth MCP server, no existing skill:** use this skill directly.
- **Provider already has a dedicated skill with its own auth script**
  (ChatPRD, TwinMind, Buildin, ByDesign, Slideshot, Magnific) — use that
  skill's existing auth flow, don't duplicate it with this one. Those predate
  this skill and are not required to migrate.
- **Building a new dedicated skill for a provider going forward:** still use
  this connector for the auth mechanics; the provider skill should only
  document available tools and usage patterns, referencing this skill for
  "how to connect." See `Skills/giststack/SKILL.md` for the pattern.

## Prerequisites

- The provider's MCP server must support OAuth 2.1 with:
  - `/.well-known/oauth-authorization-server` (or `/.well-known/openid-configuration`) metadata discovery, AND
  - Dynamic Client Registration (RFC 7591) at a `registration_endpoint`, OR a manually-issued `client_id`/`client_secret` you can pass via env vars.
  - PKCE (`code_challenge_method=S256`) — nearly universal for MCP OAuth.
- The one-time Zo Space callback route below must exist. Create it if it doesn't (see step 0).

## Step 0: Create the shared callback route (one-time, skip if it already exists)

Check first:
```
get_space_route("/api/oauth-mcp/callback")
```

If missing, create it with `write_space_route` using the exact code in
`Skills/oauth-mcp-connect/references/callback-route.md`. Do not improvise a
different implementation — this route's contract (pending-state file layout,
token file layout) is what `scripts/oauth-mcp.ts` reads and writes.

## Step 1: Connect a new provider

```bash
cd /home/workspace
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts connect <server-name> <mcp-url> [--scope "openid profile email offline_access"] [--handle your-zo-handle]
```

- `<server-name>`: short slug for the provider, e.g. `giststack`. Used for file/token naming.
- `<mcp-url>`: the MCP server's endpoint, e.g. `https://app.giststack.com/api/mcp`. OAuth metadata is discovered from this URL's origin.
- `--scope`: optional override. Defaults to the server's advertised `scopes_supported`, or `"openid profile email offline_access"` if none are advertised.
- `--handle`: optional override for the Zo handle used in the redirect URI. Defaults to `$ZO_USER` / `$ZO_HOSTNAME`.

This will:
1. Discover the provider's OAuth metadata.
2. Dynamically register an OAuth client (if the server supports RFC 7591), using the shared Space callback as `redirect_uri`.
3. Generate a PKCE verifier/challenge and save pending state to `Data/oauth-mcp/pending/<state>.json` (15-minute TTL).
4. Print an authorization URL.

**If the server has no `registration_endpoint`:** the script prints an error and expects manually-issued credentials:
```bash
OAUTH_MCP_CLIENT_ID=xxx OAUTH_MCP_CLIENT_SECRET=yyy bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts connect <server-name> <mcp-url>
```
Direct the user to the provider's developer/settings page to obtain these, and to store them in [Settings > Advanced](/?t=settings&s=advanced) if they should persist across sessions (then export them before running connect).

## Step 2: Get the user to approve

Give the user the printed authorization URL to open in **their own browser**
(desktop or phone — not Zo's sandbox browser, since the user needs to log
into the third-party service themselves). Per the always-applied rule on
external actions, do not click through or approve anything on the user's
behalf — this is their login, their consent screen.

After they approve, the shared callback route exchanges the code for tokens
and writes `Data/oauth-mcp/tokens/<server-name>.json` automatically. No
further action from you is needed until they confirm.

## Step 3: Verify

```bash
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts status <server-name>
```

Expect `"connected": true` with an `expires_at` timestamp. Per the
always-applied verification rule, don't tell the user the connection
succeeded until this returns `connected: true` — a printed auth URL is not
evidence of a completed connection.

## Step 4: Use it

```bash
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts list-tools <server-name>
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts call <server-name> <tool-name> '<json-args>'
```

`call` auto-refreshes an expiring/expired access token (via the stored
`refresh_token`) before calling, and retries once on a `401`. `refresh` and
`revoke` are also available standalone.

## Command reference

```
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts connect <server-name> <mcp-url> [--scope "..."] [--handle ...]
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts status <server-name>
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts list-tools <server-name>
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts call <server-name> <tool-name> '<json-args>'
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts refresh <server-name>
bun Skills/oauth-mcp-connect/scripts/oauth-mcp.ts revoke <server-name>
```

## File layout

```
Data/oauth-mcp/
  servers/<name>.json     # { mcpUrl } - written at connect time, read by list-tools/call
  pending/<state>.json    # in-flight PKCE state, deleted by the callback route on success, 15-min TTL
  tokens/<name>.json      # { access_token, refresh_token, expires_at, client_id, client_secret,
                           #   token_endpoint, redirect_uri, updated_at } - written by the callback route
```

`tokens/<name>.json` is the durable connection record. Treat it like any
other credential file: don't print its contents, don't commit it anywhere
public.

## Troubleshooting

- **"No matching request" on the callback page:** the 15-minute pending TTL
  expired, or `connect` was run again (creating a new `state`) after the user
  already had the URL open. Re-run `connect` and have the user open the fresh
  URL promptly.
- **"Could not discover OAuth metadata":** the provider doesn't expose
  `.well-known/oauth-authorization-server` or `openid-configuration` at its
  origin. Check the provider's docs for a different metadata URL or
  hand-rolled OAuth details; this generic flow assumes standard discovery.
- **Token exchange fails after approval:** check `Data/oauth-mcp/tokens/` — if
  no file was written, read the HTML error the callback route returned (it
  echoes the HTTP status and response body from the provider's token
  endpoint) rather than guessing.
- **401 on `call` even after connect:** run `status` to confirm `connected:
  true` and check `expires_at`; if expired and no `refresh_token` was issued,
  the user needs to re-run `connect` from scratch (some providers don't grant
  `offline_access`/refresh tokens unless that scope was explicitly requested).
