---
name: google-direct-oauth
description: |
  Direct Google OAuth integration without third-party apps. Connects your Google Calendar and Gmail 
  using your own OAuth credentials in Google Cloud Console. Includes a refresh daemon that keeps 
  tokens warm. Use this when you want direct API access to Google services without relying on 
  external OAuth providers.
  
compatibility: Requires a Google Cloud Console account (free). Works on any Zo Computer.
metadata:
  author: Zo
  category: Official
  emoji: 🅖
---

# Google Direct OAuth

Access Google Calendar and Gmail directly using your own OAuth credentials — no third-party apps involved.

## What This Does

- Creates your own OAuth client in Google Cloud Console
- Stores credentials locally on your Zo Computer (`/home/.z/google-oauth/`)
- Runs a background daemon that refreshes tokens every 4 hours
- Provides Python helpers for Zo to access your Calendar and Gmail

## Setup Instructions

### Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate)
2. Name it anything (e.g., "My Zo App")
3. Click **Create**

### Step 2: Enable the APIs

1. Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
2. Search for and enable (required for Gmail/Calendar/Drive/Docs/Sheets/Contacts):
   - **Google Calendar API**
   - **Gmail API**
   - **Google Drive API**
   - **People API** (Contacts)
   - **Google Docs API**
   - **Google Sheets API**
3. Optional (only if you plan to use these features):
   - **Google Tasks API**
   - **Google Chat API** (Workspace only)
   - **Google Classroom API** (Education/Workspace)
   - **Cloud Identity API** (Groups, Workspace)
   - **Google Keep API** (Workspace; requires service account + delegation)

### Step 3: Configure OAuth Consent Screen

1. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Choose **External** (unless you have Google Workspace)
3. Fill in:
   - **App name**: anything (e.g., "Zo Google Access")
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue** through scopes
5. **Test users**: Add your Gmail address
6. Save and continue

### Step 4: Create OAuth Credentials

1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: anything
5. **Authorized redirect URIs**: Add your Zo callback URL (Zo will tell you this)
6. Click **Create**
7. **Download the JSON file** (you'll upload this to Zo)

### Step 5: Switch to Production Mode (Important!)

1. Go back to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Click **Publish App**
3. This makes your refresh tokens long-lived (otherwise they expire in 7 days)

### Step 6: Run the Skill

Tell Zo:
> "Set up Google Direct OAuth with this credentials file" 

And upload/attach the JSON file you downloaded.

Zo will:
1. Store your credentials
2. Spin up a temporary OAuth callback site
3. Give you a link to authorize
4. Store the tokens and start the refresh daemon

## After Setup

Once connected, Zo can access your Google Calendar and Gmail directly. Examples:

- "What's on my calendar today?" (uses direct Google Calendar API)
- "Read my recent emails" (uses direct Gmail API)

These credentials are stored in `/home/.z/google-oauth/` and can be reused by other skills
like `gog` by pointing `gog auth credentials` at `client_secret.json`.

## Files

| Path | Purpose |
|------|---------|
| `/home/.z/google-oauth/client_secret.json` | Your OAuth client credentials |
| `/home/.z/google-oauth/token.json` | Access + refresh tokens |
| `/home/.z/google-oauth/google_auth.py` | Python helper for Zo |
| `/home/.z/google-oauth/refresh-daemon.py` | Background token refresher |

## Services

The skill registers a background service `google-oauth-refresh` that keeps tokens fresh every 4 hours.

## Revoking Access

To disconnect:
1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find your app and click **Remove Access**
3. Delete `/home/.z/google-oauth/` on your Zo
