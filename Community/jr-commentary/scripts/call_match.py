#!/usr/bin/env python3
"""Dry-run the JR desk. Prints a call sheet. Does not invent facts."""

from __future__ import annotations

import argparse
import sys

HEATS = ("feel", "heat", "spot", "finish")

ISM = {
    "feel": None,
    "heat": "one ism max — still calling what happened",
    "spot": "full sell, then the line, then the camera",
    "finish": "the famous register. then silence.",
}


def main() -> int:
    p = argparse.ArgumentParser(description="JR commentary desk — call sheet")
    p.add_argument("--event", required=True, help="what happened")
    p.add_argument("--heat", required=True, choices=HEATS)
    p.add_argument("--face", default="the stack", help="who is selling")
    p.add_argument("--heel", default="the body", help="who is posing")
    args = p.parse_args()

    print("THE MATCH")
    print(f"  face:  {args.face}")
    print(f"  heel:  {args.heel}")
    print(f"  heat:  {args.heat}")
    print()
    print("THE SPOT")
    print(f"  {args.event.strip()}")
    print()
    print("THE LAW")
    print("  1. name the match")
    print("  2. call the spot in present tense")
    print("  3. sell it once, then shut up")
    print(f"  ism: {ISM[args.heat] or 'none — feel does not spend one'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
