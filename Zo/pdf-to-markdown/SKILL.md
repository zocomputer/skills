---
name: Convert PDF to Markdown
description: Convert PDF files to Markdown format
metadata:
  author: Zo
  emoji: 📄
---

# Convert PDF to Markdown

## Purpose

Convert the user's PDF file to Markdown format, preserving structure and formatting.

## Input

- Path to the PDF file you want to convert

## Steps

1. Install pymupdf4llm if not already installed:

```bash
pip install pymupdf4llm
```

2. Convert the user's PDF to Markdown with proper formatting:

```python
import pymupdf4llm

# Convert with better formatting and structure preservation
markdown_text = pymupdf4llm.to_markdown(
    "<user's_pdf_path>",
    page_chunks=True,  # Separate pages with breaks
    write_images=True  # Extract and include images
)

# Save to a markdown file with the same name
output_filename = "<user's_pdf_path>".replace('.pdf', '.md')
with open(output_filename, "w", encoding="utf-8") as f:
    f.write(markdown_text)
```

3. Tell the user where the converted markdown file was saved.

## Note

If the PDF appears to be scanned (images of text), inform the user that OCR tools would work better for that use case.

