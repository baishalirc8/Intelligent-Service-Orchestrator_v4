#!/bin/bash
# =============================================================================
#  HOLOCRON AI — macOS Probe Agent v1.0.0
#  Collects system telemetry, buffers offline, executes remediation tasks.
#  Installs as a LaunchDaemon (system-wide, requires sudo).
#
#  Usage:
#    sudo bash holocron-probe-macos.sh install --token hcn_xxx --api https://...
#    bash holocron-probe-macos.sh start   --token hcn_xxx --api https://...
#    sudo bash holocron-probe-macos.sh uninstall
#    bash holocron-probe-macos.sh status
#    bash holocron-probe-macos.sh test    --token hcn_xxx --api https://...
# =============================================================================

PROBE_VERSION="1.1.0"
HEARTBEAT_INTERVAL=60
SERVICE_LABEL="com.holocron.probe"
INSTALL_PATH="/Library/Application Support/HolocronProbe"
SCRIPT_DEST="/usr/local/bin/holocron-probe-macos"
LOG_FILE="${INSTALL_PATH}/probe.log"
BUFFER_FILE="${INSTALL_PATH}/buffer.jsonl"
TASK_STATE_FILE="${INSTALL_PATH}/task_lastrun.json"
PLIST_PATH="/Library/LaunchDaemons/${SERVICE_LABEL}.plist"
CONFIG_FILE="${INSTALL_PATH}/config.env"

BUFFER_MAX=5000
FLUSH_BATCH=200
COLLECTION_TIMEOUT=30
TASK_RESULTS_DIR="${INSTALL_PATH}/task_results"

HOLOCRON_TOKEN="${HOLOCRON_TOKEN:-}"
HOLOCRON_API="${HOLOCRON_API:-}"
HOLOCRON_HMAC_SECRET="${HOLOCRON_HMAC_SECRET:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; NC='\033[0m'

COMMAND=""
LAST_SYNC_EPOCH=0
RETRY_COUNT=0
MAX_RETRIES=5

# Task last-run timestamps (epoch seconds)
declare -A TASK_LAST_RUN

# =============================================================================
# Logging
# =============================================================================
log() {
    local level="${2:-INFO}"
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    local color="$NC"
    case "$level" in
        SUCCESS) color="$GREEN" ;;
        WARN)    color="$YELLOW" ;;
        ERROR)   color="$RED" ;;
        *)       color="$CYAN" ;;
    esac
    echo -e "${color}[${ts}] $1${NC}"
    mkdir -p "$INSTALL_PATH" 2>/dev/null || true
    echo "[${ts}] [$level] $(echo "$1" | sed 's/\x1b\[[0-9;]*m//g')" >> "$LOG_FILE" 2>/dev/null || true
}

banner() {
    echo -e "${CYAN}"
    echo "  ╔══════════════════════════════════════════════╗"
    echo "  ║        HOLOCRON AI Probe Agent               ║"
    echo "  ║            macOS v${PROBE_VERSION}                    ║"
    echo "  ╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# =============================================================================
# JSON helpers — uses Python 3 (pre-installed on all macOS 10.15+)
# =============================================================================
json_str() {
    python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$1" 2>/dev/null || echo "\"$1\""
}

json_num() {
    local v="$1"
    echo "${v:-0}" | grep -E '^[0-9]+(\.[0-9]+)?$' && return
    echo "0"
}

# =============================================================================
# System info
# =============================================================================
get_hostname() { hostname -f 2>/dev/null || hostname 2>/dev/null || echo "unknown"; }

get_ip() {
    route get default 2>/dev/null | awk '/interface:/{iface=$2} END{print iface}' | \
        xargs -I{} ipconfig getifaddr {} 2>/dev/null || \
    ifconfig 2>/dev/null | awk '/inet / && !/127\.0\.0\.1/{print $2; exit}' || \
    echo "unknown"
}

get_mac_address() {
    local iface
    iface=$(route get default 2>/dev/null | awk '/interface:/{print $2}' | head -1)
    ifconfig "$iface" 2>/dev/null | awk '/ether/{print $2; exit}' || echo "unknown"
}

get_os_info() {
    local name version
    name=$(sw_vers -productName 2>/dev/null || echo "macOS")
    version=$(sw_vers -productVersion 2>/dev/null || echo "")
    echo "${name} ${version}"
}

get_manufacturer() { echo "Apple Inc."; }

get_model() {
    system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Model Name/{print $2; exit}' || \
    sysctl -n hw.model 2>/dev/null || echo "Unknown"
}

get_cpu_info() {
    sysctl -n machdep.cpu.brand_string 2>/dev/null || \
    system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Chip|Processor Name/{print $2; exit}' || \
    echo "Unknown"
}

get_total_memory_gb() {
    local bytes
    bytes=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
    echo "$bytes" | awk '{printf "%.0f", $1/1073741824}'
}

get_system_type() {
    local model
    model=$(sysctl -n hw.model 2>/dev/null | tr '[:upper:]' '[:lower:]')
    if echo "$model" | grep -q "macmini\|macpro\|imac\|macstudio"; then
        echo "physical"
    elif sysctl -n kern.hv_vmm_present 2>/dev/null | grep -q "1"; then
        echo "virtual-machine"
    else
        echo "physical"
    fi
}

# =============================================================================
# Metrics
# =============================================================================
get_cpu_usage() {
    top -l 2 -n 0 2>/dev/null | awk '/CPU usage/{gsub(/%.*$/,""); print int($3)+int($5); exit}' || \
    ps aux 2>/dev/null | awk 'NR>1{sum+=$3} END{printf "%.0f", sum}' || echo "0"
}

get_memory_usage() {
    local page_size total_pages active inactive wired
    page_size=$(sysctl -n hw.pagesize 2>/dev/null || echo "4096")
    total_pages=$(sysctl -n hw.memsize 2>/dev/null | awk -v ps="$page_size" '{print $1/ps}')
    vm_stat 2>/dev/null | awk -v total="$total_pages" '
        /Pages active/    { active=$NF+0 }
        /Pages inactive/  { inactive=$NF+0 }
        /Pages wired/     { wired=$NF+0 }
        END {
            used = active + inactive + wired
            if (total > 0) printf "%.1f", (used/total)*100
            else print "0"
        }'
}

get_disk_usage() {
    df / 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}' || echo "0"
}

