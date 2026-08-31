#!/usr/bin/env python3
"""NextDNS API CLI tool - Full feature set for querying logs, analytics, and managing profiles."""

import os
import argparse
import json
import requests

API_KEY = os.environ.get("NEXTDNS_API_KEY")
BASE_URL = "https://api.nextdns.io"


def get_headers():
    if not API_KEY:
        raise SystemExit("Error: NEXTDNS_API_KEY not found. Add it in Settings > Advanced → Secrets.")
    return {"X-Api-Key": API_KEY, "Accept": "application/json", "Content-Type": "application/json"}


def get_profiles():
    """List all NextDNS profiles."""
    resp = requests.get(f"{BASE_URL}/profiles", headers=get_headers())
    resp.raise_for_status()
    data = resp.json()
    return data.get("data", [])


def get_profile_id(profile_id=None):
    """Get profile ID, using first profile if not specified."""
    if profile_id:
        return profile_id
    profiles = get_profiles()
    if not profiles:
        raise SystemExit("Error: No NextDNS profiles found.")
    return profiles[0]["id"]


def handle_error(e):
    """Handle API errors gracefully."""
    err_msg = "API request failed"
    try:
        err_data = e.response.json()
        errors = err_data.get("errors", [])
        if errors:
            err_msg = errors[0].get("detail", str(errors))
    except:
        err_msg = str(e)
    raise SystemExit(f"Error: {err_msg}")


# ========== PROFILE COMMANDS ==========

def cmd_profiles_list(args):
    """List all profiles."""
    profiles = get_profiles()
    if not profiles:
        print("No profiles found.")
        return

    print(f"\n{'ID':<20} {'Name':<30}")
    print("-" * 55)
    for p in profiles:
        pid = p.get("id", "")
        name = p.get("name", "")
        print(f"{pid:<20} {name:<30}")


def cmd_profile_get(args):
    """Get full profile details."""
    profile_id = args.profile or get_profile_id()
    url = f"{BASE_URL}/profiles/{profile_id}"
    resp = requests.get(url, headers=get_headers())
    resp.raise_for_status()
    data = resp.json()
    print(json.dumps(data.get("data", {}), indent=2))


def cmd_profile_create(args):
    """Create a new profile."""
    body = {"name": args.name}
    if args.json_file:
        with open(args.json_file) as f:
            body = json.load(f)
    
    url = f"{BASE_URL}/profiles"
    resp = requests.post(url, headers=get_headers(), json=body)
    resp.raise_for_status()
    data = resp.json()
    print(f"Profile created with ID: {data.get('data', {}).get('id', 'unknown')}")


def cmd_profile_delete(args):
    """Delete a profile."""
    profile_id = args.profile or get_profile_id()
    if not args.yes:
        confirm = input(f"Delete profile {profile_id}? [y/N]: ")
        if confirm.lower() != 'y':
            print("Cancelled.")
            return
    
    url = f"{BASE_URL}/profiles/{profile_id}"
    resp = requests.delete(url, headers=get_headers())
    resp.raise_for_status()
    print(f"Profile {profile_id} deleted.")


# ========== SETTINGS COMMANDS ==========

def cmd_settings_get(args):
    """Get profile settings."""
    profile_id = get_profile_id(args.profile)
    section = args.section
    url = f"{BASE_URL}/profiles/{profile_id}/{section}"
    resp = requests.get(url, headers=get_headers())
    resp.raise_for_status()
    data = resp.json()
    print(json.dumps(data.get("data", {}), indent=2))


def cmd_settings_update(args):
    """Update profile settings (PATCH)."""
    profile_id = get_profile_id(args.profile)
    section = args.section
    
    if args.json_file:
        with open(args.json_file) as f:
            body = json.load(f)
    elif args.key and args.value:
        body = {args.key: parse_value(args.value)}
    else:
        raise SystemExit("Provide either --json-file or --key and --value")
    
    url = f"{BASE_URL}/profiles/{profile_id}/{section}"
    resp = requests.patch(url, headers=get_headers(), json=body)
    resp.raise_for_status()
    print(f"{section} updated successfully.")


