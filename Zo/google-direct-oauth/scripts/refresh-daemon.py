#!/usr/bin/env python3
"""
Google OAuth Token Refresh Daemon
Refreshes the access token every 4 hours to keep it warm.

Usage: python refresh-daemon.py [--interval HOURS]
"""

import json
import time
import argparse
import requests
from datetime import datetime, timezone

TOKEN_PATH = "/home/.z/google-oauth/token.json"

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}", flush=True)

def load_token():
    with open(TOKEN_PATH) as f:
        return json.load(f)

def save_token(token_data):
    with open(TOKEN_PATH, "w") as f:
        json.dump(token_data, f, indent=2)

def refresh_token():
    token_data = load_token()
    
    response = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": token_data["client_id"],
        "client_secret": token_data["client_secret"],
        "refresh_token": token_data["refresh_token"],
        "grant_type": "refresh_token",
    })
    
    if response.status_code != 200:
        log(f"ERROR: Failed to refresh token: {response.text}")
        return False
    
    new_data = response.json()
    token_data["access_token"] = new_data["access_token"]
    token_data["expires_in"] = new_data["expires_in"]
    token_data["obtained_at"] = datetime.now(timezone.utc).isoformat()
    
    if "refresh_token" in new_data:
        token_data["refresh_token"] = new_data["refresh_token"]
    
    save_token(token_data)
    log(f"Token refreshed successfully. Expires in {new_data['expires_in']}s")
    return True

def main():
    parser = argparse.ArgumentParser(description="Google OAuth refresh daemon")
    parser.add_argument("--interval", type=int, default=4, help="Refresh interval in hours (default: 4)")
    args = parser.parse_args()
    
    interval_seconds = args.interval * 60 * 60
    
    log("Google OAuth refresh daemon started")
    log(f"Refresh interval: {args.interval} hours")
    
    while True:
        try:
            refresh_token()
        except FileNotFoundError:
            log("WARNING: Token file not found. Waiting for initial auth...")
        except Exception as e:
            log(f"ERROR: {e}")
        
        time.sleep(interval_seconds)

if __name__ == "__main__":
    main()