# =============================================================================
# Network interfaces
# =============================================================================
get_network_interfaces_json() {
    local result="["
    local first=true
    local ifaces
    ifaces=$(networksetup -listallhardwareports 2>/dev/null | awk '/Hardware Port:/{port=$0} /Device:/{dev=$NF; print dev}')

    for iface in $ifaces; do
        local info
        info=$(ifconfig "$iface" 2>/dev/null)
        [ -z "$info" ] && continue
        echo "$info" | grep -q "status: active\|inet " || continue
        local ip mac iface_type bandwidth
        ip=$(echo "$info" | awk '/inet /{print $2; exit}')
        mac=$(echo "$info" | awk '/ether/{print $2; exit}')
        iface_type="ethernet"
        echo "$iface" | grep -qi "^en0\|wi\|wl\|airport" && iface_type="wireless"

        local rx1 tx1 rx2 tx2
        rx1=$(netstat -I "$iface" -b 2>/dev/null | awk 'NR==2{print $7+0}' || echo "0")
        tx1=$(netstat -I "$iface" -b 2>/dev/null | awk 'NR==2{print $10+0}' || echo "0")
        sleep 1
        rx2=$(netstat -I "$iface" -b 2>/dev/null | awk 'NR==2{print $7+0}' || echo "0")
        tx2=$(netstat -I "$iface" -b 2>/dev/null | awk 'NR==2{print $10+0}' || echo "0")
        local rx_rate=$((rx2 - rx1))
        local tx_rate=$((tx2 - tx1))
        [ "$rx_rate" -lt 0 ] 2>/dev/null && rx_rate=0
        [ "$tx_rate" -lt 0 ] 2>/dev/null && tx_rate=0

        if [ "$first" = true ]; then first=false; else result="${result},"; fi
        result="${result}{\"name\":$(json_str "$iface"),\"type\":$(json_str "$iface_type"),\"status\":\"active\",\"bandwidth\":\"Auto\",\"utilization\":\"0%\",\"vlan\":\"N/A\",\"rxBytesPerSec\":${rx_rate},\"txBytesPerSec\":${tx_rate},\"ipAddress\":$(json_str "${ip:-}"),\"macAddress\":$(json_str "${mac:-}")}"
    done
    echo "${result}]"
}

# =============================================================================
# Security audit — macOS specific
# =============================================================================
get_security_audit_json() {
    # FileVault
    local filevault="Unknown"
    fdesetup status 2>/dev/null | grep -qi "On" && filevault="Enabled" || filevault="Disabled"

    # SIP (System Integrity Protection)
    local sip="Unknown"
    csrutil status 2>/dev/null | grep -qi "enabled" && sip="Enabled" || sip="Disabled"

    # Gatekeeper
    local gatekeeper="Unknown"
    spctl --status 2>/dev/null | grep -qi "enabled\|assessments enabled" && gatekeeper="Enabled" || gatekeeper="Disabled"

    # Application Layer Firewall
    local firewall_state="Unknown"
    local fw_val
    fw_val=$(defaults read /Library/Preferences/com.apple.alf globalstate 2>/dev/null || echo "")
    [ "$fw_val" = "1" ] || [ "$fw_val" = "2" ] && firewall_state="Enabled" || firewall_state="Disabled"

    # Last OS update
    local last_update="Unknown"
    last_update=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate LastSuccessfulDate 2>/dev/null | cut -c1-10 || echo "Unknown")

    # Installed patches count (from softwareupdate history)
    local patch_count="0"
    patch_count=$(softwareupdate --history 2>/dev/null | grep -c "^\-\|Success" || echo "0")

    # Screen lock / screensaver timeout
    local screen_lock="Unknown"
    local lock_val
    lock_val=$(defaults -currentHost read com.apple.screensaver idleTime 2>/dev/null || echo "")
    [ -n "$lock_val" ] && [ "$lock_val" -le 600 ] && screen_lock="Enabled (${lock_val}s)" || screen_lock="Not configured"

    # Auto-updates
    local auto_update="Unknown"
    local au_val
    au_val=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled 2>/dev/null || echo "")
    [ "$au_val" = "1" ] && auto_update="Enabled" || auto_update="Disabled"

    # Local users (non-system)
    local admin_count
    admin_count=$(dscl . -list /Users UniqueID 2>/dev/null | awk '$2>=500{count++} END{print count+0}')

    local uptime_str
    uptime_str=$(uptime 2>/dev/null | awk -F'up' '{print $2}' | awk -F',' '{print $1}' | xargs || echo "Unknown")

    echo "{\"diskEncryption\":$(json_str "FileVault: $filevault"),\"sip\":$(json_str "$sip"),\"gatekeeper\":$(json_str "$gatekeeper"),\"firewall\":$(json_str "Application Firewall: $firewall_state"),\"lastPatched\":$(json_str "$last_update"),\"installedPatches\":${patch_count},\"autoUpdates\":$(json_str "$auto_update"),\"screenLock\":$(json_str "$screen_lock"),\"localAdminCount\":${admin_count},\"uptime\":$(json_str "$uptime_str")}"
}

