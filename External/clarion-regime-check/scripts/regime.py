#!/usr/bin/env python3
"""Clarion regime check — SPY/TLT/RSP color + equity hurdle rate.

Pulls daily bars via yfinance (cached at ~/clarion/data/equities/), computes
the regime snapshot, and prints a markdown report to stdout. Errors print a
single `REGIME_ERROR: ...` line and exit non-zero.

Usage:
    python regime.py
    python regime.py --rf-rate-pct 4.5
    python regime.py --offline
"""

from __future__ import annotations

import argparse
import sys
from datetime import timedelta

from ai_buffett_zo.data import EquityStore
from ai_buffett_zo.regime import HURDLE_PREMIUM_PCT, RegimeSnapshot, snapshot
from ai_buffett_zo.voice import (
    cite_quote,
    footer,
    header,
    md_table,
    no_data,
    show_math,
)

REQUIRED_TICKERS = ("SPY", "TLT", "RSP")


def format_regime_output(snap: RegimeSnapshot) -> str:
    """Render the regime snapshot as the markdown report shown to the user."""
    parts: list[str] = [
        header(
            f"Market Regime — {snap.color.upper()}",
            f"as of {snap.asof.isoformat()}",
        ),
        snap.rationale,
        "",
        "**Signals**",
        md_table(
            ["Signal", "Value"],
            [
                ["SPY 20d return", f"{snap.spy_ret_short:+.2%}"],
                ["TLT 20d return", f"{snap.tlt_ret_short:+.2%}"],
                ["RSP-SPY 60d spread", f"{snap.rsp_vs_spy_long:+.2%}"],
                ["SPY drawdown vs 252d high", f"{snap.spy_drawdown_from_high:+.2%}"],
            ],
        ),
    ]
    if snap.hurdle_rate_pct is not None:
        parts.append("")
        parts.append("**Equity hurdle rate**")
        parts.append(
            show_math(
                "Hurdle",
                f"rf + {HURDLE_PREMIUM_PCT[snap.color]:.1f}% regime premium",
                f"{snap.hurdle_rate_pct:.2f}%",
            )
        )
    parts.append("")
    parts.append(
        footer(
            source_lines=[cite_quote("SPY/TLT/RSP daily bars (yfinance)", snap.asof.isoformat())]
        )
    )
    return "\n".join(parts)


def run(
    *,
    rf_rate_pct: float | None,
    offline: bool,
    max_age_hours: int,
) -> int:
    max_age = timedelta.max if offline else timedelta(hours=max_age_hours)
    store = EquityStore()

    histories = {}
    for ticker in REQUIRED_TICKERS:
        try:
            bars = store.history(ticker, max_age=max_age)
        except Exception as e:  # noqa: BLE001
            print(f"REGIME_ERROR: failed to fetch {ticker}: {type(e).__name__}: {e}")
            return 1
        if not bars:
            print(no_data(f"{ticker}: no bars available"))
            print(f"REGIME_ERROR: empty history for {ticker}")
            return 1
        histories[ticker] = bars

    try:
        snap = snapshot(
            histories["SPY"],
            histories["TLT"],
            histories["RSP"],
            rf_rate_pct=rf_rate_pct,
        )
    except ValueError as e:
        print(f"REGIME_ERROR: {e}")
        return 1

    print(format_regime_output(snap))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="clarion-regime-check")
    ap.add_argument(
        "--rf-rate-pct",
        type=float,
        default=None,
        help="1Y T-bill yield as a percent (e.g. 4.5). If set, the hurdle rate is computed.",
    )
    ap.add_argument(
        "--offline",
        action="store_true",
        help="Use only cached bars; do not call yfinance.",
    )
    ap.add_argument(
        "--max-age-hours",
        type=int,
        default=24,
        help="Refresh cache if last bar older than this many hours (default 24).",
    )
    args = ap.parse_args()
    return run(
        rf_rate_pct=args.rf_rate_pct,
        offline=args.offline,
        max_age_hours=args.max_age_hours,
    )


if __name__ == "__main__":
    sys.exit(main())
