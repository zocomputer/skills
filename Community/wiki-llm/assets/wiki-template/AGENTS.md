# Wiki schema — agent instructions

This wiki is maintained by an LLM agent using the `wiki-llm` skill. **You** (the agent) are the maintainer. The human curates sources and asks questions; you do all the bookkeeping.

## Project
- **Name:** {{PROJECT_NAME}}
- **Path:** {{PROJECT_PATH}}
- **Type:** {{PROJECT_TYPE}}
- **Scope:** {{INGEST_SCOPE}}
- **Wiki root:** {{WIKI_ROOT}}

## Layout

```
{{WIKI_ROOT}}/
├── AGENTS.md           # this file — schema + conventions
├── index.md            # catalog of all pages (read this first when answering queries)
├── log.md              # chronological event log (append-only)
├── pages/
│   ├── sources/        # one summary page per ingested raw source (filename mirrors source path with / → __)
│   ├── entities/       # one page per distinct entity (file, module, function, person, concept)
│   └── topics/         # synthesis pages, comparisons, analyses
└── .wiki-llm/          # state, trash, queue, manifest — never edit by hand
    ├── state.json
    ├── queue.jsonl
    ├── trash/
    │   ├── manifest.jsonl
    │   └── <timestamp>/<original-relpath>
    └── config.json
```

## Conventions

**Page frontmatter** — every page in `pages/` starts with YAML:
```yaml
---
title: <human-readable title>
kind: source | entity | topic
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: [<paths into pages/sources/ that informed this page>]
tags: [<freeform>]
---
```

**Cross-references** — use `[[wiki-links]]` for internal references, regular markdown links for external. When you create or update a page, walk inbound references in any page that mentions the same entity and add a link.

**Log entries** — every meaningful action gets a log line:
```
## [YYYY-MM-DD HH:MM] <kind> | <subject>
- <one-line summary>
- pages touched: pages/sources/foo.md, pages/entities/bar.md
```
Kinds: `ingest`, `query`, `lint`, `ops`, `delete`, `recover`.

**Index entries** — when you create a page, add a line under the right category:
```
- [<title>](pages/<kind>/<slug>.md) — <one-line summary>
```

## Workflows

### Ingest (`wiki ingest <file>` or auto-triggered)
1. Read the source.
2. Decide: does it warrant a new `sources/` summary page? (Usually yes.)
3. Write the summary page with frontmatter, key facts, open questions.
4. Identify entities mentioned. For each: create a new `entities/` page if absent, or update the existing one. Add the source to its `sources:` frontmatter.
5. Update relevant `topics/` pages if the new source changes a synthesis or contradicts a prior claim. Note contradictions explicitly with `> ⚠️ Contradicts:` blockquotes.
6. Update `index.md` with any new pages.
7. Append to `log.md`.

### Query (`wiki query "..."`)
1. Read `index.md` first.
2. Use `wiki query` (qmd) to find candidate pages.
3. Read those pages.
4. Synthesize an answer with citations as `[page-title](relative/path.md)`.
5. If the answer is substantive and reusable, file it as a new `topics/` page. Update index + log.

### Lint (`wiki lint`)
Check for:
- Orphan pages (no inbound links from index or other pages)
- Stale pages (last `updated` older than a source they cite)
- Contradictions (pages making opposing claims about the same entity)
- Missing entity pages (entities mentioned ≥3 times across `sources/` with no dedicated page)
- Broken `[[wiki-links]]`

Output a short report and append `[YYYY-MM-DD HH:MM] lint | <N> issues` to the log.

### Stop-hook auto-update
The hook detects file changes in the project and writes pending entries to `.wiki-llm/queue.jsonl`. When the agent runs `wiki update`, it reads the queue, decides what needs re-ingesting, and processes it. Deleted files are archived to `.wiki-llm/trash/` automatically by the hook — no LLM involvement needed for that step.

## Style

- Concise. Wiki pages are reference material, not essays.
- Lead with the fact, then evidence.
- Mark uncertainty explicitly: `> 🟡 Unverified:` blockquote.
- Mark contradictions explicitly: `> ⚠️ Contradicts:` blockquote.
- Cite the source page for any non-obvious claim.