# =============================================================================
# Software inventory — macOS specific
# Uses a subprocess with timeout to avoid blocking the main loop on slow Macs.
# =============================================================================
get_software_inventory_json() {
    local apps_json="[]"
    local pkg_count=0

    # Run system_profiler in a background subprocess with timeout
    local tmp_file
    tmp_file=$(mktemp /tmp/holocron_apps_XXXXXX.json)

    (
        # /Applications folder — fast, authoritative
        python3 - "$tmp_file" <<'PYEOF'
import os, json, sys, subprocess, plistlib, glob

apps = []
# /Applications
for app_path in glob.glob('/Applications/*.app') + glob.glob('/Applications/*/*.app'):
    try:
        plist_path = os.path.join(app_path, 'Contents/Info.plist')
        if not os.path.exists(plist_path):
            continue
        with open(plist_path, 'rb') as f:
            pl = plistlib.load(f)
        name = pl.get('CFBundleName') or pl.get('CFBundleDisplayName') or os.path.basename(app_path).replace('.app','')
        version = pl.get('CFBundleShortVersionString') or pl.get('CFBundleVersion') or ''
        bundle_id = pl.get('CFBundleIdentifier') or ''
        apps.append({'name': name, 'version': version, 'publisher': bundle_id.split('.')[1] if bundle_id.count('.')>=2 else '', 'installDate': '', 'sizeMB': 0})
    except Exception:
        pass

# Homebrew formulae
try:
    result = subprocess.run(['brew', 'list', '--formula', '--versions'], capture_output=True, text=True, timeout=15)
    for line in result.stdout.strip().splitlines():
        parts = line.split()
        if parts:
            apps.append({'name': parts[0], 'version': parts[1] if len(parts)>1 else '', 'publisher': 'Homebrew', 'installDate': '', 'sizeMB': 0})
except Exception:
    pass

# Homebrew casks
try:
    result = subprocess.run(['brew', 'list', '--cask', '--versions'], capture_output=True, text=True, timeout=15)
    for line in result.stdout.strip().splitlines():
        parts = line.split()
        if parts:
            apps.append({'name': parts[0] + ' (cask)', 'version': parts[1] if len(parts)>1 else '', 'publisher': 'Homebrew', 'installDate': '', 'sizeMB': 0})
except Exception:
    pass

with open(sys.argv[1], 'w') as f:
    json.dump(apps, f)
PYEOF
    ) &
    local bg_pid=$!

    # Wait up to COLLECTION_TIMEOUT seconds
    local waited=0
    while kill -0 "$bg_pid" 2>/dev/null; do
        sleep 1
        waited=$((waited + 1))
        if [ "$waited" -ge "$COLLECTION_TIMEOUT" ]; then
            kill "$bg_pid" 2>/dev/null
            wait "$bg_pid" 2>/dev/null
            log "  [SCHED] Software inventory timed out after ${COLLECTION_TIMEOUT}s — returning partial results" WARN
            break
        fi
    done
    wait "$bg_pid" 2>/dev/null

    if [ -s "$tmp_file" ]; then
        apps_json=$(cat "$tmp_file")
        pkg_count=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(len(d))" "$tmp_file" 2>/dev/null || echo "0")
    fi
    rm -f "$tmp_file"

    local os_info
    os_info=$(get_os_info)
    local build
    build=$(sw_vers -buildVersion 2>/dev/null || echo "")

    echo "{\"os\":$(json_str "$os_info"),\"version\":$(json_str "$(sw_vers -productVersion 2>/dev/null || echo "")"),\"buildNumber\":$(json_str "$build"),\"installedPackages\":${pkg_count},\"installedApps\":${apps_json}}"
}

# =============================================================================
# Storage info
# =============================================================================
get_storage_json() {
    python3 - <<'PYEOF'
import subprocess, json, re

result = subprocess.run(['df', '-k'], capture_output=True, text=True)
volumes = []
for line in result.stdout.strip().splitlines()[1:]:
    parts = line.split()
    if len(parts) < 6:
        continue
    fs = parts[0]
    if not fs.startswith('/dev/'):
        continue
    try:
        total_gb = round(int(parts[1]) * 1024 / 1e9, 1)
        free_gb  = round(int(parts[3]) * 1024 / 1e9, 1)
        used_pct = round((1 - int(parts[3])/int(parts[1])) * 100, 1) if int(parts[1]) > 0 else 0
        mount    = parts[5]
    except (ValueError, ZeroDivisionError):
        continue
    volumes.append({'drive': mount, 'totalGB': total_gb, 'freeGB': free_gb, 'usedPercent': used_pct, 'fileSystem': 'APFS'})

print(json.dumps(volumes))
PYEOF
}

# =============================================================================
# HMAC / API
# =============================================================================
get_timestamp_ms() {
    python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo "$(date +%s)000"
}

generate_nonce() {
    openssl rand -hex 16 2>/dev/null || date +%s%N | shasum -a 256 | head -c 32
}

compute_hmac() {
    echo -n "$2" | openssl dgst -sha256 -hmac "$1" -hex 2>/dev/null | sed 's/^.* //'
}

