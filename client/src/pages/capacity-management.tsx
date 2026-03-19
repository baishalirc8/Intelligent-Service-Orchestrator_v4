import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Gauge, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Minus, RefreshCw, Brain, Zap, Clock, Wifi, Timer, Activity,
  ArrowRight, Sparkles, Target, BarChart3, ShieldAlert,
  Plus, Trash2, CheckCheck, Pencil, Calendar, User, FileText,
  SlidersHorizontal, ListChecks, CalendarPlus, ThumbsUp, ThumbsDown, Bot,
} from "lucide-react";

type RiskLevel = "healthy" | "warning" | "critical" | "no_data";
type TrendDir = "improving" | "stable" | "degrading";

interface CapacityMetric {
  metricType: string;
  label: string;
  unit: string;
  latestValue: number;
  utilizationPct: number;
  riskLevel: RiskLevel;
  trend: TrendDir;
  trendSlope: number;
  forecastDaysToBreach: number | null;
  readingCount: number;
  history: Array<{ value: number; measuredAt: string }>;
  thresholds: { warning: number; critical: number };
  hasCustomThreshold: boolean;
}

interface ServiceCapacity {
  serviceName: string;
  riskLevel: RiskLevel;
  capacityScore: number | null;
  lastUpdated: string | null;
  metrics: CapacityMetric[];
}

interface CapacityOverview {
  services: ServiceCapacity[];
  summary: { total: number; healthy: number; warning: number; critical: number; noData: number };
}

interface AiCapacityResult {
  summary: string;
  overallRisk: string;
  services: Array<{
    serviceName: string;
    riskLevel: string;
    keyRisks: string[];
    recommendations: Array<{ action: string; urgency: string; rationale: string }>;
    forecastSummary: string | null;
  }>;
  topPriorityAction: string;
  analysedAt: string;
}

interface CapacityThreshold {
  id: string;
  serviceName: string;
  metricType: string;
  warningThreshold: number;
  criticalThreshold: number;
  higherIsBetter: boolean;
  updatedAt: string;
}

