---
name: hol-guard
description: Protect supported local coding-agent runtimes with HOL Guard before mutation-bearing tool work.
compatibility: Created for Zo Computer
metadata:
  author: Hashgraph Online
  category: Community
---

# HOL Guard Runtime Safety

Use HOL Guard as a local safety boundary before a supported coding agent performs mutation-bearing tool work. Keep repository review, provider permissions, sandboxing, and remote service controls authoritative.

## Set up the reviewed runtime

Check whether HOL Guard is already available:

```bash
hol-guard --version
```

If it is unavailable and installing tools is authorized, install the reviewed stable release used by this skill:

```bash
uv tool install "hol-guard[cisco]==2.2.128"
hol-guard --version
```

Require the version check to report `2.2.128`. Do not silently replace the pin with `latest`, a branch URL, or an unversioned package. If `uv` is unavailable or installation is not authorized, stop and report the missing prerequisite instead of continuing unprotected.

## Detect a supported harness

Ask HOL Guard for the exact harness identifier:

```bash
hol-guard detect --json
```

Use only a supported identifier returned by `detect`. Do not maintain a separate alias list or assume that an arbitrary agent runtime is covered.

## Protect the harness

Run the HOL Guard-owned setup and verification flow:

```bash
hol-guard bootstrap
hol-guard install <detected-harness>
hol-guard run <detected-harness> --dry-run
hol-guard doctor <detected-harness> --json
hol-guard status --json
```

Before real mutation-bearing work, launch the supported harness through Guard rather than directly:

```bash
hol-guard run <detected-harness>
```

Treat an unprotected fallback as failure. If installation, dry-run, doctor, or status cannot prove the expected protection state, stop mutation-bearing tool work and report the failing command.

## Review Guard decisions

When Guard blocks or queues work, inspect the actual request and evidence before deciding what to do:

```bash
hol-guard approvals
hol-guard approvals open <request-id>
hol-guard receipts
hol-guard events
```

Use the pending request ID returned by `hol-guard approvals` when opening a specific approval. Approve or deny only through Guard-owned commands after reviewing the risk reason and requested scope. Do not bypass a Guard decision by editing the protected harness configuration manually.

## Boundary

HOL Guard protects supported local agent runtimes. It does not replace repository policy, code review, operating-system isolation, application authorization, provider-side access controls, or remote services' own safety checks.
