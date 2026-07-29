#!/usr/bin/env python3
"""
Email Verifier
===============
Verify email addresses using Apify Email Verification actor.
- INPUT: JSON array of leads with 'email' field (via stdin)
- OUTPUT: JSON array of verified leads (valid emails only)
"""

import json
import sys
import os
import requests
import time
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"

APIFY_KEY = os.environ.get("APIFY_API_KEY", "")

def verify_emails_apify(leads):
    """Verify emails using Apify Email Verifier actor."""
    if not APIFY_KEY:
        print("  WARNING: No APIFY_API_KEY, skipping verification", file=sys.stderr)
        # Return all leads as-is without verification
        return leads
    
    if not leads:
        return []
    
    # Extract unique emails
    emails = list(set(l["email"].lower() for l in leads if l.get("email")))
    
    # Use Apify Email Verifier - accepts array of emails
    actor_id = "alexey~email-verifier"
    
    print(f"  Verifying {len(emails)} emails via Apify...", file=sys.stderr)
    
    # Chunk emails (max ~50 per API call to be safe)
    chunk_size = 50
    verified_leads = []
    
    for i in range(0, len(emails), chunk_size):
        chunk = emails[i:i+chunk_size]
        
        try:
            resp = requests.post(
                f"https://api.apify.com/v2/acts/{actor_id}/runs",
                json={"emails": chunk},
                headers={"Authorization": f"Bearer {APIFY_KEY}"},
                timeout=30
            )
            
            if resp.status_code != 201:
                print(f"  Verification API error: {resp.status_code}", file=sys.stderr)
                continue
            
            run_data = resp.json()
            run_id = run_data["data"]["id"]
            
            # Wait for completion
            for attempt in range(30):
                time.sleep(5)
                status_resp = requests.get(
                    f"https://api.apify.com/v2/acts/{actor_id}/runs/{run_id}",
                    headers={"Authorization": f"Bearer {APIFY_KEY}"}
                )
                status = status_resp.json()["data"]["status"]
                
                if status == "SUCCEEDED":
                    items_resp = requests.get(
                        f"https://api.apify.com/v2/acts/{actor_id}/runs/{run_id}/dataset/items",
                        headers={"Authorization": f"Bearer {APIFY_KEY}"}
                    )
                    results = items_resp.json()
                    break
                elif status in ["FAILED", "ABORTED"]:
                    print(f"  Verify run {status}", file=sys.stderr)
                    results = []
                    break
        
        except Exception as e:
            print(f"  Verify error: {e}", file=sys.stderr)
            continue
        
        # Map results back to leads
        valid_emails = set()
        for result in results:
            if result.get("isValid", False) and not result.get("isDisposable", False):
                valid_emails.add(result.get("email", "").lower())
        
        print(f"  Chunk {i//chunk_size + 1}: {len(valid_emails)}/{len(chunk)} valid", file=sys.stderr)
    
    # Filter leads to only verified emails
    for lead in leads:
        if lead.get("email", "").lower() in valid_emails:
            verified_leads.append(lead)
    
    return verified_leads

def quick_verify(leads):
    """Quick pre-check: filter obviously invalid emails."""
    valid = []
    for lead in leads:
        email = lead.get("email", "")
        if not email:
            continue
        email = email.lower()
        
        # Skip obviously invalid
        if email == "info@example.com" or "noemail" in email:
            continue
        if not "@" in email or not "." in email.split("@")[-1]:
            continue
        
        valid.append(lead)
    
    return valid

if __name__ == "__main__":
    raw_input = sys.stdin.read()
    if not raw_input.strip():
        print(json.dumps([]))
        sys.exit(0)
    
    leads = json.loads(raw_input)
    print(f"[Verify] Input: {len(leads)} leads", file=sys.stderr)
    
    # Quick pre-filter
    leads = quick_verify(leads)
    print(f"[Verify] After quick filter: {len(leads)} leads", file=sys.stderr)
    
    # Apify verification
    verified = verify_emails_apify(leads)
    print(f"[Verify] Verified: {len(verified)} valid emails", file=sys.stderr)
    
    # Save verified leads
    timestamp = time.strftime("%Y%m%d_%H%M")
    outfile = DATA_DIR / f"verified_{timestamp}.json"
    with open(outfile, "w") as f:
        json.dump(verified, f, ensure_ascii=False, indent=2)
    print(f"[Verify] Saved to: {outfile}", file=sys.stderr)
    
    print(json.dumps(verified, ensure_ascii=False, indent=2))
