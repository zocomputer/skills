#!/usr/bin/env python3
"""
Reddit public JSON API wrapper
No authentication required - just append .json to URLs
"""
import urllib.request
import urllib.parse
import json
import sys
from credential import get_user_agent

BASE_URL = "https://www.reddit.com"


def api_get(path: str, params: dict = None) -> dict:
    """Make GET request to Reddit JSON API"""
    url = f"{BASE_URL}/{path}.json"
    if params:
        params["raw_json"] = "1"  # Avoid HTML entity encoding
        filtered = {k: v for k, v in params.items() if v is not None}
        if filtered:
            url += "?" + urllib.parse.urlencode(filtered)
    else:
        url += "?raw_json=1"
    
    headers = {"User-Agent": get_user_agent()}
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("error: Rate limited. Wait a moment and try again.", file=sys.stderr)
        elif e.code == 404:
            print(f"error: Not found - {path}", file=sys.stderr)
        else:
            print(f"error: HTTP {e.code}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)


def format_count(n) -> str:
    """Format numbers (1234567 -> 1.2M)"""
    if n is None:
        return "0"
    n = int(n)
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}K"
    return str(n)


def clean_post(p: dict) -> dict:
    """Clean post object from Reddit's data structure"""
    data = p.get("data", p)
    return {
        "id": data.get("id"),
        "title": data.get("title"),
        "subreddit": data.get("subreddit"),
        "author": data.get("author"),
        "score": data.get("score"),
        "upvote_ratio": data.get("upvote_ratio"),
        "num_comments": data.get("num_comments"),
        "url": data.get("url"),
        "permalink": f"https://reddit.com{data.get('permalink', '')}",
        "selftext": (data.get("selftext") or "")[:500],
        "created_utc": data.get("created_utc"),
        "is_self": data.get("is_self"),
        "link_flair_text": data.get("link_flair_text"),
    }


def clean_comment(c: dict) -> dict:
    """Clean comment object"""
    data = c.get("data", c)
    return {
        "id": data.get("id"),
        "author": data.get("author"),
        "body": (data.get("body") or "")[:300],
        "score": data.get("score"),
        "created_utc": data.get("created_utc"),
    }


def clean_subreddit(s: dict) -> dict:
    """Clean subreddit object"""
    data = s.get("data", s)
    return {
        "name": data.get("display_name"),
        "title": data.get("title"),
        "description": (data.get("public_description") or "")[:200],
        "subscribers": data.get("subscribers"),
        "active_users": data.get("accounts_active"),
        "created_utc": data.get("created_utc"),
        "url": f"https://reddit.com/r/{data.get('display_name')}",
        "over18": data.get("over18"),
    }


def clean_user(u: dict) -> dict:
    """Clean user object"""
    data = u.get("data", u)
    return {
        "name": data.get("name"),
        "link_karma": data.get("link_karma"),
        "comment_karma": data.get("comment_karma"),
        "created_utc": data.get("created_utc"),
        "is_mod": data.get("is_mod"),
        "verified": data.get("verified"),
    }


def print_post(p: dict):
    """Print post in TOON format"""
    if not p:
        return
    print(f"id: {p.get('id', '')}")
    print(f"title: {p.get('title', '')}")
    print(f"subreddit: r/{p.get('subreddit', '')}")
    print(f"author: u/{p.get('author', '')}")
    print(f"score: {format_count(p.get('score'))} ({int((p.get('upvote_ratio') or 0) * 100)}% upvoted)")
    print(f"comments: {format_count(p.get('num_comments'))}")
    print(f"url: {p.get('permalink', '')}")
    if p.get('link_flair_text'):
        print(f"flair: {p['link_flair_text']}")
    if p.get('selftext'):
        print(f"---")
        print(f"text: {p['selftext']}")


def print_subreddit(s: dict):
    """Print subreddit in TOON format"""
    if not s:
        return
    print(f"name: r/{s.get('name', '')}")
    print(f"title: {s.get('title', '')}")
    print(f"subscribers: {format_count(s.get('subscribers'))}")
    print(f"active: {format_count(s.get('active_users'))} online")
    print(f"nsfw: {s.get('over18', False)}")
    print(f"url: {s.get('url', '')}")
    if s.get('description'):
        print(f"description: {s['description']}")


def print_user(u: dict):
    """Print user in TOON format"""
    if not u:
        return
    print(f"name: u/{u.get('name', '')}")
    print(f"link_karma: {format_count(u.get('link_karma'))}")
    print(f"comment_karma: {format_count(u.get('comment_karma'))}")
    print(f"verified: {u.get('verified', False)}")
    print(f"is_mod: {u.get('is_mod', False)}")


def print_posts_list(posts: list, label: str = "posts"):
    """Print list of posts"""
    cleaned = [clean_post(p) for p in posts if p]
    print(f"{label}[{len(cleaned)}]{{title,subreddit,score,comments}}:")
    for p in cleaned:
        title = (p['title'] or '')[:60]
        print(f"  {title},r/{p['subreddit']},{format_count(p['score'])},{format_count(p['num_comments'])}")


def print_comments_list(comments: list, label: str = "comments"):
    """Print list of comments"""
    cleaned = [clean_comment(c) for c in comments if c.get("kind") == "t1"]
    print(f"{label}[{len(cleaned)}]{{author,body,score}}:")
    for c in cleaned:
        body = (c['body'] or '')[:60].replace('\n', ' ')
        print(f"  u/{c['author']},{body},{c['score']}")


def print_pagination(data: dict):
    """Print pagination info"""
    after = data.get("after")
    if after:
        print(f"---")
        print(f"has_next_page: True")
        print(f"next_cursor: {after}")
