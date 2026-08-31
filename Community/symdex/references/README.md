# SymDex

<p align="center">
  <a href="https://pypi.org/project/symdex/"><img src="https://img.shields.io/pypi/v/symdex?color=blue&label=PyPI" alt="PyPI version"></a>
  <a href="https://pypi.org/project/symdex/"><img src="https://img.shields.io/pypi/pyversions/symdex" alt="Python versions"></a>
  <a href="https://github.com/husnainpk/symdex/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
</p>

<p align="center">
  <strong>Universal code-indexer MCP server for AI coding agents.</strong><br>
  Claude · Cursor · Codex CLI · Gemini CLI · GitHub Copilot · Windsurf · Zed · OpenCode · Any agent that speaks MCP.
</p>

<p align="center">
  Pre-index your codebase once. Let AI agents find any symbol in ~200 tokens instead of reading whole files at ~7,500 tokens.<br>
  <strong>That is a 97% reduction — per lookup, every lookup.</strong>
</p>

```bash
pip install symdex
```

---

## The Problem

Every time an AI coding agent needs to find a function, it reads the entire file that might contain it. Here is what that looks like in practice:

```
Agent thought: "I need to find the validate_email function."
Agent action: Read auth/utils.py          → 7,500 tokens consumed
Agent action: Read auth/validators.py     → 6,200 tokens consumed
Agent action: Read core/helpers.py        → 8,100 tokens consumed
Agent finds it on the third try.          → 21,800 tokens wasted
```

This is the equivalent of reading an entire book from page one every time you want to find a single paragraph — when the book has an index sitting right there.

On a large codebase, a single development session can burn hundreds of thousands of tokens this way. That is real money, real slowness, and real context-window pressure.

**SymDex is the index.**

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1 — Index once (you run this, takes seconds to minutes)   │
│                                                                 │
│  symdex index ./myproject                                       │
│         │                                                       │
│         ▼                                                       │
│  tree-sitter parses every source file                           │
│         │                                                       │
│         ▼                                                       │
│  Every function, class, method extracted                        │
│  with name · kind · file · exact byte offsets · docstring       │
│         │                                                       │
│         ▼                                                       │
│  Stored in SQLite database  +  vector embeddings (sqlite-vec)   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  STEP 2 — Agent queries SymDex instead of reading files         │
│                                                                 │
│  Without SymDex:                                                │
│  Agent → read auth/utils.py (full) → 7,500 tokens              │
│                                                                 │
│  With SymDex:                                                   │
│  Agent → search_symbols("validate_email")                       │
│        → { file: "auth/utils.py", start_byte: 1024,            │
│            end_byte: 1340 }          → ~200 tokens             │
│  Agent → read bytes 1024–1340 only  → done                     │
└─────────────────────────────────────────────────────────────────┘
```

SymDex does not read files for the agent. It tells the agent **exactly where to look** — file path and byte offset — so the agent reads only the bytes it needs. Nothing more.

---

## Real-World Example

Here is a complete session showing how an agent uses SymDex to navigate a codebase:

**Setup — index the project once:**
```bash
symdex index ./myproject --name myproject
symdex serve   # start the MCP server
```

**Agent calls `search_symbols` to locate a function:**
```json
// Tool call
{ "tool": "search_symbols", "query": "validate_email", "repo": "myproject" }

// Response (~200 tokens)
{
  "symbols": [
    {
      "name": "validate_email",
      "kind": "function",
      "file": "auth/utils.py",
      "start_byte": 1024,
      "end_byte": 1340,
      "signature": "def validate_email(email: str) -> bool"
    }
  ]
}
```

**Agent calls `get_symbol` to read only that function:**
```json
// Tool call — reads bytes 1024 to 1340 only
{ "tool": "get_symbol", "file": "auth/utils.py", "start_byte": 1024, "end_byte": 1340, "repo": "myproject" }

// Response — the exact function source, nothing else
{
  "source": "def validate_email(email: str) -> bool:\n    \"\"\"Validate email format.\"\"\"\n    pattern = r'^[\\w.-]+@[\\w.-]+\\.\\w+$'\n    return bool(re.match(pattern, email))"
}
```

**Agent calls `get_callers` to understand impact before changing it:**
```json
// Tool call
{ "tool": "get_callers", "name": "validate_email", "repo": "myproject" }

// Response
{
  "callers": [
    { "name": "register_user",  "file": "auth/views.py",  "kind": "function" },
    { "name": "update_profile", "file": "users/views.py", "kind": "function" }
  ]
}
```

**Agent uses `semantic_search` when it doesn't know the exact name:**
```json
// Tool call
{ "tool": "semantic_search", "query": "check if user email address is valid", "repo": "myproject" }

