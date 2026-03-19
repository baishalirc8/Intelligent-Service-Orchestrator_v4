#!/data/data/com.termux/files/usr/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║          HOLOCRON AI — Android Mobile Probe Agent v1.0.0                   ║
# ║          Requires: Termux + Termux:API app                                 ║
# ║          Supports: Android 10+ (API 29+)                                   ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
#
# INSTALLATION (run once in Termux):
#   pkg update && pkg install -y curl jq termux-api
#   chmod +x holocron-probe-android.sh
#   bash holocron-probe-android.sh -ServerUrl "https://your-server.repl.co" \
#       -ProbeId "your-probe-id" -Token "your-token" [-HmacSecret "secret"]
#
# BACKGROUND SERVICE (persistent, survives Termux restart):
#   pkg install -y termux-services
#   mkdir -p ~/.termux/boot
#   cp holocron-probe-android.sh ~/.termux/boot/holocron-probe-android.sh
#   chmod +x ~/.termux/boot/holocron-probe-android.sh
#   termux-wake-lock

set -euo pipefail

# ─── Credentials (injected by server at download time — no manual editing needed) ──
SERVER_URL="__HOLOCRON_SERVER_URL__"
PROBE_ID="__HOLOCRON_PROBE_ID__"
TOKEN="__HOLOCRON_TOKEN__"
HMAC_SECRET=""
HEARTBEAT_INTERVAL=30
MDM_POLL_INTERVAL=60
LOG_FILE="/data/data/com.termux/files/home/holocron-probe.log"

# ─── Argument overrides (optional — credentials are already embedded above) ───
for arg in "$@"; do
    case "$arg" in
        -ServerUrl=*) SERVER_URL="${arg#*=}" ;;
        -ProbeId=*)   PROBE_ID="${arg#*=}" ;;
        -Token=*)     TOKEN="${arg#*=}" ;;
        -HmacSecret=*) HMAC_SECRET="${arg#*=}" ;;
        -Interval=*)  HEARTBEAT_INTERVAL="${arg#*=}" ;;
        -Help)
            echo "Usage: bash $0 (no arguments needed — credentials are embedded)"
            exit 0 ;;
    esac
done

# Strip CR/LF only — not spaces (spaces could exist in server URL)
SERVER_URL=$(printf '%s' "$SERVER_URL" | tr -d '\r\n\t')
PROBE_ID=$(printf '%s' "$PROBE_ID"    | tr -d '\r\n\t ')
TOKEN=$(printf '%s' "$TOKEN"          | tr -d '\r\n\t ')

if [[ -z "$SERVER_URL" || -z "$PROBE_ID" || -z "$TOKEN" ]]; then
    echo "[HOLOCRON] ERROR: Credentials not embedded. Re-download the script from the HOLOCRON Deploy dialog."
    exit 1
fi

# ─── Logging ──────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
log "═══════════════════════════════════════════════════"
log "HOLOCRON AI — Android Mobile Probe v1.0.0 starting"
log "Server: $SERVER_URL | ProbeId: $PROBE_ID"
log "═══════════════════════════════════════════════════"

# ─── HMAC signing ─────────────────────────────────────────────────────────────
sign_request() {
    local body="$1"
    local ts nonce sig payload
    ts=$(date +%s%3N)
    nonce=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16)
    payload="${ts}.${nonce}.${body}"
    sig=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex 2>/dev/null | awk '{print $NF}')
    echo "$ts $nonce $sig"
}

api_call() {
    local method="$1" path="$2" body="${3:-{}}"
    local url="$SERVER_URL$path"
    local extra_headers=()
    if [[ -n "$HMAC_SECRET" ]]; then
        read -r ts nonce sig <<< "$(sign_request "$body")"
        extra_headers+=(
            -H "X-Holocron-Timestamp: $ts"
            -H "X-Holocron-Nonce: $nonce"
            -H "X-Holocron-Signature: $sig"
        )
    fi
    curl -s -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        "${extra_headers[@]+"${extra_headers[@]}"}" \
        -d "$body" \
        --connect-timeout 10 \
        --max-time 30 2>/dev/null || true
}

