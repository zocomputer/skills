

"""Check what filings are indexed vs. available on SEC EDGAR for a ticker.

Usage:
    python3 check_indexed.py --ticker TSLA
    python3 check_indexed.py --ticker TSLA --forms 10-K,10-Q
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import argparse
import json
import sys
from pathlib import Path

from Skills.sec_edgar.scripts.config import require_sec_ua, get_fetch_forms
from Skills.sec_edgar.scripts.fetch import get_company_info, get_available_filings
from Skills.sec_edgar.scripts.manifest import get_filings_for_ticker, load_manifest, INDEX_DIR
from Skills.sec_edgar.scripts.rate_tracker import RateLimitTracker


def check_ticker(ticker: str, forms: list[str] | None = None) -> dict:
    """Check indexed vs. available filings for a ticker.

    Returns a dict with:
    - ticker, company, cik
    - indexed: {total, forms: {form: [filings...]}}
    - available: {total, forms: {form: count}}
    - new_filings: [filing info for each not-yet-indexed]
    """
    ticker = ticker.upper()

    # Load local manifest
    manifest_path = INDEX_DIR / ticker / f"{ticker}.manifest.json"
    local_filings = get_filings_for_ticker(ticker, include_amendments=True)
    local_accessions = {f["accession"].replace("-", "").replace("\n", "") for f in local_filings}

    # Resolve forms
    form_filters = forms if forms else get_fetch_forms()

    # Get EDGAR data
    tracker = RateLimitTracker()
    try:
        ua = require_sec_ua()
    except Exception:
        return {
            "ticker": ticker,
            "cik": "",
            "company": "",
            "indexed_count": len(local_filings),
            "available_count": 0,
            "new_filings": [],
            "error": "SEC User-Agent not configured. Set sec_user_agent in sec/config.json",
        }

    company = get_company_info(ticker, tracker)
    if not company:
        return {
            "ticker": ticker,
            "cik": "",
            "company": "",
            "indexed_count": len(local_filings),
            "available_count": 0,
            "new_filings": [],
            "error": f"Ticker not found: {ticker}",
        }

    cik = company["cik"]

    try:
        available = get_available_filings(cik, tracker, ua, form_filters, include_historical=True)
    except Exception as e:
        return {
            "ticker": ticker,
            "cik": cik,
            "company": company["name"],
            "indexed_count": len(local_filings),
            "available_count": 0,
            "new_filings": [],
            "error": str(e),
        }

    # Identify new filings (not locally indexed)
    new_filings = []
    for f in available["filings"]:
        acc_clean = f["accession"].replace("-", "")
        if acc_clean not in local_accessions:
            new_filings.append({
                "form": f["form"],
                "filing_date": f["filing_date"],
                "accession": f["accession"],
            })

    return {
        "ticker": ticker,
        "cik": cik,
        "company": company["name"],
        "indexed_count": len(local_filings),
        "available_count": available["total_count"],
        "form_breakdown": available["form_breakdown"],
        "new_filings_count": len(new_filings),
        "new_filings": new_filings[:20],  # cap at 20 for display
        "indexed_forms": {f: len([x for x in local_filings if x.get("form", "").upper() == f.upper()]) for f in form_filters},
    }


def format_check_output(result: dict) -> str:
    """Format a check result as human-readable string."""
    ticker = result["ticker"]
    company = result.get("company", "")
    cik = result.get("cik", "")
    error = result.get("error")

    if error:
        return f"**{ticker}** — Error: {error}"

    indexed = result["indexed_count"]
    available = result["available_count"]
    new_count = result["new_filings_count"]

    lines = [
        f"**{ticker}** — {company}",
        f"CIK: {cik}",
        f"Indexed: {indexed} filings",
        f"Available on EDGAR: {available} filings",
        f"",
    ]

    if result.get("form_breakdown"):
        lines.append("**Available form breakdown:**")
        for form, count in sorted(result["form_breakdown"].items(), key=lambda x: -x[1]):
            lines.append(f"  {form}: {count}")
        lines.append("")

    if result.get("indexed_forms"):
        lines.append("**Currently indexed by form:**")
        for form, count in result["indexed_forms"].items():
            lines.append(f"  {form}: {count}")
        lines.append("")

    if new_count > 0:
        lines.append(f"**{new_count} new filings available** to fetch:")
        for f in result.get("new_filings", [])[:10]:
            lines.append(f"  {f['form']} — {f['filing_date']} ({f['accession'][:20]}...)")
        if new_count > 10:
            lines.append(f"  ...and {new_count - 10} more")
        lines.append("")
        lines.append(f"**Next step:** `python3 Skills/sec-edgar/scripts/fetch.py --ticker {ticker}` to download new filings")
    else:
        lines.append("✅ All available filings already indexed.")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Check indexed vs. available SEC filings")
    parser.add_argument("--ticker", required=True, help="Ticker symbol")
    parser.add_argument("--forms", help="Comma-separated form types (default: from config)")
    parser.add_argument("--json", dest="as_json", action="store_true", help="Output as JSON")
    parser.add_argument("--check-only", action="store_true", help="Show available without download recommendation")

    args = parser.parse_args()

    forms = [f.strip() for f in args.forms.split(",")] if args.forms else None
    result = check_ticker(args.ticker.upper(), forms)

    if args.as_json:
        print(json.dumps(result, indent=2, default=str))
    else:
        print(format_check_output(result))


if __name__ == "__main__":
    main()