#!/usr/bin/env bun
/**
 * Generic OAuth 2.1 connector for remote MCP servers on Zo Computer.
 *
 * Zo's sandbox has no public inbound port of its own, so a normal
 * "open localhost:PORT and wait for the redirect" OAuth flow (what most
 * MCP clients assume) never completes here. This script instead uses a
 * Zo Space API route (https://<handle>.zo.space/api/oauth-mcp/callback)
 * as the redirect_uri. That route is already public, already deployed,
 * and persists tokens straight to the workspace - so the browser-side
 * redirect actually lands somewhere real.
 *
 * Flow:
 *   1. Discover OAuth metadata (.well-known/oauth-authorization-server,
 *      falling back to /.well-known/openid-configuration).
 *   2. Dynamically register an OAuth client (RFC 7591) if the server
 *      supports it, using our fixed Space callback as redirect_uri.
 *   3. Generate PKCE verifier/challenge, save a "pending" record keyed
 *      by `state` to /home/workspace/Data/oauth-mcp/pending/<state>.json.
 *   4. Print the authorization URL for the user to open in their own
 *      browser (desktop app or phone - NOT this sandbox).
 *   5. The Space route /api/oauth-mcp/callback receives the redirect,
 *      matches the state, exchanges the code for tokens, and writes
 *      /home/workspace/Data/oauth-mcp/tokens/<server>.json.
 *   6. `status`/`call` here read that token file directly (with
 *      refresh-token rotation support).
 *
 * Usage:
 *   bun oauth-mcp.ts connect <server-name> <mcp-url> [--scope "..."]
 *   bun oauth-mcp.ts status <server-name>
 *   bun oauth-mcp.ts list-tools <server-name>
 *   bun oauth-mcp.ts call <server-name> <tool-name> '<json-args>'
 *   bun oauth-mcp.ts refresh <server-name>
 *   bun oauth-mcp.ts revoke <server-name>
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { randomBytes, createHash, randomUUID } from "crypto";

const DATA_DIR = "/home/workspace/Data/oauth-mcp";
const PENDING_DIR = `${DATA_DIR}/pending`;
const TOKENS_DIR = `${DATA_DIR}/tokens`;
const CALLBACK_PATH = "/api/oauth-mcp/callback";
const PENDING_TTL_MS = 15 * 60 * 1000;

function zoHandle(): string {
  const fromEnv = process.env.ZO_HOSTNAME || process.env.ZO_USER;
  if (fromEnv) return fromEnv.replace(/\.zo\.(space|computer)$/, "");
  throw new Error(
    "Could not determine Zo handle. Pass --handle <your-zo-handle> or set ZO_USER."
  );
}

function redirectUri(handleOverride?: string): string {
  const handle = handleOverride || zoHandle();
  return `https://${handle}.zo.space${CALLBACK_PATH}`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function discoverMetadata(mcpUrl: string) {
  const origin = new URL(mcpUrl).origin;
  const candidates = [
    `${origin}/.well-known/oauth-authorization-server`,
    `${origin}/.well-known/openid-configuration`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) continue;
      const meta = await res.json();
      if (meta.authorization_endpoint && meta.token_endpoint) {
        return meta as {
          authorization_endpoint: string;
          token_endpoint: string;
          registration_endpoint?: string;
          scopes_supported?: string[];
        };
      }
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `Could not discover OAuth metadata for ${origin}. Tried: ${candidates.join(", ")}. ` +
      `The server may need manual client_id/client_secret - check its docs.`
  );
}

async function registerClient(
  registrationEndpoint: string,
  redirect: string,
  serverName: string
): Promise<{ client_id: string; client_secret?: string }> {
  const res = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: `zo-computer-${serverName}`,
      redirect_uris: [redirect],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dynamic client registration failed (${res.status}): ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

function cleanupExpiredPending() {
  if (!existsSync(PENDING_DIR)) return;
  const fs = require("fs");
  for (const f of fs.readdirSync(PENDING_DIR)) {
    const p = `${PENDING_DIR}/${f}`;
    try {
      const stat = fs.statSync(p);
      if (Date.now() - stat.mtimeMs > PENDING_TTL_MS) fs.unlinkSync(p);
    } catch {}
  }
}

async function cmdConnect(args: string[]) {
  const serverName = args[0];
  const mcpUrl = args[1];
  if (!serverName || !mcpUrl) {
    console.error("Usage: oauth-mcp.ts connect <server-name> <mcp-url> [--scope \"a b c\"] [--handle your-zo-handle]");
    process.exit(1);
  }
  const scopeIdx = args.indexOf("--scope");
  const scopeOverride = scopeIdx >= 0 ? args[scopeIdx + 1] : undefined;
  const handleIdx = args.indexOf("--handle");
  const handleOverride = handleIdx >= 0 ? args[handleIdx + 1] : undefined;

  mkdirSync(PENDING_DIR, { recursive: true });
  cleanupExpiredPending();

  const redirect = redirectUri(handleOverride);
  console.log(`Discovering OAuth metadata for ${mcpUrl} ...`);
  const meta = await discoverMetadata(mcpUrl);
  console.log(`  authorization_endpoint: ${meta.authorization_endpoint}`);
  console.log(`  token_endpoint: ${meta.token_endpoint}`);

  let clientId: string;
  let clientSecret: string | undefined;
  if (meta.registration_endpoint) {
    console.log(`Registering OAuth client (redirect_uri=${redirect}) ...`);
    const client = await registerClient(meta.registration_endpoint, redirect, serverName);
    clientId = client.client_id;
    clientSecret = client.client_secret;
    console.log(`  client_id: ${clientId}`);
  } else {
    console.error(
      `No registration_endpoint advertised. This server needs a manually-issued client_id ` +
        `(and possibly client_secret). Re-run with:\n` +
        `  OAUTH_MCP_CLIENT_ID=xxx OAUTH_MCP_CLIENT_SECRET=yyy bun oauth-mcp.ts connect ${serverName} ${mcpUrl}`
    );
    clientId = process.env.OAUTH_MCP_CLIENT_ID || "";
    clientSecret = process.env.OAUTH_MCP_CLIENT_SECRET;
    if (!clientId) process.exit(1);
  }

  const state = randomUUID();
  const { verifier, challenge } = pkce();
  const scope = scopeOverride || (meta.scopes_supported || ["openid", "profile", "email", "offline_access"]).join(" ");

  writeFileSync(
    `${PENDING_DIR}/${state}.json`,
    JSON.stringify(
      {
        serverName,
        tokenEndpoint: meta.token_endpoint,
        clientId,
        clientSecret,
        codeVerifier: verifier,
        redirectUri: redirect,
        mcpUrl,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    ),
    { mode: 0o600 }
  );

  const authUrl = new URL(meta.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirect);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("resource", mcpUrl);

  console.log("\n" + "=".repeat(70));
  console.log(`Open this URL in a browser to authorize ${serverName}:`);
  console.log("=".repeat(70));
  console.log(`\n${authUrl.toString()}\n`);
  console.log(
    `After you approve, the Zo Space callback route will exchange the code\n` +
      `and save tokens to ${TOKENS_DIR}/${serverName}.json automatically.\n` +
      `Run "bun oauth-mcp.ts status ${serverName}" after approving to confirm.`
  );
}

type TokenFile = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: number | null;
  client_id: string;
  client_secret?: string;
  token_endpoint: string;
  redirect_uri: string;
  updated_at: string;
};

function tokenPath(serverName: string) {
  return `${TOKENS_DIR}/${serverName}.json`;
}

function loadToken(serverName: string): TokenFile {
  const p = tokenPath(serverName);
  if (!existsSync(p)) {
    throw new Error(
      `No token file at ${p}. Run "bun oauth-mcp.ts connect ${serverName} <mcp-url>" first, then approve in a browser.`
    );
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

async function refreshTokenFile(serverName: string): Promise<TokenFile> {
  const token = loadToken(serverName);
  if (!token.refresh_token) throw new Error(`No refresh_token stored for ${serverName}; re-run connect.`);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
    client_id: token.client_id,
  });
  if (token.client_secret) body.set("client_secret", token.client_secret);

  const res = await fetch(token.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Refresh failed (${res.status}): ${text.slice(0, 500)}`);
  const data = JSON.parse(text);

  const updated: TokenFile = {
    ...token,
    access_token: data.access_token,
    refresh_token: data.refresh_token || token.refresh_token,
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
    updated_at: new Date().toISOString(),
  };
  writeFileSync(tokenPath(serverName), JSON.stringify(updated, null, 2), { mode: 0o600 });
  return updated;
}

async function ensureValidToken(serverName: string): Promise<string> {
  let token = loadToken(serverName);
  const expiringSoon = token.expires_at && token.expires_at - Date.now() < 60_000;
  if (expiringSoon && token.refresh_token) {
    token = await refreshTokenFile(serverName);
  }
  return token.access_token;
}

async function mcpCall(serverName: string, mcpUrl: string, method: string, params: Record<string, unknown> = {}) {
  const accessToken = await ensureValidToken(serverName);
  const doCall = async (bearer: string) =>
    fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });

  let res = await doCall(accessToken);
  if (res.status === 401) {
    const refreshed = await refreshTokenFile(serverName);
    res = await doCall(refreshed.access_token);
  }

  const text = await res.text();
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 1000)}`);

  const dataLine = text
    .split(/\r?\n/)
    .filter((l) => l.startsWith("data: "))
    .map((l) => l.slice(6))
    .pop();
  const payload = dataLine ? JSON.parse(dataLine) : JSON.parse(text);
  if (payload.error) throw new Error(`MCP error: ${JSON.stringify(payload.error)}`);
  return payload.result;
}

async function cmdStatus(args: string[]) {
  const serverName = args[0];
  if (!serverName) {
    console.error("Usage: oauth-mcp.ts status <server-name>");
    process.exit(1);
  }
  const p = tokenPath(serverName);
  if (!existsSync(p)) {
    console.log(JSON.stringify({ connected: false, server: serverName }, null, 2));
    return;
  }
  const token = loadToken(serverName);
  console.log(
    JSON.stringify(
      {
        connected: true,
        server: serverName,
        has_refresh_token: Boolean(token.refresh_token),
        expires_at: token.expires_at ? new Date(token.expires_at).toISOString() : null,
        updated_at: token.updated_at,
      },
      null,
      2
    )
  );
}

async function cmdListTools(args: string[]) {
  const serverName = args[0];
  if (!serverName) {
    console.error("Usage: oauth-mcp.ts list-tools <server-name>");
    process.exit(1);
  }
  const token = loadToken(serverName);
  const result = await mcpCall(serverName, mcpUrlFor(serverName, token), "tools/list");
  console.log(JSON.stringify(result, null, 2));
}

function mcpUrlFor(serverName: string, _token?: TokenFile): string {
  const p = `${PENDING_DIR}`;
  // mcpUrl is not persisted in the token file by default; store it alongside on connect.
  const cfgPath = `${DATA_DIR}/servers/${serverName}.json`;
  if (existsSync(cfgPath)) {
    return JSON.parse(readFileSync(cfgPath, "utf8")).mcpUrl;
  }
  throw new Error(
    `Unknown MCP URL for ${serverName}. Re-run: bun oauth-mcp.ts connect ${serverName} <mcp-url>`
  );
}

async function cmdCall(args: string[]) {
  const serverName = args[0];
  const toolName = args[1];
  const rawArgs = args[2] || "{}";
  if (!serverName || !toolName) {
    console.error("Usage: oauth-mcp.ts call <server-name> <tool-name> '<json-args>'");
    process.exit(1);
  }
  const toolArgs = JSON.parse(rawArgs);
  const mcpUrl = mcpUrlFor(serverName);
  const result = await mcpCall(serverName, mcpUrl, "tools/call", { name: toolName, arguments: toolArgs });
  if (result?.content) {
    for (const item of result.content) {
      if (item.type === "text") console.log(item.text);
      else console.log(JSON.stringify(item, null, 2));
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function cmdRefresh(args: string[]) {
  const serverName = args[0];
  if (!serverName) {
    console.error("Usage: oauth-mcp.ts refresh <server-name>");
    process.exit(1);
  }
  const updated = await refreshTokenFile(serverName);
  console.log(JSON.stringify({ refreshed: true, expires_at: updated.expires_at ? new Date(updated.expires_at).toISOString() : null }, null, 2));
}

async function cmdRevoke(args: string[]) {
  const serverName = args[0];
  if (!serverName) {
    console.error("Usage: oauth-mcp.ts revoke <server-name>");
    process.exit(1);
  }
  const p = tokenPath(serverName);
  if (existsSync(p)) unlinkSync(p);
  console.log(`Removed local token for ${serverName}. Note: this does not revoke server-side authorization - do that in the provider's settings.`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  // Persist mcpUrl alongside connect so later calls don't need it repeated.
  if (command === "connect") {
    mkdirSync(`${DATA_DIR}/servers`, { recursive: true });
    const serverName = rest[0];
    const mcpUrl = rest[1];
    if (serverName && mcpUrl) {
      writeFileSync(`${DATA_DIR}/servers/${serverName}.json`, JSON.stringify({ mcpUrl }, null, 2));
    }
    await cmdConnect(rest);
    return;
  }
  switch (command) {
    case "status":
      await cmdStatus(rest);
      break;
    case "list-tools":
      await cmdListTools(rest);
      break;
    case "call":
      await cmdCall(rest);
      break;
    case "refresh":
      await cmdRefresh(rest);
      break;
    case "revoke":
      await cmdRevoke(rest);
      break;
    default:
      console.log(`oauth-mcp.ts - generic OAuth connector for remote MCP servers on Zo Computer

Usage:
  bun oauth-mcp.ts connect <server-name> <mcp-url> [--scope "..."] [--handle your-zo-handle]
  bun oauth-mcp.ts status <server-name>
  bun oauth-mcp.ts list-tools <server-name>
  bun oauth-mcp.ts call <server-name> <tool-name> '<json-args>'
  bun oauth-mcp.ts refresh <server-name>
  bun oauth-mcp.ts revoke <server-name>
`);
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