def parse_value(val):
    """Parse value string to appropriate type."""
    if val.lower() == 'true':
        return True
    if val.lower() == 'false':
        return False
    try:
        return int(val)
    except:
        try:
            return float(val)
        except:
            return val


# ========== LIST COMMANDS ==========

def cmd_list_get(args):
    """Get denylist or allowlist."""
    profile_id = get_profile_id(args.profile)
    url = f"{BASE_URL}/profiles/{profile_id}/{args.list_type}"
    resp = requests.get(url, headers=get_headers())
    resp.raise_for_status()
    data = resp.json()
    items = data.get("data", [])
    
    if not items:
        print(f"No items in {args.list_type}.")
        return
    
    print(f"\n{'ID/Domain':<45} {'Active':<10}")
    print("-" * 60)
    for item in items:
        print(f"{item.get('id', ''):<45} {str(item.get('active', False)):<10}")


def cmd_list_add(args):
    """Add item to denylist or allowlist."""
    profile_id = get_profile_id(args.profile)
    body = {"id": args.domain, "active": not args.inactive}
    
    url = f"{BASE_URL}/profiles/{profile_id}/{args.list_type}"
    resp = requests.post(url, headers=get_headers(), json=body)
    resp.raise_for_status()
    print(f"Added {args.domain} to {args.list_type}.")


def cmd_list_remove(args):
    """Remove item from denylist or allowlist."""
    profile_id = get_profile_id(args.profile)
    
    url = f"{BASE_URL}/profiles/{profile_id}/{args.list_type}/{args.domain}"
    resp = requests.delete(url, headers=get_headers())
    resp.raise_for_status()
    print(f"Removed {args.domain} from {args.list_type}.")


def cmd_list_toggle(args):
    """Toggle item active status."""
    profile_id = get_profile_id(args.profile)
    body = {"active": args.active}
    
    url = f"{BASE_URL}/profiles/{profile_id}/{args.list_type}/{args.domain}"
    resp = requests.patch(url, headers=get_headers(), json=body)
    resp.raise_for_status()
    status = "activated" if args.active else "deactivated"
    print(f"{args.domain} {status} in {args.list_type}.")


# ========== BLOCKLISTS/NATIVES ==========

def cmd_blocklists_get(args):
    """Get privacy blocklists or natives."""
    profile_id = get_profile_id(args.profile)
    section = args.section
    url = f"{BASE_URL}/profiles/{profile_id}/privacy/{section}"
    resp = requests.get(url, headers=get_headers())
    resp.raise_for_status()
    data = resp.json()
    items = data.get("data", [])
    
    if not items:
        print(f"No {section} configured.")
        return
    
    print(f"\n{'ID':<35} {'Active':<10}")
    print("-" * 50)
    for item in items:
        print(f"{item.get('id', ''):<35} {str(item.get('active', True)):<10}")


def cmd_blocklists_add(args):
    """Add blocklist or native."""
    profile_id = get_profile_id(args.profile)
    section = args.section
    body = {"id": args.id, "active": not args.inactive}
    
    url = f"{BASE_URL}/profiles/{profile_id}/privacy/{section}"
    resp = requests.post(url, headers=get_headers(), json=body)
    resp.raise_for_status()
    print(f"Added {args.id} to {section}.")


def cmd_blocklists_remove(args):
    """Remove blocklist or native."""
    profile_id = get_profile_id(args.profile)
    section = args.section
    
    url = f"{BASE_URL}/profiles/{profile_id}/privacy/{section}/{args.id}"
    resp = requests.delete(url, headers=get_headers())
    resp.raise_for_status()
    print(f"Removed {args.id} from {section}.")


# ========== LOGS COMMANDS ==========

