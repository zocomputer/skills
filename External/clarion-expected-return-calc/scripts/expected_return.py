#!/usr/bin/env python3
"""Clarion expected-return calculator — equities or T-bills?

Implements the Expected-Return Framework from docs/ALLOCATION-POLICY.md and
the hurdle-rate framework from docs/DESIGN-LANGUAGE.md.

Answers one question for the Value bucket (50% of portfolio):
"What's the right equity / T-bill mix right now?"

Does NOT make per-position decisions; that's clarion-single-stock-eval.

Usage:
    python expected_return.py --cape 35.2 --trailing-pe 28.4
    python expected_return.py --cape 35.2 --rf-rate-pct 4.45
    python expected_return.py --cape 35.2 --no-fetch-rf  # require --rf-rate-pct
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

from ai_buffett_zo.data import EquityStore
from ai_buffett_zo.macro import (
    AllocationDecision,
    ImpliedReturn,
    decide_allocation,
    fetch_3mo_yield,
    implied_return_from_pe,
)
from ai_buffett_zo.regime import HURDLE_PREMIUM_PCT, RegimeSnapshot, snapshot
from ai_buffett_zo.voice import (
    cite_quote,
    footer,
    header,
    md_table,
    show_math,
)


def _config_path() -> Path:
    return Path.home() / "clarion" / "config.json"


def _config_rf() -> float | None:
    cfg = _config_path()
    if not cfg.exists():
        return None
    try:
        data = json.loads(cfg.read_text())
        v = data.get("rf_rate_pct")
        return float(v) if v is not None else None
    except (json.JSONDecodeError, TypeError, ValueError, OSError):
        return None


def _resolve_rf(args: argparse.Namespace) -> tuple[float | None, str]:
    """Returns (rate_pct, source_label). source_label describes provenance."""
    if args.rf_rate_pct is not None:
        return float(args.rf_rate_pct), "user-supplied"
    if not args.no_fetch_rf:
        y = fetch_3mo_yield()
        if y is not None:
            return y.rate_pct, f"Treasury.gov 3-mo (asof {y.asof.isoformat()})"
    cfg_rf = _config_rf()
    if cfg_rf is not None:
        return cfg_rf, "~/clarion/config.json fallback"
    return None, "unresolved"


def _resolve_regime() -> RegimeSnapshot | None:
    """Best-effort regime snapshot using cached SPY/TLT/RSP."""
    try:
        store = EquityStore()
        spy = store.history("SPY", max_age=timedelta(hours=24))
        tlt = store.history("TLT", max_age=timedelta(hours=24))
        rsp = store.history("RSP", max_age=timedelta(hours=24))
    except Exception:  # noqa: BLE001
        return None
    if not spy or not tlt or not rsp:
        return None
    try:
        return snapshot(spy, tlt, rsp)
    except ValueError:
        return None


def run(args: argparse.Namespace) -> int:
    rf_rate_pct, rf_source = _resolve_rf(args)
    if rf_rate_pct is None:
        print(
            "EXPECTED_RETURN_ERROR: could not resolve risk-free rate. "
            "Pass --rf-rate-pct X.X manually, or seed `rf_rate_pct` in "
            f"{_config_path()}, or check Treasury.gov reachability."
        )
        return 1

    regime_snap = _resolve_regime()
    if regime_snap is None:
        print(
            "EXPECTED_RETURN_ERROR: could not compute regime. "
            "Run clarion-regime-check first to seed the SPY/TLT/RSP cache."
        )
        return 1

    if args.cape is None:
        print(
            "EXPECTED_RETURN_ERROR: --cape is required. "
            "Look up the current Shiller CAPE on multpl.com or Yardeni Research."
        )
        return 1

    implied = implied_return_from_pe(args.cape)
    hurdle_pct = rf_rate_pct + HURDLE_PREMIUM_PCT[regime_snap.color]
    decision = decide_allocation(
        implied_return_mid_pct=implied.midpoint_pct,
        rf_rate_pct=rf_rate_pct,
        hurdle_rate_pct=hurdle_pct,
        danger_state=(regime_snap.color == "danger"),
    )

    _render(
        regime_snap=regime_snap,
        rf_rate_pct=rf_rate_pct,
        rf_source=rf_source,
        cape=args.cape,
        trailing_pe=args.trailing_pe,
        forward_pe=args.forward_pe,
        ten_year_yield_pct=args.ten_year_yield_pct,
        implied=implied,
        hurdle_pct=hurdle_pct,
        decision=decision,
    )
    return 0


def _render(
    *,
    regime_snap: RegimeSnapshot,
    rf_rate_pct: float,
    rf_source: str,
    cape: float,
    trailing_pe: float | None,
    forward_pe: float | None,
    ten_year_yield_pct: float | None,
    implied: ImpliedReturn,
    hurdle_pct: float,
    decision: AllocationDecision,
) -> None:
    print(
        header(
            f"Expected Return Check — {date.today().isoformat()}",
            f"Regime: {regime_snap.color.upper()}",
        )
    )
    print()

    # The Numbers
    print("## The Numbers")
    print()
    rows = [
        ["Trailing P/E", _fmt_pe(trailing_pe), "user-supplied" if trailing_pe is not None else "—"],
        ["Shiller CAPE", _fmt_pe(cape), "user-supplied (multpl.com / Yardeni)"],
        ["Forward P/E", _fmt_pe(forward_pe), "user-supplied" if forward_pe is not None else "—"],
        ["3-month T-bill", f"{rf_rate_pct:.2f}%", rf_source],
        [
            "10-year Treasury",
            _fmt_pct(ten_year_yield_pct),
            "user-supplied" if ten_year_yield_pct is not None else "—",
        ],
        ["Regime", regime_snap.color.upper(), "clarion-regime-check"],
    ]
    print(md_table(["Metric", "Value", "Source"], rows))

    if trailing_pe is not None and abs(trailing_pe - cape) > 5.0:
        print()
        print(
            f"_⚠ CAPE ({cape:.1f}) and trailing P/E ({trailing_pe:.1f}) diverge by "
            f"more than 5 points. Cross-check both inputs._"
        )

    print()

    # The Math
    print("## The Math")
    print()
    print(
        show_math(
            f"Implied equity return (CAPE {cape:.1f})",
            f"{implied.return_low_pct:.0f}–{implied.return_high_pct:.0f}% "
            f"annualized over 10 years (confidence: {implied.confidence})",
            f"midpoint {implied.midpoint_pct:.1f}%",
        )
    )
    print(
        show_math(
            "Risk-free rate (3-month T-bill)",
            rf_source,
            f"{rf_rate_pct:.2f}%",
        )
    )
    print(
        show_math(
            f"Regime premium ({regime_snap.color.upper()})",
            "from docs/ALLOCATION-POLICY.md",
            f"+{HURDLE_PREMIUM_PCT[regime_snap.color]:.1f}%",
        )
    )
    print(
        show_math(
            "Hurdle rate",
            f"{rf_rate_pct:.2f}% + {HURDLE_PREMIUM_PCT[regime_snap.color]:.1f}%",
            f"{hurdle_pct:.2f}%",
        )
    )
    print(
        show_math(
            "Spread",
            f"implied {implied.midpoint_pct:.1f}% vs hurdle {hurdle_pct:.2f}%",
            f"{implied.midpoint_pct - hurdle_pct:+.2f}%",
        )
    )
    print()

    # The Verdict
    print("## The Verdict")
    print()
    print(f"**{decision.verdict}**")
    print()
    print(decision.rationale)
    print()

    # Recommended Value Bucket Split
    print("## Recommended Value Bucket Split")
    print()
    print(f"- Equities: {decision.equity_low}-{decision.equity_high}%")
    print(f"- T-bills / cash: {100 - decision.equity_high}-{100 - decision.equity_low}%")
    print()

    # Context
    print("## Context")
    print()
    print(_context(regime_snap=regime_snap, rf_rate_pct=rf_rate_pct, cape=cape))
    print()

    # Footer
    print(
        footer(
            source_lines=[
                cite_quote("SPY/TLT/RSP daily bars (yfinance)", regime_snap.asof.isoformat()),
                f"Risk-free rate: {rf_source}",
                "Shiller CAPE: user-supplied",
                "Framework: docs/ALLOCATION-POLICY.md, docs/DESIGN-LANGUAGE.md",
            ]
        )
    )


def _context(*, regime_snap: RegimeSnapshot, rf_rate_pct: float, cape: float) -> str:
    notes: list[str] = []
    if regime_snap.color in ("green", "blue"):
        next_premium = HURDLE_PREMIUM_PCT["orange"]
        notes.append(
            f"A move to ORANGE would raise the hurdle to "
            f"{rf_rate_pct + next_premium:.2f}% — tighter spread, possibly downgrading the verdict."
        )
    elif regime_snap.color == "orange":
        notes.append(
            f"A move to GREEN/BLUE would lower the hurdle to "
            f"{rf_rate_pct + HURDLE_PREMIUM_PCT['green']:.2f}%; a move to RED would raise it to "
            f"{rf_rate_pct + HURDLE_PREMIUM_PCT['red']:.2f}%."
        )
    elif regime_snap.color == "red":
        notes.append(
            f"A move to ORANGE would lower the hurdle to "
            f"{rf_rate_pct + HURDLE_PREMIUM_PCT['orange']:.2f}% — wider spread, possibly upgrading the verdict."
        )
    elif regime_snap.color == "danger":
        notes.append(
            "DANGER state forces MAXIMUM T-BILLS regardless of P/E math. "
            "A regime downgrade would re-enable the framework."
        )

    cape_15 = cape * 0.85
    new_implied = implied_return_from_pe(cape_15)
    notes.append(
        f"A 15% market correction would bring CAPE to ~{cape_15:.1f}, implying "
        f"{new_implied.return_low_pct:.0f}–{new_implied.return_high_pct:.0f}% returns."
    )
    return "\n\n".join(notes)


def _fmt_pe(v: float | None) -> str:
    if v is None:
        return "—"
    return f"{v:.2f}"


def _fmt_pct(v: float | None) -> str:
    if v is None:
        return "—"
    return f"{v:.2f}%"


def main() -> int:
    ap = argparse.ArgumentParser(prog="clarion-expected-return-calc")
    ap.add_argument(
        "--cape",
        type=float,
        default=None,
        help="Shiller CAPE (cyclically adjusted P/E, 10-year). Required. Look up on multpl.com.",
    )
    ap.add_argument(
        "--trailing-pe",
        type=float,
        default=None,
        help="Trailing 12-month P/E. Optional cross-check.",
    )
    ap.add_argument(
        "--forward-pe",
        type=float,
        default=None,
        help="Next-12-month forward P/E. Optional context.",
    )
    ap.add_argument(
        "--rf-rate-pct",
        type=float,
        default=None,
        help="3-month T-bill rate as a percent (e.g. 4.45). If omitted, fetched from Treasury.gov.",
    )
    ap.add_argument(
        "--ten-year-yield-pct",
        type=float,
        default=None,
        help="10-year Treasury yield (optional context).",
    )
    ap.add_argument(
        "--no-fetch-rf",
        action="store_true",
        help="Skip Treasury.gov auto-fetch (require --rf-rate-pct).",
    )
    args = ap.parse_args()
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
