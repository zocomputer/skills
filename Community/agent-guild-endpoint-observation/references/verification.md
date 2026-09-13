# Offline verification and provenance

From this skill directory, run the included tests with Bun:

```bash
bun test scripts/observe.test.mjs
```

The tests execute the actual helper and its CLI argument handler. They substitute
only `node:https.request`, so no live Guild call or selected-target request is
needed. Fixed-origin request options, exact URL transmission, invalid-input
zero-request cases, streamed response limits, cancellation, actual six-second
timeouts, malformed JSON/evidence, unknowns and fixed output boundaries are tested.
No API key, account, model call or payment is used. A direct CLI run with missing
arguments returns a fixed unavailable JSON result and exits 1.

For repository contribution validation, run `bun validate` from the Zo skills
repository root after installing its pinned development dependencies. That native
validator checks skill layout and frontmatter; it does not execute this helper or
validate `DISPLAY.json` fields. The display metadata follows the repository's
[DISPLAY specification](https://github.com/zocomputer/skills/blob/a86c4b112e108e0d1938f5e61ee3a1de59e37f1d/DISPLAY.md).
The neutral `search` icon is a presentation choice, not a verified-trust badge.

`retained-preflight.json` is a dated, unmodified public response from an owned
Guild preflight observation completed **2026-09-11 08:48:23 UTC**, for
`https://agent-guild-5d5r.onrender.com/mcp`. Its 1,976 bytes have SHA256
`9ba3037bc50d199517416be4e3d8b327438fc2a7d898828b3e20dfeabe7e1b69`.
It is a fixture, not a claim about current endpoint state or an independent
customer. The helper's service-shape checks are grounded in
[Guild preflight.py at 9cf6c561](https://github.com/AgentTanuki/agent-guild/blob/9cf6c561468e60afb77acdbddebfc5134a155e4f/live/guild/app/preflight.py),
including the six check names, two blocking checks and the `scored` array of all
non-unknown checks. The helper and skill are original AgentTanuki work under MIT;
the service implementation is reference material and is not bundled.

Local native validation cannot establish Zo cloud installation, UI rendering,
model selection of the skill, remote availability or adoption. No hosted Zo
account or production service was exercised during these offline checks.
