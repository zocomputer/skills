#!/usr/bin/env python3
"""
Brevo Handler
==============
- Find or create Brevo list "Zcomputer lead"
- Add verified contacts to the list
- Create email campaign with Manus video template
- Send campaign

Brevo API v3: https://developers.brevo.com/reference
Requires BREVO_API_KEY environment variable.
"""

import json
import sys
import os
import time
import argparse
from pathlib import Path
import requests

SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"

BREVO_KEY = os.environ.get("BREVO_API_KEY", "")
LIST_NAME = "Zcomputer lead"
SENDER_EMAIL = "info@lion88.ai"
SENDER_NAME = "布Sir - AI Lion"

if not BREVO_KEY:
    print("WARNING: No BREVO_API_KEY set", file=sys.stderr)

BASE_URL = "https://api.brevo.com/v3"
HEADERS = {
    "api-key": BREVO_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json"
}

# Email template content
YOUTUBE_VIDEO_ID = "msSW3S-FRv0"
YOUTUBE_VIDEO_TITLE = "【廣東話】Manus太貴？接近零成本取代工具，我每日都用緊！"
YOUTUBE_VIDEO_URL = f"https://www.youtube.com/watch?v={YOUTUBE_VIDEO_ID}"
CHANNEL_URL = "https://www.youtube.com/@Itsssss-Lion-AI"
WEBSITE = "https://lion88.ai"
COURSE_URL = "https://planet.lion88.ai/courses/one-person-company-2"
HKAI_CLUB = "https://hkai.club"
CONTACT_EMAIL = "bruce@lion88.ai"

EMAIL_SUBJECT = f"【廣東話】Manus太貴？接近零成本取代工具，我每日都用緊！"

EMAIL_HTML = f"""<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
  <!-- Cover Image -->
  <tr>
    <td style="padding:0;">
      <a href="{YOUTUBE_VIDEO_URL}" target="_blank">
        <img src="https://i.ytimg.com/vi/{YOUTUBE_VIDEO_ID}/maxresdefault.jpg" alt="{YOUTUBE_VIDEO_TITLE}" width="600" style="display:block;width:100%;height:auto;border:0;">
      </a>
    </td>
  </tr>
  <!-- Play Button Overlay Concept -->
  <tr>
    <td style="padding:20px 30px 10px 30px;text-align:center;">
      <a href="{YOUTUBE_VIDEO_URL}" target="_blank" style="display:inline-block;padding:16px 40px;background-color:#FF0000;color:#ffffff;font-size:18px;font-weight:bold;text-decoration:none;border-radius:6px;">
        ▶ 立即睇片
      </a>
    </td>
  </tr>
  <!-- Content -->
  <tr>
    <td style="padding:10px 30px 5px 30px;">
      <h2 style="font-size:20px;color:#222;margin:0 0 8px 0;">{YOUTUBE_VIDEO_TITLE}</h2>
    </td>
  </tr>
  <tr>
    <td style="padding:5px 30px 15px 30px;color:#555;font-size:15px;line-height:1.6;">
      <p>Manus 真係太貴？我用一個接近零成本嘅工具，每日做到同樣嘅嘢！</p>
      <p>呢條片分享我用緊嘅免費替代方案，幫你 AI 一人公司慳錢又高效。</p>
      <p>撳上面張圖或者個制就睇到 🔥</p>
    </td>
  </tr>
  <!-- CTA -->
  <tr>
    <td style="padding:15px 30px 20px 30px;text-align:center;">
      <a href="{YOUTUBE_VIDEO_URL}" target="_blank" style="display:inline-block;padding:14px 36px;background-color:#f5c842;color:#222;font-size:16px;font-weight:bold;text-decoration:none;border-radius:6px;">
        🎬 立即觀看完整影片
      </a>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="padding:20px 30px;background-color:#1a1a1a;color:#aaa;font-size:12px;text-align:center;line-height:1.8;">
      <p style="margin:0 0 8px 0;"><strong style="color:#f5c842;">AI Lion 一人公司</strong></p>
      <p style="margin:0 0 4px 0;">
        🎥 <a href="{CHANNEL_URL}" target="_blank" style="color:#f5c842;text-decoration:none;">YouTube Channel</a> &nbsp;|&nbsp;
        🌐 <a href="{WEBSITE}" target="_blank" style="color:#f5c842;text-decoration:none;">lion88.ai</a> &nbsp;|&nbsp;
        🏫 <a href="{COURSE_URL}" target="_blank" style="color:#f5c842;text-decoration:none;">一人公司2.0課程</a>
      </p>
      <p style="margin:0 0 4px 0;">
        💬 <a href="{HKAI_CLUB}" target="_blank" style="color:#f5c842;text-decoration:none;">HK AI Club</a>
      </p>
      <p style="margin:8px 0 0 0;font-size:11px;">📧 {CONTACT_EMAIL} &nbsp;|&nbsp; © {time.strftime('%Y')} AI Lion. All rights reserved.</p>
    </td>
  </tr>
</table>
</body>
</html>"""