api_call() {
    local method="$1" endpoint="$2" data="$3"
    local url="${HOLOCRON_API}${endpoint}"
    local extra_headers=()

    if [ -n "$HOLOCRON_HMAC_SECRET" ] && [ "$method" = "POST" ]; then
        local ts nonce sig
        ts=$(get_timestamp_ms)
        nonce=$(generate_nonce)
        sig=$(compute_hmac "$HOLOCRON_HMAC_SECRET" "${ts}.${nonce}.${data}")
        extra_headers+=(-H "X-Holocron-Signature: ${sig}" -H "X-Holocron-Timestamp: ${ts}" -H "X-Holocron-Nonce: ${nonce}")
    fi

    if [ "$method" = "POST" ]; then
        curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            "${extra_headers[@]}" \
            -d "$data" \
            --connect-timeout 10 \
            --max-time 30 2>/dev/null
    else
        curl -s "$url" --connect-timeout 10 --max-time 30 2>/dev/null
    fi
}

# =============================================================================
# Buffer management (file-based JSONL)
# =============================================================================
buffer_count() {
    [ -f "$BUFFER_FILE" ] && wc -l < "$BUFFER_FILE" | tr -d ' ' || echo "0"
}

add_to_buffer() {
    local task_type="$1" hostname="$2" ip="$3" data="$4"
    local ts entry
    ts=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    entry="{\"type\":$(json_str "$task_type"),\"timestamp\":$(json_str "$ts"),\"hostname\":$(json_str "$hostname"),\"ipAddress\":$(json_str "$ip"),\"probeVersion\":$(json_str "$PROBE_VERSION"),\"siteToken\":$(json_str "$HOLOCRON_TOKEN"),\"data\":${data}}"
    mkdir -p "$INSTALL_PATH"
    echo "$entry" >> "$BUFFER_FILE"

    # Trim buffer if over limit
    local count
    count=$(buffer_count)
    if [ "$count" -gt "$BUFFER_MAX" ]; then
        local excess=$((count - BUFFER_MAX))
        local tmpf
        tmpf=$(mktemp)
        tail -n +"$((excess+1))" "$BUFFER_FILE" > "$tmpf" && mv "$tmpf" "$BUFFER_FILE"
    fi
}

