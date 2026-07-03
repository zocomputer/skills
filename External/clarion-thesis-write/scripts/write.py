#!/usr/bin/env python3
"""Clarion thesis-write — scaffold a new thesis for a ticker.

Generates a markdown thesis at ~/clarion/theses/{TICKER}.md following the
canonical Clarion format. Pre-fills the YAML metadata block, seeds the
History with an OPENED entry, and (when secrag has indexed filings) seeds
the "Why I Believe It" section with draft citations from the Buffett lens.

The script does not write the thesis prose — that's the human's job. The
SKILL.md instructs Zo to walk the user through the TODO sections after
the file is generated.

Usage:
    python write.py NVDA
    python write.py NVDA --bucket yolo
    python write.py NVDA --opened 2024-08-01
    python write.py NVDA --force
    python write.py NVDA --no-lens         # skip lens pre-population
    python write.py NVDA --no-fundamentals # skip yfinance pre-population
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date
from pathlib import Path

from ai_buffett_zo.evaluation import (
    Fundamentals,
    LensView,
    fetch_fundamentals,
    view as lens_view,
)
from ai_buffett_zo.secrag import DEFAULT_SEC_ROOT, list_indexed
from ai_buffett_zo.theses import (
    DEFAULT_HEALTH_WEIGHTS,
    DEFAULT_THESES_ROOT,
    HEALTH_COMPONENT_NAMES,
    Bucket,
    thesis_path,
)


def theses_root() -> Path:
    return Path(os.environ.get("CLARION_THESES_ROOT") or DEFAULT_THESES_ROOT)


def sec_root() -> Path:
    return Path(os.environ.get("CLARION_SEC_ROOT") or DEFAULT_SEC_ROOT)


# ---- Template rendering ----------------------------------------------------


_TEMPLATE = """\
# Thesis: {ticker} — [TODO one-line thesis summary]

---

## Metadata

```yaml
ticker: {ticker}
company: {company}
bucket: {bucket}
status: draft
opened: {opened}
last_reviewed:
health_score:  # Set by clarion-thesis-monitor on first run
cost_basis:
shares: 0
portfolio_weight:
```

---

## Core Thesis

### What I Believe

[TODO 1-3 paragraphs stating the core investment claim. What is the insight \
the market is missing or underweighting? Be specific — "this is cheap" is not \
a thesis.]

### Why I Believe It (Evidence)

{evidence_section}

### What's It Worth (Valuation)

**Primary method**: [TODO DCF / Multiples / Asset-based / Sum-of-parts]

| Scenario | Assumptions | Fair Value | Upside/Downside |
|----------|------------|------------|-----------------|
| Bear | [TODO] | $[TODO] | [TODO]% |
| Base | [TODO] | $[TODO] | [TODO]% |
| Bull | [TODO] | $[TODO] | [TODO]% |

**Current price**: ${current_price} as of {asof}
**Margin of safety**: [TODO]% (base case fair value vs current price)

### Why Now (Catalyst / Patience Rationale)

[TODO What causes the market to re-rate this? Or if no near-term catalyst, \
why is patience the right approach?]

---

## Kill Conditions

| # | Kill Condition | How to Monitor | Last Checked |
|---|---------------|----------------|--------------|
| 1 | [TODO Specific, measurable condition] | [TODO MCP tool or data source] | |
| 2 | [TODO Specific, measurable condition] | [TODO MCP tool or data source] | |
| 3 | [TODO Specific, measurable condition] | [TODO MCP tool or data source] | |

**Hard rule**: Kill conditions are written when the thesis is fresh and \
conviction is high. They exist precisely for the moments when conviction \
wavers and you need an objective framework. Do not weaken kill conditions \
retroactively.

---

## Health Scoring

| Component | Weight | Current Score | Notes |
|-----------|--------|---------------|-------|
{health_rows}
| **Overall** | **100%** | **0** | |

### Score → Action Mapping

