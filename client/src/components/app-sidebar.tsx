import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import {
  LogOut, Building2, User, ListTodo, GitBranch, Users, ChevronRight, ChevronDown,
  Sparkles, CreditCard, Zap, Activity, BarChart3, MessageSquare, Settings,
  Radar, MonitorSmartphone, AlertTriangle, AppWindow, Gauge, Terminal,
  Layers, CalendarDays, Headphones, Shield, ShieldAlert, Bug, GitPullRequest,
  BookOpen, ShieldCheck, BookMarked, TrendingUp, Package, ScrollText, Smartphone,
  TerminalSquare, FlaskConical, Settings2, LayoutGrid, Trophy, PhoneCall,
  Lock, Crosshair, ScanSearch, Target, Cloud, MonitorCheck, KeyRound,
  ClipboardCheck, Siren, HardDrive, FileKey, GraduationCap, Plug, Brain,
  DollarSign, Handshake, Rocket, Heart, Plane,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import holocronLogo from "@assets/Holocron_Logo_Icon_White_1772663128663.png";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { RoleSubscription } from "@shared/schema";
import { useState, useEffect } from "react";
import { useModules } from "@/hooks/use-modules";

interface NavItem {
  title: string;
  url: string;
  icon: typeof Users;
  moduleId: string;
  provisioned?: boolean;
  tourId?: string;
  helpText?: string;
}

const organizationItems: NavItem[] = [
  { title: "Crews & Agents",  url: "/dashboard",       icon: Users,      moduleId: "dashboard",       tourId: "sidebar-crews-agents" },
  { title: "Active Agents",   url: "/subscriptions",   icon: CreditCard, moduleId: "subscriptions" },
  { title: "Recommendations", url: "/recommendations", icon: Sparkles,   moduleId: "recommendations", tourId: "sidebar-recommendations" },
];

const infrastructureItems: NavItem[] = [
  { title: "Cockpit",           url: "/infrastructure/cockpit",         icon: Layers,           moduleId: "cockpit",         tourId: "sidebar-cockpit" },
  { title: "Discovery",         url: "/infrastructure/discovery",       icon: Radar,            moduleId: "discovery" },
  { title: "Asset Management",  url: "/infrastructure/assets",          icon: MonitorSmartphone, moduleId: "assets" },
  { title: "Event Management",  url: "/infrastructure/events",          icon: AlertTriangle,    moduleId: "events" },
  { title: "Performance",       url: "/infrastructure/performance",     icon: Gauge,            moduleId: "performance" },
  { title: "Activity Calendar", url: "/infrastructure/calendar",        icon: CalendarDays,     moduleId: "calendar" },
  { title: "Mobile Device",     url: "/infrastructure/mobile",          icon: Smartphone,       moduleId: "mobile" },
];

const configurationItems: NavItem[] = [
  { title: "Configure",          url: "/infrastructure/configure",       icon: Settings,  moduleId: "configure" },
  { title: "Service Metrics",    url: "/infrastructure/service-metrics", icon: Activity,  moduleId: "service-metrics" },
  { title: "Application Monitor",url: "/infrastructure/applications",   icon: AppWindow, moduleId: "applications" },
];

const aiOpsItems: NavItem[] = [
  { title: "Agent Matrix", url: "/agent-matrix",  icon: BarChart3,    moduleId: "agent-matrix",  tourId: "sidebar-agent-matrix" },
  { title: "Ops Console",  url: "/agent-console", icon: Terminal,     moduleId: "agent-console" },
  { title: "Agent Chat",   url: "/agent-chat",    icon: MessageSquare,moduleId: "agent-chat",    tourId: "sidebar-agent-chat" },
  { title: "Leaderboard",  url: "/leaderboard",   icon: Trophy,       moduleId: "leaderboard" },
];

const itsmItems: NavItem[] = [
  { title: "Incidents",           url: "/incidents",           icon: ShieldAlert,    moduleId: "incidents" },
  { title: "Problems",            url: "/problems",            icon: Bug,            moduleId: "problems" },
  { title: "Changes",             url: "/changes",             icon: GitPullRequest, moduleId: "changes" },
  { title: "Service Requests",    url: "/service-requests",    icon: Headphones,     moduleId: "service-requests" },
  { title: "On-Call Roster",      url: "/on-call-roster",      icon: PhoneCall,      moduleId: "on-call-roster" },
  { title: "Tasks",               url: "/tasks",               icon: ListTodo,       moduleId: "tasks" },
  { title: "Workflows",           url: "/workflows",           icon: GitBranch,      moduleId: "workflows" },
  { title: "Knowledge Base",      url: "/knowledge-base",      icon: BookOpen,       moduleId: "knowledge-base" },
  { title: "BCP / DRP",           url: "/bcp-drp",             icon: ShieldCheck,    moduleId: "bcp-drp" },
  { title: "Known Errors (KEDB)", url: "/known-errors",        icon: BookMarked,     moduleId: "known-errors" },
  { title: "CSI Register",        url: "/csi-register",        icon: TrendingUp,     moduleId: "csi-register" },
  { title: "Releases",            url: "/releases",            icon: Package,        moduleId: "releases" },
  { title: "Capacity Management",  url: "/capacity-management",   icon: Gauge,       moduleId: "capacity-management" },
  { title: "Financial Management", url: "/financial-management",  icon: DollarSign,  moduleId: "financial-management" },
  { title: "Supplier Management",  url: "/supplier-management",   icon: Handshake,   moduleId: "supplier-management" },
  { title: "Deployments",          url: "/deployment-management", icon: Rocket,      moduleId: "deployment-management" },
  { title: "Relationship Mgmt",    url: "/relationship-management", icon: Heart,     moduleId: "relationship-management" },
];

const slaMgmtItems: NavItem[] = [
  { title: "SLA Targets",    url: "/sla-management", icon: Shield,     moduleId: "sla-management" },
  { title: "SLA Breaches",   url: "/sla-breaches",   icon: ShieldAlert,moduleId: "sla-breaches" },
  { title: "Service Health", url: "/service-health", icon: Activity,   moduleId: "service-health" },
];

// Security & Compliance — all 18 modules organized in logical sub-groups
const securityGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Threat & Vulnerability",
    items: [
      { title: "Threat Intelligence",    url: "/security/threat-intelligence",    icon: Crosshair,   moduleId: "threat-intelligence" },
      { title: "Vulnerability Mgmt",     url: "/security/vulnerability-management",icon: ScanSearch,  moduleId: "vulnerability-management" },
      { title: "Penetration Testing",    url: "/security/pentest-management",     icon: Target,      moduleId: "pentest-management" },
      { title: "Patch & Remediation",    url: "/security/patch-management",       icon: ShieldCheck, moduleId: "patch-management" },
    ],
  },
  {
    label: "Cloud & Endpoint",
    items: [
      { title: "Cloud Security Posture", url: "/security/cspm",                   icon: Cloud,       moduleId: "cspm" },
      { title: "Endpoint Security (EDR)",url: "/security/edr",                    icon: HardDrive,   moduleId: "edr-management" },
    ],
  },
  {
    label: "SOC & Response",
    items: [
      { title: "SIEM",                    url: "/security/siem",                   icon: Activity,    moduleId: "siem" },
      { title: "SOC Operations",         url: "/security/soc",                    icon: MonitorCheck,moduleId: "soc-operations" },
      { title: "Security Incidents",     url: "/security/incidents",              icon: Siren,       moduleId: "security-incidents" },
      { title: "Forensics",             url: "/security/forensics",              icon: Crosshair,   moduleId: "forensics" },
    ],
  },
  {
    label: "Identity & Compliance",
    items: [
      { title: "IAM Governance",         url: "/security/iam",                    icon: KeyRound,    moduleId: "iam-governance" },
      { title: "Compliance Frameworks",  url: "/security/compliance",             icon: ClipboardCheck,moduleId: "compliance-frameworks" },
      { title: "Security Risk Register", url: "/security/risk-register",          icon: AlertTriangle,moduleId: "security-risk-register" },
      { title: "Data Protection & DLP",  url: "/security/data-protection",        icon: FileKey,     moduleId: "data-protection" },
    ],
  },
  {
    label: "Tooling",
    items: [
      { title: "Configuration Audit",    url: "/security/config-management",      icon: Settings2,   moduleId: "config-management" },
      { title: "Log Aggregation",        url: "/security/log-aggregation",        icon: ScrollText,  moduleId: "log-aggregation" },
      { title: "Command Center",         url: "/command-center",                  icon: TerminalSquare,moduleId: "command-center" },
      { title: "Asset Terminal",         url: "/terminal",                        icon: Terminal,    moduleId: "terminal" },
      { title: "Autonomous Validation",  url: "/autonomous-validation",           icon: FlaskConical,moduleId: "autonomous-validation" },
    ],
  },
  {
    label: "Awareness",
    items: [
      { title: "Security Awareness",     url: "/security/awareness",              icon: GraduationCap,moduleId: "security-awareness" },
    ],
  },
  {
    label: "Platform",
    items: [
      { title: "Integrations Hub",       url: "/security/integrations",           icon: Plug,         moduleId: "security-integrations" },
    ],
  },
];

