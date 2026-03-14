#!/bin/bash
# Installs the zo-onboarding skill from the Zo Skills Hub
slug="zo-onboarding"
dest="Skills"
manifest_url="https://raw.githubusercontent.com/zocomputer/skills/main/manifest.json"
mkdir -p "$dest"
tarball_url="$(curl -fsSL "$manifest_url" | jq -r '.tarball_url')"
archive_root="$(curl -fsSL "$manifest_url" | jq -r '.archive_root')"
curl -L "$tarball_url" | tar -xz -C "$dest" --strip-components=1 "$archive_root/$slug"
