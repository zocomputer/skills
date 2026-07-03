"""LLM client for sec-edgar — /zo/ask wrapper.

All LLM calls go through the Zo API endpoint:
    POST https://api.zo.computer/zo/ask

With Zo-hosted MiniMax 2.7. No BYO key needed — in-session scripts
read ZO_CLIENT_IDENTITY_TOKEN from the environment automatically.

Two modes:
1. Batched summarization — all section summaries in 1 call per filing
2. Reasoning fallback — tree navigation for weak keyword results

Both use structured output (output_format) for reliable parsing.
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import json
import logging
import os
import time
from typing import Any

import requests

from Skills.sec_edgar.scripts.config import get_llm_model
from Skills.sec_edgar.scripts.tree_search import _flatten_nodes, _build_tree_overview_for_llm

logger = logging.getLogger("sec-edgar")


# ── Constants ─────────────────────────────────────────────────────────────────

ZO_API_URL = "https://api.zo.computer/zo/ask"
ZO_CLIENT_IDENTITY_TOKEN = os.environ.get("ZO_CLIENT_IDENTITY_TOKEN", "")

MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0  # seconds
REQUEST_TIMEOUT = 300  # 5 min for summarization calls


# ── Exceptions ────────────────────────────────────────────────────────────────

class LLMError(Exception):
    """Base exception for LLM failures."""
    pass


class LLMConnectionError(LLMError):
    """Could not reach the Zo API."""
    pass


class LLMAuthError(LLMError):
    """Zo API token missing or invalid."""
    pass


class LLMModelError(LLMError):
    """Configured model ID was rejected."""
    pass


class LLMOutputParseError(LLMError):
    """LLM response was valid JSON but didn't match expected schema."""
    pass


# ── Core /zo/ask call ─────────────────────────────────────────────────────────

def _call_zo_ask(
    prompt: str,
    model: str | None = None,
    output_format: dict[str, Any] | None = None,
    conversation_id: str | None = None,
    timeout: int = REQUEST_TIMEOUT,
) -> dict[str, Any]:
    """Make a single request to the Zo /zo/ask endpoint.

    Returns the parsed JSON response dict.

    Raises:
        LLMAuthError — if ZO_CLIENT_IDENTITY_TOKEN is missing
        LLMConnectionError — if the API is unreachable or returns 5xx
        LLMModelError — if the model_id is rejected (400 from API)
        LLMError — on other errors
    """
    token = ZO_CLIENT_IDENTITY_TOKEN
    if not token:
        raise LLMAuthError(
            "ZO_CLIENT_IDENTITY_TOKEN is not set. "
            "This script must run inside a Zo session."
        )

    resolved_model = model or get_llm_model()

    payload: dict[str, Any] = {
        "input": prompt,
        "model_name": resolved_model,
    }
    if output_format is not None:
        payload["output_format"] = output_format
    if conversation_id is not None:
        payload["conversation_id"] = conversation_id

    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                ZO_API_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
                timeout=timeout,
            )

            if resp.status_code == 401:
                raise LLMAuthError(f"Zo API auth failed (401). Check ZO_CLIENT_IDENTITY_TOKEN.")
            if resp.status_code == 400:
                body = resp.json() if resp.content else {}
                msg = body.get("error", resp.text)
                raise LLMModelError(f"Model rejected request (400): {msg}")
            if resp.status_code >= 500:
                raise LLMConnectionError(f"Zo API server error {resp.status_code}: {resp.text}")

            resp.raise_for_status()
            result = resp.json()

            # output is a string; if output_format was specified it may be a dict
            output = result.get("output", "")
            if isinstance(output, str):
                try:
                    output = json.loads(output)
                except json.JSONDecodeError:
                    pass

            return output if isinstance(output, dict) else {"text": output}

        except (LLMConnectionError, LLMAuthError, LLMModelError):
            raise
        except Exception as e:
            last_error = e
            if attempt < MAX_RETRIES - 1:
                wait = (RETRY_BACKOFF_BASE ** (attempt + 1)) + time.time() % 1
                logger.warning(f"/zo/ask attempt {attempt+1} failed: {e}. Retrying in {wait:.1f}s...")
                time.sleep(wait)
                continue
            raise LLMError(f"/zo/ask failed after {MAX_RETRIES} attempts: {e}") from last_error

    raise LLMError("unreachable") from last_error


# ── Batched summarization ──────────────────────────────────────────────────────

SUMMARIZE_OUTPUT_FORMAT = {
    "type": "object",
    "properties": {
        "summaries": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "node_id": {"type": "string"},
                    "summary": {"type": "string"},
                },
                "required": ["node_id", "summary"],
            },
        }
    },
    "required": ["summaries"],
}


