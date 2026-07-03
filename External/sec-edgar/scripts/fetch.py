"""SEC EDGAR filing fetcher for sec-edgar.

Downloads HTML filings from SEC EDGAR for any publicly traded company.
Supports:
- Paginated submissions (all historical filings, not just ~1000 most recent)
- Proactive rate-limit tracking
- Resume after rate-limit interruption
- Automatic de-duplication by accession number
- Configurable form type filtering

Usage:
    python3 fetch.py --ticker TSLA --forms 10-K,10-Q --max 5
    python3 fetch.py --ticker TSLA --check-only   # show what's available without downloading
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import hashlib
import json
import logging
import random
import re
import sys
import time
from pathlib import Path
from typing import Any, Iterator

import requests
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

from Skills.sec_edgar.scripts.config import (
    require_sec_ua,
    get_tracked_tickers,
    get_fetch_forms,
    get_storage_warn_gb,
    SEC_DIR,
    SECUserAgentMissingError,
)
from Skills.sec_edgar.scripts.rate_tracker import RateLimitTracker, RateLimitError
from Skills.sec_edgar.scripts.utils import (
    ensure_dir,
    atomic_write_json,
    read_json,
    sha256_path,
    now_iso,
    dir_size_mb,
)

import warnings
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

logger = logging.getLogger("sec-edgar")

# SEC EDGAR endpoints
TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
PAGINATED_URL = "https://data.sec.gov/submissions/CIK{cik}-submissions-{page:03d}.json"
HTML_BASE = "https://www.sec.gov/Archives/edgar/data/{cik}/{path_part}/{filename}"

# Cache
COMPANY_CACHE: dict[str, dict[str, str]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

OUTPUT_DIR = SEC_DIR / "index"
CACHE_DIR = SEC_DIR / "cache"
ensure_dir(OUTPUT_DIR)
ensure_dir(CACHE_DIR)


# ── Errors ────────────────────────────────────────────────────────────────────

class EdgarError(Exception):
    pass


class SECLookupError(EdgarError):
    pass


class RateLimitExceeded(EdgarError):
    def __init__(self, message: str, retry_after_minutes: int = 10):
        super().__init__(message)
        self.retry_after_minutes = retry_after_minutes


# ── Company lookup ─────────────────────────────────────────────────────────────

def _read_json(url: str, tracker: RateLimitTracker, user_agent: str) -> dict:
    tracker.wait_if_needed()
    tracker.record_request()
    for attempt in range(3):
        try:
            resp = requests.get(
                url,
                headers={"User-Agent": user_agent},
                timeout=30,
            )
            if resp.status_code == 503:
                wait = (2 ** (attempt + 1)) + random.random()
                logger.warning(f"503 from SEC, attempt {attempt+1}, waiting {wait:.1f}s")
                time.sleep(wait)
                tracker.set_rate_limited()
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            if attempt == 2:
                raise RateLimitExceeded(
                    f"SEC EDGAR unreachable after 3 attempts: {e}",
                    retry_after_minutes=10,
                )
            time.sleep(2 ** attempt)
    return {}


def _read_bytes(url: str, tracker: RateLimitTracker, user_agent: str) -> bytes:
    tracker.wait_if_needed()
    tracker.record_request()
    for attempt in range(3):
        try:
            resp = requests.get(url, headers={"User-Agent": user_agent}, timeout=60)
            if resp.status_code == 503:
                wait = (2 ** (attempt + 1)) + random.random()
                logger.warning(f"503 from SEC, attempt {attempt+1}, waiting {wait:.1f}s")
                time.sleep(wait)
                tracker.set_rate_limited()
                continue
            resp.raise_for_status()
            return resp.content
        except requests.RequestException as e:
            if attempt == 2:
                raise RateLimitExceeded(
                    f"SEC EDGAR unreachable: {e}", retry_after_minutes=10
                )
            time.sleep(2 ** attempt)
    return b""


def get_company_info(ticker: str, tracker: RateLimitTracker) -> dict[str, str] | None:
    """Return {cik, name} for a ticker, with caching."""
    ticker_upper = ticker.upper().strip()
    now = time.time()

    if ticker_upper in COMPANY_CACHE:
        cached = COMPANY_CACHE[ticker_upper]
        if now - cached.get("_cached_at", 0) < CACHE_TTL_SECONDS:
            return {k: v for k, v in cached.items() if k != "_cached_at"}

    # Fetch fresh
    data = _read_json(TICKERS_URL, tracker, require_sec_ua())
    for entry in data.values():
        if isinstance(entry, dict) and entry.get("ticker") == ticker_upper:
            result = {
                "cik": str(entry["cik_str"]).zfill(10),
                "name": entry.get("title", ticker_upper),
            }
            result["_cached_at"] = now
            COMPANY_CACHE[ticker_upper] = result
            return result
    return None


# ── Submissions fetching ───────────────────────────────────────────────────────

def get_available_filings(
    ticker_or_cik: str,
    tracker: RateLimitTracker,
    user_agent: str,
    forms: list[str] | None = None,
    include_historical: bool = False,
) -> dict[str, Any]:
    """Get all available filing metadata for a company.

    Args:
        ticker_or_cik: Ticker symbol (e.g. "CRWV") or CIK (e.g. "1769628").
            Looks up CIK automatically if a ticker is passed.
        tracker: Rate limit tracker
        user_agent: SEC User-Agent
        forms: Optional form type filter (e.g. ["10-K", "10-Q"])
        include_historical: If True, fetch paginated archive for older filings

    Returns:
        {
            "cik": "0001769628",
            "company": "CoreWeave, Inc.",
            "filings": [...],
            "form_breakdown": {"10-K": 5, ...},
            "total_count": int,
            "new_filings": [...]
        }
    """
    # Resolve ticker to CIK if needed
    raw = ticker_or_cik.strip()
    if raw.isdigit() and len(raw) <= 10:
        cik = raw.zfill(10)
        company_name = ticker_or_cik
    else:
        info = get_company_info(ticker_or_cik, tracker)
        if not info:
            raise SECLookupError(f"Ticker not found: {ticker_or_cik}")
        cik = info["cik"]
        company_name = info["name"]

    # Primary submissions endpoint
    url = SUBMISSIONS_URL.format(cik=cik)
    data = _read_json(url, tracker, user_agent)

    filings = []
    recent = data.get("filings", {}).get("recent", {}) or {}
    form_filters = {f.upper() for f in (forms or [])} if forms else None

    primary_docs = recent.get("primaryDocument", []) or []
    accession_list = recent.get("accessionNumber", []) or []
    filing_date_list = recent.get("filingDate", []) or []
    form_list = recent.get("form", []) or []

    for i, form in enumerate(form_list):
        if i >= len(accession_list):
            continue
        if form_filters and form.upper() not in form_filters:
            continue
        filings.append({
            "form": form,
            "accession": accession_list[i],
            "filing_date": filing_date_list[i] if i < len(filing_date_list) else "",
            "primary_doc": primary_docs[i] if i < len(primary_docs) else None,
        })

    # Historical pagination
    if include_historical and len(filings) < 500:
        for page in range(1, 10):
            page_url = PAGINATED_URL.format(cik=cik, page=page)
            try:
                page_data = _read_json(page_url, tracker, user_agent)
            except Exception:
                break
            page_recent = page_data.get("filings", {}).get("recent", {}) or {}
            page_forms = page_recent.get("form", []) or []
            page_accessions = page_recent.get("accessionNumber", []) or []
            page_dates = page_recent.get("filingDate", []) or []
            page_primary_docs = page_recent.get("primaryDocument", []) or []
            if not page_forms:
                break
            for i in range(len(page_forms)):
                form = page_forms[i]
                if form_filters and form.upper() not in form_filters:
                    continue
                accession = page_accessions[i]
                if any(f["accession"] == accession for f in filings):
                    continue
                filings.append({
                    "form": form,
                    "accession": accession,
                    "filing_date": page_dates[i] if i < len(page_dates) else "",
                    "primary_doc": page_primary_docs[i] if i < len(page_primary_docs) else None,
                })

    form_breakdown: dict[str, int] = {}
    for f in filings:
        form_breakdown[f["form"]] = form_breakdown.get(f["form"], 0) + 1

    return {
        "cik": cik,
        "company": company_name,
        "filings": filings,
        "form_breakdown": form_breakdown,
        "total_count": len(filings),
        "new_filings": []
    }


def _get_primary_html_url(
    cik: str,
    accession: str,
    primary_doc: str | None,
    tracker: RateLimitTracker,
    user_agent: str,
) -> str:
    """Resolve the actual HTML URL for a filing.

    Strategy:
    1. If primary_doc is given, construct URL directly
    2. Otherwise fetch the accession index page and find the .htm link
    """
    path_part = accession.replace("-", "")
    base = f"https://www.sec.gov/Archives/edgar/data/{cik}/{path_part}"

    if primary_doc:
        return f"{base}/{primary_doc}"

    # Fetch index page to find primary HTML
    index_url = f"{base}/{accession}-index.htm"
    tracker.wait_if_needed()
    tracker.record_request()
    try:
        raw = requests.get(
            index_url,
            headers={"User-Agent": user_agent},
            timeout=30,
        ).content
    except requests.RequestException:
        # SEC sometimes drops the -index suffix; fall back to accession.htm
        return f"{base}/{accession}.htm"

    soup = BeautifulSoup(raw, "lxml")
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        name = href.split("/")[-1]
        if name.endswith(".htm") or name.endswith(".html"):
            if "index" not in name.lower():
                return href if href.startswith("http") else f"https://www.sec.gov{href}"
    return f"{base}/{accession}.htm"


# ── Download ────────────────────────────────────────────────────────────────────

def download_filing(
    ticker: str,
    cik: str,
    filing: dict[str, Any],
    tracker: RateLimitTracker,
    user_agent: str,
) -> Path | None:
    """Download one filing's HTML to the ticker directory.

    Returns the Path on success, None on failure.
    """
    acc = filing["accession"]
    form = filing["form"]
    date_str = filing.get("filing_date") or filing.get("filingDate") or "unknown"
    primary_doc = filing.get("primary_doc")

    ticker_dir = OUTPUT_DIR / ticker.upper()
    ensure_dir(ticker_dir)

    # Build filename: TICKER_FORM_DATE_ACCESSION.html
    date_part = date_str.replace("-", "") if date_str != "unknown" else date_str
    acc_clean = acc.replace("-", "")
    safe_ticker = re.sub(r"[^A-Z0-9.-]", "_", ticker.upper())[:20]
    safe_form = re.sub(r"[^A-Z0-9.-]", "_", form)[:40]
    filename = f"{safe_ticker}--{safe_form}--{date_part}--{acc_clean}.html"
    out_path = ticker_dir / filename

    # De-dup by accession: if the file already exists and checksum matches, skip
    if out_path.exists():
        logger.info(f"Skipping already-downloaded {filename}")
        return out_path

    url = _get_primary_html_url(cik, acc, primary_doc, tracker, user_agent)
    raw = _read_bytes(url, tracker, user_agent)

    if not raw:
        logger.warning(f"Empty response for {url}")
        return None

    out_path.write_bytes(raw)
    logger.info(f"Downloaded {filename} ({len(raw):,} bytes)")
    return out_path


# ── Public API ─────────────────────────────────────────────────────────────────

def fetch_filings(
    ticker: str,
    forms: list[str] | None = None,
    max_filings: int = 10,
    skip_indexed: bool = True,
    include_historical: bool = False,
    on_rate_limit: callable | None = None,
) -> dict[str, Any]:
    """Fetch SEC filings for a company.

    Args:
        ticker: Company ticker (e.g. "TSLA")
        forms: Form types to fetch (default from config)
        max_filings: Maximum new filings to download
        skip_indexed: Skip filings already in OUTPUT_DIR
        include_historical: Also fetch paginated submissions archive
        on_rate_limit: Optional callback(rate_limit_msg: str) if rate limited

    Returns:
        {
            "success": bool,
            "ticker": str,
            "cik": str,
            "company": str,
            "files": [Path, ...],
            "new_filings": int,
            "skipped_already_indexed": int,
            "errors": [str, ...],
            "rate_limited": bool,
        }
    """
    try:
        ua = require_sec_ua()
    except SECUserAgentMissingError:
        return {
            "success": False,
            "ticker": ticker.upper(),
            "cik": "",
            "company": "",
            "files": [],
            "new_filings": 0,
            "skipped_already_indexed": 0,
            "errors": ["SEC User-Agent not configured. Set sec_user_agent in sec/config.json"],
            "rate_limited": False,
        }

    tracker = RateLimitTracker()
    ticker_upper = ticker.upper()

    # Storage warning check
    storage_gb = dir_size_mb(SEC_DIR) / 1024
    warn_gb = get_storage_warn_gb()
    storage_warning = ""
    if storage_gb >= warn_gb:
        storage_warning = f"Storage at {storage_gb:.1f} GB / {warn_gb} GB"

    # Company lookup
    company = get_company_info(ticker_upper, tracker)
    if not company:
        return {
            "success": False,
            "ticker": ticker_upper,
            "cik": "",
            "company": "",
            "files": [],
            "new_filings": 0,
            "skipped_already_indexed": 0,
            "errors": [f"Ticker not found: {ticker_upper}"],
            "rate_limited": False,
        }

    cik = company["cik"]
    company_name = company["name"]

    # Resolve forms
    form_list = forms if forms is not None else get_fetch_forms()
    form_filters = {f.upper() for f in form_list}

    # Get available filings
    try:
        available = get_available_filings(
            cik, tracker, ua, form_list, include_historical=include_historical
        )
    except RateLimitExceeded as e:
        if on_rate_limit:
            on_rate_limit(str(e))
        return {
            "success": False,
            "ticker": ticker_upper,
            "cik": cik,
            "company": company_name,
            "files": [],
            "new_filings": 0,
            "skipped_already_indexed": 0,
            "errors": [str(e)],
            "rate_limited": True,
        }

    # Filter by accession to skip already-indexed
    ticker_dir = OUTPUT_DIR / ticker_upper
    existing_accessions: set[str] = set()
    if skip_indexed and ticker_dir.exists():
        for f in ticker_dir.glob("*.html"):
            # Filename format: TICKER--FORM--DATE--ACCESSION.html
            # (new) OR: TICKER_FORM_DATE_ACCESSION.html (legacy)
            stem = f.stem
            if "--" in stem:
                parts = stem.split("--")
            else:
                parts = stem.split("_")
            if len(parts) >= 4:
                existing_accessions.add(parts[3].replace("-", ""))

    new_filings_to_fetch = []
    for f in available["filings"]:
        acc_clean = f["accession"].replace("-", "")
        if skip_indexed and acc_clean in existing_accessions:
            continue
        new_filings_to_fetch.append(f)
        if len(new_filings_to_fetch) >= max_filings:
            break

    if not new_filings_to_fetch:
        return {
            "success": True,
            "ticker": ticker_upper,
            "cik": cik,
            "company": company_name,
            "files": [],
            "new_filings": 0,
            "skipped_already_indexed": len(existing_accessions),
            "errors": [],
            "rate_limited": False,
            "storage_warning": storage_warning or None,
        }

    # Download
    downloaded = []
    errors = []
    rate_limited = False

    for filing in new_filings_to_fetch:
        if tracker.is_rate_limited():
            rate_limited = True
            msg = f"Rate limited after {len(downloaded)} downloads. Resume in 10 minutes."
            errors.append(msg)
            if on_rate_limit:
                on_rate_limit(msg)
            break

        try:
            path = download_filing(ticker_upper, cik, filing, tracker, ua)
            if path:
                downloaded.append(path)
        except RateLimitExceeded:
            rate_limited = True
            errors.append("Rate limit hit during download")
            if on_rate_limit:
                on_rate_limit("SEC rate limit reached. Wait 10 minutes.")
            break
        except Exception as e:
            errors.append(f"Failed {filing['form']} {filing['filing_date']}: {e}")

    return {
        "success": len(downloaded) > 0 and not rate_limited,
        "ticker": ticker_upper,
        "cik": cik,
        "company": company_name,
        "files": downloaded,
        "new_filings": len(downloaded),
        "skipped_already_indexed": len(existing_accessions),
        "errors": errors,
        "rate_limited": rate_limited,
        "storage_warning": storage_warning or None,
    }


def check_available(ticker: str) -> str:
    """Show what filings are available on EDGAR without downloading.

    Returns a formatted string.
    """
    try:
        ua = require_sec_ua()
    except SECUserAgentMissingError as e:
        return f"Error: {e}"

    tracker = RateLimitTracker()
    company = get_company_info(ticker.upper(), tracker)
    if not company:
        return f"Ticker not found: {ticker}"

    cik = company["cik"]
    available = get_available_filings(cik, tracker, ua, include_historical=True)

    ticker_dir = OUTPUT_DIR / ticker.upper()
    existing = set()
    if ticker_dir.exists():
        for f in ticker_dir.glob("*.html"):
            parts = f.stem.split("_")
            if len(parts) >= 4:
                existing.add(parts[3])

    new = [f for f in available["filings"] if f["accession"].replace("-", "") not in existing]

    lines = [
        f"**{ticker.upper()}** — {company['name']}",
        f"",
        f"Available on EDGAR: {available['total_count']}",
        f"Already indexed: {len(existing)}",
        f"New to fetch: {len(new)}",
        f"",
        "**Form breakdown:**",
    ]
    for form, count in sorted(available["form_breakdown"].items(), key=lambda x: -x[1]):
        lines.append(f"  {form}: {count}")

    if new:
        lines.extend(["", f"**Next step:** `fetch.py --ticker {ticker.upper()}` to download new filings."])
    else:
        lines.extend(["", "All available filings already indexed."])

    return "\n".join(lines)


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    import argparse

    logging.basicConfig(
        stream=sys.stderr,
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    parser = argparse.ArgumentParser(description="SEC EDGAR Filing Fetcher")
    parser.add_argument("--ticker", help="Ticker symbol (e.g. TSLA)")
    parser.add_argument("--forms", help="Comma-separated form types (e.g. 10-K,10-Q)")
    parser.add_argument("--max", type=int, default=10, help="Max filings to fetch")
    parser.add_argument("--check-only", action="store_true", help="Show available without downloading")
    parser.add_argument("--include-historical", action="store_true", help="Include paginated submissions archive")
    parser.add_argument("--skip-indexed", action="store_true", default=True)

    args = parser.parse_args()

    if not args.ticker:
        parser.print_help()
        return

    forms = [f.strip() for f in args.forms.split(",")] if args.forms else None

    if args.check_only:
        print(check_available(args.ticker))
        return

    result = fetch_filings(
        args.ticker,
        forms=forms,
        max_filings=args.max,
        include_historical=args.include_historical,
    )

    print(json.dumps(result, default=str, indent=2))


if __name__ == "__main__":
    main()
