---
name: wiki-llm
description: Build and maintain an LLM-authored persistent wiki for any project folder. The wiki is a structured, interlinked set of markdown files that incrementally accumulates knowledge about a codebase, research topic, or document collection — so future sessions don't have to rescan the project from scratch. Use when the user asks to set up a wiki for a project, ingest a new source into an existing wiki, query the wiki, lint it for staleness/contradictions, list/recover deleted source files from wiki trash, or register/unregister a project for the Claude Code Stop-hook auto-update flow. Supports any folder type (web app, CLI tool, data pipeline, research notes, plain documents) — the init flow adapts its questions accordingly.
compatibility: Created for Zo Computer
metadata:
  author: wedding.zo.computer
  category: Knowledge
  display-name: Wiki-LLM
---

# wiki-llm

Persistent LLM-maintained wiki for a project. Pattern based on the LLM Wiki concept (incremental compounding knowledge base — see `references/CONCEPT.md`).

## Architecture

Three layers per project:
1. **Raw sources** — the project files themselves (read-only from the wiki's POV).
2. **The wiki** — markdown files the LLM writes/maintains at the user-chosen wiki location (default `/home/workspace/wiki/<project-slug>/`).
3. **The schema** — `<wiki>/AGENTS.md` tells future agent sessions how the wiki is structured and what conventions to follow.

Per-project registry lives at `~/.wiki-llm/registry.json`. Wiki internals live at `<wiki>/.wiki-llm/` (state, trash, queue, manifest).

## Subcommands

The CLI is `scripts/wiki` (Bun). All commands work on a registered project; pass `--project <path>` or run from inside one.

| Command | Purpose |
|---|---|
| `wiki init [path]` | Interactive setup: detect project type, ask scope/ingest/exclude questions, scaffold wiki dirs + AGENTS.md, register project. |
| `wiki status` | Show registered projects + pending updates + trash count. |
| `wiki ingest <file>` | Mark a source file (relative to project) as needing ingestion. Outputs the source content + existing wiki context for the agent to synthesize. |
| `wiki update` | Run git diff vs last snapshot. List added/modified/deleted files. Archive deletions to trash. Output a structured "what changed" report for the agent to act on. |
| `wiki query "..."` | Search the wiki via qmd (hybrid BM25+vector). Falls back to ripgrep if qmd missing. |
| `wiki lint` | Health check: orphan pages, stale claims (sources newer than dependent pages), missing cross-refs, contradictions to investigate. |
| `wiki list-deleted` | List files archived in wiki trash with timestamps. |
| `wiki recover <relpath>` | Restore a deleted source file from wiki trash to its original location. |
| `wiki register [path]` | Add project to registry. Idempotent. |
| `wiki unregister [path]` | Remove project from registry (does not delete the wiki). |
| `wiki hook` | Stop-hook entrypoint. For each registered project: detect git changes, archive deletions to trash, queue updates. Cheap, non-LLM. |
| `wiki install-hook` | Add the Stop hook to `~/.claude/settings.json`. Idempotent. |
| `wiki uninstall-hook` | Remove the Stop hook. |
| `wiki doctor [--fix]` | Check required (`bun`, `git`) and optional (`qmd`, `ripgrep`, `rustup`, `cargo`) deps. With `--fix`, best-effort install missing ones (qmd via npm/bun → cargo → rustup+cargo; git/ripgrep via apt). |
| `wiki install-qmd` | Best-effort install of qmd search backend (npm/bun → cargo → bootstrap rustup then cargo). |

## Init flow — questions asked

`wiki init` first inspects the folder to guess project type, then asks:

**Always:**
1. Project path (defaults to cwd)
2. Wiki location (default `/home/workspace/wiki/<project-slug>/`)
3. Ingest scope — what to include:
   - For a **code project** (detected via `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.): code architecture, runtime state, ops history, docs
   - For a **research/notes folder** (mostly `.md`/`.pdf`/`.txt`): documents, web sources, notes
   - For a **data folder** (mostly `.csv`/`.parquet`/`.duckdb`): schemas, sample queries, lineage
   - For an **unknown/mixed folder**: free-form scope description
4. Include globs (default inferred from project type, e.g. `**/*.{ts,tsx,js,py,md}` for code)
5. Exclude globs (default: `node_modules/**`, `.git/**`, `dist/**`, `build/**`, `__pycache__/**`, plus user additions)
6. Auto-update trigger: on-demand only, or Stop-hook auto-detect (default: hook)
7. Backfill — should the agent seed the wiki with any pre-existing ops history / git log highlights? (default: yes)

The init flow is non-interactive when run via `wiki init --json <answers.json>`, so the agent can drive it after collecting answers in chat.

## Deleted-file recovery

Whenever the Stop hook detects a tracked source file was deleted (`git status` shows D), it copies the last-known content into `<wiki>/.wiki-llm/trash/<timestamp>/<relpath>` and appends to `<wiki>/.wiki-llm/trash/manifest.jsonl`. `wiki recover <relpath>` restores the most recent archived copy. This is independent of git history.

## Stop-hook semantics

The hook fires after Claude Code finishes a turn. It does only cheap, deterministic work:
- For each registered project: snapshot current `git rev-parse HEAD` + dirty files
- Diff vs last snapshot in `<wiki>/.wiki-llm/state.json`
- Archive any deletions to trash
- Append a pending-update entry to `<wiki>/.wiki-llm/queue.jsonl`
- Print a single-line summary to stderr (visible in next-turn context if user runs commands)

It does NOT call any LLM. Actual wiki regeneration happens when the user (or the agent in a later turn) runs `wiki update`, which reads the queue and produces an instruction block for the agent to ingest changed files.

## qmd integration

If `qmd` is on PATH, `wiki query` uses it. If not, it falls back to ripgrep + a simple ranked-by-headings heuristic. Install qmd via `wiki install-qmd` (best-effort: tries `bun add -g qmd` → `npm i -g qmd` → `cargo install qmd` → bootstraps rustup if cargo is missing and retries). On Zo Computer the install runs once at skill init.

## First-run dependency preflight

The first time `wiki <anything>` runs in a fresh Zo Computer instance (detected by absence of `~/.wiki-llm/registry.json`), the CLI auto-runs `doctor --fix` to install missing deps. The check covers:

- **Required**: `bun` (script runtime), `git` (diff/recovery)
- **Optional**: `qmd` (hybrid search; ripgrep fallback), `ripgrep` (search fallback), `rustup` + `cargo` (only used if qmd can't install via npm/bun)

After the first successful run, dependency checks are skipped on subsequent invocations — re-run `wiki doctor` manually to re-check. The hook entrypoint (`wiki hook`) explicitly skips preflight to keep Stop-hook latency minimal.

## Conventions for the wiki

Every wiki has the same skeleton (see `assets/wiki-template/`):
- `AGENTS.md` — schema and conventions for the agent
- `index.md` — catalog of all pages with one-line summaries, grouped by category
- `log.md` — chronological log of ingests, queries, lint passes, ops events (`## [YYYY-MM-DD HH:MM] <kind> | <subject>`)
- `pages/` — entity, concept, and source-summary pages
- `pages/sources/` — one summary page per ingested raw source
- `pages/entities/` — one page per distinct entity (file, module, person, concept, etc.)
- `pages/topics/` — synthesis/comparison pages
- `.wiki-llm/` — state, trash, queue, manifest (agent should never edit by hand)

## When to use this skill

User says any of:
- "Set up a wiki for this project / for `<path>`"
- "Ingest `<file>` into the wiki"
- "Query the wiki for ..."
- "Lint the wiki"
- "What deleted files do I have in the wiki trash?"
- "Recover the deleted file `<relpath>`"
- "Register this project for auto-wiki updates"

If the user references "wiki" without context and a project is registered, default to operating on that project. If multiple are registered, ask which.
