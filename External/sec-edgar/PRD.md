# Zo SEC Intelligence — Product Requirements Document

**Version:** 1.3
**Date:** 2026-05-06
**Status:** Draft — under review
**Author:** Jing Xie, Clarion Intelligence Systems LLC

---

## Changelog from v1.2

| # | Change | Rationale |
|---|---|---|
| 1 | New §13: **Installation & Distribution** — one-line install from a public GitHub repo via Zo chat; full spec lives in `INSTALLATION.md`. | Course use case requires a frictionless install; this commits to the design (parent Zo agent orchestrates; `install.py` is a non-interactive worker that emits a provisioning spec). |
| 2 | §11 Prerequisites updated: SEC UA and dashboard token are gathered by the **installer flow**, not configured manually. Manual configuration remains documented for advanced users. | Reflects the install model in §13. |
| 3 | New `Skills/sec-edgar/INSTALLATION.md` referenced as the canonical install spec. | Keeps PRD readable; install detail belongs in its own doc. |

---

## Changelog from v1.1

| # | Change | Rationale |
|---|---|---|
| 1 | §6.6 added: **Storage quota** with 10 GB soft warning, no hard cap; warning surfaces in three layers (dashboard gauge, fetch.py pre-flight, weekly automation digest). | Resolves v1.1 open question 1 with a concrete mechanism, not just a number. |
| 2 | §7 dashboard adds **manual Refresh button** in header; drops the scheduled amber-dot poll cadence question. Status updates only when user clicks Refresh or the weekly automation runs. | Resolves v1.1 open question 2; simpler UX, user controls timing. |
| 3 | §11 Prerequisites: **MiniMax 2.7 is a Zo-hosted model** ($0.30 / $1.20 per 1M tokens). No BYO MiniMax key required. Only verification step is one call to `GET /zo/models/available` to confirm exact model identifier. | Resolves v1.1 open question 3 — confirmed via Zo's docs and the public MiniMax model page. |
| 4 | §10 success metrics: precision target re-stated as "**measure in Phase 4, calibrate from data**" rather than a pre-committed number. | Resolves v1.1 open question 4 — pre-committing without data is guessing. |
| 5 | §12 Open Questions section retired — all four are now resolved above. | Clean signal: nothing blocks Phase 0 anymore. |
| 6 | §8 adds "Storage gauge + manual refresh" as a P1 dashboard feature line. | Tracks the §6.6 / §7 work. |

---

## Changelog from v1.0

| # | Change | Rationale |
|---|---|---|
| 1 | Doc-id format now includes accession: `[TICKER]_[FORM]_[DATE]_[ACCESSION]` | Disambiguate amendments and same-day filings; aligns PRD with Eng Plan. |
| 2 | Manifest path normalized to `sec/manifests/global.json` and `sec/index/[TICKER]/[TICKER].manifest.json` | Removes PRD↔Plan drift. |
| 3 | New §7: Zo Space dashboard promoted from "P2 future" to **P1, scoped read-only + search**, private route | User wants a real UI; full design + data contract included. |
| 4 | New §11: Prerequisites — SEC User-Agent and MiniMax model-id verification are P0 setup, not open questions | These will block Phase 1 if not resolved up front. |
| 5 | New §6.5: Amendments policy — append-only, all versions retained, latest-flagged in manifest | Decided rather than left open. |
| 6 | Success metrics recalibrated: FinanceBench-style precision target reduced from ">95%" to **">88%"** | PageIndex's published baseline on FinanceBench is ~92% with GPT-4-class reasoning; we're using MiniMax 2.7. >88% is honest and still useful. |
| 7 | Monitoring (§4.4) now explicitly includes per-filing keyword/condition filtering before alerting | Original spec only said "fetch and notify" — missed the actual user need. |
| 8 | Embeddings (§6.4) deferred to v2 explicitly, removed from v1 surface area | "Optional, off by default" was waffling; commit to vectorless v1. |
| 9 | Open questions reduced from 4 to 2 (the rest got decided above) | Clean signal for what still needs your input. |
| 10 | Workflow F (UI-driven coverage check) added to §5 | The dashboard creates a new workflow; document it. |

