# Zo SEC Intelligence — Engineering Plan

**Version:** 1.3
**Date:** 2026-05-06
**Status:** Draft — under review
**Architecture:** Files-as-Database, Zo-as-Orchestrator

---

## Changelog from v1.2

| # | Change | Rationale |
|---|---|---|
| 1 | **Phase 6: Distribution & Installer** added to implementation phases. | Course distribution is a first-class deliverable, not an afterthought. |
| 2 | New §13: **Installer Implementation Notes** — JSON spec contract, `.bootstrap/` handoff buffer, parent-agent provisioning loop, content-hash idempotency. | Implementation detail for §13 of PRD; keeps Eng Plan self-contained. |
| 3 | §2 Directory Structure adds `install.py`, `bootstrap_dashboard.py`, `uninstall.py`, `doctor.py`. | Makes installer scripts explicit in the layout. |
| 4 | Canonical install spec lives at `Skills/sec-edgar/INSTALLATION.md`. | Avoids duplicating prose between PRD, Eng Plan, and INSTALLATION.md. |

---

## Changelog from v1.1

| # | Change | Rationale |
|---|---|---|
| 1 | **§5 simplified to a single LLM path** — all calls go through `/zo/ask` with the Zo-hosted MiniMax 2.7 model. Direct MiniMax client / `MINIMAX_API_KEY` removed. | Confirmed via Zo docs: `/zo/ask` is the documented programmatic path; no separate chat-completions endpoint is exposed. MiniMax 2.7 is hosted on Zo at $0.30 / $1.20 per 1M tokens (https://www.zo.computer/models/minimax-2-7). |
| 2 | **Batched summarization** — a 10-K's eligible sections are summarized in **one** `/zo/ask` call with structured output (array of `{node_id, summary}`), not N per-section calls. | Reduces per-filing call count from 5–10 to 1, mitigating `/zo/ask` session-startup overhead. |
| 3 | **`POST /api/sec/check` route added**; refresh button on dashboard triggers it. Drops scheduled amber-dot poll. | User-controlled timing; no cron logic to maintain. |
| 4 | **Storage stats** added to Manifest Manager; `fetch.py` pre-flight check; `/api/sec/summary` includes storage data; weekly digest includes storage line. | Implements PRD §6.6 three-layer warning. |
| 5 | **§10 config schema** simplified — drop MiniMax-key fields, drop dashboard.amber_dot_check, add storage_warn_gb. | Reflects single-LLM-path + manual-refresh decisions. |
| 6 | **§11 cost** rebased on Zo MiniMax pricing + batched summarization. Indexing cost drops to ~$0.01–$0.03 per filing. | Tighter, data-driven estimates. |
| 7 | **§6 Phase 0** trimmed — SEC UA + one smoke test against `/zo/ask` to verify MiniMax model id + dashboard token. No MiniMax key setup. | Faster ramp to Phase 1. |
| 8 | **§12 open questions: 0 remaining.** All four were resolved (storage cap, refresh cadence, MiniMax endpoint, precision target). | Phase 0 unblocked. |

---

## Changelog from v1.0

| # | Change | Rationale |
|---|---|---|
| 1 | Dropped Option A vs Option B storage evaluation. **Committed to distributed manifests** (per-ticker truth + global aggregate rebuilt on read). | The eval was over-investment for a known-better answer. Distributed scales further, isolates concurrency, and is easier to debug. |
| 2 | Auth env var corrected: scripts read **`ZO_CLIENT_IDENTITY_TOKEN`** (auto-injected in Zo sessions), not `ZO_API_KEY`. | `ZO_API_KEY` is for external callers; this skill always runs inside a Zo session. |
| 3 | Indexing summarization path moved to a **direct OpenAI-compatible call to MiniMax** (via Zo's bring-your-own-key/router); `/zo/ask` is now reserved for the **reasoning fallback** in search. | `/zo/ask` spawns a full Zo session per call — heavyweight and over-priced for a per-section summary. A direct LLM call is 10–50× cheaper for the same output. Reasoning fallback still benefits from Zo's tool/judgment loop. |
| 4 | Phase 1 prereqs added: SEC User-Agent configured, MiniMax model id verified by smoke test. | Both blocked Phase 1 if not done. |
| 5 | EDGAR fetcher now handles **paginated submissions archive** (`CIK{cik}-submissions-001.json` …) for filings older than the ~1000-most-recent window. | Without this, multi-year history workflows fail silently for active filers. |
| 6 | Manifest schema now models **amendments** (`is_amendment`, `amends`, `is_latest_for_period`). Append-only policy. | Decided rather than left open. |
| 7 | New §4.8: **Zo Space dashboard** implementation — three API routes, two page routes, theme spec. | Promoted to P1 per user direction. |
| 8 | Monitoring automation (§4.7) now reads **monitor rules** from `sec/config.json` and only alerts on rule matches, not every fetch. | Original spec missed the actual user need ("alert me on 8-Ks mentioning X"), only fetched. |
| 9 | New §11: **Cost & performance budget** — concrete per-filing, per-month, and per-search cost estimates. | Indexing cost was not modeled in v1.0. |
| 10 | Timeline annotation: 4-week solo timeline is **aggressive**. Recommend 5–6 weeks with explicit slack in Phase 4. | Honest scoping. |
| 11 | Search reasoning fallback uses **structured `output_format`** instead of "comma-separated string". | Brittle parsing was a v1.0 risk. |
| 12 | Open questions reduced to 2 (the rest got decided). | Clean signal. |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Structure](#2-directory-structure)
3. [Storage Design (committed)](#3-storage-design-committed)
4. [Component Specifications](#4-component-specifications)
   - 4.1 SEC Fetcher
   - 4.2 HTML→Markdown Converter
   - 4.3 PageIndex Tree Builder
   - 4.4 Manifest Manager
   - 4.5 Search Engine
   - 4.6 Zo Skill (Orchestration Layer)
   - 4.7 Automations
   - 4.8 Zo Space Dashboard
5. [Zo API & LLM Integration](#5-zo-api--llm-integration)
6. [Implementation Phases](#6-implementation-phases)
7. [Testing Strategy](#7-testing-strategy)
8. [Rate Limit Handling Deep Dive](#8-rate-limit-handling-deep-dive)
9. [Error Taxonomy and Recovery](#9-error-taxonomy-and-recovery)
10. [Configuration Schema](#10-configuration-schema)
11. [Cost & Performance Budget](#11-cost--performance-budget)
12. [Open Implementation Questions](#12-open-implementation-questions)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  USER CONVERSATION (chat / dashboard / automation)          │
│  "What are Tesla's risk factors?"                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ZO (the orchestrator)                                      │
│  - Reads sec/manifests/global.json                          │
│  - Calls Skills/sec-edgar/scripts/*.py                      │
│  - /zo/ask (Zo-hosted MiniMax 2.7) for both:                │
│      • batched summarization (1 call per filing)            │
│      • reasoning fallback (when keyword search is weak)     │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ SEC EDGAR       │ │ Workspace FS    │ │ /zo/ask + Zo Space  │
│ (data source)   │ │ (data store)    │ │ MiniMax 2.7         │
│                 │ │ + Zo Space      │ │ $0.30 / $1.20 / 1M  │
│                 │ │ private routes  │ │ tokens              │
└─────────────────┘ └─────────────────┘ └─────────────────────┘
```

**Key principles:**
- **No standalone server** — Zo is the only runtime
- **No MCP transport** — scripts called via `run_bash_command`
- **No vector DB** — JSON trees in filesystem
- **Single LLM path: `/zo/ask` with batched summarization** — no separate provider key, no direct chat-completions endpoint to maintain
- **Zo automations for scheduling** — `create_automation` for periodic fetches
- **Zo Space dashboard reads the same FS** — no duplicate state

---

## 2. Directory Structure

```
/home/workspace/
  sec/                          # Global SEC store
    index/
      [TICKER]/
        [TICKER].manifest.json                                # per-ticker source of truth
        [TICKER]_[FORM]_[DATE]_[ACCESSION].html
        [TICKER]_[FORM]_[DATE]_[ACCESSION].json               # PageIndex tree
        [TICKER]_[FORM]_[DATE]_[ACCESSION].manifest.json      # per-filing sidecar
    manifests/
      global.json               # aggregated view, rebuilt on read
    cache/
      company_tickers.json      # cached SEC ticker→CIK (5-min TTL)
      edgar_check.json          # last-known latest filing per ticker (for amber-dot)
    logs/
      fetch_YYYY-MM-DD.log
      index_YYYY-MM-DD.log
    config.json                 # user prefs, tracked tickers, monitor rules
  Skills/
    sec-edgar/
      SKILL.md                  # Primary skill definition
      PRD.md                    # this PRD
      ENGINEERING_PLAN.md       # this doc
      mockup-main.jpg           # dashboard main-view mockup
      mockup-drilldown.jpg      # dashboard drill-down mockup
      scripts/
        install.py              # bootstrap orchestrator (non-interactive; emits JSON spec)
        bootstrap_dashboard.py  # writes route specs to .bootstrap/ for parent agent to provision
        uninstall.py            # reverse path; emits delete spec
        doctor.py               # post-install health check (fs, config, routes, automation, reachability)
        fetch.py                # EDGAR downloader (rate-limited, paginated, resume-able)
        index.py                # orchestrates HTML→MD→tree→summaries→save
        html2md.py              # HTML→Markdown (adapted from page_index_md)
        tree_builder.py         # Markdown→tree (with three-tier summary routing)
        check_indexed.py        # Reports indexed vs. available filings
        search.py               # keyword + reasoning search
        manifest.py             # manifest CRUD utilities
        config.py               # config read/write
        rate_tracker.py         # Proactive rate-limit tracker
        llm.py                  # /zo/ask wrapper (batched summarize + reasoning)
        utils.py                # shared helpers (checksums, atomic writes)
      .bootstrap/                # gitignored; handoff buffer for installer→parent-agent
      references/
        filing_types.md
        section_map.md
        edgar_api.md
      tests/
        test_fetch.py
        test_index.py
        test_search.py
        test_manifest.py
        test_rate_tracker.py
        test_html2md.py
        fixtures/               # mock EDGAR responses, sample filings
      prompts/
        summary_prompt.md       # batched per-filing summary prompt (/zo/ask)
        search_reasoning_prompt.md  # tree-reasoning prompt (/zo/ask)
```

Zo Space routes (created via `write_space_route`, **not stored as workspace files**):
```
/sec                       page, private    — main dashboard
/sec/:ticker               page, private    — drill-down
/api/sec/summary           api, bearer-auth — main view data (incl. storage gauge)
/api/sec/ticker/:ticker    api, bearer-auth — drill-down data
/api/sec/search            api, bearer-auth — search proxy
/api/sec/check             api, bearer-auth — manual EDGAR refresh (Refresh button)
```

---

## 3. Storage Design (committed)

**Decision:** distributed per-ticker manifests + lazily-rebuilt global aggregate.

```
sec/
  index/
    TSLA/
      TSLA.manifest.json    # source of truth for TSLA
      TSLA_10-K_*.html
      TSLA_10-K_*.json
      TSLA_10-K_*.manifest.json
  manifests/
    global.json             # aggregated view, rebuilt on read or incrementally on write
```

- Per-ticker writes use **`fcntl.flock`** on `[TICKER].manifest.json` for safety against rare concurrent updates (e.g. user runs an indexing job in chat while the weekly automation is also running).
- Global aggregate is rebuilt by walking `sec/index/*/[TICKER].manifest.json` files. With ~50 tickers and ~5KB per ticker manifest this is sub-100ms.
- Per-filing sidecar manifests are atomic writes (`tmp + rename`). They exist primarily for forensics and recovery — if `[TICKER].manifest.json` ever gets corrupted, it can be reconstructed from sidecars by walking the directory.

The Option A (single global manifest) and Option B (distributed) evaluation from v1.0 is dropped — distributed wins on every dimension we cared about (concurrency, scale, debuggability, blast radius of corruption).

---

## 4. Component Specifications

### 4.1 SEC Fetcher

**File:** `Skills/sec-edgar/scripts/fetch.py`

**Interface:**
```bash
python3 fetch.py --ticker TSLA --forms 10-K,10-Q --max 5
python3 fetch.py --ticker TSLA --forms 10-K --check-available
python3 fetch.py --ticker TSLA --forms 10-K --max 20 --skip-indexed
python3 fetch.py --ticker TSLA --forms 10-K,10-Q,8-K --max 100 --include-historical
```

**Rate-limit implementation:**
```
SEC allows: 10 req/sec
Our target: 5.5–7 req/sec (0.12s interval + 20–60ms jitter)
Backoff on 503: exponential, base=2s, max=60s
External rate control flag: caller manages sleep when orchestrating multiple tickers
```

**Download pipeline:**
0. **Storage pre-flight** — run `du -sb /home/workspace/sec/`. Read `storage_warn_gb` from `sec/config.json` (default 10). If `current_gb >= warn_gb`, set a `storage_warning` flag in the output JSON so the chat skill can surface it. Never blocks the fetch.
1. Validate UA in `sec/config.json` — refuse to run if missing or default placeholder.
2. Fetch `company_tickers.json` → map ticker to CIK (cached, 5-min TTL).
3. Fetch `submissions/CIK{cik}.json` → recent ~1000 filings with accession numbers.
4. If `--include-historical`: also fetch `submissions/CIK{cik}-submissions-001.json`, `-002.json`, … until 404. Merge.
5. Filter by `--forms` and `--max`.
6. For each filing:
   a. Check if accession already in `[TICKER].manifest.json` (dedup).
   b. If not indexed: fetch primary HTML from `https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dashes}/{primary_doc}`.
   c. Identify primary doc by reading the filing's `index.json` (always present in modern accessions); fall back to first non-XBRL `*.htm` for legacy.
   d. Save to `sec/index/[TICKER]/[TICKER]_[FORM]_[DATE]_[ACCESSION].html`.
   e. Write per-filing sidecar manifest.
   f. Update per-ticker manifest under flock.
7. On rate limit: save state, return `{"rate_limited": true, "resume_token": "..."}`.

**Resume capability:**
- Store `fetch_state.json` per ticker with last-fetched index.
- On next run with `--resume`, pick up from saved state.

**Output (stdout JSON):**
```json
{
  "success": true,
  "ticker": "TSLA",
  "cik": "0001318605",
  "fetched": ["TSLA_10-K_20250128_000131860525000014.html"],
  "skipped_indexed": ["TSLA_10-K_20240126_000131860524000019.html"],
  "amendments_detected": [],
  "rate_limited": false,
  "errors": [],
  "storage": {
    "current_gb": 8.4,
    "threshold_gb": 10,
    "storage_warning": "Approaching soft cap: 8.4 GB / 10 GB"
  }
}
```

---

### 4.2 HTML→Markdown Converter

**File:** `Skills/sec-edgar/scripts/html2md.py` (adapted from existing `html_to_markdown.py` in the page-index-rag-course server)

**Requirements:**
- Preserve h1-h6 as #–###### Markdown headings
- Detect SEC bold ALL-CAPS headings (`<b>ITEM 1A. RISK FACTORS</b>`) → `## Risk Factors`
- Detect SEC Item/Part/Table patterns in text → promote to `###` headings
- Strip XBRL metadata (`style="display:none"`)
- Remove page-break TOC navigation (`<h5><a href="#toc">Table of Contents</a></h5>`)
- Deduplicate repeated page headers (company name, date, "(CONTINUED)" suffixes)
- Handle XHTML/XML served as HTML by SEC
- Strip `<script>`, `<style>`, and footers
- Convert tables to Markdown table format where `<th>` exists

**Tests:** Should pass against all major SEC form types (10-K, 10-Q, 8-K, DEF 14A, Form 4, S-1, 20-F).

---

### 4.3 PageIndex Tree Builder

**File:** `Skills/sec-edgar/scripts/tree_builder.py`

**Two sub-paths:**

#### Path A: Full Tree (LLM Summaries) — for 10-K, 10-Q, DEF 14A, S-1, 20-F

```
Input: Markdown string
Output: JSON tree (PRD §6.3)

Steps:
1. Parse Markdown → list of (heading_level, heading_text, line_start, line_end)
2. Build node list with text content per section
3. For each node:
   - Count tokens (tiktoken)
   - Classify by size:
     · < 2,000 tokens  → summary = raw text (no LLM)
     · 2,000–5,000     → extractive_summary(text, n=3 sentences)  [no LLM]
     · > 5,000         → llm.summarize(text)  [direct MiniMax call]
4. Build hierarchical tree (parent = closest higher-level heading)
5. Assign 4-digit zero-padded node_ids
6. Compute prefix_summaries by rolling up child summaries
7. Store as JSON alongside HTML
```

**Extractive summary** — TF-IDF top-N sentences preserving original order. Pure local, no LLM.

#### Path B: Raw Storage — for 8-K, Form 3/4, and short filings (< 15,000 tokens)

Single node, no LLM calls:
```json
{
  "node_id": "0000",
  "title": "[TICKER] [FORM] [DATE]",
  "summary": "First 300 chars of filing text...",
  "text": "[full filing text]"
}
```

**LLM summary call** (direct MiniMax via `llm.py` — see §5):
- Endpoint: MiniMax's OpenAI-compatible chat completions (configured via Zo's BYO-key router or directly).
- Why direct vs `/zo/ask`: a 10-K with ~5 large sections × ~$0.005 per `/zo/ask` call adds material cost; a direct MiniMax call is ~10–50× cheaper and 5× faster.

---

### 4.4 Manifest Manager

**File:** `Skills/sec-edgar/scripts/manifest.py`

**Key operations:**
```python
class ManifestManager:
    # Per-ticker (source of truth)
    def read_ticker(self, ticker: str) -> dict
    def write_ticker(self, ticker: str, data: dict) -> None  # under flock

    # Global aggregate
    def read_global(self) -> dict
    def rebuild_global(self) -> dict  # walks per-ticker manifests
    def write_global(self, data: dict) -> None

    # Filing registration
    def register_filing(self, ticker: str, filing_metadata: dict) -> None
    def is_filing_indexed(self, ticker: str, accession: str) -> bool
    def get_filings(self, ticker: str, form: str | None = None,
                    latest_only: bool = True) -> list[dict]

    # Amendments
    def mark_amended(self, ticker: str, original_accession: str,
                     amendment_doc_id: str) -> None
    def get_amendment_chain(self, ticker: str, accession: str) -> list[dict]

    # Storage stats (for dashboard gauge + weekly digest + fetch pre-flight)
    def get_total_size_bytes(self) -> int                                 # du -sb sec/
    def get_size_by_ticker(self) -> dict[str, int]                        # {"TSLA": 1_400_000_000, ...}
    def get_top_tickers_by_size(self, n: int = 5) -> list[tuple[str,int]] # sorted desc

    # Query
    def list_all_tickers(self) -> list[str]
    def search_by_accession(self, accession: str) -> dict | None

    # Concurrency safety
    def with_ticker_lock(self, ticker: str, fn: callable) -> any
```

**Manifest schema** — see PRD §6.2.

---

### 4.5 Search Engine

**File:** `Skills/sec-edgar/scripts/search.py`

**Interface:**
```bash
python3 search.py --query "climate risk" --tickers TSLA,AAPL
python3 search.py --query "supply chain resilience" --reasoning --tickers all
python3 search.py --doc-id TSLA_10-K_20250128_000131860525000014 --overview
python3 search.py --doc-id TSLA_10-K_... --node-id 0002
python3 search.py --query "revenue guidance" --doc-ids TSLA_10-K_...,AAPL_10-K_...
```

**Search algorithm:**
1. Flatten all tree nodes for the requested doc set.
2. Keyword score: title(5pt) + summary(3pt) + text(1pt). Naive bag-of-words for v1; BM25 noted as a v1.5 improvement.
3. If top score ≥ 3 → return keyword results.
4. If top score < 3 AND `--reasoning`:
   - Build tree overview (title + summary for each node).
   - Call `/zo/ask` with reasoning prompt + structured `output_format`.
   - Return LLM-selected node ids.
5. Fetch raw text for selected nodes.
6. Return results with doc_id, node_id, node_path, text_snippet, score.

**Reasoning fallback `/zo/ask` payload:**
```python
output_format = {
    "type": "object",
    "properties": {
        "selected_node_ids": {"type": "array", "items": {"type": "string"}},
        "reasoning": {"type": "string"}
    },
    "required": ["selected_node_ids"]
}
```

(Replaces v1.0's comma-separated-string parsing.)

**Output:**
```json
{
  "results": [
    {
      "doc_id": "TSLA_10-K_20250128_000131860525000014",
      "ticker": "TSLA",
      "node_id": "0002",
      "node_path": "Item 1. Business/Item 1A. Risk Factors",
      "title": "Item 1A. Risk Factors",
      "text": "...raw filing text...",
      "score": 8,
      "selected_by": "keyword"
    }
  ],
  "total_results": 3,
  "search_mode": "keyword+reasoning",
  "query": "climate risk"
}
```

---

### 4.6 Zo Skill (Orchestration Layer)

**File:** `Skills/sec-edgar/SKILL.md`

**Trigger conditions:**
- Any message mentioning a ticker + SEC-related terms (10-K, 10-Q, filing, risk factor, MD&A, etc.)
- Any message asking about a public company's financials, governance, insider activity
- Explicit invocation: "fetch SEC filings for X"

**Skill workflow (pseudocode):**
```
1. IF user asks to FETCH:
   a. RUN fetch.py --ticker [TICKER] --forms [FORMS] --max [N]
   b. PARSE output → report fetched count
   c. FOR each new HTML file:
      - RUN index.py --file [path]
      - REPORT progress
   d. DONE

2. IF user asks a QUESTION:
   a. LOAD manifest → find relevant doc_ids
   b. IF missing relevant filing:
      - ASK user "Filing not indexed. Fetch it now?"
      - IF yes → go to step 1
   c. RUN search.py --query [question] --doc-ids [relevant]
   d. FOR top results: RUN search.py --doc-id [X] --node-id [Y]
   e. SYNTHESIZE answer with citations

3. IF user asks to CHECK INDEXED:
   a. RUN check_indexed.py --ticker [TICKER]

4. IF user asks to COMPARE:
   a. RESOLVE all doc_ids
   b. FOR each doc: RUN search.py --query [Q] --doc-id [X]
   c. MERGE results, synthesize comparison
```

---

### 4.7 Automations

**Created via `create_automation`** with weekly cron (Monday 8:00 AM ET).

**Instruction to Zo:**
```
Run a weekly SEC filing check.

1. Read /home/workspace/sec/config.json → tracked_tickers, monitor_rules.

2. Storage check:
   a. python3 -c "from Skills.sec-edgar.scripts.manifest import ManifestManager; print(ManifestManager().get_total_size_bytes())"
   b. Compute current_gb and top_tickers; remember for digest line.

3. For each ticker:
   a. python3 Skills/sec-edgar/scripts/fetch.py --ticker [T] --skip-indexed --max 5
   b. For each newly fetched filing:
      - python3 Skills/sec-edgar/scripts/index.py --file [path]
      - For each rule in monitor_rules:
        · If rule.applies_to_form(form) AND rule.matches(filing_text):
          - Append (ticker, doc_id, rule_name, snippet) to alerts list

4. Write sec/cache/edgar_check.json with the latest known accession per ticker.
   This doubles as a "Refresh" — the dashboard's amber dots will be in sync after this runs.

5. Compose digest:
   - "X new filings indexed across Y tickers"
   - Storage line: "Storage: 8.2 GB / 10 GB (top: AAPL 1.4 GB, BRK.A 1.1 GB)"
   - Per-rule alert lines for each match
   - Any rate-limit failures noted at end

6. send_sms_to_user (or email per config) with the digest.
```

**Monitor rule schema** (in `sec/config.json`):
```json
{
  "monitor_rules": [
    {
      "name": "8-K acquisitions",
      "applies_to_forms": ["8-K"],
      "match": {"type": "keyword", "any_of": ["acquisition", "merger", "letter of intent"]},
      "alert_channel": "sms"
    },
    {
      "name": "10-Q revenue decline",
      "applies_to_forms": ["10-Q"],
      "match": {"type": "keyword", "any_of": ["revenue decreased", "revenue declined"]},
      "alert_channel": "email"
    }
  ]
}
```

(Numerical-condition rules like "revenue YoY < -10%" require XBRL extraction and are deferred to v2.)

---

### 4.8 Zo Space Dashboard

#### 4.8.1 Routes Summary

| Path | Type | Visibility |
|---|---|---|
| `/sec` | page | private |
| `/sec/:ticker` | page | private |
| `/api/sec/summary` | api | bearer-auth |
| `/api/sec/ticker/:ticker` | api | bearer-auth |
| `/api/sec/search` | api | bearer-auth |
| `/api/sec/check` | api | bearer-auth |

A shared `SEC_DASHBOARD_TOKEN` secret in `Settings > Advanced` gates the API routes.

#### 4.8.2 API Routes

**`GET /api/sec/summary`** — feeds the main view tile grid + summary stats + storage gauge:
```typescript
// Reads /home/workspace/sec/manifests/global.json (rebuilds lazily if stale)
// Computes storage from manifest.py's get_total_size_bytes / get_top_tickers_by_size
return c.json({
  ticker_count: 8,
  filing_count: 287,
  generated_at: "2026-05-06T...",
  last_refreshed_at: "2026-05-06T08:02:14Z",  // from sec/cache/edgar_check.json mtime
  storage: {
    bytes: 8_446_932_211,
    gb: 8.4,
    threshold_gb: 10,
    state: "amber",                            // "green" < 80%, "amber" 80–100%, "red" > 100%
    top_tickers: [
      {ticker: "AAPL", gb: 1.4},
      {ticker: "BRK.A", gb: 1.1},
      {ticker: "TSLA", gb: 0.9}
    ]
  },
  tiles: [
    {
      ticker: "TSLA",
      name: "Tesla, Inc.",
      filing_count: 32,
      latest_filing_date: "2025-01-28",
      status: "green"   // "green" | "amber" | "gray"
    },
    // ...
  ]
});
```

**`GET /api/sec/ticker/:ticker`** — feeds the drill-down:
```typescript
// Reads /home/workspace/sec/index/[TICKER]/[TICKER].manifest.json
return c.json({
  ticker: "TSLA",
  cik: "0001318605",
  name: "Tesla, Inc.",
  total_size_bytes: 943_212_445,
  filings: [
    {
      doc_id: "TSLA_10-K_20250128_000131860525000014",
      form: "10-K",
      filing_date: "2025-01-28",
      accession: "000131860525000014",
      node_count: 52,
      indexed_at: "2026-04-12T...",
      is_amendment: false,
      is_latest_for_period: true,
      size_bytes: 18_445_021
    },
    // ...
  ]
});
```

**`GET /api/sec/search?q=...&tickers=...`** — proxies to `search.py`:
```typescript
// spawns: python3 Skills/sec-edgar/scripts/search.py --query "..." --tickers ...
// returns search.py JSON output verbatim (with bearer-auth check first)
```

**`POST /api/sec/check`** — manual EDGAR refresh, triggered by the Refresh button:
```typescript
// 1. Read sec/config.json → tracked_tickers
// 2. For each ticker: fetch /submissions/CIK{cik}.json, extract latest accession + filing_date
// 3. Compare against per-ticker manifest's most recent indexed accession
// 4. Write sec/cache/edgar_check.json:
//      { "TSLA": { "latest_accession": "...", "latest_filing_date": "...", "is_indexed": true/false }, ... }
// 5. Return same shape as /api/sec/summary so the UI can refresh state directly
//
// Streaming: use SSE so the UI can show "Checking 3/8…" progress.
// Rate-limit aware: respects rate_tracker.py.
return c.json({
  checked_at: "2026-05-06T...",
  tickers_checked: 8,
  new_filings_detected: 2,
  status_changes: [
    {ticker: "NVDA", old_status: "green", new_status: "amber", reason: "8-K filed 2026-05-04 not indexed"}
  ]
});
```

#### 4.8.3 Page Components

**`/sec`** — main view (matches `mockup-main.jpg`):
- Top bar:
  - Left: "SEC INTELLIGENCE" wordmark + private lock icon
  - Right: **Refresh button** (calls `POST /api/sec/check`; shows spinner + "Checking 3/8…" while running)
- Summary row:
  - Big number: `tickers_tracked`
  - Big number: `filings_indexed`
  - **Storage gauge:** colored bar showing `<size> GB / 10 GB`, colored green/amber/red per `storage.state`
- Global search input (full-width)
- Tile grid: 4–5 per row, ticker symbol + filing count + status dot
- Below tile grid: "Last refreshed: 2026-05-06 08:02 ET" subtle text
- Tile click → React Router push `/sec/:ticker`
- Search submit → `/api/sec/search?q=...` → results list (links into chat with prefilled query)

**`/sec/:ticker`** — drill-down (matches `mockup-drilldown.jpg`):
- Reads `/api/sec/ticker/:ticker` on mount
- Renders breadcrumb, ticker header (with `total_size_bytes`), filing table (with `size_bytes` per row)

#### 4.8.4 Theme

Local theme object at the top of each route file (per Zo Space styling guidance — does not depend on shell globals):
```tsx
const theme = {
  background: "#0a0a0b",
  foreground: "#e5e5e5",
  card: "#111114",
  border: "#222226",
  muted: "#777",
  accent: "#10b981",
  amber: "#f59e0b",
  monoFont: "ui-monospace, 'SF Mono', Menlo, monospace",
};
```

#### 4.8.5 What the Dashboard Does NOT Do

- No fetch / no indexing — viewer only
- No XBRL — v2
- No filing reader — links back into chat with prefilled query

---

## 5. Zo API & LLM Integration

**Single LLM path:** all LLM operations go through Zo's `/zo/ask` API with the Zo-hosted MiniMax 2.7 model. There is no separate "direct MiniMax client" in v1.2 — the Zo docs do not expose a programmatic chat-completions endpoint; `/zo/ask` is the documented path.

### 5.1 Auth

```python
import os
ZO_TOKEN = os.environ["ZO_CLIENT_IDENTITY_TOKEN"]   # auto-injected in Zo sessions; no setup
```

### 5.2 Model identifier

- `model_name` in `/zo/ask` follows the format `zo:provider/model-id` (per the public API docs example, `"zo:openai/gpt-5.4"`).
- The expected MiniMax id is `"zo:minimax/minimax-2-7"`.
- **Phase 0 verification:** call `GET https://api.zo.computer/zo/models/available` once with the user's Zo API key, find the MiniMax 2.7 entry, copy its exact `model_name` into `sec/config.json`. After that, scripts read it from config.

### 5.3 Two call shapes

#### A. Batched summarization (hot path, called during indexing)

For each filing, a **single** `/zo/ask` call summarizes all sections that exceed the abstractive-summary token threshold (>5,000 tokens). Sections below threshold get raw or extractive summaries with no LLM call (see §4.3).

```python
def summarize_filing_sections(sections: list[dict]) -> list[dict]:
    """sections = [{node_id, title, text}], all >5K tokens.
    Returns [{node_id, summary}] in the same order."""
    body_blocks = "\n\n".join(
        f"### NODE {s['node_id']}: {s['title']}\n{s['text'][:8000]}"
        for s in sections
    )
    prompt = f"""You are a financial document analyst. Summarize each of the following SEC filing sections in 1–3 sentences focused on key facts, figures, and disclosures.

{body_blocks}

Return one summary per node_id, in the same order, as JSON."""

    resp = requests.post(
        "https://api.zo.computer/zo/ask",
        headers={"authorization": ZO_TOKEN, "content-type": "application/json"},
        json={
            "input": prompt,
            "model_name": config["llm"]["model"],   # e.g. "zo:minimax/minimax-2-7"
            "output_format": {
                "type": "object",
                "properties": {
                    "summaries": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "node_id": {"type": "string"},
                                "summary": {"type": "string"}
                            },
                            "required": ["node_id", "summary"]
                        }
                    }
                },
                "required": ["summaries"]
            }
        },
        timeout=120
    )
    resp.raise_for_status()
    return resp.json()["output"]["summaries"]
```

This collapses a 10-K's typical 5–10 per-section summary calls into **1** call, reducing both wall-clock time and the per-call session-startup overhead of `/zo/ask`.

#### B. Reasoning fallback (cold path, called only when keyword search is weak)

```python
def reason_over_tree(query: str, tree_overview: str, max_results: int = 5):
    prompt = f"""You are a financial document analyst. Given a user's question and a document
tree structure, identify the most relevant section node_ids.

USER QUESTION: {query}

DOCUMENT TREE:
{tree_overview}

Return up to {max_results} node_ids most relevant to the question."""
    resp = requests.post(
        "https://api.zo.computer/zo/ask",
        headers={"authorization": ZO_TOKEN, "content-type": "application/json"},
        json={
            "input": prompt,
            "model_name": config["llm"]["model"],
            "output_format": {
                "type": "object",
                "properties": {
                    "selected_node_ids": {"type": "array", "items": {"type": "string"}},
                    "reasoning": {"type": "string"}
                },
                "required": ["selected_node_ids"]
            }
        },
        timeout=60
    )
    resp.raise_for_status()
    return resp.json()["output"]["selected_node_ids"]
```

### 5.4 Configuration

- `ZO_CLIENT_IDENTITY_TOKEN` — auto-injected, no setup
- `SEC_DASHBOARD_TOKEN` — user adds to `Settings > Advanced` for dashboard API auth
- `sec/config.json` `llm.model` — verified MiniMax id from Phase 0

No `MINIMAX_API_KEY`. No `MINIMAX_BASE_URL`. No `llm.py` direct client.

---

## 6. Implementation Phases

**Annotated timeline:** 5–6 weeks for one engineer working at normal pace. Phase 4 hardening should not be compressed.

### Phase 0: Prereqs (½ day)

- [ ] User sets SEC User-Agent in `sec/config.json`
- [ ] User adds `SEC_DASHBOARD_TOKEN` to Zo secrets
- [ ] Smoke test: `curl -X POST https://api.zo.computer/zo/ask -H "Authorization: Bearer $ZO_API_KEY" -d '{"input":"hello","model_name":"zo:minimax/minimax-2-7"}'` — confirm 200 and reasonable output. If model_name rejected, call `GET /zo/models/available` and find the right id.
- [ ] Bake verified model id into `sec/config.json` as `llm.model`.

**Exit:** A `/zo/ask` call with the MiniMax model returns sensible output for a trivial input.

### Phase 1: Foundation (Week 1)

- [ ] Create directory structure
- [ ] Build `config.py` — read/write `sec/config.json`
- [ ] Build `manifest.py` — per-ticker + global aggregate, with flock + amendments + **storage stats methods**
- [ ] Adapt `html2md.py` from existing codebase
- [ ] Build `fetch.py` — EDGAR downloader with rate-limit handling + paginated submissions + **storage pre-flight**
- [ ] Build `tree_builder.py` — Markdown → JSON tree (no summaries yet, raw-only mode)
- [ ] Build `check_indexed.py`
- [ ] Unit tests for fetch, html2md, tree_builder, manifest

**Exit:** `fetch.py --ticker TSLA --forms 10-K --max 1` downloads HTML and produces a valid raw-mode JSON tree.

### Phase 2: Search and Retrieval (Week 2)

- [ ] Build `llm.py` — `/zo/ask` wrapper with batched-summarization + reasoning helpers (no direct MiniMax client)
- [ ] Add three-tier summary routing in `tree_builder.py` (raw / extractive / batched-LLM)
- [ ] Add extractive TF-IDF summarizer (no LLM)
- [ ] Add batched abstractive summary call for large nodes
- [ ] Build `index.py` — orchestrates HTML→MD→tree→summaries→save
- [ ] Build `search.py` — keyword + LLM reasoning fallback (with structured output)
- [ ] Build `SKILL.md` — orchestration skill
- [ ] Integration test: TSLA 10-K → search "risk factors" → cited raw text

**Exit:** Natural-language Q&A against TSLA 10-K returns cited answers from raw filing text.

### Phase 3: Multi-Ticker, Automation, Dashboard (Week 3–4)

- [ ] Build `batch_search.py` — same question across multiple tickers
- [ ] Build cross-ticker manifest reconciliation
- [ ] Create `sec/config.json` with tracked tickers + monitor rules + storage_warn_gb
- [ ] Create weekly automation via `create_automation` (with rule-based alerting + storage line)
- [ ] **Build Zo Space dashboard** (6 routes: 2 page, 4 api):
  - [ ] `/api/sec/summary` (with storage gauge data)
  - [ ] `/api/sec/ticker/:ticker` (with size_bytes per filing)
  - [ ] `/api/sec/search`
  - [ ] `/api/sec/check` (manual refresh, SSE-progress)
  - [ ] `/sec` page — header (with Refresh button), stats (with storage gauge), search, tile grid
  - [ ] `/sec/:ticker` page — breadcrumb, header, filing table
- [ ] Visual QA against `mockup-main.jpg` and `mockup-drilldown.jpg`
- [ ] Test: weekly automation fires, finds new 8-K, indexes it, matches a rule, sends SMS with storage line
- [ ] Test: Refresh button updates amber dots correctly
- [ ] Test: dashboard renders for 8 tickers / ~150 filings in <500ms

**Exit:** End-to-end works. Weekly automation alerts. Dashboard usable for daily coverage check.

### Phase 4: Hardening (Week 5)

- [ ] Performance profiling: time spent in fetch / parse / summarize / search
- [ ] Optimize hot paths (most likely: HTML parsing for very large 10-Ks)
- [ ] XBRL extraction scaffolding (future-proofing the manifest, no actual extraction yet)
- [ ] `README.md` and usage docs at `Skills/sec-edgar/README.md`
- [ ] Test full corpus: 10 tickers × 3 years = ~150 filings, all searchable
- [ ] Cost reconciliation: compare actual spend to §11 budget

**Exit:** System handles 150 filings across 10 tickers with < 2s search latency.

### Phase 5 (optional, not committed): v1.5

- BM25 search ranking
- Filing diff view (10-K year-over-year textual deltas)
- Embeddings (only if reasoning fallback proves insufficient on real workloads)
- XBRL extraction (numeric financials)

### Phase 6: Distribution & Installer (Week 5)

**Goal:** A student in Zo chat can install, smoke-test, and uninstall the skill in three commands.

- [ ] Build `install.py` per §13 — non-interactive, emits JSON spec to stdout
- [ ] Build `bootstrap_dashboard.py` — generates the six route code files into `.bootstrap/`
- [ ] Build `uninstall.py` — symmetric reverse path, default non-destructive of `sec/` data
- [ ] Build `doctor.py` — health check covering filesystem, config validity, manifest integrity, dashboard route presence, automation registration, MiniMax reachability, EDGAR reachability, storage
- [ ] Write `Skills/sec-edgar/SKILL.md` install-flow guidance — how the parent Zo agent prompts the student, runs `install.py`, processes the JSON spec, and reports the summary
- [ ] Set up the public repo at `github.com/clarion-systems/zo-sec-intelligence` with `README.md`, `INSTALL.md`, `LICENSE`, `CHANGELOG.md`, sparse-checkout-friendly layout
- [ ] Tag `v1.0.0`
- [ ] **Prototype validation:** small end-to-end install on a fresh Zo Computer to validate the subprocess→parent-agent handoff before declaring the pattern locked
- [ ] **Test:** install + smoke fetch + uninstall round-trip; re-install on top of partial state (idempotency); install pinned to a tag (`@v1.0.0`)

**Exit criteria:** A student account that has never seen this skill before completes a full install in < 4 minutes from the install command. `doctor.py` reports green. Uninstall + reinstall preserves indexed data unless `--remove-data` is passed.

---

## 7. Testing Strategy

### Unit Tests

| Module | What to Test |
|---|---|
| `fetch.py` | Rate-limit backoff, dedup by accession, HTML save path, CIK lookup, paginated submissions, UA enforcement |
| `html2md.py` | Heading preservation, SEC pattern detection, table conversion, deduplication |
| `tree_builder.py` | Node boundaries, token counting, three-tier routing, tree hierarchy |
| `manifest.py` | Read/write under flock, dedup, reconciliation, amendments chain |
| `search.py` | Keyword scoring, fallback trigger, structured output parsing, citation format |
| `rate_tracker.py` | Request counting, proactive throttling, cooldown detection |
| `llm.py` | `/zo/ask` payload shape, batched-summarization round-trip, structured-output parsing, retry on 5xx |

### Integration Tests

1. **Fetch + index pipeline** — TSLA 10-K → tree has correct Item 1, 1A, 7, 8 nodes
2. **Search round-trip** — TSLA 10-K → "risk factor" → raw text from Item 1A matches source
3. **Rate-limit recovery** — mock 503 → verify backoff → verify resume works
4. **Multi-ticker search** — AAPL + MSFT 10-Ks → search "AI" → both appear
5. **Manifest reconciliation** — add filing to per-ticker → global.json reconciles
6. **Amendments** — index 10-K then 10-K/A → both retained, amendment marked, latest-only filter excludes original
7. **Dashboard API** — call `/api/sec/summary` with valid+invalid bearer → 200 / 401

### Mock EDGAR Fixtures

`tests/fixtures/`:
- `company_tickers.json` (100 tickers)
- `submissions/CIK000131860525.json` (TSLA, 20 filings)
- `submissions/CIK000131860525-submissions-001.json` (older TSLA filings)
- `sample_10k.html` (~3 MB realistic 10-K)
- `sample_8k.html`
- `sample_10ka.html` (an amendment)

---

## 8. Rate Limit Handling Deep Dive

### SEC EDGAR Limits

- **10 requests/second** per IP (enforced)
- **403/503** when exceeded; SEC also expects a real UA — requests without UA are aggressively throttled
- No explicit `X-RateLimit-*` headers

### Strategy

```
Normal:  sleep_interval = 0.12 + uniform(0.02, 0.06)   # ~5.5–7 req/s

On 503:  for attempt in range(MAX_RETRIES):
           wait = BACKOFF_BASE^(attempt+1) + uniform(0, 1)
           sleep(wait); retry
         Else: raise RateLimitError, save state.

Proactive:
  Track last 60s timestamps. If count >= 400 in window → sleep 2s.
  If rate_limited_until is set → sleep until that time.
```

### Multi-Ticker Fan-Out

Concurrency mostly applies to **automations and parallel scripted runs**, not to a single Zo chat session (which is single-threaded). For automations:
- Each ticker process has its own `rate_tracker.py` state — no shared state between processes (safe, but means each independently respects ~7 req/s).
- If user runs 5 ticker fetches in parallel, the *aggregate* SEC load is ~35 req/s, exceeding SEC's 10 req/s cap. The skill's automation runs tickers **serially** by default; parallel mode is opt-in via `--parallel N` flag with documented risk.

### `rate_tracker.py`

```python
@dataclass
class RateLimitState:
    requests: list[float]
    rate_limited_until: float | None
    last_request_time: float | None

    def record(self) -> None: ...
    def get_wait_time(self) -> float: ...
    def wait_if_needed(self) -> None: ...
    def set_rate_limited(self, minutes: int = 10) -> None: ...
```

---

## 9. Error Taxonomy and Recovery

| Error | Cause | Recovery |
|---|---|---|
| `SECLookupError` | Ticker not found in SEC | Ask user to verify ticker |
| `SECUserAgentMissingError` | UA not configured | Refuse to fetch; prompt user to set in `sec/config.json` |
| `RateLimitError` | 503 after retries | Save fetch state; tell user to wait 10 min |
| `FilingNotFoundError` | EDGAR filing URL returns 404 | Skip; log; continue with next |
| `HTMLParseError` | Malformed HTML from SEC | Fall back to raw text extraction |
| `ManifestWriteError` | Disk full or flock contention | Retry once; abort on persistent failure |
| `LLMSummaryError` | MiniMax / `/zo/ask` fails | Use extractive fallback; log warning |
| `ChecksumMismatch` | Downloaded file corrupted | Re-download; retry once |
| `ModelIdInvalidError` | Configured MiniMax model id rejected | Refuse to index; surface to user; prompt re-verification |

---

## 10. Configuration Schema

**`sec/config.json`:**
```json
{
  "version": 1,
  "sec_user_agent": "Jing Xie jing@clarionintelligence.com",
  "tracked_tickers": ["TSLA", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "JPM"],
  "fetch_forms": ["10-K", "10-Q", "8-K", "DEF 14A"],
  "auto_index": true,
  "manifest_mode": "distributed",
  "storage_warn_gb": 10,
  "llm": {
    "model": "zo:minimax/minimax-2-7"
  },
  "rate_limit": {
    "delay": 0.12,
    "jitter_range": [0.02, 0.06],
    "max_retries": 3
  },
  "thresholds": {
    "summary_token_threshold": 5000,
    "extractive_threshold": 2000,
    "raw_storage_threshold": 15000
  },
  "monitor_rules": [
    {
      "name": "8-K acquisitions",
      "applies_to_forms": ["8-K"],
      "match": {"type": "keyword", "any_of": ["acquisition", "merger"]},
      "alert_channel": "sms"
    }
  ]
}
```

(No `MINIMAX_API_KEY`, no `MINIMAX_BASE_URL`, no `dashboard.amber_dot_check`. Refresh is manual, MiniMax is hosted.)

---

## 11. Cost & Performance Budget

Pricing as of May 2026: MiniMax 2.7 on Zo at **$0.30 / 1M input tokens, $1.20 / 1M output tokens** (per https://www.zo.computer/models/minimax-2-7). `/zo/ask` adds session overhead but the model-token cost dominates at our prompt sizes.

### Per filing (with batched summarization)

| Filing | LLM calls | Approx. tokens (in+out) | Approx. cost |
|---|---|---|---|
| 10-K (5–8 sections >5K tokens, batched into 1 call) | **1** `/zo/ask` | ~50K in + ~2K out | **~$0.02** |
| 10-Q | 1 `/zo/ask` (often skipped if all sections small) | ~20K in + ~1K out | ~$0.01 |
| 8-K (raw mode) | 0 | 0 | **$0.00** |
| Form 4 (raw mode) | 0 | 0 | $0.00 |
| DEF 14A | 1 `/zo/ask` | ~30K in + ~1.5K out | ~$0.01 |

### Per query

| Query type | LLM calls | Approx. cost |
|---|---|---|
| Keyword-only (score ≥ 3) | 0 | **$0.00** |
| Keyword + reasoning fallback | 1× `/zo/ask` (~5K in + ~0.5K out) | ~$0.002 |

### Per month (8 tickers, weekly automation, ~10 new filings/wk, ~50 ad-hoc queries/wk)

| Component | Volume | Approx. cost |
|---|---|---|
| Indexing | ~40 filings/mo, mostly 10-Q + 8-K | **~$0.30–$0.80/mo** |
| Ad-hoc queries | ~200/mo, ~30% reasoning | **~$0.10–$0.40/mo** |
| **Total** | | **~$0.40–$1.20/mo** |

A fresh 5-year backfill of 8 tickers (10-K, 10-Q, 8-K, DEF 14A) is roughly 200–300 filings, costing **~$3–$6 one-time**.

The dominant cost is no longer indexing (it's a few dollars total) — at this scale even the reasoning fallback is sub-dollar per month. Budget is comfortably absorbed even into a free Zo plan's monthly credits.

---

## 12. Open Implementation Questions — All Resolved (Phase 0 Ready)

| Prior question (v1.0 / v1.1) | Resolution (v1.2) |
|---|---|
| Storage Option A (single global manifest) vs B (distributed)? | **B / distributed** — committed in §3. |
| Embeddings in v1? | **No** — vectorless v1; v2 if reasoning fallback proves insufficient on real workloads. |
| XBRL Phase 1? | **No** — Phase 4 scaffolding only; full extraction is v2. |
| Amendments handling? | **Append-only** with `is_amendment`/`amends`/`is_latest_for_period` flags in manifest. |
| SEC User-Agent enforcement? | **P0 prereq** — fetch refuses without valid UA. |
| Filings >10 years old? | **Allowed** — paginated submissions endpoint handles full history; user opts in via `--include-historical`. |
| Storage soft cap? | **10 GB warning, three layers**, no hard cap (PRD §6.6). |
| Dashboard refresh cadence? | **Manual button**, no scheduled poll (PRD §7.4). |
| Direct MiniMax vs `/zo/ask`? | **`/zo/ask` only**, batched summarization to amortize session overhead (§5). |
| Search precision target? | **Measure in Phase 4 from real data**; no pre-committed number (PRD §10). |
| Embedding API choice? | N/A — embeddings deferred to v2. |

**0 open questions remaining. Phase 0 is unblocked.**

---

## 13. Installer Implementation Notes

Canonical install spec: `Skills/sec-edgar/INSTALLATION.md`. This section covers implementation detail not duplicated there.

### 13.1 The JSON-Spec Contract

`install.py` runs as a subprocess and **cannot call Zo tools or prompt the student**. It signals work to the parent Zo agent via stdout JSON. Schema (abbreviated):

```json
{
  "installed_version": "1.0.0",
  "filesystem_ready": true,
  "smoke_fetch_result": {"doc_id": "...", "ok": true},
  "todo": {
    "routes":      [{"path": "...", "type": "page|api", "code_file": "...", "public": false}],
    "automations": [{"title": "...", "rrule": "...", "instruction_file": "..."}],
    "secrets":     [{"name": "...", "value_file": "...", "if_missing_only": true}]
  },
  "warnings": []
}
```

Exit codes: `0` (proceed), `1` (fatal), `2` (proceed with warnings).

### 13.2 The `.bootstrap/` Handoff Buffer

`install.py` writes route code, automation instructions, and generated secrets to `Skills/sec-edgar/.bootstrap/` (gitignored). The parent Zo agent reads each `code_file` / `instruction_file` / `value_file` and passes the content to the corresponding tool call (`write_space_route`, `create_automation`, secret-write).

This indirection avoids embedding multi-kilobyte route code inside the JSON spec (which would be fragile at the chat-protocol layer).

### 13.3 Parent-Agent Provisioning Loop (pseudocode)

```python
spec = json.loads(run("python3 Skills/sec-edgar/scripts/install.py --sec-ua=... --tickers=..."))

if spec["exit_code"] == 1:
    surface_fatal(spec["error"]); return

for route in spec["todo"]["routes"]:
    code = read_file(route["code_file"])
    existing = get_space_route(route["path"])  # may be None
    if existing and content_hash(existing.code) == content_hash(code):
        log(f"skip {route['path']} (unchanged)")
        continue
    if existing:
        confirm_with_user(f"Overwrite existing route {route['path']}?")
    if route["type"] == "page":
        write_space_route(path=route["path"], route_type="page", code=code, public="false")
    else:
        write_space_route(path=route["path"], route_type="api", code=code)

for automation in spec["todo"]["automations"]:
    instruction = read_file(automation["instruction_file"])
    create_automation(rrule=automation["rrule"], instruction=instruction)

for secret in spec["todo"]["secrets"]:
    if secret["if_missing_only"] and secret_exists(secret["name"]):
        continue
    value = read_file(secret["value_file"])
    write_secret(name=secret["name"], value=value)

surface_summary(spec)
```

### 13.4 Content-Hash Idempotency

For routes, idempotency uses a content hash (`sha256` of the route code body) rather than a version field. This means:
- Re-running install with the same skill version → all routes skipped (hashes match).
- Re-running after a skill upgrade → routes whose code changed are upgraded; unchanged routes are skipped.
- Manual edits to a provisioned route → next install detects the divergence and prompts before overwriting.

The hash is computed on whitespace-normalized, comment-stripped code so trivial reformatting doesn't trigger spurious upgrade prompts.

### 13.5 Why Not Have `install.py` Call Zo Tools Directly?

Two reasons:
1. **Subprocess context.** A Python subprocess invoked via `run_bash_command` doesn't have direct access to the parent agent's tool surface. It would need to call Zo's HTTP API with a token, which adds an authentication path and another failure mode.
2. **Auditability.** Keeping all tool calls in the parent agent's transcript means the student sees them happen in chat, in order, with the parent agent narrating. Better for an educational setting.

The cost of the indirection is one extra file-read per provisioning step. Acceptable.

### 13.6 Phase 6 Prototype-First Discipline

Before locking the JSON-spec → parent-agent pattern across all six routes, build a one-route end-to-end prototype: `install.py` emits a spec for `/sec` only; parent agent provisions it; verify via `agent-browser` that the page renders correctly under the private auth gate. Only then expand to the full six-route bootstrap.