// Response — finds by meaning, not by name
{
  "symbols": [
    { "name": "validate_email", "score": 0.91, "file": "auth/utils.py" },
    { "name": "is_valid_address", "score": 0.74, "file": "core/validators.py" }
  ]
}
```

Total tokens for this entire session: **~800 tokens.** Without SymDex, finding and reading these three functions would cost **~25,000 tokens.**

---

## For AI Agents

> **If you are an AI agent reading this:** Follow these rules to use SymDex correctly.

**Rule 1 — Index before anything else.**
Call `index_folder` with the project path at the start of every session. Without this, the index is empty and all searches return nothing.

```json
{ "tool": "index_folder", "path": "/path/to/project", "name": "myproject" }
```

**Rule 2 — Never read a full file to find a function.**
Always call `search_symbols` first. Use the returned `start_byte` and `end_byte` to read only the relevant bytes via `get_symbol`.

**Rule 3 — Use the right tool for the right query.**

| What you want | Tool to call |
|---|---|
| Find a function by name | `search_symbols` |
| Read a function's source | `get_symbol` (use byte offsets from search) |
| Find by meaning / description | `semantic_search` |
| See all symbols in a file | `get_file_outline` |
| Understand project structure | `get_repo_outline` |
| Find who calls a function | `get_callers` |
| Find what a function calls | `get_callees` |
| Search for a string in code | `search_text` |

**Rule 4 — Re-index after code changes.**
Call `index_folder` again (or `invalidate_cache` for a specific file) after modifying source files so the index reflects the latest state.

---

## SymDex vs. Conventional Approach

| Capability | Conventional (read files) | SymDex |
|-----------|--------------------------|--------|
| Find a function by name | Read entire file(s) | Byte-offset lookup — read only those bytes |
| Token cost per lookup | ~7,500 tokens (one file) | ~200 tokens |
| Token cost across a session | Compounds per lookup | Fixed per lookup — does not compound |
| Search by meaning | Not possible | Semantic embedding search — finds by intent |
| "Who calls this function?" | Read every file manually | Pre-built call graph — instant answer |
| "What does this function call?" | Read function body manually | Pre-built call graph — instant answer |
| Search across multiple projects | Not possible | Cross-repo registry — one SymDex, many projects |
| Context window pressure | High — full files accumulate | Low — precise snippets only |
| Works with any AI agent | Agent-specific plugins | Any MCP-compatible agent — one config |
| Command-line access | Not available | Full CLI included |
| Re-index on changes | Full re-read every time | SHA-256 change detection — only re-indexes changed files |

---

## Features

### Symbol Search
Find any function, class, method, or variable by name across your entire indexed codebase. Returns file path and exact byte offsets. No file reading required.

### Semantic Search
Can't remember the exact function name? Search by what it does.

```bash
symdex semantic "parse and validate an authentication token" --repo myproject
```

SymDex embeds every symbol's signature and docstring into a vector and finds the closest matches by meaning — not by keyword. Powered by `sentence-transformers` running fully locally, no API calls required.

### Call Graph
Understand the impact of any change before you make it.

```bash
symdex callers process_payment --repo myproject   # Who calls this? (impact analysis)
symdex callees process_payment --repo myproject   # What does this call? (dependency trace)
```

Call relationships are extracted during indexing and stored as a graph. No file reading at query time.

### Cross-Repo Registry
Index multiple projects and search across all of them from one place.

```bash
symdex index ./frontend --name frontend
symdex index ./backend  --name backend
symdex search "validate_token"           # searches both repos simultaneously
```

Each repo gets its own SQLite database. The registry tracks all of them.

### Change Detection
SymDex stores a SHA-256 hash of every indexed file. Re-indexing only processes files that have actually changed. On large codebases this makes incremental updates take seconds, not minutes.

### Full CLI
Every MCP tool is also available as a CLI command. Use SymDex without an AI agent — in scripts, in CI, or just to explore your codebase.

### HTTP + stdio Transport
Run SymDex as a local stdio server (default, for desktop agents) or as an HTTP server for remote access.

```bash
symdex serve              # stdio — for Claude, Cursor, Copilot, Gemini CLI, Codex CLI, etc.
symdex serve --port 8080  # HTTP — for remote agents or services
```

---

## Supported Languages

SymDex parses source files using [tree-sitter](https://tree-sitter.github.io/tree-sitter/) — a fast, robust, incremental parser used by major editors including Neovim, Helix, and GitHub.

| Language | File Extensions |
|----------|----------------|
| Python | `.py` |
| JavaScript | `.js` `.mjs` |
| TypeScript | `.ts` `.tsx` |
| Go | `.go` |
| Rust | `.rs` |
| Java | `.java` |
| PHP | `.php` |
| C# | `.cs` |
| C | `.c` `.h` |
| C++ | `.cpp` `.cc` `.h` |
| Elixir | `.ex` `.exs` |
| Ruby | `.rb` |

**12 languages.** More can be added by installing additional tree-sitter grammar packages.

---

## Supported Platforms

SymDex speaks the **Model Context Protocol (MCP)** — the open standard for connecting AI agents to external tools. If a platform supports MCP, SymDex works with it — no custom integration required.

| Platform | By | How to Connect |
|----------|----|---------------|
| Claude Desktop | Anthropic | Add to `claude_desktop_config.json` |
| Claude Code | Anthropic | `claude mcp add symdex -- symdex serve` |
| Codex CLI | OpenAI | Add to MCP settings |
| Codex App | OpenAI | Add to MCP settings |
| Gemini CLI | Google | Add to MCP settings |
| Cursor | Anysphere | Add to `.cursor/mcp.json` |
| Windsurf | Codeium | Add to MCP settings |
| GitHub Copilot (agent mode) | Microsoft | Add to `.vscode/mcp.json` |
| Continue.dev | Continue | Add to `config.json` |
| Cline | Cline | Add to MCP settings |
| Zed | Zed Industries | Add to MCP settings |
| OpenCode | OpenCode | Add to `opencode.json` |
| Any custom MCP client | — | stdio or HTTP transport |

### Configuration (same pattern for all platforms)

```json
{
  "mcpServers": {
    "symdex": {
      "command": "symdex",
      "args": ["serve"]
    }
  }
}
```

For HTTP mode (remote agents):

```json
{
  "mcpServers": {
    "symdex": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

---

## Installation

Available on [PyPI](https://pypi.org/project/symdex/):

```bash
pip install symdex
```

Requires Python 3.11 or higher.

---

## Quickstart

### 1. Index your project

```bash
symdex index ./myproject --name myproject
```

SymDex walks the directory, parses every supported source file, and writes the index to a local SQLite database. Run this once. Re-run it when your code changes (only modified files are re-processed).

### 2. Search for a symbol

```bash
symdex search "validate_email" --repo myproject
```

```
┏━━━━━━━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━┓
┃ Repo           ┃ Kind     ┃ Name           ┃ File                                    ┃ Start ┃
┡━━━━━━━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━┩
│ myproject      │ function │ validate_email │ auth/utils.py                           │ 1024  │
└────────────────┴──────────┴────────────────┴─────────────────────────────────────────┴───────┘
```

### 3. Start the MCP server

```bash
symdex serve
```

Point your agent at it using the config above. The agent can now use all 14 MCP tools.

---

## MCP Tool Reference

These are the tools your AI agent can call once SymDex is running as an MCP server.

| Tool | Description |
|------|-------------|
| `index_folder` | Index a local folder — run once per project |
| `index_repo` | Index a named, registered repo |
| `search_symbols` | Find function or class by name — returns byte offsets |
| `get_symbol` | Retrieve one symbol's full source by byte offset |
| `get_symbols` | Bulk symbol retrieval by a list of offsets |
| `get_file_outline` | All symbols in a file — no file content transferred |
| `get_repo_outline` | Directory structure and symbol statistics for a repo |
| `get_file_tree` | Directory tree — structure only, no content |
| `search_text` | Text or regex search — returns matching lines only |
| `list_repos` | List all indexed repos in the registry |
| `invalidate_cache` | Force re-index on next request |
| `semantic_search` | Find symbols by meaning using embedding similarity |
| `get_callers` | Find all functions that call a named function |
| `get_callees` | Find all functions called by a named function |

---

## CLI Reference

```bash
# Indexing
symdex index ./myproject                            # Index a folder
symdex index ./myproject --name myproj             # Index with a custom name
symdex invalidate --repo myproj                    # Force re-index a repo
symdex invalidate --repo myproj --file auth.py     # Force re-index one file

# Symbol search
symdex search "validate email" --repo myproj       # Search by name
symdex search "validate email"                     # Search across all repos
symdex find MyClass --repo myproj                  # Exact name lookup

# Semantic search
symdex semantic "authentication token parsing" --repo myproj

# File and repo inspection
symdex outline myproj/auth/utils.py --repo myproj  # All symbols in a file
symdex repos                                       # List all indexed repos
symdex text "TODO" --repo myproj                   # Text search

# Call graph
symdex callers process_payment --repo myproj       # Who calls this function
symdex callees process_payment --repo myproj       # What this function calls

# Server
symdex serve                                       # Start MCP server (stdio)
symdex serve --port 8080                           # Start MCP server (HTTP)
```

---

## Architecture

<details>
<summary>Click to expand — internals for the technically curious</summary>

### Storage

Each indexed repo gets its own SQLite database file stored in `~/.symdex/`. A shared registry database tracks all repos.

```sql
-- Every extracted symbol
symbols (
    id          INTEGER PRIMARY KEY,
    repo        TEXT NOT NULL,
    file        TEXT NOT NULL,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL,   -- function | class | method | constant | variable
    start_byte  INTEGER NOT NULL,
    end_byte    INTEGER NOT NULL,
    signature   TEXT,
    docstring   TEXT,
    embedding   BLOB             -- float32 vector stored via sqlite-vec
)

-- Call graph edges
edges (
    caller_id   INTEGER REFERENCES symbols(id),
    callee_name TEXT NOT NULL,
    callee_file TEXT
)

-- Change detection
files (
    repo        TEXT NOT NULL,
    path        TEXT NOT NULL,
    hash        TEXT NOT NULL,   -- SHA-256 of file contents
    indexed_at  DATETIME NOT NULL,
    PRIMARY KEY (repo, path)
)

-- Cross-repo registry
repos (
    name         TEXT PRIMARY KEY,
    root_path    TEXT NOT NULL,
    db_path      TEXT NOT NULL,
    last_indexed DATETIME
)
```

### Parsing

Source files are parsed using [tree-sitter](https://tree-sitter.github.io/tree-sitter/). tree-sitter produces a concrete syntax tree for each file. SymDex walks the tree and extracts nodes matching known symbol types per language (e.g. `function_definition` for Python, `function_declaration` for Go, `method_definition` for JavaScript).

### Semantic Embeddings

When a symbol has a docstring or signature, SymDex generates a vector embedding using `sentence-transformers` (model: `all-MiniLM-L6-v2` by default). Embeddings are stored as raw `float32` blobs and queried using `sqlite-vec` — a SQLite extension for vector similarity search. Everything runs locally. No embedding API calls.

### MCP Server

Built on [FastMCP](https://github.com/jlowin/fastmcp). Supports both stdio transport (for desktop agents) and streamable HTTP transport (for remote access).

### Project Layout

```
symdex/
├── cli.py                  — Typer CLI (all user-facing commands)
├── core/
│   ├── parser.py           — tree-sitter symbol extraction
│   ├── storage.py          — SQLite read/write, vector storage
│   ├── indexer.py          — orchestrates parse → store pipeline
│   └── schema.sql          — database schema
├── mcp/
│   ├── server.py           — FastMCP server definition
│   └── tools.py            — 14 MCP tool implementations
├── search/
│   ├── symbol_search.py    — name-based FTS search
│   ├── text_search.py      — regex/text search
│   └── semantic.py         — embedding similarity search
└── graph/
    ├── call_graph.py       — call edge extraction and query
    └── registry.py         — cross-repo registry and multi-DB search
```

</details>

---

## FAQ

**Do I need to re-index every time I change my code?**
Only if you want SymDex to reflect your latest changes. SymDex uses SHA-256 hashes to track which files have changed — re-indexing only processes modified files, so it is fast on large codebases.

**Does semantic search send my code to an API?**
No. Embeddings are generated locally using `sentence-transformers`. Nothing leaves your machine.

**Can I use SymDex without an AI agent?**
Yes. The full CLI gives you direct access to every search capability — symbol search, semantic search, call graph, file outlines — without any agent involved.

**Does it work with monorepos?**
Yes. Index each sub-project separately with a unique `--name`, then search across all of them using `symdex search` without a `--repo` flag.

**What happens if a language is not supported?**
SymDex skips files with unrecognised extensions. Supported and unsupported files can coexist in the same project — only the supported ones are indexed.

**Is the index portable?**
Yes. The SQLite `.db` files can be copied to another machine. As long as SymDex is installed there, the index works. The only caveat is that absolute file paths in the index will point to the original machine.

---

## License

MIT — see [LICENSE](LICENSE)

## Contributing

Issues and pull requests are welcome at [github.com/husnainpk/SymDex](https://github.com/husnainpk/SymDex).
