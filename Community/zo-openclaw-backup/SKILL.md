---
name: zo-openclaw-backup
description: Backup and restore a local OpenClaw instance running on your Zo Computer. Wraps `openclaw backup` CLI with optional AES-256-CBC encryption. Use when the user wants to back up or restore their OpenClaw state, config, credentials, and workspaces.
compatibility: Created for Zo Computer
metadata:
  author: davidj.zo.computer
---
# Zo OpenClaw Backup

Creates a backup of your local OpenClaw instance using the `openclaw backup` CLI, with optional passphrase encryption (AES-256-CBC, PBKDF2 600k iterations).

## Prerequisites

- OpenClaw must be installed and available on `$PATH`. Run `openclaw --version` to verify.
- If not installed, direct the user to https://docs.openclaw.ai/install

## Backup Workflow

1. **Check OpenClaw is installed**:
   ```bash
   openclaw --version
   ```
   If not found, stop and tell the user to install it first.

2. **Ask the user**:
   - Whether to include workspaces (default: yes)
   - Whether to encrypt with a passphrase (recommended)
   - Output location (default: `/home/workspace/`)

3. **Run the backup**:
   ```bash
   python3 scripts/backup.py backup \
     [--passphrase "PASSPHRASE"] \
     [--no-include-workspace] \
     [--only-config] \
     [--verify] \
     [--output /path/to/output/]
   ```

   The script will:
   - Call `openclaw backup create` with the appropriate flags
   - Verify the archive if `--verify` is passed
   - Optionally encrypt the `.tar.gz` to a `.tar.gz.enc` file
   - Clean up the unencrypted archive after encryption
   - Report the final file path and size

4. **Report** the output file path and size. Tell the user they can download it from their workspace.

## Restore Workflow

1. **Ask the user** for the backup file path and passphrase (if encrypted).

2. **Decrypt** (if encrypted):
   ```bash
   python3 scripts/backup.py restore \
     --archive /path/to/backup.tar.gz.enc \
     --passphrase "PASSPHRASE" \
     --list-only
   ```

3. **Show contents** and let the user confirm they want to restore.

4. **Extract and restore**:
   ```bash
   python3 scripts/backup.py restore \
     --archive /path/to/backup.tar.gz.enc \
     --passphrase "PASSPHRASE" \
     --extract-to /tmp/openclaw-restore-XXXX
   ```

   The script extracts the archive. The user can then use `openclaw` or manually place files back.

5. **Clean up** the temp directory after restore.

## Verify an Existing Backup

```bash
python3 scripts/backup.py verify \
  --archive /path/to/backup.tar.gz \
  [--passphrase "PASSPHRASE"]
```

If encrypted, the script decrypts to a temp file first, then runs `openclaw backup verify`.

## Decryption Without Zo

The encrypted backup can be decrypted on any machine with openssl:
```bash
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 600000 \
  -in openclaw-backup-XXXX.tar.gz.enc -out openclaw-backup.tar.gz \
  -pass pass:YOUR_PASSPHRASE
```

Then extract normally:
```bash
tar xzf openclaw-backup.tar.gz
```

## What Gets Backed Up

Per the OpenClaw docs (https://docs.openclaw.ai/cli/backup):
- **State directory** (`~/.openclaw`) — sessions, memory, plugins, etc.
- **Active config file** — the main OpenClaw configuration
- **OAuth / credentials directory** — tokens and secrets
- **Workspace directories** — discovered from config (unless `--no-include-workspace`)

With `--only-config`, only the active config file is archived.

## Script Reference

```
python3 scripts/backup.py --help
python3 scripts/backup.py backup --help
python3 scripts/backup.py restore --help
python3 scripts/backup.py verify --help
```
