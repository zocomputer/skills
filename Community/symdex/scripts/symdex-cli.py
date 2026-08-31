#!/usr/bin/env python3
"""SymDex wrapper for Zo - provides structured JSON output for all operations.

Usage:
    python3 symdex.py <command> [options]

Commands:
    index       Index a folder
    search      Find symbols by name
    semantic    Search by meaning
    callers     Find callers of a function
    callees     Find callees of a function
    outline     List symbols in a file
    text        Text search in indexed files
    repos       List all indexed repos
    invalidate  Force re-index
    get-symbol  Get full source of a symbol by byte offsets
    serve       Start MCP server
"""

import argparse
import json
import os
import sys


def ensure_installed():
    try:
        import symdex  # noqa: F401
    except ImportError:
        print(json.dumps({"error": "SymDex not installed. Run: pip install symdex"}))
        sys.exit(1)


def cmd_index(args):
    from symdex.core.indexer import index_folder
    from symdex.core.storage import upsert_repo

    path = os.path.abspath(args.path)
    if not os.path.isdir(path):
        print(json.dumps({"error": f"Path does not exist: {path}"}))
        sys.exit(1)

    result = index_folder(path, name=args.name)
    upsert_repo(result.repo, root_path=path, db_path=result.db_path)
    print(json.dumps({
        "repo": result.repo,
        "db_path": result.db_path,
        "indexed": result.indexed_count,
        "skipped": result.skipped_count,
    }))


def cmd_search(args):
    if args.repo:
        from symdex.core.storage import get_connection, get_db_path
        from symdex.search.symbol_search import search_symbols
        conn = get_connection(get_db_path(args.repo))
        try:
            symbols = search_symbols(conn, repo=args.repo, query=args.query, kind=args.kind, limit=args.limit)
        finally:
            conn.close()
    else:
        from symdex.graph.registry import search_across_repos
        symbols = search_across_repos(query=args.query, kind=args.kind, limit=args.limit)

    print(json.dumps({"symbols": symbols, "count": len(symbols)}))


def cmd_semantic(args):
    from symdex.core.storage import get_connection, get_db_path
    from symdex.search.semantic import search_semantic

    if not args.repo:
        print(json.dumps({"error": "--repo is required for semantic search"}))
        sys.exit(1)

    conn = get_connection(get_db_path(args.repo))
    try:
        results = search_semantic(conn, query=args.query, repo=args.repo, limit=args.limit)
    finally:
        conn.close()
    print(json.dumps({"symbols": results, "count": len(results)}))


def cmd_callers(args):
    from symdex.core.storage import get_connection, get_db_path
    from symdex.graph.call_graph import get_callers

    conn = get_connection(get_db_path(args.repo))
    try:
        results = get_callers(conn, name=args.name, repo=args.repo)
    finally:
        conn.close()
    print(json.dumps({"callers": results, "count": len(results)}))


def cmd_callees(args):
    from symdex.core.storage import get_connection, get_db_path
    from symdex.graph.call_graph import get_callees

    conn = get_connection(get_db_path(args.repo))
    try:
        results = get_callees(conn, name=args.name, repo=args.repo)
    finally:
        conn.close()
    print(json.dumps({"callees": results, "count": len(results)}))


def cmd_outline(args):
    from symdex.core.storage import get_connection, get_db_path, query_file_symbols

    conn = get_connection(get_db_path(args.repo))
    try:
        symbols = query_file_symbols(conn, repo=args.repo, file=args.file)
    finally:
        conn.close()
    print(json.dumps({"file": args.file, "symbols": symbols, "count": len(symbols)}))


def cmd_text(args):
    from symdex.core.storage import get_connection, get_db_path, search_text_in_index, query_repos

    if not args.repo:
        print(json.dumps({"error": "--repo is required for text search"}))
        sys.exit(1)

    all_repos = query_repos()
    repo_info = next((r for r in all_repos if r["name"] == args.repo), None)
    if not repo_info:
        print(json.dumps({"error": f"Repo not indexed: {args.repo}"}))
        sys.exit(1)

    conn = get_connection(get_db_path(args.repo))
    try:
        matches = search_text_in_index(conn, repo=args.repo, query=args.query,
                                       repo_root=repo_info["root_path"], file_pattern=args.pattern)
    finally:
        conn.close()
    print(json.dumps({"matches": matches, "count": len(matches)}))