The 24 review items raised in the second-pair-of-eyes review (conversation `con_BGf739flKBWIVrXW`) are folded into v1.1 across the PRD and the Engineering Plan. Items not visible above are addressed in the Eng Plan (env vars, model verification flow, /zo/ask vs direct LLM API, dropping the A-vs-B storage eval, paginated EDGAR submissions, etc.).

---

## 1. Problem Statement

Investment research, financial analysis, and quantitative trading workflows depend on authoritative, timely access to SEC filings. Today, analysts either:
- Pay for expensive commercial data feeds (Bloomberg, FactSet, CapIQ)
- Manually browse SEC EDGAR with no indexing or search
- Use brittle vector-based RAG systems that lose document structure

Clarion Intelligence Systems' Zo SEC Intelligence provides a third path: a **Zo-native, structure-first document intelligence layer** that treats the workspace filesystem as the database, uses reasoning-based retrieval (PageIndex methodology), and taps MiniMax via Zo's own API for LLM operations — eliminating standalone servers, MCP transports, and separate vector infrastructure.

---

## 2. Product Vision

> *"Ask any question about any public company's SEC filings — across tickers, across years — and get precise, cited answers from raw filing text, in seconds."*

Zo SEC Intelligence is a **document intelligence platform** built on three principles:
1. **Structure-first retrieval** — SEC filings are deeply hierarchical (Items, Parts, Tables). Any retrieval system that chunks without preserving this hierarchy will miss or misrepresent section context.
2. **Files as database** — Everything lives in the workspace. No separate document store, no vector DB, no proprietary format.
3. **Zo as the orchestrator** — Zo reads files, runs searches, synthesizes answers. The only infrastructure needed is the workspace, the Zo API, and a small private dashboard.

---

## 3. Target Users

| User | What They Get |
|---|---|
| **Individual investors** | Natural-language Q&A against 10-K/10-Q filings of companies they follow |
| **Quantitative researchers** | Fast keyword screens across full filing histories for any ticker |
| **Investment analysts** | Multi-ticker comparison analysis (e.g., "How do AAPL, MSFT, GOOGL discuss AI in their latest 10-Ks?") |
| **Family offices** | Automated monitoring of owned positions' SEC filings with structured alerts |
| **Advisory clients** (via Clarion) | Custom Zo skills + automations built on top of the core SEC indexing layer |

---

## 4. Core Capabilities

### 4.1 Filing Fetching

- Fetch any SEC filing type for any publicly traded company from EDGAR
- Support for: **10-K** (annual), **10-Q** (quarterly), **8-K** (current events), **DEF 14A** (proxy), **Form 3/4** (insider ownership), **S-1** (IPO), **20-F** (foreign issuers), and more
- **Automatic de-duplication** by accession number — re-fetching the same filing is a no-op
- **Progressive rate-limit awareness** — uses SEC's 10 req/sec limit with jitter and exponential backoff; graceful degradation when limited
- **Resume capability** — if interrupted, picks up where it left off
- **Historical depth** — supports the SEC EDGAR submissions paginated archive (`CIK{cik}-submissions-001.json`, `-002.json`, ...) so we can fetch filings older than the ~1000-most-recent window the primary submissions endpoint returns

### 4.2 Document Indexing

- Converts HTML filings to **hierarchy-faithful Markdown** preserving: h1-h6 headings, SEC Item/Part/Table patterns, bold ALL-CAPS section labels
- Builds a **hierarchical tree index** (node per section) with:
  - `node_id` — stable identifier
  - `title` — section name (e.g., "Item 1A. Risk Factors")
  - `prefix_summary` — LLM summary of section + all child sections (navigation aid)
  - `summary` — LLM summary of leaf-node text
  - `text` — full raw section text
- **Three-tier summary strategy** (cost-optimized):
  - `< 2,000 tokens` → raw text as summary (no LLM call)
  - `2,000–5,000 tokens` → extractive TF-IDF (fast, no LLM call)
  - `> 5,000 tokens` → MiniMax abstractive summary
- **Short filings** (Form 4, 8-K, etc.) → raw single-node storage, no LLM calls
- Index stored as **one JSON file per filing** in workspace, alongside the original HTML

