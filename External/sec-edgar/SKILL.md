---
name: sec-edgar
description: Natural-language SEC filing intelligence — fetch, index, search, and analyze SEC EDGAR filings for any public company via conversation. Built on the PageIndex vectorless RAG methodology.
compatibility: Created for Zo Computer
metadata:
  author: cis.zo.computer
  category: External
  display-name: SEC Intelligence
---

# Zo SEC Intelligence

Ask any question about any public company's SEC filings and get precise, cited answers from raw filing text — across tickers, across years.

---

## When This Skill Activates

Activates when the user mentions:

- SEC / EDGAR / SEC filings / SEC data
- Company financial topics: earnings, revenue, guidance, income statement, cash flow, segment results, margins, guidance
- Filing types: 10-K, 10-Q, 8-K, DEF 14A, Form 3, Form 4, S-1, 20-F, 6-K, 13F, 13D, 13G
- Insider, proxy, shareholder, annual report, quarterly filing
- Risk factors, MD&A, executive comp, beneficial ownership, share repurchase, buyback
- Questions starting with "what does X say about..." / "how does X discuss..." / "compare X and Y"

---

## Decision Tree

When a user message triggers this skill, map it through this tree before acting:

```markdown
USER MESSAGE
  │
  ├─ "what do we have indexed" / "show me tracked tickers" / "dashboard"
  │     → Suggest the dashboard: https://cis.zo.space/sec
  │     → Or run: check_indexed.py --ticker ALL (show all)
  │
  ├─ "run a health check" / "diagnostics" / "is it working"
  │     → doctor.py
  │
  ├─ "how much space" / "storage" / "how big is this"
  │     → manifest.py --storage-stats
  │
  ├─ "track" / "monitor" / "alert me" / "notify me"
  │     → Register monitor rule + create automation (see Monitoring section)
  │
  ├─ "set up" / "install" / "initialize" / "get started"
  │     → Run: python3 Skills/sec-edgar/scripts/install.py
  │
  ├─ Question about a specific company's financials / operations / risks
  │     → GO TO: Ask a Question About a Company
  │
  └─ Fetch or check filings
        → GO TO: Fetch Workflow
```

---

## Fetch Workflow

### First: Check What's Already Indexed

Always check first. Never fetch blindly.

```markdown
User: "Fetch Tesla's latest 10-K"
Agent:
  → check_indexed.py --ticker TSLA
  → if already indexed: tell user what's available, ask if they want it re-fetched
  → if not: proceed to fetch
```

### SEC User-Agent — Needed Once

If the user hasn't set up SEC EDGAR access yet, get the UA first:

```markdown
Agent: "SEC EDGAR requires a name and email in the request header. What's your name and email? (Format: 'Your Name your@email.com')"
User: "Jing Xie jing@clarionintelligence.com"
Agent:
  → update config.json sec_user_agent = "Jing Xie jing@clarionintelligence.com"
  → proceed with fetch
```

### Actually Fetch

```markdown
Agent:
  → fetch.py --ticker TSLA --forms 10-K --max 2
  → index.py --auto  (background, returns immediately)
  → tell user: "Downloading 2 TSLA 10-Ks. Indexing in background — I'll let you know when ready."
```

### After Fetching

```markdown
Agent:
  → check_indexing_status (poll until done)
  → when complete: report what was indexed
  → then: GO TO: Ask a Question workflow
```

### Supported Form Types

| Form | What it is |
| --- | --- |
| 10-K | Annual report — Business, Risk Factors, MD&A, Financials |
| 10-Q | Quarterly report — Financials, MD&A, Risk Factors |
| 8-K | Current report — earnings, leadership, material events |
| DEF 14A | Proxy statement — exec comp, board, shareholder proposals |
| Form 3/4 | Insider ownership — who owns what, trading activity |
| S-1 | IPO registration — risk factors, use of proceeds |
| 20-F | Foreign company annual (non-US issuers) |
| 6-K | Foreign company current events |
| 13F | Institutional investment holdings (quarterly) |
| 13D/G | Beneficial ownership (5%+ holders) |
| 424B5 | Prospectus supplement |
| S-1/A, 10-Q/A | Amendments — stored and indexed independently |

