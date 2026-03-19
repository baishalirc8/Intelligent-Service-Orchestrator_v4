
import type {
  ValidationEnvironment, ValidationVirtualAsset, ValidationProbeDeployment, ValidationTestRun,
} from "@shared/schema";

export interface ProviderAdapter {
  testConnection(): Promise<{ success: boolean; message: string; latency?: number }>;
  listEnvironments(): Promise<MockEnv[]>;
  reserveEnvironment(envId: string): Promise<{ providerEnvId: string }>;
  releaseEnvironment(providerEnvId: string): Promise<void>;
  discoverAssets(providerEnvId: string): Promise<MockAsset[]>;
  deployProbe(opts: DeployProbeOpts): Promise<{ containerId: string }>;
  undeployProbe(containerId: string): Promise<void>;
  runValidationTest(opts: RunTestOpts): Promise<TestRunResult>;
}

export interface MockEnv {
  id: string;
  name: string;
  topology: string;
  nodeCount: number;
}

export interface MockAsset {
  name: string;
  type: string;
  ipAddress: string;
  macAddress: string;
  vendor: string;
  model: string;
  os: string;
  status: string;
  interfaces: Array<{ name: string; ip: string; mac: string }>;
}

export interface DeployProbeOpts {
  probeName: string;
  environmentId: string;
  targetAssets: string[];
  config?: Record<string, unknown>;
}

export interface RunTestOpts {
  testName: string;
  protocols: string[];
  targetAssets: MockAsset[];
  config?: Record<string, unknown>;
}

export interface ProtocolResult {
  protocol: string;
  target: string;
  status: "passed" | "failed" | "skipped";
  latencyMs?: number;
  packetLoss?: number;
  details: string;
  telemetry: Record<string, unknown>;
}

export interface TestRunResult {
  status: "passed" | "failed" | "partial";
  results: ProtocolResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
  };
  telemetry: Array<{ timestamp: string; metric: string; value: number; unit: string }>;
}

// ── Service Metrics Types ─────────────────────────────────────────────────────

export interface MetricItem {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  status: "ok" | "warning" | "critical";
}

export interface MetricGroup {
  group: string;
  metrics: MetricItem[];
}

export interface FailedCollector {
  protocol: string;
  error: string;
  details: string;
}

export interface AssetMetricsResult {
  assetId?: string;
  assetName: string;
  assetType: string;
  assetIp: string;
  vendor: string;
  os: string;
  collectedAt: string;
  overallStatus: "healthy" | "degraded" | "unreachable";
  metricGroups: MetricGroup[];
  failedCollectors: FailedCollector[];
}

// ── Static data ───────────────────────────────────────────────────────────────

const MOCK_ENVIRONMENTS: MockEnv[] = [
  { id: "mock-env-001", name: "Enterprise Core Network", topology: "campus", nodeCount: 12 },
  { id: "mock-env-002", name: "Data Centre Fabric", topology: "spine-leaf", nodeCount: 8 },
  { id: "mock-env-003", name: "OT / ICS Segment", topology: "purdue", nodeCount: 6 },
  { id: "mock-env-004", name: "SD-WAN Branch Rollout", topology: "hub-spoke", nodeCount: 10 },
  { id: "mock-env-005", name: "IoT Platform Lab", topology: "flat", nodeCount: 15 },
];

