#!/usr/bin/env python3
"""
Content360 Sync — syncs posts from Notion content calendar to Content360.

Usage:
  python3 content360_sync.py [--dry-run] [--platforms facebook,linkedin,x,instagram,youtube,tiktok,pinterest,reddit]

Environment variables (set in Zo Secrets):
  CONTENT360_EMAIL      - Login email
  CONTENT360_PASSWORD   - Login password
  CONTENT360_API_KEY    - Bearer token (from /os/profile/access-tokens)
  CONTENT360_ORG_ID     - Workspace UUID (e.g. 3f3006c0-a68f-4ac6-b4ee-c14d70356cbb)
  NOTION_API_KEY         - Notion integration secret
  NOTION_DATABASE_ID    - Content calendar database ID
"""

import os
import sys
import json
import time
import argparse
import requests
from datetime import datetime
from urllib.parse import unquote

# ── Config ──────────────────────────────────────────────────────────────────
CONTENT360_EMAIL = os.environ.get("CONTENT360_EMAIL", "")
CONTENT360_PASSWORD = os.environ.get("CONTENT360_PASSWORD", "")
CONTENT360_API_KEY = os.environ.get("CONTENT360_API_KEY", "")
CONTENT360_ORG_ID = os.environ.get("CONTENT360_ORG_ID", "")
CONTENT360_BASE_URL = "https://app.content360.io"
NOTION_API_KEY = os.environ.get("NOTION_API_KEY", "")
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID", "de201e51-282d-4c5a-973f-105dec4e96be")

# ── Session setup ───────────────────────────────────────────────────────────
session = requests.Session()
session.cookies = requests.cookies.RequestsCookieJar()

INERTIA_VERSION = None  # Set after first authenticated request


def inertia_headers(extra=None):
    """Build headers required for Content360 Inertia API."""
    headers = {
        "Authorization": f"Bearer {CONTENT360_API_KEY}",
        "X-Requested-With": "XMLHttpRequest",
        "X-Inertia": "true",
        "X-Inertia-Version": INERTIA_VERSION or "",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def get_xsrf_token():
    """Get current XSRF token from session cookies."""
    for c in session.cookies:
        if c.name == "XSRF-TOKEN":
            return unquote(c.value)
    return ""


def _ensure_auth():
    """Ensure we have a valid session. Re-authenticates if needed."""
    global INERTIA_VERSION

    # Check if we can make an authenticated request with existing session
    if INERTIA_VERSION:
        return True  # Already authenticated

    if not CONTENT360_EMAIL or not CONTENT360_PASSWORD:
        return False

    # Step 1: Get CSRF token and session cookies
    login_page = session.get(f"{CONTENT360_BASE_URL}/os/login")
    login_html = login_page.text

    import re
    csrf_match = re.search(r'<meta name="csrf-token" content="([^"]+)"', login_html)
    if not csrf_match:
        print("❌ Could not find CSRF token on login page")
        return False
    csrf_token = csrf_match.group(1)

    # Step 2: Submit login form
    resp = session.post(
        f"{CONTENT360_BASE_URL}/os/login",
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRF-TOKEN": csrf_token,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": f"{CONTENT360_BASE_URL}/os/login",
        },
        data=f"_token={csrf_token}&email={CONTENT360_EMAIL}&password={CONTENT360_PASSWORD}",
        allow_redirects=False,
    )

    if resp.status_code in (302, 200):
        _update_inertia_version(resp)
        print(f"✅ Logged in to Content360 as {CONTENT360_EMAIL}")
        return True

    print(f"❌ Login failed: {resp.status_code} - {resp.text[:200]}")
    return False


def c360_get(path):
    """GET request to Content360 API."""
    url = f"{CONTENT360_BASE_URL}/os/api/{CONTENT360_ORG_ID}{path}"
    resp = session.get(url, headers=inertia_headers())
    _update_inertia_version(resp)

    # If we got HTML instead of JSON, session may have expired — re-auth and retry once
    content_type = resp.headers.get("Content-Type", "")
    if "html" in content_type.lower() and resp.status_code == 200:
        if _ensure_auth():
            resp = session.get(url, headers=inertia_headers())
            _update_inertia_version(resp)

    return resp


def c360_post(path, data=None):
    """POST request to Content360 API."""
    url = f"{CONTENT360_BASE_URL}/os/api/{CONTENT360_ORG_ID}{path}"
    resp = session.post(url, headers=inertia_headers(), json=data)
    _update_inertia_version(resp)
    return resp


def c360_put(path, data=None):
    """PUT request to Content360 API."""
    url = f"{CONTENT360_BASE_URL}/os/api/{CONTENT360_ORG_ID}{path}"
    resp = session.put(url, headers=inertia_headers(), json=data)
    _update_inertia_version(resp)
    return resp


