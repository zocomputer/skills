

"""Hierarchy-faithful HTML → Markdown converter for SEC EDGAR filings.

Adapted from page-index-rag-course's html_to_markdown.py for sec-edgar.
Preserves document structure so tree_builder.py can build accurate trees.

Key behaviours:
- h1–h6 → #–###### headings
- Bold ALL-CAPS spans (SEC style) → ## headings
- SEC Item/Part/Table patterns → ### headings
- Tables → markdown tables (with optional ## heading for SEC-style tables)
- De-duplicates page-break headers and cover page fragments
- Strips iXBRL, scripts, styles, and hidden elements
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import re
import warnings
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag, XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

# SEC section patterns: Item/Part (10-K/10-Q), Table/Section (Form 3/4), 8-K, etc.
_SEC_HEADING_PATTERN = re.compile(
    r"^\s*("
    r"Part\s+[IVXLCDM]+|"
    r"Item\s+\d+[A-Z]?\.?|"
    r"Item\s+\d+\.\d+|"
    r"Table\s+[IVXLCDM]+|"
    r"Table\s+\d+|"
    r"Section\s+[IVXLCDM]+|"
    r"Section\s+\d+|"
    r"Exhibit\s+(?:Index|\d+)|"
    r"Note\s+\d+|"
    r"Schedule\s+[IVXLCDM\d]+"
    r")\s*",
    re.IGNORECASE,
)

_BLOCK_TAGS = {"p", "div", "li", "td", "th", "blockquote", "pre", "section", "article", "header", "footer"}
_HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}


def _bold_heading_text(tag: Tag) -> str | None:
    """Return heading text if a block contains only a single bold ALL-CAPS child.

    SEC filings use <div><span style="font-weight:bold">HEADING</span></div>
    instead of proper heading tags.
    """
    if tag.name not in ("p", "div"):
        return None

    children = [c for c in tag.children if not (isinstance(c, NavigableString) and not c.strip())]
    if len(children) != 1:
        return None

    child = children[0]
    if not isinstance(child, Tag):
        return None

    is_bold = False
    if child.name in ("b", "strong"):
        is_bold = True
    elif child.name == "span":
        style = child.get("style", "")
        if re.search(r"font-weight\s*:\s*(bold|[7-9]00)", style, re.IGNORECASE):
            is_bold = True

    if not is_bold:
        return None

    text = child.get_text(" ", strip=True)
    if not text or len(text) > 120:
        return None

    alpha = [c for c in text if c.isalpha()]
    if len(alpha) < 3 or not all(c.isupper() for c in alpha):
        return None
    return text


def _is_allcaps_heading(line: str) -> bool:
    """True if line looks like an ALL-CAPS heading (3–120 alpha chars, all uppercase)."""
    if not line or len(line) < 3 or len(line) > 120:
        return False
    if "|" in line or "$" in line:
        return False
    alpha = [c for c in line if c.isalpha()]
    if len(alpha) < 3:
        return False
    return all(c.isupper() for c in alpha)


def _has_block_or_heading_children(tag: Tag) -> bool:
    """True if any direct child is a block or heading tag."""
    return any(
        isinstance(c, Tag) and c.name in (_BLOCK_TAGS | _HEADING_TAGS)
        for c in tag.children
    )


def _element_text(tag: Tag) -> str:
    return tag.get_text(" ", strip=True)


def _table_to_text(table: Tag, out: list[str] | None = None) -> str:
    """Convert a <table> to markdown, optionally emitting SEC headings as ##."""
    rows = []
    header_emitted = False
    md_header_row: list[str] | None = None

    for tr in table.find_all("tr"):
        th_cells = tr.find_all("th")
        if th_cells and not header_emitted:
            header_text = " ".join(th.get_text(" ", strip=True) for th in th_cells)
            if out is not None and (_SEC_HEADING_PATTERN.match(header_text) or len(header_text) < 100):
                lower_text = header_text.lower()
                if any(kw in lower_text for kw in [
                    "table", "section", "non-derivative", "derivative",
                    "securities", "beneficially owned", "title of security",
                ]):
                    out.append(f"## {header_text}\n")
                    header_emitted = True
                    continue

            cells = [th.get_text(" ", strip=True) for th in th_cells]
            if cells and any(c.strip() for c in cells):
                md_header_row = cells
                rows.append("| " + " | ".join(cells) + " |")
                rows.append("| " + " | ".join("---" for _ in cells) + " |")
                header_emitted = True
                continue

        cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
        if cells and any(c.strip() for c in cells):
            if md_header_row is not None:
                rows.append("| " + " | ".join(cells) + " |")
            else:
                rows.append(" | ".join(cells))
    return "\n".join(rows) if rows else ""


