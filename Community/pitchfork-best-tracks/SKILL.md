---
name: Create Spotify playlist from Pitchfork Best New Tracks
description: Finds the latest songs from Pitchfork's Best New Tracks and creates a Spotify playlist for you
metadata:
  author: ian.zo.computer
  category: Community
  emoji: 🎵
---

## Purpose

Create a Spotify playlist with Pitchfork's most recent Best New Tracks.

**Prerequisites**: Spotify must be connected to Zo Computer.

## Inputs

- **Playlist name**: Name for the Spotify playlist (default: "Pitchfork Best Tracks - [Date]")

## Protocol

### 1. Fetch Pitchfork's Best New Tracks page

Use `tool view_webpage` with URL `https://pitchfork.com/reviews/best/tracks/` to load the page.

### 2. Extract track information

Parse the page content to extract track titles and artist names. Extract the most recent 10 tracks.

### 3. Search Spotify for each track

For each extracted track, search Spotify using the Spotify app integration. Search **sequentially**, not in parallel, to avoid rate limiting.

- If rate limited, wait 2-3 seconds before retrying
- Record the Spotify track ID for each successful match
- Track which songs were not found

### 4. Create the Spotify playlist

Use the Spotify app to create a new playlist with the specified name and description "Latest Best New Tracks from Pitchfork".

### 5. Add tracks to the playlist

Add all successfully found tracks to the newly created playlist using Spotify URIs in the format `spotify:track:[TRACK_ID]`.

### 6. Report results

Provide a summary showing:

- Total tracks added
- List of successfully added tracks (title - artist)
- List of tracks not found on Spotify
- Playlist name

