

"""Config read/write for sec-edgar.

All scripts should import config from here rather than hardcoding paths.
Reads and writes /home/workspace/sec/config.json.

Schema (see ENG §10):
{
  "version": 1,
  "sec_user_agent": "...",
  "tracked_tickers": ["TSLA", "AAPL", ...],
  "fetch_forms": ["10-K", "10-Q", "8-K", "DEF 14A"],
  "auto_index": true,
  "manifest_mode": "distributed",
  "storage_warn_gb": 10,
  "llm": {
    "model": "zo:minimax/minimax-2-7"
  },
  "rate_limit": {
    "delay": 0.12,
    "jitter_range": [0.02, 0.06],
    "max_retries": 3
  },
  "thresholds": {
    "summary_token_threshold": 5000,
    "extractive_threshold": 2000,
    "raw_storage_threshold": 15000
  },
  "monitor_rules": [...]
}
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import json
import os
import re
from pathlib import Path
from typing import Any

SEC_DIR = Path("/home/workspace/sec")
CONFIG_PATH = SEC_DIR / "config.json"

# SEC requires a real name/email — placeholder patterns that must be replaced
_PLACEHOLDER_PATTERNS = (
    r"example\.com",
    r"your-email",
    r"your\.email",
    r"research@local",
    r"@local",
)


# ── Default config ─────────────────────────────────────────────────────────────

DEFAULT_CONFIG: dict[str, Any] = {
    "version": 1,
    "sec_user_agent": "",
    "tracked_tickers": [],
    "fetch_forms": ["10-K", "10-Q", "8-K", "DEF 14A"],
    "auto_index": True,
    "manifest_mode": "distributed",
    "storage_warn_gb": 10,
    "llm": {
        "model": "zo:minimax/minimax-2-7",
    },
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


# ── Read / write ───────────────────────────────────────────────────────────────

def load() -> dict[str, Any]:
    """Load config, returning defaults for missing fields."""
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            # Merge defaults for any missing keys (forward compat)
            cfg = dict(DEFAULT_CONFIG)
            cfg.update(data)
            return cfg
        except (json.JSONDecodeError, OSError):
            return dict(DEFAULT_CONFIG)
    return dict(DEFAULT_CONFIG)


def save(cfg: dict[str, Any]) -> None:
    """Save config atomically."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    from Skills.sec_edgar.scripts.utils import atomic_write_json
    atomic_write_json(CONFIG_PATH, cfg)


# ── Convenience accessors ─────────────────────────────────────────────────────

def get_sec_user_agent() -> str:
    return load().get("sec_user_agent", "")


def is_sec_ua_valid() -> bool:
    """True if UA looks real (not a placeholder)."""
    ua = get_sec_user_agent()
    if not ua or not ua.strip():
        return False
    ua_lower = ua.lower()
    return not any(re.search(p, ua_lower) for p in _PLACEHOLDER_PATTERNS)


def require_sec_ua() -> str:
    """Return UA, raising SECUserAgentMissingError if invalid."""
    ua = get_sec_user_agent()
    if not is_sec_ua_valid():
        raise SECUserAgentMissingError(
            "SEC User-Agent is missing or is a placeholder. "
            "Set sec_user_agent in sec/config.json to e.g. 'Your Name your@email.com'"
        )
    return ua


def get_tracked_tickers() -> list[str]:
    return load().get("tracked_tickers", [])


def get_fetch_forms() -> list[str]:
    return load().get("fetch_forms", ["10-K", "10-Q", "8-K"])


def is_auto_index() -> bool:
    return load().get("auto_index", True)


def get_storage_warn_gb() -> float:
    return float(load().get("storage_warn_gb", 10))


def get_llm_model() -> str:
    return load().get("llm", {}).get("model", "zo:minimax/minimax-2-7")


def get_rate_limit_delay() -> float:
    return float(load().get("rate_limit", {}).get("delay", 0.12))


def get_rate_limit_jitter() -> tuple[float, float]:
    jr = load().get("rate_limit", {}).get("jitter_range", [0.02, 0.06])
    return float(jr[0]), float(jr[1])


def get_rate_limit_max_retries() -> int:
    return int(load().get("rate_limit", {}).get("max_retries", 3))


def get_summary_token_threshold() -> int:
    return int(load().get("thresholds", {}).get("summary_token_threshold", 5000))


def get_extractive_threshold() -> int:
    return int(load().get("thresholds", {}).get("extractive_threshold", 2000))


def get_raw_storage_threshold() -> int:
    return int(load().get("thresholds", {}).get("raw_storage_threshold", 15000))


def get_monitor_rules() -> list[dict[str, Any]]:
    return load().get("monitor_rules", [])


def get_secrets_dir() -> Path:
    """Path to Zo secrets (Settings > Advanced)."""
    return Path("/home/workspace/.zospy/secrets")


def get_dashboard_token_name() -> str:
    return "SEC_DASHBOARD_TOKEN"


def get_dashboard_token() -> str | None:
    """Read dashboard token from Zo secrets if set."""
    token_path = get_secrets_dir() / "SEC_DASHBOARD_TOKEN"
    if token_path.exists():
        return token_path.read_text().strip()
    # Also check env (injected by Zo)
    return os.environ.get("SEC_DASHBOARD_TOKEN")


# ── Mutators ───────────────────────────────────────────────────────────────────

def add_ticker(ticker: str) -> None:
    cfg = load()
    tickers = cfg.setdefault("tracked_tickers", [])
    ticker_upper = ticker.upper()
    if ticker_upper not in tickers:
        tickers.append(ticker_upper)
    save(cfg)


def remove_ticker(ticker: str) -> None:
    cfg = load()
    ticker_upper = ticker.upper()
    cfg["tracked_tickers"] = [t for t in cfg.get("tracked_tickers", []) if t != ticker_upper]
    save(cfg)


def add_monitor_rule(rule: dict[str, Any]) -> None:
    cfg = load()
    cfg.setdefault("monitor_rules", []).append(rule)
    save(cfg)


def remove_monitor_rule(name: str) -> None:
    cfg = load()
    cfg["monitor_rules"] = [r for r in cfg.get("monitor_rules", []) if r.get("name") != name]
    save(cfg)


# ── Errors ────────────────────────────────────────────────────────────────────

class SECUserAgentMissingError(Exception):
    pass


class ConfigError(Exception):
    pass
