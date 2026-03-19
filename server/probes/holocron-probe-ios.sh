#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║          HOLOCRON AI — iOS Mobile Probe Agent v1.0.0                       ║
# ║          Requires: a-Shell or Pythonista (App Store) OR SSH on jailbreak   ║
# ║          Supports: iOS 16+ / iPadOS 16+                                    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
#
# ─── INSTALLATION OPTIONS ─────────────────────────────────────────────────────
#
#  OPTION 1 — a-Shell (Recommended, no jailbreak)
#    1. Install "a-Shell" from the App Store (free)
#    2. In a-Shell: curl -O <server-url>/api/probe-download/ios
#    3. chmod +x holocron-probe-ios.sh
#    4. bash holocron-probe-ios.sh \
#           -ServerUrl="https://your-server.repl.co" \
#           -ProbeId="your-probe-id" \
#           -Token="your-token"
#    5. For background: use iOS Shortcuts to run this at intervals
#
#  OPTION 2 — Apple Shortcuts automation (no jailbreak, periodic check-in)
#    1. Install "Shortcuts" app
#    2. Create a new Shortcut with action: "Run Script over SSH" or "URL" action
#    3. Set trigger: Automation → Time of Day (every 30 min)
#    4. Point to this script's check-in endpoint
#    See: SHORTCUTS_AUTOMATION section below
#
#  OPTION 3 — SSH (jailbreak only)
#    ssh mobile@<device-ip>
#    bash holocron-probe-ios.sh -ServerUrl=... -ProbeId=... -Token=...
#
# ─── SHORTCUTS AUTOMATION (copy to Notes, import to Shortcuts) ────────────────
#
#  Shortcut "HOLOCRON Check-in":
#    Action 1: Get Contents of URL
#      URL: https://your-server.repl.co/api/probe-heartbeat
#      Method: POST
#      Headers: Authorization: Bearer <your-token>
#      Body (JSON): {"probeId":"<id>","platform":"ios","status":"online"}
#    Action 2: Stop Shortcut (ignore result)
#
#  Automation trigger: Personal Automation → Time of Day → Every 30 minutes
#
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Argument parsing ─────────────────────────────────────────────────────────
SERVER_URL=""
PROBE_ID=""
TOKEN=""
HMAC_SECRET=""
HEARTBEAT_INTERVAL=60
LOG_FILE="${HOME}/holocron-probe-ios.log"

for arg in "$@"; do
    case "$arg" in
        -ServerUrl=*) SERVER_URL="${arg#*=}" ;;
        -ProbeId=*)   PROBE_ID="${arg#*=}" ;;
        -Token=*)     TOKEN="${arg#*=}" ;;
        -HmacSecret=*) HMAC_SECRET="${arg#*=}" ;;
        -Interval=*)  HEARTBEAT_INTERVAL="${arg#*=}" ;;
        -OneShot)     ONE_SHOT=true ;;
        -Help)
            echo "Usage: bash $0 -ServerUrl=<url> -ProbeId=<id> -Token=<token> [-HmacSecret=<secret>] [-Interval=<secs>] [-OneShot]"
            exit 0 ;;
    esac
done
ONE_SHOT="${ONE_SHOT:-false}"

if [[ -z "$SERVER_URL" || -z "$PROBE_ID" || -z "$TOKEN" ]]; then
    echo "[HOLOCRON] ERROR: -ServerUrl, -ProbeId and -Token are required."
    exit 1
fi

# ─── Logging ──────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
log "═══════════════════════════════════════════════════"
log "HOLOCRON AI — iOS Mobile Probe v1.0.0 starting"
log "Server: $SERVER_URL | ProbeId: $PROBE_ID"
log "═══════════════════════════════════════════════════"

# ─── HMAC signing ─────────────────────────────────────────────────────────────
sign_request() {
    local body="$1" ts nonce payload sig
    ts=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s000)
    nonce=$(python3 -c "import uuid; print(str(uuid.uuid4()))" 2>/dev/null || echo "nonce-$(date +%s)")
    payload="${ts}.${nonce}.${body}"
    sig=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex 2>/dev/null | awk '{print $NF}')
    echo "$ts $nonce $sig"
}

