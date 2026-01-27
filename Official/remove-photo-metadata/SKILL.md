---
name: Remove Photo Metadata
description: Strip all metadata from images for privacy
metadata:
  author: Zo
  category: Official
  emoji: 🔒
---

# Remove Photo Metadata

## Purpose

Remove all metadata (Location, EXIF, GPS, camera info, etc.) from photos to protect your privacy before sharing them.

## Input

- Path to the photo file(s) you want to clean

## Steps

1. Install exiftool:

```bash
apt-get update && apt-get install -y exiftool
```

2. Remove all metadata from the photo(s):

```bash
# For a single photo
exiftool -all= "<user's_photo_path>"

# For multiple photos in a directory
exiftool -all= -r "<user's_directory_path>"

# To overwrite originals without creating backups (use with caution)
exiftool -all= -overwrite_original "<user's_photo_path>"
```

3. Tell the user that all metadata has been removed. Note that by default, exiftool creates backup files with "\_original" suffix.

## Note

This removes ALL metadata including camera settings, timestamps, GPS coordinates, and any other embedded information from the photos.

