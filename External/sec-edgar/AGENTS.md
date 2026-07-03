# AGENTS.md — Zo SEC Intelligence

This file is the primary onboarding reference for any Zo agent working on the sec-edgar skill.

---

## What This Is

`Skills/sec-edgar/` is a Zo-native SEC filing intelligence platform. It fetches filings from EDGAR, builds hierarchical tree indexes using the PageIndex methodology, stores everything in the workspace filesystem, and exposes search and analysis via Zo chat, automations, and a private Zo Space dashboard.

---

## Key Files

| File | Purpose |
|---|---|
| `STATUS.md` | **Start here.** Phase tracker, decisions log, recent sessions. |
| `PRD.md` | Product Requirements — what we're building and why |
| `ENGINEERING_PLAN.md` | How we're building it — component specs, phases, cost |
| `SKILL.md` | **Skill definition** — the entry point Zo agents use |
| `prompts/weekly_fetch.md` | Automation instruction text — weekly filing monitor |
| `INSTALLATION.md` | How the skill is installed |
| `AGENTS.md` | This file — agent-specific guidance |

---

## Architecture in One Paragraph

```
SEC EDGAR → fetch.py (HTML downloads, rate-limited)
          → html2md.py (HTML → hierarchy-faithful Markdown)
          → tree_builder.py (Markdown → hierarchical tree, three-tier summary routing)
          → index.py (orchestrates the above, calls llm.py for batched MiniMax summarization)
          → manifest.py (writes per-ticker manifest + distributed JSON tree to sec/)
          → search.py (keyword search + /zo/ask reasoning fallback)
          → Zo chat / Zo Space dashboard (reads sec/ filesystem)
```

**No standalone server. No MCP transport. No vector DB.**

---

## Critical Design Decisions (Do Not Revisit Without Full Re-Review)

1. **All LLM calls go through `/zo/ask`** with Zo-hosted MiniMax 2.7 (`zo:minimax/minimax-m2.7`). No direct MiniMax key, no chat-completions endpoint.
2. **Batched summarization:** 1 `/zo/ask` call per filing (structured JSON output with all section summaries), not N per-section calls.
3. **Distributed manifests:** `sec/index/[TICKER]/[TICKER].manifest.json` is source of truth per ticker. Global aggregate rebuilt on read.
4. **Keyword search first; LLM reasoning fallback** when keyword score < 3. Never skip keyword baseline.
5. **Dashboard is read-only.** Mutations (add ticker, change config) go through chat or direct file edit.
6. **Dashboard only suggested on "what do we have indexed" queries** — not on fetch, search, or analysis workflows.
7. **Append-only storage.** Amendments are stored independently with `is_amendment`/`amends`/`is_latest_for_period` flags.
8. **Embeddings are v2.** Vectorless PageIndex approach is sufficient for v1.
9. **Storage: 10 GB soft warning, three layers.** No hard cap.
10. **Automation instructions in `prompts/weekly_fetch.md`** — separate from SKILL.md for independent evolution.

---

## Before You Start Work on This Skill

1. **Read `STATUS.md`** — know the current phase and what's been done
2. **Read the relevant PRD + Engineering Plan sections** — understand the design before touching code
3. **Check the Decisions Log in `STATUS.md`** — confirm your change doesn't conflict with a committed decision
4. **Run `doctor.py`** — verify the environment is in a valid state before making changes

---

## Script Responsibilities

