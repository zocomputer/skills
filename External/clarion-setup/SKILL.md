---
name: clarion-setup
description: Bootstraps the Clarion Intelligence System on Zo Computer. Run this once after installing — clones the source repo, installs the ai_buffett_zo Python library, creates the workspace data tree under /home/workspace/clarion/ (auto-detected on Zo), auto-installs all nine sibling clarion-* skills (regime-check, sec-research, single-stock-eval, expected-return-calc, value-screener, thesis-write, thesis-monitor, watchlist-update, living-letter-update) under /home/workspace/Skills/, and registers the sec-indexer background service. Idempotent (safe to re-run; refreshes installed skills with upstream copies). This is the only Clarion skill a user needs to install manually — every other clarion-* skill is installed by this one. Use when the user asks to "set up Clarion" or "install Clarion".
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Setup
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion Setup

Bootstraps Clarion Intelligence System on a Zo workspace. Run this once before any other `clarion-*` skill.

## What you do

Run the steps below in order. Stop and surface any failure to the user immediately — do not proceed past a failure.

### Step 1 — Clone or update the source repo

The repo holds the Python library, the `sec-indexer` service code, and templates.

If `/home/workspace/clarion-intelligence-system` does NOT exist:

```bash
gh repo clone jingerzz/clarion-intelligence-system /home/workspace/clarion-intelligence-system
```

If it exists, update it:

```bash
git -C /home/workspace/clarion-intelligence-system pull --ff-only
```

### Step 2 — Run the setup script

```bash
python /home/workspace/clarion-intelligence-system/skills/clarion-setup/scripts/setup.py
```

The script is idempotent. It will:

- Install the `ai_buffett_zo` library editable (auto-detects whether to use `--system`)
- Create the `~/clarion/{data/equities,sec,queue,theses,watchlists,letters}/` data tree
- Write a default `~/clarion/config.json` (preserves any existing config)
- Verify the `sec-indexer` console script is on PATH
- Install every sibling `clarion-*` skill from the repo into `/home/workspace/Skills/` (refreshes any already-installed copies; pass `--skip-skills` to opt out)
- Print service registration parameters between `--- BEGIN SERVICE_REGISTRATION ---` and `--- END SERVICE_REGISTRATION ---`
- Print a final `SETUP_RESULT: ok` line on success, or `SETUP_RESULT: error: <reason>` on failure

If you do NOT see `SETUP_RESULT: ok`, surface the error to the user verbatim and stop.

### Step 3 — Confirm or create the ZO_API_KEY secret

**Scope:** This step is only needed because of the `sec-indexer` **background service**. The other Clarion skills (`clarion-regime-check`, `clarion-sec-research`, etc.) run inside chat agent turns, which auto-inject `ZO_CLIENT_IDENTITY_TOKEN`, so they need no token setup. The indexer runs as a persistent process outside agent turns, has no auto-injected identity, and so needs a long-lived bearer.

The token is **not** an external provider key (no OpenAI / Anthropic / Minimax keys involved). It's Zo-issued and calls made with it are billed against the user's Zo monthly credit pool, same as their chat usage.

**Decision — fresh install vs. re-run:**

- If the user already has a Zo secret named exactly `ZO_API_KEY` (most likely on a re-run), skip to Step 4.
- Otherwise (most likely on a first install), do the verbatim-paste step below.

**CRITICAL — paste the user-action block verbatim.** The setup script's stdout includes a block bounded by `--- BEGIN USER_ACTION_REQUIRED ---` and `--- END USER_ACTION_REQUIRED ---`. **Copy the contents of that block (everything between the two sentinels) into the chat exactly as written. Do not summarize, paraphrase, or condense.**

The block is dummy-proofed for a non-technical user: it has the exact menu paths, the exact secret name (`ZO_API_KEY`, uppercase, with underscore — the most error-prone part), the numbered sequence, and a note about UI variations. Compressing it removes the dummy-proofing.

After pasting the block:

1. Wait for the user to reply with `done` (or any clear confirmation).
2. If they reply with a question instead of confirmation (e.g. "I can't find Settings"), help them — but lead with the same explicit substeps from the user-action block, not your own paraphrase.
3. Once confirmed, proceed to Step 4.

### Step 4 — Register the sec-indexer service

Use the `register_user_service` agent tool with these exact parameters (also printed by setup.py in the SERVICE_REGISTRATION envelope):

- **label**: `sec-indexer`
- **mode**: `process`
- **entrypoint**: `sec-indexer`
- **workdir**: `/home/workspace`
- **env_vars**: pass as a JSON **object** — see *env_vars formatting* below
- **description**: `Clarion sec-indexer — background SEC EDGAR filing indexer`

**env_vars formatting (critical — common failure mode).** `env_vars` is an object-valued parameter, **not a stringified JSON**. Pass it exactly as printed in the `SERVICE_REGISTRATION` envelope:

```json
{"ZO_API_KEY": "$ZO_API_KEY", "CLARION_DATA_ROOT": "/home/workspace/clarion"}
```

Do **not** wrap it in quotes and escape it like `"{\"ZO_API_KEY\": \"$ZO_API_KEY\", ...}"`. If the tool call appears to require escape sequences inside `env_vars`, stop and re-form the call — the parameter is an object, not a string. Models that try to escape this end up generating malformed input that either fails outright (`register_user_service` returns a runner-stopped error) or — worse — succeeds with corrupted values (env vars inlined into the entrypoint shell-string, trailing XML-tag artifacts appended to the entrypoint, `CLARION_DATA_ROOT` silently dropped). The wrong-values-but-success failure mode is the dangerous one and Step 5 catches it; the prevention is to get the env_vars shape right here.

