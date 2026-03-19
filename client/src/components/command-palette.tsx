import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  CreditCard,
  Layers,
  Settings,
  Radar,
  MonitorSmartphone,
  AlertTriangle,
  Activity,
  AppWindow,
  Gauge,
  CalendarDays,
  BarChart3,
  Terminal,
  MessageSquare,
  Sparkles,
  Server,
  Brain,
  Zap,
  Search,
  ShieldAlert,
  Bug,
  GitPullRequest,
  Headphones,
  Trophy,
  PhoneCall,
  GitBranch,
  ListTodo,
} from "lucide-react";

interface CommandAction {
  id: string;
  label: string;
  description: string;
  icon: typeof Users;
  action: () => void;
  keywords: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const navigate = useCallback(
    (path: string) => {
      setLocation(path);
      setOpen(false);
    },
    [setLocation]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const navigationItems: CommandAction[] = [
    { id: "nav-dashboard", label: "Crews & Agents", description: "Organization dashboard", icon: Users, action: () => navigate("/dashboard"), keywords: ["org", "crews", "agents", "dashboard", "home"] },
    { id: "nav-subscriptions", label: "Active Agents", description: "Manage agent subscriptions", icon: CreditCard, action: () => navigate("/subscriptions"), keywords: ["subscriptions", "active", "agents", "billing"] },
    { id: "nav-cockpit", label: "Cockpit", description: "Infrastructure overview", icon: Layers, action: () => navigate("/infrastructure/cockpit"), keywords: ["cockpit", "overview", "infrastructure", "status"] },
    { id: "nav-configure", label: "Configure", description: "Configure probes and agents", icon: Settings, action: () => navigate("/infrastructure/configure"), keywords: ["configure", "probes", "setup", "deploy"] },
    { id: "nav-discovery", label: "Discovery", description: "Network discovery", icon: Radar, action: () => navigate("/infrastructure/discovery"), keywords: ["discovery", "scan", "network", "find"] },
    { id: "nav-assets", label: "Asset Management", description: "Manage discovered assets", icon: MonitorSmartphone, action: () => navigate("/infrastructure/assets"), keywords: ["assets", "devices", "inventory", "cmdb"] },
    { id: "nav-events", label: "Event Management", description: "View and manage events", icon: AlertTriangle, action: () => navigate("/infrastructure/events"), keywords: ["events", "alerts", "notifications", "incidents"] },
    { id: "nav-service-metrics", label: "Service Metrics", description: "Monitor service performance", icon: Activity, action: () => navigate("/infrastructure/service-metrics"), keywords: ["metrics", "service", "monitoring", "kpi"] },
    { id: "nav-applications", label: "Application Monitor", description: "Monitor applications", icon: AppWindow, action: () => navigate("/infrastructure/applications"), keywords: ["applications", "apps", "monitor", "apm"] },
    { id: "nav-performance", label: "Performance", description: "Performance analytics", icon: Gauge, action: () => navigate("/infrastructure/performance"), keywords: ["performance", "analytics", "speed", "latency"] },
    { id: "nav-calendar", label: "Activity Calendar", description: "Scheduled activities", icon: CalendarDays, action: () => navigate("/infrastructure/calendar"), keywords: ["calendar", "schedule", "activities", "maintenance"] },
    { id: "nav-recommendations", label: "Recommendations", description: "AI-powered recommendations", icon: Sparkles, action: () => navigate("/recommendations"), keywords: ["recommendations", "suggestions", "ai", "insights"] },
  ];

  const agentItems: CommandAction[] = [
    { id: "nav-incidents", label: "Incident Management", description: "ITIL incident lifecycle", icon: ShieldAlert, action: () => navigate("/incidents"), keywords: ["incidents", "itil", "outage", "sev", "severity", "resolve"] },
    { id: "nav-problems", label: "Problem Management", description: "Root cause analysis", icon: Bug, action: () => navigate("/problems"), keywords: ["problems", "root cause", "known error", "investigate", "itil"] },
    { id: "nav-changes", label: "Change Management", description: "ITIL change control", icon: GitPullRequest, action: () => navigate("/changes"), keywords: ["changes", "change request", "approval", "itil", "risk", "cab"] },
    { id: "nav-service-requests", label: "Service Requests", description: "Service request fulfillment", icon: Headphones, action: () => navigate("/service-requests"), keywords: ["service", "requests", "fulfillment", "sla", "itil"] },
    { id: "agent-matrix", label: "Agent Matrix", description: "View all AI agents", icon: BarChart3, action: () => navigate("/agent-matrix"), keywords: ["matrix", "agents", "ai", "overview", "grid"] },
    { id: "agent-console", label: "Ops Console", description: "Agent operations console", icon: Terminal, action: () => navigate("/agent-console"), keywords: ["console", "ops", "operations", "terminal"] },
    { id: "agent-chat", label: "Agent Chat", description: "Chat with AI agents", icon: MessageSquare, action: () => navigate("/agent-chat"), keywords: ["chat", "talk", "ask", "ai", "conversation"] },
    { id: "nav-leaderboard", label: "Leaderboard", description: "Agent performance rankings", icon: Trophy, action: () => navigate("/leaderboard"), keywords: ["leaderboard", "ranking", "xp", "gamification", "trophy", "score", "competition"] },
    { id: "nav-on-call-roster", label: "On-Call Roster", description: "Personnel availability and shifts", icon: PhoneCall, action: () => navigate("/on-call-roster"), keywords: ["roster", "on-call", "availability", "shift", "personnel", "human", "schedule"] },
    { id: "nav-workflows", label: "Workflows", description: "Orchestration pipelines with committee approval gates", icon: GitBranch, action: () => navigate("/workflows"), keywords: ["workflow", "orchestration", "pipeline", "committee", "approval", "gate", "cab"] },
    { id: "nav-tasks", label: "Tasks", description: "Agent task assignments and tracking", icon: ListTodo, action: () => navigate("/tasks"), keywords: ["task", "assignment", "agent", "tracking", "work", "todo"] },
  ];

  const actionItems: CommandAction[] = [
    { id: "action-deploy-probe", label: "Deploy a Probe", description: "Configure and deploy a new probe", icon: Server, action: () => navigate("/infrastructure/configure"), keywords: ["deploy", "probe", "create", "new", "install"] },
    { id: "action-generate-insights", label: "Generate Insights", description: "Run AI analysis on metrics", icon: Brain, action: () => navigate("/recommendations"), keywords: ["generate", "insights", "analyze", "ai", "intelligence"] },
    { id: "action-run-discovery", label: "Run Discovery Scan", description: "Start a network discovery scan", icon: Radar, action: () => navigate("/infrastructure/discovery"), keywords: ["scan", "discover", "network", "run"] },
    { id: "action-view-alerts", label: "View Active Alerts", description: "Check unacknowledged alerts", icon: Zap, action: () => navigate("/infrastructure/events"), keywords: ["alerts", "active", "critical", "warnings"] },
    { id: "action-search-assets", label: "Search Assets", description: "Find devices and assets", icon: Search, action: () => navigate("/infrastructure/assets"), keywords: ["search", "find", "assets", "devices", "lookup"] },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a command or search..."
        data-testid="input-command-search"
      />
      <CommandList data-testid="list-command-results">
        <CommandEmpty data-testid="text-command-empty">No results found.</CommandEmpty>

        <CommandGroup heading="Navigation" data-testid="group-command-navigation">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords.join(" ")}`}
              onSelect={item.action}
              data-testid={`command-item-${item.id}`}
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Agents" data-testid="group-command-agents">
          {agentItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords.join(" ")}`}
              onSelect={item.action}
              data-testid={`command-item-${item.id}`}
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions" data-testid="group-command-actions">
          {actionItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords.join(" ")}`}
              onSelect={item.action}
              data-testid={`command-item-${item.id}`}
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