def cmd_logs(args):
    """Fetch DNS query logs."""
    profile_id = get_profile_id(args.profile)
    params = {"limit": args.limit, "sort": args.sort}

    if args.status:
        params["status"] = args.status
    if args.domain:
        params["search"] = args.domain
    if args.device:
        params["device"] = args.device
    if args.from_time:
        params["from"] = args.from_time
    if args.to_time:
        params["to"] = args.to_time
    if args.raw:
        params["raw"] = "1"
    if args.cursor:
        params["cursor"] = args.cursor

    url = f"{BASE_URL}/profiles/{profile_id}/logs"
    resp = requests.get(url, headers=get_headers(), params=params)
    resp.raise_for_status()
    data = resp.json()

    logs = data.get("data", [])
    if not logs:
        print("No logs found matching your criteria.")
        return

    print(f"\n{'Timestamp':<28} {'Domain':<40} {'Status':<10} {'Device':<20}")
    print("-" * 105)
    for log in logs:
        ts = log.get("timestamp", "")[:26]
        domain = log.get("domain", "")[:38]
        status = log.get("status", "")
        device_name = log.get("device", {}).get("name", "")[:18] if log.get("device") else ""
        print(f"{ts:<28} {domain:<40} {status:<10} {device_name:<20}")

    meta = data.get("meta", {})
    if meta.get("pagination", {}).get("cursor"):
        print(f"\n... more results available (cursor: {meta['pagination']['cursor']})")
    if meta.get("stream", {}).get("id"):
        print(f"Stream ID (for resume): {meta['stream']['id']}")
    print(f"\nTotal shown: {len(logs)}")


def cmd_logs_stream(args):
    """Stream logs in real-time using SSE."""
    profile_id = get_profile_id(args.profile)
    params = {}
    
    if args.device:
        params["device"] = args.device
    if args.status:
        params["status"] = args.status
    if args.domain:
        params["search"] = args.domain
    if args.raw:
        params["raw"] = "1"
    if args.stream_id:
        params["id"] = args.stream_id

    url = f"{BASE_URL}/profiles/{profile_id}/logs/stream"
    
    print("Streaming logs (Ctrl+C to stop)...\n")
    try:
        resp = requests.get(url, headers=get_headers(), params=params, stream=True)
        for line in resp.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith("data: "):
                    data = json.loads(line_str[6:])
                    ts = data.get("timestamp", "")[:19]
                    domain = data.get("domain", "")[:35]
                    status = data.get("status", "")
                    device = data.get("device", {}).get("name", "")[:15] if data.get("device") else ""
                    print(f"{ts} | {domain:<35} | {status:<10} | {device}")
                elif line_str.startswith("id: "):
                    pass
    except KeyboardInterrupt:
        print("\nStream stopped.")


def cmd_logs_download(args):
    """Download logs as a file."""
    profile_id = get_profile_id(args.profile)

    url = f"{BASE_URL}/profiles/{profile_id}/logs/download"
    if args.no_redirect:
        # Return the redirecting URL directly for the caller to follow
        download_url = url
    else:
        # Request JSON response with redirect=0 to get download URL
        params = {"redirect": "0"}
        resp = requests.get(url, headers=get_headers(), params=params)
        resp.raise_for_status()
        data = resp.json()
        download_url = data.get("url")

    print(f"Download URL: {download_url}")

    if args.output:
        print(f"Downloading to {args.output}...")
        resp = requests.get(download_url)
        with open(args.output, 'wb') as f:
            f.write(resp.content)
        print(f"Saved to {args.output}")


def cmd_logs_clear(args):
    """Clear all logs."""
    profile_id = args.profile or get_profile_id()
    if not args.yes:
        confirm = input(f"Clear all logs for profile {profile_id}? [y/N]: ")
        if confirm.lower() != 'y':
            print("Cancelled.")
            return
    
    url = f"{BASE_URL}/profiles/{profile_id}/logs"
    resp = requests.delete(url, headers=get_headers())
    resp.raise_for_status()
    print("Logs cleared.")