# ─── Device information collectors ───────────────────────────────────────────
get_device_info() {
    local manufacturer model android_version sdk build_id serial board
    manufacturer=$(getprop ro.product.manufacturer 2>/dev/null || echo "Unknown")
    model=$(getprop ro.product.model 2>/dev/null || echo "Unknown")
    android_version=$(getprop ro.build.version.release 2>/dev/null || echo "Unknown")
    sdk=$(getprop ro.build.version.sdk 2>/dev/null || echo "0")
    build_id=$(getprop ro.build.id 2>/dev/null || echo "Unknown")
    serial=$(getprop ro.serialno 2>/dev/null | tr -d '\n' || echo "Unknown")
    board=$(getprop ro.product.board 2>/dev/null || echo "Unknown")
    cpu_abi=$(getprop ro.product.cpu.abi 2>/dev/null || echo "Unknown")
    echo "{\"manufacturer\":\"$manufacturer\",\"model\":\"$model\",\"androidVersion\":\"Android $android_version\",\"sdkVersion\":$sdk,\"buildId\":\"$build_id\",\"serial\":\"$serial\",\"board\":\"$board\",\"cpuAbi\":\"$cpu_abi\"}"
}

get_battery_info() {
    local level="0" status="unknown" charging="false" temp="0"
    if command -v termux-battery-status &>/dev/null; then
        local bat
        bat=$(termux-battery-status 2>/dev/null) || bat=""
        if [[ -n "$bat" ]]; then
            level=$(echo "$bat" | grep -oP '"percentage":\s*\K[0-9]+' 2>/dev/null || echo "0")
            status=$(echo "$bat" | grep -oP '"status":\s*"\K[^"]+' 2>/dev/null || echo "unknown")
            temp=$(echo "$bat" | grep -oP '"temperature":\s*\K[0-9.]+' 2>/dev/null || echo "0")
            charging=$([ "$status" = "CHARGING" ] && echo "true" || echo "false")
        fi
    else
        local dump
        dump=$(dumpsys battery 2>/dev/null) || dump=""
        level=$(echo "$dump" | grep -oP 'level: \K[0-9]+' | head -1 2>/dev/null || echo "0")
        temp=$(echo "$dump" | grep -oP 'temperature: \K[0-9]+' | head -1 2>/dev/null || echo "0")
    fi
    echo "{\"batteryLevel\":${level:-0},\"charging\":$charging,\"temperature\":${temp:-0}}"
}

get_storage_info() {
    local internal_total="0" internal_free="0"
    internal_total=$(df /sdcard 2>/dev/null | awk 'NR==2{printf "%.0f", $2/1048576}') || internal_total="0"
    internal_free=$(df /sdcard 2>/dev/null | awk 'NR==2{printf "%.0f", $4/1048576}') || internal_free="0"
    local used=$(( ${internal_total:-0} - ${internal_free:-0} )) || used="0"
    echo "{\"storageTotal\":${internal_total:-0},\"storageUsed\":${used:-0}}"
}

get_network_info() {
    local wifi_ssid="Unknown" ip_addr="0.0.0.0"
    ip_addr=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K[0-9.]+' | head -1 2>/dev/null) || ip_addr="0.0.0.0"
    if command -v termux-wifi-connectioninfo &>/dev/null; then
        local wifi
        wifi=$(termux-wifi-connectioninfo 2>/dev/null) || wifi=""
        if [[ -n "$wifi" ]]; then
            wifi_ssid=$(echo "$wifi" | grep -oP '"ssid":\s*"\K[^"]+' 2>/dev/null) || wifi_ssid="Unknown"
        fi
    fi
    echo "{\"ipAddress\":\"${ip_addr:-0.0.0.0}\",\"wifiSsid\":\"${wifi_ssid:-Unknown}\"}"
}

