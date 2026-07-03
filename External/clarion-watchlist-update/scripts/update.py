#!/usr/bin/env python3
"""Clarion watchlist update — read the latest screen, refresh prices.

Read-only snapshot. Loads the latest watchlist file, fetches current prices,
computes % move since the screen, surfaces big movers and watchlist-status
theses. Doesn't modify any file.

Usage:
    python update.py
    python update.py --top-only
    python update.py --threshold-pct 5
    python update.py --max-stale-days 7
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import date, timedelta
from pathlib import Path

from ai_buffett_zo.data import EquityStore
from ai_buffett_zo.screener import (
    DEFAULT_WATCHLIST_ROOT,
    WatchlistRow,
    latest_watchlist,
    parse_ranked_table,
)
from ai_buffett_zo.theses import (
    DEFAULT_THESES_ROOT,
    ThesisMetadata,
    list_theses,
    parse_thesis_metadata,
)
from ai_buffett_zo.voice import footer, header, md_table


def watchlist_root() -> Path:
    return Path(os.environ.get("CLARION_WATCHLIST_ROOT") or DEFAULT_WATCHLIST_ROOT)


def theses_root() -> Path:
    return Path(os.environ.get("CLARION_THESES_ROOT") or DEFAULT_THESES_ROOT)


# ---- Watchlist date extraction ---------------------------------------------


_DATE_FROM_FILENAME = re.compile(r"sp500-screen-(\d{4}-\d{2}-\d{2})\.md$")


def _date_from_filename(p: Path) -> date | None:
    m = _DATE_FROM_FILENAME.search(p.name)
    if m is None:
        return None
    try:
        return date.fromisoformat(m.group(1))
    except ValueError:
        return None


# ---- Price fetch -----------------------------------------------------------


def _current_price(ticker: str) -> float | None:
    try:
        store = EquityStore()
        bars = store.history(ticker, max_age=timedelta(hours=24))
    except Exception:  # noqa: BLE001
        return None
    return bars[-1].close if bars else None


# ---- Run -------------------------------------------------------------------


def run(args: argparse.Namespace) -> int:
    wl_path = latest_watchlist(watchlist_root())
    if wl_path is None:
        print(
            "WATCHLIST_UPDATE_ERROR: no watchlists found at "
            f"{watchlist_root()}. Run clarion-value-screener first."
        )
        return 1

    content = wl_path.read_text()
    rows = parse_ranked_table(content)
    if not rows:
        print(
            f"WATCHLIST_UPDATE_ERROR: latest watchlist unparseable: {wl_path}. "
            "Verify the Stage 1 ranked-results table is present."
        )
        return 1

    if args.top_only:
        rows = rows[: args.top_size]

    screen_date = _date_from_filename(wl_path) or date.today()
    age_days = (date.today() - screen_date).days
    stale = age_days > args.max_stale_days

    # Fetch current prices in order; small enough to do sequentially
    enriched: list[tuple[WatchlistRow, float | None, float | None]] = []
    for row in rows:
        cur = _current_price(row.ticker)
        if cur is not None and row.price is not None and row.price > 0:
            move_pct = (cur / row.price - 1.0) * 100
        else:
            move_pct = None
        enriched.append((row, cur, move_pct))

    # Pull watchlist-status theses
    watchlist_theses: list[tuple[ThesisMetadata, float | None]] = []
    for tp in list_theses(theses_root()):
        try:
            md = parse_thesis_metadata(tp.read_text())
        except OSError:
            continue
        if md is None or md.status != "watchlist":
            continue
        cur = _current_price(md.ticker)
        watchlist_theses.append((md, cur))

    _render(
        wl_path=wl_path,
        screen_date=screen_date,
        age_days=age_days,
        stale=stale,
        max_stale_days=args.max_stale_days,
        enriched=enriched,
        threshold_pct=args.threshold_pct,
        watchlist_theses=watchlist_theses,
        top_only=args.top_only,
    )
    return 0


def _render(
    *,
    wl_path: Path,
    screen_date: date,
    age_days: int,
    stale: bool,
    max_stale_days: int,
    enriched: list[tuple[WatchlistRow, float | None, float | None]],
    threshold_pct: float,
    watchlist_theses: list[tuple[ThesisMetadata, float | None]],
    top_only: bool,
) -> None:
    title = "Watchlist Update"
    subtitle = f"latest screen: {screen_date.isoformat()} ({age_days}d old)"
    print(header(title, subtitle))
    print()
    print(f"_Source: `{wl_path}`_" + (" — **stale**" if stale else ""))
    print()

    # Movers section
    big = [
        (row, cur, move) for row, cur, move in enriched if move is not None and abs(move) >= threshold_pct
    ]
    if big:
        print(f"## Big movers (≥ {threshold_pct:.0f}% since screen)")
        print()
        rows = [
            [
                row.ticker,
                row.sector,
                f"{row.score:.1f}",
                _fmt_money(row.price),
                _fmt_money(cur),
                _fmt_signed_pct(move),
                _direction_note(move, threshold_pct),
            ]
            for row, cur, move in big
        ]
        print(md_table(["Ticker", "Sector", "Score", "Screen $", "Current $", "Move", "Note"], rows))
        print()

    # Full table
    label = "Top-N (sector-capped)" if top_only else "Full ranked list"
    print(f"## {label}")
    print()
    rows = [
        [
            str(row.rank),
            row.ticker,
            row.sector,
            f"{row.score:.1f}",
            _fmt_money(row.price),
            _fmt_money(cur),
            _fmt_signed_pct(move),
        ]
        for row, cur, move in enriched
    ]
    print(md_table(["Rank", "Ticker", "Sector", "Score", "Screen $", "Current $", "Move"], rows))
    print()

    # Watchlist theses
    if watchlist_theses:
        print("## Watchlist-status theses")
        print()
        rows = []
        for md, cur in watchlist_theses:
            rows.append(
                [
                    md.ticker,
                    md.bucket,
                    _fmt_money(md.cost_basis),
                    _fmt_money(cur),
                    _move_vs_basis(md.cost_basis, cur),
                ]
            )
        print(md_table(["Ticker", "Bucket", "Cost Basis", "Current $", "vs Basis"], rows))
        print()
        print(
            "_For exact entry-zone checks, open the thesis file directly — "
            "the script doesn't parse the prose-heavy Position Management section in v1._"
        )
        print()

    # Staleness footer
    if stale:
        print(
            f"⚠ The latest screen is {age_days}d old (threshold: {max_stale_days}d). "
            "Regime, hurdle, and fundamentals likely drifted — consider running "
            "`clarion-value-screener` for a refresh."
        )
        print()

    print(footer())


def _direction_note(move: float, threshold: float) -> str:
    if move >= threshold:
        return "entry case weaker"
    if move <= -threshold:
        return "worth a fresh look"
    return ""


def _fmt_money(v: float | None) -> str:
    if v is None:
        return "n/a"
    return f"${v:,.2f}"


def _fmt_signed_pct(v: float | None) -> str:
    if v is None:
        return "n/a"
    return f"{v:+.1f}%"


def _move_vs_basis(basis: float | None, current: float | None) -> str:
    if basis is None or current is None or basis == 0:
        return "n/a"
    return f"{(current / basis - 1) * 100:+.1f}%"


def main() -> int:
    ap = argparse.ArgumentParser(prog="clarion-watchlist-update")
    ap.add_argument("--top-only", action="store_true", help="Only show top-N after sector cap.")
    ap.add_argument(
        "--top-size",
        type=int,
        default=10,
        help="When --top-only is set, the size of the top group (default 10).",
    )
    ap.add_argument(
        "--threshold-pct",
        type=float,
        default=10.0,
        help="Move %% threshold to flag as 'big mover' (default 10).",
    )
    ap.add_argument(
        "--max-stale-days",
        type=int,
        default=14,
        help="Days before flagging the latest watchlist as stale (default 14).",
    )
    args = ap.parse_args()
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