# ========== ANALYTICS COMMANDS ==========

def cmd_analytics(args):
    """Fetch analytics data."""
    profile_id = get_profile_id(args.profile)
    endpoint = args.endpoint
    params = {"limit": args.limit}

    if args.status:
        params["status"] = args.status
    if args.from_time:
        params["from"] = args.from_time
    if args.to_time:
        params["to"] = args.to_time
    if args.device:
        params["device"] = args.device

    # Check for time series
    if args.series:
        endpoint = f"{endpoint};series"
        if args.interval:
            params["interval"] = args.interval
        if args.alignment:
            params["alignment"] = args.alignment
        if args.timezone:
            params["timezone"] = args.timezone
        if args.partials:
            params["partials"] = args.partials

    # Special params for certain endpoints
    if endpoint == "domains" and args.root:
        params["root"] = "true"
    if endpoint == "destinations" and args.dest_type:
        params["type"] = args.dest_type

    url = f"{BASE_URL}/profiles/{profile_id}/analytics/{endpoint}"
    resp = requests.get(url, headers=get_headers(), params=params)
    resp.raise_for_status()
    data = resp.json()

    items = data.get("data", [])
    if not items:
        print("No analytics data found.")
        return

    # Handle time series output
    if args.series and data.get("meta", {}).get("series"):
        series_meta = data["meta"]["series"]
        times = series_meta.get("times", [])
        interval = series_meta.get("interval", 0)
        
        print(f"\nTime Series (interval: {interval}s)")
        print(f"{'Name':<25}", end="")
        for t in times[:5]:
            print(f" {t[5:10]}", end="")
        if len(times) > 5:
            print(f" ...({len(times)-5} more)", end="")
        print()
        print("-" * 80)
        
        for item in items:
            name = item.get("name", item.get("domain", item.get("protocol", item.get("status", "Unknown"))))[:23]
            queries = item.get("queries", [])
            print(f"{name:<25}", end="")
            for q in queries[:5]:
                print(f" {q:>6}", end="")
            print()
        return

    # Standard table output
    if endpoint == "status" or endpoint.startswith("status;"):
        print(f"\n{'Status':<15} {'Queries':<15}")
        print("-" * 35)
        for item in items:
            print(f"{item.get('status', ''):<15} {item.get('queries', 0):<15,}")
    elif endpoint == "domains" or endpoint.startswith("domains;"):
        print(f"\n{'Domain':<50} {'Queries':<12} {'Root':<30}")
        print("-" * 95)
        for item in items:
            root = item.get("root", "")
            print(f"{item.get('domain', '')[:48]:<50} {item.get('queries', 0):<12,} {root[:28]:<30}")
    elif endpoint == "devices" or endpoint.startswith("devices;"):
        print(f"\n{'Device Name':<28} {'Model':<25} {'Queries':<12}")
        print("-" * 70)
        for item in items:
            print(f"{item.get('name', '')[:26]:<28} {item.get('model', '')[:23]:<25} {item.get('queries', 0):<12,}")
    elif endpoint == "reasons" or endpoint.startswith("reasons;"):
        print(f"\n{'Reason ID':<45} {'Name':<38} {'Queries':<12}")
        print("-" * 100)
        for item in items:
            print(f"{item.get('id', '')[:43]:<45} {item.get('name', '')[:36]:<38} {item.get('queries', 0):<12,}")
    elif endpoint == "protocols" or endpoint.startswith("protocols;"):
        print(f"\n{'Protocol':<25} {'Queries':<15}")
        print("-" * 45)
        for item in items:
            print(f"{item.get('protocol', ''):<25} {item.get('queries', 0):<15,}")
    elif endpoint == "queryTypes" or endpoint.startswith("queryTypes;"):
        print(f"\n{'Type':<8} {'Name':<15} {'Queries':<15}")
        print("-" * 40)
        for item in items:
            print(f"{str(item.get('type', '')):<8} {item.get('name', ''):<15} {item.get('queries', 0):<15,}")
    elif endpoint == "ips" or endpoint.startswith("ips;"):
        print(f"\n{'IP Address':<45} {'Country':<10} {'ISP':<25} {'Queries':<12}")
        print("-" * 100)
        for item in items:
            geo = item.get("geo", {})
            network = item.get("network", {})
            print(f"{item.get('ip', ''):<45} {geo.get('countryCode', ''):<10} {network.get('isp', '')[:23]:<25} {item.get('queries', 0):<12,}")
    elif endpoint == "ipVersions" or endpoint.startswith("ipVersions;"):
        print(f"\n{'Version':<15} {'Queries':<15}")
        print("-" * 35)
        for item in items:
            print(f"IPv{item.get('version', ''):<14} {item.get('queries', 0):<15,}")
    elif endpoint == "dnssec" or endpoint.startswith("dnssec;"):
        print(f"\n{'Validated':<15} {'Queries':<15}")
        print("-" * 35)
        for item in items:
            status = "Yes" if item.get('validated') else "No"
            print(f"{status:<15} {item.get('queries', 0):<15,}")
    elif endpoint == "encryption" or endpoint.startswith("encryption;"):
        print(f"\n{'Encrypted':<15} {'Queries':<15}")
        print("-" * 35)
        for item in items:
            status = "Yes" if item.get('encrypted') else "No"
            print(f"{status:<15} {item.get('queries', 0):<15,}")
    elif endpoint == "destinations" or endpoint.startswith("destinations;"):
        print(f"\n{'Destination':<25} {'Queries':<15}")
        print("-" * 45)
        for item in items:
            dest = item.get("code") or item.get("company") or "Unknown"
            print(f"{dest:<25} {item.get('queries', 0):<15,}")
    else:
        print(json.dumps(items, indent=2))

    print(f"\nTotal: {len(items)}")


