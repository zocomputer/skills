---
name: Extract Text from Images (OCR)
description: Extract text from images, scanned documents, and PDFs using OCR
metadata:
  author: Zo
  category: Official
  emoji: 🔍
---

# Extract Text from Images (OCR)

## Purpose

Extract text from images, scanned documents, screenshots, and image-based PDFs using Tesseract OCR.

## Input

- Path to the image or PDF file containing text you want to extract

## Steps

1. Install Tesseract and required packages:

```bash
apt-get update && apt-get install -y tesseract-ocr imagemagick ghostscript
```

2. Extract text based on the file type:

```bash
# For image files (PNG, JPG, TIFF, etc.)
tesseract "<user's_image_path>" output.txt
cat output.txt

# For better accuracy with preprocessing
convert "<user's_image_path>" -resize 150% -type Grayscale -sharpen 0x1 enhanced.png
tesseract enhanced.png output.txt
cat output.txt

# For PDF files (converts to images first)
convert -density 300 "<user's_pdf_path>" -depth 8 -strip -background white -alpha off page_%d.png
for img in page_*.png; do tesseract "$img" "$img.txt"; done
cat page_*.png.txt > combined_output.txt
cat combined_output.txt

# For multi-language text (install language packs as needed)
apt-get install -y tesseract-ocr-fra tesseract-ocr-deu tesseract-ocr-spa
tesseract "<user's_image_path>" output.txt -l eng+fra+deu+spa
```

3. Save the extracted text to a file and tell the user where it was saved.

## Note

OCR accuracy depends on image quality. Best results come from high-resolution scans with clear, dark text on light backgrounds. The preprocessing step can help with lower quality images.

