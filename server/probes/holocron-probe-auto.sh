#!/bin/bash
set -e

HOLOCRON_TOKEN="${HOLOCRON_TOKEN:-}"
HOLOCRON_API="${HOLOCRON_API:-}"
HOLOCRON_HMAC_SECRET="${HOLOCRON_HMAC_SECRET:-}"
HEARTBEAT_INTERVAL=300
PROBE_VERSION="2.0.0-auto"
LOG_FILE="/var/log/holocron-probe-auto.log"
PID_FILE="/var/run/holocron-probe-auto.pid"
DATA_DIR="${HOLOCRON_DATA_DIR:-/var/lib/holocron/autonomous}"
REASONING_LOG="${DATA_DIR}/reasoning.log"
DECISIONS_LOG="${DATA_DIR}/decisions.jsonl"
METRICS_LOG="${DATA_DIR}/metrics.jsonl"
ACTIONS_LOG="${DATA_DIR}/actions.jsonl"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o}"
REMEDIATION_ENABLED="${HOLOCRON_REMEDIATION:-true}"
MAX_LOG_ENTRIES=50000

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${CYAN}[${timestamp}]${NC} $1"
    if [ -w "$(dirname "$LOG_FILE")" ] 2>/dev/null; then
        echo "[${timestamp}] $(echo "$1" | sed 's/\x1b\[[0-9;]*m//g')" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

banner() {
    echo -e "${MAGENTA}${BOLD}"
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║    HOLOCRON AI Fully Autonomous Probe      ║"
    echo "  ║         Edge Agent v${PROBE_VERSION}            ║"
    echo "  ║   Local AI · Self-Healing · Independent    ║"
    echo "  ║          Zero Server Dependency            ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
}

init_data() {
    mkdir -p "$DATA_DIR"
    touch "$METRICS_LOG" "$DECISIONS_LOG" "$ACTIONS_LOG" "$REASONING_LOG"
    log "${GREEN}✓ Autonomous data store initialized at ${DATA_DIR}${NC}"
    log "  Max log entries: ${MAX_LOG_ENTRIES}"
    log "  Self-remediation: ${REMEDIATION_ENABLED}"
}

rotate_log() {
    local file="$1"
    local count=$(wc -l < "$file" 2>/dev/null || echo "0")
    if [ "$count" -ge "$MAX_LOG_ENTRIES" ]; then
        local keep=$((MAX_LOG_ENTRIES / 2))
        tail -n "$keep" "$file" > "$file.tmp" && mv "$file.tmp" "$file"
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
    cat /sys/class/dmi/id/sys_vendor 2>/dev/null || echo "Autonomous Node"
}

get_model() {
    cat /sys/class/dmi/id/product_name 2>/dev/null || echo "Container"
}

get_cpu_info() {
    grep -m1 "model name" /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo "Edge CPU"
}

get_total_memory_gb() {
    free -g 2>/dev/null | awk '/^Mem:/ {print $2}' || echo "4"
}