api_call() {
    local method="$1" path="$2" body="${3:-{}}"
    local url="$SERVER_URL$path"
    local extra=()
    if [[ -n "$HMAC_SECRET" ]]; then
        read -r ts nonce sig <<< "$(sign_request "$body")"
        extra+=(-H "X-Holocron-Timestamp: $ts" -H "X-Holocron-Nonce: $nonce" -H "X-Holocron-Signature: $sig")
    fi
    curl -s -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        "${extra[@]+"${extra[@]}"}" \
        -d "$body" \
        --connect-timeout 15 \
        --max-time 30 2>/dev/null || true
}

# ─── iOS device information ───────────────────────────────────────────────────
detect_environment() {
    if [[ "$(uname)" == "Darwin" ]] && [[ -d "/System/Library/CoreServices" ]] && [[ ! -d "/Applications/Xcode.app" ]]; then
        echo "ios"
    elif command -v a-shell &>/dev/null || [[ -n "${ASHELL_VERSION:-}" ]]; then
        echo "ashell"
    elif command -v python3 &>/dev/null && python3 -c "import objc" 2>/dev/null; then
        echo "pythonista"
    else
        echo "generic-darwin"
    fi
}

get_ios_info() {
    local env
    env=$(detect_environment)
    local product_name product_version build_version machine

    if [[ "$env" == "ios" || "$env" == "ashell" ]]; then
        product_name=$(sysctl -n hw.machine 2>/dev/null || echo "iPhone")
        machine=$(sysctl -n hw.machine 2>/dev/null || echo "iPhone")
        product_version=$(sw_vers -productVersion 2>/dev/null || echo "17.0")
        build_version=$(sw_vers -buildVersion 2>/dev/null || echo "Unknown")
        local ncpu mem_bytes mem_gb
        ncpu=$(sysctl -n hw.ncpu 2>/dev/null || echo "1")
        mem_bytes=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
        mem_gb=$(( mem_bytes / 1073741824 ))
        echo "{\"model\":\"$product_name\",\"machine\":\"$machine\",\"iosVersion\":\"iOS $product_version\",\"buildVersion\":\"$build_version\",\"cpuCores\":$ncpu,\"ramGB\":$mem_gb}"
    else
        echo "{\"model\":\"iOS Device\",\"machine\":\"Unknown\",\"iosVersion\":\"iOS 17.0\",\"buildVersion\":\"Unknown\",\"cpuCores\":6,\"ramGB\":6}"
    fi
}

get_ios_storage() {
    local total_bytes free_bytes total_gb used_gb
    if command -v df &>/dev/null; then
        total_bytes=$(df / 2>/dev/null | awk 'NR==2{print $2*512}' || echo "0")
        free_bytes=$(df / 2>/dev/null | awk 'NR==2{print $4*512}' || echo "0")
        total_gb=$(( total_bytes / 1073741824 ))
        used_gb=$(( (total_bytes - free_bytes) / 1073741824 ))
        echo "{\"storageTotal\":$total_gb,\"storageUsed\":$used_gb}"
    else
        echo "{\"storageTotal\":128,\"storageUsed\":0}"
    fi
}

get_ios_network() {
    local ip_addr iface
    if command -v ifconfig &>/dev/null; then
        ip_addr=$(ifconfig en0 2>/dev/null | grep 'inet ' | awk '{print $2}' | head -1 || echo "0.0.0.0")
    else
        ip_addr=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K[0-9.]+' | head -1 || echo "0.0.0.0")
    fi
    echo "{\"ipAddress\":\"$ip_addr\",\"interface\":\"Wi-Fi\"}"
}

get_ios_apps() {
    # On a-Shell or standard iOS: list sandbox-accessible directories as proxy for apps
    local apps=()
    if [[ -d "/var/mobile/Containers/Bundle/Application" ]]; then
        # Jailbreak: real app list
        while IFS= read -r app; do
            apps+=("\"$app\"")
        done < <(ls /var/mobile/Containers/Bundle/Application/ 2>/dev/null | head -30)
    else
        # a-Shell: list installed commands as app proxy
        while IFS= read -r cmd; do
            [[ -n "$cmd" ]] && apps+=("\"$cmd\"")
        done < <(compgen -c 2>/dev/null | sort -u | head -30 || ls /usr/local/bin 2>/dev/null | head -30 || echo "")
    fi
    printf '[%s]' "$(IFS=','; echo "${apps[*]:-}")"
}

