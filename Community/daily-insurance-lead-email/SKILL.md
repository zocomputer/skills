---
name: daily-insurance-lead-email
description: 每日自動搵 100 個香港保險 Agent 嘅 verified email（LinkedIn + Apify），去重後 import 入 Brevo List，配合 Brevo automation 自動發送 YouTube 推廣電郵。無需人手操作，全程自動化。
compatibility: Created for Zo Computer
metadata:
  author: aibunny.zo.computer
  status: zo-user-ready
  version: "1.0.0"
  created: "2026-07-25T00:00:00.000Z"
  updated: "2026-07-29T00:00:00.000Z"
  language: zh-HK
  category: Marketing & Lead Generation
  secrets:
    - APIFY_API_KEY
    - BREVO_API_KEY
  display-name: 每日保險 Agent 電郵開發
allowed-tools: Bash, Read, Write, WebSearch, WebFetch
---

# Daily Insurance Lead Email Pipeline

每日自動化搵香港保險 Agent 嘅 verified email → 去重 → import 入 Brevo → Brevo automation 自動發送 YouTube 推廣電郵。全流程唔使經過 Zo 建立 campaign。

## 使用場景
- 將 AI Lion YouTube 頻道影片推廣畀香港保險從業員
- 建立香港保險行業嘅 email lead database
- 自動化 cold outreach，配合 Brevo automation workflow

## 流程（6 Steps）

```
Step 1: Web Search → LinkedIn profiles
        用 web_search 搵 "Hong Kong insurance agent/manager LinkedIn"
        收集 100+ profile URLs → 寫入 linkedin_urls_raw.txt
        去重 → profile_urls.txt

Step 2: Apify Email Finder → 搵 email
        Actor: LinkedIn Profile Search By Services (qXMa8kADnUQdmz18G)
        由 LinkedIn profiles 提取 email → emails_found.json

Step 3: Apify Email Verifier → 驗證 email
        Actor: Email Verifier & Validator (u0sG3Wiy5pdt9mIfU)
        過濾 invalid / catch-all / disposable → emails_verified.json（只保留 valid）

Step 4: Dedup → 對比已發送記錄
        檢查 sent_emails.json，移除已發送過嘅 email

Step 5: Brevo Import → POST /v3/contacts/import listIds:[47]
        Brevo automation 會喺 new contacts added 時自動 trigger 發送
        用 updateEnabled: true 避免 duplicate

Step 6: 更新記錄 + 成本追蹤
        更新 sent_emails.json + costs.json
        可選：發 Telegram report
```

## Email 內容

- **主旨**：【廣東話】Manus太貴？接近零成本取代工具，我每日都用緊！
- **內容**：YouTube 影片 thumbnail + 標題 + link，AI Lion 頻道介紹，social links
- **寄件者**：Bruce @ AI Lion (bruce@lion88.ai)

## 成本（每日 ~100 leads）

| 項目 | 單價 | 每日成本 |
|------|------|----------|
| LinkedIn Profile Search | ~$0.06/profile | ~$6.00 |
| Email Finder | ~$0.026/email | ~$2.60 |
| Email Verifier | ~$0.001/email | ~$0.10 |
| Brevo Send | ~$0.00125/email | ~$0.13 |
| **Total** | | **~$8.83/日** |

## 必要 Secrets

喺 [Settings > Advanced](/?t=settings&s=advanced) 設定：
- `APIFY_API_KEY` — Apify API token
- `BREVO_API_KEY` — Brevo API key

## 檔案結構

```
Skills/daily-insurance-lead-email/
├── SKILL.md
├── DISPLAY.json
├── scripts/
│   └── pipeline.py          # 主 pipeline script
├── assets/
│   ├── email_template.html  # Email HTML template
│   └── manus_thumbnail.jpg  # YouTube thumbnail
├── data/
│   ├── config.json          # API keys config、cost rates、video info
│   ├── costs.json           # 累積成本追蹤
│   ├── sent_emails.json     # 已發送記錄（dedup 用）
│   ├── emails_found.json    # Email finder output
│   ├── emails_verified.json # Verified emails only
│   └── profile_urls.txt     # LinkedIn profile URL pool
└── references/
    └── email_template.md    # Template 變數說明
```

## 用法

每日自動執行（建議透過 Zo Automation）：
```bash
python3 Skills/daily-insurance-lead-email/scripts/pipeline.py
```

手動執行：
```bash
python3 Skills/daily-insurance-lead-email/scripts/pipeline.py --test
```

## 注意事項

- Brevo List 47 需預先建立
- Brevo automation workflow 需預先設定（trigger: new contact added to list 47）
- Apify API credits 需充足（建議每月 ~$200 budget）
- 所有 email 發送由 Brevo automation 處理，**唔好**經 Zo 直接 create campaign 或 sendNow