def _walk(soup: Tag, out: list[str], state: dict) -> None:
    """Recursively walk DOM, appending markdown lines to out."""
    for child in soup.children:
        if isinstance(child, NavigableString):
            continue
        if not isinstance(child, Tag):
            continue
        name = child.name

        if name in _HEADING_TAGS:
            level = int(name[1])
            prefix = "#" * level
            text = _element_text(child)
            if text:
                out.append(f"{prefix} {text}\n")
                state["has_headings"] = True

        elif name == "table":
            text = _table_to_text(child, out)
            if text:
                out.append(text + "\n")

        elif name in _BLOCK_TAGS:
            if _has_block_or_heading_children(child):
                _walk(child, out, state)
            else:
                bold_text = _bold_heading_text(child)
                if bold_text:
                    out.append(f"## {bold_text}\n")
                    state["has_headings"] = True
                    continue
                text = _element_text(child)
                if text:
                    if _SEC_HEADING_PATTERN.match(text):
                        out.append(f"### {text}\n")
                        state["has_headings"] = True
                    else:
                        if text.startswith("#"):
                            text = "\\" + text
                        out.append(text + "\n")
        else:
            _walk(child, out, state)


def html_to_markdown(html_input: str | Path) -> str:
    """Convert SEC EDGAR HTML to hierarchy-faithful Markdown.

    Args:
        html_input: Either an HTML string or a Path to an .html/.htm file.

    Returns:
        Markdown string suitable for tree_builder.md_to_tree().
    """
    if isinstance(html_input, Path):
        raw = html_input.read_bytes()
        try:
            html_str = raw.decode("utf-8")
        except UnicodeDecodeError:
            html_str = raw.decode("latin-1")
    else:
        html_str = html_input

    soup = BeautifulSoup(html_str, "lxml")

    # Remove script, style, and hidden iXBRL elements
    for tag in soup(["script", "style"]):
        tag.decompose()
    for tag in soup.find_all(style=re.compile(r"display\s*:\s*none", re.IGNORECASE)):
        tag.decompose()

    # Remove repeated TOC navigation headers from page-break layouts
    for h5 in soup.find_all("h5"):
        link = h5.find("a")
        if link and "table of contents" in link.get_text(strip=True).lower():
            h5.decompose()

    body = soup.find("body") or soup
    out: list[str] = []
    state: dict = {"has_headings": False}
    _walk(body, out, state)

    md = "\n".join(line.rstrip() for line in "\n".join(out).splitlines())
    md = md.strip() + "\n" if md.strip() else ""

    # Fallback: if no real h1-h6 found, promote SEC patterns and ALL-CAPS lines
    if md and not state["has_headings"]:
        lines = md.splitlines()
        promoted = []
        for line in lines:
            stripped = line.strip()
            if stripped and _SEC_HEADING_PATTERN.match(stripped):
                promoted.append("## " + stripped)
            elif stripped and _is_allcaps_heading(stripped):
                promoted.append("## " + stripped)
            else:
                promoted.append(line)
        md = "\n".join(promoted).strip() + "\n" if promoted else ""

    # Merge cover page fragments (UNITED STATES, SEC FILING TYPE, etc.) into one heading
    if md:
        lines = md.splitlines()
        scan_limit = min(50, len(lines))
        cover_end = 0
        cover_lines = []
        cover_heading_indices = []
        for i in range(scan_limit):
            stripped = lines[i].strip()
            if not stripped:
                continue
            m = re.match(r"^##\s+(.+)$", stripped)
            if m and len(m.group(1)) <= 60 and _is_allcaps_heading(m.group(1)):
                cover_lines.append(m.group(1))
                cover_heading_indices.append(i)
                cover_end = i + 1
            elif not stripped.startswith("#"):
                continue
            else:
                break

        if len(cover_lines) >= 3:
            merged = " | ".join(cover_lines)
            kept = [lines[j] for j in range(cover_end) if j not in set(cover_heading_indices)]
            remaining = lines[cover_end:]
            md = "\n".join(kept) + f"\n## {merged}\n" + "\n".join(remaining)
            md = md.strip() + "\n" if md.strip() else ""

    # De-duplicate repeated page-break headers (company name, date, "(CONTINUED)")
    if md:
        lines = md.splitlines()
        heading_count: dict[str, int] = {}
        for line in lines:
            m = re.match(r"^(#{1,6})\s+(.+)$", line.strip())
            if m:
                title = m.group(2).strip()
                heading_count[title] = heading_count.get(title, 0) + 1

        repeat_titles = {t for t, c in heading_count.items() if c >= 3}
        if repeat_titles:
            seen_titles: set[str] = set()
            deduped = []
            for line in lines:
                m = re.match(r"^(#{1,6})\s+(.+)$", line.strip())
                if m:
                    title = m.group(2).strip()
                    base = re.sub(r"\s*\(CONTINUED\)\s*$", "", title, flags=re.IGNORECASE)
                    if title in repeat_titles:
                        if title not in seen_titles:
                            seen_titles.add(title)
                            deduped.append(line)
                    elif base != title and base in seen_titles:
                        pass  # skip (CONTINUED) variant
                    else:
                        seen_titles.add(title)
                        seen_titles.add(base)
                        deduped.append(line)
                else:
                    deduped.append(line)
            md = "\n".join(deduped).strip() + "\n" if deduped else ""

    # Escape stray '#' that aren't headings (e.g. "# Indicates a management contract")
    if md:
        lines = md.splitlines()
        escaped = []
        for line in lines:
            if line.startswith("#") and not re.match(r"^#{1,6}\s", line):
                escaped.append("\\" + line)
            else:
                escaped.append(line)
        md = "\n".join(escaped).strip() + "\n" if escaped else ""

    return md