get_system_type() {
    if [ -f /.dockerenv ] || grep -q "docker\|lxc\|kubepods" /proc/1/cgroup 2>/dev/null; then
        echo "container"
    else
        echo "autonomous-node"
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

get_process_count() {
    ls /proc/[0-9]*/stat 2>/dev/null | wc -l || echo "0"
}

get_load_average() {
    cat /proc/loadavg 2>/dev/null | awk '{print $1}' || echo "0"
}

get_open_files() {
    cat /proc/sys/fs/file-nr 2>/dev/null | awk '{print $1}' || echo "0"
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
    local cpu=$(echo "$context" | grep -oP '"cpuUsage":\K[0-9.]+' || echo "0")
    local mem=$(echo "$context" | grep -oP '"memoryUsage":\K[0-9.]+' || echo "0")
    local disk=$(echo "$context" | grep -oP '"diskUsage":\K[0-9.]+' || echo "0")
    local temp=$(echo "$context" | grep -oP '"temperature":\K[0-9.]+' || echo "0")
    local load=$(echo "$context" | grep -oP '"loadAverage":\K[0-9.]+' || echo "0")
    if [ -z "$OPENAI_API_KEY" ]; then
        local decision="normal"
        local reasoning="All systems nominal"
        local action="null"
        if [ "$(echo "$cpu > 95" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="remediate"
            reasoning="CPU critically high at ${cpu}%. Identifying top processes for termination."
            action="kill_top_cpu_process"
        elif [ "$(echo "$mem > 95" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="remediate"
            reasoning="Memory critically high at ${mem}%. Clearing caches and restarting non-essential services."
            action="clear_memory"
        elif [ "$(echo "$disk > 95" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="remediate"
            reasoning="Disk critically full at ${disk}%. Purging old logs and temp files."
            action="cleanup_disk"
        elif [ "$(echo "$temp > 85" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="remediate"
            reasoning="Thermal emergency at ${temp}°C. Throttling workload."
            action="throttle_workload"
        elif [ "$(echo "$cpu > 80" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="alert"
            reasoning="CPU usage elevated at ${cpu}%. Monitoring trend for potential remediation."
            action="null"
        elif [ "$(echo "$mem > 85" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="alert"
            reasoning="Memory pressure at ${mem}%. May need intervention soon."
            action="null"
        elif [ "$(echo "$disk > 85" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="warn"
            reasoning="Disk usage at ${disk}%. Plan for cleanup."
            action="null"
        elif [ "$(echo "$temp > 75" | bc 2>/dev/null || echo 0)" = "1" ]; then
            decision="warn"
            reasoning="Temperature elevated at ${temp}°C. Monitoring."
            action="null"
        fi
        echo "{\"decision\":\"${decision}\",\"reasoning\":\"${reasoning}\",\"action\":${action},\"model\":\"rule-engine-v2-auto\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
        return
    fi
    local prompt="You are HOLOCRON AI autonomous probe agent running on an edge device with NO server connectivity. You must decide and act independently. Analyze metrics and respond with JSON: {decision: normal|warn|alert|remediate, reasoning: string, action: null|kill_top_cpu_process|clear_memory|cleanup_disk|throttle_workload|restart_service}. Metrics: ${context}"
    local ai_payload="{\"model\":\"${OPENAI_MODEL}\",\"messages\":[{\"role\":\"system\",\"content\":\"You are an autonomous HOLOCRON AI edge agent. You operate independently without server contact. Make decisions and recommend actions. Respond with valid JSON only.\"},{\"role\":\"user\",\"content\":\"${prompt}\"}],\"max_tokens\":300,\"temperature\":0.1}"
    local ai_response=$(curl -s "https://api.openai.com/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${OPENAI_API_KEY}" \
        -d "$ai_payload" \
        --connect-timeout 10 --max-time 30 2>/dev/null)
    local content=$(echo "$ai_response" | grep -oP '"content":\s*"[^"]*"' | head -1 | sed 's/"content":\s*"//;s/"$//')
    if [ -n "$content" ]; then
        echo "$content"
    else
        echo "{\"decision\":\"normal\",\"reasoning\":\"AI inference unavailable, rule engine fallback active\",\"action\":null,\"model\":\"fallback\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    fi
}

execute_remediation() {
    local action="$1"
    local reasoning="$2"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    if [ "$REMEDIATION_ENABLED" != "true" ]; then
        log "${YELLOW}  ↳ Remediation disabled. Action '${action}' logged but not executed.${NC}"
        echo "{\"timestamp\":\"${timestamp}\",\"action\":\"${action}\",\"status\":\"skipped\",\"reason\":\"remediation_disabled\"}" >> "$ACTIONS_LOG"
        return
    fi
    log "${MAGENTA}  ↳ Executing self-remediation: ${action}${NC}"
    local result="success"
    case "$action" in
        kill_top_cpu_process)
            local top_pid=$(ps aux --sort=-%cpu 2>/dev/null | awk 'NR==2 {print $2}')
            local top_cmd=$(ps aux --sort=-%cpu 2>/dev/null | awk 'NR==2 {print $11}')
            if [ -n "$top_pid" ] && [ "$top_pid" != "1" ]; then
                log "${YELLOW}    Killing PID ${top_pid} (${top_cmd})${NC}"
                kill "$top_pid" 2>/dev/null || result="failed"
            else
                result="skipped_safe"
            fi
            ;;
        clear_memory)
            if [ -f /proc/sys/vm/drop_caches ]; then
                echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || result="no_permission"
                log "${GREEN}    Cleared page cache, dentries, and inodes${NC}"
            else
                result="not_available"
            fi
            ;;
        cleanup_disk)
            local freed=0
            if [ -d /tmp ]; then
                local before=$(du -sm /tmp 2>/dev/null | awk '{print $1}' || echo "0")
                find /tmp -type f -atime +1 -delete 2>/dev/null || true
                local after=$(du -sm /tmp 2>/dev/null | awk '{print $1}' || echo "0")
                freed=$((before - after))
            fi
            find /var/log -name "*.gz" -delete 2>/dev/null || true
            find /var/log -name "*.old" -delete 2>/dev/null || true
            log "${GREEN}    Cleaned temp files and old logs (freed ~${freed}MB)${NC}"
            ;;
        throttle_workload)
            log "${YELLOW}    Reducing process priorities to lower thermal output${NC}"
            for pid in $(ps aux --sort=-%cpu 2>/dev/null | awk 'NR>1 && NR<=5 {print $2}'); do
                renice +10 "$pid" 2>/dev/null || true
            done
            ;;
        *)
            log "${YELLOW}    Unknown action: ${action}${NC}"
            result="unknown_action"
            ;;
    esac
    echo "{\"timestamp\":\"${timestamp}\",\"action\":\"${action}\",\"status\":\"${result}\",\"reasoning\":\"${reasoning}\"}" >> "$ACTIONS_LOG"
    rotate_log "$ACTIONS_LOG"
    log "${GREEN}    Remediation complete: ${result}${NC}"
}

enroll_if_possible() {
    if [ -z "$HOLOCRON_API" ]; then return 1; fi
    local response=$(curl -s -o /dev/null -w "%{http_code}" "${HOLOCRON_API}/api/probe-heartbeat" \
        -X POST -H "Content-Type: application/json" \
        -d '{"siteToken":"ping"}' \
        --connect-timeout 3 --max-time 5 2>/dev/null)
    if [ "$response" = "000" ]; then return 1; fi
    local my_hostname=$(get_hostname)
    local my_ip=$(get_ip)
    local my_os=$(get_os_info)
    local payload="{\"siteToken\":\"${HOLOCRON_TOKEN}\",\"hostname\":\"${my_hostname}\",\"ipAddress\":\"${my_ip}\",\"osInfo\":\"${my_os}\",\"probeVersion\":\"${PROBE_VERSION}\",\"deploymentType\":\"autonomous\",\"macAddress\":\"$(get_mac_address)\",\"manufacturer\":\"$(get_manufacturer)\",\"model\":\"$(get_model)\",\"cpuInfo\":\"$(get_cpu_info)\",\"totalMemoryGB\":$(get_total_memory_gb),\"systemType\":\"$(get_system_type)\"}"
    local response=$(api_call "POST" "/api/probe-enroll" "$payload")
    local success=$(echo "$response" | grep -o '"success":true' || true)
    if [ -n "$success" ]; then
        log "${GREEN}✓ Registered with server (optional sync enabled)${NC}"
        return 0
    fi
    return 1
}

collect_reason_act() {
    local cpu=$(get_cpu_usage)
    local mem=$(get_memory_usage)
    local disk=$(get_disk_usage)
    local temp=$(get_temperature)
    local uptime=$(get_uptime_seconds)
    local load=$(get_load_average)
    local procs=$(get_process_count)
    local open_files=$(get_open_files)
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local net=$(get_network_interfaces_json)
    local metrics="{\"timestamp\":\"${timestamp}\",\"cpuUsage\":${cpu},\"memoryUsage\":${mem},\"diskUsage\":${disk},\"temperature\":${temp},\"uptime\":${uptime},\"loadAverage\":${load},\"processCount\":${procs},\"openFiles\":${open_files},\"networkInterfaces\":${net}}"
    echo "$metrics" >> "$METRICS_LOG"
    rotate_log "$METRICS_LOG"
    log "${MAGENTA}🧠 Autonomous reasoning cycle...${NC}"
    local ai_result=$(local_ai_reason "$metrics")
    local decision=$(echo "$ai_result" | grep -oP '"decision":\s*"\K[^"]+' || echo "unknown")
    local reasoning=$(echo "$ai_result" | grep -oP '"reasoning":\s*"\K[^"]+' || echo "")
    local action=$(echo "$ai_result" | grep -oP '"action":\s*"\K[^"]+' || echo "")
    echo "{\"timestamp\":\"${timestamp}\",\"metrics\":{\"cpu\":${cpu},\"mem\":${mem},\"disk\":${disk},\"temp\":${temp},\"load\":${load}},\"decision\":\"${decision}\",\"reasoning\":\"${reasoning}\",\"action\":\"${action}\"}" >> "$DECISIONS_LOG"
    rotate_log "$DECISIONS_LOG"
    echo "[$(date '+%H:%M:%S')] ${decision} | CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C Load:${load} | ${reasoning}" >> "$REASONING_LOG"
    rotate_log "$REASONING_LOG"
    local metrics_total=$(wc -l < "$METRICS_LOG" 2>/dev/null || echo "0")
    local actions_total=$(wc -l < "$ACTIONS_LOG" 2>/dev/null || echo "0")
    case "$decision" in
        normal)
            log "${GREEN}♥${NC} CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C Load:${load} ${GREEN}[AI: OK]${NC} (${metrics_total} metrics, ${actions_total} actions)"
            ;;
        warn*)
            log "${YELLOW}⚠${NC} CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C ${YELLOW}[AI: ${decision}]${NC} — ${reasoning}"
            ;;
        alert*)
            log "${RED}🚨${NC} CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C ${RED}[AI: ${decision}]${NC} — ${reasoning}"
            ;;
        remediate)
            log "${RED}${BOLD}🔧${NC} CPU:${cpu}% Mem:${mem}% Disk:${disk}% Temp:${temp}°C ${RED}[AI: REMEDIATE]${NC} — ${reasoning}"
            if [ -n "$action" ] && [ "$action" != "null" ]; then
                execute_remediation "$action" "$reasoning"
            fi
            ;;
    esac
}