### 4.3 Search & Retrieval

- **Keyword search** across all indexed filings (title match: 5pts, summary: 3pts, text: 1pt)
- **LLM reasoning fallback** — when keyword scores are weak (< 3), Zo navigates the tree structure semantically to find relevant sections (uses `/zo/ask`)
- **Cross-ticker search** — same query against multiple companies simultaneously
- **Year-over-year comparison** — find how a company discusses the same topic across filing periods
- **Always returns raw text** — summaries are navigation aids only; answers always cite actual filing language
- Source citation format: `(ticker: doc_id, section: node_id)`

### 4.4 Periodic Monitoring

- **Scheduled automations** to re-fetch new filings for tracked tickers (e.g., weekly)
- **Per-filing keyword/condition filtering** — monitor rules in `sec/config.json` describe what to alert on (e.g., `"on 8-K mentioning 'acquisition'"`, `"on 10-Q where revenue YoY < -10%"`); only matching filings trigger notifications, not every fetch
- **Notification** via SMS or email when new filings match a rule
- **Cross-ticker keyword monitors** — e.g., "alert me whenever any of my tracked tickers files an 8-K mentioning 'climate'"

### 4.5 Zo Space Dashboard (P1)

- Private route at `https://cis.zo.space/sec` — owner-auth only
- Read-only mirror of the SEC store: shows tracked tickers as small tiles, summary counts (tickers, total filings indexed), and a global search box
- Click a ticker → drill-down listing all indexed filings (form, filing date, accession, node count, indexed timestamp)
- Search uses the same `search.py` pipeline as Zo chat
- All mutations (adding/removing tickers, changing config) are still done via Zo chat or by editing `sec/config.json` — the UI is intentionally a viewer, not a CRUD admin panel

See §7 for the full design.

### 4.6 (Future, v2) XBRL Financial Data Pipeline

Structured extraction of numeric financial data from SEC XBRL filings for use in quantitative analysis. **Out of scope for v1.** The filing storage format and manifest schema must not preclude this — XBRL extracts will live alongside the HTML/JSON tree per filing.

---

## 5. User Workflows

### Workflow A: Research a Company

```
User: "What are Tesla's biggest risk factors in their latest 10-K?"
Zo:
  1. Check if TSLA filings are indexed
  2. If not → fetch TSLA 10-K from EDGAR, index it
  3. Search filing for "risk factor" sections
  4. Return raw text from Item 1A with citation
```

### Workflow B: Cross-Company Comparison

```
User: "Compare how Apple, Microsoft, and Google discuss AI in their 2025 10-Ks"
Zo:
  1. Ensure AAPL, MSFT, GOOGL latest 10-Ks are indexed
  2. Run batch query across all three filings
  3. Synthesize comparative answer with per-company citations
```

### Workflow C: Multi-Year Track

```
User: "Show me how Amazon's AWS segment revenue discussion has evolved from 2022 to 2025"
Zo:
  1. Ensure AMZN 10-K filings from 2022, 2023, 2024, 2025 are indexed
  2. For each filing, locate segment revenue section
  3. Return side-by-side raw text excerpts showing evolution
```

### Workflow D: Keyword Screen

```
User: "Find all companies in my portfolio that mentioned 'climate risk' in their 2025 10-Ks"
Zo:
  1. Search across all indexed 10-Ks for "climate risk"
  2. Return company + section matches with relevance scores
```

### Workflow E: Monitoring

```
Automated trigger (weekly):
  Zo fetches new 8-Ks for tracked tickers
  Applies user's monitor rules from sec/config.json
  If new 8-K matches "acquisition" rule → SMS alert
  If new 10-Q matches "revenue decline > 20%" rule → SMS alert
  Filings that don't match any rule are still indexed but no alert fires
```

### Workflow F: Coverage Check via Dashboard

```
User opens https://cis.zo.space/sec before running a multi-ticker analysis
  1. Sees 8 TICKERS / 287 FILINGS at top
  2. Notices NVDA tile has amber dot → new filing not yet indexed
  3. Clicks NVDA → sees latest filing is from 2 weeks ago, last actually indexed is 3 weeks ago
  4. Goes back to Zo chat: "fetch new NVDA filings"
  5. Refreshes dashboard → all green
```

