#!/usr/bin/env python3
"""
Get subreddit info
Usage: python3 scripts/get_subreddit.py python
"""
import argparse
import json
from reddit_api import api_get, clean_subreddit, print_subreddit


def main():
    parser = argparse.ArgumentParser(description="Get subreddit info")
    parser.add_argument("subreddit", help="Subreddit name (without r/)")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    data = api_get(f"r/{args.subreddit}/about")
    
    if args.json:
        print(json.dumps(data.get("data", data), indent=2))
        return

    print_subreddit(clean_subreddit(data))


if __name__ == "__main__":
    main()
