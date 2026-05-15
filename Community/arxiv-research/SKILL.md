---
name: arxiv-research
description: Search, download, and read arXiv papers directly. Provides search_papers, download_paper, list_papers, read_paper, convert (PDF to Markdown), and deep-paper-analysis workflow.
compatibility: Created for Zo Computer
metadata:
  author: ashishsoni08.zo.computer
---

# ArXiv Research Skill

Search and access arXiv papers directly from Zo Computer.

## Features

- **Search** arXiv papers with filters (date, categories)
- **Download** papers by arXiv ID
- **Convert** PDFs to Markdown (with page markers for citations)
- **Read** papers (auto-detects Markdown if available, else PDF text)
- **List** downloaded papers (with [MD] indicator)
- **Deep analysis** workflow for comprehensive paper review

## Tools

| Command | Description |
|---------|-------------|
| `search` / `search_papers` | Search arXiv papers |
| `download` / `download_paper` | Download paper by ID |
| `convert` | Convert PDF to Markdown |
| `list` / `list_papers` | List downloaded papers |
| `read` / `read_paper` | Read paper content |
| `mcp` | Execute MCP tools with JSON I/O |
| `deep-paper-analysis` | Complete analysis workflow |

## Usage

### Search for papers

```bash
bun arxiv.ts search "transformer architecture" --max 5
bun arxiv.ts search_papers "quantum" --categories cs.AI,quant-ph
```

### Download a paper

```bash
bun arxiv.ts download 2401.12345
bun arxiv.ts download_paper 2401.12345
```

### Convert to Markdown (optional)

Converts PDF to Markdown with page markers for exact citations:

```bash
bun arxiv.ts convert 2401.12345
```

**Requires:** `pip3 install PyMuPDF` (optionally `pip3 install pymupdf4llm` for better formatting)

### Read a paper

```bash
# Auto-detects: markdown if converted, else PDF text
bun arxiv.ts read 2401.12345

# JSON output for programmatic use
bun arxiv.ts read 2401.12345 --json
```

### List papers

```bash
bun arxiv.ts list
# Shows [MD] indicator for papers with Markdown version

bun arxiv.ts list --json
```

### Deep paper analysis

```bash
bun arxiv.ts deep-paper-analysis 2401.12345
```

Automatically downloads, converts (if possible), reads, and outputs paper data for analysis.

### MCP Mode

Execute tools directly with JSON I/O:

```bash
bun arxiv.ts mcp search_papers '{"query": "AI", "max_results": 5}'
bun arxiv.ts mcp download_paper '{"paper_id": "2401.12345"}'
bun arxiv.ts mcp read_paper '{"paper_id": "2401.12345"}'
```

## Storage

Downloaded papers stored at: `/home/workspace/Research/arxiv-papers/`

- `*.pdf` — Original PDF files
- `*.json` — Metadata
- `*.md` — Markdown conversion (optional)

## Dependencies

**Required:**
- Bun (Zo's default runtime)

**Optional (for PDF text extraction fallback):**
- `pdftotext` (poppler-utils) — fastest extraction
- OR `PyPDF2` — `pip3 install PyPDF2` (used via `scripts/extract_text.py`)

**Optional (for Markdown conversion):**
- `PyMuPDF` — `pip3 install PyMuPDF` (used via `scripts/convert_to_markdown.py`)
- `pymupdf4llm` — `pip3 install pymupdf4llm` (better formatting, optional)

## arXiv Categories

Common categories: `cs.AI`, `cs.LG`, `cs.CL`, `cs.CV`, `cs.RO`, `cs.CY`, `quant-ph`, `stat.ML`