const MOCK_ASSETS: MockAsset[] = [
  { name: "CORE-RTR-01", type: "router", ipAddress: "192.168.100.1", macAddress: "00:1A:2B:3C:4D:01", vendor: "Cisco", model: "CSR1000v", os: "IOS-XE 17.9", status: "online", interfaces: [{ name: "GigE0/0", ip: "192.168.100.1", mac: "00:1A:2B:3C:4D:01" }, { name: "GigE0/1", ip: "10.0.0.1", mac: "00:1A:2B:3C:4D:02" }] },
  { name: "CORE-SW-01", type: "switch", ipAddress: "192.168.100.2", macAddress: "00:1A:2B:3C:4D:11", vendor: "Arista", model: "vEOS-lab", os: "EOS 4.29", status: "online", interfaces: [{ name: "Eth1", ip: "192.168.100.2", mac: "00:1A:2B:3C:4D:11" }] },
  { name: "FW-PERIMETER-01", type: "firewall", ipAddress: "10.0.0.254", macAddress: "00:1A:2B:3C:4D:21", vendor: "Palo Alto", model: "PA-VM", os: "PAN-OS 11.1", status: "online", interfaces: [{ name: "eth1/1", ip: "10.0.0.254", mac: "00:1A:2B:3C:4D:21" }] },
  { name: "APP-SRV-01", type: "server", ipAddress: "10.0.10.10", macAddress: "00:1A:2B:3C:4D:31", vendor: "Generic", model: "Ubuntu VM", os: "Ubuntu 22.04", status: "online", interfaces: [{ name: "ens3", ip: "10.0.10.10", mac: "00:1A:2B:3C:4D:31" }] },
  { name: "DB-SRV-01", type: "server", ipAddress: "10.0.10.11", macAddress: "00:1A:2B:3C:4D:32", vendor: "Generic", model: "RHEL VM", os: "RHEL 9.2", status: "online", interfaces: [{ name: "eth0", ip: "10.0.10.11", mac: "00:1A:2B:3C:4D:32" }] },
  { name: "IOT-GW-01", type: "iot", ipAddress: "172.16.0.1", macAddress: "00:1A:2B:3C:4D:41", vendor: "Advantech", model: "EKI-1500", os: "Embedded Linux", status: "online", interfaces: [{ name: "eth0", ip: "172.16.0.1", mac: "00:1A:2B:3C:4D:41" }] },
  { name: "WAN-RTR-01", type: "router", ipAddress: "203.0.113.1", macAddress: "00:1A:2B:3C:4D:51", vendor: "Juniper", model: "vSRX", os: "Junos 22.4", status: "online", interfaces: [{ name: "ge-0/0/0", ip: "203.0.113.1", mac: "00:1A:2B:3C:4D:51" }] },
  { name: "LB-01", type: "loadbalancer", ipAddress: "10.0.0.100", macAddress: "00:1A:2B:3C:4D:61", vendor: "F5", model: "BIG-IP VE", os: "TMOS 17.1", status: "online", interfaces: [{ name: "1.1", ip: "10.0.0.100", mac: "00:1A:2B:3C:4D:61" }] },
];

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max)); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function metricStatus(value: number, warn: number, crit: number): "ok" | "warning" | "critical" {
  if (value >= crit) return "critical";
  if (value >= warn) return "warning";
  return "ok";
}

// ── Per-asset-type metric generation ─────────────────────────────────────────

function routerMetrics(asset: MockAsset): AssetMetricsResult {
  const cpu = rand(5, 72);
  const mem = rand(20, 78);
  const bgpNeighbors = randInt(2, 12);
  const bgpPrefixes = randInt(100, 850000);
  const ospfAdj = randInt(1, 8);
  const routes = randInt(200, 150000);
  const intf0Util = rand(1, 65);
  const intf1Util = rand(5, 85);
  return {
    assetName: asset.name, assetType: asset.type, assetIp: asset.ipAddress,
    vendor: asset.vendor, os: asset.os, collectedAt: new Date().toISOString(),
    overallStatus: cpu > 80 || mem > 85 ? "degraded" : "healthy",
    metricGroups: [
      {
        group: "System",
        metrics: [
          { key: "cpu", label: "CPU Utilisation", value: Math.round(cpu), unit: "%", status: metricStatus(cpu, 70, 90) },
          { key: "mem", label: "Memory Utilisation", value: Math.round(mem), unit: "%", status: metricStatus(mem, 75, 90) },
          { key: "uptime", label: "Uptime", value: `${randInt(1, 240)}d ${randInt(0, 23)}h`, status: "ok" },
        ],
      },
      {
        group: "Routing",
        metrics: [
          { key: "bgp_neighbors", label: "BGP Neighbours", value: bgpNeighbors, status: "ok" },
          { key: "bgp_prefixes", label: "BGP Prefixes", value: bgpPrefixes.toLocaleString(), status: "ok" },
          { key: "ospf_adj", label: "OSPF Adjacencies", value: ospfAdj, status: ospfAdj < 2 ? "warning" : "ok" },
          { key: "routes", label: "Route Table", value: routes.toLocaleString(), unit: "routes", status: "ok" },
        ],
      },
      {
        group: "Interfaces",
        metrics: [
          { key: "intf0", label: asset.interfaces[0]?.name || "GigE0/0", value: Math.round(intf0Util), unit: "%", status: metricStatus(intf0Util, 70, 90) },
          { key: "intf1", label: asset.interfaces[1]?.name || "GigE0/1", value: Math.round(intf1Util), unit: "%", status: metricStatus(intf1Util, 70, 90) },
          { key: "pkt_drop", label: "Packet Drops", value: randInt(0, 50), unit: "pps", status: randInt(0, 50) > 30 ? "warning" : "ok" },
        ],
      },
    ],
    failedCollectors: asset.vendor === "Cisco" ? [
      { protocol: "netconf", error: "SSH subsystem 'netconf' not enabled", details: "NETCONF requires 'ip ssh server algorithm hostkey rsa-sha2-256' and netconf-yang service on this IOS-XE build. SNMP fallback used." },
    ] : [],
  };
}