| Script | What it does |
|---|---|
| `fetch.py` | Downloads HTML filings from SEC EDGAR. Rate-limited, paginated, resume-able. Accepts ticker-or-CIK. |
| `html2md.py` | Converts SEC HTML to hierarchy-faithful Markdown. Preserves h1-h6, Item/Part patterns, bold ALL-CAPS headings. |
| `tree_builder.py` | Builds PageIndex tree from Markdown. Three-tier summary routing (raw/extractive/LLM). |
| `index.py` | Orchestrates html2md → tree_builder → llm → manifest. Main entry point for indexing. |
| `search.py` | Keyword search + LLM reasoning fallback. Returns ranked results with doc_id, node_id, snippet. |
| `manifest.py` | Per-ticker manifest CRUD. Uses fcntl.flock for concurrency safety. Exposes storage stats. |
| `check_indexed.py` | Reports indexed vs. available filings for a ticker. |
| `config.py` | Config read/write for `sec/config.json`. |
| `rate_tracker.py` | Proactive SEC rate-limit tracker. Tracks last 60s of requests. |
| `llm.py` | `/zo/ask` wrapper. Batched summarization (1 call per filing). Reasoning fallback with structured output. |
| `tree_search.py` | Shared tree traversal utilities. |
| `utils.py` | Shared helpers: checksums, atomic writes, token counting. |
| `install.py` | Non-interactive bootstrap. Emits JSON provisioning spec to stdout. |
| `bootstrap_dashboard.py` | Writes route specs to `.bootstrap/` for parent agent to provision. |
| `doctor.py` | Post-install health check. |
| `uninstall.py` | Reverses install; non-destructive of indexed data by default. |

---

## Secrets Needed

| Secret | Where used | Set by |
|---|---|---|
| `SEC_USER_AGENT` | `fetch.py` | User (or install.py prompts) — stored in `sec/config.json` |
| `SEC_DASHBOARD_TOKEN` | Zo Space API routes | Generated by install.py, stored in Settings > Advanced |
| `ZO_CLIENT_IDENTITY_TOKEN` | `llm.py` | Auto-injected in Zo sessions — do not set manually |

---

## Common Tasks

**Add a new ticker:**
```bash
python3 Skills/sec-edgar/scripts/fetch.py --ticker TSLA --forms 10-K,10-Q,8-K --max 5
python3 Skills/sec-edgar/scripts/index.py --auto
```

**Run a search:**
```bash
python3 Skills/sec-edgar/scripts/search.py --query "risk factors" --tickers TSLA,AAPL
```

**Check what's indexed:**
```bash
python3 Skills/sec-edgar/scripts/check_indexed.py --ticker TSLA
```

**Check storage:**
```bash
python3 Skills/sec-edgar/scripts/manifest.py --storage-stats
```

**Run doctor:**
```bash
python3 Skills/sec-edgar/scripts/doctor.py
```

---

## Zo Space Dashboard Routes

| Route | Type | Auth |
|---|---|---|
| `/sec` | page (public) | No auth — publicly accessible |
| `/sec/:ticker` | page (public) | No auth — publicly accessible |
| `/api/sec/summary` | api (public) | No auth — publicly accessible |
| `/api/sec/ticker/:ticker` | api (public) | No auth — publicly accessible |
| `/api/sec/search` | api (public) | No auth — publicly accessible |
| `/api/sec/check` | api (public) | No auth — publicly accessible |

Routes are created via `write_space_route`, NOT stored as workspace files. Use `list_space_routes()` to inspect.

---

## Rate Limits

- **SEC EDGAR:** max 10 req/s per IP. Scripts target ~5.5–7 req/s with jitter. On 503: exponential backoff, 3 retries, then raise `RateLimitError`.
- **MiniMax on Zo:** no public rate limit known. Batch summarization to 1 call/filing keeps usage low.
- **Zo automations:** high-frequency (> hourly) is discouraged — each run is a full chat session.

---

## Cost Reference (May 2026)

| Operation | LLM calls | Cost |
|---|---|---|
| Index 10-K | 1 `/zo/ask` | ~$0.02 |
| Index 10-Q | 1 `/zo/ask` | ~$0.01 |
| Index 8-K | 0 | $0.00 |
| Keyword search | 0 | $0.00 |
| Reasoning fallback | 1 `/zo/ask` | ~$0.002 |
| Weekly automation (8 tickers, ~10 filings) | ~5 `/zo/ask` | ~$0.05–0.10 |
| **Steady state/month (8 tickers)** | | **~$0.40–1.20** |

---

## Bug Reports and Issues

If something breaks:
1. Run `doctor.py` first — it checks filesystem, config, routes, automation, reachability
2. Check `sec/logs/fetch_*.log` and `sec/logs/index_*.log` for errors
3. Check the manifest: `cat sec/index/[TICKER]/[TICKER].manifest.json`
4. Verify SEC EDGAR is accessible: `curl -I -H "User-Agent: test" https://www.sec.gov/`