---

## 6. Data Architecture

### 6.1 Global SEC Store

All indexed filings live in a single workspace location, organized by ticker then by filing:

```
/home/workspace/
  sec/
    index/
      TSLA/
        TSLA.manifest.json                                          # per-ticker manifest (source of truth for TSLA)
        TSLA_10-K_20250128_000131860525000014.html                   # raw filing
        TSLA_10-K_20250128_000131860525000014.json                   # indexed tree
        TSLA_10-K_20250128_000131860525000014.manifest.json          # per-filing manifest
      AAPL/
        AAPL.manifest.json
        AAPL_10-K_20241025_000032019324000123.html
        AAPL_10-K_20241025_000032019324000123.json
        ...
    manifests/
      global.json                                                    # aggregated view, rebuilt on read
    cache/
      company_tickers.json                                           # cached ticker→CIK (5-min TTL)
    logs/
      fetch_YYYY-MM-DD.log
      index_YYYY-MM-DD.log
    config.json                                                      # user prefs, tracked tickers, monitor rules
```

**Why global:** Supports cross-ticker keyword screens and multi-ticker analysis without project boundaries. Users who want project isolation can create separate workspace directories with their own `sec/` subtrees.

**Why include accession in filename:** Disambiguates amendments (10-K/A vs 10-K), multiple same-day filings, and restated filings. The accession number is globally unique within EDGAR.

### 6.2 Manifest Schema

**Per-ticker `sec/index/[TICKER]/[TICKER].manifest.json`** — source of truth for that ticker:
```json
{
  "version": 1,
  "ticker": "TSLA",
  "cik": "0001318605",
  "name": "Tesla, Inc.",
  "updated_at": "2026-05-06T...",
  "filings": {
    "10-K": [
      {
        "doc_id": "TSLA_10-K_20250128_000131860525000014",
        "filing_date": "2025-01-28",
        "accession": "000131860525000014",
        "is_amendment": false,
        "amends": null,
        "is_latest_for_period": true,
        "indexed_at": "2026-05-06T...",
        "node_count": 52,
        "index_mode": "tree",
        "html_path": "TSLA_10-K_20250128_000131860525000014.html",
        "tree_path": "TSLA_10-K_20250128_000131860525000014.json",
        "checksum": "sha256:..."
      }
    ],
    "10-Q": [...],
    "8-K": [...]
  }
}
```

**Global `sec/manifests/global.json`** — aggregated view, periodically reconciled from per-ticker manifests:
```json
{
  "version": 1,
  "updated_at": "2026-05-06T...",
  "ticker_count": 8,
  "filing_count": 287,
  "tickers": {
    "TSLA": {"cik": "0001318605", "name": "Tesla, Inc.", "filing_count": 32, "manifest_path": "index/TSLA/TSLA.manifest.json"},
    "AAPL": {"cik": "0000320193", "name": "Apple Inc.",  "filing_count": 37, "manifest_path": "index/AAPL/AAPL.manifest.json"}
  }
}
```

**Per-filing `*.manifest.json`** — small sidecar, written atomically alongside the HTML+JSON pair:
```json
{
  "doc_id": "TSLA_10-K_20250128_000131860525000014",
  "ticker": "TSLA",
  "form": "10-K",
  "cik": "0001318605",
  "filing_date": "2025-01-28",
  "accession": "000131860525000014",
  "is_amendment": false,
  "amends": null,
  "indexed_at": "2026-05-06T...",
  "index_mode": "tree",
  "node_count": 52,
  "tree_mode": "full",
  "source": "sec_edgar",
  "checksum": "sha256:..."
}
```

### 6.3 Index Storage (JSON Tree)

Each `*.json` file contains the full hierarchical tree for one filing:

