#!/usr/bin/env python3
"""Handoff CLI -- pause/resume system for cross-conversation continuity."""

import json
import os
import sys
from datetime import datetime, timezone

HANDOFF_FILE = os.environ.get(
    "HANDOFF_FILE", "/home/workspace/Data/handoff.json"
)


def cmd_check(args):
    """Check for a pending handoff."""
    if not os.path.exists(HANDOFF_FILE):
        print("No pending handoff.")
        return

    with open(HANDOFF_FILE, "r") as f:
        handoff = json.load(f)

    age = _age_string(handoff.get("created_at", ""))
    print("PENDING HANDOFF DETECTED")
    print(f"  Created: {handoff.get('created_at', 'unknown')} ({age} ago)")
    print(f"  Task: {handoff.get('task', 'unknown')}")
    print(f"  Question: {handoff.get('question', 'unknown')}")
    print()
    print("=== Full Context ===")
    print(handoff.get("context", "No context provided."))
    print()
    print("=== Resume Instructions ===")
    print(handoff.get("resume", "No resume instructions provided."))


def cmd_save(args):
    """Create a new handoff."""
    task = None
    context = None
    question = None
    resume = None
    i = 0
    while i < len(args):
        if args[i] == "--task" and i + 1 < len(args):
            task = args[i + 1]; i += 2
        elif args[i] == "--context" and i + 1 < len(args):
            context = args[i + 1]; i += 2
        elif args[i] == "--question" and i + 1 < len(args):
            question = args[i + 1]; i += 2
        elif args[i] == "--resume" and i + 1 < len(args):
            resume = args[i + 1]; i += 2
        else:
            i += 1

    if not task or not question:
        print("ERROR: --task and --question are required", file=sys.stderr)
        sys.exit(1)

    if os.path.exists(HANDOFF_FILE):
        print("WARNING: Replacing existing handoff.", file=sys.stderr)

    handoff = {
        "task": task,
        "context": context or "",
        "question": question,
        "resume": resume or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    os.makedirs(os.path.dirname(HANDOFF_FILE), exist_ok=True)
    with open(HANDOFF_FILE, "w") as f:
        json.dump(handoff, f, indent=2)

    print(f"Handoff saved. Waiting for user input.")
    print(f"  Task: {task}")
    print(f"  Question: {question}")


def cmd_clear(args):
    """Remove the pending handoff."""
    if not os.path.exists(HANDOFF_FILE):
        print("No handoff to clear.")
        return

    os.remove(HANDOFF_FILE)
    print("Handoff cleared.")


def cmd_show(args):
    """Display full handoff contents."""
    if not os.path.exists(HANDOFF_FILE):
        print("No pending handoff.")
        return

    with open(HANDOFF_FILE, "r") as f:
        handoff = json.load(f)

    print(json.dumps(handoff, indent=2))


def _age_string(iso_str):
    """Return human-readable age from ISO timestamp."""
    if not iso_str:
        return "unknown"
    try:
        created = datetime.fromisoformat(iso_str)
        now = datetime.now(timezone.utc)
        delta = now - created
        hours = delta.total_seconds() / 3600
        if hours < 1:
            return f"{int(delta.total_seconds() / 60)} minutes"
        elif hours < 24:
            return f"{int(hours)} hours"
        else:
            return f"{int(hours / 24)} days"
    except (ValueError, TypeError):
        return "unknown"


COMMANDS = {
    "check": cmd_check,
    "save": cmd_save,
    "clear": cmd_clear,
    "show": cmd_show,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print("Handoff CLI -- pause/resume for cross-conversation continuity")
        print()
        print("Commands:")
        print("  check   Check for pending handoff")
        print("  save    Create handoff (--task, --context, --question, --resume)")
        print("  clear   Remove pending handoff")
        print("  show    Display full handoff JSON")
        print()
        print("Environment:")
        print(f"  HANDOFF_FILE = {HANDOFF_FILE}")
        sys.exit(0 if len(sys.argv) < 2 else 1)

    COMMANDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
