---
name: linkedin
description: LinkedIn tool for searching profiles, checking messages, and summarizing your feed using session cookies.
homepage: https://github.com/clawdbot/linkedin-cli
compatibility: see metadata.clawdbot.requires
metadata:
  author: Zo
  category: Connections
  display-name: LinkedIn
---

`lk`: Fast LinkedIn CLI using cookie auth.

## Updating

The `linkedin-api` Python package comes pre-installed on Zo. To update it:

```bash
uv pip install --system --break-system-packages linkedin-api
```

## Authentication

`lk.py` uses cookie-based auth. 

The USER must set their credentials in their Settings > Integrations > Connections page.

If `LINKEDIN_LI_AT` and `LINKEDIN_JSESSIONID` are not set, direct the USER to this page with a relative URL.

## Usage

Use `scripts/lk.py`

- `lk whoami`: Display your current profile details.
- `lk search "query"`: Search for people by keywords.
- `lk profile <public_id>`: Get a detailed summary of a specific profile.
- `lk feed -n 10`: Summarize the top N posts from your timeline.
- `lk messages`: Quick peek at your recent conversations.
- `lk check`: Combined whoami and messages check.
