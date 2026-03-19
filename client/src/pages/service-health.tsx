import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, Timer, TrendingUp,
  Globe, Building2, Sparkles, Brain, Zap, RefreshCw,
  Layers, Clock, Wifi, BarChart3, Target, Upload, Info,
  ShieldCheck, ChevronDown, ChevronRight, Eye, PenLine,
  ArrowRight,
} from "lucide-react";

const CORE_METRICS = [
  {
    type: "uptime",
    label: "Uptime",
    unit: "%",
    icon: Wifi,
    color: "text-green-500",
    bg: "bg-green-500/5 border-green-500/15",
    description: "Service availability over the monitoring period",
    placeholder: "99.9",
    hint: "Typical target: 99.5% – 99.99%",
    max: 100,
    min: 0,
    step: 0.01,
  },
  {
    type: "response_time",
    label: "Avg Response Time",
    unit: "min",
    icon: Timer,
    color: "text-blue-500",
    bg: "bg-blue-500/5 border-blue-500/15",
    description: "Average time to first response on tickets/incidents",
    placeholder: "15",
    hint: "Compare to your SLA response target",
    min: 0,
    step: 1,
  },
  {
    type: "mttr",
    label: "MTTR",
    unit: "min",
    icon: Clock,
    color: "text-orange-500",
    bg: "bg-orange-500/5 border-orange-500/15",
    description: "Mean Time to Resolve — average incident resolution time",
    placeholder: "240",
    hint: "Compare to your SLA resolution target",
    min: 0,
    step: 1,
  },
  {
    type: "error_rate",
    label: "Error Rate",
    unit: "%",
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-500/5 border-red-500/15",
    description: "Percentage of requests / operations that fail",
    placeholder: "0.5",
    hint: "Typical target: < 1%",
    max: 100,
    min: 0,
    step: 0.01,
  },
  {
    type: "throughput",
    label: "Throughput",
    unit: "req/s",
    icon: Activity,
    color: "text-purple-500",
    bg: "bg-purple-500/5 border-purple-500/15",
    description: "Requests or transactions per second",
    placeholder: "500",
    hint: "Baseline throughput for capacity planning",
    min: 0,
    step: 1,
  },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; glow: string; icon: typeof CheckCircle2 }> = {
  healthy:  { color: "text-green-500",  bg: "border-green-500/30 bg-green-500/5",  label: "Healthy",   glow: "shadow-[0_0_12px_-3px_hsl(142_71%_50%/0.3)]", icon: CheckCircle2 },
  at_risk:  { color: "text-amber-500",  bg: "border-amber-500/30 bg-amber-500/5",  label: "At Risk",   glow: "shadow-[0_0_12px_-3px_hsl(38_92%_50%/0.3)]",  icon: AlertTriangle },
  breaching:{ color: "text-red-500",    bg: "border-red-500/30 bg-red-500/5",      label: "Breaching", glow: "shadow-[0_0_12px_-3px_hsl(0_84%_60%/0.3)]",   icon: AlertTriangle },
  degraded: { color: "text-amber-500",  bg: "border-amber-500/30 bg-amber-500/5",  label: "Degraded",  glow: "",                                              icon: AlertTriangle },
  critical: { color: "text-red-500",    bg: "border-red-500/30 bg-red-500/5",      label: "Critical",  glow: "",                                              icon: AlertTriangle },
  no_data:  { color: "text-muted-foreground", bg: "border-dashed border-border bg-muted/10", label: "No Data", glow: "", icon: Eye },
};

