import {
  Users, CreditCard, Layers, Radar, MonitorSmartphone, AlertTriangle,
  Gauge, CalendarDays, Smartphone, Settings, Activity, AppWindow,
  BarChart3, Terminal, MessageSquare, Sparkles, Trophy,
  ShieldAlert, Bug, GitPullRequest, Headphones, PhoneCall, ListTodo,
  GitBranch, BookOpen, ShieldCheck, BookMarked, TrendingUp, Package,
  ScrollText, TerminalSquare, FlaskConical, Settings2,
  Shield, Server, Brain, Lock,
  Crosshair, ScanSearch, Target, Cloud, MonitorCheck,
  KeyRound, ClipboardCheck, Siren, HardDrive, FileKey, GraduationCap,
  DollarSign, Handshake, Rocket, Heart, Plug,
} from "lucide-react";

export interface ModuleDef {
  id: string;
  name: string;
  url: string;
  icon: typeof Users;
  helpText: string;
}

export interface DomainDef {
  id: string;
  name: string;
  description: string;
  tagline: string;
  color: string;        // tailwind color token (bg-X/10, text-X, border-X/20)
  gradient: string;    // gradient classes for the card accent
  icon: typeof Users;
  alwaysOn?: boolean;
  defaultOn?: boolean; // enabled out of the box for new users
  modules: ModuleDef[];
  autoEnableModules?: string[]; // module IDs auto-enabled when this domain is on
  requiredDomains?: string[];   // domain IDs that MUST be on when this domain is on
}

