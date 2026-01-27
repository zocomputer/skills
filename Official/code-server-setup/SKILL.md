---
name: code-server-setup
description: Sets up VS Code in your web browser so you can write and edit code from anywhere
metadata:
  author: Zo
  category: Official
  display-name: Set up code-server (VS Code in browser)
  emoji: 💻
---

## How to Use This File

This file will be included in a user request. If it is, and the user has provided the necessary inputs (password for code-server authentication), Zo should interpret this as the current task at hand and use its tools to carry out the task until completion. Zo should not ask for user confirmation to continue if it has all required parameters to execute this function. Zo should effectively treat the inclusion of this file as a user request to "run" this task.

## Purpose

This document codifies the procedure for setting up code-server on Zo Computer, enabling a full VS Code development environment accessible through your web browser. The setup includes installing code-server, configuring it with password authentication, installing essential extensions, and registering the service to run persistently with automatic restarts.

---

# code-server Setup Guide on Zo

This guide will walk you through setting up code-server on your Zo Computer instance, giving you a full VS Code development environment in your browser.

## What You'll Have When Done

- A code-server instance running at `https://code-<your-username>.zocomputer.io`
- Password-protected access to your development environment
- Full VS Code editor in your browser with essential extensions
- Direct access to your `/home/workspace` files
- Integrated terminal with shell access to your Zo Computer
- A persistent service that auto-restarts if it crashes

---

## Prerequisites

Before beginning setup, you must provide:

- **Password**: A strong password for code-server authentication (e.g., a secure passphrase)

**Important**: If you're having Zo set this up for you and haven't provided a password, Zo should ask you for a password before proceeding with the setup.

**Security Warning**: code-server provides full shell access to your Zo Computer through the integrated terminal. Anyone with access to your code-server instance can run any command as root on your machine. Authentication is REQUIRED, not optional.

---

## Setup Instructions

### Step 1: Install code-server

code-server will be automatically installed via the official installation script.

```bash
curl -fsSL https://code-server.dev/install.sh | sh
```

**Verify**: Check that code-server is installed:

```bash
code-server --version
```

**Expected Result**: You should see a version number (e.g., `4.x.x`).

---

### Step 2: Create Configuration Directory

Set up the configuration directory for code-server:

```bash
mkdir -p /root/.config/code-server
```

**Verify**: Check the directory exists:

```bash
ls -la /root/.config/code-server
```

---

### Step 3: Create Configuration File

Create the code-server configuration:

```bash
cat > /root/.config/code-server/config.yaml << 'EOF'
bind-addr: 0.0.0.0:8900
auth: password
cert: false
disable-telemetry: true
disable-update-check: true
user-data-dir: /root/.vscode-data
extensions-dir: /root/.vscode-extensions
disable-workspace-trust: true
disable-getting-started-override: true
app-name: zo.computer
welcome-text: "zo.computer code mode"
EOF
```

**Important**: The `auth: password` setting requires password authentication. The password will be provided via the `$PASSWORD` environment variable when starting the service. According to code-server documentation, the password can only be set via the `$PASSWORD` environment variable or in the config file - it cannot be passed as a command-line argument.

**Verify**: Check the configuration file:

```bash
cat /root/.config/code-server/config.yaml
```

---

### Step 4: Install Essential Extensions

Install commonly used VS Code extensions:

```bash
code-server --install-extension ms-python.python --extensions-dir "/root/.vscode-extensions"
code-server --install-extension dbaeumer.vscode-eslint --extensions-dir "/root/.vscode-extensions"
code-server --install-extension esbenp.prettier-vscode --extensions-dir "/root/.vscode-extensions"
code-server --install-extension redhat.vscode-yaml --extensions-dir "/root/.vscode-extensions"
```

**Optional**: Install Vim extension if desired:

```bash
code-server --install-extension vscodevim.vim --extensions-dir "/root/.vscode-extensions"
```

**Verify**: List installed extensions:

```bash
code-server --list-extensions --extensions-dir "/root/.vscode-extensions"
```

---

### Step 5: Configure VS Code Settings

Create the VS Code settings file with sensible defaults:

```bash
mkdir -p /root/.vscode-data/User
cat > /root/.vscode-data/User/settings.json << 'EOF'
{
  "vsicons.dontShowNewVersionMessage": true,
  "vim.enable": false,
  "workbench.startupEditor": "none",
  "workbench.colorTheme": "Default Light Modern",
  "telemetry.telemetryLevel": "off",
  "security.workspace.trust.enabled": false,
  "security.workspace.trust.startupPrompt": "never",
  "workbench.welcome.enabled": false,
  "workbench.welcomePage.walkthroughs.openOnInstall": false,
  "workbench.tips.enabled": false,
  "update.mode": "none",
  "extensions.autoCheckUpdates": false,
  "extensions.autoUpdate": false,
  "editor.minimap.enabled": false
}
EOF
```

**Verify**: Check the settings file:

```bash
cat /root/.vscode-data/User/settings.json
```

---

### Step 6: Register the Service

Register code-server as a persistent user service:

```bash
# Zo will use tool register_user_service with:
# - label: code-server
# - protocol: http
# - local_port: 8900
# - entrypoint: code-server --config /root/.config/code-server/config.yaml /home/workspace
# - env_vars: {"PASSWORD": "<USER_PROVIDED_PASSWORD>"}
# - workdir: /home/workspace
```

**Important**: Replace `<USER_PROVIDED_PASSWORD>` with the password provided by the user. The authentication mode is set to `password` in the config file, and the actual password is provided via the `PASSWORD` environment variable.

**Verify**: Use `tool list_user_services` to confirm the `code-server` service is registered with an HTTPS URL.

---

### Step 7: Test the Service

Wait a few seconds for the service to start, then test it:

```bash
curl -I https://code-<your-username>.zocomputer.io
```

Replace `<your-username>` with your Zo username.

**Expected Result**: You should get an HTTP 200 response or be redirected to a login page.

**Check Logs**: If something goes wrong, check the logs:

```bash
cat /dev/shm/code-server.log
cat /dev/shm/code-server_err.log
```

---

## Accessing code-server

Once the service is running, simply open your browser and navigate to:

```markdown
https://code-<your-username>.zocomputer.io
```

You will be prompted to enter your password. Use the password you provided during setup.

You should then see a full VS Code interface with your `/home/workspace` directory already open.

---

## What's Running

After completing this setup, you have:

- **code-server**: VS Code backend running on port 8900
- **Public URL**: `https://code-<your-username>.zocomputer.io`
- **Authentication**: Password-based authentication (REQUIRED for security)
- **Workspace**: `/home/workspace/` - all your files are accessible
- **Auto-restart**: Zo's service manager will restart the server if it crashes
- **Persistent**: Service survives across system reboots
- **Extensions**: Python, ESLint, Prettier, YAML support pre-installed

**Protocol Details**:

- HTTP server running on port 8900 internally
- Exposed via HTTPS on port 443 (standard web port)
- WebSocket connections for live editing
- Compatible with all modern web browsers

---

## Using code-server

### Basic Features

