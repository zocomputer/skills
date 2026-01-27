---
name: generate-pdf
description: Convert Markdown files to PDF format with professional formatting
metadata:
  author: Zo
  category: Official
  display-name: Generate PDF from Markdown
  emoji: 📑
---

# Generate PDF from Markdown

## Purpose

Convert Markdown files to professionally formatted PDF documents using pandoc.

## Input

- Path to the Markdown file you want to convert

## Steps

1. Install pandoc and LaTeX:

```bash
apt-get update && apt-get install -y pandoc texlive-latex-base texlive-fonts-recommended texlive-xetex
```

2. Convert the Markdown file to PDF with professional formatting:

```bash
pandoc "<user's_markdown_path>" \
  --pdf-engine=xelatex \
  --variable geometry:margin=1in \
  --variable fontsize=11pt \
  --variable linkcolor=blue \
  --highlight-style=tango \
  -o "<output_pdf_path>"
```

3. Tell the user where the PDF file was saved.

