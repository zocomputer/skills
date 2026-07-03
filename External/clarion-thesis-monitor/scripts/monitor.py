#!/usr/bin/env python3
"""Clarion thesis-monitor — health-check every active thesis.

Reads ~/clarion/theses/ active theses, refreshes prices, recomputes the
directly-derivable health components (Valuation Safety, Catalyst Proximity,
Risk Environment), checks kill condition statuses, aggregates to an Overall
score, recommends an action, and writes the result back to each thesis file.

LLM-driven components (Business Health, Insider Alignment, Thesis Integrity)
are carried forward from the previous run in v1. v2 will integrate /zo/ask
for those.

Usage:
    python monitor.py                       # all active theses, full mode
    python monitor.py --quick               # kill checks + Risk Env only
    python monitor.py --ticker NVDA         # single thesis
    python monitor.py --no-write            # preview, don't update files
    python monitor.py --ticker NVDA --current-price 142.50
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from ai_buffett_zo.data import EquityStore
from ai_buffett_zo.regime import RegimeSnapshot, snapshot
from ai_buffett_zo.theses import (
    DEFAULT_THESES_ROOT,
    HealthComponent,
    HealthSnapshot,
    HistoryEntry,
    ThesisMetadata,
    append_history_entry,
    evaluate,
    list_theses,
    parse_health_components,
    parse_kill_conditions,
    parse_metadata_block,
    parse_thesis_metadata,
    score_catalyst_proximity,
    score_risk_environment,
    score_valuation_safety,
    update_health_table,
    update_kill_conditions_last_checked,
    update_metadata_block,
)
from ai_buffett_zo.voice import footer, header, md_table


def theses_root() -> Path:
    return Path(os.environ.get("CLARION_THESES_ROOT") or DEFAULT_THESES_ROOT)


# ---- Per-thesis processing -------------------------------------------------


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


def _current_price(ticker: str, *, override: float | None) -> float | None:
    if override is not None:
        return override
    try:
        store = EquityStore()
        bars = store.history(ticker, max_age=timedelta(hours=24))
    except Exception:  # noqa: BLE001
        return None
    return bars[-1].close if bars else None


def _recompute_components(
    *,
    components: list[HealthComponent],
    metadata: ThesisMetadata,
    raw_metadata: dict[str, str],
    regime_color: str,
    current_price: float | None,
    quick: bool,
    asof: date,
) -> tuple[list[HealthComponent], list[str]]:
    """Recompute the directly-derivable components, carry forward the rest.

    Returns (new_components, notes_about_what_changed).
    """
    by_name = {c.name: c for c in components}
    notes: list[str] = []

    # Risk Environment is always re-scored — cheap, deterministic.
    if "Risk Environment" in by_name:
        old = by_name["Risk Environment"]
        new_score = score_risk_environment(metadata.bucket, regime_color)
        if old.score != new_score:
            notes.append(f"Risk Environment {old.score}→{new_score} ({regime_color}/{metadata.bucket})")
        by_name["Risk Environment"] = HealthComponent(
            name="Risk Environment",
            weight=old.weight,
            score=new_score,
            notes=f"{regime_color.upper()} regime, {metadata.bucket} bucket",
        )

    if quick:
        return list(by_name.values()), notes

    # Valuation Safety — only if base_case_fair_value is in metadata AND we have a price
    base_case = _opt_float(raw_metadata.get("base_case_fair_value"))
    if "Valuation Safety" in by_name and base_case is not None and current_price is not None:
        margin_pct = ((base_case - current_price) / base_case) * 100
        new_score = score_valuation_safety(margin_pct)
        old = by_name["Valuation Safety"]
        if old.score != new_score:
            notes.append(
                f"Valuation Safety {old.score}→{new_score} "
                f"(margin {margin_pct:+.1f}% at ${current_price:.2f} vs ${base_case:.2f})"
            )
        by_name["Valuation Safety"] = HealthComponent(
            name="Valuation Safety",
            weight=old.weight,
            score=new_score,
            notes=f"margin {margin_pct:+.1f}% at ${current_price:.2f} vs base ${base_case:.2f}",
        )

    # Catalyst Proximity — only if catalyst_date is in metadata
    catalyst_date_raw = raw_metadata.get("catalyst_date")
    catalyst_date = _opt_date(catalyst_date_raw)
    if "Catalyst Proximity" in by_name and catalyst_date is not None:
        days = (catalyst_date - asof).days
        new_score = score_catalyst_proximity(days)
        old = by_name["Catalyst Proximity"]
        if old.score != new_score:
            notes.append(
                f"Catalyst Proximity {old.score}→{new_score} (catalyst in {days}d)"
            )
        by_name["Catalyst Proximity"] = HealthComponent(
            name="Catalyst Proximity",
            weight=old.weight,
            score=new_score,
            notes=f"catalyst {catalyst_date.isoformat()} ({days}d away)",
        )

    return list(by_name.values()), notes


def _process_thesis(
    *,
    path: Path,
    regime: RegimeSnapshot,
    quick: bool,
    write: bool,
    current_price_override: float | None,
    asof: date,
) -> tuple[ThesisMetadata, HealthSnapshot, list[str]] | None:
    """Process one thesis. Returns (metadata, snapshot, change_notes) or None on parse fail."""
    content = path.read_text()
    metadata = parse_thesis_metadata(content)
    if metadata is None or metadata.status != "active":
        return None
    raw_meta = parse_metadata_block(content)
    components, _ = parse_health_components(content)
    if not components:
        return None
    kill_conditions = parse_kill_conditions(content)

    current_price = _current_price(metadata.ticker, override=current_price_override)

    new_components, notes = _recompute_components(
        components=components,
        metadata=metadata,
        raw_metadata=raw_meta,
        regime_color=regime.color,
        current_price=current_price,
        quick=quick,
        asof=asof,
    )

    snap = evaluate(
        components=new_components,
        bucket=metadata.bucket,
        regime_color=regime.color,
        kill_conditions=kill_conditions,
    )

    if write:
        _write_back(
            path=path,
            content=content,
            new_components=new_components,
            snap=snap,
            metadata=metadata,
            asof=asof,
        )

    return metadata, snap, notes


def _write_back(
    *,
    path: Path,
    content: str,
    new_components: list[HealthComponent],
    snap: HealthSnapshot,
    metadata: ThesisMetadata,
    asof: date,
) -> None:
    new = update_health_table(content, new_components, snap.overall)
    new = update_metadata_block(
        new,
        {
            "last_reviewed": asof,
            "health_score": snap.overall,
        },
    )
    new = update_kill_conditions_last_checked(new, asof)

    # Append history entry only when the action changed vs the previous review.
    prior_action = _action_from_score(metadata.health_score)
    if prior_action != snap.action:
        new = append_history_entry(
            new,
            HistoryEntry(
                date=asof,
                event="ACTION CHANGED",
                detail=f"{prior_action or 'INITIAL'} → {snap.action} ({snap.rationale})",
            ),
        )

    path.write_text(new)


def _action_from_score(score: int | None) -> str | None:
    if score is None:
        return None
    from ai_buffett_zo.theses import action_for_score
    return action_for_score(score)


# ---- Dashboard rendering ---------------------------------------------------


def _render_dashboard(
    rows: list[tuple[ThesisMetadata, HealthSnapshot, list[str]]],
    regime: RegimeSnapshot,
    *,
    quick: bool,
    write: bool,
) -> None:
    title = "Thesis Health Dashboard" if not quick else "Thesis Quick Check"
    print(header(f"{title} — {date.today().isoformat()}"))
    print()
    print(
        f"**Regime:** {regime.color.upper()} · "
        f"**Active theses:** {len(rows)} · "
        f"**Mode:** {'quick' if quick else 'full'}{'' if write else ' (read-only)'}"
    )
    print()

    # Action items first
    action_items = [
        (m, s) for m, s, _ in rows if s.action in ("EXIT", "REDUCE") or s.kill_triggered
    ]
    if action_items:
        print("## Action Items")
        print()
        for m, s in action_items:
            tag = " (KILL)" if s.kill_triggered else ""
            print(f"- **{m.ticker}** → **{s.action}**{tag} — {s.rationale}")
            for kr in s.kill_reasons:
                print(f"  - kill: {kr}")
        print()

    # Per-thesis summary
    print("## Per-Thesis Summary")
    print()
    table_rows = []
    for m, s, _ in rows:
        kill_flag = "⚠" if s.kill_triggered else ""
        table_rows.append(
            [
                m.ticker,
                m.bucket,
                f"{s.overall}/100",
                s.action,
                kill_flag,
                _lowest_component(s),
            ]
        )
    print(
        md_table(
            ["Ticker", "Bucket", "Overall", "Action", "Kill", "Weakest"],
            table_rows,
        )
    )

    # Per-thesis component detail
    print()
    print("## Component Detail")
    for m, s, notes in rows:
        print()
        print(f"### {m.ticker} — {s.overall}/100 → {s.action}")
        print()
        print(
            md_table(
                ["Component", "Weight", "Score", "Notes"],
                [[c.name, f"{c.weight}%", c.score, c.notes] for c in s.components],
            )
        )
        if notes:
            print()
            print("_changes this run:_")
            for n in notes:
                print(f"- {n}")

    print()
    print(
        footer(
            source_lines=[
                "Regime: clarion-regime-check",
                "Prices: yfinance via EquityStore",
                "Framework: docs/ALLOCATION-POLICY.md, docs/PRINCIPLES.md",
            ]
        )
    )


def _lowest_component(snap: HealthSnapshot) -> str:
    if not snap.components:
        return ""
    lowest = min(snap.components, key=lambda c: c.score)
    return f"{lowest.name} ({lowest.score})"


# ---- Main ------------------------------------------------------------------


def run(args: argparse.Namespace) -> int:
    troot = theses_root()
    paths = list_theses(troot)
    if args.ticker:
        paths = [p for p in paths if p.stem.upper() == args.ticker.upper()]
    if not paths:
        print(
            "THESIS_MONITOR_ERROR: no theses to monitor. "
            "Check ~/clarion/theses/ or run clarion-thesis-write first."
        )
        return 1

    regime = _resolve_regime()
    if regime is None:
        print(
            "THESIS_MONITOR_ERROR: regime unavailable. "
            "Run clarion-regime-check first to seed the SPY/TLT/RSP cache."
        )
        return 1

    asof = date.today()
    rows: list[tuple[ThesisMetadata, HealthSnapshot, list[str]]] = []
    malformed: list[Path] = []
    for path in paths:
        try:
            result = _process_thesis(
                path=path,
                regime=regime,
                quick=args.quick,
                write=not args.no_write,
                current_price_override=args.current_price,
                asof=asof,
            )
        except Exception as e:  # noqa: BLE001
            print(
                f"_warning: failed to process {path.name}: {type(e).__name__}: {e}_"
            )
            malformed.append(path)
            continue
        if result is None:
            continue
        rows.append(result)

    if not rows:
        print(
            "THESIS_MONITOR_ERROR: no active theses to monitor "
            "(parsed but all status != active — drafts, watchlist, closed, "
            "and killed theses are skipped — or all malformed)."
        )
        if malformed:
            for p in malformed:
                print(f"  malformed: {p.name}")
        return 1

    _render_dashboard(rows, regime, quick=args.quick, write=not args.no_write)

    if malformed:
        print()
        print("## Malformed Theses (skipped)")
        for p in malformed:
            print(f"- {p.name}")

    return 0


def _opt_float(s: object) -> float | None:
    if s is None or s == "":
        return None
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def _opt_date(s: object) -> date | None:
    if s is None or s == "":
        return None
    if isinstance(s, date):
        return s
    try:
        return date.fromisoformat(str(s))
    except ValueError:
        return None


def main() -> int:
    ap = argparse.ArgumentParser(prog="clarion-thesis-monitor")
    ap.add_argument(
        "--ticker",
        default=None,
        help="Process only this ticker (default: all active theses).",
    )
    ap.add_argument(
        "--quick",
        action="store_true",
        help="Quick mode: kill checks + Risk Environment recompute only. Skip full re-scoring.",
    )
    ap.add_argument(
        "--no-write",
        action="store_true",
        help="Preview the dashboard without writing back to thesis files.",
    )
    ap.add_argument(
        "--current-price",
        type=float,
        default=None,
        help="Override current price (single-thesis mode). For Valuation Safety re-scoring.",
    )
    args = ap.parse_args()
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
