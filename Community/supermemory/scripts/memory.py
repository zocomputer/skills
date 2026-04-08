#!/usr/bin/env python3
"""Supermemory companion CLI -- commands not covered by the official `npx supermemory` CLI.

Only two commands live here:
  conversation  - Ingest structured messages via v4/conversations (role-attributed, incremental)
  memories      - List extracted memory entries with version history (v4/memories/list)

For everything else, use `npx supermemory`:
  remember, search, profile, forget, update, add, tags, docs, etc.
"""
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone


BASE_URL = "https://api.supermemory.ai"
DEFAULT_CONTAINER = os.environ.get("SUPERMEMORY_TAG", "default")


def get_container(override=None):
    return override or DEFAULT_CONTAINER


def api(method, path, body=None):
    api_key = os.environ.get("SUPERMEMORY_API_KEY", "")
    if not api_key:
        print("ERROR: SUPERMEMORY_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "supermemory-companion/1.0",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            if not raw:
                return {}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if e.fp else ""
        print(f"ERROR: API returned {e.code}: {body_text}", file=sys.stderr)
        sys.exit(1)


def _parse_args(args, spec):
    result = {k: v[1] for k, v in spec.items()}
    i = 0
    while i < len(args):
        matched = False
        for key, (typ, _) in spec.items():
            flag = f"--{key.replace('_', '-')}"
            if args[i] == flag:
                if typ == "bool":
                    result[key] = True
                    i += 1
                elif i + 1 < len(args):
                    val = args[i + 1]
                    if typ == "int":
                        val = int(val)
                    result[key] = val
                    i += 2
                else:
                    i += 1
                matched = True
                break
        if not matched:
            i += 1
    for key, (typ, _) in spec.items():
        if typ == "str_or_stdin" and result[key] is None:
            if not sys.stdin.isatty():
                result[key] = sys.stdin.read().strip()
    return result


def cmd_conversation(args, container_tag):
    parsed = _parse_args(args, {
        "content": ("str_or_stdin", None),
        "id": ("str", None),
        "file": ("str", None),
    })

    messages = None

    if parsed["file"]:
        with open(parsed["file"]) as f:
            data = json.load(f)
            if isinstance(data, list):
                messages = data
            elif isinstance(data, dict) and "messages" in data:
                messages = data["messages"]
            else:
                print("ERROR: File must contain a JSON array of messages or {messages: [...]}", file=sys.stderr)
                sys.exit(1)
    elif parsed["content"]:
        content = parsed["content"]
        try:
            data = json.loads(content)
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict) and "role" in data[0]:
                messages = data
            elif isinstance(data, dict) and "messages" in data:
                messages = data["messages"]
        except (json.JSONDecodeError, TypeError):
            pass
        if messages is None:
            messages = [{"role": "user", "content": content}]
    else:
        print("ERROR: --content, --file, or piped input required", file=sys.stderr)
        sys.exit(1)

    valid_roles = {"user", "assistant", "system", "tool"}
    for msg in messages:
        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
            print("ERROR: Each message must have 'role' and 'content' fields", file=sys.stderr)
            sys.exit(1)
        if msg["role"] not in valid_roles:
            print(f"ERROR: Invalid role '{msg['role']}'. Must be one of: {valid_roles}", file=sys.stderr)
            sys.exit(1)

    conversation_id = parsed["id"] or f"conv-{int(datetime.now(timezone.utc).timestamp())}"

    body = {
        "conversationId": conversation_id,
        "messages": messages,
        "containerTags": [container_tag],
    }

    result = api("POST", "/v4/conversations", body)
    msg_count = len(messages)
    roles = set(m["role"] for m in messages)
    print(f"Conversation ingested to [{container_tag}]. ID: {conversation_id} ({msg_count} messages, roles: {', '.join(sorted(roles))})")
    return result


def cmd_memories(args, container_tag):
    parsed = _parse_args(args, {
        "limit": ("int", 30),
    })

    body = {"containerTags": [container_tag]}

    result = api("POST", "/v4/memories/list", body)
    memories = result.get("memories", result.get("results", []))
    if not memories:
        print(f"No memory entries found in [{container_tag}].")
        return

    limit = parsed["limit"]
    for idx, mem in enumerate(memories[:limit], 1):
        mem_id = mem.get("id") or ""
        content = (mem.get("memory") or mem.get("content") or "")[:200]
        is_static = mem.get("isStatic", False)
        version = mem.get("version", 1)
        updated = (mem.get("updatedAt") or mem.get("createdAt") or "")[:10]
        forgotten = mem.get("isForgotten", False)
        metadata = mem.get("metadata") or {}
        tags = metadata.get("tags") or ""

        static_label = " [static]" if is_static else ""
        forgotten_label = " [forgotten]" if forgotten else ""
        version_label = f" v{version}" if version and version > 1 else ""
        print(f"[{mem_id}]{static_label}{forgotten_label}{version_label} {updated}")
        if tags:
            print(f"  tags: {tags}")
        print(f"  {content}")

        history = mem.get("history") or []
        if history:
            for h in history[:3]:
                h_ver = h.get("version", "?")
                h_content = (h.get("memory") or h.get("content") or "")[:100]
                h_date = (h.get("createdAt") or "")[:10]
                print(f"    v{h_ver} ({h_date}): {h_content}")
        print()

    print(f"Showing {min(limit, len(memories))} of {len(memories)} memory entries.")


def cmd_help(**_):
    print("""Supermemory companion CLI -- commands not in the official CLI

For most operations, use the official CLI:
  npx supermemory remember "content" --tag <tag>
  npx supermemory search "query" --tag <tag>
  npx supermemory profile --tag <tag>
  npx supermemory forget <id> --tag <tag>
  npx supermemory update <id> "new content" --tag <tag>
  npx supermemory add <content|file|url> --tag <tag>
  npx supermemory tags list
  npx supermemory docs list --tag <tag>

This companion script covers two gaps:

  conversation  Ingest structured messages via v4/conversations
                  --content "text"    Raw text or JSON messages (or pipe)
                  --file "path.json"  Load messages from JSON file
                  --id "conv-id"      Conversation ID (enables incremental updates)

  memories      List extracted memory entries with version history
                  --limit N           Max results (default: 30)

Global flags:
  --container <name>   Override target container""")


COMMANDS = {
    "conversation": cmd_conversation,
    "memories": cmd_memories,
    "help": lambda *a, **kw: cmd_help(),
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        cmd_help()
        sys.exit(0 if len(sys.argv) < 2 else 1)

    container_tag = None
    args = list(sys.argv[2:])
    filtered_args = []
    i = 0
    while i < len(args):
        if args[i] == "--container" and i + 1 < len(args):
            container_tag = args[i + 1]
            i += 2
        else:
            filtered_args.append(args[i])
            i += 1

    container_tag = get_container(container_tag)
    COMMANDS[sys.argv[1]](filtered_args, container_tag=container_tag)


if __name__ == "__main__":
    main()
