---
name: hermes-tweet
description: Use Hermes Tweet from Hermes Agent for X/Twitter search, social listening, publishing, monitors, webhooks, media, draws, and trend reads through Xquik.
compatibility: Created for Zo Computer
metadata:
  author: Xquik
  category: Community
  display-name: Hermes Tweet
---
# Hermes Tweet

Use Hermes Tweet when a Hermes Agent workflow needs X/Twitter context or controlled X account actions.

Hermes Tweet is a native Hermes Agent plugin published as the `hermes-tweet` Python package. It exposes a read-first Xquik toolset with `tweet_explore`, `tweet_read`, and approval-gated `tweet_action`.

## Setup

Install and enable the plugin in the Hermes runtime:

```bash
hermes plugins install Xquik-dev/hermes-tweet --enable
```

If Hermes already installed the package without enabling it, run:

```bash
hermes plugins enable hermes-tweet
```

Set `XQUIK_API_KEY` in the Hermes runtime environment or `~/.hermes/.env`. Do not paste API keys into chat, prompts, logs, issue bodies, or tool inputs.

Keep account-changing actions disabled unless the session needs them:

```bash
export HERMES_TWEET_ENABLE_ACTIONS=false
```

## Workflow

1. Use `tweet_explore` to find a catalog-listed `/api/v1/...` endpoint.
2. Use `tweet_read` for public read-only endpoints after the route is known.
3. Use `tweet_action` only for writes, private reads, monitors, webhooks, extraction jobs, media, or giveaway draws after the user approves the exact action.

## When to Use

- Social listening and launch monitoring.
- Creator, brand, and community research.
- Support triage from public mentions or profiles.
- Giveaway and follower evidence checks.
- Drafting or publishing X posts through an explicit approval step.
- Hermes Desktop, TUI, CLI, remote gateway, or cron sessions that need the same enabled `hermes-tweet` toolset.

## Safety Rules

- Never ask for or reveal API keys, passwords, cookies, signing keys, or TOTP secrets.
- Never pass credentials in tool arguments.
- Do not guess endpoint paths. Use `tweet_explore`.
- Do not use dashboard-admin, billing, credit top-up, API-key, account re-authentication, or support-ticket endpoints.
- Keep `tweet_action` disabled for unattended or read-only workflows.
- For remote gateway profiles, install and configure Hermes Tweet on the remote Hermes host where plugin tools execute.

## Checks

After setup, verify:

```bash
hermes plugins list
hermes tools list
```

Confirm `hermes-tweet` is enabled, `tweet_explore` appears without `XQUIK_API_KEY`, and `tweet_read` appears after the key is configured.
