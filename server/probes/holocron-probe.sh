#!/bin/bash

HOLOCRON_TOKEN="${HOLOCRON_TOKEN:-}"
HOLOCRON_API="${HOLOCRON_API:-}"
HOLOCRON_HMAC_SECRET="${HOLOCRON_HMAC_SECRET:-}"
HEARTBEAT_INTERVAL=60
PROBE_VERSION="1.1.0"
LOG_FILE="/var/log/holocron-probe.log"
PID_FILE="/var/run/holocron-probe.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${CYAN}[${timestamp}]${NC} $1"
    if [ -w "$(dirname "$LOG_FILE")" ] 2>/dev/null; then
        echo "[${timestamp}] $(echo "$1" | sed 's/\x1b\[[0-9;]*m//g')" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

banner() {
    echo -e "${CYAN}"
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║          HOLOCRON AI Probe Agent           ║"
    echo "  ║              Linux v${PROBE_VERSION}                ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
}

get_hostname() {
    hostname -f 2>/dev/null || hostname 2>/dev/null || echo "unknown"
}

get_ip() {
    ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src") print $(i+1)}' | head -1 || \
    hostname -I 2>/dev/null | awk '{print $1}' || \
    echo "unknown"
}

get_os_info() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "${PRETTY_NAME:-${NAME} ${VERSION}}"
    elif [ -f /etc/redhat-release ]; then
        cat /etc/redhat-release
    else
        uname -s -r -m
    fi
}

get_mac_address() {
    ip link show 2>/dev/null | awk '/ether/ {print $2; exit}' || \
    cat /sys/class/net/$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="dev") print $(i+1)}' | head -1)/address 2>/dev/null || \
    echo "unknown"
}

get_manufacturer() {
    cat /sys/class/dmi/id/sys_vendor 2>/dev/null || \
    dmidecode -s system-manufacturer 2>/dev/null || \
    echo "Unknown"
}

get_model() {
    cat /sys/class/dmi/id/product_name 2>/dev/null || \
    dmidecode -s system-product-name 2>/dev/null || \
    echo "Unknown"
}

get_cpu_info() {
    grep -m1 "model name" /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || \
    lscpu 2>/dev/null | awk -F: '/Model name/ {gsub(/^[ \t]+/, "", $2); print $2}' || \
    echo "Unknown"
}

get_total_memory_gb() {
    free -g 2>/dev/null | awk '/^Mem:/ {print $2}' || echo "0"
}

get_system_type() {
    if [ -d /proc/vz ] || [ -f /.dockerenv ] || grep -q "docker\|lxc\|kubepods" /proc/1/cgroup 2>/dev/null; then
        echo "container"
    elif dmidecode -s system-product-name 2>/dev/null | grep -qi "virtual\|vmware\|kvm\|qemu\|xen\|hyperv"; then
        echo "virtual-machine"
    else
        echo "physical"
    fi
}

get_cpu_usage() {
    top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print 100 - $8}' | head -1 || echo "0"
}

get_memory_usage() {
    free 2>/dev/null | awk '/^Mem:/ {printf "%.1f", $3/$2 * 100}' || echo "0"
}

