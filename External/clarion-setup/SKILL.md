---
name: clarion-setup
description: Bootstraps the Clarion Intelligence System on Zo Computer. Run this once after installing — clones the source repo, installs the ai_buffett_zo Python library, creates the workspace data tree under /home/workspace/clarion/ (auto-detected on Zo), auto-installs all nine sibling clarion-* skills (regime-check, sec-research, single-stock-eval, expected-return-calc, value-screener, thesis-write, thesis-monitor, watchlist-update, living-letter-update) under /home/workspace/Skills/, registers the sec-indexer background service, and installs the 7 Clarion personas + 8 routing rules into Zo Settings. Idempotent (safe to re-run; asks before replacing customized personas/rules). The only manual step is one batched human checkpoint near the end (SEC EDGAR name + email, and creating the ZO_API_KEY secret). Use when the user asks to "set up Clarion" or "install Clarion".
metadata:
  author: cis.zo.computer
  category: External
  display-name: Clarion Setup
  homepage: https://github.com/jingerzz/clarion-intelligence-system
---

# Clarion Setup

Bootstraps the Clarion Intelligence System on a Zo workspace. Run this once before any other `clarion-*` skill.

## Flow at a glance

This skill is designed for a **single-prompt install** experience. Steps 1–5 run autonomously (clone, library, data tree, register service, install personas + rules). Step 6 is one batched human checkpoint — the user supplies their SEC EDGAR identification and creates the `ZO_API_KEY` secret in Zo Settings. Steps 7–9 resume autonomously to apply the user's input, restart the service, verify it's running, and report.

Walk through the steps below in order. Stop and surface any failure to the user immediately — do not proceed past a failure.

## Step 1 — Clone or update the source repo

The repo holds the Python library, the `sec-indexer` service code, and templates.

If `/home/workspace/clarion-intelligence-system` does NOT exist:

```bash
gh repo clone jingerzz/clarion-intelligence-system /home/workspace/clarion-intelligence-system
```

If it exists, update it:

```bash
git -C /home/workspace/clarion-intelligence-system pull --ff-only
```

## Step 2 — Run the setup script

```bash
python /home/workspace/clarion-intelligence-system/skills/clarion-setup/scripts/setup.py
```

The script is idempotent. It will:

