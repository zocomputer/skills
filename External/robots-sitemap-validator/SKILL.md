---
name: robots-sitemap-validator
description: Check robots.txt and sitemap.xml for crawl-blocking mistakes. Use when the user says "check my robots.txt", "validate my sitemap", or "is my site crawlable".
license: MIT
metadata:
  author: JustHandled Labs
  category: External
  credits: 0
  price: $0
  triggers: ["check my robots.txt","validate my sitemap","is my site crawlable"]
  version: 1.0.2
---

# Robots Sitemap Validator

Detect common local robots.txt and sitemap.xml mistakes that can hurt crawling. This detector does not fetch, submit, or change live sites.

## Workflow

1. Run scripts/scan_robots_sitemap.py with a folder, files, or --stdin.
2. Review findings by rule id, severity, file, and line.
3. Treat missing sibling sitemap files as review flags when robots.txt references them.

## Guardrails

- Read local files or stdin only.
- Do not fetch live URLs or submit sitemaps.
- Do not modify robots.txt or sitemap files.

## Verification

Run `python scripts/scan_robots_sitemap.py --help` first. Then use a disposable folder to verify both outcomes:

1. A `robots.txt` containing `User-agent: *` and `Disallow: /` must report `RSV001`.
2. A `robots.txt` with an absolute `Sitemap:` URL plus a matching, well-formed local `sitemap.xml` must produce zero findings.

## Commercial Terms

Price: $0 / 0 credits. Free commercial use for personal or internal team workflows. Do not resell or redistribute the package as-is.
