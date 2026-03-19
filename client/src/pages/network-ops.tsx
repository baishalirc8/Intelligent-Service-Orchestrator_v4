import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Router,
  Shield,
  Bot,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server,
  Minus,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Target,
  BarChart3,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ListChecks,
  ShieldAlert,
  Settings,
  RefreshCw,
  Search,
  MonitorSmartphone,
  Radar,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import type { NetworkDevice, DeviceMetric, AgentAlert, AgentKpi, AgentTask, OrgRole, Crew } from "@shared/schema";
import NetworkOpsDiscovery from "./network-ops-discovery";
import NetworkOpsAssets from "./network-ops-assets";
import NetworkOpsAgents from "./network-ops-agents";
import NetworkOpsMobile from "./network-ops-mobile";

const severityColor: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  low: "text-muted-foreground bg-muted/30 border-border/40",
};

const statusColor: Record<string, string> = {
  online: "text-green-400",
  degraded: "text-amber-400",
  warning: "text-amber-400",
  offline: "text-red-400",
};

const statusBg: Record<string, string> = {
  online: "bg-green-500",
  degraded: "bg-amber-500",
  warning: "bg-amber-500",
  offline: "bg-red-500",
};

const taskStatusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  completed: { label: "Completed", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Loader2 },
  pending: { label: "Pending", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Clock },
  scheduled: { label: "Scheduled", color: "text-muted-foreground bg-muted/30 border-border/40", icon: Timer },
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <ArrowUpRight className="h-3 w-3 text-green-400" />;
  if (trend === "down") return <ArrowDownRight className="h-3 w-3 text-blue-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function MetricBar({ value, warning, critical, unit }: { value: number; warning: number | null; critical: number | null; unit: string }) {
  if (warning === null || critical === null) return null;
  const max = critical * 1.2;
  const pct = Math.min((value / max) * 100, 100);
  const wPct = (warning / max) * 100;
  const cPct = (critical / max) * 100;
  const color = value >= critical ? "bg-red-500" : value >= warning ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="relative w-full h-2 rounded-full bg-muted/30 overflow-hidden" data-testid="metric-bar">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      <div className="absolute top-0 h-full w-px bg-amber-500/50" style={{ left: `${wPct}%` }} />
      <div className="absolute top-0 h-full w-px bg-red-500/50" style={{ left: `${cPct}%` }} />
    </div>
  );
}

const GRID_PAGE_SIZE = 8;
const TABLE_PAGE_SIZE = 12;