---

## Ask a Question About a Company

### Step 1: Ensure the filing is indexed

```markdown
Agent:
  → check_indexed.py --ticker TSLA
  → if not indexed: fetch + index first
  → if indexed: proceed to search
```

### Step 2: Search

```markdown
Agent:
  → search.py --query "risk factors" --tickers TSLA
  → returns ranked matches with doc_id, node_id, snippet, score
```

### Step 3: Get Full Text

```markdown
Agent:
  → get_document_section(doc_id, node_id) for each top result
  → present raw filing text with citation
```

### Step 4: Synthesize and Cite

Always cite:

> According to Tesla's 2025 10-K (doc: `TSLA--10-K--20250128--000131860525000014`, Item 1A Risk Factors, node 0008):
> "Our business is subject to risks including supply chain disruption, EV market adoption uncertainty, and regulatory compliance across multiple jurisdictions..."
>
> Source: TSLA--10-K--20250128--000131860525000014, node 0008

### Cross-Company Comparison

```markdown
User: "Compare how Apple, Microsoft, and Google discuss AI in their 2025 10-Ks"
Agent:
  → ensure AAPL, MSFT, GOOGL latest 10-Ks are indexed
  → search.py --query "artificial intelligence AI" --tickers AAPL,MSFT,GOOGL
  → for each top match: get_document_section
  → synthesize with per-company citations
```

### Multi-Year Tracking

```markdown
User: "Show me how Amazon's AWS segment revenue discussion evolved from 2022 to 2025"
Agent:
  → ensure AMZN 10-K filings from 2022, 2023, 2024, 2025 are indexed
  → search.py for each year individually
  → present side-by-side raw text showing evolution
```

---

## Query Routing — Where Answers Live

| User is asking about | Primary SEC section |
| --- | --- |
| Risk factors | Item 1A (10-K / 10-Q) |
| Management discussion | Item 7 MD&A (10-K), Part I Item 2 (10-Q) |
| Revenue / segment breakdown | Item 8 footnotes, Item 7 MD&A |
| Earnings / quarterly results | 8-K Item 2.02 (results), 10-Q Part I Item 2 (MD&A) |
| Revenue guidance / forward-looking | 8-K, 10-Q MD&A |
| Segment / geography results | Item 8 segment footnotes |
| Executive compensation | DEF 14A, Item 11 (10-K) |
| Insider ownership / 10b5-1 plans | Form 3/4, Item 12 (10-K) |
| Share repurchases / buybacks | Item 5 (10-K / 10-Q) |
| Legal proceedings / lawsuits | Item 3 (10-K / 10-Q) |
| Debt and credit facilities | Item 8 footnotes, Item 7 liquidity |
| Related party transactions | Item 13 (10-K) |
| Acquisitions / mergers | Item 8 notes, Item 7 |
| Accounting policies | Item 8 footnote 1-2 |
| Goodwill and intangibles | Item 8 intangible asset footnotes |
| Institutional holdings | 13F (quarterly) |
| Beneficial ownership (5%+ holders) | 13D / 13G |

---

## Monitoring — Set Up an Alert

### Register a Rule

```markdown
User: "Alert me when any of my tracked companies files an 8-K mentioning acquisition"
Agent:
  → config.py add_monitor_rule(
      name="8-K acquisitions",
      applies_to_forms=["8-K"],
      keywords=["acquisition", "merger", "letter of intent"],
      alert_channel="sms"
    )
  → verify the rule is stored in sec/config.json
```

### Create the Weekly Automation

```markdown
Agent:
  → create_automation(
      title="SEC Filing Monitor",
      rrule="WEEKLY",
      instruction_file="Skills/sec-edgar/prompts/weekly_fetch.md",
      delivery_method="sms"
    )
  → confirm automation created with trigger time
```

The automation reads `file sec/config.json` for tracked tickers and monitor rules. It:

1. Fetches new filings for all tracked tickers
2. Applies each rule's keywords to each new filing
3. Only sends alerts when at least one rule matches
4. Skips filings that match no rules (no alert fatigue)
5. Reports storage usage in the weekly digest

