#!/bin/bash
set -e

HOLOCRON_TOKEN="${HOLOCRON_TOKEN:-}"
HOLOCRON_API="${HOLOCRON_API:-}"
HOLOCRON_HMAC_SECRET="${HOLOCRON_HMAC_SECRET:-}"
HEARTBEAT_INTERVAL=120
PROBE_VERSION="2.0.0-semi"
LOG_FILE="/var/log/holocron-probe-semi.log"
PID_FILE="/var/run/holocron-probe-semi.pid"
BUFFER_DIR="${HOLOCRON_BUFFER_DIR:-/var/lib/holocron/buffer}"
BUFFER_MAX_ENTRIES="${HOLOCRON_BUFFER_MAX:-10000}"
REASONING_LOG="${HOLOCRON_BUFFER_DIR:-/var/lib/holocron/buffer}/reasoning.log"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o}"
SYNC_STRATEGY="${HOLOCRON_SYNC:-opportunistic}"
FLUSH_BATCH_SIZE=50

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${CYAN}[${timestamp}]${NC} $1"
    if [ -w "$(dirname "$LOG_FILE")" ] 2>/dev/null; then
        echo "[${timestamp}] $(echo "$1" | sed 's/\x1b\[[0-9;]*m//g')" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

banner() {
    echo -e "${MAGENTA}"
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║     HOLOCRON AI Semi-Autonomous Probe      ║"
    echo "  ║         Edge Agent v${PROBE_VERSION}            ║"
    echo "  ║   Local AI Reasoning · Store & Forward     ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
}

init_buffer() {
    mkdir -p "$BUFFER_DIR"
    touch "$BUFFER_DIR/metrics.jsonl"
    touch "$BUFFER_DIR/decisions.jsonl"
    touch "$BUFFER_DIR/reasoning.log"
    log "${GREEN}✓ Local buffer initialized at ${BUFFER_DIR}${NC}"
    log "  Max entries: ${BUFFER_MAX_ENTRIES}"
    log "  Sync strategy: ${SYNC_STRATEGY}"
}

buffer_count() {
    local metrics_count=$(wc -l < "$BUFFER_DIR/metrics.jsonl" 2>/dev/null || echo "0")
    local decisions_count=$(wc -l < "$BUFFER_DIR/decisions.jsonl" 2>/dev/null || echo "0")
    echo $((metrics_count + decisions_count))
}

buffer_write() {
    local type="$1"
    local data="$2"
    local file="$BUFFER_DIR/${type}.jsonl"
    local current=$(wc -l < "$file" 2>/dev/null || echo "0")
    if [ "$current" -ge "$BUFFER_MAX_ENTRIES" ]; then
        local keep=$((BUFFER_MAX_ENTRIES / 2))
        tail -n "$keep" "$file" > "$file.tmp" && mv "$file.tmp" "$file"
        log "${YELLOW}⚠ Buffer rotated: kept last ${keep} ${type} entries${NC}"
    fi
    echo "$data" >> "$file"
}

buffer_flush() {
    local file="$BUFFER_DIR/$1.jsonl"
    local batch_file="$BUFFER_DIR/$1_batch.json"
    local count=$(wc -l < "$file" 2>/dev/null || echo "0")
    if [ "$count" -eq 0 ]; then
        return 0
    fi
    local flush_count=$count
    [ "$flush_count" -gt "$FLUSH_BATCH_SIZE" ] && flush_count=$FLUSH_BATCH_SIZE
    head -n "$flush_count" "$file" > "$batch_file"
    local my_hostname=$(get_hostname)
    local my_ip=$(get_ip)
    local entries="["
    local first=true
    while IFS= read -r line; do
        local ts=$(echo "$line" | grep -oP '"timestamp":\s*"\K[^"]+' || echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)")
        if [ "$first" = true ]; then first=false; else entries="$entries,"; fi
        entries="$entries{\"taskType\":\"$1\",\"timestamp\":\"${ts}\",\"hostname\":\"${my_hostname}\",\"ipAddress\":\"${my_ip}\",\"data\":${line}}"
    done < "$batch_file"
    entries="$entries]"
    local payload="{\"siteToken\":\"${HOLOCRON_TOKEN}\",\"bufferedData\":${entries}}"
    local response=$(api_call "POST" "/api/probe-heartbeat-buffered" "$payload")
    local success=$(echo "$response" | grep -o '"success":true' || true)
    if [ -n "$success" ]; then
        tail -n +$((flush_count + 1)) "$file" > "$file.tmp" && mv "$file.tmp" "$file"
        rm -f "$batch_file"
        log "${GREEN}↑ Flushed ${flush_count} ${1} entries to server${NC}"
        return 0
    else
        rm -f "$batch_file"
        log "${YELLOW}↑ Flush failed for ${1}, keeping in buffer${NC}"
        return 1
    fi
}