get_disk_usage() {
    df / 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}' || echo "0"
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
        local speed_mbps=$(cat "$iface/speed" 2>/dev/null || echo "0")
        [ "$speed_mbps" -le 0 ] 2>/dev/null && speed_mbps="0"
        local bandwidth="Unknown"
        if [ "$speed_mbps" -ge 1000 ]; then
            bandwidth="$(echo "$speed_mbps" | awk '{printf "%.1f Gbps", $1/1000}')"
        elif [ "$speed_mbps" -gt 0 ]; then
            bandwidth="${speed_mbps} Mbps"
        fi
        local rx1=$(cat "/sys/class/net/$name/statistics/rx_bytes" 2>/dev/null || echo "0")
        local tx1=$(cat "/sys/class/net/$name/statistics/tx_bytes" 2>/dev/null || echo "0")
        sleep 1
        local rx2=$(cat "/sys/class/net/$name/statistics/rx_bytes" 2>/dev/null || echo "0")
        local tx2=$(cat "/sys/class/net/$name/statistics/tx_bytes" 2>/dev/null || echo "0")
        local rx_rate=$((rx2 - rx1))
        local tx_rate=$((tx2 - tx1))
        local total_bits=$(( (rx_rate + tx_rate) * 8 ))
        local util_pct=0
        if [ "$speed_mbps" -gt 0 ]; then
            local link_bps=$((speed_mbps * 1000000))
            util_pct=$(echo "$total_bits $link_bps" | awk '{if($2>0) printf "%.1f", ($1/$2)*100; else print "0"}')
        fi
        local iface_type="ethernet"
        if echo "$name" | grep -qi "wl"; then iface_type="wireless"; fi
        if [ "$first" = true ]; then first=false; else result="$result,"; fi
        result="$result{\"name\":\"$name\",\"type\":\"$iface_type\",\"status\":\"active\",\"bandwidth\":\"$bandwidth\",\"utilization\":\"${util_pct}%\",\"vlan\":\"N/A\",\"rxBytesPerSec\":$rx_rate,\"txBytesPerSec\":$tx_rate}"
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
    elif command -v python &>/dev/null; then
        python -c "import time; print(int(time.time()*1000))"
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
            --connect-timeout 10 \
            --max-time 30 2>/dev/null
    else
        curl -s -X GET "$url" \
            --connect-timeout 10 \
            --max-time 30 2>/dev/null
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

    log "${YELLOW}Enrolling probe with HOLOCRON AI...${NC}"
    log "  Hostname:     ${my_hostname}"
    log "  IP:           ${my_ip}"
    log "  MAC:          ${my_mac}"
    log "  OS:           ${my_os}"
    log "  Manufacturer: ${my_manufacturer}"
    log "  Model:        ${my_model}"
    log "  CPU:          ${my_cpu}"
    log "  Memory:       ${my_mem_gb} GB"
    log "  System Type:  ${my_sys_type}"

    local payload="{\"siteToken\":\"${HOLOCRON_TOKEN}\",\"hostname\":\"${my_hostname}\",\"ipAddress\":\"${my_ip}\",\"osInfo\":\"${my_os}\",\"probeVersion\":\"${PROBE_VERSION}\",\"deploymentType\":\"bare-metal\",\"macAddress\":\"${my_mac}\",\"manufacturer\":\"${my_manufacturer}\",\"model\":\"${my_model}\",\"cpuInfo\":\"${my_cpu}\",\"totalMemoryGB\":${my_mem_gb},\"systemType\":\"${my_sys_type}\"}"

    local response=$(api_call "POST" "/api/probe-enroll" "$payload")
    local success=$(echo "$response" | grep -o '"success":true' || true)

    if [ -n "$success" ]; then
        local probe_id=$(echo "$response" | grep -o '"probeId":"[^"]*"' | cut -d'"' -f4)
        log "${GREEN}✓ Probe enrolled successfully (ID: ${probe_id})${NC}"
        return 0
    else
        local error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        log "${RED}✗ Enrollment failed: ${error:-unknown error}${NC}"
        return 1
    fi
}

json_str() {
    python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$1" 2>/dev/null || echo "\"$1\""
}

send_heartbeat() {
    local my_hostname=$(get_hostname)
    local my_ip=$(get_ip)
    local my_os=$(get_os_info)
    local cpu=$(get_cpu_usage)
    local mem=$(get_memory_usage)
    local disk=$(get_disk_usage)
    local uptime=$(get_uptime_seconds)
    local net_ifaces=$(get_network_interfaces_json)

    local payload="{\"siteToken\":\"${HOLOCRON_TOKEN}\",\"hostname\":\"${my_hostname}\",\"ipAddress\":\"${my_ip}\",\"osInfo\":\"${my_os}\",\"probeVersion\":\"${PROBE_VERSION}\",\"cpuUsage\":${cpu},\"memoryUsage\":${mem},\"diskUsage\":${disk},\"taskQueueDepth\":0,\"activeTasks\":0,\"avgScanDurationMs\":0,\"networkInterfaces\":${net_ifaces}}"

    local response=$(api_call "POST" "/api/probe-heartbeat" "$payload")
    local success=$(echo "$response" | grep -o '"success":true' || true)

    if [ -n "$success" ]; then
        local next=$(echo "$response" | grep -o '"nextHeartbeat":[0-9]*' | cut -d: -f2)
        if [ -n "$next" ] && [ "$next" -gt 0 ] 2>/dev/null; then
            HEARTBEAT_INTERVAL=$next
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

        log "${GREEN}♥${NC} Heartbeat OK (CPU: ${cpu}%, Mem: ${mem}%, Disk: ${disk}%, Next: ${HEARTBEAT_INTERVAL}s)"
        return 0
    else
        log "${RED}✗ Heartbeat failed${NC}"
        return 1
    fi
}