export const DOMAINS: DomainDef[] = [
  {
    id: "core",
    name: "Core Platform",
    description: "AI agent management, org structure, and platform essentials. Always included.",
    tagline: "Foundation",
    color: "indigo",
    gradient: "from-indigo-500/20 via-violet-500/10 to-transparent",
    icon: Users,
    alwaysOn: true,
    defaultOn: true,
    modules: [
      { id: "dashboard",       name: "Crews & Agents",  url: "/dashboard",       icon: Users,      helpText: "Manage department hierarchy and AI agent assignments" },
      { id: "subscriptions",   name: "Active Agents",   url: "/subscriptions",   icon: CreditCard, helpText: "View and manage active AI agent subscriptions" },
      { id: "recommendations", name: "Recommendations", url: "/recommendations", icon: Sparkles,   helpText: "AI-generated insights and operational recommendations" },
    ],
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    description: "Asset discovery, real-time monitoring, event management and capacity visibility.",
    tagline: "Visibility & Operations",
    color: "emerald",
    gradient: "from-emerald-500/20 via-green-500/10 to-transparent",
    icon: Server,
    defaultOn: true,
    modules: [
      { id: "cockpit",         name: "Cockpit",              url: "/infrastructure/cockpit",         icon: Layers,          helpText: "Real-time operational dashboard for all infrastructure" },
      { id: "assets",          name: "Asset Management",     url: "/infrastructure/assets",          icon: MonitorSmartphone,helpText: "Manage all discovered devices and assets" },
      { id: "events",          name: "Event Management",     url: "/infrastructure/events",          icon: AlertTriangle,   helpText: "View alerts, events, and incidents" },
      { id: "discovery",       name: "Discovery",            url: "/infrastructure/discovery",       icon: Radar,           helpText: "Run network discovery scans" },
      { id: "performance",     name: "Performance",          url: "/infrastructure/performance",     icon: Gauge,           helpText: "Analyze infrastructure performance trends" },
      { id: "calendar",        name: "Activity Calendar",    url: "/infrastructure/calendar",        icon: CalendarDays,    helpText: "View scheduled maintenance and AI activities" },
      { id: "mobile",          name: "Mobile Device",        url: "/infrastructure/mobile",          icon: Smartphone,      helpText: "Android & iOS device management — enrollment, compliance, remote actions" },
      { id: "configure",       name: "Configure",            url: "/infrastructure/configure",       icon: Settings,        helpText: "Deploy and manage discovery probes" },
      { id: "service-metrics", name: "Service Metrics",      url: "/infrastructure/service-metrics", icon: Activity,        helpText: "Configure and monitor service-level metrics" },
      { id: "applications",    name: "Application Monitor",  url: "/infrastructure/applications",    icon: AppWindow,       helpText: "Monitor application health and uptime" },
    ],
  },
  {
    id: "ai-operations",
    name: "AI Operations",
    description: "AI agent oversight, natural language ops interface, leaderboards and insights.",
    tagline: "Intelligence Layer",
    color: "violet",
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    icon: Brain,
    defaultOn: true,
    modules: [
      { id: "agent-matrix",  name: "Agent Matrix",    url: "/agent-matrix",    icon: BarChart3,   helpText: "Overview of all AI agents and their assignments" },
      { id: "agent-console", name: "Ops Console",     url: "/agent-console",   icon: Terminal,    helpText: "Agent operations console and logs" },
      { id: "agent-chat",    name: "Agent Chat",      url: "/agent-chat",      icon: MessageSquare,helpText: "Natural language conversations with AI agents" },
      { id: "leaderboard",   name: "Leaderboard",     url: "/leaderboard",     icon: Trophy,      helpText: "Gamified agent rankings and XP leaderboard" },
    ],
  },
  {
    id: "itsm",
    name: "ITSM Suite",
    description: "Full ITIL lifecycle — incidents, problems, changes, releases, tasks and knowledge.",
    tagline: "Service Management",
    color: "blue",
    gradient: "from-blue-500/20 via-sky-500/10 to-transparent",
    icon: GitBranch,
    defaultOn: true,
    requiredDomains: ["infrastructure"],
    modules: [
      { id: "incidents",           name: "Incidents",          url: "/incidents",           icon: ShieldAlert,  helpText: "Track and resolve incidents through ITIL lifecycle" },
      { id: "problems",            name: "Problems",           url: "/problems",            icon: Bug,          helpText: "Root cause analysis and problem management" },
      { id: "changes",             name: "Changes",            url: "/changes",             icon: GitPullRequest,helpText: "ITIL change control and approval workflows" },
      { id: "service-requests",    name: "Service Requests",   url: "/service-requests",    icon: Headphones,   helpText: "View and manage pending service requests" },
      { id: "on-call-roster",      name: "On-Call Roster",     url: "/on-call-roster",      icon: PhoneCall,    helpText: "Personnel availability and shift management" },
      { id: "tasks",               name: "Tasks",              url: "/tasks",               icon: ListTodo,     helpText: "Agent task assignments and tracking" },
      { id: "workflows",           name: "Workflows",          url: "/workflows",           icon: GitBranch,    helpText: "Orchestration pipelines with committee approval gates" },
      { id: "knowledge-base",      name: "Knowledge Base",     url: "/knowledge-base",      icon: BookOpen,     helpText: "ITIL articles and organizational knowledge" },
      { id: "bcp-drp",             name: "BCP / DRP",          url: "/bcp-drp",             icon: ShieldCheck,  helpText: "Business Continuity & Disaster Recovery planning" },
      { id: "known-errors",        name: "Known Errors (KEDB)",url: "/known-errors",        icon: BookMarked,   helpText: "Known Error Database — workarounds and permanent fixes" },
      { id: "csi-register",        name: "CSI Register",       url: "/csi-register",        icon: TrendingUp,   helpText: "Continual Service Improvement — PDCA improvement pipeline" },
      { id: "releases",            name: "Releases",           url: "/releases",            icon: Package,      helpText: "Release management pipeline with go-live approval gates" },
      { id: "capacity-management",    name: "Capacity Management",   url: "/capacity-management",    icon: Gauge,       helpText: "ITIL capacity & performance — utilisation trends and AI forecasting" },
      { id: "financial-management",   name: "Financial Management",  url: "/financial-management",   icon: DollarSign,  helpText: "ITIL 4 Service Financial Management — budget governance & cost modelling" },
      { id: "supplier-management",    name: "Supplier Management",   url: "/supplier-management",    icon: Handshake,   helpText: "ITIL 4 Supplier Management — vendor contracts, SLA performance & risk" },
      { id: "deployment-management",  name: "Deployments",           url: "/deployment-management",  icon: Rocket,      helpText: "ITIL 4 Deployment Management — release pipeline health & velocity" },
      { id: "relationship-management",name: "Relationship Mgmt",     url: "/relationship-management",icon: Heart,       helpText: "ITIL 4 Relationship Management — stakeholder satisfaction & service reviews" },
    ],
  },
  {
    id: "security",
    name: "Security & Compliance",
    description: "Full ITIL-aligned cybersecurity lifecycle — threat intelligence, vulnerability management, penetration testing, SOC operations, IAM governance, cloud security posture and compliance frameworks.",
    tagline: "Protect & Enforce",
    color: "red",
    gradient: "from-red-500/20 via-orange-500/10 to-transparent",
    icon: Lock,
    defaultOn: false,
    requiredDomains: ["infrastructure"],
    autoEnableModules: ["cockpit", "assets", "events"],
    modules: [
      // ── Threat & Vulnerability ─────────────────────────────────────────
      { id: "threat-intelligence",    name: "Threat Intelligence",     url: "/security/threat-intelligence",    icon: Crosshair,      helpText: "MITRE ATT&CK-mapped threat feeds, IOC management, actor tracking and AI-enriched threat briefings" },
      { id: "vulnerability-management",name: "Vulnerability Management",url: "/security/vulnerability-management",icon: ScanSearch,     helpText: "Full CVE lifecycle — scan ingestion, CVSS risk scoring, SLA-driven remediation and trend reporting" },
      { id: "pentest-management",     name: "Penetration Testing",     url: "/security/pentest-management",     icon: Target,         helpText: "Schedule, scope and track pen tests across on-prem, cloud and hybrid environments — findings to fix" },
      { id: "patch-management",       name: "Patch & Remediation",     url: "/security/patch-management",       icon: ShieldCheck,    helpText: "AI-prioritized patch deployment pipeline — CVE-linked, change-controlled and rollback-enabled" },
      // ── Cloud & Endpoint ───────────────────────────────────────────────
      { id: "cspm",                   name: "Cloud Security Posture",  url: "/security/cspm",                   icon: Cloud,          helpText: "Multi-cloud CSPM — AWS, Azure, GCP misconfiguration detection, CIS Benchmark scoring and drift alerts" },
      { id: "edr-management",         name: "Endpoint Security (EDR)", url: "/security/edr",                    icon: HardDrive,      helpText: "EDR posture overview, alert triage, quarantine actions and endpoint telemetry across managed assets" },
      // ── SOC & Incident Response ────────────────────────────────────────
      { id: "siem",                   name: "SIEM",                    url: "/security/siem",                   icon: Activity,       helpText: "ITIL Event Management — correlated events, log source health, correlation rules and AI threat analysis" },
      { id: "soc-operations",         name: "SOC Operations",          url: "/security/soc",                    icon: MonitorCheck,   helpText: "Analyst alert queue, threat hunting workbench, playbook execution and MTTR dashboards" },
      { id: "security-incidents",     name: "Security Incidents",      url: "/security/incidents",              icon: Siren,          helpText: "ITIL-aligned security incident response — containment, eradication, recovery and lessons-learned" },
      // ── Identity & Access ──────────────────────────────────────────────
      { id: "iam-governance",         name: "IAM Governance",          url: "/security/iam",                    icon: KeyRound,       helpText: "Access reviews, privilege audit, PAM policy enforcement and orphaned-account detection" },
      // ── Compliance & Risk ──────────────────────────────────────────────
      { id: "compliance-frameworks",  name: "Compliance Frameworks",   url: "/security/compliance",             icon: ClipboardCheck, helpText: "NIST CSF, ISO 27001, CIS Controls, SOC 2 and DORA — control mappings, gap analysis and evidence collection" },
      { id: "security-risk-register", name: "Security Risk Register",  url: "/security/risk-register",          icon: AlertTriangle,  helpText: "ITIL risk identification, likelihood/impact rating, treatment plans and residual-risk tracking" },
      { id: "data-protection",        name: "Data Protection & DLP",   url: "/security/data-protection",        icon: FileKey,        helpText: "Data classification posture, encryption coverage, DLP policy management and breach impact assessment" },
      // ── Config, Logs & Tooling ─────────────────────────────────────────
      { id: "config-management",      name: "Configuration Audit",     url: "/security/config-management",      icon: Settings2,      helpText: "AI-driven ITIL configuration audit, RFC generation and automated drift remediation" },
      { id: "log-aggregation",        name: "Log Aggregation",         url: "/security/log-aggregation",        icon: ScrollText,     helpText: "Log ingestion, connector management, retention policies and AI-powered anomaly pattern analysis" },
      { id: "command-center",         name: "Command Center",          url: "/command-center",                  icon: TerminalSquare, helpText: "Multi-asset command dispatch — ITIL runbooks, approval gates and full audit trail" },
      { id: "terminal",               name: "Asset Terminal",          url: "/terminal",                        icon: Terminal,       helpText: "Remote terminal — dispatch commands to enrolled assets via Holocron probe" },
      { id: "autonomous-validation",  name: "Autonomous Validation",   url: "/autonomous-validation",           icon: FlaskConical,   helpText: "Virtual lab integration — probe deployment, protocol validation and compliance testing automation" },
      // ── Awareness ──────────────────────────────────────────────────────
      { id: "security-awareness",     name: "Security Awareness",      url: "/security/awareness",              icon: GraduationCap,  helpText: "Training completion tracking, phishing simulation campaigns and crew security posture scores" },
    ],
  },
  {
    id: "sla",
    name: "SLA & Service Health",
    description: "Define SLA targets, track breaches in real-time, and monitor agreed vs. actual service levels.",
    tagline: "Assurance Layer",
    color: "teal",
    gradient: "from-teal-500/20 via-cyan-500/10 to-transparent",
    icon: Shield,
    defaultOn: false,
    requiredDomains: ["infrastructure"],
    modules: [
      { id: "sla-management", name: "SLA Targets",    url: "/sla-management", icon: Shield,     helpText: "Define and manage SLA targets per priority level" },
      { id: "sla-breaches",   name: "SLA Breaches",   url: "/sla-breaches",   icon: ShieldAlert,helpText: "Real-time SLA breach tracking and acknowledgement" },
      { id: "service-health", name: "Service Health", url: "/service-health", icon: Activity,   helpText: "Agreed vs actual — live service compliance dashboard" },
    ],
  },
  {
    id: "ai-governance",
    name: "AI Governance",
    description: "Universal AI observability, audit logging, hallucination detection, prompt injection protection, and LLM provider management.",
    tagline: "AI Trust & Control",
    color: "violet",
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    icon: Brain,
    alwaysOn: true,
    defaultOn: true,
    modules: [
      { id: "ai-governance", name: "AI Observability",  url: "/ai-governance", icon: Brain,     helpText: "Audit log, hallucination detection, prompt injection protection and human review gates" },
      { id: "ai-providers",  name: "AI Providers",      url: "/ai-providers",  icon: Plug,      helpText: "Configure LLM providers — free priority chain: Ollama → Gemini → Grok → Groq → OpenAI last" },
      { id: "conclave",      name: "Holocron Conclave", url: "/conclave",       icon: Sparkles,  helpText: "Multi-agent adversarial deliberation system — 5 AI agents debate a topic, Synthesizer builds consensus, then execute and evaluate the outcome" },
    ],
  },
];

