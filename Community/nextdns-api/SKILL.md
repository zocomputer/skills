---
name: nextdns-api
description: Query and manage NextDNS via API - full feature set including logs, analytics, profile management, blocklists, and settings.
compatibility: Created for Zo Computer
metadata:
  author: shadowsdistant.zo.computer
  version: "2.0.0"
---

# NextDNS API Skill

Query NextDNS DNS logs and analytics, manage profiles, blocklists, and settings.

## Setup

1. Get your API key from https://my.nextdns.io/account
2. Add to Zo: **Settings → Advanced → Secrets** as `NEXTDNS_API_KEY`

## Commands

### Profile Management

| Command | Description |
|---------|-------------|
| `profiles` | List all NextDNS profiles |
| `profile-get` | Get full profile configuration |
| `profile-create --name "My Profile"` | Create a new profile |
| `profile-delete --yes` | Delete a profile |

### Settings Management

| Command | Description |
|---------|-------------|
| `settings-get security` | Get security settings |
| `settings-get privacy` | Get privacy settings |
| `settings-get parentalControl` | Get parental control settings |
| `settings-get settings/logs` | Get logging settings |
| `settings-get settings/performance` | Get performance settings |
| `settings-update security --json-file config.json` | Update settings from JSON |
| `settings-update privacy --key blocklists --value [...]` | Update single setting |

### Denylist & Allowlist

| Command | Description |
|---------|-------------|
| `list-get denylist` | Show denylist domains |
| `list-get allowlist` | Show allowlist domains |
| `list-add denylist example.com` | Add domain to denylist |
| `list-add allowlist example.com --inactive` | Add as inactive |
| `list-remove denylist example.com` | Remove from denylist |
| `list-toggle denylist example.com --active true` | Toggle active status |

### Privacy Blocklists & Natives

| Command | Description |
|---------|-------------|
| `blocklists-get blocklists` | Show enabled blocklists |
| `blocklists-get natives` | Show native tracker settings |
| `blocklists-add blocklists nextdns-recommended` | Add blocklist |
| `blocklists-add natives apple` | Enable native tracking protection |
| `blocklists-remove blocklists oisd` | Remove blocklist |

### Logs Querying

| Command | Description |
|---------|-------------|
| `logs` | Get recent DNS logs |
| `logs --status blocked` | Show blocked queries only |
| `logs --domain facebook.com` | Filter by domain |
| `logs --device "iPhone"` | Filter by device |
| `logs --from -1h --to now` | Time range filter |
| `logs --limit 500` | Get 500 results |
| `logs --raw` | Include all query types |
| `logs --cursor XYZ` | Paginate results |

### Logs Streaming & Management

| Command | Description |
|---------|-------------|
| `logs-stream` | Stream logs in real-time |
| `logs-stream --device XYZ` | Stream from specific device |
| `logs-stream --stream-id ABC` | Resume from stream ID |
| `logs-download --output logs.json` | Download logs file |
| `logs-clear --yes` | Clear all logs |

### Analytics

| Command | Description |
|---------|-------------|
| `analytics status` | Query status breakdown |
| `analytics domains` | Top queried domains |
| `analytics domains --root` | Root domains only |
| `analytics reasons` | Block reasons |
| `analytics protocols` | Protocol usage |
| `analytics queryTypes` | Query type distribution |
| `analytics ips` | Top client IPs with geo data |
| `analytics ipVersions` | IPv4 vs IPv6 |
| `analytics dnssec` | DNSSEC validation stats |
| `analytics encryption` | Encrypted vs plaintext |
| `analytics devices` | Per-device stats |
| `analytics destinations --dest-type countries` | Queries by country |
| `analytics destinations --dest-type gafam` | Big Tech queries |

### Analytics Time Series

| Command | Description |
|---------|-------------|
| `analytics status --series` | Status over time |
| `analytics domains --series --interval 1h` | Hourly domain stats |
| `analytics protocols --series --from -7d --interval 1d` | Daily protocol stats |
| `analytics devices --series --alignment clock --timezone America/New_York` | Clock-aligned stats |

## Examples

```bash
# Get blocked queries from last hour
python nextdns.py logs --status blocked --from -1h

# Stream blocked ads in real-time
python nextdns.py logs-stream --status blocked

# Check which blocklists are blocking
python nextdns.py analytics reasons --limit 20

# See top devices
python nextdns.py analytics devices --limit 10

# Add domain to denylist
python nextdns.py list-add denylist tracking-site.com

# Enable a new blocklist
python nextdns.py blocklists-add blocklists oisd

# Get hourly stats for last 24 hours
python nextdns.py analytics status --series --from -1d --interval 1h

# Check DNSSEC validation rates
python nextdns.py analytics dnssec

# Download all logs
python nextdns.py logs-download --output my-logs.json
```

## API Reference

See https://nextdns.github.io/api/ for full API documentation.
