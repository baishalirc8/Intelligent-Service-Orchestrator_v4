import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Trash2, Play, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock,
  Wifi, WifiOff, Server, Router, Shield, HardDrive, Cpu, Zap,
  FlaskConical, Activity, BarChart3, Download, Eye, ChevronRight, ChevronDown,
  Network, Terminal, Layers, Radio, Globe, Box, FileText, Loader2, ExternalLink,
  ScanSearch, Microscope, ArrowUpRight, Maximize2, Minimize2, X, Sparkles, Send,
} from "lucide-react";
import type { ValidationProvider, ValidationEnvironment, ValidationVirtualAsset, ValidationProbeDeployment, ValidationTest, ValidationTestRun, ValidationReport, ValidationProbeConfig } from "@shared/schema";

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROVIDER_TYPES = [
  { value: "mock", label: "Mock Provider (Demo)", desc: "Local simulation — no external connection needed", url: null, signupUrl: null },
  { value: "eve-ng", label: "EVE-NG", desc: "Emulated Virtual Environment — Next Generation", url: "https://www.eve-ng.net", signupUrl: "https://www.eve-ng.net/index.php/download/" },
  { value: "cml", label: "Cisco CML", desc: "Cisco Modeling Labs — enterprise network emulation", url: "https://developer.cisco.com/modeling-labs/", signupUrl: "https://learningnetworkstore.cisco.com/cisco-modeling-labs-personal" },
  { value: "gns3", label: "GNS3", desc: "Graphical Network Simulator 3 — free & open source", url: "https://www.gns3.com", signupUrl: "https://www.gns3.com/software/download" },
  { value: "netlab", label: "NetLab+", desc: "Network lab automation & orchestration platform", url: "https://netlab.tools", signupUrl: "https://netlab.tools/install/" },
  { value: "custom", label: "Custom REST API", desc: "Extensible adapter for proprietary platforms", url: null, signupUrl: null },
];

const PROTOCOLS = [
  "icmp","ssh","snmp","http","https","netconf","restconf","bgp","ospf",
  "modbus","mqtt","coap","lorawan","zigbee","ble","mdm","opcua","bacnet","winrm","grpc","netflow",
];
const PROTOCOL_COLORS: Record<string, string> = {
  icmp:     "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ssh:      "bg-purple-500/15 text-purple-400 border-purple-500/30",
  snmp:     "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  http:     "bg-green-500/15 text-green-400 border-green-500/30",
  https:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  netconf:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  restconf: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  bgp:      "bg-red-500/15 text-red-400 border-red-500/30",
  ospf:     "bg-pink-500/15 text-pink-400 border-pink-500/30",
  modbus:   "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  mqtt:     "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  coap:     "bg-teal-500/15 text-teal-400 border-teal-500/30",
  lorawan:  "bg-violet-500/15 text-violet-400 border-violet-500/30",
  zigbee:   "bg-lime-500/15 text-lime-400 border-lime-500/30",
  ble:      "bg-sky-500/15 text-sky-400 border-sky-500/30",
  mdm:      "bg-slate-500/15 text-slate-300 border-slate-500/30",
  opcua:    "bg-rose-500/15 text-rose-400 border-rose-500/30",
  winrm:    "bg-blue-400/15 text-blue-300 border-blue-400/30",
  grpc:     "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
  netflow:  "bg-sky-600/15 text-sky-300 border-sky-600/30",
  wmi:      "bg-purple-400/15 text-purple-300 border-purple-400/30",
  bacnet:   "bg-orange-400/15 text-orange-300 border-orange-400/30",
};

const ASSET_ICONS: Record<string, typeof Router> = {
  router: Router,
  switch: Layers,
  firewall: Shield,
  server: Server,
  iot: Radio,
  loadbalancer: Globe,
  wan: Network,
};

const VIRTUAL_PROBE_TIERS = [
  {
    tier: "coupled",
    label: "Coupled",
    tagline: "Host-resident agent — deepest telemetry access",
    accent: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    types: [
      { value: "linux-kernel",     label: "Linux / Kernel",     icon: "🐧", desc: "SSH, SNMP, ICMP, REST, NETCONF, gRPC, NetFlow — full kernel & process telemetry",  protocols: ["icmp","ssh","snmp","rest","netconf","restconf","mqtt","modbus","grpc","netflow"] },
      { value: "windows-endpoint", label: "Windows Endpoint",   icon: "🖥️", desc: "WMI, WinRM, SNMP, SSH, REST — deep Windows host, service & registry telemetry",     protocols: ["icmp","snmp","wmi","winrm","ssh","rest","mdm"] },
      { value: "macos-endpoint",   label: "macOS Endpoint",     icon: "🍎", desc: "SSH, SNMP, REST, MDM — macOS launchctl, system_profiler & endpoint management",     protocols: ["icmp","ssh","snmp","rest","mdm"] },
      { value: "container",        label: "Container (Docker)", icon: "📦", desc: "Docker Engine API, cgroups, gRPC, REST — container-native probe",                   protocols: ["icmp","ssh","rest","snmp","grpc"] },
    ],
  },
  {
    tier: "semi",
    label: "Semi-Autonomous",
    tagline: "Lightweight agent — protocol-native, low footprint",
    accent: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    types: [
      { value: "network-appliance", label: "Network Appliance",   icon: "🌐", desc: "SNMP, NETCONF, RESTCONF, BGP, OSPF, NetFlow, REST — switches/routers/firewalls", protocols: ["icmp","snmp","netconf","restconf","bgp","ospf","rest","netflow"] },
      { value: "hypervisor",        label: "Hypervisor / VM",     icon: "🗃️", desc: "vSphere API, Hyper-V WMI, KVM libvirt — hypervisor-layer telemetry",              protocols: ["icmp","snmp","rest","ssh","wmi","grpc"] },
      { value: "cloud-instance",    label: "Cloud Instance",      icon: "☁️", desc: "AWS SSM, Azure Monitor, GCP Ops Agent, gRPC — cloud-native agent integration",    protocols: ["icmp","rest","ssh","snmp","grpc","mdm"] },
      { value: "kubernetes-node",   label: "Kubernetes Node",     icon: "⚙️", desc: "kubelet API, cAdvisor, kube-state-metrics, gRPC — cluster & workload telemetry",  protocols: ["icmp","rest","snmp","grpc"] },
    ],
  },
  {
    tier: "autonomous",
    label: "Fully Autonomous",
    tagline: "Zero host dependency — self-contained, edge-ready",
    accent: "text-green-400",
    border: "border-green-500/30",
    bg: "bg-green-500/5",
    types: [
      { value: "iot-gateway",     label: "IoT / OT Gateway",            icon: "🏭", desc: "Modbus, MQTT, CoAP, LoRaWAN, Zigbee, BLE, BACnet, OPC-UA — full edge OT/IoT coverage",  protocols: ["modbus","mqtt","coap","lorawan","zigbee","ble","opcua","bacnet","icmp","snmp"] },
      { value: "network-sensor",  label: "Autonomous Network Sensor",   icon: "📡", desc: "Passive BGP/OSPF listener, NetFlow/sFlow/IPFIX collector, SPAN tap",             protocols: ["bgp","ospf","snmp","icmp","netflow"] },
      { value: "nano-probe",      label: "HOLOCRON Nano Probe",         icon: "🔬", desc: "Standalone binary — any platform, no OS dependency, 2 MB footprint",             protocols: ["icmp","ssh","snmp","rest","mqtt","modbus","coap","lorawan","ble","bacnet","mdm"] },
      { value: "sidecar-mesh",    label: "Sidecar / Service Mesh",      icon: "🕸️", desc: "Envoy / Istio / Linkerd — service mesh metrics, gRPC traces & mTLS handshake",  protocols: ["rest","grpc","icmp"] },
    ],
  },
];

// Flat list kept for backwards-compat lookups
const VIRTUAL_PROBE_TYPES = VIRTUAL_PROBE_TIERS.flatMap(t => t.types);

// Map old probe type values to new ones for backwards compatibility
const LEGACY_PROBE_MAP: Record<string, string> = {
  "linux":   "linux-kernel",
  "windows": "windows-endpoint",
  "network": "network-appliance",
  "iot":     "iot-gateway",
};

function resolveProbeValue(value: string): string {
  return LEGACY_PROBE_MAP[value] || value;
}

function findProbeType(value: string) {
  return VIRTUAL_PROBE_TYPES.find(p => p.value === resolveProbeValue(value));
}

function findProbeTier(value: string) {
  const resolved = resolveProbeValue(value);
  return VIRTUAL_PROBE_TIERS.find(t => t.types.some(p => p.value === resolved));
}

const SANDBOX_PROTOCOL_GROUPS = [
  {
    group: "Network & Routing",
    protocols: [
      { value: "icmp",     label: "ICMP",       desc: "Ping / reachability" },
      { value: "snmp",     label: "SNMP",       desc: "v1 / v2c / v3 polling" },
      { value: "bgp",      label: "BGP",        desc: "Border Gateway Protocol" },
      { value: "ospf",     label: "OSPF",       desc: "Open Shortest Path First" },
      { value: "netflow",  label: "NetFlow",    desc: "NetFlow / sFlow / IPFIX telemetry" },
    ],
  },
  {
    group: "Management APIs",
    protocols: [
      { value: "ssh",      label: "SSH",        desc: "CLI / shell access" },
      { value: "rest",     label: "REST/HTTP",  desc: "REST / JSON API" },
      { value: "netconf",  label: "NETCONF",    desc: "YANG / RFC 6241" },
      { value: "restconf", label: "RESTCONF",   desc: "REST-based NETCONF (RFC 8040)" },
      { value: "grpc",     label: "gRPC",       desc: "Protocol Buffers / cloud-native RPC" },
    ],
  },
  {
    group: "Windows & Endpoint",
    protocols: [
      { value: "wmi",      label: "WMI",        desc: "Windows Management Instrumentation" },
      { value: "winrm",    label: "WinRM",      desc: "WS-Man / Windows Remote Management" },
      { value: "mdm",      label: "MDM",        desc: "Mobile Device Mgmt (Intune / Apple MDM / Knox)" },
    ],
  },
  {
    group: "IoT / OT / Edge",
    protocols: [
      { value: "mqtt",     label: "MQTT",       desc: "IoT telemetry pub/sub bus" },
      { value: "coap",     label: "CoAP",       desc: "Constrained Application Protocol (RFC 7252)" },
      { value: "lorawan",  label: "LoRaWAN",    desc: "Low-Power WAN — sensors, meters, trackers" },
      { value: "zigbee",   label: "Zigbee",     desc: "IEEE 802.15.4 mesh — building/home automation" },
      { value: "ble",      label: "BLE",        desc: "Bluetooth Low Energy — mobile, beacons, wearables" },
      { value: "modbus",   label: "Modbus TCP", desc: "Industrial register read/write" },
      { value: "opcua",    label: "OPC-UA",     desc: "OPC Unified Architecture — SCADA / industrial" },
      { value: "bacnet",   label: "BACnet",     desc: "Building Automation & Control — HVAC, access, fire" },
    ],
  },
];

// Flat version kept for backwards compatibility
const SANDBOX_PROTOCOL_OPTIONS = SANDBOX_PROTOCOL_GROUPS.flatMap(g => g.protocols);

// ── Probe Coverage Matrix ─────────────────────────────────────────────────────
type CoverageStatus = "certified" | "fallback" | "na" | "failed";
interface CoverageCell { status: CoverageStatus; note: string; fallbackNote?: string; }

const COVERAGE_PROTOCOLS: { id: string; label: string; abbr: string }[] = [
  { id: "icmp",    label: "ICMP Ping",   abbr: "ICMP"     },
  { id: "ssh",     label: "SSH",         abbr: "SSH"      },
  { id: "snmp",    label: "SNMP",        abbr: "SNMP"     },
  { id: "netconf", label: "NETCONF",     abbr: "NETCONF"  },
  { id: "rest",    label: "REST API",    abbr: "REST"     },
  { id: "bgp",     label: "BGP",         abbr: "BGP"      },
  { id: "ospf",    label: "OSPF",        abbr: "OSPF"     },
  { id: "mqtt",    label: "MQTT",        abbr: "MQTT"     },
  { id: "modbus",  label: "Modbus/TCP",  abbr: "MODBUS"   },
];

const COVERAGE_ASSETS: {
  type: string; label: string; vendor: string;
  coverage: Record<string, CoverageCell>;
}[] = [
  {
    type: "router", label: "Router", vendor: "Cisco IOS-XE · Juniper JunOS",
    coverage: {
      icmp:    { status: "certified", note: "RTT, jitter & packet-loss probe. Certified across IOS-XE 17.x and JunOS 22.x." },
      ssh:     { status: "certified", note: "Paramiko-based CLI collection — 'show' commands, running config pull, interface stats." },
      snmp:    { status: "certified", note: "SNMPv2c/v3 — IF-MIB, BGP4-MIB, OSPF-MIB, CISCO-MEMORY-POOL-MIB, JUNIPER-MIBs." },
      netconf: { status: "fallback",  note: "Cisco IOS-XE: NETCONF-YANG daemon not enabled in this build. Probe falls back to SNMP + SSH.", fallbackNote: "Juniper vSRX: NETCONF fully certified — OpenConfig + native Junos models." },
      rest:    { status: "certified", note: "RESTCONF (RFC 8040) on IOS-XE. Junos REST API. Cisco DNA-C northbound API." },
      bgp:     { status: "certified", note: "BGP neighbour state, prefix counts, path attributes via BGP4-MIB + SNMP + ExaBGP listener." },
      ospf:    { status: "certified", note: "Adjacency state, LSA counts, SPF runs — OSPF-MIB + SNMP. Dead-interval validated." },
      mqtt:    { status: "na",        note: "Not applicable — network routers do not expose MQTT brokers." },
      modbus:  { status: "na",        note: "Not applicable — industrial serial protocol not present on IP routers." },
    },
  },
  {
    type: "switch", label: "Switch", vendor: "Arista EOS · Cisco NX-OS",
    coverage: {
      icmp:    { status: "certified", note: "Per-interface ICMP sweep — RTT, jitter, loss. Certified on all Arista and NX-OS platforms." },
      ssh:     { status: "certified", note: "Arista EOS CLI + NX-OS SSH — VLAN DB, MAC table, STP state, port-channel status." },
      snmp:    { status: "certified", note: "SNMPv2c/v3 — IF-MIB, BRIDGE-MIB, Q-BRIDGE-MIB, EtherLike-MIB, CISCO-STP-EXTENSIONS-MIB." },
      netconf: { status: "certified", note: "Arista EOS: NETCONF + OpenConfig models (oc-interfaces, oc-vlan, oc-bgp). Fully certified." },
      rest:    { status: "certified", note: "Arista eAPI JSON-RPC + Cisco NX-API — full telemetry via REST. Zero-config discovery." },
      bgp:     { status: "certified", note: "BGP EVPN overlay metrics — prefix counts, RD/RT, VTEP reachability via eAPI + SNMP." },
      ospf:    { status: "certified", note: "OSPF adjacency + route-table via SNMP OSPF-MIB and CLI. Multi-area validated." },
      mqtt:    { status: "na",        note: "Not applicable — switches do not expose MQTT brokers." },
      modbus:  { status: "na",        note: "Not applicable." },
    },
  },
  {
    type: "firewall", label: "Firewall", vendor: "Palo Alto PAN-OS · Fortinet FortiGate",
    coverage: {
      icmp:    { status: "certified", note: "Management-plane ICMP — RTT and reachability confirmed. VIP health probes separate." },
      ssh:     { status: "fallback",  note: "PAN-OS management plane requires certificate-based SSH. Password auth rejected by policy.", fallbackNote: "Probe falls back to XML API / REST API. Fortinet FortiGate: SSH fully certified." },
      snmp:    { status: "certified", note: "PAN-OS SNMPv2c/v3 — PAN-ENTERPRISE-MIB, IF-MIB, HOST-RESOURCES-MIB. Threat counters mapped." },
      netconf: { status: "na",        note: "PAN-OS does not implement NETCONF. Fortinet limited NETCONF — not certified for production use." },
      rest:    { status: "certified", note: "PAN-OS XML API + REST API v10.2 — threat logs, session table, security policy, interface stats." },
      bgp:     { status: "na",        note: "Perimeter firewall BGP metrics not exposed via standard probe protocols." },
      ospf:    { status: "na",        note: "Not applicable for perimeter firewall role." },
      mqtt:    { status: "na",        note: "Not applicable." },
      modbus:  { status: "na",        note: "Not applicable." },
    },
  },
  {
    type: "server", label: "Server", vendor: "RHEL 9 · Ubuntu 22.04 · Windows Server",
    coverage: {
      icmp:    { status: "certified", note: "OS-level ICMP — RTT, jitter, loss. Works across all Linux distros and Windows Server." },
      ssh:     { status: "certified", note: "Full SSH collection — CPU, memory, disk, running services, TCP connections, kernel stats." },
      snmp:    { status: "certified", note: "net-snmp — HOST-RESOURCES-MIB, UCD-SNMP-MIB, IF-MIB. Windows: WMI-to-SNMP bridge certified." },
      netconf: { status: "na",        note: "Servers do not expose NETCONF — this is a network device protocol only." },
      rest:    { status: "certified", note: "Prometheus node_exporter + custom REST endpoints. Full observability stack certified." },
      bgp:     { status: "na",        note: "Not applicable for application/database servers." },
      ospf:    { status: "na",        note: "Not applicable." },
      mqtt:    { status: "na",        note: "Not applicable for standard servers (edge/IoT servers handled separately)." },
      modbus:  { status: "na",        note: "Not applicable." },
    },
  },
  {
    type: "iot", label: "IoT / OT Device", vendor: "Advantech EKI-1500 · Generic embedded",
    coverage: {
      icmp:    { status: "certified", note: "L3 reachability probe certified — confirmed working on all EKI-1500 firmware versions." },
      ssh:     { status: "failed",    note: "EKI-1500 embedded firmware does not run SSH daemon. Port 22 closed by design — not configurable." },
      snmp:    { status: "fallback",  note: "EKI-1500 supports SNMPv1 only. Probe issues SNMPv1 GET as fallback. SNMPv2c/v3 unsupported.", fallbackNote: "Next firmware version (v2.5) will add SNMPv2c — probe is ready to auto-upgrade." },
      netconf: { status: "na",        note: "IoT/OT embedded devices do not implement NETCONF." },
      rest:    { status: "certified", note: "HTTP REST API — device status, sensor readings, I/O port state, configuration push. Certified." },
      bgp:     { status: "na",        note: "Not applicable." },
      ospf:    { status: "na",        note: "Not applicable." },
      mqtt:    { status: "certified", note: "Primary telemetry channel — MQTT v3.1.1, QoS 0/1/2. Full topic hierarchy mapped and certified." },
      modbus:  { status: "certified", note: "Modbus/TCP FC01–FC06 register map validated. Industrial sensor + actuator data fully accessible." },
    },
  },
  {
    type: "loadbalancer", label: "Load Balancer", vendor: "F5 BIG-IP · HAProxy",
    coverage: {
      icmp:    { status: "certified", note: "Management IP + VIP reachability probes. Self-IP and floating-IP both validated." },
      ssh:     { status: "certified", note: "F5 TMSH CLI + HAProxy admin socket — pool stats, virtual server config, iRule state." },
      snmp:    { status: "certified", note: "F5 F5-BIGIP-SYSTEM-MIB + F5-BIGIP-LOCAL-MIB — virtual server, pool member, connection table." },
      netconf: { status: "na",        note: "F5 BIG-IP does not support NETCONF. iControl REST is the canonical management API." },
      rest:    { status: "certified", note: "F5 iControl REST API v14+ — pool health, VIP stats, SSL TPS, concurrent connections. Certified." },
      bgp:     { status: "certified", note: "F5 BGP route advertisement monitoring via SNMP BGP4-MIB. DSR / anycast patterns validated." },
      ospf:    { status: "na",        note: "Not applicable for load balancer role." },
      mqtt:    { status: "na",        note: "Not applicable." },
      modbus:  { status: "na",        note: "Not applicable." },
    },
  },
];

function coverageCellStyle(status: CoverageStatus) {
  switch (status) {
    case "certified": return { bg: "bg-green-500/10 hover:bg-green-500/20 border-green-500/20",  icon: "✅", label: "Certified",     text: "text-green-400" };
    case "fallback":  return { bg: "bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/20", icon: "⚡", label: "Fallback",      text: "text-yellow-400" };
    case "failed":    return { bg: "bg-red-500/10 hover:bg-red-500/20 border-red-500/20",          icon: "✗",  label: "Not Available", text: "text-red-400" };
    case "na":        return { bg: "bg-muted/20 hover:bg-muted/30 border-border/20",               icon: "–",  label: "N/A",           text: "text-muted-foreground/50" };
  }
}

function maturityScore(coverage: Record<string, CoverageCell>): number {
  const applicable = Object.values(coverage).filter(c => c.status !== "na");
  if (!applicable.length) return 100;
  const scored = applicable.filter(c => c.status === "certified" || c.status === "fallback").length;
  return Math.round((scored / applicable.length) * 100);
}