run_daemon() {
    local cycle=0
    while true; do
        cycle=$((cycle + 1))
        collect_reason_act
        sleep $HEARTBEAT_INTERVAL
    done
}

stop_probe() {
    local metrics_total=$(wc -l < "$METRICS_LOG" 2>/dev/null || echo "0")
    local decisions_total=$(wc -l < "$DECISIONS_LOG" 2>/dev/null || echo "0")
    local actions_total=$(wc -l < "$ACTIONS_LOG" 2>/dev/null || echo "0")
    log "${YELLOW}Shutting down autonomous probe...${NC}"
    log "  Metrics collected:  ${metrics_total}"
    log "  Decisions made:     ${decisions_total}"
    log "  Actions taken:      ${actions_total}"
    log "  Data preserved at:  ${DATA_DIR}"
    [ -f "$PID_FILE" ] && rm -f "$PID_FILE"
    exit 0
}

usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "HOLOCRON AI Fully Autonomous Probe"
    echo "  Operates independently with zero server dependency."
    echo "  Local AI reasoning. Self-healing. Self-deciding."
    echo "  May never reconnect to the server."
    echo ""
    echo "Commands:"
    echo "  start       Start the autonomous probe (foreground)"
    echo "  install     Install as a systemd service"
    echo "  status      Check probe status and statistics"
    echo "  reason      Show recent AI reasoning decisions"
    echo "  actions     Show remediation action history"
    echo "  metrics     Show recent collected metrics"
    echo "  test        Test AI reasoning with current system state"
    echo ""
    echo "Options:"
    echo "  --token     Site token (optional — for initial registration)"
    echo "  --api       API URL (optional — for initial registration)"
    echo "  --data-dir  Data directory (default: /var/lib/holocron/autonomous)"
    echo "  --no-remediate  Disable self-remediation (log only)"
    echo ""
    echo "Environment:"
    echo "  OPENAI_API_KEY    For AI reasoning (optional, rule engine fallback)"
    echo "  OPENAI_MODEL      Model for inference (default: gpt-4o)"
    echo ""
    echo "Note: This probe does NOT require a server. It operates fully"
    echo "independently once started. Server token/API are optional for"
    echo "initial registration only."
}

