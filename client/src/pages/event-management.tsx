import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle, CheckCircle2, Clock, ShieldAlert, Loader2,
  ArrowRight, RefreshCw, Zap, Brain, Info, X,
  Activity, FileWarning, GitMerge, Wrench, Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/* ── ITIL type styling ──────────────────────────────────────────────── */
const ITIL_STYLE: Record<string, { color: string; icon: typeof Info }> = {
  Exception:     { color: "bg-red-500/15 text-red-300 border-red-500/25",    icon: ShieldAlert },
  Warning:       { color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25", icon: AlertTriangle },
  Informational: { color: "bg-sky-500/15 text-sky-300 border-sky-500/25",    icon: Info },
};

const URGENCY_STYLE: Record<string, string> = {
  immediate: "bg-red-500/15 text-red-300 border-red-500/25",
  urgent:    "bg-orange-500/15 text-orange-300 border-orange-500/25",
  normal:    "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
};

const PROCESS_STYLE: Record<string, string> = {
  "Incident Management":  "bg-red-500/10 text-red-400 border-red-500/20",
  "Problem Management":   "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "Change Management":    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Event Closure":        "bg-green-500/10 text-green-400 border-green-500/20",
};

const ACTION_LABEL: Record<string, string> = {
  raise_incident:    "Raise Incident",
  escalate_problem:  "Escalate to Problem",
  create_rfc:        "Create RFC",
  close_event:       "Close Event",
  monitor:           "Monitor",
  create_problem:    "Open Problem",
  auto_close:        "Auto-Close",
};

/* Classify security event severity → ITIL type */
function toItilType(severity: string, eventType: string): string {
  if (severity === "critical") return "Exception";
  if (severity === "high") return "Exception";
  if (eventType === "malware_detected") return "Exception";
  if (severity === "medium") return "Warning";
  return "Informational";
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-500/20 text-red-300 border-red-500/30",
    high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
    medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    low:      "bg-green-500/20 text-green-300 border-green-500/30",
  };
  return (
    <Badge className={cn("text-[10px] px-2 py-0.5 border font-semibold uppercase tracking-wide", styles[level] ?? styles.medium)}>
      {level} risk
    </Badge>
  );
}

