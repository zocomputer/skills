#!/usr/bin/env python3
"""
Postman API Client for Zo
Upload, update, and manage Postman collections
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

POSTMAN_API_BASE = "https://api.getpostman.com"


def get_api_key():
    """Get Postman API key from environment"""
    key = os.environ.get('POSTMAN_API_KEY')
    if not key:
        print("Error: POSTMAN_API_KEY not set", file=sys.stderr)
        print("Get your key from: https://web.postman.co/settings/account/", file=sys.stderr)
        print("Add it to Zo Settings > Advanced > Secrets", file=sys.stderr)
        sys.exit(1)
    return key


def api_request(path, method='GET', data=None):
    """Make API request to Postman"""
    api_key = get_api_key()
    url = f"{POSTMAN_API_BASE}{path}"
    
    headers = {
        'X-Api-Key': api_key,
        'Content-Type': 'application/json'
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode() if data else None,
        headers=headers,
        method=method
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"API Error ({e.code}): {error_body}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return None


def list_workspaces():
    """List available workspaces"""
    result = api_request('/workspaces')
    if result and 'workspaces' in result:
        print("\nAvailable Workspaces:")
        for ws in result['workspaces']:
            print(f"  - {ws['name']} (ID: {ws['id']})")
        return result['workspaces']
    return []


def list_collections():
    """List existing collections"""
    result = api_request('/collections')
    if result and 'collections' in result:
        print("\nExisting Collections:")
        for col in result['collections']:
            print(f"  - {col['name']} (UID: {col['uid']})")
        return result['collections']
    return []


def upload_collection(collection_file, name=None, workspace_id=None):
    """Upload a new collection"""
    # Read collection JSON
    with open(collection_file, 'r') as f:
        collection_data = json.load(f)
    
    # Use provided name or from collection
    collection_name = name or collection_data.get('info', {}).get('name', 'Untitled')
    
    # Build payload
    payload = {
        'collection': collection_data
    }
    
    # Add workspace if specified
    if workspace_id:
        payload['workspace'] = {'id': workspace_id}
    
    print(f"Uploading collection: {collection_name}")
    print(f"File: {collection_file}")
    
    result = api_request('/collections', method='POST', data=payload)
    
    if result and 'collection' in result:
        col = result['collection']
        print(f"\n✅ Collection created successfully!")
        print(f"   Name: {col['name']}")
        print(f"   UID: {col['uid']}")
        print(f"   URL: https://go.postman.co/workspace/{workspace_id or 'default'}/collection/{col['uid']}")
        return col
    else:
        print("\n❌ Failed to create collection")
        return None


def update_collection(collection_uid, collection_file):
    """Update an existing collection"""
    with open(collection_file, 'r') as f:
        collection_data = json.load(f)
    
    payload = {
        'collection': collection_data
    }
    
    print(f"Updating collection: {collection_uid}")
    
    result = api_request(f'/collections/{collection_uid}', method='PUT', data=payload)
    
    if result and 'collection' in result:
        col = result['collection']
        print(f"\n✅ Collection updated successfully!")
        print(f"   Name: {col['name']}")
        print(f"   UID: {col['uid']}")
        return col
    else:
        print("\n❌ Failed to update collection")
        return None


def main():
    parser = argparse.ArgumentParser(description='Postman API Client')
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # List command
    subparsers.add_parser('list', help='List existing collections')
    subparsers.add_parser('workspaces', help='List available workspaces')
    
    # Upload command
    upload_parser = subparsers.add_parser('upload', help='Upload new collection')
    upload_parser.add_argument('--file', '-f', required=True, help='Collection JSON file')
    upload_parser.add_argument('--name', '-n', help='Collection name (overrides file)')
    upload_parser.add_argument('--workspace', '-w', help='Workspace ID')
    
    # Update command
    update_parser = subparsers.add_parser('update', help='Update existing collection')
    update_parser.add_argument('--collection-id', '-c', required=True, help='Collection UID')
    update_parser.add_argument('--file', '-f', required=True, help='Updated JSON file')
    
    args = parser.parse_args()
    
    if args.command == 'list':
        list_collections()
    elif args.command == 'workspaces':
        list_workspaces()
    elif args.command == 'upload':
        upload_collection(args.file, args.name, args.workspace)
    elif args.command == 'update':
        update_collection(args.collection_id, args.file)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