get_installed_apps() {
    local apps=()
    if command -v pm &>/dev/null; then
        while IFS= read -r line; do
            local pkg
            pkg=$(echo "$line" | sed 's/package://g' | tr -d '\r') || true
            [[ -n "$pkg" ]] && apps+=("\"$pkg\"")
        done < <(pm list packages -3 2>/dev/null | head -50) || true
    fi
    printf '[%s]' "$(IFS=','; echo "${apps[*]:-}")"
}

get_location() {
    if command -v termux-location &>/dev/null; then
        local loc lat="0" lon="0"
        loc=$(termux-location -p network 2>/dev/null) || loc=""
        if [[ -n "$loc" ]]; then
            lat=$(echo "$loc" | grep -oP '"latitude":\s*\K[-0-9.]+' 2>/dev/null) || lat="0"
            lon=$(echo "$loc" | grep -oP '"longitude":\s*\K[-0-9.]+' 2>/dev/null) || lon="0"
        fi
        echo "{\"latitude\":${lat:-0},\"longitude\":${lon:-0}}"
    else
        echo "{\"latitude\":0,\"longitude\":0}"
    fi
}

# (collect_telemetry removed — logic merged into send_heartbeat below)

# ─── MDM command executor ─────────────────────────────────────────────────────
execute_mdm_command() {
    local action="$1" payload="$2"
    log "MDM Command received: $action"
    case "$action" in
        lock)
            # Trigger device lockscreen via admin command (requires Device Admin privileges)
            am broadcast -a com.holocron.ACTION_LOCK 2>/dev/null || true
            if command -v termux-notification &>/dev/null; then
                termux-notification -t "HOLOCRON Security" -c "Device lock requested by IT administrator" 2>/dev/null || true
            fi
            log "Lock command executed"
            ;;
        wipe)
            log "REMOTE WIPE command received — clearing device data"
            if command -v termux-notification &>/dev/null; then
                termux-notification -t "HOLOCRON Security" -c "Remote wipe initiated by IT administrator" 2>/dev/null || true
            fi
            # In production: wm action wipe with Device Admin. Logged here for safety.
            log "WIPE: Factory reset would execute here with Device Admin rights"
            ;;
        message)
            local msg
            msg=$(echo "$payload" | grep -oP '"text":\s*"\K[^"]+' 2>/dev/null || echo "Message from IT")
            if command -v termux-notification &>/dev/null; then
                termux-notification -t "HOLOCRON IT Message" -c "$msg" 2>/dev/null || true
            fi
            log "Message delivered: $msg"
            ;;
        locate)
            local loc
            loc=$(get_location)
            log "Location reported: $loc"
            ;;
        block)
            log "Device BLOCKED by IT administrator"
            if command -v termux-notification &>/dev/null; then
                termux-notification -t "HOLOCRON Security" -c "This device has been blocked by IT. Contact your administrator." 2>/dev/null || true
            fi
            ;;
        retire)
            log "Device RETIRED — stopping probe agent"
            exit 0
            ;;
        checkin)
            log "Manual check-in requested"
            ;;
        *)
            log "Unknown MDM command: $action"
            ;;
    esac
}

# ─── Check for pending MDM actions ───────────────────────────────────────────
poll_mdm_actions() {
    local response
    response=$(api_call "GET" "/api/probe-mdm-commands/$PROBE_ID")
    if [[ -z "$response" || "$response" == "null" ]]; then return; fi
    local count
    count=$(echo "$response" | grep -oP '"count":\s*\K[0-9]+' 2>/dev/null || echo "0")
    if [[ "$count" -gt 0 ]]; then
        log "Processing $count pending MDM command(s)..."
        local actions
        actions=$(echo "$response" | grep -oP '"action":\s*"\K[^"]+' 2>/dev/null || echo "")
        while IFS= read -r action; do
            [[ -n "$action" ]] && execute_mdm_command "$action" "$response"
        done <<< "$actions"
    fi
}

