#!/usr/bin/env python3
"""
Google Direct OAuth Setup Script
Usage: python setup.py <path-to-client-secret.json> <callback-url>
"""

import json
import sys
import os
import shutil

OAUTH_DIR = "/home/.z/google-oauth"

def main():
    if len(sys.argv) < 3:
        print("Usage: python setup.py <client-secret.json> <callback-url>")
        print("Example: python setup.py ~/client_secret.json https://google-oauth-flow-myhandle.zocomputer.io/callback")
        sys.exit(1)
    
    client_secret_path = sys.argv[1]
    callback_url = sys.argv[2]
    
    # Create directory
    os.makedirs(OAUTH_DIR, exist_ok=True)
    
    # Copy client secret
    shutil.copy(client_secret_path, f"{OAUTH_DIR}/client_secret.json")
    print(f"✓ Saved client secret to {OAUTH_DIR}/client_secret.json")
    
    # Read client details
    with open(f"{OAUTH_DIR}/client_secret.json") as f:
        data = json.load(f)
    
    # Handle both "web" and "installed" credential types
    if "web" in data:
        client_id = data["web"]["client_id"]
        client_secret = data["web"]["client_secret"]
    elif "installed" in data:
        client_id = data["installed"]["client_id"]
        client_secret = data["installed"]["client_secret"]
    else:
        print("ERROR: Unrecognized credential format")
        sys.exit(1)
    
    print(f"✓ Client ID: {client_id[:20]}...")
    print(f"✓ Callback URL: {callback_url}")
    print()
    print("Next steps:")
    print(f"1. Add this redirect URI in GCP Console: {callback_url}")
    print("2. Start the OAuth callback server")
    print("3. Visit the server URL to authorize")

if __name__ == "__main__":
    main()