The `$ZO_API_KEY` value is shell-style syntax telling Zo to resolve from the user's secret of the same name (created in Step 3) at service start. The `CLARION_DATA_ROOT` value is a literal path — it pins the indexer's writes to the same data root chat skills read from, so SEC filings land in the user-visible workspace and not in `/root/clarion/` when the service runs as root. Use the snake_case parameter names exactly — `workdir` and `env_vars` — these are the canonical keys Zo's tool accepts.

Confirm registration succeeded (the tool should return a service ID like `svc_…`).

### Step 5 — Verify the service is actually running (do not skip)

**Critical:** `register_user_service` returns success when the registration is *recorded*, not when the process is *running*. The platform does not validate that the entrypoint is a parseable shell command, nor that env_vars were correctly formatted — those checks are on you, and silent-corruption failure modes do occur when model output drifts on the JSON-escaping path. Verify the service actually started before reporting completion.

Check service status using Zo's supervisor-status tool (`service_doctor` on the current Zo platform; use the equivalent if your environment differs):

```bash
service_doctor sec-indexer
```

**Expected:** `RUNNING` with a non-zero `uptime`. If the status shows `FATAL`, `BACKOFF`, `EXITED`, or `STOPPED`, the entrypoint failed to launch. The two failure modes you'll see in practice are:

1. **Trailing characters in the entrypoint.** The registered `entrypoint` field should be exactly `sec-indexer`. If it's something like `sec-indexer</`, `sec-indexer\n`, or `ZO_API_KEY="$ZO_API_KEY" ... sec-indexer` (env vars inlined into the entrypoint string), the model output got corrupted during the tool call. The supervisor cannot execute these.
2. **Missing or malformed env_vars.** If `ZO_API_KEY` or `CLARION_DATA_ROOT` aren't in the registered service's `env_vars` as separate keys (or got inlined into the entrypoint instead), the binary will either fail at startup (no token) or run but write to the wrong data root (`/root/clarion/` instead of `/home/workspace/clarion/`) — invisible to the user.

Inspect logs if status is not RUNNING:

```bash
tail -50 /dev/shm/sec-indexer.log
tail -50 /dev/shm/sec-indexer_err.log
```

If anything is wrong, **delete the broken service and re-register**. Re-read this skill's *env_vars formatting* note from Step 4 first — the most common cause is `env_vars` being passed as a string instead of an object on the retry too.

**Do not tell the user setup is complete until `service_doctor sec-indexer` shows RUNNING with non-zero uptime.** A registered-but-broken service is a worse failure mode than a registration that visibly failed.

As a separate (weaker) sanity check that the binary is reachable on PATH:

```bash
sec-indexer --help
```

This proves the executable resolves on PATH, but does NOT prove the service is running. The `service_doctor` check above is the one that actually validates the install.

Tell the user:

> Clarion is set up.
>
> - Source: `/home/workspace/clarion-intelligence-system/`
> - Workspace data: the path printed in the `[2/6] Creating data tree under …` line from setup.py (typically `/home/workspace/clarion/` on Zo, `~/clarion/` on a local machine — auto-detected)
> - Background service: `sec-indexer` (running)
> - Skills installed under `/home/workspace/Skills/`: every sibling `clarion-*` skill from the repo (regime-check, sec-research, single-stock-eval, expected-return-calc, value-screener, thesis-write, thesis-monitor, watchlist-update, living-letter-update). List the actual names returned in the `[5/6] Installing sibling clarion-* skills ...` block from setup.py.
>
> Just ask me things like *"what's the market regime?"*, *"analyze NVDA's latest 10-K"*, or *"is the market overvalued?"*.

## Idempotency

Re-running this skill is safe. Each step:

- Repo clone: skipped if already cloned (just `git pull`)
- Library install: re-runs `uv pip install -e` (no harm)
- Data tree: `mkdir -p` (no harm)
- Config: preserved if present
- Skill install: each sibling `clarion-*` skill in `/home/workspace/Skills/` is refreshed (overwritten) with the upstream copy. This is the intended path to pull in upstream skill fixes after a `git pull`.
- Service registration: if the user already has a `sec-indexer` service, `register_user_service` should report it exists; treat that as success.

### Re-running to pick up source updates

Editable installs (`uv pip install -e`) do NOT reload an already-running service — the `sec-indexer` process keeps the Python modules it imported at startup in memory. After a `git pull` brings in new code, you MUST restart the service for the changes to take effect.

If the user is re-running setup specifically to pull in upstream fixes (or you see behavior matching code that no longer exists in the repo), restart the service after Step 4:

- Use the `update_user_service` agent tool with the existing `sec-indexer` service ID and `action: restart` (or whatever the equivalent restart action is in the user's Zo environment).
- Confirm the service comes back up before re-running any failed `clarion-sec-research` query.

## On error

If any step fails, do not silently proceed. Read the error, summarize the cause, and offer the user the next step to take. Common cases:

- **`gh: command not found`** — Zo should ship `gh`. If missing, the user's workspace is in a non-standard state; ask them to contact Zo support.
- **`uv: command not found`** — same.
- **`uv pip install` fails with venv error** — the script tries `--system` automatically; if it still fails, ask the user to share the full error.
- **`register_user_service` fails** — surface the tool's error message; check whether `ZO_API_KEY` secret exists.
