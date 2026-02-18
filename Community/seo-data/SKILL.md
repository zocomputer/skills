---
name: seo-data
description: SEO research via DataForSEO API. Keyword research, SERP analysis, backlink profiles, domain analytics, competitor analysis, and trend data. Pay-as-you-go, every command shows estimated cost. Use when you need SEO data for client projects or your own sites.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
---

## CLI

```bash
python3 /home/workspace/Skills/seo-data/scripts/seo.py <command> [options]
```

## Auth

Requires `DATAFORSEO_USERNAME` and `DATAFORSEO_PASSWORD` in Zo secrets.

## Commands

| Command | Description | ~Cost |
|---------|-------------|-------|
| `serp <query>` | Google SERP top results | $0.0006/query |
| `keywords <seed>` | Search volume + difficulty for keywords | ~$0.10/100kw |
| `keyword-ideas <seed>` | Related keyword suggestions | ~$0.05/request |
| `backlinks <domain>` | Backlink profile summary | ~$0.50/domain |
| `domain <domain>` | Domain overview (traffic, tech, rankings) | ~$0.025/request |
| `competitors <domain>` | Competitor domains by keyword overlap | ~$0.05/request |
| `trends <keyword>` | Google Trends data | ~$0.001/query |
| `audit <url>` | On-page SEO audit | ~$0.01/page |
| `balance` | Check remaining credit balance | Free |

## Options

| Flag | Description |
|------|-------------|
| `--location <code>` | Location code (default: 2840 = US). Use `--location 2826` for UK, etc. |
| `--language <code>` | Language code (default: en) |
| `--depth <n>` | SERP depth (default: 10, max: 100) |
| `--limit <n>` | Max results to return (default: 20) |
| `--output <file>` | Save full JSON to file |

## Examples

```bash
# Check what ranks for a keyword
python3 scripts/seo.py serp "best project management software"

# Get keyword ideas around a seed term
python3 scripts/seo.py keyword-ideas "project management tools"

# Backlink profile for a competitor
python3 scripts/seo.py backlinks "competitor-domain.com"

# Domain overview
python3 scripts/seo.py domain "example.com"

# Find competitors
python3 scripts/seo.py competitors "example.com"

# Check balance
python3 scripts/seo.py balance
```

## Cost Tracking

Every command prints the estimated cost to stderr. Use `balance` to check remaining credits. The $50 initial deposit goes a long way at these per-request prices.

## Notes

- This skill uses Live endpoints for instant results.
- Location codes: https://docs.dataforseo.com/v3/serp/google/locations
- Some endpoints return data from DataForSEO's own crawl index (backlinks, domain analytics), not live Google results.
