# Architecture and delegation patterns

Use these opinionated defaults when translating a user's goal into a Zo system.
They are design stances, not API contracts; verify exact schemas, quotas, and
capabilities against the fetched docs and live catalog before provisioning.

## 1. Right-size the topology first

Choose the smallest topology that satisfies the ask's durability, concurrency,
and isolation requirements. Do not build a multi-agent distributed system when a
single Function, schedule, or Agent is enough.

| Ask shape | Default topology |
| --- | --- |
| One-off task, prototype, or lightweight assistant | Single Agent (or CLI/SDK script) + Knowledge folder |
| Bounded recurring or event-driven automation | Schedule or Event -> Subscription -> Function (or single Agent when open-ended judgment is required) + lightweight state |
| Multi-stage, high-iteration, parallel, or long-running production system | Separate **Control Plane** (front-door Orchestrator Agent + deterministic Workflows/Events), **Execution Plane** (specialized Agents, Functions, Machines), and **State Plane** (Postgres + Knowledge) |

Move up a tier when the work must survive closed clients, span many iterations
or parallel items, enforce independent quality gates, coordinate heavy compute,
or expose a durable review surface.

## 2. Separate control, execution, and state

For non-trivial systems, keep three concerns distinct:

- **One front-door orchestrator Agent for human-steered systems:** When a user
  wants to commission, steer, monitor, and promote multi-stage work, give them
  one dedicated Agent as the conversational entry point. Equip it with domain
  skills, read/write access to project state, and permission to invoke
  Workflows, dispatch events, or manage tasks.
- **Deterministic loops, not polling Agents:** Keep Agents on judgment,
  creation, synthesis, and exception triage. Put scheduling, retries, batch
  dispatch, status polling, lease recovery, and deterministic checks in
  Workflows, Functions, and Schedules. Never wake an Agent on a timer merely to
  check whether a background job finished.
- **Durable external state over chat history:** Treat Agent sessions as
  ephemeral working memory. Store operational state in **Postgres** (queues,
  atomic claims via `FOR UPDATE SKIP LOCKED`, version lineage, leases,
  invariants/protected decisions, metrics, and spend ledgers) and large or
  versioned artifacts, reference corpora, instructions, and skills in
  **Knowledge**.

## 3. Delegate deliberately across code and Agents

Apply strict role boundaries so agents stay focused, verifiable, and cheap:

- **Prefer code over prompts for deterministic work:** Parsing, validation,
  compilation, metric calculation, linting, format conversion, and routing
  belong in Functions or Machine scripts—not LLM turns.
- **Isolate verification in fresh-session, read-only Reviewers:** Do not rely on
  an authoring Agent to be the sole judge of its own work. Invoke a separate
  Reviewer/Critic Agent in a **fresh session** with **read-only grants** on the
  artifact (see `zo-docs:///patterns/independent-reviewer.md`). Using a different model
  family from the author helps break correlated blind spots.
- **Prevent oscillation in iterative loops:** Give each review pass a narrow,
  explicit rubric grounded in reference material or quantitative measurements,
  and persist accepted decisions and protected invariants ("do-not-touch"
  constraints with rationale) in structured state so later rounds do not undo
  earlier wins.
- **Route models by role and cache aggressively:** Reserve frontier reasoning
  models for direction, synthesis, and high-stakes adjudication; use faster,
  cheaper models for narrow checks or structured extraction. Structure prompts
  with stable static prefixes (rubrics, reference excerpts, current artifact)
  before per-turn deltas to maximize prompt-cache hits.

## 4. Parallelize cleanly and handle long compute asynchronously

- **Fan out orthogonal work:** Use Workflow `parallel` / `for_each` steps (see
  `zo-docs:///patterns/split-and-collect.md`) for independent items or read-only review
  lenses, followed by a single deterministic reducer or adjudicator Agent that
  merges findings into one versioned update. Prefer parallel read-only critiques
  plus one synthesis pass over long serial edit-critique chains.
- **Bound concurrency to live quotas:** Size worker fan-out against live
  workspace compute quotas (vCPUs, RAM, GPUs, concurrent machines) with
  headroom for other workspace workloads.
