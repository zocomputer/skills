---
name: context7
description: >-
  Fetch up-to-date, version-specific library documentation and code examples
  from Context7. Use this skill whenever the user asks about a specific
  programming library, framework, or API, or when writing code that depends
  on a library. Replaces stale training-data knowledge with live docs.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
---

# Context7 -- Live Library Documentation

Pull current docs and code examples for any programming library directly into context. No more hallucinated APIs or outdated patterns.

## When to Use

- The user asks how to use a library, framework, or SDK (e.g. "how do I do X with Hono?")
- The user asks about a specific API, method, or configuration for a library
- You are writing or reviewing code that depends on an external library and need accurate API details
- The user says "use context7" explicitly
- The user asks about setup, installation, or configuration of a library

## How to Use

The script is at `Skills/context7/scripts/context7.ts`. Run with `bun`.

### Commands

**Search for a library:**
```bash
bun Skills/context7/scripts/context7.ts search "<library-name>"
```
Returns matching libraries with their Context7 IDs, descriptions, snippet counts, and quality scores. Pick the best match by name relevance, reputation, and benchmark score.

**Fetch docs for a specific query:**
```bash
bun Skills/context7/scripts/context7.ts docs <library-id> "<query>"
```
Returns documentation and code examples relevant to the query. Use the library ID from a search result.

**One-shot lookup (search + fetch docs):**
```bash
bun Skills/context7/scripts/context7.ts lookup "<library-name>" "<query>" --tokens 10000
```
Resolves the library and fetches relevant docs in one step. This is the most common workflow.

### Options

- `--tokens <n>` -- Max tokens of documentation to return (default: 10000). Use lower values (3000-5000) for focused questions, higher (10000-15000) for broad exploration.
- `--api-key <key>` -- Override the CONTEXT7_API_KEY environment variable.

### Workflow

1. User asks about a library -> run `lookup` with the library name and their question
2. Read the returned docs and code examples
3. Use them to give an accurate, up-to-date answer or write correct code
4. If `lookup` picks the wrong library, use `search` first to find the right ID, then `docs`

### Tips

- For well-known libraries, `lookup` usually picks the right one automatically
- If multiple versions exist, mention the version in your query: `lookup "next.js" "app router next.js 14"`
- Prefer library IDs from official sources (higher reputation/benchmark scores)
- Cache results mentally within a conversation; don't re-fetch the same docs repeatedly
