#!/usr/bin/env python3
"""
Daily Insurance Lead Email Pipeline
====================================
1. Find 100 HK insurance agent leads (free sources first, then Apify)
2. Verify emails via Apify Email Verifier
3. Dedup against sent_emails.json
4. Send email via Brevo with YouTube video promotion
5. Record sent emails

Config: data/config.json
Sent log: data/sent_emails.json
"""
import json
import os
import sys
import time
import hashlib
import csv
import io
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

HKT = timezone(timedelta(hours=8))
SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"
ASSETS_DIR = SKILL_DIR / "assets"

# ─── Load config ───────────────────────────────────────────────
with open(DATA_DIR / "config.json") as f:
    config = json.load(f)

SENDER_EMAIL = config["sender"]["email"]
SENDER_NAME = config["sender"]["name"]
BREVO_LIST_ID = config["brevo"]["list_id"]
TARGET_COUNT = config["pipeline"]["target_count"]
YOUTUBE_TITLE = config["youtube"]["video_title"]
YOUTUBE_URL = config["youtube"]["video_url"]
THUMBNAIL_URL = config["youtube"]["thumbnail_url"]

# ─── Cost tracking ──────────────────────────────────────────────
APIFY_CU_COST = config.get("costs", {}).get("apify", {}).get("compute_unit_usd", 0.40)
APIFY_LEAD_COST_PER_PROFILE = config.get("costs", {}).get("apify", {}).get("lead_cost_per_profile", 0.06)
BREVO_COST_PER_EMAIL = config.get("costs", {}).get("brevo", {}).get("cost_per_email_usd", 0.00125)
BREVO_FREE_LIMIT = config.get("costs", {}).get("brevo", {}).get("free_daily_limit", 300)

COSTS_FILE = DATA_DIR / "costs.json"

def load_costs():
    if COSTS_FILE.exists():
        with open(COSTS_FILE) as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                pass
    return {"total_apify_cu": 0, "total_apify_cost_usd": 0, "total_brevo_sent": 0, "total_brevo_cost_usd": 0, "daily_log": []}

def save_costs(costs):
    with open(COSTS_FILE, "w") as f:
        json.dump(costs, f, indent=2, ensure_ascii=False)

# ─── Brevo API ─────────────────────────────────────────────────
BREVO_KEY = os.environ.get("BREVO_API_KEY", "")
BREVO_HEADERS = {
    "accept": "application/json",
    "content-type": "application/json",
    "api-key": BREVO_KEY,
}

# ─── Apify API ─────────────────────────────────────────────────
APIFY_KEY = os.environ.get("APIFY_API_KEY", "")

def log(msg):
    print(f"[{datetime.now(HKT).strftime('%H:%M:%S')}] {msg}")

def load_sent_emails():
    """Load previously sent emails as a set for fast dedup."""
    path = DATA_DIR / "sent_emails.json"
    if path.exists():
        with open(path) as f:
            try:
                data = json.load(f)
                return set(data)
            except json.JSONDecodeError:
                return set()
    return set()

def save_sent_emails(sent_set):
    """Save sent emails set to file."""
    with open(DATA_DIR / "sent_emails.json", "w") as f:
        json.dump(sorted(list(sent_set)), f, indent=2)

def find_leads_free():
    """
    Find Hong Kong insurance agents using free methods.
    Returns list of {name, email, title, company}
    """
    leads = []
    
    # Method 1: Try Google scraping for HK insurance agent directories
    log("🔍 嘗試免費方法搵 lead...")
    
    # Use agent-browser to search HK insurance agent contacts
    import subprocess
    
    search_queries = [
        "香港保險代理 email contact",
        "Hong Kong insurance agent email directory",
        "香港保險從業員 聯絡 email",
    ]
    
    for query in search_queries:
        if len(leads) >= TARGET_COUNT:
            break
        try:
            # Use read_webpage equivalent - google search
            result = subprocess.run(
                ["curl", "-s", 
                 f"https://www.google.com/search?q={query}&num=20",
                 "-H", "User-Agent: Mozilla/5.0"],
                capture_output=True, text=True, timeout=15
            )
            # Basic email extraction from search results
            found_emails = re.findall(
                r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
                result.stdout
            )
            for email in found_emails:
                email = email.lower()
                # Filter out common non-personal emails
                if any(x in email for x in ['google', 'noreply', 'admin', 'info@']):
                    continue
                if len(leads) >= TARGET_COUNT:
                    break
                leads.append({
                    "email": email,
                    "name": "",
                    "title": "",
                    "company": "",
                    "source": "google_search"
                })
        except Exception as e:
            log(f"  ⚠️ Search '{query}' failed: {e}")
    
    log(f"  📊 免費方法搵到 {len(leads)} 個 leads")
    return leads

