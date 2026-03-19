import { useMemo, useState } from "react";
import { useQuery, useIsFetching } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Cpu, Server, Gauge,
  AlertTriangle, Eye, Layers, Network, Wifi, Router,
  Monitor, Brain, TrendingUp, ShieldAlert,
  Lightbulb, CheckCircle2, XCircle, BarChart3,
  Bot, ArrowUpRight, ThermometerSun, AppWindow,
  Bell, Wrench, Sparkles, CalendarDays, ChevronLeft,
  ChevronRight, ChevronDown, ChevronUp, Clock,
  Activity, Radio, ExternalLink, HardDrive, Search,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DiscoveredAsset, AgentAlert, MonitoredApplication,
  AgentMetricProfile, AgentOperationalInsights,
  OrgRole, RoleSubscription, AgentScheduledActivity,
  DiscoveryProbe,
} from "@shared/schema";

type InsightItem = {
  title: string;
  description: string;
  severity?: string;
  frequency?: string;
  impact?: string;
  category?: string;
};

const typeIcons: Record<string, typeof Server> = {
  switch: Network, router: Router, access_point: Wifi, firewall: Shield, gateway: Shield,
  server: Server, iot_sensor: ThermometerSun, meter: Gauge, hvac: Monitor, plc: Cpu, camera: Eye,
};

interface CategorySummary {
  key: string;
  label: string;
  icon: typeof Server;
  color: string;
  bgColor: string;
  borderColor: string;
  types: string[];
  total: number;
  online: number;
  offline: number;
  degraded: number;
  alerts: number;
  healthPct: number;
}

const categoryDefs: Omit<CategorySummary, "total" | "online" | "offline" | "degraded" | "alerts" | "healthPct">[] = [
  { key: "network", label: "Network", icon: Network, color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20", types: ["switch", "access_point", "router"] },
  { key: "security", label: "Security", icon: Shield, color: "text-red-400", bgColor: "bg-red-500/10", borderColor: "border-red-500/20", types: ["firewall", "gateway"] },
  { key: "servers", label: "Compute", icon: Server, color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20", types: ["server"] },
  { key: "iot", label: "IoT / OT", icon: ThermometerSun, color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20", types: ["iot_sensor", "meter", "hvac", "plc", "camera"] },
];

function RadialGauge({ value, max, size = 90, strokeWidth = 7, color, bgColor, children }: {
  value: number; max: number; size?: number; strokeWidth?: number; color: string; bgColor?: string; children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/15" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        {children}
      </div>
    </div>
  );
}

function MiniBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-muted/15 overflow-hidden flex-1">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-blue-500", info: "bg-gray-400",
  };
  return <div className={`h-2 w-2 rounded-full shrink-0 ${colors[severity] || colors.info}`} />;
}

const MINI_WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const activityTypeColors: Record<string, string> = {
  predictive: "#3b82f6",
  preventive: "#10b981",
  prescriptive: "#f59e0b",
  maintenance: "#06b6d4",
};

const activityTypeConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof TrendingUp }> = {
  predictive: { label: "Predictive", color: "text-blue-400", bgColor: "bg-blue-500/15", icon: TrendingUp },
  preventive: { label: "Preventive", color: "text-emerald-400", bgColor: "bg-emerald-500/15", icon: ShieldAlert },
  prescriptive: { label: "Prescriptive", color: "text-amber-400", bgColor: "bg-amber-500/15", icon: Lightbulb },
  maintenance: { label: "Maintenance", color: "text-cyan-400", bgColor: "bg-cyan-500/15", icon: Wrench },
};

function getMiniMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), inMonth: true });
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), inMonth: false });
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function CockpitMiniCalendar({ activities, roles, expanded, onToggleExpanded, currentMonth, onMonthChange, onNavigateToCalendar }: {
  activities: AgentScheduledActivity[];
  roles: OrgRole[];
  expanded: boolean;
  onToggleExpanded: () => void;
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
  onNavigateToCalendar: () => void;
}) {
  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const days = getMiniMonthDays(year, month);

  const activityDateMap = useMemo(() => {
    const map = new Map<string, AgentScheduledActivity[]>();
    for (const a of activities) {
      const d = new Date(a.scheduledDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [activities]);

  const upcomingActivities = useMemo(() => {
    return activities
      .filter(a => {
        const d = new Date(a.scheduledDate);
        return d >= today && a.status !== "completed" && a.status !== "skipped";
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, expanded ? 10 : 4);
  }, [activities, expanded]);

  const statusCounts = useMemo(() => {
    const counts = { scheduled: 0, approved: 0, pending: 0, completed: 0 };
    for (const a of activities) {
      if (a.status === "scheduled") counts.scheduled++;
      else if (a.status === "approved") counts.approved++;
      else if (a.status === "pending_approval") counts.pending++;
      else if (a.status === "completed") counts.completed++;
    }
    return counts;
  }, [activities]);

  return (
    <div data-testid="cockpit-mini-calendar">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          <CalendarDays className="h-3.5 w-3.5 text-indigo-400" />
        </div>
        <h2 className="text-sm font-semibold">Activity Calendar</h2>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-indigo-400 border-indigo-500/30">{activities.length}</Badge>
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-indigo-400"
              onClick={onNavigateToCalendar}
              data-testid="button-open-full-calendar"
            >
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open full calendar</TooltipContent>
        </Tooltip>
      </div>
      <Card className="overflow-hidden border-indigo-500/15">
        <div className="h-[2px] bg-gradient-to-r from-indigo-500/60 via-purple-400/40 to-transparent" />
        <CardContent className="p-3 space-y-3">

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onMonthChange(new Date(year, month - 1, 1))} data-testid="mini-cal-prev">
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-[10px] font-semibold" data-testid="mini-cal-month">{monthName}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onMonthChange(new Date(year, month + 1, 1))} data-testid="mini-cal-next">
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px">
            {MINI_WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center">
                <span className="text-[7px] text-muted-foreground/60 uppercase font-medium">{d}</span>
              </div>
            ))}
            {days.map((day, idx) => {
              const key = `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`;
              const dayActivities = activityDateMap.get(key) || [];
              const isToday = isSameDay(day.date, today);
              const typeSet = new Set(dayActivities.map(a => a.activityType));

              return (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <div className={`relative flex flex-col items-center py-0.5 rounded cursor-default transition-all ${
                      !day.inMonth ? "opacity-20" : ""
                    } ${isToday ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
                      <span className={`text-[8px] leading-tight ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                        {day.date.getDate()}
                      </span>
                      {dayActivities.length > 0 && (
                        <div className="flex gap-px mt-px">
                          {Array.from(typeSet).slice(0, 3).map((type, i) => (
                            <div
                              key={i}
                              className="h-1 w-1 rounded-full"
                              style={{ backgroundColor: activityTypeColors[type] || "#6366f1" }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  {dayActivities.length > 0 && (
                    <TooltipContent side="left" className="max-w-[180px]">
                      <p className="text-[10px] font-semibold mb-0.5">{dayActivities.length} activit{dayActivities.length === 1 ? "y" : "ies"}</p>
                      {dayActivities.slice(0, 3).map((a, i) => (
                        <p key={i} className="text-[9px] text-muted-foreground truncate">{a.title}</p>
                      ))}
                      {dayActivities.length > 3 && <p className="text-[8px] text-muted-foreground">+{dayActivities.length - 3} more</p>}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { label: "Queued", count: statusCounts.scheduled, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Pending", count: statusCounts.pending, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Approved", count: statusCounts.approved, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Done", count: statusCounts.completed, color: "text-green-400", bg: "bg-green-500/10" },
            ].map(s => (
              <div key={s.label} className={`text-center py-1.5 rounded-md ${s.bg}`}>
                <div className={`text-[11px] font-bold ${s.color}`}>{s.count}</div>
                <div className="text-[6px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {upcomingActivities.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Upcoming</span>
              </div>
              <div className="space-y-1">
                {upcomingActivities.map(activity => {
                  const tc = activityTypeConfig[activity.activityType] || activityTypeConfig.maintenance;
                  const role = roles.find(r => r.id === activity.roleId);
                  const d = new Date(activity.scheduledDate);
                  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/5 border border-border/15 hover:border-indigo-500/20 hover:bg-indigo-500/5 transition-all"
                      data-testid={`mini-cal-activity-${activity.id}`}
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: activityTypeColors[activity.activityType] || "#6366f1" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-medium truncate">{activity.title}</p>
                        <div className="flex items-center gap-1.5">
                          {role && <span className="text-[7px]" style={{ color: role.color }}>{role.title.split(" ").slice(0, 2).join(" ")}</span>}
                          <span className="text-[7px] text-muted-foreground">{dateStr}</span>
                        </div>
                      </div>
                      <span className={`text-[7px] px-1 py-0.5 rounded ${tc.bgColor} ${tc.color}`}>{tc.label.slice(0, 4)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-[9px] h-6 text-muted-foreground hover:text-foreground"
              onClick={onToggleExpanded}
              data-testid="button-toggle-calendar-expand"
            >
              {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {expanded ? "Show less" : "Show more"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[9px] h-6 text-indigo-400 hover:text-indigo-300"
              onClick={onNavigateToCalendar}
              data-testid="button-view-full-calendar"
            >
              Full Calendar
              <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function InfrastructureCockpit() {
  const [, setLocation] = useLocation();
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());
  const [probeSearch, setProbeSearch] = useState("");
  const [probeHealthFilter, setProbeHealthFilter] = useState("all");
  const [probePage, setProbePage] = useState(0);
  const [appSearch, setAppSearch] = useState("");
  const [appCritFilter, setAppCritFilter] = useState("all");
  const [appPage, setAppPage] = useState(0);

  const { data: assets = [], isLoading: assetsLoading } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });
  const { data: alerts = [], isLoading: alertsLoading } = useQuery<AgentAlert[]>({ queryKey: ["/api/agent-alerts"] });
  const { data: applications = [], isLoading: appsLoading } = useQuery<MonitoredApplication[]>({ queryKey: ["/api/monitored-applications"] });
  const { data: roles = [] } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<RoleSubscription[]>({ queryKey: ["/api/role-subscriptions"] });
  const { data: profiles = [] } = useQuery<AgentMetricProfile[]>({ queryKey: ["/api/agent-metric-profiles"] });
  const { data: allInsights = [] } = useQuery<AgentOperationalInsights[]>({ queryKey: ["/api/agent-operational-insights/all"] });
  const { data: scheduledActivities = [] } = useQuery<AgentScheduledActivity[]>({ queryKey: ["/api/agent-scheduled-activities"] });
  const { data: probes = [] } = useQuery<DiscoveryProbe[]>({ queryKey: ["/api/discovery-probes"] });

  const filteredProbes = useMemo(() => {
    return probes.filter(p => {
      const q = probeSearch.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.ipAddress?.toLowerCase().includes(q) ?? false) || p.protocol.toLowerCase().includes(q) || (p.hostname?.toLowerCase().includes(q) ?? false);
      const matchFilter = probeHealthFilter === "all" || p.healthStatus === probeHealthFilter || (probeHealthFilter === "enrolled" && p.enrolled) || (probeHealthFilter === "pending" && !p.enrolled);
      return matchSearch && matchFilter;
    });
  }, [probes, probeSearch, probeHealthFilter]);

  const probeTotalPages = Math.max(1, Math.ceil(filteredProbes.length / PAGE_SIZE));
  const safeProbePage = Math.min(probePage, probeTotalPages - 1);
  const paginatedProbes = filteredProbes.slice(safeProbePage * PAGE_SIZE, (safeProbePage + 1) * PAGE_SIZE);

  const coreDataLoading = assetsLoading || alertsLoading || appsLoading || subsLoading;

  const computed = useMemo(() => {
    const onlineAssets = assets.filter(a => a.status === "online");
    const offlineAssets = assets.filter(a => a.status === "offline");
    const degradedAssets = assets.filter(a => a.status === "degraded" || a.status === "warning");

    const unackedAlerts = alerts.filter(a => !a.acknowledged);
    const criticalAlerts = unackedAlerts.filter(a => a.severity === "critical" || a.severity === "high");
    const mediumAlerts = unackedAlerts.filter(a => a.severity === "medium");
    const lowAlerts = unackedAlerts.filter(a => a.severity === "low" || a.severity === "info");

    const activeSubscriptions = subscriptions.filter(s => s.status === "active");
    const aiShadowCount = activeSubscriptions.filter(s => s.hasAiShadow).length;

    const overallHealthPct = assets.length > 0 ? Math.round((onlineAssets.length / assets.length) * 100) : 100;
    const healthColor = overallHealthPct >= 80 ? "#22c55e" : overallHealthPct >= 50 ? "#f59e0b" : "#ef4444";

    const categories: CategorySummary[] = categoryDefs.map(cd => {
      const catAssets = assets.filter(a => cd.types.includes(a.type));
      const catOnline = catAssets.filter(a => a.status === "online").length;
      const catOffline = catAssets.filter(a => a.status === "offline").length;
      const catDegraded = catAssets.filter(a => a.status === "degraded" || a.status === "warning").length;
      const catAlertDeviceIds = new Set(catAssets.map(a => a.id));
      const catAlerts = unackedAlerts.filter(a => a.deviceId && catAlertDeviceIds.has(a.deviceId)).length;
      return {
        ...cd,
        total: catAssets.length,
        online: catOnline,
        offline: catOffline,
        degraded: catDegraded,
        alerts: catAlerts,
        healthPct: catAssets.length > 0 ? Math.round((catOnline / catAssets.length) * 100) : 100,
      };
    });

    const runningApps = applications.filter(a => a.status === "running" || a.status === "healthy");
    const stoppedApps = applications.filter(a => a.status === "stopped" || a.status === "offline");
    const degradedApps = applications.filter(a => a.status === "degraded" || a.status === "warning" || a.status === "critical");

    const roleMap = new Map(roles.map(r => [r.id, r]));
    const roleProfileCounts = new Map<string, number>();
    for (const p of profiles) {
      roleProfileCounts.set(p.roleId, (roleProfileCounts.get(p.roleId) || 0) + 1);
    }

    const agentCoverage = activeSubscriptions
      .filter(s => s.hasAiShadow)
      .map(s => {
        const role = roleMap.get(s.roleId);
        return role ? {
          role,
          metricCount: roleProfileCounts.get(role.id) || 0,
          hasInsights: allInsights.some(i => i.roleId === role.id),
        } : null;
      })
      .filter(Boolean) as { role: OrgRole; metricCount: number; hasInsights: boolean }[];

    const aggregatedInsights: { type: string; items: InsightItem[]; icon: typeof Activity; color: string; bgColor: string; label: string }[] = [];
    const allPredictive: InsightItem[] = [];
    const allPreventive: InsightItem[] = [];
    const allPrescriptive: InsightItem[] = [];
    for (const ins of allInsights) {
      allPredictive.push(...((ins.predictiveMeasures || []) as InsightItem[]));
      allPreventive.push(...((ins.preventiveMeasures || []) as InsightItem[]));
      allPrescriptive.push(...((ins.prescriptiveMeasures || []) as InsightItem[]));
    }
    if (allPredictive.length > 0) aggregatedInsights.push({ type: "predictive", items: allPredictive, icon: TrendingUp, color: "text-blue-400", bgColor: "bg-blue-500/10", label: "Predictive" });
    if (allPreventive.length > 0) aggregatedInsights.push({ type: "preventive", items: allPreventive, icon: ShieldAlert, color: "text-emerald-400", bgColor: "bg-emerald-500/10", label: "Preventive" });
    if (allPrescriptive.length > 0) aggregatedInsights.push({ type: "prescriptive", items: allPrescriptive, icon: Lightbulb, color: "text-amber-400", bgColor: "bg-amber-500/10", label: "Prescriptive" });

    const criticalApps = [...applications]
      .sort((a, b) => {
        const critOrder: Record<string, number> = { "mission-critical": 0, critical: 1, important: 2, utility: 3 };
        return (critOrder[a.criticality || "utility"] || 3) - (critOrder[b.criticality || "utility"] || 3);
      });

    return {
      onlineAssets, offlineAssets, degradedAssets,
      unackedAlerts, criticalAlerts, mediumAlerts, lowAlerts,
      activeSubscriptions, aiShadowCount,
      overallHealthPct, healthColor,
      categories, runningApps, stoppedApps, degradedApps,
      agentCoverage, aggregatedInsights, criticalApps,
    };
  }, [assets, alerts, applications, roles, subscriptions, profiles, allInsights]);

  const filteredApps = useMemo(() => {
    return computed.criticalApps.filter(app => {
      const q = appSearch.toLowerCase();
      const matchSearch = !q || app.name.toLowerCase().includes(q) || (app.criticality?.toLowerCase().includes(q) ?? false);
      const matchFilter = appCritFilter === "all" || app.criticality === appCritFilter;
      return matchSearch && matchFilter;
    });
  }, [computed.criticalApps, appSearch, appCritFilter]);

  const appTotalPages = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const safeAppPage = Math.min(appPage, appTotalPages - 1);
  const paginatedApps = filteredApps.slice(safeAppPage * PAGE_SIZE, (safeAppPage + 1) * PAGE_SIZE);

  if (coreDataLoading) {
    return (
      <div className="p-6 space-y-4 max-w-[1500px] mx-auto" data-testid="cockpit-loading">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-64 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-[1500px] mx-auto">

        <div className="relative overflow-hidden" data-testid="cockpit-header">
          <div className="absolute inset-0 opacity-[0.04]" style={{ background: "radial-gradient(ellipse at 20% 50%, #6366f1, transparent 60%), radial-gradient(ellipse at 80% 50%, #06b6d4, transparent 60%)" }} />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          <div className="px-6 pt-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold gradient-text" data-testid="text-cockpit-title">Infrastructure Cockpit</h1>
                    <p className="text-[9px] text-muted-foreground">Unified operational overview · Real-time infrastructure intelligence</p>
                  </div>
                </div>
              </div>

              <div className="hidden md:flex items-center shrink-0">
                <RadialGauge value={computed.overallHealthPct} max={100} size={64} strokeWidth={5} color={computed.healthColor}>
                  <span className="text-sm font-bold" style={{ color: computed.healthColor }}>{computed.overallHealthPct}%</span>
                  <span className="text-[6px] text-muted-foreground uppercase tracking-wider">Health</span>
                </RadialGauge>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" data-testid="fleet-overview-strip">
            {[
              { label: "Total Devices", value: assets.length, icon: Server, color: "#6366f1", bgColor: "bg-indigo-500/10", href: "/infrastructure/assets" },
              { label: "Online", value: computed.onlineAssets.length, icon: CheckCircle2, color: "#22c55e", bgColor: "bg-emerald-500/10", href: "/infrastructure/assets" },
              { label: "Offline", value: computed.offlineAssets.length, icon: XCircle, color: "#ef4444", bgColor: "bg-red-500/10", href: "/infrastructure/assets" },
              { label: "Active Alerts", value: computed.unackedAlerts.length, icon: Bell, color: "#f59e0b", bgColor: "bg-amber-500/10", href: "/infrastructure/events" },
              { label: "Applications", value: applications.length, icon: AppWindow, color: "#06b6d4", bgColor: "bg-cyan-500/10", href: "/infrastructure/applications" },
              { label: "AI Agents", value: computed.aiShadowCount, icon: Bot, color: "#a855f7", bgColor: "bg-purple-500/10", href: "/agent-matrix" },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.label}
                  className="agent-card-hover overflow-hidden cursor-pointer group"
                  data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setLocation(stat.href)}
                >
                  <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${stat.color}60, transparent)` }} />
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${stat.bgColor}`}>
                        <Icon className="h-3.5 w-3.5" style={{ color: stat.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-bold leading-tight" style={{ color: stat.color }}>{stat.value}</div>
                        <div className="text-[7px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                      </div>
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div data-testid="infrastructure-health-matrix">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-3 w-3 text-primary" />
              </div>
              <h2 className="text-xs font-semibold">Infrastructure Health Matrix</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {computed.categories.map(cat => {
                const Icon = cat.icon;
                const hColor = cat.healthPct >= 80 ? "#22c55e" : cat.healthPct >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <Card key={cat.key} className={`overflow-hidden border ${cat.borderColor} agent-card-hover cursor-pointer group`} data-testid={`health-category-${cat.key}`} onClick={() => setLocation("/infrastructure/assets")}>
                    <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${hColor}60, transparent)` }} />
                    <CardContent className="p-2.5">
                      <div className="flex items-start gap-2">
                        <RadialGauge value={cat.healthPct} max={100} size={40} strokeWidth={3.5} color={hColor}>
                          <span className="text-[9px] font-bold" style={{ color: hColor }}>{cat.healthPct}%</span>
                        </RadialGauge>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <Icon className={`h-3 w-3 ${cat.color}`} />
                            <span className="text-[10px] font-semibold truncate">{cat.label}</span>
                            <Badge variant="outline" className="text-[6px] px-1 py-0 h-3 ml-auto">{cat.total}</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-0.5 text-center">
                            <div>
                              <div className="text-[8px] font-bold text-emerald-400">{cat.online}</div>
                              <div className="text-[5px] text-muted-foreground uppercase">On</div>
                            </div>
                            <div>
                              <div className="text-[8px] font-bold text-amber-400">{cat.degraded}</div>
                              <div className="text-[5px] text-muted-foreground uppercase">Warn</div>
                            </div>
                            <div>
                              <div className="text-[8px] font-bold text-red-400">{cat.offline}</div>
                              <div className="text-[5px] text-muted-foreground uppercase">Down</div>
                            </div>
                          </div>
                          {cat.alerts > 0 && (
                            <div className="mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="h-2 w-2 text-amber-400" />
                              <span className="text-[7px] text-amber-400 font-medium">{cat.alerts} alert{cat.alerts !== 1 ? "s" : ""}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Card className="overflow-hidden border-cyan-500/20 agent-card-hover cursor-pointer group" data-testid="health-category-applications" onClick={() => setLocation("/infrastructure/applications")}>
                <div className="h-[2px] bg-gradient-to-r from-cyan-500/60 via-cyan-400/40 to-transparent" />
                <CardContent className="p-2.5">
                  <div className="flex items-start gap-2">
                    <RadialGauge value={computed.runningApps.length} max={Math.max(applications.length, 1)} size={40} strokeWidth={3.5} color="#06b6d4">
                      <span className="text-[9px] font-bold text-cyan-400">{applications.length > 0 ? Math.round((computed.runningApps.length / applications.length) * 100) : 100}%</span>
                    </RadialGauge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <AppWindow className="h-3 w-3 text-cyan-400" />
                        <span className="text-[10px] font-semibold">Apps</span>
                        <Badge variant="outline" className="text-[6px] px-1 py-0 h-3 ml-auto">{applications.length}</Badge>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-1 rounded-full bg-emerald-400" />
                          <span className="text-[7px]">{computed.runningApps.length} Running</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-1 rounded-full bg-amber-400" />
                          <span className="text-[7px]">{computed.degradedApps.length} Degraded</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-1 rounded-full bg-red-400" />
                          <span className="text-[7px]">{computed.stoppedApps.length} Stopped</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4" data-testid="alert-summary">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 rounded-md bg-amber-500/10 flex items-center justify-center">
                  <Bell className="h-2.5 w-2.5 text-amber-400" />
                </div>
                <h2 className="text-[10px] font-semibold">Alert Summary</h2>
                <Badge variant="outline" className="text-[7px] px-1 py-0 h-3 text-amber-400 border-amber-500/30">{computed.unackedAlerts.length}</Badge>
              </div>
              <Card className="overflow-hidden border-amber-500/15">
                <div className="h-[2px] bg-gradient-to-r from-amber-500/60 via-amber-400/40 to-transparent" />
                <CardContent className="p-2.5 space-y-2">
                  <div className="flex items-center gap-1 h-2.5 rounded-full overflow-hidden bg-muted/15">
                    {computed.unackedAlerts.length > 0 ? (
                      <>
                        {computed.criticalAlerts.length > 0 && (
                          <div className="h-full bg-red-500 transition-all duration-700" style={{ width: `${(computed.criticalAlerts.length / computed.unackedAlerts.length) * 100}%` }} />
                        )}
                        {computed.mediumAlerts.length > 0 && (
                          <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${(computed.mediumAlerts.length / computed.unackedAlerts.length) * 100}%` }} />
                        )}
                        {computed.lowAlerts.length > 0 && (
                          <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${(computed.lowAlerts.length / computed.unackedAlerts.length) * 100}%` }} />
                        )}
                      </>
                    ) : (
                      <div className="h-full w-full bg-emerald-500/30" />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="px-1 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                      <div className="text-[10px] font-bold text-red-400">{computed.criticalAlerts.length}</div>
                      <div className="text-[6px] text-muted-foreground uppercase">Critical</div>
                    </div>
                    <div className="px-1 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <div className="text-[10px] font-bold text-amber-400">{computed.mediumAlerts.length}</div>
                      <div className="text-[6px] text-muted-foreground uppercase">Medium</div>
                    </div>
                    <div className="px-1 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                      <div className="text-[10px] font-bold text-blue-400">{computed.lowAlerts.length}</div>
                      <div className="text-[6px] text-muted-foreground uppercase">Low</div>
                    </div>
                  </div>

                  {computed.unackedAlerts.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[7px] text-muted-foreground uppercase tracking-wider font-medium">Recent</div>
                      {computed.unackedAlerts.slice(0, 3).map(alert => (
                        <div key={alert.id} className="flex items-start gap-1.5 px-2 py-1 rounded-md bg-muted/5 border border-border/15 hover:border-amber-500/20 hover:bg-amber-500/5 transition-all cursor-pointer" data-testid={`alert-${alert.id}`} onClick={() => setLocation("/infrastructure/events")}>
                          <SeverityDot severity={alert.severity || "medium"} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[8px] font-medium truncate">{alert.message}</p>
                            <p className="text-[6px] text-muted-foreground">{alert.type} · {alert.severity}</p>
                          </div>
                          <ArrowUpRight className="h-2 w-2 text-muted-foreground/30 shrink-0 mt-0.5" />
                        </div>
                      ))}
                    </div>
                  )}

                  {computed.unackedAlerts.length === 0 && (
                    <div className="text-center py-1.5">
                      <CheckCircle2 className="h-4 w-4 mx-auto mb-0.5 text-emerald-400/50" />
                      <p className="text-[8px] text-muted-foreground">All clear</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-4">
              {scheduledActivities.length > 0 ? (
                <CockpitMiniCalendar
                  activities={scheduledActivities}
                  roles={roles}
                  expanded={calendarExpanded}
                  onToggleExpanded={() => setCalendarExpanded(!calendarExpanded)}
                  currentMonth={miniCalMonth}
                  onMonthChange={setMiniCalMonth}
                  onNavigateToCalendar={() => setLocation("/infrastructure/calendar")}
                />
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-5 w-5 rounded-md bg-indigo-500/10 flex items-center justify-center">
                      <CalendarDays className="h-2.5 w-2.5 text-indigo-400" />
                    </div>
                    <h2 className="text-[10px] font-semibold">Activity Calendar</h2>
                  </div>
                  <Card className="overflow-hidden border-indigo-500/15 border-dashed">
                    <CardContent className="py-6 text-center">
                      <CalendarDays className="h-6 w-6 mx-auto mb-1.5 text-indigo-400/20" />
                      <p className="text-[9px] text-muted-foreground">Generate AI insights to populate the calendar</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            <div className="lg:col-span-4" data-testid="ai-agent-coverage">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 rounded-md bg-purple-500/10 flex items-center justify-center">
                  <Bot className="h-2.5 w-2.5 text-purple-400" />
                </div>
                <h2 className="text-[10px] font-semibold">AI Agent Coverage</h2>
                <Badge variant="outline" className="text-[7px] px-1 py-0 h-3 text-purple-400 border-purple-500/30">{computed.agentCoverage.length}</Badge>
                <Button variant="ghost" size="sm" className="ml-auto h-4 px-1.5 text-[7px] text-muted-foreground hover:text-primary" onClick={() => setLocation("/agent-matrix")} data-testid="button-view-agent-matrix">
                  All <ExternalLink className="h-2 w-2 ml-0.5" />
                </Button>
              </div>
              {computed.agentCoverage.length > 0 ? (
                <Card className="overflow-hidden border-purple-500/15">
                  <div className="h-[2px] bg-gradient-to-r from-purple-500/60 via-purple-400/40 to-transparent" />
                  <CardContent className="p-2 space-y-1">
                    {computed.agentCoverage.map(({ role, metricCount, hasInsights }) => (
                      <div
                        key={role.id}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-purple-500/5 transition-all cursor-pointer group"
                        onClick={() => setLocation(`/infrastructure/agent-dashboard/${role.id}`)}
                        data-testid={`agent-coverage-${role.id}`}
                      >
                        <div className="h-5 w-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${role.color}15` }}>
                          <Bot className="h-2.5 w-2.5" style={{ color: role.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[8px] font-semibold block truncate leading-tight">{role.name}</span>
                          <span className="text-[6px] text-muted-foreground block truncate">{role.department}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {metricCount > 0 && (
                            <span className="text-[6px] px-1 rounded bg-primary/10 text-primary font-medium">{metricCount}m</span>
                          )}
                          {hasInsights && (
                            <Sparkles className="h-2 w-2 text-purple-400/60" />
                          )}
                          <ArrowUpRight className="h-2 w-2 text-muted-foreground/0 group-hover:text-purple-400 transition-all" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden border-purple-500/15 border-dashed">
                  <CardContent className="py-3 text-center">
                    <Bot className="h-4 w-4 mx-auto mb-0.5 text-purple-400/20" />
                    <p className="text-[8px] text-muted-foreground">No AI agents active yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {probes.length > 0 && (
            <div data-testid="probes-health">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Radio className="h-3 w-3 text-indigo-400" />
                </div>
                <h2 className="text-xs font-semibold">Discovery Probes</h2>
                <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-3.5 text-indigo-400 border-indigo-500/30">{probes.length}</Badge>
                {(() => {
                  const activeProbes = probes.filter(p => (p as any).lastPayloadSize > 0);
                  return activeProbes.length > 0 ? (
                    <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/15">
                      <HardDrive className="h-2.5 w-2.5 text-indigo-400" />
                      <span className="text-[8px] font-semibold text-indigo-400">{activeProbes.length} active</span>
                      <span className="text-[7px] text-muted-foreground">sending data</span>
                    </div>
                  ) : null;
                })()}
                <Button variant="ghost" size="sm" className="ml-auto h-5 px-2 text-[8px] text-muted-foreground hover:text-primary" onClick={() => setLocation("/infrastructure/configure")} data-testid="button-view-all-probes">
                  View All <ExternalLink className="h-2.5 w-2.5 ml-1" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search probes..."
                    value={probeSearch}
                    onChange={e => { setProbeSearch(e.target.value); setProbePage(0); }}
                    className="h-7 text-[10px] pl-7"
                    data-testid="input-search-cockpit-probes"
                  />
                </div>
                <Select value={probeHealthFilter} onValueChange={v => { setProbeHealthFilter(v); setProbePage(0); }}>
                  <SelectTrigger className="h-7 w-[110px] text-[10px]" data-testid="select-cockpit-probe-filter">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                    <SelectItem value="overloaded">Overloaded</SelectItem>
                    <SelectItem value="enrolled">Enrolled</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filteredProbes.length === 0 && (probeSearch || probeHealthFilter !== "all") && (
                <div className="text-center py-4 text-[10px] text-muted-foreground">No probes match your search or filter.</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {paginatedProbes.map(probe => {
                  const healthColor = probe.healthStatus === "healthy" ? "#22c55e" : probe.healthStatus === "degraded" ? "#f59e0b" : probe.healthStatus === "overloaded" ? "#ef4444" : "#6b7280";
                  const statusColor = probe.status === "scanning" ? "text-blue-400" : probe.status === "completed" ? "text-emerald-400" : probe.status === "error" ? "text-red-400" : "text-muted-foreground";
                  const enrolled = probe.enrolled;
                  const lastHeartbeat = probe.lastHeartbeat ? new Date(probe.lastHeartbeat) : null;
                  const heartbeatAge = lastHeartbeat ? Math.round((Date.now() - lastHeartbeat.getTime()) / 60000) : null;
                  const heartbeatStale = heartbeatAge !== null && heartbeatAge > (probe.heartbeatInterval || 60) / 30;

                  return (
                    <Card
                      key={probe.id}
                      className="overflow-hidden agent-card-hover cursor-pointer group"
                      data-testid={`probe-${probe.id}`}
                      onClick={() => setLocation("/infrastructure/configure")}
                    >
                      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${healthColor}60, transparent)` }} />
                      <CardContent className="p-2.5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-indigo-500/10">
                            <Radio className="h-3 w-3 text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-semibold block truncate">{probe.name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[7px] font-medium capitalize ${statusColor}`}>{probe.status}</span>
                              {enrolled ? (
                                <span className="text-[6px] px-1 py-0 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">Enrolled</span>
                              ) : (
                                <span className="text-[6px] px-1 py-0 rounded-full bg-muted/30 text-muted-foreground font-medium">Pending</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 shrink-0">
                            <div className={`h-2 w-2 rounded-full ${probe.healthStatus === "healthy" ? "bg-emerald-400" : probe.healthStatus === "degraded" ? "bg-amber-400" : probe.healthStatus === "overloaded" ? "bg-red-400" : "bg-muted-foreground/40"}`} />
                            <span className="text-[6px] text-muted-foreground capitalize">{probe.healthStatus || "unknown"}</span>
                          </div>
                          <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all shrink-0" />
                        </div>

                        {(probe.cpuUsage !== null || probe.memoryUsage !== null || probe.diskUsage !== null) && (
                          <div className="space-y-1 mb-1.5">
                            {[
                              { label: "CPU", value: probe.cpuUsage },
                              { label: "MEM", value: probe.memoryUsage },
                              { label: "DSK", value: probe.diskUsage },
                            ].filter(m => m.value !== null && m.value !== undefined).map(m => {
                              const v = m.value as number;
                              const barColor = v >= 90 ? "bg-red-500" : v >= 70 ? "bg-amber-500" : "bg-emerald-500";
                              const textColor = v >= 90 ? "text-red-400" : v >= 70 ? "text-amber-400" : "text-emerald-400";
                              return (
                                <div key={m.label} className="flex items-center gap-1.5">
                                  <span className="text-[7px] text-muted-foreground uppercase w-5">{m.label}</span>
                                  <MiniBar value={v} color={barColor} />
                                  <span className={`text-[9px] font-bold w-7 text-right ${textColor}`}>{Math.round(v)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {(probe as any).lastPayloadSize > 0 && (
                          <div className="flex items-center gap-1.5 mb-1.5 px-1.5 py-1 rounded-md bg-indigo-500/5 border border-indigo-500/10">
                            <HardDrive className="h-2.5 w-2.5 text-indigo-400" />
                            <span className="text-[7px] text-muted-foreground">Last Payload</span>
                            <span className="text-[9px] font-bold text-indigo-400 ml-auto">{formatBytes((probe as any).lastPayloadSize)}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[7px] text-muted-foreground pt-1 border-t border-border/10">
                          <div className="flex items-center gap-1">
                            <Activity className="h-2.5 w-2.5" />
                            <span>{probe.discoveredCount || 0} discovered</span>
                          </div>
                          {lastHeartbeat && (
                            <div className={`flex items-center gap-0.5 ${heartbeatStale ? "text-amber-400" : ""}`}>
                              <Clock className="h-2 w-2" />
                              <span>{heartbeatAge}m ago</span>
                            </div>
                          )}
                          {probe.protocol && (
                            <span className="px-1 py-0 rounded bg-muted/20 font-medium uppercase">{probe.protocol}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {filteredProbes.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[9px] text-muted-foreground">
                    Showing {safeProbePage * PAGE_SIZE + 1}–{Math.min((safeProbePage + 1) * PAGE_SIZE, filteredProbes.length)} of {filteredProbes.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-5 w-5 p-0" disabled={safeProbePage === 0} onClick={() => setProbePage(safeProbePage - 1)} data-testid="button-cockpit-probes-prev">
                      <ChevronLeft className="h-2.5 w-2.5" />
                    </Button>
                    <span className="text-[9px] text-muted-foreground px-1.5">
                      {safeProbePage + 1} / {probeTotalPages}
                    </span>
                    <Button variant="outline" size="sm" className="h-5 w-5 p-0" disabled={safeProbePage >= probeTotalPages - 1} onClick={() => setProbePage(safeProbePage + 1)} data-testid="button-cockpit-probes-next">
                      <ChevronRight className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {computed.criticalApps.length > 0 && (
            <div data-testid="application-health">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <AppWindow className="h-3 w-3 text-cyan-400" />
                </div>
                <h2 className="text-xs font-semibold">Application Health</h2>
                <span className="text-[9px] text-muted-foreground ml-1">by criticality</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search applications..."
                    value={appSearch}
                    onChange={e => { setAppSearch(e.target.value); setAppPage(0); }}
                    className="h-7 text-[10px] pl-7"
                    data-testid="input-search-cockpit-apps"
                  />
                </div>
                <Select value={appCritFilter} onValueChange={v => { setAppCritFilter(v); setAppPage(0); }}>
                  <SelectTrigger className="h-7 w-[130px] text-[10px]" data-testid="select-cockpit-app-filter">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Criticality</SelectItem>
                    <SelectItem value="mission-critical">Mission Critical</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="utility">Utility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filteredApps.length === 0 && (appSearch || appCritFilter !== "all") && (
                <div className="text-center py-4 text-[10px] text-muted-foreground">No applications match your search or filter.</div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {paginatedApps.map(app => {
                  const isRunning = app.status === "running" || app.status === "healthy";
                  const healthColor = (app.healthScore || 0) >= 80 ? "#22c55e" : (app.healthScore || 0) >= 50 ? "#f59e0b" : "#ef4444";
                  const critColors: Record<string, string> = { "mission-critical": "text-red-400", critical: "text-orange-400", important: "text-amber-400", utility: "text-muted-foreground" };
                  return (
                    <Card key={app.id} className="overflow-hidden agent-card-hover cursor-pointer" data-testid={`app-health-${app.id}`} onClick={() => setLocation("/infrastructure/applications")}>
                      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${healthColor}60, transparent)` }} />
                      <CardContent className="p-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={`h-6 w-6 rounded-md flex items-center justify-center ${isRunning ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                            <AppWindow className={`h-3 w-3 ${isRunning ? "text-emerald-400" : "text-red-400"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-semibold block truncate">{app.name}</span>
                            <span className={`text-[7px] font-medium capitalize ${critColors[app.criticality || "utility"]}`}>{app.criticality || "utility"}</span>
                          </div>
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${isRunning ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[7px] text-muted-foreground uppercase">Health</span>
                          <MiniBar value={app.healthScore || 0} color={(app.healthScore || 0) >= 80 ? "bg-emerald-500" : (app.healthScore || 0) >= 50 ? "bg-amber-500" : "bg-red-500"} />
                          <span className="text-[9px] font-bold" style={{ color: healthColor }}>{app.healthScore || 0}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {filteredApps.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[9px] text-muted-foreground">
                    Showing {safeAppPage * PAGE_SIZE + 1}–{Math.min((safeAppPage + 1) * PAGE_SIZE, filteredApps.length)} of {filteredApps.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-5 w-5 p-0" disabled={safeAppPage === 0} onClick={() => setAppPage(safeAppPage - 1)} data-testid="button-cockpit-apps-prev">
                      <ChevronLeft className="h-2.5 w-2.5" />
                    </Button>
                    <span className="text-[9px] text-muted-foreground px-1.5">
                      {safeAppPage + 1} / {appTotalPages}
                    </span>
                    <Button variant="outline" size="sm" className="h-5 w-5 p-0" disabled={safeAppPage >= appTotalPages - 1} onClick={() => setAppPage(safeAppPage + 1)} data-testid="button-cockpit-apps-next">
                      <ChevronRight className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {computed.aggregatedInsights.length > 0 && (
            <div data-testid="observations-recommendations">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Brain className="h-3 w-3 text-purple-400" />
                </div>
                <h2 className="text-xs font-semibold">Observations & Recommendations</h2>
                <span className="text-[9px] text-muted-foreground ml-1">AI-aggregated from all active agents</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {computed.aggregatedInsights.map(group => {
                  const Icon = group.icon;
                  const sortedItems = [...group.items].sort((a, b) => {
                    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                    return (sevOrder[a.severity || "low"] || 3) - (sevOrder[b.severity || "low"] || 3);
                  });

                  return (
                    <Card key={group.type} className={`overflow-hidden border-${group.color.replace("text-", "").split("-").slice(0, 2).join("-")}/20`} data-testid={`insight-group-${group.type}`}>
                      <div className={`px-3 py-2 ${group.bgColor} border-b border-border/15`}>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-background/60 backdrop-blur">
                            <Icon className={`h-3 w-3 ${group.color}`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-[11px] font-semibold">{group.label} Insights</h3>
                            <p className="text-[8px] text-muted-foreground">{sortedItems.length} observation{sortedItems.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-2.5 space-y-1">
                        {sortedItems.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="px-2.5 py-2 rounded-md bg-muted/5 border border-border/15 hover:border-primary/15 hover:bg-primary/5 transition-all cursor-pointer" data-testid={`insight-${group.type}-${idx}`} onClick={() => setLocation("/recommendations")}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-medium">{item.title}</span>
                              {item.severity && (
                                <span className={`text-[7px] px-1 py-0.5 rounded-full font-medium ${
                                  item.severity === "high" || item.severity === "critical" ? "bg-red-500/15 text-red-400" :
                                  item.severity === "medium" ? "bg-amber-500/15 text-amber-400" :
                                  "bg-blue-500/15 text-blue-400"
                                }`}>{item.severity}</span>
                              )}
                            </div>
                            <p className="text-[8px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{item.description}</p>
                          </div>
                        ))}
                        {sortedItems.length > 4 && (
                          <p className="text-[8px] text-muted-foreground text-center pt-0.5">+{sortedItems.length - 4} more</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </ScrollArea>
  );
}