```json
{
  "doc_id": "TSLA_10-K_20250128_000131860525000014",
  "tree": {
    "doc_name": "TSLA 10-K 2025",
    "doc_description": "Annual report for Tesla, Inc. covering fiscal year ended December 31, 2024",
    "index_mode": "tree",
    "structure": [
      {
        "node_id": "0001",
        "title": "Item 1. Business",
        "prefix_summary": "Overview of Tesla's business segments...",
        "nodes": [
          {
            "node_id": "0002",
            "title": "Item 1A. Risk Factors",
            "summary": "Tesla faces risks related to: supply chain concentration, EV market adoption uncertainty, regulatory compliance across jurisdictions, and competitive dynamics...",
            "text": "Our business is subject to risks including but not limited to: supply chain disruption which could...",
            "nodes": []
          }
        ]
      }
    ]
  }
}
```

### 6.4 Embeddings — Deferred to v2

Embeddings are **out of scope for v1**. PageIndex's vectorless approach (keyword + tree reasoning) is proven sufficient on FinanceBench-class evals. Adding embeddings later is straightforward — they would live in a separate `sec/embeddings/` directory keyed by `doc_id` — but we will not pre-build the scaffolding for them in v1.

### 6.5 Amendments and Restated Filings

SEC filings can be amended (e.g., `10-K/A` amends a prior `10-K`). Policy:
- **Append-only** — amendments do not overwrite the original; both are stored and indexed independently.
- Per-filing manifest carries `is_amendment: bool`, `amends: <doc_id of amended filing> | null`, and `is_latest_for_period: bool`.
- The dashboard and search default to **latest-for-period** results, with an option to surface superseded versions.
- The manifest schema already supports this (see §6.2).

### 6.6 Storage Quota and Warnings

Workspace storage is finite. We keep all filings forever (no auto-purge), but surface storage usage in three places so it's never a surprise.

**Threshold:** soft warning at **10 GB** of `sec/` total size. No hard cap (fetching never refuses on storage grounds alone).

**Mechanism — three layers:**

| Layer | Where | When |
|---|---|---|
| **Dashboard storage gauge** | `/sec` main view, top-right of summary stats | Every page load. Shows `<size> GB / 10 GB` with green / amber / red bar. Amber at 80% (8 GB), red at 100% (10 GB). |
| **`fetch.py` pre-flight** | stdout JSON output every fetch | Runs `du -sb sec/` before fetching. If above warn threshold, includes `{"storage_warning": "...", "current_gb": 10.3, "threshold_gb": 10}` in output so the chat skill can surface it. |
| **Weekly automation digest** | Weekly SMS/email | Includes one line: `"Storage: 8.2 GB / 10 GB (top tickers: AAPL 1.4 GB, BRK.A 1.1 GB)"`. |

**Configuration** — `sec/config.json` field `storage_warn_gb` (default 10). User can raise or lower. Setting to 0 disables warnings.

**Usage breakdown** — `manifest.py` exposes per-ticker byte totals so the dashboard and digest can show which tickers consume the most space (typically a small number of large 10-Ks dominate).

---

## 7. Zo Space Dashboard — Design

### 7.1 Goals and Non-Goals

| Goals | Non-Goals (v1) |
|---|---|
| Single glanceable view of "what do I have indexed?" | No inline filing reader — that's chat's job |
| Detect coverage gaps before running an analysis | No charts, no XBRL financials |
| Run the same search the chat skill runs, in a UI | No editing tracked tickers from UI |
| Owner-private (no public exposure of tracked positions) | No multi-user / sharing |

### 7.2 Routes

| Route | Type | Visibility | Purpose |
|---|---|---|---|
| `/sec` | page | private | Main dashboard (mockup-main.jpg) |
| `/sec/:ticker` | page | private | Per-ticker drill-down (mockup-drilldown.jpg) |
| `/api/sec/summary` | api | bearer-auth | Returns ticker count, filing count, tile data |
| `/api/sec/ticker/:ticker` | api | bearer-auth | Returns filing list for one ticker |
| `/api/sec/search` | api | bearer-auth | Keyword + reasoning search; same pipeline as `search.py` |

API routes use bearer-auth via a `SEC_DASHBOARD_TOKEN` secret to protect against unauthenticated access; the page routes use Zo's owner-auth.

### 7.3 Data Flow

