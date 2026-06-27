# LLM Wiki — concept

Source: the user's llm-wiki idea doc (paraphrased, condensed).

## Core idea

LLM incrementally builds and maintains a persistent wiki rather than re-deriving knowledge from raw sources on every query. The wiki is the compounding artifact: cross-references already there, contradictions already flagged, synthesis already reflects everything ingested.

## Layers

1. **Raw sources** — immutable, owned by the user.
2. **Wiki** — markdown, owned and maintained by the LLM.
3. **Schema** — `AGENTS.md` in the wiki root, tells the LLM how the wiki is organized and what workflows to follow.

## Operations

- **Ingest** — read a new source, write a summary page, update affected entity/concept pages, append to log.
- **Query** — search wiki first (via `index.md` or qmd), then read relevant pages, synthesize. Good answers can be filed back as new pages.
- **Lint** — find orphans, stale claims, contradictions, missing cross-references, gaps worth filling.

## Index vs log

- `index.md` is **content-oriented** — a catalog of pages, organized by category. Read first when querying.
- `log.md` is **chronological** — append-only `## [YYYY-MM-DD HH:MM] kind | subject` entries. Grep-friendly. Read to understand the wiki's evolution.

## Maintenance burden

Humans abandon wikis because the bookkeeping (cross-refs, summary updates, consistency) grows faster than the value. LLMs don't get bored. The wiki stays maintained because maintenance is near-zero cost.

## What's left to the human

Source curation, asking good questions, deciding emphasis. Not the bookkeeping.
