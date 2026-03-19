import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon, Loader2, BookOpen, HelpCircle, FileText, Command, Search, Bell, LogOut, User, Building2 } from "lucide-react";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import Onboarding from "@/pages/onboarding";
import OrgChart from "@/pages/org-chart";
import Subscriptions from "@/pages/subscriptions";
import Recommendations from "@/pages/recommendations";
import Infrastructure from "@/pages/infrastructure";
import UnifiedEventManagement from "@/pages/event-management";
import AgentDashboard from "@/pages/agent-dashboard";
import AgentMatrix from "@/pages/agent-matrix";
import AgentChat from "@/pages/agent-chat";
import AgentConsole from "@/pages/agent-console";
import ServiceRequests from "@/pages/service-requests";
import Incidents from "@/pages/incidents";
import Problems from "@/pages/problems";
import Changes from "@/pages/changes";
import Leaderboard from "@/pages/leaderboard";
import OnCallRoster from "@/pages/on-call-roster";
import Workflows from "@/pages/workflows";
import Tasks from "@/pages/tasks";
import KnowledgeBase from "@/pages/knowledge-base";
import AiKnowledgeBase from "@/pages/ai-knowledge-base";
import NotFound from "@/pages/not-found";
import BcpDrpPage from "@/pages/bcp-drp";
import KnownErrorsPage from "@/pages/known-errors";
import SlaBreachTrackerPage from "@/pages/sla-breach-tracker";
import SlaManagementPage from "@/pages/sla-management";
import ServiceHealthPage from "@/pages/service-health";
import CapacityManagementPage from "@/pages/capacity-management";
import CsiRegisterPage from "@/pages/csi-register";
import ReleaseManagementPage from "@/pages/release-management";
import LogAggregationPage from "@/pages/log-aggregation";
import CommandControlCenter from "@/pages/command-control-center";
import PatchManagement from "@/pages/patch-management";
import AssetTerminal from "@/pages/asset-terminal";
import AutonomousValidation from "@/pages/autonomous-validation";
import ConfigManagement from "@/pages/config-management";
import ModuleCatalog from "@/pages/module-catalog";
import ThreatIntelligence from "@/pages/security/threat-intelligence";
import VulnerabilityManagement from "@/pages/security/vulnerability-management";
import PentestManagement from "@/pages/security/pentest-management";
import CloudSecurityPosture from "@/pages/security/cspm";
import EndpointSecurity from "@/pages/security/edr";
import SOCOperations from "@/pages/security/soc-operations";
import SIEMOperations from "@/pages/security/siem";
import SecurityIncidents from "@/pages/security/security-incidents";
import IAMGovernance from "@/pages/security/iam-governance";
import ComplianceFrameworks from "@/pages/security/compliance-frameworks";
import SecurityRiskRegister from "@/pages/security/security-risk-register";
import DataProtection from "@/pages/security/data-protection";
import SecurityAwareness from "@/pages/security/security-awareness";
import SecurityIntegrations from "@/pages/security/integrations";
import ForensicsInvestigation from "@/pages/security/forensics";
import AiGovernance from "@/pages/ai-governance";
import ConclavePage from "@/pages/conclave";
import ServiceCatalogMetrics from "@/pages/service-catalog-metrics";
import FinancialManagement from "@/pages/financial-management";
import SupplierManagement from "@/pages/supplier-management";
import DeploymentManagement from "@/pages/deployment-management";
import RelationshipManagement from "@/pages/relationship-management";
import UserManual from "@/pages/user-manual";
import Connectors from "@/pages/connectors";
import Automation from "@/pages/automation";
import FlyguysPage from "@/pages/use-cases/flyguys";
import FlyguysPortal from "@/pages/use-cases/flyguys-portal";
import FlyguaysMissionTracker from "@/pages/use-cases/flyguys-mission-tracker";
import { GuidedTour } from "@/components/guided-tour";
import { CommandPalette } from "@/components/command-palette";
import { SetupProgress } from "@/components/setup-progress";
import { AiAssistantAvatar } from "@/components/ai-assistant-avatar";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function ProtectedRouter() {
  return (
    <Switch>
      <Route path="/dashboard" component={OrgChart} />
      <Route path="/subscriptions" component={Subscriptions} />
      <Route path="/recommendations" component={Recommendations} />
      <Route path="/infrastructure/events" component={UnifiedEventManagement} />
      <Route path="/infrastructure/agent-dashboard/:roleId" component={AgentDashboard} />
      <Route path="/infrastructure/:rest*" component={Infrastructure} />
      <Route path="/infrastructure" component={Infrastructure} />
      <Route path="/network-ops/discovery">
        <Redirect to="/infrastructure/discovery" />
      </Route>
      <Route path="/network-ops/assets">
        <Redirect to="/infrastructure/assets" />
      </Route>
      <Route path="/network-ops/agents">
        <Redirect to="/infrastructure/configure" />
      </Route>
      <Route path="/network-ops/:rest*">
        <Redirect to="/infrastructure/discovery" />
      </Route>
      <Route path="/network-ops">
        <Redirect to="/infrastructure/discovery" />
      </Route>
      <Route path="/agent-notifications">
        <Redirect to="/infrastructure/events" />
      </Route>
      <Route path="/agent-matrix" component={AgentMatrix} />
      <Route path="/agent-console" component={AgentConsole} />
      <Route path="/agent-chat" component={AgentChat} />
      <Route path="/service-requests" component={ServiceRequests} />
      <Route path="/incidents" component={Incidents} />
      <Route path="/problems" component={Problems} />
      <Route path="/changes" component={Changes} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/on-call-roster" component={OnCallRoster} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/knowledge-base" component={KnowledgeBase} />
      <Route path="/bcp-drp" component={BcpDrpPage} />
      <Route path="/known-errors" component={KnownErrorsPage} />
      <Route path="/sla-management" component={SlaManagementPage} />
      <Route path="/sla-breaches" component={SlaBreachTrackerPage} />
      <Route path="/service-health" component={ServiceHealthPage} />
      <Route path="/capacity-management" component={CapacityManagementPage} />
      <Route path="/csi-register" component={CsiRegisterPage} />
      <Route path="/financial-management" component={FinancialManagement} />
      <Route path="/supplier-management" component={SupplierManagement} />
      <Route path="/deployment-management" component={DeploymentManagement} />
      <Route path="/relationship-management" component={RelationshipManagement} />
      <Route path="/releases" component={ReleaseManagementPage} />
      <Route path="/log-aggregation" component={LogAggregationPage} />
      <Route path="/command-center" component={CommandControlCenter} />
      <Route path="/patch-management" component={PatchManagement} />
      <Route path="/terminal" component={AssetTerminal} />
      <Route path="/autonomous-validation" component={AutonomousValidation} />
      <Route path="/config-management" component={ConfigManagement} />
      <Route path="/catalog" component={ModuleCatalog} />
      {/* Security sub-routes */}
      <Route path="/security/threat-intelligence" component={ThreatIntelligence} />
      <Route path="/security/vulnerability-management" component={VulnerabilityManagement} />
      <Route path="/security/pentest-management" component={PentestManagement} />
      <Route path="/security/patch-management" component={PatchManagement} />
      <Route path="/security/config-management" component={ConfigManagement} />
      <Route path="/security/log-aggregation" component={LogAggregationPage} />
      <Route path="/security/cspm" component={CloudSecurityPosture} />
      <Route path="/security/edr" component={EndpointSecurity} />
      <Route path="/security/soc" component={SOCOperations} />
      <Route path="/security/siem" component={SIEMOperations} />
      <Route path="/security/incidents" component={SecurityIncidents} />
      <Route path="/security/iam" component={IAMGovernance} />
      <Route path="/security/compliance" component={ComplianceFrameworks} />
      <Route path="/security/risk-register" component={SecurityRiskRegister} />
      <Route path="/security/data-protection" component={DataProtection} />
      <Route path="/security/awareness" component={SecurityAwareness} />
      <Route path="/security/integrations" component={SecurityIntegrations} />
      <Route path="/security/forensics" component={ForensicsInvestigation} />
      <Route path="/ai-governance" component={AiGovernance} />
      <Route path="/ai-knowledge-base" component={AiKnowledgeBase} />
      <Route path="/ai-providers" component={ServiceCatalogMetrics} />
      <Route path="/conclave" component={ConclavePage} />
      <Route path="/user-manual" component={UserManual} />
      <Route path="/connectors" component={Connectors} />
      <Route path="/automation" component={Automation} />
      {/* Use-Cases Factory */}
      <Route path="/use-cases/flyguys" component={FlyguysPage} />
      <Route path="/flyguys-portal" component={FlyguysPortal} />
      <Route path="/flyguys-mission/:id" component={FlyguaysMissionTracker} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "Crews & Agents", subtitle: "Organization Overview" },
  "/subscriptions": { title: "Active Agents", subtitle: "Subscriptions" },
  "/recommendations": { title: "Recommendations", subtitle: "AI Insights" },
  "/infrastructure/cockpit": { title: "Cockpit", subtitle: "Infrastructure Command Center" },
  "/infrastructure/configure": { title: "Configure", subtitle: "Probe Deployment" },
  "/infrastructure/discovery": { title: "Discovery", subtitle: "Network Scanning" },
  "/infrastructure/assets": { title: "Asset Management", subtitle: "Device Inventory" },
  "/infrastructure/events": { title: "ITIL Event Management", subtitle: "Unified Security & Operational Event Hub" },
  "/infrastructure/taxonomy": { title: "Probe Taxonomy", subtitle: "v10 Classification" },
  "/infrastructure/service-metrics": { title: "Service Metrics", subtitle: "Monitoring Catalog" },
  "/infrastructure/applications": { title: "Application Monitor", subtitle: "App Health" },
  "/infrastructure/performance": { title: "Performance", subtitle: "Analytics" },
  "/infrastructure/calendar": { title: "Activity Calendar", subtitle: "Scheduled Tasks" },
  "/agent-matrix": { title: "Agent Matrix", subtitle: "AI Agent Overview" },
  "/agent-console": { title: "Ops Console", subtitle: "Agent Operations" },
  "/agent-chat": { title: "Agent Chat", subtitle: "AI Conversations" },
  "/service-requests": { title: "Service Requests", subtitle: "Task Management" },
  "/incidents": { title: "Incident Management", subtitle: "ITIL Incident Lifecycle" },
  "/problems": { title: "Problem Management", subtitle: "Root Cause Analysis" },
  "/changes": { title: "Change Management", subtitle: "ITIL Change Control" },
  "/leaderboard": { title: "Leaderboard", subtitle: "Agent Performance Rankings" },
  "/on-call-roster": { title: "On-Call Roster", subtitle: "Personnel Availability" },
  "/workflows": { title: "Workflows", subtitle: "Orchestration & Committee Gates" },
  "/tasks": { title: "Tasks", subtitle: "Agent Task Management" },
  "/connectors": { title: "Connectors", subtitle: "System Integrations & APIs" },
  "/automation": { title: "Automation", subtitle: "Runbooks & Automated Workflows" },
  "/knowledge-base": { title: "Knowledge Base", subtitle: "ITIL Articles & Resources" },
  "/bcp-drp": { title: "BCP / DRP", subtitle: "Business Continuity & Disaster Recovery" },
  "/known-errors": { title: "Known Error Database", subtitle: "KEDB — Workarounds & Permanent Fixes" },
  "/sla-management": { title: "SLA / OLA Targets", subtitle: "Manage External SLA and Internal OLA Agreement Targets" },
  "/sla-breaches": { title: "SLA Breach Tracker", subtitle: "Real-time SLA Compliance Monitoring" },
  "/service-health": { title: "Service Health Monitor", subtitle: "Agreed vs Actual — Live Service Compliance Dashboard" },
  "/capacity-management": { title: "Capacity Management", subtitle: "ITIL Capacity & Performance — Utilisation Trends & AI Forecasting" },
  "/csi-register": { title: "CSI Register", subtitle: "Continual Service Improvement — PDCA Pipeline" },
  "/financial-management": { title: "Financial Management", subtitle: "ITIL 4 — Budget Governance & IT Service Cost Modelling" },
  "/supplier-management": { title: "Supplier Management", subtitle: "ITIL 4 — Vendor Contracts, SLA Performance & Risk" },
  "/deployment-management": { title: "Deployment Management", subtitle: "ITIL 4 Technical Management — Release Pipeline Health & Velocity" },
  "/relationship-management": { title: "Relationship Management", subtitle: "ITIL 4 — Stakeholder Satisfaction & Service Reviews" },
  "/releases": { title: "Release Management", subtitle: "Release Pipeline with Go-Live Approval Gates" },
  "/patch-management": { title: "Patch Management", subtitle: "AI-Driven CVE Registry · Prioritization · Deployment Pipeline" },
  "/terminal": { title: "Asset Terminal", subtitle: "Remote Terminal — Probe-Dispatched Command Execution" },
  "/autonomous-validation": { title: "Autonomous Validation", subtitle: "Virtual Lab Integration · Probe Deployment · Protocol Validation" },
  "/config-management": { title: "Configuration Management", subtitle: "AI-Driven ITIL Config Audit · RFC Generation · Automated Remediation" },
  "/catalog": { title: "Platform Catalog", subtitle: "Activate Modules · Customize Your Sidebar" },
  "/security/threat-intelligence":    { title: "Threat Intelligence",       subtitle: "MITRE ATT&CK · IOC Management · Threat Actor Tracking" },
  "/security/vulnerability-management":{ title: "Vulnerability Management",  subtitle: "CVE Lifecycle · CVSS Risk Scoring · SLA-Driven Remediation" },
  "/security/pentest-management":     { title: "Penetration Testing",        subtitle: "Multi-Environment Engagements · Findings · Remediation Tracking" },
  "/security/patch-management":       { title: "Patch & Remediation",        subtitle: "AI-Prioritized Patch Pipeline · CVE-Linked · Change-Controlled" },
  "/security/config-management":      { title: "Configuration Audit",        subtitle: "ITIL Config Audit · RFC Generation · Drift Remediation" },
  "/security/log-aggregation":        { title: "Log Aggregation",            subtitle: "Log Ingestion · Connectors · Retention · AI Anomaly Analysis" },
  "/security/cspm":                   { title: "Cloud Security Posture",     subtitle: "AWS · Azure · GCP · CIS Benchmarks · Misconfiguration Detection" },
  "/security/edr":                    { title: "Endpoint Security (EDR)",    subtitle: "EDR Posture · Alert Triage · Quarantine · Telemetry" },
  "/security/soc":                    { title: "SOC Operations",             subtitle: "Alert Queue · Threat Hunting · Playbook Execution · MTTR" },
  "/security/siem":                   { title: "SIEM — Event Management",    subtitle: "ITIL Event Classification · Correlation Rules · Log Sources · AI Analysis" },
  "/security/incidents":              { title: "Security Incidents",         subtitle: "ITIL IR Lifecycle · Containment · Eradication · PIR" },
  "/security/iam":                    { title: "IAM Governance",             subtitle: "Access Reviews · Privilege Audit · PAM · Orphan Detection" },
  "/security/compliance":             { title: "Compliance Frameworks",      subtitle: "NIST · ISO 27001 · CIS Controls · SOC 2 · DORA" },
  "/security/risk-register":          { title: "Security Risk Register",     subtitle: "ITIL Risk Lifecycle · Treatment Plans · Residual Risk Tracking" },
  "/security/data-protection":        { title: "Data Protection & DLP",      subtitle: "Classification · Encryption · DLP Policy · Breach Readiness" },
  "/security/awareness":              { title: "Security Awareness",         subtitle: "Training · Phishing Simulation · Human Risk Score" },
  "/security/integrations":           { title: "Security Integrations",      subtitle: "CrowdStrike · Splunk · AWS Security Hub · Okta · ServiceNow · and more" },
  "/security/forensics":              { title: "Forensics Investigation",     subtitle: "Digital · Physical · HR & Insider · Financial Fraud · Legal & eDiscovery" },
  "/ai-governance":                   { title: "AI Observability & Governance", subtitle: "Audit Log · Hallucination Detection · Prompt Injection · Human Review Gates" },
  "/ai-knowledge-base":               { title: "AI Knowledge Base", subtitle: "PGVector Semantic RAG · Document Ingest · Chunk & Embed · Grounded AI Responses" },
  "/ai-providers":                    { title: "AI Providers", subtitle: "Free LLM Priority Chain · Ollama · Gemini · Grok · Groq · Mistral · OpenRouter" },
  "/conclave":                        { title: "Holocron Conclave", subtitle: "Multi-Agent Adversarial Deliberation · Consensus · Execute · Evaluate" },
  "/user-manual":                     { title: "User Manual", subtitle: "Platform Reference Guide · All Modules · AI Features · Configuration" },
  "/use-cases/flyguys":               { title: "Flyguys Platform", subtitle: "Use-Cases Factory · Requests · Bidding · Projects · Operators · Fleet · Transactions" },
};