show_reasoning() {
    if [ -f "$REASONING_LOG" ]; then
        echo -e "${MAGENTA}Recent Autonomous Decisions (last 30):${NC}"
        tail -30 "$REASONING_LOG"
    else
        echo "No reasoning log yet."
    fi
}

show_actions() {
    if [ -f "$ACTIONS_LOG" ]; then
        local count=$(wc -l < "$ACTIONS_LOG" 2>/dev/null || echo "0")
        echo -e "${RED}Remediation Action History (${count} total, last 20):${NC}"
        tail -20 "$ACTIONS_LOG"
    else
        echo "No actions taken yet."
    fi
}

show_metrics() {
    if [ -f "$METRICS_LOG" ]; then
        local count=$(wc -l < "$METRICS_LOG" 2>/dev/null || echo "0")
        echo -e "${CYAN}Collected Metrics (${count} total, last 10):${NC}"
        tail -10 "$METRICS_LOG"
    else
        echo "No metrics collected yet."
    fi
}

show_status() {
    echo -e "${MAGENTA}${BOLD}HOLOCRON AI Autonomous Probe Status${NC}"
    echo ""
    if systemctl is-active --quiet holocron-probe-auto 2>/dev/null; then
        echo -e "  Status:     ${GREEN}● Running${NC}"
    elif [ -f "$PID_FILE" ]; then
        echo -e "  Status:     ${YELLOW}● Unknown${NC}"
    else
        echo -e "  Status:     ${RED}● Stopped${NC}"
    fi
    local metrics_count=$(wc -l < "$METRICS_LOG" 2>/dev/null || echo "0")
    local decisions_count=$(wc -l < "$DECISIONS_LOG" 2>/dev/null || echo "0")
    local actions_count=$(wc -l < "$ACTIONS_LOG" 2>/dev/null || echo "0")
    echo -e "  Metrics:    ${metrics_count} collected"
    echo -e "  Decisions:  ${decisions_count} made"
    echo -e "  Actions:    ${actions_count} taken"
    echo -e "  Data Dir:   ${DATA_DIR}"
    echo -e "  AI Engine:  $([ -n "$OPENAI_API_KEY" ] && echo "OpenAI (${OPENAI_MODEL})" || echo "Rule Engine v2")"
    echo -e "  Remediation: $([ "$REMEDIATION_ENABLED" = "true" ] && echo "${GREEN}Enabled${NC}" || echo "${YELLOW}Disabled${NC}")"
}

