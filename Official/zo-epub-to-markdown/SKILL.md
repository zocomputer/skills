---
name: epub-to-markdown
description: Convert EPUB ebooks to Markdown format
metadata:
  author: Zo
  category: Official
  display-name: Convert EPUB to Markdown
  emoji: 📚
---

# Convert EPUB to Markdown

## Purpose

Convert EPUB ebook files to Markdown format, preserving structure and formatting.

## Input

- Path to the EPUB file you want to convert

## Steps

1. Install pandoc:

```bash
apt-get update && apt-get install -y pandoc
```

2. Convert the EPUB file to Markdown:

```bash
pandoc "<user's_epub_path>" -t gfm-raw_html -o "<output_markdown_path>"
```

3. Tell the user where the converted Markdown file was saved.

## Note

The `gfm-raw_html` format produces cleaner output by removing embedded HTML elements from the EPUB.

