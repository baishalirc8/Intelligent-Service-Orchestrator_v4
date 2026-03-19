import { useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid,
  ScatterChart, Scatter, ZAxis, Cell,
} from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, Shield, CheckCircle2, Clock, Bell, Bot,
  ThumbsUp, ThumbsDown, MessageSquare, ChevronDown,
  ChevronUp, AlertCircle, Send,
  Server, Eye, EyeOff, BellOff,
  ShieldAlert, Settings, RefreshCw, Target, Minus,
  LayoutGrid, ChevronRight,
  TrendingUp, TrendingDown, Gauge, FlaskConical,
  ArrowRight, Check, X, Loader2, Activity, Workflow,
  Search, Zap, CircleDot, ArrowDown, Wrench, ShieldCheck, Brain, Lightbulb,
} from "lucide-react";
import type { AgentNotification, OrgRole, DiscoveredAsset, AgentAlert, AgentKpi, NetworkDevice, ThresholdCalibration } from "@shared/schema";

const severityConfig: Record<string, { color: string; bg: string; border: string; icon: typeof AlertTriangle; label: string; ring: string }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: AlertCircle, label: "Critical", ring: "ring-red-500/20" },
  high: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: AlertTriangle, label: "High", ring: "ring-orange-500/20" },
  medium: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertTriangle, label: "Medium", ring: "ring-amber-500/20" },
  low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Shield, label: "Low", ring: "ring-blue-500/20" },
  info: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2, label: "Info", ring: "ring-emerald-500/20" },
};

const notifTypeConfig: Record<string, { color: string; label: string }> = {
  issue_detected: { color: "bg-red-500/15 text-red-400 border-red-500/25", label: "Issue Detected" },
  action_proposed: { color: "bg-purple-500/15 text-purple-400 border-purple-500/25", label: "Action Proposed" },
  action_taken: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", label: "Action Taken" },
  status_update: { color: "bg-blue-500/15 text-blue-400 border-blue-500/25", label: "Status Update" },
  escalation: { color: "bg-orange-500/15 text-orange-400 border-orange-500/25", label: "Escalation" },
};

const statusConfig: Record<string, { color: string; label: string; dot: string }> = {
  pending: { color: "bg-amber-500/15 text-amber-400", label: "Pending Review", dot: "bg-amber-400" },
  approved: { color: "bg-emerald-500/15 text-emerald-400", label: "Approved", dot: "bg-emerald-400" },
  rejected: { color: "bg-red-500/15 text-red-400", label: "Rejected", dot: "bg-red-400" },
  auto_executed: { color: "bg-blue-500/15 text-blue-400", label: "Auto-Executed", dot: "bg-blue-400" },
  completed: { color: "bg-emerald-500/15 text-emerald-400", label: "Completed", dot: "bg-emerald-400" },
};

const alertSeverityBorder: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  warning: "border-l-amber-500",
  medium: "border-l-blue-500",
  low: "border-l-muted-foreground/30",
};

const alertSeverityColor: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  low: "text-muted-foreground bg-muted/30 border-border/40",
};

function timeAgo(date: Date | string | null): string {
  if (!date) return "Unknown";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

type ActiveView = "overview" | "alerts" | "notifications" | "kpis" | "calibration" | "timeline";
type AlertDrilldown = "all" | "active" | "critical" | "false_positive" | "acknowledged";
type NotifDrilldown = "all" | "pending" | "critical_high" | "escalation";

function SummaryWidget({
  title, value, subtitle, icon: Icon, accentColor, borderColor, active, onClick, badge, testId,
}: {
  title: string; value: number | string; subtitle: string;
  icon: typeof Bell; accentColor: string; borderColor: string;
  active?: boolean; onClick?: () => void; badge?: string; testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border text-left p-4 transition-all duration-200 w-full group
        ${active
          ? `${borderColor} bg-card ring-1 ${borderColor.replace("border-", "ring-").replace("/30", "/15")} shadow-lg`
          : "border-border/40 bg-card/60 hover:bg-card hover:border-border/60"
        }`}
      data-testid={testId}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${accentColor}`}>{value}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{subtitle}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-primary/10" : "bg-muted/30"} transition-colors`}>
          <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground/40"} transition-colors`} />
        </div>
      </div>
      {badge && (
        <div className="absolute top-2 right-2">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        </div>
      )}
      <div className={`absolute bottom-0 left-0 right-0 h-[2px] transition-opacity ${active ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`}
        style={{ background: `linear-gradient(to right, var(--tw-gradient-from, hsl(var(--primary))), transparent)` }}
      />
      <ChevronRight className={`absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/30 transition-all ${active ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"}`} />
    </button>
  );
}

function AlertDetailPanel({ alert, deviceName, onAck, onFp }: {
  alert: AgentAlert; deviceName: string;
  onAck: () => void; onFp: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sevColor = alertSeverityColor[alert.severity] || alertSeverityColor.medium;
  const borderLeft = alertSeverityBorder[alert.severity] || "border-l-border";

  return (
    <div
      className={`relative border-l-[3px] ${borderLeft} ${alert.falsePositive ? "opacity-50" : ""} ${alert.acknowledged && !alert.falsePositive ? "opacity-70" : ""}`}
      data-testid={`alert-row-${alert.id}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors"
        data-testid={`alert-expand-${alert.id}`}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${sevColor} mt-0.5`}>
            {alert.severity === "critical" ? <ShieldAlert className="h-3.5 w-3.5" /> :
              alert.type === "config_drift" ? <Settings className="h-3.5 w-3.5" /> :
                alert.type === "maintenance_due" ? <RefreshCw className="h-3.5 w-3.5" /> :
                  <AlertTriangle className="h-3.5 w-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[9px] h-4 border-primary/20 bg-primary/5 text-primary/80 font-semibold">{deviceName}</Badge>
              <Badge variant="outline" className="text-[9px] h-4 border-border/30">{alert.type.replace(/_/g, " ")}</Badge>
              {alert.falsePositive && (
                <Badge className="text-[9px] h-4 bg-purple-500/10 text-purple-400 border-purple-500/15">False Positive</Badge>
              )}
              {alert.acknowledged && !alert.falsePositive && (
                <Badge className="text-[9px] h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/15">Acknowledged</Badge>
              )}
            </div>
            <p className="text-sm font-medium mt-1.5 leading-snug">{alert.message}</p>
            {!expanded && alert.details && (
              <p className="text-[11px] text-muted-foreground/50 mt-1 line-clamp-1">{alert.details}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground/40">{timeAgo(alert.createdAt)}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 ml-10 space-y-3">
          {alert.details && (
            <div className="p-3 rounded-lg bg-muted/20 border border-border/20">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1">Details</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{alert.details}</p>
            </div>
          )}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Created: {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "Unknown"}</span>
            {alert.resolvedAt && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Resolved: {new Date(alert.resolvedAt).toLocaleString()}</span>}
          </div>
          {!alert.acknowledged && !alert.falsePositive && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="gap-1.5 text-xs h-7" onClick={(e) => { e.stopPropagation(); onAck(); }} data-testid={`ack-alert-${alert.id}`}>
                <Eye className="h-3 w-3" /> Acknowledge
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={(e) => { e.stopPropagation(); onFp(); }} data-testid={`fp-alert-${alert.id}`}>
                <EyeOff className="h-3 w-3" /> Mark False Positive
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiDetailCard({ kpi, roleName }: { kpi: AgentKpi; roleName: string }) {
  const [expanded, setExpanded] = useState(false);
  const progress = Math.min((kpi.currentValue / kpi.targetValue) * 100, 120);
  const isInverse = kpi.kpiName.includes("Time") || kpi.kpiName.includes("False") || kpi.kpiName.includes("Convergence");
  const onTarget = kpi.unit === "%" ? kpi.currentValue >= kpi.targetValue * 0.95 :
    isInverse ? kpi.currentValue <= kpi.targetValue : kpi.currentValue >= kpi.targetValue * 0.8;
  const pctOfTarget = ((kpi.currentValue / kpi.targetValue) * 100).toFixed(0);
  const variance = ((kpi.currentValue - kpi.targetValue) / kpi.targetValue * 100).toFixed(1);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`text-left w-full p-4 rounded-xl border transition-all duration-200 group
        ${expanded ? "bg-card ring-1 ring-primary/10 border-primary/20" : "bg-card/50 border-border/30 hover:bg-card hover:border-border/50"}`}
      data-testid={`kpi-${kpi.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{kpi.kpiName}</p>
            <TrendIcon trend={kpi.trend} />
          </div>
          <div className="flex items-end gap-2 mt-1.5">
            <span className={`text-2xl font-bold ${onTarget ? "text-green-400" : "text-amber-400"}`}>
              {kpi.currentValue % 1 === 0 ? kpi.currentValue : kpi.currentValue.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground/50 mb-0.5">{kpi.unit}</span>
            <Badge variant="outline" className={`text-[8px] h-4 ml-1 mb-0.5 ${onTarget ? "border-green-500/20 text-green-400" : "border-amber-500/20 text-amber-400"}`}>
              {pctOfTarget}% of target
            </Badge>
          </div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${onTarget ? "bg-green-500/10" : "bg-amber-500/10"} transition-colors`}>
          <Gauge className={`h-4 w-4 ${onTarget ? "text-green-400" : "text-amber-400"}`} />
        </div>
      </div>

      <Progress value={Math.min(progress, 100)} className={`h-1.5 mt-3 ${onTarget ? "[&>div]:bg-green-500" : "[&>div]:bg-amber-500"}`} />

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground/40">Target: {kpi.targetValue}{kpi.unit}</span>
        <span className="text-[10px] text-muted-foreground/40">{kpi.period}</span>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/20 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-md bg-muted/20">
              <p className="text-[9px] text-muted-foreground/50">Variance</p>
              <p className={`text-xs font-semibold ${Number(variance) >= 0 ? "text-green-400" : "text-red-400"}`}>{Number(variance) >= 0 ? "+" : ""}{variance}%</p>
            </div>
            <div className="p-2 rounded-md bg-muted/20">
              <p className="text-[9px] text-muted-foreground/50">Trend</p>
              <p className="text-xs font-semibold capitalize flex items-center gap-1">
                <TrendIcon trend={kpi.trend} /> {kpi.trend === "up" ? "Improving" : kpi.trend === "down" ? "Declining" : "Stable"}
              </p>
            </div>
          </div>
          {roleName && (
            <div className="flex items-center gap-1.5 pt-1">
              <Bot className="h-3 w-3 text-primary/50" />
              <span className="text-[10px] text-muted-foreground/60">Managed by: <span className="text-foreground/70 font-medium">{roleName}</span></span>
            </div>
          )}
        </div>
      )}

      {!expanded && roleName && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/15">
          <Bot className="h-2.5 w-2.5 text-muted-foreground/40" />
          <span className="text-[9px] text-muted-foreground/50">{roleName}</span>
        </div>
      )}
    </button>
  );
}

function generateSimulatedTimeSeries(cal: ThresholdCalibration) {
  const mean = cal.meanValue ?? 50;
  const std = cal.stdDeviation ?? mean * 0.1;
  const normalThresh = cal.calibratedNormal ?? mean + std;
  const warningThresh = cal.calibratedWarning ?? mean + std * 1.5;
  const criticalThresh = cal.calibratedCritical ?? mean + std * 2.5;
  const points = Math.max(cal.dataPointsAnalyzed || 720, 168);
  const displayPoints = Math.min(points, 120);
  const step = Math.max(1, Math.floor(points / displayPoints));
  const data = [];

  const spread = Math.max(criticalThresh - mean, std * 2, 1);

  const seed = cal.id.charCodeAt(0) + cal.id.charCodeAt(1);
  const pseudoRandom = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297) * 49297;
    return x - Math.floor(x);
  };

  for (let i = 0; i < points; i++) {
    const r = pseudoRandom(i);
    const baseNoise = (r - 0.5) * 2 * spread * 0.35;
    const trend = Math.sin(i / (points * 0.15)) * spread * 0.15;
    const dailyCycle = Math.sin((i % 24) / 24 * Math.PI * 2) * spread * 0.1;

    const spikeRoll = pseudoRandom(i + 10000);
    let spike = 0;
    if (spikeRoll < 0.015) {
      spike = (criticalThresh - mean) * (0.9 + pseudoRandom(i + 20000) * 0.3);
    } else if (spikeRoll < 0.06) {
      spike = (warningThresh - mean) * (0.7 + pseudoRandom(i + 30000) * 0.5);
    } else if (spikeRoll < 0.12) {
      spike = (normalThresh - mean) * (0.5 + pseudoRandom(i + 40000) * 0.6);
    }

    let value = mean + baseNoise + trend + dailyCycle + spike;
    value = Math.max(0, value);

    if (i % step === 0) {
      const dayOffset = Math.floor(i / 24);
      const hour = i % 24;
      data.push({
        idx: i,
        time: `Day ${dayOffset + 1}, ${String(hour).padStart(2, "0")}:00`,
        value: parseFloat(value.toFixed(2)),
      });
    }
  }
  return { data, normalThresh, warningThresh, criticalThresh };
}