execute_remediation_task() {
    local task_json="$1"
    local task_id script_type script

    task_id=$(echo "$task_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
    script_type=$(echo "$task_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('scriptType','bash'))" 2>/dev/null)
    # Read 'script' key first (server sends 'script'), fall back to 'remediationScript' for compatibility
    script=$(echo "$task_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('script','') or d.get('remediationScript',''))" 2>/dev/null)

    [ -z "$task_id" ] && return
    [ -z "$script" ] && { log "${YELLOW}  [TASK] ${task_id}: empty script — skipping${NC}"; return; }

    # Linux only runs bash scripts — skip powershell tasks
    if [ "$script_type" != "bash" ] && [ "$script_type" != "shell" ] && [ "$script_type" != "sh" ]; then
        log "${YELLOW}  [TASK] ${task_id}: unsupported script type '${script_type}' — skipping${NC}"
        return
    fi

    log "${CYAN}  [TASK] Executing ${task_id} (${script_type})${NC}"

    # Report executing
    local report_payload
    report_payload="{\"siteToken\":$(json_str "$HOLOCRON_TOKEN"),\"taskId\":$(json_str "$task_id"),\"status\":\"executing\"}"
    api_call "POST" "/api/probe-task-report" "$report_payload" > /dev/null 2>&1 || true

    # Write script to temp file and execute with timeout
    local tmp_script exit_code output
    tmp_script=$(mktemp /tmp/holocron_task_XXXXXX.sh)
    printf '%s\n' "$script" > "$tmp_script"
    chmod +x "$tmp_script"

    local timeout_sec=1800
    local title
    title=$(echo "$task_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('title',''))" 2>/dev/null || true)
    echo "$title" | grep -qiE "install|update|patch|upgrade|download|deploy|setup|apt|yum|dnf" && timeout_sec=3600

    output=$(timeout "$timeout_sec" bash "$tmp_script" 2>&1) && exit_code=0 || exit_code=$?
    rm -f "$tmp_script"

    if [ "$exit_code" -eq 0 ]; then
        log "${GREEN}  [TASK] ${task_id}: completed successfully${NC}"
        local result_payload
        result_payload="{\"siteToken\":$(json_str "$HOLOCRON_TOKEN"),\"taskId\":$(json_str "$task_id"),\"status\":\"completed\",\"result\":$(json_str "$output")}"
        api_call "POST" "/api/probe-task-report" "$result_payload" > /dev/null 2>&1 || true
    else
        log "${RED}  [TASK] ${task_id}: failed (exit ${exit_code})${NC}"
        local error_payload
        error_payload="{\"siteToken\":$(json_str "$HOLOCRON_TOKEN"),\"taskId\":$(json_str "$task_id"),\"status\":\"failed\",\"error\":$(json_str "Exit ${exit_code}: ${output}")}"
        api_call "POST" "/api/probe-task-report" "$error_payload" > /dev/null 2>&1 || true
    fi
}

run_daemon() {
    local retry_count=0
    local max_retries=5

    while true; do
        if ! send_heartbeat; then
            retry_count=$((retry_count + 1))
            if [ $retry_count -ge $max_retries ]; then
                log "${RED}Max retries reached. Re-enrolling...${NC}"
                if enroll; then
                    retry_count=0
                fi
            fi
            local backoff=$((HEARTBEAT_INTERVAL * retry_count))
            [ $backoff -gt 300 ] && backoff=300
            sleep $backoff
        else
            retry_count=0
            sleep $HEARTBEAT_INTERVAL
        fi
    done
}

stop_probe() {
    log "${YELLOW}Shutting down HOLOCRON Probe...${NC}"
    [ -f "$PID_FILE" ] && rm -f "$PID_FILE"
    exit 0
}

usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start       Start the probe agent (foreground)"
    echo "  install     Install as a systemd service"
    echo "  uninstall   Remove the systemd service"
    echo "  status      Check probe status"
    echo "  test        Test connection to HOLOCRON AI"
    echo ""
    echo "Options:"
    echo "  --token     Site token (or set HOLOCRON_TOKEN env var)"
    echo "  --api       API URL (or set HOLOCRON_API env var)"
    echo ""
    echo "Examples:"
    echo "  $0 start --token hcn_abc123 --api https://your-instance.com"
    echo "  HOLOCRON_TOKEN=hcn_abc123 HOLOCRON_API=https://your-instance.com $0 start"
    echo "  $0 install --token hcn_abc123 --api https://your-instance.com"
}