def find_or_create_list():
    """Find or create the 'Zcomputer lead' list."""
    print(f"  Looking for list: '{LIST_NAME}'", file=sys.stderr)
    
    try:
        # List all lists
        resp = requests.get(
            f"{BASE_URL}/contacts/lists?limit=50",
            headers=HEADERS,
            timeout=15
        )
        
        if resp.status_code == 200:
            lists = resp.json().get("lists", [])
            print(f"  Found {len(lists)} lists", file=sys.stderr)
            
            for lst in lists:
                if lst["name"] == LIST_NAME:
                    print(f"  Using existing list: {lst['id']}", file=sys.stderr)
                    return lst["id"]
        
    except Exception as e:
        print(f"  Error listing: {e}", file=sys.stderr)
    
    # Create new list
    print(f"  Creating new list '{LIST_NAME}'...", file=sys.stderr)
    try:
        resp = requests.post(
            f"{BASE_URL}/contacts/lists",
            json={"name": LIST_NAME, "folderId": 1},
            headers=HEADERS,
            timeout=15
        )
        
        if resp.status_code == 201:
            list_id = resp.json()["id"]
            print(f"  Created list: {list_id}", file=sys.stderr)
            return list_id
        else:
            print(f"  Failed to create list: {resp.status_code} {resp.text}", file=sys.stderr)
    except Exception as e:
        print(f"  Error creating list: {e}", file=sys.stderr)
    
    return None

def add_contacts_to_list(list_id, contacts):
    """Add or import contacts to a Brevo list."""
    if not contacts:
        return 0
    
    print(f"  Adding {len(contacts)} contacts to list {list_id}...", file=sys.stderr)
    
    # Format for import API
    brevo_contacts = []
    for c in contacts:
        brevo_contacts.append({
            "email": c["email"],
            "attributes": {
                "FIRSTNAME": c.get("name", "").split()[0] if c.get("name") else "",
                "LASTNAME": " ".join(c.get("name", "").split()[1:]) if c.get("name", "") else "",
                "COMPANY": c.get("company", ""),
                "SOURCE": c.get("source", ""),
                "POSITION": c.get("title", ""),
            }
        })
    
    try:
        resp = requests.post(
            f"{BASE_URL}/contacts/import",
            json={
                "listIds": [list_id],
                "updateExistingContacts": True,
                "emptyContactsAttributes": False,
                "jsonBody": brevo_contacts
            },
            headers=HEADERS,
            timeout=30
        )
        
        if resp.status_code == 202:
            result = resp.json()
            print(f"  Import created: {result.get('createdCount', 0)} new, {result.get('updatedCount', 0)} updated", file=sys.stderr)
            return len(contacts)
        else:
            print(f"  Import failed: {resp.status_code} {resp.text}", file=sys.stderr)
            return 0
    except Exception as e:
        print(f"  Import error: {e}", file=sys.stderr)
        return 0

