"""Main indexing orchestrator for sec-edgar.

Coordinates: html2md → tree_builder → llm → manifest

Usage:
    python3 index.py --file /path/to/TSLA_10-K_20250128_xxx.html
    python3 index.py --auto          # index all unindexed files in sec/index/*/
    python3 index.py --ticker TSLA    # index all files for TSLA
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import logging
import sys
import re
from pathlib import Path
from typing import Any

from Skills.sec_edgar.scripts.config import (
    get_extractive_threshold,
    get_summary_token_threshold,
    get_raw_storage_threshold,
    get_llm_model,
)
from Skills.sec_edgar.scripts.html2md import html_to_markdown
from Skills.sec_edgar.scripts.tree_builder import markdown_to_tree, _extract_form_type, _should_full_index
from Skills.sec_edgar.scripts.llm import generate_summaries
from Skills.sec_edgar.scripts.manifest import (
    load_manifest,
    add_filing_to_manifest,
    update_manifest,
    get_ticker_dir,
)
from Skills.sec_edgar.scripts.utils import (
    atomic_write_json,
    sha256_path,
    count_tokens,
    now_iso,
    ensure_dir,
)

logger = logging.getLogger("sec-edgar")

SEC_DIR = Path("/home/workspace/sec")


# ── Per-filing indexer ─────────────────────────────────────────────────────────

def index_filing(
    html_path: Path,
    auto_index: bool = True,
    skip_indexed: bool = True,
) -> dict[str, Any]:
    """Index a single HTML filing.

    Steps:
    1. Read HTML
    2. Convert to Markdown (html2md)
    3. Parse form type from filename
    4. Route: full tree or raw single-node
    5. Build tree (tree_builder) — if full tree, attach LLM summaries
    6. Write JSON tree alongside HTML
    7. Update per-ticker manifest

    Args:
        html_path: Path to the .html filing
        auto_index: Whether to auto-index (True for normal use)
        skip_indexed: Skip if JSON already exists (de-dup by accession)

    Returns:
        {
            "doc_id": str,
            "success": bool,
            "error": str | None,
            "tree_path": Path | None,
            "index_mode": "tree" | "raw",
            "node_count": int,
            "llm_calls": int,
            "skipped": bool,
        }
    """
    filename = html_path.name
    ticker = _extract_ticker(filename)
    form_type = _extract_form_type(filename)
    accession = _extract_accession(filename)

    if not ticker:
        return {"doc_id": "", "success": False, "error": f"Cannot parse ticker from {filename}", "tree_path": None, "index_mode": "raw", "node_count": 0, "llm_calls": 0, "skipped": False}

    # Generate doc_id
    doc_id = make_doc_id(filename)
    ticker_dir = get_ticker_dir(ticker)
    json_path = ticker_dir / f"{doc_id}.json"

    # De-dup: if JSON exists, skip
    if skip_indexed and json_path.exists():
        return {"doc_id": doc_id, "success": True, "error": None, "tree_path": json_path, "index_mode": "unknown", "node_count": 0, "llm_calls": 0, "skipped": True}

    # Read HTML
    try:
        html_raw = html_path.read_bytes()
    except OSError as e:
        return {"doc_id": doc_id, "success": False, "error": f"Cannot read HTML: {e}", "tree_path": None, "index_mode": "raw", "node_count": 0, "llm_calls": 0, "skipped": False}

    # HTML → Markdown
    try:
        markdown_str = html_to_markdown(html_path)
    except Exception as e:
        logger.warning(f"html2md failed for {filename}: {e}")
        markdown_str = html_raw.decode("utf-8", errors="replace")

    token_count = count_tokens(markdown_str)
    is_full = _should_full_index(form_type, token_count)

    # Build tree
    if not is_full:
        # Raw single-node storage — no LLM calls, no tree structure
        logger.info(f"Raw-storing {filename} (form={form_type}, {token_count} tokens)")
        tree_data = {
            "doc_name": html_path.stem,
            "doc_description": f"{form_type or 'Unknown'} filing (raw-stored)",
            "index_mode": "raw",
            "structure": [{
                "node_id": "0000",
                "title": html_path.stem,
                "summary": markdown_str[:300],
                "text": markdown_str,
            }],
        }
        node_count = 1
        llm_calls = 0
    else:
        # Full tree indexing
        logger.info(f"Full tree indexing {filename} (form={form_type}, {token_count} tokens)")
        tree_data = markdown_to_tree(
            markdown_str,
            doc_name=html_path.stem,
            extractive_threshold=get_extractive_threshold(),
            thinning_threshold=0,  # thinnning is config-driven
        )

        # Generate summaries via batched /zo/ask
        structure = tree_data["structure"]
        node_count = _count_nodes(structure)
        summary_map = {}
        llm_calls = 0

        try:
            summary_map = generate_summaries(
                structure,
                doc_name=tree_data["doc_name"],
                summary_token_threshold=get_summary_token_threshold(),
                extractive_threshold=get_extractive_threshold(),
            )
            llm_calls = 1 if summary_map else 0
        except Exception as e:
            logger.warning(f"LLM summarization failed for {filename}: {e}")
            # Fall back: raw text summaries for large nodes
            summary_map = {}

        # Apply summaries to tree
        from Skills.sec_edgar.scripts.tree_builder import apply_summaries as _apply_summaries
        tree_data["structure"] = _apply_summaries(
            structure,
            summary_map,
            extractive_threshold=get_extractive_threshold(),
        )

    # Wrap in the format expected by tree_store / search
    store_record = {"tree": tree_data}
    try:
        ensure_dir(ticker_dir)
        atomic_write_json(json_path, store_record)
    except Exception as e:
        return {"doc_id": doc_id, "success": False, "error": f"Cannot write tree: {e}", "tree_path": None, "index_mode": tree_data.get("index_mode", "raw"), "node_count": node_count, "llm_calls": llm_calls, "skipped": False}

    # Update manifest
    try:
        manifest = load_manifest(ticker)
        add_filing_to_manifest(
            manifest,
            doc_id=doc_id,
            ticker=ticker,
            form=form_type,
            accession=accession,
            filing_date=_extract_date(filename),
            html_path=str(html_path),
            tree_path=str(json_path),
            index_mode=tree_data.get("index_mode", "raw"),
            node_count=node_count,
            checksum=f"sha256:{sha256_path(html_path)}",
            is_amendment=_is_amendment(form_type),
        )
        update_manifest(manifest, ticker)
    except Exception as e:
        logger.warning(f"Manifest update failed for {doc_id}: {e}")

    return {
        "doc_id": doc_id,
        "success": True,
        "error": None,
        "tree_path": json_path,
        "index_mode": tree_data.get("index_mode", "raw"),
        "node_count": node_count,
        "llm_calls": llm_calls,
        "skipped": False,
    }


def _extract_ticker(filename: str) -> str | None:
    """Parse ticker from SEC-style filename.

    Supports:
      - New: TICKER--FORM--...  (e.g. TSLA--10-K--...)
      - Legacy: TICKER_FORM_...  (e.g. TSLA_10-K_...)
    """
    stem = Path(filename).stem
    if "--" in stem:
        return stem.split("--")[0]
    return stem.split("_")[0]


def _extract_accession(filename: str) -> str:
    """Parse accession number from SEC-style filename.

    Supports new (--) and legacy (_) formats.
    Returns clean accession (no .html, no dashes).
    """
    stem = Path(filename).stem
    if "--" in stem:
        parts = stem.split("--")
    else:
        parts = stem.split("_")
    if len(parts) >= 4:
        acc = parts[3]
        return acc.replace("-", "").replace(".html", "")
    return ""


def _extract_date(filename: str) -> str:
    """Parse filing date from SEC-style filename.

    Supports new (--) and legacy (_) formats.
    Returns YYYY-MM-DD or empty string.
    """
    stem = Path(filename).stem
    if "--" in stem:
        parts = stem.split("--")
    else:
        parts = stem.split("_")
    if len(parts) >= 3:
        date_str = parts[2]
        if date_str == "unknown":
            return ""
        if len(date_str) == 8 and date_str.isdigit():
            return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    return ""


def _is_amendment(form: str | None) -> bool:
    if not form:
        return False
    return form.upper().endswith("/A") or "/A" in form.upper()


def _count_nodes(structure: list[dict]) -> int:
    count = 0
    for node in structure:
        count += 1
        if node.get("nodes"):
            count += _count_nodes(node["nodes"])
    return count


def make_doc_id(filename: str) -> str:
    """doc_id = filename stem (ticker--form--date--accession), no hash."""
    return Path(filename).stem


# ── Batch indexing ─────────────────────────────────────────────────────────────

def index_all_in_ticker_dir(ticker: str) -> list[dict[str, Any]]:
    """Index all unindexed HTML files in a ticker's directory."""
    ticker_dir = get_ticker_dir(ticker)
    if not ticker_dir.exists():
        return []

    results = []
    for html_path in sorted(ticker_dir.glob("*.html")):
        json_path = html_path.with_suffix(".json")
        if json_path.exists():
            continue  # skip already indexed
        result = index_filing(html_path)
        results.append(result)
        logger.info(f"Indexed {html_path.name}: mode={result['index_mode']}, nodes={result['node_count']}")

    return results


def index_auto() -> list[dict[str, Any]]:
    """Index all unindexed HTML files across all tickers."""
    all_results = []
    index_dir = SEC_DIR / "index"
    if not index_dir.exists():
        return []

    for ticker_dir in index_dir.iterdir():
        if ticker_dir.is_dir():
            results = index_all_in_ticker_dir(ticker_dir.name)
            all_results.extend(results)

    return all_results


# ── CLI ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    import argparse
    import json

    logging.basicConfig(
        stream=sys.stderr,
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    parser = argparse.ArgumentParser(description="SEC Filing Indexer")
    parser.add_argument("--file", help="Index a specific HTML file")
    parser.add_argument("--ticker", help="Index all files for a ticker")
    parser.add_argument("--auto", action="store_true", help="Index all unindexed files in sec/index/*/")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.file:
        result = index_filing(Path(args.file))
        print(json.dumps(result, default=str, indent=2))
    elif args.ticker:
        results = index_all_in_ticker_dir(args.ticker.upper())
        print(json.dumps({"ticker": args.ticker.upper(), "indexed": len(results), "results": results}, default=str, indent=2))
    elif args.auto:
        results = index_auto()
        print(json.dumps({"total_indexed": len(results), "results": results}, default=str, indent=2))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
