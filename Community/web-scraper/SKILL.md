---
name: web-scraper
description: Crawl and extract structured data from websites. Uses a tiered approach -- Zo built-ins for simple fetches, BeautifulSoup for custom parsing, Crawl4AI for deep crawls and LLM-powered extraction. Use when you need to scrape a website, extract structured data, or crawl multiple pages.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
---

## CLI

```bash
python3 /home/workspace/Skills/web-scraper/scripts/scraper.py <command> [options]
```

| Command | Description |
|---------|-------------|
| `scrape <url>` | Fetch page content as markdown |
| `scrape <url> --css <selector>` | Extract elements matching a CSS selector |
| `scrape <url> --schema <json-file>` | Extract structured data using a JSON CSS schema |
| `scrape <url> --llm-extract "<instruction>"` | Use LLM to extract structured data (Crawl4AI) |
| `crawl <url> --depth N --max-pages N` | Deep crawl following links (BFS) |
| `batch <file> [--css <selector>]` | Scrape multiple URLs from a file (one per line) |

## Options

| Flag | Description |
|------|-------------|
| `--output <file>` | Save output to file instead of stdout |
| `--format json\|md\|text` | Output format (default: md for scrape, json for extract) |
| `--js` | Force JavaScript rendering via Playwright |
| `--wait <seconds>` | Wait after page load before extracting |
| `--timeout <seconds>` | Request timeout (default: 30) |

## Tiered Approach

The scraper automatically picks the lightest tool that can do the job:

1. **Simple fetch** (`scrape <url>`) -- Uses httpx + BeautifulSoup. Fast, no browser overhead.
2. **CSS extraction** (`--css` or `--schema`) -- BeautifulSoup with selectors. Still fast.
3. **JS rendering** (`--js` flag, or auto-fallback) -- Playwright via Crawl4AI. For SPAs and dynamic content.
4. **Deep crawl** (`crawl` command) -- Crawl4AI with BFS link following.
5. **LLM extraction** (`--llm-extract`) -- Crawl4AI with LLM strategy. Most expensive, most flexible.

## Schema Format (for --schema)

JSON file with CSS extraction schema:

```json
{
  "name": "Products",
  "baseSelector": "div.product",
  "fields": [
    {"name": "title", "selector": "h2", "type": "text"},
    {"name": "price", "selector": ".price", "type": "text"},
    {"name": "url", "selector": "a", "type": "attribute", "attribute": "href"}
  ]
}
```

Field types: `text`, `attribute`, `html`, `exists`

## Examples

```bash
# Simple page content
python3 scripts/scraper.py scrape https://example.com

# Extract all h2 headings
python3 scripts/scraper.py scrape https://example.com --css "h2"

# Structured extraction with schema
python3 scripts/scraper.py scrape https://example.com/products --schema schema.json

# LLM-powered extraction
python3 scripts/scraper.py scrape https://example.com --llm-extract "Extract all company names and their descriptions"

# Deep crawl a site
python3 scripts/scraper.py crawl https://docs.example.com --depth 2 --max-pages 50

# Batch scrape URLs from file
python3 scripts/scraper.py batch urls.txt --css "article" --output results.json
```

## Notes

- Zo's `read_webpage` and `agent-browser` are still better for quick one-off page reads in conversation. Use this skill when you need structured extraction, deep crawls, or batch operations.
- LLM extraction uses whatever model is configured in Crawl4AI (defaults to environment). Costs API tokens.
- Deep crawls respect robots.txt by default. Use responsibly.
