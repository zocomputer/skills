#!/usr/bin/env python3
"""
Unlock Article - Paywall Bypass Tool
Fetches articles from paywalled sites and saves clean markdown.
"""

import argparse
import os
import re
import sys
import time
import urllib.parse
from pathlib import Path
from urllib.parse import urlparse

import requests
from readability import Document


def extract_domain(url):
    """Extract clean domain name from URL."""
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "").replace(".", "-")
    return domain


def extract_title_from_url(url):
    """Create a filename-friendly title from URL."""
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    if path:
        # Get the last meaningful part of the path
        parts = [p for p in path.split("/") if p and not p.isdigit()]
        if parts:
            # Limit length and clean up
            title = parts[-1].replace("-", " ").replace("_", " ")[:50]
            return re.sub(r'[^\w\s-]', '', title).strip()
    return "article"


def try_archive_today(url):
    """Try to get article via archive.today."""
    try:
        encoded_url = urllib.parse.quote(url, safe="")
        submit_url = f"https://archive.today/submit/?url={encoded_url}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        # Submit URL to archive.today
        resp = requests.get(submit_url, headers=headers, allow_redirects=True, timeout=30)
        
        if resp.status_code == 200:
            # Return the archived page URL
            return resp.url
        return None
    except Exception as e:
        print(f"Archive.today error: {e}", file=sys.stderr)
        return None


def try_archive_org(url):
    """Try to get article via archive.org Wayback Machine."""
    try:
        # First check if there's a snapshot
        check_url = f"https://archive.org/wayback/available?url={urllib.parse.quote(url)}"
        resp = requests.get(check_url, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("archived_snapshots"):
                snapshot = data["archived_snapshots"].get("closest")
                if snapshot and snapshot.get("available"):
                    return snapshot.get("url")
        
        # If no snapshot, try to save it
        save_url = f"https://web.archive.org/save/{url}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        resp = requests.get(save_url, headers=headers, allow_redirects=True, timeout=60)
        
        if resp.status_code == 200:
            return resp.url
        return None
    except Exception as e:
        print(f"Archive.org error: {e}", file=sys.stderr)
        return None


def try_textise_dot_iitty(url):
    """Try textise dot iitty service."""
    try:
        api_url = f"https://r.jina.ai/http://r.jina.ai/http://cc.bingj.com/cache.aspx?d=503-3904-1769&u={urllib.parse.quote(url)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        resp = requests.get(api_url, headers=headers, timeout=30)
        if resp.status_code == 200 and len(resp.text) > 500:
            return resp.text
        return None
    except Exception as e:
        print(f"Textise error: {e}", file=sys.stderr)
        return None


def try_12ft_ladder(url):
    """Try 12ft.io ladder service."""
    try:
        ladder_url = f"https://12ft.io/{url}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        resp = requests.get(ladder_url, headers=headers, timeout=30)
        if resp.status_code == 200 and len(resp.text) > 500:
            return resp.text
        return None
    except Exception as e:
        print(f"12ft.io error: {e}", file=sys.stderr)
        return None


def extract_article_content(html, url):
    """Extract readable article content from HTML."""
    try:
        doc = Document(html)
        title = doc.title()
        content = doc.summary()
        
        # Clean up the content
        # Remove script and style tags
        import re
        content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL)
        content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL)
        
        # Convert to markdown-like format
        content = re.sub(r'<h1[^>]*>(.*?)</h1>', r'\n# \1\n', content, flags=re.DOTALL)
        content = re.sub(r'<h2[^>]*>(.*?)</h2>', r'\n## \1\n', content, flags=re.DOTALL)
        content = re.sub(r'<h3[^>]*>(.*?)</h3>', r'\n### \1\n', content, flags=re.DOTALL)
        content = re.sub(r'<p[^>]*>(.*?)</p>', r'\n\1\n', content, flags=re.DOTALL)
        content = re.sub(r'<li[^>]*>(.*?)</li>', r'- \1\n', content, flags=re.DOTALL)
        content = re.sub(r'<br\s*/?>', '\n', content)
        content = re.sub(r'<[^>]+>', '', content)
        
        # Clean up whitespace
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        return title, content.strip()
    except Exception as e:
        print(f"Content extraction error: {e}", file=sys.stderr)
        return None, None


def save_article(title, content, url, output_dir):
    """Save article as markdown file."""
    domain = extract_domain(url)
    safe_title = re.sub(r'[^\w\s-]', '', title)[:60] if title else extract_title_from_url(url)
    safe_title = re.sub(r'\s+', '_', safe_title)
    
    # Create output directory
    article_dir = Path(output_dir) / domain
    article_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate filename with timestamp to avoid collisions
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    filename = f"{safe_title}_{timestamp}.md"
    filepath = article_dir / filename
    
    # Create markdown content
    markdown = f"""---
title: {title or 'Untitled Article'}
source_url: {url}
date_saved: {time.strftime("%Y-%m-%d %H:%M:%S")}
---

# {title or 'Untitled Article'}

*Source: [{url}]({url})*

---

{content}
"""
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(markdown)
    
    return filepath


def unlock_article(url, output_dir="/home/workspace/Articles"):
    """Main function to unlock and save an article."""
    print(f"Unlocking: {url}")
    
    html = None
    source = None
    
    # Try multiple methods
    methods = [
        ("12ft.io", try_12ft_ladder),
        ("archive.today", try_archive_today),
        ("archive.org", try_archive_org),
        ("textise service", try_textise_dot_iitty),
    ]
    
    for method_name, method_func in methods:
        print(f"  Trying {method_name}...")
        try:
            result = method_func(url)
            if result:
                if result.startswith("http"):
                    # It's a URL, fetch the content
                    headers = {"User-Agent": "Mozilla/5.0"}
                    resp = requests.get(result, headers=headers, timeout=30)
                    if resp.status_code == 200:
                        html = resp.text
                        source = method_name
                        break
                else:
                    # It's already HTML content
                    html = result
                    source = method_name
                    break
        except Exception as e:
            print(f"    {method_name} failed: {e}")
            continue
    
    if not html:
        print("ERROR: Could not bypass paywall with available methods.")
        print("This article may have a hard paywall or require authentication.")
        return None
    
    print(f"  Success! Retrieved via {source}")
    
    # Extract article content
    title, content = extract_article_content(html, url)
    
    if not content or len(content) < 200:
        print("WARNING: Extracted content is very short. The article may be truncated.")
    
    # Save the article
    filepath = save_article(title, content, url, output_dir)
    print(f"\nSaved to: {filepath}")
    print(f"Title: {title or 'Untitled'}")
    print(f"Content length: {len(content)} characters")
    
    return filepath


def main():
    parser = argparse.ArgumentParser(
        description="Unlock paywalled articles and save as markdown"
    )
    parser.add_argument("url", help="Article URL to unlock")
    parser.add_argument(
        "--output", "-o",
        default="/home/workspace/Articles",
        help="Output directory (default: /home/workspace/Articles)"
    )
    
    args = parser.parse_args()
    
    result = unlock_article(args.url, args.output)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
