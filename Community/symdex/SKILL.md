---
name: symdex
description: Index and search codebases using SymDex, a universal code-indexer that uses tree-sitter parsing and semantic embeddings. Use when you need to find functions, classes, or symbols across projects, understand call graphs, or perform semantic code search. Saves ~97% of tokens compared to reading full files.
category: Development
compatibility: Created for Zo Computer. Requires Python 3.11+.
metadata:
  author: YOUR_HANDLE.zo.computer
  source: https://github.com/husnainpk/SymDex
  license: MIT
  emoji: 🔍
  emojis: ["🔍", "🧬", "📇"]
tags:
  - code-indexer
  - mcp
  - tree-sitter
  - semantic-search
  - call-graph
  - symbol-search
  - development
---
# SymDex - Universal Code Indexer

SymDex indexes codebases into a local SQLite database using tree-sitter parsing, then lets you find any function, class, or method by name, meaning, or call relationship in ~200 tokens instead of reading whole files (~7,500 tokens). That is a 97% reduction per lookup.

## When to Use This Skill

- The user asks to "index" a project or codebase
- The user wants to find a function/class/method across a large project
- The user wants to understand call graphs (who calls what)
- The user wants semantic code search ("find the function that validates email")
- The user wants to explore a project's structure without reading every file
- The user references "symdex" or "code index" by name

## Installation

SymDex is installed via pip. If not already installed, run:

```bash
pip install symdex
```

If the pip-installed version has issues with missing `schema.sql`, clone and install from source:

```bash
git clone https://github.com/husnainpk/SymDex.git /tmp/symdex-src
pip install -e /tmp/symdex-src
```

Verify installation:

```bash
symdex --help
```

## Core Workflow

### Step 1: Index a project

```bash
symdex index /path/to/project --name my-project
```

This parses all supported source files using tree-sitter, extracts every function, class, and method with name, kind, file path, byte offsets, signatures, and docstrings. It stores everything in a SQLite database at `~/.symdex/<name>.db` with SHA-256 change detection for incremental re-indexing.

### Step 2: Search and query

Use the CLI commands or the wrapper script at `scripts/symdex-cli.py` for structured JSON output.

### Step 3: (Optional) Start MCP server

```bash
symdex serve              # stdio mode for local agents
symdex serve --port 8080  # HTTP mode for remote agents
```

## CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `symdex index <path>` | Index a folder | `symdex index ./myproject --name myproj` |
| `symdex search <query>` | Find symbols by name | `symdex search "validate_email" --repo myproj` |
| `symdex find <name>` | Exact symbol lookup | `symdex find MyClass --repo myproj` |
| `symdex semantic <query>` | Search by meaning | `symdex semantic "parse auth token" --repo myproj` |
| `symdex outline <file>` | List symbols in a file | `symdex outline auth/utils.py --repo myproj` |
| `symdex text <query>` | Text/substring search | `symdex text "TODO" --repo myproj` |
| `symdex callers <name>` | Who calls this function | `symdex callers process_payment --repo myproj` |
| `symdex callees <name>` | What this function calls | `symdex callees process_payment --repo myproj` |
| `symdex repos` | List indexed repos | `symdex repos` |
| `symdex invalidate` | Force re-index | `symdex invalidate --repo myproj` |
| `symdex serve` | Start MCP server | `symdex serve --port 8080` |

All commands support `--json` for machine-readable output.

## Wrapper Script

Use `scripts/symdex-cli.py` for a streamlined interface with JSON output:

```bash
python3 Skills/symdex/scripts/symdex-cli.py --help
python3 Skills/symdex/scripts/symdex-cli.py index /path/to/project --name myproj
python3 Skills/symdex/scripts/symdex-cli.py search "validate_email" --repo myproj
python3 Skills/symdex/scripts/symdex-cli.py semantic "check if email is valid" --repo myproj
python3 Skills/symdex/scripts/symdex-cli.py callers "process_payment" --repo myproj
python3 Skills/symdex/scripts/symdex-cli.py callees "process_payment" --repo myproj
python3 Skills/symdex/scripts/symdex-cli.py outline "auth/utils.py" --repo myproj
python3 Skills/symdex/scripts/symdex-cli.py repos
```

## Supported Languages (12)

Python (.py), JavaScript (.js, .mjs), TypeScript (.ts, .tsx), Go (.go), Rust (.rs), Java (.java), PHP (.php), C# (.cs), C (.c, .h), C++ (.cpp, .cc, .h), Elixir (.ex, .exs), Ruby (.rb)

## MCP Server Tools (14)

When running as an MCP server (`symdex serve`), these tools are available to any MCP-compatible agent:

| Tool | Description |
|------|-------------|
| `index_folder` | Index a local folder |
| `index_repo` | Index a named, registered repo |
| `search_symbols` | Find function/class by name (~200 tokens) |
| `get_symbol` | Get full source by byte offset |
| `get_symbols` | Bulk symbol retrieval |
| `get_file_outline` | All symbols in a file (no content) |
| `get_repo_outline` | Directory structure + symbol stats |
| `get_file_tree` | Directory tree only |
| `search_text` | Text/regex search, matching lines only |
| `list_repos` | List all indexed repos |
| `invalidate_cache` | Force re-index on next request |
| `semantic_search` | Find symbols by meaning (embedding similarity) |
| `get_callers` | Find all callers of a function |
| `get_callees` | Find all callees of a function |

## Architecture Notes

- **Storage**: SQLite per repo at `~/.symdex/`, central registry at `~/.symdex/registry.db`
- **Parsing**: tree-sitter for AST extraction across 12 languages
- **Embeddings**: `sentence-transformers` (`all-MiniLM-L6-v2` default), runs fully locally, no API calls. Configurable via `SYMDEX_EMBED_MODEL` env var.
- **Vector search**: `sqlite-vec` extension for cosine similarity
- **Change detection**: SHA-256 file hashing, only re-indexes changed files
- **MCP server**: Built on FastMCP, supports stdio and streamable HTTP transport
- **Call graph**: Extracted during indexing, stored as edges table for instant caller/callee queries

## Tips

- Always index before searching. Without indexing, searches return nothing.
- Re-index after code changes with `symdex index` (only changed files are reprocessed).
- Use `--name` when indexing to give repos memorable names.
- Omit `--repo` from `symdex search` to search across all indexed repos.
- Use `symdex semantic` when you don't know the exact function name.
- Use `symdex callers` before refactoring to understand impact.