def find_leads_apify():
    """
    Find HK insurance agents using Apify LinkedIn Search (HarvestAPI).
    """
    log("🔍 使用 Apify LinkedIn Search (HarvestAPI)...")
    
    actor_id = config["apify"]["lead_actor_id"]
    run_url = f"https://api.apify.com/v2/acts/{actor_id}/runs?token={APIFY_KEY}"
    
    payload = {
        "searchQuery": "insurance agent Hong Kong",
        "locations": ["Hong Kong"],
        "maxProfiles": TARGET_COUNT + 20,
        "profileMode": "full-email-search",
        "proxy": {"useApifyProxy": True}
    }
    
    resp = __import__('requests').post(run_url, json=payload)
    if resp.status_code != 201:
        log(f"  ❌ Apify actor start failed: {resp.status_code}")
        log(f"     Response: {resp.text[:200]}")
        return [], 0.0
    
    run_data = resp.json()
    run_id = run_data["data"]["id"]
    log(f"  🔄 Apify run started: {run_id}")
    
    # Wait for completion (max 2 min)
    for i in range(24):
        time.sleep(5)
        status_url = f"https://api.apify.com/v2/acts/{actor_id}/runs/{run_id}?token={APIFY_KEY}"
        status_resp = __import__('requests').get(status_url)
        status_data = status_resp.json()
        status = status_data["data"]["status"]
        
        if status == "SUCCEEDED":
            break
        elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
            log(f"  ❌ Apify run {status}")
            return [], 0.0
        
        if i % 4 == 0:
            log(f"  ⏳ Waiting... ({status})")
    else:
        log("  ⚠️ Apify run timed out")
        return [], 0.0
    
    log(f"  ✅ Apify run completed")
    
    # Get CU usage
    cu_used = status_data["data"].get("stats", {}).get("computeUnits", 0) if "status_data" in dir() else 0
    
    # Fetch results
    dataset_id = status_data["data"]["defaultDatasetId"]
    items_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_KEY}&clean=true&format=json"
    items_resp = __import__('requests').get(items_url)
    items = items_resp.json()
    
    leads = []
    for item in items[:TARGET_COUNT + 20]:
        leads.append({
            "name": item.get("name", ""),
            "email": item.get("email", ""),
            "title": item.get("title", ""),
            "company": item.get("company", ""),
            "profileUrl": item.get("profileUrl", ""),
            "source": "apify_linkedin"
        })
    
    # Calculate cost: per-profile pricing
    cost_per_profile = config.get("costs", {}).get("apify", {}).get("lead_cost_per_profile", 0.06)
    lead_cost = len(items) * cost_per_profile if items else cu_used * APIFY_CU_COST
    
    log(f"  📊 Apify 搵到 {len(leads)} 個 leads (from {len(items)} profiles)")
    log(f"  💰 Lead gen cost: ${lead_cost:.4f} ({len(items)} profiles × ${cost_per_profile})")
    return leads, lead_cost

def verify_emails_apify(emails):
    """
    Verify email addresses using Apify Email Verifier (michael.g).
    Returns: (verified_emails_dict, cost)
    """
    log(f"  🔍 Verifying {len(emails)} emails via Apify...")
    
    actor_id = config["apify"]["email_verifier_actor_id"]
    run_url = f"https://api.apify.com/v2/acts/{actor_id}/runs?token={APIFY_KEY}"
    
    run_input = {
        "emails": emails,
        "resultType": "full"
    }
    
    resp = __import__('requests').post(run_url, json=run_input)
    if resp.status_code != 201:
        log(f"  ❌ Verification start failed: {resp.status_code}")
        return {e: True for e in emails}, 0.0
    
    run_data = resp.json()
    run_id = run_data["data"]["id"]
    
    for i in range(24):
        time.sleep(5)
        status_url = f"https://api.apify.com/v2/acts/{actor_id}/runs/{run_id}?token={APIFY_KEY}"
        status_resp = __import__('requests').get(status_url)
        status_data = status_resp.json()
        status = status_data["data"]["status"]
        
        if status == "SUCCEEDED":
            break
        elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
            log(f"  ❌ Verification {status}")
            return {e: True for e in emails}, 0.0
        
        if i % 4 == 0:
            log(f"  ⏳ Verifying... ({status})")
    else:
        log("  ⚠️ Verification timed out - skipping verification for safety")
        return {e: True for e in emails}, 0.0
    
    # Get CU usage
    cu_used = status_data["data"].get("stats", {}).get("computeUnits", 0)
    verify_cost = cu_used * APIFY_CU_COST
    
    # Fetch results
    dataset_id = status_data["data"]["defaultDatasetId"]
    items_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_KEY}&clean=true&format=json"
    items_resp = __import__('requests').get(items_url)
    items = items_resp.json()
    
    verified = {}
    valid_count = 0
    for item in items:
        email = item.get("email", "")
        status_val = item.get("email_status", "").upper()
        is_valid = status_val not in ("INVALID", "DISPOSABLE", "UNKNOWN")
        verified[email] = is_valid
        if is_valid:
            valid_count += 1
    
    log(f"  ✅ Verified: {valid_count}/{len(emails)} valid")
    log(f"  💰 Verification cost: ${verify_cost:.4f} ({cu_used:.4f} CU)")
    return verified, verify_cost

