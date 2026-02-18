import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

BASE_URL = "https://api.supermemory.ai"

# Customize these container names for your setup.
# The default container is for the user's context.
# The self container is for the AI's own self-knowledge (optional).
CONTAINER_DEFAULT = "user"
CONTAINER_SELF = "ai"


def api(method, path, body=None):
    api_key = os.environ.get("SUPERMEMORY_API_KEY", "")
    if not api_key:
        print("ERROR: SUPERMEMORY_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "ZoSupermemory/1.0",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
            if not body:
                return {}
            return json.loads(body)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if e.fp else ""
        print(f"ERROR: API returned {e.code}: {body_text}", file=sys.stderr)
        sys.exit(1)


def cmd_save(args, container_tag=None):
    if container_tag is None:
        container_tag = CONTAINER_DEFAULT
    content = None
    tags = ""
    metadata = {}
    custom_id = None
    i = 0
    while i < len(args):
        if args[i] == "--content" and i + 1 < len(args):
            content = args[i + 1]; i += 2
        elif args[i] == "--tags" and i + 1 < len(args):
            tags = args[i + 1]; i += 2
        elif args[i] == "--id" and i + 1 < len(args):
            custom_id = args[i + 1]; i += 2
        else:
            i += 1

    if not content:
        if not sys.stdin.isatty():
            content = sys.stdin.read().strip()
        if not content:
            print("ERROR: --content required or pipe content via stdin", file=sys.stderr)
            sys.exit(1)

    if tags:
        metadata["tags"] = tags

    body = {
        "content": content,
        "containerTag": container_tag,
    }
    if metadata:
        body["metadata"] = metadata
    if custom_id:
        body["customId"] = custom_id

    result = api("POST", "/v3/documents", body)
    print(f"Saved to [{container_tag}]. ID: {result.get('id', 'unknown')}, Status: {result.get('status', 'unknown')}")
    return result


def cmd_search(args, container_tag=None):
    if container_tag is None:
        container_tag = CONTAINER_DEFAULT
    query = None
    limit = 10
    i = 0
    while i < len(args):
        if args[i] in ("--query", "-q") and i + 1 < len(args):
            query = args[i + 1]; i += 2
        elif args[i] == "--limit" and i + 1 < len(args):
            limit = int(args[i + 1]); i += 2
        else:
            i += 1

    if not query:
        print("ERROR: --query required", file=sys.stderr)
        sys.exit(1)

    body = {
        "q": query,
        "containerTags": [container_tag],
    }

    result = api("POST", "/v3/search", body)
    results = result.get("results", [])
    if not results:
        print(f"No results found in [{container_tag}].")
        return

    for idx, r in enumerate(results[:limit], 1):
        doc_id = r.get("documentId", "")
        score = r.get("score", "")
        tags = r.get("metadata", {}).get("tags", "")
        chunks = r.get("chunks", [])
        content = chunks[0].get("content", "")[:300] if chunks else ""
        created = r.get("createdAt", "")[:10]

        print(f"\n--- Result {idx} (score: {score:.2f}) [id: {doc_id}] {created} ---")
        if tags:
            print(f"  tags: {tags}")
        print(f"  {content}")

    print(f"\n{len(results)} results total.")


def cmd_profile(args, container_tag=None):
    if container_tag is None:
        container_tag = CONTAINER_DEFAULT
    body = {
        "containerTag": container_tag,
    }

    result = api("POST", "/v4/profile", body)
    profile = result.get("profile", {})

    static = profile.get("static", "")
    dynamic = profile.get("dynamic", "")

    label = container_tag.capitalize()

    if static:
        print(f"=== {label} Static Profile ===")
        print(static)
        print()
    if dynamic:
        print(f"=== {label} Dynamic Context ===")
        print(dynamic)
        print()

    if not static and not dynamic:
        print(f"No profile data yet for [{container_tag}]. Save some memories first.")


def cmd_conversation(args, container_tag=None):
    if container_tag is None:
        container_tag = CONTAINER_DEFAULT
    content = None
    custom_id = None
    i = 0
    while i < len(args):
        if args[i] == "--content" and i + 1 < len(args):
            content = args[i + 1]; i += 2
        elif args[i] == "--id" and i + 1 < len(args):
            custom_id = args[i + 1]; i += 2
        else:
            i += 1

    if not content:
        if not sys.stdin.isatty():
            content = sys.stdin.read().strip()
        if not content:
            print("ERROR: --content required or pipe content via stdin", file=sys.stderr)
            sys.exit(1)

    body = {
        "content": content,
        "containerTag": container_tag,
    }
    if custom_id:
        body["customId"] = custom_id

    result = api("POST", "/v4/conversations", body)
    print(f"Conversation ingested to [{container_tag}]. ID: {result.get('id', 'unknown')}")
    return result


def cmd_list(args, container_tag=None):
    if container_tag is None:
        container_tag = CONTAINER_DEFAULT
    limit = 20
    i = 0
    while i < len(args):
        if args[i] == "--limit" and i + 1 < len(args):
            limit = int(args[i + 1]); i += 2
        else:
            i += 1

    body = {
        "containerTags": [container_tag],
    }

    result = api("POST", "/v3/documents/list", body)
    docs = result.get("memories", result.get("documents", result.get("results", [])))

    if not docs:
        print(f"No memories found in [{container_tag}].")
        return

    for doc in docs[:limit]:
        doc_id = doc.get("id", "")
        title = doc.get("title", "")
        summary = doc.get("summary", "")[:150]
        status = doc.get("status", "")
        tags = doc.get("metadata", {}).get("tags", "")
        created = doc.get("createdAt", "")[:10]
        print(f"[{doc_id}] ({status}) {created}")
        if title:
            print(f"  {title}")
        if tags:
            print(f"  tags: {tags}")
        if summary:
            print(f"  {summary}")
        print()

    print(f"Showing {min(limit, len(docs))} of {len(docs)} memories.")


def cmd_forget(args, container_tag=None):
    memory_id = None
    i = 0
    while i < len(args):
        if args[i] == "--id" and i + 1 < len(args):
            memory_id = args[i + 1]; i += 2
        else:
            i += 1

    if not memory_id:
        print("ERROR: --id required", file=sys.stderr)
        sys.exit(1)

    api("DELETE", f"/v3/documents/{memory_id}")
    print(f"Document deleted: {memory_id}")


def cmd_close(args, container_tag=None):
    summary = None
    saves = 0
    i = 0
    while i < len(args):
        if args[i] == "--summary" and i + 1 < len(args):
            summary = args[i + 1]; i += 2
        elif args[i] == "--saves" and i + 1 < len(args):
            saves = int(args[i + 1]); i += 2
        else:
            i += 1

    if not summary:
        print("ERROR: --summary required", file=sys.stderr)
        sys.exit(1)

    log_file = "/home/workspace/Data/memory-close-log.jsonl"
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    handoff_exists = os.path.exists("/home/workspace/Data/handoff.json")

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "saves": saves,
        "handoff": handoff_exists,
    }

    with open(log_file, "a") as f:
        f.write(json.dumps(entry) + "\n")

    print(f"Close logged. Saves: {saves}, Handoff pending: {handoff_exists}")
    print(f"  Summary: {summary}")