| Score Range | Action | Description |
|-------------|--------|-------------|
| 0-39 | **EXIT** | Thesis is broken. Close position. |
| 40-54 | **REDUCE** | Thesis weakening. Trim to minimum. |
| 55-74 | **HOLD** | Thesis intact. Maintain position. |
| 75-100 | **ADD** | Thesis strong. Add on dips to fair value. |

---

## Position Management

### Sizing Rules
- **Max position size**: [TODO % of portfolio per ALLOCATION-POLICY.md limits]
- **Current size**: [TODO % of portfolio]
- **Target size**: [TODO % of portfolio]

### Entry/Exit Levels
- **Add zone**: Below $[TODO]
- **Full position at**: $[TODO]
- **Trim zone**: Above $[TODO]
- **Exit at**: $[TODO]
- **Stop loss**: [TODO $XX or N/A if thesis-based exit only]

### Options Strategy (if applicable)

[TODO Describe any options overlay — put selling, covered calls, LEAPS, \
spreads. Include strike selection criteria, DTE targets, position limits.]

---

## Monitoring Schedule

| Check | Frequency | Tool/Source | Last Run |
|-------|-----------|-------------|----------|
| Price vs levels | Daily | yfinance via EquityStore | |
| Kill conditions | Weekly | varies per condition | |
| Filing changes | On filing | clarion-sec-research | |
| Insider activity | Weekly | WebSearch (Form 4) | |
| Health score update | Monthly | clarion-thesis-monitor | |
| Thesis review | Quarterly | Re-read thesis, update evidence | |

---

## History

| Date | Event | Detail |
|------|-------|--------|
| {opened} | OPENED | [TODO Initial thesis written. Entry price $XX.] |

---

## Notes

