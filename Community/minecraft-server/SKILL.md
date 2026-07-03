---
name: minecraft-server
description: Set up, configure, and manage a Minecraft Java Edition server on Zo Computer. Use when the user wants to run a Minecraft server, change server settings, manage whitelists/ops, or check server status.
compatibility: Created for Zo Computer
metadata:
  author: hatsunemiku.zo.computer
---
# Minecraft Server Skill

Sets up and manages a Minecraft Java Edition server as a persistent Zo user service.

## Setup

Setup is a two-step process:

### Step 1: Run the setup script

```bash
bash /home/workspace/Skills/minecraft-server/scripts/minecraft.sh setup
```

This will:

1. Detect the required Java version for the latest Minecraft release
2. Install the correct Java via Adoptium (if not already installed or too old)
3. Create `/home/workspace/minecraft-server/` with the latest Minecraft server JAR
4. Accept the EULA
5. Generate a default `server.properties`
6. Create the `file start.sh` wrapper with JVM flags tuned to the system's available RAM

### Step 2: Register as a Zo user service

After the setup script completes, you MUST register a persistent Zo user service using the `register_user_service` tool:

```markdown
register_user_service(
  label="minecraft-server",
  protocol="tcp",
  local_port=25565,
  entrypoint="bash /home/workspace/minecraft-server/start.sh",
  workdir="/home/workspace/minecraft-server"
)
```

This creates a **TCP service** (not a proxy link) that:

- Persists across Zo reboots
- Auto-restarts on crash via supervisor
- Has a stable `tcp_addr` (e.g. `ts4.zocomputer.io:10578`) for players to connect to

After registration, share the `tcp_addr` from the service response with players — that's the Minecraft server address.

### If the service already exists

Check with `list_user_services`. If a `minecraft-server` service is already registered, skip registration. Use `update_user_service(service_id=...)` to restart it if the entrypoint or config changed.

### Post-setup recommendations

After the server is running, recommend these steps to the user and offer to execute them for the user:

1. **Enable whitelist** for security (especially important with `online-mode=false`):

   ```bash
   bash Skills/minecraft-server/scripts/minecraft.sh set white-list true
   bash Skills/minecraft-server/scripts/minecraft.sh whitelist <their-username>
   bash Skills/minecraft-server/scripts/minecraft.sh restart
   ```

2. **Op themselves** so they have admin commands in-game:

   ```bash
   bash Skills/minecraft-server/scripts/minecraft.sh op <their-username>
   ```

3. **Create an initial backup** once the world generates and they've verified it works.

## Commands

All commands are run via the management script:

```bash
bash /home/workspace/Skills/minecraft-server/scripts/minecraft.sh <command>
```

| Command | Description |
| --- | --- |
| `setup` | Full first-time setup (Java, JAR, EULA, start script) |
| `status` | Check if the server is running and show connection info |
| `logs` | Show recent server logs |
| `properties` | Print current server.properties |
| `set <key> <value>` | Change a server.properties value (e.g. `set difficulty hard`) |
| `whitelist <player>` | Add a player to the whitelist |
| `op <player>` | Give a player operator privileges |
| `restart` | Restart the server (kills process, supervisor auto-restarts) |
| `backup` | Create a backup of the world in minecraft-server/backups/ |
| `update` | Download the latest server JAR and restart |

## Configuration

Edit `/home/workspace/minecraft-server/server.properties` directly or use the `set` command.

Common settings:

- `difficulty` — peaceful, easy, normal, hard
- `gamemode` — survival, creative, adventure, spectator
- `max-players` — default 20
- `motd` — server message shown in the server list
- `white-list` — true/false to enforce whitelist
- `pvp` — true/false
- `view-distance` — chunk render distance (default 10)
- `level-seed` — world seed

After changing properties, run `restart` to apply.

## File Locations

- Server directory: `/home/workspace/minecraft-server/`
- Server JAR: `/home/workspace/minecraft-server/server.jar`
- World data: `/home/workspace/minecraft-server/world/`
- Properties: `/home/workspace/minecraft-server/server.properties`
- Backups: `/home/workspace/minecraft-server/backups/`
- Start script: `file minecraft-server/start.sh`
- Logs: `/dev/shm/minecraft-server.log` and `/dev/shm/minecraft-server_err.log`

## Caveats

### online-mode is set to false

The server defaults to `online-mode=false` to avoid issues with the server IP being blocked from reaching Mojang's session authentication servers (`sessionserver.mojang.com` returns 403). With `online-mode=true`, players might get "Invalid session" errors and cannot connect.

**What this means:**

- The server does NOT verify player identities with Mojang/Microsoft
- Anyone who knows the server address can join with any username
- Player UUIDs are offline-mode UUIDs (different from their Mojang UUIDs)

**Mitigation:** Always enable the whitelist (`white-list=true`) and only add trusted players. This is the primary access control when online-mode is off.

**Offline UUIDs:** Because `online-mode=false`, the server uses offline UUIDs instead of Mojang UUIDs. Entries in `file whitelist.json` and `file ops.json` **must** include the correct offline UUID or the server will reject players even if their name is listed. The offline UUID is computed as `UUID v3(MD5("OfflinePlayer:" + username))`. The `whitelist` and `op` commands in the management script generate these automatically — but if you ever edit these JSON files by hand, you must include the UUID. Example entry:

```json
{"uuid": "87c5c7bc-81a1-30a4-81c3-7d1746521b14", "name": "PlayerName"}
```

### Java version auto-detection

The setup and update commands auto-detect the Java version required by the latest Minecraft release and install it via Adoptium. Minecraft's Java requirements have been increasing rapidly (Java 21 → 25 in recent versions). If Adoptium hasn't packaged a new major Java version yet, the setup will fail — in that case, pin to the latest supported MC version manually.

### Server port

The server binds to the `PORT` environment variable injected by Zo's service manager, not necessarily port 25565 locally. The external-facing address and port are provided by the TCP service's `tcp_addr` — that's what players use.

## Notes

- The server MUST be registered as a Zo user service (TCP protocol) — not a proxy link. This ensures persistence, auto-restart, and a stable address.
- Players connect using the `tcp_addr` from the registered service.
- Heap size is auto-detected based on available RAM:
  - &lt;2GB RAM: 512MB max heap (tight — small player count, reduced view distance)
  - 2-4GB: 1GB max heap
  - 4-8GB: 2GB max heap
  - 8-16GB: 4GB max heap
  - 16GB+: 8GB max heap
  - View distance is also scaled down on low-RAM systems (6 chunks at &lt;2GB vs 12 at 8GB+)
  - The generated `file start.sh` bakes in the heap values at setup time. Re-run `setup` after a hardware change to recalculate, or edit `file start.sh` manually.
- The restart command kills the Java process; the supervisor automatically restarts it.
- **Free plan compatibility:** The skill works on free-tier Zo plans with reduced RAM. The server will run but with lower heap and view distance, which means fewer concurrent players and shorter render range. For a playable experience with 1-3 players, even 512MB-1GB heap is viable. It is recommended to upgrade the plan though otherwise.