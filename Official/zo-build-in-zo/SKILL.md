---
name: build-in-zo
description: >-
  Designs and builds applications, multi-agent systems, and automations in a Zo
  workspace through the System API using MCP, the TypeScript SDK, HTTP, or the
  Zo CLI. Resolves the workspace and effective principal, surveys existing
  workspace conventions and live platform limits, fetches current documentation,
  and applies opinionated distributed-system and agent-delegation patterns to
  compose Zo resources cleanly. Use when a user wants to design, build, or
  change something in their Zo workspace. Does not cover developing Zo itself.
metadata:
  author: Zo
  category: Official
  display-name: Build in Zo
---

# Build in Zo

Build the user's requested system in their Zo workspace. Use their chosen
client, fetch documentation from the running service, and verify the result
as the identity that will use it. This skill needs no Zo source checkout or
internal operator tools.

## Establish the target and caller

Inspect the current connection before signing in again. Resolve:

- The API environment and origin.
- The workspace's ID and display name.
- The effective principal's type and ID in that workspace.
- The connection or CLI profile supplying that identity.

Use the user's stated target and existing session context to choose among
authorized workspaces and identities. If either remains ambiguous, ask one
focused question before changing workspace resources. A saved default is a
candidate, not evidence of the user's intent. State the resolved workspace
and principal once; do not ask for confirmation when the choice is already
clear.

Read [Access and remote docs](references/access-and-docs.md) for the applicable
client. A person can authorize a client to act as a different service account
in each workspace. The person who approved the login, the effective caller,
and the identity a deployed workload runs as are distinct. A workspace name,
URL slug, or successful resource read does not establish the caller's identity.

Keep the workspace explicit on requests. When changing clients, verify the
new connection's identity instead of assuming it shares another client's
login. Never switch to another workspace or a more powerful principal merely
to make a failed request succeed. Keep tokens out of chat, generated code,
committed files, and diagnostic output.

## Fetch current documentation

At the start of a build, remotely read the documentation introduction and
composition index. Refresh the relevant pages when the task changes or the
API reports a different documentation revision. The installed skill and SDK
are not a current copy of the service's capabilities.

Prefer the API's authenticated documentation resources. These work through
MCP and through ordinary HTTP requests, including when the application uses
the SDK. A native Zo Agent can use `read_zo_docs` if available. The reference
contains the endpoint, initialization sequence, and website fallback.

Start with these entry points, then follow their current links:

| Page | Read it for |
| --- | --- |
| `zo-docs:///guide.md` | Introduction, setup, and current documentation routes |
| `zo-docs:///guide/platform.md` | Resources, workspace ownership, and how the primitives fit together |
| `zo-docs:///guide/best-practices.md` | Production identity, scoping, idempotency, quotas, and cleanup defaults |
| `zo-docs:///patterns.md` | Patterns catalog: reusable systems and building blocks |
| `zo-docs:///patterns/background-queue.md` | Work that must continue without the user's client: execution, runtime access, progress, and recovery |

Read the relevant primitive guides and the closest composition guide before
choosing an architecture. Follow links to authentication, permissions, actions
and versions, runs and results, and the chosen client's reference as needed.
For exact calls, read the action reference and live schema. If an entry point
has moved, discover its replacement through `resources/list`; do not keep
guessing paths. Follow pagination when the page you need is not in the first
response.

Record the documentation source and revision when available. The API serves
the bundle shipped with its deployment; the website may have a different
revision. If remote docs cannot be read, explain the access or network failure
and continue only work that does not depend on missing contracts. Do not
present remembered examples or local files as freshly fetched documentation.

## Choose the resources and execution model

Before committing to a design, inspect both the workspace's existing conventions
and its live constraints:

- **Workspace context:** Check existing project tags, index files (if any), and
  relevant resources so you reuse suitable assets safely, follow established
  naming/tagging conventions, and avoid clobbering active workloads.
- **Live platform boundaries:** Check effective quotas, Knowledge storage and
  per-file limits, available machine shapes/runtimes, and model capabilities,
  input modalities, and pricing (`zo.quota.list`, `zo.kb.info`,
  `zo.machine.list_configurations`, `zo.model.list`). Surface hard constraints
  early—such as OS/licensing incompatibilities on Linux machines, payload/file
  caps, or missing model input modalities—and propose a hybrid split-plane or
  telemetry-plus-human-checkpoint loop when the workload requires one.