def cmd_repos(args):
    from symdex.core.storage import query_repos
    repos = query_repos()
    print(json.dumps({"repos": repos, "count": len(repos)}))


def cmd_invalidate(args):
    from symdex.core.indexer import invalidate
    count = invalidate(args.repo, file=args.file)
    print(json.dumps({"invalidated": count}))


def cmd_get_symbol(args):
    from symdex.core.storage import query_repos

    all_repos = query_repos()
    repo_info = next((r for r in all_repos if r["name"] == args.repo), None)
    if not repo_info:
        print(json.dumps({"error": f"Repo not indexed: {args.repo}"}))
        sys.exit(1)

    abs_path = os.path.join(repo_info["root_path"], args.file)
    if not os.path.isfile(abs_path):
        print(json.dumps({"error": f"File not found: {args.file}"}))
        sys.exit(1)

    with open(abs_path, "rb") as fh:
        fh.seek(args.start_byte)
        source = fh.read(args.end_byte - args.start_byte).decode("utf-8", errors="replace")

    print(json.dumps({"file": args.file, "start_byte": args.start_byte, "end_byte": args.end_byte, "source": source}))


def cmd_serve(args):
    from symdex.mcp.server import mcp
    if args.port:
        mcp.run(transport="streamable-http", port=args.port)
    else:
        mcp.run()


def main():
    ensure_installed()

    parser = argparse.ArgumentParser(description="SymDex - Universal Code Indexer (Zo wrapper)")
    sub = parser.add_subparsers(dest="command", required=True)

    # index
    p = sub.add_parser("index", help="Index a folder")
    p.add_argument("path", help="Directory to index")
    p.add_argument("--name", "-n", help="Repo name (defaults to folder name)")

    # search
    p = sub.add_parser("search", help="Find symbols by name")
    p.add_argument("query", help="Symbol name to search for")
    p.add_argument("--repo", "-r", help="Repo name (omit to search all)")
    p.add_argument("--kind", "-k", help="Symbol kind filter (function, class, method)")
    p.add_argument("--limit", "-l", type=int, default=20, help="Max results")

    # semantic
    p = sub.add_parser("semantic", help="Search by meaning")
    p.add_argument("query", help="Natural language query")
    p.add_argument("--repo", "-r", required=True, help="Repo name")
    p.add_argument("--limit", "-l", type=int, default=10, help="Max results")

    # callers
    p = sub.add_parser("callers", help="Find callers of a function")
    p.add_argument("name", help="Function name")
    p.add_argument("--repo", "-r", required=True, help="Repo name")

    # callees
    p = sub.add_parser("callees", help="Find callees of a function")
    p.add_argument("name", help="Function name")
    p.add_argument("--repo", "-r", required=True, help="Repo name")

    # outline
    p = sub.add_parser("outline", help="List symbols in a file")
    p.add_argument("file", help="Relative file path within repo")
    p.add_argument("--repo", "-r", required=True, help="Repo name")

    # text
    p = sub.add_parser("text", help="Text search in indexed files")
    p.add_argument("query", help="Text to search for")
    p.add_argument("--repo", "-r", required=True, help="Repo name")
    p.add_argument("--pattern", "-p", help="File glob pattern")

    # repos
    sub.add_parser("repos", help="List all indexed repos")

    # invalidate
    p = sub.add_parser("invalidate", help="Force re-index")
    p.add_argument("--repo", "-r", required=True, help="Repo name")
    p.add_argument("--file", "-f", help="Specific file to invalidate")

    # get-symbol
    p = sub.add_parser("get-symbol", help="Get symbol source by byte offsets")
    p.add_argument("--repo", "-r", required=True, help="Repo name")
    p.add_argument("--file", "-f", required=True, help="Relative file path")
    p.add_argument("--start-byte", type=int, required=True, help="Start byte offset")
    p.add_argument("--end-byte", type=int, required=True, help="End byte offset")

    # serve
    p = sub.add_parser("serve", help="Start MCP server")
    p.add_argument("--port", "-p", type=int, help="HTTP port (omit for stdio)")

    args = parser.parse_args()

    commands = {
        "index": cmd_index,
        "search": cmd_search,
        "semantic": cmd_semantic,
        "callers": cmd_callers,
        "callees": cmd_callees,
        "outline": cmd_outline,
        "text": cmd_text,
        "repos": cmd_repos,
        "invalidate": cmd_invalidate,
        "get-symbol": cmd_get_symbol,
        "serve": cmd_serve,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