function switchMetrics(asset: MockAsset): AssetMetricsResult {
  const cpu = rand(3, 45);
  const mem = rand(15, 60);
  const portsUp = randInt(8, 48);
  const portsDown = randInt(0, 8);
  const macEntries = randInt(50, 8000);
  const pktRate = randInt(5000, 500000);
  const vlanCount = randInt(4, 64);
  return {
    assetName: asset.name, assetType: asset.type, assetIp: asset.ipAddress,
    vendor: asset.vendor, os: asset.os, collectedAt: new Date().toISOString(),
    overallStatus: "healthy",
    metricGroups: [
      {
        group: "System",
        metrics: [
          { key: "cpu", label: "CPU Utilisation", value: Math.round(cpu), unit: "%", status: metricStatus(cpu, 60, 80) },
          { key: "mem", label: "Memory Utilisation", value: Math.round(mem), unit: "%", status: metricStatus(mem, 70, 85) },
          { key: "temp", label: "Chassis Temp", value: randInt(38, 55), unit: "°C", status: "ok" },
        ],
      },
      {
        group: "Switching",
        metrics: [
          { key: "ports_up", label: "Ports Up", value: portsUp, status: "ok" },
          { key: "ports_down", label: "Ports Down", value: portsDown, status: portsDown > 4 ? "warning" : "ok" },
          { key: "vlans", label: "Active VLANs", value: vlanCount, status: "ok" },
          { key: "mac_table", label: "MAC Table Entries", value: macEntries.toLocaleString(), status: macEntries > 7000 ? "warning" : "ok" },
          { key: "stp", label: "STP State", value: "Root Bridge", status: "ok" },
        ],
      },
      {
        group: "Traffic",
        metrics: [
          { key: "pkt_rate", label: "Packet Rate", value: pktRate.toLocaleString(), unit: "pps", status: "ok" },
          { key: "bcast", label: "Broadcast Rate", value: randInt(10, 2000), unit: "pps", status: "ok" },
          { key: "errors", label: "Input Errors", value: randInt(0, 20), unit: "/s", status: "ok" },
        ],
      },
    ],
    failedCollectors: [],
  };
}

function serverMetrics(asset: MockAsset): AssetMetricsResult {
  const cpu = rand(5, 88);
  const mem = rand(30, 92);
  const disk = rand(20, 78);
  const load = rand(0.1, 4.5);
  const conns = randInt(50, 3500);
  const services = asset.os.includes("Ubuntu")
    ? ["nginx (active)", "sshd (active)", "cron (active)", "rsyslog (active)"]
    : ["httpd (active)", "sshd (active)", "crond (active)", "mysqld (active)", "firewalld (active)"];
  return {
    assetName: asset.name, assetType: asset.type, assetIp: asset.ipAddress,
    vendor: asset.vendor, os: asset.os, collectedAt: new Date().toISOString(),
    overallStatus: cpu > 85 || mem > 90 ? "degraded" : "healthy",
    metricGroups: [
      {
        group: "System",
        metrics: [
          { key: "cpu", label: "CPU Utilisation", value: Math.round(cpu), unit: "%", status: metricStatus(cpu, 75, 90) },
          { key: "mem", label: "Memory Utilisation", value: Math.round(mem), unit: "%", status: metricStatus(mem, 80, 95) },
          { key: "disk", label: "Disk Usage", value: Math.round(disk), unit: "%", status: metricStatus(disk, 75, 90) },
          { key: "load", label: "Load Average (1m)", value: load.toFixed(2), status: load > 4 ? "warning" : "ok" },
        ],
      },
      {
        group: "Services",
        metrics: [
          { key: "services", label: "Running Services", value: services.length, status: "ok" },
          { key: "service_list", label: "Services", value: services.slice(0, 2).join(", "), status: "ok" },
          { key: "active_conns", label: "Active Connections", value: conns, status: conns > 3000 ? "warning" : "ok" },
        ],
      },
      {
        group: "Network",
        metrics: [
          { key: "net_in", label: "Network In", value: Math.round(rand(5, 800)), unit: "Mbps", status: "ok" },
          { key: "net_out", label: "Network Out", value: Math.round(rand(5, 500)), unit: "Mbps", status: "ok" },
          { key: "retransmit", label: "TCP Retransmits", value: randInt(0, 50), unit: "/s", status: "ok" },
        ],
      },
    ],
    failedCollectors: [],
  };
}

