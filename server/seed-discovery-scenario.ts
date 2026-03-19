import { storage, db } from "./storage";
import { discoveryCredentials, discoveryProbes, agentPerformanceMetrics, agentNotifications, probeTypes, users } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDiscoveryScenario() {
  const [demoUser] = await db.select().from(users).where(eq(users.username, "demo"));
  if (!demoUser) return;

  const existing = await storage.getDiscoveryCredentials(demoUser.id);
  if (existing.length > 0) return;

  console.log("Seeding discovery scenario...");

  const roles = await storage.getOrgRoles();
  const windowsAdmin = roles.find(r => r.name === "Windows System Administrator");
  const linuxAdmin = roles.find(r => r.name === "Linux System Administrator");
  const dbAdmin = roles.find(r => r.name === "Director of Database Administration");
  const networkAdmin = roles.find(r => r.name === "Network Engineer");
  const securityAdmin = roles.find(r => r.name === "Network Security Engineer");
  const messagingAdmin = roles.find(r => r.name === "Messaging Administrator");
  const threatVulnAdmin = roles.find(r => r.name === "Vulnerability Management Analyst");
  const penTestAdmin = roles.find(r => r.name === "Penetration Tester");
  const complianceAdmin = roles.find(r => r.name === "Continuous Compliance Monitor");

  const agentRoles = [windowsAdmin, linuxAdmin, dbAdmin, networkAdmin, securityAdmin, messagingAdmin, threatVulnAdmin, penTestAdmin, complianceAdmin];
  for (const role of agentRoles) {
    if (!role) continue;
    const existingSub = await storage.getSubscriptionByRoleId(role.id);
    if (!existingSub) {
      await storage.createRoleSubscription({
        roleId: role.id,
        userId: demoUser.id,
        isActive: true,
        assignedHumanName: null,
        assignedHumanEmail: null,
        hasAiShadow: true,
      });
    } else if (!existingSub.hasAiShadow) {
      await storage.updateRoleSubscription(existingSub.id, { hasAiShadow: true });
    }
  }

  const creds = await Promise.all([
    storage.createDiscoveryCredential({
      name: "Core Router SNMP v2c",
      protocol: "snmp_v2c",
      host: "10.0.1.0/24",
      port: 161,
      authType: "community_string",
      status: "verified",
      userId: demoUser.id,
    }),
    storage.createDiscoveryCredential({
      name: "Firewall SNMP v3",
      protocol: "snmp_v3",
      host: "10.0.2.0/24",
      port: 161,
      authType: "username_password",
      status: "verified",
      userId: demoUser.id,
    }),
    storage.createDiscoveryCredential({
      name: "Linux Server SSH",
      protocol: "ssh",
      host: "10.0.10.0/24",
      port: 22,
      authType: "certificate",
      status: "verified",
      userId: demoUser.id,
    }),
    storage.createDiscoveryCredential({
      name: "Windows Domain WMI",
      protocol: "wmi",
      host: "10.0.20.0/24",
      port: 135,
      authType: "username_password",
      status: "verified",
      userId: demoUser.id,
    }),
    storage.createDiscoveryCredential({
      name: "Cloud Platform API",
      protocol: "api",
      host: "api.cloudplatform.internal",
      port: 443,
      authType: "api_key",
      status: "verified",
      userId: demoUser.id,
    }),
    storage.createDiscoveryCredential({
      name: "IoT Sensor Gateway LoRaWAN",
      protocol: "lorawan",
      host: "10.0.50.1",
      port: 1700,
      authType: "psk",
      status: "configured",
      userId: demoUser.id,
    }),
    storage.createDiscoveryCredential({
      name: "Building HVAC BACnet",
      protocol: "bacnet",
      host: "10.0.60.0/24",
      port: 47808,
      authType: "token",
      status: "verified",
      userId: demoUser.id,
    }),
    storage.createDiscoveryCredential({
      name: "Industrial PLC Modbus",
      protocol: "modbus",
      host: "10.0.70.0/24",
      port: 502,
      authType: "username_password",
      status: "failed",
      userId: demoUser.id,
    }),
  ]);

  const probes = await Promise.all([
    storage.createDiscoveryProbe({
      name: "Network Infrastructure Scanner",
      description: "SNMP-based discovery of routers, switches, and network equipment across core and edge networks",
      protocol: "snmp_v2c",
      credentialId: creds[0].id,
      scanSubnet: "10.0.1.0/24",
      scanSchedule: "*/30 * * * *",
      status: "completed",
      discoveredCount: 6,
      assignedAgentRoleId: networkAdmin?.id,
      userId: demoUser.id,
    }),
    storage.createDiscoveryProbe({
      name: "Firewall & Security Appliance Scanner",
      description: "SNMPv3 secure discovery of firewalls, IDS/IPS, and security gateways",
      protocol: "snmp_v3",
      credentialId: creds[1].id,
      scanSubnet: "10.0.2.0/24",
      scanSchedule: "0 */2 * * *",
      status: "completed",
      discoveredCount: 5,
      assignedAgentRoleId: securityAdmin?.id,
      userId: demoUser.id,
    }),
    storage.createDiscoveryProbe({
      name: "Linux Server Farm Discovery",
      description: "SSH-based discovery and inventory of Linux servers in the data center",
      protocol: "ssh",
      credentialId: creds[2].id,
      scanSubnet: "10.0.10.0/24",
      scanSchedule: "0 */4 * * *",
      status: "completed",
      discoveredCount: 4,
      assignedAgentRoleId: linuxAdmin?.id,
      userId: demoUser.id,
    }),
    storage.createDiscoveryProbe({
      name: "Windows Domain Scanner",
      description: "WMI-based discovery of Windows servers and workstations in the Active Directory domain",
      protocol: "wmi",
      credentialId: creds[3].id,
      scanSubnet: "10.0.20.0/24",
      scanSchedule: "0 */6 * * *",
      status: "completed",
      discoveredCount: 3,
      assignedAgentRoleId: windowsAdmin?.id,
      userId: demoUser.id,
    }),
    storage.createDiscoveryProbe({
      name: "IoT Sensor Array",
      description: "LoRaWAN gateway discovery of IoT sensors including temperature, humidity, and environmental monitors",
      protocol: "lorawan",
      credentialId: creds[5].id,
      scanSubnet: "10.0.50.0/24",
      scanSchedule: "0 */1 * * *",
      status: "completed",
      discoveredCount: 4,
      assignedAgentRoleId: securityAdmin?.id,
      userId: demoUser.id,
    }),
    storage.createDiscoveryProbe({
      name: "Building Automation Systems",
      description: "BACnet/Modbus discovery of HVAC controllers, PLCs, and building management devices",
      protocol: "bacnet",
      credentialId: creds[6].id,
      scanSubnet: "10.0.60.0/24",
      scanSchedule: "0 */8 * * *",
      status: "idle",
      discoveredCount: 3,
      assignedAgentRoleId: securityAdmin?.id,
      userId: demoUser.id,
    }),
  ]);

  const assets = [
    { probeId: probes[0].id, name: "CORE-SW-01", type: "switch", vendor: "Cisco", model: "Catalyst 9300-48UXM", ipAddress: "10.0.1.10", macAddress: "00:1A:2B:3C:4D:01", firmware: "IOS-XE 17.9.4", status: "online", protocol: "snmp_v2c", assignedAgentRoleId: networkAdmin?.id, metadata: {
      hardware: { cpu: "ARM Cortex-A72 1.2GHz", ram: "16 GB DDR4", flash: "16 GB", asic: "UADP 2.0", fans: 3, psu: "Dual 1100W Platinum", serialNumber: "FCW2451P0GH", formFactor: "1RU", weight: "8.6 kg", powerDraw: "185W avg / 740W max PoE" },
      software: { os: "IOS-XE", version: "17.9.4", bootloader: "ROMMON 16.12(2r)", licenseLevel: "Network Advantage", dnaLicense: "DNA Advantage 5Y", uptime: "342 days 14:22:38", lastPatched: "2025-11-15", configBackup: "2026-03-01" },
      network: { interfaces: [
        { name: "GigabitEthernet1/0/1-24", type: "1GbE PoE+", status: "active", bandwidth: "1 Gbps", utilization: "34%", vlan: "10,20,30" },
        { name: "TenGigabitEthernet1/1/1", type: "10GbE SFP+", status: "active", bandwidth: "10 Gbps", utilization: "62%", vlan: "trunk" },
        { name: "TenGigabitEthernet1/1/2", type: "10GbE SFP+", status: "active", bandwidth: "10 Gbps", utilization: "48%", vlan: "trunk" },
        { name: "Mgmt0", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "2%", vlan: "999" }
      ], vlans: 24, portCount: 48, poeCapable: true, stpMode: "Rapid-PVST+", routingProtocol: "OSPF Area 0", macTableSize: 1247 },
      security: { kpis: { patchCompliance: 94, configCompliance: 97, uptimeSla: 99.98, mttr: "12 min", lastAudit: "2026-02-10" }, accessControl: "TACACS+ / 802.1X", portSecurity: "Enabled on access ports", dhcpSnooping: true, arpInspection: true, stormControl: "Broadcast <10%" },
      vulnerabilities: [
        { cve: "CVE-2025-20188", severity: "High", description: "IOS XE Web UI privilege escalation", status: "Patched", patchedDate: "2025-11-15" },
        { cve: "CVE-2025-20198", severity: "Medium", description: "SNMP information disclosure", status: "Mitigated", mitigation: "SNMPv3 migration planned" }
      ],
      penTesting: { whitebox: { lastTest: "2026-01-20", result: "Pass", findings: 1, criticalFindings: 0 }, graybox: { lastTest: "2025-10-05", result: "Pass with observations", findings: 3, criticalFindings: 0 }, blackbox: { lastTest: "2025-08-12", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "STP Root Bridge (VLAN 10-30)", criticality: "High" }, { name: "DHCP Relay", criticality: "Medium" }, { name: "NetFlow Exporter", criticality: "Low" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "1.2, 1.3, 6.1, 11.5" }, { framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC6.6" }, { framework: "NIST 800-53", status: "Compliant", controls: "AC-4, SC-7, SI-4" }]
    } },
    { probeId: probes[0].id, name: "CORE-SW-02", type: "switch", vendor: "Cisco", model: "Catalyst 9500-24Y4C", ipAddress: "10.0.1.11", macAddress: "00:1A:2B:3C:4D:02", firmware: "IOS-XE 17.9.4", status: "online", protocol: "snmp_v2c", assignedAgentRoleId: networkAdmin?.id, metadata: {
      hardware: { cpu: "x86 Intel 2.4GHz", ram: "32 GB DDR4", flash: "32 GB", asic: "UADP 3.0", fans: 4, psu: "Dual 1600W Platinum", serialNumber: "FCW2452Q1KL", formFactor: "1RU", weight: "10.2 kg", powerDraw: "210W avg" },
      software: { os: "IOS-XE", version: "17.9.4", licenseLevel: "Network Advantage", dnaLicense: "DNA Advantage 7Y", uptime: "186 days 09:15:22", lastPatched: "2025-12-20", configBackup: "2026-03-02" },
      network: { interfaces: [
        { name: "TwentyFiveGigE1/0/1-24", type: "25GbE SFP28", status: "active", bandwidth: "25 Gbps", utilization: "41%", vlan: "trunk" },
        { name: "HundredGigE1/0/25-28", type: "100GbE QSFP28", status: "active", bandwidth: "100 Gbps", utilization: "28%", vlan: "trunk" },
        { name: "Mgmt0", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "1%", vlan: "999" }
      ], vlans: 32, portCount: 28, stackMember: true, stpMode: "MST", routingProtocol: "OSPF/BGP", macTableSize: 3842 },
      security: { kpis: { patchCompliance: 98, configCompliance: 99, uptimeSla: 99.99, mttr: "8 min", lastAudit: "2026-02-10" }, accessControl: "TACACS+", macsec: "Enabled on uplinks" },
      vulnerabilities: [{ cve: "CVE-2025-20198", severity: "Medium", description: "SNMP information disclosure", status: "Open", mitigation: "Scheduled for Q2 maintenance" }],
      penTesting: { whitebox: { lastTest: "2026-01-20", result: "Pass", findings: 0, criticalFindings: 0 }, graybox: { lastTest: "2025-10-05", result: "Pass", findings: 1, criticalFindings: 0 }, blackbox: { lastTest: "2025-08-12", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "Core Routing / L3 Aggregation", criticality: "Critical" }, { name: "VXLAN EVPN Fabric", criticality: "Critical" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "1.2, 1.3, 6.1" }, { framework: "ISO 27001", status: "Compliant", controls: "A.13.1, A.13.2" }, { framework: "NIST 800-53", status: "Compliant", controls: "AC-4, SC-7" }]
    } },
    { probeId: probes[0].id, name: "DIST-SW-01", type: "switch", vendor: "Arista", model: "7050X3-48YC12", ipAddress: "10.0.1.20", macAddress: "00:1A:2B:3C:4D:03", firmware: "EOS 4.30.1F", status: "online", protocol: "snmp_v2c", assignedAgentRoleId: networkAdmin?.id, metadata: {
      hardware: { cpu: "Intel Xeon D-1500 2.2GHz", ram: "32 GB DDR4", flash: "32 GB SSD", asic: "Memory-Only", fans: 5, psu: "Dual 750W", serialNumber: "SSN24510887", formFactor: "1RU", weight: "9.1 kg", powerDraw: "195W avg" },
      software: { os: "Arista EOS", version: "4.30.1F", uptime: "412 days 02:44:11", lastPatched: "2025-10-08", configBackup: "2026-03-03" },
      network: { interfaces: [
        { name: "Ethernet1-48", type: "25GbE SFP28", status: "active", bandwidth: "25 Gbps", utilization: "55%", vlan: "trunk" },
        { name: "Ethernet49-60", type: "100GbE QSFP28", status: "active", bandwidth: "100 Gbps", utilization: "32%", vlan: "trunk" }
      ], vlans: 16, portCount: 60, layer3Capable: true, routingProtocol: "BGP EVPN", ecmp: true, bufferSize: "32 MB" },
      security: { kpis: { patchCompliance: 88, configCompliance: 95, uptimeSla: 99.97, mttr: "15 min", lastAudit: "2026-01-28" }, accessControl: "TACACS+", aclEntries: 248 },
      vulnerabilities: [{ cve: "CVE-2025-0128", severity: "Low", description: "EOS LLDP remote info leak", status: "Accepted Risk", mitigation: "LLDP restricted to management VLAN" }],
      penTesting: { whitebox: { lastTest: "2026-01-20", result: "Pass", findings: 2, criticalFindings: 0 }, graybox: { lastTest: "2025-09-15", result: "Pass", findings: 1, criticalFindings: 0 }, blackbox: { lastTest: "2025-07-20", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "Distribution Layer Routing", criticality: "High" }, { name: "VXLAN Leaf Node", criticality: "High" }],
      compliance: [{ framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC6.6, CC7.1" }, { framework: "NIST 800-53", status: "Compliant", controls: "SC-7, AC-4" }]
    } },
    { probeId: probes[0].id, name: "ACCESS-SW-01", type: "switch", vendor: "Juniper", model: "EX4300-48MP", ipAddress: "10.0.1.30", macAddress: "00:1A:2B:3C:4D:04", firmware: "Junos 22.4R2", status: "online", protocol: "snmp_v2c", assignedAgentRoleId: networkAdmin?.id, metadata: {
      hardware: { cpu: "PowerPC e500mc 1.5GHz", ram: "4 GB DDR3", flash: "8 GB", fans: 2, psu: "Dual 715W PoE++", serialNumber: "PE0219090345", formFactor: "1RU", weight: "6.4 kg", powerDraw: "120W avg / 630W max PoE" },
      software: { os: "Junos OS", version: "22.4R2", uptime: "98 days 17:33:05", lastPatched: "2025-12-01", configBackup: "2026-03-01" },
      network: { interfaces: [
        { name: "ge-0/0/0-47", type: "1GbE PoE++", status: "active", bandwidth: "1 Gbps", utilization: "28%", vlan: "10,20" },
        { name: "xe-0/2/0-3", type: "10GbE SFP+", status: "active", bandwidth: "10 Gbps", utilization: "44%", vlan: "trunk" }
      ], vlans: 8, portCount: 52, virtualChassis: true, stpMode: "RSTP", routingProtocol: "Static", macTableSize: 682 },
      security: { kpis: { patchCompliance: 91, configCompliance: 93, uptimeSla: 99.95, mttr: "18 min", lastAudit: "2026-02-05" }, accessControl: "RADIUS / 802.1X", portSecurity: "MAC limit 3/port" },
      vulnerabilities: [{ cve: "CVE-2025-21590", severity: "Medium", description: "Junos kernel memory disclosure", status: "Patched", patchedDate: "2025-12-01" }],
      penTesting: { whitebox: { lastTest: "2026-01-20", result: "Pass", findings: 1, criticalFindings: 0 }, graybox: { lastTest: "2025-10-10", result: "Pass", findings: 2, criticalFindings: 0 }, blackbox: { lastTest: "2025-08-01", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "End-User Access Layer", criticality: "Medium" }, { name: "VoIP Phone Support (PoE)", criticality: "High" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "1.2, 1.3" }, { framework: "HIPAA", status: "Compliant", controls: "164.312(e)(1)" }]
    } },
    { probeId: probes[0].id, name: "WIFI-AP-01", type: "access_point", vendor: "Aruba", model: "AP-635 (Wi-Fi 6E)", ipAddress: "10.0.1.40", macAddress: "00:1A:2B:3C:4D:05", firmware: "ArubaOS 10.4.0.3", status: "online", protocol: "snmp_v2c", assignedAgentRoleId: networkAdmin?.id, metadata: {
      hardware: { cpu: "Qualcomm IPQ8074 2.2GHz", ram: "2 GB DDR4", flash: "512 MB", radios: "Tri-band (2.4/5/6 GHz)", antennas: "4x4:4 MIMO", psu: "PoE 802.3at (25.5W)", serialNumber: "CNF2J0M03K", formFactor: "Ceiling mount", weight: "0.9 kg", powerDraw: "25.5W PoE" },
      software: { os: "ArubaOS", version: "10.4.0.3", controller: "Aruba Central (Cloud)", uptime: "45 days 08:12:00", lastPatched: "2026-01-18", configBackup: "2026-03-01" },
      network: { interfaces: [
        { name: "2.4 GHz Radio", type: "Wi-Fi 6", status: "active", bandwidth: "574 Mbps", utilization: "38%", vlan: "10" },
        { name: "5 GHz Radio", type: "Wi-Fi 6", status: "active", bandwidth: "2.4 Gbps", utilization: "52%", vlan: "10,20" },
        { name: "6 GHz Radio", type: "Wi-Fi 6E", status: "active", bandwidth: "4.8 Gbps", utilization: "15%", vlan: "20" },
        { name: "Eth0 (Uplink)", type: "2.5GbE", status: "active", bandwidth: "2.5 Gbps", utilization: "41%", vlan: "trunk" }
      ], ssidCount: 4, connectedClients: 47, band: "Wi-Fi 6E", channelWidth: "80/160 MHz" },
      security: { kpis: { patchCompliance: 100, configCompliance: 96, uptimeSla: 99.9, mttr: "5 min", lastAudit: "2026-02-15" }, encryption: "WPA3-Enterprise (192-bit)", rogueApDetection: true, wids: true },
      vulnerabilities: [],
      penTesting: { whitebox: { lastTest: "2026-02-01", result: "Pass", findings: 0, criticalFindings: 0 }, graybox: { lastTest: "2025-11-10", result: "Pass", findings: 1, criticalFindings: 0 }, blackbox: { lastTest: "2025-09-01", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "Corporate Wireless (CORP-WIFI)", criticality: "High" }, { name: "Guest Network (GUEST)", criticality: "Low" }, { name: "IoT SSID (IOT-NET)", criticality: "Medium" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "1.2, 2.1, 4.1" }, { framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1" }]
    } },
    { probeId: probes[0].id, name: "WIFI-AP-02", type: "access_point", vendor: "Aruba", model: "AP-635 (Wi-Fi 6E)", ipAddress: "10.0.1.41", macAddress: "00:1A:2B:3C:4D:06", firmware: "ArubaOS 10.4.0.3", status: "online", protocol: "snmp_v2c", assignedAgentRoleId: networkAdmin?.id, metadata: {
      hardware: { cpu: "Qualcomm IPQ8074 2.2GHz", ram: "2 GB DDR4", flash: "512 MB", radios: "Tri-band", antennas: "4x4:4 MIMO", psu: "PoE 802.3at (25.5W)", serialNumber: "CNF2J0M04L", formFactor: "Ceiling mount", weight: "0.9 kg", powerDraw: "25.5W PoE" },
      software: { os: "ArubaOS", version: "10.4.0.3", controller: "Aruba Central (Cloud)", uptime: "45 days 08:12:00", lastPatched: "2026-01-18" },
      network: { interfaces: [
        { name: "2.4 GHz Radio", type: "Wi-Fi 6", status: "active", bandwidth: "574 Mbps", utilization: "22%", vlan: "10" },
        { name: "5 GHz Radio", type: "Wi-Fi 6", status: "active", bandwidth: "2.4 Gbps", utilization: "44%", vlan: "10,20" },
        { name: "6 GHz Radio", type: "Wi-Fi 6E", status: "active", bandwidth: "4.8 Gbps", utilization: "8%", vlan: "20" }
      ], ssidCount: 4, connectedClients: 31, band: "Wi-Fi 6E" },
      security: { kpis: { patchCompliance: 100, configCompliance: 96, uptimeSla: 99.9, mttr: "5 min", lastAudit: "2026-02-15" }, encryption: "WPA3-Enterprise" },
      vulnerabilities: [],
      penTesting: { whitebox: { lastTest: "2026-02-01", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "Corporate Wireless (CORP-WIFI)", criticality: "High" }, { name: "Guest Network (GUEST)", criticality: "Low" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "1.2, 2.1, 4.1" }]
    } },

    { probeId: probes[1].id, name: "IDS-SENSOR-01", type: "firewall", vendor: "Palo Alto", model: "PA-440", ipAddress: "10.0.2.10", macAddress: "00:2A:3B:4C:5D:01", firmware: "PAN-OS 11.1.2", status: "online", protocol: "snmp_v3", assignedAgentRoleId: securityAdmin?.id, metadata: {
      hardware: { cpu: "Marvell OCTEON 4-core", ram: "4 GB DDR4", ssd: "64 GB", throughput: "2.4 Gbps Firewall / 1.0 Gbps Threat Prevention", maxSessions: 200000, serialNumber: "024201012345", formFactor: "Desktop", weight: "2.1 kg", powerDraw: "46W avg" },
      software: { os: "PAN-OS", version: "11.1.2", threatContent: "8845-8512", appId: "8845", urlDb: "20260301", wildfire: "828412", uptime: "127 days 03:18:44", lastPatched: "2026-01-05" },
      network: { interfaces: [
        { name: "ethernet1/1 (Outside)", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "67%", vlan: "N/A - Routed" },
        { name: "ethernet1/2 (Inside)", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "58%", vlan: "N/A - Routed" },
        { name: "ethernet1/3 (DMZ)", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "12%", vlan: "N/A - Routed" },
        { name: "ethernet1/4 (Mgmt)", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "1%", vlan: "999" }
      ], zones: 6, activeSessions: 84500, threatPrevention: true, urlFiltering: true },
      security: { kpis: { patchCompliance: 100, configCompliance: 99, uptimeSla: 99.99, mttr: "4 min", lastAudit: "2026-02-20", threatsBlocked24h: 1247, falsePositiveRate: "0.3%", meanDetectionTime: "< 1 sec" }, decryptionEnabled: true, filBlocking: true, dnsSecurityEnabled: true },
      vulnerabilities: [{ cve: "CVE-2025-0108", severity: "Critical", description: "PAN-OS auth bypass in web management", status: "Patched", patchedDate: "2025-12-15" }],
      penTesting: { whitebox: { lastTest: "2026-02-15", result: "Pass", findings: 0, criticalFindings: 0 }, graybox: { lastTest: "2025-12-01", result: "Pass", findings: 2, criticalFindings: 0 }, blackbox: { lastTest: "2025-10-15", result: "Pass", findings: 1, criticalFindings: 0 } },
      applications: [{ name: "Perimeter IDS/IPS", criticality: "Critical" }, { name: "SSL Decryption (Inbound)", criticality: "Critical" }, { name: "URL Filtering Gateway", criticality: "High" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "1.1-1.5, 6.1, 11.4" }, { framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC6.6, CC6.8" }, { framework: "NIST 800-53", status: "Compliant", controls: "AC-4, SC-7, SI-3, SI-4" }, { framework: "ISO 27001", status: "Compliant", controls: "A.13.1, A.13.2" }]
    } },
    { probeId: probes[1].id, name: "VPN-GW-01", type: "gateway", vendor: "Fortinet", model: "FortiGate 100F", ipAddress: "10.0.2.20", macAddress: "00:2A:3B:4C:5D:02", firmware: "FortiOS 7.4.1", status: "online", protocol: "snmp_v3", assignedAgentRoleId: securityAdmin?.id, metadata: {
      hardware: { cpu: "SOC4 NP7 + CP9", ram: "4 GB DDR4", flash: "128 GB SSD", throughput: "20 Gbps FW / 1 Gbps SSL-VPN", maxVpnTunnels: 16000, serialNumber: "FG100FTK22900012", formFactor: "Desktop/Rack", weight: "1.8 kg", powerDraw: "38W avg" },
      software: { os: "FortiOS", version: "7.4.1", avDb: "92.00830", ipsDb: "26.00771", webFilterDb: "4.00182", uptime: "203 days 11:45:32", lastPatched: "2025-09-22" },
      network: { interfaces: [
        { name: "wan1", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "44%", vlan: "N/A" },
        { name: "wan2", type: "1GbE", status: "standby", bandwidth: "1 Gbps", utilization: "0%", vlan: "N/A" },
        { name: "port1-8", type: "1GbE Switch", status: "active", bandwidth: "1 Gbps", utilization: "31%", vlan: "10,20,30" },
        { name: "ssl.root", type: "SSL-VPN", status: "active", bandwidth: "N/A", utilization: "N/A", vlan: "N/A" }
      ], vpnTunnels: 12, sslVpnUsers: 85, ipsecTunnels: 4 },
      security: { kpis: { patchCompliance: 86, configCompliance: 94, uptimeSla: 99.97, mttr: "10 min", lastAudit: "2026-01-30", activeSslVpnSessions: 85, ipsecUptime: "99.99%" } },
      vulnerabilities: [{ cve: "CVE-2025-32756", severity: "High", description: "FortiOS stack buffer overflow in SSL-VPN", status: "Patched", patchedDate: "2025-09-22" }, { cve: "CVE-2025-24472", severity: "Medium", description: "CSR authentication bypass", status: "Patched", patchedDate: "2025-09-22" }],
      penTesting: { whitebox: { lastTest: "2026-01-15", result: "Pass", findings: 1, criticalFindings: 0 }, graybox: { lastTest: "2025-11-20", result: "Pass with observations", findings: 3, criticalFindings: 0 }, blackbox: { lastTest: "2025-09-30", result: "Pass", findings: 1, criticalFindings: 0 } },
      applications: [{ name: "Remote Access VPN (SSL-VPN)", criticality: "Critical" }, { name: "Site-to-Site IPSec VPN", criticality: "Critical" }, { name: "SD-WAN Orchestrator", criticality: "High" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "1.2, 4.1, 8.3" }, { framework: "ISO 27001", status: "Compliant", controls: "A.10.1, A.13.1" }, { framework: "HIPAA", status: "Compliant", controls: "164.312(e)(1), 164.312(a)(1)" }]
    } },
    { probeId: probes[1].id, name: "WAF-01", type: "firewall", vendor: "F5", model: "BIG-IP i5800", ipAddress: "10.0.2.30", macAddress: "00:2A:3B:4C:5D:03", firmware: "TMOS 17.1.0", status: "online", protocol: "snmp_v3", assignedAgentRoleId: securityAdmin?.id, metadata: {
      hardware: { cpu: "Intel Xeon 8-core 2.1GHz", ram: "64 GB DDR4", ssd: "480 GB x2 (RAID1)", throughput: "40 Gbps L4 / 10 Gbps L7", maxConnections: 36000000, serialNumber: "f5-XRYP-GHTR", formFactor: "1RU", weight: "14.5 kg", powerDraw: "375W avg" },
      software: { os: "TMOS / BIG-IP ASM", version: "17.1.0 Build 0.0.13", asmSignatures: "2026.02.28-001", botDefenseDb: "v3.2.1", uptime: "88 days 22:10:15", lastPatched: "2025-12-08" },
      network: { interfaces: [
        { name: "1.1 (External)", type: "10GbE SFP+", status: "active", bandwidth: "10 Gbps", utilization: "55%", vlan: "DMZ" },
        { name: "1.2 (Internal)", type: "10GbE SFP+", status: "active", bandwidth: "10 Gbps", utilization: "48%", vlan: "AppServers" },
        { name: "Mgmt", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "2%", vlan: "999" }
      ], virtualServers: 8, activePolicies: 14, wafMode: "blocking", currentConnections: 12500 },
      security: { kpis: { patchCompliance: 95, configCompliance: 98, uptimeSla: 99.99, mttr: "6 min", lastAudit: "2026-02-18", attacksBlocked24h: 3421, owaspTop10Coverage: "100%", botTrafficBlocked: "12%" } },
      vulnerabilities: [{ cve: "CVE-2025-20058", severity: "High", description: "TMM vulnerability in HTTP/2 handling", status: "Patched", patchedDate: "2025-12-08" }],
      penTesting: { whitebox: { lastTest: "2026-02-10", result: "Pass", findings: 1, criticalFindings: 0 }, graybox: { lastTest: "2025-12-15", result: "Pass", findings: 2, criticalFindings: 0 }, blackbox: { lastTest: "2025-10-20", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "Web Application Firewall (E-Commerce)", criticality: "Critical" }, { name: "API Gateway Protection", criticality: "Critical" }, { name: "Bot Defense", criticality: "High" }, { name: "DDoS L7 Mitigation", criticality: "High" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "6.4, 6.5, 6.6, 11.4" }, { framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC6.6, CC6.8" }, { framework: "OWASP ASVS L2", status: "Compliant", controls: "V1-V14" }]
    } },
    { probeId: probes[1].id, name: "NAC-CONTROLLER", type: "server", vendor: "Cisco", model: "ISE 3515", ipAddress: "10.0.2.40", macAddress: "00:2A:3B:4C:5D:04", firmware: "ISE 3.3 Patch 3", status: "online", protocol: "snmp_v3", assignedAgentRoleId: securityAdmin?.id, metadata: {
      hardware: { cpu: "Intel Xeon Silver 4314 16-core", ram: "96 GB DDR4 ECC", ssd: "600 GB SAS x4 (RAID10)", serialNumber: "ISE3515-SN00892", formFactor: "1RU", weight: "18.2 kg", powerDraw: "280W avg" },
      software: { os: "Cisco ISE", version: "3.3 Patch 3", postureFeed: "2026-03-01", profilerFeed: "2026-03-01", uptime: "64 days 15:08:22", lastPatched: "2026-01-28" },
      network: { interfaces: [
        { name: "GigE 0", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "24%", vlan: "999" },
        { name: "GigE 1", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "18%", vlan: "999" }
      ], endpoints: 342, policies: 18, profiling: true, activeRadiusSessions: 287 },
      security: { kpis: { patchCompliance: 97, configCompliance: 96, uptimeSla: 99.95, mttr: "15 min", lastAudit: "2026-02-10", endpointsProfiled: 342, complianceRate: "94%", guestSessions: 23 } },
      vulnerabilities: [{ cve: "CVE-2025-20125", severity: "Critical", description: "ISE auth bypass via RADIUS", status: "Patched", patchedDate: "2026-01-28" }],
      penTesting: { whitebox: { lastTest: "2026-02-01", result: "Pass", findings: 1, criticalFindings: 0 }, graybox: { lastTest: "2025-11-15", result: "Pass", findings: 2, criticalFindings: 0 }, blackbox: { lastTest: "2025-09-20", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "Network Access Control (802.1X)", criticality: "Critical" }, { name: "Endpoint Posture Assessment", criticality: "High" }, { name: "Guest Portal", criticality: "Medium" }, { name: "BYOD Onboarding", criticality: "Medium" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "1.2, 7.1, 8.1, 8.3" }, { framework: "NIST 800-53", status: "Compliant", controls: "AC-2, AC-3, IA-2, IA-5" }, { framework: "ISO 27001", status: "Compliant", controls: "A.9.1, A.9.2, A.9.4" }]
    } },
    { probeId: probes[1].id, name: "PROXY-SRV-01", type: "server", vendor: "Zscaler", model: "ZPA Connector (VM)", ipAddress: "10.0.2.50", macAddress: "00:2A:3B:4C:5D:05", firmware: "ZPA 23.198.1", status: "online", protocol: "snmp_v3", assignedAgentRoleId: securityAdmin?.id, metadata: {
      hardware: { cpu: "vCPU x4 (ESXi Host: Xeon Gold 6348)", ram: "8 GB", disk: "60 GB (thin provisioned)", hypervisor: "VMware ESXi 8.0 U2", serialNumber: "ZPA-VM-00291", formFactor: "Virtual Machine", powerDraw: "N/A (VM)" },
      software: { os: "Zscaler Connector OS (Linux-based)", version: "23.198.1", zscalerCloud: "zscalertwo.net", uptime: "32 days 04:55:11", lastPatched: "2026-02-02", autoUpdate: true },
      network: { interfaces: [
        { name: "eth0", type: "VMXNET3", status: "active", bandwidth: "10 Gbps (virtual)", utilization: "8%", vlan: "50" }
      ], connectedApps: 24, activeUsers: 156, tunnelStatus: "Established", brokerConnection: "zpa-broker1.zscalertwo.net" },
      security: { kpis: { patchCompliance: 100, configCompliance: 100, uptimeSla: 99.99, mttr: "3 min", lastAudit: "2026-02-20", usersConnected: 156, appsProtected: 24 } },
      vulnerabilities: [],
      penTesting: { whitebox: { lastTest: "2026-02-05", result: "Pass", findings: 0, criticalFindings: 0 }, graybox: { lastTest: "2025-12-10", result: "Pass", findings: 0, criticalFindings: 0 }, blackbox: { lastTest: "2025-10-01", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "Zero Trust Network Access (ZTNA)", criticality: "Critical" }, { name: "Private App Connector", criticality: "Critical" }],
      compliance: [{ framework: "SOC 2 Type II", status: "Compliant (via Zscaler)", controls: "CC6.1, CC6.6, CC6.7" }, { framework: "FedRAMP", status: "Authorized (High)", controls: "AC-4, SC-7, SC-12" }, { framework: "ISO 27001", status: "Certified", controls: "A.13.1, A.14.1" }]
    } },

    { probeId: probes[2].id, name: "WEB-SRV-01", type: "server", vendor: "Dell", model: "PowerEdge R750xs", ipAddress: "10.0.10.10", macAddress: "00:3A:4B:5C:6D:01", firmware: "BIOS 1.8.2 / iDRAC 6.10.80.00", status: "online", protocol: "ssh", assignedAgentRoleId: linuxAdmin?.id, metadata: {
      hardware: { cpu: "2x Intel Xeon Gold 6342 (48 cores total)", ram: "128 GB DDR4-3200 ECC RDIMM", storage: "2x 960GB SSD RAID1 (OS) + 4x 1.92TB NVMe (Data)", raid: "PERC H745 (RAID1 + RAID10)", nic: "Broadcom 57416 Dual 10GbE + Intel X710-DA2 Dual 25GbE", serialNumber: "SVC-TAG-R750-01", formFactor: "1RU", weight: "18.6 kg", powerDraw: "420W avg / 750W max" },
      software: { os: "Ubuntu 22.04.3 LTS", kernel: "5.15.0-91-generic", webServer: "Nginx 1.24.0", runtime: "Node.js 20.11 LTS", containerRuntime: "Docker 24.0.7 / containerd 1.7.11", orchestration: "Docker Compose", monitoring: "Datadog Agent 7.50", packages: 847, lastPatched: "2026-02-28", autoUpdates: "Unattended-upgrades (security only)" },
      network: { interfaces: [
        { name: "eno1 (Primary)", type: "10GbE", status: "active", bandwidth: "10 Gbps", utilization: "34%", vlan: "100" },
        { name: "eno2 (Backup)", type: "10GbE", status: "standby", bandwidth: "10 Gbps", utilization: "0%", vlan: "100" },
        { name: "ens3f0 (Storage)", type: "25GbE", status: "active", bandwidth: "25 Gbps", utilization: "12%", vlan: "200" },
        { name: "iDRAC", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "1%", vlan: "999" }
      ], defaultGateway: "10.0.10.1", dns: ["10.0.20.10", "10.0.20.11"], ntp: "10.0.20.10" },
      security: { kpis: { patchCompliance: 96, configCompliance: 92, uptimeSla: 99.95, mttr: "20 min", lastAudit: "2026-02-12", openPorts: "22, 80, 443, 8080", firewallRules: 42 }, hardening: "CIS Ubuntu 22.04 L1", selinux: "N/A (AppArmor enforcing)", antivirus: "ClamAV + Falco runtime", sshConfig: "Key-only, no root, fail2ban" },
      vulnerabilities: [
        { cve: "CVE-2025-32464", severity: "High", description: "Nginx HTTP/2 rapid reset DoS", status: "Patched", patchedDate: "2026-02-28" },
        { cve: "CVE-2025-21502", severity: "Medium", description: "Node.js undici SSRF", status: "Patched", patchedDate: "2026-02-28" },
        { cve: "CVE-2025-0001", severity: "Low", description: "OpenSSL timing side-channel", status: "Accepted Risk", mitigation: "Internal network only" }
      ],
      penTesting: { whitebox: { lastTest: "2026-02-20", result: "Pass", findings: 2, criticalFindings: 0 }, graybox: { lastTest: "2025-12-05", result: "Pass with observations", findings: 4, criticalFindings: 0 }, blackbox: { lastTest: "2025-10-10", result: "Pass", findings: 1, criticalFindings: 0 } },
      applications: [{ name: "HOLOCRON AI Platform (Frontend)", criticality: "Critical" }, { name: "Nginx Reverse Proxy", criticality: "Critical" }, { name: "Docker Container Host (12 containers)", criticality: "High" }, { name: "Datadog Monitoring Agent", criticality: "Medium" }],
      compliance: [{ framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC6.6, CC7.1, CC7.2" }, { framework: "PCI DSS 4.0", status: "Compliant", controls: "2.2, 6.1, 6.2, 10.1, 11.5" }, { framework: "CIS Benchmark", status: "L1 Compliant (Score: 94/100)", controls: "1.1-5.4" }]
    } },
    { probeId: probes[2].id, name: "DB-SRV-01", type: "server", vendor: "HPE", model: "ProLiant DL380 Gen10+", ipAddress: "10.0.10.20", macAddress: "00:3A:4B:5C:6D:02", firmware: "BIOS U46 v2.72 / iLO 5 v2.82", status: "online", protocol: "ssh", assignedAgentRoleId: dbAdmin?.id, metadata: {
      hardware: { cpu: "2x Intel Xeon Gold 6348 (56 cores total)", ram: "512 GB DDR4-3200 ECC LRDIMM", storage: "2x 960GB SSD RAID1 (OS) + 8x 3.84TB NVMe P5800X (Data)", raid: "HPE SR416i-a (OS) + NVMe Direct", nic: "HPE Ethernet 10/25Gb 2-port 621SFP28", serialNumber: "MXQ2451A0B", formFactor: "2RU", weight: "24.8 kg", powerDraw: "580W avg / 1100W max" },
      software: { os: "RHEL 9.2", kernel: "5.14.0-284.30.1.el9_2.x86_64", dbEngine: "PostgreSQL 16.2", dbExtensions: "pg_stat_statements, pgvector, pg_cron, timescaledb", replication: "Streaming replication (1 replica)", backup: "pgBackRest (full weekly, incr daily)", monitoring: "pgwatch2 + Prometheus postgres_exporter", packages: 612, lastPatched: "2026-02-15" },
      network: { interfaces: [
        { name: "eno1 (App Network)", type: "25GbE", status: "active", bandwidth: "25 Gbps", utilization: "18%", vlan: "100" },
        { name: "eno2 (Replication)", type: "25GbE", status: "active", bandwidth: "25 Gbps", utilization: "8%", vlan: "201" },
        { name: "iLO", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "1%", vlan: "999" }
      ] },
      security: { kpis: { patchCompliance: 98, configCompliance: 97, uptimeSla: 99.99, mttr: "30 min", lastAudit: "2026-02-12", dbConnectionsActive: 124, dbConnectionsMax: 500, tdeEnabled: true }, hardening: "CIS RHEL 9 L1 + CIS PostgreSQL 16", selinux: "Enforcing", encryption: "TDE (pgcrypto) + TLS 1.3 connections", auditLog: "pgAudit enabled" },
      vulnerabilities: [{ cve: "CVE-2025-1094", severity: "High", description: "PostgreSQL PL/pgSQL injection via quoting", status: "Patched", patchedDate: "2026-02-15" }],
      penTesting: { whitebox: { lastTest: "2026-02-20", result: "Pass", findings: 1, criticalFindings: 0 }, graybox: { lastTest: "2025-12-01", result: "Pass", findings: 2, criticalFindings: 0 }, blackbox: { lastTest: "2025-10-15", result: "N/A - Internal only", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "PostgreSQL 16 (Primary)", criticality: "Critical" }, { name: "HOLOCRON AI Database", criticality: "Critical" }, { name: "TimescaleDB (Metrics Store)", criticality: "High" }, { name: "pgBackRest Backup", criticality: "High" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "2.2, 3.4, 6.1, 8.1, 10.1" }, { framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC6.5, CC7.1" }, { framework: "HIPAA", status: "Compliant", controls: "164.312(a)(1), 164.312(e)(1)" }]
    } },
    { probeId: probes[2].id, name: "APP-SRV-01", type: "server", vendor: "Dell", model: "PowerEdge R650", ipAddress: "10.0.10.30", macAddress: "00:3A:4B:5C:6D:03", firmware: "BIOS 1.6.1 / iDRAC 6.10.80.00", status: "online", protocol: "ssh", assignedAgentRoleId: linuxAdmin?.id, metadata: {
      hardware: { cpu: "2x Intel Xeon Silver 4316 (40 cores total)", ram: "64 GB DDR4-3200 ECC", storage: "2x 480GB SSD RAID1 (OS) + 2x 960GB NVMe (Containers)", nic: "Intel X710-DA2 Dual 10GbE", serialNumber: "SVC-TAG-R650-01", formFactor: "1RU", weight: "15.4 kg", powerDraw: "310W avg" },
      software: { os: "Ubuntu 22.04.3 LTS", kernel: "5.15.0-91-generic", containerRuntime: "Docker 24.0.7 + Kubernetes 1.29 (single node)", containers: 12, orchestration: "K3s Lightweight K8s", monitoring: "Prometheus + Grafana", lastPatched: "2026-02-25" },
      network: { interfaces: [
        { name: "eno1", type: "10GbE", status: "active", bandwidth: "10 Gbps", utilization: "22%", vlan: "100" },
        { name: "eno2", type: "10GbE", status: "active", bandwidth: "10 Gbps", utilization: "15%", vlan: "200" }
      ] },
      security: { kpis: { patchCompliance: 93, configCompliance: 90, uptimeSla: 99.9, mttr: "15 min", lastAudit: "2026-02-12", runningContainers: 12, imageVulns: 3 }, hardening: "CIS Docker Benchmark v1.6", seccomp: "Default profiles", networkPolicies: "Calico CNI" },
      vulnerabilities: [{ cve: "CVE-2025-21613", severity: "Medium", description: "Kubernetes API server RBAC bypass", status: "Patched", patchedDate: "2026-02-25" }, { cve: "CVE-2025-0003", severity: "Low", description: "containerd mount path traversal", status: "Patched", patchedDate: "2026-02-25" }],
      penTesting: { whitebox: { lastTest: "2026-02-20", result: "Pass", findings: 3, criticalFindings: 0 }, graybox: { lastTest: "2025-11-20", result: "Pass with observations", findings: 4, criticalFindings: 0 }, blackbox: { lastTest: "2025-10-05", result: "Pass", findings: 1, criticalFindings: 0 } },
      applications: [{ name: "Microservices Platform (12 services)", criticality: "Critical" }, { name: "K3s Kubernetes", criticality: "High" }, { name: "Redis Cache Cluster", criticality: "High" }, { name: "RabbitMQ Message Broker", criticality: "High" }],
      compliance: [{ framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC7.1, CC7.2" }, { framework: "CIS Benchmark", status: "Docker L1 Compliant", controls: "1.1-5.31" }]
    } },
    { probeId: probes[2].id, name: "LOG-SRV-01", type: "server", vendor: "Supermicro", model: "SYS-620P-TRT", ipAddress: "10.0.10.40", macAddress: "00:3A:4B:5C:6D:04", firmware: "BIOS 1.4 / BMC 01.01.16", status: "offline", protocol: "ssh", assignedAgentRoleId: linuxAdmin?.id, metadata: {
      hardware: { cpu: "2x Intel Xeon Silver 4310 (24 cores total)", ram: "64 GB DDR4-3200 ECC", storage: "2x 480GB SSD RAID1 (OS) + 8x 8TB HDD RAID6 (Logs) + 2x 1.92TB NVMe (Hot tier)", raid: "Broadcom MegaRAID 9560-8i", nic: "Dual 10GbE Intel X710", serialNumber: "SM-620P-SN0412", formFactor: "2RU", weight: "28 kg", powerDraw: "340W avg" },
      software: { os: "Debian 12 (Bookworm)", kernel: "6.1.0-17-amd64", logPlatform: "Elastic Stack 8.12 (Elasticsearch + Kibana + Logstash)", retention: "90 days hot / 365 days warm / 7 years cold (S3)", ingestRate: "15,000 EPS avg", monitoring: "Elastic Stack self-monitoring", lastPatched: "2026-01-10" },
      network: { interfaces: [
        { name: "eno1 (Ingest)", type: "10GbE", status: "down", bandwidth: "10 Gbps", utilization: "0%", vlan: "100" },
        { name: "eno2 (Management)", type: "10GbE", status: "down", bandwidth: "10 Gbps", utilization: "0%", vlan: "999" }
      ] },
      security: { kpis: { patchCompliance: 78, configCompliance: 85, uptimeSla: 95.0, mttr: "4 hours", lastAudit: "2026-01-15", storageUsed: "78%", indexCount: 342 }, hardening: "CIS Debian 12 L1", auditLog: "auditd enabled", encryption: "LUKS at rest" },
      vulnerabilities: [{ cve: "CVE-2025-25012", severity: "Critical", description: "Kibana arbitrary code execution via XSRF", status: "Open", mitigation: "Server offline - pending maintenance window" }, { cve: "CVE-2025-23083", severity: "Medium", description: "Elasticsearch cluster health check bypass", status: "Open", mitigation: "Scheduled for next patch cycle" }],
      penTesting: { whitebox: { lastTest: "2025-12-15", result: "Fail - 1 critical", findings: 5, criticalFindings: 1 }, graybox: { lastTest: "2025-10-01", result: "Pass with observations", findings: 3, criticalFindings: 0 }, blackbox: { lastTest: "2025-08-15", result: "Pass", findings: 1, criticalFindings: 0 } },
      applications: [{ name: "Elasticsearch 8.12 (SIEM)", criticality: "Critical" }, { name: "Kibana Dashboards", criticality: "High" }, { name: "Logstash Pipeline (15K EPS)", criticality: "High" }, { name: "Compliance Log Archive", criticality: "Critical" }],
      compliance: [{ framework: "SOC 2 Type II", status: "Non-Compliant (Server Offline)", controls: "CC7.1, CC7.2, CC7.3" }, { framework: "PCI DSS 4.0", status: "At Risk", controls: "10.1, 10.2, 10.3, 10.7" }, { framework: "HIPAA", status: "At Risk", controls: "164.312(b)" }]
    } },

    { probeId: probes[3].id, name: "AD-DC-01", type: "server", vendor: "Dell", model: "PowerEdge R740", ipAddress: "10.0.20.10", macAddress: "00:4A:5B:6C:7D:01", firmware: "BIOS 2.18.1 / iDRAC 5.10.50.00", status: "online", protocol: "wmi", assignedAgentRoleId: windowsAdmin?.id, metadata: {
      hardware: { cpu: "2x Intel Xeon Gold 6240 (36 cores total)", ram: "128 GB DDR4-2933 ECC", storage: "2x 480GB SSD RAID1 (OS) + 2x 1.2TB SAS RAID1 (NTDS/SYSVOL)", nic: "Broadcom 5720 Quad 1GbE + Intel X710 Dual 10GbE", serialNumber: "SVC-TAG-R740-DC01", formFactor: "2RU", weight: "22 kg", powerDraw: "450W avg" },
      software: { os: "Windows Server 2022 Datacenter", build: "20348.2340", adFunctionalLevel: "Windows Server 2016", fsmoRoles: ["Schema Master", "Domain Naming Master", "PDC Emulator", "RID Master", "Infrastructure Master"], exchangePrep: true, dnsRole: true, dhcpRole: false, lastPatched: "2026-02-13", wsus: "Managed by SCCM" },
      network: { interfaces: [
        { name: "Ethernet0 (AD Replication)", type: "10GbE", status: "active", bandwidth: "10 Gbps", utilization: "8%", vlan: "20" },
        { name: "Ethernet1 (Client Services)", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "22%", vlan: "20" },
        { name: "iDRAC", type: "1GbE", status: "active", bandwidth: "1 Gbps", utilization: "1%", vlan: "999" }
      ], adUsers: 450, gpoCount: 28, adSites: 3 },
      security: { kpis: { patchCompliance: 99, configCompliance: 97, uptimeSla: 99.99, mttr: "15 min", lastAudit: "2026-02-10", lockedAccounts: 3, failedLogins24h: 47, privilegedAccounts: 12 }, hardening: "CIS Windows Server 2022 L1 + Microsoft Security Baseline", windowsDefender: true, laps: true, credentialGuard: true, secureBootEnabled: true },
      vulnerabilities: [{ cve: "CVE-2025-21298", severity: "Critical", description: "Windows OLE RCE vulnerability", status: "Patched", patchedDate: "2026-02-13" }],
      penTesting: { whitebox: { lastTest: "2026-02-01", result: "Pass", findings: 2, criticalFindings: 0 }, graybox: { lastTest: "2025-11-15", result: "Pass with observations", findings: 3, criticalFindings: 0 }, blackbox: { lastTest: "2025-09-20", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "Active Directory Domain Services", criticality: "Critical" }, { name: "DNS Server (AD-integrated)", criticality: "Critical" }, { name: "Certificate Authority (Enterprise Root)", criticality: "Critical" }, { name: "Group Policy Management", criticality: "High" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "2.2, 7.1, 8.1, 8.2, 8.3" }, { framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC6.2, CC6.3" }, { framework: "NIST 800-53", status: "Compliant", controls: "AC-2, AC-3, AC-6, IA-2, IA-5" }, { framework: "CIS Benchmark", status: "L1 Compliant (Score: 97/100)", controls: "1.1-18.9" }]
    } },
    { probeId: probes[3].id, name: "EXCHANGE-SRV", type: "server", vendor: "HPE", model: "ProLiant DL380 Gen10", ipAddress: "10.0.20.20", macAddress: "00:4A:5B:6C:7D:02", firmware: "BIOS U30 v2.72 / iLO 5 v2.80", status: "online", protocol: "wmi", assignedAgentRoleId: messagingAdmin?.id, metadata: {
      hardware: { cpu: "2x Intel Xeon Gold 6230R (52 cores total)", ram: "256 GB DDR4-2933 ECC", storage: "2x 480GB SSD RAID1 (OS) + 8x 1.8TB SAS RAID10 (Mailbox DBs)", nic: "HPE 4-port 1GbE + HPE 2-port 25GbE", serialNumber: "MXQ2230A0C", formFactor: "2RU", weight: "24.2 kg", powerDraw: "520W avg" },
      software: { os: "Windows Server 2022 Standard", build: "20348.2340", exchangeVersion: "Exchange Server 2019 CU14", dagMembers: 2, mailboxes: 380, transportQueues: 3, owaPolicies: 2, lastPatched: "2026-02-13" },
      network: { interfaces: [
        { name: "Ethernet0 (MAPI)", type: "25GbE", status: "active", bandwidth: "25 Gbps", utilization: "14%", vlan: "20" },
        { name: "Ethernet1 (Replication)", type: "25GbE", status: "active", bandwidth: "25 Gbps", utilization: "6%", vlan: "201" }
      ], mailboxes: 380, dagMembers: 2, smtpRelay: "relay.sentinel-ai.local" },
      security: { kpis: { patchCompliance: 95, configCompliance: 93, uptimeSla: 99.95, mttr: "25 min", lastAudit: "2026-02-10", spamBlocked24h: 1247, phishingDetected24h: 23, dlpPolicies: 8 }, hardening: "Microsoft Exchange Security Baseline", tlsVersion: "1.2+", smimeEnabled: true },
      vulnerabilities: [{ cve: "CVE-2025-21595", severity: "High", description: "Exchange SSRF via EWS", status: "Patched", patchedDate: "2026-02-13" }, { cve: "CVE-2025-21401", severity: "Medium", description: "OWA XSS in calendar view", status: "Patched", patchedDate: "2026-02-13" }],
      penTesting: { whitebox: { lastTest: "2026-02-01", result: "Pass", findings: 3, criticalFindings: 0 }, graybox: { lastTest: "2025-11-15", result: "Pass with observations", findings: 5, criticalFindings: 0 }, blackbox: { lastTest: "2025-09-25", result: "Pass", findings: 2, criticalFindings: 0 } },
      applications: [{ name: "Exchange Server 2019 (Email)", criticality: "Critical" }, { name: "Outlook Web App (OWA)", criticality: "High" }, { name: "Exchange ActiveSync (Mobile)", criticality: "High" }, { name: "Data Loss Prevention (DLP)", criticality: "High" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "2.2, 4.1, 8.3, 10.1" }, { framework: "HIPAA", status: "Compliant", controls: "164.312(a)(1), 164.312(e)(1), 164.312(c)(1)" }, { framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC6.7" }]
    } },
    { probeId: probes[3].id, name: "FILE-SRV-01", type: "server", vendor: "Dell", model: "PowerEdge R750", ipAddress: "10.0.20.30", macAddress: "00:4A:5B:6C:7D:03", firmware: "BIOS 1.8.2 / iDRAC 6.10.80.00", status: "online", protocol: "wmi", assignedAgentRoleId: windowsAdmin?.id, metadata: {
      hardware: { cpu: "Intel Xeon Silver 4314 (16 cores)", ram: "64 GB DDR4-3200 ECC", storage: "2x 480GB SSD RAID1 (OS) + 12x 8TB HDD RAID6 (Data = 72TB usable)", raid: "PERC H745", nic: "Broadcom 57416 Dual 10GbE", serialNumber: "SVC-TAG-R750-FS01", formFactor: "2RU", weight: "32 kg", powerDraw: "380W avg" },
      software: { os: "Windows Server 2022 Standard", build: "20348.2340", fileServerRole: "DFS Namespace + DFS Replication", deduplication: "Enabled (ratio 1.8:1)", shares: 24, quotas: "Per-user 50GB default", antivirus: "Microsoft Defender for Endpoint", lastPatched: "2026-02-13" },
      network: { interfaces: [
        { name: "Ethernet0 (SMB Traffic)", type: "10GbE", status: "active", bandwidth: "10 Gbps", utilization: "42%", vlan: "20" },
        { name: "Ethernet1 (DFS Replication)", type: "10GbE", status: "active", bandwidth: "10 Gbps", utilization: "8%", vlan: "201" }
      ], shares: 24, storageUsed: "48 TB of 72 TB", dfsEnabled: true },
      security: { kpis: { patchCompliance: 96, configCompliance: 94, uptimeSla: 99.95, mttr: "20 min", lastAudit: "2026-02-10", sharesAudited: 24, permissionIssues: 2 }, accessControl: "AD-integrated ACLs + ABE", encryption: "SMB 3.1.1 encryption enabled", auditLog: "File access auditing enabled" },
      vulnerabilities: [{ cve: "CVE-2025-21298", severity: "Critical", description: "Windows OLE RCE vulnerability", status: "Patched", patchedDate: "2026-02-13" }],
      penTesting: { whitebox: { lastTest: "2026-02-01", result: "Pass", findings: 2, criticalFindings: 0 }, graybox: { lastTest: "2025-11-10", result: "Pass", findings: 2, criticalFindings: 0 }, blackbox: { lastTest: "2025-09-15", result: "N/A - Internal only", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "DFS File Server (24 shares)", criticality: "High" }, { name: "Shadow Copies (VSS)", criticality: "Medium" }, { name: "Windows Search Service", criticality: "Low" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "2.2, 3.4, 7.1, 10.1" }, { framework: "SOC 2 Type II", status: "Compliant", controls: "CC6.1, CC6.5" }, { framework: "GDPR", status: "Compliant", controls: "Art. 5, Art. 25, Art. 32" }]
    } },

    { probeId: probes[4].id, name: "TEMP-SENSOR-DC1", type: "iot_sensor", vendor: "Dragino", model: "LHT65N", ipAddress: "10.0.50.10", macAddress: "A8:40:41:00:01:01", firmware: "v1.8.2", status: "online", protocol: "lorawan", assignedAgentRoleId: networkAdmin?.id, metadata: {
      hardware: { cpu: "STM32L072 (ARM Cortex-M0+)", ram: "20 KB SRAM", flash: "192 KB", sensor: "SHT31 (Temp/Humidity) + External DS18B20 Probe", battery: "2x AA Lithium (Saft LS14500) - 78% remaining", txPower: "16 dBm", antennas: "Internal patch antenna", serialNumber: "A84041FFFF000101", formFactor: "Wall mount IP67", weight: "0.15 kg", powerDraw: "< 0.1W (battery powered)" },
      software: { os: "LoRaWAN Stack v1.0.4", version: "v1.8.2", lorawanClass: "A", spreadingFactor: "SF7-SF12 (ADR)", dataRate: "DR0-DR5", joinMode: "OTAA", reportInterval: "600 sec", decoder: "Dragino LHT65N TTN Decoder v3" },
      network: { interfaces: [
        { name: "LoRa Radio", type: "LoRaWAN EU868", status: "active", bandwidth: "50 kbps (max)", utilization: "< 1%", vlan: "N/A" }
      ], gateway: "GW-DC-01 (10.0.50.1)", networkServer: "ChirpStack v4", applicationServer: "MQTT → InfluxDB" },
      security: { kpis: { patchCompliance: 85, configCompliance: 90, uptimeSla: 99.5, mttr: "1 hour", lastAudit: "2026-01-20" }, encryption: "AES-128 (LoRaWAN 1.0.4)", joinSecurity: "OTAA with AppKey rotation", firmwareSigning: false },
      vulnerabilities: [{ cve: "N/A", severity: "Low", description: "LoRaWAN 1.0.x replay attack vulnerability", status: "Accepted Risk", mitigation: "Frame counter validation enabled" }],
      penTesting: { whitebox: { lastTest: "2025-12-01", result: "Pass", findings: 1, criticalFindings: 0 } },
      applications: [{ name: "DC Temperature Monitoring (Room A)", criticality: "High" }, { name: "Environmental Alerting", criticality: "High" }],
      compliance: [{ framework: "ISO 27001", status: "Compliant", controls: "A.11.1, A.11.2" }, { framework: "SOC 2 Type II", status: "Compliant", controls: "CC7.1" }]
    } },
    { probeId: probes[4].id, name: "TEMP-SENSOR-DC2", type: "iot_sensor", vendor: "Dragino", model: "LHT65N", ipAddress: "10.0.50.11", macAddress: "A8:40:41:00:01:02", firmware: "v1.8.2", status: "online", protocol: "lorawan", assignedAgentRoleId: networkAdmin?.id, metadata: {
      hardware: { cpu: "STM32L072 (ARM Cortex-M0+)", ram: "20 KB", flash: "192 KB", sensor: "SHT31 + DS18B20", battery: "82% remaining", serialNumber: "A84041FFFF000102", formFactor: "Wall mount IP67", weight: "0.15 kg", powerDraw: "< 0.1W" },
      software: { os: "LoRaWAN Stack v1.0.4", version: "v1.8.2", lorawanClass: "A", reportInterval: "600 sec" },
      network: { interfaces: [{ name: "LoRa Radio", type: "LoRaWAN EU868", status: "active", bandwidth: "50 kbps", utilization: "< 1%", vlan: "N/A" }], gateway: "GW-DC-01" },
      security: { kpis: { patchCompliance: 85, configCompliance: 90, uptimeSla: 99.5, mttr: "1 hour", lastAudit: "2026-01-20" }, encryption: "AES-128" },
      vulnerabilities: [],
      penTesting: { whitebox: { lastTest: "2025-12-01", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "DC Temperature Monitoring (Room B)", criticality: "High" }],
      compliance: [{ framework: "ISO 27001", status: "Compliant", controls: "A.11.1, A.11.2" }]
    } },
    { probeId: probes[4].id, name: "POWER-METER-01", type: "meter", vendor: "Shelly", model: "Pro 3EM", ipAddress: "10.0.50.20", macAddress: "A8:40:41:00:02:01", firmware: "v1.2.0", status: "online", protocol: "lorawan", assignedAgentRoleId: networkAdmin?.id, metadata: {
      hardware: { cpu: "ESP32-S3 Dual Core 240MHz", ram: "512 KB", flash: "8 MB", sensor: "3-Phase CT Clamps (50A)", connectivity: "Wi-Fi 802.11 b/g/n + Bluetooth 5", din: "DIN-rail mount", serialNumber: "SHELLY-3EM-0201", formFactor: "DIN Rail 6 modules", weight: "0.28 kg", powerDraw: "< 2W" },
      software: { os: "Shelly Firmware (RTOS)", version: "v1.2.0", protocol: "MQTT + HTTP API", dataFormat: "JSON", cloudEnabled: false, localApi: true, reportInterval: "10 sec" },
      network: { interfaces: [{ name: "Wi-Fi", type: "802.11n", status: "active", bandwidth: "72 Mbps", utilization: "< 1%", vlan: "50" }], mqtt: "mqtt://10.0.50.1:1883", topic: "shelly/pro3em/power-meter-01" },
      security: { kpis: { patchCompliance: 80, configCompliance: 85, uptimeSla: 99.0, mttr: "2 hours", lastAudit: "2026-01-20" }, authentication: "HTTP Basic Auth", tlsEnabled: false },
      vulnerabilities: [{ cve: "N/A", severity: "Medium", description: "HTTP API lacks TLS encryption", status: "Accepted Risk", mitigation: "Isolated on IoT VLAN, no external access" }],
      penTesting: { whitebox: { lastTest: "2025-12-01", result: "Pass with observations", findings: 2, criticalFindings: 0 } },
      applications: [{ name: "UPS-A Power Monitoring (3-phase)", criticality: "High" }, { name: "PUE Calculation Input", criticality: "Medium" }],
      compliance: [{ framework: "ISO 27001", status: "Compliant", controls: "A.11.2" }, { framework: "ISO 50001", status: "Compliant", controls: "4.6.1, 4.6.2" }]
    } },
    { probeId: probes[4].id, name: "DOOR-SENSOR-01", type: "iot_sensor", vendor: "Dragino", model: "LDS02", ipAddress: "10.0.50.30", macAddress: "A8:40:41:00:03:01", firmware: "v1.6.1", status: "unknown", protocol: "lorawan", assignedAgentRoleId: securityAdmin?.id, metadata: {
      hardware: { cpu: "STM32L072", ram: "20 KB", flash: "192 KB", sensor: "Reed switch (magnetic)", battery: "12% remaining - REPLACE", serialNumber: "A84041FFFF000301", formFactor: "Surface mount IP65", weight: "0.08 kg", powerDraw: "< 0.05W" },
      software: { os: "LoRaWAN Stack v1.0.4", version: "v1.6.1", lorawanClass: "A", reportInterval: "On-change + 3600 sec heartbeat" },
      network: { interfaces: [{ name: "LoRa Radio", type: "LoRaWAN EU868", status: "intermittent", bandwidth: "50 kbps", utilization: "< 1%", vlan: "N/A" }], gateway: "GW-DC-01", lastContact: "2026-03-04T14:22:00Z" },
      security: { kpis: { patchCompliance: 70, configCompliance: 75, uptimeSla: 90.0, mttr: "4 hours", lastAudit: "2026-01-20" }, encryption: "AES-128", physicalSecurity: "Tamper detection enabled" },
      vulnerabilities: [{ cve: "N/A", severity: "High", description: "Battery critically low - sensor may fail without notice", status: "Open", mitigation: "Replacement scheduled" }],
      penTesting: { whitebox: { lastTest: "2025-12-01", result: "Pass", findings: 1, criticalFindings: 0 } },
      applications: [{ name: "Server Room Physical Access Monitoring", criticality: "Critical" }, { name: "Security Alerting (door open > 5 min)", criticality: "Critical" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "At Risk (battery)", controls: "9.1" }, { framework: "ISO 27001", status: "At Risk", controls: "A.11.1.2, A.11.1.3" }]
    } },

    { probeId: probes[5].id, name: "HVAC-CTRL-01", type: "hvac", vendor: "Johnson Controls", model: "FEC-3621-12VP", ipAddress: "10.0.60.10", macAddress: "00:5A:6B:7C:8D:01", firmware: "v4.2.1 Build 2345", status: "online", protocol: "bacnet", assignedAgentRoleId: securityAdmin?.id, metadata: {
      hardware: { cpu: "ARM Cortex-A9 800MHz", ram: "512 MB DDR3", flash: "4 GB eMMC", io: "12 Universal I/O + 4 Digital Out + 2 Analog Out", communication: "BACnet IP/MSTP + LON", serialNumber: "JCI-FEC3621-0001", formFactor: "DIN Rail", weight: "0.6 kg", powerDraw: "8W" },
      software: { os: "JCI Embedded Linux", version: "v4.2.1", bacnetDeviceId: 120001, bacnetObjects: 148, protocol: "BACnet/IP", supervisory: "Metasys ADX Server", schedules: 6, trends: 24, alarmClasses: 4, lastPatched: "2025-08-15" },
      network: { interfaces: [
        { name: "Ethernet", type: "100 Mbps", status: "active", bandwidth: "100 Mbps", utilization: "2%", vlan: "60" },
        { name: "MSTP Trunk", type: "BACnet MS/TP", status: "active", bandwidth: "76.8 kbps", utilization: "35%", vlan: "N/A" }
      ], zones: 4, setpoint: "22°C", mode: "cooling", connectedDevices: 8 },
      security: { kpis: { patchCompliance: 65, configCompliance: 72, uptimeSla: 99.5, mttr: "2 hours", lastAudit: "2025-11-15" }, authentication: "BACnet authentication disabled (default)", networkSegmentation: "Dedicated BAS VLAN", physicalAccess: "Locked MDF room" },
      vulnerabilities: [{ cve: "CVE-2024-32764", severity: "High", description: "BACnet stack buffer overflow in COV subscription handling", status: "Open", mitigation: "BAS VLAN isolated from corporate network" }, { cve: "N/A", severity: "Medium", description: "Default credentials on web interface", status: "Open", mitigation: "Web interface disabled, BACnet-only management" }],
      penTesting: { whitebox: { lastTest: "2025-10-01", result: "Fail - 1 critical", findings: 4, criticalFindings: 1 }, graybox: { lastTest: "2025-07-15", result: "Pass with observations", findings: 3, criticalFindings: 0 }, blackbox: { lastTest: "2025-05-01", result: "Pass", findings: 1, criticalFindings: 0 } },
      applications: [{ name: "DC HVAC Zone Control (4 zones)", criticality: "Critical" }, { name: "Free Cooling Economizer", criticality: "High" }, { name: "Hot/Cold Aisle Containment", criticality: "High" }, { name: "Humidity Control", criticality: "High" }],
      compliance: [{ framework: "ASHRAE 90.4", status: "Compliant", controls: "5.1-5.4" }, { framework: "ISO 27001", status: "Partially Compliant", controls: "A.11.1, A.11.2" }, { framework: "NIST 800-82", status: "Partially Compliant", controls: "ICS-specific controls" }]
    } },
    { probeId: probes[5].id, name: "PLC-POWER-01", type: "plc", vendor: "Siemens", model: "S7-1500 CPU 1515-2 PN", ipAddress: "10.0.70.10", macAddress: "00:5A:6B:7C:8D:02", firmware: "v2.9.6", status: "online", protocol: "modbus", assignedAgentRoleId: securityAdmin?.id, metadata: {
      hardware: { cpu: "Siemens proprietary 1.5GHz", ram: "500 KB Work Memory", flash: "3 MB Load Memory", io: "32 DI + 32 DO + 8 AI + 4 AO (via ET 200SP)", communication: "PROFINET + Modbus TCP + OPC UA", serialNumber: "SIE-S7-1500-0002", formFactor: "DIN Rail S7-1500", weight: "0.54 kg", powerDraw: "12W" },
      software: { os: "Siemens S7-1500 Firmware", version: "v2.9.6", plcProgram: "Power_Distribution_v3.1", programmingEnv: "TIA Portal V18", opcUaEnabled: true, webServer: true, cycleTime: "10ms avg / 15ms max", safetyIntegrated: false, lastPatched: "2025-06-20" },
      network: { interfaces: [
        { name: "X1 P1 (PROFINET)", type: "100 Mbps", status: "active", bandwidth: "100 Mbps", utilization: "8%", vlan: "70" },
        { name: "X2 P1 (Modbus TCP)", type: "100 Mbps", status: "active", bandwidth: "100 Mbps", utilization: "3%", vlan: "70" }
      ], ioPoints: 76, modbusRegisters: 128, program: "power_distribution" },
      security: { kpis: { patchCompliance: 55, configCompliance: 60, uptimeSla: 99.99, mttr: "4 hours", lastAudit: "2025-09-15" }, accessControl: "Protection Level 3 (Full Access with write protection)", networkSegmentation: "Dedicated OT VLAN with firewall", physicalAccess: "Locked electrical room", opcUaSecurity: "None (internal use only)" },
      vulnerabilities: [{ cve: "CVE-2024-46886", severity: "Critical", description: "S7-1500 web server XSS leading to credential theft", status: "Mitigated", mitigation: "Web server disabled" }, { cve: "CVE-2024-46887", severity: "High", description: "PROFINET DCP information disclosure", status: "Accepted Risk", mitigation: "OT network isolated" }, { cve: "N/A", severity: "Medium", description: "Modbus TCP lacks authentication", status: "Accepted Risk", mitigation: "Firewall rules limit Modbus access to SCADA server only" }],
      penTesting: { whitebox: { lastTest: "2025-09-15", result: "Pass with observations", findings: 5, criticalFindings: 0 }, graybox: { lastTest: "2025-06-01", result: "Pass with observations", findings: 4, criticalFindings: 0 }, blackbox: { lastTest: "2025-03-15", result: "Pass", findings: 2, criticalFindings: 0 } },
      applications: [{ name: "Power Distribution Control (3 PDUs)", criticality: "Critical" }, { name: "UPS Monitoring & Switchover", criticality: "Critical" }, { name: "Generator Start Sequencing", criticality: "Critical" }, { name: "Power Quality Monitoring", criticality: "High" }],
      compliance: [{ framework: "IEC 62443", status: "SL-2 Compliant", controls: "SR 1.1-7.7" }, { framework: "NIST 800-82", status: "Partially Compliant", controls: "Rev 3 ICS Guidelines" }, { framework: "NERC CIP", status: "Monitoring Only", controls: "CIP-002 to CIP-011" }]
    } },
    { probeId: probes[5].id, name: "CAMERA-LOBBY", type: "camera", vendor: "Axis", model: "P3265-LVE", ipAddress: "10.0.60.20", macAddress: "00:5A:6B:7C:8D:03", firmware: "11.8.61", status: "online", protocol: "http", assignedAgentRoleId: securityAdmin?.id, metadata: {
      hardware: { cpu: "ARTPEC-8 SoC", ram: "2 GB", flash: "512 MB + 256GB microSD", sensor: "1/2.8\" Progressive CMOS 2MP", lens: "3.4-8.9mm Varifocal P-Iris", irRange: "40m OptimizedIR", psu: "PoE IEEE 802.3af (12.95W max)", serialNumber: "AXIS-P3265-SN00103", formFactor: "Outdoor Dome IP66/IK10", weight: "0.95 kg", powerDraw: "12.95W max PoE" },
      software: { os: "AXIS OS", version: "11.8.61", videoCodec: "H.265 + H.264 + MJPEG", analytics: "AXIS Object Analytics (built-in)", edgeStorage: "Continuous recording to 256GB SD", vms: "Milestone XProtect Corporate", onvifProfile: "S, G, T", lastPatched: "2026-01-25" },
      network: { interfaces: [{ name: "Ethernet (PoE)", type: "100 Mbps", status: "active", bandwidth: "100 Mbps", utilization: "28%", vlan: "60" }], streams: [
        { name: "Stream 1 (Recording)", resolution: "1920x1080", fps: 30, bitrate: "4 Mbps" },
        { name: "Stream 2 (Live View)", resolution: "640x480", fps: 15, bitrate: "512 kbps" }
      ], recording: true, motionDetection: true, retentionDays: 30 },
      security: { kpis: { patchCompliance: 90, configCompliance: 88, uptimeSla: 99.5, mttr: "30 min", lastAudit: "2026-01-20" }, authentication: "Digest Auth + HTTPS", firmwareSigned: true, secureBootEnabled: true, edgeEncryption: "AES-256 (SD card)" },
      vulnerabilities: [{ cve: "CVE-2025-0355", severity: "Medium", description: "AXIS OS RTSP buffer overflow", status: "Patched", patchedDate: "2026-01-25" }],
      penTesting: { whitebox: { lastTest: "2025-12-01", result: "Pass", findings: 1, criticalFindings: 0 }, graybox: { lastTest: "2025-09-15", result: "Pass", findings: 2, criticalFindings: 0 }, blackbox: { lastTest: "2025-07-01", result: "Pass", findings: 0, criticalFindings: 0 } },
      applications: [{ name: "Lobby Security Surveillance (24/7)", criticality: "High" }, { name: "Motion-Triggered Alerting", criticality: "High" }, { name: "Object Analytics (People Counting)", criticality: "Medium" }, { name: "VMS Recording (Milestone XProtect)", criticality: "High" }],
      compliance: [{ framework: "PCI DSS 4.0", status: "Compliant", controls: "9.1" }, { framework: "GDPR", status: "Compliant", controls: "Art. 5, Art. 6, Art. 13 (signage)" }, { framework: "ISO 27001", status: "Compliant", controls: "A.11.1.1, A.11.1.2" }]
    } },
  ];

  for (const asset of assets) {
    await storage.createDiscoveredAsset({ ...asset, userId: demoUser.id } as any);
  }

  console.log(`Discovery scenario seeded: ${creds.length} credentials, ${probes.length} probes, ${assets.length} assets`);
}

export async function seedAgentPerformanceMetrics() {
  const [demoUser] = await db.select().from(users).where(eq(users.username, "demo"));
  if (!demoUser) return;

  const existing = await db.select().from(agentPerformanceMetrics).where(eq(agentPerformanceMetrics.userId, demoUser.id));
  if (existing.length > 0) return;

  console.log("Seeding agent performance metrics...");

  const roles = await storage.getOrgRoles();

  const metricsData: Array<{
    roleName: string;
    accuracy: number;
    completion: number;
    hallucination: number;
    drift: number;
    responseTime: number;
    escalation: number;
    tasks: number;
    confidence: number;
  }> = [
    { roleName: "Network Engineer", accuracy: 94, completion: 91, hallucination: 3.2, drift: 4.1, responseTime: 2.8, escalation: 6.5, tasks: 847, confidence: 92 },
    { roleName: "Network Security Engineer", accuracy: 97, completion: 93, hallucination: 1.8, drift: 2.3, responseTime: 3.1, escalation: 4.2, tasks: 612, confidence: 95 },
    { roleName: "Windows System Administrator", accuracy: 92, completion: 89, hallucination: 4.5, drift: 5.2, responseTime: 3.5, escalation: 8.3, tasks: 534, confidence: 90 },
    { roleName: "Linux System Administrator", accuracy: 95, completion: 93, hallucination: 2.1, drift: 3.0, responseTime: 2.2, escalation: 5.1, tasks: 723, confidence: 94 },
    { roleName: "Messaging Administrator", accuracy: 93, completion: 90, hallucination: 3.8, drift: 4.8, responseTime: 3.2, escalation: 7.1, tasks: 412, confidence: 91 },
    { roleName: "Director of Database Administration", accuracy: 96, completion: 94, hallucination: 2.0, drift: 2.5, responseTime: 2.5, escalation: 3.8, tasks: 589, confidence: 95 },
    { roleName: "Vulnerability Management Analyst", accuracy: 91, completion: 87, hallucination: 5.2, drift: 6.1, responseTime: 4.5, escalation: 11.2, tasks: 356, confidence: 88 },
    { roleName: "Penetration Tester", accuracy: 89, completion: 84, hallucination: 6.8, drift: 7.5, responseTime: 5.2, escalation: 14.5, tasks: 278, confidence: 86 },
    { roleName: "Continuous Compliance Monitor", accuracy: 94, completion: 91, hallucination: 3.0, drift: 3.5, responseTime: 3.8, escalation: 6.0, tasks: 445, confidence: 93 },
  ];

  let seededCount = 0;
  for (const data of metricsData) {
    const role = roles.find(r => r.name === data.roleName);
    if (!role) continue;

    const escalatedTasks = Math.round(data.tasks * (data.escalation / 100));

    await storage.createAgentPerformanceMetric({
      agentRoleId: role.id,
      metricPeriod: "monthly",
      accuracyScore: data.accuracy,
      taskCompletionRate: data.completion,
      hallucinationRisk: data.hallucination,
      driftScore: data.drift,
      avgResponseTime: data.responseTime,
      escalationRate: data.escalation,
      tasksCompleted: data.tasks,
      tasksEscalated: escalatedTasks,
      confidenceScore: data.confidence,
      userId: demoUser.id,
    });
    seededCount++;
  }

  console.log(`Agent performance metrics seeded for ${seededCount} agents`);
}

export async function seedAgentNotifications() {
  const [demoUser] = await db.select().from(users).where(eq(users.username, "demo"));
  if (!demoUser) return;

  const existing = await db.select().from(agentNotifications).where(eq(agentNotifications.userId, demoUser.id));
  if (existing.length > 0) return;

  console.log("Seeding agent notifications...");

  const roles = await storage.getOrgRoles();
  const assets = await storage.getDiscoveredAssets(demoUser.id);

  const networkEng = roles.find(r => r.name === "Network Engineer");
  const securityEng = roles.find(r => r.name === "Network Security Engineer");
  const windowsAdmin = roles.find(r => r.name === "Windows System Administrator");
  const linuxAdmin = roles.find(r => r.name === "Linux System Administrator");
  const dbAdmin = roles.find(r => r.name === "Director of Database Administration");
  const messagingAdmin = roles.find(r => r.name === "Messaging Administrator");
  const vulnMgmt = roles.find(r => r.name === "Vulnerability Management Analyst");
  const penTester = roles.find(r => r.name === "Penetration Tester");
  const compliance = roles.find(r => r.name === "Continuous Compliance Monitor");

  const findAsset = (name: string) => assets.find(a => a.name.includes(name));

  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);

  const notifications = [
    {
      agentRoleId: networkEng?.id!,
      assetId: findAsset("CORE-SW")?.id || null,
      type: "issue_detected",
      severity: "high",
      title: "Core Switch Uplink Utilization at 78% — Approaching Threshold",
      description: "CORE-SW-01 uplink interface GigabitEthernet0/1 has sustained 78% utilization over the past 4 hours, exceeding the 70% warning threshold. Traffic analysis shows increased east-west data center traffic from VM migration operations. If utilization reaches 85%, link aggregation failover may be impacted.",
      proposedAction: "Recommend enabling LACP load balancing across trunk group and scheduling traffic analysis during off-peak hours to identify optimization opportunities.",
      actionStatus: "pending",
    },
    {
      agentRoleId: networkEng?.id!,
      assetId: findAsset("CORE-SW")?.id || null,
      type: "action_taken",
      severity: "info",
      title: "Firmware Update Available: Cisco IOS-XE 17.12.3",
      description: "A new firmware version (IOS-XE 17.12.3) is available for CORE-SW-01. The update addresses 3 security advisories including CVE-2025-20356 (CVSS 7.5) related to SSH subsystem vulnerability. Current firmware is 17.09.4a.",
      proposedAction: "Schedule maintenance window for firmware upgrade. Pre-stage image to flash. Estimated downtime: 8 minutes with ISSU support.",
      actionStatus: "pending",
    },
    {
      agentRoleId: securityEng?.id!,
      assetId: findAsset("FW-CORE")?.id || null,
      type: "issue_detected",
      severity: "critical",
      title: "Critical CVE-2025-1023 Detected on Core Firewall — Active Exploit in Wild",
      description: "FortiGate FW-CORE-01 running FortiOS 7.4.3 is vulnerable to CVE-2025-1023 (CVSS 9.8), a remote code execution vulnerability in the SSL VPN web portal. CISA has confirmed active exploitation in the wild. Patch (FortiOS 7.4.5) has been available since February 15, 2026.",
      proposedAction: "Immediately apply FortiOS 7.4.5 patch during emergency maintenance window. As interim mitigation, disable SSL VPN web portal mode and restrict VPN access to IPSec tunnel mode only.",
      actionStatus: "pending",
    },
    {
      agentRoleId: securityEng?.id!,
      assetId: findAsset("IDS")?.id || null,
      type: "status_update",
      severity: "medium",
      title: "IDS False Positive Rate Increased to 12.3% — Tuning Required",
      description: "Suricata IDS sensor false positive rate has increased from 4.2% to 12.3% over the past week following signature update ET-OPEN-2026-02. The majority of false positives are related to rule SID:2035487 (HTTP anomaly detection) triggering on legitimate API traffic to the Exchange server.",
      proposedAction: "Suppress rule SID:2035487 for traffic between internal subnets 10.0.10.0/24 and 10.0.50.0/24. Add threshold to limit alerts to 5 per minute per source IP.",
      actionStatus: "auto_executed",
    },
    {
      agentRoleId: windowsAdmin?.id!,
      assetId: findAsset("AD-DC")?.id || null,
      type: "issue_detected",
      severity: "high",
      title: "Active Directory Domain Controller — 3 Failed Security Patches",
      description: "AD-DC-01 (Windows Server 2022) has 3 pending critical security patches (KB5034765, KB5034766, KB5034770) that failed installation during the last maintenance window. Error code 0x80070005 indicates an access denied issue with Windows Update service. Patch compliance has dropped to 82%.",
      proposedAction: "Reset Windows Update components using DISM tool, clear SoftwareDistribution cache, and retry patch installation. If persistent, deploy patches via SCCM with elevated privileges.",
      actionStatus: "pending",
    },
    {
      agentRoleId: windowsAdmin?.id!,
      assetId: findAsset("AD-DC")?.id || null,
      type: "action_taken",
      severity: "info",
      title: "AD Replication Health Check Completed — All Partners Healthy",
      description: "Automated AD replication health check completed across all domain controllers. Replication latency is within normal parameters (< 15 seconds). No lingering objects detected. SYSVOL replication via DFSR is functioning correctly.",
      proposedAction: null,
      actionStatus: "completed",
    },
    {
      agentRoleId: linuxAdmin?.id!,
      assetId: findAsset("WEB-SRV")?.id || null,
      type: "issue_detected",
      severity: "high",
      title: "Web Server Load Average Exceeding Threshold — 12.4 (8 cores)",
      description: "WEB-SRV-01 (Ubuntu 22.04 LTS) load average has been consistently above 8.0 for the past 2 hours, currently at 12.4. Top processes show Apache worker threads consuming 89% CPU. Access logs indicate a 340% increase in requests to /api/search endpoint suggesting possible DDoS or aggressive scraping.",
      proposedAction: "Enable rate limiting on /api/search endpoint (max 30 req/min per IP). Investigate top source IPs in access logs. Consider enabling Cloudflare WAF rules if traffic is malicious.",
      actionStatus: "pending",
    },
    {
      agentRoleId: linuxAdmin?.id!,
      assetId: findAsset("LOG-SRV")?.id || null,
      type: "issue_detected",
      severity: "medium",
      title: "Log Server Disk Usage at 84% — Projected Full in 12 Days",
      description: "LOG-SRV-01 /var/log partition is at 84% utilization (420GB of 500GB). Current ingestion rate is 3.2GB/day. At this rate, disk will reach 95% critical threshold in approximately 12 days. Largest consumers: syslog (180GB), auditd (95GB), application logs (78GB).",
      proposedAction: "Implement log rotation with 30-day retention for syslog, compress logs older than 7 days. Archive audit logs to cold storage. Consider expanding partition or adding dedicated log storage volume.",
      actionStatus: "pending",
    },
    {
      agentRoleId: dbAdmin?.id!,
      assetId: findAsset("DB-PRIMARY")?.id || null,
      type: "action_proposed",
      severity: "medium",
      title: "Database Backup Verification — Last Verified Restore: 45 Days Ago",
      description: "The last verified backup restore test for DB-PRIMARY-01 (PostgreSQL 15.4) was conducted 45 days ago, exceeding the 30-day policy. Daily backups are completing successfully (last backup: 2 hours ago, 23.4GB), but restore verification is overdue. RPO is currently met but RTO cannot be guaranteed without testing.",
      proposedAction: "Schedule automated backup restore verification to standby server during next maintenance window. Verify point-in-time recovery capability and document RTO metrics.",
      actionStatus: "pending",
    },
    {
      agentRoleId: dbAdmin?.id!,
      assetId: findAsset("DB-PRIMARY")?.id || null,
      type: "status_update",
      severity: "info",
      title: "Query Performance Optimization — 23% Improvement Achieved",
      description: "Automated query analysis identified 4 slow queries exceeding 500ms threshold on DB-PRIMARY-01. Index optimization was applied to the assets_metadata and audit_logs tables. Average query response time improved from 340ms to 262ms (23% improvement). No schema changes required.",
      proposedAction: null,
      actionStatus: "auto_executed",
    },
    {
      agentRoleId: messagingAdmin?.id!,
      assetId: findAsset("EXCH")?.id || null,
      type: "issue_detected",
      severity: "high",
      title: "Exchange Server TLS Certificate Expiring in 18 Days",
      description: "The SSL/TLS certificate for mail.company.com on EXCH-01 (Exchange 2019 CU14) expires on March 22, 2026. AutoDiscover, OWA, and ActiveSync services will be disrupted if the certificate is not renewed. Current certificate is issued by DigiCert with SHA-256 RSA 2048-bit key.",
      proposedAction: "Submit CSR for certificate renewal through DigiCert portal. Deploy renewed certificate to Exchange and update IIS bindings. Test AutoDiscover and mail flow after deployment.",
      actionStatus: "pending",
    },
    {
      agentRoleId: messagingAdmin?.id!,
      assetId: findAsset("EXCH")?.id || null,
      type: "action_taken",
      severity: "low",
      title: "Exchange Queue Health Check — 847 Messages Processed Successfully",
      description: "Automated transport queue health check completed. All submission, delivery, and replay queues are empty. 847 messages processed in the last 24 hours with 0 NDR failures. SMTP relay to O365 hybrid connector is operating normally.",
      proposedAction: null,
      actionStatus: "completed",
    },
    {
      agentRoleId: vulnMgmt?.id!,
      assetId: null,
      type: "issue_detected",
      severity: "critical",
      title: "5 New Critical CVEs Affecting Infrastructure — Immediate Review Required",
      description: "Weekly vulnerability scan completed. 5 new critical vulnerabilities detected across the infrastructure: 2 affecting network devices (FortiOS, Cisco IOS-XE), 1 affecting Windows Server (Print Spooler), 1 affecting PostgreSQL (authentication bypass), 1 affecting BACnet controllers (buffer overflow). Total open vulnerabilities: 23 critical, 47 high.",
      proposedAction: "Prioritize patching by CVSS score and exploitability. FortiOS CVE-2025-1023 (CVSS 9.8) requires immediate action due to active exploitation. Generate patch deployment schedule for remaining CVEs within 72-hour SLA.",
      actionStatus: "pending",
    },
    {
      agentRoleId: vulnMgmt?.id!,
      assetId: null,
      type: "status_update",
      severity: "medium",
      title: "Vulnerability Remediation Progress — 67% of Critical CVEs Addressed",
      description: "Monthly vulnerability remediation report: 15 of 23 critical CVEs have been remediated or mitigated. Mean Time to Remediate (MTTR) for critical vulnerabilities is 8.3 days, above the 7-day SLA target. Key blockers: 3 CVEs require vendor patches not yet available, 2 require maintenance windows.",
      proposedAction: "Escalate vendor-dependent CVEs to support channels. Request emergency maintenance windows for the 2 remaining patchable CVEs.",
      actionStatus: "pending",
    },
    {
      agentRoleId: penTester?.id!,
      assetId: null,
      type: "status_update",
      severity: "medium",
      title: "Q1 2026 Penetration Test Results Ready — 3 Critical Findings",
      description: "Quarterly penetration test completed across all infrastructure segments. 3 critical findings: (1) Default credentials on BAS controller web interface, (2) SQL injection in internal monitoring dashboard, (3) Unrestricted SNMP write access on core switch. 7 high-severity and 12 medium-severity findings also documented.",
      proposedAction: "Remediate 3 critical findings within 72 hours per security policy. Schedule remediation validation retest for end of week. Distribute full report to department managers for high-severity findings.",
      actionStatus: "pending",
    },
    {
      agentRoleId: compliance?.id!,
      assetId: null,
      type: "escalation",
      severity: "high",
      title: "PCI DSS 4.0 Annual Audit in 30 Days — 2 Control Gaps Identified",
      description: "Annual PCI DSS 4.0 audit is scheduled for April 4, 2026. Pre-audit assessment identified 2 control gaps: Requirement 6.4.3 (Content Security Policy headers not enforced on payment page) and Requirement 11.6.1 (Change detection on payment pages not configured). Both gaps were introduced during the Q4 infrastructure migration.",
      proposedAction: "Implement Content-Security-Policy headers on all payment-related endpoints. Deploy file integrity monitoring (FIM) on payment page directories. Complete remediation and evidence collection at least 14 days before audit date.",
      actionStatus: "pending",
    },
    {
      agentRoleId: compliance?.id!,
      assetId: null,
      type: "action_taken",
      severity: "info",
      title: "SOC 2 Type II Evidence Collection — Automated Gathering Complete",
      description: "Automated evidence collection for SOC 2 Type II reporting period (Jan-Feb 2026) completed. 94 of 98 control evidence items gathered automatically. 4 items require manual attestation: business continuity plan review, security awareness training completion, vendor risk assessment updates, and board security briefing minutes.",
      proposedAction: "Request manual attestation from department managers for the 4 remaining evidence items. Deadline: March 15, 2026.",
      actionStatus: "auto_executed",
    },
  ];

  let seededCount = 0;
  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i];
    if (!n.agentRoleId) continue;
    await storage.createAgentNotification({
      ...n,
      userId: demoUser.id,
    } as any);
    seededCount++;
  }

  console.log(`Agent notifications seeded: ${seededCount} notifications`);
}

export async function seedProbeTypes() {
  const [demoUser] = await db.select().from(users).where(eq(users.username, "demo"));
  if (!demoUser) return;

  const existing = await storage.getProbeTypes(demoUser.id);
  const hasCouplingModes = existing.some(t => ["coupled", "semi-autonomous", "autonomous"].includes(t.couplingMode));
  if (hasCouplingModes) return;

  for (const old of existing) {
    await storage.deleteProbeType(old.id);
  }

  console.log("Seeding probe types...");
  const uid = demoUser.id;

  const types = [
    {
      name: "Coupled Agent",
      description: "Traditional agent that requires constant server connectivity. Streams telemetry in real-time and receives instructions directly from the server. Best for environments with reliable, low-latency network connections.",
      icon: "Server",
      color: "text-blue-400",
      protocol: "wmi",
      deploymentModel: "bare-metal",
      couplingMode: "coupled",
      characteristics: ["Real-time telemetry streaming", "Server-driven instructions", "Continuous heartbeat", "Zero local storage", "Immediate command dispatch"],
      requiresEnrollment: true,
      containerImage: null,
      containerResources: null,
      hasLocalReasoning: false,
      bufferCapacity: 0,
      syncStrategy: null,
    },
    {
      name: "Semi-Autonomous Agent",
      description: "Edge-deployed probe with full local AI reasoning on lightweight hardware (Raspberry Pi, drones, edge gateways). Operates independently — collects data, makes local decisions, runs inference — and eventually reconnects to sync results back to the server.",
      icon: "Wifi",
      color: "text-amber-400",
      protocol: "ssh",
      deploymentModel: "embedded",
      couplingMode: "semi-autonomous",
      characteristics: ["Local AI reasoning", "Edge-native deployment", "Offline operation", "Store-and-forward sync", "Eventually reconnects", "Lightweight hardware", "On-device inference"],
      requiresEnrollment: true,
      containerImage: "holocron/probe-edge:latest",
      containerResources: { cpu: "1 core", memory: "1 GB", storage: "8 GB" },
      hasLocalReasoning: true,
      bufferCapacity: 10000,
      syncStrategy: "opportunistic",
    },
    {
      name: "Fully Autonomous Agent",
      description: "Permanently independent probe with full local AI reasoning. Deployed on edge devices or containers with dedicated compute resources. Operates indefinitely without server contact — self-healing, self-deciding, and fully self-sufficient. May never reconnect.",
      icon: "Brain",
      color: "text-purple-400",
      protocol: "ssh",
      deploymentModel: "container",
      couplingMode: "autonomous",
      characteristics: ["Local AI reasoning", "Permanent independence", "Self-healing", "Self-deciding", "No reconnection required", "On-device inference", "Local workflow execution", "Edge-native reasoning"],
      requiresEnrollment: true,
      containerImage: "holocron/probe-autonomous:latest",
      containerResources: { cpu: "2 cores", memory: "4 GB", storage: "20 GB", gpu: "optional" },
      hasLocalReasoning: true,
      bufferCapacity: 50000,
      syncStrategy: "periodic",
    },
  ];

  for (const t of types) {
    await storage.createProbeType({ ...t, userId: uid } as any);
  }

  const seededTypes = await storage.getProbeTypes(uid);
  const coupledType = seededTypes.find(t => t.couplingMode === "coupled");
  if (coupledType) {
    const allProbes = await storage.getDiscoveryProbes(uid);
    for (const probe of allProbes) {
      if (!probe.probeTypeId) {
        await db.update(discoveryProbes)
          .set({ probeTypeId: coupledType.id })
          .where(eq(discoveryProbes.id, probe.id));
      }
    }
  }

  console.log(`Probe types seeded: ${types.length} types`);

  // Always ensure mobile probe types exist (idempotent)
  await seedMobileProbeTypes(uid);
}

export async function seedMobileProbeTypes(userId: string) {
  const existing = await storage.getProbeTypes(userId);
  const hasAndroid = existing.some(t => t.name === "Android Mobile Agent");
  const hasIOS = existing.some(t => t.name === "iOS Mobile Agent");

  if (!hasAndroid) {
    await storage.createProbeType({
      userId,
      name: "Android Mobile Agent",
      description: "Lightweight probe for Android devices running via Termux. Collects hardware telemetry (battery, storage, CPU), installed app inventory, network info, and geolocation. Executes MDM commands (lock, wipe, message, locate, block) dispatched from the HOLOCRON MDM console. Operates in semi-autonomous mode — buffers data offline and syncs on next connection.",
      icon: "Smartphone",
      color: "text-green-400",
      protocol: "https",
      deploymentModel: "mobile",
      couplingMode: "semi-autonomous",
      characteristics: ["Termux-based (no root required)", "Real-time battery & storage telemetry", "Installed app inventory", "Geolocation via termux-api", "MDM command execution", "Offline buffering & store-forward sync", "HMAC-signed requests", "Background wake-lock service"],
      requiresEnrollment: true,
      containerImage: null,
      containerResources: null,
      hasLocalReasoning: false,
      bufferCapacity: 5000,
      syncStrategy: "opportunistic",
      communicationProtocols: [{ type: "https", priority: 1, enabled: true, config: {} }, { type: "mqtt", priority: 2, enabled: false, config: {} }] as any,
    } as any);
    console.log("Seeded Android Mobile Agent probe type");
  }

  if (!hasIOS) {
    await storage.createProbeType({
      userId,
      name: "iOS Mobile Agent",
      description: "Probe for iPhone and iPad devices using a-Shell (App Store, no jailbreak required). Collects hardware info via sysctl, storage via df, network via ifconfig, and app data. Supports one-shot mode for iOS Shortcuts automation (triggered on a schedule). Executes MDM commands from the HOLOCRON console. Full Apple MDM protocol support available via mobileconfig profile.",
      icon: "Smartphone",
      color: "text-blue-400",
      protocol: "https",
      deploymentModel: "mobile",
      couplingMode: "semi-autonomous",
      characteristics: ["a-Shell or SSH based (no jailbreak)", "iOS Shortcuts automation support", "sysctl hardware telemetry", "Storage & network reporting", "One-shot mode for periodic Shortcuts triggers", "MDM command execution", "HMAC-signed communication", "Apple MDM profile enrollment support"],
      requiresEnrollment: true,
      containerImage: null,
      containerResources: null,
      hasLocalReasoning: false,
      bufferCapacity: 2000,
      syncStrategy: "opportunistic",
      communicationProtocols: [{ type: "https", priority: 1, enabled: true, config: {} }, { type: "websocket", priority: 2, enabled: false, config: {} }] as any,
    } as any);
    console.log("Seeded iOS Mobile Agent probe type");
  }
}
