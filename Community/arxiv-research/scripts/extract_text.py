#!/usr/bin/env python3
"""
PDF text extraction fallback using PyPDF2.
Called by arxiv.ts when pdftotext is not available.
"""

import sys
from PyPDF2 import PdfReader

def extract_text(pdf_path: str, with_page_markers: bool = False) -> str:
    reader = PdfReader(pdf_path)
    text = ""
    for i, page in enumerate(reader.pages, 1):
        if with_page_markers:
            text += f"\n--- Page {i} ---\n"
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: extract_text.py <pdf_path> [with_page_markers]", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    with_markers = len(sys.argv) > 2 and sys.argv[2].lower() == "true"
    
    print(extract_text(pdf_path, with_markers))
