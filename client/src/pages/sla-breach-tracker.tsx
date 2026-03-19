import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { SlaBreach, SlaDefinition } from "@shared/schema";
import {
  AlertTriangle, CheckCircle2, RefreshCw, Clock, ShieldAlert,
  Bell, TrendingUp, Filter, Sparkles, Brain, Zap, Activity,
  Globe, Building2, ChevronDown, ChevronRight, Timer,
} from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800",
};

const URGENCY_COLORS: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
};

const IMPACT_COLORS: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-green-500",
};

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof Brain; glow: string }> = {
  green: { color: "text-green-500", label: "All Clear", icon: CheckCircle2, glow: "shadow-[0_0_12px_-3px_hsl(142_71%_50%/0.4)]" },
  amber: { color: "text-amber-500", label: "Monitoring", icon: Activity, glow: "shadow-[0_0_12px_-3px_hsl(38_92%_50%/0.4)]" },
  red: { color: "text-red-500", label: "Alert", icon: AlertTriangle, glow: "shadow-[0_0_12px_-3px_hsl(0_84%_60%/0.4)]" },
};

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / 1440)}d ${Math.round((mins % 1440) / 60)}h`;
}

interface AiMonitorResult {
  overallAssessment: string;
  healthScore: number;
  agentStatus: "green" | "amber" | "red";
  narrative: string;
  atRiskItems: { ref: string; title: string; priority: string; urgency: string; agreementType: string; action: string; timeRemaining: string }[];
  breachedItems: { ref: string; title: string; priority: string; agreementType: string; escalation: string; suggestedRootCause: string }[];
  recommendations: { title: string; detail: string; impact: string }[];
  monitoredAt: string;
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">SLA/OLA Health</span>
          <span className="font-bold">{score}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  );
}

function AgreementBadge({ type }: { type: string }) {
  if (type === "ola") return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
      <Building2 className="h-2.5 w-2.5 mr-0.5" />OLA
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
      <Globe className="h-2.5 w-2.5 mr-0.5" />SLA
    </Badge>
  );
}

function AiMonitorPanel() {
  const { toast } = useToast();
  const [result, setResult] = useState<AiMonitorResult | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const monitorMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sla-breaches/ai-monitor");
      return res.json() as Promise<AiMonitorResult>;
    },
    onSuccess: (data: AiMonitorResult) => {
      setResult(data);
      setCollapsed(false);
      toast({ title: "AI Monitor complete" });
    },
    onError: (err: any) => {
      const msg = err?.message || "Monitor failed";
      toast({ title: msg.includes("cooldown") ? msg : "AI Monitor failed", variant: "destructive" });
    },
  });

  const status = result ? STATUS_CONFIG[result.agentStatus] ?? STATUS_CONFIG.green : null;
  const StatusIcon = status?.icon ?? Brain;

  return (
    <Card className={`border ${result ? (result.agentStatus === "red" ? "border-red-500/30" : result.agentStatus === "amber" ? "border-amber-500/30" : "border-green-500/30") : "border-primary/20"} bg-card`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary/15 to-purple-600/10 border border-primary/20 ${status?.glow ?? ""}`}>
              {monitorMut.isPending
                ? <Brain className="h-5 w-5 text-primary animate-pulse" />
                : <StatusIcon className={`h-5 w-5 ${status?.color ?? "text-primary"}`} />
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">SLA/OLA Compliance Agent</h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />GPT-4o
                </Badge>
                {result && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${status?.color}`}>
                    {status?.label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {monitorMut.isPending
                  ? "Analysing all open tickets against SLA/OLA targets…"
                  : result
                    ? `Last analysed: ${new Date(result.monitoredAt).toLocaleString()}`
                    : "Proactively scans open incidents and service requests for SLA/OLA risk"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {result && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCollapsed(!collapsed)} data-testid="button-collapse-monitor">
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => monitorMut.mutate()}
              disabled={monitorMut.isPending}
              data-testid="button-run-ai-monitor"
              className="gap-1"
            >
              {monitorMut.isPending
                ? <><Brain className="h-3.5 w-3.5 animate-pulse" />Analysing…</>
                : <><Zap className="h-3.5 w-3.5" />{result ? "Re-run Monitor" : "Run AI Monitor"}</>
              }
            </Button>
          </div>
        </div>

        {monitorMut.isPending && (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {result && !collapsed && !monitorMut.isPending && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <HealthGauge score={result.healthScore} />
                <p className="text-xs font-medium mt-3">{result.overallAssessment}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{result.narrative}</p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-1 gap-2">
                {[
                  { label: "At Risk", value: result.atRiskItems.length, color: "text-amber-500" },
                  { label: "Breached", value: result.breachedItems.length, color: "text-red-500" },
                  { label: "Alerts", value: result.recommendations.length, color: "text-primary" },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30 border border-border">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {result.atRiskItems.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-2">
                  <Timer className="h-3.5 w-3.5" />At-Risk Tickets ({result.atRiskItems.length})
                </h4>
                <div className="space-y-2">
                  {result.atRiskItems.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-amber-500/5 flex items-start gap-3" data-testid={`ai-risk-${item.ref}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs font-bold">{item.ref}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${URGENCY_COLORS[item.urgency] || URGENCY_COLORS.medium}`}>
                            {item.urgency?.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${PRIORITY_COLORS[item.priority]}`}>
                            {item.priority}
                          </Badge>
                          <AgreementBadge type={item.agreementType} />
                          {item.timeRemaining && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />{item.timeRemaining}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium truncate">{item.title}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          <span className="font-semibold">Action: </span>{item.action}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.breachedItems.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" />Breached Tickets — Escalation Required ({result.breachedItems.length})
                </h4>
                <div className="space-y-2">
                  {result.breachedItems.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg border border-red-500/20 bg-red-500/5" data-testid={`ai-breach-${item.ref}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-bold">{item.ref}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${PRIORITY_COLORS[item.priority]}`}>{item.priority}</Badge>
                        <AgreementBadge type={item.agreementType} />
                      </div>
                      <p className="text-xs font-medium">{item.title}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        <span className="font-semibold">Escalation: </span>{item.escalation}
                      </p>
                      {item.suggestedRootCause && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-semibold">Likely cause: </span>{item.suggestedRootCause}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-primary flex items-center gap-1 mb-2">
                  <Sparkles className="h-3.5 w-3.5" />Agent Recommendations
                </h4>
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="p-3 rounded-lg border border-primary/15 bg-primary/5 flex items-start gap-3" data-testid={`ai-rec-${i}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-semibold">{rec.title}</p>
                          <span className={`text-[10px] font-medium ${IMPACT_COLORS[rec.impact] || IMPACT_COLORS.medium}`}>
                            {rec.impact?.toUpperCase()} impact
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{rec.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BreachCard({ breach, onAcknowledge }: { breach: SlaBreach; onAcknowledge: (id: number) => void }) {
  const isAcknowledged = !!breach.acknowledgedAt;
  return (
    <Card className={`border ${isAcknowledged ? "border-border opacity-70" : "border-red-500/30 dark:border-red-800/50"}`} data-testid={`card-breach-${breach.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isAcknowledged ? "bg-green-500/10" : "bg-red-500/10"}`}>
              {isAcknowledged ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold" data-testid={`text-breach-ref-${breach.id}`}>{breach.entityRef}</span>
                <Badge variant="outline" className="text-xs capitalize">{breach.entityType.replace("_", " ")}</Badge>
                <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[breach.priority]}`}>{breach.priority}</Badge>
                <Badge variant="outline" className={`text-xs ${breach.breachType === "resolution" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"}`}>
                  {breach.breachType === "resolution" ? "Resolution Breach" : "Response Breach"}
                </Badge>
              </div>
              <p className="text-sm mt-1">
                <span className="font-semibold text-red-500 dark:text-red-400" data-testid={`text-breach-mins-${breach.id}`}>+{formatMins(breach.breachMinutes)}</span>
                <span className="text-muted-foreground text-xs ml-1">over target</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Occurred: {new Date(breach.occurredAt!).toLocaleString()}
                {breach.assignedTo && ` · Assigned: ${breach.assignedTo}`}
              </p>
              {isAcknowledged && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  Acknowledged by {breach.acknowledgedBy} on {new Date(breach.acknowledgedAt!).toLocaleString()}
                </p>
              )}
              {breach.rootCause && <p className="text-xs text-muted-foreground mt-1 italic">Root cause: {breach.rootCause}</p>}
              {breach.preventionNotes && <p className="text-xs text-muted-foreground mt-0.5 italic">Prevention: {breach.preventionNotes}</p>}
            </div>
          </div>
          {!isAcknowledged && (
            <Button size="sm" variant="outline" onClick={() => onAcknowledge(breach.id)} data-testid={`button-ack-breach-${breach.id}`}>
              <Bell className="h-3.5 w-3.5 mr-1" />Acknowledge
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SlaBreachTrackerPage() {
  const { toast } = useToast();
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const { data: breaches = [], isLoading } = useQuery<SlaBreach[]>({ queryKey: ["/api/sla-breaches"] });
  const { data: slas = [] } = useQuery<SlaDefinition[]>({ queryKey: ["/api/sla-definitions"] });

  const computeMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sla-breaches/compute");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sla-breaches"] });
      toast({ title: `SLA check complete — ${data?.created ?? 0} new breaches detected` });
    },
    onError: () => toast({ title: "Compute failed", variant: "destructive" }),
  });

  const ackMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/sla-breaches/${id}/acknowledge`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sla-breaches"] }); toast({ title: "Breach acknowledged" }); },
    onError: () => toast({ title: "Failed to acknowledge", variant: "destructive" }),
  });

  const unacknowledged = breaches.filter(b => !b.acknowledgedAt);
  const acknowledged = breaches.filter(b => b.acknowledgedAt);

  const filtered = (showAcknowledged ? breaches : unacknowledged).filter(b => {
    if (priorityFilter !== "all" && b.priority !== priorityFilter) return false;
    if (typeFilter !== "all" && b.breachType !== typeFilter) return false;
    return true;
  });

  const byPriority: Record<string, number> = {};
  for (const b of unacknowledged) byPriority[b.priority] = (byPriority[b.priority] || 0) + 1;

  const complianceTotal = breaches.length + 100;
  const complianceRate = breaches.length === 0 ? 100 : Math.max(0, Math.round(((complianceTotal - breaches.length) / complianceTotal) * 100));

  const activeSlas = slas.filter(s => s.active && (s.agreementType ?? "sla") === "sla");
  const activeOlas = slas.filter(s => s.active && s.agreementType === "ola");

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldAlert className="h-6 w-6 text-red-500" />SLA Breach Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-monitored SLA/OLA compliance — breaches computed from live incident and service request data</p>
        </div>
        <Button onClick={() => computeMut.mutate()} disabled={computeMut.isPending} variant="outline" data-testid="button-compute-breaches">
          <RefreshCw className={`h-4 w-4 mr-1 ${computeMut.isPending ? "animate-spin" : ""}`} />
          {computeMut.isPending ? "Computing…" : "Run SLA Check"}
        </Button>
      </div>

      <AiMonitorPanel />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Active Breaches", value: unacknowledged.length, color: "text-red-500" },
          { label: "Acknowledged", value: acknowledged.length, color: "text-green-500" },
          { label: "SLA Targets", value: activeSlas.length, color: "text-blue-500", sub: "external" },
          { label: "OLA Targets", value: activeOlas.length, color: "text-purple-500", sub: "internal" },
        ].map(s => (
          <Card key={s.label} className="border border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`} data-testid={`stat-sla-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              {s.sub && <p className="text-[10px] text-muted-foreground/60">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(byPriority).length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Active Breaches by Priority</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["critical", "high", "medium", "low"].map(p => (
                <div key={p} className={`p-3 rounded-lg border text-center ${PRIORITY_COLORS[p]}`} data-testid={`stat-breach-priority-${p}`}>
                  <p className="text-xl font-bold">{byPriority[p] || 0}</p>
                  <p className="text-xs capitalize mt-0.5">{p}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {slas.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Active Targets</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {slas.filter(s => s.active).map(sla => (
                <div key={sla.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs p-2 rounded bg-muted/30 border border-border" data-testid={`row-sla-${sla.id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{sla.name}</span>
                    {sla.agreementType === "ola"
                      ? <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium shrink-0">OLA</span>
                      : <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium shrink-0">SLA</span>
                    }
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                    <span>Response: <strong className="text-foreground">{sla.responseTimeMinutes < 60 ? `${sla.responseTimeMinutes}m` : `${Math.round(sla.responseTimeMinutes / 60)}h`}</strong></span>
                    <span>Resolution: <strong className="text-foreground">{sla.resolutionTimeMinutes < 60 ? `${sla.resolutionTimeMinutes}m` : `${Math.round(sla.resolutionTimeMinutes / 60)}h`}</strong></span>
                    <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[sla.priority]}`}>{sla.priority}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36" data-testid="select-breach-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-breach-type"><SelectValue placeholder="Breach Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="response">Response Breach</SelectItem>
            <SelectItem value="resolution">Resolution Breach</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showAcknowledged ? "default" : "outline"} size="sm" onClick={() => setShowAcknowledged(!showAcknowledged)} data-testid="button-toggle-acknowledged">
          <Filter className="h-3.5 w-3.5 mr-1" />{showAcknowledged ? "Showing All" : "Show Acknowledged"}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} breach{filtered.length !== 1 ? "es" : ""} shown</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed border-border">
          <CardContent className="p-10 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-green-500/50" />
            <p className="text-sm text-muted-foreground">
              {unacknowledged.length === 0 ? "No active SLA/OLA breaches — all tickets within target." : "No breaches match the current filters."}
            </p>
            {breaches.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">Click <strong>Run SLA Check</strong> to compute breaches from existing tickets.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => (
            <BreachCard key={b.id} breach={b} onAcknowledge={(id) => ackMut.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}
