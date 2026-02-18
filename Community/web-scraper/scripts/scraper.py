#!/usr/bin/env python3
"""Web scraper with tiered approach: httpx -> BeautifulSoup -> Crawl4AI."""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup


def fetch_simple(url: str, timeout: int = 30) -> tuple[str, str]:
    """Tier 1: Simple HTTP fetch. Returns (html, content_type)."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    }
    r = httpx.get(url, headers=headers, timeout=timeout, follow_redirects=True)
    r.raise_for_status()
    return r.text, r.headers.get("content-type", "")


def html_to_markdown(html: str, url: str = "") -> str:
    """Convert HTML to clean markdown-ish text."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def extract_css(html: str, selector: str, url: str = "") -> list[dict]:
    """Tier 2: Extract elements matching a CSS selector."""
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for el in soup.select(selector):
        item = {"text": el.get_text(strip=True)}
        if el.get("href"):
            item["href"] = urljoin(url, el["href"])
        if el.get("src"):
            item["src"] = urljoin(url, el["src"])
        if el.name in ("img",) and el.get("alt"):
            item["alt"] = el["alt"]
        results.append(item)
    return results


def extract_schema(html: str, schema: dict, url: str = "") -> list[dict]:
    """Tier 2: Extract structured data using a JSON CSS schema."""
    soup = BeautifulSoup(html, "html.parser")
    base_selector = schema.get("baseSelector", "body")
    fields = schema.get("fields", [])
    results = []
    for container in soup.select(base_selector):
        item = {}
        for field in fields:
            name = field["name"]
            sel = field.get("selector", "")
            ftype = field.get("type", "text")
            el = container.select_one(sel) if sel else container
            if el is None:
                item[name] = None
                continue
            if ftype == "text":
                item[name] = el.get_text(strip=True)
            elif ftype == "attribute":
                attr = field.get("attribute", "href")
                val = el.get(attr, "")
                if attr in ("href", "src") and val:
                    val = urljoin(url, val)
                item[name] = val
            elif ftype == "html":
                item[name] = str(el)
            elif ftype == "exists":
                item[name] = True
            else:
                item[name] = el.get_text(strip=True)
        results.append(item)
    return results


async def scrape_with_js(url: str, timeout: int = 30, wait: float = 0) -> str:
    """Tier 3: Fetch with JavaScript rendering via Crawl4AI."""
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=timeout * 1000,
        delay_before_return_html=wait,
    )
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url, config=config)
        if result.success:
            return result.markdown or result.html or ""
        raise RuntimeError(f"Crawl4AI failed: {result.error_message}")


async def extract_with_llm(url: str, instruction: str, timeout: int = 30) -> str:
    """Tier 5: LLM-powered extraction via Crawl4AI."""
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
    from crawl4ai.extraction_strategy import LLMExtractionStrategy

    strategy = LLMExtractionStrategy(
        instruction=instruction,
    )
    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=timeout * 1000,
        extraction_strategy=strategy,
    )
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url, config=config)
        if result.success:
            return result.extracted_content or result.markdown or ""
        raise RuntimeError(f"LLM extraction failed: {result.error_message}")


async def deep_crawl(url: str, depth: int = 2, max_pages: int = 20, timeout: int = 30) -> list[dict]:
    """Tier 4: Deep crawl with BFS link following via Crawl4AI."""
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=timeout * 1000,
    )
    visited = set()
    queue = [(url, 0)]
    results = []

    async with AsyncWebCrawler() as crawler:
        while queue and len(results) < max_pages:
            current_url, current_depth = queue.pop(0)
            if current_url in visited:
                continue
            visited.add(current_url)

            try:
                result = await crawler.arun(url=current_url, config=config)
                if not result.success:
                    continue

                page_data = {
                    "url": current_url,
                    "depth": current_depth,
                    "title": "",
                    "content": result.markdown or "",
                }
                if result.html:
                    soup = BeautifulSoup(result.html, "html.parser")
                    title_tag = soup.find("title")
                    if title_tag:
                        page_data["title"] = title_tag.get_text(strip=True)
                results.append(page_data)
                print(f"[{len(results)}/{max_pages}] depth={current_depth} {current_url}", file=sys.stderr)

                if current_depth < depth and result.links:
                    internal = result.links.get("internal", [])
                    for link in internal:
                        href = link.get("href", "") if isinstance(link, dict) else str(link)
                        if href and href not in visited:
                            queue.append((href, current_depth + 1))
            except Exception as e:
                print(f"[error] {current_url}: {e}", file=sys.stderr)
                continue

    return results