export const ALL_MODULES: ModuleDef[] = DOMAINS.flatMap(d => d.modules);

export function getModuleById(id: string): ModuleDef | undefined {
  return ALL_MODULES.find(m => m.id === id);
}

export function getDomainByModuleId(id: string): DomainDef | undefined {
  return DOMAINS.find(d => d.modules.some(m => m.id === id));
}

/** Returns the set of domain IDs that are effectively on given raw prefs */
export function resolveEnabledDomains(prefs: Record<string, boolean>): Set<string> {
  const enabled = new Set<string>();

  // First pass: direct prefs + defaults
  for (const domain of DOMAINS) {
    const on = domain.alwaysOn
      ? true
      : (prefs[domain.id] ?? domain.defaultOn ?? false);
    if (on) enabled.add(domain.id);
  }

  // Second pass: force-on any requiredDomains of enabled domains
  let changed = true;
  while (changed) {
    changed = false;
    for (const domain of DOMAINS) {
      if (!enabled.has(domain.id)) continue;
      for (const reqId of (domain.requiredDomains ?? [])) {
        if (!enabled.has(reqId)) {
          enabled.add(reqId);
          changed = true;
        }
      }
    }
  }

  return enabled;
}

/** Returns the list of enabled domain names that require a given domain */
export function getRequiredByNames(domainId: string, prefs: Record<string, boolean>): string[] {
  const enabledDomains = resolveEnabledDomains(prefs);
  return DOMAINS
    .filter(d => enabledDomains.has(d.id) && d.requiredDomains?.includes(domainId))
    .map(d => d.name);
}