def generate_summaries(
    tree_structure: list[dict],
    doc_name: str,
    summary_token_threshold: int = 5000,
    extractive_threshold: int = 2000,
) -> dict[str, str]:
    """Generate summaries for all sections in a filing using batched /zo/ask.

    Sends all eligible nodes in ONE /zo/ask call with structured output.
    Small nodes (< extractive_threshold tokens) are handled by the caller
    without an LLM call.

    Args:
        tree_structure: Full node tree from tree_builder (with node_id, title, text)
        doc_name: Document name for prompt context
        summary_token_threshold: Tokens above this use LLM summary
        extractive_threshold: Tokens above this use extractive; below = raw text

    Returns:
        Dict mapping node_id -> summary string (including nodes handled inline)
    """
    from Skills.sec_edgar.scripts.utils import count_tokens

    # Flatten tree and identify eligible nodes
    nodes = _flatten_nodes(tree_structure)
    eligible = []  # nodes that need an LLM call

    for node in nodes:
        text = node.get("text", "")
        token_count = count_tokens(text)
        if token_count >= summary_token_threshold:
            eligible.append(node)

    if not eligible:
        logger.info("No nodes eligible for LLM summarization — all below threshold")
        return {node["node_id"]: node.get("text", "")[:300] + "..." for node in nodes}

    # Build prompt
    sections_md = []
    for node in eligible:
        text = node.get("text", "")
        token_count = count_tokens(text)
        sections_md.append(
            f"### {node['node_id']}: {node['title']}\n"
            f"(~{token_count} tokens)\n"
            f"{text[:8000]}\n"
            f"[...truncated if needed]"
        )

    prompt = (
        f"You are a financial document analysis system. Generate concise summaries for "
        f"each section of the SEC filing '{doc_name}' below.\n\n"
        f"For each section, produce a 2-4 sentence summary that captures the key points. "
        f"Focus on: what happened, key numbers mentioned, and any material risks or changes.\n\n"
        + "\n\n---\n\n".join(sections_md)
        + "\n\n"
        "Return a JSON object with a 'summaries' key, each entry containing "
        "'node_id' and 'summary'. Match the node_ids exactly."
    )

    logger.info(f"Generating summaries for {len(eligible)} nodes in 1 batched /zo/ask call")
    start = time.time()

    try:
        result = _call_zo_ask(
            prompt=prompt,
            output_format=SUMMARIZE_OUTPUT_FORMAT,
            timeout=REQUEST_TIMEOUT,
        )
        summaries_dict = {item["node_id"]: item["summary"] for item in result.get("summaries", [])}
        elapsed = time.time() - start
        logger.info(f"Batched summarization done in {elapsed:.1f}s, {len(summaries_dict)} results")
        return summaries_dict
    except LLMError as e:
        logger.error(f"LLM summarization failed: {e}")
        # Fall back to raw text for all eligible nodes
        return {node["node_id"]: node.get("text", "")[:300] + "..." for node in eligible}


# ── Reasoning fallback ────────────────────────────────────────────────────────

REASONING_OUTPUT_FORMAT = {
    "type": "object",
    "properties": {
        "selected_node_ids": {
            "type": "array",
            "items": {"type": "string"},
        },
        "reasoning": {"type": "string"},
    },
    "required": ["selected_node_ids"],
}


def reasoning_search(
    query: str,
    tree_structure: list[dict],
    doc_name: str,
    max_results: int = 5,
) -> list[str]:
    """Use LLM to navigate the document tree and find nodes relevant to query.

    Called when keyword search score is below threshold (< 3).

    Args:
        query: User's search query
        tree_structure: Full node tree from tree_builder
        doc_name: Document name for prompt context
        max_results: Maximum node_ids to return

    Returns:
        List of node_ids selected by the LLM
    """
    from Skills.sec_edgar.scripts.tree_search import _build_tree_overview_for_llm

    tree_overview = _build_tree_overview_for_llm(tree_structure)

    prompt = (
        f"USER QUERY: {query}\n\n"
        f"DOCUMENT: {doc_name}\n\n"
        f"DOCUMENT STRUCTURE:\n{tree_overview}\n\n"
        "INSTRUCTIONS:\n"
        "1. Analyze the query to understand what information is needed\n"
        "2. Review the document tree structure above\n"
        "3. Identify the most relevant node_ids that likely contain the answer\n"
        f"4. Return at most {max_results} node_ids\n"
        "5. Prioritize the most relevant nodes\n"
        "6. If no sections seem relevant, return an empty list\n\n"
        "Return a JSON object with 'selected_node_ids' (array of node_id strings) "
        "and 'reasoning' (brief explanation of why these nodes were chosen)."
    )

    logger.info(f"LLM reasoning fallback for query: {query[:50]}...")

    try:
        result = _call_zo_ask(
            prompt=prompt,
            output_format=REASONING_OUTPUT_FORMAT,
            timeout=120,
        )
        node_ids = result.get("selected_node_ids", [])
        elapsed = getattr(result, "_elapsed", "N/A")
        logger.info(f"LLM reasoning returned {len(node_ids)} nodes: {node_ids}")
        return node_ids
    except LLMError as e:
        logger.error(f"LLM reasoning fallback failed: {e}")
        return []


# ── Helpers ────────────────────────────────────────────────────────────────────

def verify_model(model: str | None = None) -> dict[str, Any]:
    """Smoke-test /zo/ask to verify the model is accessible.

    Returns the API response dict on success.

    Raises:
        LLMAuthError — token missing
        LLMConnectionError — API unreachable
        LLMModelError — model rejected
    """
    prompt = "Reply with exactly: {\"ok\": true, \"model\": \"<model name>\"}"
    return _call_zo_ask(prompt=prompt, model=model, timeout=30)
