"""PageIndex tree builder for sec-edgar.

Builds a hierarchical tree index from SEC filing Markdown:
1. Extract nodes (h1–h6 headings = section boundaries)
2. Merge child text into parent for token counting
3. Thin very small nodes into their parents
4. Build hierarchical tree structure
5. Attach summaries (three-tier: raw / extractive / LLM)

Three-tier summary strategy:
  - < extractive_threshold tokens  → raw text as summary (fast, no LLM call)
  - extractive_threshold – summary_token_threshold → TF-IDF extractive summary
  - > summary_token_threshold       → MiniMax abstractive summary (caller's job)

This module handles steps 1–4. LLM summarization is done by llm.py.
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import logging
import re
from typing import Any
from pathlib import Path

from Skills.sec_edgar.scripts.utils import count_tokens

logger = logging.getLogger("sec-edgar")

# SEC form types that always get full tree indexing (not raw storage)
FULL_INDEX_FORMS = frozenset({
    "10-K", "10-Q", "S-1", "S-3", "S-4", "S-11",
    "20-F", "40-F", "DEF 14A", "DEFA14A", "DEF 14C",
    "6-K", "F-1", "F-3", "F-4", "N-CSR", "N-CSRS", "ARS",
})

# If a form exceeds this token count, force full indexing even if normally raw
RAW_INDEX_TOKEN_LIMIT = 15_000

_FORM_RE = re.compile(r"^[A-Z0-9.-]+?_(.+?)_\d{8}_")


def _normalize_form(form: str) -> str:
    form = form.strip()
    # Handle _A suffix (filename-safe /A) before the /A check
    if form.endswith("_A"):
        form = form[:-2] + "/A"
    if form.endswith("/A"):
        form = form[:-2]
    if form.startswith("Form "):
        form = form[5:]
    form = re.sub(r"^DEF_?14A$", "DEF 14A", form)
    return form


def _extract_form_type(filename: str) -> str | None:
    stem = Path(filename).stem
    if "--" in stem:
        parts = stem.split("--")
        if len(parts) >= 2:
            return _normalize_form(parts[1].strip())
    m = re.match(r"^.+?_(.+?)_(\d{8}|\?|\d{15})_", stem)
    if m:
        return _normalize_form(m.group(1))
    return None


def _should_full_index(form: str | None, token_count: int) -> bool:
    """Decide whether a filing needs full tree indexing.

    Returns True when:
    - form is unknown (None) — be safe, do full indexing
    - normalized form is in FULL_INDEX_FORMS allowlist
    - token count exceeds RAW_INDEX_TOKEN_LIMIT (safety net)
    """
    if form is None:
        return True
    normalized = _normalize_form(form)
    if normalized.upper() in {f.upper() for f in FULL_INDEX_FORMS}:
        return True
    if token_count > RAW_INDEX_TOKEN_LIMIT:
        logger.info(f"Form '{form}' over token limit ({token_count} > {RAW_INDEX_TOKEN_LIMIT}), using full indexing")
        return True
    return False


# ── Markdown → flat node list ──────────────────────────────────────────────────

def extract_nodes(markdown_content: str) -> tuple[list[dict], list[str]]:
    """Extract sections from markdown as a flat ordered list of nodes.

    Returns (nodes, lines) where nodes is [{title, line_num, level}] and
    lines is the markdown split into lines.
    """
    header_pattern = re.compile(r"^(#{1,6})\s+(.+)$")
    code_block_pattern = re.compile(r"^```")
    node_list = []
    lines = markdown_content.split("\n")
    in_code_block = False

    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.match(code_block_pattern, stripped):
            in_code_block = not in_code_block
            continue
        if not stripped or in_code_block:
            continue
        m = re.match(header_pattern, stripped)
        if m:
            node_list.append({
                "node_title": m.group(2).strip(),
                "line_num": line_num,
            })
    return node_list, lines


def extract_text_for_nodes(node_list: list[dict], markdown_lines: list[str]) -> list[dict]:
    """Attach text content to each node, bounded by next node or end of doc."""
    all_nodes = []
    for node in node_list:
        line_content = markdown_lines[node["line_num"] - 1]
        header_match = re.match(r"^(#{1,6})", line_content)
        if header_match is None:
            continue

        processed = {
            "title": node["node_title"],
            "line_num": node["line_num"],
            "level": len(header_match.group(1)),
        }
        all_nodes.append(processed)

    for i, node in enumerate(all_nodes):
        start = node["line_num"] - 1
        end = all_nodes[i + 1]["line_num"] - 1 if i + 1 < len(all_nodes) else len(markdown_lines)
        node["text"] = "\n".join(markdown_lines[start:end]).strip()

    return all_nodes


# ── Token counting + thinning ─────────────────────────────────────────────────

def compute_node_token_counts(node_list: list[dict]) -> list[dict]:
    """Merge child text into parent and compute total token counts per node."""
    result = list(node_list)

    for i in range(len(result) - 1, -1, -1):
        current_level = result[i]["level"]
        total_text = result[i].get("text", "")

        # Collect all children (direct and indirect)
        for j in range(i + 1, len(result)):
            if result[j]["level"] <= current_level:
                break
            child_text = result[j].get("text", "")
            if child_text:
                total_text += "\n\n" + child_text

        result[i]["text_token_count"] = count_tokens(total_text)

    return result


def thin_nodes(node_list: list[dict], min_token_threshold: int) -> list[dict]:
    """Merge very small nodes into their parents.

    Nodes below min_token_threshold have their text merged into the nearest
    ancestor node, then are removed.
    """
    if min_token_threshold <= 0:
        return node_list

    result = list(node_list)
    to_remove: set[int] = set()

    for i in range(len(result) - 1, -1, -1):
        if i in to_remove:
            continue
        if result[i].get("text_token_count", 0) < min_token_threshold:
            current_level = result[i]["level"]
            parent_text = result[i].get("text", "")

            # Find children to absorb
            for j in range(i + 1, len(result)):
                if result[j]["level"] <= current_level:
                    break
                if j not in to_remove:
                    child_text = result[j].get("text", "")
                    if child_text.strip():
                        if parent_text:
                            parent_text += "\n\n"
                        parent_text += child_text
                    to_remove.add(j)

            result[i]["text"] = parent_text
            result[i]["text_token_count"] = count_tokens(parent_text)

    return [node for idx, node in enumerate(result) if idx not in to_remove]


# ── Build tree ────────────────────────────────────────────────────────────────────

def build_tree(node_list: list[dict]) -> list[dict[str, Any]]:
    """Convert flat ordered node list into a hierarchical tree.

    Uses a stack to track the current parent at each heading level.
    Each node gets a zero-padded node_id (0001, 0002, ...).
    """
    if not node_list:
        return []

    tree: list[dict[str, Any]] = []
    stack: list[tuple[dict[str, Any], int]] = []  # (node, level)
    node_counter = 1

    for node in node_list:
        level = node["level"]
        tree_node: dict[str, Any] = {
            "title": node["title"],
            "node_id": str(node_counter).zfill(4),
            "text": node.get("text", ""),
            "line_num": node["line_num"],
            "nodes": [],
        }
        node_counter += 1

        while stack and stack[-1][1] >= level:
            stack.pop()

        if not stack:
            tree.append(tree_node)
        else:
            stack[-1][0]["nodes"].append(tree_node)

        stack.append((tree_node, level))

    return tree


def clean_tree(tree_nodes: list[dict]) -> list[dict]:
    """Remove internal-only fields (line_num) from output tree nodes."""
    def clean(node: dict) -> dict:
        result = {
            "node_id": node["node_id"],
            "title": node["title"],
            "text": node["text"],
        }
        if node.get("summary"):
            result["summary"] = node["summary"]
        if node.get("prefix_summary"):
            result["prefix_summary"] = node["prefix_summary"]
        if node.get("nodes"):
            result["nodes"] = [clean(n) for n in node["nodes"]]
        return result

    return [clean(node) for node in tree_nodes]


# ── Apply summaries ─────────────────────────────────────────────────────────────

def apply_summaries(
    tree: list[dict],
    summary_map: dict[str, str],
    extractive_threshold: int,
) -> list[dict]:
    """Attach summaries to tree nodes.

    - Leaf nodes: use summary_map[node_id] or raw text
    - Parent nodes: use prefix_summary from summary_map[node_id] or raw text
    - Nodes below extractive_threshold: raw text (caller handles inline)
    """
    node_map: dict[str, dict] = {}

    def index_tree(nodes: list[dict]) -> None:
        for node in nodes:
            node_map[node["node_id"]] = node
            if node.get("nodes"):
                index_tree(node["nodes"])

    index_tree(tree)

    def apply(node: dict) -> None:
        nid = node["node_id"]
        text = node.get("text", "")
        token_count = count_tokens(text)

        # Determine which summary to use
        if token_count < extractive_threshold:
            # Small node: raw text is the summary
            node["summary"] = text[:300] + ("..." if len(text) > 300 else "")
            node["_summary_mode"] = "raw"
        elif nid in summary_map:
            # LLM-generated summary
            node["summary"] = summary_map[nid]
            node["_summary_mode"] = "llm"
        else:
            node["summary"] = text[:300] + ("..." if len(text) > 300 else "")
            node["_summary_mode"] = "raw"

        # Parent nodes get prefix_summary (summary of section + all children)
        if node.get("nodes"):
            child_summaries = []
            for child in node["nodes"]:
                child_sum = child.get("summary", "")
                if child_sum:
                    child_summaries.append(child_sum)
            if node.get("prefix_summary"):
                node["prefix_summary"] = node["prefix_summary"]
            else:
                node["prefix_summary"] = node["summary"]

        if node.get("nodes"):
            for child in node["nodes"]:
                apply(child)

    for node in tree:
        apply(node)

    return tree


# ── Main entry point ───────────────────────────────────────────────────────────

def markdown_to_tree(
    markdown_content: str,
    doc_name: str,
    extractive_threshold: int = 2000,
    thinning_threshold: int = 0,
) -> dict[str, Any]:
    """Build a PageIndex tree from SEC filing Markdown.

    Args:
        markdown_content: The HTML-converted markdown string
        doc_name: Document name (used in tree metadata)
        extractive_threshold: Nodes below this token count use raw text as summary
        thinning_threshold: Nodes below this token count are merged into parents (0=disabled)

    Returns:
        {
            "doc_name": str,
            "doc_description": str,
            "index_mode": "tree" | "raw",
            "structure": [node, ...],
        }
    """
    node_list, lines = extract_nodes(markdown_content)
    if not node_list:
        # No headings found — return raw single-node
        return {
            "doc_name": doc_name,
            "doc_description": f"{doc_name} (raw-stored, no hierarchical index)",
            "index_mode": "raw",
            "structure": [{
                "node_id": "0000",
                "title": doc_name,
                "summary": markdown_content[:300] + ("..." if len(markdown_content) > 300 else ""),
                "text": markdown_content,
            }],
        }

    nodes_with_text = extract_text_for_nodes(node_list, lines)
    nodes_with_text = compute_node_token_counts(nodes_with_text)

    if thinning_threshold > 0:
        nodes_with_text = thin_nodes(nodes_with_text, thinning_threshold)

    tree = build_tree(nodes_with_text)

    # Generate doc_description from top-level headings
    top_headings = [n["title"] for n in tree[:5]]
    doc_description = f"{doc_name} — " + "; ".join(top_headings)

    return {
        "doc_name": doc_name,
        "doc_description": doc_description,
        "index_mode": "tree",
        "structure": clean_tree(tree),
    }
