#!/usr/bin/env python3
"""Post-install health check for Zo SEC Intelligence.

Checks:
1. Filesystem: sec/ directory structure exists
2. Config: valid JSON with required fields
3. Dashboard routes: routes are accessible
4. MiniMax model: reachable via /zo/ask
5. EDGAR reachability: can reach SEC servers
6. Storage: within limits

Exit codes:
  0 = all checks passed
  1 = critical issues found
"""

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent.parent
SEC_DIR = ROOT / "sec"
CONFIG_PATH = SEC_DIR / "config.json"

# ── Checks ─────────────────────────────────────────────────────


def check_filesystem() -> tuple[bool, list[str]]:
    """Check sec/ directory structure."""
    issues = []
    required_dirs = ["index", "manifests", "cache", "logs"]
    
    for name in required_dirs:
        path = SEC_DIR / name
        if not path.exists():
            issues.append(f"Missing: sec/{name}/")
    
    return len(issues) == 0, issues


def check_config() -> tuple[bool, list[str]]:
    """Check config.json is valid."""
    issues = []
    
    if not CONFIG_PATH.exists():
        return False, ["Missing: sec/config.json"]
    
    try:
        config = json.loads(CONFIG_PATH.read_text())
        
        if not config.get("sec_user_agent"):
            issues.append("Config missing: sec_user_agent")
        
        if not config.get("tracked_tickers"):
            issues.append("Config missing: tracked_tickers (can be empty list)")
        
    except json.JSONDecodeError as e:
        issues.append(f"Config invalid JSON: {e}")
    
    return len(issues) == 0, issues


def check_routes() -> tuple[bool, list[str]]:
    """Check zo.space routes are accessible."""
    issues = []
    
    try:
        # Check local dev server
        req = urllib.request.Request("http://localhost:3099/api/sec/summary")
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status != 200:
                issues.append(f"API route returned {resp.status}")
    except Exception as e:
        issues.append(f"Cannot reach local API: {e}")
    
    return len(issues) == 0, issues


def check_model() -> tuple[bool, list[str]]:
    """Check MiniMax model is reachable."""
    issues = []
    
    try:
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "Skills" / "sec-edgar" / "scripts" / "llm.py"),
                "--verify-model",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            issues.append(f"Model verification failed: {result.stderr[:100]}")
    except Exception as e:
        issues.append(f"Model check error: {e}")
    
    return len(issues) == 0, issues


def check_edgar() -> tuple[bool, list[str]]:
    """Check SEC EDGAR is reachable."""
    issues = []
    
    try:
        config = json.loads(CONFIG_PATH.read_text())
        user_agent = config.get("sec_user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        req = urllib.request.Request(
            "https://www.sec.gov/",
            headers={"User-Agent": user_agent},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                issues.append(f"SEC EDGAR returned {resp.status}")
    except Exception as e:
        issues.append(f"Cannot reach SEC EDGAR: {e}")
    
    return len(issues) == 0, issues


def check_storage() -> tuple[bool, list[str]]:
    """Check storage is within limits."""
    issues = []
    
    try:
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                f"from Skills.sec_edgar.scripts import manifest as m; print(m.get_storage_stats()['gb'])",
            ],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        if result.returncode == 0:
            gb = float(result.stdout.strip())
            if gb > 10:
                issues.append(f"Storage at {gb:.1f} GB (warning threshold: 10 GB)")
    except Exception as e:
        issues.append(f"Storage check error: {e}")
    
    return len(issues) == 0, issues


# ── Main ────────────────────────────────────────────────────────


def main() -> int:
    print("=" * 50)
    print("Zo SEC Intelligence - Health Check")
    print("=" * 50)
    print()
    
    all_passed = True
    
    checks = [
        ("Filesystem", check_filesystem),
        ("Config", check_config),
        ("Routes", check_routes),
        ("Model", check_model),
        ("EDGAR", check_edgar),
        ("Storage", check_storage),
    ]
    
    for name, check_fn in checks:
        passed, issues = check_fn()
        status = "✓ OK" if passed else "✗ FAIL"
        print(f"{name:12} {status}")
        
        for issue in issues:
            print(f"              {issue}")
        
        if not passed:
            all_passed = False
    
    print()
    print("=" * 50)
    if all_passed:
        print("All checks passed ✓")
        return 0
    else:
        print("Issues found ✗")
        return 1


if __name__ == "__main__":
    sys.exit(main())
