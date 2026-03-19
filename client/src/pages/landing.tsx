import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import holocronLogo from "@assets/Holocron_Logo_Icon_White_1772663128663.png";
import { useState, useEffect, useRef } from "react";
import {
  Bot, Shield, Cpu, Network, BarChart3, MessageSquare,
  Users, Zap, ArrowRight, CheckCircle2, Globe, Lock,
  Activity, Bell, ChevronRight, Star, Layers, Eye,
  Server, Cloud, FileText, AlertTriangle, Mail,
  Wifi, Radio, Terminal, Satellite, Gauge, BookOpen,
  Trophy, Target, Clock, Calendar, Phone, HeartPulse,
  Search, Database, Wrench, GitBranch, ShieldCheck,
  BrainCircuit, Workflow, Lightbulb, Rocket, Sparkles,
  MonitorSmartphone, CircuitBoard, Blocks, Siren,
  TrendingUp, Award, Fingerprint, ArrowUpRight,
  ChevronDown, Play, ExternalLink, Brain,
  FlaskConical, Microscope, ScanLine, Braces, Code2,
  Quote, Infinity, Hexagon,
  SendHorizonal, Atom, Boxes, Wand2, Crosshair, Antenna,
  PlugZap, Smartphone, ScanSearch, RefreshCw, Unplug,
  Shuffle, LayoutDashboard, GitMerge, Sliders, HardDrive,
  BarChart, ShieldAlert, ListChecks, Map, Cog,
  PersonStanding, ArrowLeftRight, Gauge as GaugeIcon,
  Repeat2, ChevronsRight, AlarmClock, Binary,
  ClipboardList, Package, Handshake, RefreshCcw,
} from "lucide-react";

function AnimatedCounter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) setStarted(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started) return;
    let v = 0;
    const step = Math.ceil(end / (1800 / 16));
    const t = setInterval(() => { v += step; if (v >= end) { setCount(end); clearInterval(t); } else setCount(v); }, 16);
    return () => clearInterval(t);
  }, [started, end]);
  return <div ref={ref}><span>{prefix}{count.toLocaleString()}{suffix}</span></div>;
}

function TypewriterText({ phrases }: { phrases: string[] }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [del, setDel] = useState(false);
  useEffect(() => {
    const phrase = phrases[idx];
    if (!del && text === phrase) { const t = setTimeout(() => setDel(true), 2400); return () => clearTimeout(t); }
    if (del && text === "") { setDel(false); setIdx(i => (i + 1) % phrases.length); return; }
    const t = setTimeout(() => setText(p => del ? p.slice(0, -1) : phrase.slice(0, p.length + 1)), del ? 32 : 60);
    return () => clearTimeout(t);
  }, [text, del, idx, phrases]);
  return <span className="text-gradient">{text}<span className="animate-pulse opacity-70">|</span></span>;
}

function Monitor(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}

const heroTypewriter = [
  "Orchestrating the Future of Work",
  "Full ITIL v4 — AI-Native",
  "Proactive. Autonomous. Intelligent.",
  "Human + AI Workforce, Unified",
  "One of a Kind, Globally",
];

const worldFirsts = [
  "First platform to orchestrate human staff and AI agents as a single unified workforce",
  "First to deliver the full ITIL v4 practice spectrum through Generative AI",
  "First ITSM with proactive, predictive, and autonomous infrastructure management",
  "First 9-protocol probe network covering IP, serial, RF, mesh, and cryptographic air-gap",
  "First ITSM with native Android & iOS mobile device management via probe agents",
  "First to generate BCP/DRP plans autonomously from live infrastructure context",
  "First IT platform with a built-in XP gamification engine driving measurable behaviour",
  "First to unify NOC, SOC, ITSM, CMDB, MDM, and BCP under a single GenAI orchestrator",
  "First IT platform with an autonomous AI Quality Guardian — circuit breakers, hallucination defense, and prompt patching running live across every AI module",
  "First ITSM with multi-agent adversarial deliberation (Conclave) to eliminate AI bias and hallucination before decisions execute",
];

const orchestratorCapabilities = [
  {
    icon: Shuffle,
    title: "Dynamic Work Allocation",
    desc: "The AI Orchestrator continuously evaluates every incoming task — complexity, urgency, domain, cost — and assigns it to the optimal human agent or AI agent in real time.",
    color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20",
  },
  {
    icon: PersonStanding,
    title: "Human–AI Teaming",
    desc: "Humans and AI agents share the same workspace, same queue, and same visibility. The Orchestrator ensures neither is overloaded, and escalation happens seamlessly between them.",
    color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20",
  },
  {
    icon: ArrowLeftRight,
    title: "Autonomous Escalation",
    desc: "When an AI agent encounters ambiguity or risk beyond its threshold, it autonomously escalates to the correct human — with full context, recommended actions, and decision support.",
    color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20",
  },
  {
    icon: Repeat2,
    title: "Continuous Rebalancing",
    desc: "As incidents resolve, priorities shift, and staff availability changes, the Orchestrator rebalances the entire workforce in real time — no manager intervention required.",
    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20",
  },
  {
    icon: LayoutDashboard,
    title: "Unified Crew Command",
    desc: "One dashboard. Every Crew (department), every Agent (role), every human, every AI — with live workload, performance metrics, and bottleneck detection across the organisation.",
    color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20",
  },
  {
    icon: Binary,
    title: "Cost Intelligence",
    desc: "The Orchestrator knows the per-task cost of every AI agent and every human. It optimises for quality, speed, and cost — routing work to deliver the best outcome at the lowest price.",
    color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20",
  },
];