install_service() {
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${RED}Error: Installation requires root. Run with sudo.${NC}"
        exit 1
    fi
    local script_path=$(readlink -f "$0")
    cp "$script_path" /usr/local/bin/holocron-probe-auto
    chmod +x /usr/local/bin/holocron-probe-auto
    mkdir -p /var/lib/holocron/autonomous
    cat > /opt/holocron/.env <<ENVEOF
HOLOCRON_TOKEN=${HOLOCRON_TOKEN}
HOLOCRON_API=${HOLOCRON_API}
OPENAI_API_KEY=${OPENAI_API_KEY}
HOLOCRON_DATA_DIR=/var/lib/holocron/autonomous
HOLOCRON_REMEDIATION=${REMEDIATION_ENABLED}
ENVEOF
    chmod 600 /opt/holocron/.env
    chown root:root /opt/holocron/.env

    cat > /etc/systemd/system/holocron-probe-auto.service <<SVCEOF
[Unit]
Description=HOLOCRON AI Fully Autonomous Probe Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/holocron-probe-auto start
Restart=always
RestartSec=30
EnvironmentFile=/opt/holocron/.env
StartLimitIntervalSec=300
StartLimitBurst=5

[Install]
WantedBy=multi-user.target
SVCEOF
    systemctl daemon-reload
    systemctl enable holocron-probe-auto
    systemctl start holocron-probe-auto
    log "${GREEN}✓ Autonomous Probe installed${NC}"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --token) HOLOCRON_TOKEN="$2"; shift 2 ;;
        --api) HOLOCRON_API="$2"; shift 2 ;;
        --data-dir) DATA_DIR="$2"; shift 2 ;;
        --no-remediate) REMEDIATION_ENABLED="false"; shift ;;
        start|install|status|reason|actions|metrics|test|help) COMMAND="$1"; shift ;;
        *) echo "Unknown option: $1"; usage; exit 1 ;;
    esac