# ========== MAIN ==========

def main():
    parser = argparse.ArgumentParser(description="NextDNS API CLI - Full Feature Set")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # ---- PROFILES ----
    profiles_parser = subparsers.add_parser("profiles", help="List all profiles")
    
    profile_get = subparsers.add_parser("profile-get", help="Get full profile details")
    profile_get.add_argument("--profile", help="Profile ID (default: first profile)")
    
    profile_create = subparsers.add_parser("profile-create", help="Create a new profile")
    profile_create.add_argument("--name", required=True, help="Profile name")
    profile_create.add_argument("--json-file", help="Full profile JSON file")
    
    profile_delete = subparsers.add_parser("profile-delete", help="Delete a profile")
    profile_delete.add_argument("--profile", help="Profile ID (default: first profile)")
    profile_delete.add_argument("--yes", action="store_true", help="Skip confirmation")

    # ---- SETTINGS ----
    settings_get = subparsers.add_parser("settings-get", help="Get profile settings section")
    settings_get.add_argument("section", choices=["security", "privacy", "parentalControl", "settings", "settings/logs", "settings/performance", "settings/blockPage"], help="Settings section")
    settings_get.add_argument("--profile", help="Profile ID (default: first profile)")
    
    settings_update = subparsers.add_parser("settings-update", help="Update profile settings")
    settings_update.add_argument("section", choices=["security", "privacy", "parentalControl", "settings", "settings/logs", "settings/performance", "settings/blockPage"], help="Settings section")
    settings_update.add_argument("--profile", help="Profile ID (default: first profile)")
    settings_update.add_argument("--json-file", help="JSON file with settings")
    settings_update.add_argument("--key", help="Setting key to update")
    settings_update.add_argument("--value", help="New value for the setting")

    # ---- LISTS (DENYLIST/ALLOWLIST) ----
    list_get = subparsers.add_parser("list-get", help="Get denylist or allowlist")
    list_get.add_argument("list_type", choices=["denylist", "allowlist"], help="List type")
    list_get.add_argument("--profile", help="Profile ID (default: first profile)")
    
    list_add = subparsers.add_parser("list-add", help="Add domain to denylist/allowlist")
    list_add.add_argument("list_type", choices=["denylist", "allowlist"], help="List type")
    list_add.add_argument("domain", help="Domain to add")
    list_add.add_argument("--inactive", action="store_true", help="Add as inactive")
    list_add.add_argument("--profile", help="Profile ID (default: first profile)")
    
    list_remove = subparsers.add_parser("list-remove", help="Remove domain from list")
    list_remove.add_argument("list_type", choices=["denylist", "allowlist"], help="List type")
    list_remove.add_argument("domain", help="Domain to remove")
    list_remove.add_argument("--profile", help="Profile ID (default: first profile)")
    
    list_toggle = subparsers.add_parser("list-toggle", help="Toggle domain active status")
    list_toggle.add_argument("list_type", choices=["denylist", "allowlist"], help="List type")
    list_toggle.add_argument("domain", help="Domain to toggle")
    list_toggle.add_argument("--active", type=lambda x: x.lower() == 'true', required=True, help="true or false")
    list_toggle.add_argument("--profile", help="Profile ID (default: first profile)")

    # ---- BLOCKLISTS/NATIVES ----
    blocklists_get = subparsers.add_parser("blocklists-get", help="Get blocklists or natives")
    blocklists_get.add_argument("section", choices=["blocklists", "natives"], help="Section type")
    blocklists_get.add_argument("--profile", help="Profile ID (default: first profile)")
    
    blocklists_add = subparsers.add_parser("blocklists-add", help="Add blocklist or native")
    blocklists_add.add_argument("section", choices=["blocklists", "natives"], help="Section type")
    blocklists_add.add_argument("id", help="Blocklist/Native ID (e.g., 'nextdns-recommended')")
    blocklists_add.add_argument("--inactive", action="store_true", help="Add as inactive")
    blocklists_add.add_argument("--profile", help="Profile ID (default: first profile)")
    
    blocklists_remove = subparsers.add_parser("blocklists-remove", help="Remove blocklist or native")
    blocklists_remove.add_argument("section", choices=["blocklists", "natives"], help="Section type")
    blocklists_remove.add_argument("id", help="Blocklist/Native ID to remove")
    blocklists_remove.add_argument("--profile", help="Profile ID (default: first profile)")

    # ---- LOGS ----
    logs_parser = subparsers.add_parser("logs", help="Get DNS query logs")
    logs_parser.add_argument("--profile", help="Profile ID (default: first profile)")
    logs_parser.add_argument("--status", choices=["default", "blocked", "allowed", "error"], help="Filter by status")
    logs_parser.add_argument("--domain", help="Filter by domain name")
    logs_parser.add_argument("--device", help="Filter by device name")
    logs_parser.add_argument("--from", dest="from_time", help="Start time (e.g., -1h, -1d, -7d)")
    logs_parser.add_argument("--to", dest="to_time", help="End time")
    logs_parser.add_argument("--limit", type=int, default=100, help="Number of results (10-1000)")
    logs_parser.add_argument("--sort", choices=["asc", "desc"], default="desc", help="Sort order")
    logs_parser.add_argument("--raw", action="store_true", help="Show all DNS queries")
    logs_parser.add_argument("--cursor", help="Pagination cursor")

    logs_stream = subparsers.add_parser("logs-stream", help="Stream logs in real-time")
    logs_stream.add_argument("--profile", help="Profile ID (default: first profile)")
    logs_stream.add_argument("--device", help="Filter by device")
    logs_stream.add_argument("--status", choices=["default", "blocked", "allowed"], help="Filter by status")
    logs_stream.add_argument("--domain", help="Filter by domain")
    logs_stream.add_argument("--raw", action="store_true", help="Show all queries")
    logs_stream.add_argument("--stream-id", help="Resume from stream ID")

    logs_download = subparsers.add_parser("logs-download", help="Download logs file")
    logs_download.add_argument("--profile", help="Profile ID (default: first profile)")
    logs_download.add_argument("--output", "-o", help="Output file path")
    logs_download.add_argument("--no-redirect", action="store_true", help="Get URL only, don't auto-redirect")

    logs_clear = subparsers.add_parser("logs-clear", help="Clear all logs")
    logs_clear.add_argument("--profile", help="Profile ID (default: first profile)")
    logs_clear.add_argument("--yes", action="store_true", help="Skip confirmation")

    # ---- ANALYTICS ----
    analytics_parser = subparsers.add_parser("analytics", help="Get analytics")
    analytics_parser.add_argument("endpoint", 
        choices=["status", "domains", "reasons", "protocols", "queryTypes", 
                "ips", "ipVersions", "dnssec", "encryption", "devices", "destinations"],
        help="Analytics endpoint")
    analytics_parser.add_argument("--profile", help="Profile ID (default: first profile)")
    analytics_parser.add_argument("--status", choices=["default", "blocked", "allowed"], help="Filter by status")
    analytics_parser.add_argument("--limit", type=int, default=10, help="Number of results")
    analytics_parser.add_argument("--from", dest="from_time", help="Start time (e.g., -1d, -7d)")
    analytics_parser.add_argument("--to", dest="to_time", help="End time")
    analytics_parser.add_argument("--device", help="Filter by device")
    analytics_parser.add_argument("--root", action="store_true", help="Show root domains only (for domains endpoint)")
    analytics_parser.add_argument("--dest-type", choices=["countries", "gafam"], help="Destination type (for destinations endpoint)")
    # Time series options
    analytics_parser.add_argument("--series", action="store_true", help="Get time series data")
    analytics_parser.add_argument("--interval", help="Interval for time series (e.g., 1h, 1d)")
    analytics_parser.add_argument("--alignment", choices=["start", "end", "clock"], help="Alignment for time series")
    analytics_parser.add_argument("--timezone", help="Timezone for clock alignment (e.g., America/New_York)")
    analytics_parser.add_argument("--partials", choices=["none", "start", "end", "all"], help="Include partial windows")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    try:
        # Profile commands
        if args.command == "profiles":
            cmd_profiles_list(args)
        elif args.command == "profile-get":
            cmd_profile_get(args)
        elif args.command == "profile-create":
            cmd_profile_create(args)
        elif args.command == "profile-delete":
            cmd_profile_delete(args)
        # Settings commands
        elif args.command == "settings-get":
            cmd_settings_get(args)
        elif args.command == "settings-update":
            cmd_settings_update(args)
        # List commands
        elif args.command == "list-get":
            cmd_list_get(args)
        elif args.command == "list-add":
            cmd_list_add(args)
        elif args.command == "list-remove":
            cmd_list_remove(args)
        elif args.command == "list-toggle":
            cmd_list_toggle(args)
        # Blocklists commands
        elif args.command == "blocklists-get":
            cmd_blocklists_get(args)
        elif args.command == "blocklists-add":
            cmd_blocklists_add(args)
        elif args.command == "blocklists-remove":
            cmd_blocklists_remove(args)
        # Logs commands
        elif args.command == "logs":
            cmd_logs(args)
        elif args.command == "logs-stream":
            cmd_logs_stream(args)
        elif args.command == "logs-download":
            cmd_logs_download(args)
        elif args.command == "logs-clear":
            cmd_logs_clear(args)
        # Analytics commands
        elif args.command == "analytics":
            cmd_analytics(args)
            
    except requests.exceptions.HTTPError as e:
        handle_error(e)
    except Exception as e:
        raise SystemExit(f"Error: {e}")


if __name__ == "__main__":
    main()