- **File Explorer**: Navigate your workspace in the left sidebar
- **Search**: Full-text search across all files (Cmd/Ctrl+Shift+F)
- **Terminal**: Integrated terminal (Ctrl+\` or View → Terminal)
- **Git Integration**: Built-in git support for version control
- **Extensions**: Install additional extensions from the Extensions marketplace
- **Settings Sync**: Customize your editor preferences
- **Multi-file Editing**: Open multiple files in tabs or split view

### Keyboard Shortcuts

All standard VS Code shortcuts work:

- `Cmd/Ctrl+P` - Quick file open
- `Cmd/Ctrl+Shift+P` - Command palette
- `Cmd/Ctrl+B` - Toggle sidebar
- `Cmd/Ctrl+J` - Toggle terminal panel
- `Cmd/Ctrl+Shift+F` - Search across files
- `Cmd/Ctrl+Shift+E` - Focus file explorer

### Installing Additional Extensions

1. Click the Extensions icon in the left sidebar (or press `Cmd/Ctrl+Shift+X`)
2. Search for the extension you want
3. Click **Install**
4. Extensions are saved to `/root/.vscode-extensions` and persist across restarts

---

## Troubleshooting

### Service Not Starting

Check the logs:

```bash
cat /dev/shm/code-server.log
cat /dev/shm/code-server_err.log
```

Common issues:

- code-server not installed: Run `curl -fsSL https://code-server.dev/install.sh | sh`
- Port already in use: Change `8900` to another port in the config and service registration
- Permission issues: Ensure `/home/workspace` exists and is readable

### Can't Connect in Browser

- Verify the URL is correct: `https://code-<your-username>.zocomputer.io`
- Wait 10-15 seconds after service registration for the URL to become active
- Check that the service is running: Ask Zo to "list my user services"
- Try opening the URL in an incognito/private window

### Extensions Not Loading

- Check that extensions are installed: `code-server --list-extensions --extensions-dir "/root/.vscode-extensions"`
- Manually install missing extensions from the Extensions marketplace in the browser
- Check extension logs in the Output panel (View → Output)

### Terminal Not Working

- The integrated terminal should work by default
- If it doesn't load, try refreshing the browser page
- Check that shell is available: `echo $SHELL` should show `/bin/bash` or similar

---

## Managing the Service

### View Service Status

Ask Zo: "List my user services"

### Stop/Delete the Service

Ask Zo: "Delete the code-server service"

### Change Port

1. Edit the `bind-addr` in `/root/.config/code-server/config.yaml`
2. Update the service registration with the new port
3. Restart the service

### Enable Vim Mode

If you prefer Vim keybindings:

1. Edit `/root/.vscode-data/User/settings.json`
2. Change `"vim.enable": false` to `"vim.enable": true`
3. Restart code-server or reload the browser window

---

## Advanced Usage

### Remote File Access

Your workspace at `/home/workspace` is the same as your main Zo workspace:

- Files edited in code-server appear instantly in the Zo UI
- Files created in Zo appear instantly in code-server
- Both interfaces share the same underlying filesystem

---

## Security Notes

**CRITICAL SECURITY INFORMATION:**

- code-server provides full shell access to your Zo Computer through the integrated terminal
- Anyone who gains access to your code-server instance has root access to your entire system
- They can read, modify, or delete any files, install software, access other services, and execute arbitrary commands
- **Password authentication is REQUIRED** - running without authentication is extremely dangerous

**Best Practices:**

- Use a strong, unique password (at least 16 characters with mixed case, numbers, and symbols) if the user likes, Zo can generate a random alphanumeric password on the fly
- Never share your code-server URL or password with anyone you don't trust completely
- If you suspect your password has been compromised, immediately delete the service and recreate it with a new password
- Consider using a password manager to generate and store a secure password
- All traffic is encrypted in transit (HTTPS)
- The server is exposed to the public internet via the Zo URL
- Do not reuse passwords from other services

**Changing Your Password:**

If you need to change your password:

1. Ask Zo to update the service with a new password in the entrypoint
2. Or delete and recreate the service with a new password

### Forgot Password

If you forget your password:

1. Ask Zo: "Delete the code-server service"
2. Set up the service again with a new password using this guide

---

## Comparison to Local VS Code

**Advantages of code-server:**

- Access from any device with a browser
- No local installation required
- Server-side computing power
- Consistent environment across devices
- Easy collaboration by sharing URLs (with caution)

**Limitations:**

- Some extensions may not work (especially those requiring native code)
- No native file system access (everything goes through the browser)
- Performance depends on internet connection
- Some keyboard shortcuts may conflict with browser shortcuts

**Workaround for limitations**: You can also use VS Code's built-in Remote-SSH extension to connect to your Zo Computer from local VS Code.

---

## Alternatives and Related Tools

### VS Code Remote-SSH

Instead of code-server in the browser, you can use local VS Code with Remote-SSH:

1. Install VS Code locally
2. Install the "Remote - SSH" extension
3. Connect to your Zo Computer via SSH
4. Full native VS Code experience with remote files

### Other Code Editors on Zo

- **Vim/Neovim**: Already available in the terminal
- **Emacs**: Install with `apt install emacs-nox`
- **Nano**: Already available (simple terminal editor)
- **JupyterLab**: Set up a similar service for notebook-based development

---

## Summary

You now have a fully functional code-server instance that provides a complete VS Code development environment in your browser. Access your editor at `https://code-<your-username>.zocomputer.io`, and start coding directly in your workspace!

For questions or issues, refer to the troubleshooting section or consult the Zo Discord community.