```
Page route (React)
  → fetch('/api/sec/summary')
    → API handler reads /home/workspace/sec/manifests/global.json
    → Returns { ticker_count, filing_count, tiles: [{ticker, name, filing_count, status}] }
  → Render tile grid

User clicks a tile
  → React Router navigates to /sec/:ticker
  → fetch('/api/sec/ticker/TSLA')
    → API handler reads /home/workspace/sec/index/TSLA/TSLA.manifest.json
    → Returns flattened filing list, sorted by filing_date desc
  → Render filing table

User types in global search box
  → fetch('/api/sec/search?q=...')
    → API handler invokes search.py (same code path as the skill)
    → Returns ranked results with doc_id, node_id, snippet, score
  → Render results list (links into chat with prefilled query, since the dashboard is read-only)
```

### 7.4 Layout Specs

**Main view** (`/sec`) — see `mockup-main.jpg`:
- Header bar: "SEC INTELLIGENCE" title (left), private lock icon, **Refresh button** (right, with spinner while running)
- Summary stats: large numbers for `tickers_tracked` and `filings_indexed`, plus a **storage gauge** (`<size> GB / 10 GB` with colored bar — green < 80%, amber 80–100%, red > 100%)
- Global search input (full-width, centered)
- Tile grid: 4–5 tiles per row, each tile = ticker symbol + filing count + status dot
  - Status dot: green = up-to-date as of last refresh; amber = new filing detected on EDGAR but not yet indexed; gray = never indexed
  - Status updates **only on Refresh button click** or after the weekly automation runs — no scheduled poll. Timing is fully user-controlled.
  - "Last refreshed" timestamp shown subtly below the tile grid

**Refresh button behavior:**
- Click → `POST /api/sec/check` → server iterates tracked tickers, fetches each `/submissions/CIK{cik}.json`, compares latest accession against per-ticker manifest, updates `sec/cache/edgar_check.json`
- Button shows spinner + "Checking 3/8…" progress; takes ~5–15s for ~10 tickers
- On completion: tile dots refresh, "Last refreshed" timestamp updates

**Drill-down view** (`/sec/:ticker`) — see `mockup-drilldown.jpg`:
- Breadcrumb back to all tickers
- Ticker header: symbol + full name + CIK + filing count + ticker storage size
- Filing table: columns FORM | FILING DATE | ACCESSION | NODES | INDEXED AT | SIZE
- Each row links to the raw HTML or JSON file (signed download from the workspace, or just a "view in chat" link)

### 7.5 Theme

- Dark mode by default, terminal/Bloomberg aesthetic
- Background `#0a0a0b`, text `#e5e5e5`, borders `#222`, accent emerald `#10b981`
- Monospace for numeric data, sans-serif for prose
- Local theme object in the route file (per Zo Space styling guidance) — does not depend on shell globals

### 7.6 What the Dashboard Does NOT Do

- Does not fetch new filings — that's chat or the weekly automation
- Does not edit `sec/config.json` — that's chat or direct file edit
- Does not show XBRL financials — v2
- Does not display filing text inline — clicking a filing links back to chat with a prefilled query

---

## 8. Core Features — v1 Scope

| Feature | Priority | Notes |
|---|---|---|
| EDGAR fetching (HTML) | P0 | 10-K, 10-Q, 8-K, DEF 14A, Form 3/4; paginated submissions |
| HTML → Markdown conversion | P0 | Preserve SEC structure (Items, Parts, Tables) |
| PageIndex tree building | P0 | With three-tier summary strategy |
| Keyword search | P0 | Weighted scoring, across all tickers |
| LLM reasoning fallback | P0 | When keyword scores are weak |
| Manifest system (distributed) | P0 | Per-ticker manifests + global aggregate; amendments handled |
| Raw text retrieval | P0 | Always, with citations |
| **Zo Space dashboard (read-only + search)** | **P1** | Private route, tile grid + drill-down + search |
| **Storage gauge + manual refresh button** | **P1** | Dashboard surfaces storage; refresh updates new-filing status on demand |
| Periodic monitoring with rule-based alerts | P1 | Weekly fetch + per-rule notifications + storage line |
| Cross-ticker batch query | P1 | Same question across companies |
| Embeddings (semantic search) | v2 | Deferred |
| XBRL extraction | v2 | Deferred |

---

## 9. Non-Goals (v1)

