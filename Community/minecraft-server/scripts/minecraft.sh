#!/usr/bin/env bash
set -euo pipefail

SERVER_DIR="/home/workspace/minecraft-server"
JAR_PATH="$SERVER_DIR/server.jar"
BACKUP_DIR="$SERVER_DIR/backups"
SERVICE_LABEL="minecraft-server"
SERVICE_PORT=25565
LOG_FILE="/dev/shm/${SERVICE_LABEL}.log"
ERR_LOG="/dev/shm/${SERVICE_LABEL}_err.log"

MANIFEST_URL="https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"

get_latest_server_info() {
    curl -fsSL "$MANIFEST_URL" | python3 -c "
import sys, json, urllib.request
d = json.load(sys.stdin)
for v in d['versions']:
    if v['type'] != 'release':
        continue
    meta = json.loads(urllib.request.urlopen(v['url']).read())
    java_ver = meta.get('javaVersion', {}).get('majorVersion', 0)
    print(meta['downloads']['server']['url'])
    print(v['id'])
    print(java_ver)
    break
"
}

cmd_setup() {
    echo "=== Minecraft Server Setup ==="

    # 1. Find latest MC version to determine required Java
    echo "[1/7] Finding latest Minecraft server..."
    local info server_url mc_version required_java
    info=$(get_latest_server_info)
    server_url=$(echo "$info" | sed -n '1p')
    mc_version=$(echo "$info" | sed -n '2p')
    required_java=$(echo "$info" | sed -n '3p')
    echo "    Latest version: $mc_version (requires Java $required_java)"

    # 2. Install required Java via Adoptium
    local current_java=0
    if command -v java &>/dev/null; then
        current_java=$(java -version 2>&1 | grep -oP '(?<=version ")(\d+)' | head -1 || echo "0")
        current_java=${current_java//[^0-9]/}
        : "${current_java:=0}"
    fi
    if [ "$current_java" -lt "$required_java" ]; then
        echo "[2/7] Installing Java $required_java (Adoptium Temurin)..."
        if [ ! -f /usr/share/keyrings/adoptium.gpg ]; then
            curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /usr/share/keyrings/adoptium.gpg 2>/dev/null
            echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb bookworm main" > /etc/apt/sources.list.d/adoptium.list
            apt-get update -qq
        fi
        apt-get install -y -qq "temurin-${required_java}-jre" 2>&1 | tail -1
    else
        echo "[2/7] Java $current_java already installed (>= $required_java): $(java -version 2>&1 | head -1)"
    fi

    # 3. Create server directory
    echo "[3/7] Creating server directory..."
    mkdir -p "$SERVER_DIR" "$BACKUP_DIR"

    # 4. Download server JAR
    echo "[4/7] Downloading Minecraft $mc_version server..."
    curl -fsSL -o "$JAR_PATH" "$server_url"
    echo "    Downloaded to $JAR_PATH"

    # 5. Accept EULA
    echo "[5/7] Accepting EULA..."
    echo "eula=true" > "$SERVER_DIR/eula.txt"

    # 6. Detect available RAM and compute heap sizes
    local total_mb max_heap min_heap view_dist
    total_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
    if [ "$total_mb" -lt 2048 ]; then
        max_heap="512M"; min_heap="256M"; view_dist=6
    elif [ "$total_mb" -lt 4096 ]; then
        max_heap="1G"; min_heap="512M"; view_dist=8
    elif [ "$total_mb" -lt 8192 ]; then
        max_heap="2G"; min_heap="1G"; view_dist=10
    elif [ "$total_mb" -lt 16384 ]; then
        max_heap="4G"; min_heap="2G"; view_dist=12
    else
        max_heap="8G"; min_heap="4G"; view_dist=12
    fi
    echo "[6/7] Detected ${total_mb}MB RAM → heap: ${min_heap}-${max_heap}, view-distance: ${view_dist}"

    # 7. Generate default server.properties if missing
    if [ ! -f "$SERVER_DIR/server.properties" ]; then
        echo "[7/7] Generating default server.properties..."
        local zo_handle="${ZO_USER:-zo}"
        cat > "$SERVER_DIR/server.properties" << PROPS
server-port=25565
motd=\\u00A7b\\u00A7lZo Minecraft Server \\u00A7r\\u00A77| ${zo_handle}
difficulty=normal
gamemode=survival
max-players=20
view-distance=${view_dist}
simulation-distance=$((view_dist > 8 ? 10 : view_dist - 2))
white-list=false
pvp=true
enable-command-block=true
spawn-protection=0
online-mode=false
PROPS
    else
        echo "[7/7] server.properties already exists, keeping existing config."
    fi

    # Create the startup wrapper script
    cat > "$SERVER_DIR/start.sh" << STARTUP
#!/usr/bin/env bash
cd /home/workspace/minecraft-server

# Sync server-port in server.properties to match the PORT env var from Zo's service manager.
# The --port CLI flag is unreliable in newer MC versions, so we set it in properties directly.
MC_PORT="\${PORT:-25565}"
if [ -f server.properties ]; then
    if grep -q "^server-port=" server.properties; then
        sed -i "s/^server-port=.*/server-port=\${MC_PORT}/" server.properties
    else
        echo "server-port=\${MC_PORT}" >> server.properties
    fi
fi

exec java -Xmx${max_heap} -Xms${min_heap} \\
  -XX:+UseG1GC \\
  -XX:+ParallelRefProcEnabled \\
  -XX:MaxGCPauseMillis=200 \\
  -XX:+UnlockExperimentalVMOptions \\
  -XX:+DisableExplicitGC \\
  -XX:G1NewSizePercent=30 \\
  -XX:G1MaxNewSizePercent=40 \\
  -XX:G1HeapRegionSize=8M \\
  -XX:G1ReservePercent=20 \\
  -XX:G1MixedGCCountTarget=4 \\
  -XX:InitiatingHeapOccupancyPercent=15 \\
  -XX:G1MixedGCLiveThresholdPercent=90 \\
  -XX:SurvivorRatio=32 \\
  -XX:MaxTenuringThreshold=1 \\
  -jar server.jar --nogui
STARTUP
    chmod +x "$SERVER_DIR/start.sh"

    echo ""
    echo "=== Setup Complete ==="
    echo "Server directory: $SERVER_DIR"
    echo "Server JAR: $JAR_PATH"
    echo "Minecraft version: $mc_version"
    echo ""
    echo "=== SERVICE REGISTRATION REQUIRED ==="
    echo "Register as a Zo user service with these parameters:"
    echo "  label: minecraft-server"
    echo "  protocol: tcp"
    echo "  local_port: 25565"
    echo "  entrypoint: bash /home/workspace/minecraft-server/start.sh"
    echo "  workdir: /home/workspace/minecraft-server"
    echo ""
    echo "Use the register_user_service tool to create the service."
    echo "The server will auto-start, persist across reboots, and restart on crash."
}

cmd_status() {
    echo "=== Minecraft Server Status ==="
    if pgrep -f "server.jar" > /dev/null 2>&1; then
        echo "Status: RUNNING"
        echo "PID: $(pgrep -f 'server.jar')"
        echo "Uptime: $(ps -o etime= -p "$(pgrep -f 'server.jar' | head -1)" 2>/dev/null || echo 'unknown')"
    else
        echo "Status: STOPPED"
    fi
    echo ""
    if [ -f "$SERVER_DIR/server.properties" ]; then
        local motd difficulty gamemode max_players
        motd=$(grep "^motd=" "$SERVER_DIR/server.properties" | cut -d= -f2-)
        difficulty=$(grep "^difficulty=" "$SERVER_DIR/server.properties" | cut -d= -f2-)
        gamemode=$(grep "^gamemode=" "$SERVER_DIR/server.properties" | cut -d= -f2-)
        max_players=$(grep "^max-players=" "$SERVER_DIR/server.properties" | cut -d= -f2-)
        echo "MOTD: $motd"
        echo "Difficulty: $difficulty"
        echo "Gamemode: $gamemode"
        echo "Max Players: $max_players"
    fi
}

cmd_logs() {
    echo "=== Recent Server Logs ==="
    if [ -f "$LOG_FILE" ]; then
        tail -50 "$LOG_FILE"
    else
        echo "No log file found at $LOG_FILE"
    fi
    if [ -f "$ERR_LOG" ] && [ -s "$ERR_LOG" ]; then
        echo ""
        echo "=== Recent Errors ==="
        tail -20 "$ERR_LOG"
    fi
}

cmd_properties() {
    if [ -f "$SERVER_DIR/server.properties" ]; then
        cat "$SERVER_DIR/server.properties"
    else
        echo "server.properties not found. Run setup first."
        exit 1
    fi
}

cmd_set() {
    local key="$1" value="$2"
    if [ -z "$key" ] || [ -z "$value" ]; then
        echo "Usage: minecraft.sh set <key> <value>"
        exit 1
    fi
    local props="$SERVER_DIR/server.properties"
    if grep -q "^${key}=" "$props" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$props"
        echo "Updated: ${key}=${value}"
    else
        echo "${key}=${value}" >> "$props"
        echo "Added: ${key}=${value}"
    fi
    echo "Restart the server to apply changes."
}

cmd_whitelist() {
    local player="$1"
    if [ -z "$player" ]; then
        echo "Usage: minecraft.sh whitelist <player>"
        exit 1
    fi
    local wl="$SERVER_DIR/whitelist.json"
    if [ ! -f "$wl" ]; then
        echo "[]" > "$wl"
    fi
    python3 -c "
import json, uuid, hashlib
def offline_uuid(name):
    return str(uuid.UUID(bytes=hashlib.md5(('OfflinePlayer:' + name).encode()).digest()[:16], version=3))
with open('$wl') as f:
    wl = json.load(f)
if not any(e['name'] == '$player' for e in wl):
    wl.append({'uuid': offline_uuid('$player'), 'name': '$player'})
    with open('$wl', 'w') as f:
        json.dump(wl, f, indent=2)
    print('Added $player to whitelist.')
else:
    print('$player is already whitelisted.')
"
}

cmd_op() {
    local player="$1"
    if [ -z "$player" ]; then
        echo "Usage: minecraft.sh op <player>"
        exit 1
    fi
    local ops="$SERVER_DIR/ops.json"
    if [ ! -f "$ops" ]; then
        echo "[]" > "$ops"
    fi
    python3 -c "
import json, uuid, hashlib
def offline_uuid(name):
    return str(uuid.UUID(bytes=hashlib.md5(('OfflinePlayer:' + name).encode()).digest()[:16], version=3))
with open('$ops') as f:
    ol = json.load(f)
if not any(e['name'] == '$player' for e in ol):
    ol.append({'uuid': offline_uuid('$player'), 'name': '$player', 'level': 4, 'bypassesPlayerLimit': True})
    with open('$ops', 'w') as f:
        json.dump(ol, f, indent=2)
    print('Added $player as operator (level 4).')
else:
    print('$player is already an operator.')
"
}

cmd_restart() {
    echo "Restarting Minecraft server..."
    local pid
    pid=$(pgrep -f "server.jar" 2>/dev/null || true)
    if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null || true
        echo "Killed server process (PID $pid). Supervisor will auto-restart it."
        sleep 2
        local new_pid
        new_pid=$(pgrep -f "server.jar" 2>/dev/null || true)
        if [ -n "$new_pid" ]; then
            echo "Server restarted (new PID $new_pid)."
        else
            echo "Waiting for supervisor to restart..."
            sleep 5
            new_pid=$(pgrep -f "server.jar" 2>/dev/null || true)
            if [ -n "$new_pid" ]; then
                echo "Server restarted (new PID $new_pid)."
            else
                echo "Server not yet restarted. Check logs with: minecraft.sh logs"
            fi
        fi
    else
        echo "Server is not running. Check service status."
    fi
}

cmd_backup() {
    if [ ! -d "$SERVER_DIR/world" ]; then
        echo "No world directory found. Has the server been started?"
        exit 1
    fi
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="$BACKUP_DIR/world-${timestamp}.tar.gz"
    echo "Creating backup..."
    tar -czf "$backup_file" -C "$SERVER_DIR" world
    local size
    size=$(du -h "$backup_file" | cut -f1)
    echo "Backup created: $backup_file ($size)"
}

cmd_update() {
    echo "Finding latest Minecraft server..."
    local info server_url mc_version required_java
    info=$(get_latest_server_info)
    server_url=$(echo "$info" | sed -n '1p')
    mc_version=$(echo "$info" | sed -n '2p')
    required_java=$(echo "$info" | sed -n '3p')
    echo "Version: $mc_version (requires Java $required_java)"

    local current_java
    current_java=$(java -version 2>&1 | head -1 | grep -oP '\d+' | head -1 || echo "0")
    if [ "$current_java" -lt "$required_java" ]; then
        echo "Upgrading Java to $required_java..."
        apt-get install -y -qq "temurin-${required_java}-jre" 2>&1 | tail -1
    fi

    curl -fsSL -o "$JAR_PATH" "$server_url"
    echo "Updated server.jar to $mc_version"
    echo "Restart the server to use the new version."
}

# Main dispatch
case "${1:-help}" in
    setup)      cmd_setup ;;
    status)     cmd_status ;;
    logs)       cmd_logs ;;
    properties) cmd_properties ;;
    set)        cmd_set "${2:-}" "${3:-}" ;;
    whitelist)  cmd_whitelist "${2:-}" ;;
    op)         cmd_op "${2:-}" ;;
    restart)    cmd_restart ;;
    backup)     cmd_backup ;;
    update)     cmd_update ;;
    help|*)
        echo "Minecraft Server Management"
        echo ""
        echo "Usage: minecraft.sh <command> [args]"
        echo ""
        echo "Commands:"
        echo "  setup              Full first-time setup"
        echo "  status             Check server status"
        echo "  logs               Show recent logs"
        echo "  properties         Show server.properties"
        echo "  set <key> <value>  Change a server property"
        echo "  whitelist <player> Add player to whitelist"
        echo "  op <player>        Make player an operator"
        echo "  restart            Restart the server"
        echo "  backup             Backup the world"
        echo "  update             Download latest server JAR"
        echo "  help               Show this help"
        ;;
esac