def build_email(recipient_email):
    """Build email HTML by filling in template variables."""
    template_path = ASSETS_DIR / "email_template.html"
    with open(template_path) as f:
        html = f.read()
    
    html = html.replace("{{VIDEO_URL}}", YOUTUBE_URL)
    html = html.replace("{{THUMBNAIL_URL}}", THUMBNAIL_URL)
    html = html.replace("{{VIDEO_TITLE}}", YOUTUBE_TITLE)
    
    return html

def send_email_brevo(to_email, html_content, subject):
    """Send email via Brevo transactional API."""
    payload = {
        "sender": {
            "name": SENDER_NAME,
            "email": SENDER_EMAIL
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content,
        "headers": {
            "X-Mailin-custom": "daily_insurance_lead|youtube_manus"
        }
    }
    
    resp = __import__('requests').post(
        "https://api.brevo.com/v3/smtp/email",
        headers=BREVO_HEADERS,
        json=payload,
        timeout=30
    )
    
    if resp.status_code in (200, 201):
        return True, resp.json().get("messageId", "")
    else:
        return False, resp.text[:200]

def add_to_brevo_list(email, name=""):
    """Add contact to Brevo list 'Zcomputer lead'."""
    payload = {
        "email": email,
        "attributes": {"FIRSTNAME": name or email.split("@")[0]},
        "listIds": [BREVO_LIST_ID],
        "updateEnabled": True,
    }
    
    resp = __import__('requests').post(
        "https://api.brevo.com/v3/contacts",
        headers=BREVO_HEADERS,
        json=payload,
        timeout=15
    )
    
    return resp.status_code in (200, 201, 204)

# ─── Main Pipeline ─────────────────────────────────────────────
def main():
    log("=" * 60)
    log("🚀 Daily Insurance Lead Email Pipeline")
    log("=" * 60)
    
    # Load cost configs
    sent_emails = load_sent_emails()
    log(f"📋 已發送 email 數量: {len(sent_emails)}")
    
    # --- STEP 1: Find leads ---
    free_leads = find_leads_free()
    leads = free_leads
    lead_gen_cost = 0.0
    
    if len(leads) >= TARGET_COUNT:
        log(f"✅ 免費方法搵到足夠 leads: {len(leads)}")
    else:
        if free_leads:
            log(f"⚡ 免費方法搵到 {len(free_leads)} 個，補 Apify...")
        leads, lead_gen_cost = find_leads_apify()
        leads = free_leads + leads
    
    if not leads:
        log("❌ 搵唔到任何 lead，結束")
        return
    
    log(f"📊 總共搵到 {len(leads)} leads")
    
    # Dedup by name+email
    unique_leads = []
    unique_keys = set()
    for l in leads:
        dedup_key = f"{l['name']}:{l['email']}"
        if dedup_key not in unique_keys:
            unique_keys.add(dedup_key)
            unique_leads.append(l)
    
    # --- STEP 2: Verify emails ---
    emails_to_check = list(set(l["email"] for l in unique_leads if l["email"] and l["email"] not in sent_emails))
    verified_map = {}
    verify_cost = 0.0
    
    if emails_to_check:
        verified_map, verify_cost = verify_emails_apify(emails_to_check)
    
    # --- STEP 3: Filter valid + dedup ---
    valid_leads = []
    skipped_dupes = 0
    for l in unique_leads:
        email = l["email"]
        if not email:
            continue
        if email in sent_emails:
            skipped_dupes += 1
            continue
        # Accept if verified map says OK, or if we couldn't verify (skip verification missing emails)
        if verified_map.get(email, True):
            valid_leads.append(l)
    
    log(f"📊 After dedup + verify: {len(valid_leads)} valid leads (skipped {skipped_dupes} dupes)")
    
    if not valid_leads:
        log("❌ 冇 valid lead 可以 send，結束")
        return
    
    # --- STEP 4: Send emails via Brevo ---
    sent_count, total_sent, errors = send_via_brevo(valid_leads, sent_emails)
    
    # --- STEP 5: Cost summary ---
    brevo_cost = sent_count * BREVO_COST_PER_EMAIL
    total_cost = lead_gen_cost + verify_cost + brevo_cost
    
    log("=" * 60)
    log("🏁 Pipeline 完成!")
    log("=" * 60)
    log(f"📈 Leads 搵到: {len(leads)} (free: {len(free_leads)}, apify: {len(leads) - len(free_leads)})")
    log(f"✅ Valid leads: {len(valid_leads)}")
    log(f"📨 成功發送: {sent_count}")
    log(f"📋 累計已發送: {len(sent_emails)}")
    log(f"⏭️  Skipped dupe: {skipped_dupes}")
    log("--- 💰 成本明細 ---")
    log(f"  💰 Lead gen:    ${lead_gen_cost:.4f}")
    log(f"  💰 Verify:      ${verify_cost:.4f}")
    log(f"  💰 Brevo send:  ${brevo_cost:.4f} ({sent_count} emails)")
    log(f"  🏁 TOTAL:       ${total_cost:.4f}")
    log("=" * 60)
    
    if errors:
        log(f"⚠️ Errors ({len(errors)}):")
        for e in errors[:5]:
            log(f"   - {e}")
    
    return sent_count, len(sent_emails), errors

if __name__ == "__main__":
    main()
