#!/usr/bin/env python3
"""Superagent client — sends messages to Aung's Superagent on Base44."""

import argparse
import json
import sys
import urllib.request
import urllib.error
import os

BASE_URL = os.environ.get("SUPERAGENT_BASE44_URL", "")
if not BASE_URL:
    sys.exit("ERROR: SUPERAGENT_BASE44_URL environment variable not set")


def get_message(args) -> str:
    """Resolve message from --message, --file, or stdin."""
    if args.message:
        return args.message
    if args.file:
        with open(args.file, "r") as f:
            return f.read().strip()
    if not sys.stdin.isatty():
        return sys.stdin.read().strip()
    print("ERROR: No message provided. Use --message, --file, or pipe via stdin.", file=sys.stderr)
    sys.exit(1)


def send_message(message: str, conversation_id: str = None) -> dict:
    payload = {
        "message": message,
        "sender": "Zo",
    }
    if conversation_id:
        payload["conversation_id"] = conversation_id

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BASE_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return {"error": f"HTTP {e.code}", "detail": body}
    except urllib.error.URLError as e:
        return {"error": "Connection failed", "detail": str(e.reason)}


def main():
    parser = argparse.ArgumentParser(description="Send a message to Superagent on Base44")
    msg_group = parser.add_mutually_exclusive_group()
    msg_group.add_argument("--message", "-m", help="Message or task to send")
    msg_group.add_argument("--file", "-f", help="Read message from file")
    parser.add_argument("--conversation_id", "-c", help="Optional conversation ID for threading")
    parser.add_argument("--raw", action="store_true", help="Print full JSON response instead of just reply")
    args = parser.parse_args()

    message = get_message(args)
    result = send_message(message, args.conversation_id)

    if args.raw:
        print(json.dumps(result, indent=2))
    elif "reply" in result:
        print(result["reply"])
    elif "error" in result:
        print(f"ERROR: {result['error']}", file=sys.stderr)
        if "detail" in result:
            print(f"Detail: {result['detail']}", file=sys.stderr)
        sys.exit(1)
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