# ─── Report task result to server ────────────────────────────────────────────
report_task() {
    local task_id="$1" status="$2" result="$3" error_msg="$4"
    local payload
    payload=$(jq -n \
        --arg st "$TOKEN" \
        --arg ti "$task_id" \
        --arg s  "$status" \
        --arg r  "${result:-}" \
        --arg e  "${error_msg:-}" \
        '{siteToken:$st, taskId:$ti, status:$s, result:$r, error:$e}')
    api_call "POST" "/api/probe-task-report" "$payload" >/dev/null 2>&1 || true
}

# ─── Execute tasks dispatched in heartbeat response ───────────────────────────
execute_pending_tasks() {
    local response="$1"
    local task_count
    task_count=$(echo "$response" | jq -r '.pendingTasks | length' 2>/dev/null) || task_count="0"
    [[ "${task_count:-0}" -eq 0 || "$task_count" == "null" ]] && return

    log "Processing $task_count pending task(s)..."

    local i
    for (( i=0; i<task_count; i++ )); do
        local task_id task_title task_script timeout_sec
        task_id=$(echo "$response"     | jq -r ".pendingTasks[$i].id"             2>/dev/null) || task_id=""
        task_title=$(echo "$response"  | jq -r ".pendingTasks[$i].title"           2>/dev/null) || task_title="Task"
        task_script=$(echo "$response" | jq -r ".pendingTasks[$i].script"          2>/dev/null) || task_script=""
        timeout_sec=$(echo "$response" | jq -r ".pendingTasks[$i].timeoutSeconds // 300" 2>/dev/null) || timeout_sec="300"

        [[ -z "$task_id" || "$task_id" == "null" ]] && continue
        [[ -z "$task_script" || "$task_script" == "null" ]] && {
            report_task "$task_id" "failed" "" "No script content received"
            continue
        }

        log "Task [$((i+1))/$task_count] executing: $task_title"
        report_task "$task_id" "executing" "" ""

        # Write script to a temp file and execute it
        local tmp_script output exit_code
        tmp_script=$(mktemp "${TMPDIR:-/tmp}/hcn_task_XXXXXX.sh") 2>/dev/null || {
            report_task "$task_id" "failed" "" "Could not create temp file"
            continue
        }
        printf '%s\n' "$task_script" > "$tmp_script"
        chmod +x "$tmp_script"

        output=$(timeout "${timeout_sec}" bash "$tmp_script" 2>&1)
        exit_code=$?
        rm -f "$tmp_script"

        if [[ $exit_code -eq 0 ]]; then
            log "Task completed: $task_title"
            report_task "$task_id" "completed" "${output:0:4000}" ""
        elif [[ $exit_code -eq 124 ]]; then
            log "Task timed out after ${timeout_sec}s: $task_title"
            report_task "$task_id" "failed" "" "Task timed out after ${timeout_sec}s. Partial output: ${output:0:500}"
        else
            log "Task failed (exit $exit_code): $task_title"
            report_task "$task_id" "failed" "" "Exit code $exit_code. Output: ${output:0:1000}"
        fi
    done
}

