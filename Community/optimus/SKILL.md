---
name: optimus
description: >-
  Optimus is a unified LLM/agent-tooling CLI (Rust) that bundles a persistent
  code/notes wiki, an ultra-compressed "caveman" output mode, a structural
  repo fingerprinter ("aura"), and a repo-fusing knowledge graph ("graphify")
  behind one binary. Subcommands - optimus wiki, optimus caveman, optimus
  aura, optimus graphify, optimus init manual, optimus init auto, optimus
  help. Use when the user says "optimus", "optimus wiki", "optimus aura",
  "optimus graphify", "optimus init", or names any of the subskills directly.
compatibility: Created for Zo Computer
metadata:
  author: bitphill
allowed-tools: Bash Read Edit
---

# Optimus

Single Rust binary, several subskills, one persistent `sled`-backed memory store shared across them. Source: https://github.com/bitphill/optimus

## First run: ensure the binary is installed

Run `scripts/ensure-optimus.sh` before invoking any subcommand — it's a no-op if `optimus` is already on `PATH`, otherwise it installs via whichever of cargo/npm/pip is available, falling back to the universal installer from the GitHub release.

## Sub-skills

| Sub-skill | Trigger | What it does |
|---|---|---|
| wiki | `optimus wiki` | Persistent project wiki; `optimus wiki ingest <path>` treats each child folder as its own wiki, appended as `<parent>-<name>` |
| caveman | `optimus caveman` | Ultra-compressed output mode (~65% token cut) |
| aura | `optimus aura <path>` | Structural + semantic fingerprint of a repo |
| graphify | `optimus graphify <path>` | Fuses linked repos into one navigable graph |
| init manual | `optimus init manual` | Interactive BYOK setup — prompts for OpenRouter/Anthropic/OpenAI keys and subskill defaults |
| init auto | `optimus init auto` | Non-interactive setup — applies cascade defaults, reads keys from env vars or a prior `init manual` run |
| help | `optimus help [sub]` | Lists subskills, syntax, and example invocations |

## BYOK

`optimus` needs at least one LLM provider key to drive the `cascade` (OpenRouter recommended — it's the free-tier default). Run `optimus init manual` once to set it up interactively, or export `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` before use. Keys are stored in `~/.optimus/config.toml` (0600), never in this skill or in the binary.

## When to use this skill

User says any of:
- "optimus", "optimus wiki `<path>`", "optimus caveman on/off"
- "optimus aura `<path>`", "optimus graphify `<path>`"
- "set up optimus", "optimus init"

If the user references a subskill by name alone (e.g. "wiki", "caveman") without other context, prefer the standalone `wiki-llm`/`caveman` skill if installed; use `optimus <sub>` when they've explicitly invoked optimus or when only optimus is installed.