async def batch_scrape(urls: list[str], css: str = None, schema: dict = None, js: bool = False, timeout: int = 30) -> list[dict]:
    """Batch scrape multiple URLs."""
    results = []
    for url in urls:
        url = url.strip()
        if not url or url.startswith("#"):
            continue
        try:
            if js:
                html_content = await scrape_with_js(url, timeout)
                html = html_content
            else:
                html, _ = fetch_simple(url, timeout)

            if schema:
                data = extract_schema(html, schema, url)
                results.append({"url": url, "data": data})
            elif css:
                data = extract_css(html, css, url)
                results.append({"url": url, "data": data})
            else:
                md = html_to_markdown(html, url)
                results.append({"url": url, "content": md})
            print(f"[ok] {url}", file=sys.stderr)
        except Exception as e:
            results.append({"url": url, "error": str(e)})
            print(f"[error] {url}: {e}", file=sys.stderr)
    return results


def output_result(data, fmt: str, output_path: str = None):
    """Write result to stdout or file."""
    if fmt == "json":
        text = json.dumps(data, indent=2, ensure_ascii=False)
    elif isinstance(data, str):
        text = data
    elif isinstance(data, list):
        text = json.dumps(data, indent=2, ensure_ascii=False)
    else:
        text = str(data)

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text(text)
        print(f"Saved to {output_path}", file=sys.stderr)
    else:
        print(text)


def main():
    parser = argparse.ArgumentParser(description="Web scraper with tiered approach")
    sub = parser.add_subparsers(dest="command", required=True)

    # scrape
    sp = sub.add_parser("scrape", help="Scrape a single URL")
    sp.add_argument("url")
    sp.add_argument("--css", help="CSS selector to extract")
    sp.add_argument("--schema", help="Path to JSON schema file for structured extraction")
    sp.add_argument("--llm-extract", dest="llm_extract", help="LLM extraction instruction")
    sp.add_argument("--js", action="store_true", help="Force JS rendering")
    sp.add_argument("--wait", type=float, default=0, help="Wait seconds after page load")
    sp.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds")
    sp.add_argument("--output", help="Save to file")
    sp.add_argument("--format", choices=["json", "md", "text"], default=None)

    # crawl
    cp = sub.add_parser("crawl", help="Deep crawl a site")
    cp.add_argument("url")
    cp.add_argument("--depth", type=int, default=2, help="Max crawl depth")
    cp.add_argument("--max-pages", type=int, default=20, help="Max pages to crawl")
    cp.add_argument("--timeout", type=int, default=30)
    cp.add_argument("--output", help="Save to file")

    # batch
    bp = sub.add_parser("batch", help="Batch scrape URLs from file")
    bp.add_argument("file", help="File with URLs, one per line")
    bp.add_argument("--css", help="CSS selector to extract from each page")
    bp.add_argument("--schema", help="Path to JSON schema file")
    bp.add_argument("--js", action="store_true")
    bp.add_argument("--timeout", type=int, default=30)
    bp.add_argument("--output", help="Save to file")

    args = parser.parse_args()

    if args.command == "scrape":
        if args.llm_extract:
            result = asyncio.run(extract_with_llm(args.url, args.llm_extract, args.timeout))
            fmt = args.format or "json"
            output_result(result, fmt, args.output)
        elif args.schema:
            schema = json.loads(Path(args.schema).read_text())
            if args.js:
                html = asyncio.run(scrape_with_js(args.url, args.timeout, args.wait))
            else:
                try:
                    html, _ = fetch_simple(args.url, args.timeout)
                except Exception:
                    print("Simple fetch failed, trying JS rendering...", file=sys.stderr)
                    html = asyncio.run(scrape_with_js(args.url, args.timeout, args.wait))
            data = extract_schema(html, schema, args.url)
            output_result(data, args.format or "json", args.output)
        elif args.css:
            if args.js:
                html = asyncio.run(scrape_with_js(args.url, args.timeout, args.wait))
            else:
                try:
                    html, _ = fetch_simple(args.url, args.timeout)
                except Exception:
                    print("Simple fetch failed, trying JS rendering...", file=sys.stderr)
                    html = asyncio.run(scrape_with_js(args.url, args.timeout, args.wait))
            data = extract_css(html, args.css, args.url)
            output_result(data, args.format or "json", args.output)
        else:
            if args.js:
                content = asyncio.run(scrape_with_js(args.url, args.timeout, args.wait))
            else:
                try:
                    html, _ = fetch_simple(args.url, args.timeout)
                    content = html_to_markdown(html, args.url)
                except Exception:
                    print("Simple fetch failed, trying JS rendering...", file=sys.stderr)
                    content = asyncio.run(scrape_with_js(args.url, args.timeout, args.wait))
            output_result(content, args.format or "md", args.output)

    elif args.command == "crawl":
        results = asyncio.run(deep_crawl(args.url, args.depth, args.max_pages, args.timeout))
        output_result(results, "json", args.output)

    elif args.command == "batch":
        urls = Path(args.file).read_text().strip().splitlines()
        schema = json.loads(Path(args.schema).read_text()) if args.schema else None
        results = asyncio.run(batch_scrape(urls, args.css, schema, args.js, args.timeout))
        output_result(results, "json", args.output)


if __name__ == "__main__":
    main()
