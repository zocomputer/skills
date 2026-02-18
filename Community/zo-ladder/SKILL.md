---
name: zo-ladder
description: Send an article URL and get a clean, paywall-free version saved as a markdown document. Works with major news sites and publications by using text extraction services and browser automation.
compatibility: Created for Zo Computer
metadata:
  author: mxgrauer.zo.computer
  category: Community
  display-name: Zo Ladder
  emoji: 🪜
allowed-tools: read_webpage web_search
---
# Unlock Article

This skill fetches articles from paywalled websites and saves them as clean markdown documents.

## Quick Start

To unlock an article, simply provide a URL:

```
https://www.nytimes.com/2024/01/15/technology/example-article.html
```

Or ask me to:
- "Unlock this article: <URL>"
- "Remove the paywall from <URL>"
- "Get me the full text of <URL>"
- "Save this article: <URL>"

## How it Works

The skill tries multiple methods to retrieve the full article:

1. **Text extraction services** - Uses jina.ai and other services to extract article text directly, preserving structure.
2. **Browser automation** - Falls back to agent-browser to render pages and extract content, preserving structure.
3. **Content cleaning** - Removes ads, navigation, and formatting to produce clean markdown.
4. **Media normalization** - Normalizes media (images, videos) and captions in markdown.

## Supported Sites

This works with most publications including:
- New York Times
- Washington Post
- Wall Street Journal
- The Atlantic
- Wired
- Medium (member-only stories)
- Substack
- Bloomberg
- Financial Times (partial)
- And many more

## Output Location

Articles are saved to `Articles/<domain>/<article-title>.md`

Each file includes:
- Original URL for reference
- Date saved
- Clean article text
- Source attribution
- Subheadings
- Article images
- Image captions

## Limitations

- Some hard paywalls (especially those requiring login) cannot be bypassed
- Content may be truncated if the site uses JavaScript-heavy paywalls
- Image/caption availability depends on source extraction quality

## Extraction Requirements

- preserve heading hierarchy (H1/H2/H3)
- include inline markdown images when source URLs are available
- include captions directly beneath images when available
- do not drop subheadings even if body text is partially missing

## Manual Usage

You can also run the script directly:

```bash
bun run /home/workspace/Skills/zo-ladder/scripts/unlock.ts <url>
```

Optional: specify output directory:
```bash
bun run /home/workspace/Skills/zo-ladder/scripts/unlock.ts <url> /custom/output/path
```
