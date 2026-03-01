#!/usr/bin/env python3
"""
Mengram Memory Client for Zo Computer.
Single-file client for Mengram REST API with CLI interface.

Copy this file to /home/workspace/.zo/ and set MENGRAM_API_KEY
in Zo Secrets (Settings > Advanced > Secrets).

Usage:
  mengram_memory.py initialize          - Check Mengram health, return status
  mengram_memory.py remember "text"     - Store knowledge from text
  mengram_memory.py recall "query"      - Semantic search, return context
  mengram_memory.py status              - Get vault statistics
  mengram_memory.py health              - Health check
  mengram_memory.py profile             - Get user knowledge profile
"""

import os
import sys
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


MENGRAM_URL = os.environ.get("MENGRAM_URL", "http://localhost:8420")
MENGRAM_API_KEY = os.environ.get("MENGRAM_API_KEY", "")


class MengramMemory:
    def __init__(self, api_url=None, api_key=None):
        self.api_url = (api_url or MENGRAM_URL).rstrip("/")
        self.api_key = api_key or MENGRAM_API_KEY

    def _request(self, method, endpoint, data=None):
        url = f"{self.api_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = json.dumps(data).encode("utf-8") if data else None
        req = Request(url, data=body, headers=headers, method=method)
        try:
            with urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else ""
            return {"status": "error", "code": e.code, "message": error_body}
        except (URLError, ConnectionError, OSError) as e:
            return {"status": "error", "message": f"Connection failed: {e}"}

    def initialize(self):
        result = self._request("GET", "/api/health")
        if result.get("status") == "ok":
            stats = self._request("GET", "/api/stats")
            result["stats"] = stats
        return result

    def remember(self, text):
        return self._request("POST", "/api/remember/text", {"text": text})

    def remember_conversation(self, messages):
        return self._request("POST", "/api/remember", {"conversation": messages})

    def recall(self, query, top_k=5):
        return self._request("POST", "/api/recall", {"query": query, "top_k": top_k})

    def search(self, query, top_k=5):
        return self._request("POST", "/api/search", {"query": query, "top_k": top_k})

    def get_profile(self):
        return self._request("GET", "/api/profile")

    def status(self):
        return self._request("GET", "/api/stats")

    def health_check(self):
        return self._request("GET", "/api/health")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    client = MengramMemory()

    if command == "initialize":
        result = client.initialize()
        if result.get("status") == "ok":
            stats = result.get("stats", {})
            vault = stats.get("vault", {})
            print(f"Mengram online. Vault: {vault.get('total_notes', 0)} notes.")
            print(json.dumps(result, indent=2))
        else:
            print(f"Mengram unavailable: {result.get('message', 'unknown error')}")
            sys.exit(1)

    elif command == "remember":
        if len(sys.argv) < 3:
            print("Usage: mengram_memory.py remember \"text\"")
            sys.exit(1)
        text = sys.argv[2]
        result = client.remember(text)
        print(json.dumps(result, indent=2))

    elif command == "recall":
        if len(sys.argv) < 3:
            print("Usage: mengram_memory.py recall \"query\"")
            sys.exit(1)
        query = sys.argv[2]
        result = client.recall(query)
        context = result.get("context", "")
        if context:
            print(context)
        else:
            print("No relevant memories found.")

    elif command == "search":
        if len(sys.argv) < 3:
            print("Usage: mengram_memory.py search \"query\"")
            sys.exit(1)
        query = sys.argv[2]
        result = client.search(query)
        results = result.get("results", [])
        for r in results:
            print(f"  [{r.get('entity', '?')}] {r.get('content', '')[:120]}")

    elif command == "status":
        result = client.status()
        print(json.dumps(result, indent=2))

    elif command == "health":
        result = client.health_check()
        print(json.dumps(result, indent=2))

    elif command == "profile":
        result = client.get_profile()
        profile = result.get("profile", "")
        if profile:
            print(profile)
        else:
            print(json.dumps(result, indent=2))

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