def create_and_send_campaign(list_id, contacts_count, dry_run=False):
    """Create an email campaign and send it."""
    campaign_name = f"Manus替代工具推廣 - {time.strftime('%Y/%m/%d')}"
    
    print(f"  Creating campaign: '{campaign_name}'", file=sys.stderr)
    
    try:
        # Create campaign
        resp = requests.post(
            f"{BASE_URL}/emailCampaigns",
            json={
                "name": campaign_name,
                "subject": EMAIL_SUBJECT,
                "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
                "type": "classic",
                "htmlContent": EMAIL_HTML,
                "recipients": {"listIds": [list_id]},
                "scheduledAt": None if dry_run else None,  # Send now, not scheduled
                "inlineImageActivation": False,
                "replyTo": CONTACT_EMAIL,
            },
            headers=HEADERS,
            timeout=30
        )
        
        if resp.status_code != 201:
            print(f"  Campaign creation failed: {resp.status_code} {resp.text}", file=sys.stderr)
            return {"error": f"Campaign creation failed: {resp.text}", "sent_count": 0}
        
        campaign = resp.json()
        campaign_id = campaign["id"]
        print(f"  Campaign created: #{campaign_id}", file=sys.stderr)
        
        if dry_run:
            print(f"  [DRY RUN] Would send campaign #{campaign_id}", file=sys.stderr)
            return {
                "campaign_id": campaign_id,
                "campaign_name": campaign_name,
                "list_id": list_id,
                "sent_count": contacts_count,
                "status": "draft_preview"
            }
        
        # Send campaign
        print(f"  Sending campaign #{campaign_id}...", file=sys.stderr)
        send_resp = requests.post(
            f"{BASE_URL}/emailCampaigns/{campaign_id}/sendNow",
            headers=HEADERS,
            timeout=15
        )
        
        if send_resp.status_code in [200, 204]:
            print(f"  Campaign sent!", file=sys.stderr)
            return {
                "campaign_id": campaign_id,
                "campaign_name": campaign_name,
                "list_id": list_id,
                "sent_count": contacts_count,
                "status": "sent"
            }
        else:
            print(f"  Send failed: {send_resp.status_code} {send_resp.text}", file=sys.stderr)
            return {
                "campaign_id": campaign_id,
                "campaign_name": campaign_name,
                "list_id": list_id,
                "sent_count": 0,
                "status": "send_failed",
                "error": send_resp.text
            }
            
    except Exception as e:
        print(f"  Campaign error: {e}", file=sys.stderr)
        return {"error": str(e), "sent_count": 0}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Brevo campaign handler")
    parser.add_argument("--dry-run", type=str, default="false", help="Preview without sending")
    args = parser.parse_args()
    
    dry_run = args.dry_run.lower() == "true"
    
    # Read verified contacts from stdin
    raw_input = sys.stdin.read()
    if not raw_input.strip():
        result = {"error": "No contacts provided", "sent_count": 0}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0)
    
    contacts = json.loads(raw_input)
    print(f"[Brevo] Processing {len(contacts)} verified contacts | Dry run: {dry_run}", file=sys.stderr)
    
    # Find or create list
    list_id = find_or_create_list()
    if not list_id:
        result = {"error": "Could not find or create Brevo list", "sent_count": 0}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(1)
    
    # Add contacts to list
    added = add_contacts_to_list(list_id, contacts)
    print(f"[Brevo] Added {added} contacts to list", file=sys.stderr)
    
    # Create and send campaign
    result = create_and_send_campaign(list_id, added, dry_run=dry_run)
    
    # Save result
    timestamp = time.strftime("%Y%m%d_%H%M")
    outfile = DATA_DIR / f"brevo_result_{timestamp}.json"
    with open(outfile, "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"[Brevo] Result saved to: {outfile}", file=sys.stderr)
    
    print(json.dumps(result, ensure_ascii=False, indent=2))
