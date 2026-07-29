#!/usr/bin/env python3
"""
Daily Insurance Lead Email Pipeline
====================================
每日搵 100 個香港保險 Agent email → Verify → Dedup → Brevo List → Send
免費方案先行，唔夠再落 Apify 付費

Usage:
  python3 run_pipeline.py --dry-run     # 試 run，唔 send
  python3 run_pipeline.py               # 正式 send
"""

import os, sys, json, time, argparse, traceback
import requests
from datetime import datetime, timezone
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"
REF_DIR = SKILL_DIR / "references"

BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
APIFY_API_KEY = os.environ.get("APIFY_API_KEY", "")

BREVO_BASE = "https://api.brevo.com/v3"
APIFY_BASE = "https://api.apify.com/v2"

# ──────────────────────────────────────────
# Config
# ──────────────────────────────────────────
def load_config():
    with open(DATA_DIR / "config.json") as f:
        return json.load(f)

# ──────────────────────────────────────────
# LEAD GENERATION
# ──────────────────────────────────────────
def apify_get_leads(cfg, target_count=100):
    """
    Step 1: 用 Apify LinkedIn Profile Scraper & Email Finder
    搵香港保險 agent email。
    免費 monthly credit 先行，唔夠先 trigger paid。
    """
    actor_id = cfg["apify"]["lead_actor_id"]
    url = f"{APIFY_BASE}/acts/{actor_id}/runs"
    
    input_data = {
        "searchUrls": [
            {
                "url": "https://www.linkedin.com/search/results/people/?keywords=insurance%20agent%20Hong%20Kong",
                "method": "SEARCH_URL"
            },
            {
                "url": "https://www.linkedin.com/search/results/people/?keywords=%E4%BF%9D%E9%9A%AA%E7%B6%93%E7%B4%80%20Hong%20Kong",
                "method": "SEARCH_URL"
            },
            {
                "url": "https://www.linkedin.com/search/results/people/?keywords=insurance%20financial%20consultant%20Hong%20Kong",
                "method": "SEARCH_URL"
            },
            {
                "url": "https://www.linkedin.com/search/results/people/?keywords=%E4%BF%9D%E9%9A%AA%E9%A1%A7%E5%95%8F%20Hong%20Kong",
                "method": "SEARCH_URL"
            }
        ],
        "maxResults": target_count * 2,  # 擸多啲，verify 會篩走唔少
        "findEmails": True,
        "emailType": "personal",
        "minDelay": 2,
        "maxDelay": 5
    }
    
    print(f"🚀 Launching Apify lead actor {actor_id}...")
    resp = requests.post(url, json=input_data, params={"token": APIFY_API_KEY})
    resp.raise_for_status()
    run_data = resp.json()
    run_id = run_data["data"]["id"]
    
    print(f"   Run ID: {run_id} — waiting for completion...")
    dataset_url = f"{APIFY_BASE}/actor-runs/{run_id}/dataset/items"
    
    # Poll until done
    for i in range(60):
        status_resp = requests.get(f"{APIFY_BASE}/actor-runs/{run_id}", params={"token": APIFY_API_KEY})
        status = status_resp.json()["data"]["status"]
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            break
        time.sleep(10)
    
    if status != "SUCCEEDED":
        print(f"   ❌ Actor ended with status: {status}")
        return []
    
    # Fetch results
    items = []
    offset = 0
    while len(items) < target_count * 3:
        r = requests.get(dataset_url, params={"token": APIFY_API_KEY, "offset": offset, "limit": 200})
        batch = r.json()
        if not batch:
            break
        for item in batch:
            email = item.get("email", "")
            if email and "@" in email:
                items.append({
                    "name": f"{item.get('firstName','')} {item.get('lastName','')}".strip(),
                    "email": email,
                    "title": item.get("title", ""),
                    "company": item.get("companyName", ""),
                    "linkedin_url": item.get("url", ""),
                    "source": "apify_linkedin"
                })
        offset += 200
    
    print(f"   ✅ Got {len(items)} raw leads with emails")
    return items[:target_count * 3]

