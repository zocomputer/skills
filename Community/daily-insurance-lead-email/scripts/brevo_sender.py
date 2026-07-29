#!/usr/bin/env python3
"""
Brevo Sender
=============
Reads verified leads, outputs CSV for Brevo import, and constructs
the email campaign parameters with the Manus video.
"""

import json
import sys
import csv
import io
import time
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SKILL_DIR / "data"

with open(DATA_DIR / "config.json") as f:
    CONFIG = json.load(f)

def build_email_html(contact_email):
    """Build the HTML email content."""
    return f"""<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f0; padding:20px 0;">
<tr>
<td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">

<!-- Header -->
<tr>
<td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding:32px 40px; text-align:center;">
<h1 style="color:#f5c842; font-size:22px; margin:0; line-height:1.4;">🎬 {CONFIG['youtube_video_title']}</h1>
</td>
</tr>

<!-- Video Thumbnail -->
<tr>
<td style="padding:28px 40px 16px; text-align:center;">
<a href="{CONFIG['youtube_video_url']}" target="_blank">
<img src="https://i.ytimg.com/vi/{CONFIG['youtube_video_id']}/maxresdefault.jpg" alt="Manus 替代工具" style="width:100%; max-width:520px; border-radius:8px; border:2px solid #eee;" />
</a>
</td>
</tr>

<!-- CTA Button -->
<tr>
<td style="padding:8px 40px 28px; text-align:center;">
<a href="{CONFIG['youtube_video_url']}" target="_blank" style="display:inline-block; padding:14px 36px; background-color:#f5c842; color:#1a1a2e; text-decoration:none; border-radius:8px; font-size:15px; font-weight:700;">📹 睇片學AI工具</a>
</td>
</tr>

<!-- Content -->
<tr>
<td style="padding:0 40px 24px; color:#333; font-size:15px; line-height:1.7;">
<p style="margin:0 0 12px;">👋 你好，我係布Sir！</p>

<p style="margin:0 0 12px;">Manus 好貴？我日日都用緊一個<b>接近零成本嘅替代工具</b>，效果一樣咁好。</p>

<p style="margin:0 0 12px;">喺呢條片入面我會示範：</p>
<ul style="padding-left:20px; margin:8px 0;">
<li>點樣用免費工具取代 Manus</li>
<li>我嘅每日 AI workflow 實戰分享</li>
<li>一人公司點樣慳錢又高效</li>
</ul>

<p style="margin:0 0 12px;">🎯 我幫過唔少保險同金融業嘅朋友，用 AI 自動化日常流程，慳返大量時間做真正重要嘅嘢。</p>

<p style="margin:0;">即刻睇片 👇</p>
</td>
</tr>

<!-- CTA Button 2 -->
<tr>
<td style="padding:8px 40px 28px; text-align:center;">
<a href="{CONFIG['youtube_video_url']}" target="_blank" style="display:inline-block; padding:14px 36px; background-color:#1a1a2e; color:#f5c842; text-decoration:none; border-radius:8px; font-size:15px; font-weight:700;">🔥 即刻睇片</a>
</td>
</tr>

<!-- Divider -->
<tr>
<td style="padding:0 40px;">
<hr style="border:none; border-top:1px solid #e0e0e0;" />
</td>
</tr>

<!-- Resources -->
<tr>
<td style="padding:20px 40px 8px; text-align:center;">
<p style="color:#888; font-size:13px; margin:0;">📌 更多AI一人公司資源：</p>
</td>
</tr>
<tr>
<td style="padding:8px 40px 20px; text-align:center;">
<table align="center" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:6px 12px;">
<a href="{CONFIG['channel_url']}" target="_blank" style="color:#1a1a2e; text-decoration:underline; font-size:13px;">YouTube 頻道</a>
</td>
<td style="padding:6px 12px;">
<a href="{CONFIG['website']}" target="_blank" style="color:#1a1a2e; text-decoration:underline; font-size:13px;">官網 lion88.ai</a>
</td>
<td style="padding:6px 12px;">
<a href="{CONFIG['course_url']}" target="_blank" style="color:#1a1a2e; text-decoration:underline; font-size:13px;">一人公司課程</a>
</td>
</tr>
</table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:20px 40px 28px; text-align:center; color:#aaa; font-size:12px; line-height:1.6;">
<p style="margin:0;">© {time.strftime('%Y')} AI Lion 一人公司 | 如有查詢：<a href="mailto:{contact_email}" style="color:#888;">{contact_email}</a></p>
<p style="margin:4px 0 0;">如果你唔想再收到我哋嘅 email，可以隨時 <a href="{{unsubscribe}}" style="color:#888;">取消訂閱</a></p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>"""

def create_csv(leads):
    """Create CSV file for Brevo import."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["EMAIL", "FIRSTNAME", "LASTNAME", "COMPANY", "TITLE"])
    writer.writeheader()
    
    for lead in leads:
        writer.writerow({
            "EMAIL": lead["email"],
            "FIRSTNAME": lead.get("name", ""),
            "LASTNAME": "",
            "COMPANY": lead.get("company", ""),
            "TITLE": lead.get("title", "Insurance Agent")
        })
    
    timestamp = time.strftime("%Y%m%d_%H%M")
    csv_path = DATA_DIR / f"brevo_import_{timestamp}.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(output.getvalue())
    
    print(f"[Brevo] CSV saved to {csv_path}", file=sys.stderr)
    return str(csv_path)

if __name__ == "__main__":
    raw_input = sys.stdin.read()
    if not raw_input.strip():
        print(json.dumps({"error": "no_leads"}))
        sys.exit(0)
    
    leads = json.loads(raw_input)
    
    # Create CSV
    csv_path = create_csv(leads)
    
    # Build email HTML
    contact_email = CONFIG["contact_email"]
    html = build_email_html(contact_email)
    
    # Save HTML
    html_path = DATA_DIR / "email_template_latest.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    
    # Output for pipeline/agent
    result = {
        "csv_path": csv_path,
        "html_path": str(html_path),
        "list_name": CONFIG["brevo_list_name"],
        "sender_email": CONFIG["sender_email"],
        "sender_name": CONFIG["sender_name"],
        "subject": CONFIG["youtube_video_title"],
        "video_url": CONFIG["youtube_video_url"],
        "video_id": CONFIG["youtube_video_id"],
        "lead_count": len(leads),
        "html_template": html,
        "brevo_actions": {
            "step1": f"Import CSV to Brevo list '{CONFIG['brevo_list_name']}'",
            "step2": f"Create email campaign with subject: '{CONFIG['youtube_video_title']}'",
            "step3": f"Use sender: {CONFIG['sender_name']} <{CONFIG['sender_email']}>",
            "step4": "Send campaign to the list"
        }
    }
    
    print(json.dumps(result, ensure_ascii=False, indent=2))
