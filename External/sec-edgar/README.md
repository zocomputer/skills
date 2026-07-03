# Zo SEC Intelligence

Natural-language SEC filing intelligence — fetch, index, search, and analyze SEC EDGAR filings for any public company via conversation. Built for Zo Computer using the PageIndex vectorless RAG methodology.

## What It Does

- **Fetch** SEC filings (10-K, 10-Q, 8-K, DEF 14A, S-1, Form 3/4, etc.) from EDGAR
- **Index** filings using hierarchical tree structure (PageIndex approach)
- **Search** across all indexed filings with keyword + LLM reasoning fallback
- **Cite** answers with exact filing text and source locations
- **Dashboard** at `https://<your-handle>.zo.space/sec` for browsing indexed filings

## Installation

### Prerequisites

- A Zo Computer account (free tier sufficient)
- Your name + email for SEC User-Agent header

### Install via Zo Chat

```
install the sec-edgar skill from https://github.com/jingerzz/zo-sec-intelligence
```

Zo will prompt you for:
1. SEC User-Agent (format: `Your Name your@email.com`)
2. Initial tickers to track (e.g., `AAPL, MSFT, GOOGL`)

### Manual Install

```bash
# Clone to your Zo workspace
cd /home/workspace
git clone https://github.com/jingerzz/zo-sec-intelligence Skills/sec-edgar

# Run installer
python3 Skills/sec-edgar/scripts/install.py --sec-ua "Your Name your@email.com" --tickers AAPL,MSFT
```

## Usage

### Fetch Filings

```
User: "Fetch Tesla's latest 10-K"
Zo: → Downloads from EDGAR, indexes, reports when ready
```

### Ask Questions

```
User: "What are Tesla's biggest risk factors?"
Zo: → Searches indexed filings, returns raw text with citation
```

### Cross-Company Comparison

```
User: "Compare how Apple, Microsoft, and Google discuss AI in their 2025 10-Ks"
Zo: → Searches across all three, synthesizes with per-company citations
```

### Dashboard

Visit `https://<your-handle>.zo.space/sec` to browse all indexed filings.

## Architecture

```
SEC EDGAR → fetch.py (HTML download, rate-limited)
          → html2md.py (HTML → hierarchy-faithful Markdown)
          → tree_builder.py (PageIndex tree, 3-tier summary routing)
          → index.py (orchestrates pipeline, calls llm.py for summaries)
          → manifest.py (per-ticker manifest + distributed JSON trees)
          → search.py (keyword + LLM reasoning fallback)
          → Zo chat / dashboard
```

**Key principles:**
- No standalone server — Zo is the orchestrator
- No vector database — JSON trees in filesystem
- All LLM calls through `/zo/ask` with Zo-hosted MiniMax 2.7
- Files-as-database — everything in workspace filesystem

## Scripts

| Script | Purpose |
|--------|---------|
| `fetch.py` | Download filings from EDGAR |
| `index.py` | Index downloaded filings |
| `search.py` | Search indexed filings |
| `manifest.py` | Manifest utilities |
| `config.py` | Config read/write |
| `install.py` | First-time setup |
| `doctor.py` | Health check |

## Cost

Using Zo-hosted MiniMax 2.7 ($0.30/1M input, $1.20/1M output tokens):

| Operation | Cost |
|-----------|------|
| Index a 10-K | ~$0.02 |
| Index a 10-Q | ~$0.01 |
| Index an 8-K | $0.00 (raw mode, no LLM) |
| Search with reasoning fallback | ~$0.002 |
| Steady state (8 tickers, weekly automation) | ~$0.40–1.20/month |

## Documentation

- `SKILL.md` — Natural-language workflows for Zo agents
- `PRD.md` — Product requirements
- `ENGINEERING_PLAN.md` — Technical implementation details
- `STATUS.md` — Build progress and decisions log
- `AGENTS.md` — Agent-specific guidance

## License

MIT

## Author

Jing Xie — Clarion Intelligence Systems LLC