- **No standalone MCP server** — Zo is the orchestrator
- **No separate vector database** — tree-only retrieval; embeddings are a v2 feature
- **No commercial data feed integration** — EDGAR is the source
- **No trading execution** — analysis only
- **No portfolio management** — filing indexing and search only
- **No multi-user dashboard** — owner-private only

---

## 10. Success Metrics

| Metric | Target | Notes |
|---|---|---|
| Fetch success rate | > 99% | Includes graceful rate-limit handling |
| Index accuracy | 100% of nodes map to correct SEC sections | Validated against fixture filings |
| Search precision (FinanceBench-style) | > 88% | Baseline: PageIndex paper reports ~92% with GPT-4-class reasoning. We're using MiniMax 2.7; >88% is honest and useful. |
| Time to answer (single filing, single question) | < 30 seconds end-to-end | |
| Time to answer (cross-ticker, 5 companies) | < 90 seconds end-to-end | Assumes filings already indexed |
| Rate-limit events requiring human wait | < 1 per 100 fetches | |
| Dashboard load time (main view, 10 tickers) | < 500ms | Just reads global.json |
| Dashboard search latency | < 2s for ~300 filings | Same pipeline as chat search |

---

## 11. Prerequisites (P0 — must be done before Phase 1)

These are not open questions; they are setup steps with specific resolutions.

