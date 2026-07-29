#!/usr/bin/env python3
"""
Dedup Manager
==============
Tracks sent emails to prevent duplicates.
Reads/writes sent_emails.json in the data directory.
"""

import json
import sys
import time
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"
SENT_FILE = DATA_DIR / "sent_emails.json"

def load_sent():
    """Load list of previously sent emails."""
    if SENT_FILE.exists():
        with open(SENT_FILE) as f:
            data = json.load(f)
        return set(data.get("emails", []))
    return set()

def save_sent(email_set):
    """Save sent emails list."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(SENT_FILE, "w") as f:
        json.dump({
            "count": len(email_set),
            "emails": sorted(list(email_set)),
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S")
        }, f, ensure_ascii=False, indent=2)

def dedup_and_mark(leads):
    """
    Filter out already-sent emails, mark new ones as sent.
    Returns tuple: (new_leads, skipped_count)
    """
    sent = load_sent()
    new_leads = []
    skipped = 0
    
    for lead in leads:
        email = lead.get("email", "").lower()
        if not email:
            skipped += 1
            continue
        
        if email in sent:
            skipped += 1
        else:
            new_leads.append(lead)
            sent.add(email)
    
    # Save updated sent set
    save_sent(sent)
    
    print(f"[Dedup] {len(leads)} input → {len(new_leads)} new, {skipped} skipped (already sent)", file=sys.stderr)
    return new_leads, skipped

if __name__ == "__main__":
    raw_input = sys.stdin.read()
    if not raw_input.strip():
        print(json.dumps([]))
        sys.exit(0)
    
    leads = json.loads(raw_input)
    new_leads, skipped = dedup_and_mark(leads)
    
    print(json.dumps(new_leads, ensure_ascii=False, indent=2))