function NetworkOpsDashboard() {
  const { toast } = useToast();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<"all" | "active" | "false_positive">("all");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [devicePage, setDevicePage] = useState(0);
  const [deviceView, setDeviceView] = useState<"grid" | "table">("grid");
  const [kpiSearch, setKpiSearch] = useState("");
  const [kpiPage, setKpiPage] = useState(0);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskPage, setTaskPage] = useState(0);
  const [alertSearch, setAlertSearch] = useState("");
  const [alertPage, setAlertPage] = useState(0);
  const [taskTab, setTaskTab] = useState("router");

  const { data: devices, isLoading: devicesLoading } = useQuery<NetworkDevice[]>({ queryKey: ["/api/network-devices"] });
  const { data: metrics } = useQuery<DeviceMetric[]>({ queryKey: ["/api/device-metrics"] });
  const { data: alerts } = useQuery<AgentAlert[]>({ queryKey: ["/api/agent-alerts"] });
  const { data: kpis } = useQuery<AgentKpi[]>({ queryKey: ["/api/agent-kpis"] });
  const { data: tasks } = useQuery<AgentTask[]>({ queryKey: ["/api/agent-tasks"] });
  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: crewsList } = useQuery<Crew[]>({ queryKey: ["/api/crews"] });

  const ackMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/agent-alerts/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-alerts"] });
      toast({ title: "Alert updated" });
    },
  });

  const roleMap = useMemo(() => new Map(roles?.map(r => [r.id, r]) ?? []), [roles]);
  const crew = crewsList?.[0];

  const routerAgentRole = useMemo(() =>
    roles?.find(r => r.name === "Senior Network Engineer" && r.department === "Infrastructure & Cloud Operations"),
    [roles]
  );
  const firewallAgentRole = useMemo(() =>
    roles?.find(r => r.name === "Network Security Engineer" && r.department === "Infrastructure & Cloud Operations"),
    [roles]
  );

  const routerTasks = useMemo(() => tasks?.filter(t => t.assignedRoleId === routerAgentRole?.id) ?? [], [tasks, routerAgentRole]);
  const firewallTasks = useMemo(() => tasks?.filter(t => t.assignedRoleId === firewallAgentRole?.id) ?? [], [tasks, firewallAgentRole]);

  const routerKpis = useMemo(() => kpis?.filter(k => k.agentRoleId === routerAgentRole?.id) ?? [], [kpis, routerAgentRole]);
  const firewallKpis = useMemo(() => kpis?.filter(k => k.agentRoleId === firewallAgentRole?.id) ?? [], [kpis, firewallAgentRole]);

  const deviceMetricsMap = useMemo(() => {
    const map = new Map<string, DeviceMetric[]>();
    metrics?.forEach(m => {
      const arr = map.get(m.deviceId) ?? [];
      arr.push(m);
      map.set(m.deviceId, arr);
    });
    return map;
  }, [metrics]);

  const filteredAlerts = useMemo(() => {
    if (!alerts) return [];
    if (alertFilter === "active") return alerts.filter(a => !a.acknowledged && !a.falsePositive);
    if (alertFilter === "false_positive") return alerts.filter(a => a.falsePositive);
    return alerts;
  }, [alerts, alertFilter]);

  const routers = devices?.filter(d => d.type === "router") ?? [];
  const firewalls = devices?.filter(d => d.type === "firewall") ?? [];

  const filteredDevices = useMemo(() => {
    if (!devices) return [];
    return devices.filter(d => {
      const q = deviceSearch.toLowerCase();
      const matchSearch = !q || d.name.toLowerCase().includes(q) || d.ipAddress.toLowerCase().includes(q) || (d.vendor?.toLowerCase().includes(q) ?? false) || (d.model?.toLowerCase().includes(q) ?? false) || (d.location?.toLowerCase().includes(q) ?? false);
      const matchType = deviceTypeFilter === "all" || d.type === deviceTypeFilter || d.status === deviceTypeFilter;
      return matchSearch && matchType;
    });
  }, [devices, deviceSearch, deviceTypeFilter]);

  const pageSize = deviceView === "grid" ? GRID_PAGE_SIZE : TABLE_PAGE_SIZE;
  const deviceTotalPages = Math.max(1, Math.ceil(filteredDevices.length / pageSize));
  const safeDevicePage = Math.min(devicePage, deviceTotalPages - 1);
  const paginatedDevices = filteredDevices.slice(safeDevicePage * pageSize, (safeDevicePage + 1) * pageSize);

  const activeAlerts = alerts?.filter(a => !a.acknowledged && !a.falsePositive).length ?? 0;
  const fpCount = alerts?.filter(a => a.falsePositive).length ?? 0;
  const completedTasks = tasks?.filter(t => t.status === "completed").length ?? 0;
  const inProgressTasks = tasks?.filter(t => t.status === "in_progress").length ?? 0;

  const filteredRouterKpis = useMemo(() => {
    if (!kpiSearch) return routerKpis;
    const q = kpiSearch.toLowerCase();
    return routerKpis.filter(k => k.kpiName.toLowerCase().includes(q));
  }, [routerKpis, kpiSearch]);
  const filteredFirewallKpis = useMemo(() => {
    if (!kpiSearch) return firewallKpis;
    const q = kpiSearch.toLowerCase();
    return firewallKpis.filter(k => k.kpiName.toLowerCase().includes(q));
  }, [firewallKpis, kpiSearch]);
  const kpiTotalRouterPages = Math.max(1, Math.ceil(filteredRouterKpis.length / GRID_PAGE_SIZE));
  const kpiTotalFirewallPages = Math.max(1, Math.ceil(filteredFirewallKpis.length / GRID_PAGE_SIZE));
  const safeKpiPage = Math.min(kpiPage, Math.max(kpiTotalRouterPages, kpiTotalFirewallPages) - 1);
  const paginatedRouterKpis = filteredRouterKpis.slice(safeKpiPage * GRID_PAGE_SIZE, (safeKpiPage + 1) * GRID_PAGE_SIZE);
  const paginatedFirewallKpis = filteredFirewallKpis.slice(safeKpiPage * GRID_PAGE_SIZE, (safeKpiPage + 1) * GRID_PAGE_SIZE);

  const filteredRouterTasks = useMemo(() => {
    let list = routerTasks;
    if (taskSearch) { const q = taskSearch.toLowerCase(); list = list.filter(t => t.description.toLowerCase().includes(q)); }
    if (taskStatusFilter !== "all") list = list.filter(t => t.status === taskStatusFilter);
    return list;
  }, [routerTasks, taskSearch, taskStatusFilter]);
  const filteredFirewallTasks = useMemo(() => {
    let list = firewallTasks;
    if (taskSearch) { const q = taskSearch.toLowerCase(); list = list.filter(t => t.description.toLowerCase().includes(q)); }
    if (taskStatusFilter !== "all") list = list.filter(t => t.status === taskStatusFilter);
    return list;
  }, [firewallTasks, taskSearch, taskStatusFilter]);
  const taskTotalRouterPages = Math.max(1, Math.ceil(filteredRouterTasks.length / TABLE_PAGE_SIZE));
  const taskTotalFirewallPages = Math.max(1, Math.ceil(filteredFirewallTasks.length / TABLE_PAGE_SIZE));
  const safeTaskPage = Math.min(taskPage, Math.max(taskTotalRouterPages, taskTotalFirewallPages) - 1);
  const paginatedRouterTasks = filteredRouterTasks.slice(safeTaskPage * TABLE_PAGE_SIZE, (safeTaskPage + 1) * TABLE_PAGE_SIZE);
  const paginatedFirewallTasks = filteredFirewallTasks.slice(safeTaskPage * TABLE_PAGE_SIZE, (safeTaskPage + 1) * TABLE_PAGE_SIZE);

  const searchedAlerts = useMemo(() => {
    if (!alertSearch) return filteredAlerts;
    const q = alertSearch.toLowerCase();
    return filteredAlerts.filter(a => a.message.toLowerCase().includes(q) || (a.details?.toLowerCase().includes(q) ?? false) || a.type.toLowerCase().includes(q));
  }, [filteredAlerts, alertSearch]);
  const alertTotalPages = Math.max(1, Math.ceil(searchedAlerts.length / TABLE_PAGE_SIZE));
  const safeAlertPage = Math.min(alertPage, alertTotalPages - 1);
  const paginatedAlerts = searchedAlerts.slice(safeAlertPage * TABLE_PAGE_SIZE, (safeAlertPage + 1) * TABLE_PAGE_SIZE);

  if (devicesLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  function AgentStatusCard({ role, taskList, kpiList, deviceCount, deviceType }: {
    role: OrgRole | undefined;
    taskList: AgentTask[];
    kpiList: AgentKpi[];
    deviceCount: number;
    deviceType: string;
  }) {
    if (!role) return null;
    const completed = taskList.filter(t => t.status === "completed").length;
    const inProg = taskList.filter(t => t.status === "in_progress").length;
    const progress = taskList.length > 0 ? Math.round((completed / taskList.length) * 100) : 0;

    return (
      <Card className="overflow-hidden agent-card-hover" data-testid={`agent-card-${deviceType}`}>
        <div className="h-1 bg-gradient-to-r from-primary to-purple-500" />
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-purple-500/10 border border-primary/10">
                {deviceType === "router" ? <Router className="h-5 w-5 text-primary" /> : <Shield className="h-5 w-5 text-primary" />}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 status-dot status-dot-online" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{role.name}</p>
                <Badge className="text-[9px] bg-green-500/10 text-green-400 border-green-500/15 gap-0.5 h-4">
                  <Zap className="h-2 w-2" /> AI Active
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{role.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            <div className="text-center p-2 rounded-lg bg-muted/20">
              <p className="text-lg font-bold">{deviceCount}</p>
              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Devices</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/20">
              <p className="text-lg font-bold">{completed}<span className="text-xs text-muted-foreground">/{taskList.length}</span></p>
              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Tasks Done</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/20">
              <p className="text-lg font-bold text-blue-400">{inProg}</p>
              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Active</p>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground/60">Task Completion</span>
              <span className="text-[10px] font-semibold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  function DeviceCard({ device }: { device: NetworkDevice }) {
    const dMetrics = deviceMetricsMap.get(device.id) ?? [];
    const cpuMetric = dMetrics.find(m => m.metricName === "CPU Utilization");
    const memMetric = dMetrics.find(m => m.metricName === "Memory Usage");
    const deviceAlerts = alerts?.filter(a => a.deviceId === device.id && !a.acknowledged && !a.falsePositive) ?? [];
    const isSelected = selectedDevice === device.id;

    return (
      <Card
        className={`overflow-hidden cursor-pointer transition-all ${isSelected ? "ring-1 ring-primary/50 border-primary/30" : "agent-card-hover"}`}
        onClick={() => setSelectedDevice(isSelected ? null : device.id)}
        data-testid={`device-card-${device.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
      >
        <CardContent className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${device.type === "router" ? "bg-blue-500/10" : "bg-red-500/10"}`}>
                  {device.type === "router" ? <Router className="h-4 w-4 text-blue-400" /> : <Shield className="h-4 w-4 text-red-400" />}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${statusBg[device.status] ?? "bg-gray-500"}`} />
              </div>
              <div>
                <p className="text-xs font-semibold">{device.name}</p>
                <p className="text-[10px] text-muted-foreground/50">{device.vendor} {device.model}</p>
              </div>
            </div>
            {deviceAlerts.length > 0 && (
              <Badge className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/15 gap-0.5 h-4 shrink-0">
                <AlertTriangle className="h-2 w-2" /> {deviceAlerts.length}
              </Badge>
            )}
          </div>

          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/50">IP</span>
              <span className="text-[10px] font-mono">{device.ipAddress}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/50">FW</span>
              <span className="text-[10px] font-mono truncate max-w-[120px]">{device.firmware}</span>
            </div>
            {cpuMetric && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground/50">CPU</span>
                  <span className={`text-[10px] font-semibold ${cpuMetric.status === "warning" ? "text-amber-400" : cpuMetric.status === "critical" ? "text-red-400" : ""}`}>
                    {cpuMetric.value.toFixed(1)}%
                  </span>
                </div>
                <MetricBar value={cpuMetric.value} warning={cpuMetric.thresholdWarning} critical={cpuMetric.thresholdCritical} unit="%" />
              </div>
            )}
            {memMetric && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground/50">MEM</span>
                  <span className="text-[10px] font-semibold">{memMetric.value.toFixed(1)}%</span>
                </div>
                <MetricBar value={memMetric.value} warning={memMetric.thresholdWarning} critical={memMetric.thresholdCritical} unit="%" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground/40">{device.location}</span>
            <span className={`text-[10px] font-semibold ${statusColor[device.status] ?? ""}`}>{device.status}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  function TaskRow({ task }: { task: AgentTask }) {
    const config = taskStatusConfig[task.status] ?? taskStatusConfig.pending;
    const Icon = config.icon;
    return (
      <div className="px-4 py-3 flex items-start gap-3 agent-card-hover" data-testid={`task-row-${task.id}`}>
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${config.color} mt-0.5`}>
          <Icon className={`h-3 w-3 ${task.status === "in_progress" ? "animate-spin" : ""}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-relaxed">{task.description}</p>
          {task.context && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{task.context}</p>}
          {task.output && (
            <div className="mt-1.5 p-2 rounded-md bg-green-500/5 border border-green-500/10">
              <p className="text-[10px] text-green-400/80 leading-relaxed">{task.output}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className={`text-[9px] h-4 ${task.priority === "critical" ? "border-red-500/30 text-red-400" : task.priority === "high" ? "border-amber-500/30 text-amber-400" : "border-border/40 text-muted-foreground/60"}`}>
            {task.priority}
          </Badge>
          <Badge className={`text-[9px] h-4 border ${config.color}`}>{config.label}</Badge>
        </div>
      </div>
    );
  }

  function KpiCard({ kpi }: { kpi: AgentKpi }) {
    const progress = Math.min((kpi.currentValue / kpi.targetValue) * 100, 120);
    const onTarget = kpi.unit === "%" ? kpi.currentValue >= kpi.targetValue * 0.95 :
      kpi.kpiName.includes("Time") || kpi.kpiName.includes("False") || kpi.kpiName.includes("Convergence")
        ? kpi.currentValue <= kpi.targetValue : kpi.currentValue >= kpi.targetValue * 0.8;

    return (
      <div className="p-3 rounded-lg border bg-card/50 agent-card-hover" data-testid={`kpi-${kpi.kpiName.toLowerCase().replace(/\s+/g, "-")}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{kpi.kpiName}</p>
          <TrendIcon trend={kpi.trend} />
        </div>
        <div className="flex items-end gap-1">
          <span className={`text-xl font-bold ${onTarget ? "text-green-400" : "text-amber-400"}`}>
            {kpi.currentValue % 1 === 0 ? kpi.currentValue : kpi.currentValue.toFixed(1)}
          </span>
          <span className="text-[10px] text-muted-foreground/50 mb-0.5">{kpi.unit}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-muted-foreground/40">Target: {kpi.targetValue}{kpi.unit}</span>
          <span className="text-[9px] text-muted-foreground/40">{kpi.period}</span>
        </div>
        <Progress value={Math.min(progress, 100)} className={`h-1 mt-1.5 ${onTarget ? "[&>div]:bg-green-500" : "[&>div]:bg-amber-500"}`} />
      </div>
    );
  }

  function AlertRow({ alert }: { alert: AgentAlert }) {
    const deviceName = devices?.find(d => d.id === alert.deviceId)?.name ?? "Unknown";
    return (
      <div className={`px-4 py-3 flex items-start gap-3 ${alert.falsePositive ? "opacity-50" : ""}`} data-testid={`alert-row-${alert.id}`}>
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${severityColor[alert.severity]} mt-0.5`}>
          {alert.severity === "critical" ? <ShieldAlert className="h-3 w-3" /> :
            alert.type === "config_drift" ? <Settings className="h-3 w-3" /> :
              alert.type === "maintenance_due" ? <RefreshCw className="h-3 w-3" /> :
                <AlertTriangle className="h-3 w-3" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[9px] h-4 border-border/30">{deviceName}</Badge>
            <Badge variant="outline" className="text-[9px] h-4 border-border/30">{alert.type.replace(/_/g, " ")}</Badge>
            {alert.falsePositive && (
              <Badge className="text-[9px] h-4 bg-purple-500/10 text-purple-400 border-purple-500/15">False Positive</Badge>
            )}
          </div>
          <p className="text-xs mt-1 leading-relaxed">{alert.message}</p>
          {alert.details && <p className="text-[10px] text-muted-foreground/50 mt-1 leading-relaxed">{alert.details}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!alert.acknowledged && !alert.falsePositive && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-50 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); ackMutation.mutate({ id: alert.id, updates: { acknowledged: true } }); }}
                data-testid={`ack-alert-${alert.id}`}
              >
                <Eye className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-50 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); ackMutation.mutate({ id: alert.id, updates: { falsePositive: true, acknowledged: true } }); }}
                data-testid={`fp-alert-${alert.id}`}
              >
                <EyeOff className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-network-ops-title">
              <span className="gradient-text">Network Operations Center</span>
            </h1>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {crew ? `Crew: ${crew.name}` : "AI-powered network monitoring and management"} — {devices?.length ?? 0} devices under autonomous management
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeAlerts > 0 && (
              <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/15 gap-1" data-testid="badge-active-alerts">
                <Bell className="h-3 w-3" /> {activeAlerts} active alert{activeAlerts !== 1 ? "s" : ""}
              </Badge>
            )}
            {fpCount > 0 && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground/50 gap-1" data-testid="badge-fp-count">
                <EyeOff className="h-3 w-3" /> {fpCount} false positive{fpCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-devices-managed">
            <div className="absolute top-0 right-0 w-14 h-14 opacity-[0.04] pointer-events-none"><Server className="w-full h-full" /></div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Devices Managed</p>
            <p className="text-2xl font-bold mt-1">{devices?.length ?? 0}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{routers.length} routers • {firewalls.length} firewalls</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-primary/40" />
          </div>
          <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-tasks-progress">
            <div className="absolute top-0 right-0 w-14 h-14 opacity-[0.04] pointer-events-none"><ListChecks className="w-full h-full" /></div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Tasks Progress</p>
            <p className="text-2xl font-bold mt-1">{completedTasks}<span className="text-sm text-muted-foreground">/{tasks?.length ?? 0}</span></p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{inProgressTasks} in progress</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-green-500 to-green-500/40" />
          </div>
          <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-alerts">
            <div className="absolute top-0 right-0 w-14 h-14 opacity-[0.04] pointer-events-none"><Bell className="w-full h-full" /></div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Active Alerts</p>
            <p className={`text-2xl font-bold mt-1 ${activeAlerts > 0 ? "text-amber-400" : "text-green-400"}`}>{activeAlerts}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{fpCount} marked as false positive</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-amber-500/40" />
          </div>
          <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-ai-agents">
            <div className="absolute top-0 right-0 w-14 h-14 opacity-[0.04] pointer-events-none"><Bot className="w-full h-full" /></div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">AI Agents Active</p>
            <p className="text-2xl font-bold mt-1 text-primary">2</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Router + Firewall management</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-purple-500/40" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgentStatusCard role={routerAgentRole} taskList={routerTasks} kpiList={routerKpis} deviceCount={routers.length} deviceType="router" />
          <AgentStatusCard role={firewallAgentRole} taskList={firewallTasks} kpiList={firewallKpis} deviceCount={firewalls.length} deviceType="firewall" />
        </div>

        <Card data-testid="device-fleet-panel">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                Device Fleet
                <span className="text-[10px] font-normal text-muted-foreground/50">({filteredDevices.length})</span>
              </CardTitle>
              <div className="flex items-center gap-1">
                {selectedDevice && (
                  <Button variant="ghost" size="sm" className="text-[10px] h-5" onClick={() => setSelectedDevice(null)} data-testid="button-clear-device-selection">
                    Clear Selection
                  </Button>
                )}
                <div className="flex items-center rounded-md border border-border/40 p-0.5">
                  <Button variant={deviceView === "grid" ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={() => { setDeviceView("grid"); setDevicePage(0); }} data-testid="button-device-view-grid">
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant={deviceView === "table" ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={() => { setDeviceView("table"); setDevicePage(0); }} data-testid="button-device-view-table">
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="Search by name, IP, vendor, model, location..."
                  value={deviceSearch}
                  onChange={e => { setDeviceSearch(e.target.value); setDevicePage(0); }}
                  className="pl-8 h-8 text-xs bg-background/50"
                  data-testid="input-device-search"
                />
              </div>
              <Select value={deviceTypeFilter} onValueChange={v => { setDeviceTypeFilter(v); setDevicePage(0); }}>
                <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-device-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="router">Routers</SelectItem>
                  <SelectItem value="firewall">Firewalls</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="degraded">Degraded</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {deviceView === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {paginatedDevices.map(device => <DeviceCard key={device.id} device={device} />)}
              </div>
            ) : (
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_100px_140px_120px_80px_80px] gap-0 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider bg-muted/20 px-3 py-2 border-b border-border/30">
                  <span className="pr-2" />
                  <span>Name</span>
                  <span>Type</span>
                  <span>IP Address</span>
                  <span>Vendor / Model</span>
                  <span>CPU</span>
                  <span>Status</span>
                </div>
                {paginatedDevices.map(device => {
                  const dMetrics = deviceMetricsMap.get(device.id) ?? [];
                  const cpuMetric = dMetrics.find(m => m.metricName === "CPU Utilization");
                  const deviceAlerts = alerts?.filter(a => a.deviceId === device.id && !a.acknowledged && !a.falsePositive) ?? [];
                  const isSelected = selectedDevice === device.id;
                  return (
                    <div
                      key={device.id}
                      className={`grid grid-cols-[auto_1fr_100px_140px_120px_80px_80px] gap-0 items-center px-3 py-2 cursor-pointer transition-colors border-b border-border/20 last:border-b-0 ${isSelected ? "bg-primary/5 border-primary/20" : "hover:bg-muted/30"}`}
                      onClick={() => setSelectedDevice(isSelected ? null : device.id)}
                      data-testid={`device-row-${device.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                    >
                      <div className="pr-2.5 flex items-center">
                        <div className="relative">
                          <div className={`flex h-6 w-6 items-center justify-center rounded ${device.type === "router" ? "bg-blue-500/10" : "bg-red-500/10"}`}>
                            {device.type === "router" ? <Router className="h-3 w-3 text-blue-400" /> : <Shield className="h-3 w-3 text-red-400" />}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${statusBg[device.status] ?? "bg-gray-500"}`} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-semibold truncate">{device.name}</span>
                        {deviceAlerts.length > 0 && (
                          <Badge className="text-[8px] bg-amber-500/10 text-amber-400 border-amber-500/15 gap-0.5 h-3.5 shrink-0 px-1">
                            <AlertTriangle className="h-2 w-2" /> {deviceAlerts.length}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 capitalize">{device.type}</span>
                      <span className="text-[10px] font-mono">{device.ipAddress}</span>
                      <span className="text-[10px] text-muted-foreground/60 truncate">{device.vendor} {device.model?.split(" ")[0]}</span>
                      <span className={`text-[10px] font-semibold ${cpuMetric?.status === "warning" ? "text-amber-400" : cpuMetric?.status === "critical" ? "text-red-400" : ""}`}>
                        {cpuMetric ? `${cpuMetric.value.toFixed(1)}%` : "—"}
                      </span>
                      <span className={`text-[10px] font-semibold capitalize ${statusColor[device.status] ?? ""}`}>{device.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {filteredDevices.length > pageSize && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                <span className="text-[10px] text-muted-foreground/50">
                  Showing {safeDevicePage * pageSize + 1}–{Math.min((safeDevicePage + 1) * pageSize, filteredDevices.length)} of {filteredDevices.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={safeDevicePage === 0} onClick={() => setDevicePage(safeDevicePage - 1)} data-testid="button-device-prev-page">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground/60 min-w-[60px] text-center">
                    Page {safeDevicePage + 1} of {deviceTotalPages}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={safeDevicePage >= deviceTotalPages - 1} onClick={() => setDevicePage(safeDevicePage + 1)} data-testid="button-device-next-page">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedDevice && (
          <Card data-testid="device-metrics-panel">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Device Metrics — {devices?.find(d => d.id === selectedDevice)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(deviceMetricsMap.get(selectedDevice) ?? []).map(m => (
                  <div key={m.id} className="p-3 rounded-lg border bg-card/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{m.metricName}</span>
                      <Badge variant="outline" className={`text-[9px] h-4 ${m.status === "warning" ? "text-amber-400 border-amber-500/30" : m.status === "critical" ? "text-red-400 border-red-500/30" : "text-muted-foreground/50 border-border/30"}`}>
                        {m.status}
                      </Badge>
                    </div>
                    <div className="flex items-end gap-1 mt-1">
                      <span className={`text-lg font-bold ${m.status === "warning" ? "text-amber-400" : m.status === "critical" ? "text-red-400" : ""}`}>
                        {m.value % 1 === 0 ? m.value : m.value.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 mb-0.5">{m.unit}</span>
                    </div>
                    {m.thresholdWarning !== null && m.thresholdCritical !== null && (
                      <>
                        <MetricBar value={m.value} warning={m.thresholdWarning} critical={m.thresholdCritical} unit={m.unit} />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] text-amber-400/50">warn: {m.thresholdWarning}{m.unit}</span>
                          <span className="text-[9px] text-red-400/50">crit: {m.thresholdCritical}{m.unit}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="kpi-panel">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Agent KPIs
                <span className="text-[10px] font-normal text-muted-foreground/50">({routerKpis.length + firewallKpis.length})</span>
              </CardTitle>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search KPIs..."
                value={kpiSearch}
                onChange={e => { setKpiSearch(e.target.value); setKpiPage(0); }}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-kpi-search"
              />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Router className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-semibold">Router Agent</span>
                  <span className="text-[10px] text-muted-foreground/50">({filteredRouterKpis.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {paginatedRouterKpis.map(kpi => <KpiCard key={kpi.id} kpi={kpi} />)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs font-semibold">Firewall Agent</span>
                  <span className="text-[10px] text-muted-foreground/50">({filteredFirewallKpis.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {paginatedFirewallKpis.map(kpi => <KpiCard key={kpi.id} kpi={kpi} />)}
                </div>
              </div>
            </div>
            {(filteredRouterKpis.length > GRID_PAGE_SIZE || filteredFirewallKpis.length > GRID_PAGE_SIZE) && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                <span className="text-[10px] text-muted-foreground/50">
                  Page {safeKpiPage + 1} of {Math.max(kpiTotalRouterPages, kpiTotalFirewallPages)}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={safeKpiPage === 0} onClick={() => setKpiPage(safeKpiPage - 1)} data-testid="button-kpi-prev-page">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={safeKpiPage >= Math.max(kpiTotalRouterPages, kpiTotalFirewallPages) - 1} onClick={() => setKpiPage(safeKpiPage + 1)} data-testid="button-kpi-next-page">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="tasks-panel">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                Agent Tasks
                <span className="text-[10px] font-normal text-muted-foreground/50">({routerTasks.length + firewallTasks.length})</span>
              </CardTitle>
              <div className="flex items-center rounded-md border border-border/40 p-0.5">
                <Button variant={taskTab === "router" ? "secondary" : "ghost"} size="sm" className="text-[10px] h-6 px-2 gap-1" onClick={() => { setTaskTab("router"); setTaskPage(0); }} data-testid="tab-router-tasks">
                  <Router className="h-3 w-3" /> Router ({filteredRouterTasks.length})
                </Button>
                <Button variant={taskTab === "firewall" ? "secondary" : "ghost"} size="sm" className="text-[10px] h-6 px-2 gap-1" onClick={() => { setTaskTab("firewall"); setTaskPage(0); }} data-testid="tab-firewall-tasks">
                  <Shield className="h-3 w-3" /> Firewall ({filteredFirewallTasks.length})
                </Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="Search tasks..."
                  value={taskSearch}
                  onChange={e => { setTaskSearch(e.target.value); setTaskPage(0); }}
                  className="pl-8 h-8 text-xs bg-background/50"
                  data-testid="input-task-search"
                />
              </div>
              <Select value={taskStatusFilter} onValueChange={v => { setTaskStatusFilter(v); setTaskPage(0); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-task-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {(taskTab === "router" ? paginatedRouterTasks : paginatedFirewallTasks).map(task => <TaskRow key={task.id} task={task} />)}
              {(taskTab === "router" ? filteredRouterTasks : filteredFirewallTasks).length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground/50">No tasks matching filter</div>
              )}
            </div>
            {(() => {
              const activeTasks = taskTab === "router" ? filteredRouterTasks : filteredFirewallTasks;
              const activeTotal = taskTab === "router" ? taskTotalRouterPages : taskTotalFirewallPages;
              return activeTasks.length > TABLE_PAGE_SIZE ? (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground/50">
                    Showing {safeTaskPage * TABLE_PAGE_SIZE + 1}–{Math.min((safeTaskPage + 1) * TABLE_PAGE_SIZE, activeTasks.length)} of {activeTasks.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={safeTaskPage === 0} onClick={() => setTaskPage(safeTaskPage - 1)} data-testid="button-task-prev-page">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground/60 min-w-[60px] text-center">
                      Page {safeTaskPage + 1} of {activeTotal}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={safeTaskPage >= activeTotal - 1} onClick={() => setTaskPage(safeTaskPage + 1)} data-testid="button-task-next-page">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null;
            })()}
          </CardContent>
        </Card>

        <Card data-testid="alerts-panel">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400" />
                Alert Feed
                <span className="text-[10px] font-normal text-muted-foreground/50">({searchedAlerts.length})</span>
              </CardTitle>
              <div className="flex items-center gap-1">
                {(["all", "active", "false_positive"] as const).map(f => (
                  <Button
                    key={f}
                    size="sm"
                    variant={alertFilter === f ? "secondary" : "ghost"}
                    className="text-[10px] h-6 px-2"
                    onClick={() => { setAlertFilter(f); setAlertPage(0); }}
                    data-testid={`filter-alert-${f}`}
                  >
                    {f === "all" ? "All" : f === "active" ? "Active" : "False Positives"}
                    <Badge variant="outline" className="text-[9px] ml-1 h-3.5 px-1 border-border/30">
                      {f === "all" ? alerts?.length ?? 0 : f === "active" ? activeAlerts : fpCount}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search alerts..."
                value={alertSearch}
                onChange={e => { setAlertSearch(e.target.value); setAlertPage(0); }}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-alert-search"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {paginatedAlerts.map(alert => <AlertRow key={alert.id} alert={alert} />)}
              {searchedAlerts.length === 0 && (
                <div className="p-8 text-center">
                  <BellOff className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground/50">No alerts matching filter</p>
                </div>
              )}
            </div>
            {searchedAlerts.length > TABLE_PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
                <span className="text-[10px] text-muted-foreground/50">
                  Showing {safeAlertPage * TABLE_PAGE_SIZE + 1}–{Math.min((safeAlertPage + 1) * TABLE_PAGE_SIZE, searchedAlerts.length)} of {searchedAlerts.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={safeAlertPage === 0} onClick={() => setAlertPage(safeAlertPage - 1)} data-testid="button-alert-prev-page">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground/60 min-w-[60px] text-center">
                    Page {safeAlertPage + 1} of {alertTotalPages}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={safeAlertPage >= alertTotalPages - 1} onClick={() => setAlertPage(safeAlertPage + 1)} data-testid="button-alert-next-page">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

const subNavItems = [
  { label: "Dashboard", path: "/network-ops", icon: BarChart3 },
  { label: "Discovery", path: "/network-ops/discovery", icon: Radar },
  { label: "Assets", path: "/network-ops/assets", icon: MonitorSmartphone },
  { label: "Agent View", path: "/network-ops/agents", icon: Bot },
];

export default function NetworkOps() {
  const [location] = useLocation();

  const currentPath = location || "/network-ops";
  const activeTab = subNavItems.find(item =>
    item.path === "/network-ops" ? currentPath === "/network-ops" : currentPath.startsWith(item.path)
  )?.path || "/network-ops";

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/40 bg-background/95 backdrop-blur px-6 pt-4 pb-0">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Search className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight" data-testid="text-network-ops-title">
              <span className="gradient-text">Network Operations</span>
            </h1>
          </div>
        </div>
        <div className="flex gap-1" data-testid="network-ops-tabs">
          {subNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <button
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-all ${
                    isActive
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                  data-testid={`tab-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {currentPath === "/network-ops" && <NetworkOpsDashboard />}
        {currentPath === "/network-ops/discovery" && <NetworkOpsDiscovery />}
        {currentPath === "/network-ops/assets" && <NetworkOpsAssets />}
        {currentPath === "/network-ops/agents" && <NetworkOpsAgents />}
      </div>
    </div>
  );
}