| Prereq | Resolution |
|---|---|
| **SEC User-Agent** | SEC requires a real name/email in the UA header (e.g. `"Jing Xie jing@clarionintelligence.com"`). The skill will refuse to fetch until `sec/config.json` has a valid UA configured. First-run prompt walks the user through setting it. |
| **MiniMax model id verified** | MiniMax 2.7 is a **Zo-hosted model** — no BYO MiniMax API key needed. Pricing on Zo: $0.30 / 1M input tokens, $1.20 / 1M output tokens (as of May 2026, per https://www.zo.computer/models/minimax-2-7). Phase 0 step: call `GET https://api.zo.computer/zo/models/available` once to read the exact `model_name` identifier (likely `zo:minimax/minimax-2-7` or similar — the public docs use `zo:openai/gpt-5.4` as the format example). Bake the verified id into `sec/config.json`. |
| **Zo identity token in scripts** | Scripts invoked from a Zo session can read `process.env.ZO_CLIENT_IDENTITY_TOKEN` directly — no user-managed `ZO_API_KEY` needed for the in-session path. The skill scripts use this for `/zo/ask` calls. The weekly automation runs as a Zo session, so the same path works there. |
| **Dashboard auth token** | User generates `SEC_DASHBOARD_TOKEN` in `Settings > Advanced` (Secrets area). Used by API routes for bearer-auth. |

---

## 12. Open Questions — All Resolved

v1.0 had 4 open questions; v1.1 had 4; v1.2 has **0**.

| Question (v1.1) | Resolution (v1.2) |
|---|---|
| Storage quota / soft cap? | §6.6 — soft warning at 10 GB, three-layer mechanism (dashboard gauge, fetch.py pre-flight, weekly digest), no hard cap. |
| Amber-dot poll cadence? | §7.4 — manual Refresh button, no scheduled poll. User controls timing. Weekly automation also triggers a refresh as a side-effect. |
| Managed MiniMax endpoint vs BYO key? | §11 — MiniMax 2.7 is a Zo-hosted model accessed via `/zo/ask`. No BYO key. $0.30 / $1.20 per 1M tokens. |
| Search precision target on real workloads? | §10 — measure in Phase 4 from real data; no pre-committed number. Tracked as a memory note for future reconciliation. |

Phase 0 can now begin without further input.

---

## 13. Installation & Distribution

The full spec lives in `INSTALLATION.md`. Summary here for context.

### 13.1 Goal

A student in Zo chat types one line:

> *"install the sec-intelligence skill from `https://github.com/clarion-systems/zo-sec-intelligence`"*

Three minutes later the skill is installed, six private `cis.zo.space/sec*` routes are provisioned, a weekly fetch automation is registered, and one smoke filing is fetched and indexed.

### 13.2 Distribution Paths

| Path | Identifier | Use when |
|---|---|---|
| Zo Skills Registry | `"install the sec-intelligence skill"` | Long-term blessed path; gated by Zo registry PR. |
| **Public GitHub repo** | `"install … from https://github.com/clarion-systems/zo-sec-intelligence"` | **Default for the course.** |
| zo.pub collection | `"install … from https://zo.pub/cis/sec-intelligence"` | Zo-native alternative; useful if GitHub is blocked. |

### 13.3 Three-Actor Model

The install is a coordinated flow between three actors:

| Actor | Role |
|---|---|
| Student | Types one command; answers two prompts (UA, tickers). |
| Parent Zo agent | Orchestrator: reads `SKILL.md`, prompts the student, runs `install.py`, executes `write_space_route` / `create_automation` / secret writes. |
| `install.py` subprocess | Non-interactive worker: filesystem setup, smoke tests, emits a JSON provisioning spec to stdout. Never prompts; never calls Zo tools directly. |

This split is required because a Python subprocess can't prompt a chat user; all interaction stays in the chat layer.

### 13.4 What Students Need

- A Zo Computer account (free tier sufficient; cost <$1/month).
- Their name + email for the SEC User-Agent header.
- 5 minutes.

No MiniMax key, no GitHub credentials, no environment config.

### 13.5 Idempotency, Uninstall, Doctor

- All install steps are idempotent and safe to re-run.
- `uninstall.py` reverses everything; non-destructive of indexed data by default.
- `doctor.py` is a post-install health check (filesystem, config, routes, automation, MiniMax reachability, EDGAR reachability, storage).

### 13.6 Course Considerations

- Cohort branches (`course/2026-spring`) let instructors pin students to a known-good revision.
- Lesson 1 = the install itself; observable, narrated by the parent Zo agent.
- Failure modes are enumerated with manual recovery paths in `INSTALLATION.md` §8.

### 13.7 Open Question (Phase 6)

The pattern of "subprocess emits spec → parent agent provisions" is novel. Phase 6 build starts with a small prototype to validate the handoff before locking the design. See `INSTALLATION.md` §12.

---

## Appendix A: Filing Type Reference

| Form | Full Name | Contents | Index Mode |
|---|---|---|---|
| 10-K | Annual Report | Business, Risk Factors, MD&A, Financials | Full tree |
| 10-Q | Quarterly Report | Financials, MD&A, Risk Factors | Full tree |
| 8-K | Current Report | Material events (earnings, leadership changes) | Raw or tree |
| DEF 14A | Proxy Statement | Exec comp, board, shareholder proposals | Full tree |
| Form 3/4 | Insider Transaction | Beneficial ownership, trading activity | Raw |
| S-1 | IPO Registration | Risk factors, use of proceeds, business | Full tree |
| 20-F | Foreign Annual | Non-US issuer annual (similar to 10-K) | Full tree |
| 6-K | Foreign Current | Non-US issuer current events | Raw |
| 10-K/A, 10-Q/A | Amendments | Restated/corrected versions of original filings | Same as parent form |

## Appendix B: Query-to-Section Mapping

| User Query | Primary SEC Section(s) |
|---|---|
| Risk factors | Item 1A (10-K/10-Q) |
| Management discussion | Item 7 MD&A (10-K), Part I Item 2 (10-Q) |
| Revenue / segment breakdown | Item 8 segment footnotes, Item 7 MD&A |
| Executive compensation | DEF 14A, Item 11 (10-K) |
| Insider ownership / 10b5-1 plans | Form 3/4, Item 12 (10-K) |
| Share repurchases / buybacks | Item 5 (10-K/10-Q monthly tables) |
| Legal proceedings / lawsuits | Item 3 (10-K/10-Q) |
| Debt and credit facilities | Item 8 footnotes, Item 7 liquidity |
| Related party transactions | Item 13 (10-K) |
| Acquisitions / mergers | Item 8 notes, Item 7 |
| Accounting policies | Item 8 footnote 1-2 |
| Goodwill and intangibles | Item 8 intangible asset footnotes |

## Appendix C: Mockups

- `mockup-main.jpg` — main dashboard (tile grid + summary + search)
- `mockup-drilldown.jpg` — per-ticker drill-down (filing table)