def c360_delete(path, data=None):
    """DELETE request to Content360 API."""
    url = f"{CONTENT360_BASE_URL}/os/api/{CONTENT360_ORG_ID}{path}"
    if data:
        resp = session.delete(url, headers=inertia_headers(), json=data)
    else:
        resp = session.delete(url, headers=inertia_headers())
    _update_inertia_version(resp)
    return resp


def _update_inertia_version(resp):
    """Extract and store Inertia version from response headers."""
    global INERTIA_VERSION
    if resp.headers.get("X-Inertia-Version"):
        INERTIA_VERSION = resp.headers["X-Inertia-Version"]


def get_accounts():
    """Fetch all connected social accounts."""
    resp = c360_get("/accounts")
    if resp.status_code == 200:
        data = resp.json()
        # Direct JSON format: {"data": [...accounts...]}
        if "data" in data:
            return data.get("data", [])
        # Inertia JSON format: {"props": {"accounts": [...]}}
        return data.get("props", {}).get("accounts", [])
    return []


def get_posts(status=None, per_page=100):
    """Fetch posts, optionally filtered by status."""
    params = f"?per_page={per_page}"
    if status:
        params += f"&status={status}"
    resp = c360_get(f"/posts{params}")
    if resp.status_code == 200:
        data = resp.json()
        return data.get("props", {}).get("posts", {})
    return {}


def create_post(content_text, account_ids, status="draft", schedule_at=None):
    """
    Create a new post in Content360.

    Args:
        content_text: Plain text content for the post
        account_ids: List of account IDs (as strings)
        status: "draft" or "schedule"
        schedule_at: ISO datetime string for scheduling

    Returns:
        Created post dict or None
    """
    # Build per-account version blocks
    versions = []
    for acc_id in account_ids:
        acc_id_int = int(acc_id)
        versions.append({
            "account_id": acc_id_int,
            "is_original": True,
            "content": [{
                "body": f"<div>{content_text}</div>",
                "media": [],
                "url": "",
                "opened": True
            }]
        })

    payload = {
        "content": content_text,
        "accounts": account_ids,
        "status": status,
        "versions": versions
    }

    if schedule_at:
        payload["schedule_at"] = schedule_at

    resp = c360_post("/posts", payload)

    if resp.status_code == 200 or resp.status_code == 201:
        return resp.json()

    # Try to parse error
    try:
        err = resp.json()
        print(f"   ❌ API error: {err.get('message', err)}")
        if err.get("errors"):
            for field, msgs in err["errors"].items():
                for msg in msgs:
                    print(f"      {field}: {msg}")
    except:
        print(f"   ❌ HTTP {resp.status_code}: {resp.text[:200]}")

    return None


def delete_post(uuid):
    """Delete a post by UUID."""
    resp = c360_delete(f"/posts/{uuid}")
    return resp.status_code in (200, 204)


def schedule_post(uuid):
    """Schedule a queued post."""
    resp = c360_post(f"/posts/schedule/{uuid}")
    return resp.status_code == 200


# ── Notion helpers ──────────────────────────────────────────────────────────
def notion_query_database(db_id, filter_props=None):
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    payload = {"page_size": 100}
    if filter_props:
        payload["filter"] = filter_props
    resp = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {NOTION_API_KEY}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
        json=payload,
    )
    resp.raise_for_status()
    return resp.json().get("results", [])


def extract_text(prop):
    if not prop:
        return ""
    t = prop.get("type", "")
    if t == "title":
        return "".join(x.get("plain_text", "") for x in prop.get("title", []))
    if t == "rich_text":
        return "".join(x.get("plain_text", "") for x in prop.get("rich_text", []))
    if t == "select":
        return prop.get("select", {}).get("name", "") or ""
    if t == "multi_select":
        return [x.get("name", "") for x in prop.get("multi_select", [])]
    if t == "date":
        return prop.get("date", {}).get("start", "") or ""
    if t == "checkbox":
        return prop.get("checkbox", False)
    if t == "number":
        return prop.get("number", 0) or 0
    return ""


