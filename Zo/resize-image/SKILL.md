---
name: Resize Images
description: Resize images to specific dimensions or percentages
metadata:
  author: Zo
  emoji: 🖼️
---

# Resize Images

## Purpose

Resize images to specific dimensions, percentages, or file sizes using ImageMagick.

## Input

- Path to the image file(s) you want to resize
- Target dimensions or percentage

## Steps

1. Install ImageMagick:

```bash
apt-get update && apt-get install -y imagemagick
```

2. Resize the image based on user's requirements:

```bash
# Resize to specific width (height auto-calculated to maintain aspect ratio)
convert "<user's_image_path>" -resize 800x "<output_image_path>"

# Resize to specific height (width auto-calculated to maintain aspect ratio)
convert "<user's_image_path>" -resize x600 "<output_image_path>"

# Resize to exact dimensions (may distort image)
convert "<user's_image_path>" -resize 800x600! "<output_image_path>"

# Resize to fit within dimensions (maintains aspect ratio)
convert "<user's_image_path>" -resize 800x600 "<output_image_path>"

# Resize by percentage
convert "<user's_image_path>" -resize 50% "<output_image_path>"

# Batch resize all images in a directory
for img in *.jpg; do convert "$img" -resize 1920x1080 "resized_$img"; done
```

3. Tell the user where the resized image(s) were saved.

## Note

The default resize maintains aspect ratio. Use the '!' flag to force exact dimensions if needed.

