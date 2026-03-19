import { storage, db } from "./storage";
import { sql } from "drizzle-orm";
import { enrichRolesWithJobData } from "./enrich-roles";
import { updateRolePricing } from "./role-pricing";

interface RoleDef {
  name: string;
  title: string;
  level: string;
  description: string;
  responsibilities: string[];
  aiCapabilities: string[];
  icon: string;
  color: string;
  monthlyPrice: number;
  isSubscribable: boolean;
  children?: (RoleDef & { division?: string })[];
  division?: string;
}

const departments: { name: string; icon: string; color: string; roles: RoleDef }[] = [
  {
    name: "Infrastructure & Cloud Operations",
    icon: "Server",
    color: "#3b82f6",
    roles: {
      name: "VP of Infrastructure & Cloud Operations",
      title: "VP of Infrastructure & Cloud Operations",
      level: "vp",
      description: "Owns all physical, virtual, and cloud infrastructure including datacenter, network, server, and IoT operations.",
      responsibilities: ["Infrastructure strategy", "Cloud operations oversight", "Datacenter management", "Budget planning"],
      aiCapabilities: ["Infrastructure health scoring", "Capacity forecasting", "Cost optimization", "Cross-team coordination"],
      icon: "Server",
      color: "#3b82f6",
      monthlyPrice: 15000,
      isSubscribable: true,
      children: [
        {
          name: "Director of Network Operations",
          title: "Director of Network Operations",
          level: "director",
          division: "Network Operations",
          description: "Manages all network infrastructure including WAN/LAN, SD-WAN, firewalls, and load balancers.",
          responsibilities: ["Network architecture oversight", "Firewall policy management", "WAN/LAN planning", "Vendor management"],
          aiCapabilities: ["Network topology analysis", "Traffic pattern optimization", "Anomaly detection", "Capacity planning"],
          icon: "Network",
          color: "#6366f1",
          monthlyPrice: 8000,
          isSubscribable: true,
          children: [
            { name: "Network Architect", title: "Network Architect", level: "senior", division: "Network Operations", description: "Designs WAN/LAN/SD-WAN topologies, redundancy planning, and network security architecture.", responsibilities: ["Network design", "Redundancy planning", "SD-WAN architecture", "Security zones"], aiCapabilities: ["Topology optimization", "Redundancy analysis", "Traffic simulation", "Cost modeling"], icon: "GitBranch", color: "#6366f1", monthlyPrice: 5000, isSubscribable: true },
            { name: "Senior Network Engineer", title: "Senior Network Engineer", level: "senior", division: "Network Operations", description: "Configures routers, switches, firewalls, and load balancers across the enterprise.", responsibilities: ["Router/switch configuration", "Firewall rules", "Load balancer management", "BGP/OSPF routing"], aiCapabilities: ["Config generation", "Rule optimization", "Route analysis", "Performance tuning"], icon: "Network", color: "#6366f1", monthlyPrice: 4500, isSubscribable: true },
            { name: "Network Engineer", title: "Network Engineer", level: "mid", division: "Network Operations", description: "Day-to-day routing, VLAN management, ACLs, and QoS policy implementation.", responsibilities: ["VLAN management", "ACL configuration", "QoS policies", "Troubleshooting"], aiCapabilities: ["Automated VLAN provisioning", "ACL audit", "QoS optimization", "Fault isolation"], icon: "Network", color: "#6366f1", monthlyPrice: 3500, isSubscribable: true },
            { name: "Wireless Network Engineer", title: "Wireless Network Engineer", level: "mid", division: "Network Operations", description: "Manages Wi-Fi controllers, access points, and spectrum analysis.", responsibilities: ["AP deployment", "WiFi optimization", "Spectrum management", "Guest network"], aiCapabilities: ["RF optimization", "Channel selection", "Interference detection", "Coverage mapping"], icon: "Wifi", color: "#6366f1", monthlyPrice: 3500, isSubscribable: true },
            { name: "Network Security Engineer", title: "Network Security Engineer", level: "mid", division: "Network Operations", description: "Manages firewall rules, IDS/IPS tuning, VPN configuration, and micro-segmentation.", responsibilities: ["Firewall management", "IDS/IPS tuning", "VPN setup", "Micro-segmentation"], aiCapabilities: ["Rule conflict detection", "Threat signature updates", "VPN monitoring", "Zero-trust enforcement"], icon: "ShieldCheck", color: "#6366f1", monthlyPrice: 4000, isSubscribable: true },
            { name: "DNS/DHCP Administrator", title: "DNS/DHCP Administrator", level: "mid", division: "Network Operations", description: "Manages DNS zones, IPAM, and DHCP scoping across the enterprise.", responsibilities: ["DNS zone management", "DHCP scoping", "IPAM administration", "Record maintenance"], aiCapabilities: ["DNS health monitoring", "Scope optimization", "Conflict detection", "Auto-provisioning"], icon: "Globe", color: "#6366f1", monthlyPrice: 2800, isSubscribable: true },
            { name: "Telecom Engineer", title: "Telecom Engineer", level: "mid", division: "Network Operations", description: "Manages SIP trunks, MPLS circuits, ISP relationships, and bandwidth provisioning.", responsibilities: ["SIP trunk management", "MPLS circuits", "ISP coordination", "Bandwidth planning"], aiCapabilities: ["Call quality monitoring", "Circuit health tracking", "Cost optimization", "Capacity forecasting"], icon: "Phone", color: "#6366f1", monthlyPrice: 3000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Cloud & Datacenter",
          title: "Director of Cloud & Datacenter",
          level: "director",
          division: "Cloud & Datacenter",
          description: "Manages multi-cloud strategy and datacenter operations including virtualization and storage.",
          responsibilities: ["Cloud strategy", "Datacenter operations", "Virtualization management", "DR planning"],
          aiCapabilities: ["Cloud cost optimization", "Resource rightsizing", "Multi-cloud orchestration", "DR automation"],
          icon: "Cloud",
          color: "#0ea5e9",
          monthlyPrice: 8000,
          isSubscribable: true,
          children: [
            { name: "Cloud Architect", title: "Cloud Architect", level: "senior", division: "Cloud & Datacenter", description: "Designs multi-cloud strategy across AWS, Azure, GCP with landing zones and cost optimization.", responsibilities: ["Multi-cloud design", "Landing zones", "Cost optimization", "Security architecture"], aiCapabilities: ["Architecture recommendations", "Cost modeling", "Security posture scoring", "Migration planning"], icon: "Cloud", color: "#0ea5e9", monthlyPrice: 5500, isSubscribable: true },
            { name: "Senior Cloud Engineer (AWS)", title: "Senior Cloud Engineer (AWS)", level: "senior", division: "Cloud & Datacenter", description: "Manages AWS services: EC2, EKS, RDS, Lambda, CloudFormation, IAM.", responsibilities: ["EC2/EKS management", "RDS administration", "Lambda functions", "IAM policies"], aiCapabilities: ["Resource optimization", "Cost anomaly detection", "Auto-scaling policies", "Security auditing"], icon: "Cloud", color: "#ff9900", monthlyPrice: 4500, isSubscribable: true },
            { name: "Senior Cloud Engineer (Azure)", title: "Senior Cloud Engineer (Azure)", level: "senior", division: "Cloud & Datacenter", description: "Manages Azure VMs, AKS, Azure AD, ARM templates, and Sentinel.", responsibilities: ["Azure VM management", "AKS clusters", "Azure AD", "ARM templates"], aiCapabilities: ["Resource rightsizing", "Policy compliance", "Cost tracking", "Identity analysis"], icon: "Cloud", color: "#0078d4", monthlyPrice: 4500, isSubscribable: true },
            { name: "Senior Cloud Engineer (GCP)", title: "Senior Cloud Engineer (GCP)", level: "senior", division: "Cloud & Datacenter", description: "Manages Compute Engine, GKE, BigQuery, and Cloud Functions.", responsibilities: ["GCE management", "GKE clusters", "BigQuery", "Cloud Functions"], aiCapabilities: ["Workload optimization", "Query cost analysis", "Auto-scaling", "Security scanning"], icon: "Cloud", color: "#4285f4", monthlyPrice: 4500, isSubscribable: true },
            { name: "Virtualization Engineer", title: "Virtualization Engineer", level: "mid", division: "Cloud & Datacenter", description: "Manages VMware vSphere, ESXi, vCenter, HyperV, and resource pools.", responsibilities: ["vSphere administration", "VM provisioning", "Resource pools", "Template management"], aiCapabilities: ["VM right-sizing", "Resource balancing", "Snapshot management", "Performance monitoring"], icon: "Box", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
            { name: "Storage Engineer", title: "Storage Engineer", level: "mid", division: "Cloud & Datacenter", description: "Manages SAN/NAS, NetApp, Pure Storage, backup targets, and replication.", responsibilities: ["SAN/NAS management", "Replication setup", "Performance tuning", "Capacity planning"], aiCapabilities: ["Tiering optimization", "IOPS analysis", "Capacity forecasting", "Health monitoring"], icon: "HardDrive", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
            { name: "Backup & DR Engineer", title: "Backup & Disaster Recovery Engineer", level: "mid", division: "Cloud & Datacenter", description: "Manages Veeam, Commvault, DR runbooks, and RTO/RPO testing.", responsibilities: ["Backup scheduling", "DR runbooks", "RTO/RPO testing", "Recovery validation"], aiCapabilities: ["Backup health monitoring", "DR readiness scoring", "Recovery simulation", "Gap analysis"], icon: "Database", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
            { name: "Datacenter Technician", title: "Datacenter Technician", level: "junior", division: "Cloud & Datacenter", description: "Physical rack/stack, cabling, power distribution, and hardware replacement.", responsibilities: ["Rack installation", "Cable management", "Power distribution", "Hardware swap"], aiCapabilities: ["Asset tracking", "Power monitoring", "Cable mapping", "Maintenance scheduling"], icon: "Wrench", color: "#0ea5e9", monthlyPrice: 2000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Server Administration",
          title: "Director of Server Administration",
          level: "director",
          division: "Server Administration",
          description: "Manages all server infrastructure including Linux, Windows, and Unix administration.",
          responsibilities: ["Server fleet management", "OS standardization", "Patch coordination", "Performance optimization"],
          aiCapabilities: ["Fleet health scoring", "Patch risk assessment", "Config drift detection", "Capacity planning"],
          icon: "Server",
          color: "#22c55e",
          monthlyPrice: 7500,
          isSubscribable: true,
          children: [
            { name: "Senior Linux System Administrator", title: "Senior Linux System Administrator", level: "senior", division: "Server Administration", description: "RHEL, Ubuntu, CentOS — kernel tuning, systemd, package management, security hardening.", responsibilities: ["Kernel tuning", "Package management", "Security hardening", "Performance optimization"], aiCapabilities: ["Auto-patching", "Config management", "Log analysis", "Performance tuning"], icon: "Terminal", color: "#22c55e", monthlyPrice: 4500, isSubscribable: true },
            { name: "Linux System Administrator", title: "Linux System Administrator", level: "mid", division: "Server Administration", description: "Patching, user management, log rotation, cron jobs, SSH hardening.", responsibilities: ["Patching", "User management", "Log rotation", "SSH configuration"], aiCapabilities: ["Automated patching", "User provisioning", "Log monitoring", "Access auditing"], icon: "Terminal", color: "#22c55e", monthlyPrice: 3500, isSubscribable: true },
            { name: "Senior Windows System Administrator", title: "Senior Windows System Administrator", level: "senior", division: "Server Administration", description: "Active Directory, Group Policy, WSUS, Windows Server clustering.", responsibilities: ["AD management", "Group Policy", "WSUS administration", "Cluster management"], aiCapabilities: ["GPO analysis", "AD health monitoring", "Patch compliance", "Cluster failover testing"], icon: "Monitor", color: "#22c55e", monthlyPrice: 4500, isSubscribable: true },
            { name: "Windows System Administrator", title: "Windows System Administrator", level: "mid", division: "Server Administration", description: "Domain joins, print servers, file shares, Windows patching.", responsibilities: ["Domain management", "Print services", "File shares", "Windows patching"], aiCapabilities: ["Auto domain join", "Print queue monitoring", "Share permissions audit", "Patch deployment"], icon: "Monitor", color: "#22c55e", monthlyPrice: 3500, isSubscribable: true },
            { name: "Unix System Administrator", title: "Unix System Administrator", level: "mid", division: "Server Administration", description: "AIX, Solaris, HP-UX legacy system management and migration planning.", responsibilities: ["AIX administration", "Solaris management", "HP-UX support", "Migration planning"], aiCapabilities: ["Legacy monitoring", "Migration assessment", "Compatibility testing", "Risk analysis"], icon: "Terminal", color: "#22c55e", monthlyPrice: 3500, isSubscribable: true },
            { name: "Configuration Management Engineer", title: "Configuration Management Engineer", level: "mid", division: "Server Administration", description: "Ansible, Puppet, Chef, Terraform — infrastructure-as-code for server fleet.", responsibilities: ["Ansible playbooks", "Terraform modules", "Config standardization", "IaC pipelines"], aiCapabilities: ["Drift detection", "Playbook generation", "Compliance validation", "Change impact analysis"], icon: "FileCode", color: "#22c55e", monthlyPrice: 4000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Database Administration",
          title: "Director of Database Administration",
          level: "director",
          division: "Database Administration",
          description: "Manages all database infrastructure including SQL, NoSQL, and replication strategies.",
          responsibilities: ["Database strategy", "HA/DR planning", "Performance oversight", "License management"],
          aiCapabilities: ["Query optimization AI", "Capacity forecasting", "Failover automation", "Performance scoring"],
          icon: "Database",
          color: "#f59e0b",
          monthlyPrice: 8000,
          isSubscribable: true,
          children: [
            { name: "Senior DBA (SQL)", title: "Senior Database Administrator (SQL)", level: "senior", division: "Database Administration", description: "SQL Server, PostgreSQL, MySQL — performance tuning, replication, HA/DR.", responsibilities: ["Query optimization", "Replication setup", "HA configuration", "Backup management"], aiCapabilities: ["Query analysis", "Index recommendations", "Replication monitoring", "Automated backups"], icon: "Database", color: "#f59e0b", monthlyPrice: 5000, isSubscribable: true },
            { name: "DBA (SQL)", title: "Database Administrator (SQL)", level: "mid", division: "Database Administration", description: "Backups, index maintenance, query optimization, user provisioning.", responsibilities: ["Index maintenance", "Backup verification", "User management", "Performance monitoring"], aiCapabilities: ["Auto-indexing", "Backup validation", "Permission auditing", "Slow query detection"], icon: "Database", color: "#f59e0b", monthlyPrice: 3500, isSubscribable: true },
            { name: "Senior DBA (NoSQL)", title: "Senior Database Administrator (NoSQL)", level: "senior", division: "Database Administration", description: "MongoDB, Cassandra, Redis, Elasticsearch cluster management.", responsibilities: ["Cluster management", "Sharding strategy", "Replication", "Performance tuning"], aiCapabilities: ["Shard balancing", "Cluster health monitoring", "Cache optimization", "Query profiling"], icon: "Database", color: "#f59e0b", monthlyPrice: 5000, isSubscribable: true },
            { name: "Database Reliability Engineer", title: "Database Reliability Engineer", level: "mid", division: "Database Administration", description: "Automated failover, connection pooling, schema migration pipelines.", responsibilities: ["Failover automation", "Connection pooling", "Schema migrations", "Monitoring"], aiCapabilities: ["Failover orchestration", "Pool optimization", "Migration validation", "Uptime tracking"], icon: "Database", color: "#f59e0b", monthlyPrice: 4000, isSubscribable: true },
            { name: "Data Replication Specialist", title: "Data Replication Specialist", level: "mid", division: "Database Administration", description: "Cross-region replication, CDC pipelines, data consistency verification.", responsibilities: ["Cross-region replication", "CDC pipelines", "Consistency checks", "Lag monitoring"], aiCapabilities: ["Replication monitoring", "Lag alerting", "Consistency validation", "Conflict resolution"], icon: "RefreshCw", color: "#f59e0b", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
        {
          name: "Director of IoT & Edge Computing",
          title: "Director of IoT & Edge Computing",
          level: "director",
          division: "IoT & Edge",
          description: "Manages all IoT devices, edge infrastructure, building management, and industrial control systems.",
          responsibilities: ["IoT strategy", "Edge computing", "BMS oversight", "ICS security"],
          aiCapabilities: ["Device fleet management", "Sensor analytics", "Firmware orchestration", "Anomaly detection"],
          icon: "Cpu",
          color: "#ec4899",
          monthlyPrice: 7500,
          isSubscribable: true,
          children: [
            { name: "IoT Solutions Architect", title: "IoT Solutions Architect", level: "senior", division: "IoT & Edge", description: "Designs sensor network architectures, edge gateway selection, and protocol strategies.", responsibilities: ["Sensor network design", "Gateway selection", "Protocol strategy", "Scalability planning"], aiCapabilities: ["Architecture recommendations", "Protocol optimization", "Scalability modeling", "Cost analysis"], icon: "Cpu", color: "#ec4899", monthlyPrice: 5000, isSubscribable: true },
            { name: "IoT Platform Engineer", title: "IoT Platform Engineer", level: "mid", division: "IoT & Edge", description: "MQTT broker management, device provisioning, firmware OTA pipelines.", responsibilities: ["MQTT administration", "Device provisioning", "OTA updates", "Data pipeline management"], aiCapabilities: ["Broker monitoring", "Auto-provisioning", "Firmware validation", "Data flow optimization"], icon: "Cpu", color: "#ec4899", monthlyPrice: 3800, isSubscribable: true },
            { name: "Embedded Systems Engineer", title: "Embedded Systems Engineer", level: "mid", division: "IoT & Edge", description: "Firmware development, microcontroller programming, RTOS management.", responsibilities: ["Firmware development", "MCU programming", "RTOS configuration", "Hardware interfacing"], aiCapabilities: ["Code analysis", "Power optimization", "Timing analysis", "Test automation"], icon: "Cpu", color: "#ec4899", monthlyPrice: 4000, isSubscribable: true },
            { name: "Edge Computing Engineer", title: "Edge Computing Engineer", level: "mid", division: "IoT & Edge", description: "Edge node deployment, K3s, local processing, and edge-cloud synchronization.", responsibilities: ["Edge deployment", "K3s management", "Local processing", "Cloud sync"], aiCapabilities: ["Workload placement", "Sync optimization", "Resource monitoring", "Latency analysis"], icon: "Cpu", color: "#ec4899", monthlyPrice: 3800, isSubscribable: true },
            { name: "BMS Engineer", title: "Building Management Systems Engineer", level: "mid", division: "IoT & Edge", description: "HVAC controls, lighting automation, access control integration.", responsibilities: ["HVAC management", "Lighting control", "Access systems", "Energy optimization"], aiCapabilities: ["Energy optimization", "Comfort modeling", "Predictive maintenance", "Access pattern analysis"], icon: "Building", color: "#ec4899", monthlyPrice: 3500, isSubscribable: true },
            { name: "ICS Engineer", title: "Industrial Control Systems Engineer", level: "mid", division: "IoT & Edge", description: "SCADA systems, PLCs, Modbus/OPC-UA protocol management.", responsibilities: ["SCADA management", "PLC programming", "Protocol configuration", "Safety systems"], aiCapabilities: ["Process monitoring", "Anomaly detection", "Safety validation", "Protocol translation"], icon: "Cog", color: "#ec4899", monthlyPrice: 4000, isSubscribable: true },
          ],
        },
        {
          name: "NOC Manager",
          title: "NOC Manager",
          level: "manager",
          division: "NOC",
          description: "Manages the 24/7 Network Operations Center for monitoring, triage, and escalation.",
          responsibilities: ["NOC staffing", "Escalation management", "Monitoring strategy", "SLA adherence"],
          aiCapabilities: ["Alert correlation", "Intelligent triage", "Escalation automation", "Shift optimization"],
          icon: "Eye",
          color: "#8b5cf6",
          monthlyPrice: 6000,
          isSubscribable: true,
          children: [
            { name: "NOC Team Lead (Day)", title: "NOC Team Lead (Day Shift)", level: "lead", division: "NOC", description: "Supervises daytime NOC operations, escalation decisions, SLA tracking.", responsibilities: ["Shift supervision", "Escalation decisions", "SLA tracking", "Team coordination"], aiCapabilities: ["Workload balancing", "Priority scoring", "SLA prediction", "Alert grouping"], icon: "Eye", color: "#8b5cf6", monthlyPrice: 4000, isSubscribable: true },
            { name: "NOC Team Lead (Night)", title: "NOC Team Lead (Night Shift)", level: "lead", division: "NOC", description: "Overnight NOC coverage, on-call coordination, critical incident command.", responsibilities: ["Night shift supervision", "On-call coordination", "Critical incident handling", "Handoff management"], aiCapabilities: ["Reduced-staffing optimization", "Auto-triage", "Severity scoring", "Escalation triggers"], icon: "Moon", color: "#8b5cf6", monthlyPrice: 4000, isSubscribable: true },
            { name: "NOC Analyst Level 1", title: "NOC Analyst Level 1", level: "junior", division: "NOC", description: "Alert monitoring, initial triage, runbook execution for standard events.", responsibilities: ["Alert monitoring", "Initial triage", "Runbook execution", "Ticket creation"], aiCapabilities: ["Auto-triage", "Runbook automation", "Alert deduplication", "Pattern recognition"], icon: "Eye", color: "#8b5cf6", monthlyPrice: 2500, isSubscribable: true },
            { name: "NOC Analyst Level 2", title: "NOC Analyst Level 2", level: "mid", division: "NOC", description: "Deeper investigation, correlation analysis, vendor coordination.", responsibilities: ["Deep investigation", "Correlation analysis", "Vendor coordination", "Incident documentation"], aiCapabilities: ["Root cause analysis", "Multi-source correlation", "Knowledge retrieval", "Impact assessment"], icon: "Eye", color: "#8b5cf6", monthlyPrice: 3000, isSubscribable: true },
            { name: "NOC Analyst Level 3", title: "NOC Analyst Level 3", level: "senior", division: "NOC", description: "Complex troubleshooting, root cause during outages, war room leadership.", responsibilities: ["Complex troubleshooting", "War room leadership", "Post-mortem analysis", "Process improvement"], aiCapabilities: ["Advanced diagnostics", "Predictive failure analysis", "Automated remediation", "War room coordination"], icon: "Eye", color: "#8b5cf6", monthlyPrice: 4000, isSubscribable: true },
            { name: "Monitoring Tools Engineer", title: "Monitoring Tools Engineer", level: "mid", division: "NOC", description: "Nagios, Zabbix, PRTG, Datadog, Prometheus/Grafana configuration and maintenance.", responsibilities: ["Tool configuration", "Dashboard creation", "Alert rules", "Integration management"], aiCapabilities: ["Alert tuning", "Dashboard generation", "Threshold optimization", "Tool integration"], icon: "BarChart", color: "#8b5cf6", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
      ],
    },
  },
  {
    name: "Cybersecurity",
    icon: "Shield",
    color: "#ef4444",
    roles: {
      name: "VP of Cybersecurity (CISO)",
      title: "VP of Cybersecurity (CISO)",
      level: "vp",
      description: "Owns security posture, threat management, compliance, and risk across the entire organization.",
      responsibilities: ["Security strategy", "Risk management", "Compliance oversight", "Board reporting"],
      aiCapabilities: ["Threat landscape analysis", "Risk scoring", "Compliance dashboards", "Executive briefings"],
      icon: "Shield",
      color: "#ef4444",
      monthlyPrice: 15000,
      isSubscribable: true,
      children: [
        {
          name: "Director of Security Operations (SOC)",
          title: "Director of Security Operations (SOC)",
          level: "director",
          division: "SOC",
          description: "Manages the Security Operations Center including threat detection, incident response, and forensics.",
          responsibilities: ["SOC operations", "Threat detection strategy", "IR planning", "Tool evaluation"],
          aiCapabilities: ["Threat correlation", "Attack chain analysis", "Automated response", "Intel integration"],
          icon: "Shield",
          color: "#ef4444",
          monthlyPrice: 8500,
          isSubscribable: true,
          children: [
            { name: "SOC Manager", title: "SOC Manager", level: "manager", division: "SOC", description: "SOC staffing, process improvement, playbook development, and metrics tracking.", responsibilities: ["SOC staffing", "Process improvement", "Playbook development", "KPI tracking"], aiCapabilities: ["Analyst productivity tracking", "Playbook optimization", "Coverage gap analysis", "Training recommendations"], icon: "Shield", color: "#ef4444", monthlyPrice: 5500, isSubscribable: true },
            { name: "SOC Analyst Level 1", title: "SOC Analyst Level 1", level: "junior", division: "SOC", description: "Alert triage, initial investigation, false positive filtering.", responsibilities: ["Alert triage", "Initial investigation", "False positive filtering", "Ticket creation"], aiCapabilities: ["Auto-triage", "False positive detection", "IOC lookup", "Alert enrichment"], icon: "Shield", color: "#ef4444", monthlyPrice: 2500, isSubscribable: true },
            { name: "SOC Analyst Level 2", title: "SOC Analyst Level 2", level: "mid", division: "SOC", description: "Deep-dive analysis, malware triage, IOC correlation.", responsibilities: ["Deep analysis", "Malware triage", "IOC correlation", "Escalation decisions"], aiCapabilities: ["Behavioral analysis", "Malware classification", "IOC correlation", "Attack pattern matching"], icon: "Shield", color: "#ef4444", monthlyPrice: 3500, isSubscribable: true },
            { name: "SOC Analyst Level 3 / Threat Hunter", title: "SOC Analyst Level 3 / Threat Hunter", level: "senior", division: "SOC", description: "Proactive threat hunting, adversary emulation, MITRE ATT&CK mapping.", responsibilities: ["Threat hunting", "Adversary emulation", "ATT&CK mapping", "Detection engineering"], aiCapabilities: ["Proactive hunting", "TTP detection", "ATT&CK automation", "Hypothesis generation"], icon: "Search", color: "#ef4444", monthlyPrice: 5000, isSubscribable: true },
            { name: "SIEM Engineer", title: "SIEM Engineer", level: "mid", division: "SOC", description: "Splunk, QRadar, Sentinel — rule authoring, log source onboarding, parser development.", responsibilities: ["Rule authoring", "Log onboarding", "Parser development", "Correlation rules"], aiCapabilities: ["Auto-rule generation", "Log normalization", "Parser creation", "Alert optimization"], icon: "BarChart", color: "#ef4444", monthlyPrice: 4000, isSubscribable: true },
            { name: "Incident Response Lead", title: "Incident Response Lead", level: "senior", division: "SOC", description: "IR plan execution, containment, eradication, evidence preservation.", responsibilities: ["IR execution", "Containment", "Eradication", "Evidence preservation"], aiCapabilities: ["Auto-containment", "Playbook execution", "Timeline reconstruction", "Impact analysis"], icon: "AlertTriangle", color: "#ef4444", monthlyPrice: 5000, isSubscribable: true },
            { name: "Digital Forensics Analyst", title: "Digital Forensics Analyst", level: "senior", division: "SOC", description: "Disk/memory forensics, chain of custody, litigation support.", responsibilities: ["Disk forensics", "Memory analysis", "Chain of custody", "Report writing"], aiCapabilities: ["Artifact extraction", "Timeline analysis", "Malware deobfuscation", "Evidence correlation"], icon: "Search", color: "#ef4444", monthlyPrice: 4500, isSubscribable: true },
            { name: "Threat Intelligence Analyst", title: "Threat Intelligence Analyst", level: "mid", division: "SOC", description: "IOC feeds, dark web monitoring, APT tracking, intelligence reports.", responsibilities: ["IOC management", "Dark web monitoring", "APT tracking", "Intel reporting"], aiCapabilities: ["Feed aggregation", "Dark web scanning", "APT profiling", "Automated reporting"], icon: "Eye", color: "#ef4444", monthlyPrice: 4000, isSubscribable: true },
          ],
        },
        {
          name: "Director of GRC",
          title: "Director of Governance, Risk & Compliance",
          level: "director",
          division: "GRC",
          description: "Manages compliance with regulatory frameworks, risk assessment, and audit coordination.",
          responsibilities: ["Framework alignment", "Risk management", "Audit coordination", "Policy governance"],
          aiCapabilities: ["Compliance scoring", "Risk quantification", "Audit automation", "Policy gap analysis"],
          icon: "FileCheck",
          color: "#14b8a6",
          monthlyPrice: 8000,
          isSubscribable: true,
          children: [
            { name: "GRC Manager", title: "GRC Manager", level: "manager", division: "GRC", description: "Framework alignment, audit coordination, risk register maintenance.", responsibilities: ["Framework management", "Audit coordination", "Risk register", "Control testing"], aiCapabilities: ["Control mapping", "Risk scoring", "Evidence collection", "Gap identification"], icon: "FileCheck", color: "#14b8a6", monthlyPrice: 5000, isSubscribable: true },
            { name: "Compliance Analyst (SOC2)", title: "Compliance Analyst (SOC2)", level: "mid", division: "GRC", description: "SOC2 Type II evidence collection, control testing, auditor liaison.", responsibilities: ["Evidence collection", "Control testing", "Auditor liaison", "Gap remediation"], aiCapabilities: ["Auto-evidence collection", "Control monitoring", "Compliance scoring", "Report generation"], icon: "FileCheck", color: "#14b8a6", monthlyPrice: 3500, isSubscribable: true },
            { name: "Compliance Analyst (ISO 27001)", title: "Compliance Analyst (ISO 27001)", level: "mid", division: "GRC", description: "ISMS documentation, internal audits, corrective action tracking.", responsibilities: ["ISMS documentation", "Internal audits", "Corrective actions", "Certification maintenance"], aiCapabilities: ["Documentation automation", "Audit scheduling", "Non-conformity tracking", "Continuous monitoring"], icon: "FileCheck", color: "#14b8a6", monthlyPrice: 3500, isSubscribable: true },
            { name: "Compliance Analyst (HIPAA/PCI-DSS)", title: "Compliance Analyst (HIPAA/PCI-DSS)", level: "mid", division: "GRC", description: "PHI/PII controls, cardholder data environment scoping.", responsibilities: ["PHI/PII controls", "CDE scoping", "SAQ management", "Breach notification"], aiCapabilities: ["Data flow mapping", "Scope validation", "Control testing", "Breach detection"], icon: "FileCheck", color: "#14b8a6", monthlyPrice: 3500, isSubscribable: true },
            { name: "Risk Analyst", title: "Risk Analyst", level: "mid", division: "GRC", description: "Risk assessments, business impact analysis, risk treatment plans.", responsibilities: ["Risk assessments", "BIA", "Treatment plans", "Risk reporting"], aiCapabilities: ["Risk quantification", "Impact modeling", "Threat assessment", "Risk trending"], icon: "AlertTriangle", color: "#14b8a6", monthlyPrice: 3500, isSubscribable: true },
            { name: "Policy & Standards Writer", title: "Policy & Standards Writer", level: "mid", division: "GRC", description: "Security policies, acceptable use, data classification standards.", responsibilities: ["Policy authoring", "Standards development", "Classification schemes", "Policy review cycles"], aiCapabilities: ["Policy drafting", "Gap analysis", "Compliance mapping", "Version management"], icon: "FileText", color: "#14b8a6", monthlyPrice: 3000, isSubscribable: true },
            { name: "Privacy Officer", title: "Privacy Officer", level: "senior", division: "GRC", description: "GDPR, CCPA compliance, data subject requests, privacy impact assessments.", responsibilities: ["GDPR compliance", "CCPA adherence", "DSAR processing", "PIA management"], aiCapabilities: ["Data mapping", "DSAR automation", "PIA workflows", "Consent tracking"], icon: "Lock", color: "#14b8a6", monthlyPrice: 4500, isSubscribable: true },
            { name: "Audit Coordinator", title: "Audit Coordinator", level: "mid", division: "GRC", description: "Internal audit scheduling, evidence gathering, finding remediation tracking.", responsibilities: ["Audit scheduling", "Evidence gathering", "Finding tracking", "Remediation coordination"], aiCapabilities: ["Audit planning", "Evidence automation", "Finding prioritization", "Remediation tracking"], icon: "ClipboardList", color: "#14b8a6", monthlyPrice: 3000, isSubscribable: true },
          ],
        },
        {
          name: "Director of IAM",
          title: "Director of Identity & Access Management",
          level: "director",
          division: "IAM",
          description: "Manages identity, authentication, authorization, and privileged access across the enterprise.",
          responsibilities: ["IAM strategy", "Zero trust architecture", "PAM oversight", "SSO management"],
          aiCapabilities: ["Access anomaly detection", "Privilege analysis", "Identity risk scoring", "SSO optimization"],
          icon: "Key",
          color: "#f97316",
          monthlyPrice: 7500,
          isSubscribable: true,
          children: [
            { name: "IAM Architect", title: "IAM Architect", level: "senior", division: "IAM", description: "Zero trust architecture, identity federation, SSO strategy design.", responsibilities: ["Zero trust design", "Federation architecture", "SSO strategy", "Access models"], aiCapabilities: ["Architecture analysis", "Trust scoring", "Federation optimization", "Policy simulation"], icon: "Key", color: "#f97316", monthlyPrice: 5000, isSubscribable: true },
            { name: "Senior IAM Engineer", title: "Senior IAM Engineer", level: "senior", division: "IAM", description: "Okta, Azure AD, Ping Identity — SAML/OIDC configuration and management.", responsibilities: ["IdP management", "SAML/OIDC config", "Federation setup", "Protocol troubleshooting"], aiCapabilities: ["Config validation", "Protocol analysis", "Federation monitoring", "SSO health checks"], icon: "Key", color: "#f97316", monthlyPrice: 4500, isSubscribable: true },
            { name: "IAM Engineer", title: "IAM Engineer", level: "mid", division: "IAM", description: "User provisioning, group management, access reviews, joiner/mover/leaver workflows.", responsibilities: ["User provisioning", "Group management", "Access reviews", "JML workflows"], aiCapabilities: ["Auto-provisioning", "Role mining", "Access certification", "Orphan detection"], icon: "Key", color: "#f97316", monthlyPrice: 3500, isSubscribable: true },
            { name: "PAM Engineer", title: "Privileged Access Management Engineer", level: "mid", division: "IAM", description: "CyberArk, BeyondTrust — vault management, session recording, JIT access.", responsibilities: ["Vault management", "Session recording", "JIT access", "Credential rotation"], aiCapabilities: ["Credential rotation", "Session analysis", "JIT automation", "Risk-based access"], icon: "Lock", color: "#f97316", monthlyPrice: 4000, isSubscribable: true },
            { name: "Certificate & PKI Admin", title: "Certificate & PKI Administrator", level: "mid", division: "IAM", description: "Internal CA management, certificate lifecycle, code signing.", responsibilities: ["CA management", "Cert lifecycle", "Code signing", "Key management"], aiCapabilities: ["Expiry tracking", "Auto-renewal", "Chain validation", "Key rotation"], icon: "Key", color: "#f97316", monthlyPrice: 3500, isSubscribable: true },
            { name: "MFA Specialist", title: "MFA/Authentication Specialist", level: "mid", division: "IAM", description: "MFA rollout, passwordless authentication, FIDO2/WebAuthn.", responsibilities: ["MFA deployment", "Passwordless auth", "FIDO2 management", "User enrollment"], aiCapabilities: ["Enrollment tracking", "Auth analytics", "Risk-based MFA", "Device trust scoring"], icon: "Fingerprint", color: "#f97316", monthlyPrice: 3000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Security Engineering",
          title: "Director of Security Architecture & Engineering",
          level: "director",
          division: "Security Engineering",
          description: "Manages security architecture reviews, application security, endpoint protection, and vulnerability management.",
          responsibilities: ["Security architecture", "AppSec program", "Endpoint strategy", "Vuln management"],
          aiCapabilities: ["Architecture scoring", "Code analysis", "Endpoint detection", "Vulnerability prioritization"],
          icon: "ShieldCheck",
          color: "#dc2626",
          monthlyPrice: 8500,
          isSubscribable: true,
          children: [
            { name: "Senior Security Architect", title: "Senior Security Architect", level: "senior", division: "Security Engineering", description: "Security reference architecture, threat modeling, secure design reviews.", responsibilities: ["Reference architecture", "Threat modeling", "Design reviews", "Security patterns"], aiCapabilities: ["Threat model generation", "Architecture scoring", "Attack surface analysis", "Design recommendations"], icon: "ShieldCheck", color: "#dc2626", monthlyPrice: 5500, isSubscribable: true },
            { name: "Application Security Engineer", title: "Application Security Engineer", level: "mid", division: "Security Engineering", description: "SAST/DAST scanning, code review, OWASP Top 10 remediation.", responsibilities: ["SAST/DAST", "Code review", "OWASP remediation", "Security testing"], aiCapabilities: ["Auto-scanning", "Vulnerability triage", "Fix recommendations", "CI/CD integration"], icon: "Code", color: "#dc2626", monthlyPrice: 4000, isSubscribable: true },
            { name: "Cloud Security Engineer", title: "Cloud Security Engineer", level: "mid", division: "Security Engineering", description: "CSPM, CWPP, container security, cloud-native security controls.", responsibilities: ["CSPM management", "Container security", "Cloud controls", "Misconfiguration detection"], aiCapabilities: ["Misconfiguration detection", "Policy enforcement", "Container scanning", "Drift monitoring"], icon: "Cloud", color: "#dc2626", monthlyPrice: 4000, isSubscribable: true },
            { name: "Endpoint Security Engineer", title: "Endpoint Security Engineer", level: "mid", division: "Security Engineering", description: "EDR management (CrowdStrike, Carbon Black), device hardening, AV policies.", responsibilities: ["EDR management", "Device hardening", "AV policies", "Threat response"], aiCapabilities: ["EDR tuning", "Behavioral analysis", "Auto-containment", "Policy optimization"], icon: "Monitor", color: "#dc2626", monthlyPrice: 3800, isSubscribable: true },
            { name: "Email Security Engineer", title: "Email Security Engineer", level: "mid", division: "Security Engineering", description: "Email gateway, DMARC/DKIM/SPF, phishing simulation campaigns.", responsibilities: ["Email gateway", "DMARC/DKIM/SPF", "Phishing simulations", "Spam filtering"], aiCapabilities: ["Phishing detection", "Header analysis", "Campaign automation", "Threat scoring"], icon: "Mail", color: "#dc2626", monthlyPrice: 3500, isSubscribable: true },
            { name: "DLP Engineer", title: "DLP Engineer", level: "mid", division: "Security Engineering", description: "Data loss prevention rules, content inspection, egress monitoring.", responsibilities: ["DLP rules", "Content inspection", "Egress monitoring", "Policy tuning"], aiCapabilities: ["Pattern detection", "Content classification", "Policy recommendations", "False positive reduction"], icon: "Shield", color: "#dc2626", monthlyPrice: 3500, isSubscribable: true },
            { name: "Vulnerability Management Analyst", title: "Vulnerability Management Analyst", level: "mid", division: "Security Engineering", description: "Qualys, Nessus, Rapid7 — scanning, patch prioritization, CVSS scoring.", responsibilities: ["Vulnerability scanning", "Patch prioritization", "CVSS scoring", "Remediation tracking"], aiCapabilities: ["Scan scheduling", "Risk prioritization", "Patch correlation", "Trend analysis"], icon: "Bug", color: "#dc2626", monthlyPrice: 3500, isSubscribable: true },
            { name: "Penetration Tester", title: "Penetration Tester / Red Team Operator", level: "senior", division: "Security Engineering", description: "External/internal pentests, social engineering, adversary simulation.", responsibilities: ["Penetration testing", "Social engineering", "Red team ops", "Reporting"], aiCapabilities: ["Attack automation", "Exploit selection", "Social engineering simulation", "Report generation"], icon: "Crosshair", color: "#dc2626", monthlyPrice: 5000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Security Platform Engineering",
          title: "Director of Security Platform Engineering",
          level: "director",
          division: "Security Integration & Platform",
          description: "Owns the lifecycle of all security tool integrations — EDR, SIEM, CSPM, IAM, DLP, ITSM, and threat intelligence platforms. Accountable for API credential governance, integration health, and security automation pipelines.",
          responsibilities: ["Integration strategy", "Credential governance", "Security automation", "Platform vendor management"],
          aiCapabilities: ["Integration health scoring", "Credential lifecycle management", "API anomaly detection", "Platform cost optimization"],
          icon: "Plug",
          color: "#7c3aed",
          monthlyPrice: 8500,
          isSubscribable: true,
          children: [
            {
              name: "Security Integrations Architect",
              title: "Security Integrations Architect",
              level: "senior",
              division: "Security Integration & Platform",
              description: "Designs the end-to-end security platform integration topology — selecting APIs, authentication patterns, data flows, and connection orchestration across CrowdStrike, Splunk, Okta, ServiceNow, and 17+ platforms.",
              responsibilities: ["Integration topology design", "API authentication architecture", "Data flow mapping", "Platform selection & evaluation"],
              aiCapabilities: ["Integration topology analysis", "Vendor capability scoring", "Connection flow optimization", "API compatibility assessment"],
              icon: "GitBranch",
              color: "#7c3aed",
              monthlyPrice: 5500,
              isSubscribable: true,
            },
            { name: "Security Platform Engineer", title: "Security Platform Engineer", level: "mid", division: "Security Integration & Platform", description: "Manages day-to-day credential configuration, OAuth token rotation, connection health monitoring, and API lifecycle across all 21 integrated security platforms.", responsibilities: ["Credential configuration", "OAuth token rotation", "Connection health monitoring", "API lifecycle management"], aiCapabilities: ["Auto-credential rotation", "Connection health dashboards", "API anomaly detection", "Token expiry alerting"], icon: "Settings", color: "#7c3aed", monthlyPrice: 4000, isSubscribable: true },
            { name: "SIEM & SOAR Integration Engineer", title: "SIEM & SOAR Integration Engineer", level: "mid", division: "Security Integration & Platform", description: "Owns Splunk, Microsoft Sentinel, and IBM QRadar integrations — log source onboarding, parser development, correlation rule authoring, and SOAR playbook wiring.", responsibilities: ["Log source onboarding", "Parser development", "Correlation rule authoring", "SOAR playbook wiring"], aiCapabilities: ["Log normalization automation", "Correlation rule recommendation", "Alert volume optimization", "Playbook trigger analysis"], icon: "BarChart", color: "#7c3aed", monthlyPrice: 4200, isSubscribable: true },
            { name: "EDR Platform Engineer", title: "EDR Platform Engineer", level: "mid", division: "Security Integration & Platform", description: "Manages CrowdStrike Falcon, SentinelOne, and Microsoft Defender for Endpoint — sensor deployment, policy groups, exclusion management, and real-time response API integration.", responsibilities: ["Sensor deployment", "Policy group management", "Exclusion management", "Real-time response integration"], aiCapabilities: ["Policy tuning recommendations", "Sensor health monitoring", "Exclusion risk scoring", "Threat surface analysis"], icon: "HardDrive", color: "#7c3aed", monthlyPrice: 4000, isSubscribable: true },
            { name: "Cloud Security Platform Engineer", title: "Cloud Security Platform Engineer", level: "mid", division: "Security Integration & Platform", description: "Integrates and operates AWS Security Hub, Azure Defender for Cloud, and Google Cloud SCC — aggregating multi-cloud findings, mapping to compliance frameworks, and automating remediation pipelines.", responsibilities: ["Multi-cloud findings aggregation", "Compliance framework mapping", "Remediation pipeline automation", "Cloud API credential management"], aiCapabilities: ["Cross-cloud posture scoring", "Misconfiguration auto-detection", "Compliance gap analysis", "Remediation prioritization"], icon: "Cloud", color: "#7c3aed", monthlyPrice: 4200, isSubscribable: true },
            { name: "IAM & DLP Integration Engineer", title: "IAM & DLP Integration Engineer", level: "mid", division: "Security Integration & Platform", description: "Connects Okta, Microsoft Entra ID, CyberArk PAM, Microsoft Purview, and Zscaler — enabling automated access reviews, JIT provisioning, privilege escalation detection, and real-time DLP policy enforcement via APIs.", responsibilities: ["IAM API integration", "PAM vault API management", "DLP policy API enforcement", "JIT provisioning workflows"], aiCapabilities: ["Access anomaly detection", "JIT provisioning automation", "Privilege escalation alerting", "DLP policy optimization"], icon: "KeyRound", color: "#7c3aed", monthlyPrice: 4000, isSubscribable: true },
            { name: "Security Automation Engineer", title: "Security Automation Engineer", level: "mid", division: "Security Integration & Platform", description: "Builds AI-driven automation playbooks across the integrated security ecosystem — automating quarantine, RFC creation, access revocation, DLP block, and awareness campaign triggers via API orchestration.", responsibilities: ["Playbook development", "API orchestration", "Automation testing", "Response workflow design"], aiCapabilities: ["AI playbook generation", "Orchestration flow optimization", "Automation coverage analysis", "Response time benchmarking"], icon: "Zap", color: "#7c3aed", monthlyPrice: 4500, isSubscribable: true },
            { name: "Security Tooling Analyst", title: "Security Tooling & Integration Analyst", level: "junior", division: "Security Integration & Platform", description: "Monitors integration health dashboards, tracks API quota usage, manages credential inventory, raises alerts on connection failures, and produces weekly platform health reports.", responsibilities: ["Integration health monitoring", "API quota tracking", "Credential inventory management", "Platform health reporting"], aiCapabilities: ["Health dashboard generation", "Quota anomaly alerting", "Credential expiry tracking", "Report automation"], icon: "Activity", color: "#7c3aed", monthlyPrice: 2800, isSubscribable: true },
          ],
        },
      ],
    },
  },
  {
    name: "Service Management",
    icon: "Headphones",
    color: "#16a34a",
    roles: {
      name: "VP of Service Management",
      title: "VP of Service Management (ITSM)",
      level: "vp",
      description: "Owns the entire client-facing service delivery lifecycle including service desk, change, and problem management.",
      responsibilities: ["Service strategy", "ITIL processes", "Client satisfaction", "Service improvement"],
      aiCapabilities: ["Service analytics", "CSI recommendations", "Process optimization", "Satisfaction prediction"],
      icon: "Headphones",
      color: "#16a34a",
      monthlyPrice: 14000,
      isSubscribable: true,
      children: [
        {
          name: "Director of Service Desk", title: "Director of Service Desk", level: "director", division: "Service Desk", description: "Manages front-line IT support including ticket queues, agent performance, and CSAT.", responsibilities: ["Queue management", "Agent performance", "CSAT tracking", "Knowledge management"], aiCapabilities: ["Auto-routing", "Sentiment analysis", "SLA prediction", "Self-service optimization"], icon: "Headphones", color: "#16a34a", monthlyPrice: 7000, isSubscribable: true,
          children: [
            { name: "Service Desk Manager", title: "Service Desk Manager", level: "manager", division: "Service Desk", description: "Queue management, agent performance metrics, CSAT improvement.", responsibilities: ["Queue management", "Performance metrics", "CSAT improvement", "Shift scheduling"], aiCapabilities: ["Workload optimization", "Performance analytics", "CSAT prediction", "Resource planning"], icon: "Headphones", color: "#16a34a", monthlyPrice: 4500, isSubscribable: true },
            { name: "Service Desk Analyst Tier 1", title: "Service Desk Analyst Tier 1", level: "junior", division: "Service Desk", description: "Password resets, basic troubleshooting, ticket logging, knowledge base lookups.", responsibilities: ["Password resets", "Basic troubleshooting", "Ticket logging", "KB lookups"], aiCapabilities: ["Auto-resolution", "KB suggestion", "Ticket classification", "Response generation"], icon: "Headphones", color: "#16a34a", monthlyPrice: 2000, isSubscribable: true },
            { name: "Service Desk Analyst Tier 2", title: "Service Desk Analyst Tier 2", level: "mid", division: "Service Desk", description: "Application support, remote desktop troubleshooting, software installs.", responsibilities: ["App support", "Remote troubleshooting", "Software installs", "Escalation decisions"], aiCapabilities: ["Diagnostic automation", "Remote fix execution", "Install automation", "Escalation recommendations"], icon: "Headphones", color: "#16a34a", monthlyPrice: 2800, isSubscribable: true },
            { name: "Service Desk Analyst Tier 3", title: "Service Desk Analyst Tier 3 / Desktop Engineer", level: "senior", division: "Service Desk", description: "Complex desktop issues, imaging, hardware diagnostics.", responsibilities: ["Complex troubleshooting", "Imaging", "Hardware diagnostics", "Endpoint management"], aiCapabilities: ["Advanced diagnostics", "Image automation", "Hardware prediction", "Root cause analysis"], icon: "Headphones", color: "#16a34a", monthlyPrice: 3500, isSubscribable: true },
            { name: "VIP Support Specialist", title: "VIP/Executive Support Specialist", level: "mid", division: "Service Desk", description: "White-glove support for C-suite and executives, on-site assistance.", responsibilities: ["Executive support", "On-site assistance", "Priority handling", "Proactive maintenance"], aiCapabilities: ["Priority routing", "Proactive monitoring", "Personal device management", "Schedule optimization"], icon: "Star", color: "#16a34a", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
        {
          name: "Director of Change & Release", title: "Director of Change & Release Management", level: "director", division: "Change & Release", description: "Manages change advisory board, release scheduling, and deployment coordination.", responsibilities: ["CAB facilitation", "Release planning", "Risk assessment", "Deployment coordination"], aiCapabilities: ["Change risk scoring", "Conflict detection", "Impact prediction", "Release automation"], icon: "GitBranch", color: "#9333ea", monthlyPrice: 7000, isSubscribable: true,
          children: [
            { name: "Change Manager", title: "Change Manager", level: "manager", division: "Change & Release", description: "CAB facilitation, change risk scoring, conflict calendar management.", responsibilities: ["CAB management", "Risk scoring", "Calendar management", "Post-implementation reviews"], aiCapabilities: ["Risk auto-scoring", "Conflict detection", "Impact analysis", "PIR automation"], icon: "GitBranch", color: "#9333ea", monthlyPrice: 4500, isSubscribable: true },
            { name: "Release Manager", title: "Release Manager", level: "manager", division: "Change & Release", description: "Release scheduling, go/no-go decisions, deployment coordination.", responsibilities: ["Release scheduling", "Go/no-go decisions", "Deployment coordination", "Rollback planning"], aiCapabilities: ["Release readiness scoring", "Dependency analysis", "Deployment automation", "Rollback orchestration"], icon: "GitBranch", color: "#9333ea", monthlyPrice: 4500, isSubscribable: true },
            { name: "Change Coordinator", title: "Change Coordinator", level: "mid", division: "Change & Release", description: "Change ticket processing, approval routing, post-implementation reviews.", responsibilities: ["Ticket processing", "Approval routing", "PIR documentation", "Status tracking"], aiCapabilities: ["Auto-routing", "Approval workflow", "PIR templates", "Status updates"], icon: "GitBranch", color: "#9333ea", monthlyPrice: 3000, isSubscribable: true },
            { name: "Release Engineer", title: "Release Engineer", level: "mid", division: "Change & Release", description: "Deployment automation, blue-green deployments, canary releases, rollback.", responsibilities: ["Deploy automation", "Blue-green deploys", "Canary releases", "Rollback procedures"], aiCapabilities: ["Deployment orchestration", "Canary analysis", "Rollback automation", "Health validation"], icon: "Rocket", color: "#9333ea", monthlyPrice: 3800, isSubscribable: true },
            { name: "Environment Manager", title: "Environment Manager", level: "mid", division: "Change & Release", description: "Staging/UAT/production environment provisioning and lifecycle management.", responsibilities: ["Environment provisioning", "Lifecycle management", "Refresh scheduling", "Access control"], aiCapabilities: ["Auto-provisioning", "Drift detection", "Refresh automation", "Usage analysis"], icon: "Layers", color: "#9333ea", monthlyPrice: 3000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Problem Management", title: "Director of Problem Management", level: "director", division: "Problem Management", description: "Manages root cause analysis, known error database, and proactive problem prevention.", responsibilities: ["RCA oversight", "Known error DB", "Trend analysis", "Problem prevention"], aiCapabilities: ["Pattern detection", "RCA automation", "Trend prediction", "Proactive identification"], icon: "Bug", color: "#e11d48", monthlyPrice: 7000, isSubscribable: true,
          children: [
            { name: "Problem Manager", title: "Problem Manager", level: "manager", division: "Problem Management", description: "Problem lifecycle management, trend analysis, root cause review coordination.", responsibilities: ["Problem lifecycle", "Trend analysis", "RCA coordination", "Workaround management"], aiCapabilities: ["Trend detection", "RCA facilitation", "Workaround optimization", "Incident correlation"], icon: "Bug", color: "#e11d48", monthlyPrice: 4500, isSubscribable: true },
            { name: "Senior Problem Analyst", title: "Senior Problem Analyst", level: "senior", division: "Problem Management", description: "Kepner-Tregoe analysis, fault tree analysis, 5-why investigations.", responsibilities: ["KT analysis", "Fault tree analysis", "5-why investigations", "Permanent fix planning"], aiCapabilities: ["Fault tree generation", "Causal analysis", "Fix recommendation", "Impact prediction"], icon: "Search", color: "#e11d48", monthlyPrice: 4000, isSubscribable: true },
            { name: "Problem Analyst", title: "Problem Analyst", level: "mid", division: "Problem Management", description: "Known error documentation, workaround validation, permanent fix tracking.", responsibilities: ["Known error docs", "Workaround validation", "Fix tracking", "Trend reporting"], aiCapabilities: ["Error documentation", "Workaround testing", "Fix verification", "Trend analysis"], icon: "Bug", color: "#e11d48", monthlyPrice: 3000, isSubscribable: true },
            { name: "Availability Manager", title: "Availability Manager", level: "mid", division: "Problem Management", description: "Uptime reporting, single points of failure identification, resilience planning.", responsibilities: ["Uptime reporting", "SPOF identification", "Resilience planning", "Recovery testing"], aiCapabilities: ["Availability modeling", "SPOF detection", "Resilience scoring", "DR validation"], icon: "Activity", color: "#e11d48", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
        {
          name: "Director of Service Level Management", title: "Director of Service Level Management", level: "director", division: "SLA Management", description: "Manages SLA negotiation, capacity planning, and service continuity.", responsibilities: ["SLA management", "Capacity planning", "Continuity management", "Service catalog"], aiCapabilities: ["SLA forecasting", "Capacity modeling", "Continuity testing", "Catalog optimization"], icon: "Clock", color: "#f59e0b", monthlyPrice: 7000, isSubscribable: true,
          children: [
            { name: "SLA Manager", title: "SLA Manager", level: "manager", division: "SLA Management", description: "SLA negotiation, OLA/UC alignment, breach analysis, SLA reporting.", responsibilities: ["SLA negotiation", "OLA alignment", "Breach analysis", "Performance reporting"], aiCapabilities: ["SLA prediction", "Breach prevention", "Performance analytics", "Optimization recommendations"], icon: "Clock", color: "#f59e0b", monthlyPrice: 4000, isSubscribable: true },
            { name: "Capacity Planner", title: "Capacity Planner", level: "mid", division: "SLA Management", description: "Demand forecasting, resource utilization trending, capacity models.", responsibilities: ["Demand forecasting", "Utilization trending", "Capacity modeling", "Growth planning"], aiCapabilities: ["Demand prediction", "Utilization analysis", "Capacity simulation", "Growth modeling"], icon: "TrendingUp", color: "#f59e0b", monthlyPrice: 3500, isSubscribable: true },
            { name: "Service Continuity Manager", title: "Service Continuity Manager", level: "mid", division: "SLA Management", description: "BCP/DRP planning, DR testing, continuity exercises.", responsibilities: ["BCP planning", "DR testing", "Continuity exercises", "Recovery documentation"], aiCapabilities: ["DR readiness scoring", "Test scheduling", "Recovery simulation", "Gap identification"], icon: "Shield", color: "#f59e0b", monthlyPrice: 3500, isSubscribable: true },
            { name: "Service Catalog Manager", title: "Service Catalog Manager", level: "mid", division: "SLA Management", description: "Catalog design, service definitions, pricing models, request workflows.", responsibilities: ["Catalog design", "Service definitions", "Pricing models", "Workflow management"], aiCapabilities: ["Usage analytics", "Pricing optimization", "Workflow automation", "Demand analysis"], icon: "ShoppingBag", color: "#f59e0b", monthlyPrice: 3000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Asset & Config Management", title: "Director of Asset & Configuration Management", level: "director", division: "Asset Management", description: "Manages CMDB, IT asset lifecycle, software licensing, and hardware procurement.", responsibilities: ["CMDB governance", "Asset lifecycle", "License compliance", "Procurement coordination"], aiCapabilities: ["Asset discovery", "License optimization", "Lifecycle prediction", "CMDB accuracy scoring"], icon: "Server", color: "#ca8a04", monthlyPrice: 6500, isSubscribable: true,
          children: [
            { name: "CMDB Manager", title: "CMDB Manager", level: "manager", division: "Asset Management", description: "CI lifecycle, data quality, relationship mapping, federation strategy.", responsibilities: ["CI lifecycle", "Data quality", "Relationship mapping", "Federation management"], aiCapabilities: ["Auto-discovery", "Data quality scoring", "Relationship inference", "Change impact analysis"], icon: "Database", color: "#ca8a04", monthlyPrice: 4000, isSubscribable: true },
            { name: "IT Asset Manager", title: "IT Asset Manager", level: "mid", division: "Asset Management", description: "Hardware/software inventory, license compliance, procurement coordination.", responsibilities: ["Inventory management", "License compliance", "Procurement", "Disposal management"], aiCapabilities: ["Inventory tracking", "License optimization", "Procurement automation", "EOL prediction"], icon: "Server", color: "#ca8a04", monthlyPrice: 3000, isSubscribable: true },
            { name: "Software Asset Manager (SAM)", title: "Software Asset Manager", level: "mid", division: "Asset Management", description: "License true-ups, audit defense, vendor negotiation, SaaS sprawl management.", responsibilities: ["License true-ups", "Audit defense", "Vendor negotiation", "SaaS management"], aiCapabilities: ["Usage tracking", "True-up prediction", "Cost optimization", "Sprawl detection"], icon: "Package", color: "#ca8a04", monthlyPrice: 3000, isSubscribable: true },
            { name: "Hardware Lifecycle Coordinator", title: "Hardware Lifecycle Coordinator", level: "mid", division: "Asset Management", description: "Refresh cycles, lease management, disposal/ITAD, warranty tracking.", responsibilities: ["Refresh planning", "Lease management", "ITAD coordination", "Warranty tracking"], aiCapabilities: ["Refresh prediction", "Lease optimization", "Disposal compliance", "Warranty alerting"], icon: "RefreshCw", color: "#ca8a04", monthlyPrice: 2800, isSubscribable: true },
          ],
        },
      ],
    },
  },
  {
    name: "AI & Automation",
    icon: "Brain",
    color: "#0891b2",
    roles: {
      name: "VP of AI & Automation",
      title: "VP of AI & Automation",
      level: "vp",
      description: "Owns the autonomous AI agent platform — the core product that differentiates the service offering.",
      responsibilities: ["AI strategy", "Agent development", "Automation roadmap", "Ethics governance"],
      aiCapabilities: ["Meta-learning optimization", "Cross-agent coordination", "Platform evolution", "ROI analysis"],
      icon: "Brain",
      color: "#0891b2",
      monthlyPrice: 16000,
      isSubscribable: true,
      children: [
        {
          name: "Director of AI Agent Development", title: "Director of AI Agent Development", level: "director", division: "AI Development", description: "Leads the team building, training, and maintaining the specialist AI agents.", responsibilities: ["Agent architecture", "Model training", "Agent lifecycle", "Performance optimization"], aiCapabilities: ["Agent orchestration", "Model selection", "Performance benchmarking", "Architecture evolution"], icon: "Brain", color: "#0891b2", monthlyPrice: 9000, isSubscribable: true,
          children: [
            { name: "AI/ML Architect", title: "AI/ML Architect", level: "senior", division: "AI Development", description: "Agent architecture, decision models, multi-agent coordination patterns.", responsibilities: ["Agent architecture", "Decision models", "Multi-agent patterns", "Scalability design"], aiCapabilities: ["Architecture optimization", "Model selection", "Coordination patterns", "Scaling strategies"], icon: "Brain", color: "#0891b2", monthlyPrice: 6000, isSubscribable: true },
            { name: "Senior ML Engineer", title: "Senior ML Engineer", level: "senior", division: "AI Development", description: "Model training, fine-tuning, reinforcement learning for remediation agents.", responsibilities: ["Model training", "Fine-tuning", "RL agents", "Feature engineering"], aiCapabilities: ["Auto-tuning", "Transfer learning", "Reward optimization", "Feature selection"], icon: "Brain", color: "#0891b2", monthlyPrice: 5000, isSubscribable: true },
            { name: "ML Engineer", title: "ML Engineer", level: "mid", division: "AI Development", description: "Feature engineering, data preprocessing, model evaluation and deployment.", responsibilities: ["Feature engineering", "Data preprocessing", "Model evaluation", "Deployment pipelines"], aiCapabilities: ["Feature automation", "Data validation", "Model comparison", "Pipeline optimization"], icon: "Brain", color: "#0891b2", monthlyPrice: 4000, isSubscribable: true },
            { name: "NLP Engineer", title: "NLP Engineer", level: "mid", division: "AI Development", description: "Natural language interfaces, intent classification, conversational AI.", responsibilities: ["NLU development", "Intent classification", "Dialogue management", "Entity extraction"], aiCapabilities: ["Intent optimization", "Context management", "Response generation", "Sentiment analysis"], icon: "MessageSquare", color: "#0891b2", monthlyPrice: 4000, isSubscribable: true },
            { name: "AI Agent Developer (Infra)", title: "AI Agent Developer (Infrastructure)", level: "mid", division: "AI Development", description: "Develops Network Monitor, IoT Controller, and Patch Manager agent logic.", responsibilities: ["Infra agent development", "Protocol integration", "Monitoring logic", "Remediation workflows"], aiCapabilities: ["Protocol handling", "Anomaly detection", "Auto-remediation", "Health scoring"], icon: "Cpu", color: "#0891b2", monthlyPrice: 4000, isSubscribable: true },
            { name: "AI Agent Developer (Security)", title: "AI Agent Developer (Security)", level: "mid", division: "AI Development", description: "Develops Security Monitor and Compliance Auditor agent logic.", responsibilities: ["Security agent development", "Threat detection logic", "Compliance rules", "Response automation"], aiCapabilities: ["Threat modeling", "Rule generation", "Response orchestration", "Risk scoring"], icon: "Shield", color: "#0891b2", monthlyPrice: 4000, isSubscribable: true },
            { name: "AI Agent Developer (ITSM)", title: "AI Agent Developer (ITSM)", level: "mid", division: "AI Development", description: "Develops Incident Manager, Change Manager, and Service Desk agent logic.", responsibilities: ["ITSM agent development", "Workflow automation", "Ticket processing", "SLA logic"], aiCapabilities: ["Ticket classification", "Workflow optimization", "Priority scoring", "Resolution prediction"], icon: "Headphones", color: "#0891b2", monthlyPrice: 4000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Automation & Orchestration", title: "Director of Automation & Orchestration", level: "director", division: "Automation", description: "Manages orchestration strategy, workflow engines, and integration pipelines.", responsibilities: ["Orchestration strategy", "Workflow design", "Integration management", "RPA program"], aiCapabilities: ["Workflow optimization", "Integration health", "Process mining", "Bot management"], icon: "Zap", color: "#f97316", monthlyPrice: 8000, isSubscribable: true,
          children: [
            { name: "Automation Architect", title: "Automation Architect", level: "senior", division: "Automation", description: "Orchestration strategy, workflow engine design, integration patterns.", responsibilities: ["Orchestration design", "Workflow engines", "Integration patterns", "Scalability planning"], aiCapabilities: ["Workflow optimization", "Pattern recognition", "Integration health", "Bottleneck detection"], icon: "Zap", color: "#f97316", monthlyPrice: 5000, isSubscribable: true },
            { name: "Senior Automation Engineer", title: "Senior Automation Engineer", level: "senior", division: "Automation", description: "Complex multi-system workflows, error handling, retry logic.", responsibilities: ["Complex workflows", "Error handling", "Retry logic", "Cross-system integration"], aiCapabilities: ["Workflow debugging", "Error prediction", "Retry optimization", "Performance analysis"], icon: "Zap", color: "#f97316", monthlyPrice: 4500, isSubscribable: true },
            { name: "Automation Engineer", title: "Automation Engineer", level: "mid", division: "Automation", description: "Runbook authoring, script development, API integrations.", responsibilities: ["Runbook authoring", "Script development", "API integrations", "Testing"], aiCapabilities: ["Script generation", "API testing", "Runbook optimization", "Integration validation"], icon: "Zap", color: "#f97316", monthlyPrice: 3500, isSubscribable: true },
            { name: "RPA Developer", title: "RPA Developer", level: "mid", division: "Automation", description: "UI automation for legacy systems, bot lifecycle management.", responsibilities: ["Bot development", "UI automation", "Bot maintenance", "Process documentation"], aiCapabilities: ["Bot optimization", "UI element detection", "Error recovery", "Process mining"], icon: "Bot", color: "#f97316", monthlyPrice: 3500, isSubscribable: true },
            { name: "Integration Engineer", title: "Integration Engineer", level: "mid", division: "Automation", description: "iPaaS, webhook management, event-driven architecture, message queues.", responsibilities: ["iPaaS management", "Webhook setup", "Event architecture", "Queue management"], aiCapabilities: ["Integration monitoring", "Event routing", "Queue optimization", "Health tracking"], icon: "Link", color: "#f97316", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
        {
          name: "Director of MLOps", title: "Director of MLOps", level: "director", division: "MLOps", description: "Manages model deployment, monitoring, retraining, and AI safety.", responsibilities: ["Model lifecycle", "Deployment pipelines", "Performance monitoring", "Retraining coordination"], aiCapabilities: ["Pipeline automation", "Drift detection", "Performance tracking", "Auto-retraining"], icon: "Activity", color: "#0891b2", monthlyPrice: 7500, isSubscribable: true,
          children: [
            { name: "MLOps Engineer", title: "MLOps Engineer", level: "mid", division: "MLOps", description: "Model deployment pipelines, A/B testing, model versioning, feature stores.", responsibilities: ["Deployment pipelines", "A/B testing", "Model versioning", "Feature stores"], aiCapabilities: ["Pipeline automation", "Experiment tracking", "Version management", "Feature serving"], icon: "Activity", color: "#0891b2", monthlyPrice: 4000, isSubscribable: true },
            { name: "Data Scientist", title: "Data Scientist", level: "mid", division: "MLOps", description: "Anomaly detection models, predictive analytics, failure prediction.", responsibilities: ["Anomaly detection", "Predictive analytics", "Failure prediction", "Statistical analysis"], aiCapabilities: ["Model development", "Feature engineering", "Anomaly tuning", "Prediction optimization"], icon: "BarChart", color: "#0891b2", monthlyPrice: 4000, isSubscribable: true },
            { name: "AI Safety Engineer", title: "AI Safety Engineer", level: "mid", division: "MLOps", description: "Guardrails, blast radius limits, autonomous action boundaries, rollback triggers.", responsibilities: ["Guardrail design", "Blast radius limits", "Action boundaries", "Rollback triggers"], aiCapabilities: ["Safety monitoring", "Boundary enforcement", "Rollback automation", "Risk assessment"], icon: "ShieldCheck", color: "#0891b2", monthlyPrice: 4000, isSubscribable: true },
            { name: "Model Performance Analyst", title: "Model Performance Analyst", level: "mid", division: "MLOps", description: "Drift detection, accuracy monitoring, retraining schedules.", responsibilities: ["Drift detection", "Accuracy monitoring", "Retraining scheduling", "Performance reporting"], aiCapabilities: ["Drift alerting", "Accuracy tracking", "Schedule optimization", "Performance dashboards"], icon: "TrendingUp", color: "#0891b2", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
      ],
    },
  },
  {
    name: "Data & Analytics",
    icon: "BarChart",
    color: "#8b5cf6",
    roles: {
      name: "VP of Data & Analytics",
      title: "VP of Data & Analytics",
      level: "vp",
      description: "Owns telemetry pipelines, reporting, and data-driven decision making.",
      responsibilities: ["Data strategy", "Analytics platform", "Observability", "BI program"],
      aiCapabilities: ["Data pipeline optimization", "Insight generation", "Anomaly detection", "Predictive analytics"],
      icon: "BarChart",
      color: "#8b5cf6",
      monthlyPrice: 13000,
      isSubscribable: true,
      children: [
        {
          name: "Director of Observability", title: "Director of Observability", level: "director", division: "Observability", description: "Manages metrics, logs, traces — the data feeding the AI agents.", responsibilities: ["Observability strategy", "Tool management", "Data pipeline", "Alert management"], aiCapabilities: ["Signal correlation", "Alert optimization", "Pipeline monitoring", "Cost management"], icon: "Activity", color: "#8b5cf6", monthlyPrice: 7500, isSubscribable: true,
          children: [
            { name: "Observability Architect", title: "Observability Architect", level: "senior", division: "Observability", description: "Metrics/logs/traces strategy, OpenTelemetry, correlation engine.", responsibilities: ["O11y architecture", "OpenTelemetry", "Correlation engine", "Standards"], aiCapabilities: ["Architecture optimization", "Signal correlation", "Cost modeling", "Standard enforcement"], icon: "Activity", color: "#8b5cf6", monthlyPrice: 5000, isSubscribable: true },
            { name: "Senior Monitoring Engineer", title: "Senior Monitoring Engineer", level: "senior", division: "Observability", description: "Prometheus, Grafana, Datadog — custom dashboard development.", responsibilities: ["Prometheus setup", "Grafana dashboards", "Alert rules", "Custom metrics"], aiCapabilities: ["Dashboard generation", "Alert tuning", "Metric optimization", "Anomaly detection"], icon: "BarChart", color: "#8b5cf6", monthlyPrice: 4500, isSubscribable: true },
            { name: "Log Management Engineer", title: "Log Management Engineer", level: "mid", division: "Observability", description: "ELK stack, Fluentd, log ingestion pipelines, retention policies.", responsibilities: ["ELK management", "Log ingestion", "Retention policies", "Parser development"], aiCapabilities: ["Log classification", "Pattern detection", "Retention optimization", "Parser generation"], icon: "FileText", color: "#8b5cf6", monthlyPrice: 3500, isSubscribable: true },
            { name: "APM Engineer", title: "APM Engineer", level: "mid", division: "Observability", description: "Application performance monitoring, distributed tracing, latency analysis.", responsibilities: ["APM setup", "Distributed tracing", "Latency analysis", "Service mapping"], aiCapabilities: ["Trace analysis", "Bottleneck detection", "Service dependency mapping", "Performance prediction"], icon: "Activity", color: "#8b5cf6", monthlyPrice: 3800, isSubscribable: true },
            { name: "Synthetic Monitoring Engineer", title: "Synthetic Monitoring Engineer", level: "mid", division: "Observability", description: "Uptime checks, transaction monitoring, global probe deployment.", responsibilities: ["Uptime monitoring", "Transaction checks", "Probe deployment", "SLA reporting"], aiCapabilities: ["Test optimization", "Failure prediction", "Probe placement", "SLA tracking"], icon: "Globe", color: "#8b5cf6", monthlyPrice: 3000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Business Intelligence", title: "Director of Business Intelligence", level: "director", division: "Business Intelligence", description: "Manages data warehousing, reporting, and self-service analytics.", responsibilities: ["BI strategy", "Data warehouse", "Reporting", "Self-service analytics"], aiCapabilities: ["Insight generation", "Report automation", "Data quality", "Trend detection"], icon: "PieChart", color: "#8b5cf6", monthlyPrice: 7000, isSubscribable: true,
          children: [
            { name: "BI Architect", title: "BI Architect", level: "senior", division: "Business Intelligence", description: "Data warehouse design, reporting strategy, self-service analytics.", responsibilities: ["DW design", "Report strategy", "Self-service tools", "Data modeling"], aiCapabilities: ["Schema optimization", "Query performance", "Report automation", "Data modeling"], icon: "PieChart", color: "#8b5cf6", monthlyPrice: 5000, isSubscribable: true },
            { name: "Senior BI Analyst", title: "Senior BI Analyst", level: "senior", division: "Business Intelligence", description: "Executive dashboards, SLA compliance reports, trend analysis.", responsibilities: ["Executive dashboards", "SLA reports", "Trend analysis", "Data storytelling"], aiCapabilities: ["Dashboard generation", "Insight extraction", "Trend prediction", "Narrative generation"], icon: "BarChart", color: "#8b5cf6", monthlyPrice: 4000, isSubscribable: true },
            { name: "BI Analyst", title: "BI Analyst", level: "mid", division: "Business Intelligence", description: "Ad-hoc reporting, data visualization, client-facing reports.", responsibilities: ["Ad-hoc reports", "Visualizations", "Client reports", "Data validation"], aiCapabilities: ["Report automation", "Viz recommendations", "Data quality checks", "Template generation"], icon: "BarChart", color: "#8b5cf6", monthlyPrice: 3000, isSubscribable: true },
            { name: "Data Visualization Specialist", title: "Data Visualization Specialist", level: "mid", division: "Business Intelligence", description: "Tableau, Power BI, custom dashboard design.", responsibilities: ["Tableau/Power BI", "Dashboard design", "Interactive reports", "Visual storytelling"], aiCapabilities: ["Layout optimization", "Chart selection", "Color palette", "Interactivity design"], icon: "PieChart", color: "#8b5cf6", monthlyPrice: 3000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Data Engineering", title: "Director of Data Engineering", level: "director", division: "Data Engineering", description: "Manages data lakes, ETL/ELT pipelines, stream processing.", responsibilities: ["Data architecture", "Pipeline management", "Data quality", "Stream processing"], aiCapabilities: ["Pipeline optimization", "Quality monitoring", "Schema evolution", "Performance tuning"], icon: "Database", color: "#8b5cf6", monthlyPrice: 7500, isSubscribable: true,
          children: [
            { name: "Senior Data Engineer", title: "Senior Data Engineer", level: "senior", division: "Data Engineering", description: "Data lake architecture, ETL/ELT pipelines, stream processing (Kafka, Flink).", responsibilities: ["Data lake design", "ETL pipelines", "Stream processing", "Architecture"], aiCapabilities: ["Pipeline generation", "Stream optimization", "Schema management", "Performance tuning"], icon: "Database", color: "#8b5cf6", monthlyPrice: 4500, isSubscribable: true },
            { name: "Data Engineer", title: "Data Engineer", level: "mid", division: "Data Engineering", description: "Data transformation, quality checks, schema management.", responsibilities: ["Data transformation", "Quality checks", "Schema management", "Testing"], aiCapabilities: ["Transform optimization", "Quality scoring", "Schema validation", "Test generation"], icon: "Database", color: "#8b5cf6", monthlyPrice: 3500, isSubscribable: true },
            { name: "Data Quality Analyst", title: "Data Quality Analyst", level: "mid", division: "Data Engineering", description: "Data validation rules, deduplication, master data management.", responsibilities: ["Validation rules", "Deduplication", "MDM", "Quality reporting"], aiCapabilities: ["Rule generation", "Duplicate detection", "Quality monitoring", "Anomaly detection"], icon: "CheckCircle", color: "#8b5cf6", monthlyPrice: 3000, isSubscribable: true },
            { name: "Database Performance Analyst", title: "Database Performance Analyst", level: "mid", division: "Data Engineering", description: "Query optimization, index strategies, slow query analysis.", responsibilities: ["Query optimization", "Index strategies", "Slow query analysis", "Performance reporting"], aiCapabilities: ["Query analysis", "Index recommendations", "Performance prediction", "Bottleneck detection"], icon: "Gauge", color: "#8b5cf6", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
      ],
    },
  },
  {
    name: "Platform Engineering",
    icon: "Code",
    color: "#0ea5e9",
    roles: {
      name: "VP of Platform Engineering",
      title: "VP of Platform Engineering",
      level: "vp",
      description: "Owns the product platform that clients consume — the HOLOCRON AI application itself.",
      responsibilities: ["Platform strategy", "Engineering leadership", "DevOps/SRE", "Quality assurance"],
      aiCapabilities: ["Code quality analysis", "Deployment optimization", "Reliability engineering", "Test automation"],
      icon: "Code",
      color: "#0ea5e9",
      monthlyPrice: 14000,
      isSubscribable: true,
      children: [
        {
          name: "Director of Software Engineering", title: "Director of Software Engineering", level: "director", division: "Software Engineering", description: "Leads frontend/backend development, API design, and multi-tenancy.", responsibilities: ["Engineering leadership", "Architecture decisions", "Team management", "Technical roadmap"], aiCapabilities: ["Code review automation", "Architecture analysis", "Dependency scanning", "Performance profiling"], icon: "Code", color: "#0ea5e9", monthlyPrice: 8000, isSubscribable: true,
          children: [
            { name: "Engineering Manager (Backend)", title: "Engineering Manager (Backend)", level: "manager", division: "Software Engineering", description: "Backend team leadership, API design, microservices architecture.", responsibilities: ["Team leadership", "API design", "Microservices", "Sprint planning"], aiCapabilities: ["Sprint prediction", "Code review", "Architecture scoring", "Dependency analysis"], icon: "Code", color: "#0ea5e9", monthlyPrice: 5000, isSubscribable: true },
            { name: "Senior Backend Engineer", title: "Senior Backend Engineer", level: "senior", division: "Software Engineering", description: "Node.js/Python services, database design, API development.", responsibilities: ["Service development", "DB design", "API development", "Code reviews"], aiCapabilities: ["Code generation", "Schema design", "API optimization", "Test generation"], icon: "Code", color: "#0ea5e9", monthlyPrice: 4500, isSubscribable: true },
            { name: "Backend Engineer", title: "Backend Engineer", level: "mid", division: "Software Engineering", description: "Feature implementation, bug fixes, code reviews.", responsibilities: ["Feature development", "Bug fixes", "Code reviews", "Documentation"], aiCapabilities: ["Bug detection", "Code completion", "Test writing", "Refactoring suggestions"], icon: "Code", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
            { name: "Engineering Manager (Frontend)", title: "Engineering Manager (Frontend)", level: "manager", division: "Software Engineering", description: "Frontend team leadership, UI/UX implementation strategy.", responsibilities: ["Team leadership", "UI/UX strategy", "Component architecture", "Performance"], aiCapabilities: ["UI analysis", "Performance profiling", "Accessibility audit", "Design system management"], icon: "Layout", color: "#0ea5e9", monthlyPrice: 5000, isSubscribable: true },
            { name: "Senior Frontend Engineer", title: "Senior Frontend Engineer", level: "senior", division: "Software Engineering", description: "React/TypeScript, component architecture, performance optimization.", responsibilities: ["Component architecture", "Performance optimization", "State management", "Design system"], aiCapabilities: ["Component generation", "Performance analysis", "Accessibility fixes", "Bundle optimization"], icon: "Layout", color: "#0ea5e9", monthlyPrice: 4500, isSubscribable: true },
            { name: "Frontend Engineer", title: "Frontend Engineer", level: "mid", division: "Software Engineering", description: "UI features, responsive design, accessibility.", responsibilities: ["UI development", "Responsive design", "Accessibility", "Testing"], aiCapabilities: ["UI generation", "Responsive testing", "A11y audit", "Visual regression"], icon: "Layout", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
            { name: "Full Stack Engineer", title: "Full Stack Engineer", level: "mid", division: "Software Engineering", description: "End-to-end feature development, prototyping.", responsibilities: ["Full stack development", "Prototyping", "Integration", "Testing"], aiCapabilities: ["Full stack generation", "Prototype automation", "Integration testing", "Feature scaffolding"], icon: "Code", color: "#0ea5e9", monthlyPrice: 3800, isSubscribable: true },
            { name: "API Engineer", title: "API Engineer", level: "mid", division: "Software Engineering", description: "REST/GraphQL design, versioning, rate limiting, documentation.", responsibilities: ["API design", "Versioning", "Rate limiting", "Documentation"], aiCapabilities: ["API generation", "Schema validation", "Rate limit optimization", "Doc generation"], icon: "Link", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
        {
          name: "Director of DevOps & SRE", title: "Director of DevOps & SRE", level: "director", division: "DevOps & SRE", description: "Manages CI/CD, platform reliability, and infrastructure-as-code.", responsibilities: ["DevOps strategy", "SRE practices", "Reliability targets", "Infrastructure automation"], aiCapabilities: ["Pipeline optimization", "Reliability scoring", "Incident prediction", "Toil detection"], icon: "Settings", color: "#0ea5e9", monthlyPrice: 8000, isSubscribable: true,
          children: [
            { name: "SRE Manager", title: "SRE Manager", level: "manager", division: "DevOps & SRE", description: "Reliability targets, error budgets, incident management process.", responsibilities: ["Error budgets", "Reliability targets", "Incident process", "Toil reduction"], aiCapabilities: ["Error budget tracking", "Reliability forecasting", "Incident analysis", "Toil measurement"], icon: "Settings", color: "#0ea5e9", monthlyPrice: 5000, isSubscribable: true },
            { name: "Senior SRE", title: "Senior Site Reliability Engineer", level: "senior", division: "DevOps & SRE", description: "Architecture reliability reviews, chaos engineering, performance testing.", responsibilities: ["Reliability reviews", "Chaos engineering", "Performance testing", "Runbook authoring"], aiCapabilities: ["Chaos experiment design", "Performance analysis", "Failure injection", "Reliability scoring"], icon: "Settings", color: "#0ea5e9", monthlyPrice: 4500, isSubscribable: true },
            { name: "Site Reliability Engineer", title: "Site Reliability Engineer", level: "mid", division: "DevOps & SRE", description: "On-call rotation, incident response, post-mortems, toil reduction.", responsibilities: ["On-call", "Incident response", "Post-mortems", "Toil reduction"], aiCapabilities: ["Alert correlation", "Response automation", "Post-mortem generation", "Toil identification"], icon: "Settings", color: "#0ea5e9", monthlyPrice: 3800, isSubscribable: true },
            { name: "Senior DevOps Engineer", title: "Senior DevOps Engineer", level: "senior", division: "DevOps & SRE", description: "CI/CD pipelines, GitOps, container orchestration (Kubernetes).", responsibilities: ["CI/CD design", "GitOps", "K8s management", "Pipeline optimization"], aiCapabilities: ["Pipeline generation", "GitOps automation", "K8s optimization", "Deploy analysis"], icon: "GitBranch", color: "#0ea5e9", monthlyPrice: 4500, isSubscribable: true },
            { name: "DevOps Engineer", title: "DevOps Engineer", level: "mid", division: "DevOps & SRE", description: "Build automation, deployment scripts, environment management.", responsibilities: ["Build automation", "Deploy scripts", "Environment management", "Monitoring"], aiCapabilities: ["Script generation", "Build optimization", "Env provisioning", "Health monitoring"], icon: "GitBranch", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
            { name: "Container/K8s Engineer", title: "Container/Kubernetes Engineer", level: "mid", division: "DevOps & SRE", description: "Cluster management, Helm charts, service mesh, pod security.", responsibilities: ["Cluster management", "Helm charts", "Service mesh", "Pod security"], aiCapabilities: ["Cluster optimization", "Chart generation", "Mesh configuration", "Security policies"], icon: "Box", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
            { name: "IaC Engineer", title: "Infrastructure-as-Code Engineer", level: "mid", division: "DevOps & SRE", description: "Terraform modules, CloudFormation, Pulumi, state management.", responsibilities: ["Terraform modules", "CloudFormation", "State management", "Module registry"], aiCapabilities: ["Module generation", "State analysis", "Drift detection", "Cost estimation"], icon: "FileCode", color: "#0ea5e9", monthlyPrice: 3800, isSubscribable: true },
          ],
        },
        {
          name: "Director of QA", title: "Director of Quality Assurance", level: "director", division: "Quality Assurance", description: "Manages test strategy, quality metrics, and release readiness.", responsibilities: ["Test strategy", "Quality metrics", "Release readiness", "Test automation"], aiCapabilities: ["Test generation", "Coverage analysis", "Release scoring", "Bug prediction"], icon: "CheckCircle", color: "#0ea5e9", monthlyPrice: 6500, isSubscribable: true,
          children: [
            { name: "QA Manager", title: "QA Manager", level: "manager", division: "Quality Assurance", description: "Test strategy, quality metrics, release readiness decisions.", responsibilities: ["Test strategy", "Quality metrics", "Release readiness", "Resource planning"], aiCapabilities: ["Strategy optimization", "Metric tracking", "Readiness scoring", "Coverage analysis"], icon: "CheckCircle", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
            { name: "Senior QA Engineer", title: "Senior QA Engineer", level: "senior", division: "Quality Assurance", description: "Test automation frameworks, E2E test suites, performance testing.", responsibilities: ["Automation frameworks", "E2E tests", "Performance testing", "Test architecture"], aiCapabilities: ["Test generation", "Framework optimization", "Performance analysis", "Coverage reporting"], icon: "CheckCircle", color: "#0ea5e9", monthlyPrice: 3800, isSubscribable: true },
            { name: "QA Engineer", title: "QA Engineer", level: "mid", division: "Quality Assurance", description: "Functional testing, regression testing, bug reporting.", responsibilities: ["Functional testing", "Regression testing", "Bug reporting", "Test documentation"], aiCapabilities: ["Test case generation", "Regression detection", "Bug classification", "Doc automation"], icon: "CheckCircle", color: "#0ea5e9", monthlyPrice: 3000, isSubscribable: true },
            { name: "Security QA Engineer", title: "Security QA Engineer", level: "mid", division: "Quality Assurance", description: "Security testing integration, compliance validation in CI/CD.", responsibilities: ["Security testing", "Compliance validation", "CI/CD integration", "Vulnerability testing"], aiCapabilities: ["Security scan automation", "Compliance checking", "Pipeline integration", "Vuln prioritization"], icon: "ShieldCheck", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
            { name: "Performance Engineer", title: "Performance Engineer", level: "mid", division: "Quality Assurance", description: "Load testing (k6, JMeter), scalability testing, bottleneck identification.", responsibilities: ["Load testing", "Scalability testing", "Bottleneck detection", "Performance baselines"], aiCapabilities: ["Load generation", "Bottleneck analysis", "Baseline comparison", "Scaling recommendations"], icon: "Gauge", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
        {
          name: "Director of Mobile Engineering", title: "Director of Mobile Engineering", level: "director", division: "Mobile Engineering", description: "Leads native and cross-platform mobile application development, app store management, and mobile DevOps.", responsibilities: ["Mobile strategy", "App development", "Store management", "Mobile CI/CD"], aiCapabilities: ["Platform analysis", "Store optimization", "Crash prediction", "Performance profiling"], icon: "Smartphone", color: "#0ea5e9", monthlyPrice: 8000, isSubscribable: true,
          children: [
            { name: "Senior iOS Engineer", title: "Senior iOS Engineer", level: "senior", division: "Mobile Engineering", description: "Swift/SwiftUI development, iOS architecture patterns, App Store submission and review process.", responsibilities: ["iOS development", "Architecture design", "App Store management", "Code reviews"], aiCapabilities: ["Swift code generation", "UI layout optimization", "Crash analysis", "Memory profiling"], icon: "Smartphone", color: "#0ea5e9", monthlyPrice: 5000, isSubscribable: true },
            { name: "iOS Engineer", title: "iOS Engineer", level: "mid", division: "Mobile Engineering", description: "iOS feature development, UIKit/SwiftUI components, unit testing, and integration with backend APIs.", responsibilities: ["Feature development", "UI components", "Unit testing", "API integration"], aiCapabilities: ["Component generation", "Test automation", "API binding", "Layout assistance"], icon: "Smartphone", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
            { name: "Senior Android Engineer", title: "Senior Android Engineer", level: "senior", division: "Mobile Engineering", description: "Kotlin/Jetpack Compose development, Android architecture, Play Store management and release pipelines.", responsibilities: ["Android development", "Architecture patterns", "Play Store management", "Performance optimization"], aiCapabilities: ["Kotlin code generation", "Compose layout optimization", "ANR analysis", "Battery profiling"], icon: "Smartphone", color: "#0ea5e9", monthlyPrice: 5000, isSubscribable: true },
            { name: "Android Engineer", title: "Android Engineer", level: "mid", division: "Mobile Engineering", description: "Android feature development, Material Design components, testing, and backend integration.", responsibilities: ["Feature development", "Material components", "Testing", "API integration"], aiCapabilities: ["Component scaffolding", "Test generation", "API binding", "Layout optimization"], icon: "Smartphone", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
            { name: "Cross-Platform Mobile Engineer", title: "Cross-Platform Mobile Engineer", level: "mid", division: "Mobile Engineering", description: "React Native or Flutter development for cross-platform mobile applications, shared codebases and native module bridging.", responsibilities: ["Cross-platform development", "Native bridging", "Shared codebase", "Platform parity"], aiCapabilities: ["Cross-platform code generation", "Bridge optimization", "Platform diff analysis", "Performance comparison"], icon: "Smartphone", color: "#0ea5e9", monthlyPrice: 4200, isSubscribable: true },
            { name: "Mobile DevOps Engineer", title: "Mobile DevOps Engineer", level: "mid", division: "Mobile Engineering", description: "Mobile CI/CD pipelines (Fastlane, Bitrise), automated builds, code signing, beta distribution, and crash monitoring.", responsibilities: ["Mobile CI/CD", "Code signing", "Beta distribution", "Crash monitoring"], aiCapabilities: ["Pipeline optimization", "Signing automation", "Distribution management", "Crash clustering"], icon: "GitBranch", color: "#0ea5e9", monthlyPrice: 3800, isSubscribable: true },
          ],
        },
        {
          name: "Director of SCM & CI/CD", title: "Director of Source Control & CI/CD", level: "director", division: "SCM & CI/CD", description: "Manages source control platforms (GitHub/GitLab), CI/CD pipeline strategy, artifact management, and developer workflow tooling.", responsibilities: ["SCM strategy", "CI/CD platforms", "Artifact management", "Branch policies"], aiCapabilities: ["Pipeline optimization", "Merge conflict prediction", "Build time analysis", "Workflow automation"], icon: "GitBranch", color: "#0ea5e9", monthlyPrice: 7500, isSubscribable: true,
          children: [
            { name: "GitHub Platform Administrator", title: "GitHub Platform Administrator", level: "senior", division: "SCM & CI/CD", description: "GitHub Enterprise administration, organization management, repository policies, GitHub Actions workflows, and security settings.", responsibilities: ["GitHub administration", "Org management", "Actions workflows", "Security policies"], aiCapabilities: ["Policy enforcement", "Workflow optimization", "Access analysis", "Security scanning"], icon: "Github", color: "#0ea5e9", monthlyPrice: 5000, isSubscribable: true },
            { name: "Senior CI/CD Engineer", title: "Senior CI/CD Pipeline Engineer", level: "senior", division: "SCM & CI/CD", description: "Designs and maintains enterprise CI/CD pipelines, GitHub Actions, Jenkins, and GitLab CI. Optimizes build times and reliability.", responsibilities: ["Pipeline architecture", "Build optimization", "Multi-stage deploys", "Pipeline security"], aiCapabilities: ["Pipeline generation", "Build caching optimization", "Failure prediction", "Stage parallelization"], icon: "GitBranch", color: "#0ea5e9", monthlyPrice: 4800, isSubscribable: true },
            { name: "CI/CD Engineer", title: "CI/CD Engineer", level: "mid", division: "SCM & CI/CD", description: "Builds and maintains CI/CD pipelines, automated testing integration, deployment automation, and environment provisioning.", responsibilities: ["Pipeline development", "Test integration", "Deploy automation", "Environment management"], aiCapabilities: ["Pipeline scaffolding", "Test orchestration", "Deploy scripting", "Env provisioning"], icon: "GitBranch", color: "#0ea5e9", monthlyPrice: 3800, isSubscribable: true },
            { name: "GitOps Engineer", title: "GitOps Engineer", level: "mid", division: "SCM & CI/CD", description: "Implements GitOps workflows with ArgoCD/Flux, declarative infrastructure, pull-based deployments, and drift detection.", responsibilities: ["GitOps implementation", "ArgoCD/Flux management", "Drift detection", "Declarative configs"], aiCapabilities: ["Config generation", "Drift alerting", "Sync optimization", "Manifest validation"], icon: "GitBranch", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
            { name: "Artifact & Registry Manager", title: "Artifact & Registry Manager", level: "mid", division: "SCM & CI/CD", description: "Manages container registries, package repositories (npm, Maven, PyPI), artifact versioning, and supply chain integrity.", responsibilities: ["Registry management", "Package repositories", "Version strategy", "Supply chain security"], aiCapabilities: ["Vulnerability scanning", "Version analysis", "Dependency mapping", "SBOM generation"], icon: "Package", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
            { name: "Release Manager", title: "Release Manager", level: "mid", division: "SCM & CI/CD", description: "Coordinates release trains, versioning strategy, changelog generation, feature flags, and rollback procedures.", responsibilities: ["Release coordination", "Versioning strategy", "Changelog management", "Feature flags"], aiCapabilities: ["Release risk scoring", "Changelog generation", "Flag analysis", "Rollback planning"], icon: "Tag", color: "#0ea5e9", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
        {
          name: "Director of Cloud-Native Architecture", title: "Director of Cloud-Native Architecture", level: "director", division: "Cloud-Native Architecture", description: "Leads microservices architecture, event-driven systems, service mesh implementation, and cloud-native design patterns.", responsibilities: ["Microservices strategy", "Event architecture", "Service mesh", "Cloud-native patterns"], aiCapabilities: ["Service decomposition", "Event flow optimization", "Mesh configuration", "Pattern recommendation"], icon: "Cloud", color: "#0ea5e9", monthlyPrice: 8500, isSubscribable: true,
          children: [
            { name: "Senior Microservices Architect", title: "Senior Microservices Architect", level: "senior", division: "Cloud-Native Architecture", description: "Designs microservices boundaries, inter-service communication patterns, domain-driven design, and distributed system resilience.", responsibilities: ["Service boundaries", "Communication patterns", "DDD implementation", "Resilience design"], aiCapabilities: ["Boundary analysis", "Pattern selection", "Domain modeling", "Failure simulation"], icon: "Cloud", color: "#0ea5e9", monthlyPrice: 6000, isSubscribable: true },
            { name: "Event-Driven Architecture Engineer", title: "Event-Driven Architecture Engineer", level: "senior", division: "Cloud-Native Architecture", description: "Implements event streaming (Kafka, Pulsar), CQRS/Event Sourcing, saga patterns, and asynchronous communication.", responsibilities: ["Event streaming", "CQRS/ES patterns", "Saga orchestration", "Async messaging"], aiCapabilities: ["Event schema design", "Stream optimization", "Saga generation", "Message routing"], icon: "Zap", color: "#0ea5e9", monthlyPrice: 5500, isSubscribable: true },
            { name: "Service Mesh Engineer", title: "Service Mesh Engineer", level: "mid", division: "Cloud-Native Architecture", description: "Implements and manages Istio/Linkerd service mesh, mTLS, traffic management, and observability sidecar injection.", responsibilities: ["Mesh deployment", "mTLS management", "Traffic policies", "Sidecar management"], aiCapabilities: ["Mesh configuration", "Traffic analysis", "Policy generation", "Performance tuning"], icon: "Network", color: "#0ea5e9", monthlyPrice: 4500, isSubscribable: true },
            { name: "API Gateway Engineer", title: "API Gateway Engineer", level: "mid", division: "Cloud-Native Architecture", description: "Manages API gateways (Kong, Apigee), rate limiting, authentication, request transformation, and API versioning.", responsibilities: ["Gateway management", "Rate limiting", "Auth integration", "API versioning"], aiCapabilities: ["Route optimization", "Rate limit tuning", "Auth policy generation", "Version migration"], icon: "Link", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
            { name: "Serverless Engineer", title: "Serverless Engineer", level: "mid", division: "Cloud-Native Architecture", description: "Designs and builds serverless applications using AWS Lambda, Azure Functions, or Google Cloud Functions with event triggers.", responsibilities: ["Serverless development", "Event triggers", "Cold start optimization", "Cost management"], aiCapabilities: ["Function generation", "Trigger design", "Performance optimization", "Cost analysis"], icon: "Zap", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Developer Experience", title: "Director of Developer Experience", level: "director", division: "Developer Experience", description: "Leads internal developer productivity, tooling, documentation, developer portals, and engineering onboarding.", responsibilities: ["Developer productivity", "Internal tooling", "Documentation", "Developer portal"], aiCapabilities: ["Productivity metrics", "Tool recommendations", "Doc generation", "Onboarding optimization"], icon: "Terminal", color: "#0ea5e9", monthlyPrice: 7000, isSubscribable: true,
          children: [
            { name: "Senior DX Engineer", title: "Senior Developer Experience Engineer", level: "senior", division: "Developer Experience", description: "Builds internal developer tools, CLI utilities, SDK libraries, and self-service infrastructure for engineering teams.", responsibilities: ["Internal tooling", "CLI development", "SDK libraries", "Self-service infra"], aiCapabilities: ["Tool generation", "CLI scaffolding", "SDK optimization", "Template creation"], icon: "Terminal", color: "#0ea5e9", monthlyPrice: 5000, isSubscribable: true },
            { name: "DX Engineer", title: "Developer Experience Engineer", level: "mid", division: "Developer Experience", description: "Maintains internal developer tools, local development environments, project templates, and developer documentation.", responsibilities: ["Dev environment", "Project templates", "Developer docs", "Tool maintenance"], aiCapabilities: ["Environment setup", "Template generation", "Doc automation", "Tool monitoring"], icon: "Terminal", color: "#0ea5e9", monthlyPrice: 3800, isSubscribable: true },
            { name: "Developer Portal Engineer", title: "Developer Portal Engineer", level: "mid", division: "Developer Experience", description: "Builds and maintains the internal developer portal (Backstage/Cortex), service catalog, API documentation, and tech radar.", responsibilities: ["Portal development", "Service catalog", "API docs", "Tech radar"], aiCapabilities: ["Catalog automation", "Doc generation", "Radar updates", "Service scoring"], icon: "BookOpen", color: "#0ea5e9", monthlyPrice: 3800, isSubscribable: true },
            { name: "Technical Writer", title: "Technical Writer", level: "mid", division: "Developer Experience", description: "Writes and maintains technical documentation, API references, runbooks, architecture decision records, and onboarding guides.", responsibilities: ["Technical docs", "API references", "Runbooks", "ADRs"], aiCapabilities: ["Doc generation", "Reference building", "Runbook templates", "ADR drafting"], icon: "FileText", color: "#0ea5e9", monthlyPrice: 3200, isSubscribable: true },
          ],
        },
        {
          name: "Director of DevSecOps", title: "Director of DevSecOps", level: "director", division: "DevSecOps", description: "Integrates security into the software development lifecycle — shift-left security, supply chain integrity, and secure-by-default pipelines.", responsibilities: ["Shift-left security", "Supply chain security", "Pipeline security", "SAST/DAST strategy"], aiCapabilities: ["Vulnerability prediction", "Supply chain analysis", "Pipeline hardening", "Code security scoring"], icon: "ShieldCheck", color: "#0ea5e9", monthlyPrice: 8000, isSubscribable: true,
          children: [
            { name: "Senior DevSecOps Engineer", title: "Senior DevSecOps Engineer", level: "senior", division: "DevSecOps", description: "Implements security scanning in CI/CD (SAST, DAST, SCA), container security policies, and secrets management.", responsibilities: ["Security scanning", "Container security", "Secrets management", "Policy enforcement"], aiCapabilities: ["Scan orchestration", "Policy generation", "Secret rotation", "Risk scoring"], icon: "ShieldCheck", color: "#0ea5e9", monthlyPrice: 5500, isSubscribable: true },
            { name: "DevSecOps Engineer", title: "DevSecOps Engineer", level: "mid", division: "DevSecOps", description: "Integrates SAST/DAST/SCA tools into pipelines, manages vulnerability triage, and enforces security gates.", responsibilities: ["Tool integration", "Vulnerability triage", "Security gates", "Compliance checks"], aiCapabilities: ["Triage automation", "Gate configuration", "Compliance validation", "Fix suggestions"], icon: "ShieldCheck", color: "#0ea5e9", monthlyPrice: 4200, isSubscribable: true },
            { name: "Supply Chain Security Engineer", title: "Supply Chain Security Engineer", level: "mid", division: "DevSecOps", description: "Software supply chain integrity — SBOM generation, dependency auditing, signing verification (Sigstore/Cosign), and provenance tracking.", responsibilities: ["SBOM generation", "Dependency auditing", "Signing verification", "Provenance tracking"], aiCapabilities: ["Dependency analysis", "Risk scoring", "Provenance validation", "SBOM automation"], icon: "Package", color: "#0ea5e9", monthlyPrice: 4500, isSubscribable: true },
            { name: "Secrets Management Engineer", title: "Secrets Management Engineer", level: "mid", division: "DevSecOps", description: "Manages HashiCorp Vault, AWS Secrets Manager, key rotation policies, and certificate lifecycle management.", responsibilities: ["Vault management", "Key rotation", "Certificate lifecycle", "Access policies"], aiCapabilities: ["Rotation scheduling", "Access analysis", "Certificate monitoring", "Policy generation"], icon: "Key", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Data Platform Engineering", title: "Director of Data Platform Engineering", level: "director", division: "Data Platform", description: "Manages the platform-side database infrastructure, data APIs, caching layers, and search infrastructure for product teams.", responsibilities: ["Data platform strategy", "Database infrastructure", "Caching strategy", "Search infrastructure"], aiCapabilities: ["Query optimization", "Cache analysis", "Index recommendations", "Platform health scoring"], icon: "Database", color: "#0ea5e9", monthlyPrice: 7500, isSubscribable: true,
          children: [
            { name: "Senior Database Platform Engineer", title: "Senior Database Platform Engineer", level: "senior", division: "Data Platform", description: "Designs multi-tenant database architectures, sharding strategies, replication topologies, and query optimization.", responsibilities: ["DB architecture", "Sharding design", "Replication strategy", "Query optimization"], aiCapabilities: ["Schema optimization", "Shard planning", "Replication tuning", "Query analysis"], icon: "Database", color: "#0ea5e9", monthlyPrice: 5500, isSubscribable: true },
            { name: "Database Platform Engineer", title: "Database Platform Engineer", level: "mid", division: "Data Platform", description: "Manages PostgreSQL, MySQL, MongoDB clusters, connection pooling, backup automation, and migration tooling.", responsibilities: ["Cluster management", "Connection pooling", "Backup automation", "Migration tooling"], aiCapabilities: ["Cluster monitoring", "Pool optimization", "Backup scheduling", "Migration generation"], icon: "Database", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
            { name: "Cache & In-Memory Engineer", title: "Cache & In-Memory Engineer", level: "mid", division: "Data Platform", description: "Redis/Memcached clusters, cache invalidation strategies, session stores, and in-memory data grids.", responsibilities: ["Cache architecture", "Invalidation strategy", "Session management", "Cluster ops"], aiCapabilities: ["Hit rate optimization", "Invalidation planning", "Memory analysis", "Cluster scaling"], icon: "Zap", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
            { name: "Search Infrastructure Engineer", title: "Search Infrastructure Engineer", level: "mid", division: "Data Platform", description: "Elasticsearch/OpenSearch cluster management, index design, relevance tuning, and full-text search optimization.", responsibilities: ["Search clusters", "Index design", "Relevance tuning", "Query optimization"], aiCapabilities: ["Index optimization", "Relevance scoring", "Query analysis", "Cluster sizing"], icon: "Search", color: "#0ea5e9", monthlyPrice: 4000, isSubscribable: true },
          ],
        },
      ],
    },
  },
  {
    name: "IT Finance & Vendor Management",
    icon: "DollarSign",
    color: "#059669",
    roles: {
      name: "VP of IT Finance & Vendor Management",
      title: "VP of IT Finance & Vendor Management",
      level: "vp",
      description: "Owns budgeting, licensing, procurement, and vendor relationships.",
      responsibilities: ["IT budget", "Vendor management", "Procurement strategy", "Cost optimization"],
      aiCapabilities: ["Spend analysis", "Contract optimization", "Vendor scoring", "License optimization"],
      icon: "DollarSign",
      color: "#059669",
      monthlyPrice: 10000,
      isSubscribable: true,
      children: [
        {
          name: "Director of IT Procurement", title: "Director of IT Procurement", level: "director", division: "Procurement", description: "Manages RFP/RFQ processes, contract negotiation, vendor selection.", responsibilities: ["RFP management", "Contract negotiation", "Vendor selection", "Spend tracking"], aiCapabilities: ["RFP automation", "Contract analysis", "Vendor comparison", "Cost forecasting"], icon: "ShoppingCart", color: "#059669", monthlyPrice: 6000, isSubscribable: true,
          children: [
            { name: "IT Procurement Manager", title: "IT Procurement Manager", level: "manager", division: "Procurement", description: "RFP/RFQ processes, contract negotiation, vendor selection.", responsibilities: ["RFP/RFQ process", "Negotiations", "Vendor evaluation", "Order management"], aiCapabilities: ["RFP scoring", "Price benchmarking", "Vendor analysis", "Order tracking"], icon: "ShoppingCart", color: "#059669", monthlyPrice: 4000, isSubscribable: true },
            { name: "Procurement Analyst", title: "Procurement Analyst", level: "mid", division: "Procurement", description: "Purchase orders, invoice validation, spend tracking.", responsibilities: ["PO management", "Invoice validation", "Spend tracking", "Budget reporting"], aiCapabilities: ["Invoice matching", "Spend analysis", "Budget forecasting", "Anomaly detection"], icon: "Receipt", color: "#059669", monthlyPrice: 2800, isSubscribable: true },
            { name: "License Compliance Analyst", title: "License Compliance Analyst", level: "mid", division: "Procurement", description: "True-up audits, license optimization, compliance gap identification.", responsibilities: ["License audits", "Optimization", "Compliance tracking", "Vendor coordination"], aiCapabilities: ["Usage tracking", "Compliance scoring", "Optimization recommendations", "Audit preparation"], icon: "FileCheck", color: "#059669", monthlyPrice: 3000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Vendor Management", title: "Director of Vendor Management", level: "director", division: "Vendor Management", description: "Manages vendor scorecards, performance reviews, and contract administration.", responsibilities: ["Vendor scorecards", "Performance reviews", "Contract management", "Relationship management"], aiCapabilities: ["Vendor scoring", "Performance tracking", "Contract analysis", "Risk assessment"], icon: "Users", color: "#059669", monthlyPrice: 6000, isSubscribable: true,
          children: [
            { name: "Vendor Relationship Manager", title: "Vendor Relationship Manager", level: "mid", division: "Vendor Management", description: "Vendor scorecards, performance reviews, escalation management.", responsibilities: ["Vendor scorecards", "Performance reviews", "Escalation management", "Relationship building"], aiCapabilities: ["Score automation", "Review scheduling", "Escalation tracking", "Sentiment analysis"], icon: "Users", color: "#059669", monthlyPrice: 3500, isSubscribable: true },
            { name: "Contract Administrator", title: "Contract Administrator", level: "mid", division: "Vendor Management", description: "Contract renewals, terms negotiation, SLA enforcement with vendors.", responsibilities: ["Contract renewals", "Terms negotiation", "SLA enforcement", "Document management"], aiCapabilities: ["Renewal alerting", "Terms analysis", "SLA tracking", "Obligation monitoring"], icon: "FileText", color: "#059669", monthlyPrice: 3000, isSubscribable: true },
            { name: "Cloud FinOps Analyst", title: "Cloud FinOps Analyst", level: "mid", division: "Vendor Management", description: "Cloud cost optimization, reserved instance planning, usage anomaly detection.", responsibilities: ["Cost optimization", "RI planning", "Usage analysis", "Chargeback models"], aiCapabilities: ["Cost anomaly detection", "RI recommendations", "Rightsizing analysis", "Chargeback automation"], icon: "DollarSign", color: "#059669", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
      ],
    },
  },
  {
    name: "R&D & Innovation",
    icon: "Lightbulb",
    color: "#d946ef",
    roles: {
      name: "VP of R&D & Innovation",
      title: "VP of R&D & Innovation",
      level: "vp",
      description: "Owns the technology research pipeline, emerging technology evaluation, and innovation programs that drive future product capabilities and competitive advantage.",
      responsibilities: ["R&D strategy", "Innovation programs", "Technology scouting", "Research partnerships", "Patent portfolio"],
      aiCapabilities: ["Technology trend analysis", "Research prioritization", "Innovation scoring", "Patent landscape mapping", "ROI forecasting"],
      icon: "Lightbulb",
      color: "#d946ef",
      monthlyPrice: 15000,
      isSubscribable: true,
      children: [
        {
          name: "Director of Applied Research", title: "Director of Applied Research", level: "director", division: "Applied Research", description: "Leads applied research translating academic advances into production-ready capabilities across AI, distributed systems, and security.", responsibilities: ["Research roadmap", "Academic partnerships", "Prototype-to-production", "Publication strategy"], aiCapabilities: ["Literature synthesis", "Feasibility analysis", "Research gap identification", "Impact prediction"], icon: "Microscope", color: "#d946ef", monthlyPrice: 9000, isSubscribable: true,
          children: [
            { name: "Principal Research Scientist", title: "Principal Research Scientist", level: "senior", division: "Applied Research", description: "Leads multi-quarter research initiatives in AI/ML, distributed systems, or security. Publishes findings and drives technology transfer.", responsibilities: ["Research leadership", "Technology transfer", "Publication", "Cross-team mentoring"], aiCapabilities: ["Research synthesis", "Experiment design", "Literature review automation", "Impact analysis"], icon: "Atom", color: "#d946ef", monthlyPrice: 7000, isSubscribable: true },
            { name: "Senior Research Engineer", title: "Senior Research Engineer", level: "senior", division: "Applied Research", description: "Builds research prototypes and experimental systems. Bridges the gap between theoretical research and engineering implementation.", responsibilities: ["Prototype engineering", "Experiment infrastructure", "Benchmarking", "Research tooling"], aiCapabilities: ["Prototype generation", "Benchmark automation", "Experiment tracking", "Code synthesis"], icon: "FlaskConical", color: "#d946ef", monthlyPrice: 5500, isSubscribable: true },
            { name: "Research Engineer", title: "Research Engineer", level: "mid", division: "Applied Research", description: "Implements research experiments, builds evaluation frameworks, and contributes to prototype development.", responsibilities: ["Experiment implementation", "Evaluation frameworks", "Data collection", "Result analysis"], aiCapabilities: ["Experiment automation", "Data pipeline setup", "Statistical analysis", "Result visualization"], icon: "FlaskConical", color: "#d946ef", monthlyPrice: 4000, isSubscribable: true },
            { name: "Research Analyst", title: "Research Analyst", level: "mid", division: "Applied Research", description: "Conducts market and technology research, competitive analysis, and prepares research briefings for leadership.", responsibilities: ["Market research", "Competitive analysis", "Technology assessments", "Research briefings"], aiCapabilities: ["Market intelligence", "Competitor tracking", "Trend analysis", "Briefing generation"], icon: "Search", color: "#d946ef", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
        {
          name: "Director of Emerging Technology", title: "Director of Emerging Technology", level: "director", division: "Emerging Technology", description: "Evaluates and pilots emerging technologies including quantum computing, Web3, edge AI, and next-gen architectures for enterprise applicability.", responsibilities: ["Technology scouting", "Pilot programs", "Feasibility studies", "Technology radar"], aiCapabilities: ["Tech radar automation", "Feasibility scoring", "Pilot tracking", "Adoption readiness assessment"], icon: "Telescope", color: "#d946ef", monthlyPrice: 8500, isSubscribable: true,
          children: [
            { name: "Senior Emerging Tech Engineer", title: "Senior Emerging Technology Engineer", level: "senior", division: "Emerging Technology", description: "Leads proof-of-concept projects for emerging technologies. Evaluates technical feasibility and enterprise readiness.", responsibilities: ["PoC leadership", "Technical evaluation", "Architecture assessment", "Integration planning"], aiCapabilities: ["PoC scaffolding", "Feasibility modeling", "Architecture simulation", "Risk assessment"], icon: "Rocket", color: "#d946ef", monthlyPrice: 5500, isSubscribable: true },
            { name: "Emerging Tech Engineer", title: "Emerging Technology Engineer", level: "mid", division: "Emerging Technology", description: "Builds and tests proof-of-concept implementations for new technologies. Contributes to technology evaluation frameworks.", responsibilities: ["PoC development", "Technology testing", "Evaluation frameworks", "Demo preparation"], aiCapabilities: ["Rapid prototyping", "Test automation", "Framework generation", "Demo creation"], icon: "Rocket", color: "#d946ef", monthlyPrice: 4000, isSubscribable: true },
            { name: "Quantum Computing Researcher", title: "Quantum Computing Researcher", level: "mid", division: "Emerging Technology", description: "Explores quantum computing applications for optimization, cryptography, and machine learning acceleration.", responsibilities: ["Quantum algorithms", "Crypto analysis", "Optimization research", "Quantum readiness"], aiCapabilities: ["Algorithm simulation", "Quantum circuit design", "Crypto impact assessment", "Readiness scoring"], icon: "Atom", color: "#d946ef", monthlyPrice: 5000, isSubscribable: true },
            { name: "Edge AI Specialist", title: "Edge AI Specialist", level: "mid", division: "Emerging Technology", description: "Develops and optimizes AI models for edge deployment, model compression, and on-device inference.", responsibilities: ["Edge model optimization", "Model compression", "On-device inference", "Edge deployment"], aiCapabilities: ["Model pruning", "Quantization optimization", "Latency analysis", "Edge benchmarking"], icon: "Cpu", color: "#d946ef", monthlyPrice: 4500, isSubscribable: true },
            { name: "Blockchain/Web3 Engineer", title: "Blockchain/Web3 Engineer", level: "mid", division: "Emerging Technology", description: "Evaluates distributed ledger technologies for supply chain, identity, and data integrity use cases.", responsibilities: ["DLT evaluation", "Smart contracts", "Identity solutions", "Data integrity"], aiCapabilities: ["Contract analysis", "Protocol comparison", "Use case scoring", "Integration assessment"], icon: "Link", color: "#d946ef", monthlyPrice: 4000, isSubscribable: true },
          ],
        },
        {
          name: "Director of Innovation Lab", title: "Director of Innovation Lab", level: "director", division: "Innovation Lab", description: "Runs the internal innovation lab — managing hackathons, rapid prototyping sprints, intrapreneurship programs, and design thinking workshops.", responsibilities: ["Innovation programs", "Hackathon management", "Intrapreneurship", "Design thinking", "IP strategy"], aiCapabilities: ["Idea scoring", "Market fit analysis", "Prototype acceleration", "Innovation metrics", "Patent drafting"], icon: "Sparkles", color: "#d946ef", monthlyPrice: 8000, isSubscribable: true,
          children: [
            { name: "Senior Innovation Engineer", title: "Senior Innovation Engineer", level: "senior", division: "Innovation Lab", description: "Leads rapid prototyping initiatives, turns winning hackathon ideas into viable product features, and mentors innovation teams.", responsibilities: ["Rapid prototyping", "Feature incubation", "Team mentoring", "Technology integration"], aiCapabilities: ["Prototype generation", "Feature feasibility", "Integration planning", "Impact modeling"], icon: "Sparkles", color: "#d946ef", monthlyPrice: 5000, isSubscribable: true },
            { name: "Innovation Engineer", title: "Innovation Engineer", level: "mid", division: "Innovation Lab", description: "Builds rapid prototypes, participates in design sprints, and contributes to innovation lab experiments.", responsibilities: ["Prototype development", "Design sprints", "Experiment execution", "Demo creation"], aiCapabilities: ["Rapid scaffolding", "Sprint facilitation", "Experiment tracking", "Demo automation"], icon: "Sparkles", color: "#d946ef", monthlyPrice: 3800, isSubscribable: true },
            { name: "UX Researcher", title: "UX Researcher", level: "mid", division: "Innovation Lab", description: "Conducts user research, usability testing, and design validation for innovation lab prototypes and emerging product concepts.", responsibilities: ["User research", "Usability testing", "Design validation", "Persona development"], aiCapabilities: ["Survey generation", "Sentiment analysis", "Heatmap analysis", "Persona modeling"], icon: "Users", color: "#d946ef", monthlyPrice: 3500, isSubscribable: true },
            { name: "Technology Evangelist", title: "Technology Evangelist", level: "mid", division: "Innovation Lab", description: "Promotes internal innovation culture, organizes tech talks, publishes technical blogs, and represents the company at conferences.", responsibilities: ["Tech talks", "Blog writing", "Conference representation", "Innovation culture"], aiCapabilities: ["Content generation", "Talk preparation", "Audience analysis", "Trend communication"], icon: "Megaphone", color: "#d946ef", monthlyPrice: 3500, isSubscribable: true },
            { name: "IP & Patent Analyst", title: "IP & Patent Analyst", level: "mid", division: "Innovation Lab", description: "Patent landscape analysis, invention disclosure management, prior art searches, and intellectual property portfolio strategy.", responsibilities: ["Patent analysis", "Invention disclosures", "Prior art search", "IP portfolio management"], aiCapabilities: ["Patent search automation", "Claim drafting assistance", "Landscape mapping", "Portfolio optimization"], icon: "FileCheck", color: "#d946ef", monthlyPrice: 3800, isSubscribable: true },
          ],
        },
      ],
    },
  },
  {
    name: "Compliance",
    icon: "Scale",
    color: "#7c3aed",
    roles: {
      name: "VP of Compliance",
      title: "VP of Compliance",
      level: "vp",
      description: "Owns enterprise-wide regulatory compliance, audit readiness, policy enforcement, and risk management across all IT operations.",
      responsibilities: ["Compliance strategy", "Regulatory oversight", "Audit management", "Policy governance", "Risk assessment"],
      aiCapabilities: ["Compliance gap analysis", "Regulatory change tracking", "Audit preparation automation", "Risk scoring", "Policy enforcement monitoring"],
      icon: "Scale",
      color: "#7c3aed",
      monthlyPrice: 14000,
      isSubscribable: true,
      children: [
        {
          name: "Director of Regulatory Compliance", title: "Director of Regulatory Compliance", level: "director", division: "Regulatory Compliance", description: "Manages compliance with industry regulations including GDPR, CCPA, SOX, HIPAA, and PCI-DSS across the organization.", responsibilities: ["Regulatory tracking", "Compliance programs", "Gap remediation", "Regulatory reporting"], aiCapabilities: ["Regulation mapping", "Gap detection", "Remediation planning", "Compliance dashboards"], icon: "BookOpen", color: "#7c3aed", monthlyPrice: 8000, isSubscribable: true,
          children: [
            { name: "Senior Regulatory Compliance Analyst", title: "Senior Regulatory Compliance Analyst", level: "senior", division: "Regulatory Compliance", description: "Leads compliance assessments for GDPR, SOX, and industry-specific regulations. Designs control frameworks and remediation plans.", responsibilities: ["Compliance assessments", "Control frameworks", "Remediation plans", "Regulatory research"], aiCapabilities: ["Control mapping", "Assessment automation", "Regulation parsing", "Impact analysis"], icon: "BookOpen", color: "#7c3aed", monthlyPrice: 5000, isSubscribable: true },
            { name: "GDPR Compliance Specialist", title: "GDPR Compliance Specialist", level: "mid", division: "Regulatory Compliance", description: "Data protection impact assessments, data subject rights management, cross-border transfer compliance.", responsibilities: ["DPIA execution", "DSR management", "Transfer mechanisms", "Privacy notices"], aiCapabilities: ["DPIA automation", "DSR tracking", "Transfer analysis", "Notice generation"], icon: "Shield", color: "#7c3aed", monthlyPrice: 4000, isSubscribable: true },
            { name: "SOX Compliance Analyst", title: "SOX Compliance Analyst", level: "mid", division: "Regulatory Compliance", description: "IT general controls testing, financial system access reviews, change management compliance for SOX requirements.", responsibilities: ["ITGC testing", "Access reviews", "Change management", "Evidence collection"], aiCapabilities: ["Control testing automation", "Access anomaly detection", "Change tracking", "Evidence management"], icon: "FileCheck", color: "#7c3aed", monthlyPrice: 3800, isSubscribable: true },
            { name: "HIPAA Compliance Specialist", title: "HIPAA Compliance Specialist", level: "mid", division: "Regulatory Compliance", description: "Healthcare data protection, PHI handling controls, breach notification compliance, and business associate agreements.", responsibilities: ["PHI safeguards", "Breach notifications", "BAA management", "Security rule compliance"], aiCapabilities: ["PHI flow mapping", "Breach risk scoring", "BAA tracking", "Safeguard validation"], icon: "Heart", color: "#7c3aed", monthlyPrice: 4000, isSubscribable: true },
            { name: "PCI-DSS Compliance Analyst", title: "PCI-DSS Compliance Analyst", level: "mid", division: "Regulatory Compliance", description: "Payment card data security standards compliance, scope management, and self-assessment questionnaires.", responsibilities: ["PCI scope management", "SAQ completion", "Control validation", "Cardholder data mapping"], aiCapabilities: ["Scope analysis", "Control gap detection", "SAQ automation", "Data flow mapping"], icon: "CreditCard", color: "#7c3aed", monthlyPrice: 3800, isSubscribable: true },
          ],
        },
        {
          name: "Director of Audit & Assurance", title: "Director of Audit & Assurance", level: "director", division: "Audit & Assurance", description: "Manages internal IT audits, external audit coordination, and continuous compliance monitoring across all systems.", responsibilities: ["Audit planning", "External audit coordination", "Evidence management", "Findings remediation"], aiCapabilities: ["Audit scheduling", "Evidence collection automation", "Finding classification", "Remediation tracking"], icon: "ClipboardCheck", color: "#7c3aed", monthlyPrice: 7500, isSubscribable: true,
          children: [
            { name: "Senior IT Auditor", title: "Senior IT Auditor", level: "senior", division: "Audit & Assurance", description: "Plans and executes IT audit engagements, assesses control effectiveness, and reports findings to leadership.", responsibilities: ["Audit execution", "Control assessment", "Risk evaluation", "Audit reporting"], aiCapabilities: ["Audit program generation", "Control testing automation", "Risk heat mapping", "Report drafting"], icon: "ClipboardCheck", color: "#7c3aed", monthlyPrice: 5000, isSubscribable: true },
            { name: "IT Auditor", title: "IT Auditor", level: "mid", division: "Audit & Assurance", description: "Conducts audit fieldwork, tests controls, collects evidence, and documents findings for IT audit engagements.", responsibilities: ["Fieldwork execution", "Control testing", "Evidence collection", "Finding documentation"], aiCapabilities: ["Test script generation", "Evidence validation", "Finding categorization", "Workpaper automation"], icon: "ClipboardCheck", color: "#7c3aed", monthlyPrice: 3500, isSubscribable: true },
            { name: "Continuous Compliance Monitor", title: "Continuous Compliance Monitor", level: "mid", division: "Audit & Assurance", description: "Real-time compliance monitoring, automated control testing, deviation alerting, and compliance dashboard management.", responsibilities: ["Real-time monitoring", "Automated testing", "Deviation alerts", "Dashboard management"], aiCapabilities: ["Anomaly detection", "Continuous control testing", "Drift alerting", "Compliance scoring"], icon: "Activity", color: "#7c3aed", monthlyPrice: 3800, isSubscribable: true },
          ],
        },
        {
          name: "Director of Policy & Standards", title: "Director of Policy & Standards", level: "director", division: "Policy & Standards", description: "Develops, maintains, and enforces IT policies, standards, and procedures organization-wide.", responsibilities: ["Policy development", "Standards maintenance", "Exception management", "Policy communication"], aiCapabilities: ["Policy drafting", "Gap analysis", "Exception tracking", "Compliance mapping"], icon: "FileText", color: "#7c3aed", monthlyPrice: 7000, isSubscribable: true,
          children: [
            { name: "Senior Policy Analyst", title: "Senior Policy Analyst", level: "senior", division: "Policy & Standards", description: "Drafts and reviews IT policies, maps controls to regulatory requirements, and manages policy lifecycle.", responsibilities: ["Policy authoring", "Control mapping", "Policy reviews", "Lifecycle management"], aiCapabilities: ["Policy generation", "Regulatory mapping", "Impact assessment", "Version tracking"], icon: "FileText", color: "#7c3aed", monthlyPrice: 4500, isSubscribable: true },
            { name: "Policy Analyst", title: "Policy Analyst", level: "mid", division: "Policy & Standards", description: "Maintains policy repository, tracks policy acknowledgments, and manages exceptions and waivers.", responsibilities: ["Repository management", "Acknowledgment tracking", "Exception processing", "Policy distribution"], aiCapabilities: ["Acknowledgment automation", "Exception analysis", "Distribution tracking", "Gap identification"], icon: "FileText", color: "#7c3aed", monthlyPrice: 3200, isSubscribable: true },
            { name: "Standards & Frameworks Analyst", title: "Standards & Frameworks Analyst", level: "mid", division: "Policy & Standards", description: "Maps organizational controls to frameworks like NIST, COBIT, ISO 27001, and maintains the unified control framework.", responsibilities: ["Framework mapping", "Control inventory", "Cross-framework alignment", "Standards updates"], aiCapabilities: ["Control mapping automation", "Framework comparison", "Gap detection", "Standards monitoring"], icon: "Layers", color: "#7c3aed", monthlyPrice: 3500, isSubscribable: true },
          ],
        },
        {
          name: "Director of Risk Management", title: "Director of IT Risk Management", level: "director", division: "Risk Management", description: "Identifies, assesses, and mitigates IT risks across the organization. Maintains the risk register and reports to leadership.", responsibilities: ["Risk identification", "Risk assessment", "Mitigation planning", "Risk reporting"], aiCapabilities: ["Risk scoring", "Threat modeling", "Mitigation recommendations", "Risk trend analysis"], icon: "AlertTriangle", color: "#7c3aed", monthlyPrice: 7500, isSubscribable: true,
          children: [
            { name: "Senior Risk Analyst", title: "Senior IT Risk Analyst", level: "senior", division: "Risk Management", description: "Conducts risk assessments, manages the IT risk register, and designs risk treatment plans for critical systems.", responsibilities: ["Risk assessments", "Risk register", "Treatment plans", "Quantitative analysis"], aiCapabilities: ["Risk quantification", "Scenario modeling", "Treatment optimization", "Register automation"], icon: "AlertTriangle", color: "#7c3aed", monthlyPrice: 4500, isSubscribable: true },
            { name: "Risk Analyst", title: "IT Risk Analyst", level: "mid", division: "Risk Management", description: "Performs vendor risk assessments, third-party due diligence, and ongoing risk monitoring for IT operations.", responsibilities: ["Vendor risk assessments", "Third-party due diligence", "Risk monitoring", "Risk documentation"], aiCapabilities: ["Vendor scoring", "Due diligence automation", "Risk alerting", "Documentation generation"], icon: "AlertTriangle", color: "#7c3aed", monthlyPrice: 3500, isSubscribable: true },
            { name: "Business Continuity Analyst", title: "Business Continuity Analyst", level: "mid", division: "Risk Management", description: "Business impact analysis, disaster recovery planning, BCP testing, and recovery time objective management.", responsibilities: ["BIA execution", "DR planning", "BCP testing", "RTO/RPO management"], aiCapabilities: ["BIA automation", "DR plan generation", "Test scenario design", "Recovery optimization"], icon: "RefreshCw", color: "#7c3aed", monthlyPrice: 3800, isSubscribable: true },
          ],
        },
      ],
    },
  },
];

let sortCounter = 0;

async function createRoleTree(
  role: RoleDef & { division?: string },
  department: string,
  parentId: string | null,
  division: string | null,
): Promise<void> {
  sortCounter++;
  const created = await storage.createOrgRole({
    name: role.name,
    title: role.title,
    department,
    division: role.division || division,
    parentRoleId: parentId,
    level: role.level,
    description: role.description,
    responsibilities: role.responsibilities,
    aiCapabilities: role.aiCapabilities,
    icon: role.icon,
    color: role.color,
    monthlyPrice: role.monthlyPrice,
    isSubscribable: role.isSubscribable,
    sortOrder: sortCounter,
  });

  if (role.children) {
    for (const child of role.children) {
      await createRoleTree(child, department, created.id, child.division || role.division || division);
    }
  }
}

const ctoDepartments = new Set([
  "Infrastructure & Cloud Operations",
  "Data & Analytics",
  "Platform Engineering",
  "R&D & Innovation",
]);

async function seedMissingDepartments(existing: any[]) {
  const existingDepts = new Set(existing.map(r => r.department));
  const existingDivisions = new Set(existing.filter(r => r.division).map(r => r.division));
  const existingNames = new Set(existing.map(r => r.name));
  const cto = existing.find(r => r.level === "cxo" && r.name === "Chief Technology Officer");
  const cio = existing.find(r => r.level === "cxo" && r.name === "Chief Information Officer");

  if (!cto && !cio) {
    console.log("[seed] No CTO or CIO found — skipping missing department seeding");
    return;
  }

  for (const dept of departments) {
    if (!existingDepts.has(dept.name)) {
      const parentId = ctoDepartments.has(dept.name) ? cto?.id : cio?.id;
      if (!parentId) {
        console.log(`[seed] Skipping department "${dept.name}" — required parent (${ctoDepartments.has(dept.name) ? "CTO" : "CIO"}) not found`);
        continue;
      }
      console.log(`[seed] Seeding missing department: ${dept.name}`);
      await createRoleTree(dept.roles, dept.name, parentId, null);
    } else if (dept.roles.children) {
      const vpRole = existing.find(r => r.department === dept.name && r.level === "vp");
      if (!vpRole) continue;

      for (const dirChild of dept.roles.children) {
        const divisionName = dirChild.division || dirChild.name;
        if (!existingNames.has(dirChild.name) && !existingDivisions.has(divisionName)) {
          console.log(`[seed] Seeding missing division "${divisionName}" in department "${dept.name}"`);
          await createRoleTree(dirChild, dept.name, vpRole.id, dirChild.division || null);
        }
      }
    }
  }
}

export async function seedOrgRoles() {
  await db.execute(sql`UPDATE org_roles SET is_subscribable = true WHERE level = 'vp'`);
  await db.execute(sql`ALTER TABLE org_roles ADD COLUMN IF NOT EXISTS job_description text`);
  await db.execute(sql`ALTER TABLE org_roles ADD COLUMN IF NOT EXISTS required_skills text[]`);
  await db.execute(sql`ALTER TABLE org_roles ADD COLUMN IF NOT EXISTS key_tasks text[]`);
  await db.execute(sql`ALTER TABLE org_roles ADD COLUMN IF NOT EXISTS human_cost_monthly integer`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country text`);
  await enrichRolesWithJobData();
  await updateRolePricing();

  const existing = await storage.getOrgRoles();
  if (existing.length > 0) {
    await seedMissingDepartments(existing);
    return;
  }

  const cio = await storage.createOrgRole({
    name: "Chief Information Officer",
    title: "CIO — Chief Information Officer",
    department: "Executive",
    division: null,
    parentRoleId: null,
    level: "cxo",
    description: "Overall IT strategy, governance, budget, vendor relationships, and board reporting. The CIO ensures technology investments align with business objectives.",
    responsibilities: ["IT Strategy", "Governance", "Budget Management", "Board Reporting", "Digital Transformation"],
    aiCapabilities: ["Strategic planning AI", "Budget optimization", "Risk forecasting", "Technology radar", "Board report generation"],
    icon: "Crown",
    color: "#0f172a",
    monthlyPrice: 0,
    isSubscribable: false,
    sortOrder: 0,
  });

  sortCounter++;
  const cto = await storage.createOrgRole({
    name: "Chief Technology Officer",
    title: "CTO — Chief Technology Officer",
    department: "Executive",
    division: null,
    parentRoleId: cio.id,
    level: "cxo",
    description: "Drives technology strategy, innovation, and engineering excellence. Oversees infrastructure, platform engineering, and data operations to ensure technical capabilities meet business demands.",
    responsibilities: ["Technology Strategy", "Engineering Excellence", "Innovation Leadership", "Technical Architecture", "R&D Oversight"],
    aiCapabilities: ["Technology evaluation AI", "Architecture optimization", "Innovation scoring", "Technical debt analysis", "Engineering productivity analysis"],
    icon: "Cpu",
    color: "#1e293b",
    monthlyPrice: 0,
    isSubscribable: false,
    sortOrder: sortCounter,
  });

  for (const dept of departments) {
    const parentId = ctoDepartments.has(dept.name) ? cto.id : cio.id;
    await createRoleTree(dept.roles, dept.name, parentId, null);
  }
}