# ──────────────────────────────────────────
# EMAIL VERIFICATION (Apify Email Verifier)
# ──────────────────────────────────────────
def verify_emails(leads, cfg):
    """
    Step 2: Verify emails via Apify Email Verifier
    """
    emails = [l["email"] for l in leads]
    if not emails:
        return []
    
    actor_id = cfg["apify"]["email_verifier_actor_id"]
    url = f"{APIFY_BASE}/acts/{actor_id}/runs"
    
    print(f"🔍 Verifying {len(emails)} emails...")
    resp = requests.post(url, json={"emails": emails}, params={"token": APIFY_API_KEY})
    resp.raise_for_status()
    run_id = resp.json()["data"]["id"]
    
    for i in range(30):
        status_resp = requests.get(f"{APIFY_BASE}/actor-runs/{run_id}", params={"token": APIFY_API_KEY})
        status = status_resp.json()["data"]["status"]
        if status in ("SUCCEEDED", "FAILED", "ABORTED"):
            break
        time.sleep(5)
    
    if status != "SUCCEEDED":
        print(f"   ⚠️ Verification ended: {status}")
        return leads  # fallback: return all, rely on Brevo bounces
    
    # Fetch verified results
    dataset_url = f"{APIFY_BASE}/actor-runs/{run_id}/dataset/items"
    verified = []
    for r in requests.get(dataset_url, params={"token": APIFY_API_KEY, "limit": 5000}).json():
        if r.get("isValid") and r.get("status") not in ("INVALID", "CATCH_ALL"):
            verified.append(r["email"])
    
    valid_leads = [l for l in leads if l["email"] in set(verified)]
    print(f"   ✅ {len(valid_leads)}/{len(leads)} emails verified")
    return valid_leads

# ──────────────────────────────────────────
# DEDUP
# ──────────────────────────────────────────
def dedup_leads(leads):
    """
    Step 3: Remove already-sent emails
    """
    sent_file = DATA_DIR / "sent_emails.json"
    if sent_file.exists():
        with open(sent_file) as f:
            sent = set(json.load(f))
    else:
        sent = set()
    
    new_leads = [l for l in leads if l["email"].lower() not in sent]
    print(f"📋 Dedup: {len(new_leads)} new / {len(leads)} total (already sent: {len(leads) - len(new_leads)})")
    return new_leads

# ──────────────────────────────────────────
# BREVO: Add contacts to list
# ──────────────────────────────────────────
def brevo_add_contacts(leads, list_id):
    """
    Step 4: Add verified, dedup'd leads to Brevo list
    """
    if not leads:
        return
    
    print(f"📥 Adding {len(leads)} contacts to Brevo list {list_id}...")
    
    # Brevo limit: 150 contacts per batch import
    batch_size = 100
    for i in range(0, len(leads), batch_size):
        batch = leads[i:i+batch_size]
        payload = {
            "listIds": [list_id],
            "updateEnabled": False,
            "contacts": [
                {
                    "email": l["email"].lower(),
                    "attributes": {
                        "FIRSTNAME": l.get("name", "").split()[0] if l.get("name") else "",
                        "LASTNAME": " ".join(l.get("name", "").split()[1:]) if l.get("name") else "",
                        "TITLE": l.get("title", ""),
                        "COMPANY": l.get("company", ""),
                        "LINKEDIN": l.get("linkedin_url", ""),
                        "SOURCE": l.get("source", "apify")
                    }
                }
                for l in batch
            ]
        }
        resp = requests.post(
            f"{BREVO_BASE}/contacts/import",
            headers={"api-key": BREVO_API_KEY, "content-type": "application/json"},
            json=payload
        )
        if resp.status_code == 202:
            print(f"   Batch {i//batch_size +1}: {len(batch)} contacts queued")
        else:
            print(f"   ⚠️ Batch {i//batch_size +1} failed: {resp.status_code} {resp.text[:200]}")