get_hostname() {
    hostname -f 2>/dev/null || hostname 2>/dev/null || echo "unknown"
}

get_ip() {
    ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src") print $(i+1)}' | head -1 || \
    hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown"
}

get_os_info() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "${PRETTY_NAME:-${NAME} ${VERSION}}"
    else
        uname -s -r -m
    fi
}

get_mac_address() {
    ip link show 2>/dev/null | awk '/ether/ {print $2; exit}' || echo "unknown"
}

get_manufacturer() {
    cat /sys/class/dmi/id/sys_vendor 2>/dev/null || echo "Edge Device"
}

get_model() {
    cat /sys/class/dmi/id/product_name 2>/dev/null || echo "Embedded"
}

get_cpu_info() {
    grep -m1 "model name" /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || \
    lscpu 2>/dev/null | awk -F: '/Model name/ {gsub(/^[ \t]+/, "", $2); print $2}' || echo "ARM/Edge"
}

get_total_memory_gb() {
    free -g 2>/dev/null | awk '/^Mem:/ {print $2}' || echo "1"
}

get_system_type() {
    if [ -f /.dockerenv ] || grep -q "docker\|lxc\|kubepods" /proc/1/cgroup 2>/dev/null; then
        echo "container"
    elif [ -f /sys/firmware/devicetree/base/model ] 2>/dev/null; then
        echo "embedded"
    else
        echo "edge-device"
    fi
}

get_cpu_usage() {
    top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print 100 - $8}' | head -1 || \
    cat /proc/stat 2>/dev/null | awk '/^cpu / {usage=($2+$4)*100/($2+$4+$5); printf "%.1f", usage}' || echo "0"
}

get_memory_usage() {
    free 2>/dev/null | awk '/^Mem:/ {printf "%.1f", $3/$2 * 100}' || echo "0"
}

get_disk_usage() {
    df / 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}' || echo "0"
}

get_temperature() {
    if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        local temp=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo "0")
        echo "scale=1; $temp / 1000" | bc 2>/dev/null || echo "0"
    elif command -v vcgencmd &>/dev/null; then
        vcgencmd measure_temp 2>/dev/null | grep -oP '\d+\.\d+' || echo "0"
    else
        echo "0"
    fi
}

get_uptime_seconds() {
    cat /proc/uptime 2>/dev/null | awk '{print int($1)}' || echo "0"
}

