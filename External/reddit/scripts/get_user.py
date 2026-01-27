#!/usr/bin/env python3
"""
Get user profile
Usage: python3 scripts/get_user.py spez --posts 10
"""
import argparse
import json
from reddit_api import api_get, clean_user, print_user, print_posts_list


def main():
    parser = argparse.ArgumentParser(description="Get Reddit user profile")
    parser.add_argument("username", help="Username (without u/)")
    parser.add_argument("--posts", "-p", type=int, default=0, help="Include N recent posts")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    data = api_get(f"user/{args.username}/about")
    
    if args.json:
        print(json.dumps(data.get("data", data), indent=2))
        return

    print_user(clean_user(data))

    if args.posts > 0:
        posts_data = api_get(f"user/{args.username}/submitted", {"limit": args.posts})
        posts = posts_data.get("data", {}).get("children", [])
        if posts:
            print(f"---")
            print_posts_list(posts, "recent_posts")


if __name__ == "__main__":
    main()
