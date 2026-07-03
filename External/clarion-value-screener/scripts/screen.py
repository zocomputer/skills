#!/usr/bin/env python3
"""Clarion value screener — Stage 1 of the AWB two-stage pipeline.

Computes the 8-factor composite, applies regime-tightened thresholds and
sector cap, writes a watchlist markdown file. Stage 2 (filing-level deep
dive + thesis starters) is delegated to clarion-single-stock-eval per
top candidate.

Two input modes:

  --tickers NVDA,AAPL,ADBE,...
        Fetch fundamentals for each ticker via yfinance. Sector pulled
        from yfinance .info. Fewer fields than a screener-site source
        (no ROIC, no insider %), so the composite uses partial data.

  --input candidates.json
        Use a chat-agent-prepared JSON file (full schema in SKILL.md).
        Best for full S&P 500 screens via WebFetch on a screener site.

Usage:
    python screen.py --tickers NVDA,AAPL,ADBE
    python screen.py --input ~/clarion/queue/screen-input.json
    python screen.py --tickers NVDA,AAPL --rf-rate-pct 4.45 --sp500-cape 35.2
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from ai_buffett_zo.data import EquityStore
from ai_buffett_zo.evaluation import fetch_fundamentals
from ai_buffett_zo.macro import fetch_3mo_yield
from ai_buffett_zo.regime import HURDLE_PREMIUM_PCT, RegimeSnapshot, snapshot
from ai_buffett_zo.screener import (
    DEFAULT_WATCHLIST_ROOT,
    Candidate,
    ScreenContext,
    apply_sector_cap,
    render_watchlist,
    score_and_rank,
    watchlist_path,
)


def watchlist_root() -> Path:
    return Path(os.environ.get("CLARION_WATCHLIST_ROOT") or DEFAULT_WATCHLIST_ROOT)


# ---- Context resolution ---------------------------------------------------


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


def _resolve_rf(args: argparse.Namespace) -> float | None:
    if args.rf_rate_pct is not None:
        return float(args.rf_rate_pct)
    y = fetch_3mo_yield()
    return y.rate_pct if y is not None else None


def _build_context_from_args(
    args: argparse.Namespace,
    *,
    regime: RegimeSnapshot,
    rf_rate_pct: float | None,
) -> ScreenContext:
    hurdle = (
        rf_rate_pct + HURDLE_PREMIUM_PCT[regime.color]
        if rf_rate_pct is not None
        else None
    )
    return ScreenContext(
        screen_date=args.screen_date or date.today(),
        regime_color=regime.color,
        danger_state=(regime.color == "danger"),
        rf_rate_pct=rf_rate_pct,
        hurdle_rate_pct=hurdle,
        sp500_cape=args.sp500_cape,
        sp500_trailing_pe=args.sp500_trailing_pe,
        implied_return_low_pct=args.implied_return_low_pct,
        implied_return_high_pct=args.implied_return_high_pct,
        universe=args.universe,
        notes=args.notes or "",
    )


def _context_from_json(blob: dict) -> ScreenContext:
    ctx = blob.get("context", {})
    return ScreenContext(
        screen_date=date.fromisoformat(blob.get("screen_date") or date.today().isoformat()),
        regime_color=ctx.get("regime_color", "orange"),
        danger_state=bool(ctx.get("danger_state", False)),
        rf_rate_pct=_opt_float(ctx.get("rf_rate_pct")),
        hurdle_rate_pct=_opt_float(ctx.get("hurdle_rate_pct")),
        sp500_cape=_opt_float(ctx.get("sp500_cape")),
        sp500_trailing_pe=_opt_float(ctx.get("sp500_trailing_pe")),
        implied_return_low_pct=_opt_float(ctx.get("implied_return_low_pct")),
        implied_return_high_pct=_opt_float(ctx.get("implied_return_high_pct")),
        universe=ctx.get("universe", "S&P 500"),
        notes=ctx.get("notes", ""),
    )


# ---- Candidate gathering --------------------------------------------------


def _candidates_from_tickers(tickers: list[str]) -> list[Candidate]:
    """Fetch yfinance fundamentals for each ticker, build Candidate list.

    yfinance lacks ROIC and insider %, so those stay None — the composite
    formula's contributing_weight will reflect the partial data.
    """
    out: list[Candidate] = []
    for ticker in tickers:
        ticker = ticker.upper().strip()
        if not ticker:
            continue
        try:
            f = fetch_fundamentals(ticker)
        except Exception as e:  # noqa: BLE001
            print(f"_warning: yfinance fetch failed for {ticker}: {type(e).__name__}: {e}_")
            continue
        sector = _sector_for(ticker) or "Unknown"
        # yfinance debtToEquity is reported as a percent (e.g. 25.0 = 0.25 D/E)
        de_normalized = (f.debt_to_equity / 100) if f.debt_to_equity is not None else None
        # P/FCF computed from market_cap / FCF when both available
        pfcf = (
            f.market_cap / f.free_cash_flow
            if f.market_cap is not None and f.free_cash_flow not in (None, 0)
            else None
        )
        out.append(
            Candidate(
                ticker=ticker,
                company=f.company,
                sector=sector,
                pe=f.trailing_pe,
                pfcf=pfcf,
                roe=f.return_on_equity,
                roic=None,
                op_margin=f.operating_margin,
                profit_margin=f.profit_margin,
                de=de_normalized,
                insider_pct=None,
                market_cap=f.market_cap,
                price=f.last_close,
            )
        )
    return out


def _sector_for(ticker: str) -> str | None:
    """Best-effort sector lookup via yfinance .info. Non-fatal on failure."""
    try:
        import yfinance as yf

        info = yf.Ticker(ticker).info or {}
    except Exception:  # noqa: BLE001
        return None
    return info.get("sector")


def _candidates_from_json(blob: dict) -> list[Candidate]:
    raw = blob.get("candidates") or []
    out: list[Candidate] = []
    for r in raw:
        if "ticker" not in r:
            continue
        out.append(
            Candidate(
                ticker=r["ticker"].upper(),
                company=r.get("company"),
                sector=r.get("sector", "Unknown"),
                pe=_opt_float(r.get("pe")),
                pfcf=_opt_float(r.get("pfcf")),
                roe=_opt_float(r.get("roe")),
                roic=_opt_float(r.get("roic")),
                op_margin=_opt_float(r.get("op_margin")),
                profit_margin=_opt_float(r.get("profit_margin")),
                de=_opt_float(r.get("de")),
                insider_pct=_opt_float(r.get("insider_pct")),
                market_cap=_opt_float(r.get("market_cap")),
                price=_opt_float(r.get("price")),
            )
        )
    return out


# ---- Main ------------------------------------------------------------------


def run(args: argparse.Namespace) -> int:
    if not args.tickers and not args.input:
        print("SCREEN_ERROR: --tickers or --input required.")
        return 1

    # 1. Build context
    if args.input:
        try:
            blob = json.loads(Path(args.input).expanduser().read_text())
        except FileNotFoundError:
            print(f"SCREEN_ERROR: input file not found: {args.input}")
            return 1
        except json.JSONDecodeError as e:
            print(f"SCREEN_ERROR: input JSON malformed: {e}")
            return 1
        context = _context_from_json(blob)
        candidates = _candidates_from_json(blob)
    else:
        regime = _resolve_regime()
        if regime is None:
            print(
                "SCREEN_ERROR: regime unavailable. "
                "Run clarion-regime-check first to seed the SPY/TLT/RSP cache."
            )
            return 1
        rf_rate_pct = _resolve_rf(args)
        context = _build_context_from_args(args, regime=regime, rf_rate_pct=rf_rate_pct)
        candidates = _candidates_from_tickers(args.tickers.split(","))

    if not candidates:
        print("SCREEN_ERROR: no candidates after fetching. Check tickers / input.")
        return 1

    # 2. Score + rank + sector cap
    ranked = score_and_rank(candidates, regime_color=context.regime_color)
    cap_result = apply_sector_cap(ranked, target_size=args.top_size)

    # 3. Render + save
    out_dir = watchlist_root()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = watchlist_path(out_dir, context.screen_date)
    rendered = render_watchlist(
        context=context,
        ranked=ranked,
        cap_result=cap_result,
    )
    out_path.write_text(rendered)

    # 4. Print summary
    print(f"Wrote {out_path}")
    print()
    print(f"Stage 1: {len(ranked)} candidates ranked. Top {len(cap_result.top)} after sector cap:")
    for i, s in enumerate(cap_result.top, start=1):
        print(
            f"  {i}. {s.candidate.ticker} ({s.candidate.sector}) — score {s.composite:.1f}"
            + (f" · price ${s.candidate.price:.2f}" if s.candidate.price else "")
        )
    if cap_result.sectors_relaxed:
        print()
        print("(sector cap relaxed to 4 per sector — universe genuinely concentrated)")
    print()
    print("Next steps:")
    print(
        "  1. Open the watchlist file and fill the Sniff Test / Passed On / Existing Theses sections"
    )
    print(
        "  2. For each top candidate not already covered: "
        "`clarion-single-stock-eval <TICKER>` for filing-level Buffett-lens evidence"
    )
    print(
        "  3. For names worth a position: `clarion-thesis-write <TICKER>` to scaffold a thesis"
    )
    return 0


def _opt_float(s: object) -> float | None:
    if s is None or s == "":
        return None
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def main() -> int:
    ap = argparse.ArgumentParser(prog="clarion-value-screener")
    ap.add_argument("--tickers", default=None, help="Comma-separated ticker list (yfinance mode).")
    ap.add_argument("--input", default=None, help="Path to JSON input prepared by chat agent.")

    # Context overrides (only used in --tickers mode; --input gets these from JSON)
    ap.add_argument(
        "--screen-date",
        type=date.fromisoformat,
        default=None,
        help="ISO date for the screen (default: today).",
    )
    ap.add_argument("--rf-rate-pct", type=float, default=None)
    ap.add_argument("--sp500-cape", type=float, default=None)
    ap.add_argument("--sp500-trailing-pe", type=float, default=None)
    ap.add_argument("--implied-return-low-pct", type=float, default=None)
    ap.add_argument("--implied-return-high-pct", type=float, default=None)
    ap.add_argument("--universe", default="S&P 500", help="Universe label for the watchlist title.")
    ap.add_argument("--notes", default=None, help="Free-text notes for the Context block.")
    ap.add_argument("--top-size", type=int, default=10, help="Top-N after sector cap.")

    args = ap.parse_args()
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