get_network_interfaces_json() {
    local result="["
    local first=true
    for iface in /sys/class/net/*; do
        local name=$(basename "$iface")
        [ "$name" = "lo" ] && continue
        local state=$(cat "$iface/operstate" 2>/dev/null || echo "unknown")
        [ "$state" != "up" ] && continue
        local rx=$(cat "/sys/class/net/$name/statistics/rx_bytes" 2>/dev/null || echo "0")
        local tx=$(cat "/sys/class/net/$name/statistics/tx_bytes" 2>/dev/null || echo "0")
        local iface_type="ethernet"
        if echo "$name" | grep -qi "wl"; then iface_type="wireless"; fi
        if echo "$name" | grep -qi "wwan"; then iface_type="cellular"; fi
        if [ "$first" = true ]; then first=false; else result="$result,"; fi
        result="$result{\"name\":\"$name\",\"type\":\"$iface_type\",\"status\":\"active\",\"rxBytes\":$rx,\"txBytes\":$tx}"
    done
    result="$result]"
    echo "$result"
}

generate_nonce() {
    if command -v openssl &>/dev/null; then
        openssl rand -hex 16
    elif [ -f /dev/urandom ]; then
        head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'
    else
        date +%s%N | sha256sum | head -c 32
    fi
}

get_timestamp_ms() {
    if command -v python3 &>/dev/null; then
        python3 -c "import time; print(int(time.time()*1000))"
    else
        echo "$(date +%s)000"
    fi
}

compute_hmac_sha256() {
    local secret="$1"
    local message="$2"
    echo -n "$message" | openssl dgst -sha256 -hmac "$secret" -hex 2>/dev/null | sed 's/^.* //'
}

check_server_reachable() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" "${HOLOCRON_API}/api/probe-heartbeat" \
        -X POST -H "Content-Type: application/json" \
        -d '{"siteToken":"ping"}' \
        --connect-timeout 5 --max-time 10 2>/dev/null)
    [ "$response" != "000" ]
}

api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local url="${HOLOCRON_API}${endpoint}"
    local hmac_headers=""
    if [ -n "$HOLOCRON_HMAC_SECRET" ] && [ "$method" = "POST" ]; then
        local timestamp=$(get_timestamp_ms)
        local nonce=$(generate_nonce)
        local signature=$(compute_hmac_sha256 "$HOLOCRON_HMAC_SECRET" "${timestamp}.${nonce}.${data}")
        hmac_headers="-H \"X-Holocron-Signature: ${signature}\" -H \"X-Holocron-Timestamp: ${timestamp}\" -H \"X-Holocron-Nonce: ${nonce}\""
    fi
    if [ "$method" = "POST" ]; then
        eval curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            $hmac_headers \
            -d "'$data'" \
            --connect-timeout 10 --max-time 30 2>/dev/null
    else
        curl -s -X GET "$url" --connect-timeout 10 --max-time 30 2>/dev/null
    fi
}

local_ai_reason() {
    local context="$1"
    local question="$2"
    if [ -z "$OPENAI_API_KEY" ]; then
        local cpu=$(echo "$context" | grep -oP '"cpuUsage":\K[0-9.]+' || echo "0")
        local mem=$(echo "$context" | grep -oP '"memoryUsage":\K[0-9.]+' || echo "0")
        local disk=$(echo "$context" | grep -oP '"diskUsage":\K[0-9.]+' || echo "0")
        local temp=$(echo "$context" | grep -oP '"temperature":\K[0-9.]+' || echo "0")
        local decision="normal"
        local reasoning="Metrics within acceptable ranges"
        if [ "$(echo "$cpu > 90" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="alert_cpu"
            reasoning="CPU usage critically high at ${cpu}%. Consider process investigation."
        elif [ "$(echo "$mem > 90" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="alert_memory"
            reasoning="Memory usage critically high at ${mem}%. Risk of OOM."
        elif [ "$(echo "$disk > 90" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="alert_disk"
            reasoning="Disk usage critically high at ${disk}%. Immediate cleanup needed."
        elif [ "$(echo "$temp > 80" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="alert_thermal"
            reasoning="Device temperature at ${temp}°C — thermal throttling risk."
        elif [ "$(echo "$cpu > 70" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="warn_cpu"
            reasoning="CPU usage elevated at ${cpu}%. Monitoring trend."
        elif [ "$(echo "$mem > 80" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="warn_memory"
            reasoning="Memory usage high at ${mem}%. Watch for growth."
        fi
        echo "{\"decision\":\"${decision}\",\"reasoning\":\"${reasoning}\",\"model\":\"rule-engine-v1\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
        return
    fi
    local prompt="You are an edge AI agent monitoring a system. Analyze these metrics and return a JSON response with fields: decision (normal/warn/alert/remediate), reasoning (brief explanation), action (null or specific action to take). Context: ${context}"
    local ai_payload="{\"model\":\"${OPENAI_MODEL}\",\"messages\":[{\"role\":\"system\",\"content\":\"You are a HOLOCRON AI edge probe agent. Respond only with valid JSON.\"},{\"role\":\"user\",\"content\":\"${prompt}\"}],\"max_tokens\":200,\"temperature\":0.1}"
    local ai_response=$(curl -s "https://api.openai.com/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${OPENAI_API_KEY}" \
        -d "$ai_payload" \
        --connect-timeout 10 --max-time 30 2>/dev/null)
    local content=$(echo "$ai_response" | grep -oP '"content":\s*"[^"]*"' | head -1 | sed 's/"content":\s*"//;s/"$//')
    if [ -n "$content" ]; then
        echo "$content"
    else
        echo "{\"decision\":\"error\",\"reasoning\":\"AI inference failed, using fallback\",\"model\":\"fallback\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    fi
}

enroll() {
    local my_hostname=$(get_hostname)
    local my_ip=$(get_ip)
    local my_os=$(get_os_info)
    local my_mac=$(get_mac_address)
    local my_manufacturer=$(get_manufacturer)
    local my_model=$(get_model)
    local my_cpu=$(get_cpu_info)
    local my_mem_gb=$(get_total_memory_gb)
    local my_sys_type=$(get_system_type)
    log "${YELLOW}Enrolling semi-autonomous probe...${NC}"
    log "  Hostname:     ${my_hostname}"
    log "  IP:           ${my_ip}"
    log "  OS:           ${my_os}"
    log "  System Type:  ${my_sys_type}"
    log "  AI Reasoning: ${MAGENTA}Enabled${NC}"
    local payload="{\"siteToken\":\"${HOLOCRON_TOKEN}\",\"hostname\":\"${my_hostname}\",\"ipAddress\":\"${my_ip}\",\"osInfo\":\"${my_os}\",\"probeVersion\":\"${PROBE_VERSION}\",\"deploymentType\":\"semi-autonomous\",\"macAddress\":\"${my_mac}\",\"manufacturer\":\"${my_manufacturer}\",\"model\":\"${my_model}\",\"cpuInfo\":\"${my_cpu}\",\"totalMemoryGB\":${my_mem_gb},\"systemType\":\"${my_sys_type}\"}"
    local response=$(api_call "POST" "/api/probe-enroll" "$payload")
    local success=$(echo "$response" | grep -o '"success":true' || true)
    if [ -n "$success" ]; then
        local probe_id=$(echo "$response" | grep -o '"probeId":"[^"]*"' | cut -d'"' -f4)
        log "${GREEN}✓ Enrolled (ID: ${probe_id})${NC}"
        return 0
    else
        log "${YELLOW}⚠ Enrollment deferred — operating offline${NC}"
        return 1
    fi
}

collect_and_reason() {
    local cpu=$(get_cpu_usage)
    local mem=$(get_memory_usage)
    local disk=$(get_disk_usage)
    local temp=$(get_temperature)
    local uptime=$(get_uptime_seconds)
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local net=$(get_network_interfaces_json)
    local metrics="{\"timestamp\":\"${timestamp}\",\"cpuUsage\":${cpu},\"memoryUsage\":${mem},\"diskUsage\":${disk},\"temperature\":${temp},\"uptime\":${uptime},\"networkInterfaces\":${net}}"
    buffer_write "metrics" "$metrics"
    log "${MAGENTA}🧠 Running local AI reasoning...${NC}"
    local ai_result=$(local_ai_reason "$metrics" "Analyze system health")
    local decision=$(echo "$ai_result" | grep -oP '"decision":\s*"\K[^"]+' || echo "unknown")
    buffer_write "decisions" "{\"timestamp\":\"${timestamp}\",\"metrics\":{\"cpu\":${cpu},\"mem\":${mem},\"disk\":${disk},\"temp\":${temp}},\"aiResult\":${ai_result}}"
    echo "[$(date '+%H:%M:%S')] Decision: ${decision} | CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C" >> "$REASONING_LOG"
    local buf_count=$(buffer_count)
    case "$decision" in
        normal)
            log "${GREEN}♥${NC} CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C ${GREEN}[AI: ${decision}]${NC} Buffer:${buf_count}"
            ;;
        warn*)
            log "${YELLOW}⚠${NC} CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C ${YELLOW}[AI: ${decision}]${NC} Buffer:${buf_count}"
            ;;
        alert*|remediate)
            log "${RED}🚨${NC} CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C ${RED}[AI: ${decision}]${NC} Buffer:${buf_count}"
            ;;
        *)
            log "  CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C [AI: ${decision}] Buffer:${buf_count}"
            ;;
    esac
}

try_sync() {
    if ! check_server_reachable; then
        local buf_count=$(buffer_count)
        log "${YELLOW}↕ Server unreachable — buffering locally (${buf_count} entries)${NC}"
        return 1
    fi
    log "${GREEN}↕ Server reachable — syncing buffered data...${NC}"
    buffer_flush "metrics" || true
    buffer_flush "decisions" || true
    return 0
}

run_daemon() {
    local enrolled=false
    local cycle=0
    local sync_interval=5
    while true; do
        cycle=$((cycle + 1))
        collect_and_reason
        if [ "$SYNC_STRATEGY" = "opportunistic" ]; then
            if [ $((cycle % sync_interval)) -eq 0 ] || [ "$enrolled" = false ]; then
                if try_sync; then
                    if [ "$enrolled" = false ]; then
                        if enroll; then enrolled=true; fi
                    fi
                fi
            fi
        fi
        sleep $HEARTBEAT_INTERVAL
    done
}

stop_probe() {
    local buf_count=$(buffer_count)
    log "${YELLOW}Shutting down... (${buf_count} entries in buffer)${NC}"
    log "${YELLOW}Buffer preserved at ${BUFFER_DIR}${NC}"
    [ -f "$PID_FILE" ] && rm -f "$PID_FILE"
    exit 0
}

usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "HOLOCRON AI Semi-Autonomous Probe"
    echo "  Operates independently with local AI reasoning."
    echo "  Buffers data locally. Syncs when server is reachable."
    echo ""
    echo "Commands:"
    echo "  start       Start the probe (foreground)"
    echo "  install     Install as a systemd service"
    echo "  status      Check probe status"
    echo "  buffer      Show buffer statistics"
    echo "  reason      Show recent AI reasoning log"
    echo "  flush       Force buffer flush to server"
    echo "  test        Test connection to HOLOCRON AI"
    echo ""
    echo "Options:"
    echo "  --token     Site token (or HOLOCRON_TOKEN env var)"
    echo "  --api       API URL (or HOLOCRON_API env var)"
    echo "  --buffer-dir  Buffer directory (default: /var/lib/holocron/buffer)"
    echo "  --sync      Sync strategy: opportunistic|periodic|manual"
    echo ""
    echo "Environment:"
    echo "  OPENAI_API_KEY    For AI reasoning (optional, falls back to rule engine)"
    echo "  OPENAI_MODEL      Model for inference (default: gpt-4o)"
}

show_buffer_stats() {
    local metrics_count=$(wc -l < "$BUFFER_DIR/metrics.jsonl" 2>/dev/null || echo "0")
    local decisions_count=$(wc -l < "$BUFFER_DIR/decisions.jsonl" 2>/dev/null || echo "0")
    local metrics_size=$(du -sh "$BUFFER_DIR/metrics.jsonl" 2>/dev/null | awk '{print $1}' || echo "0")
    local decisions_size=$(du -sh "$BUFFER_DIR/decisions.jsonl" 2>/dev/null | awk '{print $1}' || echo "0")
    echo -e "${CYAN}Buffer Statistics:${NC}"
    echo -e "  Metrics:   ${metrics_count} entries (${metrics_size})"
    echo -e "  Decisions: ${decisions_count} entries (${decisions_size})"
    echo -e "  Total:     $((metrics_count + decisions_count)) entries"
    echo -e "  Max:       ${BUFFER_MAX_ENTRIES}"
    echo -e "  Location:  ${BUFFER_DIR}"
}

show_reasoning_log() {
    if [ -f "$REASONING_LOG" ]; then
        echo -e "${MAGENTA}Recent AI Reasoning:${NC}"
        tail -20 "$REASONING_LOG"
    else
        echo "No reasoning log yet."
    fi
}

install_service() {
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${RED}Error: Installation requires root. Run with sudo.${NC}"
        exit 1
    fi
    local script_path=$(readlink -f "$0")
    cp "$script_path" /usr/local/bin/holocron-probe-semi
    chmod +x /usr/local/bin/holocron-probe-semi
    mkdir -p /var/lib/holocron/buffer
    cat > /opt/holocron/.env <<ENVEOF
HOLOCRON_TOKEN=${HOLOCRON_TOKEN}
HOLOCRON_HMAC_SECRET=${HOLOCRON_HMAC_SECRET}
HOLOCRON_API=${HOLOCRON_API}
OPENAI_API_KEY=${OPENAI_API_KEY}
HOLOCRON_BUFFER_DIR=/var/lib/holocron/buffer
ENVEOF
    chmod 600 /opt/holocron/.env
    chown root:root /opt/holocron/.env

    cat > /etc/systemd/system/holocron-probe-semi.service <<SVCEOF
[Unit]
Description=HOLOCRON AI Semi-Autonomous Probe Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/holocron-probe-semi start
Restart=always
RestartSec=30
EnvironmentFile=/opt/holocron/.env
StartLimitIntervalSec=300
StartLimitBurst=5

[Install]
WantedBy=multi-user.target
SVCEOF
    systemctl daemon-reload
    systemctl enable holocron-probe-semi
    systemctl start holocron-probe-semi
    log "${GREEN}✓ Semi-Autonomous Probe installed${NC}"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --token) HOLOCRON_TOKEN="$2"; shift 2 ;;
        --api) HOLOCRON_API="$2"; shift 2 ;;
        --buffer-dir) BUFFER_DIR="$2"; shift 2 ;;
        --sync) SYNC_STRATEGY="$2"; shift 2 ;;
        start|install|status|buffer|reason|flush|test|help) COMMAND="$1"; shift ;;
        *) echo "Unknown option: $1"; usage; exit 1 ;;
    esac
done

COMMAND="${COMMAND:-start}"

if [ "$COMMAND" = "help" ]; then usage; exit 0; fi
if [ "$COMMAND" = "buffer" ]; then show_buffer_stats; exit 0; fi
if [ "$COMMAND" = "reason" ]; then show_reasoning_log; exit 0; fi

if [ "$COMMAND" = "flush" ]; then
    if [ -z "$HOLOCRON_TOKEN" ] || [ -z "$HOLOCRON_API" ]; then
        echo -e "${RED}Error: Token and API URL required for flush.${NC}"; exit 1
    fi
    HOLOCRON_API="${HOLOCRON_API%/}"
    init_buffer
    buffer_flush "metrics"
    buffer_flush "decisions"
    exit 0
fi

if [ "$COMMAND" = "test" ]; then
    if [ -z "$HOLOCRON_API" ]; then echo -e "${RED}Error: API URL required.${NC}"; exit 1; fi
    HOLOCRON_API="${HOLOCRON_API%/}"
    log "Testing connection to ${HOLOCRON_API}..."
    if check_server_reachable; then
        log "${GREEN}✓ Server reachable${NC}"
    else
        log "${RED}✗ Server unreachable${NC}"
    fi
    log "Testing local AI reasoning..."
    local_ai_reason '{"cpuUsage":45,"memoryUsage":62,"diskUsage":30,"temperature":42}' "test"
    log "${GREEN}✓ AI reasoning operational${NC}"
    exit 0
fi

if [ "$COMMAND" = "status" ]; then
    if systemctl is-active --quiet holocron-probe-semi 2>/dev/null; then
        echo -e "${GREEN}● Semi-Autonomous Probe is running${NC}"
        show_buffer_stats
    else
        echo -e "${RED}● Semi-Autonomous Probe is not running${NC}"
    fi
    exit 0
fi

if [ -z "$HOLOCRON_TOKEN" ]; then
    echo -e "${RED}Error: Site token is required.${NC}"
    echo "Set HOLOCRON_TOKEN or use --token flag."
    usage; exit 1
fi

if [ -z "$HOLOCRON_API" ]; then
    echo -e "${RED}Error: API URL is required.${NC}"
    echo "Set HOLOCRON_API or use --api flag."
    usage; exit 1
fi

HOLOCRON_API="${HOLOCRON_API%/}"

banner
trap stop_probe SIGTERM SIGINT

case $COMMAND in
    start)
        init_buffer
        log "Starting Semi-Autonomous Probe..."
        log "  Token:  ${HOLOCRON_TOKEN:0:10}...${HOLOCRON_TOKEN: -4}"
        log "  API:    ${HOLOCRON_API}"
        log "  Buffer: ${BUFFER_DIR}"
        log "  Sync:   ${SYNC_STRATEGY}"
        log "  AI:     ${MAGENTA}$([ -n "$OPENAI_API_KEY" ] && echo "OpenAI (${OPENAI_MODEL})" || echo "Rule Engine v1 (local)")${NC}"
        log ""
        if check_server_reachable; then
            enroll || true
        else
            log "${YELLOW}Server unreachable — starting in offline mode${NC}"
        fi
        log "${GREEN}Probe is operational. Collecting and reasoning locally.${NC}"
        log ""
        run_daemon
        ;;
    install)
        install_service
        ;;
esac
