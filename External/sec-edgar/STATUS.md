# sec-edgar Build — Status Tracker

**Last updated:** 2026-05-06 21:00 ET
**Current phase:** Phase 3 — Dashboard Complete (known issues fixed)
**Next action:** User review → Phase 4 (Monitoring automation)

---

## Progress Summary

| Phase | Status | Description |
|-------|--------|-------------|
| **0. Prerequisites** | ✅ DONE | `config.py`, `utils.py`, `rate_tracker.py`, `llm.py` |
| **1. Core Scripts** | ✅ DONE | `fetch.py`, `html2md.py`, `tree_builder.py`, `index.py`, `manifest.py`, `search.py` |
| **2. Skill Definition** | ✅ DONE | `SKILL.md` with natural-language workflows |
| **3. Zo Space Dashboard** | ✅ DONE | `/sec` (main), `/sec/:ticker` (drill-down), 3 API routes — **PUBLIC** |
| **4. Monitoring** | ⏳ TODO | `prompts/weekly_monitor.md` written, needs `create_automation` |
| **5. Testing** | ⏳ TODO | Unit tests + integration tests |
| **6. Distribution** | ⏳ TODO | `install.py`, `bootstrap_dashboard.py`, `doctor.py` |

---

## Recent Sessions

### 2026-05-06 (this session)
- Built all Phase 0–1 scripts (fetch, index, search, manifest, config, llm)
- Fetched + indexed filings for 10 tickers: TSLA, CAT, IBM, DPZ, NVDA, MSTR, PLTR, SOFI, CRWV, IREN
- Tested all form types: 10-K, 10-Q, 8-K, DEF 14A, S-1, S-1/A, Form 4
- Fixed multiple bugs:
  - Doc-id format now uses `--` separator: `TICKER--FORM--DATE--ACCESSION`
  - Form type extraction handles `S-1/A`, `DEF 14A`, etc.
  - Search outputs JSON with `--json` flag
  - **node_path added to search results**
  - **Storage stats correctly computed (0.09 GB)**
  - **filing_date backfilled from SEC API for all tickers**
- Built Zo Space dashboard:
  - `/sec` — main view with tiles, stats, search — **PUBLIC**
  - `/sec/:ticker` — drill-down with filing table sorted by date — **PUBLIC**
  - `/api/sec/summary` — JSON for main view
  - `/api/sec/ticker/:ticker` — JSON for drill-down
  - `/api/sec/search` — JSON for search
- Cleaned up bogus ticker directories (26 removed)
- Rebuilt global manifest: 10 tickers, 118 filings

---

## Decisions Log

| # | Date | Decision | Context |
|---|------|----------|---------|
| 1 | 2026-05-06 | Doc-id format: `TICKER--FORM--DATE--ACCESSION` | Disambiguates amendments, same-day filings |
| 2 | 2026-05-06 | Filename format: same as doc-id + `.html` or `.json` | Consistency, dedup by accession |
| 3 | 2026-05-06 | API routes export `(c: Context) => Response` | Not `new Hono()` apps — root conflict |
| 4 | 2026-05-06 | Search script: `--json` flag for API consumption | CLI default is text, API needs JSON |
| 5 | 2026-05-06 | Filter bogus tickers in manifest rebuild | Don't create dirs with `--` or `.HTML` |
| 6 | 2026-05-06 | Dark theme for SEC dashboard | Bloomberg/terminal aesthetic per PRD |
| 7 | 2026-05-06 | Dashboard is **PUBLIC** | User can share link to portfolio view |

---

## Known Issues — RESOLVED

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | ~~Some JSON trees have empty `doc_id` fields~~ | Search returns partial results | ✅ Fixed: backfilled 100 files |
| 2 | ~~Storage stats not computed correctly~~ | Dashboard shows wrong size | ✅ Fixed: now uses correct calculation |
| 3 | ~~Search results don't include `node_path`~~ | Dashboard shows only `title` | ✅ Fixed: added path tracking to `_flatten_tree` |
| 4 | ~~Filing dates empty in drill-down view~~ | Users can't see when filing was made | ✅ Fixed: backfilled from SEC API (96 filings updated) |

---

## File Checklist

| File | Status | Notes |
|------|--------|-------|
| `SKILL.md` | ✅ DONE | Full natural-language workflows |
| `PRD.md` | ✅ DONE | v1.3 — all open questions resolved |
| `ENGINEERING_PLAN.md` | ✅ DONE | v1.3 — Phase 6 added |
| `README.md` | ✅ DONE | Architecture overview, quick links |
| `STATUS.md` | ✅ DONE | This file |
| `INSTALLATION.md` | ⏳ TODO | Need to write |
| `scripts/config.py` | ✅ DONE | Config read/write |
| `scripts/utils.py` | ✅ DONE | Checksums, atomic writes, token count |
| `scripts/rate_tracker.py` | ✅ DONE | Proactive SEC rate limiting |
| `scripts/llm.py` | ✅ DONE | `/zo/ask` wrapper, batched summaries |
| `scripts/fetch.py` | ✅ DONE | EDGAR downloader, paginated, resume |
| `scripts/html2md.py` | ✅ DONE | SEC-aware HTML → Markdown |
| `scripts/tree_builder.py` | ✅ DONE | PageIndex tree, 3-tier summary |
| `scripts/index.py` | ✅ DONE | Orchestrates fetch → index pipeline |
| `scripts/manifest.py` | ✅ DONE | Per-ticker + global manifests |
| `scripts/search.py` | ✅ DONE | Keyword + reasoning fallback, node_path |
| `scripts/check_indexed.py` | ✅ DONE | What's indexed vs available |
| `prompts/weekly_monitor.md` | ✅ DONE | Automation instruction template |

---

## Next Steps

1. **User reviews dashboard** — test live at https://cis.zo.space/sec
2. **Phase 4: Monitoring** — register weekly automation via `create_automation`
3. **Phase 5: Testing** — unit tests for each script, integration tests
4. **Phase 6: Distribution** — write `install.py`, `bootstrap_dashboard.py`, `doctor.py`, `INSTALLATION.md`

---

## Quick Commands

```bash
# Check what's indexed
python3 Skills/sec-edgar/scripts/check_indexed.py --ticker TSLA

# Fetch new filings
python3 Skills/sec-edgar/scripts/fetch.py --ticker NVDA --forms 10-K,10-Q --max 5

# Index downloaded filings
python3 Skills/sec-edgar/scripts/index.py --auto

# Search
python3 Skills/sec-edgar/scripts/search.py --query "AI strategy" --json --max 10

# Rebuild global manifest
python3 -c "
from Skills.sec_edgar.scripts import manifest as m
m.rebuild_global_manifest()
print(m.get_storage_stats())
"
```

---

## Routes Live

| Route | URL | Status |
|-------|-----|--------|
| Main dashboard | https://cis.zo.space/sec | ✅ Live (public) |
| Ticker drill-down | https://cis.zo.space/sec/TSLA | ✅ Live (public) |
| Summary API | https://cis.zo.space/api/sec/summary | ✅ Live |
| Ticker API | https://cis.zo.space/api/sec/ticker/TSLA | ✅ Live |
| Search API | https://cis.zo.space/api/sec/search?q=risk+factors | ✅ Live |

---

## Stats

- **Tickers indexed:** 10
- **Filings indexed:** 118
- **Storage used:** 0.09 GB
- **Form types:** 10-K, 10-Q, 8-K, DEF 14A, S-1, S-1/A, Form 4, 13F-HR, 13D, 13G