interface CapacityAction {
  id: string;
  serviceName: string;
  metricType: string | null;
  title: string;
  rationale: string | null;
  urgency: string;
  status: string;
  owner: string | null;
  dueDate: string | null;
  notes: string | null;
  source: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface CapacityDemandEvent {
  id: string;
  serviceName: string;
  title: string;
  description: string | null;
  expectedImpact: string | null;
  estimatedLoadIncreasePct: number | null;
  plannedDate: string;
  status: string;
  createdAt: string;
}

const DEFAULT_THRESHOLDS: Record<string, { warning: number; critical: number; higherIsBetter: boolean }> = {
  uptime:        { warning: 99.5, critical: 99.0, higherIsBetter: true  },
  error_rate:    { warning: 1,    critical: 3,    higherIsBetter: false },
  response_time: { warning: 60,   critical: 120,  higherIsBetter: false },
  mttr:          { warning: 240,  critical: 480,  higherIsBetter: false },
  throughput:    { warning: 0,    critical: 0,    higherIsBetter: true  },
};

const RISK_CFG: Record<RiskLevel, { color: string; bg: string; border: string; label: string; glow: string }> = {
  healthy:  { color: "text-green-500",  bg: "bg-green-500/5",  border: "border-green-500/30",  label: "Healthy",  glow: "shadow-[0_0_12px_-3px_hsl(142_71%_50%/0.25)]" },
  warning:  { color: "text-amber-500",  bg: "bg-amber-500/5",  border: "border-amber-500/30",  label: "Warning",  glow: "shadow-[0_0_12px_-3px_hsl(38_92%_50%/0.25)]"  },
  critical: { color: "text-red-500",    bg: "bg-red-500/5",    border: "border-red-500/30",    label: "Critical", glow: "shadow-[0_0_12px_-3px_hsl(0_84%_60%/0.25)]"   },
  no_data:  { color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border", label: "No Data", glow: "" },
};

const UTIL_COLOR = (pct: number) => pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-amber-500" : "bg-green-500";

const METRIC_ICON: Record<string, any> = {
  uptime: Wifi, error_rate: AlertTriangle, response_time: Timer, mttr: Clock, throughput: BarChart3,
};

const URGENCY_CFG: Record<string, { color: string; label: string }> = {
  immediate: { color: "text-red-500 border-red-500/30",   label: "Immediate" },
  soon:      { color: "text-amber-500 border-amber-500/30", label: "Soon"   },
  monitor:   { color: "text-muted-foreground",              label: "Monitor" },
};

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  suggested:   { color: "text-purple-500 border-purple-500/30", label: "AI Suggested" },
  open:        { color: "text-blue-500 border-blue-500/30",     label: "Open"         },
  in_progress: { color: "text-amber-500 border-amber-500/30",   label: "In Progress"  },
  resolved:    { color: "text-green-500 border-green-500/30",   label: "Resolved"     },
};

const DEMAND_STATUS_CFG: Record<string, { color: string; label: string }> = {
  planned:   { color: "text-blue-500 border-blue-500/30",   label: "Planned"   },
  confirmed: { color: "text-amber-500 border-amber-500/30", label: "Confirmed" },
  cancelled: { color: "text-muted-foreground",               label: "Cancelled" },
  completed: { color: "text-green-500 border-green-500/30", label: "Completed" },
};

function TrendIcon({ trend }: { trend: TrendDir }) {
  if (trend === "improving") return <TrendingDown className="h-3 w-3 text-green-500" />;
  if (trend === "degrading") return <TrendingUp className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function CapacityScoreRing({ score, risk }: { score: number | null; risk: RiskLevel }) {
  const cfg = RISK_CFG[risk];
  if (score === null) return (
    <div className="h-16 w-16 rounded-full border-4 border-border flex items-center justify-center shrink-0">
      <span className="text-[10px] text-muted-foreground">N/A</span>
    </div>
  );
  return (
    <div className={`h-16 w-16 rounded-full border-4 ${score >= 70 ? "border-green-500/60" : score >= 40 ? "border-amber-500/60" : "border-red-500/60"} flex flex-col items-center justify-center shrink-0 ${cfg.glow}`}>
      <span className={`text-lg font-bold leading-none ${cfg.color}`}>{score}</span>
      <span className="text-[8px] text-muted-foreground">/ 100</span>
    </div>
  );
}

function UtilBar({ metric }: { metric: CapacityMetric }) {
  const Icon = METRIC_ICON[metric.metricType] ?? Activity;
  const risk = RISK_CFG[metric.riskLevel];
  const formattedVal = metric.metricType === "uptime"
    ? `${metric.latestValue.toFixed(2)}%`
    : `${metric.latestValue}${metric.unit}`;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`h-3 w-3 shrink-0 ${risk.color}`} />
          <span className="text-muted-foreground truncate">{metric.label}</span>
          <TrendIcon trend={metric.trend} />
          {metric.hasCustomThreshold && (
            <span title="Custom threshold active">
              <SlidersHorizontal className="h-2.5 w-2.5 text-primary/60" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`font-semibold ${risk.color}`}>{formattedVal}</span>
          <span className="text-muted-foreground/60">{metric.utilizationPct}%</span>
          {metric.forecastDaysToBreach !== null && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-red-500/40 text-red-500">
              ⚠ {metric.forecastDaysToBreach}d
            </Badge>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${UTIL_COLOR(metric.utilizationPct)}`}
          style={{ width: `${Math.min(100, metric.utilizationPct)}%` }} />
      </div>
    </div>
  );
}

function ThresholdDialog({ svc, thresholds, onClose }: {
  svc: ServiceCapacity;
  thresholds: CapacityThreshold[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [vals, setVals] = useState<Record<string, { warning: string; critical: string; higherIsBetter: boolean }>>(() => {
    const init: Record<string, { warning: string; critical: string; higherIsBetter: boolean }> = {};
    svc.metrics.forEach(m => {
      const custom = thresholds.find(t => t.serviceName === svc.serviceName && t.metricType === m.metricType);
      const def = DEFAULT_THRESHOLDS[m.metricType];
      init[m.metricType] = {
        warning: String(custom?.warningThreshold ?? def?.warning ?? m.thresholds.warning),
        critical: String(custom?.criticalThreshold ?? def?.critical ?? m.thresholds.critical),
        higherIsBetter: custom?.higherIsBetter ?? def?.higherIsBetter ?? false,
      };
    });
    return init;
  });

  const upsertMut = useMutation({
    mutationFn: async (data: { metricType: string; warning: number; critical: number; higherIsBetter: boolean }) => {
      const res = await apiRequest("PUT", "/api/capacity/thresholds", {
        serviceName: svc.serviceName, metricType: data.metricType,
        warningThreshold: data.warning, criticalThreshold: data.critical, higherIsBetter: data.higherIsBetter,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/thresholds"] });
    },
    onError: () => toast({ title: "Failed to save threshold", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (metricType: string) => {
      const custom = thresholds.find(t => t.serviceName === svc.serviceName && t.metricType === metricType);
      if (!custom) return;
      const res = await apiRequest("DELETE", `/api/capacity/thresholds/${custom.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/thresholds"] });
      toast({ title: "Threshold reset to default" });
    },
  });

  const handleSaveAll = async () => {
    for (const [metricType, v] of Object.entries(vals)) {
      const w = parseFloat(v.warning);
      const c = parseFloat(v.critical);
      if (!isNaN(w) && !isNaN(c)) {
        await upsertMut.mutateAsync({ metricType, warning: w, critical: c, higherIsBetter: v.higherIsBetter });
      }
    }
    toast({ title: "Thresholds saved" });
    onClose();
  };

  return (
    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Thresholds — {svc.serviceName}
        </DialogTitle>
        <p className="text-xs text-muted-foreground mt-1">Set warning and critical levels per metric. Custom thresholds override the global defaults and affect utilisation calculations.</p>
      </DialogHeader>
      <div className="space-y-5 py-2">
        {svc.metrics.map(m => {
          const v = vals[m.metricType] ?? { warning: "", critical: "", higherIsBetter: false };
          const hasCustom = thresholds.some(t => t.serviceName === svc.serviceName && t.metricType === m.metricType);
          const def = DEFAULT_THRESHOLDS[m.metricType];
          return (
            <div key={m.metricType} className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{m.label}</span>
                <div className="flex items-center gap-2">
                  {hasCustom && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-primary border-primary/30">Custom</Badge>
                  )}
                  {hasCustom && (
                    <button
                      onClick={() => deleteMut.mutate(m.metricType)}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                      data-testid={`button-reset-threshold-${m.metricType}`}
                    >Reset</button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-amber-500">Warning{def ? ` (default: ${def.warning})` : ""}</Label>
                  <Input
                    type="number"
                    value={v.warning}
                    onChange={e => setVals(prev => ({ ...prev, [m.metricType]: { ...prev[m.metricType], warning: e.target.value } }))}
                    className="h-8 text-xs"
                    data-testid={`input-threshold-warning-${m.metricType}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-red-500">Critical{def ? ` (default: ${def.critical})` : ""}</Label>
                  <Input
                    type="number"
                    value={v.critical}
                    onChange={e => setVals(prev => ({ ...prev, [m.metricType]: { ...prev[m.metricType], critical: e.target.value } }))}
                    className="h-8 text-xs"
                    data-testid={`input-threshold-critical-${m.metricType}`}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={v.higherIsBetter}
                  onCheckedChange={val => setVals(prev => ({ ...prev, [m.metricType]: { ...prev[m.metricType], higherIsBetter: val } }))}
                  id={`hib-${m.metricType}`}
                  data-testid={`switch-higher-is-better-${m.metricType}`}
                />
                <Label htmlFor={`hib-${m.metricType}`} className="text-xs text-muted-foreground cursor-pointer">Higher value is better (e.g. uptime, throughput)</Label>
              </div>
            </div>
          );
        })}
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSaveAll} disabled={upsertMut.isPending} data-testid="button-save-thresholds">
          Save All Thresholds
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ServiceCard({ svc, thresholds, aiData }: {
  svc: ServiceCapacity;
  thresholds: CapacityThreshold[];
  aiData?: AiCapacityResult["services"][0];
}) {
  const cfg = RISK_CFG[svc.riskLevel];
  const [showThresholds, setShowThresholds] = useState(false);
  const nearestForecast = svc.metrics
    .filter(m => m.forecastDaysToBreach !== null)
    .sort((a, b) => (a.forecastDaysToBreach ?? 999) - (b.forecastDaysToBreach ?? 999))[0];

  return (
    <>
      <Card className={`border ${cfg.border} ${cfg.bg} ${cfg.glow}`} data-testid={`card-capacity-${svc.serviceName.toLowerCase().replace(/\s+/g, "-")}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <CapacityScoreRing score={svc.capacityScore} risk={svc.riskLevel} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1 mb-1">
                <h3 className="font-semibold text-sm truncate">{svc.serviceName}</h3>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${cfg.color} border-current/30`}>
                  {cfg.label}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">{svc.metrics.length} metric{svc.metrics.length !== 1 ? "s" : ""} tracked</p>
              {svc.lastUpdated && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Updated {new Date(svc.lastUpdated).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {svc.metrics.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 text-center py-2">No readings recorded yet</p>
          ) : (
            <div className="space-y-2.5">
              {svc.metrics.map(m => <UtilBar key={m.metricType} metric={m} />)}
            </div>
          )}

          {nearestForecast && (
            <div className="mt-3 p-2 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <p className="text-[10px] text-red-600 dark:text-red-400 flex-1">
                <strong>{nearestForecast.label}</strong> breach forecast in ~<strong>{nearestForecast.forecastDaysToBreach}d</strong>
              </p>
            </div>
          )}

          {aiData && aiData.recommendations.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-primary">AI Recommendations</p>
              {aiData.recommendations.slice(0, 2).map((r, i) => (
                <div key={i} className="p-2 rounded border border-primary/10 bg-primary/5 text-[10px]">
                  <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                    <span className="font-medium flex-1 min-w-0">{r.action}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3 shrink-0 ${URGENCY_CFG[r.urgency]?.color ?? "text-muted-foreground"}`}>
                      {r.urgency}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground break-words">{r.rationale}</p>
                </div>
              ))}
            </div>
          )}

          {svc.metrics.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 h-7 text-xs"
              onClick={() => setShowThresholds(true)}
              data-testid={`button-edit-thresholds-${svc.serviceName.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <SlidersHorizontal className="h-3 w-3 mr-1.5" />Edit Thresholds
            </Button>
          )}
        </CardContent>
      </Card>

      {showThresholds && (
        <Dialog open onOpenChange={open => !open && setShowThresholds(false)}>
          <ThresholdDialog svc={svc} thresholds={thresholds} onClose={() => setShowThresholds(false)} />
        </Dialog>
      )}
    </>
  );
}

function ActionDialog({
  action, serviceNames, onClose,
}: {
  action?: CapacityAction;
  serviceNames: string[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    serviceName: action?.serviceName ?? (serviceNames[0] ?? ""),
    metricType: action?.metricType ?? "",
    title: action?.title ?? "",
    rationale: action?.rationale ?? "",
    urgency: action?.urgency ?? "monitor",
    status: action?.status ?? "open",
    owner: action?.owner ?? "",
    dueDate: action?.dueDate ?? "",
    notes: action?.notes ?? "",
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/capacity/actions", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/actions"] });
      toast({ title: "Action created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create action", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/capacity/actions/${action!.id}`, form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/actions"] });
      toast({ title: "Action updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update action", variant: "destructive" }),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" />
          {action ? "Edit Action" : "New Capacity Action"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Service *</Label>
            <Select value={form.serviceName} onValueChange={v => setForm(p => ({ ...p, serviceName: v }))}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-action-service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {serviceNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Metric (optional)</Label>
            <Select value={form.metricType || "none"} onValueChange={v => setForm(p => ({ ...p, metricType: v === "none" ? "" : v }))}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-action-metric">
                <SelectValue placeholder="All metrics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All metrics</SelectItem>
                <SelectItem value="uptime">Uptime</SelectItem>
                <SelectItem value="error_rate">Error Rate</SelectItem>
                <SelectItem value="response_time">Response Time</SelectItem>
                <SelectItem value="mttr">MTTR</SelectItem>
                <SelectItem value="throughput">Throughput</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Action Title *</Label>
          <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Scale ERP database connection pool" className="h-8 text-xs"
            data-testid="input-action-title" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rationale</Label>
          <Textarea value={form.rationale} onChange={e => setForm(p => ({ ...p, rationale: e.target.value }))}
            placeholder="Why is this action needed?" className="text-xs resize-none" rows={2}
            data-testid="textarea-action-rationale" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Urgency</Label>
            <Select value={form.urgency} onValueChange={v => setForm(p => ({ ...p, urgency: v }))}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-action-urgency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="soon">Soon</SelectItem>
                <SelectItem value="monitor">Monitor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-action-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Owner</Label>
            <Input value={form.owner} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))}
              placeholder="Name or team" className="h-8 text-xs" data-testid="input-action-owner" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
              className="h-8 text-xs" data-testid="input-action-due-date" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Additional notes..." className="text-xs resize-none" rows={2}
            data-testid="textarea-action-notes" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => action ? updateMut.mutate() : createMut.mutate()} disabled={!form.title || !form.serviceName || isPending}
          data-testid="button-save-action">
          {action ? "Save Changes" : "Create Action"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function DemandEventDialog({ event, serviceNames, onClose }: {
  event?: CapacityDemandEvent;
  serviceNames: string[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    serviceName: event?.serviceName ?? (serviceNames[0] ?? ""),
    title: event?.title ?? "",
    description: event?.description ?? "",
    expectedImpact: event?.expectedImpact ?? "",
    estimatedLoadIncreasePct: event?.estimatedLoadIncreasePct ? String(event.estimatedLoadIncreasePct) : "",
    plannedDate: event?.plannedDate ?? "",
    status: event?.status ?? "planned",
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, estimatedLoadIncreasePct: form.estimatedLoadIncreasePct ? parseFloat(form.estimatedLoadIncreasePct) : null };
      const res = await apiRequest("POST", "/api/capacity/demand-events", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/demand-events"] });
      toast({ title: "Demand event created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create demand event", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, estimatedLoadIncreasePct: form.estimatedLoadIncreasePct ? parseFloat(form.estimatedLoadIncreasePct) : null };
      const res = await apiRequest("PATCH", `/api/capacity/demand-events/${event!.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/demand-events"] });
      toast({ title: "Demand event updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update demand event", variant: "destructive" }),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="h-4 w-4 text-primary" />
          {event ? "Edit Demand Event" : "Log Demand Event"}
        </DialogTitle>
        <p className="text-xs text-muted-foreground mt-1">Record anticipated business demand changes that may affect service capacity.</p>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Service *</Label>
            <Select value={form.serviceName} onValueChange={v => setForm(p => ({ ...p, serviceName: v }))}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-demand-service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {serviceNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Planned Date *</Label>
            <Input type="date" value={form.plannedDate} onChange={e => setForm(p => ({ ...p, plannedDate: e.target.value }))}
              className="h-8 text-xs" data-testid="input-demand-date" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Event Title *</Label>
          <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Black Friday peak traffic, ERP go-live, Customer migration"
            className="h-8 text-xs" data-testid="input-demand-title" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Describe the expected demand change..." className="text-xs resize-none" rows={2}
            data-testid="textarea-demand-description" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Est. Load Increase %</Label>
            <Input type="number" value={form.estimatedLoadIncreasePct}
              onChange={e => setForm(p => ({ ...p, estimatedLoadIncreasePct: e.target.value }))}
              placeholder="e.g. 40" className="h-8 text-xs" data-testid="input-demand-load-pct" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-demand-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Expected Impact</Label>
          <Textarea value={form.expectedImpact} onChange={e => setForm(p => ({ ...p, expectedImpact: e.target.value }))}
            placeholder="Which services/metrics will be most affected?" className="text-xs resize-none" rows={2}
            data-testid="textarea-demand-impact" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => event ? updateMut.mutate() : createMut.mutate()}
          disabled={!form.title || !form.serviceName || !form.plannedDate || isPending}
          data-testid="button-save-demand-event">
          {event ? "Save Changes" : "Log Event"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function CapacityManagementPage() {
  const { toast } = useToast();
  const [aiResult, setAiResult] = useState<AiCapacityResult | null>(null);
  const [editAction, setEditAction] = useState<CapacityAction | "new" | null>(null);
  const [editDemand, setEditDemand] = useState<CapacityDemandEvent | "new" | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data, isLoading, refetch } = useQuery<CapacityOverview>({ queryKey: ["/api/capacity/overview"] });
  const { data: thresholds = [] } = useQuery<CapacityThreshold[]>({ queryKey: ["/api/capacity/thresholds"] });
  const { data: actions = [], isLoading: actionsLoading } = useQuery<CapacityAction[]>({ queryKey: ["/api/capacity/actions"] });
  const { data: demandEvents = [], isLoading: demandsLoading } = useQuery<CapacityDemandEvent[]>({ queryKey: ["/api/capacity/demand-events"] });

  const aiMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/capacity/ai-analyse");
      return res.json();
    },
    onSuccess: (data: AiCapacityResult) => {
      setAiResult(data);
      toast({ title: "AI capacity analysis complete" });
    },
    onError: (err: any) => {
      toast({ title: err?.message?.includes("cooldown") ? err.message : "AI analysis failed", variant: "destructive" });
    },
  });

  const deleteActionMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/capacity/actions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/actions"] });
      toast({ title: "Action deleted" });
    },
  });

  const patchActionMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/capacity/actions/${id}`, { status });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/capacity/actions"] }),
  });

  const deleteDemandMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/capacity/demand-events/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/demand-events"] });
      toast({ title: "Demand event deleted" });
    },
  });

  const services = data?.services ?? [];
  const summary = data?.summary ?? { total: 0, healthy: 0, warning: 0, critical: 0, noData: 0 };
  const serviceNames = services.map(s => s.serviceName);

  const suggestedActions = actions.filter(a => a.status === "suggested");
  const regularActions = actions.filter(a => a.status !== "suggested");
  const filteredActions = actionFilter === "all" ? regularActions : regularActions.filter(a => a.status === actionFilter);
  const openActions = regularActions.filter(a => a.status !== "resolved").length;
  const pendingApprovals = suggestedActions.length;
  const upcomingDemands = demandEvents.filter(d => d.status === "planned" || d.status === "confirmed").length;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Gauge className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />Capacity Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            ITIL Capacity &amp; Performance — utilisation trends, threshold monitoring, and AI forecasting.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/capacity/actions"] }); queryClient.invalidateQueries({ queryKey: ["/api/capacity/demand-events"] }); }} data-testid="button-refresh-capacity">
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => aiMut.mutate()} disabled={aiMut.isPending} data-testid="button-ai-capacity">
            {aiMut.isPending
              ? <><Brain className="h-3.5 w-3.5 animate-pulse sm:mr-1" /><span className="hidden sm:inline">Analysing…</span></>
              : <><Zap className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">AI Forecast</span></>}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {!isLoading && services.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Services",  value: summary.total,    color: "text-primary",   icon: Gauge        },
            { label: "Healthy",   value: summary.healthy,  color: "text-green-500", icon: CheckCircle2 },
            { label: "Warning",   value: summary.warning,  color: "text-amber-500", icon: AlertTriangle},
            { label: "Critical",  value: summary.critical, color: "text-red-500",   icon: ShieldAlert  },
          ].map(s => (
            <Card key={s.label} className="border border-border">
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI result panel */}
      {aiResult && (
        <Card className={`border ${aiResult.overallRisk === "critical" ? "border-red-500/30 bg-red-500/5" : aiResult.overallRisk === "high" ? "border-amber-500/30 bg-amber-500/5" : "border-primary/20 bg-primary/5"}`}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-sm">AI Capacity Intelligence</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary shrink-0">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />GPT-4o
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${aiResult.overallRisk === "critical" ? "text-red-500" : aiResult.overallRisk === "high" ? "text-amber-500" : "text-green-500"}`}>
                    Risk: {aiResult.overallRisk}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{aiResult.summary}</p>
              </div>
            </div>
            {aiResult.topPriorityAction && (
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2">
                <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-0.5">Top Priority Action</p>
                  <p className="text-xs text-muted-foreground break-words">{aiResult.topPriorityAction}</p>
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-3">Analysed: {new Date(aiResult.analysedAt).toLocaleString()}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">
            <Gauge className="h-3.5 w-3.5 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-xs" data-testid="tab-actions">
            <ListChecks className="h-3.5 w-3.5 mr-1.5" />Actions
            {(openActions + pendingApprovals) > 0 && (
              <Badge className={`ml-1.5 h-4 px-1 text-[9px] ${pendingApprovals > 0 ? "bg-purple-500 hover:bg-purple-500" : ""}`}>
                {openActions + pendingApprovals}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="demand" className="text-xs" data-testid="tab-demand">
            <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />Demand Events
            {upcomingDemands > 0 && <Badge className="ml-1.5 h-4 px-1 text-[9px]">{upcomingDemands}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
            </div>
          )}
          {!isLoading && services.length === 0 && (
            <Card className="border border-dashed border-border">
              <CardContent className="p-10 text-center">
                <Gauge className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium mb-1">No capacity data yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Capacity tracking begins once services have metric readings in the <strong>Service Health Monitor</strong>.
                </p>
                <Button size="sm" variant="outline" onClick={() => window.location.href = "/service-health"}>
                  <ArrowRight className="h-3.5 w-3.5 mr-1" />Go to Service Health
                </Button>
              </CardContent>
            </Card>
          )}
          {services.length > 0 && (
            <>
              {services.some(s => s.metrics.some(m => m.forecastDaysToBreach !== null)) && (
                <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Capacity breach forecasts detected</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      One or more services show degrading trends. Run <strong>AI Forecast</strong> for detailed recommendations.
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...services]
                  .sort((a, b) => {
                    const order: Record<RiskLevel, number> = { critical: 0, warning: 1, healthy: 2, no_data: 3 };
                    return order[a.riskLevel] - order[b.riskLevel];
                  })
                  .map(svc => (
                    <ServiceCard key={svc.serviceName} svc={svc} thresholds={thresholds} aiData={aiResult?.services.find(s => s.serviceName === svc.serviceName)} />
                  ))}
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
                <span className="font-medium">Utilisation bars:</span>
                <span className="flex items-center gap-1"><span className="h-2 w-6 rounded bg-green-500 inline-block" /> &lt; 50% — Healthy</span>
                <span className="flex items-center gap-1"><span className="h-2 w-6 rounded bg-amber-500 inline-block" /> 50–79% — Warning</span>
                <span className="flex items-center gap-1"><span className="h-2 w-6 rounded bg-red-500 inline-block" /> ≥ 80% — Critical</span>
                <span className="flex items-center gap-1"><SlidersHorizontal className="h-3 w-3 text-primary/60" /> Custom threshold active</span>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Actions Tab ── */}
        <TabsContent value="actions" className="mt-4 space-y-4">

          {/* AI Suggestions — pending human approval */}
          {suggestedActions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pb-1 border-b border-purple-500/20">
                <Bot className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">AI Suggested Actions</span>
                <Badge className="h-4 px-1.5 text-[9px] bg-purple-500 hover:bg-purple-500">{suggestedActions.length}</Badge>
                <span className="text-[10px] text-muted-foreground ml-1">— review and approve or dismiss each suggestion</span>
              </div>
              {suggestedActions.map(action => {
                const urgCfg = URGENCY_CFG[action.urgency] ?? URGENCY_CFG.monitor;
                return (
                  <Card key={action.id} className="border border-purple-500/25 bg-purple-500/5"
                    data-testid={`card-suggestion-${action.id}`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium truncate">{action.title}</span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${urgCfg.color}`}>{urgCfg.label}</Badge>
                          </div>
                          <p className="text-[10px] font-medium text-purple-600 dark:text-purple-400 mb-0.5">{action.serviceName}</p>
                          {action.rationale && <p className="text-[10px] text-muted-foreground/80 line-clamp-3">{action.rationale}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => patchActionMut.mutate({ id: action.id, status: "open" })}
                            disabled={patchActionMut.isPending}
                            title="Approve — move to action queue"
                            data-testid={`button-approve-suggestion-${action.id}`}
                          >
                            <ThumbsUp className="h-3 w-3 mr-1" />Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:text-destructive"
                            onClick={() => deleteActionMut.mutate(action.id)}
                            title="Dismiss suggestion"
                            data-testid={`button-dismiss-suggestion-${action.id}`}
                          >
                            <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Active action queue */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {suggestedActions.length > 0 && (
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Queue</span>
                )}
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-action-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{filteredActions.length} action{filteredActions.length !== 1 ? "s" : ""}</span>
              </div>
              <Button size="sm" onClick={() => setEditAction("new")} data-testid="button-new-action">
                <Plus className="h-3.5 w-3.5 mr-1" />New Action
              </Button>
            </div>

            {actionsLoading && <Skeleton className="h-32 rounded-lg" />}

            {!actionsLoading && filteredActions.length === 0 && suggestedActions.length === 0 && (
              <Card className="border border-dashed border-border">
                <CardContent className="p-8 text-center">
                  <ListChecks className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm font-medium mb-1">No actions yet</p>
                  <p className="text-xs text-muted-foreground">
                    Run <strong>AI Forecast</strong> to generate suggested actions, or click <strong>New Action</strong> to add one manually.
                  </p>
                </CardContent>
              </Card>
            )}

            {!actionsLoading && filteredActions.length === 0 && suggestedActions.length > 0 && (
              <p className="text-xs text-center text-muted-foreground py-4">No approved actions yet — approve AI suggestions above to add them to the queue.</p>
            )}

            <div className="space-y-2">
              {filteredActions.map(action => {
                const urgCfg = URGENCY_CFG[action.urgency] ?? URGENCY_CFG.monitor;
                const stsCfg = STATUS_CFG[action.status] ?? STATUS_CFG.open;
                return (
                  <Card key={action.id} className={`border border-border ${action.status === "resolved" ? "opacity-60" : ""}`}
                    data-testid={`card-action-${action.id}`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium truncate">{action.title}</span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${urgCfg.color}`}>{urgCfg.label}</Badge>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${stsCfg.color}`}>{stsCfg.label}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                            <span className="font-medium">{action.serviceName}</span>
                            {action.metricType && <span>· {action.metricType}</span>}
                            {action.owner && <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5" />{action.owner}</span>}
                            {action.dueDate && <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />Due {action.dueDate}</span>}
                            {action.source === "ai_agent" && <Badge variant="outline" className="text-[9px] px-1 py-0 h-3 text-purple-500 border-purple-500/30">AI origin</Badge>}
                          </div>
                          {action.rationale && <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-2">{action.rationale}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {action.status !== "resolved" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => patchActionMut.mutate({ id: action.id, status: action.status === "open" ? "in_progress" : "resolved" })}
                              title={action.status === "open" ? "Start" : "Resolve"}
                              data-testid={`button-progress-action-${action.id}`}>
                              <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditAction(action)}
                            title="Edit" data-testid={`button-edit-action-${action.id}`}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteActionMut.mutate(action.id)}
                            title="Delete" data-testid={`button-delete-action-${action.id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive/60" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ── Demand Events Tab ── */}
        <TabsContent value="demand" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{demandEvents.length} demand event{demandEvents.length !== 1 ? "s" : ""} logged</p>
            <Button size="sm" onClick={() => setEditDemand("new")} data-testid="button-new-demand-event">
              <Plus className="h-3.5 w-3.5 mr-1" />Log Demand Event
            </Button>
          </div>

          {demandsLoading && <Skeleton className="h-32 rounded-lg" />}

          {!demandsLoading && demandEvents.length === 0 && (
            <Card className="border border-dashed border-border">
              <CardContent className="p-8 text-center">
                <CalendarPlus className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm font-medium mb-1">No demand events yet</p>
                <p className="text-xs text-muted-foreground">Record anticipated business demand changes so capacity forecasts account for known future load — seasonal peaks, go-lives, migrations.</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {demandEvents.map(ev => {
              const stsCfg = DEMAND_STATUS_CFG[ev.status] ?? DEMAND_STATUS_CFG.planned;
              return (
                <Card key={ev.id} className={`border border-border ${ev.status === "cancelled" || ev.status === "completed" ? "opacity-60" : ""}`}
                  data-testid={`card-demand-${ev.id}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium truncate">{ev.title}</span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${stsCfg.color}`}>{stsCfg.label}</Badge>
                          {ev.estimatedLoadIncreasePct != null && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 text-primary border-primary/30">
                              +{ev.estimatedLoadIncreasePct}% load
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span className="font-medium">{ev.serviceName}</span>
                          <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{ev.plannedDate}</span>
                        </div>
                        {ev.description && <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-2">{ev.description}</p>}
                        {ev.expectedImpact && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-start gap-0.5">
                            <FileText className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{ev.expectedImpact}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditDemand(ev)}
                          title="Edit" data-testid={`button-edit-demand-${ev.id}`}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteDemandMut.mutate(ev.id)}
                          title="Delete" data-testid={`button-delete-demand-${ev.id}`}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive/60" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      {editAction !== null && (
        <Dialog open onOpenChange={open => !open && setEditAction(null)}>
          <ActionDialog
            action={editAction === "new" ? undefined : editAction}
            serviceNames={serviceNames.length > 0 ? serviceNames : ["General"]}
            onClose={() => setEditAction(null)}
          />
        </Dialog>
      )}

      {/* Demand Event Dialog */}
      {editDemand !== null && (
        <Dialog open onOpenChange={open => !open && setEditDemand(null)}>
          <DemandEventDialog
            event={editDemand === "new" ? undefined : editDemand}
            serviceNames={serviceNames.length > 0 ? serviceNames : ["General"]}
            onClose={() => setEditDemand(null)}
          />
        </Dialog>
      )}
    </div>
  );
}