---

## Key Principles

1. **Check before fetch.** Always `check_indexed.py --ticker X` first — avoids redundant downloads and respects SEC rate limits.

2. **Summaries are navigation only.** The system builds summaries to help locate relevant sections. Answers always come from full raw text, never from summaries.

3. **Cite with doc_id + node_id.** Every answer must include the source citation in format: `(ticker: doc_id, section: node_id)`.

4. **SEC rate limits are real.** EDGAR allows 10 req/s. Scripts handle this with jitter and backoff. If rate-limited, wait 10 minutes before retrying.

5. **Amendments are stored independently.** 10-K/A is not a replacement for 10-K — both are kept, with `is_latest_for_period` flagged in the manifest.

6. **Dashboard is read-only.** The Zo Space dashboard at `https://cis.zo.space/sec` is for reading and monitoring. All actions (add ticker, change config, trigger fetch) go through chat or file edit.

7. **Only suggest dashboard on "what do we have indexed" queries.** Not on fetch, search, or analysis — those are chat-first workflows.

8. **One skill, one job.** Don't try to do financial analysis, trading, or portfolio management. Stay focused on SEC filing intelligence.

---

## Error Recovery

| Problem | What to do |
| --- | --- |
| Ticker not found | Verify the ticker symbol. Try searching on SEC EDGAR directly. |
| SEC rate limited | "SEC rate limited — I'll wait 10 minutes before retrying." |
| Filing not in index | Check `check_indexed.py --ticker X`. If not indexed, fetch it. |
| No search results | Try broader terms. Check the document overview to understand structure. |
| Indexing failed | Check `file index.py` output. Verify the HTML file exists and is valid. |
| LLM call failed | Retry once. If still failing, note the section will use raw text without summarization. |

---

## Scripts Reference

All scripts run from `/home/workspace` with `python3 Skills/sec-edgar/scripts/<script>.py`.

| Script | What it does |
| --- | --- |
| `fetch.py --ticker TSLA --forms 10-K,10-Q --max 5` | Download filings. `--skip-indexed` skips already downloaded. |
| `index.py --auto` | Index all unindexed HTML files in sec/index/. |
| `index.py --file <path>` | Index a single file. |
| `check_indexed.py --ticker TSLA` | What's indexed vs. available on SEC EDGAR. Use `--all` for all tickers. |
| `search.py --query "risk factors" --tickers TSLA,IBM` | Keyword + LLM-reasoning search across indexed filings. |
| `manifest.py --ticker TSLA` | Per-ticker manifest. `--storage-stats` shows total + per-ticker storage. |
| `config.py --add-ticker MSFT --add-rule "..."` | Add tickers or monitor rules to config. |
|  | Health check: filesystem, config, storage, EDGAR reachability. |
| `llm.py --verify-model` | Verify MiniMax 2.7 is reachable via Zo. |
|  | First-time setup: creates sec/ dirs, sets config, runs smoke test. |

---

## Data Storage

```markdown
/home/workspace/sec/
  index/
    [TICKER]/
      [TICKER].manifest.json           ← source of truth per ticker
      [TICKER]--[FORM]--[DATE]--[ACCESSION].html   ← original HTML
      [TICKER]--[FORM]--[DATE]--[ACCESSION].json   ← PageIndex tree
      [TICKER]--[FORM]--[DATE]--[ACCESSION].manifest.json  ← per-filing sidecar
  manifests/
    global.json                        ← aggregated view (rebuilt on read)
  cache/
    company_tickers.json               ← ticker→CIK (5-min TTL)
    edgar_check.json                   ← last-known filing per ticker
  logs/
    fetch_YYYY-MM-DD.log
    index_YYYY-MM-DD.log
  config.json                          ← user prefs, tracked tickers, monitor rules
```

---

## First-Time Setup

```markdown
User: "Set up SEC intelligence"
Agent:
  → python3 Skills/sec-edgar/scripts/install.py
  → prompt for SEC User-Agent (name + email)
  → prompt for initial tickers to track
  → run smoke test (fetch one filing, index it, verify search works)
  → report setup complete with status
```