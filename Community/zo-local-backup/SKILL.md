---
name: zo-local-backup
description: Backup and restore your entire Zo Computer to a single encrypted archive (.enc). Includes workspace files, zo.space routes/assets, agents, rules, personas, services, and secrets. Use when the user wants a simple downloadable backup or wants to restore from one.
compatibility: Created for Zo Computer
metadata:
  author: davidj.zo.computer
---
# Zo Local Backup

Creates a single encrypted `.enc` file containing your entire Zo — workspace files, zo.space routes, agents, rules, personas, services, and secrets. Encrypted with AES-256-CBC (PBKDF2, 600k iterations) via openssl.

## Backup Workflow

1. **Ask the user for a passphrase** (they'll need it to restore).

2. **Export Zo configurations** to a temp staging directory:

   ```bash
   export ZO_CONFIG_DIR=$(mktemp -d /tmp/zo-config-XXXX)
   ```

   Use MCP tools to collect and save each config category. **Collect agents, rules, personas, and services in parallel** since they are independent calls.

   - **Routes**: Read route source files directly from the Zo filesystem instead of calling `get_space_route()` for each route (which is extremely slow for 100+ routes and truncates large files). Use a Python script via `run_bash_command`:
     1. Call `list_space_routes()` to get the list of all routes with their path, route_type, and public status.
     2. Read route source code from `/__substrate/space/routes/pages/*.tsx` and `/__substrate/space/routes/api/*.ts`. Filename conventions:
        - **Pages**: strip leading `/`, replace `/` with `-`, add `.tsx`. Special case: `/` → `_home.tsx`.
          - `/about` → `about.tsx`
          - `/blog/posts/hello` → `blog-posts-hello.tsx`
        - **APIs**: strip leading `/`, replace `/` with `-` (**keep the `api-` prefix**), add `.ts`.
          - `/api/hello` → `api-hello.ts`
          - `/api/users/list` → `api-users-list.ts`
          - `/api/admin/settings` → `api-admin-settings.ts`
        - **Dynamic params**: `:` is kept literally → `/api/posts/:id` → `api-posts-:id.ts`
        - **Wildcards**: `*` is kept literally → `/api/files/*` → `api-files-*.ts`
     3. Write a Python script that reads all files and saves the combined list (with path, route_type, public, code) to `$ZO_CONFIG_DIR/routes.json`. The recommended approach is to glob all files from both directories, then match each against the route list — rather than building filenames manually for each route path.
   - **Assets**: Call `list_space_assets()`. Save to `$ZO_CONFIG_DIR/assets.json`. Download asset files using a **Python script** (not shell curl/mkdir — those commands are unavailable in the Zo zsh environment). Use `urllib.request` with `concurrent.futures.ThreadPoolExecutor` (20 workers) to download from `http://localhost:3099/ASSET_PATH` into `$ZO_CONFIG_DIR/asset-files/`, preserving directory structure.
   - **Agents**: Call `list_agents()`. Save to `$ZO_CONFIG_DIR/agents.json`.
   - **Rules**: Call `list_rules()`. Save to `$ZO_CONFIG_DIR/rules.json`.
   - **Personas**: Call `list_personas()`. Save to `$ZO_CONFIG_DIR/personas.json`.
   - **Services**: Call `list_user_services()`. Save to `$ZO_CONFIG_DIR/services.json`.
   - **Secrets/env vars**: Run `env | grep -v '^_=' | sort` and save output to `$ZO_CONFIG_DIR/env_vars.txt`. Warn the user that secret values are included in the backup and the passphrase protects them.

   > **Important notes:**
   > - Do NOT use `get_space_route()` in a loop — it's too slow for many routes and truncates large ones. Read from the filesystem instead.
   > - Do NOT use shell commands like `curl`, `mkdir`, `dirname` for asset downloads — they are not available in the Zo zsh shell. Use Python (`urllib.request`) instead.
   > - Save MCP tool results (agents, rules, etc.) to JSON files using `run_bash_command` with a Python one-liner or heredoc, since the results come back as structured data.
   > - API route filenames keep the `api-` prefix — do NOT strip it. The full URL path `/api/foo/bar` becomes `api-foo-bar.ts`.

3. **Run the backup script**:

   ```bash
   python3 scripts/backup.py backup \
     --passphrase "USER_PASSPHRASE" \
     --config-dir "$ZO_CONFIG_DIR"
   ```

4. **Clean up** the temp config dir:
   ```bash
   rm -rf $ZO_CONFIG_DIR
   ```

5. **Report** the output file path and size. The file is at `/home/workspace/zo-backup-DATE.enc`. Tell the user they can download it from their workspace.

## Restore Workflow

### Step 1: Setup

1. **Ask the user** for the passphrase and confirm which backup file to restore from.

2. **List backup contents** to show what's available:
   ```bash
   python3 scripts/backup.py restore \
     --passphrase "USER_PASSPHRASE" \
     --archive /home/workspace/zo-backup-XXXX.enc \
     --list-only
   ```

3. **Present the restore menu.** Show the user which categories are available and let them choose what to restore. Present it like this:

   > **Your backup contains:**
   > 1. **Workspace files** — X files (Y new, Z conflicts)
   > 2. **zo.space routes & assets** — N routes, M assets
   > 3. **Agents** — N agents
   > 4. **Rules** — N rules
   > 5. **Personas** — N personas
   > 6. **Services** — N services
   > 7. **Secrets/env vars** — N variables
   >
   > Which would you like to restore? (e.g. "all", "1 and 2", "just agents and rules", "everything except secrets")

4. **Extract the backup** to a temp directory:
   ```bash
   export ZO_RESTORE_DIR=$(mktemp -d /tmp/zo-restore-XXXX)
   python3 scripts/backup.py restore \
     --passphrase "USER_PASSPHRASE" \
     --archive /home/workspace/zo-backup-XXXX.enc \
     --extract-to "$ZO_RESTORE_DIR"
   ```

### Step 2: Restore selected categories

Only restore the categories the user selected. Each category is independent — skip any the user didn't ask for.

#### Category 1: Workspace files

1. **Analyze conflicts**:
   ```bash
   python3 scripts/backup.py restore \
     --passphrase "USER_PASSPHRASE" \
     --archive /home/workspace/zo-backup-XXXX.enc \
     --extract-to "$ZO_RESTORE_DIR" \
     --diff
   ```
   Show the user the conflict summary. Ask which files to overwrite.

2. **Apply files**:
   - Copy new files (no conflicts):
     ```bash
     python3 scripts/backup.py restore \
       --passphrase "PASS" --archive FILE --extract-to "$ZO_RESTORE_DIR" --copy-new
     ```
   - Overwrite specific conflicting files the user approved:
     ```bash
     python3 scripts/backup.py restore \
       --passphrase "PASS" --archive FILE --extract-to "$ZO_RESTORE_DIR" \
       --copy-files '["path/to/file1.txt", "path/to/file2.txt"]'
     ```

#### Category 2: zo.space routes & assets

- **Assets**: Simply copy the asset files directly to `/__substrate/space/assets/` using `cp -r` or Python's shutil. This is much faster than individual `update_space_asset` tool calls:
  ```bash
  cp -r "$ZO_RESTORE_DIR/zo-config/asset-files/"* /__substrate/space/assets/
  ```
  Or in Python:
  ```python
  import shutil
  shutil.copytree(src_dir, dest_dir, dirs_exist_ok=True)
  ```
  This works because assets are served directly from the filesystem — no database update needed.

- **Routes**: read_file `$ZO_RESTORE_DIR/zo-config/routes.json`. For each route, call `update_space_route(path, route_type, code)` to recreate it. Ask user before overwriting existing routes.

#### Category 3: Agents

Read `$ZO_RESTORE_DIR/zo-config/agents.json`. Show the user the list and recreate them with `create_agent()`. If agents with the same name already exist, ask before overwriting.

#### Category 4: Rules

Read `$ZO_RESTORE_DIR/zo-config/rules.json`. Show the user the list and recreate with `create_rule()`. If rules with the same name already exist, ask before overwriting.

#### Category 5: Personas

Read `$ZO_RESTORE_DIR/zo-config/personas.json`. Show the user the list and recreate with `create_persona()`. If personas with the same name already exist, ask before overwriting.

#### Category 6: Services

Read `$ZO_RESTORE_DIR/zo-config/services.json`. Show the user the list and recreate with `register_user_service()`. If services with the same name already exist, ask before overwriting.

#### Category 7: Secrets/env vars

Read `$ZO_RESTORE_DIR/zo-config/env_vars.txt`. Show the user the env var names (but NOT values) that were backed up. Tell the user to manually re-add any secrets they need via [Settings > Advanced](/?t=settings&s=advanced), since secrets cannot be set programmatically.

### Step 3: Clean up

```bash
rm -rf $ZO_RESTORE_DIR
```

Report a summary of what was restored and what was skipped.

## Decryption Without Zo

The backup can be decrypted on any machine with openssl:
```bash
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 600000 \
  -in zo-backup-XXXX.enc -out backup.zip -pass pass:YOUR_PASSPHRASE
unzip backup.zip
```

## Known Issues & Tips

- **API filename convention**: API route files keep the `api-` prefix. `/api/hello` → `api-hello.ts`, NOT `hello.ts`.
- **Special characters in filenames**: Dynamic params (`:id`) and wildcards (`*`) are kept literally in filenames. Don't escape or transform them.
- **Use a glob-first approach for routes**: Glob `/__substrate/space/routes/pages/*.tsx` and `routes/api/*.ts` to find all files, then match against `list_space_routes()` — rather than building filenames manually per route.
- **Parallel collection**: Agents, rules, personas, and services can all be collected in a single parallel batch. Routes and assets require filesystem/HTTP access and are better handled via Python scripts.
- **Assets are just files**: Assets live in `/__substrate/space/assets/` and are served directly. Copy files to restore — no API calls needed.
- **Assets must also go in `dist/`**: The server serves from `/__substrate/space/dist/`. After copying assets, also copy them to `dist/`. Note that `bun run build` clears `dist/`, so copy assets *after* building.
- **Regenerate `.routes.json` after filesystem writes**: Direct file writes can leave the route database stale or corrupted. Regenerate it by globbing all route files and writing complete entries with all fields (path, route_type, public, code).
- **Homepage special case**: The `/` route must exist as `routes/pages/index.tsx` AND be mapped in `.routes.json` with path `"/"`.
- **Verify after restore**: Test routes with `curl http://localhost:3099/PATH` and check `list_space_routes()` to confirm everything appears. Rebuild and restart if needed.

## Script Reference

```
python3 scripts/backup.py --help
python3 scripts/backup.py backup --help
python3 scripts/backup.py restore --help
```
