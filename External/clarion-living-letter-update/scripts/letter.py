#!/usr/bin/env python3
"""Clarion living-letter update — quarterly + year-end finalization.

Operations:
    update    Append/replace the current (or specified) quarter's section.
    finalize  Year-end finalization (Year in Context + Full Year Summary).
    status    Show what's populated in the letter.

Append-only philosophy: refuses to overwrite an already-populated quarter
without --force. Hindsight commentary belongs in NEW sections, not as edits
to old quarters.

Usage:
    python letter.py update
    python letter.py update --quarter 2
    python letter.py update --year 2026 --quarter 3 --force
    python letter.py finalize
    python letter.py status
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from ai_buffett_zo.data import EquityStore
from ai_buffett_zo.letters import (
    DEFAULT_LETTERS_ROOT,
    QUARTER_LABELS,
    current_quarter,
    ensure_letter,
    is_finalized,
    is_quarter_populated,
    letter_path,
    list_letters,
    render_finalization,
    render_quarterly_section,
    replace_full_year_summary,
    replace_quarter,
    replace_year_in_context,
)
from ai_buffett_zo.regime import RegimeSnapshot, snapshot
from ai_buffett_zo.theses import (
    DEFAULT_THESES_ROOT,
    ThesisMetadata,
    list_theses,
    parse_thesis_metadata,
)


def letters_root() -> Path:
    return Path(os.environ.get("CLARION_LETTERS_ROOT") or DEFAULT_LETTERS_ROOT)


def theses_root() -> Path:
    return Path(os.environ.get("CLARION_THESES_ROOT") or DEFAULT_THESES_ROOT)


# ---- System data resolution -----------------------------------------------


def _resolve_regime() -> RegimeSnapshot | None:
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


def _active_theses() -> list[ThesisMetadata]:
    out: list[ThesisMetadata] = []
    for p in list_theses(theses_root()):
        try:
            md = parse_thesis_metadata(p.read_text())
        except OSError:
            continue
        if md is None:
            continue
        if md.status == "active":
            out.append(md)
    return out


def _all_theses() -> list[ThesisMetadata]:
    out: list[ThesisMetadata] = []
    for p in list_theses(theses_root()):
        try:
            md = parse_thesis_metadata(p.read_text())
        except OSError:
            continue
        if md is not None:
            out.append(md)
    return out


# ---- Operations ------------------------------------------------------------


def cmd_update(args: argparse.Namespace) -> int:
    year = args.year or date.today().year
    quarter = args.quarter or current_quarter()
    if quarter not in (1, 2, 3, 4):
        print(f"LETTER_ERROR: unknown quarter {quarter}; pass 1-4.")
        return 1

    root = letters_root()
    path = ensure_letter(root, year)
    content = path.read_text()

    if is_quarter_populated(content, quarter) and not args.force:
        print(
            f"LETTER_ERROR: quarter already populated. "
            f"Q{quarter} {year} contains structural content. "
            f"Pass --force to overwrite (rare; usually means re-running for the same period). "
            f"Hindsight commentary belongs in a NEW section in brackets, not as edits to past quarters."
        )
        return 1

    regime = _resolve_regime()
    theses = _active_theses()
    section = render_quarterly_section(
        quarter=quarter,
        update_date=date.today(),
        regime=regime,
        active_theses=theses,
    )
    new_content = replace_quarter(content, quarter, section)
    path.write_text(new_content)

    print(f"Wrote Q{quarter} {year} to: {path}")
    print()
    if regime is None:
        print("_warning: regime unavailable (yfinance cache empty for SPY/TLT/RSP)._")
        print()
    print(f"Active theses surfaced ({len(theses)}):")
    for t in sorted(theses, key=lambda m: m.ticker):
        print(f"  - {t.ticker} ({t.bucket}, score {t.health_score or '—'})")
    print()
    print("**Next:** open the letter and fill these [TODO] sections in order:")
    print()
    print("1. **Regime & Environment** — Macro events, S&P 500 P/E at quarter start")
    print("2. **Portfolio Snapshot** — Actual bucket weights (system can't track real-time)")
    print("3. **What We Did** — Specific decisions, named tickers, reasoning at the time")
    print("4. **Thesis Health → Notes** — One-line key development per thesis")
    print("5. **What We Learned** — Surprises, mistakes, patterns (most valuable section)")
    print("6. **Performance** — Quarter return, S&P 500, 60/40, YTD")
    return 0


def cmd_finalize(args: argparse.Namespace) -> int:
    year = args.year or date.today().year
    root = letters_root()
    path = ensure_letter(root, year)
    content = path.read_text()

    # All four quarters must be populated before finalizing
    missing = [q for q in (1, 2, 3, 4) if not is_quarter_populated(content, q)]
    if missing and not args.force:
        labels = ", ".join(f"Q{q}" for q in missing)
        print(
            f"LETTER_ERROR: cannot finalize. The following quarters are still "
            f"placeholders: {labels}. Fill them in first (clarion-living-letter-update update "
            f"--quarter N), or pass --force to finalize anyway."
        )
        return 1

    if is_finalized(content) and not args.force:
        print(
            f"LETTER_ERROR: letter already finalized. {path} contains a populated "
            f"Full Year Summary. Pass --force to re-render the scaffold (rare)."
        )
        return 1

    theses = _all_theses()
    year_in_context, full_summary = render_finalization(
        year=year,
        finalize_date=date.today(),
        active_theses=theses,
    )

    new_content = replace_year_in_context(content, year_in_context)
    new_content = replace_full_year_summary(new_content, full_summary)
    path.write_text(new_content)

    print(f"Finalization scaffold written to: {path}")
    print()
    print(f"Theses on file ({len(theses)}):")
    by_status: dict[str, int] = {}
    for t in theses:
        by_status[t.status] = by_status.get(t.status, 0) + 1
    for status, count in sorted(by_status.items()):
        print(f"  - {status}: {count}")
    print()
    print("**Next:** fill these [TODO] sections:")
    print()
    print("1. **Year in Context** — 2-3 paragraphs setting the macro scene")
    print("2. **Performance table** — Total return / drawdown / Sharpe / best+worst month")
    print("3. **By Bucket** — Per-bucket attribution + key winner/loser")
    print("4. **Mistakes & Lessons** — Ranked by impact (this is the most valuable section)")
    print("5. **Theses: Final Scorecard → Outcome** — One-line outcome per thesis")
    print("6. **Looking Ahead** — Observations (NOT predictions) about regime, opportunity, risk, asymmetry")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    year = args.year or date.today().year
    root = letters_root()
    path = letter_path(root, year)
    if not path.exists():
        print(f"No letter for {year} yet. Run `clarion-living-letter-update update` to create.")
        all_files = list_letters(root)
        if all_files:
            print()
            print("Existing letters:")
            for f in all_files:
                print(f"  - {f.name}")
        return 0
    content = path.read_text()
    print(f"Letter: {path}")
    print()
    for q in (1, 2, 3, 4):
        flag = "✓ populated" if is_quarter_populated(content, q) else "  placeholder"
        print(f"  {flag}  {QUARTER_LABELS[q]}")
    print()
    print(f"  {'✓ finalized' if is_finalized(content) else '  not finalized'}  Full Year Summary")
    return 0


# ---- Main ------------------------------------------------------------------


def main() -> int:
    ap = argparse.ArgumentParser(prog="clarion-living-letter-update")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_up = sub.add_parser("update", help="Append/replace a quarterly section.")
    p_up.add_argument("--year", type=int, default=None)
    p_up.add_argument("--quarter", type=int, default=None, help="1-4")
    p_up.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an already-populated quarter (rare).",
    )
    p_up.set_defaults(func=cmd_update)

    p_fin = sub.add_parser("finalize", help="Year-end Year in Context + Full Year Summary.")
    p_fin.add_argument("--year", type=int, default=None)
    p_fin.add_argument(
        "--force",
        action="store_true",
        help="Finalize even if some quarters are placeholders.",
    )
    p_fin.set_defaults(func=cmd_finalize)

    p_stat = sub.add_parser("status", help="Show what's populated in the letter.")
    p_stat.add_argument("--year", type=int, default=None)
    p_stat.set_defaults(func=cmd_status)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
