#!/usr/bin/env python3
"""
Pipeline Runner
===============
Orchestration log for the daily insurance lead email workflow.
Does NOT run the pipeline — it prints the step-by-step instructions
for the Zo Agent to follow.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"

MAGENTA = "\033[35m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RESET = "\033[0m"
BOLD = "\033[1m"

STEPS = [
    {
        "num": 1,
        "name": "Lead Generation",
        "actions": [
            "Try free scraping first (HKFI/IA public registers, Google Maps free tier)",
            "Use Apify Google Maps Scraper if needed (free tier has ~100 results)",
            "If still < 100 leads, use Apify LinkedIn People Scraper (paid)",
            "Target: HK insurance agents, personal emails only",
            "Save raw leads to data/raw_leads_{date}.json"
        ]
    },
    {
        "num": 2,
        "name": "Email Verification",
        "actions": [
            "Run scripts/verifier.py with the raw leads JSON via stdin",
            "Basic checks: syntax + MX + skip generic emails (info@, admin@...)",
            "Deep checks: use Apify Email Verifier actor on leads needing SMTP check",
            "Output: data/verified_leads_{date}.json"
        ]
    },
    {
        "num": 3,
        "name": "Dedup Against Sent History",
        "actions": [
            "Read data/sent_emails.json (empty dict if first run)",
            "For each verified lead, check if email exists in sent_emails",
            "Filter out duplicates → final clean list",
            "Save to data/new_leads_{date}.json"
        ]
    },
    {
        "num": 4,
        "name": "Brevo List Management",
        "actions": [
            "Find or create Brevo list named 'Zcomputer lead'",
            "use_integration('brevo', 'brevo-create-list', {'listName': 'Zcomputer lead'}) if not exists",
            "use_integration('brevo', 'brevo-add-or-update-contact', ...) for each new lead",
            "Or use Brevo API batch import endpoint", 
        ]
    },
    {
        "num": 5,
        "name": "Create & Send Campaign",
        "actions": [
            "Run scripts/campaign_sender.py --html to get email HTML",
            "Use Brevo tools to create campaign with:",
            "  - Subject: 【廣東話】Manus太貴？接近零成本取代工具，我每日都用緊！",
            "  - Sender: 布Sir - AI Lion <info@lion88.ai>",
            "  - Template: HTML + inline thumbnail",
            "  - List: Zcomputer lead",
            "use_integration('brevo', 'brevo-send-transactional-email', ...)",
            "Send immediately (3:30 PM HKT)"
        ]
    },
    {
        "num": 6,
        "name": "Update Sent Records",
        "actions": [
            "Append new emails to data/sent_emails.json",
            "Record timestamp, list name, campaign subject for each email"
        ]
    }
]

def print_header():
    print(f"\n{BOLD}{MAGENTA}{'='*60}{RESET}")
    print(f"{BOLD}{MAGENTA}  每日保險 Lead Email Pipeline{RESET}")
    print(f"{BOLD}{MAGENTA}  {datetime.now().isoformat()}{RESET}")
    print(f"{BOLD}{MAGENTA}{'='*60}{RESET}\n")

def print_summary():
    with open(SKILL_DIR / "data" / "config.json") as f:
        config = json.load(f)
    
    sent_path = DATA_DIR / "sent_emails.json"
    sent_count = 0
    if sent_path.exists():
        with open(sent_path) as f:
            sent = json.load(f)
            sent_count = len(sent)
    
    print(f"{CYAN}設定摘要:{RESET}")
    print(f"  目標受眾: {config['target_location']} {config['target_industry']} {config['target_role']}")
    print(f"  每日目標: {config['target_daily_leads']} leads")
    print(f"  Brevo List: {config['brevo_list_name']}")
    print(f"  寄件人: {config['sender_email']}")
    print(f"  推廣影片: {config['youtube_video_title'][:50]}...")
    print(f"  已發送記錄: {sent_count} emails")
    print(f"  已發送檔案: {DATA_DIR / 'sent_emails.json'}")
    print()

def print_steps():
    print(f"{YELLOW}{BOLD}Pipeline 步驟:{RESET}\n")
    for step in STEPS:
        print(f"{GREEN}{BOLD}Step {step['num']}: {step['name']}{RESET}")
        for action in step["actions"]:
            print(f"  → {action}")
        print()

if __name__ == "__main__":
    if "--summary" in sys.argv:
        print_json = json.dumps({
            "steps": STEPS,
            "config_file": str(SKILL_DIR / "data" / "config.json"),
            "sent_file": str(DATA_DIR / "sent_emails.json"),
            "scripts": {
                "verifier": str(SKILL_DIR / "scripts" / "verifier.py"),
                "campaign_sender": str(SKILL_DIR / "scripts" / "campaign_sender.py")
            }
        }, ensure_ascii=False, indent=2)
        print(print_json)
    else:
        print_header()
        print_summary()
        print_steps()