# ─── Full telemetry collection ────────────────────────────────────────────────
collect_telemetry() {
    local device storage network apps hostname
    device=$(get_ios_info)
    storage=$(get_ios_storage)
    network=$(get_ios_network)
    apps=$(get_ios_apps)
    hostname=$(hostname 2>/dev/null || echo "ios-device")

    cat <<EOF
{
  "probeId": "$PROBE_ID",
  "platform": "ios",
  "hostname": "$hostname",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "probeVersion": "1.0.0",
  "hardware": $device,
  "storage": $storage,
  "network": $network,
  "installedApps": $apps,
  "status": "online"
}
EOF
}

# ─── MDM command executor ─────────────────────────────────────────────────────
execute_mdm_command() {
    local action="$1"
    log "MDM command received: $action"
    case "$action" in
        lock)
            # iOS: open lock screen via URL scheme (requires a-Shell shortcut integration)
            if command -v shortcuts &>/dev/null; then
                shortcuts run "HOLOCRON Lock" 2>/dev/null || true
            fi
            log "Lock screen command dispatched"
            ;;
        message)
            local msg="${2:-Message from IT administrator}"
            log "IT Message: $msg"
            # Open message via URL scheme in a-Shell
            if command -v open &>/dev/null; then
                open "alert://?text=${msg// /%20}" 2>/dev/null || true
            fi
            ;;
        wipe)
            log "REMOTE WIPE command received — MDM profile wipe would execute here"
            log "On production: Apple MDM protocol sends EraseDevice command via APNs"
            ;;
        retire)
            log "Device retired by IT — stopping probe"
            exit 0
            ;;
        locate)
            log "Location requested by IT administrator"
            ;;
        *)
            log "Received command: $action"
            ;;
    esac
}

# ─── Poll for MDM actions ──────────────────────────────────────────────────────
poll_mdm_actions() {
    local response
    response=$(api_call "GET" "/api/probe-mdm-commands/$PROBE_ID")
    local count
    count=$(echo "$response" | grep -oP '"count":\s*\K[0-9]+' 2>/dev/null || echo "0")
    if [[ "$count" -gt 0 ]]; then
        log "Processing $count MDM command(s)"
        while IFS= read -r action; do
            [[ -n "$action" ]] && execute_mdm_command "$action"
        done < <(echo "$response" | grep -oP '"action":\s*"\K[^"]+' 2>/dev/null || echo "")
    fi
}

# ─── Send heartbeat ───────────────────────────────────────────────────────────
send_heartbeat() {
    local payload
    payload=$(collect_telemetry)
    log "Sending heartbeat telemetry..."
    local response
    response=$(api_call "POST" "/api/probe-heartbeat" "$payload")
    log "Response: ${response:0:120}"
}

# ─── Enroll probe ─────────────────────────────────────────────────────────────
enroll_probe() {
    local device hostname payload response
    device=$(get_ios_info)
    hostname=$(hostname 2>/dev/null || echo "ios-device")
    payload="{\"probeId\":\"$PROBE_ID\",\"platform\":\"ios\",\"hostname\":\"$hostname\",\"version\":\"1.0.0\",\"hardware\":$device}"
    log "Enrolling probe with HOLOCRON server..."
    response=$(api_call "POST" "/api/probe-enroll" "$payload")
    log "Enrollment: ${response:0:200}"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    if ! command -v curl &>/dev/null; then
        log "ERROR: curl not found. In a-Shell: curl is included by default."
        log "Alternatively install: pkg install curl"
        exit 1
    fi

    log "Environment: $(detect_environment)"
    enroll_probe

    if [[ "$ONE_SHOT" == "true" ]]; then
        send_heartbeat
        poll_mdm_actions
        log "One-shot complete. Use -OneShot flag with iOS Shortcuts for periodic check-ins."
        exit 0
    fi

    log "Starting probe loop (interval: ${HEARTBEAT_INTERVAL}s)"
    local counter=0
    while true; do
        send_heartbeat
        if (( counter % 5 == 0 )); then
            poll_mdm_actions
        fi
        counter=$((counter + 1))
        sleep "$HEARTBEAT_INTERVAL"
    done
}

main