/** Resolve preferences → final enabled module set (applies all dependency rules) */
export function resolveEnabledModules(prefs: Record<string, boolean>): Set<string> {
  const enabled = new Set<string>();
  const enabledDomains = resolveEnabledDomains(prefs);

  for (const domain of DOMAINS) {
    if (!enabledDomains.has(domain.id)) continue;
    for (const m of domain.modules) {
      if (prefs[m.id] === false) continue; // individual override
      enabled.add(m.id);
    }
    // autoEnableModules (specific module IDs from other domains)
    for (const depId of (domain.autoEnableModules ?? [])) {
      enabled.add(depId);
    }
  }

  // Always enable individual modules explicitly turned on
  for (const domain of DOMAINS) {
    for (const m of domain.modules) {
      if (prefs[m.id] === true) enabled.add(m.id);
    }
  }

  // Core always on
  const coreDomain = DOMAINS.find(d => d.alwaysOn);
  if (coreDomain) {
    for (const m of coreDomain.modules) enabled.add(m.id);
  }

  return enabled;
}

export const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", badge: "bg-indigo-500/20 text-indigo-300" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", badge: "bg-emerald-500/20 text-emerald-300" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20", badge: "bg-violet-500/20 text-violet-300" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", badge: "bg-blue-500/20 text-blue-300" },
  red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", badge: "bg-red-500/20 text-red-300" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20", badge: "bg-teal-500/20 text-teal-300" },
};