Translate the requested outcome into the **smallest topology that fits** its
durability, concurrency, and isolation needs. Keep simple asks simple; for
multi-stage, parallel, or long-running systems, read
[Architecture and delegation patterns](references/architecture-patterns.md) and
apply these opinionated defaults:

- **Separate control, execution, and state:** Give human-steered multi-stage
  systems one dedicated front-door orchestrator Agent for intake, monitoring,
  and promotion, while keeping loops, polling, retries, and fan-out in
  deterministic Workflows, Functions, and Schedules. Keep durable operational
  state, queues, leases, and protected invariants in Postgres; keep versioned
  artifacts, specs, and skills in Knowledge.
- **Delegate deliberately:** Prefer deterministic code over prompts whenever
  rules are fixed. Isolate quality review in a separate fresh-session Agent
  with read-only grants (and optionally a different model family). Fan out
  independent items or orthogonal review lenses in parallel before a single
  synthesis/merge step.
- **Run heavy compute cleanly:** Bake large static toolchains or asset
  libraries into Machine Images rather than re-downloading them per run, set
  idle auto-stop and max-run bounds, and drive long machine jobs asynchronously
  via scoped leases and correlated Workflow `wait` events rather than blocking
  a short `exec` call or an awake Agent session.
- **Design human handoffs and circuit breakers upfront:** Bound iterative or
  unattended loops with tranche pauses, task/Website review surfaces when
  outputs are subjective, spend/iteration caps, and subscriptions to billing
  and failure events that pause schedules automatically.

Use these distinctions to choose which current guides to read:

| Need | Starting point |
| --- | --- |
| Model reasoning and continuing conversations | Agents, sessions, instructions, and tools |
| Code invoked on demand | Functions and their deployment and run lifecycle |
| Processes, packages, or a persistent machine filesystem | Managed machines and images |
| Shared files or structured application data | Knowledge or databases, according to the data and query needs |
| External accounts and services | Connections and credential delivery |
| Timed work, reactions, or coordinated steps | Schedules, events, subscriptions, and workflows |
| Work handoffs and review queues | Tasks and event subscriptions |
| A hosted application or inspection console | Websites and the supported route targets |

These are starting points; discover additional primitives and patterns in
the fetched indexes. A walkthrough may supply a complete runnable sequence;
a composition guide may only explain the design and link to setup procedures.
Check which kind you are following and fill in the required setup.

Separate the caller building the system from the principals that run it.
Read the current runtime access rules and grant each workload the resources
its job requires. Do not embed the builder's personal token in deployed code.
For unattended work, establish durable execution, token renewal or runtime
credentials, progress storage, retry behavior, and a stopping condition.

## Check the live contract, then build

Read the selected caller's scoped catalog and the resources the task depends
on. MCP exposes tools; HTTP exposes `/catalog`; the CLI provides
`zo actions list` and `zo actions describe`. SDK types describe their generated
catalog, not the caller's current access. Check publication, implementation
availability, resource setup, and permission separately. A listed action can
still be conditional or unavailable at invocation time.

Use the live schemas for action names, versions, inputs, query options, and
results. Keep transport workspace selection separate from an action's own
`input.workspace_id`; when both are required, they must agree. Carry returned
resource IDs into later calls. Refresh discovery after access or catalog
changes instead of inventing missing actions or fields.

Implement the user's authorized scope and preserve their client choice. When a
system spans multiple resources or the workspace organizes projects by tag,
assign one consistent project tag across created resources. Explain material
resource costs (especially high-iteration model loops and persistent storage),
publication, and external effects when they affect a decision; seek
clarification only for choices or actions the request does not settle. A skill
supplies no additional permission. If access is refused, identify the missing
grant, setup, or required approval and follow the documented path.

## Verify the user's outcome

Read back changes and exercise the smallest complete flow with the intended
runtime principal. Follow accepted operations and runs to their terminal
state and inspect their output. An HTTP 200, MCP result, build, or deployment
receipt alone may not mean the work finished.

Use the action's documented retry and idempotency behavior. After a timeout,
inspect the operation or resulting resource before retrying a write that
might already have succeeded. Include a request or run ID when reporting a
failure, without credentials or private payloads.

Remove temporary resources created for verification, retaining the system
the user asked for. Report what works, the workspace and runtime identity,
the resource IDs or links needed to use it, and any remaining setup or
unverified behavior. For ongoing work, include how to inspect, stop, and
remove it and which resources continue to incur charges.