done

COMMAND="${COMMAND:-start}"

if [ "$COMMAND" = "help" ]; then usage; exit 0; fi
if [ "$COMMAND" = "status" ]; then show_status; exit 0; fi
if [ "$COMMAND" = "reason" ]; then show_reasoning; exit 0; fi
if [ "$COMMAND" = "actions" ]; then show_actions; exit 0; fi
if [ "$COMMAND" = "metrics" ]; then show_metrics; exit 0; fi

if [ "$COMMAND" = "test" ]; then
    init_data
    log "Running autonomous reasoning test..."
    collect_reason_act
    log "${GREEN}✓ Autonomous reasoning test complete${NC}"
    exit 0
fi

HOLOCRON_API="${HOLOCRON_API:+${HOLOCRON_API%/}}"

banner
trap stop_probe SIGTERM SIGINT

case $COMMAND in
    start)
        init_data
        log "Starting Fully Autonomous Probe..."
        if [ -n "$HOLOCRON_TOKEN" ] && [ -n "$HOLOCRON_API" ]; then
            log "  Token: ${HOLOCRON_TOKEN:0:10}...${HOLOCRON_TOKEN: -4}"
            log "  API:   ${HOLOCRON_API} (optional registration)"
        else
            log "  ${YELLOW}No server configured — operating in pure autonomous mode${NC}"
        fi
        log "  Data:  ${DATA_DIR}"
        log "  AI:    ${MAGENTA}$([ -n "$OPENAI_API_KEY" ] && echo "OpenAI (${OPENAI_MODEL})" || echo "Rule Engine v2 (local)")${NC}"
        log "  Heal:  $([ "$REMEDIATION_ENABLED" = "true" ] && echo "${GREEN}Self-remediation enabled${NC}" || echo "${YELLOW}Remediation disabled${NC}")"
        log ""
        if [ -n "$HOLOCRON_TOKEN" ] && [ -n "$HOLOCRON_API" ]; then
            enroll_if_possible || log "${YELLOW}Server unavailable — proceeding autonomously${NC}"
        fi
        log "${MAGENTA}${BOLD}Autonomous probe is operational. No server dependency.${NC}"
        log ""
        run_daemon
        ;;
    install)
        install_service
        ;;
esac