const infrastructureDevices = [
  { category: "Network Infrastructure", color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/8", icon: Network, items: ["Routers (Cisco, Juniper, Aruba, MikroTik)", "Firewalls (Palo Alto, Fortinet, Check Point, pfSense)", "Switches (Layer 2 & Layer 3, managed & unmanaged)", "Load Balancers (F5, HAProxy, NGINX, AWS ALB)", "SD-WAN Appliances & Controllers", "VPN Gateways & Concentrators", "Wireless Access Points & Controllers", "DNS / DHCP / IPAM Servers"] },
  { category: "Compute & Virtualisation", color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/8", icon: Server, items: ["Physical Servers (Dell, HP, Lenovo, SuperMicro)", "Hypervisors (VMware vSphere, Hyper-V, KVM, XenServer)", "Kubernetes Clusters & Container Runtimes", "Docker Hosts & Microservice Meshes", "Cloud VMs (AWS EC2, Azure VMs, GCP Compute)", "Bare-metal & Colocation Infrastructure", "Blade Chassis & Modular Servers", "HPC / GPU Compute Nodes"] },
  { category: "Storage & Data", color: "text-cyan-400", border: "border-cyan-500/20", bg: "bg-cyan-500/8", icon: HardDrive, items: ["SAN / NAS Arrays (NetApp, Pure Storage, EMC)", "Object Storage (S3, Azure Blob, GCS)", "Relational Databases (MSSQL, MySQL, PostgreSQL, Oracle)", "NoSQL & Caching (MongoDB, Redis, Cassandra)", "Data Warehouses (Snowflake, Redshift, BigQuery)", "Backup & Recovery Appliances", "File Servers & DFS Shares", "RAID Controllers & Tape Libraries"] },
  { category: "Mission-Critical Applications", color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/8", icon: Layers, items: ["ERP Systems (SAP, Oracle Financials, Microsoft Dynamics)", "CRM Platforms (Salesforce, HubSpot, ServiceNow)", "Identity & Directory (Active Directory, Azure AD, LDAP)", "Email & Collaboration (Exchange, Microsoft 365, Google Workspace)", "DevOps Toolchains (Jenkins, GitLab, GitHub Actions, Terraform)", "Web & API Services (custom microservices, REST, GraphQL)", "Middleware & ESBs (MuleSoft, IBM MQ, RabbitMQ)", "Business Intelligence & Reporting Platforms"] },
  { category: "Industrial & OT / IoT", color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/8", icon: CircuitBoard, items: ["SCADA Systems & Historians (OSIsoft PI, Wonderware)", "Programmable Logic Controllers (Siemens, Rockwell, ABB)", "Remote Terminal Units (RTUs) & IEDs", "Building Management Systems (BACnet, KNX, Modbus)", "Industrial Sensors & Actuators", "Smart Meters & Energy Management Systems", "Environmental Monitoring Sensors", "Air-gapped & Isolated OT Networks"] },
  { category: "Mobile & End-User", color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/8", icon: Smartphone, items: ["Android Devices (via Termux Probe Agent, MDM)", "iOS Devices (via a-Shell Probe, Shortcuts MDM)", "Windows Laptops & Desktops (WMI / PowerShell)", "macOS Endpoints (SSH / API agents)", "Virtual Desktops (Citrix, VMware Horizon, AVD)", "Thin Clients & Kiosk Devices", "Printers, Scanners & Peripherals", "USB & Removable Media Policies"] },
];

const monitoringProtocols = [
  { name: "WMI", full: "Windows Management Instrumentation", desc: "Deep Windows host metrics — CPU, memory, processes, services, event logs, registry, hardware inventory", icon: Monitor, color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/8", use: "Windows servers, laptops, desktops" },
  { name: "SNMP", full: "Simple Network Management Protocol (v1/v2c/v3)", desc: "Industry-standard network device polling — interface stats, bandwidth, error rates, device health, traps & informs", icon: Network, color: "text-cyan-400", border: "border-cyan-500/20", bg: "bg-cyan-500/8", use: "Routers, switches, firewalls, UPS, printers" },
  { name: "SSH", full: "Secure Shell", desc: "Encrypted command execution on Unix/Linux systems — real-time metrics, log tailing, config audit, software inventory, script execution", icon: Terminal, color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/8", use: "Linux servers, macOS, network appliances" },
  { name: "REST / GraphQL API", full: "Application Programming Interfaces", desc: "Native integration with cloud platforms, SaaS apps, and custom services — authenticated, rate-aware, schema-validated telemetry collection", icon: Code2, color: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/8", use: "Cloud services, SaaS, custom apps, microservices" },
  { name: "LoRaWAN", full: "Long Range Wide Area Network", desc: "Low-power long-range RF protocol for remote sensors and rural infrastructure — covers areas where IP connectivity is unavailable", icon: Satellite, color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/8", use: "Remote sensors, agriculture, utilities, smart cities" },
  { name: "BACnet", full: "Building Automation and Control Networks", desc: "ASHRAE-standard protocol for building management systems — HVAC, lighting, access control, energy, environmental monitoring", icon: CircuitBoard, color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/8", use: "HVAC, BMS, smart buildings, data centres" },
  { name: "MQTT", full: "Message Queuing Telemetry Transport", desc: "Lightweight pub/sub messaging for IoT and constrained devices — low bandwidth, high frequency telemetry from thousands of endpoints", icon: Wifi, color: "text-teal-400", border: "border-teal-500/20", bg: "bg-teal-500/8", use: "IoT sensors, industrial devices, edge agents" },
  { name: "Modbus", full: "Modbus RTU / TCP", desc: "De-facto standard for industrial control systems — reads registers from PLCs, drives, meters, and sensors over serial or TCP/IP", icon: Cpu, color: "text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/8", use: "PLCs, VFDs, energy meters, industrial sensors" },
  { name: "ICMP / NetFlow", full: "Ping, Traceroute & Traffic Flow Analysis", desc: "Baseline reachability, latency, packet loss, and deep traffic flow analytics — maps real-time inter-device communication paths", icon: Activity, color: "text-indigo-400", border: "border-indigo-500/20", bg: "bg-indigo-500/8", use: "All IP-connected devices — network health baseline" },
  { name: "MDM Protocols", full: "Mobile Device Management APIs", desc: "Native Android & iOS MDM via HOLOCRON probe agents — enrollment, compliance, app inventory, remote lock/wipe/locate/message", icon: Smartphone, color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/8", use: "Android smartphones/tablets, iPhone, iPad" },
  { name: "WebSocket / WSS", full: "Full-Duplex Real-Time Streaming", desc: "Persistent bidirectional channels for high-frequency telemetry streams — millisecond-latency alerting from real-time event sources", icon: Zap, color: "text-yellow-400", border: "border-yellow-500/20", bg: "bg-yellow-500/8", use: "Real-time dashboards, high-speed event sources" },
  { name: "Reticulum", full: "Cryptographic Mesh Network Protocol", desc: "Air-gap–capable encrypted mesh networking — reaches completely isolated environments with no internet access, no central server required", icon: Blocks, color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/8", use: "Air-gapped, classified, and off-grid sites" },
];

const realtimePipeline = [
  { icon: ScanLine, label: "Probe Telemetry", desc: "12 monitoring protocols collecting real-time data across every device, application, and sensor in your ecosystem", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/25" },
  { icon: BrainCircuit, label: "AI Correlation Engine", desc: "AI correlates signals across systems — detecting complex multi-vector events that no single alert would surface", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25" },
  { icon: Siren, label: "Incident Management", desc: "Auto-classified incidents with severity, affected CIs, root cause narrative, and recommended remediation — in seconds", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25" },
  { icon: ShieldAlert, label: "Security Response", desc: "CVE cross-referencing, firewall rule analysis, and autonomous containment actions initiated before a human is paged", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/25" },
  { icon: FileText, label: "BCP/DRP Activation", desc: "Live incident severity triggers BCP/DRP response workflows — escalation, communications, recovery procedures, real-time drill readiness", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
  { icon: ShieldCheck, label: "Audit & Compliance", desc: "Every event, every action, every decision — cryptographically signed and stored for regulatory compliance and post-incident review", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
];

const agentCapabilities = [
  {
    icon: Brain,
    title: "Reason & Think",
    desc: "Every AI agent applies multi-step AI reasoning before acting. It weighs context, history, risk, and policy — then forms a considered response, just as a senior specialist would.",
    tag: "Cognitive Reasoning",
    color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20",
  },
  {
    icon: Lightbulb,
    title: "Think Outside the Box",
    desc: "AI agents aren't constrained by habit or convention. When standard approaches won't work, the agent reasons laterally — surfacing creative solutions your team may never have considered.",
    tag: "Lateral Initiative",
    color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20",
  },
  {
    icon: Cog,
    title: "Configure & Execute",
    desc: "Beyond recommendations — AI agents can configure systems, write and run scripts, adjust policies, deploy changes, and execute multi-step playbooks end-to-end, autonomously.",
    tag: "Autonomous Execution",
    color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20",
  },
  {
    icon: RefreshCw,
    title: "Self-Heal the Ecosystem",
    desc: "When something breaks anywhere in your technology stack — infrastructure, application, security posture, or data pipeline — the AI agent diagnoses, repairs, and validates, closing the loop without human intervention.",
    tag: "Self-Healing",
    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20",
  },
  {
    icon: Zap,
    title: "Take Initiative",
    desc: "AI agents don't wait to be told. They monitor their domain continuously, spot emerging issues, identify optimisation opportunities, and proactively act — or escalate — before problems become visible.",
    tag: "Proactive Initiative",
    color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20",
  },
  {
    icon: Clock,
    title: "Always On, Always Sharp",
    desc: "No fatigue. No leave. No context-switching. AI agents operate at full capability 24 hours a day, 365 days a year — handling the volume and velocity that would exhaust any human team.",
    tag: "24 / 7 / 365",
    color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20",
  },
];

const agentRoles = [
  { title: "Infrastructure Analyst", crew: "Infrastructure & Cloud", cost: "~$8/day", icon: Server, color: "text-blue-400" },
  { title: "SOC Threat Hunter", crew: "Cybersecurity", cost: "~$8/day", icon: ShieldAlert, color: "text-red-400" },
  { title: "ITSM Service Agent", crew: "Service Management", cost: "~$6/day", icon: Activity, color: "text-green-400" },
  { title: "Compliance Auditor", crew: "Compliance & Risk", cost: "~$7/day", icon: ShieldCheck, color: "text-teal-400" },
  { title: "Change Risk Analyst", crew: "Platform Engineering", cost: "~$7/day", icon: GitBranch, color: "text-indigo-400" },
  { title: "Data Intelligence Agent", crew: "Data & Analytics", cost: "~$6/day", icon: BarChart3, color: "text-amber-400" },
  { title: "NOC Operations Agent", crew: "Infrastructure & Cloud", cost: "~$8/day", icon: Network, color: "text-cyan-400" },
  { title: "BCP/DRP Coordinator", crew: "Compliance & Risk", cost: "~$7/day", icon: FileText, color: "text-purple-400" },
];

const genAiEngine = [
  { icon: Brain, title: "Multi-Model AI Engine", desc: "8 free LLM providers supported out of the box — Ollama, Gemini, Grok, Groq, Mistral, OpenRouter, Together AI, HuggingFace. A 4-tier priority waterfall ensures the best available model is always used, with automatic OpenAI fallback. Not a plugin — the intelligence layer of the entire platform.", tag: "Foundation Model", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { icon: Wand2, title: "Generative Remediation", desc: "HOLOCRON doesn't alert you to incidents — it generates the full remediation plan, runbook, and corrective script in real time.", tag: "Auto-Remediation", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { icon: Microscope, title: "Causal Root Analysis", desc: "Deep causal reasoning across your entire event graph — correlating probes, logs, metrics, user reports — and narrating what happened.", tag: "Causal Intelligence", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  { icon: Braces, title: "AI-Generated Policies", desc: "MDM compliance policies, firewall rules, ITIL procedures, and BCP plans generated from your infrastructure's live context — not generic templates.", tag: "Policy Generation", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { icon: ScanLine, title: "Predictive Failure", desc: "9-protocol telemetry feeds a continuous generative analysis loop — surfacing failure scenarios before they occur, with confidence scores.", tag: "Predictive Ops", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { icon: SendHorizonal, title: "NLP Ops Console", desc: "Ask anything in plain language. The AI routes your question to the right specialist agent — infrastructure, security, compliance, or service.", tag: "Conversational Ops", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { icon: ShieldCheck, title: "AI Quality Guardian", desc: "Every AI output is automatically reviewed by an independent critic agent in the background. Circuit breakers trip after 3 consecutive quality failures — injecting corrective prompt patches and raising ITIL incidents automatically until quality recovers.", tag: "Hallucination Defense", color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" },
  { icon: Atom, title: "Holocron Conclave", desc: "5 adversarial AI agents (Advocate, Critic, Risk Assessor, Pragmatist, Ethicist) debate your most consequential decisions across 2 rounds. A Synthesizer builds consensus. The platform then executes and self-evaluates the outcome — eliminating single-model bias at source.", tag: "Multi-Agent Consensus", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  { icon: FlaskConical, title: "Prompt Security Shield", desc: "12-pattern regex engine blocks prompt injection, jailbreak, DAN mode, role-override, and system-message hijack attempts in real time across all 76 AI endpoints. Every blocked attempt is logged and surfaced in the AI Governance audit trail.", tag: "Injection Defense", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
];

const proactiveCapabilities = [
  {
    icon: ScanSearch,
    title: "Predictive Health Monitoring",
    desc: "AI continuously analyses telemetry trends across all endpoints. CPU drift, memory pressure, storage fill rates, and network degradation patterns are detected and acted on before any service is affected.",
    tag: "Predictive",
    color: "text-indigo-400", border: "border-indigo-500/25", bg: "bg-indigo-500/8",
  },
  {
    icon: ShieldAlert,
    title: "Autonomous Vulnerability Response",
    desc: "The moment a CVE is published, HOLOCRON cross-references your CMDB, scores exposure, generates a remediation plan, and raises the change request — all before your team opens their laptop.",
    tag: "Autonomous Security",
    color: "text-red-400", border: "border-red-500/25", bg: "bg-red-500/8",
  },
  {
    icon: Cog,
    title: "Self-Healing Infrastructure",
    desc: "Failed services, crashed containers, degraded databases — HOLOCRON detects, diagnoses, and remediates autonomously using pre-approved playbooks. Human approval only when risk thresholds demand it.",
    tag: "Self-Healing",
    color: "text-emerald-400", border: "border-emerald-500/25", bg: "bg-emerald-500/8",
  },
  {
    icon: Sliders,
    title: "Capacity Optimisation",
    desc: "AI models forecast resource demand based on historical patterns, seasonal trends, and business growth signals — automatically provisioning or decommissioning infrastructure to maintain optimal cost efficiency.",
    tag: "Auto-Scaling",
    color: "text-amber-400", border: "border-amber-500/25", bg: "bg-amber-500/8",
  },
  {
    icon: AlarmClock,
    title: "Pre-emptive SLA Management",
    desc: "Instead of alerting you when an SLA has breached, HOLOCRON AI predicts breach risk hours in advance — reallocating resources, reassigning priorities, and notifying stakeholders proactively.",
    tag: "Proactive SLA",
    color: "text-blue-400", border: "border-blue-500/25", bg: "bg-blue-500/8",
  },
  {
    icon: GitMerge,
    title: "Change Risk Pre-emption",
    desc: "Every proposed change is modelled against live infrastructure topology. The AI identifies collision risks, dependency conflicts, and blast radius before the CAB ever meets — eliminating change-induced outages.",
    tag: "Risk Intelligence",
    color: "text-purple-400", border: "border-purple-500/25", bg: "bg-purple-500/8",
  },
];

const itilV4Practices = [
  { group: "Service Management", color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/8", practices: ["Incident Management", "Problem Management", "Change Enablement", "Service Request Mgmt", "Service Level Mgmt", "Service Catalogue", "Availability Management", "Capacity & Performance", "IT Asset Management", "Monitoring & Event Mgmt"] },
  { group: "Technical Management", color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/8", practices: ["Infrastructure & Platform", "Software Development", "Deployment Management", "Release Management", "Configuration Mgmt", "Service Continuity", "Service Design", "Service Validation", "Service Measurement", "Business Analysis"] },
  { group: "General Management", color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/8", practices: ["Strategy Management", "Portfolio Management", "Architecture Mgmt", "Risk Management", "Information Security", "Knowledge Management", "Workforce & Talent", "Supplier Management", "Relationship Mgmt", "Continual Improvement"] },
];

const itilAllPractices = [
  {
    group: "Service Management Practices",
    groupColor: "text-blue-400", groupBorder: "border-blue-500/30", groupBg: "bg-blue-500/8",
    practices: [
      { icon: Siren, title: "Incident Management", desc: "AI detects, classifies, and routes incidents before the user finishes typing a subject. Severity auto-set. SLA countdown begins instantly.", features: ["Auto-severity & category", "Smart escalation chains", "SLA breach prediction", "AI resolution narratives"], color: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/8" },
      { icon: Search, title: "Problem Management", desc: "Generative root cause analysis with permanent fix recommendations, known error database management, and recurring incident pattern detection.", features: ["Root cause narration", "Known error records", "Trend correlation engine", "Workaround generation"], color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/8" },
      { icon: GitBranch, title: "Change Enablement", desc: "Full CAB workflow with AI risk & impact assessment, scheduling, blackout enforcement, emergency change pathways, and automated PIRs.", features: ["AI risk & impact model", "CAB approval workflows", "Scheduling & blackouts", "PIR auto-generation"], color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/8" },
      { icon: ClipboardList, title: "Service Request Management", desc: "Self-service catalogue with AI-driven fulfilment, approval chains, SLA-based prioritisation, and auto-completion for routine requests.", features: ["Service catalogue builder", "Approval workflow engine", "SLA-driven prioritisation", "Auto-fulfilment triggers"], color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/8" },
      { icon: BarChart3, title: "Service Level Management", desc: "Define, monitor, and enforce SLAs, OLAs, and UCs with AI-generated breach predictions, trend analysis, and supplier accountability reports.", features: ["SLA / OLA / UC management", "Real-time compliance tracking", "Breach prediction & alerts", "Supplier SLA enforcement"], color: "text-indigo-400", border: "border-indigo-500/20", bg: "bg-indigo-500/8" },
      { icon: Layers, title: "Service Catalogue Management", desc: "Living catalogue of every service — business and technical — with AI-maintained descriptions, ownership, status, and dependency mapping.", features: ["Business & technical catalogue", "AI-maintained descriptions", "Ownership & lifecycle state", "Dependency visualisation"], color: "text-cyan-400", border: "border-cyan-500/20", bg: "bg-cyan-500/8" },
      { icon: Activity, title: "Availability Management", desc: "Continuous availability monitoring with AI-driven MTTR/MTBF analysis, maintenance windows, redundancy gap identification, and improvement plans.", features: ["Availability SLA tracking", "MTTR / MTBF analytics", "Single point of failure detection", "Improvement recommendations"], color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/8" },
      { icon: TrendingUp, title: "Capacity & Performance Management", desc: "AI demand forecasting, workload trending, resource optimisation, and cost-aware capacity planning across cloud and on-premises infrastructure.", features: ["Demand forecasting", "Workload trend analysis", "Resource utilisation scoring", "Cost-aware rightsizing"], color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/8" },
      { icon: Package, title: "IT Asset Management", desc: "Full hardware and software asset lifecycle — procurement to decommission — with AI-driven licence compliance, contract alerts, and shadow IT detection.", features: ["Asset lifecycle tracking", "Software licence compliance", "Contract & renewal alerts", "Shadow IT discovery"], color: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/8" },
      { icon: Eye, title: "Monitoring & Event Management", desc: "Multi-protocol probe telemetry correlated by AI across 12 monitoring protocols — converting raw signals into enriched, prioritised, actionable events.", features: ["12-protocol probe network", "AI event correlation", "Signal deduplication", "Automated event lifecycle"], color: "text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/8" },
    ],
  },
  {
    group: "Technical Management Practices",
    groupColor: "text-purple-400", groupBorder: "border-purple-500/30", groupBg: "bg-purple-500/8",
    practices: [
      { icon: Server, title: "Infrastructure & Platform Management", desc: "Full lifecycle management of on-premises, hybrid, and multi-cloud infrastructure with AI-driven configuration drift detection and autonomous remediation.", features: ["Multi-cloud & on-prem", "Configuration drift detection", "Auto-remediation playbooks", "Platform health scoring"], color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/8" },
      { icon: Code2, title: "Software Development & Management", desc: "AI-integrated development lifecycle — from code quality review to dependency vulnerability scanning, build failure analysis, and release readiness scoring.", features: ["Code quality analysis", "Dependency vulnerability scan", "Build failure narration", "Release readiness scoring"], color: "text-pink-400", border: "border-pink-500/20", bg: "bg-pink-500/8" },
      { icon: Boxes, title: "Deployment Management", desc: "Controlled rollout to production environments with blue/green and canary strategies, automated rollback triggers, and AI deployment health validation.", features: ["Blue/green & canary deploys", "Automated rollback triggers", "Deployment health checks", "Change linkage & audit"], color: "text-sky-400", border: "border-sky-500/20", bg: "bg-sky-500/8" },
      { icon: GitMerge, title: "Release Management", desc: "End-to-end release planning and scheduling — aligning development sprints, infrastructure windows, business calendars, and risk scoring into a unified release pipeline.", features: ["Release pipeline planning", "Environment readiness gating", "Stakeholder comms automation", "Go/no-go AI assessment"], color: "text-teal-400", border: "border-teal-500/20", bg: "bg-teal-500/8" },
      { icon: Database, title: "Service Configuration Management", desc: "AI-maintained CMDB with automated CI discovery, relationship mapping, dependency visualisation, and change impact analysis — always accurate, always current.", features: ["Auto-discovered CI records", "Relationship & dependency maps", "Change impact analysis", "CMDB health scoring"], color: "text-lime-400", border: "border-lime-500/20", bg: "bg-lime-500/8" },
      { icon: ShieldCheck, title: "Service Continuity Management", desc: "BCP/DRP lifecycle managed end-to-end — AI-written plans from live infrastructure context, drill management, real-time incident-triggered activation, and regulatory compliance.", features: ["AI-generated BCP/DRP plans", "Drill scheduling & debrief", "Incident-triggered activation", "RTO/RPO tracking"], color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/8" },
      { icon: FlaskConical, title: "Service Validation & Testing", desc: "AI-assisted test planning, automated test execution scheduling, defect pattern analysis, and service acceptance criteria validation before every release.", features: ["Test plan generation", "Acceptance criteria validation", "Defect trend analysis", "Release gate enforcement"], color: "text-fuchsia-400", border: "border-fuchsia-500/20", bg: "bg-fuchsia-500/8" },
      { icon: ScanLine, title: "Service Measurement & Reporting", desc: "Real-time dashboards, executive report generation, KPI trending, and AI-written narrative summaries across every ITIL practice — always available, always current.", features: ["Real-time KPI dashboards", "AI-written exec summaries", "Practice health scoring", "Exportable compliance reports"], color: "text-cyan-400", border: "border-cyan-500/20", bg: "bg-cyan-500/8" },
    ],
  },
  {
    group: "General Management Practices",
    groupColor: "text-emerald-400", groupBorder: "border-emerald-500/30", groupBg: "bg-emerald-500/8",
    practices: [
      { icon: Target, title: "Strategy Management", desc: "AI-assisted strategic analysis of the IT service portfolio — aligning technology investment with business objectives, gap identification, and roadmap generation.", features: ["Portfolio vs strategy alignment", "Gap analysis & roadmap", "Investment prioritisation", "Market & benchmarking intel"], color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/8" },
      { icon: Layers, title: "Portfolio Management", desc: "Maintain a live, AI-scored portfolio of services, projects, and improvement initiatives — with resource demand forecasting and business value tracking.", features: ["Service portfolio registry", "Project & initiative tracking", "Resource demand forecasting", "Business value scoring"], color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/8" },
      { icon: AlertTriangle, title: "Risk Management", desc: "AI-scored risk register with probability/impact matrices, automated control mapping, regulatory alignment, and treatment plan generation for every identified risk.", features: ["AI risk scoring engine", "Control mapping & gaps", "Regulatory alignment checks", "Treatment plan generation"], color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/8" },
      { icon: Shield, title: "Information Security Management", desc: "Proactive security posture management — CVE cross-referencing, security policy enforcement, compliance mapping (ISO 27001, NIST, SOC2), and AI threat intelligence feeds.", features: ["CVE & threat intelligence", "Policy enforcement engine", "Compliance framework mapping", "Security event correlation"], color: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/8" },
      { icon: BookOpen, title: "Knowledge Management", desc: "AI-first knowledge search — retrieving cached intelligence before invoking the AI engine, cutting inference costs. Automatic KB article creation from resolved incidents.", features: ["AI-first search strategy", "Auto-article from incidents", "Article lifecycle management", "Resolution linking & reuse"], color: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/8" },
      { icon: Users, title: "Workforce & Talent Management", desc: "AI Orchestrator dynamically allocates work across human agents and AI agents — balancing skill, availability, cost, and SLA. Gamified performance management keeps teams engaged.", features: ["Dynamic work allocation", "Skill & availability matching", "Gamified XP leaderboards", "AI coaching & performance"], color: "text-pink-400", border: "border-pink-500/20", bg: "bg-pink-500/8" },
      { icon: Handshake, title: "Supplier Management", desc: "Track and govern your entire vendor ecosystem — contracts, SLA adherence, performance scorecards, renewal alerts, and AI-generated supplier risk assessments.", features: ["Vendor register & contracts", "SLA adherence tracking", "AI supplier risk scoring", "Renewal & escalation alerts"], color: "text-teal-400", border: "border-teal-500/20", bg: "bg-teal-500/8" },
      { icon: MessageSquare, title: "Business Relationship Management", desc: "Structured stakeholder engagement — service review scheduling, satisfaction tracking, feedback analysis, and AI-generated relationship health reports.", features: ["Stakeholder register", "Service review workflows", "Satisfaction survey engine", "Relationship health scoring"], color: "text-sky-400", border: "border-sky-500/20", bg: "bg-sky-500/8" },
      { icon: RefreshCcw as any, title: "Continual Improvement", desc: "AI-maintained improvement register linked to every practice — capturing ideas, scoring business value vs effort, tracking delivery, and closing the loop on every action.", features: ["Improvement register", "AI value vs effort scoring", "Action tracking & closure", "Practice maturity benchmarking"], color: "text-lime-400", border: "border-lime-500/20", bg: "bg-lime-500/8" },
    ],
  },
];

const transportProtocols = [
  { name: "HTTPS", icon: Globe, desc: "Encrypted REST for IP networks", category: "IP" },
  { name: "MQTT", icon: Wifi, desc: "Lightweight pub/sub for IoT", category: "IP" },
  { name: "WebSocket", icon: Zap, desc: "Full-duplex real-time comms", category: "IP" },
  { name: "CoAP", icon: Cpu, desc: "Constrained IoT endpoints", category: "IP" },
  { name: "Raw TCP", icon: Terminal, desc: "Direct socket connections", category: "IP" },
  { name: "Raw UDP", icon: Radio, desc: "Lightweight telemetry datagrams", category: "IP" },
  { name: "RS-232/485", icon: CircuitBoard, desc: "OT/SCADA serial communication", category: "Physical" },
  { name: "LoRa", icon: Satellite, desc: "Long-range remote & rural RF", category: "RF" },
  { name: "Reticulum", icon: Blocks, desc: "Cryptographic mesh for air-gaps", category: "Mesh" },
];

const probeTargets = [
  { name: "Windows", icon: Monitor, color: "text-cyan-400" },
  { name: "Linux", icon: Server, color: "text-blue-400" },
  { name: "macOS", icon: Monitor, color: "text-rose-400" },
  { name: "Docker", icon: Boxes, color: "text-purple-400" },
  { name: "Android", icon: Smartphone, color: "text-green-400" },
  { name: "iOS", icon: Smartphone, color: "text-indigo-400" },
  { name: "OT/SCADA", icon: CircuitBoard, color: "text-orange-400" },
  { name: "IoT", icon: Antenna, color: "text-amber-400" },
  { name: "Air-gapped", icon: PlugZap, color: "text-violet-400" },
];

const crews = [
  { name: "Infrastructure & Cloud", icon: Cloud, color: "from-blue-500 to-cyan-500", agents: "25+", desc: "Cloud ops, datacenter, capacity planning" },
  { name: "Cybersecurity", icon: Shield, color: "from-red-500 to-orange-500", agents: "22+", desc: "SOC, threat detection, incident response" },
  { name: "Service Management", icon: Activity, color: "from-green-500 to-emerald-500", agents: "20+", desc: "ITIL, SLA management, service desk" },
  { name: "AI & Automation", icon: Bot, color: "from-purple-500 to-violet-500", agents: "18+", desc: "AI ops, MLOps, intelligent automation" },
  { name: "Data & Analytics", icon: BarChart3, color: "from-amber-500 to-yellow-500", agents: "20+", desc: "Data engineering, BI, governance" },
  { name: "Platform Engineering", icon: Layers, color: "from-indigo-500 to-blue-500", agents: "22+", desc: "DevOps, SRE, CI/CD, IaC" },
  { name: "Compliance & Risk", icon: FileText, color: "from-teal-500 to-green-500", agents: "18+", desc: "Policy, risk assessment, audit readiness" },
  { name: "IT Governance", icon: Eye, color: "from-pink-500 to-rose-500", agents: "15+", desc: "Enterprise architecture, PMO, strategy" },
  { name: "Communications", icon: MessageSquare, color: "from-sky-500 to-blue-500", agents: "12+", desc: "Unified comms, collaboration platforms" },
  { name: "End User Computing", icon: MonitorSmartphone, color: "from-fuchsia-500 to-purple-500", agents: "15+", desc: "Desktop engineering, endpoint mgmt" },
];

const bcpFeatures = [
  { icon: FileText, title: "AI-Generated Plans", desc: "Full BCP/DRP plans written by Generative AI from live infrastructure context — from Draft to Active with version control" },
  { icon: Target, title: "Business Impact Analysis", desc: "AI-quantified operational and financial impact with RTO/RPO targets for every critical process" },
  { icon: AlertTriangle, title: "Risk Register", desc: "AI-scored risk cataloguing with probability/impact matrices and auto-generated mitigation strategies" },
  { icon: Activity, title: "Drill Management", desc: "Schedule, execute, and debrief recovery exercises with AI-assisted lessons learned and improvement actions" },
  { icon: Eye, title: "Review & Audit", desc: "Periodic reviews with AI-generated findings, recommendations, and compliance-ready audit trails" },
  { icon: ShieldCheck, title: "Compliance Dashboard", desc: "Real-time plan health, overdue reviews, upcoming drills, and regulatory coverage scoring" },
];

const gamificationFeatures = [
  { icon: Trophy, label: "XP Leaderboard", desc: "Live competitive ranking across all Crews with real-time XP scores" },
  { icon: Award, label: "Achievement Badges", desc: "Earn recognition for incidents resolved, problems closed, changes approved" },
  { icon: TrendingUp, label: "AI Performance Score", desc: "AI-generated performance insights with trend analysis and coaching suggestions" },
  { icon: Star, label: "XP Rewards Engine", desc: "100 XP / incident · 200 XP / change · 75 XP / request · 50 XP / problem" },
];

const testimonials = [
  { quote: "HOLOCRON replaced 12 planned hires. The AI Orchestrator dynamically allocates work between our team and the AI agents — we never have to think about who picks up what. It just happens. Nothing else comes close.", author: "Sarah Chen", role: "CTO, TechScale Inc.", stars: 5 },
  { quote: "It's not AI-assisted ops. It's AI-native ops. The platform caught a CVE, cross-referenced our CMDB, generated the change request, and had a remediation plan ready — before my team opened their laptops.", author: "Marcus Rodriguez", role: "CISO, FinGuard Corp.", stars: 5 },
  { quote: "Full ITIL v4 coverage, generative AI at every layer, multi-protocol probe network, MDM, BCP — all in one platform. We evaluated every vendor. HOLOCRON is genuinely in a category of its own.", author: "Priya Patel", role: "VP Engineering, CloudNova", stars: 5 },
  { quote: "BCP compliance went from 40% to 98% in three months. The AI writes the plans from our actual infrastructure data. It's not a template. It's intelligence. Audit prep is now painless.", author: "James Okafor", role: "Director of IT, SecureNet Global", stars: 5 },
];

export default function LandingPage() {
  const [activeProtocol, setActiveProtocol] = useState(0);
  const [tickerPaused, setTickerPaused] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setActiveProtocol(p => (p + 1) % transportProtocols.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#020307] text-white overflow-x-hidden">
      <style>{`
        @keyframes pulse-glow { 0%,100%{opacity:0.25} 50%{opacity:0.6} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin-slow { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes fadeUp { 0%{opacity:0;transform:translateY(16px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes beam { 0%,100%{opacity:0} 50%{opacity:0.7} }
        .animate-pulse-glow { animation:pulse-glow 4s ease-in-out infinite; }
        .animate-spin-slow { animation:spin-slow 30s linear infinite; }
        .animate-spin-slow-rev { animation:spin-slow 22s linear infinite reverse; }
        .animate-ticker { animation:ticker 38s linear infinite; }
        .animate-float { animation:float 7s ease-in-out infinite; }
        .animate-beam { animation:beam 3s ease-in-out infinite; }
        .glass { background:rgba(255,255,255,0.025); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.07); }
        .glass-sm { background:rgba(255,255,255,0.018); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.05); }
        .grid-bg { background-image:linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px); background-size:60px 60px; }
        .dot-bg { background-image:radial-gradient(circle,rgba(99,102,241,0.14) 1px,transparent 1px); background-size:30px 30px; }
        .hero-glow { background:radial-gradient(ellipse 110% 60% at 50% -5%, rgba(88,80,236,0.18), transparent); }
        .section-glow { background:radial-gradient(ellipse 70% 50% at 50% 0%, rgba(99,102,241,0.07), transparent); }
        .text-gradient { background:linear-gradient(135deg,#818cf8,#c084fc,#f472b6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .text-gradient-blue { background:linear-gradient(135deg,#60a5fa,#818cf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .text-gradient-gold { background:linear-gradient(135deg,#fbbf24,#f59e0b,#d97706); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .text-gradient-green { background:linear-gradient(135deg,#34d399,#10b981); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .card-lift { transition:all 0.35s cubic-bezier(0.4,0,0.2,1); }
        .card-lift:hover { transform:translateY(-3px); box-shadow:0 20px 50px rgba(99,102,241,0.1); }
        .gen-pill { background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.2)); border:1px solid rgba(168,85,247,0.3); }
        .orch-ring { border:1px solid rgba(99,102,241,0.18); border-radius:50%; }
      `}</style>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#020307]/85 backdrop-blur-2xl" data-testid="nav-landing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <img src={holocronLogo} alt="Holocron AI" className="h-4 w-4 sm:h-5 sm:w-5 object-contain" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black tracking-tight text-white" data-testid="text-landing-brand">HOLOCRON AI</span>
                <span className="hidden sm:inline text-[9px] text-indigo-400/80 ml-2 uppercase tracking-widest font-semibold">AI Orchestration Platform</span>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-5 text-[12px] text-white/45">
              <a href="#orchestrator" className="hover:text-white transition-colors">AI Orchestrator</a>
              <a href="#workforce" className="hover:text-white transition-colors">AI Workforce</a>
              <a href="#proactive" className="hover:text-white transition-colors">Autonomous Ops</a>
              <a href="#coverage" className="hover:text-white transition-colors">Coverage</a>
              <a href="#itil" className="hover:text-white transition-colors">ITIL v4</a>
              <a href="#bcp" className="hover:text-white transition-colors">BCP/DRP</a>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Badge className="hidden md:inline-flex gen-pill text-purple-300 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 border-0">AI-Native</Badge>
              <Button variant="ghost" size="sm" className="text-xs h-8 sm:h-9 px-3 text-white/60 hover:text-white hover:bg-white/5" asChild data-testid="button-nav-login">
                <Link href="/auth">Sign In</Link>
              </Button>
              <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 shadow-lg shadow-indigo-500/30 text-[11px] sm:text-sm h-8 sm:h-9 px-3 sm:px-5 border-0 text-white font-semibold" asChild data-testid="button-nav-get-started">
                <Link href="/auth">Get Started <ArrowRight className="ml-1.5 h-3 w-3" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-24 sm:pt-32 pb-20 sm:pb-28 overflow-hidden hero-glow" data-testid="section-hero">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]" style={{ background: "radial-gradient(ellipse,rgba(88,80,236,0.13) 0%,transparent 65%)" }} />
        <div className="absolute top-24 left-1/4 w-[500px] h-[500px] bg-indigo-600/7 rounded-full blur-[140px] animate-pulse-glow" />
        <div className="absolute top-32 right-1/4 w-[400px] h-[400px] bg-purple-600/7 rounded-full blur-[110px] animate-pulse-glow" style={{ animationDelay: "2s" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full glass text-xs sm:text-sm" data-testid="badge-hero">
            <Atom className="h-3.5 w-3.5 text-indigo-400 animate-spin-slow" />
            <span className="text-white/50">The World's First</span>
            <span className="text-indigo-400 font-bold">Generative AI Orchestration Platform</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight max-w-6xl mx-auto leading-[1.02] text-white" data-testid="text-hero-title">
            Beyond IT Operations.<br />
            <TypewriterText phrases={heroTypewriter} />
          </h1>

          <p className="mt-7 sm:mt-10 text-base sm:text-lg md:text-xl text-white/45 max-w-4xl mx-auto leading-relaxed font-light" data-testid="text-hero-subtitle">
            HOLOCRON AI is not an IT helpdesk with AI bolted on. It is a <strong className="text-white/80 font-semibold">Generative AI Orchestration Platform</strong> that spans 
            the full ITIL v4 practice spectrum — proactively managing your infrastructure, 
            autonomously coordinating your human and AI workforce, and delivering intelligence at a scale no team alone could match.
            <span className="block mt-3 text-indigo-400/80 font-medium">There is nothing else like it on earth.</span>
          </p>

          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button size="lg" className="w-full sm:w-auto px-8 sm:px-12 h-12 sm:h-14 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-90 shadow-2xl shadow-indigo-500/35 border-0 text-white font-bold text-sm sm:text-base" asChild data-testid="button-hero-start">
              <Link href="/auth">Start Free Trial <Rocket className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 sm:px-12 h-12 sm:h-14 border-white/10 bg-white/4 hover:bg-white/8 text-white text-sm sm:text-base" asChild data-testid="button-hero-demo">
              <Link href="/auth"><Play className="mr-2 h-4 w-4" /> Live Demo</Link>
            </Button>
          </div>

          <div className="mt-14 sm:mt-20 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 max-w-4xl mx-auto">
            {[
              { value: 199, suffix: "+", label: "AI Agent Roles", icon: Bot, color: "text-indigo-400" },
              { value: 34, suffix: "", label: "ITIL v4 Practices", icon: ListChecks, color: "text-purple-400" },
              { value: 9, suffix: "", label: "Probe Protocols", icon: Radio, color: "text-cyan-400" },
              { value: 70, suffix: "%", label: "Avg Cost Savings", icon: TrendingUp, color: "text-emerald-400" },
            ].map((s, i) => (
              <div key={i} className="text-center p-4 sm:p-5 rounded-2xl glass card-lift" data-testid={`stat-hero-${i}`}>
                <s.icon className={`h-5 w-5 ${s.color} mx-auto mb-2`} />
                <div className={`text-2xl sm:text-3xl md:text-4xl font-black ${s.color}`}><AnimatedCounter end={s.value} suffix={s.suffix} /></div>
                <p className="text-[10px] sm:text-xs text-white/35 mt-1.5 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-30">
          <ChevronDown className="h-5 w-5 text-white" />
        </div>
      </section>

      {/* WORLD FIRSTS TICKER */}
      <div className="border-y border-white/5 bg-indigo-950/25 py-3 overflow-hidden" data-testid="section-ticker">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...worldFirsts, ...worldFirsts].map((w, i) => (
            <div key={i} className="inline-flex items-center gap-3 px-8 shrink-0">
              <Sparkles className="h-3 w-3 text-indigo-400 shrink-0" />
              <span className="text-[11px] text-white/45 font-medium">{w}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI ORCHESTRATOR */}
      <section id="orchestrator" className="py-20 sm:py-32 relative section-glow" data-testid="section-orchestrator">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px]" style={{ background: "radial-gradient(ellipse,rgba(139,92,246,0.09) 0%,transparent 70%)" }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-14 sm:mb-20">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] gen-pill text-purple-300 font-bold uppercase tracking-widest border-0">AI Orchestrator</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight" data-testid="text-orchestrator-title">
              One Brain.<br />
              <span className="text-gradient">Your Entire Human + AI Workforce.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-white/45 max-w-3xl mx-auto leading-relaxed">
              The HOLOCRON AI Orchestrator is the coordination intelligence at the centre of the platform. 
              It dynamically allocates every task — incoming incidents, change requests, security alerts, service requests — 
              to the optimal human agent or AI agent in real time, continuously rebalancing as conditions evolve.
            </p>
          </div>

          {/* Orchestrator visual diagram */}
          <div className="relative mb-16 sm:mb-20 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-[#080b18] to-[#0a0618] p-8 sm:p-14 overflow-hidden" data-testid="panel-orchestrator-diagram">
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%,rgba(88,80,236,0.1),transparent)" }} />
            <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
              {/* Incoming work */}
              <div className="space-y-3">
                <p className="text-[10px] text-white/35 uppercase tracking-widest font-bold mb-4">Incoming Work</p>
                {[
                  { icon: Siren, label: "Incidents", color: "text-red-400", border: "border-red-500/25", bg: "bg-red-500/8" },
                  { icon: ShieldAlert, label: "Security Alerts", color: "text-orange-400", border: "border-orange-500/25", bg: "bg-orange-500/8" },
                  { icon: GitBranch, label: "Change Requests", color: "text-blue-400", border: "border-blue-500/25", bg: "bg-blue-500/8" },
                  { icon: FileText, label: "Service Requests", color: "text-green-400", border: "border-green-500/25", bg: "bg-green-500/8" },
                  { icon: AlertTriangle, label: "Risk Events", color: "text-amber-400", border: "border-amber-500/25", bg: "bg-amber-500/8" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${item.border} ${item.bg}`}>
                    <item.icon className={`h-4 w-4 ${item.color} shrink-0`} />
                    <span className="text-xs text-white/55 font-medium">{item.label}</span>
                    <ChevronsRight className="h-3.5 w-3.5 text-white/20 ml-auto" />
                  </div>
                ))}
              </div>

              {/* Central Orchestrator */}
              <div className="flex flex-col items-center gap-5">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <div className="absolute inset-0 orch-ring animate-spin-slow opacity-40" />
                  <div className="absolute inset-5 orch-ring animate-spin-slow-rev opacity-30" />
                  <div className="absolute inset-10 orch-ring opacity-20" />
                  <div className="relative z-10 h-24 w-24 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
                    <img src={holocronLogo} alt="HOLOCRON Orchestrator" className="h-14 w-14 object-contain" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-white">AI Orchestrator</p>
                  <p className="text-[11px] text-indigo-400/80 mt-1">AI-Powered · Multi-Model</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                  {["Cost Intelligence", "Priority Scoring", "Skills Matching", "Load Balancing", "Risk Threshold", "Auto-Escalation"].map(tag => (
                    <span key={tag} className="text-[9px] px-2 py-1 rounded-full border border-indigo-500/25 text-indigo-400/80 bg-indigo-500/8">{tag}</span>
                  ))}
                </div>
              </div>

              {/* Workforce output */}
              <div className="space-y-3">
                <p className="text-[10px] text-white/35 uppercase tracking-widest font-bold mb-4">Assigned To</p>
                {[
                  { icon: Bot, label: "AI Shadow Agents", sub: "Routine · High volume · 24/7", color: "text-purple-400", border: "border-purple-500/25", bg: "bg-purple-500/8" },
                  { icon: Users, label: "Human Specialists", sub: "Complex · Strategic · Sensitive", color: "text-blue-400", border: "border-blue-500/25", bg: "bg-blue-500/8" },
                  { icon: Zap, label: "Automated Playbooks", sub: "Pre-approved · Instant · Zero-touch", color: "text-amber-400", border: "border-amber-500/25", bg: "bg-amber-500/8" },
                ].map((item, i) => (
                  <div key={i} className={`px-3 py-3 rounded-xl border ${item.border} ${item.bg}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className={`h-4 w-4 ${item.color} shrink-0`} />
                      <span className="text-xs text-white font-semibold">{item.label}</span>
                    </div>
                    <p className="text-[10px] text-white/35 pl-6">{item.sub}</p>
                  </div>
                ))}
                <div className="px-3 py-2.5 rounded-xl border border-white/8 bg-white/3 mt-2">
                  <p className="text-[10px] text-white/35 leading-relaxed">When AI confidence drops below threshold → auto-escalates to human with full context and recommended actions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Orchestrator capability cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {orchestratorCapabilities.map((cap, i) => (
              <Card key={i} className={`border ${cap.border} bg-[#09090f] card-lift group`} data-testid={`card-orch-${i}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3.5">
                    <div className={`h-10 w-10 rounded-xl ${cap.bg} ${cap.border} border flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <cap.icon className={`h-5 w-5 ${cap.color}`} />
                    </div>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2">{cap.title}</h3>
                  <p className="text-xs sm:text-sm text-white/40 leading-relaxed">{cap.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI WORKFORCE COMPLEMENT */}
      <section id="workforce" className="py-20 sm:py-32 relative" data-testid="section-workforce" style={{ background: "linear-gradient(180deg,#020307 0%,#060312 50%,#020307 100%)" }}>
        <div className="absolute inset-0 dot-bg opacity-25" />
        <div className="absolute top-0 left-0 w-[600px] h-[500px]" style={{ background: "radial-gradient(circle at top left,rgba(139,92,246,0.08),transparent 60%)" }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px]" style={{ background: "radial-gradient(circle at bottom right,rgba(99,102,241,0.07),transparent 60%)" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-20">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-violet-400/30 bg-violet-500/10 text-violet-300 font-bold uppercase tracking-widest">AI Workforce Complement</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight" data-testid="text-workforce-title">
              Your Best Team Member<br />
              <span className="text-gradient">Costs Less Than a Daily Coffee.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-white/45 max-w-3xl mx-auto leading-relaxed">
              HOLOCRON AI agents don't replace your people — they <strong className="text-white/80 font-semibold">amplify them</strong>. 
              Each agent is a AI-powered specialist that reasons, thinks laterally, configures systems, 
              executes autonomously, and self-heals your entire ecosystem — at a fraction of the cost of a human equivalent. 
              Subscribe the agents you need. Cancel anytime.
            </p>
          </div>

          {/* Cost value proposition banner */}
          <div className="mb-14 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-[#0c0820] to-[#080b1c] p-7 sm:p-10 relative overflow-hidden" data-testid="panel-cost-value">
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 70% at 50% 50%,rgba(139,92,246,0.1),transparent)" }} />
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10 items-center">

              {/* Human cost side */}
              <div className="text-center p-5 rounded-2xl border border-red-500/15 bg-red-500/5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 mb-4">Human Specialist (FTE)</div>
                <div className="text-3xl sm:text-4xl font-black text-red-300 mb-1">$80–$150k</div>
                <div className="text-xs text-white/35 mb-5">per year · single domain · 40h/week</div>
                <ul className="space-y-2 text-[11px] text-white/35 text-left">
                  {["One domain of expertise only", "Works 8 hours / day, 5 days / week", "Holidays, sick leave, training gaps", "Cannot scale without more headcount", "Context switches reduce effectiveness"].map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5"><span className="text-red-500 shrink-0 mt-0.5">✕</span><span>{item}</span></li>
                  ))}
                </ul>
              </div>

              {/* VS divider */}
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-indigo-500/30">VS</div>
                <p className="text-xs text-white/30 text-center max-w-[160px]">Add AI agents instantly — no hiring, no onboarding, no overhead</p>
              </div>

              {/* AI Agent cost side */}
              <div className="text-center p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/7">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80 mb-4">HOLOCRON AI Agent</div>
                <div className="text-3xl sm:text-4xl font-black text-emerald-300 mb-1">~$180–$240</div>
                <div className="text-xs text-white/35 mb-5">per month · multi-domain · 24/7/365</div>
                <ul className="space-y-2 text-[11px] text-white/55 text-left">
                  {["Crosses domain boundaries as needed", "Operates 24 hours / 7 days / 365 days", "Never fatigued, never on leave", "Scales to any number instantly", "Full focus on every task, every time"].map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Saving callout */}
            <div className="relative mt-8 pt-6 border-t border-white/6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 text-center">
              {[
                { label: "Avg cost vs human equivalent", value: "~3%", color: "text-emerald-400" },
                { label: "Reduction in routine task backlog", value: "80%", color: "text-indigo-400" },
                { label: "Uptime vs standard working hours", value: "3×", color: "text-amber-400" },
                { label: "Time to deploy a new AI specialist", value: "<2 min", color: "text-purple-400" },
              ].map((s, i) => (
                <div key={i} data-testid={`stat-workforce-${i}`}>
                  <div className={`text-2xl sm:text-3xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-white/35 mt-1 max-w-[120px] mx-auto">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent capability cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
            {agentCapabilities.map((cap, i) => (
              <Card key={i} className={`border ${cap.border} bg-[#09090f] card-lift group`} data-testid={`card-agent-cap-${i}`}>
                <CardContent className="p-6 sm:p-7">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-11 w-11 rounded-xl ${cap.bg} ${cap.border} border flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <cap.icon className={`h-5 w-5 ${cap.color}`} />
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${cap.color} ${cap.border} border bg-transparent uppercase tracking-wide font-bold px-2 py-0.5`}>{cap.tag}</Badge>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2.5">{cap.title}</h3>
                  <p className="text-xs sm:text-sm text-white/40 leading-relaxed">{cap.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Agent intelligence flow */}
          <div className="mb-14 p-6 sm:p-10 rounded-3xl border border-indigo-500/15 bg-[#08091a] relative overflow-hidden" data-testid="panel-agent-flow">
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 60% at 50% 50%,rgba(99,102,241,0.07),transparent)" }} />
            <div className="relative text-center mb-8">
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2">How an AI Agent Thinks and Acts</h3>
              <p className="text-sm text-white/40 max-w-xl mx-auto">A single agent processing a complex multi-system issue — no human in the loop until approval is required</p>
            </div>
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
              {[
                { icon: ScanLine, label: "Observe", desc: "Monitors telemetry, logs, events, alerts across all connected systems in real time", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/25" },
                { icon: Brain, label: "Reason", desc: "Applies multi-step AI reasoning — weighs context, history, risk, blast radius", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25" },
                { icon: Lightbulb, label: "Decide", desc: "Selects optimal course of action — including novel approaches beyond standard playbooks", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
                { icon: Cog, label: "Execute", desc: "Configures, patches, scripts, deploys — or escalates with full context and recommended actions", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
                { icon: RefreshCw, label: "Validate", desc: "Verifies the outcome, confirms service restoration, and closes the loop autonomously", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
              ].map((step, i, arr) => (
                <div key={i} className="flex md:flex-col items-center gap-4 md:gap-0 md:flex-1" data-testid={`step-agent-${i}`}>
                  <div className={`relative flex flex-col items-center`}>
                    <div className={`h-14 w-14 rounded-2xl ${step.bg} border ${step.border} flex items-center justify-center mb-0 md:mb-3 shrink-0`}>
                      <step.icon className={`h-6 w-6 ${step.color}`} />
                    </div>
                    <div className="hidden md:block text-center mt-3">
                      <p className={`text-xs font-black uppercase tracking-widest ${step.color}`}>{step.label}</p>
                      <p className="text-[10px] text-white/35 mt-1.5 max-w-[110px] mx-auto leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                  {/* Mobile label */}
                  <div className="md:hidden flex-1">
                    <p className={`text-sm font-bold ${step.color}`}>{step.label}</p>
                    <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden md:flex items-center justify-center shrink-0 text-white/15">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sample agent roles */}
          <div className="text-center mb-8">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">199+ Specialist Agents Available Today</h3>
            <p className="text-sm text-white/38">Subscribe any combination. Deploy in under 2 minutes. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {agentRoles.map((agent, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/7 bg-white/2 card-lift" data-testid={`card-agent-role-${i}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center">
                    <agent.icon className={`h-4 w-4 ${agent.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs font-bold text-white leading-tight truncate">{agent.title}</p>
                    <p className="text-[9px] text-white/30 truncate">{agent.crew}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/25 uppercase tracking-wider">From</span>
                  <span className="text-xs font-black text-emerald-400">{agent.cost}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button size="lg" className="px-10 h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 shadow-xl shadow-violet-500/25 border-0 text-white font-bold" asChild data-testid="button-workforce-cta">
              <Link href="/auth">Browse All 199+ Agents <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* PROACTIVE AUTONOMOUS MANAGEMENT */}
      <section id="proactive" className="py-20 sm:py-32 relative" data-testid="section-proactive" style={{ background: "linear-gradient(180deg,#020307 0%,#050410 50%,#020307 100%)" }}>
        <div className="absolute inset-0 grid-bg opacity-35" />
        <div className="absolute top-0 right-0 w-[600px] h-[500px]" style={{ background: "radial-gradient(circle at top right,rgba(16,185,129,0.07),transparent 60%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-14">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-emerald-400/30 bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-widest">Autonomous Infrastructure</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight" data-testid="text-proactive-title">
              Proactive. Preventive.<br />
              <span className="text-gradient-green">Fully Autonomous.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-white/45 max-w-3xl mx-auto leading-relaxed">
              HOLOCRON AI doesn't wait for things to break. It predicts. It prevents. It self-heals. 
              The platform continuously analyses your entire infrastructure — in real time — and acts before your team is even aware of a problem. 
              This is not monitoring. This is <strong className="text-white/75 font-semibold">autonomous operations management</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {proactiveCapabilities.map((cap, i) => (
              <Card key={i} className={`border ${cap.border} bg-[#09090f] card-lift group`} data-testid={`card-proactive-${i}`}>
                <CardContent className="p-6 sm:p-7">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-11 w-11 rounded-xl ${cap.bg} ${cap.border} border flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <cap.icon className={`h-5 w-5 ${cap.color}`} />
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${cap.color} ${cap.border} border bg-transparent uppercase tracking-wide font-bold px-2 py-0.5`}>{cap.tag}</Badge>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2.5">{cap.title}</h3>
                  <p className="text-xs sm:text-sm text-white/40 leading-relaxed">{cap.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Proactive vs Reactive comparison */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="panel-comparison">
            <div className="p-6 sm:p-8 rounded-2xl border border-red-500/15 bg-red-500/5">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
                <h3 className="font-bold text-base text-red-300">Traditional ITSM</h3>
              </div>
              <ul className="space-y-2.5 text-sm text-white/45">
                {["Waits for a user to report an incident", "Alerts fire after service is impacted", "Manual investigation and diagnosis", "Reactive patching after exploitation", "SLA tracked only after breach", "Human bandwidth limits capacity"].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-red-500 shrink-0 mt-0.5">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 sm:p-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/6">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                </div>
                <h3 className="font-bold text-base text-emerald-300">HOLOCRON AI</h3>
              </div>
              <ul className="space-y-2.5 text-sm text-white/55">
                {["AI detects anomalies before any user notices", "Predicts failure hours or days in advance", "AI diagnoses and narrates root cause instantly", "Autonomous CVE cross-referencing and remediation", "SLA breach predicted and prevented proactively", "199+ AI agents operating 24/7 at unlimited scale"].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* GENERATIVE AI ENGINE */}
      <section id="genai" className="py-20 sm:py-28 relative section-glow" data-testid="section-genai">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] gen-pill text-purple-300 font-bold uppercase tracking-widest border-0">Generative AI Engine</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight" data-testid="text-genai-title">
              Not AI-Assisted.<br /><span className="text-gradient">AI-Native from the Ground Up.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed">
              Our AI engine isn't a feature. It's the reasoning layer — aggregating leading LLMs and SLMs, routing every task to the optimal model for cost, speed, and accuracy.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {genAiEngine.map((cap, i) => (
              <Card key={i} className={`border ${cap.border} bg-[#09090f] card-lift group`} data-testid={`card-genai-${i}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-10 w-10 rounded-xl ${cap.bg} ${cap.border} border flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <cap.icon className={`h-5 w-5 ${cap.color}`} />
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${cap.color} ${cap.border} border bg-transparent uppercase tracking-wide font-bold px-1.5 py-0.5`}>{cap.tag}</Badge>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2">{cap.title}</h3>
                  <p className="text-xs sm:text-sm text-white/40 leading-relaxed">{cap.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* AI Engine / Aggregator panel */}
          <div className="mt-12 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-[#08091a] to-[#0a0614] p-8 sm:p-12 relative overflow-hidden" data-testid="panel-ai-engine">
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 60% at 80% 50%,rgba(139,92,246,0.1),transparent)" }} />
            <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full gen-pill">
                  <Brain className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-[11px] text-indigo-300 font-bold uppercase tracking-wider">Multi-Model AI Engine</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">Knowledge-First. Cost-Intelligent. Always Contextual.</h3>
                <p className="text-sm sm:text-base text-white/45 leading-relaxed mb-6">
                  HOLOCRON's proprietary routing layer first checks the ITIL Knowledge Base before invoking the AI engine — 
                  reducing inference costs by up to 60% while ensuring every AI response is grounded in 
                  your organisation's specific context, history, and infrastructure topology.
                </p>
                <div className="space-y-2.5">
                  {[
                    "Context-aware reasoning trained on your infrastructure",
                    "Knowledge Base–first strategy reduces LLM costs by 60%",
                    "Multi-agent CrewAI-inspired orchestration architecture",
                    "HMAC-signed, encrypted agent-to-server communication",
                    "Full audit trail on every AI decision and recommendation",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-white/55">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="relative w-52 h-52">
                  <div className="absolute inset-0 orch-ring animate-spin-slow opacity-25" />
                  <div className="absolute inset-6 orch-ring animate-spin-slow-rev opacity-20" />
                  <div className="absolute inset-12 orch-ring opacity-15" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-2xl shadow-indigo-500/35">
                      <img src={holocronLogo} alt="HOLOCRON AI" className="h-14 w-14 object-contain" />
                    </div>
                  </div>
                  {[Bot, Shield, Activity, Network, BookOpen, Gauge].map((Icon, i) => (
                    <div key={i} className="absolute w-9 h-9 rounded-xl glass flex items-center justify-center" style={{ top: `${50 - 44 * Math.cos((i * 60 - 90) * Math.PI / 180)}%`, left: `${50 + 44 * Math.sin((i * 60 - 90) * Math.PI / 180)}%`, transform: "translate(-50%,-50%)" }}>
                      <Icon className="h-3.5 w-3.5 text-indigo-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FULL ITIL v4 SPECTRUM */}
      <section id="itil" className="py-20 sm:py-32 relative" data-testid="section-itil" style={{ background: "linear-gradient(180deg,#020307 0%,#04041a 50%,#020307 100%)" }}>
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px]" style={{ background: "radial-gradient(circle,rgba(59,130,246,0.07),transparent 60%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-14">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-blue-400/30 bg-blue-500/10 text-blue-400 font-bold uppercase tracking-widest">ITIL v4 — Full Spectrum</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight" data-testid="text-itil-title">
              All 34 ITIL v4 Practices.<br /><span className="text-gradient-blue">Every One, GenAI-Powered.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-white/45 max-w-3xl mx-auto leading-relaxed">
              HOLOCRON AI doesn't cherry-pick four ITIL processes and call it a suite. 
              It covers <strong className="text-white/75 font-semibold">all three ITIL v4 practice groups</strong> — 
              Service Management, Technical Management, and General Management — 
              with a dedicated Generative AI agent for every practice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
            {itilV4Practices.map((group, i) => (
              <div key={i} className={`p-5 sm:p-6 rounded-2xl border ${group.border} ${group.bg}`} data-testid={`card-itilv4-group-${i}`}>
                <h3 className={`text-sm font-black uppercase tracking-widest ${group.color} mb-4`}>{group.group}</h3>
                <div className="space-y-1.5">
                  {group.practices.map((p, j) => (
                    <div key={j} className="flex items-center gap-2 text-[11px] sm:text-xs text-white/50">
                      <CheckCircle2 className={`h-3 w-3 ${group.color} shrink-0`} />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Full practice detail grid */}
          <div className="space-y-14">
            {itilAllPractices.map((group, gi) => (
              <div key={gi} data-testid={`itil-group-${gi}`}>
                {/* Group header */}
                <div className="flex items-center gap-3 mb-7">
                  <div className={`h-px flex-1 bg-white/6 hidden sm:block`} />
                  <div className={`px-4 py-1.5 rounded-full border ${group.groupBorder} ${group.groupBg} text-[10px] font-black uppercase tracking-widest ${group.groupColor}`}>
                    {group.group}
                  </div>
                  <div className={`h-px flex-1 bg-white/6 hidden sm:block`} />
                </div>

                {/* Practice cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {group.practices.map((practice, pi) => (
                    <div
                      key={pi}
                      className={`p-5 rounded-2xl border ${practice.border} ${practice.bg} bg-[#08090f] card-lift group flex flex-col`}
                      data-testid={`card-itil-practice-${gi}-${pi}`}
                    >
                      {/* Icon + title */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`h-9 w-9 rounded-xl border ${practice.border} ${practice.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <practice.icon className={`h-4 w-4 ${practice.color}`} />
                        </div>
                        <h4 className={`text-sm font-black leading-tight ${practice.color} pt-1`}>{practice.title}</h4>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] sm:text-xs text-white/45 leading-relaxed mb-4 flex-1">{practice.desc}</p>

                      {/* Feature list */}
                      <div className="space-y-1.5 border-t border-white/6 pt-3">
                        {practice.features.map((f, fi) => (
                          <div key={fi} className="flex items-center gap-2 text-[10px] sm:text-[11px] text-white/40">
                            <CheckCircle2 className={`h-2.5 w-2.5 ${practice.color} shrink-0`} />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* NLP console callout */}
          <div className="mt-12 p-6 sm:p-8 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col sm:flex-row items-start sm:items-center gap-5" data-testid="panel-nlp-console">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <MessageSquare className="h-7 w-7 text-indigo-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-base sm:text-lg font-black text-white mb-1.5">NLP Ops Console — One Interface for All 34 Practices</h4>
              <p className="text-sm text-white/45 leading-relaxed">
                Type anything in natural language — "show me all open incidents breaching SLA", "draft a change request for the firewall upgrade", 
                "what is the root cause of yesterday's outage?" — and the AI engine routes your query to exactly the right practice agent, 
                retrieves live context from the CMDB and knowledge base, and returns a complete, actionable response.
              </p>
            </div>
            <div className="shrink-0 self-start sm:self-center">
              <div className="px-4 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-xs font-bold text-indigo-400 whitespace-nowrap">
                34 ITIL Practices · One Chat · 9 AI Capabilities
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NETWORK OPS */}
      <section id="network" className="py-20 sm:py-28 relative section-glow" data-testid="section-network">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-cyan-400/30 bg-cyan-500/10 text-cyan-400 font-bold uppercase tracking-widest">Network Operations</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight" data-testid="text-network-title">
              The World's Most Comprehensive<br /><span className="text-gradient-blue">Multi-Protocol Probe Network</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-white/45 max-w-3xl mx-auto leading-relaxed">
              9 transport protocols. 9 platform targets. 3 coupling modes. From cloud VMs to air-gapped SCADA systems to Android handsets — 
              HOLOCRON's probe network reaches everywhere, feeding the AI Orchestrator with live telemetry.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2"><Radio className="h-4.5 w-4.5 text-cyan-400" /> 9 Transport Protocols</h3>
              <div className="space-y-2.5">
                {transportProtocols.map((p, i) => (
                  <div key={i} className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-500 ${i === activeProtocol ? "border-cyan-500/40 bg-cyan-500/10" : "border-white/6 bg-white/2"}`} data-testid={`protocol-${p.name.toLowerCase()}`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${i === activeProtocol ? "bg-cyan-500/20" : "bg-white/5"}`}>
                      <p.icon className={`h-4 w-4 ${i === activeProtocol ? "text-cyan-400" : "text-white/25"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${i === activeProtocol ? "text-white" : "text-white/40"}`}>{p.name}</span>
                        <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${i === activeProtocol ? "border-cyan-500/40 text-cyan-400" : "border-white/10 text-white/20"}`}>{p.category}</Badge>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${i === activeProtocol ? "text-white/55" : "text-white/20"}`}>{p.desc}</p>
                    </div>
                    {i === activeProtocol && <Zap className="h-3.5 w-3.5 text-cyan-400 animate-pulse shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2"><Crosshair className="h-4.5 w-4.5 text-green-400" /> Supported Platforms</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {probeTargets.map((t, i) => (
                  <div key={i} className="p-3 rounded-xl border border-white/7 bg-white/2 flex flex-col items-center gap-2 text-center card-lift" data-testid={`probe-target-${i}`}>
                    <t.icon className={`h-6 w-6 ${t.color}`} />
                    <span className="text-[10px] text-white/45 font-medium">{t.name}</span>
                  </div>
                ))}
              </div>
              <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2"><Boxes className="h-4.5 w-4.5 text-purple-400" /> 3 Coupling Modes</h3>
              <div className="space-y-3">
                {[
                  { mode: "Coupled", icon: Server, desc: "Always connected — real-time streaming, server-driven, zero local storage", color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/7" },
                  { mode: "Semi-Autonomous", icon: Wifi, desc: "Edge AI — offline operation, store & forward, eventually reconnects", color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/7" },
                  { mode: "Fully Autonomous", icon: Brain, desc: "Permanent independence — self-healing, self-deciding, no reconnection", color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/7" },
                ].map((m, i) => (
                  <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${m.border} ${m.bg}`} data-testid={`coupling-mode-${i}`}>
                    <m.icon className={`h-4 w-4 ${m.color} shrink-0 mt-0.5`} />
                    <div>
                      <span className={`text-sm font-bold ${m.color}`}>{m.mode}</span>
                      <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EVERYTHING WE COVER */}
      <section id="coverage" className="py-20 sm:py-32 relative" data-testid="section-coverage" style={{ background: "linear-gradient(180deg,#020307 0%,#04060f 50%,#020307 100%)" }}>
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute top-0 right-1/3 w-[600px] h-[500px]" style={{ background: "radial-gradient(circle,rgba(6,182,212,0.07),transparent 60%)" }} />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[400px]" style={{ background: "radial-gradient(circle,rgba(99,102,241,0.07),transparent 60%)" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-20">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-cyan-400/30 bg-cyan-500/10 text-cyan-400 font-bold uppercase tracking-widest">Full Ecosystem Coverage</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight" data-testid="text-coverage-title">
              Every Device. Every Protocol.<br />
              <span className="text-gradient-blue">Every Corner of Your Ecosystem.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-white/45 max-w-3xl mx-auto leading-relaxed">
              From the router at your network edge to the PLC on your factory floor, from a mobile phone in the field 
              to a mission-critical SAP instance in the cloud — HOLOCRON's probe network reaches every asset, 
              speaks every monitoring language, and feeds everything into a single AI-powered intelligence layer.
            </p>
          </div>

          {/* ── INFRASTRUCTURE DEVICE CATEGORIES ── */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-7">
              <div className="h-8 w-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <Server className="h-4 w-4 text-blue-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">Infrastructure & Devices Covered</h3>
              <div className="h-px flex-1 bg-white/6 hidden sm:block" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {infrastructureDevices.map((cat, i) => (
                <div key={i} className={`p-5 rounded-2xl border ${cat.border} ${cat.bg} card-lift`} data-testid={`card-infra-cat-${i}`}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={`h-8 w-8 rounded-lg ${cat.bg} border ${cat.border} flex items-center justify-center shrink-0`}>
                      <cat.icon className={`h-4 w-4 ${cat.color}`} />
                    </div>
                    <h4 className={`text-xs sm:text-[13px] font-black uppercase tracking-wider ${cat.color}`}>{cat.category}</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {cat.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-[11px] sm:text-xs text-white/50">
                        <CheckCircle2 className={`h-3 w-3 ${cat.color} shrink-0 mt-0.5`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* ── MONITORING PROTOCOLS ── */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-7">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
                <Radio className="h-4 w-4 text-cyan-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">12 Monitoring Protocols — Deep Coverage</h3>
              <div className="h-px flex-1 bg-white/6 hidden sm:block" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {monitoringProtocols.map((proto, i) => (
                <div key={i} className={`p-4 sm:p-5 rounded-2xl border ${proto.border} bg-[#09090f] card-lift group`} data-testid={`card-protocol-${i}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`h-9 w-9 rounded-xl ${proto.bg} border ${proto.border} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <proto.icon className={`h-4 w-4 ${proto.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-black ${proto.color}`}>{proto.name}</div>
                      <div className="text-[9px] text-white/30 leading-tight mt-0.5">{proto.full}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/45 leading-relaxed mb-3">{proto.desc}</p>
                  <div className={`text-[9px] px-2 py-1 rounded-lg border ${proto.border} ${proto.bg} ${proto.color} font-semibold inline-block`}>
                    ↳ {proto.use}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── REAL-TIME INTELLIGENCE PIPELINE ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-7">
              <div className="h-8 w-8 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                <Zap className="h-4 w-4 text-red-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">Real-Time Intelligence Pipeline — End to End</h3>
              <div className="h-px flex-1 bg-white/6 hidden sm:block" />
            </div>
            <div className="p-6 sm:p-10 rounded-3xl border border-white/8 bg-[#08090f] relative overflow-hidden" data-testid="panel-realtime-pipeline">
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 100%,rgba(239,68,68,0.06),transparent)" }} />
              <div className="relative">
                <p className="text-center text-sm text-white/35 mb-8 max-w-2xl mx-auto">
                  Every telemetry signal — from a packet drop on a Cisco router to a BACnet fault in your data centre HVAC to a compliance violation on a remote Android device — 
                  flows through a single unified pipeline, processed by AI in real time.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {realtimePipeline.map((stage, i) => (
                    <div key={i} className={`p-5 rounded-2xl border ${stage.border} ${stage.bg} relative`} data-testid={`card-pipeline-${i}`}>
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-xl ${stage.bg} border ${stage.border} flex items-center justify-center shrink-0 mt-0.5`}>
                          <stage.icon className={`h-5 w-5 ${stage.color}`} />
                        </div>
                        <div>
                          <div className={`text-xs font-black uppercase tracking-wider ${stage.color} mb-1.5`}>{stage.label}</div>
                          <p className="text-[11px] sm:text-xs text-white/45 leading-relaxed">{stage.desc}</p>
                        </div>
                      </div>
                      {i < realtimePipeline.length - 1 && (
                        <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
                          <div className="h-5 w-5 rounded-full bg-[#08090f] border border-white/10 flex items-center justify-center">
                            <ArrowRight className="h-2.5 w-2.5 text-white/25" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Stats row */}
                <div className="mt-8 pt-7 border-t border-white/6 grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
                  {[
                    { value: "<3s", label: "Alert to incident creation", color: "text-red-400" },
                    { value: "100%", label: "Events with AI narrative", color: "text-violet-400" },
                    { value: "Real-time", label: "BCP/DRP status updates", color: "text-amber-400" },
                    { value: "Zero", label: "Monitoring blind spots", color: "text-emerald-400" },
                  ].map((s, i) => (
                    <div key={i} data-testid={`stat-pipeline-${i}`}>
                      <div className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-white/30 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* BCP/DRP real-time callout */}
          <div className="p-6 sm:p-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 relative overflow-hidden" data-testid="panel-bcp-realtime">
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 60% at 0% 50%,rgba(245,158,11,0.08),transparent)" }} />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <FileText className="h-7 w-7 text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-base sm:text-lg font-black text-white mb-1.5">BCP/DRP Managed in Real Time — Triggered by Live Incidents</h4>
                <p className="text-sm text-white/45 leading-relaxed">
                  When a monitored event crosses a criticality threshold — a server farm going dark, a firewall failing over, 
                  a mission-critical application becoming unresponsive — HOLOCRON AI doesn't just raise an incident. 
                  It simultaneously evaluates BCP relevance, escalates to the DRP coordinator, activates the relevant recovery procedures, 
                  initiates stakeholder communications, and begins tracking mean-time-to-recovery in real time. 
                  No manual BCP invocation. No lost minutes. The plan executes as the incident unfolds.
                </p>
              </div>
              <div className="shrink-0 self-start sm:self-center">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-bold text-amber-400 whitespace-nowrap">Live Always</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BCP/DRP */}
      <section id="bcp" className="py-20 sm:py-28 relative" data-testid="section-bcp" style={{ background: "linear-gradient(180deg,#020307 0%,#06030d 50%,#020307 100%)" }}>
        <div className="absolute inset-0 dot-bg opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-red-400/30 bg-red-500/10 text-red-400 font-bold uppercase tracking-widest">Business Continuity</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight" data-testid="text-bcp-title">
              AI-Generated BCP/DRP.<br /><span className="text-gradient">Compliance-Ready by Default.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-white/45 max-w-3xl mx-auto leading-relaxed">
              AI writes your Business Continuity and Disaster Recovery plans from live infrastructure context — 
              not blank templates. Full lifecycle: BIA → Risk Register → Plans → Drills → Audit.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {bcpFeatures.map((f, i) => (
              <div key={i} className="p-5 sm:p-6 rounded-2xl border border-red-500/15 bg-red-500/5 card-lift" data-testid={`card-bcp-${i}`}>
                <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="font-bold text-sm sm:text-base text-white mb-2">{f.title}</h3>
                <p className="text-xs sm:text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GAMIFICATION */}
      <section className="py-16 sm:py-24 relative section-glow" data-testid="section-gamification">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-amber-400/30 bg-amber-500/10 text-amber-400 font-bold uppercase tracking-widest">Gamification Engine</Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight" data-testid="text-gamification-title">
              The First IT Platform With<br /><span className="text-gradient-gold">a Built-in XP Engine</span>
            </h2>
            <p className="mt-5 text-base text-white/40 max-w-2xl mx-auto">Motivate your team, surface top performers, and drive measurable behaviour change — with AI-generated coaching and live competitive rankings.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {gamificationFeatures.map((f, i) => (
              <div key={i} className="p-5 rounded-2xl border border-amber-500/15 bg-amber-500/5 card-lift text-center" data-testid={`card-gamification-${i}`}>
                <div className="h-12 w-12 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-4">
                  <f.icon className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="font-bold text-sm text-white mb-2">{f.label}</h3>
                <p className="text-xs text-white/38 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CREWS */}
      <section id="crews" className="py-20 sm:py-28 relative" data-testid="section-crews" style={{ background: "linear-gradient(180deg,#020307 0%,#04040e 100%)" }}>
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-indigo-400/30 bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-widest">Crews & Agents</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight" data-testid="text-crews-title">
              10 AI-Powered Crews.<br /><span className="text-gradient">199+ Specialist Agents.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-white/40 max-w-3xl mx-auto leading-relaxed">
              HOLOCRON's CrewAI-inspired architecture organises your entire IT operation into Crews (departments) 
              and Agents (roles). Every agent is an AI specialist — deployable, measurable, and orchestrated dynamically.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {crews.map((crew, i) => (
              <div key={i} className="p-4 sm:p-5 rounded-2xl border border-white/7 bg-white/2 card-lift group" data-testid={`card-crew-${i}`}>
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${crew.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <crew.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-xs sm:text-sm text-white leading-tight">{crew.name}</h3>
                  <Badge variant="outline" className="text-[8px] border-white/12 text-white/35 ml-2 shrink-0">{crew.agents}</Badge>
                </div>
                <p className="text-[10px] sm:text-xs text-white/30 leading-relaxed">{crew.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8 GLOBAL FIRSTS */}
      <section className="py-16 sm:py-24 relative section-glow" data-testid="section-world-firsts">
        <div className="absolute inset-0 dot-bg opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold uppercase tracking-widest">One of a Kind, Globally</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight" data-testid="text-world-firsts-title">
              8 Global Firsts.<br /><span className="text-gradient-gold">One Platform.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {worldFirsts.map((item, i) => (
              <div key={i} className="p-4 sm:p-5 rounded-2xl border border-amber-500/15 bg-amber-500/5 card-lift" data-testid={`card-world-first-${i}`}>
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <p className="text-xs sm:text-[13px] text-white/55 leading-relaxed">{item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 sm:py-28 relative" data-testid="section-testimonials" style={{ background: "linear-gradient(180deg,#020307 0%,#04040e 100%)" }}>
        <div className="absolute inset-0 grid-bg opacity-15" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Badge className="mb-5 px-4 py-1.5 text-[10px] border border-white/10 bg-white/5 text-white/40 font-bold uppercase tracking-widest">Customer Results</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight" data-testid="text-testimonials-title">
              Real Teams. <span className="text-gradient">Transformative Outcomes.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="border border-white/7 bg-[#09090f] card-lift" data-testid={`card-testimonial-${i}`}>
                <CardContent className="p-6 sm:p-8">
                  <div className="flex gap-0.5 mb-5">
                    {Array.from({ length: t.stars }).map((_, j) => <Star key={j} className="h-4 w-4 text-amber-400 fill-amber-400" />)}
                  </div>
                  <Quote className="h-6 w-6 text-indigo-500/35 mb-3" />
                  <p className="text-sm sm:text-base text-white/60 leading-relaxed mb-6 italic">{t.quote}</p>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {t.author.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.author}</p>
                      <p className="text-xs text-white/35">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-32 relative overflow-hidden" data-testid="section-cta">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%,rgba(88,80,236,0.15),transparent)" }} />
        <div className="absolute inset-0 grid-bg opacity-35" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10">
            <Atom className="h-3.5 w-3.5 text-indigo-400 animate-spin-slow" />
            <span className="text-xs sm:text-sm text-indigo-300 font-semibold">The AI Orchestrator for Your Entire Organisation</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05]" data-testid="text-cta-title">
            The Future of IT Operations<br /><span className="text-gradient">Is Already Here.</span>
          </h2>
          <p className="mt-7 text-base sm:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed">
            Full ITIL v4 spectrum. Proactive autonomous management. Human + AI workforce orchestration. 
            Generative AI at the core of every process. There is nothing else like it on earth.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto px-10 sm:px-14 h-12 sm:h-14 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-90 shadow-2xl shadow-indigo-500/40 border-0 text-white font-bold text-sm sm:text-base" asChild data-testid="button-cta-start">
              <Link href="/auth">Start Free Trial <Rocket className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-10 sm:px-14 h-12 sm:h-14 border-white/10 bg-white/4 hover:bg-white/8 text-white text-sm sm:text-base" asChild data-testid="button-cta-demo">
              <Link href="/auth"><Eye className="mr-2 h-4 w-4" /> Live Demo</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-white/25">
            {["No credit card required", "Full platform access", "Full AI access", "Deploy in minutes", "All 34 ITIL practices"].map(item => (
              <span key={item} className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-12 sm:py-16" data-testid="section-footer" style={{ background: "#020307" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center">
                  <img src={holocronLogo} alt="HOLOCRON AI" className="h-4 w-4 object-contain" />
                </div>
                <span className="font-black text-sm text-white">HOLOCRON AI</span>
              </div>
              <p className="text-xs text-white/30 leading-relaxed mb-4">The world's first Generative AI Orchestration Platform. Full ITIL v4. Autonomous infrastructure. Human + AI workforce — unified.</p>
              <Badge className="gen-pill text-purple-300 text-[9px] font-bold px-2.5 py-1 border-0">AI-Powered</Badge>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4">Platform</h4>
              <ul className="space-y-2.5 text-xs text-white/30">
                {["AI Orchestrator", "Generative AI Engine", "Full ITIL v4 Spectrum", "Autonomous Infrastructure", "Network Operations", "BCP/DRP Lifecycle", "Mobile Device Mgmt"].map(item => (
                  <li key={item}><a href="#orchestrator" className="hover:text-white/60 transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4">Capabilities</h4>
              <ul className="space-y-2.5 text-xs text-white/30">
                {["199+ AI Agent Roles", "34 ITIL v4 Practices", "10 IT Crews", "9 Probe Protocols", "Gamification XP Engine", "On-Call Roster", "Knowledge Base", "AI Governance Suite", "Holocron Conclave", "8 Free LLM Providers"].map(item => (
                  <li key={item}><span>{item}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4">Resources</h4>
              <ul className="space-y-2.5 text-xs text-white/30">
                {[{ label: "Documentation", href: "/documentation" }, { label: "Patent Exploration", href: "/patent-exploration" }, { label: "Sign In", href: "/auth" }, { label: "Get Started Free", href: "/auth" }].map(item => (
                  <li key={item.label}><a href={item.href} className="hover:text-white/60 transition-colors">{item.label}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-white/20 text-center sm:text-left">© 2026 HOLOCRON AI. The world's first Generative AI Orchestration Platform. All rights reserved.</p>
            <div className="flex items-center gap-1.5">
              <Atom className="h-3.5 w-3.5 text-indigo-400/50" />
              <span className="text-[11px] text-white/20">AI-Native · Full ITIL v4 · One of a Kind, Globally</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
