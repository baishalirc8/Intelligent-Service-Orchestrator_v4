import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  Thermometer,
  Gauge,
  Wifi,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Server,
} from "lucide-react";
import type { TelemetryMetric } from "@shared/schema";

const statusColors: Record<string, string> = {
  normal: "text-green-500",
  warning: "text-yellow-500",
  critical: "text-red-500",
};

const statusBg: Record<string, string> = {
  normal: "bg-green-500/15 text-green-600 dark:text-green-400",
  warning: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const metricIcons: Record<string, React.ElementType> = {
  cpu_usage: Cpu,
  memory_usage: HardDrive,
  disk_usage: HardDrive,
  temperature: Thermometer,
  supply_temp: Thermometer,
  return_temp: Thermometer,
  humidity: Activity,
  throughput: Wifi,
  bandwidth: Wifi,
  bandwidth_utilization: Wifi,
  power_draw: Zap,
  power_consumption: Zap,
  load: Gauge,
  active_sessions: Activity,
  active_connections: Activity,
  active_tunnels: Activity,
  concurrent_users: Activity,
  request_rate: Activity,
  response_time: Activity,
  query_latency: Activity,
  error_rate: AlertTriangle,
  port_errors: AlertTriangle,
  uptime: CheckCircle2,
  battery_level: Zap,
  battery_health: Zap,
  battery_runtime: Zap,
};

function MetricCard({ metric }: { metric: TelemetryMetric }) {
  const Icon = metricIcons[metric.metricName] || Gauge;
  const isAlert = metric.status === "warning" || metric.status === "critical";

  return (
    <div
      className={`p-3 rounded-md border ${isAlert ? (metric.status === "critical" ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5") : "border-border"}`}
      data-testid={`metric-${metric.sourceName}-${metric.metricName}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${statusColors[metric.status]}`} />
          <span className="text-xs text-muted-foreground capitalize">{metric.metricName.replace(/_/g, " ")}</span>
        </div>
        {isAlert && (
          <Badge variant="outline" className={`text-[10px] ${statusBg[metric.status]}`}>
            {metric.status}
          </Badge>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-bold">{typeof metric.metricValue === "number" ? (Number.isInteger(metric.metricValue) ? metric.metricValue : metric.metricValue.toFixed(1)) : metric.metricValue}</span>
        <span className="text-xs text-muted-foreground">{metric.unit}</span>
      </div>
    </div>
  );
}

function SourceCard({ sourceName, metrics }: { sourceName: string; metrics: TelemetryMetric[] }) {
  const hasAlerts = metrics.some(m => m.status === "warning" || m.status === "critical");
  const criticalCount = metrics.filter(m => m.status === "critical").length;
  const warningCount = metrics.filter(m => m.status === "warning").length;

  return (
    <Card className={`hover-elevate ${criticalCount > 0 ? "border-red-500/30" : warningCount > 0 ? "border-yellow-500/30" : ""}`} data-testid={`card-source-${sourceName}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            {sourceName}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-600 dark:text-red-400">
                {criticalCount} critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
                {warningCount} warning
              </Badge>
            )}
            {!hasAlerts && (
              <Badge variant="outline" className="text-[10px] bg-green-500/15 text-green-600 dark:text-green-400 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                healthy
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {metrics.map(m => (
            <MetricCard key={m.id} metric={m} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Telemetry() {
  const { data: metrics, isLoading } = useQuery<TelemetryMetric[]>({ queryKey: ["/api/telemetry"] });
  const [filter, setFilter] = useState<string>("all");

  const sourceMap = new Map<string, TelemetryMetric[]>();
  metrics?.forEach(m => {
    const list = sourceMap.get(m.sourceName) || [];
    list.push(m);
    sourceMap.set(m.sourceName, list);
  });

  const sources = [...sourceMap.entries()].sort((a, b) => {
    const aAlert = a[1].some(m => m.status === "critical") ? 2 : a[1].some(m => m.status === "warning") ? 1 : 0;
    const bAlert = b[1].some(m => m.status === "critical") ? 2 : b[1].some(m => m.status === "warning") ? 1 : 0;
    return bAlert - aAlert;
  });

  const totalMetrics = metrics?.length ?? 0;
  const criticalMetrics = metrics?.filter(m => m.status === "critical").length ?? 0;
  const warningMetrics = metrics?.filter(m => m.status === "warning").length ?? 0;

  const filteredSources = filter === "all"
    ? sources
    : filter === "critical"
    ? sources.filter(([, ms]) => ms.some(m => m.status === "critical"))
    : filter === "warning"
    ? sources.filter(([, ms]) => ms.some(m => m.status === "warning"))
    : sources.filter(([, ms]) => ms.every(m => m.status === "normal"));

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Infrastructure Telemetry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time health metrics collected autonomously from all infrastructure assets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1.5">
            <Activity className="h-3 w-3" />
            {totalMetrics} metrics
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            {sources.length} sources
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="hover-elevate cursor-pointer" onClick={() => setFilter("all")} data-testid="filter-all-sources">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{sources.length}</p>
            <p className="text-xs text-muted-foreground">Total Sources</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer border-green-500/20" onClick={() => setFilter("healthy")} data-testid="filter-healthy">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{sources.filter(([, ms]) => ms.every(m => m.status === "normal")).length}</p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer border-yellow-500/20" onClick={() => setFilter("warning")} data-testid="filter-warning">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{warningMetrics}</p>
            <p className="text-xs text-muted-foreground">Warnings</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer border-red-500/20" onClick={() => setFilter("critical")} data-testid="filter-critical">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{criticalMetrics}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredSources.map(([name, ms]) => (
          <SourceCard key={name} sourceName={name} metrics={ms} />
        ))}
      </div>
    </div>
  );
}