function getPageTitle(path: string) {
  if (PAGE_TITLES[path]) return PAGE_TITLES[path];
  if (path.startsWith("/infrastructure/agent-dashboard")) return { title: "Agent Dashboard", subtitle: "Performance & Insights" };
  for (const key of Object.keys(PAGE_TITLES)) {
    if (path.startsWith(key)) return PAGE_TITLES[key];
  }
  return { title: "HOLOCRON AI", subtitle: "Platform" };
}

function SearchTrigger() {
  const isMac = typeof navigator !== "undefined" && navigator.platform?.includes("Mac");
  return (
    <button
      className="flex items-center gap-2 h-8 px-3 w-full max-w-[240px] rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer group"
      onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }))}
      data-testid="button-command-palette"
      title="Search & Navigate"
    >
      <Search className="h-3.5 w-3.5 text-muted-foreground/60" />
      <span className="text-xs text-muted-foreground/50 flex-1 text-left">Search...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 h-5 rounded border border-border/50 bg-muted/40 text-[10px] text-muted-foreground/50 font-mono">
        {isMac ? "⌘" : "Ctrl+"}K
      </kbd>
    </button>
  );
}

function AuthenticatedLayout() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [showTour, setShowTour] = useState(false);
  const pageInfo = getPageTitle(location);

  useEffect(() => {
    if (user && !user.tourCompleted) {
      setShowTour(true);
    }
  }, [user]);

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 h-svh">
        <header className="flex items-center gap-3 px-3 h-12 border-b border-border/50 shrink-0 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="shrink-0" />

            <div className="h-4 w-px bg-border/50 shrink-0 hidden sm:block" />

            <div className="flex flex-col min-w-0 shrink-0">
              <h1 className="text-sm font-semibold truncate leading-tight" data-testid="text-page-title">
                {pageInfo.title}
              </h1>
              {pageInfo.subtitle && (
                <span className="text-[10px] text-muted-foreground/60 leading-tight hidden sm:block">
                  {pageInfo.subtitle}
                </span>
              )}
            </div>

            <div className="flex-1 flex justify-center px-4">
              <SearchTrigger />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <SetupProgress />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => window.open('/patent-exploration', '_blank')}
                    data-testid="button-patent-exploration"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Patent Exploration</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    data-testid="button-documentation-menu"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => window.open('/user-manual', '_blank')}
                    className="cursor-pointer"
                    data-testid="button-user-manual"
                  >
                    <HelpCircle className="mr-2 h-4 w-4" />
                    User Manual
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => window.open('/documentation', '_blank')}
                    className="cursor-pointer"
                    data-testid="button-technical-docs"
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Technical Documentation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ThemeToggle />
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" data-testid="button-user-avatar">
                      <Avatar className="h-8 w-8">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-xs font-semibold text-primary">
                          {user.displayName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none" data-testid="text-dropdown-user-name">{user.displayName}</p>
                        {user.companyName && (
                          <p className="text-xs leading-none text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {user.companyName}
                          </p>
                        )}
                        {user.email && (
                          <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout.mutate()}
                      disabled={logout.isPending}
                      className="text-red-600 dark:text-red-400 cursor-pointer"
                      data-testid="button-dropdown-logout"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {logout.isPending ? "Signing out..." : "Sign out"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <ProtectedRouter />
          </main>
      </div>
      <CommandPalette />
      <AiAssistantAvatar />
      {showTour && <GuidedTour onComplete={() => setShowTour(false)} />}
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/flyguys-portal" component={FlyguysPortal} />
        <Route path="/" component={LandingPage} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    );
  }

  if (location === "/onboarding") {
    return <Onboarding />;
  }

  if (user && !user.onboardingCompleted) {
    return <Redirect to="/onboarding" />;
  }

  if (location === "/auth" || location === "/") {
    return <Redirect to="/dashboard" />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
