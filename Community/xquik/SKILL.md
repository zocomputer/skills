---
name: xquik
description: Set up Xquik REST or MCP access for X data, monitors, webhooks, draws, and agent workflows.
compatibility: Created for Zo Computer
metadata:
  author: Xquik
  category: Community
  display-name: Xquik
---
# Xquik

Use this skill when a user wants an agent to work with Xquik through the public REST API, OpenAPI spec, or MCP server.

## Usage

### Choose the integration path

- Use MCP when an agent needs X data tools directly inside an MCP-capable client.
- Use REST when building an app, workflow, script, or backend integration.
- Use webhooks when the user needs event-driven monitor updates.
- Use the OpenAPI spec when generating typed clients or checking response contracts.

### Public entry points

- REST docs: `https://docs.xquik.com`
- OpenAPI spec: `https://docs.xquik.com/openapi.yaml`
- MCP docs: `https://docs.xquik.com/mcp/overview`
- MCP endpoint: `https://xquik.com/mcp`
- MCP manifest: `https://xquik.com/.well-known/mcp.json`
- OAuth discovery: `https://xquik.com/.well-known/oauth-authorization-server`

### Authentication

For REST requests, ask the user to create an Xquik API key and store it in the host secret store as `XQUIK_API_KEY`. Send REST requests with the `x-api-key` header.

For MCP clients, use OAuth 2.1 Authorization Code with PKCE when the client supports browser authorization. For API-key based MCP clients, use the MCP manifest and send the key through the `Authorization` header as documented there.

Never ask the user to paste API keys into chat. Never write keys into scripts, docs, config files, or examples. Refer to `XQUIK_API_KEY` only as an environment or secret-store variable.

### Setup checklist

1. Confirm whether the user needs MCP, REST, webhooks, or an OpenAPI-based client.
2. Open the matching public docs entry point above.
3. Confirm the required auth method before making requests.
4. Store the user-provided key as `XQUIK_API_KEY` if REST or API-key MCP access is needed.
5. Use the OpenAPI spec to choose the endpoint, request fields, pagination fields, and error handling.
6. Respect documented rate limits, retry `429` and `5xx` responses only when safe, and preserve idempotency for write workflows.

### REST request pattern

```bash
curl -fsS "https://xquik.com/api/v1/<endpoint>" \
  -H "x-api-key: ${XQUIK_API_KEY}"
```

Replace `<endpoint>` with a path from the OpenAPI spec. Do not invent endpoints from memory.

### MCP configuration pattern

Use `https://xquik.com/mcp` as the remote StreamableHTTP server URL. Configure authentication from the MCP manifest or through OAuth discovery, depending on the client's supported flow.

### Safety notes

- Treat X account data, monitor targets, webhook URLs, and API keys as sensitive user data.
- Keep examples generic unless the user supplies public IDs or URLs they want to query.
- Do not promise access to unsupported endpoints. Check the docs or OpenAPI spec first.
- Do not retry write actions unless the public API contract says it is safe.