function firewallMetrics(asset: MockAsset): AssetMetricsResult {
  const cpu = rand(10, 65);
  const sessionUtil = rand(20, 78);
  const conns = randInt(5000, 250000);
  const blocked = randInt(10, 5000);
  const threats = randInt(0, 150);
  return {
    assetName: asset.name, assetType: asset.type, assetIp: asset.ipAddress,
    vendor: asset.vendor, os: asset.os, collectedAt: new Date().toISOString(),
    overallStatus: threats > 100 ? "degraded" : "healthy",
    metricGroups: [
      {
        group: "System",
        metrics: [
          { key: "cpu", label: "CPU Utilisation", value: Math.round(cpu), unit: "%", status: metricStatus(cpu, 65, 85) },
          { key: "session_util", label: "Session Table", value: Math.round(sessionUtil), unit: "%", status: metricStatus(sessionUtil, 70, 90) },
          { key: "uptime", label: "Uptime", value: `${randInt(5, 180)}d`, status: "ok" },
        ],
      },
      {
        group: "Traffic",
        metrics: [
          { key: "active_conns", label: "Active Sessions", value: conns.toLocaleString(), status: conns > 200000 ? "warning" : "ok" },
          { key: "blocked", label: "Packets Blocked", value: blocked.toLocaleString(), unit: "/s", status: "ok" },
          { key: "throughput", label: "Throughput", value: Math.round(rand(0.5, 12)), unit: "Gbps", status: "ok" },
          { key: "nat_sessions", label: "NAT Sessions", value: randInt(100, 50000).toLocaleString(), status: "ok" },
        ],
      },
      {
        group: "Threats",
        metrics: [
          { key: "threats", label: "Threat Events", value: threats, unit: "/h", status: threats > 100 ? "critical" : threats > 50 ? "warning" : "ok" },
          { key: "ips_blocks", label: "IPS Blocks", value: randInt(0, 500), unit: "/h", status: "ok" },
          { key: "url_filter", label: "URL Filter Hits", value: randInt(100, 5000), unit: "/h", status: "ok" },
        ],
      },
    ],
    failedCollectors: [
      { protocol: "ssh", error: "Authentication failed — certificate required", details: "PAN-OS management plane requires certificate-based SSH auth. Probe is configured for password auth. REST API/XML API collection used as fallback." },
    ],
  };
}

function iotMetrics(asset: MockAsset): AssetMetricsResult {
  const temp = rand(18, 52);
  const signal = rand(-85, -45);
  const battery = rand(20, 100);
  const queueDepth = randInt(0, 500);
  return {
    assetName: asset.name, assetType: asset.type, assetIp: asset.ipAddress,
    vendor: asset.vendor, os: asset.os, collectedAt: new Date().toISOString(),
    overallStatus: temp > 48 || battery < 25 ? "degraded" : "healthy",
    metricGroups: [
      {
        group: "Environment",
        metrics: [
          { key: "temp", label: "Temperature", value: temp.toFixed(1), unit: "°C", status: temp > 48 ? "critical" : temp > 40 ? "warning" : "ok" },
          { key: "signal", label: "Signal Strength", value: Math.round(signal), unit: "dBm", status: signal < -75 ? "warning" : "ok" },
          { key: "battery", label: "Battery Level", value: Math.round(battery), unit: "%", status: battery < 25 ? "critical" : battery < 40 ? "warning" : "ok" },
        ],
      },
      {
        group: "Device",
        metrics: [
          { key: "fw", label: "Firmware", value: "EKI-1500 v2.4.1", status: "ok" },
          { key: "uptime", label: "Uptime", value: `${randInt(0, 45)}d ${randInt(0, 23)}h`, status: "ok" },
          { key: "reboots", label: "Unexpected Reboots", value: randInt(0, 3), status: "ok" },
        ],
      },
      {
        group: "MQTT",
        metrics: [
          { key: "queue", label: "Message Queue", value: queueDepth, status: queueDepth > 400 ? "warning" : "ok" },
          { key: "topics", label: "Active Topics", value: randInt(3, 25), status: "ok" },
          { key: "publish_rate", label: "Publish Rate", value: randInt(1, 100), unit: "msg/s", status: "ok" },
        ],
      },
    ],
    failedCollectors: [
      { protocol: "ssh", error: "Connection refused — port 22 not open", details: "EKI-1500 embedded firmware does not expose SSH daemon. Device only supports MQTT and limited HTTP API." },
      { protocol: "snmp", error: "SNMP timeout — community string mismatch or v2c not supported", details: "Device only supports SNMPv1. Probe attempted SNMPv2c GET. Switching to MQTT-based telemetry collection." },
    ],
  };
}

