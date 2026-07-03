#!/usr/bin/env python3
"""Clarion SEC research — index / search / status.

Subcommands:
    index TICKER [--form FORM]        queue latest filing of FORM (default 10-K).
                                      Common values: 10-K, 10-Q, 8-K, 4 (insider
                                      transactions), 3, 5, S-1, DEF 14A, 20-F.
                                      Any SEC form name works; amendments use /A.
    search "query" [--tickers ...] [--sections ...] [--top-k N]
    status TICKER                     show indexing state for a ticker

Reads from ~/clarion/queue (queue) and ~/clarion/sec (corpus). Override via
$CLARION_QUEUE_ROOT and $CLARION_SEC_ROOT for testing or non-default layouts.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from ai_buffett_zo.indexer import (
    DEFAULT_QUEUE_ROOT,
    IndexRequest,
    enqueue,
    load_status,
)
from ai_buffett_zo.secrag import (
    DEFAULT_SEC_ROOT,
    SearchHit,
    list_indexed,
    search,
)
from ai_buffett_zo.voice import (
    cite_filing,
    footer,
    header,
    md_table,
    no_data,
)


def queue_root() -> Path:
    return Path(os.environ.get("CLARION_QUEUE_ROOT") or DEFAULT_QUEUE_ROOT)


def sec_root() -> Path:
    return Path(os.environ.get("CLARION_SEC_ROOT") or DEFAULT_SEC_ROOT)


# ---- index -----------------------------------------------------------------


def cmd_index(args: argparse.Namespace) -> int:
    qroot = queue_root()
    qroot.mkdir(parents=True, exist_ok=True)
    req = IndexRequest.new(args.ticker, form=args.form)
    path = enqueue(req, root=qroot)

    parts = [
        header(f"Queued — {req.ticker} {req.form}"),
        f"Request ID: `{req.id}`",
        f"Queue path: `{path}`",
        "",
        (
            f"The sec-indexer service will pick this up within a few seconds and "
            f"index the latest {req.form} filing. Indexing typically takes 1-5 "
            f"minutes depending on filing size and model. Check progress with:"
        ),
        "",
        "```",
        f"clarion-sec-research status {req.ticker}",
        "```",
        "",
        footer(),
    ]
    print("\n".join(parts))
    return 0


# ---- search ----------------------------------------------------------------


def cmd_search(args: argparse.Namespace) -> int:
    sroot = sec_root()
    tickers = _split_csv(args.tickers)
    sections = _split_csv(args.sections)

    hits = search(
        args.query,
        root=sroot,
        tickers=tickers,
        section_labels=sections,
        top_k=args.top_k,
    )

    print(header(f'SEC search — "{args.query}"', _query_subtitle(tickers, sections)))

    if not hits:
        print()
        print(no_data("no matches in the indexed corpus."))
        _suggest_indexing(sroot, tickers)
        return 0

    print()
    print(_hits_table(hits))
    print()
    print("**Top results**")
    for i, h in enumerate(hits[: args.top_show], start=1):
        print()
        print(f"### {i}. {cite_filing(h.ticker, h.form, h.filed)} → `{h.path}`")
        print()
        print(f"> {h.snippet}")

    print()
    print(footer(source_lines=[h.citation for h in hits[: args.top_show]]))
    return 0


def _hits_table(hits: list[SearchHit]) -> str:
    rows = [
        [h.ticker, h.form, h.filed, h.section_label, f"{h.score:.0f}"]
        for h in hits
    ]
    return md_table(["Ticker", "Form", "Filed", "Section", "Score"], rows)


def _suggest_indexing(sroot: Path, tickers: list[str] | None) -> None:
    if tickers:
        print()
        print("To index these tickers, run:")
        for t in tickers:
            print(f"```\nclarion-sec-research index {t.upper()}\n```")
    else:
        indexed = list_indexed(sroot)
        if not indexed:
            print()
            print("No filings indexed yet. Index one with:")
            print("```\nclarion-sec-research index <TICKER>\n```")


def _query_subtitle(
    tickers: list[str] | None, sections: list[str] | None
) -> str | None:
    parts: list[str] = []
    if tickers:
        parts.append(f"tickers: {', '.join(tickers)}")
    if sections:
        parts.append(f"sections: {', '.join(sections)}")
    return " · ".join(parts) if parts else None


def _split_csv(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    return [s.strip() for s in raw.split(",") if s.strip()]


# ---- status ----------------------------------------------------------------


def cmd_status(args: argparse.Namespace) -> int:
    sroot = sec_root()
    status = load_status(sroot, args.ticker)

    print(header(f"Indexing status — {status.ticker}"))

    if not status.filings and not status.last_request:
        print()
        print(f"No filings indexed yet for {status.ticker}.")
        print(f"Run: `clarion-sec-research index {status.ticker}`")
        print()
        print(footer())
        return 0

    if status.last_request:
        lr = status.last_request
        print()
        print("**Last request**")
        print(f"- Form: `{lr.get('form', '?')}`")
        print(f"- State: `{lr.get('state', '?')}`")
        print(f"- Updated: `{lr.get('updated_at', '?')}`")
        if lr.get("error"):
            print(f"- Error: `{lr['error']}`")

    if status.filings:
        print()
        print("**Indexed filings**")
        rows = [
            [f.form, f.filed, f.accession, f.indexed_at, f.status]
            for f in status.filings
        ]
        print(md_table(["Form", "Filed", "Accession", "Indexed at", "Status"], rows))

    print()
    print(footer())
    return 0


# ---- main ------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(prog="clarion-sec-research")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_index = sub.add_parser("index", help="Queue a filing for indexing.")
    p_index.add_argument("ticker", type=str.upper)
    p_index.add_argument("--form", default="10-K")
    p_index.set_defaults(func=cmd_index)

    p_search = sub.add_parser("search", help="Search indexed filings by keyword.")
    p_search.add_argument("query")
    p_search.add_argument("--tickers", help="Comma-separated tickers (filter).")
    p_search.add_argument(
        "--sections",
        help=(
            "Comma-separated section labels. For 10-K/10-Q the canonical labels "
            "are: business, risk_factors, mdna, financial_statements. For other "
            "forms (Form 4, 8-K, S-1, DEF 14A, ...) sections are slugified from "
            "each filing's headings — run search without --sections first to see "
            "what's indexed."
        ),
    )
    p_search.add_argument("--top-k", type=int, default=10)
    p_search.add_argument(
        "--top-show",
        type=int,
        default=5,
        help="How many full-snippet entries to render after the table.",
    )
    p_search.set_defaults(func=cmd_search)

    p_status = sub.add_parser("status", help="Show indexing status for a ticker.")
    p_status.add_argument("ticker", type=str.upper)
    p_status.set_defaults(func=cmd_status)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
