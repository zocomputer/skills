# SEC Weekly Filing Monitor

Run this every week to check for new SEC filings across all tracked tickers,
apply the user's monitor rules, and send a digest if there are new filings or alerts.

## How to Run

This instruction file is referenced by the `create_automation` call in the skill.
Zo executes this by reading this file and running the equivalent steps via chat.

## Step-by-Step

### 1. Read tracked tickers and monitor rules

Read `sec/config.json`. Extract:
- `tracked_tickers` — list of ticker symbols
- `monitor_rules` — list of rules, each with `name`, `applies_to_forms`, `match.keywords`, `alert_channel`

### 2. For each ticker, check for new filings

For each ticker in `tracked_tickers`:
```
python3 Skills/sec-edgar/scripts/fetch.py --ticker [TICKER] --forms 10-K,10-Q,8-K,DEF 14A --max 5 --skip-indexed
```
Only process filings that are genuinely new (not already in the manifest).

### 3. For each new filing, apply monitor rules

For each newly downloaded filing:
- Read the filing text (either the raw HTML or the extracted tree text)
- For each rule where `rule.applies_to_forms` includes the filing's form type:
  - Check if any of `rule.match.keywords` appear in the filing text
  - If a match is found, record: (ticker, filing form, rule name, matched snippet)

Only alert on matches. Filings that match no rules generate no alert — they are still indexed silently.

### 4. Compose the digest

Build a text digest:

```
SEC Intelligence — Weekly Filing Digest
Date: [YYYY-MM-DD]

Tracked tickers: [N]
New filings indexed: [M]
Storage: [X.X GB / 10 GB]

[If alerts found:]
ALERTS:
- [TICKER] [FORM]: matched rule "acquisitions" — snippet
- [TICKER] [FORM]: matched rule "revenue decline" — snippet

[If no alerts:]
No new filing matches this week.

Top tickers by storage:
- AAPL: 1.4 GB
- BRK.A: 1.1 GB
```

### 5. Send the digest

Send via the `alert_channel` specified in the matching rule (sms or email).
If no alerts and no new filings, still send the digest but mark it as "routine — no action needed."

### 6. Update edgar_check.json

Write `sec/cache/edgar_check.json` with the latest known accession number per ticker.
This keeps the dashboard's status dots in sync.

## Important Rules

- **No alert fatigue.** Only send notifications when a rule actually matches. Silent on filings that don't match any rule.
- **Rate limit respect.** Add `sleep 0.15` between SEC API calls. If 503, wait 10 minutes and retry once.
- **Always index.** Even when a filing triggers no rule, still index it for future search.
- **Storage check.** If `sec/` total size is within 1 GB of `storage_warn_gb`, include a prominent storage warning in the digest.
- **Time zone.** Use America/New_York for all timestamps in the digest.

## Example Digest

```
SEC Intelligence — Weekly Filing Digest
Date: 2026-05-13

Tracked tickers: 8
New filings indexed: 3 (1 TSLA 8-K, 2 CAT 10-Q)
Storage: 8.2 GB / 10 GB

ALERTS:
- TSLA 8-K: matched rule "acquisitions" — "entered into a definitive agreement to acquire..."
- AAPL 10-Q: matched rule "revenue decline" — "revenue decreased 5% year over year"

Top tickers by storage:
- AAPL: 1.4 GB
- BRK.A: 1.1 GB
- TSLA: 0.9 GB
```