function loadbalancerMetrics(asset: MockAsset): AssetMetricsResult {
  const cpu = rand(8, 55);
  const conns = randInt(1000, 80000);
  const rps = randInt(500, 25000);
  const poolTotal = randInt(4, 20);
  const poolHealthy = randInt(Math.floor(poolTotal * 0.7), poolTotal);
  const sslTps = randInt(100, 5000);
  return {
    assetName: asset.name, assetType: asset.type, assetIp: asset.ipAddress,
    vendor: asset.vendor, os: asset.os, collectedAt: new Date().toISOString(),
    overallStatus: poolHealthy < poolTotal ? "degraded" : "healthy",
    metricGroups: [
      {
        group: "Traffic",
        metrics: [
          { key: "active_conns", label: "Active Connections", value: conns.toLocaleString(), status: "ok" },
          { key: "rps", label: "Requests/sec", value: rps.toLocaleString(), status: "ok" },
          { key: "throughput", label: "Throughput", value: Math.round(rand(100, 4000)), unit: "Mbps", status: "ok" },
          { key: "ssl_tps", label: "SSL TPS", value: sslTps.toLocaleString(), status: "ok" },
        ],
      },
      {
        group: "Pool Health",
        metrics: [
          { key: "pool_healthy", label: "Healthy Members", value: `${poolHealthy}/${poolTotal}`, status: poolHealthy < poolTotal ? "warning" : "ok" },
          { key: "pool_pct", label: "Pool Health", value: Math.round((poolHealthy / poolTotal) * 100), unit: "%", status: poolHealthy < poolTotal ? "warning" : "ok" },
          { key: "response_time", label: "Avg Response Time", value: Math.round(rand(5, 250)), unit: "ms", status: "ok" },
        ],
      },
      {
        group: "System",
        metrics: [
          { key: "cpu", label: "CPU Utilisation", value: Math.round(cpu), unit: "%", status: metricStatus(cpu, 60, 80) },
          { key: "mem", label: "Memory", value: Math.round(rand(30, 70)), unit: "%", status: "ok" },
        ],
      },
    ],
    failedCollectors: [],
  };
}

export function generateAssetMetrics(asset: MockAsset & { id?: string }): AssetMetricsResult {
  const result = (() => {
    switch (asset.type) {
      case "router": return routerMetrics(asset);
      case "switch": return switchMetrics(asset);
      case "server": return serverMetrics(asset);
      case "firewall": return firewallMetrics(asset);
      case "iot": return iotMetrics(asset);
      case "loadbalancer": return loadbalancerMetrics(asset);
      default: return serverMetrics(asset);
    }
  })();
  result.assetId = asset.id;
  return result;
}

// ── Protocol validation (original) ───────────────────────────────────────────

