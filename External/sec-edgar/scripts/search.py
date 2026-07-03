"""Search engine for sec-edgar — keyword + LLM reasoning fallback.

Pipeline:
1. Flatten all indexed tree nodes into a flat list (doc_id, node_id, title, summary, text)
2. Keyword search: score by title (5pts) + summary (3pts) + text (1pt)
3. If top keyword score < 3 → LLM reasoning fallback (/zo/ask tree navigation)
4. Always return raw text for final results

Usage:
    python3 search.py --query "risk factors" --tickers TSLA,AAPL --max-results 5
    python3 search.py --query "AI strategy" --all
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import json
import logging
import re
import sys
from pathlib import Path
from typing import Any

from Skills.sec_edgar.scripts.config import get_llm_model
from Skills.sec_edgar.scripts.llm import reasoning_search
from Skills.sec_edgar.scripts.utils import read_json

logger = logging.getLogger("sec-edgar")

REASONING_THRESHOLD = 3
INDEX_DIR = Path("/home/workspace/sec/index")

# ── Flatten tree ───────────────────────────────────────────────────────────────

def _flatten_tree(
    structure: list[dict],
    doc_id: str,
    doc_name: str,
    path: str = "",
) -> list[dict[str, Any]]:
    """Recursively flatten a document tree into searchable nodes."""
    results = []
    for node in structure:
        if not isinstance(node, dict):
            continue
        title = node.get("title", "")
        current_path = f"{path}/{title}" if path else title
        results.append({
            "doc_id": doc_id,
            "doc_name": doc_name,
            "node_id": node.get("node_id", ""),
            "node_path": current_path,
            "title": title,
            "summary": node.get("summary", node.get("prefix_summary", "")),
            "text": node.get("text", ""),
        })
        for child in node.get("nodes", []):
            results.extend(_flatten_tree([child], doc_id, doc_name, current_path))
    return results


def _load_all_trees(tickers: list[str] | None = None) -> list[tuple[dict, Path]]:
    """Load all tree JSON files, optionally filtered to specific tickers."""
    trees = []
    if not INDEX_DIR.exists():
        return trees

    for ticker_dir in INDEX_DIR.iterdir():
        if not ticker_dir.is_dir():
            continue
        ticker = ticker_dir.name
        if tickers and ticker not in tickers:
            continue

        for json_path in ticker_dir.glob("*.json"):
            if json_path.name.endswith(".manifest.json"):
                continue
            try:
                data = read_json(json_path)
                if data and "tree" in data:
                    trees.append((data, json_path))
            except Exception:
                continue

    return trees


def _build_all_nodes(tickers: list[str] | None = None) -> list[dict[str, Any]]:
    """Build flat list of all searchable nodes across all indexed filings."""
    all_nodes = []
    for data, _ in _load_all_trees(tickers):
        tree = data.get("tree", {})
        doc_id = data.get("doc_id", "")
        doc_name = tree.get("doc_name", data.get("source_file", ""))
        structure = tree.get("structure", [])
        all_nodes.extend(_flatten_tree(structure, doc_id, doc_name))
    return all_nodes


# ── Keyword search ─────────────────────────────────────────────────────────────

def _score_node(node: dict, query_terms: list[str]) -> int:
    """Score a node based on keyword matches."""
    score = 0
    title_lower = node["title"].lower()
    summary_lower = (node.get("summary") or "").lower()
    text_lower = (node.get("text") or "").lower()

    for term in query_terms:
        tl = term.lower()
        if tl in title_lower:
            score += 5
        if tl in summary_lower:
            score += 3
        if tl in text_lower:
            score += 1
    return score


def _make_snippet(text: str, query_terms: list[str], max_len: int = 300) -> str:
    """Create a text snippet around the first keyword match."""
    text = text or ""
    for term in query_terms:
        idx = text.lower().find(term.lower())
        if idx >= 0:
            start = max(0, idx - 100)
            end = min(len(text), idx + 200)
            snippet = ("..." if start > 0 else "") + text[start:end] + ("..." if end < len(text) else "")
            return snippet
    return text[:max_len] + ("..." if len(text) > max_len else "")


def keyword_search(
    query: str,
    tickers: list[str] | None = None,
    max_results: int = 10,
) -> list[dict[str, Any]]:
    """Pure keyword search across flattened nodes."""
    query_terms = [t for t in re.split(r"\s+", query.strip()) if t]
    if not query_terms:
        return []

    all_nodes = _build_all_nodes(tickers)
    scored = []

    for node in all_nodes:
        score = _score_node(node, query_terms)
        if score > 0:
            text = node.get("text", "")
            snippet = _make_snippet(text, query_terms)
            scored.append({
                "doc_id": node["doc_id"],
                "doc_name": node["doc_name"],
                "node_id": node["node_id"],
                "title": node["title"],
                "summary": node.get("summary", ""),
                "text_snippet": snippet,
                "score": score,
                "method": "keyword",
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:max_results]


# ── LLM reasoning fallback ─────────────────────────────────────────────────────

def _build_tree_overview(structure: list[dict], max_depth: int = 3, current_depth: int = 0) -> str:
    """Build condensed tree overview for LLM (node_id, title, summary)."""
    lines = []
    if isinstance(structure, dict):
        structure = [structure]
    if not isinstance(structure, list):
        return ""

    for node in structure:
        # Skip noise nodes
        title = node.get("title", "").strip().lower()
        if title in {"table of contents", "index", "signatures", "power of attorney"}:
            continue

        node_id = node.get("node_id", "")
        summary = node.get("summary", node.get("prefix_summary", ""))
        indent = "  " * current_depth

        line = f"{indent}[{node_id}] {node.get('title', 'Untitled')}"
        if summary and len(summary) > 20:
            short = summary[:150].replace("\n", " ")
            if len(summary) > 150:
                short += "..."
            line += f" - {short}"
        lines.append(line)

        if "nodes" in node and current_depth < max_depth:
            child_lines = _build_tree_overview(node["nodes"], max_depth, current_depth + 1)
            if child_lines:
                lines.append(child_lines)

    return "\n".join(lines)


# ── Main search ───────────────────────────────────────────────────────────────

def search(
    query: str,
    tickers: list[str] | None = None,
    max_results: int = 10,
    use_reasoning: bool = True,
) -> list[dict[str, Any]]:
    """Search indexed SEC filings.

    Strategy:
    1. Keyword search (always — fast baseline)
    2. If top keyword score < REASONING_THRESHOLD AND use_reasoning=True AND single doc:
       invoke LLM reasoning fallback
    3. Return results

    Args:
        query: Search query
        tickers: Optional list of tickers to restrict search to
        max_results: Maximum results to return
        use_reasoning: Whether to use LLM reasoning fallback for weak keyword matches

    Returns:
        List of result dicts: {doc_id, doc_name, node_id, title, summary, text_snippet, score, method}
    """
    # Always run keyword search first
    results = keyword_search(query, tickers, max_results)

    if not results:
        return []

    top_score = results[0]["score"]

    # If keyword score is strong, return keyword results
    if top_score >= REASONING_THRESHOLD:
        logger.info(f"Keyword search sufficient (score={top_score}), returning {len(results)} results")
        return results

    # Try LLM reasoning fallback if enabled and we have a specific ticker context
    if use_reasoning and tickers and len(tickers) == 1:
        ticker = tickers[0]
        ticker_dir = INDEX_DIR / ticker

        # Find the most recent indexed filing for this ticker
        if ticker_dir.exists():
            candidates = sorted(ticker_dir.glob("*.json"))
            candidates = [p for p in candidates if not p.name.endswith(".manifest.json")]

            if candidates:
                latest_tree_path = candidates[-1]
                data = read_json(latest_tree_path)
                tree = data.get("tree", {})
                structure = tree.get("structure", [])
                doc_name = tree.get("doc_name", latest_tree_path.stem)

                logger.info(f"Keyword score low (score={top_score}), invoking LLM reasoning for {doc_name}")

                try:
                    selected_ids = reasoning_search(
                        query=query,
                        tree_structure=structure,
                        doc_name=doc_name,
                        max_results=max_results,
                    )

                    if selected_ids:
                        # Build full-node results for selected IDs
                        all_nodes = _build_all_nodes(tickers)
                        node_map = {n["node_id"]: n for n in all_nodes}

                        reasoning_results = []
                        for nid in selected_ids:
                            if nid in node_map:
                                node = node_map[nid]
                                snippet = _make_snippet(node.get("text", ""), query.split())
                                reasoning_results.append({
                                    "doc_id": node["doc_id"],
                                    "doc_name": node["doc_name"],
                                    "node_id": node["node_id"],
                                    "title": node["title"],
                                    "summary": node.get("summary", ""),
                                    "text_snippet": snippet,
                                    "score": 10,
                                    "method": "llm_reasoning",
                                })

                        # Merge: reasoning first, then keyword results not in reasoning
                        seen = {(r["doc_id"], r["node_id"]) for r in reasoning_results}
                        for kr in results:
                            key = (kr["doc_id"], kr["node_id"])
                            if key not in seen and len(reasoning_results) < max_results:
                                reasoning_results.append(kr)

                        logger.info(f"LLM reasoning returned {len(reasoning_results)} nodes")
                        return reasoning_results

                except Exception as e:
                    logger.warning(f"LLM reasoning fallback failed: {e}")
                    # Fall back to keyword results
                    return results

    return results


# ── Batch query (cross-ticker) ─────────────────────────────────────────────

def batch_query(
    query: str,
    tickers: list[str],
    max_results_per_ticker: int = 3,
) -> dict[str, Any]:
    """Run the same query across multiple tickers simultaneously.

    Returns per-ticker results plus a summary.
    """
    results_by_ticker = {}
    total_matches = 0

    for ticker in tickers:
        ticker_results = search(query, tickers=[ticker], max_results=max_results_per_ticker)
        results_by_ticker[ticker] = {
            "results": ticker_results,
            "match_count": len(ticker_results),
        }
        total_matches += len(ticker_results)

    return {
        "query": query,
        "tickers_searched": tickers,
        "results_by_ticker": results_by_ticker,
        "total_matches": total_matches,
    }


# ── Get document section (raw text) ─────────────────────────────────────

def get_section_text(doc_id: str, node_id: str) -> str | None:
    """Return raw text for a specific document + node."""
    # Find the JSON tree file for doc_id
    if not INDEX_DIR.exists():
        return None

    for ticker_dir in INDEX_DIR.iterdir():
        if not ticker_dir.is_dir():
            continue
        tree_path = ticker_dir / f"{doc_id}.json"
        if tree_path.exists():
            data = read_json(tree_path)
            tree = data.get("tree", {})
            structure = tree.get("structure", [])
            all_nodes = _flatten_tree(structure, doc_id, tree.get("doc_name", ""))

            for node in all_nodes:
                if node["node_id"] == node_id:
                    return node.get("text", "")
            return None

    return None


def get_document_overview(doc_id: str) -> str | None:
    """Return a TOC-style listing of all nodes in a document."""
    if not INDEX_DIR.exists():
        return None

    for ticker_dir in INDEX_DIR.iterdir():
        if not ticker_dir.is_dir():
            continue
        tree_path = ticker_dir / f"{doc_id}.json"
        if tree_path.exists():
            data = read_json(tree_path)
            tree = data.get("tree", {})
            doc_name = tree.get("doc_name", doc_id)
            doc_desc = tree.get("doc_description", "")
            structure = tree.get("structure", [])
            mode = tree.get("index_mode", "tree")

            lines = [f"Document: {doc_name}"]
            if doc_desc:
                lines.append(f"Description: {doc_desc}")
            if mode == "raw":
                lines.append("[Raw-stored — full text in single node]")
            lines.append("")

            def walk(nodes, indent=0):
                prefix = "  " * indent
                for node in nodes:
                    nid = node.get("node_id", "")
                    title = node.get("title", "Untitled")
                    summary = node.get("summary", node.get("prefix_summary", ""))
                    short = summary[:80] + "..." if len(summary) > 80 else summary
                    lines.append(f"{prefix}- [{nid}] {title}")
                    if short:
                        lines.append(f"{prefix}  {short}")
                    if node.get("nodes"):
                        walk(node["nodes"], indent + 1)

            walk(structure)
            return "\n".join(lines)

    return None


# ── CLI ─────────────────────────────────────────────────────────────────────────

def main() -> None:
    import argparse
    import json as json_mod

    parser = argparse.ArgumentParser(description="SEC Filing Search")
    parser.add_argument("--query", "-q", required=True, help="Search query")
    parser.add_argument("--tickers", help="Comma-separated tickers (default: all)")
    parser.add_argument("--all", action="store_true", help="Search all indexed filings")
    parser.add_argument("--max-results", "--max", dest="max_results", type=int, default=10)
    parser.add_argument("--no-reasoning", dest="no_reasoning", action="store_true")
    parser.add_argument("--doc-id", help="Get overview of a specific doc")
    parser.add_argument("--section", help="Get raw text (requires --doc-id and --node-id)")
    parser.add_argument("--node-id", help="Node ID for --section")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    if args.doc_id:
        if args.section:
            text = get_section_text(args.doc_id, args.node_id or "")
            print(text or "Node not found")
        else:
            overview = get_document_overview(args.doc_id)
            print(overview or f"Document not found: {args.doc_id}")
        return

    tickers = None
    if args.all:
        tickers = None
    elif args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",")]

    results = search(
        args.query,
        tickers=tickers,
        max_results=args.max_results,
        use_reasoning=not args.no_reasoning,
    )

    if args.json:
        output = {
            "query": args.query,
            "tickers": tickers,
            "count": len(results),
            "results": results,
        }
        print(json_mod.dumps(output, indent=2))
    else:
        print(f"Search: '{args.query}' | tickers: {tickers or 'all'} | results: {len(results)}\n")
        for r in results:
            print(f"  [{r['score']:.0f}] {r['doc_name']} / {r['title']} (node: {r['node_id']}, method: {r['method']})")
            print(f"    {r['text_snippet'][:150]}...")
            print()


if __name__ == "__main__":
    main()