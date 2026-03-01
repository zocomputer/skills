#!/usr/bin/env python3
"""
Mengram CLI - Memory operations from command line.

Usage:
    mengram status          - Check system status
    mengram remember <text> - Save text to memory
    mengram search <query>  - Search memories
    mengram profile         - Get user knowledge profile
    mengram stats           - Get vault statistics
"""

import os
import sys
import json
import urllib.request
import urllib.error

# Configuration from environment
API_URL = os.getenv("MENGRAM_API_URL", "http://localhost:8420")
API_KEY = os.getenv("MENGRAM_API_KEY", "")


def api_call(endpoint: str, method: str = "GET", data: dict = None) -> dict:
    """
    Make an API call to Mengram.
    
    Args:
        endpoint: API endpoint (e.g., "/api/health")
        method: HTTP method
        data: Request body data
        
    Returns:
        Response as dict
    """
    url = f"{API_URL}{endpoint}"
    headers = {
        "Content-Type": "application/json",
    }
    
    # Add auth header if API key is set
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    
    if data:
        body = json.dumps(data).encode("utf-8")
    else:
        body = None
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            error_body = json.loads(e.read().decode("utf-8"))
            return {"error": str(e), "body": error_body}
        except:
            return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}


def cmd_status():
    """Check system status."""
    result = api_call("/api/health")
    
    if "error" in result:
        print(f"❌ Error connecting to Mengram API: {result['error']}")
        print(f"   Make sure the API is running at {API_URL}")
        return
    
    print("🧠 Mengram Status")
    print("=" * 40)
    print(f"  API URL: {API_URL}")
    print(f"  Status: {result.get('status', 'unknown')}")
    print(f"  Version: {result.get('version', 'unknown')}")
    print(f"  Auth: {'enabled' if result.get('auth') else 'disabled'}")
    
    # Get stats
    stats = api_call("/api/stats")
    if "error" not in stats:
        print("\n📊 Vault Statistics:")
        vault = stats.get("vault", {})
        graph = stats.get("graph", {})
        print(f"  Entities: {vault.get('total_notes', 0)}")
        print(f"  Relations: {graph.get('total_relations', 0)}")


def cmd_remember(text: str):
    """Save text to memory."""
    if not text:
        print("❌ Error: No text provided")
        return
    
    print(f"💾 Remembering: {text[:50]}{'...' if len(text) > 50 else ''}")
    
    result = api_call("/api/remember/text", method="POST", data={"text": text})
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
        if "body" in result:
            print(f"   {result['body']}")
        return
    
    print(f"✅ Remembered!")
    if result.get("created"):
        print(f"   Created entities: {', '.join(result['created'])}")
    if result.get("updated"):
        print(f"   Updated entities: {', '.join(result['updated'])}")


def cmd_search(query: str, top_k: int = 5):
    """Search memories."""
    if not query:
        print("❌ Error: No query provided")
        return
    
    print(f"🔍 Searching: {query}\n")
    
    result = api_call("/api/search", method="POST", data={"query": query, "top_k": top_k})
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
        return
    
    results = result.get("results", [])
    
    if not results:
        print("No results found.")
        return
    
    for r in results:
        score = r.get("score", 0)
        entity = r.get("entity", "unknown")
        etype = r.get("type", "unknown")
        
        print(f"### {entity} ({etype}) [score: {score:.3f}]")
        
        facts = r.get("facts", [])
        if facts:
            for fact in facts[:5]:
                print(f"  - {fact}")
        
        relations = r.get("relations", [])
        if relations:
            print("  Relations:")
            for rel in relations[:3]:
                arrow = "→" if rel.get("direction") == "outgoing" else "←"
                print(f"    {arrow} {rel.get('type')}: {rel.get('target')}")
        
        print()


def cmd_profile():
    """Get user knowledge profile."""
    result = api_call("/api/profile")
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
        return
    
    profile = result.get("profile", "")
    print(profile)


def cmd_stats():
    """Get vault statistics."""
    result = api_call("/api/stats")
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
        return
    
    print("📊 Mengram Statistics")
    print("=" * 40)
    
    vault = result.get("vault", {})
    print("\nVault:")
    for key, value in vault.items():
        print(f"  {key}: {value}")
    
    graph = result.get("graph", {})
    print("\nKnowledge Graph:")
    for key, value in graph.items():
        print(f"  {key}: {value}")


def cmd_recall(query: str):
    """Recall memories as context."""
    if not query:
        print("❌ Error: No query provided")
        return
    
    print(f"🧠 Recalling context for: {query}\n")
    
    result = api_call("/api/recall", method="POST", data={"query": query})
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
        return
    
    context = result.get("context", "")
    print(context)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nEnvironment Variables:")
        print(f"  MENGRAM_API_URL: {API_URL}")
        print(f"  MENGRAM_API_KEY: {'<set>' if API_KEY else '<not set>'}")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "status":
        cmd_status()
    
    elif command == "remember":
        if len(sys.argv) < 3:
            print("Usage: mengram remember <text>")
            sys.exit(1)
        text = " ".join(sys.argv[2:])
        cmd_remember(text)
    
    elif command == "search":
        if len(sys.argv) < 3:
            print("Usage: mengram search <query>")
            sys.exit(1)
        query = " ".join(sys.argv[2:])
        cmd_search(query)
    
    elif command == "recall":
        if len(sys.argv) < 3:
            print("Usage: mengram recall <query>")
            sys.exit(1)
        query = " ".join(sys.argv[2:])
        cmd_recall(query)
    
    elif command == "profile":
        cmd_profile()
    
    elif command == "stats":
        cmd_stats()
    
    elif command == "help":
        print(__doc__)
    
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