# ──────────────────────────────────────────
# BREVO: Send transactional email
# ──────────────────────────────────────────
def brevo_send_emails(leads, cfg, dry_run=False):
    """
    Step 5: Send personalized email to each lead
    """
    if not leads:
        return 0
    
    yt = cfg["youtube"]
    contact = cfg["contact"]
    
    template_path = REF_DIR / "email_template.html"
    with open(template_path, "r") as f:
        template = f.read()
    
    sent_count = 0
    for i, lead in enumerate(leads):
        name = lead.get("name", "").split()[0] if lead.get("name") else "你好"
        greeting = f"{name}，" if name and name != "你好" else "你好，"
        
        html = template.replace("{{video_url}}", yt["video_url"])
        html = html.replace("{{thumbnail_url}}", yt["thumbnail_url"])
        html = html.replace("{{video_title}}", yt["video_title"])
        html = html.replace("{{channel_url}}", yt["channel_url"])
        html = html.replace("{{website}}", contact["website"])
        html = html.replace("{{course_url}}", contact["course_url"])
        html = html.replace("{{hkai_club}}", contact["hkai_club"])
        html = html.replace("<tr><td style=\"padding:28px 40px 12px 40px\">",
                           f"<tr><td style=\"padding:4px 40px 0 40px\"><p style=\"color:#444;font-size:14px;margin:0 0 12px 0\">{greeting}</p></td></tr>\n<tr><td style=\"padding:0 40px 12px 40px\">")
        
        payload = {
            "sender": {"name": contact["sender_name"], "email": contact["sender_email"]},
            "to": [{"email": lead["email"].lower(), "name": lead.get("name", "")}],
            "subject": yt["video_title"],
            "htmlContent": html
        }
        
        if dry_run:
            print(f"   [DRY RUN] Would send to: {lead['email']} ({lead.get('name','')})")
            sent_count += 1
        else:
            resp = requests.post(
                f"{BREVO_BASE}/smtp/email",
                headers={"api-key": BREVO_API_KEY, "content-type": "application/json"},
                json=payload
            )
            if resp.status_code == 201:
                sent_count += 1
            else:
                print(f"   ⚠️ Failed to send to {lead['email']}: {resp.status_code} {resp.text[:100]}")
        
        # Rate limit: ~1 per second to avoid Brevo throttle
        if not dry_run and i < len(leads) - 1:
            time.sleep(1.2)
    
    print(f"📧 Sent: {sent_count}/{len(leads)}")
    return sent_count

# ──────────────────────────────────────────
# UPDATE SENT LOG
# ──────────────────────────────────────────
def update_sent_log(leads):
    """
    Step 6: Record sent emails to prevent re-sending
    """
    sent_file = DATA_DIR / "sent_emails.json"
    if sent_file.exists():
        with open(sent_file) as f:
            sent = json.load(f)
    else:
        sent = []
    
    new_emails = [l["email"].lower() for l in leads]
    sent.extend(new_emails)
    sent = sorted(set(sent))
    
    with open(sent_file, "w") as f:
        json.dump(sent, f, indent=2)
    
    print(f"💾 Sent log updated: {len(sent)} total unique emails")

# ──────────────────────────────────────────
# SAVE TODAY'S RAW LEADS
# ──────────────────────────────────────────
def save_leads_csv(leads, tag="sent"):
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    path = DATA_DIR / f"leads_{tag}_{ts}.csv"
    import csv
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["name","email","title","company","linkedin_url","source"])
        w.writeheader()
        for l in leads:
            w.writerow({k: l.get(k, "") for k in w.fieldnames})
    print(f"📄 Saved: {path}")

# ──────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Don't actually send emails")
    parser.add_argument("--count", type=int, default=100, help="Target lead count")
    args = parser.parse_args()
    
    cfg = load_config()
    target = args.count
    
    print(f"╔══════════════════════════════════════╗")
    print(f"║  Daily Insurance Lead Pipeline      ║")
    print(f"║  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}         ║")
    print(f"╚══════════════════════════════════════╝")
    print(f"  Target: {target} verified leads")
    print(f"  Brevo List: {cfg['brevo']['list_name']} (#{cfg['brevo']['list_id']})")
    print(f"  Video: {cfg['youtube']['video_title'][:50]}...")
    print()
    
    # Step 1: Get leads
    leads = apify_get_leads(cfg, target_count=target)
    if not leads:
        print("❌ No leads found. Abort.")
        return
    
    # Step 2: Verify
    verified = verify_emails(leads, cfg)
    
    # Step 3: Dedup
    new_leads = dedup_leads(verified)
    
    if not new_leads:
        print("✅ No new leads to send today.")
        return
    
    # Step 4: Add to Brevo list
    brevo_add_contacts(new_leads, cfg["brevo"]["list_id"])
    
    # Step 5: Send emails
    sent = brevo_send_emails(new_leads, cfg, dry_run=args.dry_run)
    
    if not args.dry_run and sent > 0:
        # Step 6: Save sent log
        update_sent_log(new_leads)
        save_leads_csv(new_leads, "sent")
    
    print(f"\n✅ Done! {sent} emails {'would be ' if args.dry_run else ''}sent.")

if __name__ == "__main__":
    main()
