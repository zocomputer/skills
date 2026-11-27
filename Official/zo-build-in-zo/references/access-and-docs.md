# Access and remote docs

Use the section matching the existing client. These bootstrap instructions
let you identify the caller and fetch current guides without a source
checkout. Read the fetched authentication and client guides for the task's
full setup.

## Identify the workspace and principal

The production API base is `https://api.zo.computer/zo-system-api/v1`.
Preserve another environment only when the user or existing connection
explicitly selects it. Send a credential only to its intended API origin;
do not forward it to documentation websites or across redirects.

### Zo CLI

The public CLI is `zo`, from `@zocomputer/cli`. Inspect an existing sign-in
without printing its tokens:

```sh
zo auth status --json
zo context list --json
```

For a named profile, pass `--profile <profile>` to both. After resolving the
target, run:

```sh
zo auth status --profile <profile> --workspace <workspace-id> --json
```

Check `environment`, `selected_workspace.workspace_id`, and
`selected_workspace.subject` (type and ID). `approving_subject` identifies
the person who approved the login, who may differ from the effective subject.

Pass the chosen `--profile` and `--workspace` on subsequent commands. Workspace
selection otherwise falls back to `ZO_WORKSPACE_ID`, then the profile's saved
default. Prefer per-command selection over changing shared defaults with
`zo context use`. An environment token override,
`ZO_SYSTEM_API_ACCESS_TOKEN`, can also change which credential the CLI uses;
status must reflect the credential actually used for this task.

If no suitable sign-in exists, use the client's normal sign-in flow. For a
CLI setup, install it if needed with `npm install --global @zocomputer/cli@latest`,
then run `zo login --profile <profile>`. Let the user approve the displayed
code, workspace, and identity in their browser. Use a new profile when a different
sign-in should be kept alongside an existing one. Do not replace an existing
login or choose an owner identity merely to avoid an access refusal.

To make authenticated HTTP requests from a CLI sign-in, capture
`zo auth token --profile <profile> --workspace <workspace-id>` directly into
the requesting process or a private shell variable, without printing it or
enabling shell tracing. Obtain a fresh token when it expires. Do not read or
copy the CLI's credential files.

### HTTP and TypeScript SDK

With the System API bearer used by this client, request:

```http
GET /zo-system-api/v1/session
Authorization: Bearer <system-api-access-token>
```

Use the client's API origin. Send no workspace header or query parameters
on this request. The response's `workspaces` array gives each authorized
`workspace_id`, `name`, and effective `subject` (type and ID). It also gives
`credential_kind`, `approving_subject`, and expiry information. Do not cache
it; access can change. A workspace-bound bearer returns one workspace and
may have no approving human.

Select the resolved workspace using `Zo-Workspace-Id` for HTTP invocation,
`workspace_id` for catalog queries, or `workspaceId` in the TypeScript SDK's
`createClient` configuration. An action's input does not replace transport
selection. The SDK's `accessToken` callback supplies tokens but does not
obtain or refresh them; use the current authentication guide for an
appropriate token provider. Host API keys and provider credentials such as
a Slack token are not System API credentials.

### MCP

Read the existing server's initialization instructions and connection
metadata. A connection with `workspace_id` in its URL or `Zo-Workspace-Id`
header is bound to that workspace. Do not add a top-level `workspace_id` to
tool arguments on a bound connection. On a multi-workspace connection, each
tool call supplies a top-level `workspace_id` alongside `input` and `options`.
Follow the exposed tool schema in either case; an action may also require
the same ID inside `input`.

Initialization can identify authorized workspaces without revealing their
effective principals. Use trusted identity metadata from this connection or
`GET /session` with its bearer when the client provides an authorized way to
make that request. A separately signed-in CLI does not prove the MCP caller's
identity. If the client hides it, ask the user which identity they authorized
for this workspace in that connection, and distinguish that answer from a
server-verified identity. Do not extract tokens from client storage.