function protocolResult(protocol: string, target: string, forcePass?: boolean): ProtocolResult {
  const roll = Math.random();
  const pass = forcePass || roll > 0.15;
  const latency = rand(0.8, 45);
  const detailMap: Record<string, string> = {
    icmp: pass ? `Echo reply received, RTT ${latency.toFixed(1)}ms` : "Request timeout — no ICMP reply",
    ssh: pass ? `Session established, key exchange OK (ED25519), banner received` : "Connection refused on port 22",
    snmp: pass ? `OID .1.3.6.1.2.1.1.1.0 → ${target} sysDescr retrieved successfully` : "SNMP timeout — community string mismatch",
    http: pass ? `HTTP 200 OK, ${randInt(1, 60)}KB response, TLS 1.3` : "HTTP 503 Service Unavailable",
    https: pass ? `HTTPS 200 OK, cert valid (expires ${randInt(60, 365)}d), TLS 1.3` : "SSL certificate verification failed",
    netconf: pass ? `NETCONF hello exchanged, capabilities negotiated, XML validated` : "NETCONF session refused — SSH subsystem not enabled",
    bgp: pass ? `BGP OPEN received, ASN ${randInt(64512, 65535)}, ${randInt(10, 500)} prefixes advertised` : "BGP OPEN rejected — AS mismatch",
    ospf: pass ? `OSPF HELLO received, area 0.0.0.0, router-id ${target}, DR elected` : "OSPF adjacency failed — dead interval mismatch",
    modbus: pass ? `Modbus/TCP FC03 — read ${randInt(1, 100)} holding registers OK` : "Modbus exception code 0x02 — illegal data address",
    mqtt: pass ? `MQTT CONNACK received, QoS ${randInt(0, 2)} subscribe OK, ${randInt(1, 20)} topics` : "MQTT connection refused — bad credentials",
  };
  return {
    protocol,
    target,
    status: pass ? "passed" : "failed",
    latencyMs: pass ? latency : undefined,
    packetLoss: pass ? rand(0, 2) : rand(30, 100),
    details: detailMap[protocol] || (pass ? `${protocol.toUpperCase()} validation passed` : `${protocol.toUpperCase()} validation failed`),
    telemetry: {
      timestamp: new Date().toISOString(),
      latencyMs: latency,
      retries: randInt(0, 3),
      bytesXferred: randInt(100, 5000),
    },
  };
}

export class MockProviderAdapter implements ProviderAdapter {
  async testConnection() {
    await sleep(randInt(200, 600));
    return { success: true, message: "Mock provider ready — all systems nominal", latency: randInt(8, 45) };
  }

  async listEnvironments() { return MOCK_ENVIRONMENTS; }

  async reserveEnvironment(envId: string) {
    await sleep(randInt(800, 2000));
    return { providerEnvId: envId };
  }

  async releaseEnvironment(_providerEnvId: string) {
    await sleep(randInt(300, 800));
  }

  async discoverAssets(providerEnvId: string) {
    await sleep(randInt(1500, 3000));
    const env = MOCK_ENVIRONMENTS.find(e => e.id === providerEnvId);
    const count = env?.nodeCount || 4;
    const shuffled = [...MOCK_ASSETS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, MOCK_ASSETS.length));
  }

  async deployProbe(opts: DeployProbeOpts) {
    await sleep(randInt(2000, 5000));
    return { containerId: `hcn-probe-${opts.probeName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}` };
  }

  async undeployProbe(_containerId: string) {
    await sleep(randInt(500, 1500));
  }

  async runValidationTest(opts: RunTestOpts): Promise<TestRunResult> {
    await sleep(randInt(3000, 7000));
    const results: ProtocolResult[] = [];
    for (const asset of opts.targetAssets) {
      for (const protocol of opts.protocols) {
        results.push(protocolResult(protocol, asset.ipAddress || asset.name));
      }
    }
    if (results.length === 0) {
      for (const protocol of opts.protocols) {
        results.push(protocolResult(protocol, "10.0.0.1", true));
      }
    }
    const passed = results.filter(r => r.status === "passed").length;
    const failed = results.filter(r => r.status === "failed").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const passRate = results.length > 0 ? (passed / results.length) * 100 : 0;
    const telemetry = [];
    for (let i = 0; i < 20; i++) {
      telemetry.push({ timestamp: new Date(Date.now() - (20 - i) * 15000).toISOString(), metric: "latency_p95", value: rand(1, 50), unit: "ms" });
      telemetry.push({ timestamp: new Date(Date.now() - (20 - i) * 15000).toISOString(), metric: "packet_loss", value: rand(0, 5), unit: "%" });
      telemetry.push({ timestamp: new Date(Date.now() - (20 - i) * 15000).toISOString(), metric: "throughput", value: rand(10, 1000), unit: "Mbps" });
    }
    return {
      status: passRate === 100 ? "passed" : passRate < 50 ? "failed" : "partial",
      results,
      summary: { total: results.length, passed, failed, skipped, passRate },
      telemetry,
    };
  }
}

export function getProviderAdapter(type: string): ProviderAdapter {
  switch (type) {
    case "eve-ng":
    case "cml":
    case "gns3":
    case "netlab":
    case "custom":
    case "mock":
    default:
      return new MockProviderAdapter();
  }
}
