---
name: mcporter-setup
description: >-
  Install MCPorter and configure MCP servers from scratch. Use when setting up
  MCP integration for the first time, adding new MCP servers, or troubleshooting
  MCP connectivity. Handles installation, configuration, secrets management,
  and connection testing.
compatibility: Created for Zo Computer
metadata:
  author: curtastrophe
  category: Community
---

# MCPorter Setup

Install and configure MCP (Model Context Protocol) servers on Zo Computer. This skill handles the complete setup process from installation to working connection.

## When to Use

- User wants to use an MCP server but mcporter isn't installed
- User wants to add a new MCP server to their configuration
- User mentions a platform/service that might be available via MCP
- Troubleshooting MCP connection issues
- User asks "set up MCP" or "add MCP server"

---

## Setup Process

Follow these steps in order:

### Step 1: Check MCPorter Installation

Run the installation check script:

```bash
bun Skills/mcporter-setup/scripts/check-install.ts
```

If not installed, the script will install mcporter automatically.

### Step 2: Gather MCP Server Details

Ask the user for the following information:

| Required | Question | Example |
|----------|----------|---------|
| **Server URL** | "What is the MCP server URL?" | `https://mcp.example.com/mcp` |
| **Server Name** | "What name would you like for this server?" | `myserver` |
| **Description** | "What does this server provide?" | `My API integration` |

### Step 3: Determine Authentication Method

Check the server's auth requirements:

```bash
bun Skills/mcporter-setup/scripts/detect-auth.ts <server_url>
```

This will return one of:
- `none` - No authentication required
- `oauth` - Standard OAuth (browser-based)
- `api-key` - API key in header
- `bearer` - Bearer token
- `custom` - Non-standard auth (requires manual setup)

### Step 4: Handle Authentication

Based on the auth type:

#### No Auth
Proceed directly to Step 5.

#### OAuth
Run the auth flow:
```bash
npx mcporter auth <server_url>
```
Tell the user: "A browser window will open for authentication. Please complete the login and return here."

#### API Key / Bearer Token
Ask the user:
1. "What is the header name for the API key?" (e.g., `x-api-key`, `Authorization`)
2. "What is your API key or token?"

Then store the secret:
```bash
# Tell user to add secret in Settings > Advanced
# Then reference it in config
```

**For API keys:** Direct the user to [Settings > Advanced](/?t=settings&s=advanced) to add the secret, then continue with the variable reference.

### Step 5: Add Server Configuration

Run the setup script with gathered information:

```bash
bun Skills/mcporter-setup/scripts/add-server.ts \
  --name "<server_name>" \
  --url "<server_url>" \
  --description "<description>" \
  --auth-type "<auth_type>" \
  --header-name "<header_name>" \
  --secret-var "<SECRET_VAR_NAME>"
```

### Step 6: Test Connection

Verify the setup works:

```bash
bun Skills/mcporter-setup/scripts/test-server.ts <server_name>
```

If successful, show the available tools:
```bash
npx mcporter list <server_name> --all-parameters
```

---

## Common MCP Servers

Use these pre-configured setups for popular services:

### Linear

```
URL: https://mcp.linear.app/mcp
Auth: Bearer token (LINEAR_API_KEY)
Header: Authorization: Bearer ${LINEAR_API_KEY}
```

Setup:
1. Get API key from Linear Settings > API
2. Store as `LINEAR_API_KEY` in Zo Secrets
3. Run: `npx mcporter config add linear https://mcp.linear.app/mcp --header "Authorization: Bearer ${LINEAR_API_KEY}" --scope home`

### Context7 (No Auth)

```
URL: https://mcp.context7.com/mcp
Auth: None
```

Setup:
```bash
npx mcporter config add context7 https://mcp.context7.com/mcp --description "Documentation search" --scope home
```

### GitHub MCP (STDIO)

```
Command: npx -y @github/mcp-server
Auth: GITHUB_TOKEN environment variable
```

Setup:
1. Create GitHub Personal Access Token
2. Store as `GITHUB_TOKEN` in Zo Secrets
3. Run: `npx mcporter config add github --command "npx" --arg "-y" --arg "@github/mcp-server" --env "GITHUB_TOKEN=${GITHUB_TOKEN}" --scope home`

### Firecrawl

```
URL: https://mcp.firecrawl.dev/mcp
Auth: Bearer token (FIRECRAWL_API_KEY)
Header: Authorization: Bearer ${FIRECRAWL_API_KEY}
```

Setup:
1. Get API key from Firecrawl dashboard
2. Store as `FIRECRAWL_API_KEY` in Zo Secrets
3. Run: `npx mcporter config add firecrawl https://mcp.firecrawl.dev/mcp --header "Authorization: Bearer ${FIRECRAWL_API_KEY}" --scope home`

---

## Troubleshooting

### SSE Error / Invalid Content Type

The server may use a different transport or require custom auth:
1. Check server documentation
2. Try `--http-url` flag instead of SSE
3. May need manual token configuration

### Authentication Required (401/403)

Secret may not be loaded:
1. Verify secret exists in Zo Secrets
2. Check the environment variable name matches exactly
3. Test with: `curl -H "Authorization: Bearer $SECRET" <url>`

### Tools Unavailable

Server may be offline or auth failed:
1. Test connectivity: `curl -v <server_url>`
2. Re-run auth: `npx mcporter auth <server_url>`
3. Check server status page if available

---

## Scripts

### `check-install.ts`
Checks if mcporter is installed and installs if needed.

### `detect-auth.ts <url>`
Analyzes server auth requirements.

### `add-server.ts`
Adds server configuration with proper auth setup.

### `test-server.ts <name>`
Tests server connectivity and lists available tools.

---

## After Setup

Once configured, use the `mcporter` skill for quick command reference:

```bash
npx mcporter list <server>
npx mcporter call <server>.<tool> param=value
```

## References

- [MCPorter Documentation](https://github.com/steipete/mcporter)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)
- [Zo Secrets](/?t=settings&s=advanced)
