#!/usr/bin/env python3
"""SEO data via DataForSEO API. Pay-as-you-go, every command shows estimated cost."""

import argparse
import base64
import json
import os
import sys

import httpx

BASE = "https://api.dataforseo.com/v3"


def get_auth() -> str:
    user = os.environ.get("DATAFORSEO_USERNAME", "")
    pwd = os.environ.get("DATAFORSEO_PASSWORD", "")
    if not user or not pwd:
        print("Error: DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD must be set in Zo secrets.", file=sys.stderr)
        sys.exit(1)
    return base64.b64encode(f"{user}:{pwd}".encode()).decode()


def api(path: str, payload: list[dict] = None, method: str = "POST") -> dict:
    auth = get_auth()
    headers = {"Authorization": f"Basic {auth}", "Content-Type": "application/json"}
    url = f"{BASE}{path}"
    if method == "GET":
        r = httpx.get(url, headers=headers, timeout=60)
    else:
        r = httpx.post(url, headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    data = r.json()
    cost = data.get("cost", 0)
    if cost:
        print(f"[cost] ${cost:.4f}", file=sys.stderr)
    if data.get("status_code") != 20000:
        msg = data.get("status_message", "Unknown error")
        print(f"[error] {msg}", file=sys.stderr)
    return data


def cmd_serp(args):
    payload = [{
        "keyword": args.query,
        "location_code": args.location,
        "language_code": args.language,
        "depth": args.depth,
    }]
    data = api("/serp/google/organic/live/advanced", payload)
    results = []
    for task in data.get("tasks", []):
        for res in (task.get("result") or []):
            for item in (res.get("items") or []):
                if item.get("type") == "organic":
                    results.append({
                        "position": item.get("rank_absolute"),
                        "title": item.get("title"),
                        "url": item.get("url"),
                        "domain": item.get("domain"),
                        "description": item.get("description"),
                        "etv": item.get("estimated_paid_traffic_cost"),
                    })
    print(json.dumps(results[:args.limit], indent=2))


def cmd_keywords(args):
    keywords = [k.strip() for k in args.seed.split(",")]
    payload = [{
        "keywords": keywords,
        "location_code": args.location,
        "language_code": args.language,
    }]
    data = api("/keywords_data/google_ads/search_volume/live", payload)
    results = []
    for task in data.get("tasks", []):
        for res in (task.get("result") or []):
            results.append({
                "keyword": res.get("keyword"),
                "search_volume": res.get("search_volume"),
                "competition": res.get("competition"),
                "competition_index": res.get("competition_index"),
                "cpc": res.get("cpc"),
                "monthly_searches": res.get("monthly_searches"),
            })
    print(json.dumps(results[:args.limit], indent=2))


def cmd_keyword_ideas(args):
    payload = [{
        "keyword": args.seed,
        "location_code": args.location,
        "language_code": args.language,
        "limit": args.limit,
        "include_seed_keyword": True,
        "include_serp_info": True,
    }]
    data = api("/dataforseo_labs/google/keyword_ideas/live", payload)
    results = []
    for task in data.get("tasks", []):
        for res in (task.get("result") or []):
            for item in (res.get("items") or []):
                kd = item.get("keyword_data") or {}
                ki = kd.get("keyword_info") or {}
                results.append({
                    "keyword": kd.get("keyword"),
                    "search_volume": ki.get("search_volume"),
                    "competition": ki.get("competition"),
                    "cpc": ki.get("cpc"),
                    "keyword_difficulty": item.get("keyword_difficulty"),
                    "search_intent": (kd.get("search_intent_info") or {}).get("main_intent"),
                })
    print(json.dumps(results[:args.limit], indent=2))


def cmd_backlinks(args):
    payload = [{
        "target": args.domain,
        "limit": args.limit,
    }]
    summary_data = api("/backlinks/summary/live", [{"target": args.domain}])
    summary = {}
    for task in summary_data.get("tasks", []):
        for res in (task.get("result") or []):
            summary = {
                "target": res.get("target"),
                "total_backlinks": res.get("external_links_count"),
                "referring_domains": res.get("referring_domains"),
                "rank": res.get("rank"),
                "broken_backlinks": res.get("broken_backlinks"),
                "referring_ips": res.get("referring_ips"),
                "referring_subnets": res.get("referring_subnets"),
            }

    bl_data = api("/backlinks/backlinks/live", payload)
    backlinks = []
    for task in bl_data.get("tasks", []):
        for res in (task.get("result") or []):
            for item in (res.get("items") or []):
                backlinks.append({
                    "url_from": item.get("url_from"),
                    "domain_from": item.get("domain_from"),
                    "url_to": item.get("url_to"),
                    "anchor": item.get("anchor"),
                    "rank": item.get("rank"),
                    "is_lost": item.get("is_lost"),
                    "dofollow": item.get("dofollow"),
                })

    print(json.dumps({"summary": summary, "backlinks": backlinks[:args.limit]}, indent=2))


def cmd_domain(args):
    payload = [{
        "target": args.domain,
        "location_code": args.location,
        "language_code": args.language,
    }]
    data = api("/dataforseo_labs/google/domain_rank_overview/live", payload)
    results = []
    for task in data.get("tasks", []):
        for res in (task.get("result") or []):
            for item in (res.get("items") or []):
                results.append({
                    "target": item.get("target"),
                    "rank": item.get("rank"),
                    "organic_count": item.get("organic_count"),
                    "organic_traffic": item.get("organic_traffic"),
                    "organic_cost": item.get("organic_cost"),
                    "paid_count": item.get("paid_count"),
                    "etv": item.get("etv"),
                    "is_ip": item.get("is_ip"),
                    "metrics": item.get("metrics"),
                })
    print(json.dumps(results, indent=2))


def cmd_competitors(args):
    payload = [{
        "target": args.domain,
        "location_code": args.location,
        "language_code": args.language,
        "limit": args.limit,
    }]
    data = api("/dataforseo_labs/google/competitors_domain/live", payload)
    results = []
    for task in data.get("tasks", []):
        for res in (task.get("result") or []):
            for item in (res.get("items") or []):
                results.append({
                    "domain": item.get("domain"),
                    "avg_position": item.get("avg_position"),
                    "intersections": item.get("intersections"),
                    "full_domain_metrics": item.get("metrics"),
                })
    print(json.dumps(results[:args.limit], indent=2))


def cmd_trends(args):
    payload = [{
        "keywords": [args.keyword],
        "location_code": args.location,
        "language_code": args.language,
        "time_range": args.timeframe or "past_12_months",
    }]
    data = api("/keywords_data/google_trends/explore/live", payload)
    results = []
    for task in data.get("tasks", []):
        for res in (task.get("result") or []):
            for item in (res.get("items") or []):
                if item.get("type") == "google_trends_graph":
                    results.append({
                        "keyword": args.keyword,
                        "data": item.get("data"),
                    })
    print(json.dumps(results, indent=2))


def cmd_audit(args):
    payload = [{
        "url": args.url,
        "enable_javascript": True,
    }]
    data = api("/on_page/instant_pages", payload)
    results = []
    for task in data.get("tasks", []):
        for res in (task.get("result") or []):
            for item in (res.get("items") or []):
                results.append({
                    "url": item.get("url"),
                    "status_code": item.get("status_code"),
                    "meta": item.get("meta"),
                    "page_timing": item.get("page_timing"),
                    "onpage_score": item.get("onpage_score"),
                    "checks": item.get("checks"),
                    "total_dom_size": item.get("total_dom_size"),
                    "content": item.get("content"),
                })
    print(json.dumps(results, indent=2))


def cmd_balance(args):
    data = api("/appendix/user_data", method="GET")
    for task in data.get("tasks", []):
        for res in (task.get("result") or []):
            info = {
                "balance": res.get("money", {}).get("balance"),
                "total_spent": res.get("money", {}).get("total", 0) - res.get("money", {}).get("balance", 0),
                "limits": res.get("money", {}).get("limits"),
            }
            print(json.dumps(info, indent=2))
            return
    print(json.dumps(data, indent=2))


def main():
    parser = argparse.ArgumentParser(description="SEO data via DataForSEO")
    sub = parser.add_subparsers(dest="command", required=True)

    # shared args
    def add_common(p):
        p.add_argument("--location", type=int, default=2840, help="Location code (2840=US)")
        p.add_argument("--language", default="en", help="Language code")
        p.add_argument("--limit", type=int, default=20, help="Max results")
        p.add_argument("--output", help="Save to file")

    sp = sub.add_parser("serp", help="Google SERP results")
    sp.add_argument("query")
    sp.add_argument("--depth", type=int, default=10)
    add_common(sp)

    sp = sub.add_parser("keywords", help="Search volume for keywords (comma-separated)")
    sp.add_argument("seed")
    add_common(sp)

    sp = sub.add_parser("keyword-ideas", help="Related keyword suggestions")
    sp.add_argument("seed")
    add_common(sp)

    sp = sub.add_parser("backlinks", help="Backlink profile for a domain")
    sp.add_argument("domain")
    add_common(sp)

    sp = sub.add_parser("domain", help="Domain overview")
    sp.add_argument("domain")
    add_common(sp)

    sp = sub.add_parser("competitors", help="Competitor domains")
    sp.add_argument("domain")
    add_common(sp)

    sp = sub.add_parser("trends", help="Google Trends data")
    sp.add_argument("keyword")
    sp.add_argument("--timeframe", help="e.g. past_12_months, past_5_years")
    add_common(sp)

    sp = sub.add_parser("audit", help="On-page SEO audit")
    sp.add_argument("url")
    add_common(sp)

    sp = sub.add_parser("balance", help="Check credit balance")

    args = parser.parse_args()

    cmds = {
        "serp": cmd_serp, "keywords": cmd_keywords, "keyword-ideas": cmd_keyword_ideas,
        "backlinks": cmd_backlinks, "domain": cmd_domain, "competitors": cmd_competitors,
        "trends": cmd_trends, "audit": cmd_audit, "balance": cmd_balance,
    }
    cmds[args.command](args)


if __name__ == "__main__":
    main()
