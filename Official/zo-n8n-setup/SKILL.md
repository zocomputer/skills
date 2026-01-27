---
name: n8n-setup
description: Sets up n8n workflow automation tool so you can create automated workflows between different apps and services
metadata:
  author: Zo
  category: Official
  display-name: Set up n8n workflow automation
  emoji: 🔗
---

# n8n Setup

> **How to use this file**: Reference this command in a message to Zo (e.g., "run `prompt 'Prompts/n8n-setup.prompt.md'`") to automatically set up n8n as a hosted service on your Zo Computer. Zo will follow the steps below to install and configure n8n with a public URL.

This prompt sets up n8n (workflow automation) as a hosted service on your Zo Computer.

## What it does

1. Installs n8n globally via npm
2. Registers n8n as a managed service with a public URL
3. Configures n8n with appropriate security settings

## Prerequisites

- Node.js and npm (already installed on Zo Computer)

## Steps

### 1. Install n8n

```bash
npm install -g n8n
```

### 2. Choose a port

Pick an available port (e.g., 48341 or any other high port).

### 3. Register as a service

Use `register_user_service` with:

- **label**: `n8n`
- **protocol**: `http`
- **local_port**: your chosen port (e.g., 48341)
- **entrypoint**: `npx n8n`
- **workdir**: `/home/workspace`
- **env_vars**:
  - `N8N_PORT`: your chosen port (e.g., `48341`)
  - `N8N_SECURE_COOKIE`: `false` (since we're behind a proxy)
  - `N8N_HOST`: `n8n-{username}.zocomputer.io` (replace with your actual URL)
  - `GENERIC_TIMEZONE`: `America/New_York` (or your preferred timezone)
  - `N8N_PROXY_HOPS`: `1` (for proper IP handling behind the proxy)
  - `WEBHOOK_URL`: `https://n8n-{username}.zocomputer.io/` (replace with your actual URL)
  - `N8N_RUNNERS_ENABLED`: `true` (enables the runners feature)

### 4. Access your instance

Once registered, you'll get a public URL like:

```
https://n8n-{username}.zocomputer.io
```

## Configuration

The service will automatically:

- Store workflows and credentials in `/root/.n8n` (created automatically by n8n)
- Run with your Zo Computer user context
- Restart automatically if it crashes
- Provide a public HTTPS endpoint

## Notes

- First time you access n8n, you'll need to create an owner account
- Workflows and credentials persist in your workspace
- You can update environment variables using `update_user_service`
- Check logs at `/dev/shm/n8n.log` and `/dev/shm/n8n_err.log`

