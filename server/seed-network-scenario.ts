import { storage, db } from "./storage";
import { networkDevices, deviceMetrics, agentAlerts, agentKpis, agentTasks, crews } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export async function seedNetworkScenario() {
  const demoUser = await storage.getUserByUsername("demo");
  if (!demoUser) return;

  const existing = await storage.getNetworkDevices(demoUser.id);
  if (existing.length > 0) return;

  console.log("Seeding network operations scenario for demo user...");

  const allRoles = await storage.getOrgRoles();
  const netEngineer = allRoles.find(r => r.name === "Senior Network Engineer" && r.department === "Infrastructure & Cloud Operations");
  const netSecEngineer = allRoles.find(r => r.name === "Network Security Engineer" && r.department === "Infrastructure & Cloud Operations");

  if (!netEngineer || !netSecEngineer) {
    console.log("Required roles not found, skipping network scenario seed");
    return;
  }

  const existingSubs = await storage.getRoleSubscriptions(demoUser.id);
  const netEngSub = existingSubs.find(s => s.roleId === netEngineer.id);
  const netSecSub = existingSubs.find(s => s.roleId === netSecEngineer.id);

  if (!netEngSub) {
    await storage.createRoleSubscription({
      userId: demoUser.id,
      roleId: netEngineer.id,
      status: "active",
      assignedHumanName: "Marcus Chen",
      assignedHumanEmail: "m.chen@acmecorp.com",
      hasAiShadow: true,
    });
  } else if (!netEngSub.hasAiShadow) {
    await storage.updateRoleSubscription(netEngSub.id, { hasAiShadow: true, assignedHumanName: netEngSub.assignedHumanName || "Marcus Chen" });
  }

  if (!netSecSub) {
    await storage.createRoleSubscription({
      userId: demoUser.id,
      roleId: netSecEngineer.id,
      status: "active",
      assignedHumanName: "Sarah Kim",
      assignedHumanEmail: "s.kim@acmecorp.com",
      hasAiShadow: true,
    });
  } else if (!netSecSub.hasAiShadow) {
    await storage.updateRoleSubscription(netSecSub.id, { hasAiShadow: true, assignedHumanName: netSecSub.assignedHumanName || "Sarah Kim" });
  }

  const crew = await storage.createCrew({
    name: "Network Operations Crew",
    description: "Autonomous network infrastructure management — routers, firewalls, monitoring, and security enforcement",
    department: "Infrastructure & Cloud Operations",
    processType: "parallel",
    status: "active",
    agentRoleIds: [netEngineer.id, netSecEngineer.id],
    userId: demoUser.id,
  });

  const routerDevices = [
    { name: "CORE-RTR-01", type: "router", vendor: "Cisco", model: "ISR 4451-X", ipAddress: "10.0.1.1", firmware: "IOS-XE 17.09.04", status: "online", location: "DC-East Rack A3" },
    { name: "CORE-RTR-02", type: "router", vendor: "Juniper", model: "MX480", ipAddress: "10.0.1.2", firmware: "Junos 23.4R1", status: "online", location: "DC-East Rack A4" },
    { name: "EDGE-RTR-01", type: "router", vendor: "Cisco", model: "ASR 1001-X", ipAddress: "10.0.2.1", firmware: "IOS-XE 17.06.05", status: "degraded", location: "DC-West Rack B1" },
    { name: "BRANCH-RTR-01", type: "router", vendor: "Arista", model: "7280R3", ipAddress: "10.1.0.1", firmware: "EOS 4.30.1F", status: "online", location: "Branch-NYC" },
  ];

  const firewallDevices = [
    { name: "FW-PERIMETER-01", type: "firewall", vendor: "Palo Alto", model: "PA-5260", ipAddress: "10.0.0.1", firmware: "PAN-OS 11.1.2", status: "online", location: "DC-East DMZ" },
    { name: "FW-PERIMETER-02", type: "firewall", vendor: "Fortinet", model: "FortiGate 600E", ipAddress: "10.0.0.2", firmware: "FortiOS 7.4.3", status: "online", location: "DC-West DMZ" },
    { name: "FW-INTERNAL-01", type: "firewall", vendor: "Palo Alto", model: "PA-3260", ipAddress: "10.0.3.1", firmware: "PAN-OS 11.0.4", status: "warning", location: "DC-East Internal" },
    { name: "FW-BRANCH-01", type: "firewall", vendor: "Fortinet", model: "FortiGate 200F", ipAddress: "10.1.0.2", firmware: "FortiOS 7.2.8", status: "online", location: "Branch-NYC" },
  ];

  const createdDevices: { id: string; name: string; type: string }[] = [];

  for (const d of routerDevices) {
    const device = await storage.createNetworkDevice({
      ...d,
      configHash: `sha256:${Math.random().toString(36).slice(2, 18)}`,
      assignedAgentRoleId: netEngineer.id,
      userId: demoUser.id,
    });
    createdDevices.push({ id: device.id, name: device.name, type: device.type });
  }

  for (const d of firewallDevices) {
    const device = await storage.createNetworkDevice({
      ...d,
      configHash: `sha256:${Math.random().toString(36).slice(2, 18)}`,
      assignedAgentRoleId: netSecEngineer.id,
      userId: demoUser.id,
    });
    createdDevices.push({ id: device.id, name: device.name, type: device.type });
  }

  const routers = createdDevices.filter(d => d.type === "router");
  const firewalls = createdDevices.filter(d => d.type === "firewall");

  const routerTasks = [
    { description: "Backup running configurations for all core routers", expectedOutput: "Configuration backups stored in TFTP server with timestamp", status: "completed", priority: "high", context: "Scheduled daily at 02:00 UTC", output: "All 4 router configs backed up successfully. SHA256 hashes verified. Backup size: 2.4MB total." },
    { description: "Audit BGP session health and neighbor states across all routers", expectedOutput: "BGP health report with session states, prefix counts, and anomalies", status: "completed", priority: "high", context: "Weekly audit — checks Established state, prefix limits, route leaks", output: "8 BGP sessions verified. All Established. No route leaks detected. Prefix counts within normal range." },
    { description: "Review and optimize OSPF area configurations", expectedOutput: "OSPF topology report with area assignments and cost recommendations", status: "completed", priority: "medium", context: "Quarterly review of OSPF areas for optimal convergence", output: "OSPF areas verified. Recommended cost adjustment on EDGE-RTR-01 Gi0/1 interface from 10 to 5 for faster failover." },
    { description: "Verify VLAN trunk configurations and prune unused VLANs", expectedOutput: "VLAN audit report showing active/inactive VLANs per trunk", status: "in_progress", priority: "medium", context: "Reduce broadcast domain by pruning VLANs not in use for 90+ days" },
    { description: "Analyze QoS policy effectiveness and adjust DSCP markings", expectedOutput: "QoS analysis with latency/jitter measurements per traffic class", status: "in_progress", priority: "medium", context: "Voice traffic showing intermittent quality issues on EDGE-RTR-01" },
    { description: "Firmware vulnerability assessment for EDGE-RTR-01", expectedOutput: "CVE report and upgrade recommendation with rollback plan", status: "pending", priority: "critical", context: "IOS-XE 17.06.05 has known CVE-2024-20311 — needs upgrade to 17.09.04" },
    { description: "Validate ACL rule consistency across all router interfaces", expectedOutput: "ACL compliance report with discrepancies highlighted", status: "pending", priority: "high", context: "Ensure all inbound ACLs match security baseline template" },
    { description: "Monitor and tune interface error counters and CRC errors", expectedOutput: "Interface health report with error trends and recommendations", status: "pending", priority: "medium", context: "CORE-RTR-02 Gi0/3 showing elevated CRC errors — possible cable issue" },
    { description: "Configure NetFlow/IPFIX on all routers for traffic analysis", expectedOutput: "NetFlow configuration deployed and validated on all interfaces", status: "scheduled", priority: "low", context: "Enable flow data export to Observability platform collector at 10.0.5.50" },
    { description: "Perform routing table convergence test after planned maintenance", expectedOutput: "Convergence time measurements and failover verification", status: "scheduled", priority: "high", context: "Maintenance window: Saturday 03:00-05:00 UTC. Test OSPF reconvergence." },
  ];

  const firewallTasks = [
    { description: "Inspect and clean up unused firewall rules on FW-PERIMETER-01", expectedOutput: "Rule cleanup report with removed/disabled rules and hit counts", status: "completed", priority: "critical", context: "Quarterly rule review — rules with zero hits in 180 days flagged for removal", output: "Analyzed 847 rules. Removed 23 unused rules (zero hits >180 days). Disabled 8 shadow rules. Reduced rule base by 3.6%." },
    { description: "Update IDS/IPS signature database across all firewalls", expectedOutput: "Signature update status report with version numbers", status: "completed", priority: "critical", context: "Critical: New signatures released for CVE-2024-21762 (FortiOS) and CVE-2024-3400 (PAN-OS)", output: "All 4 firewalls updated. PA units: Content v8792. FortiGate units: IPS DB v27.742. Threat prevention validated." },
    { description: "Audit VPN tunnel configurations and certificate expiry dates", expectedOutput: "VPN health report with tunnel states and certificate timeline", status: "completed", priority: "high", context: "Check IPSec tunnel Phase 1/Phase 2 SAs, IKEv2 peer authentication", output: "12 VPN tunnels verified. All Phase 1/2 active. WARNING: Branch-NYC tunnel cert expires in 28 days — renewal initiated." },
    { description: "Review micro-segmentation policies for PCI-DSS compliance", expectedOutput: "Compliance matrix mapping firewall zones to PCI-DSS requirements", status: "in_progress", priority: "critical", context: "PCI-DSS v4.0 audit preparation — verify cardholder data environment isolation" },
    { description: "Analyze threat logs and tune false positive thresholds", expectedOutput: "False positive analysis with threshold adjustment recommendations", status: "in_progress", priority: "high", context: "FP rate currently at 8.2% — target is below 5%. Focus on web application signatures." },
    { description: "Implement zero-trust network access policies for remote workforce", expectedOutput: "ZTNA policy configuration with user/device posture checks", status: "pending", priority: "high", context: "Extend GlobalProtect/FortiClient ZTNA policies to all remote access" },
    { description: "Rotate SSL/TLS inspection certificates on perimeter firewalls", expectedOutput: "Certificate rotation completed with validation test results", status: "pending", priority: "medium", context: "Current inspection cert expires in 45 days — generate new subordinate CA cert" },
    { description: "Configure geo-IP blocking for sanctioned countries", expectedOutput: "Geo-IP policy deployed with allowed/blocked country lists", status: "pending", priority: "medium", context: "Block traffic from OFAC-sanctioned regions per corporate security policy" },
    { description: "Validate HA failover for FW-PERIMETER-01/02 cluster", expectedOutput: "Failover test results with timing measurements and session persistence", status: "scheduled", priority: "high", context: "Quarterly HA validation — test active/passive failover and session sync" },
    { description: "Generate monthly security posture report for leadership", expectedOutput: "Executive summary with threat trends, blocked attacks, policy compliance", status: "scheduled", priority: "medium", context: "Monthly report due by 5th — aggregate IPS events, URL filtering, sandboxing stats" },
  ];

  for (const t of routerTasks) {
    await storage.createAgentTask({
      ...t,
      assignedRoleId: netEngineer.id,
      crewId: crew.id,
      userId: demoUser.id,
    });
  }

  for (const t of firewallTasks) {
    await storage.createAgentTask({
      ...t,
      assignedRoleId: netSecEngineer.id,
      crewId: crew.id,
      userId: demoUser.id,
    });
  }

  const metricDefs = [
    ...routers.flatMap(d => [
      { deviceId: d.id, metricName: "CPU Utilization", value: d.name === "EDGE-RTR-01" ? 78 : 25 + Math.random() * 20, unit: "%", thresholdWarning: 70, thresholdCritical: 90, status: d.name === "EDGE-RTR-01" ? "warning" : "normal" },
      { deviceId: d.id, metricName: "Memory Usage", value: 40 + Math.random() * 25, unit: "%", thresholdWarning: 75, thresholdCritical: 90, status: "normal" },
      { deviceId: d.id, metricName: "Interface Throughput", value: 200 + Math.random() * 600, unit: "Mbps", thresholdWarning: 800, thresholdCritical: 950, status: "normal" },
      { deviceId: d.id, metricName: "Packet Loss", value: d.name === "EDGE-RTR-01" ? 0.3 : Math.random() * 0.05, unit: "%", thresholdWarning: 0.1, thresholdCritical: 1.0, status: d.name === "EDGE-RTR-01" ? "warning" : "normal" },
      { deviceId: d.id, metricName: "Latency", value: 2 + Math.random() * 8, unit: "ms", thresholdWarning: 20, thresholdCritical: 50, status: "normal" },
      { deviceId: d.id, metricName: "BGP Prefixes", value: 450 + Math.floor(Math.random() * 100), unit: "routes", thresholdWarning: 600, thresholdCritical: 750, status: "normal" },
      { deviceId: d.id, metricName: "Uptime", value: d.name === "EDGE-RTR-01" ? 43 : 180 + Math.floor(Math.random() * 200), unit: "days", thresholdWarning: null, thresholdCritical: null, status: "normal" },
    ]),
    ...firewalls.flatMap(d => [
      { deviceId: d.id, metricName: "CPU Utilization", value: d.name === "FW-INTERNAL-01" ? 72 : 30 + Math.random() * 20, unit: "%", thresholdWarning: 70, thresholdCritical: 90, status: d.name === "FW-INTERNAL-01" ? "warning" : "normal" },
      { deviceId: d.id, metricName: "Memory Usage", value: 45 + Math.random() * 20, unit: "%", thresholdWarning: 80, thresholdCritical: 95, status: "normal" },
      { deviceId: d.id, metricName: "Active Sessions", value: 15000 + Math.floor(Math.random() * 30000), unit: "sessions", thresholdWarning: 50000, thresholdCritical: 80000, status: "normal" },
      { deviceId: d.id, metricName: "Threat Prevention Rate", value: 97 + Math.random() * 2.5, unit: "%", thresholdWarning: 95, thresholdCritical: 90, status: "normal" },
      { deviceId: d.id, metricName: "SSL Decryption Load", value: 35 + Math.random() * 25, unit: "%", thresholdWarning: 70, thresholdCritical: 85, status: "normal" },
      { deviceId: d.id, metricName: "IPS Throughput", value: 1.5 + Math.random() * 3, unit: "Gbps", thresholdWarning: 5, thresholdCritical: 7, status: "normal" },
      { deviceId: d.id, metricName: "Blocked Threats", value: 200 + Math.floor(Math.random() * 500), unit: "/24h", thresholdWarning: null, thresholdCritical: null, status: "normal" },
    ]),
  ];

  for (const m of metricDefs) {
    await storage.createDeviceMetric({ ...m, userId: demoUser.id });
  }

  const now = new Date();
  const alertDefs = [
    { deviceId: routers[2].id, agentRoleId: netEngineer.id, type: "threshold_breach", severity: "warning", message: "EDGE-RTR-01 CPU utilization at 78% — exceeds 70% warning threshold", details: "Sustained high CPU for 15 minutes. Top process: BGP Scanner (42%), OSPF Hello (12%). Recommendation: Check BGP table size and consider route filtering.", acknowledged: true, falsePositive: false },
    { deviceId: routers[2].id, agentRoleId: netEngineer.id, type: "threshold_breach", severity: "warning", message: "EDGE-RTR-01 packet loss elevated to 0.3% on Gi0/2", details: "Intermittent packet loss detected on WAN interface. Possible causes: congestion, duplex mismatch, or physical layer issue. CRC errors also elevated.", acknowledged: false, falsePositive: false },
    { deviceId: routers[1].id, agentRoleId: netEngineer.id, type: "config_drift", severity: "medium", message: "CORE-RTR-02 running config differs from last backup", details: "Config hash mismatch detected. 3 lines changed: NTP server added (10.0.5.10), logging buffer size increased to 65536, SNMP community string rotated.", acknowledged: true, falsePositive: false },
    { deviceId: routers[0].id, agentRoleId: netEngineer.id, type: "maintenance_due", severity: "low", message: "CORE-RTR-01 firmware update available: IOS-XE 17.12.01", details: "Non-critical update available. Includes bug fixes for CSCwe12345 (memory leak in IPv6 ACL processing) and CSCwf67890 (SNMP polling delay). No security CVEs.", acknowledged: false, falsePositive: false },
    { deviceId: routers[3].id, agentRoleId: netEngineer.id, type: "threshold_breach", severity: "low", message: "BRANCH-RTR-01 BGP prefix count spike from 480 to 520", details: "Prefix count increased by 8.3% in the last hour. Within normal range but monitoring. Source AS: 65001 advertising 40 new prefixes.", acknowledged: true, falsePositive: true },
    { deviceId: firewalls[2].id, agentRoleId: netSecEngineer.id, type: "threshold_breach", severity: "warning", message: "FW-INTERNAL-01 CPU at 72% — threat prevention processing high", details: "SSL decryption and IPS inspection causing elevated CPU. 3,200 concurrent SSL sessions being decrypted. Consider enabling hardware offload or adjusting decryption policy scope.", acknowledged: false, falsePositive: false },
    { deviceId: firewalls[0].id, agentRoleId: netSecEngineer.id, type: "threshold_breach", severity: "critical", message: "FW-PERIMETER-01: 47 blocked intrusion attempts from 185.234.xx.xx in 1 hour", details: "Source IP 185.234.xx.xx attempting SQL injection against web servers in DMZ. Attack signature: SQL Injection (ID 41000). All attempts blocked. Source geo: Eastern Europe. Recommended: Add to block list.", acknowledged: true, falsePositive: false },
    { deviceId: firewalls[1].id, agentRoleId: netSecEngineer.id, type: "config_drift", severity: "medium", message: "FW-PERIMETER-02 policy out of sync with FW-PERIMETER-01", details: "HA pair policy drift detected. FW-PERIMETER-02 missing 2 rules added to FW-PERIMETER-01: Rule #312 (allow HTTPS to app-server-03) and Rule #315 (block ICMP from external).", acknowledged: false, falsePositive: false },
    { deviceId: firewalls[0].id, agentRoleId: netSecEngineer.id, type: "threshold_breach", severity: "medium", message: "FW-PERIMETER-01 IPS flagged internal DNS queries as DNS tunneling", details: "IPS signature 'DNS Tunneling Detection' triggered 23 times from 10.0.4.15. Investigation shows queries are from legitimate monitoring tool (Datadog agent) using long TXT record queries.", acknowledged: true, falsePositive: true },
    { deviceId: firewalls[3].id, agentRoleId: netSecEngineer.id, type: "maintenance_due", severity: "low", message: "FW-BRANCH-01 FortiOS 7.2.8 end-of-support in 90 days", details: "FortiOS 7.2.x reaches end of engineering support on 2026-06-01. Upgrade path: 7.2.8 → 7.4.3 (supported until 2028). Compatibility matrix reviewed — all features supported.", acknowledged: false, falsePositive: false },
    { deviceId: firewalls[1].id, agentRoleId: netSecEngineer.id, type: "threshold_breach", severity: "low", message: "FW-PERIMETER-02 detected outbound connection to known TOR exit node", details: "Single TCP connection from 10.0.8.42 to known TOR exit node 198.xx.xx.xx:443. Investigation: User was testing security research tool in isolated lab VLAN. No data exfiltration risk.", acknowledged: true, falsePositive: true },
  ];

  for (const a of alertDefs) {
    await storage.createAgentAlert({ ...a, userId: demoUser.id });
  }

  const kpiDefs = [
    { agentRoleId: netEngineer.id, kpiName: "Config Compliance", currentValue: 94.5, targetValue: 99, unit: "%", trend: "up", period: "monthly" },
    { agentRoleId: netEngineer.id, kpiName: "Mean Time to Repair", currentValue: 12, targetValue: 15, unit: "min", trend: "down", period: "monthly" },
    { agentRoleId: netEngineer.id, kpiName: "Network Uptime SLA", currentValue: 99.97, targetValue: 99.95, unit: "%", trend: "stable", period: "monthly" },
    { agentRoleId: netEngineer.id, kpiName: "Change Success Rate", currentValue: 97.2, targetValue: 95, unit: "%", trend: "up", period: "monthly" },
    { agentRoleId: netEngineer.id, kpiName: "Tasks Automated", currentValue: 10, targetValue: 15, unit: "tasks", trend: "up", period: "monthly" },
    { agentRoleId: netEngineer.id, kpiName: "Avg Convergence Time", currentValue: 1.8, targetValue: 3, unit: "sec", trend: "down", period: "monthly" },
    { agentRoleId: netSecEngineer.id, kpiName: "Threat Block Rate", currentValue: 98.7, targetValue: 99, unit: "%", trend: "up", period: "monthly" },
    { agentRoleId: netSecEngineer.id, kpiName: "False Positive Rate", currentValue: 8.2, targetValue: 5, unit: "%", trend: "down", period: "monthly" },
    { agentRoleId: netSecEngineer.id, kpiName: "Rule Compliance", currentValue: 91.3, targetValue: 95, unit: "%", trend: "up", period: "monthly" },
    { agentRoleId: netSecEngineer.id, kpiName: "Mean Time to Detect", currentValue: 3.2, targetValue: 5, unit: "min", trend: "down", period: "monthly" },
    { agentRoleId: netSecEngineer.id, kpiName: "VPN Tunnel Uptime", currentValue: 99.8, targetValue: 99.5, unit: "%", trend: "stable", period: "monthly" },
    { agentRoleId: netSecEngineer.id, kpiName: "Cert Rotation Compliance", currentValue: 87, targetValue: 100, unit: "%", trend: "up", period: "monthly" },
  ];

  for (const k of kpiDefs) {
    await storage.createAgentKpi({ ...k, userId: demoUser.id });
  }

  console.log(`Network scenario seeded: ${createdDevices.length} devices, ${routerTasks.length + firewallTasks.length} tasks, ${metricDefs.length} metrics, ${alertDefs.length} alerts, ${kpiDefs.length} KPIs`);
}