function ThresholdDistributionChart({ cal }: { cal: ThresholdCalibration }) {
  const result = useMemo(() => generateSimulatedTimeSeries(cal), [cal.id, cal.dataPointsAnalyzed]);
  const { data, normalThresh, warningThresh, criticalThresh } = result;

  const dataValues = data.map(d => d.value);
  const dataMax = Math.max(...dataValues);
  const dataMin = Math.min(...dataValues);
  const chartMax = Math.max(dataMax, criticalThresh) * 1.08;
  const chartMin = Math.max(0, dataMin * 0.92);

  const gradientId = `metricGrad-${cal.id.slice(0, 8)}`;

  return (
    <div className="p-3 rounded-lg bg-muted/10 border border-border/20" data-testid="threshold-distribution-chart">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Threshold Distribution Over Time</p>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500/60" /> Normal</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500/60" /> Warning</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500/60" /> Critical</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-primary/60" /> Metric</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.12} />
          {normalThresh > 0 && (
            <ReferenceArea y1={chartMin} y2={normalThresh} fill="#10b981" fillOpacity={0.05} />
          )}
          {warningThresh > 0 && normalThresh > 0 && (
            <ReferenceArea y1={normalThresh} y2={warningThresh} fill="#f59e0b" fillOpacity={0.06} />
          )}
          {criticalThresh > 0 && warningThresh > 0 && (
            <ReferenceArea y1={warningThresh} y2={chartMax} fill="#ef4444" fillOpacity={0.05} />
          )}
          {normalThresh > 0 && (
            <ReferenceLine y={normalThresh} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1.2} strokeOpacity={0.7} label={{ value: `Normal ${normalThresh.toFixed(1)}`, position: "insideTopRight", fontSize: 9, fill: "#10b981" }} />
          )}
          {warningThresh > 0 && (
            <ReferenceLine y={warningThresh} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.2} strokeOpacity={0.7} label={{ value: `Warning ${warningThresh.toFixed(1)}`, position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }} />
          )}
          {criticalThresh > 0 && (
            <ReferenceLine y={criticalThresh} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.2} strokeOpacity={0.7} label={{ value: `Critical ${criticalThresh.toFixed(1)}`, position: "insideTopRight", fontSize: 9, fill: "#ef4444" }} />
          )}
          {cal.currentWarning != null && (
            <ReferenceLine y={cal.currentWarning} stroke="#f59e0b" strokeDasharray="8 4" strokeWidth={1} strokeOpacity={0.3} label={{ value: "Old Warn", position: "insideBottomRight", fontSize: 8, fill: "#f59e0b60" }} />
          )}
          {cal.currentCritical != null && (
            <ReferenceLine y={cal.currentCritical} stroke="#ef4444" strokeDasharray="8 4" strokeWidth={1} strokeOpacity={0.3} label={{ value: "Old Crit", position: "insideBottomRight", fontSize: 8, fill: "#ef444460" }} />
          )}
          <XAxis
            dataKey="idx"
            tick={false}
            axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.2 }}
            tickLine={false}
          />
          <YAxis
            domain={[chartMin, chartMax]}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fillOpacity: 0.4 }}
            axisLine={false}
            tickLine={false}
            width={42}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "11px",
              padding: "6px 10px",
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "10px" }}
            formatter={(value: number) => [`${value.toFixed(2)} ${cal.unit}`, "Metric Value"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.time || ""}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 1, stroke: "hsl(var(--primary))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-[9px] text-muted-foreground/30">Start of analysis window</span>
        <span className="text-[9px] text-muted-foreground/30">
          <span className="text-muted-foreground/50 font-medium">{cal.dataPointsAnalyzed.toLocaleString()}</span> data points · {Math.round(cal.dataPointsAnalyzed / 24)} days
          <span className="ml-1.5 text-purple-400/50">(AI-selected)</span>
        </span>
      </div>
    </div>
  );
}

interface TimelineEvent {
  id: string;
  timestamp: number;
  deviceName: string;
  deviceId: string;
  deviceIndex: number;
  severity: string;
  type: "alert" | "notification" | "calibration";
  title: string;
  detail: string;
  size: number;
  color: string;
}

interface RCAResult {
  rootCauseEventId: string;
  rootCauseSummary: string;
  rootCauseCategory: string;
  causalChain: {
    order: number;
    eventId: string;
    role: "root_cause" | "propagation" | "symptom" | "side_effect";
    explanation: string;
    delayFromRoot: string;
  }[];
  impactAssessment: {
    severity: string;
    affectedSystems: string[];
    businessImpact: string;
    blastRadius: string;
  };
  remediation: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    preventionRecommendations: string[];
  };
  confidence: number;
  reasoning: string;
  alternativeHypotheses: {
    hypothesis: string;
    confidence: number;
    reason: string;
  }[];
}

const rcaCategoryIcons: Record<string, typeof AlertTriangle> = {
  hardware_failure: Zap,
  software_bug: AlertCircle,
  configuration_error: Settings,
  capacity_exhaustion: TrendingUp,
  network_issue: Activity,
  security_incident: ShieldAlert,
  dependency_failure: Workflow,
  human_error: Eye,
  environmental: Server,
};

const rcaCategoryLabels: Record<string, string> = {
  hardware_failure: "Hardware Failure",
  software_bug: "Software Bug",
  configuration_error: "Configuration Error",
  capacity_exhaustion: "Capacity Exhaustion",
  network_issue: "Network Issue",
  security_incident: "Security Incident",
  dependency_failure: "Dependency Failure",
  human_error: "Human Error",
  environmental: "Environmental",
};

const chainRoleColors: Record<string, { bg: string; text: string; border: string }> = {
  root_cause: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/25" },
  propagation: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/25" },
  symptom: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/25" },
  side_effect: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/25" },
};

const eventTypeColors: Record<string, string> = {
  alert: "#f59e0b",
  notification: "#6366f1",
  calibration: "#a855f7",
};

const severitySizes: Record<string, number> = {
  critical: 280,
  high: 200,
  medium: 140,
  low: 90,
  info: 60,
  warning: 160,
};

const severityColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  warning: "#f59e0b",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#10b981",
};