function formatMins(mins: number | null | undefined): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${(mins / 60) % 1 === 0 ? mins / 60 : (mins / 60).toFixed(1)}h`;
  return `${(mins / 1440) % 1 === 0 ? mins / 1440 : (mins / 1440).toFixed(1)}d`;
}

function ComplianceBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground italic">No readings yet</span>;
  const color = score >= 90 ? "bg-green-500" : score >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">Compliance</span>
        <span className={`font-bold ${score >= 90 ? "text-green-500" : score >= 70 ? "text-amber-500" : "text-red-500"}`}>{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

interface MetricReading {
  value: number; unit: string; measuredAt: string; source: string;
}
interface ServiceHealth {
  serviceName: string;
  slaCount: number; olaCount: number;
  slaDetails: any[]; olaDetails: any[];
  agreedTargets: { responseTimeMinutes: number | null; resolutionTimeMinutes: number | null };
  metrics: {
    uptime: MetricReading | null;
    errorRate: MetricReading | null;
    responseTime: MetricReading | null;
    throughput: MetricReading | null;
    mttr: MetricReading | null;
  };
  complianceScore: number | null;
  totalReadings: number;
  lastUpdated: string | null;
}
interface AiAnalysis {
  overallHealthScore: number; status: string; summary: string;
  services: { serviceName: string; complianceScore: number; status: string; gaps: any[]; positives: string[]; recommendations: { action: string; rationale: string; urgency: string }[] }[];
  topPriorityAction: string; analysedAt: string;
}

// ─── Bulk Record Metrics Dialog ─────────────────────────────────────────────
function RecordMetricsDialog({ serviceName, service, open, onClose }: {
  serviceName: string;
  service: ServiceHealth | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [source, setSource] = useState("manual");
  const [customSource, setCustomSource] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const effectiveSource = source === "custom" ? customSource : source;

  const pushMut = useMutation({
    mutationFn: (readings: any[]) => apiRequest("POST", "/api/service-health/readings", readings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-health"] });
      toast({ title: `Metrics recorded for ${serviceName}` });
      setValues({});
      onClose();
    },
    onError: () => toast({ title: "Failed to save readings", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const readings: any[] = [];
    for (const m of CORE_METRICS) {
      const raw = values[m.type];
      if (raw !== undefined && raw !== "" && !isNaN(parseFloat(raw))) {
        readings.push({
          serviceName,
          metricType: m.type,
          value: parseFloat(raw),
          unit: m.unit,
          source: effectiveSource || "manual",
          note: null,
        });
      }
    }
    if (readings.length === 0) {
      toast({ title: "Enter at least one metric value", variant: "destructive" });
      return;
    }
    pushMut.mutate(readings);
  }

  const missingMetrics = CORE_METRICS.filter(m => {
    const key = m.type === "error_rate" ? "errorRate" : m.type === "response_time" ? "responseTime" : m.type as keyof ServiceHealth["metrics"];
    return !service?.metrics[key as keyof typeof service.metrics];
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <PenLine className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">Record Metrics — {serviceName}</span>
          </DialogTitle>
          <DialogDescription>
            Manually record current metric values for this service. Leave blank to skip any metric. These readings will appear on the Service Health dashboard and be used by the AI analysis.
          </DialogDescription>
        </DialogHeader>

        {service && (service.slaDetails.length > 0 || service.olaDetails.length > 0) && (
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2 text-xs mb-2">
            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div>
              <strong className="text-primary">Agreed targets for reference: </strong>
              Response: <strong>{formatMins(service.agreedTargets.responseTimeMinutes)}</strong>,
              Resolution/MTTR: <strong>{formatMins(service.agreedTargets.resolutionTimeMinutes)}</strong>
              {service.slaDetails.length > 0 && (
                <span className="ml-2 text-muted-foreground">({service.slaCount} SLA, {service.olaCount} OLA)</span>
              )}
            </div>
          </div>
        )}

        {missingMetrics.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{missingMetrics.length} metric{missingMetrics.length !== 1 ? "s" : ""} not yet recorded: {missingMetrics.map(m => m.label).join(", ")}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {CORE_METRICS.map(m => {
            const metricKey = m.type === "error_rate" ? "errorRate" : m.type === "response_time" ? "responseTime" : m.type as keyof ServiceHealth["metrics"];
            const existing = service?.metrics[metricKey as keyof typeof service.metrics] as MetricReading | null;
            const Icon = m.icon;

            return (
              <div key={m.type} className={`p-3 rounded-lg border ${m.bg}`} data-testid={`metric-input-${m.type}`}>
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border`}>
                    <Icon className={`h-4 w-4 ${m.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <Label className="text-xs font-semibold">{m.label}</Label>
                      <span className="text-[10px] text-muted-foreground shrink-0">{m.unit}</span>
                      {existing && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 max-w-full truncate">
                          Current: {existing.value}{m.unit} ({existing.source})
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2">{m.description} · {m.hint}</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder={existing ? String(existing.value) : m.placeholder}
                        value={values[m.type] ?? ""}
                        onChange={e => setValues(prev => ({ ...prev, [m.type]: e.target.value }))}
                        min={m.min}
                        max={(m as any).max}
                        step={m.step}
                        className="h-8 text-sm"
                        data-testid={`input-record-${m.type}`}
                      />
                      <span className="text-xs text-muted-foreground shrink-0 w-12">{m.unit}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2 border-t border-border space-y-2">
            <Label className="text-xs font-semibold">Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-record-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Entry</SelectItem>
                <SelectItem value="Datadog">Datadog</SelectItem>
                <SelectItem value="Prometheus">Prometheus</SelectItem>
                <SelectItem value="Grafana">Grafana</SelectItem>
                <SelectItem value="New Relic">New Relic</SelectItem>
                <SelectItem value="Azure Monitor">Azure Monitor</SelectItem>
                <SelectItem value="AWS CloudWatch">AWS CloudWatch</SelectItem>
                <SelectItem value="ITSM Report">ITSM Report</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
            {source === "custom" && (
              <Input
                placeholder="e.g. AI Monitoring Agent, ServiceNow"
                value={customSource}
                onChange={e => setCustomSource(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-custom-source"
              />
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={pushMut.isPending}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pushMut.isPending} data-testid="button-submit-record-metrics">
              {pushMut.isPending ? "Saving…" : `Save Metrics`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Single push dialog (for custom / advanced) ──────────────────────────────
function PushReadingDialog({ open, onClose, services }: { open: boolean; onClose: () => void; services: string[] }) {
  const { toast } = useToast();
  const [serviceName, setServiceName] = useState("");
  const [metricType, setMetricType] = useState("uptime");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("%");
  const [source, setSource] = useState("manual");
  const [note, setNote] = useState("");

  const metaCfg = CORE_METRICS.find(m => m.type === metricType);

  const pushMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/service-health/readings", {
      serviceName, metricType, value: parseFloat(value), unit: unit || metaCfg?.unit || "", source: source || "manual", note: note || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-health"] });
      toast({ title: "Reading pushed" });
      setValue(""); setNote("");
      onClose();
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Push Single Metric Reading</DialogTitle>
          <DialogDescription>Push a single metric value — use "Record Metrics" on a service card to fill all metrics at once.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Service Name</Label>
            <Input list="push-service-list" value={serviceName} onChange={e => setServiceName(e.target.value)} placeholder="e.g. ERP, Email Service" data-testid="input-push-service" />
            <datalist id="push-service-list">{services.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Metric Type</Label>
              <Select value={metricType} onValueChange={(v) => {
                setMetricType(v);
                const cfg = CORE_METRICS.find(m => m.type === v);
                if (cfg?.unit) setUnit(cfg.unit);
              }}>
                <SelectTrigger data-testid="select-metric-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CORE_METRICS.map(m => (
                    <SelectItem key={m.value ?? m.type} value={m.type}>
                      <div className="flex items-center gap-2">
                        <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                        <span>{m.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Source</Label>
              <Input value={source} onChange={e => setSource(e.target.value)} placeholder="manual / AI Agent" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Value</Label>
              <Input type="number" step="any" value={value} onChange={e => setValue(e.target.value)} data-testid="input-metric-value" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Unit</Label>
              <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="%, min, req/s" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Note (optional)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Context for this reading" />
          </div>
          <Button onClick={() => pushMut.mutate()} disabled={pushMut.isPending || !serviceName || !value} className="w-full" data-testid="button-push-reading">
            {pushMut.isPending ? "Pushing…" : "Push Reading"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Metric Cell ─────────────────────────────────────────────────────────────
function MetricCell({ label, actual, agreed, metricType }: {
  label: string; actual: MetricReading | null; agreed: number | null; metricType: string;
}) {
  const metaCfg = CORE_METRICS.find(m => m.type === metricType);
  const Icon = metaCfg?.icon ?? Activity;

  let varColor = "text-foreground";
  let varianceText = "";
  if (actual && agreed !== null) {
    const diff = actual.value - agreed;
    if (metricType === "uptime") {
      varColor = actual.value >= agreed ? "text-green-500" : actual.value >= agreed - 0.5 ? "text-amber-500" : "text-red-500";
      varianceText = diff >= 0 ? `+${Math.abs(diff).toFixed(2)}%` : `${diff.toFixed(2)}%`;
    } else if (metricType === "response_time" || metricType === "mttr") {
      varColor = actual.value <= agreed ? "text-green-500" : actual.value <= agreed * 1.2 ? "text-amber-500" : "text-red-500";
      varianceText = diff <= 0 ? `-${Math.abs(diff).toFixed(0)}min faster` : `+${diff.toFixed(0)}min over target`;
    } else if (metricType === "error_rate") {
      varColor = actual.value <= 1 ? "text-green-500" : actual.value <= 3 ? "text-amber-500" : "text-red-500";
    }
  } else if (actual) {
    if (metricType === "uptime") varColor = actual.value >= 99.5 ? "text-green-500" : actual.value >= 99 ? "text-amber-500" : "text-red-500";
    if (metricType === "error_rate") varColor = actual.value <= 1 ? "text-green-500" : actual.value <= 3 ? "text-amber-500" : "text-red-500";
  }

  return (
    <div className="p-3 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`h-3.5 w-3.5 ${metaCfg?.color ?? "text-muted-foreground"}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2 rounded bg-primary/5 border border-primary/10">
          <p className="text-[10px] text-muted-foreground mb-0.5">Agreed</p>
          <p className="text-sm font-bold">
            {agreed !== null
              ? (metricType === "response_time" || metricType === "mttr" ? formatMins(agreed) : `${agreed}${metaCfg?.unit ?? ""}`)
              : "—"
            }
          </p>
        </div>
        <div className={`p-2 rounded border ${actual ? "bg-card border-border" : "bg-muted/30 border-dashed border-border"}`}>
          <p className="text-[10px] text-muted-foreground mb-0.5">Actual</p>
          {actual
            ? <p className={`text-sm font-bold ${varColor}`}>
              {metricType === "uptime" ? `${actual.value.toFixed(2)}%`
                : metricType === "response_time" || metricType === "mttr" ? formatMins(actual.value)
                : `${actual.value}${actual.unit}`}
            </p>
            : <p className="text-xs text-muted-foreground/50">No data</p>
          }
        </div>
      </div>
      {varianceText && <p className={`text-[10px] text-center mt-1 font-medium ${varColor}`}>{varianceText}</p>}
      {actual && (
        <p className="text-[10px] text-muted-foreground/60 text-center mt-0.5 break-words">
          {actual.source} · {new Date(actual.measuredAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────
function ServiceCard({ service, aiData, selected, onSelect, onRecord }: {
  service: ServiceHealth;
  aiData?: AiAnalysis["services"][0] | null;
  selected: boolean;
  onSelect: () => void;
  onRecord: () => void;
}) {
  const score = aiData?.complianceScore ?? service.complianceScore;
  const hasNoData = service.totalReadings === 0;
  const statusKey = hasNoData ? "no_data" : score !== null && score >= 90 ? "healthy" : score !== null && score >= 70 ? "at_risk" : score !== null ? "breaching" : "no_data";
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.no_data;
  const StatusIcon = statusCfg.icon;
  const [gapsOpen, setGapsOpen] = useState(false);

  const missingTypes = CORE_METRICS.filter(m => {
    const key = m.type === "error_rate" ? "errorRate" : m.type === "response_time" ? "responseTime" : m.type as keyof ServiceHealth["metrics"];
    return !service.metrics[key as keyof typeof service.metrics];
  });

  return (
    <Card
      className={`border transition-all ${selected ? "ring-2 ring-primary/40 " : ""}${statusCfg.bg} ${statusCfg.glow}`}
      data-testid={`card-service-${service.serviceName.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <button className="flex items-center gap-2 text-left flex-1 min-w-0" onClick={onSelect}>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${score !== null && score >= 90 ? "bg-green-500/10" : score !== null && score >= 70 ? "bg-amber-500/10" : hasNoData ? "bg-muted/50" : "bg-red-500/10"}`}>
              <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm" data-testid={`text-service-name-${service.serviceName}`}>{service.serviceName}</h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {service.slaCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-500 border-blue-500/20"><Globe className="h-2.5 w-2.5 mr-0.5" />{service.slaCount} SLA</Badge>}
                {service.olaCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-500 border-purple-500/20"><Building2 className="h-2.5 w-2.5 mr-0.5" />{service.olaCount} OLA</Badge>}
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusCfg.color}`}>{statusCfg.label}</Badge>
              </div>
            </div>
          </button>
          <Button
            size="sm"
            variant={hasNoData ? "default" : "outline"}
            className="h-7 text-xs gap-1 shrink-0"
            onClick={(e) => { e.stopPropagation(); onRecord(); }}
            data-testid={`button-record-${service.serviceName.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <PenLine className="h-3 w-3" />{hasNoData ? "Record" : "Update"}
          </Button>
        </div>

        <ComplianceBar score={score} />

        {hasNoData ? (
          <div className="mt-4 p-3 rounded-lg border border-dashed border-border text-center">
            <Eye className="h-5 w-5 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground mb-2">No metric readings yet</p>
            <p className="text-[10px] text-muted-foreground/70 mb-3">
              AI agents can push metrics automatically, or you can record them manually below.
            </p>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onRecord(); }} data-testid={`button-record-first-${service.serviceName.toLowerCase().replace(/\s+/g, "-")}`}>
              <PenLine className="h-3 w-3" />Record First Metrics <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              {[
                { key: "uptime", label: "Uptime", reading: service.metrics.uptime, format: (v: number) => `${v.toFixed(2)}%` },
                { key: "mttr", label: "MTTR", reading: service.metrics.mttr, agreed: service.agreedTargets.resolutionTimeMinutes, format: (v: number) => formatMins(v) },
                { key: "error_rate", label: "Errors", reading: service.metrics.errorRate, format: (v: number) => `${v.toFixed(2)}%` },
              ].map(m => {
                const metaCfg = CORE_METRICS.find(x => x.type === m.key);
                const Icon = metaCfg?.icon ?? Activity;
                const hasData = !!m.reading;
                let compColor = "text-foreground";
                if (hasData) {
                  if (m.key === "uptime") compColor = m.reading!.value >= 99.5 ? "text-green-500" : m.reading!.value >= 99 ? "text-amber-500" : "text-red-500";
                  else if ((m as any).agreed !== null && m.reading) compColor = m.reading.value <= (m as any).agreed ? "text-green-500" : "text-red-500";
                  else if (m.key === "error_rate") compColor = m.reading!.value <= 1 ? "text-green-500" : m.reading!.value <= 3 ? "text-amber-500" : "text-red-500";
                }
                return (
                  <div key={m.key} className="p-2 rounded-lg border border-border bg-muted/20 text-center" data-testid={`metric-${m.key}-${service.serviceName}`}>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Icon className={`h-3 w-3 ${metaCfg?.color ?? "text-muted-foreground"}`} />
                      <span className="text-[10px] text-muted-foreground">{m.label}</span>
                    </div>
                    {hasData ? <p className={`text-sm font-bold ${compColor}`}>{m.format(m.reading!.value)}</p>
                      : <p className="text-xs text-muted-foreground/50">—</p>}
                    {(m as any).agreed !== null && hasData && <p className="text-[9px] text-muted-foreground">agreed: {formatMins((m as any).agreed)}</p>}
                  </div>
                );
              })}
            </div>

            {missingTypes.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                <span>Missing: {missingTypes.map(m => m.label).join(", ")}</span>
                <button className="text-primary hover:underline shrink-0" onClick={(e) => { e.stopPropagation(); onRecord(); }}>Record now</button>
              </div>
            )}
          </>
        )}

        {aiData && aiData.gaps.length > 0 && (
          <div className="mt-3">
            <button className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium hover:underline" onClick={(e) => { e.stopPropagation(); setGapsOpen(!gapsOpen); }}>
              {gapsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {aiData.gaps.length} compliance gap{aiData.gaps.length !== 1 ? "s" : ""} (AI)
            </button>
            {gapsOpen && (
              <div className="mt-2 space-y-1">
                {aiData.gaps.map((gap: any, i: number) => (
                  <div key={i} className="text-xs p-2 rounded border border-amber-500/20 bg-amber-500/5">
                    <span className="font-medium">{gap.metric}:</span> agreed {gap.agreed} → actual {gap.actual}
                    <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">{gap.variance}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {service.lastUpdated && (
          <p className="text-[10px] text-muted-foreground mt-2">Last reading: {new Date(service.lastUpdated).toLocaleString()}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ServiceHealthPage() {
  const { toast } = useToast();
  const [pushOpen, setPushOpen] = useState(false);
  const [recordService, setRecordService] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiAnalysis | null>(null);

  const { data: services = [], isLoading, refetch } = useQuery<ServiceHealth[]>({
    queryKey: ["/api/service-health"],
  });

  const aiMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/service-health/ai-analyse", selectedService ? { serviceName: selectedService } : {});
      return res.json() as Promise<AiAnalysis>;
    },
    onSuccess: (data: AiAnalysis) => { setAiResult(data); toast({ title: "AI analysis complete" }); },
    onError: (err: any) => { toast({ title: err?.message?.includes("cooldown") ? err.message : "AI analysis failed", variant: "destructive" }); },
  });

  const allServiceNames = Array.from(new Set(services.map(s => s.serviceName)));
  const recordServiceData = services.find(s => s.serviceName === recordService) ?? null;

  const overallHealthy = services.filter(s => (s.complianceScore ?? 100) >= 90 && s.totalReadings > 0).length;
  const overallAtRisk = services.filter(s => s.complianceScore !== null && s.complianceScore < 90 && s.complianceScore >= 70).length;
  const withNoData = services.filter(s => s.totalReadings === 0).length;
  const selectedServiceData = services.find(s => s.serviceName === selectedService);
  const selectedAiData = aiResult?.services.find(s => s.serviceName === selectedService);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />Service Health Monitor
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Agreed vs Actual — compliance tracking. Use <strong>Record</strong> to enter metrics manually.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-health">
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPushOpen(true)} data-testid="button-push-single">
            <Upload className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Push Single</span>
          </Button>
          <Button size="sm" onClick={() => aiMut.mutate()} disabled={aiMut.isPending} data-testid="button-ai-analyse">
            {aiMut.isPending ? <><Brain className="h-3.5 w-3.5 animate-pulse sm:mr-1" /><span className="hidden sm:inline">Analysing…</span></> : <><Zap className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">AI Analyse</span></>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Services Tracked", value: services.length, color: "text-primary", icon: Layers },
          { label: "Healthy", value: overallHealthy, color: "text-green-500", icon: CheckCircle2 },
          { label: "At Risk", value: overallAtRisk, color: "text-amber-500", icon: AlertTriangle },
          { label: "Need Readings", value: withNoData, color: "text-muted-foreground", icon: PenLine },
        ].map(s => (
          <Card key={s.label} className="border border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {withNoData > 0 && (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {withNoData} service{withNoData !== 1 ? "s" : ""} have no metric readings yet
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click <strong>Record</strong> on each service card to manually enter metrics, or configure AI agents to push them automatically via <code className="text-xs bg-muted px-1 rounded">POST /api/service-health/readings</code>
            </p>
          </div>
        </div>
      )}

      {aiResult && (
        <Card className={`border ${aiResult.status === "healthy" ? "border-green-500/30 bg-green-500/5" : aiResult.status === "critical" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-sm">AI Service Health Intelligence</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />GPT-4o
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${aiResult.status === "healthy" ? "text-green-500" : aiResult.status === "critical" ? "text-red-500" : "text-amber-500"}`}>
                    Health: {aiResult.overallHealthScore}/100
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
                  <p className="text-xs text-muted-foreground">{aiResult.topPriorityAction}</p>
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-3">Analysed: {new Date(aiResult.analysedAt).toLocaleString()}</p>
          </CardContent>
        </Card>
      )}

      {services.length === 0 && !isLoading && (
        <Card className="border border-dashed border-border">
          <CardContent className="p-10 text-center">
            <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium mb-1">No services mapped yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Go to <strong>SLA Targets</strong> and add a <strong>Service / Application</strong> to any SLA or OLA agreement. Once linked, that service will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
        </div>
      )}

      {services.length > 0 && (
        <Tabs defaultValue="grid">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="grid" data-testid="tab-grid-view"><Layers className="h-3.5 w-3.5 mr-1" />Service Grid</TabsTrigger>
              <TabsTrigger value="detail" data-testid="tab-detail-view"><BarChart3 className="h-3.5 w-3.5 mr-1" />Detail View</TabsTrigger>
            </TabsList>
            {selectedService && (
              <Badge variant="outline" className="text-xs">Inspecting: <strong className="ml-1">{selectedService}</strong></Badge>
            )}
          </div>

          <TabsContent value="grid" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(svc => (
                <ServiceCard
                  key={svc.serviceName}
                  service={svc}
                  aiData={aiResult?.services.find(s => s.serviceName === svc.serviceName)}
                  selected={selectedService === svc.serviceName}
                  onSelect={() => setSelectedService(selectedService === svc.serviceName ? null : svc.serviceName)}
                  onRecord={() => setRecordService(svc.serviceName)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="detail" className="mt-4">
            {/* Mobile service selector */}
            <div className="md:hidden mb-4">
              <Select value={selectedService ?? ""} onValueChange={setSelectedService}>
                <SelectTrigger data-testid="select-service-mobile">
                  <SelectValue placeholder="Choose a service to inspect…" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(svc => {
                    const score = svc.complianceScore;
                    const scoreLabel = score !== null && svc.totalReadings > 0 ? ` — ${score}%` : svc.totalReadings === 0 ? " — No data" : "";
                    return (
                      <SelectItem key={svc.serviceName} value={svc.serviceName} data-testid={`option-service-${svc.serviceName.toLowerCase().replace(/\s+/g, "-")}`}>
                        {svc.serviceName}{scoreLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              {/* Desktop sidebar */}
              <div className="hidden md:flex flex-col gap-1 w-52 shrink-0">
                {services.map(svc => {
                  const score = svc.complianceScore;
                  const color = score === null || svc.totalReadings === 0 ? "text-muted-foreground" : score >= 90 ? "text-green-500" : score >= 70 ? "text-amber-500" : "text-red-500";
                  return (
                    <button
                      key={svc.serviceName}
                      onClick={() => setSelectedService(svc.serviceName)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all ${selectedService === svc.serviceName ? "bg-primary/10 border-primary/30 text-primary" : "border-border hover:bg-muted/50 text-muted-foreground"}`}
                      data-testid={`sidebar-service-${svc.serviceName.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{svc.serviceName}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {svc.totalReadings === 0 && <PenLine className="h-3 w-3 text-amber-500" />}
                          <span className={`text-[10px] font-bold ${color}`}>{score !== null && svc.totalReadings > 0 ? `${score}%` : "—"}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 min-w-0 w-full">
                {selectedServiceData ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <h2 className="text-lg font-bold truncate">{selectedServiceData.serviceName}</h2>
                        {selectedServiceData.slaCount > 0 && <Badge variant="outline" className="border-blue-500/30 text-blue-500 shrink-0">{selectedServiceData.slaCount} SLA</Badge>}
                        {selectedServiceData.olaCount > 0 && <Badge variant="outline" className="border-purple-500/30 text-purple-500 shrink-0">{selectedServiceData.olaCount} OLA</Badge>}
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={() => setRecordService(selectedServiceData.serviceName)} data-testid={`button-record-detail-${selectedServiceData.serviceName.toLowerCase().replace(/\s+/g, "-")}`}>
                        <PenLine className="h-3 w-3" /><span className="hidden sm:inline">Record / Update Metrics</span><span className="sm:hidden">Record</span>
                      </Button>
                    </div>

                    {selectedServiceData.totalReadings === 0 && (
                      <div className="p-5 rounded-lg border border-dashed border-border text-center">
                        <PenLine className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm font-medium mb-1">No readings recorded yet</p>
                        <p className="text-xs text-muted-foreground mb-3">Record the current metric values manually or configure an AI agent to push them via the API.</p>
                        <Button size="sm" onClick={() => setRecordService(selectedServiceData.serviceName)}>
                          <PenLine className="h-3.5 w-3.5 mr-1" />Record Metrics
                        </Button>
                      </div>
                    )}

                    {selectedServiceData.totalReadings > 0 && (
                      <Card className="border border-border">
                        <CardHeader className="pb-2 pt-4 px-4">
                          <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Agreed vs Actual</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <MetricCell label="Uptime" actual={selectedServiceData.metrics.uptime} agreed={null} metricType="uptime" />
                            <MetricCell label="Error Rate" actual={selectedServiceData.metrics.errorRate} agreed={null} metricType="error_rate" />
                            <MetricCell label="Response Time" actual={selectedServiceData.metrics.responseTime} agreed={selectedServiceData.agreedTargets.responseTimeMinutes} metricType="response_time" />
                            <MetricCell label="MTTR" actual={selectedServiceData.metrics.mttr} agreed={selectedServiceData.agreedTargets.resolutionTimeMinutes} metricType="mttr" />
                          </div>
                          {selectedServiceData.metrics.throughput && (
                            <div className="mt-3">
                              <MetricCell label="Throughput" actual={selectedServiceData.metrics.throughput} agreed={null} metricType="throughput" />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {(selectedServiceData.slaDetails.length > 0 || selectedServiceData.olaDetails.length > 0) && (
                      <Card className="border border-border">
                        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Linked Agreements</CardTitle></CardHeader>
                        <CardContent className="px-4 pb-4 space-y-2">
                          {[...selectedServiceData.slaDetails.map((d: any) => ({ ...d, type: "sla" })), ...selectedServiceData.olaDetails.map((d: any) => ({ ...d, type: "ola" }))].map((d: any) => (
                            <div key={d.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs p-2 rounded border border-border bg-muted/20 gap-1.5">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                {d.type === "sla" ? <Globe className="h-3 w-3 text-blue-500 shrink-0" /> : <Building2 className="h-3 w-3 text-purple-500 shrink-0" />}
                                <span className="font-medium truncate">{d.name}</span>
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5 capitalize shrink-0">{d.priority}</Badge>
                              </div>
                              <div className="flex items-center gap-x-3 gap-y-1 text-muted-foreground flex-wrap">
                                <span>Response: <strong className="text-foreground">{formatMins(d.responseTimeMinutes)}</strong></span>
                                <span>Resolution: <strong className="text-foreground">{formatMins(d.resolutionTimeMinutes)}</strong></span>
                                {d.counterparty && <span className="text-muted-foreground/60">{d.counterparty}</span>}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {selectedAiData && (
                      <Card className="border border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2 pt-4 px-4">
                          <CardTitle className="text-sm flex items-center gap-2 flex-wrap min-w-0">
                            <Brain className="h-4 w-4 text-primary shrink-0" />
                            <span className="flex-1 min-w-0 truncate">AI Analysis — {selectedServiceData.serviceName}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${STATUS_CONFIG[selectedAiData.status]?.color ?? ""}`}>{STATUS_CONFIG[selectedAiData.status]?.label ?? selectedAiData.status}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3">
                          {selectedAiData.positives.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">What's working well</p>
                              {selectedAiData.positives.map((p: string, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />{p}
                                </p>
                              ))}
                            </div>
                          )}
                          {selectedAiData.recommendations.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-primary mb-2">Recommendations</p>
                              {selectedAiData.recommendations.map((r: any, i: number) => (
                                <div key={i} className="text-xs p-2 rounded border border-primary/15 bg-card mb-1.5">
                                  <div className="flex items-start gap-2 mb-0.5 flex-wrap">
                                    <span className="font-medium flex-1 min-w-0">{r.action}</span>
                                    <Badge variant="outline" className={`text-[10px] px-1 py-0 h-3.5 shrink-0 ${r.urgency === "immediate" ? "text-red-500 border-red-500/30" : r.urgency === "soon" ? "text-amber-500 border-amber-500/30" : "text-muted-foreground"}`}>{r.urgency}</Badge>
                                  </div>
                                  <p className="text-muted-foreground break-words">{r.rationale}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card className="border border-dashed border-border h-64 flex items-center justify-center">
                    <CardContent className="text-center p-6">
                      <BarChart3 className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Select a service to inspect its agreed vs actual metrics and AI analysis</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <RecordMetricsDialog
        serviceName={recordService ?? ""}
        service={recordServiceData}
        open={!!recordService}
        onClose={() => setRecordService(null)}
      />
      <PushReadingDialog
        open={pushOpen}
        onClose={() => setPushOpen(false)}
        services={allServiceNames}
      />
    </div>
  );
}
