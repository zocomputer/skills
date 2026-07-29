#!/usr/bin/env python3
"""
Lead Finder
============
Finds Hong Kong insurance agents' personal emails.
Priority: FREE → PAID Apify actors.

Free approach:
- Apify Google Maps Scraper (free tier) — search "insurance agent Hong Kong"
- Extract company names, websites, phone numbers from Maps results
- Try domain-based email discovery

Fallback:
- Apify LinkedIn Email Extractor (paid) — search LinkedIn for HK insurance agents
"""

import json
import sys
import os
import requests
import time
import argparse
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"

APIFY_KEY = os.environ.get("APIFY_API_KEY", "")

def apify_run(actor_id, run_input, max_wait=180):
    """Run an Apify actor and fetch results."""
    if not APIFY_KEY:
        print(f"  No APIFY_API_KEY for {actor_id}", file=sys.stderr)
        return []
    
    try:
        # Start run
        resp = requests.post(
            f"https://api.apify.com/v2/acts/{actor_id}/runs",
            json=run_input,
            headers={"Authorization": f"Bearer {APIFY_KEY}"},
            timeout=30
        )
        
        if resp.status_code == 201:
            run_data = resp.json()
            run_id = run_data["data"]["id"]
            print(f"  Run started: {run_id}", file=sys.stderr)
            
            # Wait for completion
            for attempt in range(max_wait // 10):
                time.sleep(10)
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
                    return items_resp.json()
                elif status in ["FAILED", "ABORTED"]:
                    print(f"  Run {status}", file=sys.stderr)
                    return []
                
                print(f"  Waiting... ({attempt+1})", file=sys.stderr)
        
        print(f"  Timeout waiting for run", file=sys.stderr)
        return []
    
    except Exception as e:
        print(f"  Apify error: {e}", file=sys.stderr)
        return []

def find_leads_free(count=200):
    """Find leads using free Apify actors."""
    leads = []
    
    # Method 1: Google Maps Scraper
    print("[FREE] Google Maps search: Hong Kong insurance agent", file=sys.stderr)
    
    maps_results = apify_run(
        "compass~google-maps-scraper",
        {
            "searchStringsArray": ["insurance agent Hong Kong", "insurance broker Hong Kong", "保險代理 香港"],
            "language": "en",
            "maxCrawledPlacesPerSearch": 50,
            "maxImages": 0,
            "includeHistoricalPlaces": False
        }
    )
    
    if maps_results:
        print(f"  Maps results: {len(maps_results)} places", file=sys.stderr)
        for place in maps_results:
            title = place.get("title", "")
            website = place.get("website", "")
            phone = place.get("phone", "")
            address = place.get("address", "")
            category = place.get("categoryName", "")
            
            if website:
                # Try to derive email from website domain
                domain = website.replace("https://", "").replace("http://", "").rstrip("/").split("/")[0]
                
                leads.append({
                    "name": title,
                    "company": title,
                    "email": f"info@{domain}",  # Generic, will be verified
                    "source": "google_maps",
                    "website": website,
                    "phone": phone,
                    "address": address,
                    "category": category,
                    "email_type": "company"
                })
    
    # Method 2: Try LinkedIn People Search (another free approach via web scraping)
    print(f"[FREE] Total raw leads: {len(leads)}", file=sys.stderr)
    
    return leads[:count]

def find_leads_paid(count=200):
    """Find leads using paid Apify actors (better email extraction)."""
    leads = []
    
    # LinkedIn Email Extractor
    print("[PAID] LinkedIn Email Extractor: insurance agent Hong Kong", file=sys.stderr)
    
    linkedin_results = apify_run(
        "lukaskrivka~linkedin-email-extractor",
        {
            "search": "insurance agent Hong Kong",
            "maxResults": count,
            "region": "Asia Pacific"
        }
    )
    
    if linkedin_results:
        print(f"  LinkedIn results: {len(linkedin_results)} profiles", file=sys.stderr)
        for profile in linkedin_results:
            email = profile.get("email", "")
            if email:
                leads.append({
                    "name": profile.get("name", ""),
                    "company": profile.get("currentCompanyName", ""),
                    "title": profile.get("currentPosition", ""),
                    "email": email,
                    "source": "linkedin",
                    "linkedin_url": profile.get("linkedinUrl", ""),
                    "email_type": "personal" if "@gmail" in email or "@yahoo" in email else "company"
                })
    
    print(f"[PAID] Total leads: {len(leads)}", file=sys.stderr)
    return leads[:count]

def find_leads(count=200):
    """Find leads: free first, then paid fallback."""
    
    # Try free first
    leads = find_leads_free(count)
    
    if len(leads) >= count // 2:
        print(f"[OK] Free method found {len(leads)} leads, skipping paid.", file=sys.stderr)
        return leads[:count]
    
    print(f"[FALLBACK] Free only found {len(leads)}, trying paid...", file=sys.stderr)
    
    # Fallback to paid
    paid_leads = find_leads_paid(count)
    
    # Combine, dedup by email
    seen = set()
    all_leads = []
    for lead in leads + paid_leads:
        email = lead.get("email", "").lower()
        if email and email not in seen:
            seen.add(email)
            all_leads.append(lead)
    
    return all_leads[:count]

def save_leads(leads):
    """Save found leads to a file for debugging."""
    timestamp = time.strftime("%Y%m%d_%H%M")
    outfile = DATA_DIR / f"leads_{timestamp}.json"
    with open(outfile, "w") as f:
        json.dump(leads, f, ensure_ascii=False, indent=2)
    print(f"  Saved leads to: {outfile}", file=sys.stderr)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Find leads")
    parser.add_argument("--count", type=int, default=200, help="Number of leads to find")
    args = parser.parse_args()
    
    leads = find_leads(count=args.count)
    save_leads(leads)
    
    print(json.dumps(leads, ensure_ascii=False, indent=2))