flush_buffer() {
    local count
    count=$(buffer_count)
    [ "$count" -eq 0 ] && return 0

    local processed=0 errors=0
    while [ "$(buffer_count)" -gt 0 ]; do
        local batch_size=$FLUSH_BATCH
        local remaining
        remaining=$(buffer_count)
        [ "$remaining" -lt "$batch_size" ] && batch_size=$remaining

        local tmpf batch_json
        tmpf=$(mktemp)
        head -n "$batch_size" "$BUFFER_FILE" > "$tmpf"

        batch_json=$(python3 - "$tmpf" <<'PYEOF'
import json, sys
entries = []
with open(sys.argv[1]) as f:
    for line in f:
        line = line.strip()
        if line:
            try:
                entries.append(json.loads(line))
            except Exception:
                pass
print(json.dumps(entries))
PYEOF
)
        rm -f "$tmpf"

        local token
        token=$(echo "$batch_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['siteToken'] if d else '')" 2>/dev/null || echo "$HOLOCRON_TOKEN")
        local payload="{\"siteToken\":$(json_str "$token"),\"entries\":${batch_json}}"
        local response
        response=$(api_call "POST" "/api/probe-heartbeat-buffered" "$payload")
        local success
        success=$(echo "$response" | grep -o '"success":true' || true)

        if [ -n "$success" ]; then
            local tmpf2
            tmpf2=$(mktemp)
            tail -n "+$((batch_size+1))" "$BUFFER_FILE" > "$tmpf2" && mv "$tmpf2" "$BUFFER_FILE"
            [ ! -s "$BUFFER_FILE" ] && rm -f "$BUFFER_FILE"
            processed=$((processed + batch_size))
        else
            errors=$((errors + 1))
            log "  [FLUSH] Buffer flush failed: $(echo "$response" | grep -o '"error":"[^"]*"' | head -1)" WARN
            return 1
        fi
    done

    log "  [FLUSH] Flushed ${processed} entries (errors: ${errors})"
    return 0
}

# =============================================================================
# Heartbeat
# =============================================================================
send_heartbeat() {
    # Report any background tasks that completed since last heartbeat
    report_completed_tasks

    local hostname ip cpu mem disk
    hostname=$(get_hostname)
    ip=$(get_ip)
    cpu=$(get_cpu_usage)
    mem=$(get_memory_usage)
    disk=$(get_disk_usage)

    # Count active background tasks
    local active_tasks=0
    if [ -d "$TASK_RESULTS_DIR" ]; then
        active_tasks=$(find "$TASK_RESULTS_DIR" -name "*.lock" 2>/dev/null | wc -l | tr -d ' ')
    fi

    local payload
    payload="{\"siteToken\":$(json_str "$HOLOCRON_TOKEN"),\"hostname\":$(json_str "$hostname"),\"ipAddress\":$(json_str "$ip"),\"osInfo\":$(json_str "$(get_os_info)"),\"probeVersion\":$(json_str "$PROBE_VERSION"),\"cpuUsage\":${cpu},\"memoryUsage\":${mem},\"diskUsage\":${disk},\"taskQueueDepth\":$(buffer_count),\"activeTasks\":${active_tasks},\"avgScanDurationMs\":0}"

    local response
    response=$(api_call "POST" "/api/probe-heartbeat" "$payload")
    local success
    success=$(echo "$response" | grep -o '"success":true' || true)

    if [ -n "$success" ]; then
        local next
        next=$(echo "$response" | grep -o '"nextHeartbeat":[0-9]*' | cut -d: -f2)
        [ -n "$next" ] && [ "$next" -gt 0 ] 2>/dev/null && HEARTBEAT_INTERVAL=$next

        # Check if server requested immediate software inventory
        local req_sw
        req_sw=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print('yes' if d.get('requestSoftwareInventory') else '')" 2>/dev/null || true)
        if [ "$req_sw" = "yes" ]; then
            log "  [SCHED] Server requested immediate software inventory — launching background scan" WARN
            (
                local _inv _h _i
                _h=$(get_hostname); _i=$(get_ip)
                _inv=$(get_software_inventory_json)
                add_to_buffer "softwareInventory" "$_h" "$_i" "$_inv"
                TASK_LAST_RUN[softwareInventory]=$(date +%s)
                local _pkg
                _pkg=$(echo "$_inv" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('installedPackages',0))" 2>/dev/null || echo "?")
                log "  [SCHED] On-demand software inventory done (${_pkg} packages)"
            ) &
            disown
            TASK_LAST_RUN[softwareInventory]=$(date +%s)
        fi

        # Dispatch pending remediation tasks
        local tasks_json
        tasks_json=$(echo "$response" | python3 -c "
import json,sys
d=json.load(sys.stdin)
tasks = d.get('pendingTasks', [])
for t in tasks:
    print(json.dumps(t))
" 2>/dev/null || true)

        if [ -n "$tasks_json" ]; then
            while IFS= read -r task_line; do
                [ -z "$task_line" ] && continue
                execute_remediation_task "$task_line"
            done <<< "$tasks_json"
        fi

        log "♥ Heartbeat OK (CPU: ${cpu}%, Mem: ${mem}%, Disk: ${disk}%, Buf: $(buffer_count), Next: ${HEARTBEAT_INTERVAL}s)" SUCCESS
        return 0
    else
        local err
        err=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        log "✗ Heartbeat failed: ${err:-no response}" ERROR
        return 1
    fi
}

# =============================================================================
# Remediation task execution — NON-BLOCKING (background)
# Tasks run in the background; results are picked up on the next heartbeat.
# =============================================================================

# Report any completed background tasks and clear their result files
report_completed_tasks() {
    [ -d "$TASK_RESULTS_DIR" ] || return 0
    local result_file
    for result_file in "$TASK_RESULTS_DIR"/*.result 2>/dev/null; do
        [ -f "$result_file" ] || continue
        local result_json task_id status
        result_json=$(cat "$result_file" 2>/dev/null) || continue
        task_id=$(echo "$result_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('taskId',''))" 2>/dev/null)
        status=$(echo "$result_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
        [ -z "$task_id" ] && { rm -f "$result_file"; continue; }
        local report_payload
        report_payload=$(echo "$result_json" | python3 -c "
import json,sys
d=json.load(sys.stdin)
d['siteToken']='${HOLOCRON_TOKEN}'
print(json.dumps(d))
" 2>/dev/null)
        if [ -n "$report_payload" ]; then
            api_call "POST" "/api/probe-task-report" "$report_payload" > /dev/null
            log "  [TASK] Reported background task ${task_id}: ${status}" $([ "$status" = "completed" ] && echo "SUCCESS" || echo "ERROR")
        fi
        rm -f "$result_file"
    done
}

execute_remediation_task() {
    local task_json="$1"
    local task_id script_type script rollback_script

    task_id=$(echo "$task_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
    script_type=$(echo "$task_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('scriptType','bash'))" 2>/dev/null)
    script=$(echo "$task_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('script','') or d.get('remediationScript',''))" 2>/dev/null)
    rollback_script=$(echo "$task_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('rollbackScript',''))" 2>/dev/null)

    [ -z "$task_id" ] && return
    [ -z "$script" ] && return

    if [ "$script_type" != "bash" ] && [ "$script_type" != "shell" ] && [ "$script_type" != "sh" ]; then
        log "  [TASK] Unsupported script type: ${script_type} — skipping" WARN
        return
    fi

    # Deduplicate: skip if already running or result pending
    mkdir -p "$TASK_RESULTS_DIR"
    local lock_file="${TASK_RESULTS_DIR}/${task_id}.lock"
    [ -f "${TASK_RESULTS_DIR}/${task_id}.result" ] && return
    [ -f "$lock_file" ] && return

    log "  [TASK] Launching task ${task_id} in background (type: ${script_type})"
    touch "$lock_file"

    # Report executing immediately (non-blocking)
    local exec_payload
    exec_payload="{\"siteToken\":$(json_str "$HOLOCRON_TOKEN"),\"taskId\":$(json_str "$task_id"),\"status\":\"executing\"}"
    api_call "POST" "/api/probe-task-report" "$exec_payload" > /dev/null &

    # Store rollback script
    if [ -n "$rollback_script" ]; then
        mkdir -p "$INSTALL_PATH/rollbacks"
        echo "$rollback_script" > "${INSTALL_PATH}/rollbacks/${task_id}.sh"
    fi

    # Determine timeout: long-running tasks get 3600s, others 1800s
    local title timeout_sec
    title=$(echo "$task_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('title',''))" 2>/dev/null || true)
    echo "$title" | grep -qiE "install|update|patch|upgrade|download|deploy|setup|softwareupdate" && timeout_sec=3600 || timeout_sec=1800

    # Run script in background — result written to file for next heartbeat to pick up
    local result_file="${TASK_RESULTS_DIR}/${task_id}.result"
    (
        local tmp_script out_file exit_code output
        tmp_script=$(mktemp /tmp/holocron_task_XXXXXX.sh)
        out_file=$(mktemp /tmp/holocron_out_XXXXXX.txt)
        printf '%s\n' "$script" > "$tmp_script"
        chmod +x "$tmp_script"

        # Use perl for timeout (always available on macOS), fall back to direct exec
        if command -v perl > /dev/null 2>&1; then
            perl -e "alarm($timeout_sec); exec 'bash', '$tmp_script'" > "$out_file" 2>&1
            exit_code=$?
        else
            bash "$tmp_script" > "$out_file" 2>&1
            exit_code=$?
        fi

        output=$(cat "$out_file" 2>/dev/null | head -c 32768)
        rm -f "$tmp_script" "$out_file"

        local status="completed"
        if [ "$exit_code" -ne 0 ]; then
            status="failed"
            python3 -c "
import json, sys
d = {'taskId': sys.argv[1], 'status': 'failed', 'result': sys.argv[2], 'error': 'Exit code ' + sys.argv[3] + ': ' + sys.argv[4]}
print(json.dumps(d))
" "$task_id" "$output" "$exit_code" "$output" > "$result_file" 2>/dev/null
        else
            python3 -c "
import json, sys
d = {'taskId': sys.argv[1], 'status': 'completed', 'result': sys.argv[2], 'error': None}
print(json.dumps(d))
" "$task_id" "$output" > "$result_file" 2>/dev/null
        fi

        rm -f "$lock_file"
        log "  [TASK] Background task ${task_id} finished: ${status} (exit: ${exit_code})" $([ "$status" = "completed" ] && echo "SUCCESS" || echo "ERROR")
    ) &
    disown
}

# =============================================================================
# Scheduled collections (one per daemon cycle)
# =============================================================================
get_scheduled_tasks() {
    echo "metrics:60"
    echo "networkInterfaces:60"
    echo "securityAudit:600"
    echo "softwareInventory:600"
    echo "storageInfo:3600"
}

get_task_last_run() {
    local task="$1"
    echo "${TASK_LAST_RUN[$task]:-0}"
}

invoke_due_collections() {
    local now
    now=$(date +%s)
    local most_overdue_task="" most_overdue_secs=-99999999

    while IFS=":" read -r task interval; do
        local last_run overdue_by
        last_run=$(get_task_last_run "$task")
        if [ "$last_run" -eq 0 ]; then
            overdue_by=99999999
        else
            overdue_by=$(( now - last_run - interval ))
        fi
        if [ "$overdue_by" -gt 0 ] && [ "$overdue_by" -gt "$most_overdue_secs" ]; then
            most_overdue_secs=$overdue_by
            most_overdue_task=$task
        fi
    done < <(get_scheduled_tasks)

    [ -z "$most_overdue_task" ] && return

    log "  [SCHED] Running collection: ${most_overdue_task}"
    local hostname ip
    hostname=$(get_hostname)
    ip=$(get_ip)

    case "$most_overdue_task" in
        metrics)
            local cpu mem disk
            cpu=$(get_cpu_usage)
            mem=$(get_memory_usage)
            disk=$(get_disk_usage)
            local data="{\"cpuUsage\":${cpu},\"memoryUsage\":${mem},\"diskUsage\":${disk}}"
            add_to_buffer "metrics" "$hostname" "$ip" "$data"
            log "  [SCHED] Metrics collected (CPU: ${cpu}%, Mem: ${mem}%, Disk: ${disk}%)"
            ;;
        networkInterfaces)
            local ifaces
            ifaces=$(get_network_interfaces_json)
            add_to_buffer "networkInterfaces" "$hostname" "$ip" "{\"interfaces\":${ifaces}}"
            log "  [SCHED] Network interfaces collected"
            ;;
        securityAudit)
            local audit
            audit=$(get_security_audit_json)
            add_to_buffer "securityAudit" "$hostname" "$ip" "$audit"
            log "  [SCHED] Security audit collected"
            ;;
        softwareInventory)
            local inv
            inv=$(get_software_inventory_json)
            add_to_buffer "softwareInventory" "$hostname" "$ip" "$inv"
            local pkg_count
            pkg_count=$(echo "$inv" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('installedPackages',0))" 2>/dev/null || echo "?")
            log "  [SCHED] Software inventory collected (${pkg_count} packages)"
            ;;
        storageInfo)
            local storage
            storage=$(get_storage_json)
            add_to_buffer "storageInfo" "$hostname" "$ip" "{\"volumes\":${storage}}"
            log "  [SCHED] Storage info collected"
            ;;
    esac

    TASK_LAST_RUN[$most_overdue_task]=$(date +%s)
}

# =============================================================================
# Enrollment
# =============================================================================
enroll() {
    local hostname ip os mac manufacturer model cpu mem_gb sys_type
    hostname=$(get_hostname)
    ip=$(get_ip)
    os=$(get_os_info)
    mac=$(get_mac_address)
    manufacturer=$(get_manufacturer)
    model=$(get_model)
    cpu=$(get_cpu_info)
    mem_gb=$(get_total_memory_gb)
    sys_type=$(get_system_type)

    log "Enrolling probe with HOLOCRON AI..." WARN
    log "  Hostname:     ${hostname}"
    log "  IP:           ${ip}"
    log "  MAC:          ${mac}"
    log "  OS:           ${os}"
    log "  Manufacturer: ${manufacturer}"
    log "  Model:        ${model}"
    log "  CPU:          ${cpu}"
    log "  Memory:       ${mem_gb} GB"
    log "  System Type:  ${sys_type}"

    local payload
    payload="{\"siteToken\":$(json_str "$HOLOCRON_TOKEN"),\"hostname\":$(json_str "$hostname"),\"ipAddress\":$(json_str "$ip"),\"osInfo\":$(json_str "$os"),\"probeVersion\":$(json_str "$PROBE_VERSION"),\"deploymentType\":\"bare-metal\",\"macAddress\":$(json_str "$mac"),\"manufacturer\":$(json_str "$manufacturer"),\"model\":$(json_str "$model"),\"cpuInfo\":$(json_str "$cpu"),\"totalMemoryGB\":${mem_gb},\"systemType\":$(json_str "$sys_type")}"

    local response
    response=$(api_call "POST" "/api/probe-enroll" "$payload")
    echo "$response" | grep -q '"success":true' || { log "✗ Enrollment failed: $(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)" ERROR; return 1; }

    local probe_id
    probe_id=$(echo "$response" | grep -o '"probeId":"[^"]*"' | cut -d'"' -f4)
    log "✓ Probe enrolled successfully (ID: ${probe_id})" SUCCESS
    return 0
}

# =============================================================================
# Main daemon loop
# =============================================================================
run_daemon() {
    RETRY_COUNT=0
    LAST_SYNC_EPOCH=0

    while true; do
        local now
        now=$(date +%s)
        local time_since_sync=$(( now - LAST_SYNC_EPOCH ))

        # Heartbeat FIRST — never blocked by collection
        if [ "$time_since_sync" -ge "$HEARTBEAT_INTERVAL" ]; then
            LAST_SYNC_EPOCH=$now

            if ! flush_buffer; then
                RETRY_COUNT=$((RETRY_COUNT + 1))
                local backoff=$(( HEARTBEAT_INTERVAL * (2 ** RETRY_COUNT) ))
                [ "$backoff" -gt 300 ] && backoff=300
                log "Buffer flush failed. Retry in ${backoff}s" WARN
                if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
                    log "Max retries. Re-enrolling..." WARN
                    enroll && RETRY_COUNT=0
                fi
                sleep "$backoff"
                continue
            fi

            if send_heartbeat; then
                RETRY_COUNT=0
            else
                RETRY_COUNT=$((RETRY_COUNT + 1))
                local backoff=$(( HEARTBEAT_INTERVAL * (2 ** RETRY_COUNT) ))
                [ "$backoff" -gt 300 ] && backoff=300
                if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
                    log "Max retries. Re-enrolling..." WARN
                    enroll && RETRY_COUNT=0
                fi
                sleep "$backoff"
                continue
            fi
        fi

        # Run one scheduled collection after heartbeat
        invoke_due_collections

        sleep 5
    done
}

stop_probe() {
    log "Shutting down HOLOCRON Probe..." WARN
    exit 0
}

# =============================================================================
# LaunchDaemon service management
# =============================================================================
install_service() {
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${RED}Error: Installation requires root. Run: sudo bash $0 install --token ... --api ...${NC}"
        exit 1
    fi

    mkdir -p "$INSTALL_PATH"
    cp "$0" "$SCRIPT_DEST"
    chmod +x "$SCRIPT_DEST"

    # Write config
    cat > "$CONFIG_FILE" <<ENVEOF
HOLOCRON_TOKEN=${HOLOCRON_TOKEN}
HOLOCRON_API=${HOLOCRON_API}
HOLOCRON_HMAC_SECRET=${HOLOCRON_HMAC_SECRET:-}
ENVEOF
    chmod 600 "$CONFIG_FILE"

    # Write LaunchDaemon plist
    cat > "$PLIST_PATH" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${SCRIPT_DEST}</string>
        <string>start</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOLOCRON_TOKEN</key>
        <string>${HOLOCRON_TOKEN}</string>
        <key>HOLOCRON_API</key>
        <string>${HOLOCRON_API}</string>
        <key>HOLOCRON_HMAC_SECRET</key>
        <string>${HOLOCRON_HMAC_SECRET:-}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_FILE}</string>
    <key>StandardErrorPath</key>
    <string>${INSTALL_PATH}/probe-error.log</string>
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
PLISTEOF

    chmod 644 "$PLIST_PATH"
    launchctl load -w "$PLIST_PATH" 2>/dev/null || launchctl bootstrap system "$PLIST_PATH" 2>/dev/null

    log "✓ HOLOCRON Probe installed as LaunchDaemon (${SERVICE_LABEL})" SUCCESS
    log "  View logs:  tail -f \"${LOG_FILE}\""
    log "  Status:     launchctl list | grep holocron"
    log "  Stop:       sudo launchctl unload ${PLIST_PATH}"
}

uninstall_service() {
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${RED}Error: Uninstall requires root.${NC}"; exit 1
    fi
    launchctl unload -w "$PLIST_PATH" 2>/dev/null || launchctl bootout system "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH" "$SCRIPT_DEST"
    log "✓ HOLOCRON Probe uninstalled. Data preserved at: ${INSTALL_PATH}" SUCCESS
    log "  To also remove data: sudo rm -rf \"${INSTALL_PATH}\""
}

check_status() {
    local running
    running=$(launchctl list 2>/dev/null | grep "$SERVICE_LABEL" || true)
    if [ -n "$running" ]; then
        echo -e "${GREEN}● HOLOCRON Probe is running${NC}"
        echo "  Label: ${SERVICE_LABEL}"
        echo "  Log:   ${LOG_FILE}"
        [ -f "$LOG_FILE" ] && echo "" && echo "--- Last 10 log lines ---" && tail -10 "$LOG_FILE"
    else
        echo -e "${RED}● HOLOCRON Probe is NOT running${NC}"
        echo "  Install: sudo bash $0 install --token ... --api ..."
    fi
}

test_connection() {
    log "Testing connection to ${HOLOCRON_API}..."
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "${HOLOCRON_API}/api/health" --connect-timeout 10 2>/dev/null)
    if [ "$code" = "200" ]; then
        log "✓ API is reachable (HTTP ${code})" SUCCESS
    else
        log "✗ API returned HTTP ${code}" ERROR
    fi
}

show_help() {
    echo "Usage: bash $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  install    Install as a LaunchDaemon service (requires sudo)"
    echo "  uninstall  Remove the LaunchDaemon service (requires sudo)"
    echo "  start      Run in foreground (for testing)"
    echo "  status     Check if the probe is running"
    echo "  test       Test connectivity to HOLOCRON AI"
    echo ""
    echo "Options:"
    echo "  --token    Site token (or HOLOCRON_TOKEN env var)"
    echo "  --api      API URL   (or HOLOCRON_API env var)"
    echo "  --hmac     HMAC secret (optional, or HOLOCRON_HMAC_SECRET env var)"
    echo ""
    echo "Quick install:"
    echo "  curl -fsSL https://YOUR-URL/api/probe-download/macos | sudo bash -s install \\"
    echo "    --token hcn_xxx --api https://YOUR-URL"
}

# =============================================================================
# Argument parsing
# =============================================================================
while [ $# -gt 0 ]; do
    case "$1" in
        --token)  HOLOCRON_TOKEN="$2";       shift 2 ;;
        --api)    HOLOCRON_API="$2";          shift 2 ;;
        --hmac)   HOLOCRON_HMAC_SECRET="$2"; shift 2 ;;
        install|uninstall|start|status|test|help) COMMAND="$1"; shift ;;
        *) echo "Unknown option: $1"; show_help; exit 1 ;;
    esac
done

COMMAND="${COMMAND:-start}"
HOLOCRON_API="${HOLOCRON_API%/}"

# Load config file if it exists and vars are not already set
if [ -f "$CONFIG_FILE" ]; then
    [ -z "$HOLOCRON_TOKEN" ]       && HOLOCRON_TOKEN=$(grep '^HOLOCRON_TOKEN=' "$CONFIG_FILE" | cut -d= -f2-)
    [ -z "$HOLOCRON_API" ]         && HOLOCRON_API=$(grep '^HOLOCRON_API=' "$CONFIG_FILE" | cut -d= -f2-)
    [ -z "$HOLOCRON_HMAC_SECRET" ] && HOLOCRON_HMAC_SECRET=$(grep '^HOLOCRON_HMAC_SECRET=' "$CONFIG_FILE" | cut -d= -f2-)
fi

case "$COMMAND" in
    help)      show_help; exit 0 ;;
    status)    check_status; exit 0 ;;
    uninstall) uninstall_service; exit 0 ;;
    test)
        [ -z "$HOLOCRON_API" ] && { echo "Error: --api required"; show_help; exit 1; }
        test_connection; exit 0 ;;
esac

[ -z "$HOLOCRON_TOKEN" ] && { echo -e "${RED}Error: --token required${NC}"; show_help; exit 1; }
[ -z "$HOLOCRON_API" ]   && { echo -e "${RED}Error: --api required${NC}";   show_help; exit 1; }

banner

trap stop_probe SIGTERM SIGINT

case "$COMMAND" in
    install) install_service ;;
    start)
        log "Starting HOLOCRON Probe Agent..."
        log "  Token: ${HOLOCRON_TOKEN:0:10}...${HOLOCRON_TOKEN: -4}"
        log "  API:   ${HOLOCRON_API}"
        log ""
        if enroll; then
            log "Probe is online. Heartbeat interval: ${HEARTBEAT_INTERVAL}s" SUCCESS
            log ""
            # Seed initial collections so data appears immediately — metrics first, then inventory in background
            log "[INIT] Running initial metrics collection..."
            INIT_H=$(get_hostname); INIT_I=$(get_ip); INIT_C=$(get_cpu_usage); INIT_M=$(get_memory_usage); INIT_D=$(get_disk_usage)
            add_to_buffer "metrics" "$INIT_H" "$INIT_I" "{\"cpuUsage\":${INIT_C},\"memoryUsage\":${INIT_M},\"diskUsage\":${INIT_D}}"
            TASK_LAST_RUN[metrics]=$(date +%s)
            log "[INIT] Launching background software inventory (apps will appear on next heartbeat)..."
            # Run softwareInventory in background so daemon loop starts immediately
            (
                INIT_INV=$(get_software_inventory_json)
                add_to_buffer "softwareInventory" "$INIT_H" "$INIT_I" "$INIT_INV"
                INIT_PKG=$(echo "$INIT_INV" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('installedPackages',0))" 2>/dev/null || echo "?")
                log "[INIT] Background software inventory done (${INIT_PKG} packages)"
            ) &
            TASK_LAST_RUN[softwareInventory]=$(date +%s)
            run_daemon
        else
            log "Failed to enroll. Check your token and API URL." ERROR
            exit 1
        fi
        ;;
esac