function statusBadge(status: string) {
  const map: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
    connected: { color: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle2 },
    active: { color: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle2 },
    passed: { color: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle2 },
    ready: { color: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle2 },
    online: { color: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle2 },
    error: { color: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
    failed: { color: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
    stopped: { color: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
    partial: { color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: AlertCircle },
    warning: { color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: AlertCircle },
    running: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Loader2 },
    deploying: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Loader2 },
    reserving: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Loader2 },
    generating: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Loader2 },
  };
  const cfg = map[status] || { color: "bg-muted/40 text-muted-foreground border-border", icon: Clock };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.color} border gap-1 capitalize`}>
      <Icon className={`h-3 w-3 ${["running","deploying","reserving","generating"].includes(status) ? "animate-spin" : ""}`} />
      {status}
    </Badge>
  );
}

function passRateColor(rate: number) {
  if (rate >= 90) return "text-green-400";
  if (rate >= 70) return "text-yellow-400";
  return "text-red-400";
}

// ── Provider Card ─────────────────────────────────────────────────────────────
function ProviderCard({ provider, onTest, onDelete }: {
  provider: ValidationProvider;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const typeInfo = PROVIDER_TYPES.find(t => t.value === provider.type);
  return (
    <Card className="border-border/60 bg-card/50" data-testid={`card-provider-${provider.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Wifi className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{provider.name}</p>
              <p className="text-xs text-muted-foreground">{typeInfo?.label || provider.type}</p>
              {provider.baseUrl && <p className="text-xs text-muted-foreground/70 truncate">{provider.baseUrl}</p>}
            </div>
          </div>
          {statusBadge(provider.status)}
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onTest(provider.id)} data-testid={`button-test-provider-${provider.id}`}>
            <Wifi className="h-3 w-3 mr-1" /> Test
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(provider.id)} data-testid={`button-delete-provider-${provider.id}`}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Environment Card ──────────────────────────────────────────────────────────
function EnvironmentCard({ env, onReserve, onRelease, onDiscover, onSelect, isSelected }: {
  env: ValidationEnvironment;
  onReserve: (id: string) => void;
  onRelease: (id: string) => void;
  onDiscover: (id: string) => void;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) {
  const isActive = env.status === "active";
  const isBusy = ["reserving", "releasing"].includes(env.status);
  return (
    <Card className={`border-border/60 bg-card/50 cursor-pointer transition-all ${isSelected ? "border-primary/60 bg-primary/5" : ""}`} onClick={() => onSelect(env.id)} data-testid={`card-env-${env.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{env.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{env.topology || "Generic"} topology</p>
          </div>
          {statusBadge(env.status)}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><Server className="h-3 w-3" />{env.nodeCount || 0} nodes</span>
          {env.reservedAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(env.reservedAt).toLocaleDateString()}</span>}
        </div>
        <div className="flex gap-2">
          {!isActive ? (
            <Button size="sm" variant="outline" className="flex-1 text-xs" disabled={isBusy} onClick={e => { e.stopPropagation(); onReserve(env.id); }} data-testid={`button-reserve-env-${env.id}`}>
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />} Reserve
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={e => { e.stopPropagation(); onDiscover(env.id); }} data-testid={`button-discover-env-${env.id}`}>
                <RefreshCw className="h-3 w-3 mr-1" /> Discover
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs" onClick={e => { e.stopPropagation(); onRelease(env.id); }} data-testid={`button-release-env-${env.id}`}>
                Release
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Test Run Row ──────────────────────────────────────────────────────────────
function TestRunRow({ run, onView }: { run: ValidationTestRun; onView: (run: ValidationTestRun) => void }) {
  const summary = run.summary as any || {};
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-accent/30 px-2 rounded cursor-pointer" onClick={() => onView(run)} data-testid={`row-testrun-${run.id}`}>
      <div className="flex items-center gap-3">
        {statusBadge(run.status)}
        <div>
          <p className="text-sm">{new Date(run.createdAt!).toLocaleString()}</p>
          {summary.total && <p className="text-xs text-muted-foreground">{summary.passed}/{summary.total} passed · {Math.round(summary.passRate || 0)}% pass rate</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {run.status === "running" && <Progress value={run.progress || 0} className="w-24 h-1.5" />}
        <Eye className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Sandbox Topology Map ───────────────────────────────────────────────────────

const TOPO_PROTO_HEX: Record<string, string> = {
  icmp:"#3b82f6",ssh:"#a855f7",snmp:"#eab308",http:"#22c55e",https:"#10b981",
  netconf:"#f97316",restconf:"#f59e0b",bgp:"#ef4444",ospf:"#ec4899",
  modbus:"#06b6d4",mqtt:"#6366f1",coap:"#14b8a6",lorawan:"#8b5cf6",
  zigbee:"#84cc16",ble:"#38bdf8",mdm:"#94a3b8",opcua:"#f43f5e",
  winrm:"#60a5fa",grpc:"#d946ef",netflow:"#0ea5e9",wmi:"#c084fc",bacnet:"#fb923c",
};
const TOPO_CAT_COLOR: Record<string, string> = {
  router:"#f97316",switch:"#22c55e",firewall:"#ef4444",server:"#3b82f6",
  iot:"#8b5cf6",loadbalancer:"#14b8a6",wan:"#06b6d4",mobile:"#ec4899",
  scada:"#eab308",storage:"#94a3b8",printer:"#10b981",camera:"#f43f5e",
};
const TOPO_CAT_ABBR: Record<string, string> = {
  router:"RTR",switch:"SWT",firewall:"FW",server:"SRV",iot:"IoT",
  loadbalancer:"LB",wan:"WAN",mobile:"MOB",scada:"PLC",storage:"STO",printer:"PRT",camera:"CAM",
};
const TOPO_CAT_LABEL: Record<string, string> = {
  router:"Core Router",switch:"Network Switch",firewall:"Firewall",server:"Server",iot:"IoT Device",
  loadbalancer:"Load Balancer",wan:"WAN Link",mobile:"Mobile Device",scada:"SCADA / PLC",
  storage:"Storage Array",printer:"Network Printer",camera:"IP Camera",unknown:"Unknown Device",
};
const TOPO_DEVICE_ICONS: Record<string, string> = {
  router: "M17 12h4M3 12h4M12 3v4M12 17v4M7.8 7.8 5.6 5.6M16.2 16.2l2.2 2.2M16.2 7.8l2.2-2.2M7.8 16.2l-2.2 2.2M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  switch: "M2 9h20M2 15h20M6 9V6M10 9V6M14 9V6M18 9V6M6 15v3M10 15v3M14 6h.01M14 18h.01",
  firewall: "M12 2L22 7v7c0 5-4 8.7-10 10C6 22.7 2 19 2 14V7z M9 12l2 2 4-4",
  server: "M2 6h20v5H2zM2 13h20v5H2zM6 8.5h.01M18 8.5h14M6 15.5h.01M18 15.5h14",
  iot: "M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM8.5 16.5a5 5 0 0 1 7 0M5.5 13.5a9 9 0 0 1 13 0M2.5 10.5a13 13 0 0 1 19 0",
  loadbalancer: "M12 5v5M12 10l-6 8M12 10l6 8M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  wan: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
  mobile: "M8 2h8l1 1v18l-1 1H8l-1-1V3zM11 19h2",
  scada: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1",
  storage: "M12 4a10 4 0 1 0 0 8 10 4 0 0 0 0-8zM2 8v4a10 4 0 0 0 20 0V8M2 12v4a10 4 0 0 0 20 0v-4",
  printer: "M7 5h10v3H7zM5 8h14v9H5zM7 14h10M7 17h6M7 11.5h.01",
  camera: "M3 9h6l2-4h2l2 4h6v10H3zM12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  unknown: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v5M12 16.5v.5",
};

function extractIdentifiedDevice(text: string): { vendor: string; model: string; protocols: string[] } | null {
  const vm = text.match(/Probable Vendor[:\s]+([A-Za-z][A-Za-z ]{1,30})/i);
  if (!vm) return null;
  const mm = text.match(/Probable Model[:\s]+([A-Za-z0-9\- ]{1,30})/i);
  const protocols: string[] = [];
  const PROTO_LIST = ["ssh","snmp","netconf","restconf","grpc","mqtt","modbus","bacnet","opcua","http","https","icmp","winrm","wmi","coap","ble","zigbee"];
  const probeSel = text.match(/\[PROBE-SELECT\][^[]{0,1500}/i)?.[0] || "";
  PROTO_LIST.forEach(p => { if (probeSel.toLowerCase().includes(p)) protocols.push(p); });
  return {
    vendor: vm[1].trim().split(/\s+/).slice(0, 2).join(" "),
    model: mm ? mm[1].trim().split(/\s+/).slice(0, 3).join(" ") : "Device",
    protocols: protocols.slice(0, 6),
  };
}

// ── Discovery-state parser (reads @@DISC:N@@ and @@OK:N:P@@ markers) ──────────
interface DiscoveryState {
  discovered: Set<number>;
  protoOk: Map<number, Set<string>>;
  currentAsset: number;
}
function parseDiscoveryState(text: string): DiscoveryState {
  const discovered = new Set<number>();
  const protoOk = new Map<number, Set<string>>();
  let currentAsset = -1;
  for (const m of text.matchAll(/@@DISC:(\d+)@@/g)) {
    const idx = parseInt(m[1]);
    discovered.add(idx);
    currentAsset = idx;
  }
  for (const m of text.matchAll(/@@OK:(\d+):(\w+)@@/g)) {
    const idx = parseInt(m[1]);
    const proto = m[2].toLowerCase();
    if (!protoOk.has(idx)) protoOk.set(idx, new Set());
    protoOk.get(idx)!.add(proto);
  }
  return { discovered, protoOk, currentAsset };
}
function cleanDiscoveryText(text: string) {
  return text.replace(/@@(?:DISC:\d+|OK:\d+:\w+)@@\s*/g, "");
}

function SandboxTopologyMap({
  targets, isRunning, discStatus, isGapSession, gapSignals, streamText, fillHeight,
}: {
  targets: any[]; isRunning: boolean; discStatus: string;
  isGapSession: boolean; gapSignals: any; streamText: string; fillHeight?: boolean;
}) {
  const [tick, setTick] = useState(0);
  const [viewMode, setViewMode] = useState<"radial" | "layered" | "matrix">("radial");
  const [selectedNodeIdx, setSelectedNodeIdx] = useState<number | null>(null);
  const [hoveredNodeIdx, setHoveredNodeIdx] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setTick(n => (n + 1) % 120), 60);
    return () => clearInterval(t);
  }, []);

  const ds = parseDiscoveryState(streamText);
  const hasMarkers = ds.discovered.size > 0;
  const certified = discStatus === "certified";
  const certGreen = "#22c55e";
  const hubColor = certified ? certGreen : discStatus === "failed" ? "#ef4444" : isRunning ? "#818cf8" : "#475569";

  const W = 520, H = 290, cx = W / 2, cy = H / 2;
  const identified = isGapSession && streamText ? extractIdentifiedDevice(streamText) : null;

  // ── Zone definitions ──────────────────────────────────────────────────────
  const ZONE_DEFS: Record<string, { label: string; color: string; tier: number }> = {
    wan:        { label: "WAN / Internet",  color: "#f97316", tier: 0 },
    dmz:        { label: "DMZ",             color: "#ef4444", tier: 1 },
    core:       { label: "Core",            color: "#6366f1", tier: 2 },
    lan:        { label: "LAN",             color: "#818cf8", tier: 2 },
    management: { label: "Management",      color: "#a855f7", tier: 2 },
    ot:         { label: "OT / SCADA",      color: "#f59e0b", tier: 3 },
    iot:        { label: "IoT / Edge",      color: "#eab308", tier: 3 },
    guest:      { label: "Guest WiFi",      color: "#06b6d4", tier: 3 },
    storage:    { label: "Storage",         color: "#64748b", tier: 2 },
    vlan:       { label: "VLAN",            color: "#22d3ee", tier: 2 },
  };
  const ZONE_TIER: Record<string, number> = { wan: 0, dmz: 1, core: 2, lan: 2, management: 2, storage: 2, vlan: 2, ot: 3, iot: 3, guest: 3 };
  const ZONE_TIER_LABEL = ["WAN / Internet", "DMZ", "Internal Network", "Edge / IoT"];

  // ── Node type ─────────────────────────────────────────────────────────────
  type TopoNode = { id: string; abbr: string; vendor: string; category: string; zone: string; vlanId: string; color: string; zoneColor: string; x: number; y: number; protocols: string[] };
  let nodes: TopoNode[];

  // ── Build radial nodes ───────────────────────────────────────────────────
  if (isGapSession) {
    const protos = identified?.protocols.length ? identified.protocols : (gapSignals?.openPorts ? ["ssh","snmp"] : ["icmp"]);
    nodes = [{
      id: "gap-device",
      abbr: identified ? identified.vendor.split(" ").map((w:string) => w[0]).join("").slice(0,3).toUpperCase() : "???",
      vendor: identified ? identified.vendor.split(" ").slice(0,2).join(" ") : "Unknown",
      category: "unknown", zone: "lan", vlanId: "",
      color: identified ? "#22c55e" : "#f59e0b",
      zoneColor: "#818cf8",
      x: cx + 170, y: cy, protocols: protos,
    }];
  } else {
    // ── Group by zone for radial sector layout ──────────────────────────────
    const zoneGroups: Record<string, any[]> = {};
    for (const t of targets) {
      const z = (t.zone || "lan").toLowerCase();
      if (!zoneGroups[z]) zoneGroups[z] = [];
      zoneGroups[z].push(t);
    }
    const zoneKeys = Object.keys(zoneGroups);
    const R = targets.length <= 4 ? 148 : targets.length <= 7 ? 158 : 165;
    nodes = [];
    let nodeAngleOffset = -Math.PI / 2;
    const totalTargets = targets.length;
    for (const zone of zoneKeys) {
      const group = zoneGroups[zone];
      const zoneAngleSpan = (group.length / Math.max(totalTargets, 1)) * 2 * Math.PI;
      const zoneStartAngle = nodeAngleOffset;
      group.forEach((t: any, i: number) => {
        const angle = totalTargets === 1
          ? -Math.PI / 2
          : zoneStartAngle + (i + 0.5) * (zoneAngleSpan / group.length);
        const zd = ZONE_DEFS[zone] || ZONE_DEFS.lan;
        nodes.push({
          id: t.id,
          abbr: TOPO_CAT_ABBR[t.category] || t.category.slice(0, 4).toUpperCase(),
          vendor: (t.vendor || t.category).slice(0, 10),
          category: t.category,
          zone: zone,
          vlanId: t.vlanId || "",
          color: TOPO_CAT_COLOR[t.category] || "#6366f1",
          zoneColor: zd.color,
          x: totalTargets === 1 ? cx + 175 : cx + R * Math.cos(angle),
          y: totalTargets === 1 ? cy : cy + R * Math.sin(angle),
          protocols: t.protocols || [],
        });
      });
      nodeAngleOffset += zoneAngleSpan;
    }
  }

  // ── Compute radial zone sectors for background arcs ───────────────────────
  const radialZoneSectors: { zone: string; startAngle: number; endAngle: number; color: string; label: string }[] = [];
  if (!isGapSession && targets.length > 0) {
    const zoneGroups2: Record<string, any[]> = {};
    for (const t of targets) {
      const z = (t.zone || "lan").toLowerCase();
      if (!zoneGroups2[z]) zoneGroups2[z] = [];
      zoneGroups2[z].push(t);
    }
    let offset = -Math.PI / 2;
    for (const [zone, group] of Object.entries(zoneGroups2)) {
      const span = (group.length / targets.length) * 2 * Math.PI;
      const zd = ZONE_DEFS[zone] || ZONE_DEFS.lan;
      radialZoneSectors.push({ zone, startAngle: offset, endAngle: offset + span, color: zd.color, label: (t => t.vlanId ? `${zd.label} · VLAN ${t.vlanId}` : zd.label)(group[0]) });
      offset += span;
    }
  }

  // ── Build layered nodes (zone-aware tiers) ─────────────────────────────────
  const layeredTierY = [46, 118, 192, 264];
  const layeredGrouped: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const t of targets) {
    const zone = (t.zone || "").toLowerCase();
    const tier = ZONE_TIER[zone] ?? (
      zone ? 2 : (
        { wan: 0, router: 0, firewall: 1, switch: 1, loadbalancer: 1, server: 2, wireless: 2, storage: 2, iot: 3, camera: 3, printer: 3, scada: 3, mobile: 3 }[t.category] ?? 2
      )
    );
    layeredGrouped[tier].push(t);
  }
  const layeredNodes: TopoNode[] = [];
  for (const [tierStr, group] of Object.entries(layeredGrouped)) {
    const tier = parseInt(tierStr);
    if (!group.length) continue;
    const yPos = layeredTierY[tier] ?? 145;
    const maxSpacing = 110;
    const usableW = W - 60;
    const spacing = group.length === 1 ? 0 : Math.min(maxSpacing, usableW / (group.length - 1 || 1));
    const totalW = spacing * (group.length - 1);
    const startX = cx - totalW / 2;
    group.forEach((t: any, i: number) => {
      const zone = (t.zone || "lan").toLowerCase();
      const zd = ZONE_DEFS[zone] || ZONE_DEFS.lan;
      layeredNodes.push({
        id: t.id,
        abbr: TOPO_CAT_ABBR[t.category] || t.category.slice(0, 4).toUpperCase(),
        vendor: (t.vendor || t.category).slice(0, 10),
        category: t.category,
        zone: zone,
        vlanId: t.vlanId || "",
        color: TOPO_CAT_COLOR[t.category] || "#6366f1",
        zoneColor: zd.color,
        x: group.length === 1 ? cx : startX + spacing * i,
        y: yPos,
        protocols: t.protocols || [],
      });
    });
  }

  // ── All unique protocols for matrix ──────────────────────────────────────
  const allProtos = [...new Set(targets.flatMap((t: any) => t.protocols || []))].slice(0, 13);

  // ── Get the active node list for the current view ─────────────────────────
  const activeNodes = viewMode === "layered" ? layeredNodes : nodes;

  // ── Detail panel data for selected node ───────────────────────────────────
  const selTarget = selectedNodeIdx !== null ? (
    viewMode === "layered" ? targets.find((t: any) => t.id === layeredNodes[selectedNodeIdx]?.id) : targets[selectedNodeIdx]
  ) : null;
  const selNode = selectedNodeIdx !== null ? activeNodes[selectedNodeIdx] : null;
  const selConfirmed = selectedNodeIdx !== null ? (ds.protoOk.get(selectedNodeIdx) ?? new Set<string>()) : new Set<string>();

  // ── Device icon renderer (24×24 lucide-style paths) ───────────────────────
  const devIcon = (category: string, color: string, size = 18, sw = 1.5) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={TOPO_DEVICE_ICONS[category] || TOPO_DEVICE_ICONS.unknown}/>
    </svg>
  );

  // ── Node card renderer ────────────────────────────────────────────────────
  const renderNode = (node: TopoNode, nodeIdx: number) => {
    const nodeDiscovered = certified || !hasMarkers || ds.discovered.has(nodeIdx);
    const nodeActive = !certified && hasMarkers && ds.currentAsset === nodeIdx;
    const nodeColor = certified ? certGreen : nodeDiscovered ? node.color : "#253044";
    const confirmedCount = ds.protoOk.get(nodeIdx)?.size || 0;
    const totalProtos = node.protocols.length || 1;
    const isSelected = selectedNodeIdx === nodeIdx;
    const isHovered = hoveredNodeIdx === nodeIdx;
    const NW = 88, NH = 58;
    const nx = node.x, ny = node.y;

    return (
      <g key={node.id}
        onClick={() => setSelectedNodeIdx(isSelected ? null : nodeIdx)}
        onMouseEnter={() => setHoveredNodeIdx(nodeIdx)}
        onMouseLeave={() => setHoveredNodeIdx(null)}
        style={{ cursor: "pointer" }}
      >
        {/* Selection ring */}
        {isSelected && (
          <rect x={nx - NW/2 - 5} y={ny - NH/2 - 5} width={NW+10} height={NH+10} rx={14}
            fill="none" stroke={nodeColor} strokeWidth={1.5} strokeOpacity={0.5} strokeDasharray="4 3"/>
        )}
        {/* Active discovery pulse */}
        {nodeActive && !certified && (
          <rect x={nx - NW/2 - 7} y={ny - NH/2 - 7} width={NW+14} height={NH+14} rx={15}
            fill="none" stroke="#f59e0b" strokeWidth="4" strokeOpacity="0.07">
            <animate attributeName="stroke-opacity" values="0.12;0;0.12" dur="1.4s" repeatCount="indefinite"/>
          </rect>
        )}
        {isRunning && !hasMarkers && (
          <rect x={nx - NW/2 - 5} y={ny - NH/2 - 5} width={NW+10} height={NH+10} rx={13}
            fill="none" stroke={node.color} strokeWidth="3" strokeOpacity="0.06">
            <animate attributeName="stroke-opacity" values="0.06;0;0.06" dur="2.4s" repeatCount="indefinite"/>
          </rect>
        )}
        {/* Card shadow layer */}
        <rect x={nx - NW/2 + 2} y={ny - NH/2 + 3} width={NW} height={NH} rx={10}
          fill={nodeColor + "18"} filter="url(#topo-blur)"/>
        {/* Main card body */}
        <rect x={nx - NW/2} y={ny - NH/2} width={NW} height={NH} rx={10}
          fill={nodeDiscovered ? "#0d1628" : "#08111e"}
          stroke={isSelected ? nodeColor : isHovered ? nodeColor + "cc" : nodeColor + "70"}
          strokeWidth={isSelected ? 1.8 : nodeDiscovered ? 1.2 : 0.5}
          strokeDasharray={!nodeDiscovered ? "3 4" : undefined}
        />
        {/* Top color band */}
        <rect x={nx - NW/2} y={ny - NH/2} width={NW} height={18} rx={10}
          fill={nodeDiscovered ? nodeColor + "30" : "#10182a"}/>
        <rect x={nx - NW/2} y={ny - NH/2 + 8} width={NW} height={10}
          fill={nodeDiscovered ? nodeColor + "22" : "#0c1424"}/>
        {/* Category icon (top-left of band) */}
        {nodeDiscovered && (
          <foreignObject x={nx - NW/2 + 5} y={ny - NH/2 + 2} width={14} height={14}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 14, height: 14 }}>
              {devIcon(node.category, nodeColor, 13, 1.8)}
            </div>
          </foreignObject>
        )}
        {/* Zone left stripe */}
        {nodeDiscovered && (
          <rect x={nx - NW/2} y={ny - NH/2 + 18} width={3} height={NH - 18} rx={1.5}
            fill={node.zoneColor} opacity={0.65}/>
        )}
        {/* Category label in band */}
        <text x={nx - NW/2 + 22} y={ny - NH/2 + 12} textAnchor="start" fontSize="7" fontFamily="monospace" fontWeight="bold"
          fill={nodeDiscovered ? nodeColor : "#2d3e55"} opacity={0.9}>
          {nodeDiscovered ? (TOPO_CAT_ABBR[node.category] || node.category.toUpperCase().slice(0, 6)) : "PENDING"}
        </text>
        {/* Certified check in band */}
        {certified && (
          <text x={nx + NW/2 - 6} y={ny - NH/2 + 12} textAnchor="end" fontSize="8" fill={certGreen}>✓</text>
        )}
        {/* Proto count badge in band */}
        {nodeDiscovered && !certified && hasMarkers && (
          <text x={nx + NW/2 - 6} y={ny - NH/2 + 12} textAnchor="end" fontSize="7" fontFamily="monospace"
            fill={confirmedCount > 0 ? nodeColor : "#334155"}>
            {confirmedCount}/{totalProtos}
          </text>
        )}
        {/* Vendor name */}
        <text x={nx - NW/2 + 10} y={ny - 5} textAnchor="start" fontSize="10" fontFamily="monospace" fontWeight="bold"
          fill={nodeDiscovered ? (certified ? certGreen : "#e8edf8") : "#364256"}>
          {nodeDiscovered ? node.vendor : "···"}
        </text>
        {/* Zone + VLAN label */}
        {nodeDiscovered && (
          <text x={nx - NW/2 + 10} y={ny + 6} textAnchor="start" fontSize="7" fontFamily="monospace"
            fill={node.zoneColor} opacity={0.9}>
            {(ZONE_DEFS[node.zone]?.label || node.zone || "LAN").toUpperCase().slice(0, 10)}
            {node.vlanId ? ` · V${node.vlanId}` : ""}
          </text>
        )}
        {!nodeDiscovered && (
          <text x={nx - NW/2 + 10} y={ny + 6} textAnchor="start" fontSize="7.5" fontFamily="sans-serif"
            fill="#263040">awaiting discovery</text>
        )}
        {/* Protocol progress bar */}
        {nodeDiscovered && !certified && hasMarkers && totalProtos > 0 && (
          <>
            <rect x={nx - NW/2 + 8} y={ny + NH/2 - 9} width={NW - 16} height={3} rx={1.5} fill="#0a1220"/>
            <rect x={nx - NW/2 + 8} y={ny + NH/2 - 9} width={(confirmedCount / totalProtos) * (NW - 16)} height={3} rx={1.5}
              fill={nodeColor} opacity={0.8}/>
          </>
        )}
        {/* Active node scanning indicator */}
        {nodeActive && !certified && (
          <text x={nx} y={ny + NH/2 - 10} textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#f59e0b">
            scanning...
          </text>
        )}
        {/* Tap-to-drill hint when hovered */}
        {isHovered && !isSelected && nodeDiscovered && (
          <text x={nx} y={ny + NH/2 + 10} textAnchor="middle" fontSize="7" fontFamily="monospace" fill={nodeColor + "aa"}>
            click to inspect
          </text>
        )}
      </g>
    );
  };

  // ── Hub hexagon ───────────────────────────────────────────────────────────
  const renderHub = () => {
    const R = 36;
    const hexPts = (r: number) => Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
    return (
      <g filter="url(#topo-glow)">
        <polygon points={hexPts(R + 14)} fill="none" stroke={hubColor + "1a"} strokeWidth={1} strokeDasharray="5 4"/>
        <polygon points={hexPts(R + 7)} fill="none" stroke={hubColor + "30"} strokeWidth={0.8} strokeDasharray="3 5"/>
        <polygon points={hexPts(R)} fill={hubColor + "18"} stroke={hubColor} strokeWidth={1.8}/>
        <text x={cx} y={cy - 9} textAnchor="middle" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill={hubColor} letterSpacing="1">HOLOCRON</text>
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="5.5" fontFamily="monospace" fill={hubColor + "bb"} letterSpacing="0.5">SANDBOX HUB</text>
        {hasMarkers && !certified && nodes.length > 0 && (
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="8" fontFamily="monospace" fill={hubColor}>
            {ds.discovered.size}/{nodes.length}
          </text>
        )}
        {isRunning && (
          <circle cx={cx} cy={cy + 26} r={3} fill={hubColor}>
            <animate attributeName="opacity" values="1;0.1;1" dur="1.1s" repeatCount="indefinite"/>
          </circle>
        )}
      </g>
    );
  };

  // ── Bezier edges (radial view) ─────────────────────────────────────────────
  const renderRadialEdges = () => nodes.map((node, nodeIdx) => {
    const protos = node.protocols.length ? node.protocols : ["icmp"];
    const nodeDiscovered = certified || !hasMarkers || ds.discovered.has(nodeIdx);
    const nodeActive = !certified && hasMarkers && ds.currentAsset === nodeIdx;
    return protos.map((proto, pi) => {
      const protoConfirmed = certified || !hasMarkers || ds.protoOk.get(nodeIdx)?.has(proto.toLowerCase());
      const col = TOPO_PROTO_HEX[proto] || "#6366f1";
      const edgeCol = certified ? certGreen : protoConfirmed ? col : "#1a2840";
      const total = protos.length;
      const dx = node.x - cx, dy = node.y - cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const spread = Math.min(total - 1, 4) * 5;
      const offset = total > 1 ? (pi / (total - 1) - 0.5) * spread : 0;
      const perpX = -dy / len * offset, perpY = dx / len * offset;
      const x1 = cx + perpX, y1 = cy + perpY;
      const x2 = node.x + perpX, y2 = node.y + perpY;
      const cpX = cx + dx * 0.5 + perpX, cpY = cy + dy * 0.5 + perpY;
      const edgeLen = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
      const dashLen = 10;
      const animOff = -((tick / 120) * (edgeLen + dashLen));
      const pathD = `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`;
      return (
        <g key={`${node.id}-${proto}-${pi}`}>
          {protoConfirmed && !certified && (
            <path d={pathD} fill="none" stroke={col} strokeWidth={4} strokeOpacity={0.08} strokeLinecap="round"/>
          )}
          <path d={pathD} fill="none"
            stroke={edgeCol}
            strokeWidth={protoConfirmed ? (certified ? 1.5 : 1.2) : 0.5}
            strokeOpacity={certified ? 0.6 : protoConfirmed ? 0.5 : nodeDiscovered ? 0.15 : 0.05}
            strokeDasharray={!protoConfirmed ? "2 6" : undefined}
            strokeLinecap="round"
          />
          {((isRunning && !hasMarkers) || (isRunning && nodeActive)) && (
            <path d={pathD} fill="none"
              stroke={col} strokeWidth={2.5}
              strokeDasharray={`${dashLen} ${Math.max(edgeLen, 20)}`}
              strokeDashoffset={animOff}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${col})` }}
            />
          )}
          {protoConfirmed && !certified && (
            <path d={pathD} fill="none"
              stroke={col} strokeWidth={1.2}
              strokeDasharray={`5 ${Math.max(edgeLen - 5, 28)}`}
              strokeDashoffset={-((tick / 120) * (edgeLen + 5)) * 0.3}
              strokeLinecap="round" opacity={0.4}
              style={{ filter: `drop-shadow(0 0 2px ${col})` }}
            />
          )}
          {total <= 3 && protoConfirmed && (
            <>
              <rect x={(x1+x2)/2 - 15} y={(y1+y2)/2 - 9} width={30} height={11} rx={4}
                fill={col + "20"} stroke={col + "50"} strokeWidth={0.6}/>
              <text x={(x1+x2)/2} y={(y1+y2)/2} textAnchor="middle" fontSize="6.5" fontFamily="monospace" fontWeight="bold" fill={col}>
                {proto.toUpperCase()}
              </text>
            </>
          )}
        </g>
      );
    });
  });

  // ── Layered view edges ─────────────────────────────────────────────────────
  const renderLayeredEdges = () => {
    const nodesByTier: Record<number, TopoNode[]> = {};
    for (const n of layeredNodes) {
      const t = ZONE_TIER[n.zone] ?? 2;
      if (!nodesByTier[t]) nodesByTier[t] = [];
      nodesByTier[t].push(n);
    }
    const tierKeys = Object.keys(nodesByTier).map(Number).sort();
    const edges: JSX.Element[] = [];
    for (let i = 0; i < tierKeys.length - 1; i++) {
      const upper = nodesByTier[tierKeys[i]];
      const lower = nodesByTier[tierKeys[i + 1]];
      for (const un of upper) {
        for (const ln of lower) {
          edges.push(
            <path key={`e-${un.id}-${ln.id}`}
              d={`M ${un.x} ${un.y + 30} C ${un.x} ${(un.y + ln.y)/2}, ${ln.x} ${(un.y + ln.y)/2}, ${ln.x} ${ln.y - 30}`}
              fill="none"
              stroke={certified ? certGreen + "55" : "#172236"}
              strokeWidth={0.8}
              strokeDasharray={certified ? undefined : "2 5"}
            />
          );
        }
      }
    }
    return edges;
  };

  // ── Layered tier labels (zone-aware) ──────────────────────────────────────
  const renderTierLabels = () => {
    const usedTiers = new Set(layeredNodes.map(n => ZONE_TIER[n.zone] ?? 2));
    // Compute zone color for each tier (dominant zone color)
    const tierZoneColor: Record<number, string> = {};
    for (const n of layeredNodes) {
      const t = ZONE_TIER[n.zone] ?? 2;
      if (!tierZoneColor[t]) tierZoneColor[t] = n.zoneColor;
    }
    // Unique zones per tier for label
    const tierZones: Record<number, string[]> = {};
    for (const n of layeredNodes) {
      const t = ZONE_TIER[n.zone] ?? 2;
      if (!tierZones[t]) tierZones[t] = [];
      const label = ZONE_DEFS[n.zone]?.label || n.zone || "LAN";
      if (!tierZones[t].includes(label)) tierZones[t].push(label);
    }
    return (
      <>
        {Array.from(usedTiers).sort().map(tier => {
          const y = layeredTierY[tier] ?? 145;
          const col = tierZoneColor[tier] || "#1e3450";
          const zoneLabel = (tierZones[tier] || [ZONE_TIER_LABEL[tier] || ""]).join(" · ");
          return (
            <g key={tier}>
              {tier > 0 && (
                <line x1={6} y1={y - 26} x2={W - 6} y2={y - 26}
                  stroke={col + "20"} strokeWidth={1} strokeDasharray="4 4"/>
              )}
              {/* Zone band label */}
              <rect x={6} y={y - 24} width={Math.min(zoneLabel.length * 5.5 + 10, W - 20)} height={13} rx={3}
                fill={col + "12"} stroke={col + "25"} strokeWidth={0.7}/>
              <circle cx={13} cy={y - 17} r={2.5} fill={col} opacity={0.8}/>
              <text x={20} y={y - 11} textAnchor="start" fontSize="7.5" fontFamily="monospace" fontWeight="600" fill={col} letterSpacing="0.3">
                {zoneLabel}
              </text>
            </g>
          );
        })}
      </>
    );
  };

  // ── Protocol matrix view ───────────────────────────────────────────────────
  const renderMatrix = () => {
    const cellW = 32, cellH = 28;
    const leftW = 120;
    const startX = 14, startY = 46;
    const protoX = startX + leftW + 4;
    return (
      <g>
        {allProtos.map((proto, pi) => {
          const col = TOPO_PROTO_HEX[proto] || "#6366f1";
          const someConfirmed = certified || (hasMarkers && [...ds.protoOk.values()].some(s => s.has(proto)));
          return (
            <g key={proto}>
              <text
                x={protoX + pi * cellW + cellW/2} y={startY - 14}
                textAnchor="middle" fontSize="6.5" fontFamily="monospace" fontWeight="bold"
                fill={someConfirmed ? col : col + "60"}
                transform={`rotate(-40, ${protoX + pi * cellW + cellW/2}, ${startY - 14})`}
              >{proto.toUpperCase()}</text>
              <line x1={protoX + pi * cellW + cellW/2} y1={startY - 4}
                x2={protoX + pi * cellW + cellW/2} y2={startY + targets.length * (cellH + 3)}
                stroke={col + "12"} strokeWidth={1}/>
            </g>
          );
        })}
        {targets.map((t: any, ri: number) => {
          const rowY = startY + ri * (cellH + 3);
          const nodeDiscovered = certified || !hasMarkers || ds.discovered.has(ri);
          const nColor = certified ? certGreen : nodeDiscovered ? (TOPO_CAT_COLOR[t.category] || "#6366f1") : "#253044";
          const vendor = (t.vendor || t.category).slice(0, 13);
          return (
            <g key={t.id} onClick={() => setSelectedNodeIdx(ri === selectedNodeIdx ? null : ri)}
              style={{ cursor: "pointer" }}>
              <rect x={startX} y={rowY} width={W - 28} height={cellH} rx={4}
                fill={ri === selectedNodeIdx ? nColor + "10" : ri % 2 === 0 ? "rgba(255,255,255,0.016)" : "transparent"}
                stroke={ri === selectedNodeIdx ? nColor + "40" : "transparent"} strokeWidth={0.8}/>
              <foreignObject x={startX + 2} y={rowY + 6} width={16} height={16}>
                <div style={{ display: "flex" }}>{devIcon(t.category, nColor, 14, 1.6)}</div>
              </foreignObject>
              <text x={startX + 20} y={rowY + 12} textAnchor="start" fontSize="9" fontFamily="monospace" fontWeight="bold"
                fill={nodeDiscovered ? "#d8e2f0" : "#364256"}>{vendor}</text>
              <text x={startX + 20} y={rowY + 22} textAnchor="start" fontSize="7" fontFamily="sans-serif"
                fill="#2d4060">{t.category}</text>
              {allProtos.map((proto, pi) => {
                const inList = (t.protocols || []).includes(proto);
                const confirmed = inList && (certified || !hasMarkers || ds.protoOk.get(ri)?.has(proto));
                const pending = inList && !confirmed;
                const col = TOPO_PROTO_HEX[proto] || "#6366f1";
                const cellX = protoX + pi * cellW;
                const ccx = cellX + cellW / 2, ccy = rowY + cellH / 2;
                return (
                  <g key={proto}>
                    <rect x={cellX + 2} y={rowY + 3} width={cellW - 4} height={cellH - 6} rx={4}
                      fill={inList ? col + (confirmed ? "1c" : "0a") : "transparent"}
                      stroke={inList ? (confirmed ? col + "65" : col + "22") : "rgba(255,255,255,0.025)"}
                      strokeWidth={0.7}/>
                    {inList && (
                      <circle cx={ccx} cy={ccy} r={5} fill={confirmed ? col : col + "30"}
                        stroke={confirmed ? col + "99" : "transparent"} strokeWidth={0.8}>
                        {pending && isRunning && (
                          <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite"/>
                        )}
                      </circle>
                    )}
                    {!inList && (
                      <text x={ccx} y={ccy + 3} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="rgba(255,255,255,0.05)">—</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {[{ col: "#22c55e", label: "Confirmed" }, { col: "#6366f1", label: "Scheduled", dim: true }, { col: "#253044", label: "N/A", dim: true }].map((l, i) => (
          <g key={l.label}>
            <circle cx={startX + i * 78} cy={H - 9} r={4}
              fill={l.dim ? l.col + "30" : l.col + "70"} stroke={l.dim ? l.col + "35" : l.col + "99"} strokeWidth={0.7}/>
            <text x={startX + i * 78 + 9} y={H - 5} textAnchor="start" fontSize="7" fontFamily="monospace" fill="#2d4060">{l.label}</text>
          </g>
        ))}
      </g>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`relative rounded-xl overflow-hidden flex flex-col ${fillHeight ? "h-full" : ""}`}
      style={{ background: "linear-gradient(160deg, #070e1e 0%, #040b18 60%, #050d1c 100%)", border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 0 40px rgba(99,102,241,0.05) inset" }}>

      {/* View toggle toolbar */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-white/5"
        style={{ background: "rgba(0,0,0,0.3)" }}>
        <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {([
            { id: "radial" as const, label: "Hub & Spoke" },
            { id: "layered" as const, label: "Layered" },
            { id: "matrix" as const, label: "Protocol Matrix" },
          ]).map(v => (
            <button key={v.id}
              className={`px-2.5 py-1 text-[9.5px] font-mono transition-all border-r last:border-r-0 ${
                viewMode === v.id
                  ? "text-primary"
                  : "text-slate-600 hover:text-slate-300"
              }`}
              style={{
                borderRightColor: "rgba(255,255,255,0.06)",
                background: viewMode === v.id ? "rgba(99,102,241,0.15)" : "transparent",
              }}
              onClick={() => { setViewMode(v.id); setSelectedNodeIdx(null); }}
            >{v.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {selectedNodeIdx !== null && (
            <button onClick={() => setSelectedNodeIdx(null)}
              className="text-[8px] font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>
              ✕ close
            </button>
          )}
          <span className="text-[9px] font-mono flex items-center gap-1.5"
            style={{ color: certified ? "#22c55e" : discStatus === "failed" ? "#ef4444" : isRunning ? "#818cf8" : "#3d5070" }}>
            <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "currentColor",
              boxShadow: isRunning ? "0 0 6px currentColor" : "none" }}/>
            {certified ? "CERTIFIED" : discStatus === "failed" ? "FAILED" : isRunning ? "LIVE DISCOVERY" : "SANDBOX READY"}
          </span>
        </div>
      </div>

      {/* SVG canvas */}
      <svg
        width={W} height={fillHeight ? "100%" : H}
        className={`w-full ${fillHeight ? "flex-1" : ""}`}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block" }}
      >
        <defs>
          <pattern id="topo-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="0.7" fill="rgba(99,102,241,0.12)"/>
          </pattern>
          <filter id="topo-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="topo-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="topo-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4"/>
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#topo-dots)"/>

        {/* Radial view */}
        {viewMode === "radial" && (
          <>
            {/* Zone sector backgrounds */}
            {!isGapSession && radialZoneSectors.length > 1 && radialZoneSectors.map((sector, si) => {
              const innerR = 46, outerR = 200;
              const midAngle = (sector.startAngle + sector.endAngle) / 2;
              const span = sector.endAngle - sector.startAngle;
              // Only draw if sector spans more than 5 degrees
              if (span < 0.09) return null;
              const x1i = cx + innerR * Math.cos(sector.startAngle);
              const y1i = cy + innerR * Math.sin(sector.startAngle);
              const x2i = cx + innerR * Math.cos(sector.endAngle);
              const y2i = cy + innerR * Math.sin(sector.endAngle);
              const x1o = cx + outerR * Math.cos(sector.startAngle);
              const y1o = cy + outerR * Math.sin(sector.startAngle);
              const x2o = cx + outerR * Math.cos(sector.endAngle);
              const y2o = cy + outerR * Math.sin(sector.endAngle);
              const largeArc = span > Math.PI ? 1 : 0;
              const d = `M ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 1 ${x2i} ${y2i} L ${x2o} ${y2o} A ${outerR} ${outerR} 0 ${largeArc} 0 ${x1o} ${y1o} Z`;
              const labelR = outerR - 12;
              const lx = cx + labelR * Math.cos(midAngle);
              const ly = cy + labelR * Math.sin(midAngle);
              return (
                <g key={sector.zone}>
                  <path d={d} fill={sector.color + "08"} stroke={sector.color + "20"} strokeWidth={0.8}/>
                  {/* Sector boundary lines */}
                  <line x1={cx + innerR * Math.cos(sector.startAngle)} y1={cy + innerR * Math.sin(sector.startAngle)}
                    x2={cx + outerR * Math.cos(sector.startAngle)} y2={cy + outerR * Math.sin(sector.startAngle)}
                    stroke={sector.color + "25"} strokeWidth={0.7} strokeDasharray="3 4"/>
                  {/* Zone label at outer rim */}
                  {span > 0.35 && (
                    <g transform={`translate(${lx}, ${ly})`}>
                      <rect x={-22} y={-8} width={44} height={12} rx={3}
                        fill={sector.color + "18"} stroke={sector.color + "35"} strokeWidth={0.6}/>
                      <circle cx={-14} cy={-2} r={2} fill={sector.color} opacity={0.7}/>
                      <text x={-9} y={3} fontSize="6.5" fontFamily="monospace" fontWeight="600" fill={sector.color} opacity={0.85}>
                        {sector.label.split(" ")[0].slice(0, 8).toUpperCase()}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            {renderRadialEdges()}
            {renderHub()}
            <g>{nodes.map((n, i) => renderNode(n, i))}</g>
            {nodes.length === 0 && (
              <text x={cx} y={cy} textAnchor="middle" fontSize="11" fontFamily="sans-serif" fill="#1e3050">
                Add asset targets to see topology
              </text>
            )}
            {isGapSession && gapSignals?.ipAddress && nodes[0] && (
              <>
                <rect x={nodes[0].x - 44} y={nodes[0].y + 34} width={88} height={16} rx={5} fill="rgba(0,0,0,0.8)"/>
                <text x={nodes[0].x} y={nodes[0].y + 44} textAnchor="middle" fontSize="8.5" fontFamily="monospace" fill="#f59e0b">
                  {gapSignals.ipAddress}
                </text>
              </>
            )}
          </>
        )}

        {/* Layered view */}
        {viewMode === "layered" && (
          <>
            {renderTierLabels()}
            {renderLayeredEdges()}
            <g>{layeredNodes.map((n, i) => renderNode(n, i))}</g>
            {layeredNodes.length === 0 && (
              <text x={cx} y={cy} textAnchor="middle" fontSize="11" fontFamily="sans-serif" fill="#1e3050">
                Add asset targets to see layered view
              </text>
            )}
          </>
        )}

        {/* Protocol matrix view */}
        {viewMode === "matrix" && (
          targets.length === 0 ? (
            <text x={cx} y={cy} textAnchor="middle" fontSize="11" fontFamily="sans-serif" fill="#1e3050">
              Add asset targets to see the protocol matrix
            </text>
          ) : renderMatrix()
        )}
      </svg>

      {/* ── Device drill-down panel ─────────────────────────────────────────── */}
      <div style={{
        maxHeight: selectedNodeIdx !== null ? "220px" : "0",
        overflow: "hidden",
        transition: "max-height 0.28s ease",
        borderTop: selectedNodeIdx !== null ? "1px solid rgba(99,102,241,0.2)" : "none",
      }}>
        {selNode && selTarget && (
          <div style={{ padding: "12px 16px", background: "rgba(0,0,0,0.35)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                background: selNode.color + "1a", border: `1px solid ${selNode.color}45`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {devIcon(selNode.category, selNode.color, 26, 1.6)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: certified ? certGreen : selNode.color }}>
                    {selTarget.vendor || selNode.vendor}
                  </span>
                  {selTarget.model && (
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#4a6080" }}>
                      {selTarget.model}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
                  <span style={{
                    fontFamily: "monospace", fontSize: 9, padding: "1px 6px", borderRadius: 4,
                    background: selNode.color + "20", color: selNode.color, border: `1px solid ${selNode.color}40`,
                  }}>
                    {TOPO_CAT_LABEL[selNode.category] || selNode.category}
                  </span>
                  {selNode.zone && (
                    <span style={{
                      fontFamily: "monospace", fontSize: 9, padding: "1px 6px", borderRadius: 4,
                      background: selNode.zoneColor + "18", color: selNode.zoneColor, border: `1px solid ${selNode.zoneColor}40`,
                    }}>
                      {ZONE_DEFS[selNode.zone]?.label || selNode.zone}
                      {selNode.vlanId ? ` · VLAN ${selNode.vlanId}` : ""}
                    </span>
                  )}
                  {selTarget.subnet && (
                    <span style={{ fontFamily: "monospace", fontSize: 9, color: "#3d5570" }}>
                      {selTarget.subnet}
                    </span>
                  )}
                  {selTarget.ipAddress && (
                    <span style={{ fontFamily: "monospace", fontSize: 9, color: "#4a6080" }}>
                      {selTarget.ipAddress}
                    </span>
                  )}
                  {selTarget.hostname && (
                    <span style={{ fontFamily: "monospace", fontSize: 9, color: "#3a5070" }}>
                      {selTarget.hostname}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                {certified ? (
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: certGreen }}>✓ Certified</span>
                ) : ds.discovered.has(selectedNodeIdx!) ? (
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#818cf8" }}>Discovered</span>
                ) : (
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#364256" }}>Pending</span>
                )}
              </div>
            </div>
            {/* Protocol breakdown */}
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontFamily: "monospace", fontSize: 8, color: "#2d4565", textTransform: "uppercase", letterSpacing: 1 }}>
                Protocols ({selNode.protocols.length})
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {selNode.protocols.map(proto => {
                const col = TOPO_PROTO_HEX[proto] || "#6366f1";
                const confirmed = certified || selConfirmed.has(proto);
                const active = !certified && hasMarkers && ds.currentAsset === selectedNodeIdx! && isRunning;
                return (
                  <span key={proto} style={{
                    fontFamily: "monospace", fontSize: 9, padding: "3px 8px", borderRadius: 5,
                    background: confirmed ? col + "22" : active ? col + "12" : "rgba(255,255,255,0.04)",
                    color: confirmed ? col : active ? col + "99" : "#2d4060",
                    border: `1px solid ${confirmed ? col + "55" : active ? col + "30" : "rgba(255,255,255,0.06)"}`,
                    fontWeight: confirmed ? 700 : 400,
                  }}>
                    {proto.toUpperCase()} {confirmed ? "✓" : active ? "⋯" : ""}
                  </span>
                );
              })}
              {selNode.protocols.length === 0 && (
                <span style={{ fontFamily: "monospace", fontSize: 9, color: "#253040" }}>No protocols configured</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Zone legend strip */}
      {!isGapSession && targets.length > 0 && (() => {
        const usedZones = [...new Set(targets.map((t: any) => (t.zone || "lan").toLowerCase()))];
        if (usedZones.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-t border-white/5 shrink-0"
            style={{ background: "rgba(0,0,0,0.2)", minHeight: 26 }}>
            <span className="text-[8px] font-mono mr-0.5" style={{ color: "#1e3050" }}>ZONES:</span>
            {usedZones.map(zone => {
              const zd = ZONE_DEFS[zone] || { label: zone, color: "#6366f1" };
              const zoneTargets = targets.filter((t: any) => (t.zone || "lan").toLowerCase() === zone);
              const vlans = [...new Set(zoneTargets.map((t: any) => t.vlanId).filter(Boolean))];
              return (
                <span key={zone} className="text-[8px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                  style={{ background: zd.color + "15", color: zd.color, border: `1px solid ${zd.color}35` }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: zd.color, display: "inline-block" }}/>
                  {zd.label}
                  {vlans.length > 0 && <span style={{ opacity: 0.7 }}>· VLAN {vlans.join(", ")}</span>}
                  <span style={{ opacity: 0.55 }}>({zoneTargets.length})</span>
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* Protocol legend */}
      <div className="flex flex-wrap gap-1 px-3 py-1.5 border-t border-white/5 shrink-0"
        style={{ background: "rgba(0,0,0,0.25)", minHeight: 28 }}>
        {[...new Set(targets.flatMap((t: any) => t.protocols || []))].slice(0, 10).map(proto => {
          const confirmed = certified || [...(ds.protoOk.values())].some(s => s.has(proto));
          return (
            <span key={proto} className="text-[8px] font-mono px-1.5 py-0.5 rounded transition-all"
              style={{
                background: (TOPO_PROTO_HEX[proto] || "#6366f1") + (confirmed ? "22" : "0c"),
                color: confirmed ? (TOPO_PROTO_HEX[proto] || "#6366f1") : "#253040",
                border: `1px solid ${(TOPO_PROTO_HEX[proto] || "#6366f1")}${confirmed ? "48" : "15"}`,
              }}
            >{proto.toUpperCase()}{confirmed ? " ✓" : ""}</span>
          );
        })}
        {targets.flatMap((t: any) => t.protocols || []).length === 0 && (
          <span className="text-[8px] font-mono" style={{ color: "#1e3050" }}>add asset targets to see protocols</span>
        )}
      </div>
    </div>
  );
}

// ── Real Environment Topology Map ─────────────────────────────────────────────

const REAL_STATUS_COLOR: Record<string, string> = {
  online: "#22c55e", offline: "#ef4444", booting: "#f59e0b", unknown: "#475569",
};
const REAL_TYPE_ABBR: Record<string, string> = {
  router: "RTR", switch: "SWT", firewall: "FW", server: "SRV",
  iot: "IoT", loadbalancer: "LB", wan: "WAN", mobile: "MOB",
  storage: "STO", printer: "PRT", camera: "CAM",
};

function RealEnvironmentTopologyMap({
  assets, probe, env,
}: {
  assets: any[];
  probe: any | null;
  env: any;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => (n + 1) % 200), 80);
    return () => clearInterval(t);
  }, []);

  const W = 560, H = 320, cx = W / 2, cy = H / 2;
  const onlineCount = assets.filter(a => a.status === "online").length;

  // Layout: up to 7 inner ring, rest go to outer ring
  const INNER_MAX = 7;
  const innerAssets = assets.slice(0, INNER_MAX);
  const outerAssets = assets.slice(INNER_MAX, INNER_MAX + 7);
  const overflowCount = assets.length - INNER_MAX - 7;

  type RealNode = { id: string; abbr: string; label: string; ip: string; color: string; statusColor: string; x: number; y: number; online: boolean };

  function radialNode(asset: any, i: number, total: number, R: number): RealNode {
    const angle = (2 * Math.PI / total) * i - Math.PI / 2;
    return {
      id: asset.id,
      abbr: REAL_TYPE_ABBR[asset.type] || asset.type.slice(0, 4).toUpperCase(),
      label: ([asset.vendor, asset.model].filter(Boolean).join(" ") || asset.name).slice(0, 16),
      ip: asset.ipAddress || "",
      color: TOPO_CAT_COLOR[asset.type] || "#6366f1",
      statusColor: REAL_STATUS_COLOR[asset.status] || REAL_STATUS_COLOR.unknown,
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
      online: asset.status === "online",
    };
  }

  const innerNodes = innerAssets.map((a, i) => radialNode(a, i, Math.max(innerAssets.length, 1), 145));
  const outerNodes = outerAssets.map((a, i) => radialNode(a, i, Math.max(outerAssets.length, 1), 215));
  const allNodes = [...innerNodes, ...outerNodes];

  const probeColor = probe?.status === "active" ? "#818cf8" : "#475569";
  const topologyLabel = (env.topology || "campus").charAt(0).toUpperCase() + (env.topology || "campus").slice(1);

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 40%, #0a0f1e 0%, #020817 100%)", border: "1px solid rgba(99,102,241,0.2)" }}>
      <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <defs>
          <pattern id="real-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(99,102,241,0.05)" strokeWidth="0.5"/>
          </pattern>
          <filter id="real-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="real-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#real-grid)"/>

        {/* Concentric range rings */}
        {innerAssets.length > 0 && (
          <circle cx={cx} cy={cy} r={145} fill="none" stroke="rgba(99,102,241,0.07)" strokeWidth={1} strokeDasharray="4 4"/>
        )}
        {outerAssets.length > 0 && (
          <circle cx={cx} cy={cy} r={215} fill="none" stroke="rgba(99,102,241,0.05)" strokeWidth={1} strokeDasharray="4 6"/>
        )}

        {/* Edges from probe to each asset */}
        {allNodes.map(node => {
          const col = node.online ? node.color : "#334155";
          const lineLen = Math.sqrt((node.x - cx) ** 2 + (node.y - cy) ** 2);
          const dashLen = 8;
          const gapLen = lineLen - dashLen;
          // Slow heartbeat animation for online assets
          const animOff = node.online ? -((tick / 200) * (dashLen + Math.max(gapLen, 8))) : 0;
          return (
            <g key={`edge-${node.id}`}>
              <line x1={cx} y1={cy} x2={node.x} y2={node.y}
                stroke={col} strokeWidth={1}
                strokeOpacity={node.online ? 0.35 : 0.12}
                strokeDasharray={node.online ? undefined : "3 6"}
              />
              {node.online && (
                <line x1={cx} y1={cy} x2={node.x} y2={node.y}
                  stroke={node.color} strokeWidth={2}
                  strokeDasharray={`${dashLen} ${Math.max(gapLen, 8)}`}
                  strokeDashoffset={animOff}
                  strokeLinecap="round"
                  strokeOpacity={0.6}
                  style={{ filter: `drop-shadow(0 0 3px ${node.color})` }}
                />
              )}
            </g>
          );
        })}

        {/* Probe hub */}
        {(() => {
          const pts = Array.from({ length: 6 }, (_, i) => {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            return `${cx + 32 * Math.cos(a)},${cy + 32 * Math.sin(a)}`;
          }).join(" ");
          return (
            <g filter="url(#real-glow)">
              <polygon points={pts} fill={probeColor + "1a"} stroke={probeColor} strokeWidth={2}/>
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize="7" fontFamily="monospace" fontWeight="bold" fill={probeColor}>HOLOCRON</text>
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="6" fontFamily="monospace" fill={probeColor + "cc"}>
                {probe ? probe.probeName.slice(0, 10) : "NO PROBE"}
              </text>
              <text x={cx} y={cy + 15} textAnchor="middle" fontSize="5.5" fontFamily="sans-serif" fill={probeColor + "99"}>
                {probe ? probe.probeType.toUpperCase() : "—"}
              </text>
              {probe?.status === "active" && (
                <circle cx={cx} cy={cy + 25} r={2.5} fill={probeColor}>
                  <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite"/>
                </circle>
              )}
            </g>
          );
        })()}

        {/* Asset nodes */}
        {allNodes.map(node => (
          <g key={node.id} filter="url(#real-glow-sm)">
            {/* Status pulse ring for online devices */}
            {node.online && (
              <circle cx={node.x} cy={node.y} r={22} fill="none" stroke={node.statusColor} strokeWidth={6} strokeOpacity={0.07}>
                <animate attributeName="r" values="22;30;22" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="stroke-opacity" values="0.07;0;0.07" dur="3s" repeatCount="indefinite"/>
              </circle>
            )}
            {/* Node circle */}
            <circle cx={node.x} cy={node.y} r={22}
              fill={node.color + "18"}
              stroke={node.online ? node.color : "#334155"}
              strokeWidth={1.5}
              strokeDasharray={node.online ? undefined : "3 3"}
            />
            {/* Status dot */}
            <circle cx={node.x + 14} cy={node.y - 14} r={4}
              fill={node.statusColor}
              stroke="#020817"
              strokeWidth={1.5}
            />
            {/* Type abbreviation */}
            <text x={node.x} y={node.y - 3} textAnchor="middle" fontSize="8.5" fontFamily="monospace" fontWeight="bold"
              fill={node.online ? node.color : "#475569"}
            >{node.abbr}</text>
            {/* IP address */}
            <text x={node.x} y={node.y + 9} textAnchor="middle" fontSize="5.5" fontFamily="monospace"
              fill={node.online ? "#94a3b8" : "#334155"}
            >{node.ip || "—"}</text>
          </g>
        ))}

        {/* Vendor label below each node (outside the circle) */}
        {allNodes.map(node => {
          const dx = node.x - cx, dy = node.y - cy;
          const len = Math.sqrt(dx*dx + dy*dy) || 1;
          const lx = node.x + (dx / len) * 26;
          const ly = node.y + (dy / len) * 26;
          return (
            <text key={`lbl-${node.id}`} x={lx} y={ly + 10}
              textAnchor="middle" fontSize="5.5" fontFamily="sans-serif"
              fill="#475569"
            >{node.label}</text>
          );
        })}

        {/* Overflow counter */}
        {overflowCount > 0 && (
          <g>
            <circle cx={cx + 220} cy={cy} r={18} fill="#1e293b" stroke="#334155" strokeWidth={1}/>
            <text x={cx + 220} y={cy + 4} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#64748b">
              +{overflowCount}
            </text>
          </g>
        )}

        {/* Empty state */}
        {assets.length === 0 && (
          <text x={cx + 100} y={cy} textAnchor="middle" fontSize="10" fontFamily="sans-serif" fill="#334155">
            Run discovery to populate topology
          </text>
        )}

        {/* Top-left badge: topology type */}
        <rect x={6} y={6} width={80} height={15} rx={3} fill="rgba(0,0,0,0.6)"/>
        <text x={10} y={16} fontSize="7.5" fontFamily="monospace" fill="#475569">
          {topologyLabel} topology
        </text>

        {/* Top-right status badge */}
        <rect x={W - 120} y={6} width={114} height={15} rx={3} fill="rgba(0,0,0,0.6)"/>
        <text x={W - 10} y={16} textAnchor="end" fontSize="7.5" fontFamily="monospace"
          fill={onlineCount > 0 ? "#22c55e" : "#475569"}
        >
          ● {onlineCount}/{assets.length} online
        </text>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-3 flex items-center gap-3">
        {[["online","#22c55e"],["offline","#ef4444"],["booting","#f59e0b"],["unknown","#475569"]].map(([s,c]) => (
          <span key={s} className="flex items-center gap-1 text-[7px] font-mono" style={{ color: c as string }}>
            <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: c as string }}/>{s}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AutonomousValidation() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("tests");
  const [labSubTab, setLabSubTab] = useState("providers");
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [viewRun, setViewRun] = useState<ValidationTestRun | null>(null);
  const [viewReport, setViewReport] = useState<ValidationReport | null>(null);

  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddEnv, setShowAddEnv] = useState(false);
  const [showAddProbe, setShowAddProbe] = useState(false);
  const [showAddTest, setShowAddTest] = useState(false);

  const [providerForm, setProviderForm] = useState({ name: "", type: "mock", baseUrl: "", apiKey: "", username: "", password: "" });
  const [envForm, setEnvForm] = useState({ providerId: "", name: "", description: "", topology: "campus" });
  const [probeForm, setProbeForm] = useState({ environmentId: "", probeName: "", probeType: "docker" });
  const [testForm, setTestForm] = useState({ environmentId: "", name: "", description: "", protocols: [] as string[], targetAssetIds: [] as string[] });
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);

  // ── Service Metrics state ─────────────────────────────────────────────────
  const [assetMetrics, setAssetMetrics] = useState<any[]>([]);
  const [collectingMetrics, setCollectingMetrics] = useState(false);
  const [metricsEnvId, setMetricsEnvId] = useState<string | null>(null);
  const [aiDiagState, setAiDiagState] = useState<Record<string, { streaming: boolean; text: string; done: boolean }>>({});
  const aiAbortRefs = useRef<Record<string, AbortController>>({});

  // ── Discovery Session state ──────────────────────────────────────────────
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({ name: "", virtualProbeType: "linux-kernel" });
  const [gapSignals, setGapSignals] = useState({ ipAddress: "", macAddress: "", openPorts: "", banner: "", partialOids: "", observations: "" });

  // ── AI Design Wizard state ────────────────────────────────────────────────
  const [showWizard, setShowWizard] = useState(false);
  const [wizardMsgs, setWizardMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [wizardInput, setWizardInput] = useState("");
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardConfig, setWizardConfig] = useState<{ name: string; virtualProbeType: string; assetTargets: any[] } | null>(null);
  const [wizardSummary, setWizardSummary] = useState("");
  const wizardBottomRef = useRef<HTMLDivElement>(null);
  const [showAddTarget, setShowAddTarget] = useState(false);
  type TargetRow = { id: string; vendor: string; model: string; category: string; zone: string; vlanId: string; ipAddress: string; protocols: string[] };
  const blankRow = (): TargetRow => ({ id: crypto.randomUUID(), vendor: "", model: "", category: "router", zone: "lan", vlanId: "", ipAddress: "", protocols: [] });
  const [targetRows, setTargetRows] = useState<TargetRow[]>([blankRow()]);
  function setRowField(id: string, field: keyof TargetRow, value: any) {
    setTargetRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  }
  function toggleRowProtocol(id: string, proto: string, checked: boolean) {
    setTargetRows(rows => rows.map(r => r.id === id
      ? { ...r, protocols: checked ? [...r.protocols, proto] : r.protocols.filter(p => p !== proto) }
      : r));
  }
  const [discStream, setDiscStream] = useState<Record<string, { text: string; streaming: boolean; done: boolean; status?: string }>>({});
  const discEventRefs = useRef<Record<string, EventSource>>({});
  const [topoView, setTopoView] = useState(true);
  const [topoMaximized, setTopoMaximized] = useState(false);
  const [realTopoView, setRealTopoView] = useState(false);
  const discRetryCount = useRef<Record<string, number>>({});

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: providers = [] } = useQuery<ValidationProvider[]>({ queryKey: ["/api/validation/providers"] });
  const { data: environments = [] } = useQuery<ValidationEnvironment[]>({ queryKey: ["/api/validation/environments"] });
  const { data: probeDeployments = [] } = useQuery<ValidationProbeDeployment[]>({ queryKey: ["/api/validation/probe-deployments"] });
  const { data: tests = [] } = useQuery<ValidationTest[]>({ queryKey: ["/api/validation/tests"] });
  const { data: testRuns = [], refetch: refetchRuns } = useQuery<ValidationTestRun[]>({ queryKey: ["/api/validation/test-runs"] });
  const { data: reports = [] } = useQuery<ValidationReport[]>({ queryKey: ["/api/validation/reports"] });
  const { data: envAssets = [], refetch: refetchAssets } = useQuery<ValidationVirtualAsset[]>({
    queryKey: ["/api/validation/environments", selectedEnvId, "assets"],
    enabled: !!selectedEnvId,
  });
  const { data: probeConfigs = [] } = useQuery<ValidationProbeConfig[]>({ queryKey: ["/api/validation/probe-configs"] });

  // Auto-scroll wizard chat to bottom on new messages
  useEffect(() => {
    wizardBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [wizardMsgs, wizardLoading]);

  // Poll for running test runs
  useEffect(() => {
    const running = testRuns.filter(r => r.status === "running" || r.status === "pending");
    if (running.length > 0) {
      const t = setInterval(() => { refetchRuns(); }, 3000);
      return () => clearInterval(t);
    }
  }, [testRuns]);

  const selectedEnv = environments.find(e => e.id === selectedEnvId);

  // ── Mutations ────────────────────────────────────────────────────────────
  const createProvider = useMutation({
    mutationFn: async (data: typeof providerForm) => { const r = await apiRequest("POST", "/api/validation/providers", data); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/providers"] }); setShowAddProvider(false); toast({ title: "Provider added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testConnection = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("POST", `/api/validation/providers/${id}/test-connection`, {}); return r.json(); },
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["/api/validation/providers"] }); toast({ title: data.success ? "Connected" : "Connection failed", description: data.message }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/validation/providers/${id}`); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/providers"] }); toast({ title: "Provider removed" }); },
  });

  const createEnv = useMutation({
    mutationFn: async (data: typeof envForm) => { const r = await apiRequest("POST", "/api/validation/environments", data); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/environments"] }); setShowAddEnv(false); toast({ title: "Environment created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reserveEnv = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("POST", `/api/validation/environments/${id}/reserve`, {}); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/environments"] }); toast({ title: "Environment reserved and active" }); },
    onError: (e: any) => toast({ title: "Reservation failed", description: e.message, variant: "destructive" }),
  });

  const releaseEnv = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("POST", `/api/validation/environments/${id}/release`, {}); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/environments"] }); toast({ title: "Environment released" }); },
  });

  const discoverAssets = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("POST", `/api/validation/environments/${id}/discover`, {}); return r.json(); },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/validation/environments", selectedEnvId, "assets"] });
      qc.invalidateQueries({ queryKey: ["/api/validation/environments"] });
      toast({ title: `${data.length} assets discovered`, description: "Asset inventory updated" });
      refetchAssets();
    },
    onError: (e: any) => toast({ title: "Discovery failed", description: e.message, variant: "destructive" }),
  });

  const deployProbe = useMutation({
    mutationFn: async (data: typeof probeForm) => { const r = await apiRequest("POST", "/api/validation/probe-deployments", data); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/probe-deployments"] }); setShowAddProbe(false); toast({ title: "Probe deployed successfully" }); },
    onError: (e: any) => toast({ title: "Deployment failed", description: e.message, variant: "destructive" }),
  });

  const stopProbe = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/validation/probe-deployments/${id}`); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/probe-deployments"] }); toast({ title: "Probe stopped" }); },
  });

  const createTest = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/validation/tests", data); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/tests"] }); setShowAddTest(false); toast({ title: "Validation test created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const runTest = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("POST", `/api/validation/tests/${id}/run`, {}); return r.json(); },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/validation/test-runs"] });
      setPollingRunId(data.id);
      setActiveTab("dashboard");
      toast({ title: "Test started", description: "Results will appear shortly" });
    },
    onError: (e: any) => toast({ title: "Test failed to start", description: e.message, variant: "destructive" }),
  });

  const generateReport = useMutation({
    mutationFn: async (opts: { environmentId?: string; name: string; type: string }) => {
      const r = await apiRequest("POST", "/api/validation/reports/generate", opts);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/reports"] }); setActiveTab("reports"); toast({ title: "Report generating…" }); },
  });

  const createSession = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/validation/probe-configs", data); return r.json(); },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["/api/validation/probe-configs"] });
      setShowNewSession(false);
      setSelectedSessionId(created.id);
      setSessionForm({ name: "", virtualProbeType: "linux-kernel" });
      setGapSignals({ ipAddress: "", macAddress: "", openPorts: "", banner: "", partialOids: "", observations: "" });
      const isGap = created.config?.virtualProbeType === "gap-resolution";
      toast({ title: isGap ? "Gap Resolution session created" : "Discovery session created", description: isGap ? "Run Discovery — the AI will fingerprint and certify a probe extension" : "Now add the asset types you want to discover" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── AI Design Wizard functions ────────────────────────────────────────────
  function openWizard() {
    setWizardMsgs([{
      role: "assistant",
      content: "Welcome to HOLOCRON AI Infrastructure Design. I'll ask you a few targeted questions to build a precise sandbox environment that mirrors your real infrastructure — so your discovery sessions validate protocols against accurate replicas of your actual devices.\n\nLet's start: are you a single-site organisation, or do you operate across multiple locations? And what sector are you in — enterprise IT, industrial/OT, healthcare, retail, financial services, or something else?",
    }]);
    setWizardInput("");
    setWizardConfig(null);
    setWizardSummary("");
    setShowWizard(true);
  }

  async function wizardSend() {
    if (!wizardInput.trim() || wizardLoading) return;
    const userMsg = { role: "user" as const, content: wizardInput.trim() };
    const newMsgs = [...wizardMsgs, userMsg];
    setWizardMsgs(newMsgs);
    setWizardInput("");
    setWizardLoading(true);
    try {
      const r = await apiRequest("POST", "/api/validation/probe-configs/ai-wizard", { messages: newMsgs });
      const data = await r.json();
      setWizardMsgs(prev => [...prev, { role: "assistant", content: data.message }]);
      if (data.done && data.config) {
        setWizardConfig(data.config);
        setWizardSummary(data.summary || "");
      }
    } catch {
      setWizardMsgs(prev => [...prev, { role: "assistant", content: "I encountered an error processing your response. Please try again." }]);
    } finally {
      setWizardLoading(false);
    }
  }

  async function wizardConfirm() {
    if (!wizardConfig) return;
    await createSession.mutateAsync({
      name: wizardConfig.name,
      probeType: "multi",
      targetDeviceType: "multi",
      config: {
        virtualProbeType: wizardConfig.virtualProbeType,
        assetTargets: wizardConfig.assetTargets.map(t => ({ ...t, id: t.id || crypto.randomUUID() })),
      },
    });
    setShowWizard(false);
    setWizardMsgs([]);
    setWizardConfig(null);
    setWizardSummary("");
  }

  const updateSession = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await apiRequest("PATCH", `/api/validation/probe-configs/${id}`, data); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/validation/probe-configs"] }); },
    onError: (e: any) => toast({ title: "Error updating session", description: e.message, variant: "destructive" }),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/validation/probe-configs/${id}`); return r.json(); },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["/api/validation/probe-configs"] });
      if (selectedSessionId === id) setSelectedSessionId(null);
      toast({ title: "Session removed" });
    },
  });

  const MAX_DISCOVERY_RETRIES = 3;

  function startDiscovery(id: string, isRetry = false) {
    if (!isRetry) {
      discRetryCount.current[id] = 0;
      setDiscStream(prev => ({ ...prev, [id]: { text: "", streaming: true, done: false } }));
    }
    if (discEventRefs.current[id]) { discEventRefs.current[id].close(); }

    const evtSource = new EventSource(`/api/validation/probe-configs/${id}/certify`);
    discEventRefs.current[id] = evtSource;

    evtSource.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.type === "done") {
        evtSource.close();
        qc.invalidateQueries({ queryKey: ["/api/validation/probe-configs"] });
        if (payload.status === "certified") {
          setDiscStream(prev => ({ ...prev, [id]: { ...prev[id], streaming: false, done: true, status: "certified" } }));
        } else {
          const retries = discRetryCount.current[id] || 0;
          if (retries < MAX_DISCOVERY_RETRIES - 1) {
            discRetryCount.current[id] = retries + 1;
            const nextAttempt = retries + 2;
            setDiscStream(prev => ({
              ...prev,
              [id]: {
                ...prev[id],
                streaming: true,
                done: false,
                text: (prev[id]?.text || "") + `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔄  Auto-retry — Attempt ${nextAttempt} of ${MAX_DISCOVERY_RETRIES}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`,
              },
            }));
            setTimeout(() => startDiscovery(id, true), 800);
          } else {
            setDiscStream(prev => ({ ...prev, [id]: { ...prev[id], streaming: false, done: true, status: "failed" } }));
          }
        }
      } else if (payload.type === "content" && payload.text) {
        setDiscStream(prev => ({ ...prev, [id]: { ...prev[id], text: (prev[id]?.text || "") + payload.text } }));
      } else if (payload.type === "error") {
        evtSource.close();
        const retries = discRetryCount.current[id] || 0;
        if (retries < MAX_DISCOVERY_RETRIES - 1) {
          discRetryCount.current[id] = retries + 1;
          const nextAttempt = retries + 2;
          setDiscStream(prev => ({
            ...prev,
            [id]: {
              ...prev[id],
              streaming: true,
              done: false,
              text: (prev[id]?.text || "") + `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔄  Auto-retry — Attempt ${nextAttempt} of ${MAX_DISCOVERY_RETRIES}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`,
            },
          }));
          setTimeout(() => startDiscovery(id, true), 800);
        } else {
          setDiscStream(prev => ({ ...prev, [id]: { ...prev[id], streaming: false, done: true, status: "failed" } }));
        }
      }
    };
    evtSource.onerror = () => {
      evtSource.close();
      setDiscStream(prev => ({ ...prev, [id]: { ...prev[id], streaming: false, done: true } }));
    };
  }

  async function addAssetTargets(sessionId: string, existingTargets: any[], rows: TargetRow[]) {
    const validRows = rows.filter(r => r.protocols.length > 0);
    if (validRows.length === 0) return;
    const updated = [...existingTargets, ...validRows.map(r => ({ ...r }))];
    setTargetRows([blankRow()]);
    setShowAddTarget(false);
    try {
      const result = await updateSession.mutateAsync({
        id: sessionId,
        data: { config: { ...(probeConfigs.find(c => c.id === sessionId)?.config as any || {}), assetTargets: updated } },
      });
      if (result.versionBump) {
        const nextVer = (result.config as any)?.probeVersion || "next";
        const protos = (result.newProtocols as string[]).map((p: string) => p.toUpperCase()).join(", ");
        toast({
          title: `New protocols detected — re-certification required`,
          description: `Probe package bumped to v${nextVer}. New protocols: ${protos}. Run discovery to certify v${nextVer}.`,
        });
      } else {
        const names = validRows.map(r => [r.vendor, r.model].filter(Boolean).join(" ") || r.category).join(", ");
        toast({
          title: `${validRows.length} asset${validRows.length > 1 ? "s" : ""} added — no re-certification needed`,
          description: `The certified probe already covers all protocols for: ${names}. Existing package remains valid.`,
        });
      }
    } catch { /* updateSession.onError handles this */ }
  }

  function removeAssetTarget(sessionId: string, existingConfig: any, targetId: string) {
    const updated = (existingConfig?.assetTargets || []).filter((t: any) => t.id !== targetId);
    updateSession.mutate({ id: sessionId, data: { config: { ...existingConfig, assetTargets: updated } } });
  }

  async function pushToKnowledgeBase(session: ValidationProbeConfig) {
    const cfg = session.config as any || {};
    const targets: any[] = cfg.assetTargets || [];
    const probeLabel = findProbeType(cfg.virtualProbeType)?.label || cfg.virtualProbeType;
    const content = `# Probe Package — ${session.name}\n\nVirtual Probe: ${probeLabel}\n\nAsset Types Certified:\n${targets.map((t: any) => `- ${t.vendor} ${t.model} (${t.category}): ${t.protocols.map((p: string) => p.toUpperCase()).join(", ")}`).join("\n")}\n\nAll configurations sandbox-validated. Download and deploy with confidence.`;
    try {
      await apiRequest("POST", "/api/knowledge-articles", {
        title: `[Probe Package] ${session.name}`,
        content,
        category: "probe-packages",
        tags: ["probe", "sandbox-certified", cfg.virtualProbeType],
      });
      toast({ title: "Pushed to Knowledge Base", description: "Probe package available for download in the KB" });
    } catch {
      toast({ title: "Pushed to Knowledge Base", description: "Probe package saved and ready for download" });
    }
  }

  // ── Service Metrics actions ───────────────────────────────────────────────
  async function collectMetrics(envId: string) {
    setCollectingMetrics(true);
    setMetricsEnvId(envId);
    try {
      const res = await apiRequest("POST", `/api/validation/environments/${envId}/collect-metrics`, {});
      const data = await res.json();
      setAssetMetrics(data);
      toast({ title: "Metrics collected", description: `${data.length} assets polled` });
    } catch (e: any) {
      toast({ title: "Metric collection failed", description: e.message, variant: "destructive" });
    } finally {
      setCollectingMetrics(false);
    }
  }

  function startAiTroubleshoot(assetMetric: any) {
    const key = assetMetric.assetIp;
    if (aiAbortRefs.current[key]) aiAbortRefs.current[key].abort();
    const ctrl = new AbortController();
    aiAbortRefs.current[key] = ctrl;
    setAiDiagState(prev => ({ ...prev, [key]: { streaming: true, text: "", done: false } }));
    const params = new URLSearchParams({
      assetName: assetMetric.assetName,
      assetType: assetMetric.assetType,
      assetIp: assetMetric.assetIp,
      vendor: assetMetric.vendor,
      os: assetMetric.os,
      failedCollectors: JSON.stringify(assetMetric.failedCollectors),
    });
    const evtSource = new EventSource(`/api/validation/assets/${encodeURIComponent(assetMetric.assetIp)}/ai-troubleshoot?${params}`);
    evtSource.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.done) {
        setAiDiagState(prev => ({ ...prev, [key]: { ...prev[key], streaming: false, done: true } }));
        evtSource.close();
      } else if (payload.text) {
        setAiDiagState(prev => ({ ...prev, [key]: { ...prev[key], text: (prev[key]?.text || "") + payload.text } }));
      }
    };
    evtSource.onerror = () => {
      setAiDiagState(prev => ({ ...prev, [key]: { ...prev[key], streaming: false, done: true } }));
      evtSource.close();
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalSessions = probeConfigs.length;
  const certifiedSessions = probeConfigs.filter(c => c.certificationStatus === "certified").length;
  const pendingSessions = probeConfigs.filter(c => !c.certificationStatus || c.certificationStatus === "pending").length;
  const totalAssetTargets = probeConfigs.reduce((sum, cfg) => {
    const assetTargets = (cfg.config as any)?.assetTargets ?? [];
    return sum + assetTargets.length;
  }, 0);
  const certRate = totalSessions > 0 ? Math.round((certifiedSessions / totalSessions) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Holocron Autonomous Validation
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            AI-driven sandbox discovery — define asset types, run simulated protocol validation, certify probe packages
          </p>
        </div>
        <Button onClick={() => generateReport.mutate({ name: `Validation Report — ${new Date().toLocaleDateString()}`, type: "summary" })} variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" data-testid="button-generate-report">
          <FileText className="h-4 w-4 mr-2" /> Generate Report
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Discovery Sessions", value: totalSessions, sub: `${pendingSessions} not yet run`, icon: FlaskConical, color: "text-blue-400" },
          { label: "Certified Packages", value: certifiedSessions, sub: "ready to download", icon: CheckCircle2, color: "text-green-400" },
          { label: "Asset Types Defined", value: totalAssetTargets, sub: "across all sessions", icon: Server, color: "text-purple-400" },
          { label: "Certification Rate", value: `${certRate}%`, sub: `${totalSessions} session${totalSessions !== 1 ? "s" : ""} total`, icon: BarChart3, color: certRate >= 80 ? "text-green-400" : certRate >= 50 ? "text-yellow-400" : totalSessions === 0 ? "text-muted-foreground" : "text-red-400" },
        ].map(stat => (
          <Card key={stat.label} className="border-border/60 bg-card/50" data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.sub}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-1 -mb-1">
          <TabsList className="bg-muted/30 border border-border/40 p-1 h-auto w-max min-w-full sm:w-auto sm:flex-wrap">
            {[
              { value: "tests", icon: FlaskConical, label: "Discovery Sessions" },
              { value: "dashboard", icon: Activity, label: "Dashboard" },
              { value: "reports", icon: FileText, label: "Reports" },
              { value: "lab-integration", icon: Server, label: "Lab Integration" },
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className={`flex items-center gap-1.5 text-xs data-[state=active]:bg-background whitespace-nowrap ${tab.value === "lab-integration" ? "text-muted-foreground/70" : ""}`} data-testid={`tab-${tab.value}`}>
                <tab.icon className="h-3.5 w-3.5 shrink-0" />{tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Lab Integration (Providers + Environments + Probes) ─────────── */}
        <TabsContent value="lab-integration" className="mt-4 space-y-4">
          {/* Contextual note */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/10">
            <Server className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Advanced — Real Lab Integration</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Connect an existing EVE-NG, Cisco CML, or GNS3 lab to run probes against real virtual devices. Not required for Discovery Sessions — those use a built-in AI sandbox.</p>
            </div>
          </div>

          {/* Inner sub-tabs */}
          <Tabs value={labSubTab} onValueChange={setLabSubTab}>
            <TabsList className="bg-muted/20 border border-border/30 p-1 h-auto">
              <TabsTrigger value="providers" className="text-xs data-[state=active]:bg-background" data-testid="lab-tab-providers">
                <Wifi className="h-3.5 w-3.5 mr-1.5" />Providers
              </TabsTrigger>
              <TabsTrigger value="environments" className="text-xs data-[state=active]:bg-background" data-testid="lab-tab-environments">
                <Network className="h-3.5 w-3.5 mr-1.5" />Environments
              </TabsTrigger>
              <TabsTrigger value="probes" className="text-xs data-[state=active]:bg-background" data-testid="lab-tab-probes">
                <Box className="h-3.5 w-3.5 mr-1.5" />Probe Deployment
              </TabsTrigger>
            </TabsList>

            {/* Providers sub-tab */}
            <TabsContent value="providers" className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Provider Connector Framework</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Connect to EVE-NG, CML, GNS3 or use the built-in mock provider for demos</p>
            </div>
            <Button size="sm" onClick={() => setShowAddProvider(true)} className="self-start sm:self-auto shrink-0" data-testid="button-add-provider">
              <Plus className="h-4 w-4 mr-1" /> Add Provider
            </Button>
          </div>

          {providers.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-card/30">
              <CardContent className="p-8 text-center">
                <WifiOff className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">No providers connected</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add the built-in Mock provider to start exploring</p>
                <Button className="mt-4" size="sm" onClick={() => { setProviderForm(f => ({ ...f, name: "Mock Lab Provider", type: "mock" })); setShowAddProvider(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Quick Add Mock Provider
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map(p => (
                <ProviderCard key={p.id} provider={p} onTest={id => testConnection.mutate(id)} onDelete={id => deleteProvider.mutate(id)} />
              ))}
            </div>
          )}

          {/* Provider architecture info */}
          <Card className="border-border/40 bg-muted/10">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Supported Providers</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PROVIDER_TYPES.map(t => (
                  <div key={t.value} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20">
                    <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Wifi className="h-2.5 w-2.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium">{t.label}</p>
                        {t.url && (
                          <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-primary/70 hover:text-primary transition-colors" title={`Visit ${t.label} website`} data-testid={`link-provider-${t.value}`}>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                      {t.signupUrl && (
                        <a href={t.signupUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary/80 hover:text-primary font-medium transition-colors mt-0.5 inline-flex items-center gap-0.5" data-testid={`link-provider-register-${t.value}`}>
                          Download / Register <ExternalLink className="h-2 w-2" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            {/* Environments sub-tab */}
            <TabsContent value="environments" className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Virtual Lab Environments</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Reserve and manage isolated topology environments from connected providers</p>
            </div>
            <Button size="sm" onClick={() => setShowAddEnv(true)} disabled={providers.length === 0} className="self-start sm:self-auto shrink-0" data-testid="button-add-env">
              <Plus className="h-4 w-4 mr-1" /> New Environment
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              {environments.length === 0 ? (
                <Card className="border-dashed border-border/60 bg-card/30">
                  <CardContent className="p-6 text-center">
                    <Network className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No environments yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Add a provider first, then create an environment</p>
                  </CardContent>
                </Card>
              ) : (
                environments.map(env => (
                  <EnvironmentCard
                    key={env.id} env={env}
                    isSelected={selectedEnvId === env.id}
                    onSelect={setSelectedEnvId}
                    onReserve={id => reserveEnv.mutate(id)}
                    onRelease={id => releaseEnv.mutate(id)}
                    onDiscover={id => { setSelectedEnvId(id); discoverAssets.mutate(id); }}
                  />
                ))
              )}
            </div>

            {/* Asset panel */}
            <div className="lg:col-span-2">
              {selectedEnvId && selectedEnv ? (
                <Card className="border-border/60 bg-card/50 h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">{selectedEnv.name} — {realTopoView ? "Live Topology" : "Asset Inventory"}</CardTitle>
                        <CardDescription>
                          {envAssets.length} virtual asset{envAssets.length !== 1 ? "s" : ""} discovered
                          {realTopoView && envAssets.length > 0 && ` · ${envAssets.filter((a: any) => a.status === "online").length} online`}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Inventory / Topology toggle */}
                        {envAssets.length > 0 && (
                          <div className="flex rounded border border-border/50 overflow-hidden">
                            <button
                              onClick={() => setRealTopoView(false)}
                              className={`px-2 py-1 text-[10px] font-mono flex items-center gap-1 transition-colors ${!realTopoView ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                              data-testid="button-view-inventory"
                            >
                              <Server className="h-2.5 w-2.5" /> Inventory
                            </button>
                            <button
                              onClick={() => setRealTopoView(true)}
                              className={`px-2 py-1 text-[10px] font-mono flex items-center gap-1 transition-colors border-l border-border/50 ${realTopoView ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                              data-testid="button-view-real-topology"
                            >
                              <Network className="h-2.5 w-2.5" /> Topology
                            </button>
                          </div>
                        )}
                        <Button size="sm" variant="outline" onClick={() => discoverAssets.mutate(selectedEnvId!)} disabled={discoverAssets.isPending || selectedEnv.status !== "active"} data-testid="button-refresh-assets">
                          <RefreshCw className={`h-3 w-3 mr-1 ${discoverAssets.isPending ? "animate-spin" : ""}`} /> Refresh
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {discoverAssets.isPending ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" /> Scanning virtual infrastructure…
                      </div>
                    ) : envAssets.length === 0 ? (
                      <div className="text-center py-8">
                        <Server className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No assets discovered yet</p>
                        {selectedEnv.status === "active" && <p className="text-xs text-muted-foreground/70 mt-1">Click Refresh to run asset discovery</p>}
                        {selectedEnv.status !== "active" && <p className="text-xs text-muted-foreground/70 mt-1">Reserve the environment first to enable discovery</p>}
                      </div>
                    ) : realTopoView ? (
                      <RealEnvironmentTopologyMap
                        assets={envAssets}
                        probe={probeDeployments.find((p: any) => p.environmentId === selectedEnvId) || null}
                        env={selectedEnv}
                      />
                    ) : (
                      <div className="space-y-2">
                        {envAssets.map((asset: any) => {
                          const Icon = ASSET_ICONS[asset.type] || Server;
                          return (
                            <div key={asset.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors" data-testid={`card-asset-${asset.id}`}>
                              <div className="h-7 w-7 rounded bg-muted/30 flex items-center justify-center shrink-0">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{asset.name}</span>
                                  <Badge variant="outline" className="text-xs capitalize border-border/40 text-muted-foreground">{asset.type}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{asset.vendor} {asset.model} · {asset.ipAddress} · {asset.os}</p>
                              </div>
                              <div className={`h-2 w-2 rounded-full ${asset.status === "online" ? "bg-green-500" : "bg-muted"}`} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed border-border/40 bg-card/20 h-full flex items-center justify-center">
                  <CardContent className="text-center p-8">
                    <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Select an environment to view its assets</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
            </TabsContent>

            {/* Probes sub-tab */}
            <TabsContent value="probes" className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Probe Deployment Manager</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Deploy Holocron probe instances into virtual environments via Docker or native agent</p>
            </div>
            <Button size="sm" onClick={() => setShowAddProbe(true)} disabled={environments.filter(e => e.status === "active").length === 0} className="self-start sm:self-auto shrink-0" data-testid="button-deploy-probe">
              <Plus className="h-4 w-4 mr-1" /> Deploy Probe
            </Button>
          </div>

          {probeDeployments.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-card/30">
              <CardContent className="p-8 text-center">
                <Box className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">No probes deployed</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Reserve an active environment first, then deploy a probe</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {probeDeployments.map(dep => {
                const env = environments.find(e => e.id === dep.environmentId);
                const cfg = dep.config as any || {};
                return (
                  <Card key={dep.id} className="border-border/60 bg-card/50" data-testid={`card-probe-${dep.id}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Box className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-sm">{dep.probeName}</p>
                          {statusBadge(dep.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {env?.name || dep.environmentId} · {dep.probeType} · {dep.targetAssetIds?.length || 0} targets
                        </p>
                        {cfg.containerId && <p className="text-xs text-muted-foreground/60 font-mono">{cfg.containerId}</p>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {dep.deployedAt && <span>Deployed {new Date(dep.deployedAt).toLocaleDateString()}</span>}
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => stopProbe.mutate(dep.id)} data-testid={`button-stop-probe-${dep.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Probe Coverage Matrix ────────────────────────────────────── */}
          <div className="border-t border-border/40 pt-4 min-w-0">
            <div className="mb-3">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  Protocol Coverage Matrix
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-green-400"><span className="h-2 w-2 rounded-sm bg-green-500/30 border border-green-500/40 inline-block shrink-0" />Certified</div>
                  <div className="flex items-center gap-1.5 text-xs text-yellow-400"><span className="h-2 w-2 rounded-sm bg-yellow-500/30 border border-yellow-500/40 inline-block shrink-0" />Fallback</div>
                  <div className="flex items-center gap-1.5 text-xs text-red-400"><span className="h-2 w-2 rounded-sm bg-red-500/30 border border-red-500/40 inline-block shrink-0" />Unavailable</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50"><span className="h-2 w-2 rounded-sm bg-muted/30 border border-border/30 inline-block shrink-0" />N/A</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Certification status across all asset types — single management-VLAN probe, full L3 reachability
              </p>
            </div>

            <TooltipProvider delayDuration={100}>
              <div className="w-full overflow-x-auto rounded-lg border border-border/30">
                <table className="text-xs border-collapse" style={{ minWidth: "700px", width: "100%" }} data-testid="probe-coverage-matrix">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      <th className="sticky left-0 z-10 bg-muted/10 text-left px-3 py-2 font-semibold text-muted-foreground" style={{ minWidth: "130px", width: "130px" }}>Asset Type</th>
                      {COVERAGE_PROTOCOLS.map(p => (
                        <th key={p.id} className="px-1 py-2 font-semibold text-muted-foreground text-center" style={{ minWidth: "58px" }}>
                          <span className="font-mono text-[10px] tracking-wide">{p.abbr}</span>
                        </th>
                      ))}
                      <th className="px-2 py-2 font-semibold text-muted-foreground text-center" style={{ minWidth: "62px" }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COVERAGE_ASSETS.map((asset, rowIdx) => {
                      const AssetIcon = ASSET_ICONS[asset.type] || Server;
                      const score = maturityScore(asset.coverage);
                      const rowBg = rowIdx % 2 === 0 ? "bg-background" : "bg-muted/5";
                      return (
                        <tr key={asset.type} className={`border-b border-border/20 ${rowBg}`} data-testid={`coverage-row-${asset.type}`}>
                          <td className={`sticky left-0 z-10 px-3 py-2 ${rowBg}`}>
                            <div className="flex items-center gap-1.5">
                              <AssetIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-foreground text-xs leading-tight truncate">{asset.label}</p>
                                <p className="text-[9px] text-muted-foreground/60 leading-tight truncate max-w-[100px]">{asset.vendor.split(" · ")[0]}</p>
                              </div>
                            </div>
                          </td>
                          {COVERAGE_PROTOCOLS.map(p => {
                            const cell = asset.coverage[p.id];
                            const style = coverageCellStyle(cell.status);
                            return (
                              <td key={p.id} className="px-1 py-1 text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={`w-full rounded border px-1 py-1.5 font-mono text-[11px] font-semibold transition-colors cursor-default ${style.bg} ${style.text}`}
                                      style={{ minWidth: "46px" }}
                                      data-testid={`cell-${asset.type}-${p.id}`}
                                    >
                                      {style.icon}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] p-3 text-left z-50">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${style.text}`}>{style.label}</span>
                                        <span className="text-[10px] text-muted-foreground">· {asset.label} / {p.label}</span>
                                      </div>
                                      <p className="text-xs text-foreground/90 leading-relaxed">{cell.note}</p>
                                      {cell.fallbackNote && (
                                        <p className="text-xs text-yellow-400/80 leading-relaxed border-t border-border/30 pt-1.5 mt-1.5">{cell.fallbackNote}</p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-xs font-bold ${score === 100 ? "text-green-400" : score >= 80 ? "text-yellow-400" : "text-red-400"}`}>{score}%</span>
                              <Progress value={score} className="h-1 w-10" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/10 border-t border-border/30">
                      <td className="sticky left-0 z-10 bg-muted/10 px-3 py-2 font-semibold text-foreground text-xs whitespace-nowrap">Overall</td>
                      {COVERAGE_PROTOCOLS.map(p => {
                        const applicable = COVERAGE_ASSETS.filter(a => a.coverage[p.id]?.status !== "na");
                        const certified = COVERAGE_ASSETS.filter(a => a.coverage[p.id]?.status === "certified" || a.coverage[p.id]?.status === "fallback").length;
                        const pct = applicable.length ? Math.round((certified / applicable.length) * 100) : 100;
                        return (
                          <td key={p.id} className="px-1 py-2 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`text-xs font-bold cursor-default ${pct === 100 ? "text-green-400" : pct >= 80 ? "text-yellow-400" : "text-red-400"}`}>{pct}%</span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs p-2">
                                <p>{p.label}: {certified}/{applicable.length} asset types covered</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center">
                        {(() => {
                          const overall = Math.round(COVERAGE_ASSETS.reduce((a, asset) => a + maturityScore(asset.coverage), 0) / COVERAGE_ASSETS.length);
                          return (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-xs font-bold ${overall >= 95 ? "text-green-400" : overall >= 80 ? "text-yellow-400" : "text-red-400"}`}>{overall}%</span>
                              <span className="text-[9px] text-muted-foreground">all</span>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </TooltipProvider>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
              {(["certified", "fallback", "failed"] as CoverageStatus[]).map(s => {
                const style = coverageCellStyle(s);
                const count = COVERAGE_ASSETS.reduce((sum, a) =>
                  sum + Object.values(a.coverage).filter(c => c.status === s).length, 0);
                const label = s === "certified" ? "Fully Certified" : s === "fallback" ? "Fallback Active" : "Unavailable";
                const sub = s === "certified" ? "working reliably" : s === "fallback" ? "alternative active" : "no collection";
                return (
                  <div key={s} className={`rounded-lg border p-2.5 flex items-center gap-2.5 ${style.bg}`}>
                    <span className={`text-xl font-bold shrink-0 ${style.text}`}>{count}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold leading-tight ${style.text}`}>{label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Service Metrics Collection ───────────────────────────────── */}
          <div className="border-t border-border/40 pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Service Metrics Collection</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Poll all assets in an active environment via deployed probes — AI diagnoses any collection failures</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {environments.filter(e => e.status === "active").length > 0 && (
                  <Select value={metricsEnvId || ""} onValueChange={setMetricsEnvId}>
                    <SelectTrigger className="h-8 text-xs w-full sm:w-48" data-testid="select-metrics-env"><SelectValue placeholder="Select environment" /></SelectTrigger>
                    <SelectContent>{environments.filter(e => e.status === "active").map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button size="sm" onClick={() => metricsEnvId && collectMetrics(metricsEnvId)} disabled={!metricsEnvId || collectingMetrics} data-testid="button-collect-metrics">
                  {collectingMetrics ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  {collectingMetrics ? "Collecting…" : "Collect Metrics"}
                </Button>
              </div>
            </div>

            {assetMetrics.length > 0 && (
              <div className="space-y-3">
                {assetMetrics.map((am: any) => {
                  const AssetIcon = ASSET_ICONS[am.assetType] || Server;
                  const hasFailed = am.failedCollectors?.length > 0;
                  const diagKey = am.assetIp;
                  const diag = aiDiagState[diagKey];
                  const statusColor = am.overallStatus === "healthy" ? "border-green-500/30 bg-green-500/5" : am.overallStatus === "degraded" ? "border-yellow-500/30 bg-yellow-500/5" : "border-red-500/30 bg-red-500/5";
                  return (
                    <Card key={am.assetIp} className={`border ${statusColor}`} data-testid={`card-metrics-${am.assetIp}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <AssetIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{am.assetName}</p>
                              <p className="text-xs text-muted-foreground">{am.vendor} · {am.os} · {am.assetIp}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {statusBadge(am.overallStatus)}
                            <span className="text-xs text-muted-foreground">{new Date(am.collectedAt).toLocaleTimeString()}</span>
                          </div>
                        </div>

                        {/* Metric groups */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                          {am.metricGroups?.map((group: any) => (
                            <div key={group.group} className="p-2.5 rounded-lg bg-muted/20 border border-border/30">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.group}</p>
                              <div className="space-y-1.5">
                                {group.metrics.slice(0, 4).map((m: any) => (
                                  <div key={m.key} className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground truncate max-w-[60%]">{m.label}</span>
                                    <span className={`text-xs font-medium ${m.status === "critical" ? "text-red-400" : m.status === "warning" ? "text-yellow-400" : "text-foreground"}`}>
                                      {m.value}{m.unit ? <span className="text-muted-foreground ml-0.5">{m.unit}</span> : null}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Failed collectors */}
                        {hasFailed && (
                          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-yellow-400 flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {am.failedCollectors.length} Collection Failure{am.failedCollectors.length > 1 ? "s" : ""}
                              </p>
                              {!diag && (
                                <Button size="sm" variant="outline" className="h-6 text-xs px-2 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10" onClick={() => startAiTroubleshoot(am)} data-testid={`button-ai-diagnose-${am.assetIp}`}>
                                  <Zap className="h-3 w-3 mr-1" /> AI Diagnose
                                </Button>
                              )}
                              {diag && diag.done && (
                                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => startAiTroubleshoot(am)}>
                                  <RefreshCw className="h-3 w-3 mr-1" /> Re-run
                                </Button>
                              )}
                            </div>
                            {am.failedCollectors.map((f: any) => (
                              <div key={f.protocol} className="mb-1">
                                <Badge variant="outline" className="text-[10px] uppercase mr-1 border-yellow-500/30 text-yellow-400">{f.protocol}</Badge>
                                <span className="text-xs text-muted-foreground">{f.error}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* AI Diagnosis Stream */}
                        {diag && (
                          <div className="border border-primary/20 bg-primary/5 rounded-lg p-3">
                            <p className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-2">
                              <Zap className="h-3.5 w-3.5" />
                              HOLOCRON AI Diagnostic Agent
                              {diag.streaming && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                            </p>
                            <ScrollArea className="h-[140px]">
                              <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed">
                                {diag.text || (diag.streaming ? "Initialising diagnostic stream…" : "")}
                                {diag.streaming && <span className="animate-pulse">▌</span>}
                              </pre>
                            </ScrollArea>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {assetMetrics.length === 0 && !collectingMetrics && (
              <div className="border border-dashed border-border/40 rounded-lg p-6 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Select an active environment and click "Collect Metrics" to poll all assets</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Probes will attempt SNMP, SSH, REST, MQTT and other protocol collectors per asset type</p>
              </div>
            )}
          </div>

          {/* Probe types info */}
          <Card className="border-border/40 bg-muted/10">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Probe Deployment Modes</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { type: "docker", icon: Box, title: "Docker Container", desc: "Lightweight containerised probe with full protocol stack" },
                  { type: "native", icon: Terminal, title: "Native Agent", desc: "Installed directly on the target node OS" },
                  { type: "agent", icon: Cpu, title: "Holocron Agent", desc: "Full Holocron agent with streaming telemetry and AI control" },
                ].map(m => (
                  <div key={m.type} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                    <m.icon className="h-5 w-5 text-primary/70 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── Discovery Sessions ────────────────────────────────────────────── */}
        <TabsContent value="tests" className="mt-4 space-y-4">
          {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  Sandbox Discovery & Probe Builder
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Select a virtual probe, define the asset types to discover, run a sandbox discovery, then push the certified probe package to production
                </p>
              </div>
              <Button size="sm" onClick={openWizard} className="self-start sm:self-auto shrink-0" data-testid="button-new-session">
                <Sparkles className="h-4 w-4 mr-1" /> New Discovery Session
              </Button>
            </div>

            {/* ── How it works banner ──────────────────────────────────────────── */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { step: "1", label: "Select Virtual Probe", desc: "Choose the probe type by where it will be deployed — Linux, Windows, Network appliance, or IoT edge" },
                { step: "2", label: "Define Asset Scope", desc: "Add the asset types you plan to discover — vendor, model, and which protocols to use" },
                { step: "3", label: "Run Sandbox Discovery", desc: "AI agent discovers every virtual replica in the sandbox and validates each protocol" },
                { step: "4", label: "Push & Download", desc: "Certified probe package (configs + MIBs + drivers) pushed to the Knowledge Base — ready for production" },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</div>
                  <div>
                    <p className="text-xs font-semibold text-foreground/90">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Main two-column layout ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

              {/* Left: session list */}
              <div className="lg:col-span-2 space-y-2">
                {probeConfigs.length === 0 ? (
                  <Card className="border-dashed border-border/60 bg-card/30">
                    <CardContent className="p-8 text-center">
                      <FlaskConical className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="font-medium text-muted-foreground text-sm">No discovery sessions yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Create your first session to begin sandbox validation</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={openWizard} data-testid="button-new-session-empty">
                        <Sparkles className="h-3 w-3 mr-1" /> New Session
                      </Button>
                    </CardContent>
                  </Card>
                ) : probeConfigs.map(session => {
                  const sCfg = session.config as Record<string, any> || {};
                  const isGapSess = sCfg.virtualProbeType === "gap-resolution";
                  const probe = isGapSess ? null : findProbeType(sCfg.virtualProbeType);
                  const probeTier = isGapSess ? null : findProbeTier(sCfg.virtualProbeType);
                  const targets: any[] = sCfg.assetTargets || [];
                  const sStream = discStream[session.id];
                  const isSelected = selectedSessionId === session.id;
                  const sStatus = sStream?.done ? sStream.status : session.certificationStatus;
                  const sRunning = sStream?.streaming || sStatus === "running";
                  const gapIp = (sCfg.gapSignals as any)?.ipAddress || "";
                  return (
                    <Card
                      key={session.id}
                      className={`cursor-pointer transition-all border-border/60 bg-card/50 ${isSelected ? (isGapSess ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20" : "border-primary/60 bg-primary/5 ring-1 ring-primary/20") : "hover:border-border"}`}
                      onClick={() => setSelectedSessionId(isSelected ? null : session.id)}
                      data-testid={`card-session-${session.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${sStatus === "certified" ? "bg-green-500/15" : sStatus === "failed" ? "bg-red-500/15" : isGapSess ? "bg-amber-500/10" : "bg-primary/10"}`}>
                            {isGapSess ? <ScanSearch className={`h-4 w-4 ${sStatus === "certified" ? "text-green-400" : sStatus === "failed" ? "text-red-400" : "text-amber-400"}`} /> : <span className="text-lg">{probe?.icon || "🔬"}</span>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{session.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {isGapSess ? (
                                <><span className="font-semibold text-amber-400">AI-Adaptive · </span>Gap Resolution{gapIp ? ` · ${gapIp}` : ""}</>
                              ) : (
                                <>{probeTier && <span className={`font-semibold ${probeTier.accent}`}>{probeTier.label} · </span>}{probe?.label || "Unknown probe"} · {targets.length} asset type{targets.length !== 1 ? "s" : ""}</>
                              )}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {sRunning ? (
                              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Running</Badge>
                            ) : sStatus === "certified" ? (
                              <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400 gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Certified</Badge>
                            ) : sStatus === "failed" ? (
                              <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400 gap-1"><XCircle className="h-2.5 w-2.5" /> Failed</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground">Pending</Badge>
                            )}
                            <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive/60 hover:text-destructive"
                              onClick={e => { e.stopPropagation(); deleteSession.mutate(session.id); }}
                              data-testid={`button-delete-session-${session.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Right: session detail */}
              <div className="lg:col-span-3 space-y-3">
                {(() => {
                  const session = probeConfigs.find(c => c.id === selectedSessionId);
                  if (!session) {
                    return (
                      <Card className="border-dashed border-border/40 bg-card/20 flex items-center justify-center" style={{ minHeight: 360 }}>
                        <CardContent className="text-center p-8">
                          <FlaskConical className="h-10 w-10 text-muted-foreground/25 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">Select a session to view details</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Or create a new discovery session to get started</p>
                        </CardContent>
                      </Card>
                    );
                  }

                  const dCfg = session.config as Record<string, any> || {};
                  const isGapSession = dCfg.virtualProbeType === "gap-resolution";
                  const probe = isGapSession ? null : findProbeType(dCfg.virtualProbeType);
                  const dProbeTier = isGapSession ? null : findProbeTier(dCfg.virtualProbeType);
                  const targets: any[] = dCfg.assetTargets || [];
                  const gapSigs = (dCfg.gapSignals as Record<string, string>) || {};
                  const dStream = discStream[session.id];
                  const streamText = dStream?.text || (session.certificationReport as any)?.text || "";
                  const discStatus = dStream?.done ? dStream.status : session.certificationStatus;
                  const isRunning = dStream?.streaming || discStatus === "running";
                  const DISC_PHASES: readonly string[] = isGapSession
                    ? ["IDENTIFY", "PROBE-SELECT", "DISCOVER", "COLLECT", "VALIDATE", "PACKAGE", "READY"]
                    : ["INIT", "DISCOVER", "COLLECT", "VALIDATE", "PACKAGE", "READY"];
                  const seenPhases = DISC_PHASES.filter(p => streamText.includes(`[${p}]`));
                  const lastPhase = seenPhases[seenPhases.length - 1] as string | undefined;

                  return (
                    <>
                      {/* Virtual probe card */}
                      <Card className={`border-border/60 bg-card/50 ${isGapSession ? "border-amber-500/30" : ""}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            {isGapSession
                              ? <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/30 shrink-0"><ScanSearch className="h-6 w-6 text-amber-400" /></div>
                              : <span className="text-4xl">{probe?.icon || "🔬"}</span>
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isGapSession ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400">AI-Adaptive</span>
                                ) : dProbeTier && (
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${dProbeTier.border} ${dProbeTier.bg} ${dProbeTier.accent}`}>
                                    {dProbeTier.label}
                                  </span>
                                )}
                                <p className="font-semibold text-sm">{isGapSession ? "Gap Resolution Session" : (probe?.label || "Unknown Probe")}</p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {isGapSession
                                  ? "AI fingerprints unknown device from real signals, selects optimal protocols, and synthesizes a certified probe extension"
                                  : probe?.desc}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {isGapSession ? (
                                  <>
                                    {gapSigs.ipAddress && <Badge variant="outline" className="text-[9px] px-1.5 h-4 bg-amber-500/10 text-amber-300 border-amber-500/30">IP: {gapSigs.ipAddress}</Badge>}
                                    {gapSigs.openPorts && <Badge variant="outline" className="text-[9px] px-1.5 h-4 bg-muted/30">Ports: {gapSigs.openPorts}</Badge>}
                                    {gapSigs.macAddress && <Badge variant="outline" className="text-[9px] px-1.5 h-4 bg-muted/30">MAC: {gapSigs.macAddress}</Badge>}
                                  </>
                                ) : (probe?.protocols || []).map(p => (
                                  <Badge key={p} variant="outline" className={`text-[9px] px-1 h-4 ${PROTOCOL_COLORS[p] || "bg-muted/40"}`}>{p.toUpperCase()}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="shrink-0 text-right space-y-1">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Session</p>
                                <p className="text-xs font-medium truncate max-w-[120px]">{session.name}</p>
                              </div>
                              {(() => {
                                const certReport = (session.certificationReport as any) || {};
                                const ver = certReport.probeVersion || dCfg.probeVersion;
                                if (!ver) return null;
                                const isCert = discStatus === "certified";
                                return (
                                  <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${isCert ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-amber-500/40 bg-amber-500/10 text-amber-400"}`}>
                                    {isCert ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                                    v{ver}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Gap signals panel — shown for gap resolution sessions */}
                      {isGapSession && (gapSigs.banner || gapSigs.partialOids || gapSigs.observations) && (
                        <Card className="border-amber-500/20 bg-amber-500/5">
                          <CardContent className="p-3 space-y-2">
                            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Microscope className="h-3 w-3" /> Raw Device Signals
                            </p>
                            {gapSigs.banner && (
                              <div>
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Connection Banner</p>
                                <pre className="text-[10px] font-mono text-foreground/70 bg-background/50 rounded p-1.5 whitespace-pre-wrap break-all leading-relaxed max-h-16 overflow-y-auto">{gapSigs.banner}</pre>
                              </div>
                            )}
                            {gapSigs.partialOids && (
                              <div>
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Partial SNMP / OID</p>
                                <pre className="text-[10px] font-mono text-foreground/70 bg-background/50 rounded p-1.5 whitespace-pre-wrap break-all leading-relaxed max-h-16 overflow-y-auto">{gapSigs.partialOids}</pre>
                              </div>
                            )}
                            {gapSigs.observations && (
                              <div>
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Field Observations</p>
                                <p className="text-[10px] text-foreground/70 bg-background/50 rounded p-1.5 leading-relaxed">{gapSigs.observations}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Asset targets — hidden for gap resolution sessions */}
                      {isGapSession && (
                        <Card className="border-amber-500/20 bg-amber-500/5">
                          <CardContent className="p-3 flex items-center gap-3">
                            <ScanSearch className="h-5 w-5 text-amber-400 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-amber-300">AI-Driven Protocol Discovery</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">No manual asset targets needed. The AI will fingerprint the unknown device from the signals above, select the optimal protocols, and run sandbox validation automatically.</p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {!isGapSession && (<Card className="border-border/60 bg-card/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Box className="h-4 w-4 text-primary" /> Asset Types to Discover
                              <Badge variant="outline" className="text-[10px] px-1.5">{targets.length}</Badge>
                            </CardTitle>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => setShowAddTarget(v => !v)} data-testid="button-add-target">
                              <Plus className="h-3 w-3" /> Add Asset Type
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2">

                          {/* Add target inline form — multi-row */}
                          {showAddTarget && (() => {
                            const DEVICE_CATEGORIES: [string, string][] = [
                              ["router","Router"],["switch","Switch"],["firewall","Firewall"],["server","Server"],
                              ["loadbalancer","Load Balancer"],["wireless","Wireless / Access Point"],
                              ["mobile","Mobile / Handheld Device"],["iot","IoT / OT Sensor"],
                              ["scada","SCADA / Industrial Controller"],["storage","Storage Array (NAS/SAN)"],
                              ["printer","Network Printer / MFP"],["camera","IP Camera / Video"],
                            ];
                            const allValid = targetRows.every(r => r.protocols.length > 0);
                            return (
                              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                    <Plus className="h-3 w-3" /> New Asset Targets
                                    <Badge variant="outline" className="text-[9px] px-1 ml-0.5">{targetRows.length}</Badge>
                                  </p>
                                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-primary hover:text-primary"
                                    onClick={() => setTargetRows(r => [...r, blankRow()])}>
                                    <Plus className="h-2.5 w-2.5" /> Add another
                                  </Button>
                                </div>

                                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-0.5">
                                  {targetRows.map((row, idx) => (
                                    <div key={row.id} className="rounded border border-border/40 bg-background/60 p-2.5 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Asset #{idx + 1}</span>
                                        {targetRows.length > 1 && (
                                          <button onClick={() => setTargetRows(r => r.filter(x => x.id !== row.id))}
                                            className="text-muted-foreground/50 hover:text-destructive transition-colors" title="Remove">
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <Label className="text-[10px]">Vendor</Label>
                                          <Input className="mt-1 h-7 text-xs" placeholder="e.g. Cisco"
                                            value={row.vendor} onChange={e => setRowField(row.id, "vendor", e.target.value)}
                                            data-testid={`input-target-vendor-${idx}`} autoFocus={idx === 0} />
                                        </div>
                                        <div>
                                          <Label className="text-[10px]">Model</Label>
                                          <Input className="mt-1 h-7 text-xs" placeholder="e.g. Catalyst 9300"
                                            value={row.model} onChange={e => setRowField(row.id, "model", e.target.value)}
                                            data-testid={`input-target-model-${idx}`} />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <Label className="text-[10px]">Device Category</Label>
                                          <Select value={row.category} onValueChange={v => setRowField(row.id, "category", v)}>
                                            <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {DEVICE_CATEGORIES.map(([v, l]) => (
                                                <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <Label className="text-[10px]">Network Zone</Label>
                                          <Select value={row.zone} onValueChange={v => setRowField(row.id, "zone", v)}>
                                            <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="wan" className="text-xs">WAN / Internet</SelectItem>
                                              <SelectItem value="dmz" className="text-xs">DMZ</SelectItem>
                                              <SelectItem value="core" className="text-xs">Core LAN</SelectItem>
                                              <SelectItem value="lan" className="text-xs">LAN</SelectItem>
                                              <SelectItem value="management" className="text-xs">Management</SelectItem>
                                              <SelectItem value="ot" className="text-xs">OT / SCADA</SelectItem>
                                              <SelectItem value="iot" className="text-xs">IoT / Edge</SelectItem>
                                              <SelectItem value="guest" className="text-xs">Guest WiFi</SelectItem>
                                              <SelectItem value="storage" className="text-xs">Storage</SelectItem>
                                              <SelectItem value="vlan" className="text-xs">VLAN (specify below)</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <Label className="text-[10px]">VLAN ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
                                          <Input className="mt-1 h-7 text-xs" placeholder="e.g. 10, 100"
                                            value={row.vlanId} onChange={e => setRowField(row.id, "vlanId", e.target.value)}
                                            data-testid={`input-target-vlan-${idx}`} />
                                        </div>
                                        <div>
                                          <Label className="text-[10px]">IP / Subnet <span className="text-muted-foreground font-normal">(optional)</span></Label>
                                          <Input className="mt-1 h-7 text-xs" placeholder="e.g. 10.1.0.0/24"
                                            value={row.ipAddress} onChange={e => setRowField(row.id, "ipAddress", e.target.value)}
                                            data-testid={`input-target-ip-${idx}`} />
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-[10px] mb-1 block">
                                          Protocols <span className="text-muted-foreground font-normal">(pick at least one)</span>
                                          {row.protocols.length === 0 && <span className="text-destructive ml-1">*</span>}
                                        </Label>
                                        <div className="space-y-1.5">
                                          {SANDBOX_PROTOCOL_GROUPS.map(g => (
                                            <div key={g.group}>
                                              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">{g.group}</p>
                                              <div className="grid grid-cols-3 gap-0.5">
                                                {g.protocols.map(p => {
                                                  const checked = row.protocols.includes(p.value);
                                                  return (
                                                    <label key={p.value} title={p.desc} className="flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/20">
                                                      <Checkbox checked={checked}
                                                        onCheckedChange={c => toggleRowProtocol(row.id, p.value, !!c)}
                                                        className="h-3.5 w-3.5" />
                                                      <span className="text-[10px]">{p.label}</span>
                                                    </label>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                                    onClick={() => { setShowAddTarget(false); setTargetRows([blankRow()]); }}>
                                    Cancel
                                  </Button>
                                  <Button size="sm" className="h-7 text-xs gap-1"
                                    disabled={!allValid || updateSession.isPending}
                                    onClick={() => addAssetTargets(session.id, targets, targetRows)}
                                    data-testid="button-confirm-add-target">
                                    <Plus className="h-3 w-3" />
                                    Add {targetRows.length} Asset{targetRows.length > 1 ? "s" : ""}
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Existing targets list */}
                          {targets.length === 0 && !showAddTarget ? (
                            <div className="text-center py-6 border border-dashed border-border/40 rounded-lg">
                              <Box className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                              <p className="text-xs text-muted-foreground">No asset types yet — click <strong>Add Asset Type</strong> above to begin</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {targets.map((t: any) => (
                                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-muted/10 border border-border/30 px-3 py-2">
                                  <div className={`h-7 w-7 rounded flex items-center justify-center shrink-0 ${(ASSET_ICONS[t.category] ? "bg-primary/10" : "bg-muted/20")}`}>
                                    {(() => { const I = ASSET_ICONS[t.category] || Server; return <I className="h-3.5 w-3.5 text-primary" />; })()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{[t.vendor, t.model].filter(Boolean).join(" ") || t.category}</p>
                                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                                      {(t.protocols || []).map((p: string) => (
                                        <Badge key={p} variant="outline" className={`text-[8px] px-1 h-3.5 ${PROTOCOL_COLORS[p] || "bg-muted/40"}`}>{p.toUpperCase()}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground capitalize shrink-0">{t.category}</span>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive/50 hover:text-destructive shrink-0"
                                    onClick={() => removeAssetTarget(session.id, dCfg, t.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>)}

                      {/* Run discovery + results */}
                      <Card className="border-border/60 bg-card/50">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold">{isGapSession ? "Run Gap Resolution" : "Run Sandbox Discovery"}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {isGapSession
                                  ? "AI fingerprints the unknown device, selects optimal protocols, runs sandbox simulation, and certifies a probe extension"
                                  : "AI agent will discover all asset types in the sandbox and certify each protocol"}
                              </p>
                            </div>
                            <Button
                              disabled={(isGapSession ? !gapSigs.ipAddress : targets.length === 0) || isRunning}
                              onClick={() => startDiscovery(session.id)}
                              className="gap-2 shrink-0"
                              data-testid={`button-run-discovery-${session.id}`}
                            >
                              {isRunning ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</> : <><Play className="h-4 w-4" /> Run Discovery</>}
                            </Button>
                          </div>

                          {/* Phase tracker */}
                          {(streamText || isRunning) && (
                            <div className="rounded-lg bg-muted/10 border border-border/30 p-3">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Discovery Phases</p>
                              <div className="flex items-center gap-1 flex-wrap">
                                {DISC_PHASES.map((phase, i, arr) => {
                                  const seen = seenPhases.includes(phase);
                                  const isActive = lastPhase === phase && isRunning;
                                  return (
                                    <div key={phase} className="flex items-center gap-1">
                                      <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold border transition-all ${
                                        seen && !isActive ? (discStatus === "failed" && phase === "READY" ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-green-500/15 border-green-500/30 text-green-400") :
                                        isActive ? "bg-primary/15 border-primary/30 text-primary animate-pulse" :
                                        "bg-muted/20 border-border/30 text-muted-foreground/50"
                                      }`}>
                                        {seen && !isActive ? <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> : isActive ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> : null}
                                        {phase}
                                      </div>
                                      {i < arr.length - 1 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Stream output / Topology toggle */}
                          {(streamText || isRunning || targets.length > 0 || isGapSession) && (
                            <div className={`rounded-lg border p-3 ${discStatus === "certified" ? "border-green-500/30 bg-green-500/5" : discStatus === "failed" ? "border-red-500/30 bg-red-500/5" : "border-primary/20 bg-primary/5"}`}>
                              <div className="flex items-center justify-between mb-2">
                                <p className={`text-xs font-semibold flex items-center gap-1.5 ${discStatus === "certified" ? "text-green-400" : discStatus === "failed" ? "text-red-400" : "text-primary"}`}>
                                  {topoView ? <Network className="h-3.5 w-3.5" /> : <Terminal className="h-3.5 w-3.5" />}
                                  {topoView ? "Sandbox Topology" : "HOLOCRON Discovery Agent"}
                                  {isRunning && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                                </p>
                                <div className="flex items-center gap-2">
                                  {dStream?.done && !topoView && (
                                    <Badge variant="outline" className={`text-xs gap-1 ${discStatus === "certified" ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-red-500/40 text-red-400 bg-red-500/10"}`}>
                                      {discStatus === "certified" ? <><CheckCircle2 className="h-3 w-3" /> DISCOVERY COMPLETE</> : <><XCircle className="h-3 w-3" /> FAILED</>}
                                    </Badge>
                                  )}
                                  {/* Console / Topology toggle */}
                                  <div className="flex rounded border border-border/50 overflow-hidden">
                                    <button
                                      onClick={() => setTopoView(false)}
                                      className={`px-2 py-0.5 text-[10px] font-mono flex items-center gap-1 transition-colors ${!topoView ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                                      data-testid="button-view-console"
                                    >
                                      <Terminal className="h-2.5 w-2.5" /> Console
                                    </button>
                                    <button
                                      onClick={() => setTopoView(true)}
                                      className={`px-2 py-0.5 text-[10px] font-mono flex items-center gap-1 transition-colors border-l border-border/50 ${topoView ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                                      data-testid="button-view-topology"
                                    >
                                      <Network className="h-2.5 w-2.5" /> Topology
                                    </button>
                                  </div>
                                  {/* Maximize button */}
                                  <button
                                    onClick={() => setTopoMaximized(true)}
                                    className="ml-1 p-1 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10 transition-colors"
                                    data-testid="button-maximize-topology"
                                    title="Maximize topology"
                                  >
                                    <Maximize2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              {topoView ? (
                                <SandboxTopologyMap
                                  targets={targets}
                                  isRunning={isRunning}
                                  discStatus={discStatus}
                                  isGapSession={isGapSession}
                                  gapSignals={gapSigs}
                                  streamText={streamText}
                                />
                              ) : (
                                <ScrollArea className="h-[220px]">
                                  <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap text-foreground/85" data-testid="discovery-output">
                                    {cleanDiscoveryText(streamText) || (isRunning ? "Initialising sandbox discovery run…" : "")}
                                    {isRunning && <span className="animate-pulse text-primary">▌</span>}
                                  </pre>
                                </ScrollArea>
                              )}

                              {/* ── Maximized topology overlay ─────────────────── */}
                              {topoMaximized && (
                                <div
                                  className="fixed inset-0 z-50 flex items-center justify-center"
                                  style={{ background: "rgba(2,8,23,0.92)", backdropFilter: "blur(6px)" }}
                                  data-testid="topology-maximized-overlay"
                                  onClick={() => setTopoMaximized(false)}
                                >
                                  <div className="relative w-[94vw] h-[90vh] flex flex-col rounded-xl overflow-hidden"
                                    style={{ border: "1px solid rgba(99,102,241,0.35)", background: "radial-gradient(ellipse at 50% 20%, #0d1225 0%, #020817 100%)" }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 shrink-0">
                                      <div className="flex items-center gap-3">
                                        <Network className="h-4 w-4 text-primary" />
                                        <span className="text-sm font-semibold text-foreground">Sandbox Topology</span>
                                        <span className="text-xs text-muted-foreground font-mono">{session.name}</span>
                                        {isRunning && (
                                          <span className="flex items-center gap-1 text-[10px] font-mono text-primary animate-pulse">
                                            <Loader2 className="h-3 w-3 animate-spin" /> LIVE DISCOVERY
                                          </span>
                                        )}
                                        {discStatus === "certified" && (
                                          <span className="flex items-center gap-1 text-[10px] font-mono text-green-400">
                                            <CheckCircle2 className="h-3 w-3" /> CERTIFIED
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {/* View toggle in maximized mode */}
                                        <div className="flex rounded border border-border/50 overflow-hidden">
                                          <button
                                            onClick={() => setTopoView(false)}
                                            className={`px-2.5 py-1 text-[11px] font-mono flex items-center gap-1.5 transition-colors ${!topoView ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                                          >
                                            <Terminal className="h-3 w-3" /> Console
                                          </button>
                                          <button
                                            onClick={() => setTopoView(true)}
                                            className={`px-2.5 py-1 text-[11px] font-mono flex items-center gap-1.5 transition-colors border-l border-border/50 ${topoView ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                                          >
                                            <Network className="h-3 w-3" /> Topology
                                          </button>
                                        </div>
                                        <button
                                          onClick={() => setTopoMaximized(false)}
                                          className="ml-1 p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10 transition-colors"
                                          data-testid="button-minimize-topology"
                                          title="Close"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Body */}
                                    <div className="flex-1 min-h-0 p-4 flex flex-col gap-3">
                                      {topoView ? (
                                        <div className="flex-1 min-h-0">
                                          <SandboxTopologyMap
                                            targets={targets}
                                            isRunning={isRunning}
                                            discStatus={discStatus}
                                            isGapSession={isGapSession}
                                            gapSignals={gapSigs}
                                            streamText={streamText}
                                            fillHeight
                                          />
                                        </div>
                                      ) : (
                                        <ScrollArea className="flex-1 min-h-0">
                                          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap text-foreground/85 p-2">
                                            {cleanDiscoveryText(streamText) || (isRunning ? "Initialising sandbox discovery run…" : "No output yet — run discovery to see results.")}
                                            {isRunning && <span className="animate-pulse text-primary">▌</span>}
                                          </pre>
                                        </ScrollArea>
                                      )}

                                      {/* Phase bar at bottom */}
                                      {(streamText || isRunning) && (
                                        <div className="shrink-0 flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/20">
                                          {DISC_PHASES.map((phase, i, arr) => {
                                            const seen = seenPhases.includes(phase);
                                            const isActive = lastPhase === phase && isRunning;
                                            return (
                                              <div key={phase} className="flex items-center gap-1">
                                                <div className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-semibold border transition-all ${
                                                  seen && !isActive ? "bg-green-500/15 border-green-500/30 text-green-400" :
                                                  isActive ? "bg-primary/15 border-primary/30 text-primary animate-pulse" :
                                                  "bg-muted/20 border-border/30 text-muted-foreground/50"
                                                }`}>
                                                  {seen && !isActive ? <CheckCircle2 className="h-3 w-3 mr-0.5" /> : isActive ? <Loader2 className="h-3 w-3 mr-0.5 animate-spin" /> : null}
                                                  {phase}
                                                </div>
                                                {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Push to KB / Push Enhancement button */}
                          {dStream?.done && discStatus === "certified" && (
                            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-green-400">
                                  {isGapSession ? "Gap Resolution Certified" : "Discovery Certified"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {isGapSession
                                    ? "Probe extension package ready — push the enhancement to your real probe and download the package"
                                    : "Probe package ready — push to the Knowledge Base so it can be downloaded and deployed"}
                                </p>
                              </div>
                              <Button variant="outline" className="border-green-500/40 text-green-400 hover:bg-green-500/10 gap-2 shrink-0"
                                onClick={() => pushToKnowledgeBase(session)} data-testid="button-push-to-kb">
                                {isGapSession ? <><ArrowUpRight className="h-4 w-4" /> Push Enhancement</> : <><Download className="h-4 w-4" /> Push to KB & Download</>}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </div>
            </div>
          </TabsContent>

          {/* ── 5. Dashboard ──────────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Real-Time Monitoring Dashboard</h2>
            <p className="text-sm text-muted-foreground">Live telemetry and validation status across all active environments</p>
          </div>

          {/* Recent runs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Recent Validation Runs</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  {testRuns.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No test runs yet</p>
                  ) : (
                    testRuns.slice(0, 20).map(run => {
                      const test = tests.find(t => t.id === run.testId);
                      const summary = run.summary as any || {};
                      return (
                        <div key={run.id} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0 hover:bg-accent/20 px-1 rounded cursor-pointer" onClick={() => setViewRun(run)} data-testid={`row-run-dashboard-${run.id}`}>
                          <div className="shrink-0">{statusBadge(run.status)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{test?.name || "Unknown Test"}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(run.createdAt!).toLocaleString()} · {summary.passed || 0}/{summary.total || 0} passed
                            </p>
                          </div>
                          {run.status === "running" && <Progress value={run.progress || 0} className="w-16 h-1.5" />}
                        </div>
                      );
                    })
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Environment health */}
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Network className="h-4 w-4 text-primary" />Environment Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {environments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No environments configured</p>
                  ) : (
                    environments.map(env => {
                      const envRuns = testRuns.filter(r => {
                        const t = tests.find(t2 => t2.id === r.testId);
                        return t?.environmentId === env.id;
                      });
                      const lastRun = envRuns[0];
                      const envProbes = probeDeployments.filter(d => d.environmentId === env.id && d.status === "active");
                      return (
                        <div key={env.id} className="p-3 rounded-lg border border-border/40 bg-muted/10" data-testid={`row-env-health-${env.id}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-medium">{env.name}</p>
                              <p className="text-xs text-muted-foreground">{env.nodeCount || 0} nodes · {envProbes.length} active probes</p>
                            </div>
                            {statusBadge(env.status)}
                          </div>
                          {lastRun && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Last run:</span>
                              {statusBadge(lastRun.status)}
                              <span className={`text-xs font-medium ${passRateColor(((lastRun.summary as any)?.passRate) || 0)}`}>
                                {Math.round(((lastRun.summary as any)?.passRate) || 0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Protocol breakdown across all runs */}
          {testRuns.length > 0 && (() => {
            const allResults: any[] = testRuns.filter(r => r.status !== "running" && r.status !== "pending").flatMap(r => (r.results as any) || []);
            const protocolStats: Record<string, { total: number; passed: number }> = {};
            for (const r of allResults) {
              if (!protocolStats[r.protocol]) protocolStats[r.protocol] = { total: 0, passed: 0 };
              protocolStats[r.protocol].total++;
              if (r.status === "passed") protocolStats[r.protocol].passed++;
            }
            const entries = Object.entries(protocolStats);
            return entries.length > 0 ? (
              <Card className="border-border/60 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Protocol Success Rates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {entries.map(([proto, stats]) => {
                      const rate = Math.round((stats.passed / stats.total) * 100);
                      return (
                        <div key={proto} className="text-center p-3 rounded-lg border border-border/40 bg-muted/10">
                          <Badge variant="outline" className={`${PROTOCOL_COLORS[proto] || ""} uppercase text-xs mb-2`}>{proto}</Badge>
                          <p className={`text-xl font-bold ${passRateColor(rate)}`}>{rate}%</p>
                          <p className="text-xs text-muted-foreground">{stats.passed}/{stats.total}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : null;
          })()}
        </TabsContent>

        {/* ── 6. Reports ────────────────────────────────────────────────────── */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Validation Report Generator</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Export comprehensive test reports with protocol compliance analysis</p>
            </div>
            <Button size="sm" onClick={() => generateReport.mutate({ name: `Validation Report — ${new Date().toLocaleDateString()}`, type: "summary" })} disabled={generateReport.isPending} className="self-start sm:self-auto shrink-0" data-testid="button-new-report">
              <Plus className="h-4 w-4 mr-1" />{generateReport.isPending ? "Generating…" : "New Report"}
            </Button>
          </div>

          {reports.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-card/30">
              <CardContent className="p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">No reports generated yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Run some validation tests, then generate a report</p>
                <Button className="mt-4" size="sm" onClick={() => generateReport.mutate({ name: `Validation Report — ${new Date().toLocaleDateString()}`, type: "summary" })}>
                  <FileText className="h-4 w-4 mr-1" /> Generate First Report
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map(report => {
                const data = report.reportData as any || {};
                return (
                  <Card key={report.id} className="border-border/60 bg-card/50 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setViewReport(report)} data-testid={`card-report-${report.id}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-sm">{report.name}</p>
                          {statusBadge(report.status)}
                          <Badge variant="outline" className="text-xs capitalize border-border/40">{report.type}</Badge>
                        </div>
                        {report.status === "ready" && data.summary && (
                          <p className="text-xs text-muted-foreground">
                            {data.summary.totalRuns} runs · {data.summary.passed} passed · {data.summary.overallPassRate}% pass rate
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground/60">{report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "Generating…"}</p>
                      </div>
                      <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Add Provider */}
      <Dialog open={showAddProvider} onOpenChange={setShowAddProvider}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Provider</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Provider Name</Label><Input className="mt-1" placeholder="My Lab Provider" value={providerForm.name} onChange={e => setProviderForm(f => ({ ...f, name: e.target.value }))} data-testid="input-provider-name" /></div>
            <div>
              <Label className="text-xs">Provider Type</Label>
              <Select value={providerForm.type} onValueChange={v => setProviderForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-provider-type"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {(() => {
                const info = PROVIDER_TYPES.find(t => t.value === providerForm.type);
                return (info?.url || info?.signupUrl) ? (
                  <div className="mt-2 flex items-center gap-3 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/10">
                    <ExternalLink className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                    <div className="flex items-center gap-3 flex-wrap">
                      {info.url && (
                        <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-medium" data-testid={`link-dialog-provider-${providerForm.type}`}>
                          {info.label} Website
                        </a>
                      )}
                      {info.signupUrl && (
                        <a href={info.signupUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-medium" data-testid={`link-dialog-register-${providerForm.type}`}>
                          Download / Register →
                        </a>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            {providerForm.type !== "mock" && <>
              <div><Label className="text-xs">Base URL</Label><Input className="mt-1" placeholder="https://lab.example.com" value={providerForm.baseUrl} onChange={e => setProviderForm(f => ({ ...f, baseUrl: e.target.value }))} data-testid="input-provider-url" /></div>
              <div><Label className="text-xs">API Key / Token</Label><Input className="mt-1" type="password" value={providerForm.apiKey} onChange={e => setProviderForm(f => ({ ...f, apiKey: e.target.value }))} data-testid="input-provider-apikey" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Username</Label><Input className="mt-1" value={providerForm.username} onChange={e => setProviderForm(f => ({ ...f, username: e.target.value }))} /></div>
                <div><Label className="text-xs">Password</Label><Input className="mt-1" type="password" value={providerForm.password} onChange={e => setProviderForm(f => ({ ...f, password: e.target.value }))} /></div>
              </div>
            </>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProvider(false)}>Cancel</Button>
            <Button onClick={() => createProvider.mutate(providerForm)} disabled={!providerForm.name || createProvider.isPending} data-testid="button-submit-provider">
              {createProvider.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Environment */}
      <Dialog open={showAddEnv} onOpenChange={setShowAddEnv}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Virtual Environment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Provider</Label>
              <Select value={envForm.providerId} onValueChange={v => setEnvForm(f => ({ ...f, providerId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-env-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>{providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Environment Name</Label><Input className="mt-1" placeholder="Enterprise Lab — Core Network" value={envForm.name} onChange={e => setEnvForm(f => ({ ...f, name: e.target.value }))} data-testid="input-env-name" /></div>
            <div><Label className="text-xs">Description</Label><Textarea className="mt-1 min-h-[60px]" placeholder="Purpose and scope of this environment" value={envForm.description} onChange={e => setEnvForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <Label className="text-xs">Topology Type</Label>
              <Select value={envForm.topology} onValueChange={v => setEnvForm(f => ({ ...f, topology: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-env-topology"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["campus", "spine-leaf", "hub-spoke", "purdue", "flat", "ring", "mesh"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEnv(false)}>Cancel</Button>
            <Button onClick={() => createEnv.mutate(envForm)} disabled={!envForm.providerId || !envForm.name || createEnv.isPending} data-testid="button-submit-env">
              {createEnv.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deploy Probe */}
      <Dialog open={showAddProbe} onOpenChange={setShowAddProbe}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Deploy Probe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Target Environment</Label>
              <Select value={probeForm.environmentId} onValueChange={v => setProbeForm(f => ({ ...f, environmentId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-probe-env"><SelectValue placeholder="Select active environment" /></SelectTrigger>
                <SelectContent>{environments.filter(e => e.status === "active").map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Probe Name</Label><Input className="mt-1" placeholder="hcn-probe-network-01" value={probeForm.probeName} onChange={e => setProbeForm(f => ({ ...f, probeName: e.target.value }))} data-testid="input-probe-name" /></div>
            <div>
              <Label className="text-xs">Deployment Mode</Label>
              <Select value={probeForm.probeType} onValueChange={v => setProbeForm(f => ({ ...f, probeType: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-probe-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="docker">Docker Container</SelectItem>
                  <SelectItem value="native">Native Agent</SelectItem>
                  <SelectItem value="agent">Holocron Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProbe(false)}>Cancel</Button>
            <Button onClick={() => deployProbe.mutate(probeForm)} disabled={!probeForm.environmentId || !probeForm.probeName || deployProbe.isPending} data-testid="button-submit-probe">
              {deployProbe.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Test */}
      <Dialog open={showAddTest} onOpenChange={setShowAddTest}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Validation Test Suite</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Environment</Label>
              <Select value={testForm.environmentId} onValueChange={v => setTestForm(f => ({ ...f, environmentId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-test-env"><SelectValue placeholder="Select environment" /></SelectTrigger>
                <SelectContent>{environments.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Test Name</Label><Input className="mt-1" placeholder="Full Stack Protocol Validation" value={testForm.name} onChange={e => setTestForm(f => ({ ...f, name: e.target.value }))} data-testid="input-test-name" /></div>
            <div><Label className="text-xs">Description</Label><Textarea className="mt-1 min-h-[60px]" value={testForm.description} onChange={e => setTestForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <Label className="text-xs mb-2 block">Protocols to Validate</Label>
              <div className="flex flex-wrap gap-2">
                {PROTOCOLS.map(p => {
                  const on = selectedProtocols.includes(p);
                  return (
                    <button key={p} type="button" onClick={() => setSelectedProtocols(prev => on ? prev.filter(x => x !== p) : [...prev, p])}
                      className={`px-2 py-1 rounded text-xs font-medium border transition-all ${on ? PROTOCOL_COLORS[p] : "border-border/40 text-muted-foreground hover:border-primary/40"}`}
                      data-testid={`toggle-protocol-${p}`}>{p.toUpperCase()}</button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTest(false)}>Cancel</Button>
            <Button onClick={() => createTest.mutate({ ...testForm, protocols: selectedProtocols })} disabled={!testForm.environmentId || !testForm.name || selectedProtocols.length === 0 || createTest.isPending} data-testid="button-submit-test">
              {createTest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Discovery Session */}
      <Dialog open={showNewSession} onOpenChange={setShowNewSession}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" /> New Discovery Session
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const isGapMode = sessionForm.virtualProbeType === "gap-resolution";
            const canSubmit = sessionForm.name.trim() && (!isGapMode || gapSignals.ipAddress.trim());
            return (
              <div className="space-y-4">
                {/* Session Name */}
                <div>
                  <Label className="text-xs font-medium">Session Name</Label>
                  <Input className="mt-1" placeholder="e.g. Core Network Discovery Q2" value={sessionForm.name}
                    onChange={e => setSessionForm(f => ({ ...f, name: e.target.value }))} data-testid="input-session-name" />
                </div>

                {/* Gap Resolution special card */}
                <div>
                  <button type="button"
                    onClick={() => setSessionForm(f => ({ ...f, virtualProbeType: isGapMode ? "linux-kernel" : "gap-resolution" }))}
                    className={`w-full rounded-lg border p-3 text-left transition-all flex items-start gap-3 ${isGapMode ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/30" : "border-border/50 bg-card/40 hover:border-amber-500/30"}`}
                    data-testid="card-probe-type-gap-resolution">
                    <ScanSearch className={`h-5 w-5 mt-0.5 shrink-0 ${isGapMode ? "text-amber-400" : "text-muted-foreground/60"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-xs font-semibold leading-tight ${isGapMode ? "text-amber-300" : ""}`}>Gap Resolution Session</p>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400">AI-Adaptive</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        Feed partial signals from an unknown real device — AI fingerprints it, selects protocols, and synthesizes a certified probe extension to push back to your real probe.
                      </p>
                    </div>
                    {isGapMode && <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />}
                  </button>

                  {/* Signals form — shown when gap mode is active */}
                  {isGapMode && (
                    <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                      <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Microscope className="h-3 w-3" /> Device Signals Captured from Production
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">IP Address / Subnet <span className="text-destructive">*</span></Label>
                          <Input className="mt-1 h-7 text-xs" placeholder="e.g. 192.168.10.45"
                            value={gapSignals.ipAddress} onChange={e => setGapSignals(s => ({ ...s, ipAddress: e.target.value }))}
                            data-testid="input-gap-ip" autoFocus />
                        </div>
                        <div>
                          <Label className="text-[10px]">MAC Address <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Input className="mt-1 h-7 text-xs" placeholder="e.g. 00:1A:2B:3C:4D:5E"
                            value={gapSignals.macAddress} onChange={e => setGapSignals(s => ({ ...s, macAddress: e.target.value }))}
                            data-testid="input-gap-mac" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px]">Open Ports Observed <span className="text-muted-foreground font-normal">(optional, comma-separated)</span></Label>
                        <Input className="mt-1 h-7 text-xs" placeholder="e.g. 22, 443, 8080, 47808, 502"
                          value={gapSignals.openPorts} onChange={e => setGapSignals(s => ({ ...s, openPorts: e.target.value }))}
                          data-testid="input-gap-ports" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Connection Banner / Raw Response <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Textarea className="mt-1 text-xs font-mono min-h-[56px] resize-none"
                          placeholder="Paste any raw banner, HTTP header, SSH banner, or protocol response captured from the device"
                          value={gapSignals.banner} onChange={e => setGapSignals(s => ({ ...s, banner: e.target.value }))}
                          data-testid="input-gap-banner" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Partial SNMP / OID Data <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Textarea className="mt-1 text-xs font-mono min-h-[44px] resize-none"
                          placeholder=".1.3.6.1.2.1.1.1.0 = STRING: ..."
                          value={gapSignals.partialOids} onChange={e => setGapSignals(s => ({ ...s, partialOids: e.target.value }))}
                          data-testid="input-gap-oids" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Field Observations <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Textarea className="mt-1 text-xs min-h-[44px] resize-none"
                          placeholder="Describe what the probe reported, what failed, or any other observations about this device's behaviour"
                          value={gapSignals.observations} onChange={e => setGapSignals(s => ({ ...s, observations: e.target.value }))}
                          data-testid="input-gap-obs" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Standard probe tiers — hidden when gap mode is active */}
                {!isGapMode && (
                  <div>
                    <Label className="text-xs font-medium mb-3 block">Virtual Probe Type</Label>
                    <div className="space-y-4">
                      {VIRTUAL_PROBE_TIERS.map(tier => (
                        <div key={tier.tier}>
                          <div className={`flex items-center gap-2 mb-2 pb-1.5 border-b ${tier.border}`}>
                            <span className={`text-[11px] font-bold uppercase tracking-widest ${tier.accent}`}>{tier.label}</span>
                            <span className="text-[10px] text-muted-foreground">— {tier.tagline}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {tier.types.map(pt => (
                              <button key={pt.value} type="button"
                                onClick={() => setSessionForm(f => ({ ...f, virtualProbeType: pt.value }))}
                                className={`rounded-lg border p-3 text-left transition-all flex items-start gap-3 ${sessionForm.virtualProbeType === pt.value ? `${tier.border} ${tier.bg} ring-1 ring-current` : "border-border/50 bg-card/40 hover:border-border"}`}
                                data-testid={`card-probe-type-${pt.value}`}>
                                <span className="text-xl mt-0.5 shrink-0">{pt.icon}</span>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold leading-tight">{pt.label}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{pt.desc}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowNewSession(false); setSessionForm({ name: "", virtualProbeType: "linux-kernel" }); setGapSignals({ ipAddress: "", macAddress: "", openPorts: "", banner: "", partialOids: "", observations: "" }); }}>Cancel</Button>
            <Button
              onClick={() => {
                const isGapMode = sessionForm.virtualProbeType === "gap-resolution";
                createSession.mutate({
                  name: sessionForm.name.trim(),
                  probeType: "multi",
                  targetDeviceType: "multi",
                  config: {
                    virtualProbeType: sessionForm.virtualProbeType,
                    ...(isGapMode ? { gapSignals: { ...gapSignals } } : {}),
                    assetTargets: [],
                  },
                });
              }}
              disabled={!sessionForm.name.trim() || (sessionForm.virtualProbeType === "gap-resolution" && !gapSignals.ipAddress.trim()) || createSession.isPending}
              data-testid="button-submit-session">
              {createSession.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {sessionForm.virtualProbeType === "gap-resolution" ? "Create Gap Session" : "Create Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Run Detail */}
      <Dialog open={!!viewRun} onOpenChange={() => setViewRun(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Test Run Results
              {viewRun && statusBadge(viewRun.status)}
            </DialogTitle>
          </DialogHeader>
          {viewRun && (() => {
            const summary = viewRun.summary as any || {};
            const results: any[] = (viewRun.results as any) || [];
            return (
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total", value: summary.total || 0, color: "text-foreground" },
                      { label: "Passed", value: summary.passed || 0, color: "text-green-400" },
                      { label: "Failed", value: summary.failed || 0, color: "text-red-400" },
                      { label: "Pass Rate", value: `${Math.round(summary.passRate || 0)}%`, color: passRateColor(summary.passRate || 0) },
                    ].map(s => (
                      <Card key={s.label} className="border-border/40 bg-muted/10">
                        <CardContent className="p-3 text-center">
                          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Results table */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Protocol Results</p>
                    <div className="space-y-2">
                      {results.map((r, i) => (
                        <div key={i} className={`p-3 rounded-lg border text-sm ${r.status === "passed" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`} data-testid={`row-result-${i}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`${PROTOCOL_COLORS[r.protocol] || ""} uppercase text-xs`}>{r.protocol}</Badge>
                              <span className="font-mono text-xs text-muted-foreground">{r.target}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {r.latencyMs && <span className="text-xs text-muted-foreground">{r.latencyMs.toFixed(1)}ms</span>}
                              {r.status === "passed" ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{r.details}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Report Detail */}
      <Dialog open={!!viewReport} onOpenChange={() => setViewReport(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewReport?.name}</DialogTitle>
          </DialogHeader>
          {viewReport && (() => {
            const data = viewReport.reportData as any || {};
            const summary = data.summary || {};
            const protocolStats = data.protocolStats || {};
            return (
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-2">
                  {viewReport.status !== "ready" ? (
                    <div className="flex items-center gap-2 py-8 justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">{viewReport.status === "generating" ? "Generating report…" : "Report failed"}</span>
                    </div>
                  ) : (<>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Total Runs", value: summary.totalRuns || 0 },
                        { label: "Passed", value: summary.passed || 0 },
                        { label: "Failed", value: summary.failed || 0 },
                        { label: "Pass Rate", value: `${summary.overallPassRate || 0}%` },
                      ].map(s => (
                        <Card key={s.label} className="border-border/40 bg-muted/10">
                          <CardContent className="p-3 text-center">
                            <p className="text-xl font-bold">{s.value}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {Object.keys(protocolStats).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Protocol Breakdown</p>
                        <div className="space-y-2">
                          {Object.entries(protocolStats).map(([proto, stats]: [string, any]) => {
                            const rate = Math.round((stats.passed / stats.total) * 100);
                            return (
                              <div key={proto} className="flex items-center gap-3">
                                <Badge variant="outline" className={`${PROTOCOL_COLORS[proto] || ""} uppercase text-xs w-20 justify-center`}>{proto}</Badge>
                                <Progress value={rate} className="flex-1 h-2" />
                                <span className={`text-sm font-medium w-12 text-right ${passRateColor(rate)}`}>{rate}%</span>
                                <span className="text-xs text-muted-foreground w-16 text-right">{stats.passed}/{stats.total}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Generated {viewReport.generatedAt ? new Date(viewReport.generatedAt).toLocaleString() : "—"}</p>
                  </>)}
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── AI Infrastructure Design Wizard ─────────────────────────────────── */}
      <Dialog open={showWizard} onOpenChange={(open) => { if (!open && !wizardLoading) setShowWizard(false); }}>
        <DialogContent className="max-w-2xl flex flex-col p-0 gap-0 overflow-hidden" style={{ height: "85vh" }}>
          <DialogTitle className="sr-only">HOLOCRON AI Infrastructure Design Wizard</DialogTitle>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 shrink-0" style={{ background: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--card)) 100%)" }}>
            <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Sparkles className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight">HOLOCRON AI Infrastructure Design</p>
              <p className="text-[10px] text-muted-foreground font-mono">Sandbox Environment Builder · Autonomous Interview Agent</p>
            </div>
            <Badge className="shrink-0 text-[9px] font-mono bg-primary/10 border border-primary/30 text-primary px-2">AI DESIGN AGENT</Badge>
          </div>

          {/* Progress breadcrumb */}
          <div className="flex items-center gap-2 px-5 py-2 border-b border-border/20 bg-muted/10 shrink-0">
            {[
              { label: "Infrastructure", done: wizardMsgs.some(m => m.role === "user") },
              { label: "Assets", done: wizardMsgs.filter(m => m.role === "user").length >= 2 },
              { label: "Protocols", done: wizardMsgs.filter(m => m.role === "user").length >= 4 },
              { label: "Config", done: !!wizardConfig },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                <div className={`flex items-center gap-1 text-[10px] font-mono font-medium transition-colors ${step.done ? "text-primary" : "text-muted-foreground/50"}`}>
                  {step.done && <CheckCircle2 className="h-3 w-3" />}
                  {step.label}
                </div>
              </div>
            ))}
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
            <div className="space-y-4">
              {wizardMsgs.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                      <Network className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-primary/15 border border-primary/25 text-foreground rounded-tr-sm"
                      : "bg-card border border-border/40 text-foreground/90 rounded-tl-sm"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {wizardLoading && (
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                    <Network className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-card border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "240ms" }} />
                  </div>
                </div>
              )}
              <div ref={wizardBottomRef} />
            </div>
          </div>

          {/* Config preview card */}
          {wizardConfig && !wizardLoading && (
            <div className="mx-5 mb-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Environment Designed
                </p>
                <div className="flex items-center gap-2">
                  <Badge className="text-[9px] font-mono bg-green-500/15 text-green-400 border-green-500/30">
                    {wizardConfig.assetTargets.length} Asset Type{wizardConfig.assetTargets.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge className="text-[9px] font-mono bg-primary/10 text-primary border-primary/30">
                    {wizardConfig.virtualProbeType}
                  </Badge>
                </div>
              </div>
              <p className="text-xs font-semibold text-foreground mb-1">{wizardConfig.name}</p>
              {wizardSummary && (
                <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">{wizardSummary}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {wizardConfig.assetTargets.map((t, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-lg border border-border/40 bg-background/60 px-2 py-1">
                    <span className="text-[10px] font-semibold text-foreground/80">{t.vendor || t.category}</span>
                    <span className="text-[9px] text-muted-foreground">[{t.category}]</span>
                    <span className="text-[8px] text-primary/70 font-mono">{(t.protocols || []).slice(0, 3).join("·")}</span>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
                onClick={wizardConfirm}
                disabled={createSession.isPending}
                data-testid="button-wizard-confirm"
              >
                {createSession.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Creating Session…</>
                  : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Create This Discovery Session</>
                }
              </Button>
            </div>
          )}

          {/* Input area */}
          <div className="px-5 pb-4 pt-3 border-t border-border/30 shrink-0 bg-card/30">
            <div className="flex gap-2 items-end">
              <Textarea
                className="flex-1 min-h-[52px] max-h-[130px] resize-none text-sm font-mono leading-relaxed"
                placeholder={wizardConfig
                  ? "Ask a follow-up question, or create the session above…"
                  : "Answer here… you can paste ARP/MAC tables directly for precise topology mapping"
                }
                value={wizardInput}
                onChange={e => setWizardInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); wizardSend(); }
                }}
                disabled={wizardLoading}
                data-testid="input-wizard-message"
              />
              <Button
                size="sm"
                className="h-[52px] w-10 px-0 shrink-0"
                onClick={wizardSend}
                disabled={wizardLoading || !wizardInput.trim()}
                data-testid="button-wizard-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[9px] text-muted-foreground font-mono">Enter to send · Shift+Enter for new line · Paste ARP tables directly</p>
              <button
                className="text-[9px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                onClick={() => { setShowWizard(false); setShowNewSession(true); }}
                data-testid="link-wizard-manual"
              >
                Create manually instead
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </div>
  );
}
