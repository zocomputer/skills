#!/usr/bin/env python3
"""
PDF to Markdown conversion using PyMuPDF (best quality).
Called by arxiv.ts for convert command.
"""

import sys

def convert_to_markdown(pdf_path: str, md_path: str) -> str:
    try:
        import fitz  # PyMuPDF
        
        # Try pymupdf4llm first (best quality)
        try:
            from pymupdf4llm import to_markdown
            md = to_markdown(pdf_path)
        except ImportError:
            # Fallback: basic PyMuPDF
            doc = fitz.open(pdf_path)
            md = ""
            for page_num in range(len(doc)):
                page = doc[page_num]
                md += f"\n\n--- Page {page_num + 1} ---\n\n"
                md += page.get_text()
            doc.close()
    except ImportError:
        raise ImportError("PyMuPDF not installed. Run: pip3 install PyMuPDF")
    
    with open(md_path, "w") as f:
        f.write(md)
    
    return md

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: convert_to_markdown.py <pdf_path> <md_path>", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    md_path = sys.argv[2]
    convert_to_markdown(pdf_path, md_path)
