"""
Google OAuth helper - auto-refreshes tokens as needed.

Usage:
    from google_auth import get_credentials, get_calendar_service, get_gmail_service
    
    # Get calendar events
    service = get_calendar_service()
    events = service.events().list(calendarId='primary').execute()
    
    # Get Gmail messages
    gmail = get_gmail_service()
    messages = gmail.users().messages().list(userId='me').execute()
"""

import json
import os
import requests
from datetime import datetime, timezone

TOKEN_PATH = "/home/.z/google-oauth/token.json"

def load_token():
    with open(TOKEN_PATH) as f:
        return json.load(f)

def save_token(token_data):
    with open(TOKEN_PATH, "w") as f:
        json.dump(token_data, f, indent=2)

def refresh_if_needed(token_data):
    """Refresh the access token if it's expired or about to expire."""
    obtained_at = token_data.get("obtained_at", "")
    expires_in = token_data.get("expires_in", 3600)
    
    if obtained_at:
        try:
            obtained_time = datetime.fromisoformat(obtained_at.replace("Z", "+00:00"))
            elapsed = (datetime.now(timezone.utc) - obtained_time).total_seconds()
            if elapsed < expires_in - 300:  # 5 min buffer
                return token_data
        except:
            pass
    
    # Need to refresh
    response = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": token_data["client_id"],
        "client_secret": token_data["client_secret"],
        "refresh_token": token_data["refresh_token"],
        "grant_type": "refresh_token",
    })
    
    if response.status_code != 200:
        raise Exception(f"Failed to refresh token: {response.text}")
    
    new_data = response.json()
    token_data["access_token"] = new_data["access_token"]
    token_data["expires_in"] = new_data["expires_in"]
    token_data["obtained_at"] = datetime.now(timezone.utc).isoformat()
    
    if "refresh_token" in new_data:
        token_data["refresh_token"] = new_data["refresh_token"]
    
    save_token(token_data)
    return token_data

def get_credentials():
    """Get Google OAuth credentials, refreshing if needed."""
    from google.oauth2.credentials import Credentials
    
    token_data = load_token()
    token_data = refresh_if_needed(token_data)
    
    return Credentials(
        token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=token_data["client_id"],
        client_secret=token_data["client_secret"],
    )

def get_calendar_service():
    """Get an authenticated Google Calendar service."""
    from googleapiclient.discovery import build
    return build("calendar", "v3", credentials=get_credentials())

def get_gmail_service():
    """Get an authenticated Gmail service."""
    from googleapiclient.discovery import build
    return build("gmail", "v1", credentials=get_credentials())