function EventCorrelationTimeline({
  alerts,
  notifications,
  calibrations,
  deviceMap,
  roleMap,
  assetMap,
}: {
  alerts: AgentAlert[] | undefined;
  notifications: AgentNotification[] | undefined;
  calibrations: ThresholdCalibration[] | undefined;
  deviceMap: Map<string, NetworkDevice>;
  roleMap: Map<string, OrgRole>;
  assetMap: Map<string, DiscoveredAsset>;
}) {
  const [timeRange, setTimeRange] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [rcaResults, setRcaResults] = useState<Map<string, RCAResult>>(new Map());
  const [analyzingCluster, setAnalyzingCluster] = useState<string | null>(null);
  const { toast } = useToast();

  const { events, deviceNames, timeMin, timeMax } = useMemo(() => {
    const allEvents: TimelineEvent[] = [];
    const deviceNameSet = new Map<string, number>();
    let idx = 0;

    const getDeviceIdx = (name: string) => {
      if (!deviceNameSet.has(name)) {
        deviceNameSet.set(name, idx++);
      }
      return deviceNameSet.get(name)!;
    };

    if (alerts) {
      for (const a of alerts) {
        const device = a.deviceId ? deviceMap.get(a.deviceId) : null;
        const dName = device?.name || "Unknown Device";
        allEvents.push({
          id: a.id,
          timestamp: new Date(a.createdAt).getTime(),
          deviceName: dName,
          deviceId: a.deviceId || "",
          deviceIndex: getDeviceIdx(dName),
          severity: a.severity,
          type: "alert",
          title: a.message,
          detail: a.type.replace(/_/g, " "),
          size: severitySizes[a.severity] || 100,
          color: severityColors[a.severity] || "#6b7280",
        });
      }
    }

    if (notifications) {
      for (const n of notifications) {
        const asset = n.assetId ? assetMap.get(n.assetId) : null;
        const role = n.agentRoleId ? roleMap.get(n.agentRoleId) : null;
        const dName = asset?.hostname || role?.name || "System";
        allEvents.push({
          id: n.id,
          timestamp: new Date(n.createdAt).getTime(),
          deviceName: dName,
          deviceId: n.assetId || "",
          deviceIndex: getDeviceIdx(dName),
          severity: n.severity,
          type: "notification",
          title: n.title,
          detail: n.type.replace(/_/g, " "),
          size: severitySizes[n.severity] || 100,
          color: severityColors[n.severity] || "#6b7280",
        });
      }
    }

    if (calibrations) {
      for (const c of calibrations) {
        const device = c.deviceId ? deviceMap.get(c.deviceId) : null;
        const dName = device?.name || c.metricName;
        allEvents.push({
          id: c.id,
          timestamp: new Date(c.createdAt).getTime(),
          deviceName: dName,
          deviceId: c.deviceId || "",
          deviceIndex: getDeviceIdx(dName),
          severity: "info",
          type: "calibration",
          title: `${c.metricName} threshold calibrated`,
          detail: `${c.calibratedWarning?.toFixed(1)}/${c.calibratedCritical?.toFixed(1)} ${c.unit}`,
          size: 120,
          color: "#a855f7",
        });
      }
    }

    allEvents.sort((a, b) => a.timestamp - b.timestamp);

    const tMin = allEvents.length > 0 ? allEvents[0].timestamp : Date.now() - 86400000;
    const tMax = allEvents.length > 0 ? allEvents[allEvents.length - 1].timestamp : Date.now();

    return {
      events: allEvents,
      deviceNames: Array.from(deviceNameSet.keys()),
      timeMin: tMin,
      timeMax: tMax,
    };
  }, [alerts, notifications, calibrations, deviceMap, roleMap, assetMap]);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (typeFilter !== "all") list = list.filter(e => e.type === typeFilter);
    if (timeRange !== "all") {
      const now = Date.now();
      const ranges: Record<string, number> = { "24h": 86400000, "7d": 604800000, "30d": 2592000000 };
      const cutoff = now - (ranges[timeRange] || 0);
      list = list.filter(e => e.timestamp >= cutoff);
    }
    return list;
  }, [events, typeFilter, timeRange]);

  const clusters = useMemo(() => {
    const clusterWindow = (timeMax - timeMin) * 0.03;
    const found: { events: TimelineEvent[]; center: number; devices: Set<string> }[] = [];

    for (const evt of filteredEvents) {
      let matched = false;
      for (const cl of found) {
        if (Math.abs(evt.timestamp - cl.center) < clusterWindow) {
          cl.events.push(evt);
          cl.devices.add(evt.deviceName);
          cl.center = cl.events.reduce((s, e) => s + e.timestamp, 0) / cl.events.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        found.push({ events: [evt], center: evt.timestamp, devices: new Set([evt.deviceName]) });
      }
    }

    return found.filter(c => c.devices.size > 1).map(c => ({
      ...c,
      id: `cluster-${c.center}`,
      deviceList: Array.from(c.devices),
    }));
  }, [filteredEvents, timeMin, timeMax]);

  const chartData = filteredEvents.map(e => ({
    x: e.timestamp,
    y: e.deviceIndex,
    z: e.size,
    ...e,
  }));

  const eventTypeCounts = useMemo(() => ({
    alert: filteredEvents.filter(e => e.type === "alert").length,
    notification: filteredEvents.filter(e => e.type === "notification").length,
    calibration: filteredEvents.filter(e => e.type === "calibration").length,
  }), [filteredEvents]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const rootCauseEventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [, rca] of rcaResults) {
      if (rca.rootCauseEventId) ids.add(rca.rootCauseEventId);
    }
    return ids;
  }, [rcaResults]);

  const analyzeRootCause = useCallback(async (cluster: typeof clusters[0]) => {
    setAnalyzingCluster(cluster.id);
    try {
      const eventsPayload = cluster.events.map(e => ({
        id: e.id,
        timestamp: new Date(e.timestamp).toISOString(),
        deviceName: e.deviceName,
        type: e.type,
        severity: e.severity,
        title: e.title,
        detail: e.detail,
      }));

      const res = await apiRequest("POST", "/api/root-cause-analysis", { events: eventsPayload });
      const data: RCAResult = await res.json();

      setRcaResults(prev => {
        const next = new Map(prev);
        next.set(cluster.id, data);
        return next;
      });
      setExpandedCluster(cluster.id);
      toast({ title: "Root Cause Analysis Complete", description: data.rootCauseSummary });
    } catch (err: any) {
      toast({ title: "RCA Failed", description: err.message || "Could not complete analysis", variant: "destructive" });
    } finally {
      setAnalyzingCluster(null);
    }
  }, [toast]);

  return (
    <div className="space-y-4" data-testid="event-timeline-view">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold">Event Correlation Timeline</span>
          <Badge variant="outline" className="text-[9px] h-5 border-border/30">{filteredEvents.length} events</Badge>
          {clusters.length > 0 && (
            <Badge className="text-[9px] h-5 bg-cyan-500/10 text-cyan-400 border-cyan-500/15 gap-1">
              <Workflow className="h-3 w-3" /> {clusters.length} correlation{clusters.length !== 1 ? "s" : ""} detected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-7 text-[10px] w-[110px]" data-testid="select-timeline-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="alert">Alerts</SelectItem>
              <SelectItem value="notification">Notifications</SelectItem>
              <SelectItem value="calibration">Calibrations</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="h-7 text-[10px] w-[100px]" data-testid="select-timeline-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center cursor-pointer hover:bg-amber-500/10 transition-colors"
          onClick={() => setTypeFilter(typeFilter === "alert" ? "all" : "alert")}
          data-testid="filter-alerts-bubble"
        >
          <p className="text-lg font-bold text-amber-400">{eventTypeCounts.alert}</p>
          <p className="text-[9px] text-muted-foreground/50">Alerts</p>
        </div>
        <div className="p-2.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-center cursor-pointer hover:bg-indigo-500/10 transition-colors"
          onClick={() => setTypeFilter(typeFilter === "notification" ? "all" : "notification")}
          data-testid="filter-notifs-bubble"
        >
          <p className="text-lg font-bold text-indigo-400">{eventTypeCounts.notification}</p>
          <p className="text-[9px] text-muted-foreground/50">Notifications</p>
        </div>
        <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10 text-center cursor-pointer hover:bg-purple-500/10 transition-colors"
          onClick={() => setTypeFilter(typeFilter === "calibration" ? "all" : "calibration")}
          data-testid="filter-cals-bubble"
        >
          <p className="text-lg font-bold text-purple-400">{eventTypeCounts.calibration}</p>
          <p className="text-[9px] text-muted-foreground/50">Calibrations</p>
        </div>
      </div>

      <Card className="overflow-hidden" data-testid="timeline-chart-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 text-[9px]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Alerts</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Notifications</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500" /> Calibrations</span>
              {rootCauseEventIds.size > 0 && (
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-500/30" /> Root Cause</span>
              )}
              <span className="text-muted-foreground/40 ml-2">Bubble size = severity level</span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(250, deviceNames.length * 40 + 60)}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.12} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[timeMin - (timeMax - timeMin) * 0.05, timeMax + (timeMax - timeMin) * 0.05]}
                  tickFormatter={(v: number) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fillOpacity: 0.5 }}
                  axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.2 }}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[-0.5, deviceNames.length - 0.5]}
                  ticks={deviceNames.map((_, i) => i)}
                  tickFormatter={(v: number) => {
                    const name = deviceNames[v] || "";
                    return name.length > 18 ? name.slice(0, 16) + "…" : name;
                  }}
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fillOpacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <ZAxis type="number" dataKey="z" range={[40, 400]} />
                <RechartsTooltip
                  cursor={false}
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const evt = payload[0]?.payload as TimelineEvent & { x: number };
                    if (!evt) return null;
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-xl max-w-xs" data-testid="timeline-tooltip">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: eventTypeColors[evt.type] }} />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">{evt.type}</span>
                          <Badge className="text-[8px] h-4" style={{ backgroundColor: `${severityColors[evt.severity]}20`, color: severityColors[evt.severity] }}>
                            {evt.severity}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium leading-tight mb-1">{evt.title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <Server className="h-3 w-3" />
                          <span>{evt.deviceName}</span>
                          <span>·</span>
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(evt.timestamp)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/40 mt-1">{evt.detail}</p>
                      </div>
                    );
                  }}
                />
                {clusters.map(cl => {
                  const minDevice = Math.min(...cl.events.map(e => e.deviceIndex));
                  const maxDevice = Math.max(...cl.events.map(e => e.deviceIndex));
                  const minTime = Math.min(...cl.events.map(e => e.timestamp));
                  const maxTime = Math.max(...cl.events.map(e => e.timestamp));
                  const padding = (timeMax - timeMin) * 0.01;
                  return (
                    <ReferenceArea
                      key={cl.id}
                      x1={minTime - padding}
                      x2={maxTime + padding}
                      y1={minDevice - 0.3}
                      y2={maxDevice + 0.3}
                      fill="#06b6d4"
                      fillOpacity={hoveredCluster === cl.id ? 0.12 : 0.04}
                      stroke="#06b6d4"
                      strokeOpacity={0.25}
                      strokeDasharray="4 3"
                    />
                  );
                })}
                <Scatter data={chartData}>
                  {chartData.map((entry, index) => {
                    const isRootCause = rootCauseEventIds.has(entry.id);
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isRootCause ? "#ef4444" : entry.type === "alert" ? "#f59e0b" : entry.type === "notification" ? "#6366f1" : "#a855f7"}
                        fillOpacity={isRootCause ? 0.9 : 0.7}
                        stroke={isRootCause ? "#ef4444" : entry.color}
                        strokeWidth={isRootCause ? 3 : 1.5}
                        strokeOpacity={isRootCause ? 0.8 : 0.4}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="p-10 text-center">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground/50">No events match the current filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {clusters.length > 0 && (
        <Card className="overflow-hidden" data-testid="correlation-clusters-card">
          <div className="px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold">Root Cause Analysis</span>
              <Badge variant="outline" className="text-[9px] h-5 border-border/30">{clusters.length} correlation{clusters.length !== 1 ? "s" : ""}</Badge>
              {rcaResults.size > 0 && (
                <Badge className="text-[9px] h-5 bg-emerald-500/10 text-emerald-400 border-emerald-500/15 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {rcaResults.size} analyzed
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Identify the trigger event that caused cascading failures across your infrastructure</p>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-border/15">
              {clusters.map(cl => {
                const rca = rcaResults.get(cl.id);
                const isExpanded = expandedCluster === cl.id;
                const isAnalyzing = analyzingCluster === cl.id;
                const rootEvent = rca ? cl.events.find(e => e.id === rca.rootCauseEventId) : null;
                const CategoryIcon = rca ? (rcaCategoryIcons[rca.rootCauseCategory] || AlertTriangle) : Workflow;

                return (
                  <div key={cl.id} data-testid={`correlation-cluster-entry-${cl.id}`}>
                    <div
                      className="p-3 hover:bg-muted/10 transition-colors cursor-pointer"
                      onMouseEnter={() => setHoveredCluster(cl.id)}
                      onMouseLeave={() => setHoveredCluster(null)}
                      onClick={() => setExpandedCluster(isExpanded ? null : cl.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${rca ? "bg-red-500/10 border-red-500/20" : "bg-cyan-500/10 border-cyan-500/20"}`}>
                          {rca ? <CircleDot className="h-4 w-4 text-red-400" /> : <Workflow className="h-4 w-4 text-cyan-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {rca ? (
                              <>
                                <span className="text-xs font-semibold text-red-400">Root Cause Identified</span>
                                <Badge className="text-[8px] h-4 bg-red-500/10 text-red-400 border-red-500/15 gap-0.5">
                                  <CategoryIcon className="h-2.5 w-2.5" /> {rcaCategoryLabels[rca.rootCauseCategory] || rca.rootCauseCategory}
                                </Badge>
                                <Badge className="text-[8px] h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/15">
                                  {rca.confidence}% confidence
                                </Badge>
                              </>
                            ) : (
                              <>
                                <span className="text-xs font-semibold">{cl.events.length} events across {cl.devices.size} assets</span>
                                <Badge className="text-[8px] h-4 bg-cyan-500/10 text-cyan-400 border-cyan-500/15">
                                  {formatTime(Math.min(...cl.events.map(e => e.timestamp)))}
                                </Badge>
                              </>
                            )}
                          </div>
                          {rca ? (
                            <p className="text-[11px] text-foreground/70 leading-snug">{rca.rootCauseSummary}</p>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {cl.deviceList.map(d => (
                                <Badge key={d} variant="outline" className="text-[8px] h-4 border-border/25 gap-0.5">
                                  <Server className="h-2.5 w-2.5" /> {d}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!rca && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-[10px]"
                              onClick={(e) => { e.stopPropagation(); analyzeRootCause(cl); }}
                              disabled={isAnalyzing}
                              data-testid={`button-rca-${cl.id}`}
                            >
                              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                              {isAnalyzing ? "Analyzing..." : "Analyze Root Cause"}
                            </Button>
                          )}
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3">
                        {rca ? (
                          <>
                            <Card className="overflow-hidden border-red-500/15 bg-red-500/[0.02]" data-testid={`rca-detail-${cl.id}`}>
                              <div className="px-3 py-2.5 border-b border-red-500/10">
                                <div className="flex items-center gap-2">
                                  <CircleDot className="h-3.5 w-3.5 text-red-400" />
                                  <span className="text-[11px] font-semibold text-red-400">Causal Chain</span>
                                  <span className="text-[9px] text-muted-foreground/40">{rca.causalChain?.length || 0} steps</span>
                                </div>
                              </div>
                              <CardContent className="p-3">
                                <div className="space-y-0">
                                  {(rca.causalChain || []).map((step, i) => {
                                    const chainEvt = cl.events.find(e => e.id === step.eventId);
                                    const roleStyle = chainRoleColors[step.role] || chainRoleColors.side_effect;
                                    return (
                                      <div key={i} className="flex items-start gap-2.5" data-testid={`chain-step-${i}`}>
                                        <div className="flex flex-col items-center shrink-0 pt-0.5">
                                          <div className={`flex h-6 w-6 items-center justify-center rounded-full ${roleStyle.bg} border ${roleStyle.border}`}>
                                            {step.role === "root_cause" ? <Zap className={`h-3 w-3 ${roleStyle.text}`} /> :
                                             step.role === "propagation" ? <ArrowDown className={`h-3 w-3 ${roleStyle.text}`} /> :
                                             step.role === "symptom" ? <AlertTriangle className={`h-3 w-3 ${roleStyle.text}`} /> :
                                             <Minus className={`h-3 w-3 ${roleStyle.text}`} />}
                                          </div>
                                          {i < (rca.causalChain?.length || 0) - 1 && (
                                            <div className="w-px h-6 bg-border/20 my-0.5" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0 pb-2">
                                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                            <Badge className={`text-[7px] h-3.5 ${roleStyle.bg} ${roleStyle.text} border ${roleStyle.border}`}>
                                              {step.role.replace(/_/g, " ")}
                                            </Badge>
                                            {chainEvt && (
                                              <Badge className="text-[7px] h-3.5" style={{ backgroundColor: `${eventTypeColors[chainEvt.type]}15`, color: eventTypeColors[chainEvt.type] }}>
                                                {chainEvt.type}
                                              </Badge>
                                            )}
                                            {step.delayFromRoot && step.delayFromRoot !== "0" && step.delayFromRoot !== "0s" && (
                                              <span className="text-[8px] text-muted-foreground/40 flex items-center gap-0.5">
                                                <Clock className="h-2.5 w-2.5" /> +{step.delayFromRoot}
                                              </span>
                                            )}
                                          </div>
                                          {chainEvt && (
                                            <p className="text-[10px] font-medium text-foreground/70 truncate">{chainEvt.title}</p>
                                          )}
                                          <p className="text-[10px] text-muted-foreground/50 leading-snug">{step.explanation}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              <Card className="overflow-hidden border-amber-500/15 bg-amber-500/[0.02]" data-testid={`rca-impact-${cl.id}`}>
                                <div className="px-3 py-2 border-b border-amber-500/10">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                                    <span className="text-[11px] font-semibold text-amber-400">Impact Assessment</span>
                                  </div>
                                </div>
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className="text-[8px] h-4" style={{ backgroundColor: `${severityColors[rca.impactAssessment?.severity || "medium"]}15`, color: severityColors[rca.impactAssessment?.severity || "medium"] }}>
                                      {rca.impactAssessment?.severity || "unknown"} severity
                                    </Badge>
                                    <Badge variant="outline" className="text-[8px] h-4 border-border/25">
                                      {rca.impactAssessment?.blastRadius || "unknown"} blast radius
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] text-foreground/60 leading-snug">{rca.impactAssessment?.businessImpact}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {(rca.impactAssessment?.affectedSystems || []).map(sys => (
                                      <Badge key={sys} variant="outline" className="text-[7px] h-3.5 border-amber-500/15 gap-0.5">
                                        <Server className="h-2 w-2" /> {sys}
                                      </Badge>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="overflow-hidden border-emerald-500/15 bg-emerald-500/[0.02]" data-testid={`rca-remediation-${cl.id}`}>
                                <div className="px-3 py-2 border-b border-emerald-500/10">
                                  <div className="flex items-center gap-2">
                                    <Wrench className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-[11px] font-semibold text-emerald-400">Remediation</span>
                                  </div>
                                </div>
                                <CardContent className="p-3 space-y-2">
                                  {(rca.remediation?.immediate || []).length > 0 && (
                                    <div>
                                      <p className="text-[9px] font-semibold text-red-400 uppercase tracking-wider mb-0.5">Immediate</p>
                                      {rca.remediation.immediate.map((r, i) => (
                                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/60">
                                          <Zap className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                                          <span>{r}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {(rca.remediation?.shortTerm || []).length > 0 && (
                                    <div>
                                      <p className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider mb-0.5">Short-Term</p>
                                      {rca.remediation.shortTerm.map((r, i) => (
                                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/60">
                                          <Wrench className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                                          <span>{r}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {(rca.remediation?.longTerm || []).length > 0 && (
                                    <div>
                                      <p className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">Long-Term Prevention</p>
                                      {rca.remediation.longTerm.map((r, i) => (
                                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/60">
                                          <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                                          <span>{r}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </div>

                            {rca.reasoning && (
                              <Card className="overflow-hidden border-indigo-500/15 bg-indigo-500/[0.02]" data-testid={`rca-reasoning-${cl.id}`}>
                                <div className="px-3 py-2 border-b border-indigo-500/10">
                                  <div className="flex items-center gap-2">
                                    <Lightbulb className="h-3.5 w-3.5 text-indigo-400" />
                                    <span className="text-[11px] font-semibold text-indigo-400">AI Reasoning</span>
                                  </div>
                                </div>
                                <CardContent className="p-3">
                                  <p className="text-[10px] text-foreground/60 leading-relaxed">{rca.reasoning}</p>
                                  {(rca.alternativeHypotheses || []).length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-border/10">
                                      <p className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1">Alternative Hypotheses</p>
                                      {rca.alternativeHypotheses.map((alt, i) => (
                                        <div key={i} className="flex items-start gap-2 text-[10px] mb-1">
                                          <Badge variant="outline" className="text-[7px] h-3.5 border-border/20 shrink-0">{alt.confidence}%</Badge>
                                          <div>
                                            <span className="text-foreground/60">{alt.hypothesis}</span>
                                            <span className="text-muted-foreground/40"> — {alt.reason}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-[10px]"
                              onClick={(e) => { e.stopPropagation(); analyzeRootCause(cl); }}
                              disabled={isAnalyzing}
                              data-testid={`button-rca-rerun-${cl.id}`}
                            >
                              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              Re-analyze
                            </Button>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <div className="space-y-0.5">
                              {cl.events.sort((a, b) => a.timestamp - b.timestamp).map(evt => (
                                <div key={evt.id} className="flex items-center gap-2 text-[10px]">
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: eventTypeColors[evt.type] }} />
                                  <span className="text-muted-foreground/50 shrink-0">{new Date(evt.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                                  <Badge variant="outline" className="text-[7px] h-3.5 border-border/20 gap-0.5 shrink-0">
                                    <Server className="h-2 w-2" /> {evt.deviceName.length > 15 ? evt.deviceName.slice(0, 13) + "…" : evt.deviceName}
                                  </Badge>
                                  <span className="truncate text-foreground/70">{evt.title}</span>
                                  <Badge className="text-[7px] h-3 shrink-0" style={{ backgroundColor: `${severityColors[evt.severity]}15`, color: severityColors[evt.severity] }}>
                                    {evt.severity}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-[10px] w-full"
                              onClick={(e) => { e.stopPropagation(); analyzeRootCause(cl); }}
                              disabled={isAnalyzing}
                              data-testid={`button-rca-expanded-${cl.id}`}
                            >
                              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                              {isAnalyzing ? "AI Analyzing Event Chain..." : "Analyze Root Cause with AI"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CalibrationCard({ cal }: {
  cal: ThresholdCalibration;
}) {
  const [expanded, setExpanded] = useState(false);
  const fpReduction = cal.falsePositivesBefore && cal.falsePositivesProjected !== null
    ? Math.round(((cal.falsePositivesBefore - (cal.falsePositivesProjected ?? 0)) / Math.max(1, cal.falsePositivesBefore)) * 100)
    : null;

  return (
    <Card
      className={`overflow-hidden transition-all duration-200 ${expanded ? "ring-1 ring-primary/15 border-primary/20" : ""}`}
      data-testid={`calibration-${cal.id}`}
    >
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left p-4 hover:bg-muted/10 transition-colors"
          data-testid={`toggle-cal-${cal.id}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
              <FlaskConical className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-semibold">{cal.metricName}</span>
                <Badge variant="outline" className="text-[9px] h-4 border-border/30">{cal.unit}</Badge>
                <Badge className="text-[9px] h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/15">Auto-Applied</Badge>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/50">Current:</span>
                  <span className="text-amber-400 font-medium">{cal.currentWarning ?? "—"}</span>
                  <span className="text-muted-foreground/30">/</span>
                  <span className="text-red-400 font-medium">{cal.currentCritical ?? "—"}</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/50">Proposed:</span>
                  <span className="text-amber-300 font-medium">{cal.calibratedWarning?.toFixed(1) ?? "—"}</span>
                  <span className="text-muted-foreground/30">/</span>
                  <span className="text-red-300 font-medium">{cal.calibratedCritical?.toFixed(1) ?? "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                {fpReduction !== null && fpReduction > 0 && (
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                    <TrendingDown className="h-3 w-3" /> {fpReduction}% fewer false positives
                  </span>
                )}
                {cal.confidence > 0 && (
                  <span className="text-[10px] text-muted-foreground/50">{cal.confidence.toFixed(0)}% confidence</span>
                )}
              </div>
            </div>
            <div className="shrink-0 mt-1">
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground/40" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/40" />}
            </div>
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 pt-0 ml-11 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                <p className="text-[9px] font-semibold text-emerald-400/70 uppercase tracking-wider">Normal</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">{cal.calibratedNormal?.toFixed(1) ?? "—"}</p>
                <p className="text-[9px] text-muted-foreground/40">{cal.unit}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center">
                <p className="text-[9px] font-semibold text-amber-400/70 uppercase tracking-wider">Warning</p>
                <p className="text-lg font-bold text-amber-400 mt-0.5">{cal.calibratedWarning?.toFixed(1) ?? "—"}</p>
                <p className="text-[9px] text-muted-foreground/40">{cal.unit}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-center">
                <p className="text-[9px] font-semibold text-red-400/70 uppercase tracking-wider">Critical</p>
                <p className="text-lg font-bold text-red-400 mt-0.5">{cal.calibratedCritical?.toFixed(1) ?? "—"}</p>
                <p className="text-[9px] text-muted-foreground/40">{cal.unit}</p>
              </div>
            </div>

            <ThresholdDistributionChart cal={cal} />

            <div className="p-3 rounded-lg bg-muted/15 border border-border/20 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Variation Calibration Analysis</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-muted-foreground/50">Algorithm</span>
                  <p className="font-medium text-foreground/80">{cal.algorithm.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/50">Data Points</span>
                  <p className="font-medium text-foreground/80">{cal.dataPointsAnalyzed.toLocaleString()} <span className="text-[9px] text-purple-400/60">({Math.round(cal.dataPointsAnalyzed / 24)}d)</span></p>
                  <p className="text-[8px] text-purple-400/40 mt-0.5">AI-selected bundle</p>
                </div>
                <div>
                  <span className="text-muted-foreground/50">Mean Value</span>
                  <p className="font-medium text-foreground/80">{cal.meanValue?.toFixed(2) ?? "—"} {cal.unit}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/50">Std Deviation</span>
                  <p className="font-medium text-foreground/80">±{cal.stdDeviation?.toFixed(2) ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/50">CV (Variance Coeff)</span>
                  <p className="font-medium text-foreground/80">{cal.varianceCoefficient?.toFixed(3) ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/50">P95 Value</span>
                  <p className="font-medium text-foreground/80">{cal.p95Value?.toFixed(2) ?? "—"} {cal.unit}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/50">P99 Value</span>
                  <p className="font-medium text-foreground/80">{cal.p99Value?.toFixed(2) ?? "—"} {cal.unit}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/50">Confidence</span>
                  <p className="font-medium text-foreground/80">{cal.confidence.toFixed(0)}%</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
              <p className="text-[10px] font-semibold text-purple-400/70 uppercase tracking-wider mb-2">False Positive Impact</p>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-red-400">{cal.falsePositivesBefore ?? 0}</p>
                  <p className="text-[9px] text-muted-foreground/50">Current FPs</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                <div className="text-center">
                  <p className="text-xl font-bold text-emerald-400">{cal.falsePositivesProjected ?? 0}</p>
                  <p className="text-[9px] text-muted-foreground/50">Projected FPs</p>
                </div>
                {fpReduction !== null && fpReduction > 0 && (
                  <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/15 ml-auto">
                    {fpReduction}% reduction
                  </Badge>
                )}
              </div>
            </div>

            {cal.appliedAt && (
              <div className="flex items-center gap-2 pt-1">
                <Badge className="text-[9px] h-5 bg-emerald-500/10 text-emerald-400 border-emerald-500/15 gap-1">
                  <Check className="h-3 w-3" /> Thresholds auto-applied to device metrics
                </Badge>
                <span className="text-[9px] text-muted-foreground/40">
                  {new Date(cal.appliedAt).toLocaleDateString()} {new Date(cal.appliedAt).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InfrastructureEvents() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [expandedNotif, setExpandedNotif] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [alertDrilldown, setAlertDrilldown] = useState<AlertDrilldown>("all");
  const [notifDrilldown, setNotifDrilldown] = useState<NotifDrilldown>("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: notifications } = useQuery<AgentNotification[]>({ queryKey: ["/api/agent-notifications"] });
  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: assets } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });
  const { data: alerts } = useQuery<AgentAlert[]>({ queryKey: ["/api/agent-alerts"] });
  const { data: kpis } = useQuery<AgentKpi[]>({ queryKey: ["/api/agent-kpis"] });
  const { data: devices } = useQuery<NetworkDevice[]>({ queryKey: ["/api/network-devices"] });
  const { data: calibrations } = useQuery<ThresholdCalibration[]>({ queryKey: ["/api/threshold-calibrations"] });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/agent-notifications/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-kpis"] });
      toast({ title: "Events refreshed", description: "Latest autonomous agent findings synced" });
    },
    onError: () => toast({ title: "Refresh failed", variant: "destructive" }),
  });

  const runCalibrationMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/threshold-calibrations/run"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/threshold-calibrations"] });
      toast({ title: "Calibration complete", description: "Data Scientist agent analyzed metrics and auto-applied optimized thresholds" });
    },
    onError: () => toast({ title: "Calibration failed", description: "Could not complete threshold analysis", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/agent-notifications/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notifications"] });
      toast({ title: "Notification updated" });
      setExpandedNotif(null);
      setResponseText("");
    },
  });

  const ackAlertMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/agent-alerts/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-alerts"] });
      toast({ title: "Alert updated" });
    },
  });

  const roleMap = useMemo(() => new Map(roles?.map(r => [r.id, r]) ?? []), [roles]);
  const assetMap = useMemo(() => new Map(assets?.map(a => [a.id, a]) ?? []), [assets]);
  const deviceMap = useMemo(() => new Map(devices?.map(d => [d.id, d]) ?? []), [devices]);

  const activeAlertCount = alerts?.filter(a => !a.acknowledged && !a.falsePositive).length ?? 0;
  const criticalAlertCount = alerts?.filter(a => (a.severity === "critical" || a.severity === "high" || a.severity === "warning") && !a.falsePositive).length ?? 0;
  const fpAlertCount = alerts?.filter(a => a.falsePositive).length ?? 0;
  const ackAlertCount = alerts?.filter(a => a.acknowledged && !a.falsePositive).length ?? 0;
  const pendingNotifCount = notifications?.filter(n => n.actionStatus === "pending").length ?? 0;
  const criticalNotifCount = notifications?.filter(n => n.severity === "critical" || n.severity === "high").length ?? 0;
  const escalationCount = notifications?.filter(n => n.type === "escalation").length ?? 0;
  const kpisOnTarget = kpis?.filter(k => {
    const isInverse = k.kpiName.includes("Time") || k.kpiName.includes("False") || k.kpiName.includes("Convergence");
    return k.unit === "%" ? k.currentValue >= k.targetValue * 0.95 :
      isInverse ? k.currentValue <= k.targetValue : k.currentValue >= k.targetValue * 0.8;
  }).length ?? 0;
  const kpisOffTarget = (kpis?.length ?? 0) - kpisOnTarget;
  const appliedCalCount = calibrations?.filter(c => c.status === "applied").length ?? 0;
  const totalFpReduction = useMemo(() => {
    if (!calibrations) return 0;
    return calibrations
      .filter(c => c.falsePositivesBefore && c.falsePositivesProjected !== null)
      .reduce((sum, c) => sum + ((c.falsePositivesBefore ?? 0) - (c.falsePositivesProjected ?? 0)), 0);
  }, [calibrations]);

  const drillToCalibration = useCallback(() => {
    setActiveView("calibration");
  }, []);

  const drillToTimeline = useCallback(() => {
    setActiveView("timeline");
  }, []);

  const filteredAlerts = useMemo(() => {
    if (!alerts) return [];
    switch (alertDrilldown) {
      case "active": return alerts.filter(a => !a.acknowledged && !a.falsePositive);
      case "critical": return alerts.filter(a => a.severity === "critical" && !a.falsePositive);
      case "false_positive": return alerts.filter(a => a.falsePositive);
      case "acknowledged": return alerts.filter(a => a.acknowledged && !a.falsePositive);
      default: return alerts;
    }
  }, [alerts, alertDrilldown]);

  const filteredNotifications = useMemo(() => {
    let list = notifications ?? [];
    switch (notifDrilldown) {
      case "pending": list = list.filter(n => n.actionStatus === "pending"); break;
      case "critical_high": list = list.filter(n => n.severity === "critical" || n.severity === "high"); break;
      case "escalation": list = list.filter(n => n.type === "escalation"); break;
    }
    if (severityFilter !== "all") list = list.filter(n => n.severity === severityFilter);
    if (statusFilter !== "all") list = list.filter(n => n.actionStatus === statusFilter);
    return list;
  }, [notifications, notifDrilldown, severityFilter, statusFilter]);

  const drillToAlerts = useCallback((filter: AlertDrilldown) => {
    setActiveView("alerts");
    setAlertDrilldown(filter);
  }, []);

  const drillToNotifs = useCallback((filter: NotifDrilldown) => {
    setActiveView("notifications");
    setNotifDrilldown(filter);
  }, []);

  const drillToKpis = useCallback(() => {
    setActiveView("kpis");
  }, []);

  const severityBreakdown = useMemo(() => {
    if (!alerts) return {};
    const counts: Record<string, number> = {};
    alerts.filter(a => !a.falsePositive).forEach(a => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
    return counts;
  }, [alerts]);

  const notifSeverityBreakdown = useMemo(() => {
    if (!notifications) return {};
    const counts: Record<string, number> = {};
    notifications.forEach(n => { counts[n.severity] = (counts[n.severity] || 0) + 1; });
    return counts;
  }, [notifications]);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold tracking-tight gradient-text-bright" data-testid="text-events-title">
              Event Management
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Infrastructure alerts, AI notifications, and KPI monitoring
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeView !== "overview" && (
              <Button
                variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                onClick={() => { setActiveView("overview"); setAlertDrilldown("all"); setNotifDrilldown("all"); }}
                data-testid="button-back-overview"
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Overview
              </Button>
            )}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              variant="outline"
              className="gap-2 h-8 text-xs"
              data-testid="button-generate-scan"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              {generateMutation.isPending ? "Syncing..." : "Refresh Events"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <SummaryWidget
            title="Active Alerts"
            value={activeAlertCount}
            subtitle={`${criticalAlertCount} critical · ${fpAlertCount} false pos.`}
            icon={Bell}
            accentColor={activeAlertCount > 0 ? "text-amber-400" : "text-green-400"}
            borderColor="border-amber-500/30"
            active={activeView === "alerts"}
            onClick={() => drillToAlerts("active")}
            badge={criticalAlertCount > 0 ? "critical" : undefined}
            testId="widget-active-alerts"
          />
          <SummaryWidget
            title="Agent Notifications"
            value={notifications?.length ?? 0}
            subtitle={`${pendingNotifCount} pending · ${escalationCount} escalations`}
            icon={MessageSquare}
            accentColor="text-primary"
            borderColor="border-primary/30"
            active={activeView === "notifications"}
            onClick={() => drillToNotifs("all")}
            badge={pendingNotifCount > 0 ? "pending" : undefined}
            testId="widget-notifications"
          />
          <SummaryWidget
            title="Critical / High"
            value={criticalNotifCount}
            subtitle="Requiring immediate attention"
            icon={AlertCircle}
            accentColor={criticalNotifCount > 0 ? "text-red-400" : "text-green-400"}
            borderColor="border-red-500/30"
            active={activeView === "notifications" && notifDrilldown === "critical_high"}
            onClick={() => drillToNotifs("critical_high")}
            testId="widget-critical"
          />
          <SummaryWidget
            title="KPI Health"
            value={`${kpisOnTarget}/${kpis?.length ?? 0}`}
            subtitle={kpisOffTarget > 0 ? `${kpisOffTarget} below target` : "All metrics on target"}
            icon={Target}
            accentColor={kpisOffTarget > 0 ? "text-amber-400" : "text-green-400"}
            borderColor="border-purple-500/30"
            active={activeView === "kpis"}
            onClick={drillToKpis}
            testId="widget-kpis"
          />
          <SummaryWidget
            title="Threshold Calibration"
            value={appliedCalCount}
            subtitle={totalFpReduction > 0 ? `${totalFpReduction} FPs reducible` : fpAlertCount > 0 ? `${fpAlertCount} FPs detected` : "Thresholds optimized"}
            icon={FlaskConical}
            accentColor={appliedCalCount > 0 ? "text-purple-400" : "text-green-400"}
            borderColor="border-purple-500/30"
            active={activeView === "calibration"}
            onClick={drillToCalibration}
            badge={appliedCalCount > 0 ? `${appliedCalCount} applied` : undefined}
            testId="widget-calibration"
          />
          <SummaryWidget
            title="Event Timeline"
            value={(alerts?.length ?? 0) + (notifications?.length ?? 0) + (calibrations?.length ?? 0)}
            subtitle="Chronological correlation"
            icon={Activity}
            accentColor="text-cyan-400"
            borderColor="border-cyan-500/30"
            active={activeView === "timeline"}
            onClick={drillToTimeline}
            testId="widget-timeline"
          />
        </div>

        {activeView === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="overflow-hidden" data-testid="overview-alerts-card">
              <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold">Infrastructure Alerts</span>
                  {activeAlertCount > 0 && <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/15 text-amber-400 border-amber-500/20">{activeAlertCount}</Badge>}
                </div>
                <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => drillToAlerts("all")} data-testid="link-view-all-alerts">
                  View All <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
              <CardContent className="p-0">
                {alerts && alerts.length > 0 ? (
                  <div className="divide-y divide-border/20">
                    {alerts.filter(a => !a.falsePositive).slice(0, 5).map(alert => {
                      const dn = deviceMap.get(alert.deviceId || "")?.name ?? "Unknown";
                      const borderLeft = alertSeverityBorder[alert.severity] || "border-l-border";
                      return (
                        <div
                          key={alert.id}
                          className={`px-4 py-2.5 flex items-center gap-3 border-l-[3px] ${borderLeft} hover:bg-muted/10 cursor-pointer transition-colors ${alert.acknowledged ? "opacity-60" : ""}`}
                          onClick={() => drillToAlerts(alert.severity === "critical" ? "critical" : "active")}
                          data-testid={`overview-alert-${alert.id}`}
                        >
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${alertSeverityColor[alert.severity] || alertSeverityColor.medium}`}>
                            {alert.severity === "critical" ? <ShieldAlert className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{alert.message}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-primary/60 font-medium">{dn}</span>
                              <span className="text-[9px] text-muted-foreground/40">{timeAgo(alert.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <CheckCircle2 className="h-6 w-6 mx-auto text-green-400/40 mb-1" />
                    <p className="text-xs text-muted-foreground/50">No alerts</p>
                  </div>
                )}
                {alerts && alerts.length > 0 && (
                  <div className="px-4 py-2 border-t border-border/20 flex items-center gap-3 flex-wrap">
                    {Object.entries(severityBreakdown).map(([sev, count]) => (
                      <button
                        key={sev}
                        className="flex items-center gap-1 text-[10px] hover:opacity-80 transition-opacity"
                        onClick={() => drillToAlerts(sev === "critical" ? "critical" : "active")}
                        data-testid={`severity-drill-${sev}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${sev === "critical" ? "bg-red-400" : sev === "high" ? "bg-orange-400" : sev === "warning" ? "bg-amber-400" : sev === "medium" ? "bg-blue-400" : "bg-muted-foreground/40"}`} />
                        <span className="text-muted-foreground/60 capitalize">{sev}</span>
                        <span className="font-semibold text-foreground/70">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden" data-testid="overview-notifs-card">
              <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Agent Notifications</span>
                  {pendingNotifCount > 0 && <Badge className="text-[9px] h-4 px-1.5 bg-primary/15 text-primary border-primary/20">{pendingNotifCount} pending</Badge>}
                </div>
                <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => drillToNotifs("all")} data-testid="link-view-all-notifs">
                  View All <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
              <CardContent className="p-0">
                {notifications && notifications.length > 0 ? (
                  <div className="divide-y divide-border/20">
                    {notifications.slice(0, 5).map(notif => {
                      const role = roleMap.get(notif.agentRoleId);
                      const sev = severityConfig[notif.severity] || severityConfig.info;
                      const SevIcon = sev.icon;
                      const tConfig = notifTypeConfig[notif.type] || notifTypeConfig.status_update;
                      const sConfig = statusConfig[notif.actionStatus] || statusConfig.pending;
                      return (
                        <div
                          key={notif.id}
                          className="px-4 py-2.5 hover:bg-muted/10 cursor-pointer transition-colors"
                          onClick={() => drillToNotifs(notif.actionStatus === "pending" ? "pending" : "all")}
                          data-testid={`overview-notif-${notif.id}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${sev.bg} ${sev.border} ${sev.color}`}>
                              <SevIcon className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{notif.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {role && <span className="text-[10px] text-primary/60 font-medium">{role.name}</span>}
                                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${sConfig.dot}`} />
                                <span className="text-[10px] text-muted-foreground/50">{sConfig.label}</span>
                                <span className="text-[9px] text-muted-foreground/30 ml-auto">{timeAgo(notif.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <CheckCircle2 className="h-6 w-6 mx-auto text-green-400/40 mb-1" />
                    <p className="text-xs text-muted-foreground/50">No notifications</p>
                  </div>
                )}
                {notifications && notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-border/20 flex items-center gap-3 flex-wrap">
                    {Object.entries(notifSeverityBreakdown).map(([sev, count]) => {
                      const sc = severityConfig[sev] || severityConfig.info;
                      return (
                        <button
                          key={sev}
                          className="flex items-center gap-1 text-[10px] hover:opacity-80 transition-opacity"
                          onClick={() => drillToNotifs(sev === "critical" || sev === "high" ? "critical_high" : "all")}
                          data-testid={`notif-severity-drill-${sev}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.color.replace("text-", "bg-")}`} />
                          <span className="text-muted-foreground/60 capitalize">{sev}</span>
                          <span className="font-semibold text-foreground/70">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden lg:col-span-2" data-testid="overview-kpis-card">
              <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-semibold">KPI Thresholds</span>
                  <Badge variant="outline" className="text-[9px] h-4 border-border/30">{kpisOnTarget} on target</Badge>
                  {kpisOffTarget > 0 && <Badge className="text-[9px] h-4 bg-amber-500/10 text-amber-400 border-amber-500/15">{kpisOffTarget} off target</Badge>}
                </div>
                <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={drillToKpis} data-testid="link-view-all-kpis">
                  View All <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
              <CardContent className="p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {kpis?.slice(0, 10).map(kpi => {
                    const progress = Math.min((kpi.currentValue / kpi.targetValue) * 100, 120);
                    const isInverse = kpi.kpiName.includes("Time") || kpi.kpiName.includes("False") || kpi.kpiName.includes("Convergence");
                    const onTarget = kpi.unit === "%" ? kpi.currentValue >= kpi.targetValue * 0.95 :
                      isInverse ? kpi.currentValue <= kpi.targetValue : kpi.currentValue >= kpi.targetValue * 0.8;
                    return (
                      <div
                        key={kpi.id}
                        className="p-3 rounded-lg bg-muted/15 border border-border/20 hover:bg-muted/25 cursor-pointer transition-colors"
                        onClick={drillToKpis}
                        data-testid={`overview-kpi-${kpi.id}`}
                      >
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider truncate">{kpi.kpiName}</p>
                        <div className="flex items-end gap-1 mt-1">
                          <span className={`text-lg font-bold ${onTarget ? "text-green-400" : "text-amber-400"}`}>
                            {kpi.currentValue % 1 === 0 ? kpi.currentValue : kpi.currentValue.toFixed(1)}
                          </span>
                          <span className="text-[9px] text-muted-foreground/40 mb-0.5">{kpi.unit}</span>
                          <TrendIcon trend={kpi.trend} />
                        </div>
                        <Progress value={Math.min(progress, 100)} className={`h-1 mt-1.5 ${onTarget ? "[&>div]:bg-green-500" : "[&>div]:bg-amber-500"}`} />
                      </div>
                    );
                  })}
                  {(!kpis || kpis.length === 0) && (
                    <div className="col-span-full p-4 text-center">
                      <p className="text-xs text-muted-foreground/50">No KPI thresholds configured</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden lg:col-span-2" data-testid="overview-calibration-card">
              <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-semibold">Threshold Calibration</span>
                  {appliedCalCount > 0 && <Badge className="text-[9px] h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/15">{appliedCalCount} auto-applied</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-6 gap-1"
                    onClick={() => runCalibrationMutation.mutate()}
                    disabled={runCalibrationMutation.isPending}
                    data-testid="button-run-calibration-overview"
                  >
                    {runCalibrationMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                    {runCalibrationMutation.isPending ? "Analyzing..." : "Run Analysis"}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={drillToCalibration} data-testid="link-view-all-calibrations">
                    View All <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-3">
                {calibrations && calibrations.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                      <div className="p-2.5 rounded-lg bg-muted/15 border border-border/20 text-center">
                        <p className="text-lg font-bold text-purple-400">{calibrations.length}</p>
                        <p className="text-[9px] text-muted-foreground/50">Total Calibrations</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/15 border border-border/20 text-center">
                        <p className="text-lg font-bold text-emerald-400">{appliedCalCount}</p>
                        <p className="text-[9px] text-muted-foreground/50">Auto-Applied</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/15 border border-border/20 text-center">
                        <p className="text-lg font-bold text-emerald-400">{totalFpReduction > 0 ? `-${totalFpReduction}` : "0"}</p>
                        <p className="text-[9px] text-muted-foreground/50">FP Reduction</p>
                      </div>
                    </div>
                    {calibrations.filter(c => c.status === "applied").slice(0, 3).map(cal => {
                      const fpRed = cal.falsePositivesBefore && cal.falsePositivesProjected !== null
                        ? Math.round(((cal.falsePositivesBefore - (cal.falsePositivesProjected ?? 0)) / Math.max(1, cal.falsePositivesBefore)) * 100)
                        : null;
                      return (
                        <div
                          key={cal.id}
                          className="px-3 py-2 rounded-lg bg-muted/10 border border-border/15 hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={drillToCalibration}
                          data-testid={`overview-cal-${cal.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FlaskConical className="h-3 w-3 text-purple-400/60" />
                              <span className="text-xs font-medium">{cal.metricName}</span>
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-border/30">{cal.unit}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {fpRed !== null && fpRed > 0 && (
                                <span className="text-[9px] text-emerald-400 font-medium">-{fpRed}% FP</span>
                              )}
                              <span className="text-[9px] text-muted-foreground/40">{cal.confidence?.toFixed(0)}% conf.</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <FlaskConical className="h-6 w-6 mx-auto text-purple-400/30 mb-2" />
                    <p className="text-xs text-muted-foreground/50">No calibrations yet</p>
                    <p className="text-[10px] text-muted-foreground/30 mt-1">Run the Data Scientist analysis to get threshold recommendations</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeView === "alerts" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold">Infrastructure Alert Feed</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {([
                  { key: "all", label: "All", count: alerts?.length ?? 0 },
                  { key: "active", label: "Active", count: activeAlertCount },
                  { key: "critical", label: "Critical", count: criticalAlertCount },
                  { key: "acknowledged", label: "Acknowledged", count: ackAlertCount },
                  { key: "false_positive", label: "False Positives", count: fpAlertCount },
                ] as { key: AlertDrilldown; label: string; count: number }[]).map(f => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={alertDrilldown === f.key ? "secondary" : "ghost"}
                    className="text-[10px] h-7 px-2.5"
                    onClick={() => setAlertDrilldown(f.key)}
                    data-testid={`filter-alert-${f.key}`}
                  >
                    {f.label}
                    <Badge variant="outline" className="text-[9px] ml-1 h-3.5 px-1 border-border/30">{f.count}</Badge>
                  </Button>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden" data-testid="alerts-panel">
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {filteredAlerts.map(alert => (
                    <AlertDetailPanel
                      key={alert.id}
                      alert={alert}
                      deviceName={deviceMap.get(alert.deviceId || "")?.name ?? "Unknown"}
                      onAck={() => ackAlertMutation.mutate({ id: alert.id, updates: { acknowledged: true } })}
                      onFp={() => ackAlertMutation.mutate({ id: alert.id, updates: { falsePositive: true, acknowledged: true } })}
                    />
                  ))}
                  {filteredAlerts.length === 0 && (
                    <div className="p-10 text-center">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-green-400/30 mb-2" />
                      <p className="text-sm text-muted-foreground/50">No alerts matching filter</p>
                      <p className="text-[10px] text-muted-foreground/30 mt-1">Try adjusting your filter criteria</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeView === "notifications" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Agent Notifications</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { key: "all", label: "All" },
                  { key: "pending", label: `Pending (${pendingNotifCount})` },
                  { key: "critical_high", label: `Critical/High (${criticalNotifCount})` },
                  { key: "escalation", label: `Escalations (${escalationCount})` },
                ] as { key: NotifDrilldown; label: string }[]).map(f => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={notifDrilldown === f.key ? "secondary" : "ghost"}
                    className="text-[10px] h-7 px-2.5"
                    onClick={() => setNotifDrilldown(f.key)}
                    data-testid={`filter-notif-${f.key}`}
                  >
                    {f.label}
                  </Button>
                ))}
                <div className="h-4 w-px bg-border/30 mx-1" />
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[120px] h-7 text-[10px]" data-testid="select-severity">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px] h-7 text-[10px]" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="auto_executed">Auto-Executed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredNotifications.map(notif => {
                const role = roleMap.get(notif.agentRoleId);
                const asset = notif.assetId ? assetMap.get(notif.assetId) : null;
                const sevConfig = severityConfig[notif.severity] ?? severityConfig.info;
                const SevIcon = sevConfig.icon;
                const tConfig = notifTypeConfig[notif.type] ?? notifTypeConfig.status_update;
                const sConfig = statusConfig[notif.actionStatus] ?? statusConfig.pending;
                const isExpanded = expandedNotif === notif.id;

                return (
                  <Card key={notif.id} className={`overflow-hidden transition-all duration-200 ${isExpanded ? "ring-1 ring-primary/15 border-primary/20" : ""}`} data-testid={`notification-${notif.id}`}>
                    <CardContent className="p-0">
                      <button
                        className="w-full text-left p-4 hover:bg-muted/10 transition-colors"
                        onClick={() => setExpandedNotif(isExpanded ? null : notif.id)}
                        data-testid={`toggle-notif-${notif.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${sevConfig.bg} ${sevConfig.border} ${sevConfig.color}`}>
                            <SevIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {role && (
                                <Badge variant="outline" className="text-[9px] h-4 border-primary/20 bg-primary/5 gap-1">
                                  <Bot className="h-2 w-2" /> {role.name}
                                </Badge>
                              )}
                              <Badge className={`text-[9px] h-4 border ${tConfig.color}`}>{tConfig.label}</Badge>
                              <div className="flex items-center gap-1">
                                <span className={`h-1.5 w-1.5 rounded-full ${sConfig.dot}`} />
                                <span className="text-[10px] text-muted-foreground/60">{sConfig.label}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground/30 ml-auto">{timeAgo(notif.createdAt)}</span>
                            </div>
                            <p className="text-sm font-semibold">{notif.title}</p>
                            {!isExpanded && <p className="text-[11px] text-muted-foreground/50 mt-0.5 line-clamp-1">{notif.description}</p>}
                          </div>
                          <div className="shrink-0 mt-1">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground/40" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/40" />}
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 ml-11 space-y-3">
                          <p className="text-xs text-muted-foreground/70 leading-relaxed">{notif.description}</p>
                          {asset && (
                            <div className="flex items-center gap-1.5">
                              <Server className="h-3 w-3 text-muted-foreground/50" />
                              <span className="text-[10px] text-muted-foreground/60">{asset.name} ({asset.ipAddress})</span>
                            </div>
                          )}
                          {notif.proposedAction && (
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                              <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider mb-1">Proposed Action</p>
                              <p className="text-xs text-foreground/80 leading-relaxed">{notif.proposedAction}</p>
                            </div>
                          )}
                          {notif.humanResponse && (
                            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                              <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider mb-1">Human Response</p>
                              <p className="text-xs text-foreground/80 leading-relaxed">{notif.humanResponse}</p>
                            </div>
                          )}
                          {notif.actionStatus === "pending" && (
                            <div className="space-y-3 pt-1">
                              <div className="flex gap-2">
                                <Button
                                  size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
                                  onClick={() => updateMutation.mutate({ id: notif.id, updates: { actionStatus: "approved" } })}
                                  data-testid={`approve-${notif.id}`}
                                >
                                  <ThumbsUp className="h-3 w-3" /> Approve
                                </Button>
                                <Button
                                  size="sm" variant="destructive" className="gap-1.5 text-xs h-7"
                                  onClick={() => updateMutation.mutate({ id: notif.id, updates: { actionStatus: "rejected" } })}
                                  data-testid={`reject-${notif.id}`}
                                >
                                  <ThumbsDown className="h-3 w-3" /> Reject
                                </Button>
                              </div>
                              <div className="flex gap-2">
                                <Textarea
                                  value={responseText}
                                  onChange={e => setResponseText(e.target.value)}
                                  placeholder="Add a response to the agent..."
                                  className="text-xs min-h-[60px]"
                                  data-testid={`response-input-${notif.id}`}
                                />
                                <Button
                                  size="icon" className="shrink-0 h-[60px] w-10"
                                  disabled={!responseText.trim()}
                                  onClick={() => updateMutation.mutate({
                                    id: notif.id,
                                    updates: { humanResponse: responseText.trim(), actionStatus: "approved" }
                                  })}
                                  data-testid={`send-response-${notif.id}`}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {filteredNotifications.length === 0 && (
                <div className="p-10 text-center">
                  <BellOff className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground/50">No notifications matching filters</p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1">Try adjusting your filter criteria</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "kpis" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold">KPI Thresholds</span>
                <Badge variant="outline" className="text-[9px] h-5 border-border/30">{kpis?.length ?? 0} metrics</Badge>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> On target: {kpisOnTarget}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Off target: {kpisOffTarget}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {kpis?.map(kpi => (
                <KpiDetailCard
                  key={kpi.id}
                  kpi={kpi}
                  roleName={roleMap.get(kpi.agentRoleId)?.name ?? ""}
                />
              ))}
              {(!kpis || kpis.length === 0) && (
                <div className="col-span-full p-10 text-center">
                  <Target className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground/50">No KPI thresholds configured</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "calibration" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold">Threshold Calibration</span>
                <Badge variant="outline" className="text-[9px] h-5 border-border/30">{calibrations?.length ?? 0} calibrations</Badge>
              </div>
              {calibrations && calibrations.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => runCalibrationMutation.mutate()}
                    disabled={runCalibrationMutation.isPending}
                    data-testid="button-run-calibration"
                  >
                    {runCalibrationMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                    {runCalibrationMutation.isPending ? "Data Scientist Analyzing..." : "Run Variation Calibration"}
                  </Button>
                </div>
              )}
            </div>

            {fpAlertCount > 0 && (
              <Card className="overflow-hidden border-purple-500/20 bg-purple-500/5" data-testid="fp-summary-card">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <EyeOff className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">False Positive Summary</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {fpAlertCount} alert{fpAlertCount !== 1 ? "s" : ""} marked as false positives. 
                        {appliedCalCount > 0
                          ? ` The Data Scientist agent has auto-applied ${appliedCalCount} threshold adjustment${appliedCalCount !== 1 ? "s" : ""}${totalFpReduction > 0 ? `, reducing ${totalFpReduction} false positives` : ""}. More calibration runs with historical data will further improve accuracy.`
                          : " Run the variation calibration to auto-apply optimized thresholds."}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-400">{fpAlertCount}</p>
                        <p className="text-[9px] text-muted-foreground/50">Current FPs</p>
                      </div>
                      {totalFpReduction > 0 && (
                        <>
                          <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                          <div className="text-center">
                            <p className="text-2xl font-bold text-emerald-400">-{totalFpReduction}</p>
                            <p className="text-[9px] text-muted-foreground/50">Projected Reduction</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2.5">
              {calibrations?.map(cal => (
                <CalibrationCard
                  key={cal.id}
                  cal={cal}
                />
              ))}
              {(!calibrations || calibrations.length === 0) && (
                <div className="p-10 text-center">
                  <FlaskConical className="h-10 w-10 mx-auto text-purple-400/20 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground/60">No Threshold Calibrations</p>
                  <p className="text-xs text-muted-foreground/40 mt-1 max-w-md mx-auto">
                    The Data Scientist agent uses variation calibration to analyze your metric data and automatically apply optimal 
                    Warning / Normal / Critical thresholds — reducing false positives while maintaining detection accuracy. 
                    Each calibration run improves accuracy as more historical data is collected.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs mt-4"
                    onClick={() => runCalibrationMutation.mutate()}
                    disabled={runCalibrationMutation.isPending}
                    data-testid="button-run-calibration-empty"
                  >
                    {runCalibrationMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                    {runCalibrationMutation.isPending ? "Analyzing Metrics..." : "Run First Analysis"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "timeline" && (
          <EventCorrelationTimeline
            alerts={alerts}
            notifications={notifications}
            calibrations={calibrations}
            deviceMap={deviceMap}
            roleMap={roleMap}
            assetMap={assetMap}
          />
        )}
      </div>
    </ScrollArea>
  );
}