# Self-* shortcuts: use the AI's own container
def cmd_self_save(args, container_tag=None):
    return cmd_save(args, container_tag=CONTAINER_SELF)

def cmd_self_search(args, container_tag=None):
    return cmd_search(args, container_tag=CONTAINER_SELF)

def cmd_self_profile(args, container_tag=None):
    return cmd_profile(args, container_tag=CONTAINER_SELF)


def cmd_help():
    print(f"""Supermemory CLI -- long-term memory for your AI

Containers:
  Default (user context): {CONTAINER_DEFAULT}
  Self (AI self-knowledge): {CONTAINER_SELF}

Global flags:
  --as <name>    Target a specific container (default: {CONTAINER_DEFAULT})

Commands:
  save          Save a memory
                  --content "text"  Content to save (or pipe via stdin)
                  --tags "a,b"      Comma-separated tags (optional)
                  --id "custom-id"  Custom ID for document-level dedup (optional)

  search        Search memories
                  --query "text"    Search query (required)
                  --limit N         Max results (default: 10)

  profile       Get profile (static facts + dynamic context)

  self-save     Save to AI's own container (shortcut for --as {CONTAINER_SELF} save)
  self-search   Search AI's own container
  self-profile  Get AI's own profile

  conversation  Ingest a conversation for memory extraction
                  --content "text"  Conversation text (or pipe via stdin)
                  --id "conv-id"    Conversation ID (optional)

  list          List recent documents
                  --limit N         Max results (default: 20)

  forget        Delete a document (permanent)
                  --id "doc-id"     Document ID to delete (required)

  close         Log conversation close protocol execution
                  --summary "text"  Brief conversation summary (required)
                  --saves N         Number of saves made this session (default: 0)

  help          Show this help""")


COMMANDS = {
    "save": cmd_save,
    "search": cmd_search,
    "profile": cmd_profile,
    "self-save": cmd_self_save,
    "self-search": cmd_self_search,
    "self-profile": cmd_self_profile,
    "conversation": cmd_conversation,
    "list": cmd_list,
    "forget": cmd_forget,
    "close": cmd_close,
    "help": lambda _, **kw: cmd_help(),
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        cmd_help()
        sys.exit(0 if len(sys.argv) < 2 else 1)

    # Extract --as flag from anywhere in args
    container_tag = CONTAINER_DEFAULT
    args = list(sys.argv[2:])
    filtered_args = []
    i = 0
    while i < len(args):
        if args[i] == "--as" and i + 1 < len(args):
            container_tag = args[i + 1].lower()
            i += 2
        else:
            filtered_args.append(args[i])
            i += 1

    command = sys.argv[1]
    COMMANDS[command](filtered_args, container_tag=container_tag)


if __name__ == "__main__":
    main()