install_service() {
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${RED}Error: Installation requires root privileges. Run with sudo.${NC}"
        exit 1
    fi

    local script_path=$(readlink -f "$0")
    cp "$script_path" /usr/local/bin/holocron-probe
    chmod +x /usr/local/bin/holocron-probe

    cat > /opt/holocron/.env <<ENVEOF
HOLOCRON_TOKEN=${HOLOCRON_TOKEN}
HOLOCRON_HMAC_SECRET=${HOLOCRON_HMAC_SECRET}
HOLOCRON_API=${HOLOCRON_API}
ENVEOF
    chmod 600 /opt/holocron/.env
    chown root:root /opt/holocron/.env

    cat > /etc/systemd/system/holocron-probe.service <<SVCEOF
[Unit]
Description=HOLOCRON AI Probe Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/holocron-probe start
Restart=always
RestartSec=10
EnvironmentFile=/opt/holocron/.env
StartLimitIntervalSec=300
StartLimitBurst=5

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable holocron-probe
    systemctl start holocron-probe

    log "${GREEN}✓ HOLOCRON Probe installed and started as a systemd service${NC}"
    log "  Check status: systemctl status holocron-probe"
    log "  View logs:    journalctl -u holocron-probe -f"
}

uninstall_service() {
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${RED}Error: Uninstall requires root privileges. Run with sudo.${NC}"
        exit 1
    fi

    systemctl stop holocron-probe 2>/dev/null || true
    systemctl disable holocron-probe 2>/dev/null || true
    rm -f /etc/systemd/system/holocron-probe.service
    rm -f /usr/local/bin/holocron-probe
    systemctl daemon-reload

    log "${GREEN}✓ HOLOCRON Probe uninstalled${NC}"
}

check_status() {
    if systemctl is-active --quiet holocron-probe 2>/dev/null; then
        echo -e "${GREEN}● HOLOCRON Probe is running${NC}"
        systemctl status holocron-probe --no-pager
    else
        echo -e "${RED}● HOLOCRON Probe is not running${NC}"
    fi
}

test_connection() {
    log "Testing connection to ${HOLOCRON_API}..."

    local response=$(curl -s -o /dev/null -w "%{http_code}" "${HOLOCRON_API}/api/probe-heartbeat" \
        -X POST -H "Content-Type: application/json" \
        -d '{"siteToken":"test"}' \
        --connect-timeout 10 2>/dev/null)

    if [ "$response" = "404" ]; then
        log "${GREEN}✓ API is reachable (token validation working)${NC}"
    elif [ "$response" = "400" ]; then
        log "${GREEN}✓ API is reachable (request validation working)${NC}"
    elif [ "$response" = "200" ]; then
        log "${GREEN}✓ API is reachable and responding${NC}"
    else
        log "${RED}✗ API returned HTTP ${response}${NC}"
    fi
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --token) HOLOCRON_TOKEN="$2"; shift 2 ;;
        --api) HOLOCRON_API="$2"; shift 2 ;;
        start|install|uninstall|status|test|help) COMMAND="$1"; shift ;;
        *) echo "Unknown option: $1"; usage; exit 1 ;;
    esac
done

COMMAND="${COMMAND:-start}"

if [ "$COMMAND" = "help" ]; then
    usage
    exit 0
fi

if [ "$COMMAND" = "status" ]; then
    check_status
    exit 0
fi

if [ "$COMMAND" = "uninstall" ]; then
    uninstall_service
    exit 0
fi

if [ -z "$HOLOCRON_TOKEN" ]; then
    echo -e "${RED}Error: Site token is required.${NC}"
    echo "Set HOLOCRON_TOKEN environment variable or use --token flag."
    echo ""
    usage
    exit 1
fi

if [ -z "$HOLOCRON_API" ]; then
    echo -e "${RED}Error: API URL is required.${NC}"
    echo "Set HOLOCRON_API environment variable or use --api flag."
    echo ""
    usage
    exit 1
fi

HOLOCRON_API="${HOLOCRON_API%/}"

banner

trap stop_probe SIGTERM SIGINT

case $COMMAND in
    start)
        log "Starting HOLOCRON Probe Agent..."
        log "  Token: ${HOLOCRON_TOKEN:0:10}...${HOLOCRON_TOKEN: -4}"
        log "  API:   ${HOLOCRON_API}"
        log ""

        if enroll; then
            log "${GREEN}Probe is online. Heartbeat interval: ${HEARTBEAT_INTERVAL}s${NC}"
            log ""
            run_daemon
        else
            log "${RED}Failed to enroll. Check your token and API URL.${NC}"
            exit 1
        fi
        ;;
    install)
        install_service
        ;;
    test)
        test_connection
        ;;
esac