- Install the `ai_buffett_zo` library editable (auto-detects whether to use `--system`)
- Create the `~/clarion/{data/equities,sec,queue,theses,watchlists,letters}/` data tree
- Write a default `~/clarion/config.json` if missing (preserves any existing config — including any `sec_user_agent` you already customized)
- Verify the `sec-indexer` console script is on PATH
- Install every sibling `clarion-*` skill from the repo into `/home/workspace/Skills/` (refreshes any already-installed copies; pass `--skip-skills` to opt out)
- Print service registration parameters between `--- BEGIN SERVICE_REGISTRATION ---` and `--- END SERVICE_REGISTRATION ---`
- Print a `USER_ACTION_REQUIRED` block (you'll surface this in Step 6)
- Print a final `SETUP_RESULT: ok` line on success, or `SETUP_RESULT: error: <reason>` on failure

If you do NOT see `SETUP_RESULT: ok`, surface the error to the user verbatim and stop.

## Step 3 — Register the sec-indexer service

Use the `register_user_service` agent tool with the parameters printed in the `SERVICE_REGISTRATION` envelope:

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

Do **not** wrap it in quotes and escape it like `"{\"ZO_API_KEY\": \"$ZO_API_KEY\", ...}"`. If the tool call appears to require escape sequences inside `env_vars`, stop and re-form the call — the parameter is an object, not a string. Models that try to escape this end up generating malformed input that either fails outright or — worse — succeeds with corrupted values (env vars inlined into the entrypoint shell-string, trailing XML-tag artifacts appended to the entrypoint, `CLARION_DATA_ROOT` silently dropped). The verification at Step 8 catches the corrupted-success case; the prevention is to get the env_vars shape right here.

**Expected state after Step 3: the service is in `FATAL` or `BACKOFF`.** This is normal and expected. `$ZO_API_KEY` resolves from a Zo secret that doesn't exist yet (the user creates it in Step 6). The supervisor will try to launch `sec-indexer`, the binary will fail to authenticate against Zo's API, and the service will retry-backoff. **Do NOT call `service_doctor` yet. Do NOT delete and re-register. Continue to Step 4.** The restart in Step 7, after the secret exists, brings the service to RUNNING.

If `register_user_service` itself returns an error (not just a FATAL state — an actual tool error), check the env_vars formatting above first, then surface the error.

## Step 4 — Install the 7 Clarion personas

Read `/home/workspace/clarion-intelligence-system/docs/PERSONAS-AND-RULES.md`.

For each of the 7 personas — sections `## Persona 1 — Data-First Plain Talk` through `## Persona 7 — Clarion LP Voice`:

1. **Extract the persona name** from the section heading. Examples:
   - `## Persona 1 — Data-First Plain Talk` → name is `Data-First Plain Talk`
   - `## Persona 2 — Clarion Macro Sentinel` → name is `Clarion Macro Sentinel`
2. **Extract the persona's prompt text** — it's the contents of the *outermost* triple-backtick code block within the persona's section (before the next `## Persona` heading or the next top-level section). Note: persona prompts contain *nested* triple-backtick blocks for bash examples; you want the outermost one only.
3. **Check whether a persona with this name already exists**:
   - Call `list_personas()` and filter client-side by `name`.
   - If a match exists, ask the user: *"I see an existing Clarion persona named '\<NAME\>'. Replace it with the latest version from the doc? (yes/no)"* Wait for the answer.
     - If **yes**: call `delete_persona(persona_id=<existing_id>)`, then proceed to create.
     - If **no**: skip this persona entirely; do not create a duplicate. Note the existing `id` in the persona-ID map for Step 5.
   - If no match exists, proceed to create.
4. **Create the persona**: call `create_persona(name="<extracted name>", prompt="<extracted prompt>")`. The tool response contains the new persona's `id`. If the response shape is unexpected and you can't find the `id`, fall back to calling `list_personas()` again and filtering by name to recover the new id.
5. **Record** the mapping `{persona_name → persona_id}` for use in Step 5.

After all 7 personas, you should have a complete mapping covering all 7 Clarion persona names. Surface any persona that was skipped (user said "no" to replacement) — the corresponding rule in Step 5 still needs an ID to reference, so the existing persona's ID must be in the map.

## Step 5 — Install Clarion rules

Read the same `PERSONAS-AND-RULES.md` file. **Install Rules 3, 5, 6, 7, 8, 9, 10, and 11. SKIP Rules 1, 2, and 4** — they reference operator-personal infrastructure not installed by Clarion (memory layer, Zo Space verification). The doc has explicit scope notes confirming this.

For each rule to install:

1. **Extract the rule's Condition text** — the prose body after `**Condition:**` (a single paragraph, not in a code block).
2. **Extract the rule's Instruction text** — the contents of the triple-backtick block under `**Instruction:**`.
3. **For Rules 5–11 (the routing rules)**, the Instruction text contains a persona ID. The doc's checked-in value is the author's instance-specific UUID OR the placeholder `<your Persona N UUID>` (for Rule 11). **Replace it with the actual persona ID** you captured in Step 4, matched by name:
   - Rule 5 (stock evaluation) → `Clarion Analyst`
   - Rule 6 (regime questions) → `Clarion Macro Sentinel`
   - Rule 7 (thesis monitoring / portfolio status) → `Clarion Portfolio Manager`
   - Rule 8 (thesis writing) → `Clarion Thesis Architect`
   - Rule 9 (value screens) → `Clarion Value Screener`
   - Rule 10 (investor letter) → `Clarion LP Voice`
   - Rule 11 (return to default) → `Data-First Plain Talk`
4. **Check whether a Clarion routing rule with this condition already exists**:
   - Call `list_rules()` and compare each existing rule's condition text to the one you're about to install. Compare the first ~80 characters (handles minor wording variations across doc versions).
   - If a match exists, ask the user: *"I see an existing Clarion rule for '\<condition snippet\>'. Replace it? (yes/no)"* Wait for the answer.
     - If **yes**: call `delete_rule(rule_id=<existing_id>)`, then proceed to create.
     - If **no**: skip this rule.
   - If no match exists, proceed to create.
5. **Create the rule**: call `create_rule(instruction="<substituted instruction>", condition="<condition>")`.

Total expected after Step 5: **8 Clarion rules installed** (Rule 3 + Rules 5–11).

## Step 6 — Batched human checkpoint (the only manual step)

**Pre-check (skip the whole checkpoint on a clean re-run).** Before asking the user for anything, check both of:

1. `/home/workspace/clarion/config.json`'s `sec_user_agent` field — is it the placeholder `Clarion Intelligence System (clarion@example.com)`, or a real user value?
2. `service_doctor(service="sec-indexer")` — is the service already RUNNING with non-zero uptime? (If yes, the `ZO_API_KEY` secret already exists, since the service couldn't have started without it.)

If `sec_user_agent` is a real value AND the service is already RUNNING, **skip Step 6 entirely** — there's nothing for the user to do. Tell the user *"detected a complete prior install — skipping the human checkpoint and going straight to a refresh restart."* Jump to Step 7b (restart only, no config.json write needed).

Otherwise, you need at least one of two inputs from the user. **Surface both together so they can multitask** — the user can type their SEC identification in chat while simultaneously navigating Zo Settings to create the secret.

### Input A — SEC EDGAR identification

First, check `/home/workspace/clarion/config.json` — read the `sec_user_agent` field. If it is the placeholder `Clarion Intelligence System (clarion@example.com)`, you need a real value from the user. Ask:

> **SEC EDGAR requires Clarion to identify itself in every API request.** Type your name and email in the format: `Jane Doe jane@example.com`. This will be sent in the User-Agent header of every SEC request from your machine — only you and the SEC see it. SEC's [fair-access policy](https://www.sec.gov/os/accessing-edgar-data) asks every API consumer to identify themselves.
>
> Reply with that one line. While you're doing that, also start Input B below.

If `sec_user_agent` is already a non-placeholder value (a previous install set it), **skip Input A** and use what's already in config.json.

### Input B — Create the `ZO_API_KEY` secret in Zo Settings

The setup script's stdout includes a block bounded by `--- BEGIN USER_ACTION_REQUIRED ---` and `--- END USER_ACTION_REQUIRED ---`. **Paste the contents of that block (everything between the two sentinels) into chat verbatim**, below your Input A request. Do not summarize, paraphrase, or condense — the block is dummy-proofed for non-technical users with exact menu paths and the exact secret name (`ZO_API_KEY`, uppercase, with underscore — the most error-prone part).

Wait for the user to reply with:
- A line in the format `Name email@example.com` (for Input A) — **unless** you already had a non-placeholder `sec_user_agent`, in which case there's nothing to wait for here.
- The word `done` (or any clear confirmation) that they've created the `ZO_API_KEY` secret (for Input B).

If the user only replies to one of the two, prompt for the other before continuing.

## Step 7 — Apply user inputs and restart the service

### 7a — Write the SEC user-agent to config.json (only if Input A produced a value)

Substitute the user's reply into this command and run it:

```bash
python3 -c "import json, pathlib; p = pathlib.Path('/home/workspace/clarion/config.json'); d = json.loads(p.read_text()); d['sec_user_agent'] = '<USER_INPUT_VERBATIM>'; p.write_text(json.dumps(d, indent=2))"
```

Replace `<USER_INPUT_VERBATIM>` with the user's exact reply (no quotes around it inside the Python string — the outer quotes are already there). Confirm the write by reading the file back and showing the `sec_user_agent` line.

### 7b — Restart the sec-indexer service

Call `update_user_service` with the existing `sec-indexer` service_id and `action="restart"`. This:
- Causes the supervisor to re-evaluate `$ZO_API_KEY` (now that the secret exists)
- Restarts the `sec-indexer` process (which re-reads `config.json` on startup, picking up the new `sec_user_agent`)

Confirm the restart command succeeded.

## Step 8 — Verify the service is actually running (do not skip)

Call the `service_doctor` agent tool:

```
service_doctor(service="sec-indexer")
```

**Expected:** status is `RUNNING` with non-zero `uptime`. The tool also reports listening status, source-file freshness, and suggests fixes for any detected issues.

If the result shows `FATAL`, `BACKOFF`, `EXITED`, `STOPPED`, or any non-RUNNING state, the registration is genuinely broken. The two failure modes you'll see in practice:

1. **Trailing characters in the entrypoint.** Check the registered service's `entrypoint` field via `list_user_services()`. It must be exactly `sec-indexer`. If it's something like `sec-indexer</`, `sec-indexer\n`, or has env vars inlined into the entrypoint shell-string, the model output got corrupted during the Step 3 tool call.
2. **Missing or malformed env_vars.** If `ZO_API_KEY` or `CLARION_DATA_ROOT` aren't in the registered service's `env_vars` as separate keys, the binary will fail to authenticate or write to the wrong data root.

Inspect logs via shell if needed:

```bash
tail -50 /dev/shm/sec-indexer.log
tail -50 /dev/shm/sec-indexer_err.log
```

If anything is wrong, `delete_user_service` the broken one and re-do Step 3 — re-read the *env_vars formatting* guidance carefully. **Do not tell the user setup is complete until `service_doctor(service="sec-indexer")` reports RUNNING with non-zero uptime.**

As a separate (weaker) sanity check that the binary is reachable on PATH:

```bash
sec-indexer --help
```

This proves the executable resolves on PATH, but does NOT prove the service is running. Step 8's `service_doctor` is the actual validation.

## Step 9 — Report and explain

Tell the user:

> Clarion is set up.
>
> - Source: `/home/workspace/clarion-intelligence-system/`
> - Workspace data: the path printed in the `[2/6] Creating data tree under …` line from setup.py (typically `/home/workspace/clarion/` on Zo, `~/clarion/` on a local machine — auto-detected)
> - Background service: `sec-indexer` (running)
> - Skills installed under `/home/workspace/Skills/`: every sibling `clarion-*` skill from setup.py's `[5/6]` block. List the actual names returned.
> - Personas installed in Zo Settings → AI: the 7 Clarion personas you created in Step 4. List them by name (Data-First Plain Talk, Clarion Macro Sentinel, Clarion Value Screener, Clarion Analyst, Clarion Thesis Architect, Clarion Portfolio Manager, Clarion LP Voice).
> - Rules installed in Zo Settings → AI: 8 Clarion rules (Rule 3 — live market data; Rules 5–10 — persona routing; Rule 11 — return to default).
> - SEC EDGAR identification: `<the user's name and email from config.json>` (the actual value, not the placeholder).
>
> Just ask me things like *"what's the market regime?"*, *"evaluate NVDA"*, *"update my watchlist"*, *"write a thesis on TTD"*, *"show me my portfolio"*, or *"update the Q1 letter"*.

If anything in this report differs from the expected state (e.g., fewer than 7 personas, fewer than 8 rules, service not RUNNING, sec_user_agent is still the placeholder), call this out explicitly. Do not paper over partial-install state.

## Idempotency

Re-running this skill is safe. Each step:

- **Repo clone**: skipped if already cloned (just `git pull --ff-only`)
- **Library install**: re-runs `uv pip install -e` (no harm)
- **Data tree**: `mkdir -p` (no harm)
- **Config.json**: preserved if present — including any `sec_user_agent` the user previously set. The setup script does NOT overwrite an existing config.
- **Skill install**: each sibling `clarion-*` skill in `/home/workspace/Skills/` is refreshed (overwritten) with the upstream copy. This is the intended path to pull in upstream skill fixes after a `git pull`.
- **Service registration**: if the user already has a `sec-indexer` service, `register_user_service` should report it exists; treat that as success and continue.
- **Persona install**: Step 4 calls `list_personas()` and asks the user before replacing any existing Clarion persona. User customizations are preserved unless the user opts in to replacement. The order is "ask first, then replace" — never silent overwrite.
- **Rule install**: Same — Step 5 calls `list_rules()` and asks before replacing.
- **Human checkpoint**: Step 6's Input A is skipped if `config.json` already has a non-placeholder `sec_user_agent`. Step 6's Input B is essentially "if the secret already exists, the user replies `done` immediately and the SKILL.md's USER_ACTION_REQUIRED message instructs them this is OK."

### Re-running to pick up source updates

Editable installs (`uv pip install -e`) do NOT reload an already-running service — the `sec-indexer` process keeps the Python modules it imported at startup in memory. After a `git pull` brings in new code, you MUST restart the service for the changes to take effect.

If the user is re-running setup specifically to pull in upstream fixes, the existing Step 7b restart in this flow handles this naturally. After Step 8 verifies RUNNING, the new code is live.

## On error

If any step fails, do not silently proceed. Read the error, summarize the cause, and offer the user the next step to take. Common cases:

- **`gh: command not found`** — Zo should ship `gh`. If missing, the user's workspace is in a non-standard state; ask them to contact Zo support.
- **`uv: command not found`** — same.
- **`uv pip install` fails with venv error** — the script tries `--system` automatically; if it still fails, ask the user to share the full error.
- **`register_user_service` fails with a JSON-escaping or "runner stopped" error** — re-read the *env_vars formatting* guidance in Step 3. The most common cause is `env_vars` being passed as a stringified JSON instead of an object. Re-form the call and retry.
- **`create_persona` / `create_rule` returns an error** — surface the error verbatim. Possible causes include a tool-not-available environment, malformed prompt text (check the extracted code block for stray markdown), or a transient platform error (retry once before giving up).
- **`service_doctor` shows non-RUNNING after Step 7's restart** — follow the Step 8 troubleshooting (inspect entrypoint via `list_user_services()`, inspect logs, delete + re-register if entrypoint is corrupted). Do NOT mark setup complete.
- **The user replies "no" to replacing personas/rules in Step 4/5** — that's their right. Continue with the existing persona's ID in the map for Step 5's rule substitutions. The final report in Step 9 should mention which personas/rules were preserved vs. created.
