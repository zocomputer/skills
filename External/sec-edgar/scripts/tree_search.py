

"""Tree search utilities for sec-edgar — shared between search.py and llm.py.

Provides:
- _flatten_nodes: recursive tree flattener
- _build_tree_overview_for_llm: condensed tree for LLM reasoning
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

from typing import Any


def _flatten_nodes(
    structure: list[dict],
    doc_id: str = "",
    doc_name: str = "",
    path: str = "",
) -> list[dict[str, Any]]:
    """Recursively flatten a tree structure into a list of searchable nodes."""
    results = []
    for node in structure:
        if not isinstance(node, dict):
            continue
        title = node.get("title", "")
        node_path = f"{path}/{title}" if path else title
        results.append({
            "doc_id": doc_id,
            "doc_name": doc_name,
            "node_id": node.get("node_id", ""),
            "node_path": node_path,
            "title": title,
            "summary": node.get("summary", node.get("prefix_summary", "")),
            "text": node.get("text", ""),
        })
        for child in node.get("nodes", []):
            results.extend(_flatten_nodes([child], doc_id, doc_name, node_path))
    return results


_NOISE_TITLES = {
    "table of contents", "index", "signatures", "power of attorney",
    "exhibit index", "certifications",
}


def _is_noise_node(node: dict) -> bool:
    """True if node title is generic boilerplate."""
    title = node.get("title", "").strip().lower()
    return title in _NOISE_TITLES


def _build_tree_overview_for_llm(
    structure,
    max_depth: int = 3,
    current_depth: int = 0,
) -> str:
    """Build condensed tree overview for LLM (node_id, title, summary).

    Limits depth to keep context manageable.
    """
    lines = []
    if isinstance(structure, dict):
        structure = [structure]
    if not isinstance(structure, list):
        return ""

    for node in structure:
        if _is_noise_node(node):
            continue

        node_id = node.get("node_id", "")
        title = node.get("title", "Untitled")
        summary = node.get("summary", node.get("prefix_summary", ""))
        indent = "  " * current_depth

        line = f"{indent}[{node_id}] {title}"
        if summary and len(summary) > 20:
            short = summary[:200].replace("\n", " ")
            if len(summary) > 200:
                short += "..."
            line += f" - {short}"
        lines.append(line)

        if "nodes" in node and current_depth < max_depth:
            child_lines = _build_tree_overview_for_llm(node["nodes"], max_depth, current_depth + 1)
            if child_lines:
                lines.append(child_lines)

    return "\n".join(lines)