export default function UnifiedEventManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "security" | "operational">("all");
  const hasTriaged = useRef(false);
  const [triage, setTriage] = useState<any>(null);
  const [triageLoading, setTriageLoading] = useState(false);

  /* ── Real data from DB ─────────────────────────────────────────── */
  const { data: securityEvents = [], isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ["/api/security-events"],
  });

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery<any[]>({
    queryKey: ["/api/incidents"],
  });

  const { data: problems = [], isLoading: problemsLoading } = useQuery<any[]>({
    queryKey: ["/api/problems"],
  });

  const { data: integrations = [] } = useQuery<any[]>({
    queryKey: ["/api/security/integrations"],
  });

  const dataLoading = eventsLoading || incidentsLoading || problemsLoading;

  /* ── Raise incident from security event ───────────────────────── */
  const raiseMutation = useMutation({
    mutationFn: async (evt: any) => {
      const r = await apiRequest("POST", "/api/incidents", {
        title: `[ITIL Event] ${evt.eventType ?? evt.title ?? "Security Event"}: ${(evt.message ?? evt.description ?? "").slice(0, 80)}`,
        description: evt.message ?? evt.description ?? "Raised from unified ITIL Event Management",
        severity: evt.severity ?? "medium",
        status: "open",
        category: evt.category ?? "Security",
        source: evt.source ?? "Event Management",
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Incident raised", description: "ITIL Incident created and queued for triage" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  /* ── AI triage — auto-runs once when real data loads ──────────── */
  const triageMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/events/ai-triage", {
        securityEvents,
        incidents,
        problems,
        connectedPlatforms: integrations.map((i: any) => i.displayName),
      });
      return r.json();
    },
    onSuccess: (data) => setTriage(data),
    onError: (e: any) => toast({ title: "AI triage failed", description: e.message, variant: "destructive" }),
    onSettled: () => setTriageLoading(false),
  });

  useEffect(() => {
    if (!dataLoading && !hasTriaged.current && (securityEvents.length > 0 || incidents.length > 0)) {
      hasTriaged.current = true;
      setTriageLoading(true);
      triageMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, securityEvents.length, incidents.length]);

  /* ── Derived stats ─────────────────────────────────────────────── */
  const openIncidents = incidents.filter((i: any) => !["resolved", "closed"].includes(i.status));
  const openProblems  = problems.filter((p: any) => p.status !== "resolved");
  const unprocessed   = securityEvents.filter((e: any) => !e.processed);
  const exceptions    = securityEvents.filter((e: any) => toItilType(e.severity, e.eventType) === "Exception");

  /* ── Unified display rows ──────────────────────────────────────── */
  const securityRows = securityEvents.map((e: any) => ({
    ...e, stream: "security", itilType: toItilType(e.severity, e.eventType),
    title: e.eventType?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    description: e.message, action: toItilType(e.severity, e.eventType) === "Exception" ? "raise_incident" : "monitor",
  }));

  const operationalRows = (triage?.operationalEvents ?? []).map((e: any) => ({ ...e, stream: "operational" }));

  const allRows = [...securityRows, ...operationalRows];
  const displayRows = activeTab === "security" ? securityRows
    : activeTab === "operational" ? operationalRows
    : allRows;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Proactive AI Triage Panel ─────────────────────────────── */}
      <Card className={cn("border-2", triage?.overallRiskLevel === "critical" ? "border-red-500/40" : triage?.overallRiskLevel === "high" ? "border-orange-500/40" : "border-amber-500/30")}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1">
              <Brain className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm font-bold">ITIL AI Event Triage</CardTitle>
                  <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-300 border border-amber-500/20">Auto-running · Generative AI</Badge>
                  {triage && <RiskBadge level={triage.overallRiskLevel} />}
                </div>
                {triage?.summary && (
                  <p className="text-xs text-muted-foreground/70 mt-1 max-w-2xl">{triage.summary}</p>
                )}
              </div>
            </div>
            <Button
              size="sm" variant="outline" className="h-7 text-[11px] gap-1.5 shrink-0"
              onClick={() => { hasTriaged.current = false; setTriageLoading(true); triageMutation.mutate(); }}
              disabled={triageLoading}
              data-testid="button-refresh-triage"
            >
              {triageLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Re-analyse
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {triageLoading && !triage && (
            <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground/50">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              <span className="text-xs">AI is analysing your live event stream against ITIL best practices…</span>
            </div>
          )}
          {triage?.proactiveActions?.length > 0 && (
            <div className="space-y-2">
              {triage.proactiveActions.map((action: any) => {
                const urgencyStyle = URGENCY_STYLE[action.urgency] ?? URGENCY_STYLE.normal;
                const processStyle = PROCESS_STYLE[action.itilProcess] ?? PROCESS_STYLE["Event Closure"];
                return (
                  <div
                    key={action.id}
                    className="flex items-start gap-3 rounded-lg border border-border/30 bg-card/60 p-3"
                    data-testid={`triage-action-${action.id}`}
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/25 shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-amber-400">{action.priority}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={cn("text-[9px] px-1.5 py-0 border", urgencyStyle)}>{action.urgency}</Badge>
                        <Badge className={cn("text-[9px] px-1.5 py-0 border", processStyle)}>{action.itilProcess}</Badge>
                        <span className="text-xs font-semibold text-foreground/90">{action.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{action.rationale}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={action.action === "raise_incident" ? "destructive" : "outline"}
                      className={cn("h-7 text-[10px] px-2.5 gap-1 shrink-0",
                        action.action === "escalate_problem" && "border-violet-500/40 text-violet-400 hover:bg-violet-500/10",
                        action.action === "create_rfc" && "border-blue-500/40 text-blue-400 hover:bg-blue-500/10",
                      )}
                      onClick={() => {
                        if (action.action === "raise_incident") {
                          const evt = securityEvents.find((e: any) => e.id === action.securityEventId) ?? { eventType: action.title, message: action.rationale, severity: "high", source: "AI Triage" };
                          raiseMutation.mutate(evt);
                        } else {
                          toast({ title: `Action: ${ACTION_LABEL[action.action]}`, description: action.title });
                        }
                      }}
                      data-testid={`button-triage-action-${action.id}`}
                    >
                      {ACTION_LABEL[action.action] ?? "Act"} <ArrowRight className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {triage?.itilAssessment && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              {[
                { label: "Event Management",   value: triage.itilAssessment.eventManagement,   icon: Activity,     color: "text-sky-400" },
                { label: "Incident Management",value: triage.itilAssessment.incidentManagement, icon: ShieldAlert,  color: "text-red-400" },
                { label: "Problem Management", value: triage.itilAssessment.problemManagement,  icon: FileWarning,  color: "text-violet-400" },
              ].map(a => (
                <div key={a.label} className="rounded-lg bg-muted/10 border border-border/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <a.icon className={cn("h-3 w-3 shrink-0", a.color)} />
                    <span className="text-[10px] font-semibold text-muted-foreground/60">{a.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{a.value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ITIL Pipeline Status ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Security Events",   value: securityEvents.length, sub: `${unprocessed.length} unprocessed`, icon: Activity,    color: "text-amber-400" },
          { label: "Exception Events",  value: exceptions.length,     sub: "require ITIL Incident",            icon: ShieldAlert,  color: "text-red-400" },
          { label: "Open Incidents",    value: openIncidents.length,   sub: "ITIL Incident Management",         icon: Zap,          color: "text-orange-400" },
          { label: "Open Problems",     value: openProblems.length,    sub: "ITIL Problem Management",          icon: FileWarning,  color: "text-violet-400" },
        ].map(k => (
          <Card key={k.label} className="bg-card/60 border-border/40">
            <CardContent className="p-4 flex items-start gap-3">
              <k.icon className={cn("h-5 w-5 shrink-0 mt-0.5", k.color)} />
              <div>
                <p className={cn("text-xl font-bold font-mono", k.color)}>{k.value}</p>
                <p className="text-[11px] font-medium text-foreground/80 mt-0.5">{k.label}</p>
                <p className="text-[9px] text-muted-foreground/40">{k.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── ITIL Process Flow ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto p-3 rounded-xl border border-border/30 bg-card/40">
        {[
          { label: "Event Detection",  count: securityEvents.length,   color: "bg-sky-500/15 text-sky-300 border-sky-500/25",     icon: Activity },
          { label: "ITIL Triage",      count: unprocessed.length,      color: "bg-amber-500/15 text-amber-300 border-amber-500/25", icon: Brain },
          { label: "Incident",         count: openIncidents.length,    color: "bg-red-500/15 text-red-300 border-red-500/25",     icon: ShieldAlert },
          { label: "Problem",          count: openProblems.length,     color: "bg-violet-500/15 text-violet-300 border-violet-500/25", icon: FileWarning },
          { label: "Change (RFC)",     count: 0,                       color: "bg-blue-500/15 text-blue-300 border-blue-500/25",  icon: Wrench },
          { label: "Resolved",         count: incidents.filter((i: any) => i.status === "resolved").length, color: "bg-green-500/15 text-green-300 border-green-500/25", icon: CheckCircle2 },
        ].map((step, i, arr) => (
          <div key={step.label} className="flex items-center gap-1 shrink-0">
            <div className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-medium", step.color)}>
              <step.icon className="h-3 w-3 shrink-0" />
              <span>{step.label}</span>
              <span className="font-mono font-bold ml-0.5">({step.count})</span>
            </div>
            {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
          </div>
        ))}
      </div>

      {/* ── Unified Event Stream ──────────────────────────────────── */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-amber-400" /> Unified ITIL Event Stream
            </CardTitle>
            <div className="flex items-center gap-1">
              {(["all", "security", "operational"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn("px-3 py-1 rounded-md text-[11px] font-medium transition-colors capitalize",
                    activeTab === tab ? "bg-primary/15 text-primary" : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/10"
                  )}
                  data-testid={`tab-${tab}`}
                >
                  {tab} {tab === "security" ? `(${securityRows.length})` : tab === "operational" ? `(${operationalRows.length})` : `(${allRows.length})`}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dataLoading ? (
            <div className="flex items-center gap-3 py-10 justify-center text-muted-foreground/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading live event stream from DB…</span>
            </div>
          ) : displayRows.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground/40">
              {activeTab === "operational" && !triage ? "AI triage is generating operational events…" : "No events in this view"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/10">
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">ITIL Type</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Stream</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Event</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Source</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Severity</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">ITIL Process</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row: any) => {
                    const itilMeta = ITIL_STYLE[row.itilType] ?? ITIL_STYLE.Informational;
                    const ItilIcon = itilMeta.icon;
                    const processStyle = PROCESS_STYLE[row.itilProcess] ?? "";
                    return (
                      <tr key={row.id} className="border-b border-border/20 hover:bg-muted/5 transition-colors" data-testid={`event-row-${row.id}`}>
                        <td className="p-3">
                          <Badge className={cn("text-[9px] px-1.5 py-0 border gap-1 inline-flex items-center", itilMeta.color)}>
                            <ItilIcon className="h-2.5 w-2.5" />{row.itilType}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={cn("text-[9px] px-1.5 py-0 border",
                            row.stream === "security" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          )}>
                            {row.stream === "security" ? "Security" : "Operational"}
                          </Badge>
                        </td>
                        <td className="p-3 max-w-[260px]">
                          <p className="font-medium text-foreground/90 truncate leading-tight" title={row.description ?? row.message}>
                            {row.description ?? row.message}
                          </p>
                          {row.asset && <p className="text-[9px] text-muted-foreground/40 mt-0.5">{row.asset}</p>}
                        </td>
                        <td className="p-3 text-muted-foreground/50 text-[10px] max-w-[100px] truncate">{row.source}</td>
                        <td className="p-3">
                          <span className={cn("text-[10px] font-semibold",
                            row.severity === "critical" ? "text-red-400" :
                            row.severity === "high" ? "text-orange-400" :
                            row.severity === "medium" ? "text-yellow-400" : "text-muted-foreground/50"
                          )}>
                            {row.severity}
                          </span>
                        </td>
                        <td className="p-3">
                          {row.itilProcess && (
                            <Badge className={cn("text-[9px] px-1.5 py-0 border", processStyle)}>{row.itilProcess}</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {row.action === "raise_incident" || row.itilType === "Exception" ? (
                            <Button
                              size="sm" variant="destructive"
                              className="h-6 text-[10px] px-2 gap-1"
                              onClick={() => raiseMutation.mutate(row)}
                              disabled={raiseMutation.isPending}
                              data-testid={`button-raise-${row.id}`}
                            >
                              <Zap className="h-2.5 w-2.5" /> Raise P{row.severity === "critical" ? "1" : "2"}
                            </Button>
                          ) : row.action === "create_problem" || row.itilType === "Warning" ? (
                            <Button size="sm" variant="outline"
                              className="h-6 text-[10px] px-2 gap-1 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                              onClick={() => toast({ title: "Monitoring", description: `${row.source} event added to watch queue` })}
                              data-testid={`button-watch-${row.id}`}
                            >
                              <Clock className="h-2.5 w-2.5" /> Watch
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost"
                              className="h-6 text-[10px] px-2 text-muted-foreground/40"
                              onClick={() => toast({ title: "Event logged", description: "Informational event acknowledged" })}
                              data-testid={`button-log-${row.id}`}
                            >
                              <CheckCircle2 className="h-2.5 w-2.5" /> Acknowledge
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Open Incidents from DB ────────────────────────────────── */}
      {openIncidents.length > 0 && (
        <Card className="bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-400" /> Active ITIL Incidents
              <Badge className="text-[9px] px-1.5 py-0 bg-red-500/15 text-red-300 border border-red-500/25">{openIncidents.length} open</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/10">
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Title</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Severity</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Status</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Category</th>
                    <th className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {openIncidents.map((inc: any) => (
                    <tr key={inc.id} className="border-b border-border/20 hover:bg-muted/5" data-testid={`incident-row-${inc.id}`}>
                      <td className="p-3 font-medium text-foreground/80 max-w-[280px] truncate">{inc.title}</td>
                      <td className="p-3">
                        <span className={cn("font-semibold text-[10px]",
                          inc.severity === "critical" ? "text-red-400" : inc.severity === "high" ? "text-orange-400" : "text-yellow-400"
                        )}>{inc.severity}</span>
                      </td>
                      <td className="p-3">
                        <Badge className={cn("text-[9px] px-1.5 py-0 border",
                          inc.status === "open" ? "bg-red-500/15 text-red-400 border-red-500/25" :
                          inc.status === "in_progress" ? "bg-blue-500/15 text-blue-400 border-blue-500/25" :
                          "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
                        )}>{inc.status}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground/50">{inc.category}</td>
                      <td className="p-3 text-muted-foreground/50">{inc.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
