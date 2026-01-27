#!/usr/bin/env python3
"""
Get posts from a subreddit
Usage: python3 scripts/get_posts.py python --sort hot --limit 20
"""
import argparse
from reddit_api import api_get, print_posts_list, print_pagination


def main():
    parser = argparse.ArgumentParser(description="Get subreddit posts")
    parser.add_argument("subreddit", help="Subreddit name (without r/)")
    parser.add_argument("--sort", "-s", choices=["hot", "new", "top", "rising", "controversial"],
                        default="hot", help="Sort method (default: hot)")
    parser.add_argument("--time", "-t", choices=["hour", "day", "week", "month", "year", "all"],
                        help="Time filter for top/controversial")
    parser.add_argument("--limit", "-l", type=int, default=25, help="Max posts (max 100)")
    parser.add_argument("--after", "-a", help="Pagination cursor")
    args = parser.parse_args()

    path = f"r/{args.subreddit}/{args.sort}"
    params = {
        "limit": min(args.limit, 100),
        "after": args.after,
    }
    if args.time and args.sort in ["top", "controversial"]:
        params["t"] = args.time

    data = api_get(path, params)
    listing = data.get("data", {})
    posts = listing.get("children", [])

    label = f"r/{args.subreddit}/{args.sort}"
    if args.time:
        label += f"/{args.time}"
    print_posts_list(posts, label)
    print_pagination(listing)


if __name__ == "__main__":
    main()
