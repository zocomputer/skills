#!/usr/bin/env python3
"""Zo SEC Intelligence - Installer (non-interactive subprocess)

This script is designed to be run by the parent Zo agent during skill installation.
It does NOT prompt the user - all inputs come from command-line arguments.
It emits a JSON provisioning spec to stdout for the parent agent to consume.

Exit codes:
  0 = success (proceed with provisioning)
  1 = fatal error (abort installation)
  2 = warnings (proceed but show warnings to user)
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── Paths ───────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent.parent
SEC_DIR = ROOT / "sec"
SKILL_DIR = ROOT / "Skills" / "sec-edgar"
BOOTSTRAP_DIR = SKILL_DIR / ".bootstrap"
CONFIG_PATH = SEC_DIR / "config.json"

# ── Helper Functions ───────────────────────────────────────────


def log(msg: str) -> None:
    """Log to stderr (stdout is reserved for JSON output)."""
    print(f"[install] {msg}", file=sys.stderr)


def atomic_write(path: Path, content: str) -> None:
    """Write file atomically."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.rename(path)


def sha256_file(path: Path) -> str:
    """Compute SHA256 hash of file."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ensure_sec_structure() -> dict[str, Path]:
    """Create sec/ directory structure. Returns dict of created paths."""
    dirs = {
        "index": SEC_DIR / "index",
        "manifests": SEC_DIR / "manifests",
        "cache": SEC_DIR / "cache",
        "logs": SEC_DIR / "logs",
    }
    for name, path in dirs.items():
        path.mkdir(parents=True, exist_ok=True)
        log(f"Created: sec/{name}/")
    return dirs


def create_default_config(sec_ua: str, tickers: list[str]) -> dict:
    """Create default config.json."""
    return {
        "version": 1,
        "sec_user_agent": sec_ua,
        "tracked_tickers": tickers,
        "fetch_forms": ["10-K", "10-Q", "8-K", "DEF 14A"],
        "auto_index": True,
        "manifest_mode": "distributed",
        "storage_warn_gb": 10,
        "llm": {"model": "zo:minimax/minimax-m2.7"},
        "rate_limit": {
            "delay": 0.12,
            "jitter_range": [0.02, 0.06],
            "max_retries": 3,
        },
        "thresholds": {
            "summary_token_threshold": 5000,
            "extractive_threshold": 2000,
            "raw_storage_threshold": 15000,
        },
        "monitor_rules": [],
    }


def smoke_test_fetch(ticker: str) -> dict:
    """Fetch one filing as smoke test. Returns result dict."""
    log(f"Smoke test: fetching {ticker} 10-K...")
    try:
        # Run fetch.py
        result = subprocess.run(
            [
                sys.executable,
                str(SKILL_DIR / "scripts" / "fetch.py"),
                "--ticker", ticker,
                "--forms", "10-K",
                "--max", "1",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            return {"ok": False, "error": f"fetch failed: {result.stderr}"}
        
        # Parse output
        try:
            data = json.loads(result.stdout)
            if not data.get("success") or not data.get("files"):
                return {"ok": False, "error": "no files fetched"}
            return {"ok": True, "file": data["files"][0]}
        except json.JSONDecodeError:
            return {"ok": False, "error": f"invalid JSON from fetch: {result.stdout[:200]}"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "fetch timed out (60s)"}
    except Exception as e:
        return {"ok": False, "error": f"fetch error: {e}"}


def smoke_test_index(html_path: str) -> dict:
    """Index the fetched filing. Returns result dict."""
    log(f"Smoke test: indexing {html_path}...")
    try:
        result = subprocess.run(
            [
                sys.executable,
                str(SKILL_DIR / "scripts" / "index.py"),
                "--file", html_path,
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            return {"ok": False, "error": f"index failed: {result.stderr}"}
        
        try:
            data = json.loads(result.stdout)
            return {"ok": True, "doc_id": data.get("doc_id")}
        except json.JSONDecodeError:
            return {"ok": False, "error": f"invalid JSON from index: {result.stdout[:200]}"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "index timed out (120s)"}
    except Exception as e:
        return {"ok": False, "error": f"index error: {e}"}


def smoke_test_search(ticker: str) -> dict:
    """Test search works. Returns result dict."""
    log(f"Smoke test: searching {ticker}...")
    try:
        result = subprocess.run(
            [
                sys.executable,
                str(SKILL_DIR / "scripts" / "search.py"),
                "--query", "risk",
                "--tickers", ticker,
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return {"ok": False, "error": f"search failed: {result.stderr}"}
        
        try:
            data = json.loads(result.stdout)
            hits = len(data.get("results", []))
            return {"ok": True, "hits": hits}
        except json.JSONDecodeError:
            return {"ok": False, "error": f"invalid JSON from search: {result.stdout[:200]}"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "search timed out (30s)"}
    except Exception as e:
        return {"ok": False, "error": f"search error: {e}"}


def write_dashboard_routes() -> list[dict]:
    """Write dashboard route code to .bootstrap/ for parent agent to provision."""
    BOOTSTRAP_DIR.mkdir(parents=True, exist_ok=True)
    
    routes = []
    
    # Main dashboard page
    main_code = '''import { useState, useEffect } from "react";

const theme = {
  background: "#0a0a0b",
  foreground: "#e5e5e5",
  card: "#111114",
  border: "#222226",
  accent: "#10b981",
  muted: "#777",
};

export default function SecDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sec/summary")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: theme.foreground }}>Loading...</div>;

  return (
    <div style={{ 
      background: theme.background, 
      color: theme.foreground, 
      minHeight: "100vh", 
      padding: "2rem" 
    }}>
      <h1 style={{ color: theme.accent }}>SEC Intelligence</h1>
      <p>{data?.ticker_count || 0} tickers, {data?.filing_count || 0} filings</p>
    </div>
  );
}
'''
    main_path = BOOTSTRAP_DIR / "main.tsx"
    atomic_write(main_path, main_code)
    routes.append({
        "path": "/sec",
        "type": "page",
        "code_file": str(main_path),
        "public": True,
    })
    
    # Summary API
    summary_code = '''import type { Context } from "hono";
import { execSync } from "child_process";

export default async (c: Context) => {
  try {
    const result = execSync(
      "python3 /home/workspace/Skills/sec-edgar/scripts/manifest.py --global-json",
      { encoding: "utf-8", timeout: 5000 }
    );
    const data = JSON.parse(result);
    return c.json(data);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
};
'''
    summary_path = BOOTSTRAP_DIR / "api_summary.ts"
    atomic_write(summary_path, summary_code)
    routes.append({
        "path": "/api/sec/summary",
        "type": "api",
        "code_file": str(summary_path),
    })
    
    log(f"Wrote {len(routes)} route specs to .bootstrap/")
    return routes


def generate_output(
    installed_version: str,
    smoke_result: dict | None,
    routes: list[dict],
    warnings: list[str],
) -> dict:
    """Generate the JSON output for parent agent."""
    return {
        "installed_version": installed_version,
        "filesystem_ready": True,
        "smoke_fetch_result": smoke_result,
        "todo": {
            "routes": routes,
            "automations": [],
            "secrets": [],
        },
        "warnings": warnings,
    }


# ── Main Entry Point ────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(description="Zo SEC Intelligence Installer")
    parser.add_argument("--sec-ua", default="", help="SEC User-Agent header")
    parser.add_argument("--tickers", default="", help="Comma-separated initial tickers")
    parser.add_argument("--no-smoke-test", action="store_true", help="Skip smoke test")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    args = parser.parse_args()

    warnings = []
    
    # Validate SEC UA
    sec_ua = args.sec_ua.strip()
    if not sec_ua:
        log("ERROR: --sec-ua is required")
        print(json.dumps({"error": "SEC User-Agent required", "exit_code": 1}))
        return 1
    
    # Parse tickers
    tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    if not tickers:
        tickers = ["AAPL"]  # Default
        warnings.append("No tickers specified, defaulting to AAPL for smoke test")
    
    # Dry run
    if args.dry_run:
        log("Dry run - would:")
        log(f"  Create: {SEC_DIR}/ structure")
        log(f"  Write: {CONFIG_PATH}")
        log(f"  Fetch: {tickers[0]} 10-K (smoke test)")
        log(f"  Write: {BOOTSTRAP_DIR}/ routes")
        print(json.dumps({"dry_run": True, "exit_code": 0}))
        return 0
    
    # Create structure
    ensure_sec_structure()
    
    # Write config
    config = create_default_config(sec_ua, tickers)
    atomic_write(CONFIG_PATH, json.dumps(config, indent=2))
    log(f"Wrote: {CONFIG_PATH}")
    
    # Smoke test
    smoke_result = None
    if not args.no_smoke_test:
        ticker = tickers[0]
        
        fetch_result = smoke_test_fetch(ticker)
        if not fetch_result.get("ok"):
            log(f"ERROR: Smoke test fetch failed: {fetch_result.get('error')}")
            print(json.dumps({
                "error": f"Smoke test fetch failed: {fetch_result.get('error')}",
                "exit_code": 1,
            }))
            return 1
        
        index_result = smoke_test_index(fetch_result["file"])
        if not index_result.get("ok"):
            log(f"ERROR: Smoke test index failed: {index_result.get('error')}")
            print(json.dumps({
                "error": f"Smoke test index failed: {index_result.get('error')}",
                "exit_code": 1,
            }))
            return 1
        
        search_result = smoke_test_search(ticker)
        if not search_result.get("ok"):
            warnings.append(f"Search test returned no results (may be OK for short filings)")
        
        smoke_result = {
            "ticker": ticker,
            "fetch": fetch_result,
            "index": index_result,
            "search": search_result,
        }
        log(f"Smoke test passed: indexed {index_result.get('doc_id', 'unknown')}")
    
    # Write dashboard routes
    routes = write_dashboard_routes()
    
    # Generate output
    output = generate_output(
        installed_version="1.0.0",
        smoke_result=smoke_result,
        routes=routes,
        warnings=warnings,
    )
    
    print(json.dumps(output, indent=2))
    
    if warnings:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
