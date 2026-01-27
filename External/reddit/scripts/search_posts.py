#!/usr/bin/env python3
"""
Search posts on Reddit
Usage: python3 scripts/search_posts.py "AI agent" --subreddit ClaudeAI --limit 20
"""
import argparse
from reddit_api import api_get, print_posts_list, print_pagination


def main():
    parser = argparse.ArgumentParser(description="Search Reddit posts")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--subreddit", "-r", help="Limit to subreddit")
    parser.add_argument("--sort", "-s", choices=["relevance", "hot", "top", "new", "comments"],
                        default="relevance", help="Sort method")
    parser.add_argument("--time", "-t", choices=["hour", "day", "week", "month", "year", "all"],
                        default="all", help="Time filter")
    parser.add_argument("--limit", "-l", type=int, default=25, help="Max posts")
    parser.add_argument("--after", "-a", help="Pagination cursor")
    args = parser.parse_args()

    if args.subreddit:
        path = f"r/{args.subreddit}/search"
        params = {
            "q": args.query,
            "restrict_sr": "1",
            "sort": args.sort,
            "t": args.time,
            "limit": min(args.limit, 100),
            "after": args.after,
        }
    else:
        path = "search"
        params = {
            "q": args.query,
            "sort": args.sort,
            "t": args.time,
            "limit": min(args.limit, 100),
            "after": args.after,
        }

    data = api_get(path, params)
    listing = data.get("data", {})
    posts = listing.get("children", [])

    label = f"search({args.query})"
    if args.subreddit:
        label = f"r/{args.subreddit}/search({args.query})"
    print(f"query: {args.query}")
    print(f"sort: {args.sort}, time: {args.time}")
    print_posts_list(posts, label)
    print_pagination(listing)


if __name__ == "__main__":
    main()
