#!/usr/bin/env python3
"""
Daily Campaign Sender
=====================
Builds and sends Brevo email campaign with the Manus video.
Uses the HTML template, embeds thumbnail, and sends to the Zcomputer lead list.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

SKILL_DIR = Path(__file__).resolve().parent.parent
with open(SKILL_DIR / "data" / "config.json") as f:
    config = json.load(f)

def build_campaign_config():
    """Return campaign parameters for Brevo API / agent."""
    return {
        "template": f"{SKILL_DIR}/references/email_template.md",
        "thumbmail": f"{SKILL_DIR}/assets/manus_thumbnail.jpg",
        "sender": {
            "name": config["sender_name"],
            "email": config["sender_email"]
        },
        "subject": config["youtube_video_title"],
        "video_url": config["youtube_video_url"],
        "video_title": config["youtube_video_title"],
        "channel_url": config["youtube_channel_url"],
        "website": config["website"],
        "course_url": config["course_url"],
        "hkai_club": config["hkai_club"],
        "contact_email": config["contact_email"],
        "list_name": config["brevo_list_name"],
        "target_list": "Find Brevo list ID for 'Zcomputer lead'"
    }

def build_email_html():
    """Generate the HTML email body with current config values."""
    template_path = SKILL_DIR / "references" / "email_template.md"
    
    if not template_path.exists():
        print(f"[Error] Template not found: {template_path}", file=sys.stderr)
        return ""
    
    with open(template_path) as f:
        content = f.read()
    
    # Extract the HTML block from markdown
    html_start = content.find("```html")
    html_end = content.find("```", html_start + 10)
    
    if html_start == -1 or html_end == -1:
        return content
    
    html = content[html_start + 7 : html_end].strip()
    
    # Replace variables
    variables = {
        "{{video_url}}": config["youtube_video_url"],
        "{{video_title}}": config["youtube_video_title"],
        "{{channel_url}}": config["youtube_channel_url"],
        "{{website}}": config["website"],
        "{{course_url}}": config["course_url"],
        "{{hkai_club}}": config["hkai_club"],
    }
    
    for var, val in variables.items():
        html = html.replace(var, val)
    
    return html


if __name__ == "__main__":
    if "--html" in sys.argv:
        html = build_email_html()
        print(html)
    else:
        campaign = build_campaign_config()
        print(json.dumps(campaign, ensure_ascii=False, indent=2))
    
    print(f"\n[Campaign] Ready for execution at {datetime.now().isoformat()}", file=sys.stderr)
    print(f"[Campaign] Subject: {config['youtube_video_title']}", file=sys.stderr)
    print("[Campaign] Agent should now:", file=sys.stderr)
    print("[Campaign]   1. Find/create Brevo list 'Zcomputer lead'", file=sys.stderr)
    print("[Campaign]   2. Create campaign with the HTML email", file=sys.stderr)
    print("[Campaign]   3. Upload thumbnail as inline image", file=sys.stderr)
    print("[Campaign]   4. Schedule send to the list", file=sys.stderr)
