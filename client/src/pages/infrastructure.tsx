import { useLocation, Link } from "wouter";
import {
  Settings,
  Radar,
  MonitorSmartphone,
  AlertTriangle,
  Server,
  AppWindow,
  Gauge,
  Activity,
  Layers,
  CalendarDays,
  CircuitBoard,
  Smartphone,
} from "lucide-react";
import InfrastructureCockpit from "./infrastructure-cockpit";
import InfrastructureConfigure from "./infrastructure-configure";
import InfrastructureDiscovery from "./infrastructure-discovery";
import NetworkOpsAssets from "./network-ops-assets";
import InfrastructureEvents from "./infrastructure-events";
import InfrastructureApplications from "./infrastructure-applications";
import InfrastructurePerformance from "./infrastructure-performance";
import ServiceCatalogMetrics from "./service-catalog-metrics";
import AgentCalendar from "./agent-calendar";
import ProbeTaxonomy from "./probe-taxonomy";
import NetworkOpsMobile from "./network-ops-mobile";

type NavItem = { label: string; path: string; icon: typeof Layers };

const navGroups: { group: string | null; items: NavItem[] }[] = [
  {
    group: null,
    items: [
      { label: "Cockpit", path: "/infrastructure/cockpit", icon: Layers },
    ],
  },
  {
    group: "Configuration",
    items: [
      { label: "Configure", path: "/infrastructure/configure", icon: Settings },
      { label: "Discovery", path: "/infrastructure/discovery", icon: Radar },
      { label: "Taxonomy", path: "/infrastructure/taxonomy", icon: CircuitBoard },
      { label: "Metrics", path: "/infrastructure/service-metrics", icon: Activity },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Assets", path: "/infrastructure/assets", icon: MonitorSmartphone },
      { label: "Mobile", path: "/infrastructure/mobile", icon: Smartphone },
      { label: "Events", path: "/infrastructure/events", icon: AlertTriangle },
      { label: "Apps", path: "/infrastructure/applications", icon: AppWindow },
    ],
  },
  {
    group: "Analytics",
    items: [
      { label: "Performance", path: "/infrastructure/performance", icon: Gauge },
      { label: "Calendar", path: "/infrastructure/calendar", icon: CalendarDays },
    ],
  },
];

const allNavItems = navGroups.flatMap(g => g.items);

function matchPath(fullPath: string, segment: string): boolean {
  return fullPath.startsWith(`/infrastructure/${segment}`) || fullPath.startsWith(`/${segment}`);
}

export default function Infrastructure() {
  const [location] = useLocation();

  const fullPath = location || "/infrastructure";
  const isBaseRoute = fullPath === "/infrastructure" || fullPath === "/";
  const activeTab = isBaseRoute ? "/infrastructure/cockpit" :
    allNavItems.find(item => fullPath.startsWith(item.path) || fullPath.startsWith(item.path.replace("/infrastructure", "")))?.path || "/infrastructure/cockpit";

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/40 bg-background/95 backdrop-blur px-6 pt-4 pb-0">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight" data-testid="text-infrastructure-title">
              <span className="gradient-text">Proactive Autonomous Infrastructure Management</span>
            </h1>
          </div>
        </div>
        <div className="flex items-end gap-0 overflow-x-auto scrollbar-hide" data-testid="infrastructure-tabs">
          {navGroups.map((section, gi) => (
            <div key={section.group ?? "root"} className="flex items-end">
              {gi > 0 && (
                <div className="flex flex-col items-center self-stretch justify-center px-2">
                  <div className="h-full w-px bg-border/30" />
                </div>
              )}
              <div className="flex flex-col">
                {section.group && (
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-semibold px-1 mb-0.5">
                    {section.group}
                  </span>
                )}
                <div className="flex gap-0.5">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <button
                          className={`flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-t-md border-b-2 transition-all whitespace-nowrap ${
                            isActive
                              ? "border-primary text-primary bg-primary/5"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          }`}
                          data-testid={`tab-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <Icon className="h-3 w-3" />
                          {item.label}
                        </button>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {(isBaseRoute || matchPath(fullPath, "cockpit")) && <InfrastructureCockpit />}
        {matchPath(fullPath, "configure") && <InfrastructureConfigure />}
        {matchPath(fullPath, "discovery") && <InfrastructureDiscovery />}
        {matchPath(fullPath, "assets") && <NetworkOpsAssets />}
        {matchPath(fullPath, "mobile") && <NetworkOpsMobile />}
        {matchPath(fullPath, "events") && <InfrastructureEvents />}
        {matchPath(fullPath, "applications") && <InfrastructureApplications />}
        {matchPath(fullPath, "performance") && <InfrastructurePerformance />}
        {matchPath(fullPath, "taxonomy") && <ProbeTaxonomy />}
        {matchPath(fullPath, "service-metrics") && <ServiceCatalogMetrics />}
        {matchPath(fullPath, "calendar") && <AgentCalendar />}
      </div>
    </div>
  );
}
