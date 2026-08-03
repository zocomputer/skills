# Shared callback route: `/api/oauth-mcp/callback`

This is the exact code deployed at `https://YOUR_HANDLE.zo.space/api/oauth-mcp/callback`.
It is a **shared, provider-agnostic** OAuth redirect target — do not create a
new per-provider callback route for servers connected via this skill;
`scripts/oauth-mcp.ts` always points at this one path.

If this route is ever missing (e.g. lost during a Space rebuild or export),
recreate it with `write_space_route(path="/api/oauth-mcp/callback", route_type="api", public="true", code=<below>)`.
It must stay public (API routes always are) since providers' OAuth redirects
hit it unauthenticated.

```typescript
import type { Context } from "hono";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";

const DATA_DIR = "/home/workspace/Data/oauth-mcp";
const PENDING_DIR = `${DATA_DIR}/pending`;
const TOKENS_DIR = `${DATA_DIR}/tokens`;

function htmlResponse(c: Context, title: string, message: string, ok: boolean) {
  return c.html(
    `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;text-align:center;color:${ok ? "#1a1a1a" : "#7a1a1a"}}</style>
    </head><body><h1>${title}</h1><p>${message}</p></body></html>`,
    ok ? 200 : 400
  );
}

export default async (c: Context) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return htmlResponse(c, "Authorization failed", c.req.query("error_description") || error, false);
  }
  if (!code || !state) {
    return htmlResponse(c, "Missing parameters", "No authorization code or state received.", false);
  }

  const pendingPath = `${PENDING_DIR}/${state}.json`;
  if (!existsSync(pendingPath)) {
    return htmlResponse(
      c,
      "No matching request",
      "No pending OAuth request matched this callback's state. It may have expired (15 min) - re-run the connect command and try again promptly.",
      false
    );
  }

  const pending = JSON.parse(readFileSync(pendingPath, "utf8"));

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: pending.redirectUri,
      client_id: pending.clientId,
      code_verifier: pending.codeVerifier,
    });
    if (pending.clientSecret) body.set("client_secret", pending.clientSecret);

    const tokenRes = await fetch(pending.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const text = await tokenRes.text();
    if (!tokenRes.ok) {
      return htmlResponse(c, "Token exchange failed", `HTTP ${tokenRes.status}: ${text.slice(0, 500)}`, false);
    }
    const tokenData = JSON.parse(text);

    mkdirSync(TOKENS_DIR, { recursive: true });
    writeFileSync(
      `${TOKENS_DIR}/${pending.serverName}.json`,
      JSON.stringify(
        {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type,
          expires_at: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
          client_id: pending.clientId,
          client_secret: pending.clientSecret,
          token_endpoint: pending.tokenEndpoint,
          redirect_uri: pending.redirectUri,
          updated_at: new Date().toISOString(),
        },
        null,
        2
      ),
      { mode: 0o600 }
    );

    unlinkSync(pendingPath);

    return htmlResponse(
      c,
      `${pending.serverName} connected`,
      "Authorization successful. You can close this tab and return to Zo.",
      true
    );
  } catch (err: any) {
    return htmlResponse(c, "Callback error", err?.message || String(err), false);
  }
};
```

## Contract this route depends on

- Reads `Data/oauth-mcp/pending/<state>.json` written by `scripts/oauth-mcp.ts connect`:
  ```json
  {
    "serverName": "string",
    "tokenEndpoint": "string (URL)",
    "clientId": "string",
    "clientSecret": "string | undefined",
    "codeVerifier": "string",
    "redirectUri": "string (URL, must equal https://<handle>.zo.space/api/oauth-mcp/callback)",
    "mcpUrl": "string (URL)",
    "createdAt": "ISO timestamp"
  }
  ```
- Writes `Data/oauth-mcp/tokens/<serverName>.json`, read by `scripts/oauth-mcp.ts status/list-tools/call/refresh`.
- Deletes the pending file on success (one-shot; a re-approved stale link will hit "No matching request").