# ─── Send heartbeat with full telemetry ──────────────────────────────────────
send_heartbeat() {
    local payload response

    # Collect from helper functions
    local device battery storage_info network hostname
    device=$(get_device_info)
    battery=$(get_battery_info)
    storage_info=$(get_storage_info)
    network=$(get_network_info)

    # Parse collected JSON safely with jq
    local ip_addr manufacturer model android_version battery_level charging temp wifi_ssid
    ip_addr=$(echo "$network"    | jq -r '.ipAddress    // "0.0.0.0"' 2>/dev/null) || ip_addr="0.0.0.0"
    wifi_ssid=$(echo "$network"  | jq -r '.wifiSsid     // "Unknown"' 2>/dev/null) || wifi_ssid="Unknown"
    manufacturer=$(echo "$device"| jq -r '.manufacturer // "Unknown"' 2>/dev/null) || manufacturer="Unknown"
    model=$(echo "$device"       | jq -r '.model        // "Unknown"' 2>/dev/null) || model="Unknown"
    # Build hostname: prefer net.hostname (empty on Android 10+), fall back to Manufacturer Model
    hostname=$(getprop net.hostname 2>/dev/null)
    if [[ -z "$hostname" || "$hostname" == "localhost" ]]; then
        local mfr_cap; mfr_cap="$(echo "${manufacturer:0:1}" | tr '[:lower:]' '[:upper:]')${manufacturer:1}"
        hostname="${mfr_cap} ${model}"
    fi
    [[ -z "$hostname" || "$hostname" == " " ]] && hostname="android-device"
    android_version=$(echo "$device" | jq -r '.androidVersion // "Android"' 2>/dev/null) || android_version="Android"
    battery_level=$(echo "$battery" | jq -r '.batteryLevel  // 0' 2>/dev/null) || battery_level="0"
    charging=$(echo "$battery"   | jq -r '.charging     // false' 2>/dev/null) || charging="false"
    temp=$(echo "$battery"       | jq -r '.temperature  // 0' 2>/dev/null) || temp="0"

    local storage_total storage_used disk_usage
    storage_total=$(echo "$storage_info" | jq -r '.storageTotal // 1' 2>/dev/null) || storage_total="1"
    storage_used=$(echo "$storage_info"  | jq -r '.storageUsed  // 0' 2>/dev/null) || storage_used="0"
    [[ "${storage_total:-0}" -le 0 ]] && storage_total=1
    disk_usage=$(awk "BEGIN{printf \"%.1f\", ${storage_used:-0}*100/${storage_total:-1}}") || disk_usage="0"

    # Memory from /proc/meminfo
    local mem_total mem_avail mem_usage
    mem_total=$(grep -m1 '^MemTotal:'    /proc/meminfo 2>/dev/null | awk '{print $2}') || mem_total="1"
    mem_avail=$(grep -m1 '^MemAvailable:' /proc/meminfo 2>/dev/null | awk '{print $2}') || mem_avail="0"
    [[ "${mem_total:-0}" -le 0 ]] && mem_total=1
    mem_usage=$(awk "BEGIN{printf \"%.1f\", (${mem_total}-${mem_avail:-0})*100/${mem_total:-1}}") || mem_usage="0"

    # CPU — 1-second sample from /proc/stat
    local cpu_usage="0"
    if [[ -f /proc/stat ]]; then
        local s1=() s2=()
        read -ra s1 < <(grep '^cpu ' /proc/stat 2>/dev/null | head -1) || true
        sleep 1
        read -ra s2 < <(grep '^cpu ' /proc/stat 2>/dev/null | head -1) || true
        if [[ ${#s1[@]} -ge 8 && ${#s2[@]} -ge 8 ]]; then
            local t1=$(( s1[1]+s1[2]+s1[3]+s1[4]+s1[5]+s1[6]+s1[7] ))
            local t2=$(( s2[1]+s2[2]+s2[3]+s2[4]+s2[5]+s2[6]+s2[7] ))
            local dtotal=$(( t2 - t1 )) didle=$(( s2[4] - s1[4] ))
            [[ $dtotal -le 0 ]] && dtotal=1
            cpu_usage=$(awk "BEGIN{printf \"%.1f\", ($dtotal-$didle)*100/$dtotal}") || cpu_usage="0"
        fi
    fi

    local os_info="$manufacturer $model · $android_version"
    local storage_str="Total: ${storage_total}GB · Used: ${storage_used}GB"

    # Build payload with jq — all strings properly escaped, all numbers typed correctly
    payload=$(jq -n \
        --arg  st   "$TOKEN" \
        --arg  hn   "$hostname" \
        --arg  ip   "${ip_addr:-0.0.0.0}" \
        --arg  pv   "1.0.0" \
        --arg  oi   "$os_info" \
        --arg  stor "$storage_str" \
        --arg  ssid "$wifi_ssid" \
        --argjson cpu  "${cpu_usage:-0}" \
        --argjson mem  "${mem_usage:-0}" \
        --argjson disk "${disk_usage:-0}" \
        --argjson batt "${battery_level:-0}" \
        --argjson tmp  "${temp:-0}" \
        --argjson chrg "${charging:-false}" \
        '{
            siteToken:      $st,
            hostname:       $hn,
            ipAddress:      $ip,
            probeVersion:   $pv,
            osInfo:         $oi,
            cpuUsage:       $cpu,
            memoryUsage:    $mem,
            diskUsage:      $disk,
            taskQueueDepth: 0,
            activeTasks:    0,
            storageInfo:    $stor,
            softwareSummary: {
                platform:    "android",
                battery:     $batt,
                charging:    $chrg,
                temperature: $tmp,
                wifiSsid:    $ssid
            }
        }')

    log "Sending heartbeat (${#payload}B)..."
    response=$(api_call "POST" "/api/probe-heartbeat" "$payload") || response=""
    log "Heartbeat response: ${response:0:300}"

    # Process any tasks the server dispatched in this heartbeat
    [[ -n "$response" ]] && execute_pending_tasks "$response"
}

# ─── Initial enrollment / registration ───────────────────────────────────────
enroll_probe() {
    local hostname manufacturer model android_version payload response
    manufacturer=$(getprop ro.product.manufacturer 2>/dev/null || echo "Unknown") || manufacturer="Unknown"
    model=$(getprop ro.product.model 2>/dev/null || echo "Unknown") || model="Unknown"
    android_version=$(getprop ro.build.version.release 2>/dev/null || echo "Android") || android_version="Android"
    hostname=$(getprop net.hostname 2>/dev/null)
    if [[ -z "$hostname" || "$hostname" == "localhost" ]]; then
        local mfr_cap; mfr_cap="$(echo "${manufacturer:0:1}" | tr '[:lower:]' '[:upper:]')${manufacturer:1}"
        hostname="${mfr_cap} ${model}"
    fi
    [[ -z "$hostname" || "$hostname" == " " ]] && hostname="android-device"

    # Use jq to build JSON — handles ALL special characters safely
    payload=$(jq -n \
        --arg st "$TOKEN" \
        --arg hn "$hostname" \
        --arg oi "${manufacturer} ${model} - Android ${android_version}" \
        --arg pv "1.0.0" \
        --arg mf "$manufacturer" \
        --arg mo "$model" \
        '{siteToken:$st,hostname:$hn,osInfo:$oi,probeVersion:$pv,manufacturer:$mf,model:$mo,systemType:"android-mdm"}')

    log "Enrolling probe with server..."
    response=$(api_call "POST" "/api/probe-enroll" "$payload") || true
    log "Enrollment response: ${response:0:200}"
}

# ─── Termux permission check ──────────────────────────────────────────────────
check_requirements() {
    local missing=()
    command -v curl &>/dev/null || missing+=("curl")
    command -v jq &>/dev/null  || missing+=("jq")
    if [[ ${#missing[@]} -gt 0 ]]; then
        log "ERROR: Missing required packages: ${missing[*]}"
        log "Install with: pkg install -y ${missing[*]}"
        exit 1
    fi
    log "Requirements check passed"
    if ! command -v termux-battery-status &>/dev/null; then
        log "WARNING: termux-api not installed. Install for full device telemetry:"
        log "  pkg install termux-api && apt install termux-api (from F-Droid)"
    fi
}

# ─── Main loop ────────────────────────────────────────────────────────────────
main() {
    check_requirements
    enroll_probe

    local heartbeat_counter=0
    log "Starting probe loop (heartbeat every ${HEARTBEAT_INTERVAL}s, MDM poll every ${MDM_POLL_INTERVAL}s)"

    while true; do
        send_heartbeat

        if (( heartbeat_counter % (MDM_POLL_INTERVAL / HEARTBEAT_INTERVAL) == 0 )); then
            poll_mdm_actions
        fi

        heartbeat_counter=$((heartbeat_counter + 1))
        sleep "$HEARTBEAT_INTERVAL"
    done
}

main