def notion_update_page(page_id, properties):
    url = f"https://api.notion.com/v1/pages/{page_id}"
    resp = requests.patch(
        url,
        headers={
            "Authorization": f"Bearer {NOTION_API_KEY}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
        json={"properties": properties},
    )
    resp.raise_for_status()
    return resp.json()


# ── Sync logic ─────────────────────────────────────────────────────────────
def sync_notion_to_content360(dry_run=True, platforms=None):
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Syncing Notion → Content360")
    print(f"Platforms: {platforms or 'all'}\n")

    # 0. Ensure we have credentials
    if not CONTENT360_API_KEY:
        print("❌ CONTENT360_API_KEY not set.")
        sys.exit(1)
    if not CONTENT360_ORG_ID:
        print("❌ CONTENT360_ORG_ID not set.")
        sys.exit(1)

    # 1. Login if no session
    print("Connecting to Content360...")
    if not CONTENT360_API_KEY or not CONTENT360_EMAIL:
        print("⚠️  No API key, attempting session login...")
        _ensure_auth()
    else:
        # Try with existing token, verify it works
        resp = c360_get("/posts")
        if resp.status_code == 401:
            print("⚠️  Token expired, re-authing via session login...")
            _ensure_auth()
        else:
            print(f"✅ Connected with bearer token")
            _update_inertia_version(resp)

    # 2. Build platform → account ID mapping
    print("Fetching accounts...")
    accounts = get_accounts()
    platform_to_accounts = {}
    for acc in accounts:
        provider = acc.get("provider", "").lower()
        if provider not in platform_to_accounts:
            platform_to_accounts[provider] = []
        platform_to_accounts[provider].append({
            "id": str(acc["id"]),
            "name": acc.get("name", ""),
            "provider": provider,
        })

    print(f"Found {len(accounts)} accounts across {len(platform_to_accounts)} platforms")

    # 3. Fetch unscheduled posts from Notion
    print("\nFetching unscheduled posts from Notion...")
    pages = notion_query_database(NOTION_DATABASE_ID)
    unscheduled = []
    for page in pages:
        props = page.get("properties", {})
        posted = extract_text(props.get("Posted"))
        if posted:
            continue
        schedule_date = extract_text(props.get("Schedule"))
        platform = extract_text(props.get("Platform"))
        if platforms and platform.lower() not in [p.lower() for p in platforms]:
            continue
        unscheduled.append({
            "page_id": page["id"],
            "props": props,
            "platform": platform,
            "schedule_date": schedule_date,
        })

    print(f"Found {len(unscheduled)} unscheduled post(s) in Notion")

    if not unscheduled:
        print("Nothing to sync.")
        return []

    # 4. Create posts in Content360
    created = []
    for item in unscheduled:
        props = item["props"]
        page_id = item["page_id"]
        platform = item["platform"].lower()
        schedule_date = item["schedule_date"]

        # Get caption/hook/cta
        caption = extract_text(props.get("Caption", ""))
        hook = extract_text(props.get("Hook", ""))
        cta = extract_text(props.get("CTA", ""))

        if hook:
            full_text = f"{hook}\n\n{caption}"
        else:
            full_text = caption

        if cta:
            full_text += f"\n\n{cta}"

        if not full_text.strip():
            print(f"  ⚠️  Skipping empty post (page {page_id})")
            continue

        # Select account
        accs = platform_to_accounts.get(platform, [])
        if not accs:
            print(f"  ⚠️  No {platform} account found, skipping")
            continue

        account_ids = [accs[0]["id"]]  # Use first account for this platform
        status = "draft" if not schedule_date else "schedule"

        if dry_run:
            print(f"  [DRY RUN] Would create post for {platform}: {hook or caption[:60]}...")
            continue

        print(f"  Creating {platform} post: {hook or caption[:50]}...")
        post = create_post(full_text, account_ids, status=status)

        if post:
            uuid = post.get("uuid", "")
            print(f"  ✅ Created post UUID: {uuid}")

            # Mark as posted in Notion
            try:
                notion_update_page(page_id, {"Posted": {"checkbox": True}})
                print(f"  ✅ Marked as Posted in Notion")
            except Exception as e:
                print(f"  ⚠️  Could not update Notion: {e}")

            created.append({
                "page_id": page_id,
                "platform": platform,
                "uuid": uuid,
                "post": post,
            })
        else:
            print(f"  ❌ Failed to create post")

        time.sleep(0.5)  # Rate limit

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Created {len(created)} post(s) in Content360")
    return created


# ── CLI ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync Notion content calendar to Content360")
    parser.add_argument("--dry-run", action="store_true", default=False,
                        help="Show what would be done without making changes")
    parser.add_argument("--platforms", type=str, default="",
                        help="Comma-separated list: facebook,linkedin,x,instagram,youtube,tiktok,pinterest,reddit")
    args = parser.parse_args()

    platforms = [p.strip() for p in args.platforms.split(",") if p.strip()] or None

    if not CONTENT360_API_KEY:
        print("❌ CONTENT360_API_KEY environment variable not set.")
        sys.exit(1)

    created = sync_notion_to_content360(dry_run=args.dry_run, platforms=platforms)