[TODO Free-form space for observations, pattern recognition, or context that \
doesn't fit the structure above. Date each entry.]
"""


def _health_rows() -> str:
    """Render the health scoring table rows with default weights and zero scores."""
    rows = []
    for name in HEALTH_COMPONENT_NAMES:
        weight = DEFAULT_HEALTH_WEIGHTS[name]
        rows.append(f"| {name} | {weight}% | 0 | |")
    return "\n".join(rows)


def _evidence_section(lens: list[LensView] | None) -> str:
    """Compose the 'Why I Believe It' draft from lens hits, or a TODO if none."""
    if not lens:
        return (
            "[TODO Numbered list of specific evidence supporting the thesis. "
            "Each item should reference a data source — SEC filing, MCP tool "
            "output, or verified external data.]\n\n"
            "1. [TODO Evidence point] — Source: [filing doc_id, tool output, or URL]\n"
            "2. [TODO Evidence point] — Source: [...]\n"
            "3. [TODO Evidence point] — Source: [...]"
        )

    lines = [
        "*Draft citations from the Buffett-lens search. Replace each with a written claim "
        "supported by the citation; remove any that don't matter for this thesis.*",
        "",
    ]
    n = 1
    for lv in lens:
        if not lv.hits:
            continue
        lines.append(f"**{lv.title} (DRAFT)**")
        for h in lv.hits[:2]:  # cap 2 per dimension to keep section manageable
            lines.append(f"{n}. [TODO claim]. Source: {h.citation}")
            lines.append(f"   > _{h.snippet[:240]}_")
            n += 1
        lines.append("")
    if n == 1:
        # No hits anywhere
        return _evidence_section(None)
    return "\n".join(lines).rstrip()


def render(
    *,
    ticker: str,
    company: str,
    bucket: Bucket,
    opened: date,
    current_price: str,
    asof: str,
    lens: list[LensView] | None,
) -> str:
    return _TEMPLATE.format(
        ticker=ticker,
        company=company or "[TODO Full Company Name]",
        bucket=bucket,
        opened=opened.isoformat(),
        current_price=current_price,
        asof=asof,
        evidence_section=_evidence_section(lens),
        health_rows=_health_rows(),
    )


# ---- Orchestration ---------------------------------------------------------


def run(args: argparse.Namespace) -> int:
    ticker = args.ticker.upper()
    troot = theses_root()
    troot.mkdir(parents=True, exist_ok=True)
    out = thesis_path(troot, ticker)

    if out.exists() and not args.force:
        print(
            f"THESIS_WRITE_ERROR: file already exists at {out}. "
            f"Pass --force to overwrite, or delete the file first."
        )
        return 1

    # Fundamentals — best-effort; non-fatal
    fundamentals: Fundamentals | None = None
    if not args.no_fundamentals:
        try:
            fundamentals = fetch_fundamentals(ticker)
        except Exception as e:  # noqa: BLE001
            print(
                f"_warning: fundamentals fetch failed ({type(e).__name__}: {e}). "
                f"Proceeding without yfinance pre-population._"
            )

    company = (fundamentals.company if fundamentals else "") or ""
    if fundamentals and fundamentals.last_close is not None:
        current_price = f"{fundamentals.last_close:.2f}"
    else:
        current_price = "[TODO]"
    asof = date.today().isoformat()

    # Lens — best-effort; non-fatal
    lens: list[LensView] | None = None
    if not args.no_lens:
        sroot = sec_root()
        indexed = [m for m in list_indexed(sroot) if m.ticker == ticker]
        if not indexed:
            if args.require_indexed:
                print(
                    f"THESIS_WRITE_ERROR: ticker not indexed. "
                    f"Run `clarion-sec-research index {ticker}` first."
                )
                return 1
            print(
                f"_note: no indexed filings for {ticker}; evidence section "
                f"will be a TODO. Consider `clarion-sec-research index {ticker}` "
                f"and re-running with --force._"
            )
        else:
            try:
                lens = lens_view(ticker, sec_root=sroot)
            except Exception as e:  # noqa: BLE001
                print(
                    f"_warning: lens search failed ({type(e).__name__}: {e}). "
                    f"Proceeding without seeded citations._"
                )

    content = render(
        ticker=ticker,
        company=company,
        bucket=args.bucket,
        opened=args.opened,
        current_price=current_price,
        asof=asof,
        lens=lens,
    )
    out.write_text(content)

    print(f"Thesis scaffolded at: {out}")
    print()
    print(
        "Status is `draft` — `clarion-thesis-monitor` will skip drafts to keep "
        "the dashboard signal-clean. Promote to `active` (edit the metadata "
        "block: `status: draft` → `status: active`) once the prose is filled in."
    )
    print()
    print("**Next steps** — fill in the [TODO] sections, in this order:")
    print()
    print("1. Title line — replace `[TODO one-line thesis summary]` with the core insight")
    print("2. **What I Believe** — 1-3 paragraphs of the core investment claim")
    print("3. **Why I Believe It** — replace the DRAFT/TODO citations with written claims")
    print("4. **What's It Worth** — fill in bear/base/bull scenarios with numbers")
    print("5. **Why Now** — catalyst or patience rationale")
    print("6. **Kill Conditions** — at least 3, specific and measurable")
    print("7. Update **Metadata**: `cost_basis`, `shares`, `portfolio_weight` after entry")
    print("8. Promote `status: draft` → `status: active` to enable monitoring")
    print()
    print(
        f"After the prose is in and status is `active`, run: "
        f"`clarion-thesis-monitor --ticker {ticker}` to compute the initial health score."
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="clarion-thesis-write")
    ap.add_argument("ticker", type=str.upper)
    ap.add_argument(
        "--bucket",
        choices=["value", "systematic", "short", "yolo"],
        default="value",
        help="Strategy bucket per docs/ALLOCATION-POLICY.md (default: value).",
    )
    ap.add_argument(
        "--opened",
        type=date.fromisoformat,
        default=date.today(),
        help="Date the position was opened (ISO format YYYY-MM-DD; default: today).",
    )
    ap.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an existing thesis file at the same path.",
    )
    ap.add_argument(
        "--no-lens",
        action="store_true",
        help="Skip the secrag Buffett-lens pre-population.",
    )
    ap.add_argument(
        "--no-fundamentals",
        action="store_true",
        help="Skip the yfinance fundamentals pre-population.",
    )
    ap.add_argument(
        "--require-indexed",
        action="store_true",
        help="Fail if the ticker has no indexed SEC filings. Off by default.",
    )
    args = ap.parse_args()
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
