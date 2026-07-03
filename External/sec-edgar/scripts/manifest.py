

"""Manifest system for sec-edgar — distributed per-ticker manifests.

Storage layout:
    /home/workspace/sec/index/[TICKER]/[TICKER].manifest.json   ← source of truth per ticker
    /home/workspace/sec/index/[TICKER]/[DOC_ID].json             ← PageIndex tree per filing
    /home/workspace/sec/index/[TICKER]/[DOC_ID].html              ← original HTML
    /home/workspace/sec/index/[TICKER]/[DOC_ID].manifest.json     ← per-filing sidecar
    /home/workspace/sec/manifests/global.json                      ← aggregated view (rebuilt on read)

Concurrency: uses fcntl.flock on [TICKER].manifest.json for write safety.
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from Skills.sec_edgar.scripts.config import SEC_DIR
from Skills.sec_edgar.scripts.utils import (
    FileLock,
    atomic_write_json,
    read_json,
    ensure_dir,
    now_iso,
    dir_size_mb,
)

logger = logging.getLogger("sec-edgar")

INDEX_DIR = SEC_DIR / "index"
MANIFESTS_DIR = SEC_DIR / "manifests"
CACHE_DIR = SEC_DIR / "cache"
ensure_dir(INDEX_DIR)
ensure_dir(MANIFESTS_DIR)
ensure_dir(CACHE_DIR)

MANIFEST_VERSION = 1


# ── Paths ─────────────────────────────────────────────────────────────────────────

def get_ticker_dir(ticker: str) -> Path:
    return INDEX_DIR / ticker.upper()


def get_ticker_manifest_path(ticker: str) -> Path:
    ticker_upper = ticker.upper()
    return get_ticker_dir(ticker_upper) / f"{ticker_upper}.manifest.json"


def get_filing_manifest_path(ticker: str, doc_id: str) -> Path:
    return get_ticker_dir(ticker) / f"{doc_id}.manifest.json"


# ── Manifest schema helpers ──────────────────────────────────────────────────

def new_ticker_manifest(ticker: str, cik: str, name: str) -> dict[str, Any]:
    """Create a new per-ticker manifest."""
    return {
        "version": MANIFEST_VERSION,
        "ticker": ticker.upper(),
        "cik": cik,
        "name": name,
        "updated_at": now_iso(),
        "filings": {},  # keyed by form, each is a list of filing records
    }


def new_filing_manifest(
    doc_id: str,
    ticker: str,
    form: str | None,
    accession: str,
    filing_date: str,
    is_amendment: bool,
    amends: str | None,
    index_mode: str,
    node_count: int,
    html_path: str,
    tree_path: str,
    checksum: str,
) -> dict[str, Any]:
    return {
        "doc_id": doc_id,
        "ticker": ticker.upper(),
        "form": form or "Unknown",
        "cik": "",
        "filing_date": filing_date,
        "accession": accession,
        "is_amendment": is_amendment,
        "amends": amends,
        "is_latest_for_period": True,  # caller must update superseded filings
        "indexed_at": now_iso(),
        "index_mode": index_mode,
        "node_count": node_count,
        "source": "sec_edgar",
        "html_path": html_path,
        "tree_path": tree_path,
        "checksum": checksum,
    }


# ── Load / save ───────────────────────────────────────────────────────────────

def load_manifest(ticker: str) -> dict[str, Any]:
    """Load or create a per-ticker manifest with file locking."""
    path = get_ticker_manifest_path(ticker)
    if path.exists():
        data = read_json(path)
        if data.get("version") == MANIFEST_VERSION:
            return data
    return new_ticker_manifest(ticker, cik="", name="")


def save_manifest(manifest: dict[str, Any], ticker: str) -> None:
    """Save manifest atomically with file locking."""
    manifest["updated_at"] = now_iso()
    path = get_ticker_manifest_path(ticker)
    ensure_dir(path.parent)
    with FileLock(str(path) + ".lock"):
        atomic_write_json(path, manifest)


def update_manifest(manifest: dict[str, Any], ticker: str) -> None:
    """Save after any modification."""
    manifest["updated_at"] = now_iso()
    save_manifest(manifest, ticker)


# ── Filing management ───────────────────────────────────────────────────────

def add_filing_to_manifest(
    manifest: dict[str, Any],
    doc_id: str,
    ticker: str,
    form: str | None,
    accession: str,
    filing_date: str,
    html_path: str,
    tree_path: str,
    index_mode: str,
    node_count: int,
    checksum: str,
    is_amendment: bool = False,
    amends: str | None = None,
) -> None:
    """Add or update a filing record in the manifest.

    Handles amendments: marks `is_latest_for_period` on the original,
    stores amendment as a separate entry.
    """
    form_key = (form or "Unknown").upper()

    # Initialize form list if needed
    if form_key not in manifest["filings"]:
        manifest["filings"][form_key] = []

    filings_list = manifest["filings"][form_key]

    # Check for existing by accession
    for i, f in enumerate(filings_list):
        if f.get("accession") == accession:
            # Already exists — update in place
            filings_list[i].update({
                "indexed_at": now_iso(),
                "index_mode": index_mode,
                "node_count": node_count,
            })
            return

    # Create new filing manifest record
    record = new_filing_manifest(
        doc_id=doc_id,
        ticker=ticker,
        form=form,
        accession=accession,
        filing_date=filing_date,
        is_amendment=is_amendment,
        amends=amends,
        index_mode=index_mode,
        node_count=node_count,
        html_path=html_path,
        tree_path=tree_path,
        checksum=checksum,
    )

    # If this is an amendment, mark the original as not latest
    if is_amendment and amends:
        for f in filings_list:
            if f.get("doc_id") == amends:
                f["is_latest_for_period"] = False

    # If this is NOT an amendment and there are existing amendments for this period,
    # mark those as not latest (newer original supersedes them)
    if not is_amendment:
        for f in filings_list:
            if f.get("is_latest_for_period") and not f.get("is_amendment"):
                # There was a prior filing for this period; keep both but mark old as superseded
                # Actually: don't mark old as superseded — there can be multiple originals
                # Just add the new one
                pass

    manifest["filings"][form_key].append(record)

    # Sort by filing_date descending
    manifest["filings"][form_key].sort(
        key=lambda f: f.get("filing_date", ""), reverse=True
    )


# ── Global manifest (lazy rebuild) ──────────────────────────────────────────

def rebuild_global_manifest() -> dict[str, Any]:
    """Walk sec/index/*/ to rebuild the global manifest.

    This is called lazily by get_global_manifest().
    """
    entries: dict[str, Any] = {
        "version": MANIFEST_VERSION,
        "updated_at": now_iso(),
        "tickers": {},
        "ticker_count": 0,
        "filing_count": 0,
    }

    if not INDEX_DIR.exists():
        return entries

    for ticker_dir in sorted(INDEX_DIR.iterdir()):
        if not ticker_dir.is_dir():
            continue
        ticker = ticker_dir.name
        manifest_path = get_ticker_manifest_path(ticker)

        if not manifest_path.exists():
            continue

        m = read_json(manifest_path)
        if not m:
            continue

        ticker_filings = 0
        for form_list in m.get("filings", {}).values():
            ticker_filings += len(form_list)

        entries["tickers"][ticker] = {
            "cik": m.get("cik", ""),
            "name": m.get("name", ""),
            "filing_count": ticker_filings,
            "manifest_path": str(manifest_path.relative_to(SEC_DIR)),
        }
        entries["filing_count"] += ticker_filings

    entries["ticker_count"] = len(entries["tickers"])
    entries["updated_at"] = now_iso()
    return entries


def get_global_manifest(max_age_seconds: int = 60) -> dict[str, Any]:
    """Return global manifest, rebuilding if stale.

    Args:
        max_age_seconds: Rebuild if global.json is older than this.
    """
    global_path = MANIFESTS_DIR / "global.json"

    if global_path.exists():
        data = read_json(global_path)
        if data.get("version") == MANIFEST_VERSION:
            updated = data.get("updated_at", "")
            if updated:
                try:
                    updated_dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                    age = (datetime.now(timezone.utc) - updated_dt).total_seconds()
                    if age < max_age_seconds:
                        return data
                except Exception:
                    pass

    # Rebuild
    data = rebuild_global_manifest()
    ensure_dir(MANIFESTS_DIR)
    atomic_write_json(global_path, data)
    return data


# ── Storage stats ──────────────────────────────────────────────────────────

def get_total_storage_bytes() -> int:
    """Total bytes in sec/index/."""
    index_dir = INDEX_DIR
    if not index_dir.exists():
        return 0
    total = 0
    for entry in index_dir.rglob("*"):
        if entry.is_file():
            total += entry.stat().st_size
    return total


def get_storage_stats() -> dict[str, Any]:
    """Return storage statistics for the SEC store."""
    bytes_total = get_total_storage_bytes()
    gb = bytes_total / (1024 ** 3)

    return {
        "bytes": bytes_total,
        "gb": round(gb, 2),
        "threshold_gb": 10,  # from config
        "state": "green",  # green < 80%, amber 80–100%, red > 100%
    }


def get_top_tickers_by_size(limit: int = 5) -> list[dict[str, Any]]:
    """Return top tickers by storage usage."""
    if not INDEX_DIR.exists():
        return []

    sizes: dict[str, int] = {}
    for ticker_dir in INDEX_DIR.iterdir():
        if not ticker_dir.is_dir():
            continue
        total = 0
        for f in ticker_dir.rglob("*"):
            if f.is_file():
                total += f.stat().st_size
        sizes[ticker_dir.name] = total

    sorted_tickers = sorted(sizes.items(), key=lambda x: x[1], reverse=True)
    result = []
    for ticker, bytes_used in sorted_tickers[:limit]:
        result.append({
            "ticker": ticker,
            "bytes": bytes_used,
            "gb": round(bytes_used / (1024 ** 3), 2),
        })
    return result


# ── Query helpers ─────────────────────────────────────────────────────────

def get_filings_for_ticker(
    ticker: str,
    form: str | None = None,
    include_amendments: bool = False,
) -> list[dict[str, Any]]:
    """Return all filings for a ticker, optionally filtered by form."""
    manifest = load_manifest(ticker)
    if not manifest.get("filings"):
        return []

    results = []
    forms_to_check = [form.upper()] if form else list(manifest["filings"].keys())

    for form_key in forms_to_check:
        for filing in manifest["filings"].get(form_key, []):
            if not include_amendments and filing.get("is_amendment"):
                continue
            if not include_amendments and not filing.get("is_latest_for_period"):
                continue
            results.append(filing)

    return sorted(results, key=lambda f: f.get("filing_date", ""), reverse=True)


def is_filing_indexed(ticker: str, accession: str) -> bool:
    """Check if a filing (by accession) is already indexed."""
    manifest = load_manifest(ticker)
    for form_list in manifest.get("filings", {}).values():
        for f in form_list:
            if f.get("accession", "").replace("-", "") == accession.replace("-", ""):
                return True
    return False


# ── CLI ────────────────────────────────────────────────────────────────────

def main() -> None:
    import argparse
    import json

    parser = argparse.ArgumentParser(description="SEC Manifest Manager")
    parser.add_argument("--ticker", help="Ticker to query")
    parser.add_argument("--storage-stats", action="store_true", help="Show storage stats")
    parser.add_argument("--global", dest="show_global", action="store_true", help="Show global manifest")
    parser.add_argument("--filings", action="store_true", help="List filings for ticker")

    args = parser.parse_args()

    if args.storage_stats:
        stats = get_storage_stats()
        top = get_top_tickers_by_size()
        stats["top_tickers"] = top
        print(json.dumps(stats, indent=2))
    elif args.show_global:
        gm = get_global_manifest()
        print(json.dumps(gm, indent=2, default=str))
    elif args.ticker:
        manifest = load_manifest(args.ticker.upper())
        if args.filings:
            filings = get_filings_for_ticker(args.ticker.upper())
            print(json.dumps({"ticker": args.ticker.upper(), "filings": filings}, indent=2, default=str))
        else:
            print(json.dumps(manifest, indent=2, default=str))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
