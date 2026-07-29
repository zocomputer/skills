#!/usr/bin/env python3
"""
Lead Generator — HK Insurance Agents
=====================================
Free sources first:
  1. HKFI (Hong Kong Federation of Insurers) public register
  2. Apify Google Maps Scraper (free tier)
  3. Manual web scraping of insurance directories

Fallback: Apify LinkedIn scrapers (paid)
"""

import json
import sys
import time
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"

def generate_from_hkfi():
    """
    Attempt to find leads from HKFI / HK Insurance Authority public data.
    Returns list of {name, company, email, title, source}
    """
    # HKFI member directory and IA register are available at:
    # https://www.hkfi.org.hk/member-directory
    # https://www.ia.org.hk/en/supervision/registers/individual_insurance_intermediaries.html
    #
    # Agent should use agent-browser to scrape these pages
    
    print("[Leads] HKFI source requires agent-browser scraping", file=sys.stderr)
    print("[Leads] Target URL: https://www.ia.org.hk/en/supervision/registers/", file=sys.stderr)
    return []

def generate_from_apify_google_maps():
    """
    Use Apify Google Maps Scraper (free tier) to find:
    - "insurance broker in Hong Kong"
    - "insurance agent Hong Kong"
    - "保險公司 香港"
    
    Then extract contact info from the results.
    """
    print("[Leads] Apify Google Maps Scraper: ", file=sys.stderr)
    print("[Leads] Actor: 'compass/google-maps-scraper'", file=sys.stderr)
    print("[Leads] Search queries:", file=sys.stderr)
    print("[Leads]   - 'insurance broker Hong Kong'", file=sys.stderr)
    print("[Leads]   - 'insurance agent Hong Kong'", file=sys.stderr)
    print("[Leads]   - '保險經紀 香港'", file=sys.stderr)
    return []

def generate_manual_sources():
    """Document manual scrape targets."""
    return [
        {"url": "https://www.hkfi.org.hk/member-directory", "method": "agent-browser"},
        {"url": "https://www.ia.org.hk/en/supervision/registers/", "method": "agent-browser"},
        {"url": "https://www.linkedin.com/search/results/people/?keywords=insurance+agent+hong+kong", "method": "Apify LinkedIn Scraper"},
    ]

if __name__ == "__main__":
    print(json.dumps({
        "status": "ready",
        "free_sources": [
            {"name": "HKFI member directory", "url": "https://www.hkfi.org.hk/member-directory", "method": "agent-browser scraping"},
            {"name": "IA Register", "url": "https://www.ia.org.hk/en/supervision/registers/", "method": "agent-browser scraping"},
            {"name": "Apify Google Maps Scraper", "actor": "compass/google-maps-scraper", "queries": ["insurance broker Hong Kong", "insurance agent Hong Kong", "保險經紀 香港", "保險代理 香港"]},
        ],
        "paid_fallback": [
            {"name": "Apify LinkedIn People Scraper", "actor": "voyager_1/linkedin-people-scraper", "estimated_cost": "$5-10 per 100 profiles"},
            {"name": "Apify Email Finder", "actor": "seo_estimator/email-finder", "estimated_cost": "$2-5 per 100 emails"},
        ],
        "instruction": "Agent should try free sources first, then use paid Apify actors if needed"
    }, ensure_ascii=False, indent=2))
    
    # Initialize sent_emails if not exists
    sent_file = DATA_DIR / "sent_emails.json"
    if not sent_file.exists():
        sent_file.parent.mkdir(parents=True, exist_ok=True)
        with open(sent_file, "w") as f:
            json.dump({"emails": {}, "last_updated": ""}, f, ensure_ascii=False)
        print(f"[Init] Created {sent_file}", file=sys.stderr)