- **Pre-bake heavy runtimes into Machine Images:** When workloads need custom
  system packages, compilers, headless browsers, model weights, or large static
  asset libraries, build and validate once on a temporary builder machine and
  snapshot it into a reusable Machine Image. Do not reinstall toolchains or
  re-download gigabytes of static assets on every job. Always set idle
  auto-stop and maximum-run timeouts on on-demand machines.
- **Drive long machine jobs asynchronously:** Managed command execution has a
  short synchronous timeout. For jobs that exceed it, use an async pattern:
  issue a scoped job lease in state -> start the bounded worker command ->
  suspend the Workflow on a correlated `wait` for a completion event (backed by
  a bounded recovery schedule that pauses itself when idle) -> run an
  independent deterministic verifier before marking the job complete.

## 5. Check platform and sensory boundaries before designing

Before committing to an architecture, inspect live workspace capabilities
(`zo.quota.list`, `zo.kb.info`, `zo.machine.list_configurations`,
`zo.model.list`) and surface hard constraints early:

- **OS, hardware, and licensing fit:** Managed machines run Linux x86_64
  (confirm live runtime/GPU constraints in machine configurations). If a
  workload depends on macOS/Windows-only binaries, local hardware dongles, or
  desktop DRM that cannot run reliably headlessly on Linux, flag it upfront and
  propose a **hybrid split-plane**: keep orchestration, state, Agents,
  analysis, and review UI native in Zo, and bridge only the constrained
  execution step via a narrow pull-only external worker authenticated as a
  least-privilege service account that reports completion back through a Zo
  event.
- **Storage and payload ceilings:** Check Knowledge quota, per-file upload
  limits, Function payload limits, and Machine disk ceilings. Split oversized
  archives, keep large immutable dependencies in Machine Images, and pass file
  IDs or presigned URLs rather than inline payloads.
- **Model modality gaps:** Check `zo.model.list` input modalities before
  assuming an Agent can directly inspect an output format. When models cannot
  perceive the medium directly (for example, audio, interactive feel, or
  OCR-hostile diagrams/notation), pair deterministic programmatic telemetry
  plus rendered visual artifacts (charts, contact sheets, page images) with
  explicit human review checkpoints.

## 6. Design human handoffs and feedback loops

For subjective, high-stakes, or long-running work, make human oversight cheap
and durable:

- **Run in bounded tranches:** Pause between batches rather than letting an
  unconstrained loop run blind. Use workspace Tasks (see
  `zo-docs:///patterns/human-handoff.md`) for conversational escalations and
  sign-offs, and withhold high-impact grants from autonomous Agents when a
  human should execute the final step.
- **Provide a lightweight inspection surface when review is rich:** When humans
  need to compare versions, audition media, or inspect telemetry across many
  runs, serve a thin read-only Website backed by Postgres/Knowledge that does
  not wake heavy compute on read.
- **Compile human feedback into durable rules:** When a human gives a recurring
  qualitative correction during review, store it as an explicit rule or
  deterministic check in Postgres/Knowledge so downstream critics and linters
  enforce it automatically on future rounds.

## 7. Ship guardrails and workspace hygiene on day one

Every unattended, scheduled, or iterative system should include:

- **Hard stopping conditions and spend protection:** Track iteration counts and
  budget ceilings in state, and wire platform billing and failure events
  (credit-low, credit-exhausted, and consecutive workflow/function failures) to
  pause active schedules automatically without making model calls.
- **Idempotency and stale-lease recovery:** Use idempotency keys on event
  dispatches and invocations, atomic state transitions in Postgres, and a
  bounded reconciler that reclaims timed-out leases and stops idle workers.
- **Consistent project tagging:** Tag all resources belonging to one project
  under a shared project tag (after checking `zo.tag.list` for workspace
  conventions) so discovery, cost attribution, maintenance, and teardown stay
  clean.
- **Observability:** Rely on `zo.logs` trace trees and `zo.activity.list`
  rather than ad-hoc log scraping to diagnose multi-hop failures.
