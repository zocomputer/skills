#!/usr/bin/env python3
"""
Daily Insurance Lead Email Pipeline
====================================
Orchestrates the full daily pipeline:
1. Find leads (free methods first)  
2. Verify emails via Apify
3. Dedup against sent list
4. Create/update Brevo list & send campaign
"""

import json
import sys
import os
import argparse
from datetime import datetime
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"
SENT_EMAILS_FILE = DATA_DIR / "sent_emails.json"

def load_config():
    with open(DATA_DIR / "config.json", "r", encoding="utf-8") as f:
        return json.load(f)

def load_sent_emails():
    if SENT_EMAILS_FILE.exists():
        with open(SENT_EMAILS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"emails": [], "last_updated": None}

def save_sent_emails(data):
    data["last_updated"] = datetime.now().isoformat()
    with open(SENT_EMAILS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def dedup_leads(new_leads, sent_emails):
    """Dedup new leads against sent emails list."""
    sent_set = set(sent_emails.get("emails", []))
    return [l for l in new_leads if l.get("email", "").lower().strip() not in sent_set]

def mark_as_sent(sent_emails, leads):
    """Mark leads as sent."""
    for lead in leads:
        sent_emails["emails"].append(lead["email"].lower().strip())

def main(dry_run=False):
    config = load_config()
    sent_emails = load_sent_emails()
    
    print(f"=== Daily Insurance Lead Email Pipeline ===")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Target: {config['target_daily_leads']} leads")
    print(f"Industry: {config['target_industry']} | Location: {config['target_location']} | Role: {config['target_role']}")
    print(f"Brevo List: {config['brevo_list_name']}")
    print(f"Sender: {config['sender_email']}")
    print(f"Dry Run: {dry_run}")
    print(f"Sent history: {len(sent_emails['emails'])} emails\n")

    # Step 1: Find leads (handled by lead_finder.py)
    print("[Step 1/5] Finding leads...")
    leads_script = SKILL_DIR / "scripts" / "lead_finder.py"
    import subprocess
    result = subprocess.run(
        ["python3", str(leads_script), "--count", str(config["target_daily_leads"])],
        capture_output=True, text=True, cwd=str(SKILL_DIR)
    )
    if result.returncode != 0:
        print(f"ERR: Lead finder failed: {result.stderr}")
        sys.exit(1)
    
    new_leads = json.loads(result.stdout)
    print(f"  Found: {len(new_leads)} raw leads")

    # Step 2: Verify emails via Apify
    print("[Step 2/5] Verifying emails via Apify...")
    verify_script = SKILL_DIR / "scripts" / "email_verifier.py"
    result = subprocess.run(
        ["python3", str(verify_script)],
        input=json.dumps(new_leads),
        capture_output=True, text=True, cwd=str(SKILL_DIR)
    )
    if result.returncode != 0:
        print(f"ERR: Email verifier failed: {result.stderr}")
        sys.exit(1)
    
    verified_leads = json.loads(result.stdout)
    print(f"  Verified: {len(verified_leads)} leads")

    # Step 3: Dedup
    print("[Step 3/5] Dedup against sent history...")
    final_leads = dedup_leads(verified_leads, sent_emails)
    print(f"  After dedup: {len(final_leads)} new leads")

    if not final_leads:
        print("\n⚠️ No new leads to send. Exiting.")
        return

    # Step 4: Send via Brevo
    print("[Step 4/5] Sending via Brevo...")
    brevo_script = SKILL_DIR / "scripts" / "brevo_handler.py"
    result = subprocess.run(
        ["python3", str(brevo_script), "--dry-run", str(dry_run).lower()],
        input=json.dumps(final_leads),
        capture_output=True, text=True, cwd=str(SKILL_DIR)
    )
    if result.returncode != 0:
        print(f"ERR: Brevo handler failed: {result.stderr}")
        sys.exit(1)

    brevo_result = json.loads(result.stdout)
    print(f"  Campaign created: {brevo_result.get('campaign_id', 'N/A')}")
    print(f"  Sent to: {brevo_result.get('sent_count', 0)} contacts")

    # Step 5: Update sent tracking
    if not dry_run:
        print("[Step 5/5] Updating sent tracking...")
        mark_as_sent(sent_emails, final_leads)
        save_sent_emails(sent_emails)
        print(f"  Total sent history: {len(sent_emails['emails'])} emails")
    
    print(f"\n=== Pipeline Complete ===")
    print(f"Leads found: {len(new_leads)}")
    print(f"Verified: {len(verified_leads)}")
    print(f"Sent: {len(final_leads)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Daily Insurance Lead Email Pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, don't send")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