For a new connection, the production Streamable HTTP URL is
`https://api.zo.computer/zo-system-api/v1/mcp?catalog=scoped`. Browser OAuth
requires a supported, registered client; do not invent a client ID or assume
dynamic client registration. Use the client's supported Zo sign-in or the
CLI path above, then fetch `zo-docs:///guide/install.md` for current setup.

## Read docs through the existing client

If the MCP client exposes resources, use `resources/list` and `resources/read`
on the Zo server. Begin with `zo-docs:///guide.md` and
`zo-docs:///patterns.md`. A `zo-docs:///…` URI is an MCP resource identifier,
not a URL for a browser or HTTP GET.

Pass a returned `nextCursor` as `params.cursor` to list another page. Read a
returned URI with `params.uri`; the Markdown is in `result.contents[].text`,
with links to other `zo-docs:///…` resources. Use the index and page links
before listing the whole collection.

When available on a native Zo Agent, `read_zo_docs(uri=...)` reads the
deployment's same documentation bundle. With no URI it lists pages; pass
`nextCursor` back as `cursor` for more. This tool is not a System API action
or a tool guaranteed to exist in external MCP clients.

If the client exposes tools but not resources, use the HTTP procedure below
with an authorized credential. If it exposes neither HTTP access nor a way
to read documentation resources, explain the missing capability and ask for
a supported docs connection. Do not substitute tool descriptions for guides.

## Read docs with any HTTP client

This procedure is available even when the application uses SDK or HTTP
actions. It only reads documentation; it does not invoke workspace actions.
Use the same resolved environment, workspace, and System API bearer.

POST each JSON body below to:

```text
https://api.zo.computer/zo-system-api/v1/mcp?workspace_id=<workspace-id>&catalog=scoped
```

Use these headers on every request, including the notification:

```http
Authorization: Bearer <system-api-access-token>
Content-Type: application/json
Accept: application/json, text/event-stream
```

1. Initialize with a protocol version your client supports. This minimal
   client uses a version supported by the current Zo endpoint:

   ```json
   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"build-in-zo","version":"1.0"}}}
   ```

   Read `result.protocolVersion`, `capabilities`, and `instructions`. Continue
   only if the returned version is supported by your client. Add
   `MCP-Protocol-Version: <returned-version>` to subsequent requests. Zo
   currently returns JSON and uses no persistent MCP session ID.

2. Complete initialization:

   ```json
   {"jsonrpc":"2.0","method":"notifications/initialized"}
   ```

   This returns HTTP 202 without a JSON-RPC result. Do not try to parse an
   empty response as JSON.

3. Read the introduction, then repeat with `zo-docs:///patterns.md`:

   ```json
   {"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"zo-docs:///guide.md"}}
   ```

4. Follow links to the pages needed for the task. To discover moved pages:

   ```json
   {"jsonrpc":"2.0","id":3,"method":"resources/list","params":{}}
   ```

Check HTTP failures and JSON-RPC `error` before reading `result`.
`result._meta["zo/docs_revision"]` identifies the served bundle. If that
revision changes during retrieval, reread the indexes and affected pages.
A listing cursor from an old revision is invalid; restart without it.
Unknown resource URIs return JSON-RPC `-32002`; rediscover the page.

Documentation requires valid System API credentials and workspace eligibility,
but no action grant. A 401 calls for token refresh or sign-in through the
existing credential provider; a 403 calls for checking workspace access.
Neither is a reason to grant broader action permissions. Reading a guide
does not prove its actions are callable by this principal.

## Website exports

If a current, accessible Zo documentation site is known from the connection
or supplied by the user, its System documentation publishes `/docs/llms.txt`
and Markdown twins of pages under `/docs`. Fetch the index and follow its
links; use `/docs/llms-full.txt` only when the whole collection is needed.
Do not send the System API bearer to the website.

Check the response content and final URL: a successful HTML login page is
not a documentation index. The System documentation website can be protected
or not yet published at the public domain. In that case, use the authenticated
API resources above. Do not guess an internal deployment URL or bypass site
protection. Website and API deployments can differ; use the API's docs and
live catalog to resolve a mismatch affecting execution.
