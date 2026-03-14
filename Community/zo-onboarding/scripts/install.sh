#!/bin/bash
# Installs the zo-onboarding skill from the Zo Skills Hub (or PR fallback)
slug="zo-onboarding"
dest="Skills"
mkdir -p "$dest"

# Try 1: Install from the official Skills Hub manifest (available after PR merge)
manifest_url="https://raw.githubusercontent.com/zocomputer/skills/main/manifest.json"
tarball_url="$(curl -fsSL "$manifest_url" | jq -r '.tarball_url')"
archive_root="$(curl -fsSL "$manifest_url" | jq -r '.archive_root')"
curl -L "$tarball_url" | tar -xz -C "$dest" --strip-components=2 "$archive_root/Community/$slug" 2>/dev/null

if [ -f "$dest/$slug/SKILL.md" ]; then
  echo "Installed $slug from Skills Hub"
  exit 0
fi

# Try 2: Install from the PR branch (pre-merge fallback)
echo "Not found in manifest, trying PR branch..."
curl -L "https://github.com/Zenlyte/skills/archive/refs/heads/add-zo-onboarding-skill.tar.gz" \
  | tar -xz -C "$dest" --strip-components=2 "skills-add-zo-onboarding-skill/Community/$slug" 2>/dev/null

if [ -f "$dest/$slug/SKILL.md" ]; then
  echo "Installed $slug from PR branch"
  exit 0
fi

echo "Failed to install $slug from both sources"
exit 1