const aiGovernanceItems: NavItem[] = [
  { title: "AI Observability", url: "/ai-governance",    icon: Brain,    moduleId: "ai-governance" },
  { title: "AI Knowledge Base",url: "/ai-knowledge-base",icon: BookOpen, moduleId: "ai-knowledge-base" },
  { title: "AI Providers",     url: "/ai-providers",     icon: Plug,     moduleId: "ai-providers" },
  { title: "Conclave",         url: "/conclave",          icon: Sparkles, moduleId: "conclave" },
];

const useCasesItems: NavItem[] = [
  { title: "Flyguys Platform", url: "/use-cases/flyguys", icon: Plane, moduleId: "flyguys" },
];

function NavItem({ item, location, indent = false }: { item: NavItem; location: string; indent?: boolean }) {
  const isActive = location === item.url || (item.url !== "/" && item.url !== "/dashboard" && location.startsWith(item.url));
  return (
    <SidebarMenuItem data-testid={item.tourId}>
      <SidebarMenuButton
        asChild
        data-active={isActive}
        className={`group relative rounded-lg transition-all duration-200
          ${indent ? "px-3 py-2" : "px-3 py-2.5"}
          ${isActive
            ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.15)]"
            : "hover:bg-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground border border-transparent"
          }
        `}
      >
        <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
          <item.icon className={`shrink-0 ${indent ? "h-3.5 w-3.5" : "h-4 w-4"} ${isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-sidebar-foreground"}`} />
          <span className={`font-medium ${indent ? "text-xs" : "text-sm"}`}>{item.title}</span>
          {isActive && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroup({ label, items, location, isEnabled }: { label: string; items: NavItem[]; location: string; isEnabled: (id: string) => boolean }) {
  const visible = items.filter(i => isEnabled(i.moduleId));
  if (visible.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] font-bold text-sidebar-foreground/60 px-3 mb-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map(item => <NavItem key={item.title} item={item} location={location} />)}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function InfrastructureNavGroup({ location, isEnabled }: { location: string; isEnabled: (id: string) => boolean }) {
  const visibleInfra = infrastructureItems.filter(i => isEnabled(i.moduleId));
  const visibleConfig = configurationItems.filter(i => isEnabled(i.moduleId));
  if (visibleInfra.length === 0 && visibleConfig.length === 0) return null;

  const allVisible = [...visibleInfra, ...visibleConfig];
  const isAnyChildActive = allVisible.some(item => location.startsWith(item.url));
  const isAnyConfigActive = visibleConfig.some(item => location.startsWith(item.url));
  const [expanded, setExpanded] = useState(isAnyChildActive);
  const [configExpanded, setConfigExpanded] = useState(isAnyConfigActive);

  useEffect(() => { if (isAnyChildActive) setExpanded(true); }, [isAnyChildActive]);
  useEffect(() => { if (isAnyConfigActive) setConfigExpanded(true); }, [isAnyConfigActive]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        className="text-[10px] uppercase tracking-[0.15em] font-bold text-sidebar-foreground/60 px-3 mb-1 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-infra-toggle"
      >
        <span className="flex-1">Infrastructure Mgmt</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
      </SidebarGroupLabel>
      {expanded && (
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleInfra.slice(0, 1).map(item => <NavItem key={item.title} item={item} location={location} />)}
            {visibleConfig.length > 0 && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setConfigExpanded(!configExpanded)}
                    className={`group relative px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer
                      ${isAnyConfigActive ? "bg-primary/5 text-primary/80 border border-primary/10" : "hover:bg-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground border border-transparent"}
                    `}
                    data-testid="button-config-toggle"
                  >
                    <Settings className={`h-4 w-4 shrink-0 ${isAnyConfigActive ? "text-primary/70" : "text-muted-foreground/70 group-hover:text-sidebar-foreground"}`} />
                    <span className="text-sm font-medium flex-1">Configuration</span>
                    {configExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {configExpanded && visibleConfig.map(item => (
                  <div key={item.title} className="pl-3">
                    <NavItem item={item} location={location} indent />
                  </div>
                ))}
              </>
            )}
            {visibleInfra.slice(1).map(item => <NavItem key={item.title} item={item} location={location} />)}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

function ITSMNavGroup({ location, isEnabled }: { location: string; isEnabled: (id: string) => boolean }) {
  const visibleItsm = itsmItems.filter(i => isEnabled(i.moduleId));
  const visibleSla = slaMgmtItems.filter(i => isEnabled(i.moduleId));
  if (visibleItsm.length === 0 && visibleSla.length === 0) return null;

  const isAnySlaActive = visibleSla.some(item => location === item.url || location.startsWith(item.url));
  const [slaExpanded, setSlaExpanded] = useState(isAnySlaActive);
  useEffect(() => { if (isAnySlaActive) setSlaExpanded(true); }, [isAnySlaActive]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] font-bold text-sidebar-foreground/60 px-3 mb-1">
        ITSM Suite
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItsm.map(item => <NavItem key={item.title} item={item} location={location} />)}
          {visibleSla.length > 0 && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setSlaExpanded(!slaExpanded)}
                  className={`group relative px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer
                    ${isAnySlaActive ? "bg-primary/5 text-primary/80 border border-primary/10" : "hover:bg-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground border border-transparent"}
                  `}
                  data-testid="button-sla-mgmt-toggle"
                >
                  <Shield className={`h-4 w-4 shrink-0 ${isAnySlaActive ? "text-primary/70" : "text-muted-foreground/70 group-hover:text-sidebar-foreground"}`} />
                  <span className="text-sm font-medium flex-1">SLA Mgmt</span>
                  {slaExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {slaExpanded && visibleSla.map(item => (
                <div key={item.title} className="pl-3">
                  <NavItem item={item} location={location} indent />
                </div>
              ))}
            </>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SecurityNavGroup({ location, isEnabled }: { location: string; isEnabled: (id: string) => boolean }) {
  const allSecurityItems = securityGroups.flatMap(g => g.items);
  const anyVisible = allSecurityItems.some(i => isEnabled(i.moduleId));
  const isAnySecActive = allSecurityItems.some(i => location === i.url || (i.url !== "/" && location.startsWith(i.url)));
  const [expanded, setExpanded] = useState(isAnySecActive);
  useEffect(() => { if (isAnySecActive) setExpanded(true); }, [isAnySecActive]);
  if (!anyVisible) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        className="text-[10px] uppercase tracking-[0.15em] font-bold text-sidebar-foreground/60 px-3 mb-1 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-security-toggle"
      >
        <Lock className="h-3 w-3 text-red-400/70 mr-1.5" />
        <span className="flex-1">Security & Compliance</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
      </SidebarGroupLabel>
      {expanded && (
        <SidebarGroupContent>
          {securityGroups.map(group => {
            const visibleItems = group.items.filter(i => isEnabled(i.moduleId));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="text-[9px] uppercase tracking-wider text-red-400/50 font-bold px-3 mt-3 mb-1">{group.label}</p>
                <SidebarMenu>
                  {visibleItems.map(item => <NavItem key={item.title} item={item} location={location} indent />)}
                </SidebarMenu>
              </div>
            );
          })}
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isEnabled } = useModules();

  const { data: subscriptions } = useQuery<RoleSubscription[]>({
    queryKey: ["/api/role-subscriptions"],
  });

  const activeSubs = subscriptions?.filter(s => s.status === "active").length ?? 0;
  const aiShadows = subscriptions?.filter(s => s.hasAiShadow).length ?? 0;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/90 to-purple-600 shadow-[0_0_16px_-2px_hsl(var(--primary)/0.3)]">
            <img src={holocronLogo} alt="Holocron AI" className="h-5 w-5 object-contain" />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-sidebar shadow-[0_0_6px_hsl(142_71%_50%/0.5)]" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight gradient-text" data-testid="text-app-name">
              HOLOCRON AI
            </span>
            <span className="text-[10px] text-muted-foreground/70 font-medium">
              Automation Orchestration Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <div className="px-4 py-2">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border/40">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-primary/70" />
                <span className="text-[10px] text-muted-foreground font-medium">Agent Status</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold text-primary" data-testid="text-active-agents">{aiShadows}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-700 ease-out"
                style={{ width: `${activeSubs > 0 ? Math.min(100, (aiShadows / Math.max(1, activeSubs)) * 100) : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
              <span>{activeSubs} roles assigned</span>
              <span>{aiShadows} AI active</span>
            </div>
          </div>
        </div>
      </div>

      <SidebarContent className="px-1 scrollbar-thin">
        <NavGroup label="Organization" items={organizationItems} location={location} isEnabled={isEnabled} />
        <InfrastructureNavGroup location={location} isEnabled={isEnabled} />
        <NavGroup label="AI Operations" items={aiOpsItems} location={location} isEnabled={isEnabled} />
        <ITSMNavGroup location={location} isEnabled={isEnabled} />
        <SecurityNavGroup location={location} isEnabled={isEnabled} />
        <NavGroup label="AI Governance" items={aiGovernanceItems} location={location} isEnabled={isEnabled} />
        <NavGroup label="Use-Cases Factory" items={useCasesItems} location={location} isEnabled={() => true} />
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/catalog">
            <button
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 text-left
                ${location === "/catalog"
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : "bg-accent/20 border-border/30 text-muted-foreground/70 hover:text-foreground hover:border-border/60 hover:bg-accent/40"
                }`}
              data-testid="link-catalog"
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-medium">Customize</span>
            </button>
          </Link>
        </div>
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-accent/20 border border-border/30">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0">
              <User className="h-3 w-3 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" data-testid="text-sidebar-user">{user.displayName}</p>
              {user.companyName && (
                <p className="text-[10px] text-muted-foreground/50 truncate flex items-center gap-1">
                  <Building2 className="h-2.5 w-2.5 shrink-0" />{user.companyName}
                </p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              data-testid="button-logout"
              title="Sign out"
            >
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
